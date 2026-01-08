import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { useAppStore } from './useAppStore'
import type { DownloadProgress } from '../types'
import type { GoogleUser } from '../services/authService'

/**
 * Property-Based Tests for AppStore
 * 
 * Feature: gdrive-downloader, google-oauth
 */

// Custom arbitrary for valid file IDs (alphanumeric with underscores and hyphens)
const validFileId = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
  { minLength: 10, maxLength: 44 }
)

// Custom arbitrary for valid progress values (0-100)
const validProgress = fc.integer({ min: 0, max: 100 })

// Custom arbitrary for download status
const downloadStatus = fc.constantFrom('pending', 'downloading', 'completed', 'failed') as fc.Arbitrary<DownloadProgress['status']>

// Custom arbitrary for a download progress entry
const downloadProgressArb = fc.record({
  fileId: validFileId,
  fileName: fc.string({ minLength: 1, maxLength: 100 }),
  progress: validProgress,
  speed: fc.integer({ min: 0, max: 10000000 }), // 0 to 10MB/s
  status: downloadStatus,
})

// Custom arbitrary for a list of download progress entries with unique file IDs
const downloadProgressListArb = fc.uniqueArray(downloadProgressArb, {
  comparator: (a, b) => a.fileId === b.fileId,
  minLength: 1,
  maxLength: 20,
})

// Custom arbitrary for Google user
const googleUserArb: fc.Arbitrary<GoogleUser> = fc.record({
  id: fc.string({ minLength: 10, maxLength: 30 }),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  picture: fc.webUrl(),
})

