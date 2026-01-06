import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import { DownloadQueue } from './DownloadQueue'
import type { QueueItem, FileMetadata } from '../types'

/**
 * Feature: gdrive-downloader
 * Property 5: Queue Display Consistency
 * 
 * For any file added to the download queue, the DownloadQueue component SHALL
 * display that file in the queue list until it is removed or cleared.
 * 
 * Validates: Requirements 5.3
 */

// Custom arbitrary for valid Google Drive IDs (avoiding JS reserved property names)
const validGoogleDriveId = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
  { minLength: 10, maxLength: 44 }
).filter(id => !['constructor', 'hasOwnProperty', 'toString', 'valueOf', '__proto__'].includes(id))

// Arbitrary for file names
const fileNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_- .'.split('')),
  { minLength: 1, maxLength: 50 }
).map(name => name.trim() || 'file')

// Arbitrary for MIME types
const mimeTypeArb = fc.oneof(
  fc.constant('application/pdf'),
  fc.constant('application/zip'),
  fc.constant('image/jpeg'),
  fc.constant('video/mp4'),
  fc.constant('text/plain')
)

// Arbitrary for file sizes (0 to 10GB)
const fileSizeArb = fc.integer({ min: 0, max: 10 * 1024 * 1024 * 1024 })

// Arbitrary for ISO date strings
const dateStringArb = fc.date().map(d => d.toISOString())

// Arbitrary for FileMetadata
const fileMetadataArb: fc.Arbitrary<FileMetadata> = fc.record({
  id: validGoogleDriveId,
  name: fileNameArb,
  mimeType: mimeTypeArb,
  size: fileSizeArb,
  modifiedTime: dateStringArb,
  iconLink: fc.option(fc.webUrl(), { nil: undefined })
})

// Arbitrary for queue item status
const queueStatusArb = fc.constantFrom<QueueItem['status']>('queued', 'downloading', 'completed', 'failed')

// Arbitrary for progress (0-100)
const progressArb = fc.integer({ min: 0, max: 100 })

// Arbitrary for QueueItem
const queueItemArb: fc.Arbitrary<QueueItem> = fc.record({
  id: validGoogleDriveId,
  metadata: fileMetadataArb,
  status: queueStatusArb,
  progress: progressArb
})

// Arbitrary for non-empty queue with unique IDs
const nonEmptyQueueArb = fc.array(queueItemArb, { minLength: 1, maxLength: 10 })
  .map(items => {
    // Ensure unique IDs by appending index
    return items.map((item, index) => ({
      ...item,
      id: `${item.id}_${index}`
    }))
  })

describe('DownloadQueue Property Tests', () => {
  /**
   * Property 5: Queue Display Consistency
   * 
   * For any file added to the download queue, the DownloadQueue component SHALL
   * display that file in the queue list until it is removed or cleared.
   */
  describe('Property 5: Queue Display Consistency', () => {
    it('should display all queue items in the queue list', () => {
      fc.assert(
        fc.property(nonEmptyQueueArb, (queue) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnRemove = vi.fn()
          const mockOnClearCompleted = vi.fn()
          
          render(
            <DownloadQueue 
              queue={queue} 
              onRemove={mockOnRemove} 
              onClearCompleted={mockOnClearCompleted} 
            />
          )
          
          // The queue list should be present
          const queueList = screen.getByTestId('queue-list')
          expect(queueList).toBeInTheDocument()
          
          // Each queue item should be displayed
          for (const item of queue) {
            const queueItem = screen.getByTestId(`queue-item-${item.id}`)
            expect(queueItem).toBeInTheDocument()
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should display correct file name for each queue item', () => {
      fc.assert(
        fc.property(nonEmptyQueueArb, (queue) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnRemove = vi.fn()
          const mockOnClearCompleted = vi.fn()
          
          render(
            <DownloadQueue 
              queue={queue} 
              onRemove={mockOnRemove} 
              onClearCompleted={mockOnClearCompleted} 
            />
          )
          
          // Get all queue item names
          const nameElements = screen.getAllByTestId('queue-item-name')
          
          // Should have same number of name elements as queue items
          expect(nameElements.length).toBe(queue.length)
          
          // Each name should match the corresponding queue item
          for (let i = 0; i < queue.length; i++) {
            expect(nameElements[i].textContent).toBe(queue[i].metadata.name)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should display correct status for each queue item', () => {
      fc.assert(
        fc.property(nonEmptyQueueArb, (queue) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnRemove = vi.fn()
          const mockOnClearCompleted = vi.fn()
          
          render(
            <DownloadQueue 
              queue={queue} 
              onRemove={mockOnRemove} 
              onClearCompleted={mockOnClearCompleted} 
            />
          )
          
          // Get all status elements
          const statusElements = screen.getAllByTestId('queue-item-status')
          
          // Should have same number of status elements as queue items
          expect(statusElements.length).toBe(queue.length)
          
          // Each status should match the corresponding queue item
          const statusTextMap: Record<QueueItem['status'], string> = {
            'queued': 'Queued',
            'downloading': 'Downloading',
            'completed': 'Completed',
            'failed': 'Failed',
            cancelled: ''
          }
          
          for (let i = 0; i < queue.length; i++) {
            expect(statusElements[i].textContent).toBe(statusTextMap[queue[i].status])
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should show clear completed button only when there are completed items', () => {
      fc.assert(
        fc.property(nonEmptyQueueArb, (queue) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnRemove = vi.fn()
          const mockOnClearCompleted = vi.fn()
          
          render(
            <DownloadQueue 
              queue={queue} 
              onRemove={mockOnRemove} 
              onClearCompleted={mockOnClearCompleted} 
            />
          )
          
          const hasCompletedItems = queue.some(item => item.status === 'completed')
          const clearButton = screen.queryByText('Clear Completed')
          
          if (hasCompletedItems) {
            expect(clearButton).toBeInTheDocument()
          } else {
            expect(clearButton).not.toBeInTheDocument()
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should display total count matching queue length', () => {
      fc.assert(
        fc.property(nonEmptyQueueArb, (queue) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnRemove = vi.fn()
          const mockOnClearCompleted = vi.fn()
          
          render(
            <DownloadQueue 
              queue={queue} 
              onRemove={mockOnRemove} 
              onClearCompleted={mockOnClearCompleted} 
            />
          )
          
          // Check that total count is displayed
          const expectedText = queue.length === 1 
            ? 'Total: 1 file in queue'
            : `Total: ${queue.length} files in queue`
          
          expect(screen.getByText(expectedText)).toBeInTheDocument()
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Empty queue behavior', () => {
    it('should render nothing when queue is empty', () => {
      cleanup()
      
      const mockOnRemove = vi.fn()
      const mockOnClearCompleted = vi.fn()
      
      const { container } = render(
        <DownloadQueue 
          queue={[]} 
          onRemove={mockOnRemove} 
          onClearCompleted={mockOnClearCompleted} 
        />
      )
      
      // Should render nothing
      expect(container.firstChild).toBeNull()
    })
  })
})
