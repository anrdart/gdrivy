import { google, Auth } from 'googleapis'
import crypto from 'crypto'

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
}

export class OAuthError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message)
    this.name = 'OAuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class OAuthService {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private oauth2Client: Auth.OAuth2Client

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || ''
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'

    if (!this.clientId || !this.clientSecret) {
      console.warn('Warning: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. OAuth will fail.')
    }

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    )
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE(): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    return { codeVerifier, codeChallenge }
  }

  /**
   * Generate OAuth authorization URL with PKCE
   */
  generateAuthUrl(state: string, codeChallenge: string): string {
    const baseUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
      prompt: 'consent',
    })

    // Append PKCE parameters
    const url = new URL(baseUrl)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')

    return url.toString()
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
    try {
      const { tokens } = await this.oauth2Client.getToken({
        code,
        codeVerifier,
      })

      if (!tokens.access_token) {
        throw new OAuthError('No access token received', 'AUTH_FAILED', 401)
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date || Date.now() + 3600 * 1000,
      }
    } catch (error) {
      const err = error as { message?: string; code?: string }
      if (err.code === 'invalid_grant') {
        throw new OAuthError('Authorization code expired or invalid', 'AUTH_FAILED', 401)
      }
      throw new OAuthError(
        err.message || 'Failed to exchange authorization code',
        'AUTH_FAILED',
        401
      )
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken })
      const { credentials } = await this.oauth2Client.refreshAccessToken()

      if (!credentials.access_token) {
        throw new OAuthError('Failed to refresh access token', 'SESSION_EXPIRED', 401)
      }

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: credentials.expiry_date || Date.now() + 3600 * 1000,
      }
    } catch (error) {
      const err = error as { message?: string }
      throw new OAuthError(
        err.message || 'Failed to refresh token',
        'SESSION_EXPIRED',
        401
      )
    }
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<GoogleUser> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken })
      
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const { data } = await oauth2.userinfo.get()

      if (!data.id || !data.email) {
        throw new OAuthError('Invalid user info received', 'AUTH_FAILED', 500)
      }

      return {
        id: data.id,
        email: data.email,
        name: data.name || data.email,
        picture: data.picture || '',
      }
    } catch (error) {
      const err = error as { message?: string; code?: number }
      if (err.code === 401) {
        throw new OAuthError('Access token expired or invalid', 'SESSION_EXPIRED', 401)
      }
      throw new OAuthError(
        err.message || 'Failed to get user info',
        'AUTH_FAILED',
        500
      )
    }
  }

  /**
   * Revoke token (logout)
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(token)
    } catch (error) {
      console.warn('Token revoke warning:', (error as Error).message)
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(expiresAt: number): boolean {
    const bufferTime = 5 * 60 * 1000 // 5 minutes buffer
    return Date.now() >= expiresAt - bufferTime
  }
}

// Singleton instance
let oauthServiceInstance: OAuthService | null = null

export function getOAuthService(): OAuthService {
  if (!oauthServiceInstance) {
    oauthServiceInstance = new OAuthService()
  }
  return oauthServiceInstance
}
