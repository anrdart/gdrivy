import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { getGoogleDriveService, GoogleDriveError, ErrorCode } from '../services/googleDrive.js'
import { extractUserToken } from '../middleware/auth.js'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'

export const downloadRouter = Router()

// Apply auth middleware to extract user token
downloadRouter.use(extractUserToken)

// GET /api/download/:fileId
// Streams file content from Google Drive with progress headers
// Query params (optional, for faster download):
//   - name: file name
//   - mimeType: file MIME type
//   - size: file size in bytes
downloadRouter.get('/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  let stream: Readable | null = null
  let isClientDisconnected = false
  
  try {
    const { fileId } = req.params
    const { name, mimeType, size } = req.query
    
    if (!fileId || fileId.trim() === '') {
      throw new GoogleDriveError(
        'File ID is required',
        ErrorCode.INVALID_LINK,
        400
      )
    }

    // Use user token if available, otherwise fallback to API key
    const driveService = getGoogleDriveService(req.accessToken)
    
    // Pass known metadata to skip extra API call if available
    const knownMetadata = (name && mimeType && size) ? {
      name: decodeURIComponent(name as string),
      mimeType: decodeURIComponent(mimeType as string),
      size: parseInt(size as string, 10),
    } : undefined
    
    const result = await driveService.getFileStream(fileId, knownMetadata)
    stream = result.stream as Readable
    const metadata = result.metadata
    
    // Set response headers for download
    const fileName = encodeURIComponent(metadata.name)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`)
    res.setHeader('Content-Type', metadata.mimeType)
    
    // Set Content-Length if available for progress tracking
    if (metadata.size > 0) {
      res.setHeader('Content-Length', metadata.size.toString())
    }
    
    // Handle client disconnect
    req.on('close', () => {
      isClientDisconnected = true
      if (stream && !stream.destroyed) {
        stream.destroy()
      }
    })
    
    // Use pipeline for better error handling and backpressure management
    await pipeline(stream, res)
    
  } catch (error) {
    // Clean up stream if it exists
    if (stream && !stream.destroyed) {
      stream.destroy()
    }
    
    // Don't send error if client disconnected - that's expected behavior
    if (isClientDisconnected) {
      return
    }
    
    // Check if it's a pipeline error due to client disconnect
    if (error instanceof Error && error.message.includes('Premature close')) {
      return
    }
    
    next(error)
  }
})
