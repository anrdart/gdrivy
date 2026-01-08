import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { getGoogleDriveService, GoogleDriveError, ErrorCode } from '../services/googleDrive.js'
import { extractUserToken } from '../middleware/auth.js'

export const metadataRouter = Router()

// Apply auth middleware to extract user token
metadataRouter.use(extractUserToken)

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

    // Use user token if available, otherwise fallback to API key
    const driveService = getGoogleDriveService(req.accessToken)
    const metadata = await driveService.getMetadata(fileId)
    
    res.json({
      success: true,
      data: metadata,
    })
  } catch (error) {
    next(error)
  }
})
