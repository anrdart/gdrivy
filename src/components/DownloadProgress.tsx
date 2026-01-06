import { FiX, FiRefreshCw, FiCheck, FiAlertCircle, FiLoader } from 'react-icons/fi'
import type { DownloadProgress as DownloadProgressType } from '../types'

interface DownloadProgressProps {
  downloads: DownloadProgressType[]
  onRetry: (fileId: string) => void
  onCancel: (fileId: string) => void
}

/**
 * Format download speed to human-readable format
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const k = 1024
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  const speed = bytesPerSecond / Math.pow(k, i)
  
  return `${speed.toFixed(i > 0 ? 2 : 0)} ${units[Math.min(i, units.length - 1)]}`
}

/**
 * Get status icon based on download status
 */
function getStatusIcon(status: DownloadProgressType['status']) {
  switch (status) {
    case 'completed':
      return <FiCheck className="w-5 h-5 text-accent-400" />
    case 'failed':
      return <FiAlertCircle className="w-5 h-5 text-red-400" />
    case 'cancelled':
      return <FiX className="w-5 h-5 text-yellow-400" />
    case 'downloading':
      return <FiLoader className="w-5 h-5 text-primary-400 animate-spin" />
    case 'pending':
    default:
      return <FiLoader className="w-5 h-5 text-gray-500" />
  }
}

/**
 * Get progress bar color based on status
 */
function getProgressBarColor(status: DownloadProgressType['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-gradient-to-r from-accent-500 to-accent-400'
    case 'failed':
      return 'bg-gradient-to-r from-red-500 to-red-400'
    case 'cancelled':
      return 'bg-gradient-to-r from-yellow-500 to-yellow-400'
    case 'downloading':
      return 'bg-gradient-to-r from-primary-500 to-primary-400'
    case 'pending':
    default:
      return 'bg-gray-600'
  }
}

/**
 * Get status text
 */
function getStatusText(download: DownloadProgressType): string {
  switch (download.status) {
    case 'completed':
      return 'Completed'
    case 'failed':
      return download.error || 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'downloading':
      return `${download.progress.toFixed(1)}% • ${formatSpeed(download.speed)}`
    case 'pending':
    default:
      return 'Waiting...'
  }
}

/**
 * Single download item component
 */
function DownloadItem({ 
  download, 
  onRetry, 
  onCancel 
}: { 
  download: DownloadProgressType
  onRetry: (fileId: string) => void
  onCancel: (fileId: string) => void
}) {
  const canCancel = download.status === 'pending' || download.status === 'downloading'
  const canRetry = download.status === 'failed' || download.status === 'cancelled'

  return (
    <div 
      className="bg-surface-900 rounded-xl p-3 sm:p-4 transition-all duration-200 hover:bg-surface-800/80"
      data-testid={`download-item-${download.fileId}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Status Icon */}
        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-800 flex items-center justify-center">
          {getStatusIcon(download.status)}
        </div>

        {/* File Info and Progress */}
        <div className="flex-grow min-w-0">
          {/* File Name */}
          <p 
            className="text-white text-sm sm:text-base font-medium truncate" 
            title={download.fileName}
            data-testid="download-filename"
          >
            {download.fileName}
          </p>

          {/* Progress Bar */}
          <div className="mt-1.5 sm:mt-2 h-1.5 sm:h-2 bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getProgressBarColor(download.status)}`}
              style={{ width: `${Math.min(100, Math.max(0, download.progress))}%` }}
              role="progressbar"
              aria-valuenow={download.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="progress-bar"
            />
          </div>

          {/* Status Text */}
          <p 
            className={`mt-1.5 sm:mt-2 text-xs sm:text-sm ${
              download.status === 'failed' ? 'text-red-400' : 
              download.status === 'cancelled' ? 'text-yellow-400' :
              download.status === 'completed' ? 'text-accent-400' :
              'text-gray-400'
            }`}
            data-testid="download-status"
          >
            {getStatusText(download)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex gap-1 sm:gap-2">
          {canRetry && (
            <button
              onClick={() => onRetry(download.fileId)}
              className="p-2 sm:p-2.5 text-gray-400 hover:text-white hover:bg-surface-700 rounded-lg transition-all duration-200 touch-target"
              title="Retry download"
              aria-label="Retry download"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(download.fileId)}
              className="p-2 sm:p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 touch-target"
              title="Cancel download"
              aria-label="Cancel download"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * DownloadProgress Component
 * 
 * Progress bar with percentage, download speed indicator,
 * cancel and retry buttons.
 * 
 * Requirements: 3.2, 3.3, 3.4
 * - WHILE a download is in progress THEN the Progress_Tracker SHALL display download percentage and speed
 * - WHEN a download completes successfully THEN the User_Interface SHALL notify the user and provide the downloaded file
 * - IF a download fails THEN the Download_Manager SHALL display an error message and offer retry option
 */
export function DownloadProgress({ downloads, onRetry, onCancel }: DownloadProgressProps) {
  if (downloads.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-2xl mx-auto card animate-slide-up">
      <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
        <FiLoader className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
        Downloads
      </h3>
      <div className="space-y-2 sm:space-y-3">
        {downloads.map((download) => (
          <DownloadItem
            key={download.fileId}
            download={download}
            onRetry={onRetry}
            onCancel={onCancel}
          />
        ))}
      </div>
    </div>
  )
}

export default DownloadProgress