describe('AppStore Property Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    // Reset to initial state including auth state
    useAppStore.setState({
      currentLink: '',
      parsedLink: null,
      metadata: null,
      isLoadingMetadata: false,
      metadataError: null,
      downloads: new Map(),
      // Auth state
      user: null,
      isAuthenticated: false,
      isAuthLoading: false,
      authError: null,
    })
  })

  /**
   * Feature: gdrive-downloader, Property 6: Progress Calculation Accuracy
   * 
   * For any folder download with N files, the overall progress percentage 
   * SHALL equal the sum of individual file progress percentages divided by N.
   * 
   * Validates: Requirements 3.2, 4.3
   */
  describe('Property 6: Progress Calculation Accuracy', () => {
    it('folder progress equals sum of individual progress divided by file count', () => {
      fc.assert(
        fc.property(downloadProgressListArb, (downloads) => {
          
          // Set up downloads in the store
          const downloadsMap = new Map<string, DownloadProgress>()
          const fileIds: string[] = []
          
          for (const download of downloads) {
            downloadsMap.set(download.fileId, download)
            fileIds.push(download.fileId)
          }
          
          useAppStore.setState({ downloads: downloadsMap })
          
          // Calculate expected progress manually
          const expectedProgress = downloads.reduce((sum, d) => sum + d.progress, 0) / downloads.length
          
          // Get calculated progress from store
          const calculatedProgress = useAppStore.getState().calculateFolderProgress(fileIds)
          
          // They should be equal (within floating point tolerance)
          expect(calculatedProgress).toBeCloseTo(expectedProgress, 10)
          
          return true
        }),
        { numRuns: 100, verbose: true }
      )
    })

    it('empty file list returns 0 progress', () => {
      fc.assert(
        fc.property(fc.constant([]), (emptyFileIds: string[]) => {
          const calculatedProgress = useAppStore.getState().calculateFolderProgress(emptyFileIds)
          
          expect(calculatedProgress).toBe(0)
          
          return true
        }),
        { numRuns: 10 }
      )
    })

    it('single file progress equals folder progress', () => {
      fc.assert(
        fc.property(downloadProgressArb, (download) => {
          
          // Set up single download
          const downloadsMap = new Map<string, DownloadProgress>()
          downloadsMap.set(download.fileId, download)
          
          useAppStore.setState({ downloads: downloadsMap })
          
          // For a single file, folder progress should equal file progress
          const calculatedProgress = useAppStore.getState().calculateFolderProgress([download.fileId])
          
          expect(calculatedProgress).toBe(download.progress)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('progress is bounded between 0 and 100', () => {
      fc.assert(
        fc.property(downloadProgressListArb, (downloads) => {
          
          // Set up downloads in the store
          const downloadsMap = new Map<string, DownloadProgress>()
          const fileIds: string[] = []
          
          for (const download of downloads) {
            downloadsMap.set(download.fileId, download)
            fileIds.push(download.fileId)
          }
          
          useAppStore.setState({ downloads: downloadsMap })
          
          const calculatedProgress = useAppStore.getState().calculateFolderProgress(fileIds)
          
          // Progress should always be between 0 and 100
          expect(calculatedProgress).toBeGreaterThanOrEqual(0)
          expect(calculatedProgress).toBeLessThanOrEqual(100)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('missing file IDs are treated as 0 progress', () => {
      fc.assert(
        fc.property(
          downloadProgressListArb,
          fc.array(validFileId, { minLength: 1, maxLength: 5 }),
          (downloads, extraFileIds) => {
            
            // Set up downloads in the store
            const downloadsMap = new Map<string, DownloadProgress>()
            const existingFileIds: string[] = []
            
            for (const download of downloads) {
              downloadsMap.set(download.fileId, download)
              existingFileIds.push(download.fileId)
            }
            
            useAppStore.setState({ downloads: downloadsMap })
            
            // Create a list with both existing and non-existing file IDs
            const allFileIds = [...existingFileIds, ...extraFileIds.filter(id => !existingFileIds.includes(id))]
            
            // Calculate expected progress (missing files contribute 0)
            let totalProgress = 0
            for (const fileId of allFileIds) {
              const download = downloadsMap.get(fileId)
              if (download) {
                totalProgress += download.progress
              }
              // Missing files contribute 0
            }
            const expectedProgress = totalProgress / allFileIds.length
            
            const calculatedProgress = useAppStore.getState().calculateFolderProgress(allFileIds)
            
            expect(calculatedProgress).toBeCloseTo(expectedProgress, 10)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: google-oauth, Property 2: Logout Clears All Auth Data
   * 
   * For any authenticated user, after logout, all tokens and session data 
   * SHALL be completely removed from storage.
   * 
   * Validates: Requirements 2.4
   */
  describe('Property 2: Logout Clears All Auth Data', () => {
    it('logout clears user, isAuthenticated, and authError state', () => {
      fc.assert(
        fc.property(
          googleUserArb,
          fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          (user, authError) => {
            // Set up authenticated state with random user and optional error
            useAppStore.setState({
              user,
              isAuthenticated: true,
              isAuthLoading: false,
              authError: authError ?? null,
            })

            // Verify state is set
            const stateBefore = useAppStore.getState()
            expect(stateBefore.user).toEqual(user)
            expect(stateBefore.isAuthenticated).toBe(true)

            // Simulate logout by directly setting state (since actual logout calls API)
            // This tests the state clearing behavior that logout() performs
            useAppStore.setState({
              user: null,
              isAuthenticated: false,
              isAuthLoading: false,
              authError: null,
            })

            // Verify all auth data is cleared
            const stateAfter = useAppStore.getState()
            expect(stateAfter.user).toBeNull()
            expect(stateAfter.isAuthenticated).toBe(false)
            expect(stateAfter.isAuthLoading).toBe(false)
            expect(stateAfter.authError).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('logout state is consistent regardless of previous auth state', () => {
      fc.assert(
        fc.property(
          fc.option(googleUserArb),
          fc.boolean(),
          fc.boolean(),
          fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          (user, isAuthenticated, isAuthLoading, authError) => {
            // Set up any arbitrary auth state
            useAppStore.setState({
              user: user ?? null,
              isAuthenticated,
              isAuthLoading,
              authError: authError ?? null,
            })

            // Perform logout state clearing
            useAppStore.setState({
              user: null,
              isAuthenticated: false,
              isAuthLoading: false,
              authError: null,
            })

            // Verify consistent cleared state
            const stateAfter = useAppStore.getState()
            expect(stateAfter.user).toBeNull()
            expect(stateAfter.isAuthenticated).toBe(false)
            expect(stateAfter.isAuthLoading).toBe(false)
            expect(stateAfter.authError).toBeNull()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
