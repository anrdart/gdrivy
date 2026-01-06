import { ErrorCode, AppError } from '../types'

/**
 * User-friendly error messages with suggested actions
 * Property 7: Error Message Coverage
 * For any ErrorCode in the system, there SHALL exist a corresponding 
 * user-friendly error message with a suggested action.
 * Validates: Requirements 6.4
 */
export const errorMessages: Record<ErrorCode, { message: string; suggestion: string }> = {
  [ErrorCode.INVALID_LINK]: {
    message: 'Link tidak valid. Pastikan link berasal dari Google Drive.',
    suggestion: 'Coba paste ulang link dari Google Drive',
  },
  [ErrorCode.FILE_NOT_FOUND]: {
    message: 'File tidak ditemukan atau sudah dihapus.',
    suggestion: 'Periksa kembali link atau hubungi pemilik file',
  },
  [ErrorCode.ACCESS_DENIED]: {
    message: 'File ini bersifat private atau memerlukan izin akses.',
    suggestion: 'Minta pemilik file untuk mengubah pengaturan sharing',
  },
  [ErrorCode.QUOTA_EXCEEDED]: {
    message: 'Kuota download Google Drive telah habis.',
    suggestion: 'Coba lagi dalam beberapa jam atau gunakan akun berbeda',
  },
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Koneksi internet bermasalah.',
    suggestion: 'Periksa koneksi internet dan coba lagi',
  },
  [ErrorCode.DOWNLOAD_FAILED]: {
    message: 'Download gagal.',
    suggestion: 'Klik tombol retry untuk mencoba lagi',
  },
  [ErrorCode.API_ERROR]: {
    message: 'Terjadi kesalahan pada server.',
    suggestion: 'Coba lagi dalam beberapa saat',
  },
}

/**
 * Get user-friendly error message for an error code
 */
export function getErrorMessage(code: ErrorCode): { message: string; suggestion: string } {
  return errorMessages[code] || {
    message: 'Terjadi kesalahan yang tidak diketahui.',
    suggestion: 'Coba lagi atau hubungi support',
  }
}

/**
 * Create an AppError from an error code
 */
export function createAppError(code: ErrorCode): AppError {
  const { message, suggestion } = getErrorMessage(code)
  return { code, message, suggestion }
}

/**
 * Check if all error codes have corresponding messages
 * Used for testing Property 7
 */
export function hasMessageForAllErrorCodes(): boolean {
  const allCodes = Object.values(ErrorCode)
  return allCodes.every(code => errorMessages[code] !== undefined)
}

/**
 * Get all error codes that have messages defined
 */
export function getErrorCodesWithMessages(): ErrorCode[] {
  return Object.keys(errorMessages) as ErrorCode[]
}

/**
 * Retry configuration matching the design document
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  backoffMultiplier: 2, // exponential backoff
  maxDelay: 10000, // 10 seconds max
}

/**
 * Calculate delay for a retry attempt using exponential backoff
 */
export function calculateRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt)
  return Math.min(delay, RETRY_CONFIG.maxDelay)
}

/**
 * Retry state for tracking retry attempts
 */
export interface RetryState {
  attempts: number
  lastError: AppError | null
  isRetrying: boolean
}

/**
 * Create initial retry state
 */
export function createRetryState(): RetryState {
  return {
    attempts: 0,
    lastError: null,
    isRetrying: false,
  }
}

/**
 * Check if retry is allowed based on current state
 * Property 8: Retry Limit Enforcement
 * For any download that encounters network errors, the Download_Manager 
 * SHALL retry at most 3 times before marking the download as failed.
 * Validates: Requirements 6.3
 */
export function canRetry(state: RetryState): boolean {
  return state.attempts < RETRY_CONFIG.maxRetries
}

/**
 * Check if error is retryable (network errors)
 */
export function isRetryableError(code: ErrorCode): boolean {
  return code === ErrorCode.NETWORK_ERROR || code === ErrorCode.DOWNLOAD_FAILED
}
