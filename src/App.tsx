import { useCallback, useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { LinkInput } from './components/LinkInput'
import { FilePreview } from './components/FilePreview'
import { DownloadProgress } from './components/DownloadProgress'
import { DownloadQueue } from './components/DownloadQueue'
import { FilePreviewSkeleton, ToastContainer, ErrorBoundary, AuthButton, LoginPrompt } from './components'
import { useToast } from './hooks/useToast'
import { getDownloadService } from './services/downloadService'
import type { FileMetadata, FolderMetadata, DownloadProgress as DownloadProgressType, QueueItem } from './types'

/**
 * Check if metadata is a folder
 */
function isFolder(metadata: FileMetadata | FolderMetadata): metadata is FolderMetadata {
  return 'files' in metadata
}

/**
 * Main App Component
 * 
 * Wires together:
 * - LinkInput → fetchMetadata → FilePreview
 * - FilePreview → startDownload → DownloadProgress
 * - Folder download with queue management
 * 
 * Requirements: 3.1, 4.1, 4.2
 */
function App() {
  const {
    metadata,
    isLoadingMetadata,
    metadataError,
    requiresLoginForAccess,
    downloads,
    isAuthenticated,
    setLink,
    fetchMetadata,
    startDownload,
    cancelDownload,
    retryDownload,
    updateDownloadProgress,
    clearCompleted,
    clearMetadataError,
    checkAuth,
    handleAuthCallback,
  } = useAppStore()

  const downloadService = getDownloadService()
  const { 
    toasts, 
    dismissToast, 
    showSuccess, 
    showError,
    showDownloadComplete,
    showDownloadFailed 
  } = useToast()

  // Check auth status on mount and handle OAuth callback
  // Requirements: 4.1, 4.2
  useEffect(() => {
    // Handle OAuth callback if present
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('auth_success') || urlParams.has('auth_error')) {
      handleAuthCallback()
    } else {
      // Check existing auth status
      checkAuth()
    }
  }, [checkAuth, handleAuthCallback])

  // Handle link submission from LinkInput
  const handleLinkSubmit = useCallback(async (link: string) => {
    setLink(link)
    const parsed = useAppStore.getState().parsedLink
    if (parsed) {
      await fetchMetadata(parsed.id, parsed.type)
      // Check if metadata was fetched successfully
      const state = useAppStore.getState()
      if (state.metadata && !state.metadataError) {
        showSuccess('File Found', `Ready to download: ${state.metadata.name}`)
      } else if (state.metadataError) {
        showError('Failed to Fetch', state.metadataError, 'Check the link and try again')
      }
    }
  }, [setLink, fetchMetadata, showSuccess, showError])


  // Handle download initiation from FilePreview
  const handleDownload = useCallback(async () => {
    if (!metadata) return

    if (isFolder(metadata)) {
      // Folder download - add all files to queue and download sequentially
      for (const file of metadata.files) {
        startDownload(file.id, file.name, file.size)
      }

      // Start downloading files sequentially
      for (const file of metadata.files) {
        updateDownloadProgress(file.id, { status: 'downloading' })
        
        const result = await downloadService.downloadFile(
          file.id,
          (progress, speed) => {
            updateDownloadProgress(file.id, { progress, speed })
          },
          file.name, // Pass expected filename from metadata
          { mimeType: file.mimeType, size: file.size } // Pass metadata for faster download
        )

        if (result.success && result.blob) {
          updateDownloadProgress(file.id, { 
            status: 'completed', 
            progress: 100 
          })
          // Use metadata filename as primary, result.fileName as fallback
          const downloadFileName = result.fileName || file.name
          downloadService.triggerBrowserDownload(result.blob, downloadFileName)
          showDownloadComplete(downloadFileName)
        } else {
          updateDownloadProgress(file.id, { 
            status: 'failed',
            error: result.error?.message || 'Download failed'
          })
          showDownloadFailed(file.name, result.error?.message)
        }
      }
    } else {
      // Single file download
      const fileId = metadata.id
      startDownload(fileId, metadata.name, metadata.size)
      updateDownloadProgress(fileId, { status: 'downloading' })

      const result = await downloadService.downloadFile(
        fileId,
        (progress, speed) => {
          updateDownloadProgress(fileId, { progress, speed })
        },
        metadata.name, // Pass expected filename from metadata
        { mimeType: metadata.mimeType, size: metadata.size } // Pass metadata for faster download
      )

      if (result.success && result.blob) {
        updateDownloadProgress(fileId, { 
          status: 'completed', 
          progress: 100 
        })
        // Use metadata filename as primary, result.fileName as fallback
        const downloadFileName = result.fileName || metadata.name
        downloadService.triggerBrowserDownload(result.blob, downloadFileName)
        showDownloadComplete(downloadFileName)
      } else {
        updateDownloadProgress(fileId, { 
          status: 'failed',
          error: result.error?.message || 'Download failed'
        })
        showDownloadFailed(metadata.name, result.error?.message)
      }
    }
  }, [metadata, startDownload, updateDownloadProgress, downloadService, showDownloadComplete, showDownloadFailed])


  // Handle retry for failed downloads
  const handleRetry = useCallback(async (fileId: string) => {
    retryDownload(fileId)
    updateDownloadProgress(fileId, { status: 'downloading' })

    const download = downloads.get(fileId)
    const fileName = download?.fileName || 'Unknown file'

    const result = await downloadService.downloadFile(
      fileId,
      (progress, speed) => {
        updateDownloadProgress(fileId, { progress, speed })
      },
      fileName // Pass expected filename from download state
    )

    if (result.success && result.blob) {
      updateDownloadProgress(fileId, { 
        status: 'completed', 
        progress: 100 
      })
      const downloadFileName = result.fileName || fileName
      downloadService.triggerBrowserDownload(result.blob, downloadFileName)
      showDownloadComplete(downloadFileName)
    } else {
      updateDownloadProgress(fileId, { 
        status: 'failed',
        error: result.error?.message || 'Download failed'
      })
      showDownloadFailed(fileName, result.error?.message)
    }
  }, [retryDownload, updateDownloadProgress, downloads, downloadService, showDownloadComplete, showDownloadFailed])

  // Handle cancel download
  const handleCancel = useCallback((fileId: string) => {
    downloadService.cancelDownload(fileId)
    cancelDownload(fileId)
  }, [cancelDownload, downloadService])

  // Convert downloads Map to array for DownloadProgress component
  const downloadsArray: DownloadProgressType[] = Array.from(downloads.values())

  // Convert downloads to QueueItem format for DownloadQueue component
  const queueItems: QueueItem[] = downloadsArray.map(download => ({
    id: download.fileId,
    metadata: {
      id: download.fileId,
      name: download.fileName,
      mimeType: 'application/octet-stream', // Default mime type
      size: download.fileSize || 0, // Use fileSize from download progress
      modifiedTime: new Date().toISOString(),
    },
    status: download.status === 'pending' ? 'queued' : 
            download.status === 'downloading' ? 'downloading' :
            download.status === 'completed' ? 'completed' : 
            download.status === 'cancelled' ? 'cancelled' : 'failed',
    progress: download.progress,
  }))

  // Check if any download is in progress
  const isDownloading = downloadsArray.some(
    d => d.status === 'downloading' || d.status === 'pending'
  )

  // Handle remove from queue
  const handleRemoveFromQueue = useCallback((id: string) => {
    cancelDownload(id)
  }, [cancelDownload])

  // Handle clear completed
  const handleClearCompleted = useCallback(() => {
    clearCompleted()
  }, [clearCompleted])


  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 text-white">
        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Background decoration */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
          {/* Header */}
          <header className="text-center mb-10 sm:mb-14 animate-fade-in">
            {/* Auth Button - positioned top right */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
              <AuthButton />
            </div>

            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-glow">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-primary-400 via-primary-300 to-accent-400 bg-clip-text text-transparent">
              Google Drive Downloader
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-md mx-auto">
              Paste a Google Drive link to download files easily and quickly
            </p>
          </header>

          {/* Link Input Section */}
          <section className="mb-8 animate-slide-up">
            <LinkInput 
              onLinkSubmit={handleLinkSubmit}
              isLoading={isLoadingMetadata}
            />
          </section>

          {/* Error Message or Login Prompt */}
          {metadataError && (
            <section className="mb-8 animate-slide-up">
              {requiresLoginForAccess && !isAuthenticated ? (
                <LoginPrompt 
                  message={metadataError}
                  onDismiss={clearMetadataError}
                />
              ) : (
                <div className="card bg-red-900/20 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-400">Error</h3>
                      <p className="text-red-300/80 text-sm mt-1">{metadataError}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Loading Skeleton for Metadata */}
          {isLoadingMetadata && !metadata && (
            <section className="mb-8 animate-fade-in">
              <FilePreviewSkeleton />
            </section>
          )}

          {/* File Preview Section */}
          {metadata && !metadataError && !isLoadingMetadata && (
            <section className="mb-8 animate-slide-up">
              <FilePreview
                metadata={metadata}
                onDownload={handleDownload}
                isLoading={isDownloading}
              />
            </section>
          )}

          {/* Download Progress Section */}
          {downloadsArray.length > 0 && (
            <section className="mb-8 animate-slide-up">
              <DownloadProgress
                downloads={downloadsArray}
                onRetry={handleRetry}
                onCancel={handleCancel}
              />
            </section>
          )}

          {/* Download Queue Section - Alternative view for folder downloads */}
          {queueItems.length > 3 && (
            <section className="mb-8 animate-slide-up">
              <DownloadQueue
                queue={queueItems}
                onRemove={handleRemoveFromQueue}
                onClearCompleted={handleClearCompleted}
              />
            </section>
          )}

          {/* Footer */}
          <footer className="text-center text-gray-500 text-sm mt-16 pt-8 border-t border-surface-800">
            <p className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Supports file and folder downloads from Google Drive
            </p>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
