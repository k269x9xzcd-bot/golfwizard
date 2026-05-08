import { describe, it, expect } from 'vitest'
import { pickRelevantMatch } from './linkedMatch.js'

const matchA = { id: 'mA', status: 'linked', round_a_id: 'roundA', round_b_id: 'roundOther', created_at: '2026-05-01' }
const matchB = { id: 'mB', status: 'pending', round_a_id: 'roundB', round_b_id: null, created_at: '2026-05-08' }
const matchComplete = { id: 'mC', status: 'complete', round_a_id: 'roundA', round_b_id: 'roundOther' }
const matchCancelled = { id: 'mX', status: 'cancelled', round_a_id: 'roundA', round_b_id: 'roundOther' }

describe('pickRelevantMatch', () => {
  it('returns null when not authenticated', () => {
    expect(pickRelevantMatch([matchA], 'roundA', false)).toBeNull()
  })

  it('returns null when linkedMatches is empty', () => {
    expect(pickRelevantMatch([], 'roundA', true)).toBeNull()
  })

  it('returns the match for the active round when one exists', () => {
    expect(pickRelevantMatch([matchA, matchB], 'roundA', true)).toBe(matchA)
    expect(pickRelevantMatch([matchA, matchB], 'roundB', true)).toBe(matchB)
  })

  // The actual bug: switching from a round that has a linked match to one
  // that does not would fall through to the most recent match and show
  // its banner on the new round.
  it('returns null when active round has no match — does NOT fall back to most recent', () => {
    expect(pickRelevantMatch([matchA, matchB], 'roundUnrelated', true)).toBeNull()
  })

  it('falls back to first pending/linked match when no active round (HomeView)', () => {
    expect(pickRelevantMatch([matchB, matchA], null, true)).toBe(matchB)
    expect(pickRelevantMatch([matchB, matchA], undefined, true)).toBe(matchB)
  })

  it('ignores matches with status complete or cancelled', () => {
    expect(pickRelevantMatch([matchComplete, matchCancelled], 'roundA', true)).toBeNull()
    expect(pickRelevantMatch([matchComplete, matchCancelled], null, true)).toBeNull()
  })

  it('matches on round_b_id as well as round_a_id', () => {
    expect(pickRelevantMatch([matchA], 'roundOther', true)).toBe(matchA)
  })

  it('handles non-array linkedMatches defensively', () => {
    expect(pickRelevantMatch(null, 'roundA', true)).toBeNull()
    expect(pickRelevantMatch(undefined, 'roundA', true)).toBeNull()
  })
})
