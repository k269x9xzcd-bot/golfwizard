// Canonical player identity for round_members rows.
// Same person can appear across rounds with different short_name / guest_name
// spellings ("Spiels" vs "Spieler"). Group by stable identity, in this order:
//   1. profile_id (auth user id)
//   2. lowercase trimmed email
//   3. ghin_number (string)
//   4. lowercase trimmed full name (guest_name || name)
// Falls back to row id only when nothing else is available.

export function canonicalPlayerKey(m) {
  if (!m) return null
  if (m.profile_id) return `pid:${m.profile_id}`
  const email = (m.email || '').trim().toLowerCase()
  if (email) return `email:${email}`
  const ghin = m.ghin_number != null ? String(m.ghin_number).trim() : ''
  if (ghin) return `ghin:${ghin}`
  const fullName = (m.guest_name || m.name || '').trim().toLowerCase()
  if (fullName) return `name:${fullName}`
  return m.id ? `id:${m.id}` : null
}

function bestDisplayName(m) {
  return m.short_name || m.guest_name || m.name || '?'
}

function lastInitial(m) {
  const full = (m.guest_name || m.name || '').trim()
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return ''
  return parts[parts.length - 1][0]?.toUpperCase() || ''
}

// Group round_members across rounds by canonical key.
// Returns array of { id, name, label, ghin_number, members[] }.
// `label` adds a last-initial suffix when two distinct canonical keys
// share the same display name (e.g. "Chris R" / "Chris C").
export function groupMembersByCanonicalPlayer(rounds) {
  const map = new Map()
  for (const r of (rounds || [])) {
    for (const m of (r.round_members || [])) {
      const key = canonicalPlayerKey(m)
      if (!key) continue
      let entry = map.get(key)
      if (!entry) {
        entry = {
          id: key,
          name: bestDisplayName(m),
          ghin_number: m.ghin_number ?? null,
          lastInitial: lastInitial(m),
          members: [],
        }
        map.set(key, entry)
      } else {
        if (!entry.lastInitial) entry.lastInitial = lastInitial(m)
        if (!entry.ghin_number && m.ghin_number) entry.ghin_number = m.ghin_number
      }
      entry.members.push(m)
    }
  }

  const players = Array.from(map.values())
  const byName = new Map()
  for (const p of players) {
    const arr = byName.get(p.name) || []
    arr.push(p)
    byName.set(p.name, arr)
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
  return players
}
