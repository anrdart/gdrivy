import type { ParsedLink } from '../types'

/**
 * LinkParserService - Parses Google Drive URLs and extracts file/folder IDs
 * 
 * Supported URL formats:
 * - https://drive.google.com/file/d/{fileId}/view
 * - https://drive.google.com/file/d/{fileId}/view?usp=sharing
 * - https://drive.google.com/open?id={fileId}
 * - https://drive.google.com/drive/folders/{folderId}
 * - https://drive.google.com/drive/folders/{folderId}?usp=sharing
 */
export class LinkParserService {
  // Regex patterns for different Google Drive URL formats
  // Require https:// or http:// protocol and exact domain match (not subdomain)
  private static readonly FILE_D_PATTERN = /^https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
  private static readonly OPEN_ID_PATTERN = /^https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/
  private static readonly FOLDER_PATTERN = /^https?:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/

  /**
   * Parse a Google Drive URL and extract the file/folder ID
   * @param url - The URL to parse
   * @returns ParsedLink object if valid, null otherwise
   */
  static parse(url: string): ParsedLink | null {
    if (!url || typeof url !== 'string') {
      return null
    }

    const trimmedUrl = url.trim()
    
    if (!this.isValidGoogleDriveUrl(trimmedUrl)) {
      return null
    }

    // Try to extract file ID first
    const fileId = this.extractFileId(trimmedUrl)
    if (fileId) {
      return {
        type: 'file',
        id: fileId,
        originalUrl: trimmedUrl
      }
    }

    // Try to extract folder ID
    const folderId = this.extractFolderId(trimmedUrl)
    if (folderId) {
      return {
        type: 'folder',
        id: folderId,
        originalUrl: trimmedUrl
      }
    }

    return null
  }

  /**
   * Check if a URL is a valid Google Drive URL
   * @param url - The URL to validate
   * @returns true if valid Google Drive URL, false otherwise
   */
  static isValidGoogleDriveUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false
    }

    const trimmedUrl = url.trim()
    
    // Must start with http:// or https:// and have exact domain drive.google.com
    if (!trimmedUrl.match(/^https?:\/\/drive\.google\.com\//)) {
      return false
    }

    // Must match one of the supported patterns
    return (
      this.FILE_D_PATTERN.test(trimmedUrl) ||
      this.OPEN_ID_PATTERN.test(trimmedUrl) ||
      this.FOLDER_PATTERN.test(trimmedUrl)
    )
  }

  /**
   * Extract file ID from a Google Drive URL
   * @param url - The URL to extract from
   * @returns File ID if found, null otherwise
   */
  static extractFileId(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null
    }

    const trimmedUrl = url.trim()

    // Try /file/d/{id} pattern
    const fileDMatch = trimmedUrl.match(this.FILE_D_PATTERN)
    if (fileDMatch && fileDMatch[1]) {
      return fileDMatch[1]
    }

    // Try /open?id={id} pattern
    const openIdMatch = trimmedUrl.match(this.OPEN_ID_PATTERN)
    if (openIdMatch && openIdMatch[1]) {
      return openIdMatch[1]
    }

    return null
  }

  /**
   * Extract folder ID from a Google Drive URL
   * @param url - The URL to extract from
   * @returns Folder ID if found, null otherwise
   */
  static extractFolderId(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null
    }

    const trimmedUrl = url.trim()

    const folderMatch = trimmedUrl.match(this.FOLDER_PATTERN)
    if (folderMatch && folderMatch[1]) {
      return folderMatch[1]
    }

    return null
  }

  /**
   * Reconstruct a Google Drive URL from a ParsedLink
   * @param parsedLink - The parsed link to reconstruct
   * @returns Reconstructed URL
   */
  static reconstructUrl(parsedLink: ParsedLink): string {
    if (parsedLink.type === 'file') {
      return `https://drive.google.com/file/d/${parsedLink.id}/view`
    }
    return `https://drive.google.com/drive/folders/${parsedLink.id}`
  }
}

export default LinkParserService
