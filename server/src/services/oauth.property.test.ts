import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import crypto from 'crypto'
import { OAuthService } from './oauth.js'

/**
 * Property Test for PKCE Code Challenge
 * **Property 6: PKCE Code Challenge**
 * **Validates: Requirements 5.2**
 * 
 * *For any* OAuth authorization URL generated, it SHALL include a code_challenge
 * parameter for PKCE security.
 */

describe('OAuthService - PKCE Property Tests', () => {
  let oauthService: OAuthService

  beforeEach(() => {
    // Set required env vars for OAuthService
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback'
    
    oauthService = new OAuthService()
  })

  /**
   * Feature: google-oauth, Property 6: PKCE Code Challenge
   * 
   * For any OAuth authorization URL generated, it SHALL include:
   * - code_challenge parameter
   * - code_challenge_method=S256
   */
  it('Property 6: generated auth URL SHALL include code_challenge parameter', () => {
    // Arbitrary for state parameter (hex string)
    const stateArb = fc.stringMatching(/^[0-9a-f]{16,64}$/)

    fc.assert(
      fc.property(stateArb, (state) => {
        // Generate PKCE parameters
        const { codeChallenge } = oauthService.generatePKCE()
        
        // Generate auth URL with PKCE
        const authUrl = oauthService.generateAuthUrl(state, codeChallenge)
        
        // Parse the URL to verify parameters
        const url = new URL(authUrl)
        
        // Verify: code_challenge is present
        expect(url.searchParams.has('code_challenge')).toBe(true)
        
        // Verify: code_challenge matches what we passed
        expect(url.searchParams.get('code_challenge')).toBe(codeChallenge)
        
        // Verify: code_challenge_method is S256
        expect(url.searchParams.get('code_challenge_method')).toBe('S256')
        
        // Verify: state parameter is included
        expect(url.searchParams.get('state')).toBe(state)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: PKCE code verifier and challenge are correctly related
   * 
   * For any generated PKCE pair, the code_challenge SHALL be the
   * base64url-encoded SHA256 hash of the code_verifier.
   */
  it('PKCE code_challenge SHALL be SHA256 hash of code_verifier', () => {
    fc.assert(
      fc.property(fc.integer(), () => {
        // Generate PKCE parameters
        const { codeVerifier, codeChallenge } = oauthService.generatePKCE()
        
        // Manually compute the expected challenge
        const expectedChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url')
        
        // Verify: code_challenge matches SHA256(code_verifier)
        expect(codeChallenge).toBe(expectedChallenge)
        
        // Verify: code_verifier has sufficient entropy (at least 32 bytes = 43 base64url chars)
        expect(codeVerifier.length).toBeGreaterThanOrEqual(43)
        
        // Verify: code_challenge is valid base64url (no padding, no + or /)
        expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Each PKCE generation produces unique values
   * 
   * For any two consecutive PKCE generations, the code_verifier values
   * SHALL be different (cryptographically random).
   */
  it('PKCE generation SHALL produce unique code_verifier values', () => {
    fc.assert(
      fc.property(fc.integer(), () => {
        // Generate two PKCE pairs
        const pkce1 = oauthService.generatePKCE()
        const pkce2 = oauthService.generatePKCE()
        
        // Verify: code_verifiers are different
        expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier)
        
        // Verify: code_challenges are different (since verifiers are different)
        expect(pkce1.codeChallenge).not.toBe(pkce2.codeChallenge)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Auth URL contains required OAuth parameters
   */
  it('Auth URL SHALL contain all required OAuth parameters', () => {
    // Arbitrary for state parameter (hex string)
    const stateArb = fc.stringMatching(/^[0-9a-f]{16,64}$/)

    fc.assert(
      fc.property(stateArb, (state) => {
        const { codeChallenge } = oauthService.generatePKCE()
        const authUrl = oauthService.generateAuthUrl(state, codeChallenge)
        
        const url = new URL(authUrl)
        
        // Verify: required OAuth parameters are present
        expect(url.searchParams.has('client_id')).toBe(true)
        expect(url.searchParams.has('redirect_uri')).toBe(true)
        expect(url.searchParams.has('response_type')).toBe(true)
        expect(url.searchParams.has('scope')).toBe(true)
        expect(url.searchParams.has('access_type')).toBe(true)
        
        // Verify: PKCE parameters are present
        expect(url.searchParams.has('code_challenge')).toBe(true)
        expect(url.searchParams.has('code_challenge_method')).toBe(true)
        
        // Verify: scope includes drive.readonly
        const scope = url.searchParams.get('scope') || ''
        expect(scope).toContain('drive.readonly')
      }),
      { numRuns: 100 }
    )
  })
})
