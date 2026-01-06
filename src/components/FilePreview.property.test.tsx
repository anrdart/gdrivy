import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import { FilePreview, formatFileSize, getFileTypeDisplay } from './FilePreview'
import type { FileMetadata, FolderMetadata } from '../types'

/**
 * Feature: gdrive-downloader
 * Property 3: Metadata Display Completeness
 * 
 * For any FileMetadata object, the rendered FilePreview component SHALL contain
 * the file name, formatted size, and file type in its output.
 * 
 * Validates: Requirements 2.4
 */

// Custom arbitrary for valid Google Drive IDs
const validGoogleDriveId = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
  { minLength: 10, maxLength: 44 }
)

// Arbitrary for file names
const fileNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_- .'.split('')),
  { minLength: 1, maxLength: 100 }
).map(name => name.trim() || 'file')

// Arbitrary for MIME types
const mimeTypeArb = fc.oneof(
  fc.constant('application/pdf'),
  fc.constant('application/zip'),
  fc.constant('image/jpeg'),
  fc.constant('image/png'),
  fc.constant('video/mp4'),
  fc.constant('audio/mpeg'),
  fc.constant('text/plain'),
  fc.constant('application/octet-stream')
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

// Arbitrary for FolderMetadata
const folderMetadataArb: fc.Arbitrary<FolderMetadata> = fc.record({
  id: validGoogleDriveId,
  name: fileNameArb,
  files: fc.array(fileMetadataArb, { minLength: 0, maxLength: 10 }),
  totalSize: fileSizeArb
})

describe('FilePreview Property Tests', () => {
  /**
   * Property 3: Metadata Display Completeness
   * 
   * For any FileMetadata object, the rendered FilePreview component SHALL contain
   * the file name, formatted size, and file type in its output.
   */
  describe('Property 3: Metadata Display Completeness', () => {
    it('should display all required fields (name, size, type) for any FileMetadata', () => {
      fc.assert(
        fc.property(fileMetadataArb, (metadata) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnDownload = vi.fn()
          
          render(
            <FilePreview 
              metadata={metadata} 
              onDownload={mockOnDownload} 
              isLoading={false} 
            />
          )
          
          // All three fields should be present
          const nameElement = screen.getByTestId('file-name')
          const sizeElement = screen.getByTestId('file-size')
          const typeElement = screen.getByTestId('file-type')
          
          expect(nameElement).toBeInTheDocument()
          expect(sizeElement).toBeInTheDocument()
          expect(typeElement).toBeInTheDocument()
          
          // Verify content
          expect(nameElement.textContent).toBe(metadata.name)
          expect(sizeElement.textContent).toContain(formatFileSize(metadata.size))
          expect(typeElement.textContent).toContain(getFileTypeDisplay(metadata.mimeType))
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should display folder metadata with file count', () => {
      fc.assert(
        fc.property(folderMetadataArb, (metadata) => {
          // Clean up before each property test iteration
          cleanup()
          
          const mockOnDownload = vi.fn()
          
          render(
            <FilePreview 
              metadata={metadata} 
              onDownload={mockOnDownload} 
              isLoading={false} 
            />
          )
          
          // Name should be displayed
          const nameElement = screen.getByTestId('file-name')
          expect(nameElement).toBeInTheDocument()
          expect(nameElement.textContent).toBe(metadata.name)
          
          // Size should be displayed
          const sizeElement = screen.getByTestId('file-size')
          expect(sizeElement).toBeInTheDocument()
          expect(sizeElement.textContent).toContain(formatFileSize(metadata.totalSize))
          
          // Type should show folder with file count
          const typeElement = screen.getByTestId('file-type')
          expect(typeElement).toBeInTheDocument()
          expect(typeElement.textContent).toContain('Folder')
          expect(typeElement.textContent).toContain(`${metadata.files.length} files`)
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Helper function tests
   */
  describe('formatFileSize helper', () => {
    it('should format any non-negative size correctly', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 * 1024 * 1024 * 1024 }), (size) => {
          const formatted = formatFileSize(size)
          
          // Should return a non-empty string
          expect(formatted.length).toBeGreaterThan(0)
          
          // Should contain a unit
          expect(formatted).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB|TB)/)
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('getFileTypeDisplay helper', () => {
    it('should return a non-empty string for any MIME type', () => {
      fc.assert(
        fc.property(fc.string(), (mimeType) => {
          const display = getFileTypeDisplay(mimeType)
          
          // Should return a non-empty string
          expect(display.length).toBeGreaterThan(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
