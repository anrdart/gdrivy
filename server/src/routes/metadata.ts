import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { getGoogleDriveService, GoogleDriveError, ErrorCode } from '../services/googleDrive.js'

export const metadataRouter = Router()

// GET /api/metadata/:fileId
// Fetches file or folder metadata from Google Drive API v3
metadataRouter.get('/:fileId', async (req: Request, res: Response, next: NextFunction) => {
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
    const metadata = await driveService.getMetadata(fileId)
    
    res.json({
      success: true,
      data: metadata,
    })
  } catch (error) {
    next(error)
  }
})
