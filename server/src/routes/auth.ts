import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { getOAuthService, OAuthError, GoogleUser } from '../services/oauth.js'

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    oauthState?: string
    codeVerifier?: string
    userId?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    user?: GoogleUser
  }
}

const router = Router()

// Lazy getter for OAuth service to ensure env vars are loaded
const getOAuth = () => getOAuthService()

/**
 * POST /api/auth/google
 * Initiate OAuth flow - returns auth URL
 */
router.post('/google', (req: Request, res: Response) => {
  try {
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = getOAuth().generatePKCE()
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex')
    
    // Store in session for verification
    req.session.oauthState = state
    req.session.codeVerifier = codeVerifier
    
    // Generate auth URL
    const authUrl = getOAuth().generateAuthUrl(state, codeChallenge)
    
    res.json({ authUrl })
  } catch (error) {
    console.error('Error generating auth URL:', error)
    res.status(500).json({
      error: {
        code: 'AUTH_FAILED',
        message: 'Failed to initiate authentication',
      },
    })
  }
})

/**
 * GET /api/auth/google/callback
 * Handle OAuth callback from Google
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  
  try {
    const { code, state, error } = req.query
    
    // Check for OAuth errors (user denied consent)
    if (error) {
      return res.redirect(`${frontendUrl}?auth_error=AUTH_CANCELLED`)
    }
    
    // Validate state to prevent CSRF
    if (!state || state !== req.session.oauthState) {
      return res.redirect(`${frontendUrl}?auth_error=AUTH_FAILED&message=Invalid state`)
    }
    
    // Get code verifier from session
    const codeVerifier = req.session.codeVerifier
    if (!codeVerifier) {
      return res.redirect(`${frontendUrl}?auth_error=AUTH_FAILED&message=Missing code verifier`)
    }
    
    if (!code || typeof code !== 'string') {
      return res.redirect(`${frontendUrl}?auth_error=AUTH_FAILED&message=Missing authorization code`)
    }
    
    // Exchange code for tokens
    const tokens = await getOAuth().exchangeCode(code, codeVerifier)
    
    // Get user info
    const user = await getOAuth().getUserInfo(tokens.accessToken)
    
    // Store in session
    req.session.userId = user.id
    req.session.accessToken = tokens.accessToken
    req.session.refreshToken = tokens.refreshToken
    req.session.expiresAt = tokens.expiresAt
    req.session.user = user
    
    // Clear OAuth temp data
    delete req.session.oauthState
    delete req.session.codeVerifier
    
    // Redirect to frontend with success
    res.redirect(`${frontendUrl}?auth_success=true`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    const errorCode = error instanceof OAuthError ? error.code : 'AUTH_FAILED'
    res.redirect(`${frontendUrl}?auth_error=${errorCode}`)
  }
})

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.session.refreshToken
    
    if (!refreshToken) {
      // Clear any remaining session data
      delete req.session.accessToken
      delete req.session.user
      delete req.session.userId
      delete req.session.expiresAt
      
      return res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'No refresh token available',
        },
      })
    }
    
    const tokens = await getOAuth().refreshAccessToken(refreshToken)
    
    // Update session with new tokens
    req.session.accessToken = tokens.accessToken
    req.session.refreshToken = tokens.refreshToken
    req.session.expiresAt = tokens.expiresAt
    
    res.json({ success: true })
  } catch (error) {
    console.error('Token refresh error:', error)
    
    // Clear all auth data from session on refresh failure
    delete req.session.accessToken
    delete req.session.refreshToken
    delete req.session.expiresAt
    delete req.session.user
    delete req.session.userId
    
    res.status(401).json({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Failed to refresh token. Please login again.',
      },
    })
  }
})

/**
 * POST /api/auth/logout
 * Clear session and revoke tokens
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const accessToken = req.session.accessToken
    
    // Revoke token if available
    if (accessToken) {
      await getOAuth().revokeToken(accessToken)
    }
    
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err)
        return res.status(500).json({
          error: {
            code: 'LOGOUT_FAILED',
            message: 'Failed to logout',
          },
        })
      }
      
      // Clear session cookie
      res.clearCookie('connect.sid')
      res.json({ success: true })
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Failed to logout',
      },
    })
  }
})

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = req.session.user
    const expiresAt = req.session.expiresAt
    const refreshToken = req.session.refreshToken
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Not authenticated',
        },
      })
    }
    
    // Check if token needs refresh before returning user info
    if (expiresAt && getOAuth().isTokenExpired(expiresAt)) {
      if (refreshToken) {
        try {
          const tokens = await getOAuth().refreshAccessToken(refreshToken)
          req.session.accessToken = tokens.accessToken
          req.session.refreshToken = tokens.refreshToken
          req.session.expiresAt = tokens.expiresAt
          console.log('Token auto-refreshed in /me endpoint')
        } catch (refreshError) {
          // Token refresh failed, clear session and return 401
          console.warn('Token refresh failed in /me:', refreshError)
          
          // Clear all auth data from session
          delete req.session.accessToken
          delete req.session.refreshToken
          delete req.session.expiresAt
          delete req.session.user
          delete req.session.userId
          
          return res.status(401).json({
            error: {
              code: 'SESSION_EXPIRED',
              message: 'Session expired. Please login again.',
            },
          })
        }
      } else {
        // No refresh token available - session is invalid
        delete req.session.accessToken
        delete req.session.user
        delete req.session.userId
        delete req.session.expiresAt
        
        return res.status(401).json({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session expired. Please login again.',
          },
        })
      }
    }
    
    res.json({
      user,
      isAuthenticated: true,
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({
      error: {
        code: 'AUTH_FAILED',
        message: 'Failed to get user info',
      },
    })
  }
})

export { router as authRouter }
