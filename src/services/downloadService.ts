import type { FileMetadata, FolderMetadata, AppError } from '../types'
import { ErrorCode } from '../types'
import { createAppError } from './errorHandler'
import { getRetryManager } from './retryManager'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Progress callback type for download operations
 */
export type ProgressCallback = (progress: number, speed: number) => void

/**
 * Folder progress callback type for batch downloads
 */
export type FolderProgressCallback = (fileId: string, progress: number, speed: number) => void

/**
 * Download result type
 */
export interface DownloadResult {
  success: boolean
  blob?: Blob
  fileName?: string
  error?: AppError
}

/**
 * DownloadService - Handles file downloads from Google Drive via backend proxy
 * 
 * Requirements: 3.1, 4.2, 4.4
 * - WHEN a user clicks the download button for a file THEN the Download_Manager SHALL initiate the download process
 * - WHEN a user initiates folder download THEN the Download_Manager SHALL download files sequentially
 * - WHEN all files in a folder are downloaded THEN the User_Interface SHALL provide option to download as ZIP archive
 */
export class DownloadService {
  private retryManager = getRetryManager()
  private abortControllers: Map<string, AbortController> = new Map()

  /**
   * Fetch metadata for a file or folder
   * @param id - File or folder ID
   * @param type - 'file' or 'folder'
   */
  async fetchMetadata(id: string, type: 'file' | 'folder'): Promise<FileMetadata | FolderMetadata> {
    const endpoint = type === 'folder'
      ? `${API_BASE_URL}/api/folder/${id}/files`
      : `${API_BASE_URL}/api/metadata/${id}`

    const response = await fetch(endpoint, {
      credentials: 'include', // Include cookies for authenticated requests (Requirements: 3.1, 3.2)
    })
    const data = await response.json()

    if (!response.ok || !data.success) {
      const errorCode = this.mapHttpErrorToCode(response.status, data.error?.code)
      throw createAppError(errorCode)
    }

    // Transform folder response to FolderMetadata format
    if (type === 'folder' && data.data) {
      const folderData = data.data as { folderId: string; folderName: string; files: FileMetadata[]; totalSize?: number }
      return {
        id: folderData.folderId,
        name: folderData.folderName,
        files: folderData.files,
        totalSize: folderData.totalSize || folderData.files.reduce((sum, file) => sum + file.size, 0),
      }
    }

    return data.data
  }


