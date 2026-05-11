import { describe, it, expect } from 'vitest'
import { resolveMemberSourceName } from './memberNameResolver.js'

// Mirror nameToInitials from useScorecardHelpers (kept in sync).
function nameToInitials(name) {
  if (!name || name === '?') return '??'
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts[0]?.length >= 2) return (parts[0][0] + parts[0][1]).toUpperCase()
  return (parts[0]?.[0] ?? '?').toUpperCase() + '?'
}

describe('resolveMemberSourceName', () => {
  it('falls back to guest_name when nothing matches', () => {
    const m = { guest_name: 'Frank Ricketti', short_name: 'Ricketti' }
    expect(resolveMemberSourceName(m)).toBe('Frank Ricketti')
  })

  it('uses roster first+last when round_member has profile_id matching roster.user_id', () => {
    const m = { profile_id: 'uid-1', short_name: 'Spieler', guest_name: null }
    const roster = [{ user_id: 'uid-1', first_name: 'Jason', last_name: 'Spieler', name: 'Jason Spieler' }]
    expect(resolveMemberSourceName(m, { rosterPlayers: roster })).toBe('Jason Spieler')
  })

  it('uses roster name when first/last absent but full name has a space', () => {
    const m = { profile_id: 'uid-1', short_name: 'Chen' }
    const roster = [{ user_id: 'uid-1', first_name: null, last_name: null, name: 'Shang Chen' }]
    expect(resolveMemberSourceName(m, { rosterPlayers: roster })).toBe('Shang Chen')
  })

  it('skips roster name if it has no space (just last name)', () => {
    const m = { profile_id: 'uid-1', short_name: 'Chen', guest_name: null }
    const roster = [{ user_id: 'uid-1', first_name: null, last_name: null, name: 'Chen' }]
    // Should fall through to short_name fallback — roster.name was just last name.
    expect(resolveMemberSourceName(m, { rosterPlayers: roster })).toBe('Chen')
  })

  it('matches roster by email case-insensitively', () => {
    const m = { profile_id: null, email: 'BRIAN@example.com', short_name: 'Cimons' }
    const roster = [{ user_id: null, email: 'brian@example.com', first_name: 'Brian', last_name: 'Cimons' }]
    expect(resolveMemberSourceName(m, { rosterPlayers: roster })).toBe('Brian Cimons')
  })

  it('prefers auth profile for current user', () => {
    const m = { profile_id: 'me', short_name: 'Spieler' }
    const authUser = { id: 'me' }
    const authProfile = { first_name: 'Jason', last_name: 'Spieler', display_name: 'Jason' }
    expect(resolveMemberSourceName(m, { authUser, authProfile })).toBe('Jason Spieler')
  })

  it('uses display_name from auth profile when first+last missing', () => {
    const m = { profile_id: 'me', short_name: 'X' }
    const authUser = { id: 'me' }
    const authProfile = { first_name: null, last_name: null, display_name: 'Jay Spi' }
    expect(resolveMemberSourceName(m, { authUser, authProfile })).toBe('Jay Spi')
  })

  it('returns empty string for null member', () => {
    expect(resolveMemberSourceName(null)).toBe('')
  })

  // ── Pines fixture ──────────────────────────────────────────
  it('Pines round 0772e592 → JS, FR, SC, BC', () => {
    const members = [
      { id: 'mSP', profile_id: 'uid-spieler',  short_name: 'Spieler', guest_name: null,             email: null },
      { id: 'mFR', profile_id: null,           short_name: 'Ricketti',guest_name: 'frank ricketti', email: null },
      { id: 'mCH', profile_id: 'uid-chen',     short_name: 'Chen',    guest_name: null,             email: null },
      { id: 'mCI', profile_id: 'uid-cimons',   short_name: 'Cimons',  guest_name: null,             email: null },
    ]
    const roster = [
      { user_id: 'uid-spieler', first_name: 'Jason', last_name: 'Spieler', name: 'Jason Spieler' },
      { user_id: 'uid-chen',    first_name: 'Shang', last_name: 'Chen',    name: 'Shang Chen' },
      { user_id: 'uid-cimons',  first_name: 'Brian', last_name: 'Cimons',  name: 'Brian Cimons' },
    ]
    const sources = members.map(m => resolveMemberSourceName(m, { rosterPlayers: roster }))
    const initials = sources.map(nameToInitials)
    expect(initials).toEqual(['JS', 'FR', 'SC', 'BC'])
  })
})
