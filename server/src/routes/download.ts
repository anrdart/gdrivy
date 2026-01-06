import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { getGoogleDriveService, GoogleDriveError, ErrorCode } from '../services/googleDrive.js'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'

export const downloadRouter = Router()

// GET /api/download/:fileId
// Streams file content from Google Drive with progress headers
downloadRouter.get('/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  let stream: Readable | null = null
  let isClientDisconnected = false
  
  try {
    const { fileId } = req.params
    
    if (!fileId || fileId.trim() === '') {
      throw new GoogleDriveError(
        'File ID is required',
        ErrorCode.INVALID_LINK,
        400
      )
    }

    const driveService = getGoogleDriveService()
    const result = await driveService.getFileStream(fileId)
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
