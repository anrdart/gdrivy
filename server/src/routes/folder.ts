import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { getGoogleDriveService, GoogleDriveError, ErrorCode } from '../services/googleDrive.js'

export const folderRouter = Router()

// GET /api/folder/:folderId/files
// Lists all files in a Google Drive folder
folderRouter.get('/:folderId/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { folderId } = req.params
    
    if (!folderId || folderId.trim() === '') {
      throw new GoogleDriveError(
        'Folder ID is required',
        ErrorCode.INVALID_LINK,
        400
      )
    }

    const driveService = getGoogleDriveService()
    
    // First get folder metadata to get the folder name
    const folderMetadata = await driveService.getMetadata(folderId)
    
    // Check if it's actually a folder
    if (!('files' in folderMetadata)) {
      throw new GoogleDriveError(
        'The provided ID is not a folder',
        ErrorCode.INVALID_LINK,
        400
      )
    }
    
    res.json({
      success: true,
      data: {
        folderId: folderMetadata.id,
        folderName: folderMetadata.name,
        files: folderMetadata.files,
        totalSize: folderMetadata.totalSize,
      },
    })
  } catch (error) {
    next(error)
  }
})
