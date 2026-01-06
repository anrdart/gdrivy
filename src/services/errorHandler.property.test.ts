import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { ErrorCode } from '../types'
import { 
  errorMessages, 
  getErrorMessage, 
  createAppError,
  hasMessageForAllErrorCodes,
  RETRY_CONFIG,
  calculateRetryDelay,
  canRetry,
  isRetryableError,
  RetryState
} from './errorHandler'
import { createRetryManager } from './retryManager'

/**
 * Property-Based Tests for Error Handling System
 * 
 * Feature: gdrive-downloader
 */

// Arbitrary for all valid ErrorCode values
const validErrorCode = fc.constantFrom(...Object.values(ErrorCode))

// Arbitrary for retry attempt numbers
const retryAttemptNumber = fc.integer({ min: 0, max: 10 })

describe('Error Handler Property Tests', () => {
  /**
   * Feature: gdrive-downloader, Property 7: Error Message Coverage
   * 
   * For any ErrorCode in the system, there SHALL exist a corresponding 
   * user-friendly error message with a suggested action.
   * 
   * Validates: Requirements 6.4
   */
  describe('Property 7: Error Message Coverage', () => {
    it('every ErrorCode has a corresponding error message', () => {
      fc.assert(
        fc.property(validErrorCode, (code) => {
          // Check that errorMessages has an entry for this code
          const messageEntry = errorMessages[code]
          
          expect(messageEntry).toBeDefined()
          expect(messageEntry.message).toBeDefined()
          expect(typeof messageEntry.message).toBe('string')
          expect(messageEntry.message.length).toBeGreaterThan(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('every ErrorCode has a corresponding suggested action', () => {
      fc.assert(
        fc.property(validErrorCode, (code) => {
          const messageEntry = errorMessages[code]
          
          expect(messageEntry).toBeDefined()
          expect(messageEntry.suggestion).toBeDefined()
          expect(typeof messageEntry.suggestion).toBe('string')
          expect(messageEntry.suggestion.length).toBeGreaterThan(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('getErrorMessage returns valid message for any ErrorCode', () => {
      fc.assert(
        fc.property(validErrorCode, (code) => {
          const result = getErrorMessage(code)
          
          expect(result).toBeDefined()
          expect(result.message).toBeDefined()
          expect(result.suggestion).toBeDefined()
          expect(typeof result.message).toBe('string')
          expect(typeof result.suggestion).toBe('string')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('createAppError returns valid AppError for any ErrorCode', () => {
      fc.assert(
        fc.property(validErrorCode, (code) => {
          const appError = createAppError(code)
          
          expect(appError).toBeDefined()
          expect(appError.code).toBe(code)
          expect(appError.message).toBeDefined()
          expect(appError.suggestion).toBeDefined()
          expect(typeof appError.message).toBe('string')
          expect(typeof appError.suggestion).toBe('string')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('hasMessageForAllErrorCodes returns true', () => {
      // This is a direct verification that all codes are covered
      expect(hasMessageForAllErrorCodes()).toBe(true)
    })

    it('all ErrorCode enum values are covered in errorMessages', () => {
      const allCodes = Object.values(ErrorCode)
      const coveredCodes = Object.keys(errorMessages)
      
      // Every ErrorCode should be in errorMessages
      for (const code of allCodes) {
        expect(coveredCodes).toContain(code)
      }
      
      // The count should match
      expect(coveredCodes.length).toBe(allCodes.length)
    })
  })

  /**
   * Feature: gdrive-downloader, Property 8: Retry Limit Enforcement
   * 
   * For any download that encounters network errors, the Download_Manager 
   * SHALL retry at most 3 times before marking the download as failed.
   * 
   * Validates: Requirements 6.3
   */
  describe('Property 8: Retry Limit Enforcement', () => {
    it('canRetry returns false after maxRetries attempts', () => {
      fc.assert(
        fc.property(retryAttemptNumber, (attempts) => {
          const state: RetryState = {
            attempts,
            lastError: null,
            isRetrying: false,
          }
          
          const result = canRetry(state)
          
          if (attempts < RETRY_CONFIG.maxRetries) {
            expect(result).toBe(true)
          } else {
            expect(result).toBe(false)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('retry limit is exactly 3', () => {
      expect(RETRY_CONFIG.maxRetries).toBe(3)
    })

    it('RetryManager enforces max retry limit', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 20 }), (operationId) => {
          const manager = createRetryManager()
          
          // Initially should be able to retry
          expect(manager.canRetry(operationId)).toBe(true)
          expect(manager.getRemainingAttempts(operationId)).toBe(3)
          
          // Record 3 attempts
          manager.recordAttempt(operationId, ErrorCode.NETWORK_ERROR)
          expect(manager.getRemainingAttempts(operationId)).toBe(2)
          
          manager.recordAttempt(operationId, ErrorCode.NETWORK_ERROR)
          expect(manager.getRemainingAttempts(operationId)).toBe(1)
          
          manager.recordAttempt(operationId, ErrorCode.NETWORK_ERROR)
          expect(manager.getRemainingAttempts(operationId)).toBe(0)
          
          // After 3 attempts, should not be able to retry
          expect(manager.canRetry(operationId)).toBe(false)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('reset allows retrying again', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 20 }), (operationId) => {
          const manager = createRetryManager()
          
          // Exhaust retries
          for (let i = 0; i < RETRY_CONFIG.maxRetries; i++) {
            manager.recordAttempt(operationId, ErrorCode.NETWORK_ERROR)
          }
          
          expect(manager.canRetry(operationId)).toBe(false)
          
          // Reset
          manager.resetState(operationId)
          
          // Should be able to retry again
          expect(manager.canRetry(operationId)).toBe(true)
          expect(manager.getRemainingAttempts(operationId)).toBe(3)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('exponential backoff delay increases with each attempt', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: RETRY_CONFIG.maxRetries - 1 }),
          (attempt) => {
            const delay = calculateRetryDelay(attempt)
            
            // Delay should be positive
            expect(delay).toBeGreaterThan(0)
            
            // Delay should not exceed maxDelay
            expect(delay).toBeLessThanOrEqual(RETRY_CONFIG.maxDelay)
            
            // Delay should follow exponential pattern
            const expectedDelay = Math.min(
              RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
              RETRY_CONFIG.maxDelay
            )
            expect(delay).toBe(expectedDelay)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('only network and download errors are retryable', () => {
      fc.assert(
        fc.property(validErrorCode, (code) => {
          const isRetryable = isRetryableError(code)
          
          if (code === ErrorCode.NETWORK_ERROR || code === ErrorCode.DOWNLOAD_FAILED) {
            expect(isRetryable).toBe(true)
          } else {
            expect(isRetryable).toBe(false)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
