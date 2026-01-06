import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { LinkParserService } from './linkParser'

/**
 * Property-Based Tests for LinkParserService
 * 
 * Feature: gdrive-downloader
 */

// Custom arbitrary for valid Google Drive file IDs
// Google Drive IDs are alphanumeric with underscores and hyphens, typically 25-44 chars
const validGoogleDriveId = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
  { minLength: 10, maxLength: 44 }
)

// Custom arbitrary for valid Google Drive file URLs
const validGoogleDriveFileUrl = fc.oneof(
  // Format: /file/d/{id}/view
  validGoogleDriveId.map(id => `https://drive.google.com/file/d/${id}/view`),
  // Format: /file/d/{id}/view?usp=sharing
  validGoogleDriveId.map(id => `https://drive.google.com/file/d/${id}/view?usp=sharing`),
  // Format: /open?id={id}
  validGoogleDriveId.map(id => `https://drive.google.com/open?id=${id}`)
)

// Custom arbitrary for valid Google Drive folder URLs
const validGoogleDriveFolderUrl = fc.oneof(
  // Format: /drive/folders/{id}
  validGoogleDriveId.map(id => `https://drive.google.com/drive/folders/${id}`),
  // Format: /drive/folders/{id}?usp=sharing
  validGoogleDriveId.map(id => `https://drive.google.com/drive/folders/${id}?usp=sharing`)
)

// Combined arbitrary for any valid Google Drive URL
const validGoogleDriveUrl = fc.oneof(validGoogleDriveFileUrl, validGoogleDriveFolderUrl)

describe('LinkParserService Property Tests', () => {
  /**
   * Feature: gdrive-downloader, Property 1: Link Parsing Round Trip
   * 
   * For any valid Google Drive URL (file or folder), the LinkParserService SHALL 
   * correctly extract the ID, and reconstructing a URL from that ID should produce 
   * a functionally equivalent URL (same ID extractable).
   * 
   * Validates: Requirements 1.1, 1.2, 1.4
   */
  describe('Property 1: Link Parsing Round Trip', () => {
    it('parsed link ID can be used to reconstruct a functionally equivalent URL', () => {
      fc.assert(
        fc.property(validGoogleDriveUrl, (url) => {
          // Parse the original URL
          const parsed = LinkParserService.parse(url)
          
          // Must successfully parse
          expect(parsed).not.toBeNull()
          
          if (parsed) {
            // Reconstruct URL from parsed data
            const reconstructed = LinkParserService.reconstructUrl(parsed)
            
            // Parse the reconstructed URL
            const reparsed = LinkParserService.parse(reconstructed)
            
            // Must successfully parse again
            expect(reparsed).not.toBeNull()
            
            if (reparsed) {
              // The IDs must match (round-trip property)
              expect(reparsed.id).toBe(parsed.id)
              // The types must match
              expect(reparsed.type).toBe(parsed.type)
            }
          }
          
          return true
        }),
        { numRuns: 100, verbose: true }
      )
    })

    it('file URLs are correctly identified as file type', () => {
      fc.assert(
        fc.property(validGoogleDriveFileUrl, (url) => {
          const parsed = LinkParserService.parse(url)
          
          expect(parsed).not.toBeNull()
          expect(parsed?.type).toBe('file')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('folder URLs are correctly identified as folder type', () => {
      fc.assert(
        fc.property(validGoogleDriveFolderUrl, (url) => {
          const parsed = LinkParserService.parse(url)
          
          expect(parsed).not.toBeNull()
          expect(parsed?.type).toBe('folder')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('extracted ID matches the ID in the original URL', () => {
      fc.assert(
        fc.property(validGoogleDriveId, (id) => {
          // Test with file URL format
          const fileUrl = `https://drive.google.com/file/d/${id}/view`
          const parsedFile = LinkParserService.parse(fileUrl)
          
          expect(parsedFile).not.toBeNull()
          expect(parsedFile?.id).toBe(id)
          
          // Test with folder URL format
          const folderUrl = `https://drive.google.com/drive/folders/${id}`
          const parsedFolder = LinkParserService.parse(folderUrl)
          
          expect(parsedFolder).not.toBeNull()
          expect(parsedFolder?.id).toBe(id)
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: gdrive-downloader, Property 2: Invalid Link Rejection
   * 
   * For any string that is not a valid Google Drive URL, the LinkParserService 
   * SHALL return null or an error indicator, never a valid ParsedLink object.
   * 
   * Validates: Requirements 1.3
   */
  describe('Property 2: Invalid Link Rejection', () => {
    // Arbitrary for non-Google Drive URLs
    const nonGoogleDriveUrl = fc.oneof(
      // Random HTTP URLs that are not Google Drive
      fc.webUrl().filter(url => !url.includes('drive.google.com')),
      // Random strings
      fc.string().filter(s => !s.includes('drive.google.com')),
      // Other Google services
      fc.constantFrom(
        'https://docs.google.com/document/d/abc123/edit',
        'https://sheets.google.com/spreadsheets/d/abc123',
        'https://photos.google.com/photo/abc123',
        'https://mail.google.com/mail/u/0/',
        'https://calendar.google.com/calendar'
      ),
      // Malformed Google Drive URLs
      fc.constantFrom(
        'https://drive.google.com/',
        'https://drive.google.com/file/',
        'https://drive.google.com/file/d/',
        'https://drive.google.com/drive/',
        'https://drive.google.com/drive/folders/',
        'https://drive.google.com/open',
        'https://drive.google.com/open?',
        'https://drive.google.com/open?id=',
        'drive.google.com/file/d/abc123/view', // missing protocol
        'http://notdrive.google.com/file/d/abc123/view'
      )
    )

    it('non-Google Drive URLs return null', () => {
      fc.assert(
        fc.property(nonGoogleDriveUrl, (url) => {
          const parsed = LinkParserService.parse(url)
          
          // Must return null for invalid URLs
          expect(parsed).toBeNull()
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('empty and null-like inputs return null', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\n', '\t', null, undefined),
          (input) => {
            const parsed = LinkParserService.parse(input as string)
            
            expect(parsed).toBeNull()
            
            return true
          }
        ),
        { numRuns: 10 }
      )
    })

    it('isValidGoogleDriveUrl returns false for invalid URLs', () => {
      fc.assert(
        fc.property(nonGoogleDriveUrl, (url) => {
          const isValid = LinkParserService.isValidGoogleDriveUrl(url)
          
          expect(isValid).toBe(false)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('random strings without drive.google.com are rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => !s.includes('drive.google.com')),
          (randomString) => {
            const parsed = LinkParserService.parse(randomString)
            
            expect(parsed).toBeNull()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
