import { ErrorCode, AppError, AuthErrorCode, AuthError } from '../types'

/**
 * Extended error info with login prompt support
 * Requirements: 3.4, 4.4
 */
export interface ErrorInfo {
  message: string
  suggestion: string
  requiresLogin?: boolean
}

/**
 * User-friendly error messages with suggested actions
 * Property 7: Error Message Coverage
 * For any ErrorCode in the system, there SHALL exist a corresponding 
 * user-friendly error message with a suggested action.
 * Validates: Requirements 6.4
 */
export const errorMessages: Record<ErrorCode, ErrorInfo> = {
  [ErrorCode.INVALID_LINK]: {
    message: 'Link tidak valid. Pastikan link berasal dari Google Drive.',
    suggestion: 'Coba paste ulang link dari Google Drive',
  },
  [ErrorCode.FILE_NOT_FOUND]: {
    message: 'File tidak ditemukan. File mungkin sudah dihapus atau bersifat private.',
    suggestion: 'Jika file bersifat private, coba login dengan akun Google yang memiliki akses',
    requiresLogin: true,
  },
  [ErrorCode.ACCESS_DENIED]: {
    message: 'File ini bersifat private atau memerlukan izin akses.',
    suggestion: 'Login dengan akun Google untuk mengakses file private',
    requiresLogin: true,
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
export function getErrorMessage(code: ErrorCode): ErrorInfo {
  return errorMessages[code] || {
    message: 'Terjadi kesalahan yang tidak diketahui.',
    suggestion: 'Coba lagi atau hubungi support',
  }
}

/**
 * Auth error messages with suggested actions
 * Requirements: 6.1, 6.2, 6.3, 6.4
 * 
 * AUTH_CANCELLED - consent denied
 * AUTH_FAILED - token exchange error
 * NETWORK_ERROR - connection failed
 * SESSION_EXPIRED - refresh failed
 */
export interface AuthErrorInfo {
  message: string
  suggestion: string
  canRetry: boolean
  requiresReLogin: boolean
}

export const authErrorMessages: Record<AuthErrorCode, AuthErrorInfo> = {
  [AuthErrorCode.AUTH_CANCELLED]: {
    message: 'Login dibatalkan',
    suggestion: 'Klik tombol login untuk mencoba lagi',
    canRetry: true,
    requiresReLogin: false,
  },
  [AuthErrorCode.AUTH_FAILED]: {
    message: 'Autentikasi gagal',
    suggestion: 'Terjadi kesalahan saat login. Silakan coba lagi',
    canRetry: true,
    requiresReLogin: false,
  },
  [AuthErrorCode.NETWORK_ERROR]: {
    message: 'Koneksi gagal',
    suggestion: 'Periksa koneksi internet dan coba lagi',
    canRetry: true,
    requiresReLogin: false,
  },
  [AuthErrorCode.SESSION_EXPIRED]: {
    message: 'Sesi berakhir',
    suggestion: 'Silakan login kembali untuk melanjutkan',
    canRetry: false,
    requiresReLogin: true,
  },
}

/**
 * Get user-friendly auth error message for an auth error code
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export function getAuthErrorMessage(code: AuthErrorCode): AuthErrorInfo {
  return authErrorMessages[code] || {
    message: 'Terjadi kesalahan autentikasi',
    suggestion: 'Silakan coba login kembali',
    canRetry: true,
    requiresReLogin: false,
  }
}

/**
 * Create an AuthError from an auth error code
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export function createAuthError(code: AuthErrorCode): AuthError {
  const { message, suggestion, canRetry, requiresReLogin } = getAuthErrorMessage(code)
  return { code, message, suggestion, canRetry, requiresReLogin }
}

/**
 * Parse auth error code from string
 * Returns the AuthErrorCode if valid, null otherwise
 */
export function parseAuthErrorCode(code: string): AuthErrorCode | null {
  if (Object.values(AuthErrorCode).includes(code as AuthErrorCode)) {
    return code as AuthErrorCode
  }
  return null
}

/**
 * Check if an auth error requires re-login
 * Requirements: 6.4
 */
export function isReLoginRequired(code: AuthErrorCode): boolean {
  const errorInfo = authErrorMessages[code]
  return errorInfo?.requiresReLogin === true
}

/**
 * Check if an auth error can be retried
 * Requirements: 6.2, 6.3
 */
export function canRetryAuth(code: AuthErrorCode): boolean {
  const errorInfo = authErrorMessages[code]
  return errorInfo?.canRetry === true
}

/**
 * Check if an error requires login to resolve
 * Requirements: 3.4, 4.4
 */
export function isLoginRequiredError(code: ErrorCode): boolean {
  const errorInfo = errorMessages[code]
  return errorInfo?.requiresLogin === true
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
