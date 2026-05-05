import { describe, it, expect } from 'vitest'
import { isCrossMatchComplete, crossMatchDisplayStatus } from './crossMatchStatus.js'

describe('isCrossMatchComplete', () => {
  it('false for null / undefined', () => {
    expect(isCrossMatchComplete(null)).toBe(false)
    expect(isCrossMatchComplete(undefined)).toBe(false)
  })

  it('true when status is complete (legacy persisted path)', () => {
    expect(isCrossMatchComplete({ status: 'complete' })).toBe(true)
  })

  it('true when both linked rounds are complete even if status lags', () => {
    // Captures the v3.10.252 bug: settlement-persist subscriber missed,
    // status stuck on "linked" but both rounds finished.
    expect(isCrossMatchComplete({ status: 'linked', _bothRoundsComplete: true })).toBe(true)
  })

  it('false when only one linked round is complete', () => {
    expect(isCrossMatchComplete({ status: 'linked', _bothRoundsComplete: false })).toBe(false)
  })

  it('false when status is pending', () => {
    expect(isCrossMatchComplete({ status: 'pending' })).toBe(false)
  })
})

describe('crossMatchDisplayStatus', () => {
  it('renders complete when both rounds finished', () => {
    expect(crossMatchDisplayStatus({ status: 'linked', _bothRoundsComplete: true })).toBe('complete')
  })

  it('renders linked when in-progress', () => {
    expect(crossMatchDisplayStatus({ status: 'linked' })).toBe('linked')
  })

  it('preserves cancelled status', () => {
    expect(crossMatchDisplayStatus({ status: 'cancelled' })).toBe('cancelled')
  })

  it('renders complete when status is already complete', () => {
    expect(crossMatchDisplayStatus({ status: 'complete' })).toBe('complete')
  })
})
