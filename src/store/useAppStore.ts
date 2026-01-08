import { create } from 'zustand'
import type { 
  ParsedLink, 
  FileMetadata, 
  FolderMetadata, 
  DownloadProgress,
  ErrorCode,
  AuthErrorCode 
} from '../types'
import { LinkParserService } from '../services/linkParser'
import { getAuthService, type GoogleUser, type AuthError } from '../services/authService'
import { isLoginRequiredError } from '../services/errorHandler'
import api from '../lib/api'

interface AppState {
  // Current input
  currentLink: string
  parsedLink: ParsedLink | null

  // Metadata
  metadata: FileMetadata | FolderMetadata | null
  isLoadingMetadata: boolean
  metadataError: string | null
  metadataErrorCode: ErrorCode | null
  requiresLoginForAccess: boolean

  // Downloads
  downloads: Map<string, DownloadProgress>

  // Auth state (Requirements: 2.1, 2.4, 6.1, 6.2, 6.3, 6.4)
  user: GoogleUser | null
  isAuthenticated: boolean
  isAuthLoading: boolean
  authError: string | null
  authErrorCode: AuthErrorCode | null

  // Actions
  setLink: (link: string) => void
  fetchMetadata: (id: string, type: 'file' | 'folder') => Promise<void>
  startDownload: (fileId: string, fileName?: string, fileSize?: number) => void
  cancelDownload: (fileId: string) => void
  retryDownload: (fileId: string) => void
  clearCompleted: () => void
  updateDownloadProgress: (fileId: string, progress: Partial<DownloadProgress>) => void
  clearMetadataError: () => void
  
  // Helper for calculating folder progress
  calculateFolderProgress: (fileIds: string[]) => number

  // Auth actions (Requirements: 2.1, 2.4)
  login: () => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  handleAuthCallback: () => Promise<void>
  clearAuthError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentLink: '',
  parsedLink: null,
  metadata: null,
  isLoadingMetadata: false,
  metadataError: null,
  metadataErrorCode: null,
  requiresLoginForAccess: false,
  downloads: new Map(),

  // Auth initial state (Requirements: 2.1, 2.4, 6.1, 6.2, 6.3, 6.4)
  user: null,
  isAuthenticated: false,
  isAuthLoading: false,
  authError: null,
  authErrorCode: null,

  // Set link and automatically parse it
  setLink: (link: string) => {
    const parsedLink = LinkParserService.parse(link)
    set({
      currentLink: link,
      parsedLink,
      // Clear previous metadata when link changes
      metadata: null,
      metadataError: null,
      metadataErrorCode: null,
      requiresLoginForAccess: false,
    })
  },

  // Fetch metadata from API using axios
  fetchMetadata: async (id: string, type: 'file' | 'folder') => {
    set({ isLoadingMetadata: true, metadataError: null, metadataErrorCode: null, requiresLoginForAccess: false })

    try {
      const endpoint = type === 'folder' 
        ? `/api/folder/${id}/files`
        : `/api/metadata/${id}`

      const { data } = await api.get(endpoint)

      if (!data.success) {
        const errorCode = data.error?.code as ErrorCode | undefined
        const requiresLogin = errorCode ? isLoginRequiredError(errorCode) : false
        throw { 
          message: data.error?.message || 'Failed to fetch metadata',
          code: errorCode,
          requiresLogin,
        }
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
      // Handle axios errors
      let errorMessage = 'Unknown error occurred'
      let errorCode: ErrorCode | null = null
      let requiresLogin = false

      if (error && typeof error === 'object') {
        // Check if it's an axios error with response
        if ('response' in error) {
          const axiosError = error as { response?: { data?: { error?: { code?: string; message?: string } } } }
          errorCode = axiosError.response?.data?.error?.code as ErrorCode || null
          errorMessage = axiosError.response?.data?.error?.message || errorMessage
          requiresLogin = errorCode ? isLoginRequiredError(errorCode) : false
        } else if ('message' in error) {
          // Regular error object
          const typedError = error as { message?: string; code?: ErrorCode; requiresLogin?: boolean }
          errorMessage = typedError.message || errorMessage
          errorCode = typedError.code || null
          requiresLogin = typedError.requiresLogin || false
        }
      }

      set({ 
        metadataError: errorMessage, 
        metadataErrorCode: errorCode,
        requiresLoginForAccess: requiresLogin,
        isLoadingMetadata: false,
      })
    }
  },

  // Clear metadata error
  clearMetadataError: () => {
    set({ metadataError: null, metadataErrorCode: null, requiresLoginForAccess: false })
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

  // Auth Actions (Requirements: 2.1, 2.4, 6.1, 6.2, 6.3, 6.4)

  /**
   * Initiate login - redirects to Google OAuth
   */
  login: async () => {
    set({ isAuthLoading: true, authError: null, authErrorCode: null })
    try {
      const authService = getAuthService()
      await authService.initiateLogin()
      // Note: This will redirect, so we won't reach here
    } catch (error) {
      const authError = error as AuthError
      const errorMessage = authError.message || 'Login failed'
      const errorCode = authError.code || null
      set({ isAuthLoading: false, authError: errorMessage, authErrorCode: errorCode })
    }
  },

  /**
   * Logout - clear session and all auth data
   * Property 2: Logout Clears All Auth Data
   */
  logout: async () => {
    set({ isAuthLoading: true, authError: null, authErrorCode: null })
    try {
      const authService = getAuthService()
      await authService.logout()
      // Clear all auth state
      set({
        user: null,
        isAuthenticated: false,
        isAuthLoading: false,
        authError: null,
        authErrorCode: null,
      })
    } catch (error) {
      const authError = error as AuthError
      const errorMessage = authError.message || 'Logout failed'
      const errorCode = authError.code || null
      set({ isAuthLoading: false, authError: errorMessage, authErrorCode: errorCode })
    }
  },

  /**
   * Check current authentication status
   */
  checkAuth: async () => {
    set({ isAuthLoading: true })
    try {
      const authService = getAuthService()
      const user = await authService.checkAuth()
      set({
        user,
        isAuthenticated: user !== null,
        isAuthLoading: false,
      })
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isAuthLoading: false,
      })
    }
  },

  /**
   * Handle OAuth callback after redirect
   * Requirements: 6.1, 6.2
   */
  handleAuthCallback: async () => {
    set({ isAuthLoading: true, authError: null, authErrorCode: null })
    try {
      const authService = getAuthService()
      const user = await authService.handleCallback()
      if (user) {
        set({
          user,
          isAuthenticated: true,
          isAuthLoading: false,
        })
      } else {
        set({ isAuthLoading: false })
      }
    } catch (error) {
      const authError = error as AuthError
      const errorMessage = authError.message || 'Authentication failed'
      const errorCode = authError.code || null
      set({
        isAuthLoading: false,
        authError: errorMessage,
        authErrorCode: errorCode,
      })
    }
  },

  /**
   * Clear auth error
   */
  clearAuthError: () => {
    set({ authError: null, authErrorCode: null })
  },
}))

export default useAppStore
