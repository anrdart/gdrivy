import { Request, Response, NextFunction } from 'express'
import { getOAuthService, OAuthError } from '../services/oauth.js'

// Extend Express Request to include accessToken and auth status
declare global {
  namespace Express {
    interface Request {
      accessToken?: string
      tokenRefreshed?: boolean
    }
  }
}

/**
 * Result of token refresh attempt
 */
interface TokenRefreshResult {
  success: boolean
  accessToken?: string
  error?: string
}

/**
 * Attempt to refresh the access token using the refresh token
 * Returns the new access token if successful, or clears session on failure
 */
async function attemptTokenRefresh(req: Request): Promise<TokenRefreshResult> {
  const refreshToken = req.session?.refreshToken
  
  if (!refreshToken) {
    return { success: false, error: 'No refresh token available' }
  }

  const oauthService = getOAuthService()

  try {
    const tokens = await oauthService.refreshAccessToken(refreshToken)
    
    // Update session with new tokens
    req.session.accessToken = tokens.accessToken
    req.session.refreshToken = tokens.refreshToken
    req.session.expiresAt = tokens.expiresAt
    
    // Mark that token was refreshed in this request
    req.tokenRefreshed = true
    
    console.log('Token auto-refreshed successfully')
    
    return { success: true, accessToken: tokens.accessToken }
  } catch (error) {
    const errorMessage = error instanceof OAuthError ? error.message : 'Unknown error'
    console.warn('Token refresh failed:', errorMessage)
    
    return { success: false, error: errorMessage }
  }
}

/**
 * Clear all authentication data from session
 */
function clearAuthSession(req: Request): void {
  delete req.session.accessToken
  delete req.session.refreshToken
  delete req.session.expiresAt
  delete req.session.user
  delete req.session.userId
}

/**
 * Middleware to extract and validate user access token from session
 * - If user is authenticated, attaches accessToken to request
 * - If token is expired, attempts auto-refresh before API calls
 * - Does NOT block unauthenticated requests (allows fallback to API key)
 * 
 * Token Auto-Refresh Flow:
 * 1. Check if access token exists in session
 * 2. Check if token is expired or about to expire (5 min buffer)
 * 3. If expired, attempt refresh using refresh token
 * 4. If refresh succeeds, update session and continue with new token
 * 5. If refresh fails, clear session and continue without auth
 */
export async function extractUserToken(req: Request, _res: Response, next: NextFunction) {
  try {
    const accessToken = req.session?.accessToken
    const expiresAt = req.session?.expiresAt
    const refreshToken = req.session?.refreshToken

    if (!accessToken) {
      // No token - continue without auth (will use API key for public files)
      return next()
    }

    const oauthService = getOAuthService()

    // Check if token needs refresh (expired or about to expire)
    if (expiresAt && oauthService.isTokenExpired(expiresAt)) {
      if (refreshToken) {
        const refreshResult = await attemptTokenRefresh(req)
        
        if (refreshResult.success && refreshResult.accessToken) {
          // Token refreshed successfully - use new token
          req.accessToken = refreshResult.accessToken
        } else {
          // Token refresh failed - clear session and continue without auth
          clearAuthSession(req)
          // Don't set accessToken - will fallback to API key
        }
      } else {
        // No refresh token available - clear session
        clearAuthSession(req)
      }
    } else {
      // Token is still valid - use existing token
      req.accessToken = accessToken
    }

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    // On error, continue without auth
    next()
  }
}

/**
 * Middleware that requires authentication
 * Returns 401 if user is not authenticated or token refresh fails
 * Use this for endpoints that strictly require authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const accessToken = req.session?.accessToken
    const expiresAt = req.session?.expiresAt
    const refreshToken = req.session?.refreshToken

    if (!accessToken) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required',
        },
      })
    }

    const oauthService = getOAuthService()

    // Check if token needs refresh
    if (expiresAt && oauthService.isTokenExpired(expiresAt)) {
      if (refreshToken) {
        const refreshResult = await attemptTokenRefresh(req)
        
        if (refreshResult.success && refreshResult.accessToken) {
          req.accessToken = refreshResult.accessToken
        } else {
          // Token refresh failed - clear session and return 401
          clearAuthSession(req)
          return res.status(401).json({
            error: {
              code: 'SESSION_EXPIRED',
              message: 'Session expired. Please login again.',
            },
          })
        }
      } else {
        // No refresh token - clear session and return 401
        clearAuthSession(req)
        return res.status(401).json({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session expired. Please login again.',
          },
        })
      }
    } else {
      req.accessToken = accessToken
    }

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error',
      },
    })
  }
}
