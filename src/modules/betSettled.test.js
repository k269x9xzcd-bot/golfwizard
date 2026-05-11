import { describe, it, expect } from 'vitest'
import { isSettled, nassauBetSettled, skinsHoleSettled } from './betSettled.js'

describe('isSettled', () => {
  it('returns true when all holes are played', () => {
    expect(isSettled(18, 18, 0)).toBe(true)
    expect(isSettled(18, 18, 5)).toBe(true)
    expect(isSettled(9, 9, -2)).toBe(true)
  })

  it('returns true on closeout (lead > remaining holes)', () => {
    expect(isSettled(12, 18, 7)).toBe(true)   // 7 up with 6 to play → done
    expect(isSettled(12, 18, -7)).toBe(true)  // 7 down with 6 to play → done
    expect(isSettled(8, 9, 2)).toBe(true)     // front: 2 up with 1 to play → done
  })

  it('returns false on dormie (lead == remaining)', () => {
    expect(isSettled(12, 18, 6)).toBe(false)  // 6 up with 6 to play → dormie, NOT settled
    expect(isSettled(12, 18, -6)).toBe(false) // mirror
    expect(isSettled(8, 9, 1)).toBe(false)    // 1 up with 1 to play → dormie
  })

  it('returns false when lead < remaining', () => {
    expect(isSettled(10, 18, 3)).toBe(false)  // 3 up with 8 to play → could lose
    expect(isSettled(0, 18, 0)).toBe(false)   // round not started
  })

  it('all-square edge cases — never settled before final hole', () => {
    expect(isSettled(17, 18, 0)).toBe(false)  // tied with 1 to play → could decide
    expect(isSettled(18, 18, 0)).toBe(true)   // tied at end → settled at AS
    expect(isSettled(0, 9, 0)).toBe(false)
  })

  it('handles null/undefined finalUp', () => {
    expect(isSettled(18, 18)).toBe(true)
    expect(isSettled(10, 18, null)).toBe(false)
  })
})

describe('nassauBetSettled', () => {
  function buildSeg(playedThru, segStart = 1, segEnd = 9) {
    const holeResults = []
    for (let h = segStart; h <= segEnd; h++) {
      if (h <= playedThru) holeResults.push({ hole: h, n1: 4, n2: 4, winner: null })
      else holeResults.push({ hole: h, n1: null, n2: null, winner: null })
    }
    return holeResults
  }

  it('main bet: settled at end of segment', () => {
    expect(nassauBetSettled(buildSeg(9), 1, 0)).toBe(true)
    expect(nassauBetSettled(buildSeg(8), 1, 1)).toBe(false)  // 1up with 1 to play → dormie
    expect(nassauBetSettled(buildSeg(8), 1, 2)).toBe(true)   // 2up with 1 to play → closed
  })

  it('press bet starting mid-segment: scoped to its own length', () => {
    // Press starts at H5, segment ends at H9 → 5 holes total. Played thru H8 → 4 played, 1 left.
    expect(nassauBetSettled(buildSeg(8), 5, 1)).toBe(false)  // dormie within press
    expect(nassauBetSettled(buildSeg(8), 5, 2)).toBe(true)   // closed
    expect(nassauBetSettled(buildSeg(9), 5, 0)).toBe(true)   // segment over → AS settled
  })
})

describe('skinsHoleSettled', () => {
  it('hole with a winner is settled', () => {
    expect(skinsHoleSettled({ hole: 3, winner: 'p1', pot: 5 })).toBe(true)
  })
  it('hole without a winner (carry) is not yet settled', () => {
    expect(skinsHoleSettled({ hole: 3, winner: null, reason: 'tie' })).toBe(false)
    expect(skinsHoleSettled({ hole: 3, winner: null, reason: 'incomplete' })).toBe(false)
  })
  it('handles null hr safely', () => {
    expect(skinsHoleSettled(null)).toBe(false)
  })
})
