import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { useToast } from '../hooks/useToast'
import { renderHook, act } from '@testing-library/react'
import type { ToastType } from './Toast'

/**
 * Property-Based Tests for UI Feedback State Machine
 * 
 * Feature: gdrive-downloader, Property 9: UI Feedback State Machine
 * 
 * For any user action (submit link, start download, cancel), the UI SHALL 
 * transition to an appropriate feedback state (loading, success, error) 
 * and never remain in an undefined state.
 * 
 * Validates: Requirements 5.5
 */

// Valid toast types
const validToastTypes: ToastType[] = ['success', 'error', 'warning', 'info']

// Arbitrary for toast type
const toastTypeArb = fc.constantFrom(...validToastTypes)

// Arbitrary for toast title (non-empty string)
const toastTitleArb = fc.string({ minLength: 1, maxLength: 100 })

// Arbitrary for optional toast message
const toastMessageArb = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined })

// Arbitrary for optional suggestion
const toastSuggestionArb = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined })

describe('UI Feedback State Machine Property Tests', () => {
  /**
   * Property 9: UI Feedback State Machine
   * 
   * For any user action, the UI SHALL transition to an appropriate feedback state
   * and never remain in an undefined state.
   */
  describe('Property 9: UI Feedback State Machine', () => {
    it('toast notifications always have a valid type', () => {
      fc.assert(
        fc.property(toastTypeArb, toastTitleArb, (type, title) => {
          const { result } = renderHook(() => useToast())
          
          act(() => {
            result.current.addToast(type, title)
          })
          
          // Toast should be added with valid type
          expect(result.current.toasts.length).toBe(1)
          expect(validToastTypes).toContain(result.current.toasts[0].type)
          expect(result.current.toasts[0].title).toBe(title)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('toast notifications can be dismissed and state returns to empty', () => {
      fc.assert(
        fc.property(toastTypeArb, toastTitleArb, (type, title) => {
          const { result } = renderHook(() => useToast())
          
          let toastId: string
          act(() => {
            toastId = result.current.addToast(type, title)
          })
          
          // Toast should exist
          expect(result.current.toasts.length).toBe(1)
          
          // Dismiss the toast
          act(() => {
            result.current.dismissToast(toastId)
          })
          
          // Toast should be removed
          expect(result.current.toasts.length).toBe(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('multiple toasts can be added and all have valid states', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(toastTypeArb, toastTitleArb), { minLength: 1, maxLength: 5 }),
          (toastData) => {
            const { result } = renderHook(() => useToast())
            
            // Add multiple toasts
            act(() => {
              toastData.forEach(([type, title]) => {
                result.current.addToast(type, title)
              })
            })
            
            // All toasts should have valid types
            expect(result.current.toasts.length).toBe(toastData.length)
            result.current.toasts.forEach((toast) => {
              expect(validToastTypes).toContain(toast.type)
              expect(toast.id).toBeDefined()
              expect(toast.title).toBeDefined()
            })
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clearAllToasts removes all toasts and returns to idle state', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(toastTypeArb, toastTitleArb), { minLength: 1, maxLength: 5 }),
          (toastData) => {
            const { result } = renderHook(() => useToast())
            
            // Add multiple toasts
            act(() => {
              toastData.forEach(([type, title]) => {
                result.current.addToast(type, title)
              })
            })
            
            // Verify toasts were added
            expect(result.current.toasts.length).toBe(toastData.length)
            
            // Clear all toasts
            act(() => {
              result.current.clearAllToasts()
            })
            
            // All toasts should be removed (idle state)
            expect(result.current.toasts.length).toBe(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('success action always produces success toast type', () => {
      fc.assert(
        fc.property(toastTitleArb, toastMessageArb, (title, message) => {
          const { result } = renderHook(() => useToast())
          
          act(() => {
            result.current.showSuccess(title, message)
          })
          
          expect(result.current.toasts.length).toBe(1)
          expect(result.current.toasts[0].type).toBe('success')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('error action always produces error toast type', () => {
      fc.assert(
        fc.property(toastTitleArb, toastMessageArb, toastSuggestionArb, (title, message, suggestion) => {
          const { result } = renderHook(() => useToast())
          
          act(() => {
            result.current.showError(title, message, suggestion)
          })
          
          expect(result.current.toasts.length).toBe(1)
          expect(result.current.toasts[0].type).toBe('error')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('warning action always produces warning toast type', () => {
      fc.assert(
        fc.property(toastTitleArb, toastMessageArb, (title, message) => {
          const { result } = renderHook(() => useToast())
          
          act(() => {
            result.current.showWarning(title, message)
          })
          
          expect(result.current.toasts.length).toBe(1)
          expect(result.current.toasts[0].type).toBe('warning')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('info action always produces info toast type', () => {
      fc.assert(
        fc.property(toastTitleArb, toastMessageArb, (title, message) => {
          const { result } = renderHook(() => useToast())
          
          act(() => {
            result.current.showInfo(title, message)
          })
          
          expect(result.current.toasts.length).toBe(1)
          expect(result.current.toasts[0].type).toBe('info')
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('each toast has a unique ID', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(toastTypeArb, toastTitleArb), { minLength: 2, maxLength: 10 }),
          (toastData) => {
            const { result } = renderHook(() => useToast())
            
            // Add multiple toasts
            act(() => {
              toastData.forEach(([type, title]) => {
                result.current.addToast(type, title)
              })
            })
            
            // All IDs should be unique
            const ids = result.current.toasts.map(t => t.id)
            const uniqueIds = new Set(ids)
            expect(uniqueIds.size).toBe(ids.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('download complete action produces success toast', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (fileName) => {
            const { result } = renderHook(() => useToast())
            
            act(() => {
              result.current.showDownloadComplete(fileName)
            })
            
            expect(result.current.toasts.length).toBe(1)
            expect(result.current.toasts[0].type).toBe('success')
            expect(result.current.toasts[0].title).toBe('Download Complete')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('download failed action produces error toast', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          toastMessageArb,
          (fileName, errorMessage) => {
            const { result } = renderHook(() => useToast())
            
            act(() => {
              result.current.showDownloadFailed(fileName, errorMessage)
            })
            
            expect(result.current.toasts.length).toBe(1)
            expect(result.current.toasts[0].type).toBe('error')
            expect(result.current.toasts[0].title).toBe('Download Failed')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('state transitions are deterministic - same input produces same output type', () => {
      fc.assert(
        fc.property(
          toastTypeArb,
          toastTitleArb,
          fc.integer({ min: 1, max: 5 }),
          (type, title, repeatCount) => {
            // Run the same action multiple times and verify consistent behavior
            for (let i = 0; i < repeatCount; i++) {
              const { result } = renderHook(() => useToast())
              
              act(() => {
                result.current.addToast(type, title)
              })
              
              // Same input should always produce same output type
              expect(result.current.toasts[0].type).toBe(type)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
