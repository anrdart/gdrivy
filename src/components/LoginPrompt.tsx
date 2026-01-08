import { useEffect, useCallback } from 'react'
import { FiLock, FiLogIn, FiX } from 'react-icons/fi'
import { useAppStore } from '../store/useAppStore'

interface LoginPromptProps {
  message?: string
  onDismiss?: () => void
}

/**
 * LoginPrompt Component - Modal Dialog
 * 
 * Displays a modal popup to login when accessing private files.
 * Shows explanation and login button.
 * 
 * Requirements: 3.4, 4.4
 * - WHEN a non-logged-in user tries to access a private file THEN the User_Interface SHALL prompt them to login
 * - WHEN accessing a private file without login THEN the User_Interface SHALL show a prompt to login with explanation
 */
export function LoginPrompt({ message, onDismiss }: LoginPromptProps) {
  const { login, isAuthLoading } = useAppStore()

  const handleLogin = async () => {
    await login()
  }

  // Handle escape key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && onDismiss) {
      onDismiss()
    }
  }, [onDismiss])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [handleKeyDown])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onDismiss) {
      onDismiss()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl animate-slide-up">
        {/* Close button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <FiX className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <FiLock className="w-8 h-8 text-amber-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-2">
            File Private
          </h2>

          {/* Message */}
          <p className="text-gray-400 text-sm mb-6">
            {message || 'File ini bersifat private. Login dengan akun Google untuk mengakses file ini.'}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogin}
              disabled={isAuthLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary-500/25"
            >
              {isAuthLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <FiLogIn className="w-5 h-5" />
                  <span>Login dengan Google</span>
                </>
              )}
            </button>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="w-full px-6 py-3 text-gray-400 hover:text-white hover:bg-surface-800 font-medium rounded-xl transition-colors"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPrompt
