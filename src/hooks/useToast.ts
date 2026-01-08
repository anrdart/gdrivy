import { useState, useCallback } from 'react'
import type { ToastMessage, ToastType } from '../components/Toast'
import { ErrorCode, AuthErrorCode } from '../types'
import { getErrorMessage, getAuthErrorMessage } from '../services/errorHandler'

let toastIdCounter = 0

/**
 * Generate unique toast ID
 */
function generateToastId(): string {
  return `toast-${++toastIdCounter}-${Date.now()}`
}

/**
 * Default toast duration in milliseconds
 */
const DEFAULT_DURATION = 5000

/**
 * useToast Hook
 * 
 * Custom hook for managing toast notifications.
 * Provides methods to show success, error, warning, and info toasts.
 * 
 * Requirements: 5.5, 6.4
 * - THE User_Interface SHALL provide visual feedback for all user actions
 * - WHEN any error occurs THEN the User_Interface SHALL display user-friendly error message
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  /**
   * Add a new toast notification
   */
  const addToast = useCallback((
    type: ToastType,
    title: string,
    options?: {
      message?: string
      suggestion?: string
      duration?: number
    }
  ) => {
    const toast: ToastMessage = {
      id: generateToastId(),
      type,
      title,
      message: options?.message,
      suggestion: options?.suggestion,
      duration: options?.duration ?? DEFAULT_DURATION,
    }

    setToasts((prev) => [...prev, toast])
    return toast.id
  }, [])

  /**
   * Dismiss a toast by ID
   */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  /**
   * Clear all toasts
   */
  const clearAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  /**
   * Show success toast
   */
  const showSuccess = useCallback((title: string, message?: string) => {
    return addToast('success', title, { message })
  }, [addToast])

  /**
   * Show error toast with optional suggestion
   */
  const showError = useCallback((title: string, message?: string, suggestion?: string) => {
    return addToast('error', title, { message, suggestion, duration: 8000 })
  }, [addToast])

  /**
   * Show error toast from ErrorCode
   * Uses the error message mapping from errorHandler
   */
  const showErrorFromCode = useCallback((code: ErrorCode) => {
    const { message, suggestion } = getErrorMessage(code)
    return addToast('error', message, { suggestion, duration: 8000 })
  }, [addToast])

  /**
   * Show auth error toast from AuthErrorCode
   * Uses the auth error message mapping from errorHandler
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  const showAuthError = useCallback((code: AuthErrorCode) => {
    const { message, suggestion } = getAuthErrorMessage(code)
    return addToast('error', message, { suggestion, duration: 8000 })
  }, [addToast])

  /**
   * Show login cancelled toast
   * Requirements: 6.1
   */
  const showLoginCancelled = useCallback(() => {
    return showAuthError(AuthErrorCode.AUTH_CANCELLED)
  }, [showAuthError])

  /**
   * Show auth failed toast with retry option
   * Requirements: 6.2
   */
  const showAuthFailed = useCallback(() => {
    return showAuthError(AuthErrorCode.AUTH_FAILED)
  }, [showAuthError])

  /**
   * Show network error during auth toast
   * Requirements: 6.3
   */
  const showAuthNetworkError = useCallback(() => {
    return showAuthError(AuthErrorCode.NETWORK_ERROR)
  }, [showAuthError])

  /**
   * Show session expired toast with re-login prompt
   * Requirements: 6.4
   */
  const showSessionExpired = useCallback(() => {
    return showAuthError(AuthErrorCode.SESSION_EXPIRED)
  }, [showAuthError])

  /**
   * Show warning toast
   */
  const showWarning = useCallback((title: string, message?: string) => {
    return addToast('warning', title, { message, duration: 6000 })
  }, [addToast])

  /**
   * Show info toast
   */
  const showInfo = useCallback((title: string, message?: string) => {
    return addToast('info', title, { message })
  }, [addToast])

  /**
   * Show download complete toast
   */
  const showDownloadComplete = useCallback((fileName: string) => {
    return showSuccess('Download Complete', `${fileName} has been downloaded successfully.`)
  }, [showSuccess])

  /**
   * Show download failed toast
   */
  const showDownloadFailed = useCallback((fileName: string, errorMessage?: string) => {
    return showError(
      'Download Failed',
      `Failed to download ${fileName}${errorMessage ? `: ${errorMessage}` : ''}`,
      'Click retry to try again'
    )
  }, [showError])

  return {
    toasts,
    addToast,
    dismissToast,
    clearAllToasts,
    showSuccess,
    showError,
    showErrorFromCode,
    showAuthError,
    showLoginCancelled,
    showAuthFailed,
    showAuthNetworkError,
    showSessionExpired,
    showWarning,
    showInfo,
    showDownloadComplete,
    showDownloadFailed,
  }
}

export default useToast
