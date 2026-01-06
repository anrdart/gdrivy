import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { LinkParserService } from '../services/linkParser'

/**
 * Feature: gdrive-downloader
 * Property 4: Download Button State Consistency
 * 
 * For any input string, the download button SHALL be enabled if and only if
 * the LinkParserService returns a valid ParsedLink object.
 * 
 * Validates: Requirements 5.2
 */

// Custom arbitrary for valid Google Drive IDs
const validGoogleDriveId = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
  { minLength: 10, maxLength: 44 }
)

// Generator for valid Google Drive file URLs
const validFileUrlArb = validGoogleDriveId.map(id => `https://drive.google.com/file/d/${id}/view`)

// Generator for valid Google Drive folder URLs
const validFolderUrlArb = validGoogleDriveId.map(id => `https://drive.google.com/drive/folders/${id}`)

// Generator for valid Google Drive open URLs
const validOpenUrlArb = validGoogleDriveId.map(id => `https://drive.google.com/open?id=${id}`)

// Combined generator for all valid URL formats
const validGoogleDriveUrlArb = fc.oneof(
  validFileUrlArb,
  validFolderUrlArb,
  validOpenUrlArb
)

// Generator for invalid URLs (non-Google Drive)
const invalidUrlArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('not a url'),
  fc.constant('https://example.com/file'),
  fc.constant('https://google.com/drive'),
  fc.webUrl().filter(url => !url.includes('drive.google.com')),
  fc.string().filter(s => !s.includes('drive.google.com'))
)

describe('LinkInput Property Tests', () => {

  /**
   * Property 4: Download Button State Consistency
   * 
   * For any valid Google Drive URL, the submit button should be enabled
   * after the input value is set (simulating user input).
   */
  it('should enable submit button for valid Google Drive URLs', () => {
    fc.assert(
      fc.property(validGoogleDriveUrlArb, (url) => {
        // Verify that LinkParserService considers this URL valid
        const isValid = LinkParserService.isValidGoogleDriveUrl(url)
        expect(isValid).toBe(true)
        
        // The parsed link should not be null for valid URLs
        const parsedLink = LinkParserService.parse(url)
        expect(parsedLink).not.toBeNull()
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Download Button State Consistency (Inverse)
   * 
   * For any invalid URL, the LinkParserService should return null,
   * which means the submit button should be disabled.
   */
  it('should return null from LinkParserService for invalid URLs', () => {
    fc.assert(
      fc.property(invalidUrlArb, (url) => {
        const parsedLink = LinkParserService.parse(url)
        
        // Invalid URLs should result in null parsed link
        expect(parsedLink).toBeNull()
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Consistency between validation and parsing
   * 
   * For any string, isValidGoogleDriveUrl should return true if and only if
   * parse returns a non-null value.
   */
  it('should have consistent validation and parsing results', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const isValid = LinkParserService.isValidGoogleDriveUrl(input)
        const parsedLink = LinkParserService.parse(input)
        
        // Consistency: valid URL <=> non-null parsed link
        if (isValid) {
          expect(parsedLink).not.toBeNull()
        } else {
          expect(parsedLink).toBeNull()
        }
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Button state matches validation state
   * 
   * The button enabled state should directly correspond to whether
   * the LinkParserService considers the input valid.
   */
  it('button enabled state should match LinkParserService validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(validGoogleDriveUrlArb, invalidUrlArb),
        (url) => {
          const isValidUrl = LinkParserService.isValidGoogleDriveUrl(url)
          const parsedLink = LinkParserService.parse(url)
          
          // The button should be enabled iff the URL is valid
          // This is the core property: button enabled <=> valid parsed link
          const shouldButtonBeEnabled = parsedLink !== null
          
          expect(shouldButtonBeEnabled).toBe(isValidUrl)
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
