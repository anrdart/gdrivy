import { create } from 'zustand'
import type { 
  ParsedLink, 
  FileMetadata, 
  FolderMetadata, 
  DownloadProgress 
} from '../types'
import { LinkParserService } from '../services/linkParser'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface AppState {
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
  startDownload: (fileId: string, fileName?: string, fileSize?: number) => void
  cancelDownload: (fileId: string) => void
  retryDownload: (fileId: string) => void
  clearCompleted: () => void
  updateDownloadProgress: (fileId: string, progress: Partial<DownloadProgress>) => void
  
  // Helper for calculating folder progress
  calculateFolderProgress: (fileIds: string[]) => number
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentLink: '',
  parsedLink: null,
  metadata: null,
  isLoadingMetadata: false,
  metadataError: null,
  downloads: new Map(),

  // Set link and automatically parse it
  setLink: (link: string) => {
    const parsedLink = LinkParserService.parse(link)
    set({
      currentLink: link,
      parsedLink,
      // Clear previous metadata when link changes
      metadata: null,
      metadataError: null,
    })
  },

  // Fetch metadata from API
  fetchMetadata: async (id: string, type: 'file' | 'folder') => {
    set({ isLoadingMetadata: true, metadataError: null })

    try {
      const endpoint = type === 'folder' 
        ? `${API_BASE_URL}/api/folder/${id}/files`
        : `${API_BASE_URL}/api/metadata/${id}`

      const response = await fetch(endpoint)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch metadata')
      }

      // Transform folder response to FolderMetadata format
      if (type === 'folder' && data.data) {
        const folderData = data.data as { folderId: string; folderName: string; files: FileMetadata[] }
        const folderMetadata: FolderMetadata = {
          id: folderData.folderId,
          name: folderData.folderName,
          files: folderData.files,
          totalSize: folderData.files.reduce((sum, file) => sum + file.size, 0),
        }
        set({ metadata: folderMetadata, isLoadingMetadata: false })
      } else {
        set({ metadata: data.data, isLoadingMetadata: false })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      set({ metadataError: errorMessage, isLoadingMetadata: false })
    }
  },

  // Start a download
  startDownload: (fileId: string, fileName?: string, fileSize?: number) => {
    const { downloads, metadata } = get()
    const newDownloads = new Map(downloads)

    // Get file name and size from metadata if not provided
    let resolvedFileName = fileName
    let resolvedFileSize = fileSize
    if (metadata) {
      if ('files' in metadata) {
        // It's a folder, find the file
        const file = metadata.files.find(f => f.id === fileId)
        if (!resolvedFileName) resolvedFileName = file?.name || 'Unknown file'
        if (resolvedFileSize === undefined) resolvedFileSize = file?.size || 0
      } else if (metadata.id === fileId) {
        if (!resolvedFileName) resolvedFileName = metadata.name
        if (resolvedFileSize === undefined) resolvedFileSize = metadata.size || 0
      }
    }

    const downloadProgress: DownloadProgress = {
      fileId,
      fileName: resolvedFileName || 'Unknown file',
      progress: 0,
      speed: 0,
      status: 'pending',
      fileSize: resolvedFileSize || 0,
    }

    newDownloads.set(fileId, downloadProgress)
    set({ downloads: newDownloads })
  },

  // Cancel a download
  cancelDownload: (fileId: string) => {
    const { downloads } = get()
    const newDownloads = new Map(downloads)
    const download = newDownloads.get(fileId)

    if (download) {
      newDownloads.set(fileId, {
        ...download,
        status: 'cancelled',
        error: 'Download cancelled by user',
      })
      set({ downloads: newDownloads })
    }
  },

  // Retry a failed or cancelled download
  retryDownload: (fileId: string) => {
    const { downloads } = get()
    const newDownloads = new Map(downloads)
    const download = newDownloads.get(fileId)

    if (download && (download.status === 'failed' || download.status === 'cancelled')) {
      newDownloads.set(fileId, {
        ...download,
        progress: 0,
        speed: 0,
        status: 'pending',
        error: undefined,
      })
      set({ downloads: newDownloads })
    }
  },

  // Clear completed downloads
  clearCompleted: () => {
    const { downloads } = get()
    const newDownloads = new Map(downloads)

    for (const [fileId, download] of newDownloads) {
      if (download.status === 'completed') {
        newDownloads.delete(fileId)
      }
    }

    set({ downloads: newDownloads })
  },

  // Update download progress
  updateDownloadProgress: (fileId: string, progress: Partial<DownloadProgress>) => {
    const { downloads } = get()
    const newDownloads = new Map(downloads)
    const download = newDownloads.get(fileId)

    if (download) {
      newDownloads.set(fileId, {
        ...download,
        ...progress,
      })
      set({ downloads: newDownloads })
    }
  },

  // Calculate overall folder progress
  // Property 6: Progress Calculation Accuracy
  // For any folder download with N files, the overall progress percentage 
  // SHALL equal the sum of individual file progress percentages divided by N
  calculateFolderProgress: (fileIds: string[]): number => {
    const { downloads } = get()
    
    if (fileIds.length === 0) {
      return 0
    }

    let totalProgress = 0
    for (const fileId of fileIds) {
      const download = downloads.get(fileId)
      if (download) {
        totalProgress += download.progress
      }
    }

    return totalProgress / fileIds.length
  },
}))

export default useAppStore
