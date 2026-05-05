// Canonical player identity for round_members rows.
// Same person can appear across rounds with different short_name / guest_name
// spellings ("Spiels" vs "Spieler"). Group rows by stable identity.
//
// Algorithm — profile-id-locked groups + name attachment for orphans:
//   1. Profile-linked rows (profile_id != null) form their own groups, keyed
//      by `pid:${profile_id}`. Two rows with DIFFERENT profile_ids never
//      merge, even if they share email / ghin / name (handles the Todd Lee
//      vs Jason scenario where two distinct accounts share an old email).
//   2. Ghost rows (profile_id == null) attach to a profile group when their
//      normalized guest_name matches exactly one profile group's name.
//      If two profile groups share that name, the ghost stays orphan.
//   3. Remaining ghosts dedupe among themselves by canonical token
//      preference: email > ghin > normalized full name > member id.
//
// Display label per group: longest guest_name encountered, else short_name.
// Two groups with the same label get a last-initial suffix.

function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Intrinsic key for a row in isolation. profile_id always wins. For ghosts,
// prefer NAME first — two unlinked rows with the same guest_name but slightly
// different ghin/email (a common data-entry artifact) should still collapse
// to one chip. If no name, fall back to email > ghin > member id.
function memberIntrinsicKey(m) {
  if (!m) return null
  if (m.profile_id) return `pid:${m.profile_id}`
  const fullName = normalizeName(m.guest_name || m.name)
  if (fullName) return `name:${fullName}`
  const email = (m.email || '').trim().toLowerCase()
  if (email) return `email:${email}`
  const ghin = m.ghin_number != null ? String(m.ghin_number).trim() : ''
  if (ghin) return `ghin:${ghin}`
  return m.id ? `member:${m.id}` : null
}

function lastInitialFromName(s) {
  const parts = (s || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return ''
  return (parts[parts.length - 1][0] || '').toUpperCase()
}

export function buildCanonicalGroups(rounds) {
  const allMembers = []
  for (const r of (rounds || [])) {
    for (const m of (r.round_members || [])) {
      allMembers.push(m)
    }
  }

  const groups = new Map()           // groupKey → array of members
  const memberToKey = new Map()      // member object → groupKey
  const profileGroupsByName = new Map() // normalizedName → Set<profile groupKey>

  // Pass 1: profile-linked rows
  for (const m of allMembers) {
    if (!m.profile_id) continue
    const key = `pid:${m.profile_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
    memberToKey.set(m, key)

    const name = normalizeName(m.guest_name || m.name)
    if (name) {
      if (!profileGroupsByName.has(name)) profileGroupsByName.set(name, new Set())
      profileGroupsByName.get(name).add(key)
    }
  }

  // Pass 2: ghost rows attach to profile group via name match (only when unambiguous)
  const orphans = []
  for (const m of allMembers) {
    if (m.profile_id) continue
    const name = normalizeName(m.guest_name || m.name)
    const candidates = name ? profileGroupsByName.get(name) : null
    if (candidates && candidates.size === 1) {
      const key = candidates.values().next().value
      groups.get(key).push(m)
      memberToKey.set(m, key)
    } else {
      orphans.push(m)
    }
  }

  // Pass 3: remaining ghosts dedupe by intrinsic key
  for (const m of orphans) {
    const key = memberIntrinsicKey(m)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
    memberToKey.set(m, key)
  }

  // Build players array
  const players = []
  for (const [key, members] of groups.entries()) {
    let longestGuestName = ''
    let bestShortName = ''
    let bestGhin = null
    let lastInit = ''
    for (const m of members) {
      const gn = (m.guest_name || '').trim()
      if (gn.length > longestGuestName.length) longestGuestName = gn
      const sn = (m.short_name || '').trim()
      if (sn && !bestShortName) bestShortName = sn
      if (!bestGhin && m.ghin_number) bestGhin = m.ghin_number
      if (!lastInit) lastInit = lastInitialFromName(m.guest_name || m.name)
    }
    const displayName = longestGuestName
      || bestShortName
      || (members[0]?.name || '?')
    players.push({
      id: key,
      name: displayName,
      ghin_number: bestGhin,
      lastInitial: lastInit,
      members,
    })
  }

  // Disambiguate labels when two groups share the same display name
  const byName = new Map()
  for (const p of players) {
    if (!byName.has(p.name)) byName.set(p.name, [])
    byName.get(p.name).push(p)
  }
  for (const group of byName.values()) {
    if (group.length > 1) {
      for (const p of group) {
        p.label = p.lastInitial ? `${p.name} ${p.lastInitial}` : p.name
      }
    } else {
      group[0].label = group[0].name
    }
  }

  const keyOf = (m) => (m ? memberToKey.get(m) || null : null)

  return { players, keyOf }
}

// Backwards-compat: returns just the players array.
export function groupMembersByCanonicalPlayer(rounds) {
  return buildCanonicalGroups(rounds).players
}

// A row's INTRINSIC key. Useful for tests and for finding profile-linked rows
// directly. Note: a ghost row's intrinsic key is NOT the same as the group
// key it gets after orphan-attachment — use buildCanonicalGroups + keyOf
// for the actual group assignment.
export function canonicalPlayerKey(m) {
  return memberIntrinsicKey(m)
}
