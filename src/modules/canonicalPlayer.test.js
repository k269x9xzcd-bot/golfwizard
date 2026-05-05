import { describe, it, expect } from 'vitest'
import {
  canonicalPlayerKey,
  buildCanonicalGroups,
  groupMembersByCanonicalPlayer,
} from './canonicalPlayer'

describe('canonicalPlayerKey (intrinsic key)', () => {
  it('prefers profile_id over everything', () => {
    expect(canonicalPlayerKey({
      profile_id: 'uid-1', email: 'a@b.com', ghin_number: '123', guest_name: 'Jason',
    })).toBe('pid:uid-1')
  })

  it('prefers normalized guest_name over email and ghin (no profile_id)', () => {
    expect(canonicalPlayerKey({
      email: '  Jason@Example.COM ', ghin_number: '123', guest_name: '  Jason Spieler  ',
    })).toBe('name:jason spieler')
  })

  it('falls back to email when no profile_id and no name', () => {
    expect(canonicalPlayerKey({
      email: '  Jason@Example.COM ', ghin_number: '123',
    })).toBe('email:jason@example.com')
  })

  it('falls back to ghin_number when only ghin is present', () => {
    expect(canonicalPlayerKey({ ghin_number: 6438823 })).toBe('ghin:6438823')
  })

  it('falls back to member id when nothing else is present', () => {
    expect(canonicalPlayerKey({ id: 'm-x' })).toBe('member:m-x')
  })
})

