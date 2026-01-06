import { FiTrash2, FiFile, FiCheck, FiX, FiLoader } from 'react-icons/fi'
import type { QueueItem } from '../types'
import { formatFileSize } from './FilePreview'

interface DownloadQueueProps {
  queue: QueueItem[]
  onRemove: (id: string) => void
  onClearCompleted: () => void
}

/**
 * Get status icon based on queue item status
 */
function getStatusIcon(status: QueueItem['status']) {
  switch (status) {
    case 'completed':
      return <FiCheck className="w-4 h-4 text-accent-400" />
    case 'failed':
      return <FiX className="w-4 h-4 text-red-400" />
    case 'cancelled':
      return <FiX className="w-4 h-4 text-yellow-400" />
    case 'downloading':
      return <FiLoader className="w-4 h-4 text-primary-400 animate-spin" />
    case 'queued':
    default:
      return <FiFile className="w-4 h-4 text-gray-500" />
  }
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(status: QueueItem['status']): string {
  switch (status) {
    case 'completed':
      return 'badge-success'
    case 'failed':
      return 'badge-error'
    case 'cancelled':
      return 'badge-warning'
    case 'downloading':
      return 'badge-info'
    case 'queued':
    default:
      return 'badge-neutral'
  }
}

/**
 * Get status text
 */
function getStatusText(status: QueueItem['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'downloading':
      return 'Downloading'
    case 'queued':
    default:
      return 'Queued'
  }
}

/**
 * Single queue item component
 */
function QueueItemRow({ 
  item, 
  onRemove 
}: { 
  item: QueueItem
  onRemove: (id: string) => void
}) {
  return (
    <div 
      className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-surface-900 rounded-xl transition-all duration-200 hover:bg-surface-800/80"
      data-testid={`queue-item-${item.id}`}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-800 flex items-center justify-center">
        {getStatusIcon(item.status)}
      </div>

      {/* File Info */}
      <div className="flex-grow min-w-0">
        <p 
          className="text-white text-xs sm:text-sm font-medium truncate" 
          title={item.metadata.name}
          data-testid="queue-item-name"
        >
          {item.metadata.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
          <span className="text-xs text-gray-500">
            {formatFileSize(item.metadata.size)}
          </span>
          {item.status === 'downloading' && (
            <span className="text-xs text-primary-400 font-medium">
              {item.progress.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Status Badge - Hidden on very small screens */}
      <span 
        className={`hidden xs:flex flex-shrink-0 badge ${getStatusBadgeClass(item.status)}`}
        data-testid="queue-item-status"
      >
        {getStatusText(item.status)}
      </span>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(item.id)}
        className="flex-shrink-0 p-1.5 sm:p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 touch-target"
        title="Remove from queue"
        aria-label={`Remove ${item.metadata.name} from queue`}
      >
        <FiTrash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * DownloadQueue Component
 * 
 * List of queued/downloading/completed files.
 * Individual progress for each file.
 * Clear completed button.
 * 
 * Requirements: 5.3, 4.2
 * - WHEN a download is queued THEN the User_Interface SHALL display the file in a download queue list
 * - WHEN a user initiates folder download THEN the Download_Manager SHALL download files sequentially or provide option for batch download
 */
export function DownloadQueue({ queue, onRemove, onClearCompleted }: DownloadQueueProps) {
  if (queue.length === 0) {
    return null
  }

  const completedCount = queue.filter(item => item.status === 'completed').length
  const downloadingCount = queue.filter(item => item.status === 'downloading').length
  const queuedCount = queue.filter(item => item.status === 'queued').length
  const failedCount = queue.filter(item => item.status === 'failed').length
  const cancelledCount = queue.filter(item => item.status === 'cancelled').length

  return (
    <div className="w-full max-w-2xl mx-auto card animate-slide-up">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-white">Download Queue</h3>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {downloadingCount > 0 && (
              <span className="badge badge-info text-xs">{downloadingCount} downloading</span>
            )}
            {queuedCount > 0 && (
              <span className="badge badge-neutral text-xs">{queuedCount} queued</span>
            )}
            {completedCount > 0 && (
              <span className="badge badge-success text-xs">{completedCount} completed</span>
            )}
            {failedCount > 0 && (
              <span className="badge badge-error text-xs">{failedCount} failed</span>
            )}
            {cancelledCount > 0 && (
              <span className="badge badge-warning text-xs">{cancelledCount} cancelled</span>
            )}
          </div>
        </div>

        {/* Clear Completed Button */}
        {completedCount > 0 && (
          <button
            onClick={onClearCompleted}
            className="btn-ghost flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
          >
            <FiTrash2 className="w-4 h-4" />
            Clear Completed
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="space-y-1.5 sm:space-y-2" data-testid="queue-list">
        {queue.map((item) => (
          <QueueItemRow
            key={item.id}
            item={item}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-surface-700">
        <p className="text-xs sm:text-sm text-gray-500">
          Total: {queue.length} file{queue.length !== 1 ? 's' : ''} in queue
        </p>
      </div>
    </div>
  )
}

export default DownloadQueue