  /**
   * Download a single file with progress tracking
   * @param fileId - Google Drive file ID
   * @param onProgress - Progress callback (progress: 0-100, speed: bytes/sec)
   * @param expectedFileName - Optional expected filename with extension (from metadata)
   * @param fileMetadata - Optional file metadata to skip server-side metadata fetch
   * 
   * Requirements: 3.1, 3.2
   * - WHEN a logged-in user pastes a private file link THEN the Google_Drive_Service SHALL use the user's access token to fetch metadata
   * - WHEN a logged-in user downloads a private file THEN the Google_Drive_Service SHALL authenticate the request with the user's token
   */
  async downloadFile(
    fileId: string, 
    onProgress?: ProgressCallback, 
    expectedFileName?: string,
    fileMetadata?: { mimeType: string; size: number }
  ): Promise<DownloadResult> {
    const operationId = `download-${fileId}`
    
    // Create abort controller for this download
    const abortController = new AbortController()
    this.abortControllers.set(fileId, abortController)

    try {
      const result = await this.retryManager.executeWithRetry(
        operationId,
        async () => {
          // Build URL with optional metadata params for faster download
          let url = `${API_BASE_URL}/api/download/${fileId}`
          if (expectedFileName && fileMetadata) {
            const params = new URLSearchParams({
              name: expectedFileName,
              mimeType: fileMetadata.mimeType,
              size: fileMetadata.size.toString(),
            })
            url += `?${params.toString()}`
          }
          
          const response = await fetch(url, {
            signal: abortController.signal,
            credentials: 'include', // Include cookies for authenticated requests (Requirements: 3.1, 3.2)
          })

          // Handle 401 Unauthorized - token may be expired or invalid
          if (response.status === 401) {
            const errorCode = ErrorCode.ACCESS_DENIED
            throw createAppError(errorCode)
          }

          if (!response.ok) {
            const errorCode = this.mapHttpErrorToCode(response.status)
            throw createAppError(errorCode)
          }

          // Get content length for progress calculation
          const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10)
          
          // Get MIME type from Content-Type header for proper blob creation
          const contentType = response.headers.get('Content-Type') || 'application/octet-stream'
          
          // Get filename from Content-Disposition header, fallback to expected filename from metadata
          const contentDisposition = response.headers.get('Content-Disposition')
          const extractedFileName = this.extractFileName(contentDisposition)
          let fileName = extractedFileName || expectedFileName || `file-${fileId}`
          
          // Ensure filename has correct extension based on MIME type
          fileName = this.ensureFileExtension(fileName, contentType)

          // Read the response as a stream for progress tracking
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('Response body is not readable')
          }

          const chunks: BlobPart[] = []
          let receivedLength = 0
          let lastTime = Date.now()
          let lastBytes = 0

          while (true) {
            const { done, value } = await reader.read()
            
            if (done) break
            
            chunks.push(value)
            receivedLength += value.length

            // Calculate progress and speed
            const now = Date.now()
            const timeDiff = (now - lastTime) / 1000 // seconds
            
            if (timeDiff >= 0.1 && onProgress) { // Update every 100ms
              const bytesDiff = receivedLength - lastBytes
              const speed = bytesDiff / timeDiff
              const progress = contentLength > 0 
                ? (receivedLength / contentLength) * 100 
                : 0
              
              onProgress(progress, speed)
              
              lastTime = now
              lastBytes = receivedLength
            }
          }

          // Final progress update
          if (onProgress) {
            onProgress(100, 0)
          }

          // Combine chunks into a single blob with correct MIME type
          const blob = new Blob(chunks, { type: contentType })
          return { blob, fileName }
        }
      )

      if (result.success && result.data) {
        return {
          success: true,
          blob: result.data.blob,
          fileName: result.data.fileName,
        }
      }

