import { describe, it, expect } from 'vitest'
import { canonicalGameKey, findDuplicateGame } from './gameConfigDedup'

describe('canonicalGameKey', () => {
  it('produces identical keys when player order differs', () => {
    const a = { type: 'match1v1', config: { player1: 'sp', player2: 'ch', ppt: 5 } }
    const b = { type: 'match1v1', config: { player2: 'ch', ppt: 5, player1: 'sp' } }
    expect(canonicalGameKey(a)).toBe(canonicalGameKey(b))
  })

  it('treats player1/player2 swap as different (positional fields)', () => {
    const a = { type: 'match1v1', config: { player1: 'sp', player2: 'ch', ppt: 5 } }
    const b = { type: 'match1v1', config: { player1: 'ch', player2: 'sp', ppt: 5 } }
    expect(canonicalGameKey(a)).not.toBe(canonicalGameKey(b))
  })

  it('sorts team arrays so order-insensitive teams collide', () => {
    const a = { type: 'nassau', config: { team1: ['a', 'b'], team2: ['c', 'd'], front: 10, back: 10, overall: 20 } }
    const b = { type: 'nassau', config: { team1: ['b', 'a'], team2: ['d', 'c'], front: 10, back: 10, overall: 20 } }
    expect(canonicalGameKey(a)).toBe(canonicalGameKey(b))
  })

  it('different stake = different key', () => {
    const a = { type: 'skins', config: { players: ['a', 'b'], ppt: 5 } }
    const b = { type: 'skins', config: { players: ['a', 'b'], ppt: 10 } }
    expect(canonicalGameKey(a)).not.toBe(canonicalGameKey(b))
  })

  it('different game type = different key', () => {
    const a = { type: 'skins', config: { ppt: 5 } }
    const b = { type: 'snake', config: { ppt: 5 } }
    expect(canonicalGameKey(a)).not.toBe(canonicalGameKey(b))
  })

  it('case-insensitive on type', () => {
    const a = { type: 'NASSAU', config: { front: 10 } }
    const b = { type: 'nassau', config: { front: 10 } }
    expect(canonicalGameKey(a)).toBe(canonicalGameKey(b))
  })

  it('returns empty string for null', () => {
    expect(canonicalGameKey(null)).toBe('')
  })
})

describe('findDuplicateGame', () => {
  it('finds identical match1v1 config in existing list', () => {
    const existing = [
      { id: 'g1', type: 'match1v1', config: { player1: 'sp', player2: 'ch', ppt: 5 } },
    ]
    const candidate = { type: 'match1v1', config: { player1: 'sp', player2: 'ch', ppt: 5 } }
    expect(findDuplicateGame(candidate, existing)?.id).toBe('g1')
  })

  it('returns null when no match', () => {
    const existing = [
      { id: 'g1', type: 'match1v1', config: { player1: 'sp', player2: 'ch', ppt: 5 } },
    ]
    const candidate = { type: 'match1v1', config: { player1: 'sp', player2: 'jo', ppt: 5 } }
    expect(findDuplicateGame(candidate, existing)).toBeNull()
  })

  it('finds duplicate nassau even when team players are reordered', () => {
    const existing = [
      { id: 'g1', type: 'nassau', config: { team1: ['a', 'b'], team2: ['c', 'd'], front: 10, back: 10, overall: 20 } },
    ]
    const candidate = { type: 'nassau', config: { team1: ['b', 'a'], team2: ['d', 'c'], front: 10, back: 10, overall: 20 } }
    expect(findDuplicateGame(candidate, existing)?.id).toBe('g1')
  })

  it('handles empty existing list', () => {
    expect(findDuplicateGame({ type: 'skins', config: {} }, [])).toBeNull()
  })

  it('handles undefined inputs gracefully', () => {
    expect(findDuplicateGame(null, [])).toBeNull()
    expect(findDuplicateGame({ type: 'skins' }, null)).toBeNull()
  })
})
