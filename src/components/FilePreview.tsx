import { FiFile, FiFolder, FiDownload, FiLoader, FiImage, FiVideo, FiMusic, FiFileText } from 'react-icons/fi'
import type { FileMetadata, FolderMetadata } from '../types'

interface FilePreviewProps {
  metadata: FileMetadata | FolderMetadata
  onDownload: () => void
  isLoading: boolean
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${size.toFixed(i > 0 ? 2 : 0)} ${units[i]}`
}

/**
 * Get file type display name from MIME type
 */
export function getFileTypeDisplay(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF Document',
    'application/zip': 'ZIP Archive',
    'application/x-rar-compressed': 'RAR Archive',
    'application/vnd.google-apps.folder': 'Folder',
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'text/plain': 'Text File',
    'text/html': 'HTML File',
    'text/css': 'CSS File',
    'text/javascript': 'JavaScript File',
    'application/json': 'JSON File',
  }

  // Use Object.prototype.hasOwnProperty to avoid prototype pollution issues
  if (Object.prototype.hasOwnProperty.call(typeMap, mimeType)) {
    return typeMap[mimeType]
  }

  // Handle generic types
  if (mimeType && mimeType.startsWith('image/')) return 'Image'
  if (mimeType && mimeType.startsWith('video/')) return 'Video'
  if (mimeType && mimeType.startsWith('audio/')) return 'Audio'
  if (mimeType && mimeType.startsWith('text/')) return 'Text File'

  return 'File'
}

/**
 * Get icon component based on MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType === 'application/vnd.google-apps.folder') {
    return <FiFolder className="w-8 h-8 text-yellow-400" />
  }
  if (mimeType.startsWith('image/')) {
    return <FiImage className="w-8 h-8 text-accent-400" />
  }
  if (mimeType.startsWith('video/')) {
    return <FiVideo className="w-8 h-8 text-purple-400" />
  }
  if (mimeType.startsWith('audio/')) {
    return <FiMusic className="w-8 h-8 text-pink-400" />
  }
  if (mimeType.startsWith('text/') || mimeType.includes('document')) {
    return <FiFileText className="w-8 h-8 text-primary-400" />
  }
  return <FiFile className="w-8 h-8 text-gray-400" />
}

/**
 * Check if metadata is a folder
 */
function isFolder(metadata: FileMetadata | FolderMetadata): metadata is FolderMetadata {
  return 'files' in metadata
}

/**
 * FilePreview Component
 * 
 * Displays file name, size (formatted), type, icon.
 * Download button with loading state.
 * Support for file and folder preview.
 * 
 * Requirements: 2.4, 3.1
 * - WHEN metadata is successfully fetched THEN the User_Interface SHALL display file name, size (formatted), and file type
 * - WHEN a user clicks the download button for a file THEN the Download_Manager SHALL initiate the download process
 */
export function FilePreview({ metadata, onDownload, isLoading }: FilePreviewProps) {
  const isFolderType = isFolder(metadata)
  
  // Get display values
  const name = metadata.name
  const size = isFolderType ? metadata.totalSize : metadata.size
  const formattedSize = formatFileSize(size)
  const fileType = isFolderType 
    ? `Folder (${metadata.files.length} files)` 
    : getFileTypeDisplay(metadata.mimeType)
  const mimeType = isFolderType ? 'application/vnd.google-apps.folder' : metadata.mimeType

  // Get iconLink only for file metadata
  const iconLink = !isFolderType ? metadata.iconLink : undefined

  return (
    <div className="w-full max-w-2xl mx-auto card card-hover animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        {/* File/Folder Icon */}
        <div className="flex-shrink-0 p-3 sm:p-4 bg-surface-900 rounded-xl">
          {iconLink ? (
            <img 
              src={iconLink} 
              alt="" 
              className="w-6 h-6 sm:w-8 sm:h-8"
              aria-hidden="true"
            />
          ) : (
            getFileIcon(mimeType)
          )}
        </div>

        {/* File Info */}
        <div className="flex-grow min-w-0 w-full sm:w-auto">
          {/* File Name */}
          <h2 
            className="text-base sm:text-lg lg:text-xl font-semibold text-white truncate" 
            title={name}
            data-testid="file-name"
          >
            {name}
          </h2>

          {/* File Details */}
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-2 sm:gap-3">
            <span 
              className="badge badge-info"
              data-testid="file-size"
            >
              {formattedSize}
            </span>
            <span 
              className="badge badge-neutral"
              data-testid="file-type"
            >
              {fileType}
            </span>
          </div>
        </div>
      </div>

      {/* Folder Contents Preview */}
      {isFolderType && metadata.files.length > 0 && (
        <div className="mt-4 sm:mt-5 p-3 sm:p-4 bg-surface-900 rounded-xl max-h-40 sm:max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">
            Folder Contents
          </p>
          <ul className="space-y-1.5 sm:space-y-2">
            {metadata.files.slice(0, 5).map((file) => (
              <li 
                key={file.id} 
                className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-surface-800 transition-colors"
              >
                <FiFile className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-300 truncate flex-grow">{file.name}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </li>
            ))}
            {metadata.files.length > 5 && (
              <li className="text-xs text-gray-500 pl-2 pt-2 border-t border-surface-700">
                + {metadata.files.length - 5} more files
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={onDownload}
        disabled={isLoading}
        className={`
          mt-4 sm:mt-5 w-full py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl font-semibold 
          transition-all duration-200 
          flex items-center justify-center gap-2
          text-sm sm:text-base
          active:scale-[0.98]
          ${isLoading
            ? 'bg-surface-700 text-gray-500 cursor-not-allowed'
            : 'btn-success'
          }
        `}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <FiLoader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            <span>Preparing Download...</span>
          </>
        ) : (
          <>
            <FiDownload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{isFolderType ? 'Download All Files' : 'Download File'}</span>
          </>
        )}
      </button>
    </div>
  )
}

export default FilePreview
