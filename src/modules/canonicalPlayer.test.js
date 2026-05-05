import { describe, it, expect } from 'vitest'
import { canonicalPlayerKey, groupMembersByCanonicalPlayer } from './canonicalPlayer'

describe('canonicalPlayerKey precedence', () => {
  it('prefers profile_id over everything', () => {
    expect(canonicalPlayerKey({
      profile_id: 'uid-1',
      email: 'a@b.com',
      ghin_number: '123',
      guest_name: 'Jason',
    })).toBe('pid:uid-1')
  })

  it('falls back to email (lowercased + trimmed) when no profile_id', () => {
    expect(canonicalPlayerKey({
      email: '  Jason@Example.COM ',
      ghin_number: '123',
      guest_name: 'Jason',
    })).toBe('email:jason@example.com')
  })

  it('falls back to ghin_number when no profile_id or email', () => {
    expect(canonicalPlayerKey({
      ghin_number: 6438823,
      guest_name: 'Nick',
    })).toBe('ghin:6438823')
  })

  it('falls back to lowercased trimmed full name', () => {
    expect(canonicalPlayerKey({
      guest_name: '  Jason Spieler  ',
    })).toBe('name:jason spieler')
  })

  it('returns same key for two rows of the same Jason with different short_names', () => {
    const a = { profile_id: null, email: 'jason@x.com', ghin_number: null, guest_name: 'Jason Spieler', short_name: 'Spiels' }
    const b = { profile_id: null, email: 'jason@x.com', ghin_number: null, guest_name: 'Jason Spieler', short_name: 'Spieler' }
    expect(canonicalPlayerKey(a)).toBe(canonicalPlayerKey(b))
  })
})

describe('groupMembersByCanonicalPlayer', () => {
  it('dedupes same person across rounds with different short_names', () => {
    const rounds = [
      { round_members: [{ id: 'm1', email: 'jason@x.com', short_name: 'Spiels', guest_name: 'Jason Spieler' }] },
      { round_members: [{ id: 'm2', email: 'jason@x.com', short_name: 'Spieler', guest_name: 'Jason Spieler' }] },
    ]
    const out = groupMembersByCanonicalPlayer(rounds)
    expect(out).toHaveLength(1)
    expect(out[0].members).toHaveLength(2)
    expect(out[0].id).toBe('email:jason@x.com')
  })

  it('keeps two distinct people with same first name as separate chips', () => {
    const rounds = [
      { round_members: [
        { id: 'm1', email: 'chrisr@x.com', short_name: 'Chris', guest_name: 'Chris Raggo' },
        { id: 'm2', email: 'chrisc@x.com', short_name: 'Chris', guest_name: 'Chris Carroll' },
      ]},
    ]
    const out = groupMembersByCanonicalPlayer(rounds)
    expect(out).toHaveLength(2)
    const labels = out.map(p => p.label).sort()
    expect(labels).toEqual(['Chris C', 'Chris R'])
  })

  it('does not append last-initial when display name is unique', () => {
    const rounds = [
      { round_members: [
        { id: 'm1', email: 'jason@x.com', short_name: 'Spieler', guest_name: 'Jason Spieler' },
        { id: 'm2', email: 'shang@x.com', short_name: 'Shang', guest_name: 'Shang Chen' },
      ]},
    ]
    const out = groupMembersByCanonicalPlayer(rounds)
    expect(out.find(p => p.name === 'Spieler').label).toBe('Spieler')
    expect(out.find(p => p.name === 'Shang').label).toBe('Shang')
  })

  it('attaches every matching round_member to the canonical entry', () => {
    const rounds = [
      { round_members: [{ id: 'a', profile_id: 'u1', short_name: 'A1' }] },
      { round_members: [{ id: 'b', profile_id: 'u1', short_name: 'A2' }] },
      { round_members: [{ id: 'c', profile_id: 'u1', short_name: 'A3' }] },
    ]
    const [entry] = groupMembersByCanonicalPlayer(rounds)
    expect(entry.members.map(m => m.id)).toEqual(['a', 'b', 'c'])
  })
})
