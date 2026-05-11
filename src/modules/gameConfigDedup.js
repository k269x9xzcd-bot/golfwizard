// Canonicalize a game_configs row for duplicate detection.
// Sorts player/team arrays so different orderings hash identically.
// Returns a stable string key derived from { type, config } that ignores
// id/round_id/created_by/sort_order/timestamps.

const PLAYER_ARRAY_FIELDS = ['players', 'team1', 'team2', 'wolfTeeOrder']

function normalize(value) {
  if (Array.isArray(value)) {
    const copy = value.map(normalize)
    return copy.every(v => typeof v === 'string' || typeof v === 'number')
      ? [...copy].sort()
      : copy
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) {
      out[k] = normalize(value[k])
    }
    return out
  }
  return value
}

export function canonicalGameKey(game) {
  if (!game) return ''
  const type = String(game.type ?? '').toLowerCase()
  const cfg = game.config ?? {}
  const norm = {}
  for (const k of Object.keys(cfg).sort()) {
    let v = cfg[k]
    if (PLAYER_ARRAY_FIELDS.includes(k) && Array.isArray(v)) {
      v = [...v].sort()
    } else {
      v = normalize(v)
    }
    norm[k] = v
  }
  return `${type}::${JSON.stringify(norm)}`
}

export function findDuplicateGame(candidate, existingGames) {
  if (!candidate || !Array.isArray(existingGames)) return null
  const key = canonicalGameKey(candidate)
  return existingGames.find(g => canonicalGameKey(g) === key) ?? null
}
