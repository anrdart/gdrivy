import { describe, it } from 'vitest'
import * as fc from 'fast-check'

describe('fast-check setup', () => {
  it('should run property-based tests', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a // commutative property
      }),
      { numRuns: 100 }
    )
  })

  it('should generate strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return typeof s === 'string'
      }),
      { numRuns: 100 }
    )
  })
})
