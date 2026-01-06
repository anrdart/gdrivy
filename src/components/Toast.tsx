import { useEffect, useState, useCallback } from 'react'
import { FiCheck, FiX, FiAlertCircle, FiInfo } from 'react-icons/fi'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  suggestion?: string
  duration?: number
}

interface ToastProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

/**
 * Get icon based on toast type
 */
function getToastIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return <FiCheck className="w-5 h-5 text-accent-400" />
    case 'error':
      return <FiAlertCircle className="w-5 h-5 text-red-400" />
    case 'warning':
      return <FiAlertCircle className="w-5 h-5 text-yellow-400" />
    case 'info':
    default:
      return <FiInfo className="w-5 h-5 text-primary-400" />
  }
}

/**
 * Get background color based on toast type
 */
function getToastBgClass(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'bg-surface-800 border-accent-500/50'
    case 'error':
      return 'bg-surface-800 border-red-500/50'
    case 'warning':
      return 'bg-surface-800 border-yellow-500/50'
    case 'info':
    default:
      return 'bg-surface-800 border-primary-500/50'
  }
}

/**
 * Single Toast Component
 */
function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }, [toast.id, onDismiss])

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(handleDismiss, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, handleDismiss])

  return (
    <div
      className={`
        flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border shadow-card
        transition-all duration-300 transform backdrop-blur-sm
        ${getToastBgClass(toast.type)}
        ${isExiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getToastIcon(toast.type)}
      </div>

      {/* Content */}
      <div className="flex-grow min-w-0">
        <p className="font-semibold text-white text-sm sm:text-base">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-xs sm:text-sm text-gray-300">{toast.message}</p>
        )}
        {toast.suggestion && (
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-400 italic">{toast.suggestion}</p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 sm:p-1.5 text-gray-500 hover:text-white hover:bg-surface-700 rounded-lg transition-all duration-200 touch-target"
        aria-label="Dismiss notification"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

/**
 * ToastContainer Component
 * 
 * Container for displaying toast notifications.
 * Positioned at top-right of the screen.
 * 
 * Requirements: 5.5, 6.4
 * - THE User_Interface SHALL provide visual feedback for all user actions (loading states, success, errors)
 * - WHEN any error occurs THEN the User_Interface SHALL display user-friendly error message with suggested action
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div 
      className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex flex-col gap-2 sm:gap-3 max-w-[calc(100vw-1rem)] sm:max-w-sm w-full"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default ToastContainer
