/**
 * AuthErrorDisplay Component
 * 
 * Displays authentication error messages with appropriate actions:
 * - Login cancelled message
 * - Auth failed with retry
 * - Session expired with re-login
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { FiAlertCircle, FiRefreshCw, FiLogIn, FiX } from 'react-icons/fi'
import { AuthErrorCode } from '../types'
import { getAuthErrorMessage } from '../services/errorHandler'

interface AuthErrorDisplayProps {
  errorCode: AuthErrorCode
  onRetry?: () => void
  onReLogin?: () => void
  onDismiss?: () => void
}

/**
 * AuthErrorDisplay Component
 * 
 * Shows auth error with appropriate action buttons based on error type.
 */
export function AuthErrorDisplay({ 
  errorCode, 
  onRetry, 
  onReLogin, 
  onDismiss 
}: AuthErrorDisplayProps) {
  const { message, suggestion, canRetry, requiresReLogin } = getAuthErrorMessage(errorCode)

  return (
    <div 
      className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-sm"
      role="alert"
      aria-live="polite"
    >
      {/* Error Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <FiAlertCircle className="w-5 h-5 text-red-400" />
      </div>

      {/* Content */}
      <div className="flex-grow min-w-0">
        <p className="font-semibold text-red-300">{message}</p>
        <p className="mt-1 text-sm text-gray-400">{suggestion}</p>

        {/* Action Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Retry Button - for AUTH_CANCELLED, AUTH_FAILED, NETWORK_ERROR */}
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span>Coba Lagi</span>
            </button>
          )}

          {/* Re-Login Button - for SESSION_EXPIRED */}
          {requiresReLogin && onReLogin && (
            <button
              onClick={onReLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-accent-500/20 text-accent-300 hover:bg-accent-500/30 transition-colors"
            >
              <FiLogIn className="w-4 h-4" />
              <span>Login Kembali</span>
            </button>
          )}
        </div>
      </div>

      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1.5 text-gray-500 hover:text-white hover:bg-surface-700 rounded-lg transition-all duration-200"
          aria-label="Dismiss error"
        >
          <FiX className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default AuthErrorDisplay
