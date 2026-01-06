// Parsed Link Types
export interface ParsedLink {
  type: 'file' | 'folder'
  id: string
  originalUrl: string
}

// File Metadata Types
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

// Download Progress Types
export interface DownloadProgress {
  fileId: string
  fileName: string
  progress: number // 0-100
  speed: number // bytes per second
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  error?: string
  fileSize?: number // file size in bytes
}

// Queue Item Types
export interface QueueItem {
  id: string
  metadata: FileMetadata
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  progress: number
}

// Error Types
export enum ErrorCode {
  INVALID_LINK = 'INVALID_LINK',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  API_ERROR = 'API_ERROR',
}

export interface AppError {
  code: ErrorCode
  message: string
  suggestion?: string
}

// API Response Types
export interface MetadataResponse {
  success: boolean
  data?: FileMetadata | FolderMetadata
  error?: {
    code: string
    message: string
  }
}

export interface FolderFilesResponse {
  success: boolean
  data?: {
    folderId: string
    folderName: string
    files: FileMetadata[]
  }
  error?: {
    code: string
    message: string
  }
}

// App State Types
export interface AppState {
  // Current input
  currentLink: string
  parsedLink: ParsedLink | null

  // Metadata
  metadata: FileMetadata | FolderMetadata | null
  isLoadingMetadata: boolean
  metadataError: string | null

  // Downloads
  downloads: Map<string, DownloadProgress>

  // Actions
  setLink: (link: string) => void
  fetchMetadata: (id: string, type: 'file' | 'folder') => Promise<void>
  startDownload: (fileId: string) => void
  cancelDownload: (fileId: string) => void
  retryDownload: (fileId: string) => void
  clearCompleted: () => void
}
