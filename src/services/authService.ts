/**
 * AuthService - Frontend service for Google OAuth authentication
 * 
 * Handles OAuth flow initiation, callback processing, logout, and auth status checks.
 * All tokens are stored server-side in sessions (not localStorage) for security.
 * 
 * Requirements: 1.1, 2.4, 6.1, 6.2, 6.3, 6.4
 */

import { AuthErrorCode } from '../types'
import { parseAuthErrorCode, createAuthError } from './errorHandler'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

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

export interface AuthError {
  code: AuthErrorCode
  message: string
  suggestion?: string
  canRetry?: boolean
  requiresReLogin?: boolean
}

/**
 * AuthService class for handling Google OAuth authentication
 */
export class AuthService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Initiate login - redirects to Google OAuth consent screen
   * Requirements: 1.1
   * Throws AUTH_FAILED or NETWORK_ERROR on failure
   */
  async initiateLogin(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/google`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        await response.json().catch(() => ({}))
        throw createAuthError(AuthErrorCode.AUTH_FAILED)
      }

      const data = await response.json()
      
      if (data.authUrl) {
        // Redirect to Google OAuth consent screen
        window.location.href = data.authUrl
      } else {
        throw createAuthError(AuthErrorCode.AUTH_FAILED)
      }
    } catch (error) {
      // Check if it's already an AuthError
      if (error && typeof error === 'object' && 'code' in error) {
        const authError = error as AuthError
        if (Object.values(AuthErrorCode).includes(authError.code)) {
          throw error
        }
      }
      // Network error
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
      const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw createAuthError(AuthErrorCode.NETWORK_ERROR)
      }
    } catch (error) {
      // Check if it's already an AuthError
      if (error && typeof error === 'object' && 'code' in error) {
        const authError = error as AuthError
        if (Object.values(AuthErrorCode).includes(authError.code)) {
          throw error
        }
      }
      console.error('Logout error:', error)
      throw createAuthError(AuthErrorCode.NETWORK_ERROR)
    }
  }

  /**
   * Check current authentication status
   * Returns the current user if authenticated, null otherwise
   * Throws SESSION_EXPIRED if session is invalid
   */
  async checkAuth(): Promise<GoogleUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        // Not authenticated
        return null
      }

      if (!response.ok) {
        return null
      }

      const data: AuthResponse = await response.json()
      return data.user || null
    } catch (error) {
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
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        // Session expired, need to re-login
        throw createAuthError(AuthErrorCode.SESSION_EXPIRED)
      }

      return response.ok
    } catch (error) {
      // Check if it's already an AuthError
      if (error && typeof error === 'object' && 'code' in error) {
        const authError = error as AuthError
        if (Object.values(AuthErrorCode).includes(authError.code)) {
          throw error
        }
      }
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
export function createAuthService(baseUrl?: string): AuthService {
  return new AuthService(baseUrl)
}
