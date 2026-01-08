import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

// Declare global fetch for TypeScript
declare const globalThis: {
  fetch: typeof fetch
}

/**
 * Property-Based Tests for DownloadService
 * 
 * Feature: google-oauth
 * Property 4: Authenticated Requests Include Token
 * 
 * For any Google Drive API request made by an authenticated user, 
 * the request SHALL include the user's access token in the authorization header.
 * 
 * Note: In this implementation, authentication is handled via cookies (credentials: 'include')
 * rather than explicit Authorization headers. The backend extracts the token from the session cookie.
 * 
 * Validates: Requirements 3.1, 3.2
 */

// Custom arbitrary for valid file IDs (alphanumeric with underscores and hyphens)
const validFileId = fc.stringMatching(/^[a-zA-Z0-9_-]{10,44}$/)

// Custom arbitrary for valid folder IDs
const validFolderId = fc.stringMatching(/^[a-zA-Z0-9_-]{10,44}$/)

// Custom arbitrary for resource type
const resourceType = fc.constantFrom('file', 'folder') as fc.Arbitrary<'file' | 'folder'>

describe('DownloadService Property Tests', () => {
  let fetchCalls: Array<{ url: string; options: RequestInit }> = []
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    fetchCalls = []
    originalFetch = globalThis.fetch
    
    // Mock fetch to capture all calls
    globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      fetchCalls.push({ url: url.toString(), options: options || {} })
      
      // Return a mock response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          success: true, 
          data: { 
            id: 'test-id', 
            name: 'test-file.txt',
            mimeType: 'text/plain',
            size: 1024,
            modifiedTime: new Date().toISOString(),
          } 
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
          'Content-Length': '1024',
        }),
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as unknown as Response)
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  /**
   * Feature: google-oauth, Property 4: Authenticated Requests Include Token
   * 
   * For any Google Drive API request made by an authenticated user, 
   * the request SHALL include credentials for cookie-based authentication.
   * 
   * Validates: Requirements 3.1, 3.2
   */
  describe('Property 4: Authenticated Requests Include Token', () => {
    it('fetchMetadata requests include credentials for any file/folder ID', async () => {
      // Dynamically import to get fresh instance with mocked fetch
      const { createDownloadService } = await import('./downloadService')
      
      await fc.assert(
        fc.asyncProperty(
          validFileId,
          resourceType,
          async (id, type) => {
            fetchCalls = [] // Reset calls for each test
            const service = createDownloadService()
            
            try {
              await service.fetchMetadata(id, type)
            } catch {
              // Ignore errors - we're testing the request configuration
            }
            
            // Verify at least one fetch call was made
            expect(fetchCalls.length).toBeGreaterThan(0)
            
            // Verify all fetch calls include credentials: 'include'
            for (const call of fetchCalls) {
              expect(call.options.credentials).toBe('include')
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('downloadFile requests include credentials for any file ID', async () => {
      const { createDownloadService } = await import('./downloadService')
      
      await fc.assert(
        fc.asyncProperty(
          validFileId,
          async (fileId) => {
            fetchCalls = [] // Reset calls for each test
            const service = createDownloadService()
            
            try {
              await service.downloadFile(fileId)
            } catch {
              // Ignore errors - we're testing the request configuration
            }
            
            // Verify at least one fetch call was made
            expect(fetchCalls.length).toBeGreaterThan(0)
            
            // Verify all fetch calls include credentials: 'include'
            for (const call of fetchCalls) {
              expect(call.options.credentials).toBe('include')
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('all API requests use credentials regardless of endpoint', async () => {
      const { createDownloadService } = await import('./downloadService')
      
      // Test various combinations of operations
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileId: validFileId,
            folderId: validFolderId,
            operation: fc.constantFrom('metadata-file', 'metadata-folder', 'download'),
          }),
          async ({ fileId, folderId, operation }) => {
            fetchCalls = [] // Reset calls for each test
            const service = createDownloadService()
            
            try {
              switch (operation) {
                case 'metadata-file':
                  await service.fetchMetadata(fileId, 'file')
                  break
                case 'metadata-folder':
                  await service.fetchMetadata(folderId, 'folder')
                  break
                case 'download':
                  await service.downloadFile(fileId)
                  break
              }
            } catch {
              // Ignore errors - we're testing the request configuration
            }
            
            // Verify credentials are included in all requests
            for (const call of fetchCalls) {
              expect(call.options.credentials).toBe('include')
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
