import { describe, it, expect } from 'vitest'
import { calculateMonthlyInterest } from './interest'

describe('calculateMonthlyInterest', () => {
  it('calculates and rounds to 2 decimals', () => {
    expect(calculateMonthlyInterest(1000, 2.5)).toBe(25)
    expect(calculateMonthlyInterest(1234.56, 1.75)).toBe(21.6)
  })
})
