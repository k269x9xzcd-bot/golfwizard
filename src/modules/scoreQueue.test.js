import { describe, it, expect } from 'vitest'
import {
  MAX_ATTEMPTS,
  isUnrecoverableError,
  markAttempt,
  shouldDropForRetries,
  reconcileQueueAgainstMembers,
} from './scoreQueue.js'

describe('isUnrecoverableError', () => {
  it('returns true for Postgres FK violation code 23503', () => {
    expect(isUnrecoverableError({ code: '23503', message: 'fk constraint' })).toBe(true)
  })
  it('returns true when error.detail wraps the code', () => {
    expect(isUnrecoverableError({ detail: { code: '23503' } })).toBe(true)
  })
  it('returns true for 409 with member_id in message', () => {
    expect(isUnrecoverableError({ status: 409, message: 'invalid member_id' })).toBe(true)
  })
  it('returns true for 400 with member_id', () => {
    expect(isUnrecoverableError({ status: 400, message: 'member_id missing' })).toBe(true)
  })
  it('returns true for foreign-key message mentioning member', () => {
    expect(isUnrecoverableError({ message: 'insert violates foreign key on member relation' })).toBe(true)
  })
  it('returns false for transient network errors', () => {
    expect(isUnrecoverableError({ message: 'timed out after 5000ms' })).toBe(false)
    expect(isUnrecoverableError({ status: 500, message: 'server error' })).toBe(false)
    expect(isUnrecoverableError({ status: 409, message: 'duplicate key' })).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(isUnrecoverableError(null)).toBe(false)
    expect(isUnrecoverableError(undefined)).toBe(false)
  })
})

describe('markAttempt', () => {
  it('initializes _attempts to 1', () => {
    expect(markAttempt({ round_id: 'r', member_id: 'm', hole: 1 })._attempts).toBe(1)
  })
  it('increments existing _attempts', () => {
    expect(markAttempt({ _attempts: 2 })._attempts).toBe(3)
  })
  it('returns a new object (immutable)', () => {
    const e = { hole: 5 }
    const out = markAttempt(e)
    expect(out).not.toBe(e)
    expect(e._attempts).toBeUndefined()
  })
})

describe('shouldDropForRetries', () => {
  it(`drops at MAX_ATTEMPTS=${MAX_ATTEMPTS}`, () => {
    expect(shouldDropForRetries({ _attempts: MAX_ATTEMPTS })).toBe(true)
    expect(shouldDropForRetries({ _attempts: MAX_ATTEMPTS + 1 })).toBe(true)
  })
  it('keeps items below the cap', () => {
    expect(shouldDropForRetries({ _attempts: MAX_ATTEMPTS - 1 })).toBe(false)
    expect(shouldDropForRetries({ _attempts: 0 })).toBe(false)
    expect(shouldDropForRetries({})).toBe(false)
  })
})

describe('reconcileQueueAgainstMembers', () => {
  const r1 = 'round-A'
  const r2 = 'round-B'
  const queue = [
    { round_id: r1, member_id: 'real-1', hole: 1, score: 4 },
    { round_id: r1, member_id: 'orphan-1', hole: 2, score: 5 },  // garbage UUID — not in members
    { round_id: r1, member_id: 'orphan-2', hole: 3, score: 4 },
    { round_id: r2, member_id: 'whatever', hole: 7, score: 3 },  // different round → untouched
    { round_id: r1, member_id: 'real-2', hole: 4, score: 6 },
  ]
  const validMembers = ['real-1', 'real-2']

  it('drops items for the loaded round whose member_id is not in the roster', () => {
    const { kept, dropped } = reconcileQueueAgainstMembers(queue, validMembers, r1)
    expect(dropped.map(e => e.member_id).sort()).toEqual(['orphan-1', 'orphan-2'])
    expect(kept).toHaveLength(3)
    expect(kept.map(e => e.member_id)).toEqual(['real-1', 'whatever', 'real-2'])
  })

  it('leaves entries for other rounds untouched (we don\'t know their membership)', () => {
    const { kept } = reconcileQueueAgainstMembers(queue, validMembers, r1)
    expect(kept.find(e => e.round_id === r2)).toBeDefined()
  })

  it('returns empty arrays for non-array input', () => {
    expect(reconcileQueueAgainstMembers(null, validMembers, r1)).toEqual({ kept: [], dropped: [] })
  })

  it('no-ops when roundId is missing (refuses to drop without scope)', () => {
    const { kept, dropped } = reconcileQueueAgainstMembers(queue, validMembers, null)
    expect(kept).toEqual(queue)
    expect(dropped).toEqual([])
  })

  it('Seaview repro: 8 orphan scores prune cleanly', () => {
    const seaview = '0fca8940-409e-4369-a191-cfa51af73bef'
    const stuck = Array.from({ length: 8 }, (_, i) => ({
      round_id: seaview,
      member_id: `client-uuid-${i}`,
      hole: i + 1,
      score: 4,
    }))
    const realMembers = ['m-JS', 'm-FR', 'm-AL', 'm-JR']
    const { kept, dropped } = reconcileQueueAgainstMembers(stuck, realMembers, seaview)
    expect(kept).toHaveLength(0)
    expect(dropped).toHaveLength(8)
  })
})
