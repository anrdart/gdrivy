import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { Request, Response, NextFunction } from 'express'
import { extractUserToken, requireAuth } from './auth.js'
import * as oauthModule from '../services/oauth.js'

/**
 * Property Test for Token Auto-Refresh
 * **Property 3: Token Auto-Refresh**
 * **Validates: Requirements 2.2**
 * 
 * *For any* API request with an expired token and valid refresh token,
 * the system SHALL automatically attempt to refresh the access token.
 */

// Mock the OAuth service
vi.mock('../services/oauth.js', async () => {
  const actual = await vi.importActual('../services/oauth.js')
  return {
    ...actual,
    getOAuthService: vi.fn(),
  }
})

describe('Auth Middleware - Property Tests', () => {
  // Arbitrary generators for test data
  const accessTokenArb = fc.string({ minLength: 10, maxLength: 100 })
  const refreshTokenArb = fc.string({ minLength: 10, maxLength: 100 })
  
  // Generate expiry times (past = expired, future = valid)
  // Use min: 1 to avoid 0 which is falsy and skips the expiry check
  const expiredTimeArb = fc.integer({ min: 1, max: Date.now() - 1000 })
  const validTimeArb = fc.integer({ min: Date.now() + 60000, max: Date.now() + 3600000 })

  let mockOAuthService: {
    isTokenExpired: ReturnType<typeof vi.fn>
    refreshAccessToken: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockOAuthService = {
      isTokenExpired: vi.fn(),
      refreshAccessToken: vi.fn(),
    }
    vi.mocked(oauthModule.getOAuthService).mockReturnValue(mockOAuthService as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Feature: google-oauth, Property 3: Token Auto-Refresh
   * 
   * For any request with an expired access token and a valid refresh token,
   * the middleware SHALL attempt to refresh the token automatically.
   */
  it('Property 3: should auto-refresh expired tokens when refresh token is available', async () => {
    await fc.assert(
      fc.asyncProperty(
        accessTokenArb,
        refreshTokenArb,
        expiredTimeArb,
        accessTokenArb, // new access token after refresh
        async (oldAccessToken, refreshToken, expiresAt, newAccessToken) => {
          // Reset and re-setup mocks for each iteration
          mockOAuthService.isTokenExpired.mockReset()
          mockOAuthService.refreshAccessToken.mockReset()
          
          // Setup: token is expired
          mockOAuthService.isTokenExpired.mockReturnValue(true)
          mockOAuthService.refreshAccessToken.mockResolvedValue({
            accessToken: newAccessToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() + 3600000,
          })

          // Create mock request with expired token
          const mockSession = {
            accessToken: oldAccessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
          }
          const req = {
            session: mockSession,
          } as unknown as Request

          const res = {} as Response
          const next = vi.fn() as NextFunction

          // Execute middleware
          await extractUserToken(req, res, next)

          // Verify: refresh was attempted with the correct refresh token
          expect(mockOAuthService.refreshAccessToken).toHaveBeenCalledTimes(1)
          expect(mockOAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken)
          
          // Verify: session was updated with new token
          expect(req.session.accessToken).toBe(newAccessToken)
          
          // Verify: request has new access token
          expect(req.accessToken).toBe(newAccessToken)
          
          // Verify: next was called (request continues)
          expect(next).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: When token is not expired, no refresh should be attempted
   */
  it('should not refresh valid (non-expired) tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        accessTokenArb,
        refreshTokenArb,
        validTimeArb,
        async (accessToken, refreshToken, expiresAt) => {
          // Reset and re-setup mocks for each iteration
          mockOAuthService.isTokenExpired.mockReset()
          mockOAuthService.refreshAccessToken.mockReset()
          
          // Setup: token is NOT expired
          mockOAuthService.isTokenExpired.mockReturnValue(false)

          const mockSession = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
          }
          const req = {
            session: mockSession,
          } as unknown as Request

          const res = {} as Response
          const next = vi.fn() as NextFunction

          await extractUserToken(req, res, next)

          // Verify: refresh was NOT attempted
          expect(mockOAuthService.refreshAccessToken).not.toHaveBeenCalled()
          
          // Verify: original token is used
          expect(req.accessToken).toBe(accessToken)
          
          // Verify: next was called
          expect(next).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: When refresh fails, session should be cleared
   * **Validates: Requirements 2.3**
   */
  it('should clear session when token refresh fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        accessTokenArb,
        refreshTokenArb,
        expiredTimeArb,
        fc.string(), // error message
        async (accessToken, refreshToken, expiresAt, errorMessage) => {
          // Reset and re-setup mocks for each iteration
          mockOAuthService.isTokenExpired.mockReset()
          mockOAuthService.refreshAccessToken.mockReset()
          
          // Setup: token is expired and refresh will fail
          mockOAuthService.isTokenExpired.mockReturnValue(true)
          mockOAuthService.refreshAccessToken.mockRejectedValue(new Error(errorMessage))

          const mockSession = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            user: { id: 'test', email: 'test@test.com', name: 'Test', picture: '' },
            userId: 'test',
          }
          const req = {
            session: mockSession,
          } as unknown as Request

          const res = {} as Response
          const next = vi.fn() as NextFunction

          await extractUserToken(req, res, next)

          // Verify: session auth data was cleared
          expect(req.session.accessToken).toBeUndefined()
          expect(req.session.refreshToken).toBeUndefined()
          expect(req.session.expiresAt).toBeUndefined()
          expect(req.session.user).toBeUndefined()
          
          // Verify: request has no access token (will fallback to API key)
          expect(req.accessToken).toBeUndefined()
          
          // Verify: next was still called (graceful degradation)
          expect(next).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: requireAuth should return 401 when refresh fails
   * **Validates: Requirements 2.3**
   */
  it('requireAuth should return 401 when token refresh fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        accessTokenArb,
        refreshTokenArb,
        expiredTimeArb,
        async (accessToken, refreshToken, expiresAt) => {
          // Reset and re-setup mocks for each iteration
          mockOAuthService.isTokenExpired.mockReset()
          mockOAuthService.refreshAccessToken.mockReset()
          
          // Setup: token is expired and refresh will fail
          mockOAuthService.isTokenExpired.mockReturnValue(true)
          mockOAuthService.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'))

          const mockSession = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            user: { id: 'test', email: 'test@test.com', name: 'Test', picture: '' },
          }
          const req = {
            session: mockSession,
          } as unknown as Request

          const mockJson = vi.fn()
          const res = {
            status: vi.fn().mockReturnThis(),
            json: mockJson,
          } as unknown as Response
          const next = vi.fn() as NextFunction

          await requireAuth(req, res, next)

          // Verify: 401 status was returned
          expect(res.status).toHaveBeenCalledWith(401)
          
          // Verify: error response contains SESSION_EXPIRED code
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                code: 'SESSION_EXPIRED',
              }),
            })
          )
          
          // Verify: next was NOT called (request blocked)
          expect(next).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Requests without tokens should pass through without refresh attempt
   */
  it('should pass through requests without tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // whether session exists
        async (hasSession) => {
          // Reset mocks for each iteration
          mockOAuthService.isTokenExpired.mockReset()
          mockOAuthService.refreshAccessToken.mockReset()
          
          const req = {
            session: hasSession ? {} : undefined,
          } as unknown as Request

          const res = {} as Response
          const next = vi.fn() as NextFunction

          await extractUserToken(req, res, next)

          // Verify: no refresh attempted
          expect(mockOAuthService.refreshAccessToken).not.toHaveBeenCalled()
          
          // Verify: no access token set
          expect(req.accessToken).toBeUndefined()
          
          // Verify: next was called
          expect(next).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