describe('buildCanonicalGroups — profile-id-locked grouping', () => {
  it('keeps two distinct profile_ids separate even when they share an email (Todd Lee / Jason)', () => {
    const rounds = [{ round_members: [
      { id: 'a', profile_id: 'aa8a5a43', email: 'jayspieler@aol.com', guest_name: 'Jason Spieler', short_name: 'Spiels' },
      { id: 'b', profile_id: 'aa8a5a43', email: 'jayspieler@aol.com', guest_name: 'Jason Spieler', short_name: 'Spieler' },
      { id: 'c', profile_id: '09582d3b', email: 'jayspieler@aol.com', guest_name: 'Todd Lee', short_name: 'Todd' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(2)
    const ids = players.map(p => p.id).sort()
    expect(ids).toEqual(['pid:09582d3b', 'pid:aa8a5a43'])
  })

  it('attaches a profile_id=null ghost to the profile group via name match', () => {
    const rounds = [{ round_members: [
      { id: 'g', profile_id: null, guest_name: 'Jason Spieler', short_name: 'Spiels' },
      { id: 'p1', profile_id: 'aa8a5a43', guest_name: 'Jason Spieler', short_name: 'Spieler' },
      { id: 'p2', profile_id: 'aa8a5a43', guest_name: 'Jason Spieler', short_name: 'Spiels' },
      { id: 'p3', profile_id: 'aa8a5a43', guest_name: 'Jason Spieler', short_name: 'Spieler' },
    ]}]
    const { players, keyOf } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(1)
    expect(players[0].id).toBe('pid:aa8a5a43')
    expect(players[0].members).toHaveLength(4)
    // keyOf maps the ghost row to the profile group
    expect(keyOf(rounds[0].round_members[0])).toBe('pid:aa8a5a43')
  })

  it('keeps a ghost orphan when no profile group has a matching name', () => {
    const rounds = [{ round_members: [
      { id: 'g', profile_id: null, guest_name: null, email: 'foo@bar.com' },
      { id: 'p', profile_id: 'pid-x', guest_name: 'Jane Doe' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(2)
    const ghost = players.find(p => p.id === 'email:foo@bar.com')
    expect(ghost).toBeTruthy()
    expect(ghost.members).toHaveLength(1)
  })

  it('merges two ghost rows with same guest_name but different ghin_number under name', () => {
    const rounds = [{ round_members: [
      { id: 'a', profile_id: null, guest_name: 'Brian Cimons', ghin_number: '111' },
      { id: 'b', profile_id: null, guest_name: 'Brian Cimons', ghin_number: '222' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(1)
    expect(players[0].id).toBe('name:brian cimons')
    expect(players[0].members).toHaveLength(2)
  })

  it('does NOT auto-attach a ghost when its name matches multiple profile groups', () => {
    const rounds = [{ round_members: [
      { id: 'p1', profile_id: 'uid-1', guest_name: 'Chris Smith' },
      { id: 'p2', profile_id: 'uid-2', guest_name: 'Chris Smith' },
      { id: 'g',  profile_id: null,    guest_name: 'Chris Smith' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    // Two profile groups + one orphan-by-name
    expect(players).toHaveLength(3)
  })

  it('dedupes same person across rounds with different short_names (no profile_id)', () => {
    const rounds = [
      { round_members: [{ id: 'm1', email: 'jason@x.com', short_name: 'Spiels', guest_name: 'Jason Spieler' }] },
      { round_members: [{ id: 'm2', email: 'jason@x.com', short_name: 'Spieler', guest_name: 'Jason Spieler' }] },
    ]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(1)
    expect(players[0].members).toHaveLength(2)
    // Same guest_name → orphan key is name (name beats email in the preference list).
    expect(players[0].id).toBe('name:jason spieler')
  })

  it('keeps two distinct people with same first name as separate chips', () => {
    const rounds = [{ round_members: [
      { id: 'm1', email: 'chrisr@x.com', short_name: 'Chris', guest_name: 'Chris Raggo' },
      { id: 'm2', email: 'chrisc@x.com', short_name: 'Chris', guest_name: 'Chris Carroll' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(2)
    // Display label is full guest_name (no collision, no last-initial suffix)
    const labels = players.map(p => p.label).sort()
    expect(labels).toEqual(['Chris Carroll', 'Chris Raggo'])
  })

  it('appends last-initial when two groups share the exact same display name', () => {
    // Two distinct profiles, both with guest_name "Chris" — collision
    // forces last-initial. With no last name available, label falls back
    // to bare name (no suffix possible).
    const rounds = [{ round_members: [
      { id: 'a', profile_id: 'u-a', guest_name: 'Chris' },
      { id: 'b', profile_id: 'u-b', guest_name: 'Chris' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(2)
    expect(players.every(p => p.label === 'Chris')).toBe(true)
  })

  it('attaches every row matching a profile_id to one group', () => {
    const rounds = [
      { round_members: [{ id: 'a', profile_id: 'u1', short_name: 'A1' }] },
      { round_members: [{ id: 'b', profile_id: 'u1', short_name: 'A2' }] },
      { round_members: [{ id: 'c', profile_id: 'u1', short_name: 'A3' }] },
    ]
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(1)
    expect(players[0].members.map(m => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('display name prefers longest guest_name over short_name', () => {
    const rounds = [{ round_members: [
      { id: 'a', profile_id: 'u', short_name: 'Spiels', guest_name: 'Jason' },
      { id: 'b', profile_id: 'u', short_name: 'Spieler', guest_name: 'Jason Spieler' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players[0].name).toBe('Jason Spieler')
  })

  it('falls back to short_name when no group member has a guest_name', () => {
    const rounds = [{ round_members: [
      { id: 'a', profile_id: 'u', short_name: 'Spiels' },
    ]}]
    const { players } = buildCanonicalGroups(rounds)
    expect(players[0].name).toBe('Spiels')
  })
})

describe('buildCanonicalGroups — realistic Bonnie Boyz fixture', () => {
  // 19 round_member rows mirroring the prod data drawn from the Bonnie Boyz
  // tournament. Some rows are profile-linked; some are ghosts that should
  // attach to a profile group via name; a couple of distinct people share
  // first names. Expected post-dedupe count: 10 chips for these 10 distinct
  // people (down from 19 rows).
  const fixture = [
    // Jason Spieler — 1 profile, 3 profile-linked rows + 1 ghost (Spiels with no profile_id)
    { id: 'r1', profile_id: 'uid-jason', guest_name: 'Jason Spieler', short_name: 'Spieler', email: 'jay@x.com' },
    { id: 'r2', profile_id: 'uid-jason', guest_name: 'Jason Spieler', short_name: 'Spiels',  email: 'jay@x.com' },
    { id: 'r3', profile_id: 'uid-jason', guest_name: 'Jason Spieler', short_name: 'Spieler', email: 'jay@x.com' },
    { id: 'r4', profile_id: null,        guest_name: 'Jason Spieler', short_name: 'Spiels',  email: null },

    // Chris Carroll — profile-linked, 2 rows
    { id: 'r5', profile_id: 'uid-chrisc', guest_name: 'Chris Carroll', short_name: 'Chris', email: 'cc@x.com' },
    { id: 'r6', profile_id: 'uid-chrisc', guest_name: 'Chris Carroll', short_name: 'Carroll', email: 'cc@x.com' },

    // Chris Raggo — profile-linked, distinct from Chris Carroll
    { id: 'r7', profile_id: 'uid-chrisr', guest_name: 'Chris Raggo', short_name: 'Chris', email: 'cr@x.com' },

    // Brian Cimons — 2 ghost rows, same guest_name → merge via name
    { id: 'r8', profile_id: null, guest_name: 'Brian Cimons', short_name: 'Brian', ghin_number: '500' },
    { id: 'r9', profile_id: null, guest_name: 'Brian Cimons', short_name: 'Brian', ghin_number: '500' },

    // Nick Boccabella — profile-linked + ghost row attached by name
    { id: 'r10', profile_id: 'uid-nick', guest_name: 'Nick Boccabella', short_name: 'Nick', email: 'nb@x.com' },
    { id: 'r11', profile_id: null,       guest_name: 'Nick Boccabella', short_name: 'Nick', email: null },

    // Todd Boccabella — distinct from Nick, profile_id null but unique name
    { id: 'r12', profile_id: null, guest_name: 'Todd Boccabella', short_name: 'Todd', email: 'todd@x.com' },

    // Anthony Caggiano — 2 profile-linked rows
    { id: 'r13', profile_id: 'uid-ant', guest_name: 'Anthony Caggiano', short_name: 'Cags', email: 'ant@x.com' },
    { id: 'r14', profile_id: 'uid-ant', guest_name: 'Anthony Caggiano', short_name: 'Anthony', email: 'ant@x.com' },

    // Brendan Lavelle — 1 ghost row (guest only)
    { id: 'r15', profile_id: null, guest_name: 'Brendan Lavelle', short_name: 'Brendan', email: null },

    // Stephen Virgilio — profile-linked
    { id: 'r16', profile_id: 'uid-virg', guest_name: 'Stephen Virgilio', short_name: 'Steve', email: 'sv@x.com' },
    { id: 'r17', profile_id: 'uid-virg', guest_name: 'Stephen Virgilio', short_name: 'Virg', email: 'sv@x.com' },

    // Two more ghosts — same person (Marty Durkin), should merge by name
    { id: 'r18', profile_id: null, guest_name: 'Marty Durkin', short_name: 'Marty' },
    { id: 'r19', profile_id: null, guest_name: 'Marty Durkin', short_name: 'Durks' },
  ]

  const rounds = [{ round_members: fixture }]

  it('collapses 19 rows to 10 distinct players', () => {
    const { players } = buildCanonicalGroups(rounds)
    expect(players).toHaveLength(10)
  })

  it('Jason Spieler ghost is attached to the profile group', () => {
    const { players, keyOf } = buildCanonicalGroups(rounds)
    const jason = players.find(p => p.id === 'pid:uid-jason')
    expect(jason).toBeTruthy()
    expect(jason.members).toHaveLength(4)
    expect(keyOf(fixture[3])).toBe('pid:uid-jason') // the ghost row r4
  })

  it('Brian Cimons (2 ghosts) merges to 1 chip', () => {
    const { players } = buildCanonicalGroups(rounds)
    const brian = players.find(p => p.name === 'Brian Cimons')
    expect(brian).toBeTruthy()
    expect(brian.members).toHaveLength(2)
  })

  it('Nick + Todd Boccabella stay as 2 distinct chips', () => {
    const { players } = buildCanonicalGroups(rounds)
    const nick = players.find(p => p.name === 'Nick Boccabella')
    const todd = players.find(p => p.name === 'Todd Boccabella')
    expect(nick).toBeTruthy()
    expect(todd).toBeTruthy()
    expect(nick.id).not.toBe(todd.id)
  })

  it('Chris Carroll + Chris Raggo stay as 2 distinct chips', () => {
    const { players } = buildCanonicalGroups(rounds)
    const labels = players.map(p => p.label).filter(l => l.startsWith('Chris')).sort()
    expect(labels).toEqual(['Chris Carroll', 'Chris Raggo'])
  })
})

describe('groupMembersByCanonicalPlayer (legacy wrapper)', () => {
  it('returns just the players array', () => {
    const rounds = [{ round_members: [
      { id: 'a', profile_id: 'u1', guest_name: 'A' },
      { id: 'b', profile_id: 'u2', guest_name: 'B' },
    ]}]
    const players = groupMembersByCanonicalPlayer(rounds)
    expect(Array.isArray(players)).toBe(true)
    expect(players).toHaveLength(2)
  })
})
