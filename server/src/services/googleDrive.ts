import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

// Error codes matching the design document
export enum ErrorCode {
  INVALID_LINK = 'INVALID_LINK',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  API_ERROR = 'API_ERROR',
}

export interface FileMetadata {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  iconLink?: string
}

export interface FolderMetadata {
  id: string
  name: string
  files: FileMetadata[]
  totalSize: number
}

export class GoogleDriveError extends Error {
  statusCode: number
  code: ErrorCode

  constructor(message: string, code: ErrorCode, statusCode: number = 500) {
    super(message)
    this.name = 'GoogleDriveError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class GoogleDriveService {
  private drive: drive_v3.Drive

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY
    
    if (!key) {
      console.warn('Warning: GOOGLE_API_KEY not set. API calls will fail.')
    }

    this.drive = google.drive({
      version: 'v3',
      auth: key,
    })
  }

  /**
   * Fetch metadata for a file or folder
   */
  async getMetadata(fileId: string): Promise<FileMetadata | FolderMetadata> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, iconLink',
        supportsAllDrives: true,
      })

      const file = response.data

      if (!file.id || !file.name) {
        throw new GoogleDriveError(
          'Invalid file metadata received',
          ErrorCode.API_ERROR,
          500
        )
      }

      // Check if it's a folder
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const files = await this.listFolderFiles(fileId)
        const totalSize = files.reduce((sum, f) => sum + f.size, 0)
        
        return {
          id: file.id,
          name: file.name,
          files,
          totalSize,
        } as FolderMetadata
      }

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || 'application/octet-stream',
        size: parseInt(file.size || '0', 10),
        modifiedTime: file.modifiedTime || new Date().toISOString(),
        iconLink: file.iconLink || undefined,
      } as FileMetadata
    } catch (error) {
      throw this.handleApiError(error)
    }
  }

  /**
   * List all files in a folder
   */
  async listFolderFiles(folderId: string): Promise<FileMetadata[]> {
    try {
      const files: FileMetadata[] = []
      let pageToken: string | undefined

      do {
        const response = await this.drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink)',
          pageSize: 100,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })

        if (response.data.files) {
          for (const file of response.data.files) {
            if (file.id && file.name) {
              files.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType || 'application/octet-stream',
                size: parseInt(file.size || '0', 10),
                modifiedTime: file.modifiedTime || new Date().toISOString(),
                iconLink: file.iconLink || undefined,
              })
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined
      } while (pageToken)

      return files
    } catch (error) {
      throw this.handleApiError(error)
    }
  }

  /**
   * Get a readable stream for downloading a file
   */
  async getFileStream(fileId: string): Promise<{
    stream: import('stream').Readable
    metadata: FileMetadata
  }> {
    try {
      // First get metadata to know file info
      const metadataResponse = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime',
        supportsAllDrives: true,
      })

      const file = metadataResponse.data

      if (!file.id || !file.name) {
        throw new GoogleDriveError(
          'Invalid file metadata received',
          ErrorCode.API_ERROR,
          500
        )
      }

      // Check if it's a Google Docs type that needs export
      const isGoogleDoc = file.mimeType?.startsWith('application/vnd.google-apps.')
      
      let stream: import('stream').Readable

      if (isGoogleDoc) {
        // Export Google Docs to appropriate format
        const exportMimeType = this.getExportMimeType(file.mimeType!)
        const response = await this.drive.files.export(
          { fileId, mimeType: exportMimeType },
          { responseType: 'stream' }
        )
        stream = response.data as unknown as import('stream').Readable
      } else {
        // Regular file download - use acknowledgeAbuse for large files
        const response = await this.drive.files.get(
          { 
            fileId, 
            alt: 'media', 
            supportsAllDrives: true,
            acknowledgeAbuse: true // Allow downloading files flagged as potential abuse
          },
          { responseType: 'stream' }
        )
        stream = response.data as unknown as import('stream').Readable
      }

      return {
        stream,
        metadata: {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          size: parseInt(file.size || '0', 10),
          modifiedTime: file.modifiedTime || new Date().toISOString(),
        },
      }
    } catch (error) {
      throw this.handleApiError(error)
    }
  }

  /**
   * Get export MIME type for Google Docs
   */
  private getExportMimeType(googleMimeType: string): string {
    const exportMap: Record<string, string> = {
      'application/vnd.google-apps.document': 'application/pdf',
      'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.google-apps.presentation': 'application/pdf',
      'application/vnd.google-apps.drawing': 'image/png',
    }
    return exportMap[googleMimeType] || 'application/pdf'
  }

  /**
   * Handle Google API errors and convert to our error types
   */
  private handleApiError(error: unknown): GoogleDriveError {
    // --- DEBUG LOGGING ---
    console.error("🔥🔥🔥 DEBUG ERROR GOOGLE:", error);
    const anyError = error as any;
    if (anyError.response) {
      console.error("📦 DATA DARI GOOGLE:", JSON.stringify(anyError.response.data, null, 2));
    }
    // ---------------------

    if (error instanceof GoogleDriveError) {
      return error
    }

    const gaxiosError = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> }
    const statusCode = gaxiosError.code || 500
    const reason = gaxiosError.errors?.[0]?.reason

    switch (statusCode) {
      case 404:
        return new GoogleDriveError(
          'File tidak ditemukan atau sudah dihapus.',
          ErrorCode.FILE_NOT_FOUND,
          404
        )
      case 403:
        if (reason === 'userRateLimitExceeded' || reason === 'rateLimitExceeded') {
          return new GoogleDriveError(
            'Kuota download Google Drive telah habis.',
            ErrorCode.QUOTA_EXCEEDED,
            429
          )
        }
        return new GoogleDriveError(
          'File ini bersifat private atau memerlukan izin akses.',
          ErrorCode.ACCESS_DENIED,
          403
        )
      case 401:
        return new GoogleDriveError(
          'API key tidak valid atau tidak memiliki izin.',
          ErrorCode.ACCESS_DENIED,
          401
        )
      default:
        return new GoogleDriveError(
          gaxiosError.message || 'Terjadi kesalahan pada server.',
          ErrorCode.API_ERROR,
          statusCode
        )
    }
  }
}

// Singleton instance
let driveServiceInstance: GoogleDriveService | null = null

export function getGoogleDriveService(): GoogleDriveService {
  if (!driveServiceInstance) {
    driveServiceInstance = new GoogleDriveService()
  }
  return driveServiceInstance
}
