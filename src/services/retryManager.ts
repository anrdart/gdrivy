import { ErrorCode, AppError } from '../types'
import { 
  RETRY_CONFIG, 
  calculateRetryDelay, 
  isRetryableError, 
  createAppError,
  RetryState,
  createRetryState 
} from './errorHandler'

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: AppError
  attempts: number
}

/**
 * Retry manager for handling operations with automatic retry
 * Property 8: Retry Limit Enforcement
 * For any download that encounters network errors, the Download_Manager 
 * SHALL retry at most 3 times before marking the download as failed.
 * Validates: Requirements 6.3
 */
export class RetryManager {
  private retryStates: Map<string, RetryState> = new Map()

  /**
   * Get or create retry state for an operation
   */
  getState(operationId: string): RetryState {
    if (!this.retryStates.has(operationId)) {
      this.retryStates.set(operationId, createRetryState())
    }
    return this.retryStates.get(operationId)!
  }

  /**
   * Reset retry state for an operation
   */
  resetState(operationId: string): void {
    this.retryStates.set(operationId, createRetryState())
  }

  /**
   * Clear retry state for an operation
   */
  clearState(operationId: string): void {
    this.retryStates.delete(operationId)
  }

  /**
   * Check if operation can be retried
   */
  canRetry(operationId: string): boolean {
    const state = this.getState(operationId)
    return state.attempts < RETRY_CONFIG.maxRetries
  }

  /**
   * Get remaining retry attempts
   */
  getRemainingAttempts(operationId: string): number {
    const state = this.getState(operationId)
    return Math.max(0, RETRY_CONFIG.maxRetries - state.attempts)
  }

  /**
   * Execute an operation with automatic retry on retryable errors
   */
  async executeWithRetry<T>(
    operationId: string,
    operation: () => Promise<T>,
    onRetry?: (attempt: number, delay: number) => void
  ): Promise<RetryResult<T>> {
    const state = this.getState(operationId)
    
    while (state.attempts <= RETRY_CONFIG.maxRetries) {
      try {
        state.isRetrying = state.attempts > 0
        const data = await operation()
        
        // Success - reset state and return
        this.resetState(operationId)
        return {
          success: true,
          data,
          attempts: state.attempts + 1,
        }
      } catch (error) {
        state.attempts++
        
        // Determine error code
        const errorCode = this.extractErrorCode(error)
        const appError = createAppError(errorCode)
        state.lastError = appError

        // Check if we should retry
        if (isRetryableError(errorCode) && state.attempts < RETRY_CONFIG.maxRetries) {
          const delay = calculateRetryDelay(state.attempts - 1)
          
          if (onRetry) {
            onRetry(state.attempts, delay)
          }
          
          // Wait before retrying
          await this.delay(delay)
          continue
        }

        // Max retries reached or non-retryable error
        return {
          success: false,
          error: appError,
          attempts: state.attempts,
        }
      }
    }

    // Should not reach here, but handle edge case
    return {
      success: false,
      error: state.lastError || createAppError(ErrorCode.API_ERROR),
      attempts: state.attempts,
    }
  }

  /**
   * Manual retry - increment attempt and check if allowed
   */
  recordAttempt(operationId: string, errorCode: ErrorCode): boolean {
    const state = this.getState(operationId)
    state.attempts++
    state.lastError = createAppError(errorCode)
    
    return this.canRetry(operationId)
  }

  /**
   * Extract error code from various error types
   */
  private extractErrorCode(error: unknown): ErrorCode {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      if (message.includes('network') || message.includes('fetch')) {
        return ErrorCode.NETWORK_ERROR
      }
      if (message.includes('not found') || message.includes('404')) {
        return ErrorCode.FILE_NOT_FOUND
      }
      if (message.includes('denied') || message.includes('403') || message.includes('401')) {
        return ErrorCode.ACCESS_DENIED
      }
      if (message.includes('quota') || message.includes('429')) {
        return ErrorCode.QUOTA_EXCEEDED
      }
    }
    
    // Check if error has a code property
    const errorWithCode = error as { code?: string }
    if (errorWithCode.code && Object.values(ErrorCode).includes(errorWithCode.code as ErrorCode)) {
      return errorWithCode.code as ErrorCode
    }
    
    return ErrorCode.API_ERROR
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton instance for global retry management
let retryManagerInstance: RetryManager | null = null

export function getRetryManager(): RetryManager {
  if (!retryManagerInstance) {
    retryManagerInstance = new RetryManager()
  }
  return retryManagerInstance
}

/**
 * Create a new retry manager instance (useful for testing)
 */
export function createRetryManager(): RetryManager {
  return new RetryManager()
}
