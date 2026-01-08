/**
 * AuthService - Frontend service for Google OAuth authentication
 * 
 * Handles OAuth flow initiation, callback processing, logout, and auth status checks.
 * All tokens are stored server-side in sessions (not localStorage) for security.
 * 
 * Requirements: 1.1, 2.4, 6.1, 6.2, 6.3, 6.4
 */

import { AxiosError } from 'axios'
import api from '../lib/api'
import { AuthErrorCode } from '../types'
import { parseAuthErrorCode, createAuthError } from './errorHandler'

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
}

export interface AuthResponse {
  user?: GoogleUser
  isAuthenticated: boolean
  error?: {
    code: string
    message: string
  }
}

interface InitiateLoginResponse {
  authUrl?: string
}

export interface AuthError {
  code: AuthErrorCode
  message: string
  suggestion?: string
  canRetry?: boolean
  requiresReLogin?: boolean
}

/**
 * Type guard to check if an error is an AuthError
 */
function isAuthError(error: unknown): error is AuthError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    Object.values(AuthErrorCode).includes((error as AuthError).code)
  )
}

/**
 * AuthService class for handling Google OAuth authentication
 */
export class AuthService {
  /**
   * Initiate login - redirects to Google OAuth consent screen
   * Requirements: 1.1
   * Throws AUTH_FAILED or NETWORK_ERROR on failure
   */
  async initiateLogin(): Promise<void> {
    try {
      const { data } = await api.post<InitiateLoginResponse>('/api/auth/google')
      
      if (data.authUrl) {
        // Redirect to Google OAuth consent screen
        window.location.href = data.authUrl
      } else {
        throw createAuthError(AuthErrorCode.AUTH_FAILED)
      }
    } catch (error) {
      if (isAuthError(error)) throw error
      console.error('Login initiation error:', error)
      throw createAuthError(AuthErrorCode.NETWORK_ERROR)
    }
  }

  /**
   * Handle OAuth callback - process URL parameters after redirect
   * Returns the authenticated user or throws an AuthError
   * Requirements: 6.1, 6.2
   */
  async handleCallback(): Promise<GoogleUser | null> {
    const urlParams = new URLSearchParams(window.location.search)
    
    // Check for auth error
    const authError = urlParams.get('auth_error')
    if (authError) {
      // Clean up URL
      this.cleanupUrl()
      
      // Parse the error code
      const errorCode = parseAuthErrorCode(authError)
      if (errorCode) {
        throw createAuthError(errorCode)
      }
      
      // Fallback for unknown error codes
      throw createAuthError(AuthErrorCode.AUTH_FAILED)
    }

    // Check for auth success
    const authSuccess = urlParams.get('auth_success')
    if (authSuccess === 'true') {
      // Clean up URL
      this.cleanupUrl()
      // Fetch user info
      return this.checkAuth()
    }

    return null
  }

  /**
   * Logout - clear session and revoke tokens
   * Requirements: 2.4
   * Throws NETWORK_ERROR on failure
   */
  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout')
    } catch (error) {
      if (isAuthError(error)) throw error
      console.error('Logout error:', error)
      throw createAuthError(AuthErrorCode.NETWORK_ERROR)
    }
  }

  /**
   * Check current authentication status
   * Returns the current user if authenticated, null otherwise
   */
  async checkAuth(): Promise<GoogleUser | null> {
    try {
      const { data } = await api.get<AuthResponse>('/api/auth/me')
      return data.user || null
    } catch (error) {
      // 401 means not authenticated - this is expected
      if (error instanceof AxiosError && error.response?.status === 401) {
        return null
      }
      console.error('Auth check error:', error)
      return null
    }
  }

  /**
   * Refresh access token
   * Returns true if refresh was successful
   * Throws SESSION_EXPIRED if refresh fails
   * Requirements: 6.4
   */
  async refreshToken(): Promise<boolean> {
    try {
      await api.post('/api/auth/refresh')
      return true
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        throw createAuthError(AuthErrorCode.SESSION_EXPIRED)
      }
      if (isAuthError(error)) throw error
      console.error('Token refresh error:', error)
      throw createAuthError(AuthErrorCode.NETWORK_ERROR)
    }
  }

  /**
   * Clean up URL parameters after handling callback
   */
  private cleanupUrl(): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('auth_success')
    url.searchParams.delete('auth_error')
    url.searchParams.delete('message')
    window.history.replaceState({}, document.title, url.pathname)
  }
}

// Singleton instance
let authServiceInstance: AuthService | null = null

/**
 * Get the singleton AuthService instance
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService()
  }
  return authServiceInstance
}

/**
 * Create a new AuthService instance (useful for testing)
 */
export function createAuthService(): AuthService {
  return new AuthService()
}