      return {
        success: false,
        error: result.error,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: createAppError(ErrorCode.DOWNLOAD_FAILED),
        }
      }
      throw error
    } finally {
      this.abortControllers.delete(fileId)
    }
  }


  /**
   * Download all files from a folder sequentially
   * @param folderId - Google Drive folder ID
   * @param files - Array of file metadata to download
   * @param onProgress - Progress callback for each file
   */
  async downloadFolder(
    folderId: string,
    files: FileMetadata[],
    onProgress?: FolderProgressCallback
  ): Promise<Map<string, DownloadResult>> {
    const results = new Map<string, DownloadResult>()

    // Download files sequentially
    for (const file of files) {
      // Check if download was cancelled
      if (this.abortControllers.has(folderId)) {
        const controller = this.abortControllers.get(folderId)
        if (controller?.signal.aborted) {
          break
        }
      }

      const result = await this.downloadFile(
        file.id,
        onProgress 
          ? (progress, speed) => onProgress(file.id, progress, speed)
          : undefined
      )

      results.set(file.id, result)

      // If download failed and it's not a retryable error, continue with next file
      // This allows partial folder downloads
    }

    return results
  }

  /**
   * Cancel an ongoing download
   * @param fileId - File ID to cancel
   */
  cancelDownload(fileId: string): void {
    const controller = this.abortControllers.get(fileId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(fileId)
    }
  }

  /**
   * Trigger browser download for a blob
   * @param blob - File blob
   * @param fileName - File name for download
   */
  triggerBrowserDownload(blob: Blob, fileName: string): void {
    // Ensure the blob has the correct MIME type based on file extension if not set
    let downloadBlob = blob
    if (blob.type === '' || blob.type === 'application/octet-stream') {
      const mimeType = this.getMimeTypeFromFileName(fileName)
      if (mimeType) {
        downloadBlob = new Blob([blob], { type: mimeType })
      }
    }
    
    const url = URL.createObjectURL(downloadBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromFileName(fileName: string): string | null {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext) return null

    return this.extensionToMimeType[ext] || null
  }

  /**
   * Known valid file extensions
   */
  private readonly validExtensions = new Set([
    // Video
    'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', '3gp', 'm4v', 'mpeg', 'mpg',
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif',
    // Documents
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
    // Archives
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
    // Text/Code
    'txt', 'html', 'htm', 'css', 'js', 'ts', 'json', 'xml', 'csv', 'md', 'yaml', 'yml',
    // Other
    'exe', 'dmg', 'apk', 'iso',
  ])

  /**
   * Extension to MIME type mapping
   */
  private readonly extensionToMimeType: Record<string, string> = {
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    '3gp': 'video/3gpp',
    'm4v': 'video/x-m4v',
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpeg',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'wma': 'audio/x-ms-wma',
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    // Text
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv',
  }

  /**
   * MIME type to extension mapping
   */
  private readonly mimeTypeToExtension: Record<string, string> = {
    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'video/x-msvideo': 'avi',
    'video/quicktime': 'mov',
    'video/x-ms-wmv': 'wmv',
    'video/x-flv': 'flv',
    'video/3gpp': '3gp',
    'video/x-m4v': 'm4v',
    'video/mpeg': 'mpeg',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'audio/x-ms-wma': 'wma',
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/tiff': 'tiff',
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    // Archives
    'application/zip': 'zip',
    'application/vnd.rar': 'rar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
    // Text
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'text/csv': 'csv',
  }

  /**
   * Check if filename has a valid known extension
   */
  private hasValidExtension(fileName: string): boolean {
    const lastDotIndex = fileName.lastIndexOf('.')
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
      return false
    }
    
    const ext = fileName.substring(lastDotIndex + 1).toLowerCase()
    return this.validExtensions.has(ext)
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string | null {
    // Remove charset or other parameters from MIME type
    const baseMimeType = mimeType.split(';')[0].trim().toLowerCase()
    return this.mimeTypeToExtension[baseMimeType] || null
  }

  /**
   * Ensure filename has correct extension based on MIME type
   * If filename doesn't have a valid extension, add one based on MIME type
   */
  private ensureFileExtension(fileName: string, mimeType: string): string {
    // If filename already has a valid extension, return as-is
    if (this.hasValidExtension(fileName)) {
      return fileName
    }

    // Get extension from MIME type
    const ext = this.getExtensionFromMimeType(mimeType)
    if (ext) {
      return `${fileName}.${ext}`
    }

    // If we can't determine extension, return original filename
    return fileName
  }

  /**
   * Extract filename from Content-Disposition header
   */
  private extractFileName(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null

    // Try to extract filename*=UTF-8'' format first (RFC 5987)
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match) {
      return decodeURIComponent(utf8Match[1])
    }

    // Fall back to filename="..." format
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i)
    if (filenameMatch) {
      return decodeURIComponent(filenameMatch[1])
    }

    // Try without quotes
    const simpleMatch = contentDisposition.match(/filename=([^;]+)/i)
    if (simpleMatch) {
      return decodeURIComponent(simpleMatch[1].trim())
    }

    return null
  }

  /**
   * Map HTTP status codes to ErrorCode
   */
  private mapHttpErrorToCode(status: number, serverCode?: string): ErrorCode {
    // Check server-provided error code first
    if (serverCode && Object.values(ErrorCode).includes(serverCode as ErrorCode)) {
      return serverCode as ErrorCode
    }

    switch (status) {
      case 400:
        return ErrorCode.INVALID_LINK
      case 401:
      case 403:
        return ErrorCode.ACCESS_DENIED
      case 404:
        return ErrorCode.FILE_NOT_FOUND
      case 429:
        return ErrorCode.QUOTA_EXCEEDED
      case 500:
      case 502:
      case 503:
        return ErrorCode.API_ERROR
      default:
        return ErrorCode.NETWORK_ERROR
    }
  }
}

// Singleton instance
let downloadServiceInstance: DownloadService | null = null

export function getDownloadService(): DownloadService {
  if (!downloadServiceInstance) {
    downloadServiceInstance = new DownloadService()
  }
  return downloadServiceInstance
}

/**
 * Create a new download service instance (useful for testing)
 */
export function createDownloadService(): DownloadService {
  return new DownloadService()
}

export default DownloadService
