import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { createAuthService, type GoogleUser } from './authService'

// Declare global fetch for TypeScript
declare const globalThis: {
  fetch: typeof fetch
}

/**
 * Property Test for No Tokens in localStorage
 * **Property 5: No Tokens in localStorage**
 * **Validates: Requirements 5.1**
 * 
 * *For any* state of the application, tokens (access_token, refresh_token)
 * SHALL NOT be stored in browser localStorage.
 */

// Token-related keys that should NEVER be in localStorage
const FORBIDDEN_KEYS = [
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'token',
  'auth_token',
  'authToken',
  'google_token',
  'googleToken',
  'oauth_token',
  'oauthToken',
  'id_token',
  'idToken',
]

// Custom arbitrary for Google user
const googleUserArb: fc.Arbitrary<GoogleUser> = fc.record({
  id: fc.string({ minLength: 10, maxLength: 30 }),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  picture: fc.webUrl(),
})

// Custom arbitrary for token-like strings
const tokenArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-'.split('')),
  { minLength: 20, maxLength: 200 }
)

describe('AuthService - No localStorage Tokens Property Tests', () => {
  let originalLocalStorage: Storage
  let mockLocalStorage: { [key: string]: string }

  beforeEach(() => {
    // Save original localStorage
    originalLocalStorage = window.localStorage

    // Create mock localStorage
    mockLocalStorage = {}
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key]
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {}
      }),
      key: vi.fn((index: number) => Object.keys(mockLocalStorage)[index] || null),
      get length() {
        return Object.keys(mockLocalStorage).length
      },
    }

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })

    // Mock fetch
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    })
    vi.restoreAllMocks()
  })

  /**
   * Helper function to check if localStorage contains any forbidden token keys
   */
  function checkNoTokensInLocalStorage(): boolean {
    const keys = Object.keys(mockLocalStorage)
    for (const key of keys) {
      const lowerKey = key.toLowerCase()
      for (const forbidden of FORBIDDEN_KEYS) {
        if (lowerKey.includes(forbidden.toLowerCase())) {
          return false
        }
      }
      // Also check if the value looks like a token (long alphanumeric string)
      const value = mockLocalStorage[key]
      if (value && value.length > 50 && /^[A-Za-z0-9._-]+$/.test(value)) {
        // This might be a token stored under a different key
        // We'll allow it only if it's clearly not auth-related
        if (lowerKey.includes('auth') || lowerKey.includes('session') || lowerKey.includes('user')) {
          return false
        }
      }
    }
    return true
  }

  /**
   * Feature: google-oauth, Property 5: No Tokens in localStorage
   * 
   * For any successful authentication, tokens SHALL NOT be stored in localStorage.
   */
  it('Property 5: checkAuth SHALL NOT store tokens in localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(googleUserArb, async (user) => {
        // Clear localStorage before test
        mockLocalStorage = {}

        // Mock successful auth check response
        vi.mocked(globalThis.fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ user, isAuthenticated: true }),
        } as Response)

        const authService = createAuthService('http://test-api')
        await authService.checkAuth()

        // Verify: no tokens in localStorage
        expect(checkNoTokensInLocalStorage()).toBe(true)

        // Verify: localStorage.setItem was not called with token-like keys
        const setItemCalls = vi.mocked(window.localStorage.setItem).mock.calls
        for (const [key] of setItemCalls) {
          const lowerKey = key.toLowerCase()
          for (const forbidden of FORBIDDEN_KEYS) {
            expect(lowerKey).not.toContain(forbidden.toLowerCase())
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: logout SHALL NOT leave tokens in localStorage
   */
  it('logout SHALL NOT leave tokens in localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Clear localStorage before test
        mockLocalStorage = {}

        // Mock successful logout response
        vi.mocked(globalThis.fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response)

        const authService = createAuthService('http://test-api')
        await authService.logout()

        // Verify: no tokens in localStorage
        expect(checkNoTokensInLocalStorage()).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: refreshToken SHALL NOT store tokens in localStorage
   */
  it('refreshToken SHALL NOT store tokens in localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, async (newToken) => {
        // Clear localStorage before test
        mockLocalStorage = {}

        // Mock successful refresh response
        vi.mocked(globalThis.fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ 
            success: true,
            accessToken: newToken,
          }),
        } as Response)

        const authService = createAuthService('http://test-api')
        await authService.refreshToken()

        // Verify: no tokens in localStorage
        expect(checkNoTokensInLocalStorage()).toBe(true)

        // Verify: the new token was NOT stored in localStorage
        const allValues = Object.values(mockLocalStorage)
        expect(allValues).not.toContain(newToken)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Even after multiple auth operations, no tokens in localStorage
   */
  it('multiple auth operations SHALL NOT accumulate tokens in localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(
        googleUserArb,
        fc.array(fc.constantFrom('checkAuth', 'logout', 'refreshToken'), { minLength: 1, maxLength: 10 }),
        async (user, operations) => {
          // Clear localStorage before test
          mockLocalStorage = {}

          const authService = createAuthService('http://test-api')

          for (const operation of operations) {
            // Reset fetch mock for each operation
            vi.mocked(globalThis.fetch).mockReset()

            switch (operation) {
              case 'checkAuth':
                vi.mocked(globalThis.fetch).mockResolvedValueOnce({
                  ok: true,
                  status: 200,
                  json: async () => ({ user, isAuthenticated: true }),
                } as Response)
                await authService.checkAuth()
                break
              case 'logout':
                vi.mocked(globalThis.fetch).mockResolvedValueOnce({
                  ok: true,
                  status: 200,
                  json: async () => ({ success: true }),
                } as Response)
                await authService.logout()
                break
              case 'refreshToken':
                vi.mocked(globalThis.fetch).mockResolvedValueOnce({
                  ok: true,
                  status: 200,
                  json: async () => ({ success: true }),
                } as Response)
                await authService.refreshToken()
                break
            }

            // After each operation, verify no tokens in localStorage
            expect(checkNoTokensInLocalStorage()).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Auth errors SHALL NOT cause token leakage to localStorage
   */
  it('auth errors SHALL NOT cause token leakage to localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }), // error message
        async (errorMessage) => {
          // Clear localStorage before test
          mockLocalStorage = {}

          // Mock failed auth response
          vi.mocked(globalThis.fetch).mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ 
              error: { 
                code: 'AUTH_FAILED', 
                message: errorMessage,
              },
            }),
          } as Response)

          const authService = createAuthService('http://test-api')
          
          try {
            await authService.checkAuth()
          } catch {
            // Expected to fail
          }

          // Verify: no tokens in localStorage even after error
          expect(checkNoTokensInLocalStorage()).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
