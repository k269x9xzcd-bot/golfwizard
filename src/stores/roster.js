import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'

export const useRosterStore = defineStore('roster', () => {
  const players = ref([])
  const loading = ref(false)

  const DEFAULT_PLAYERS = [
    // ── Favorites (seeded for all new users) ──────────────────
    { id: 'default_1',  name: 'Jason Spieler',     short_name: 'Spieler', ghin_index: 9.8,  ghin_number: '1321498', is_favorite: true,  email: 'jayspieler@aol.com',          nickname: 'Spiels', use_nickname: true  },
    { id: 'default_2',  name: 'Alex Carroll',       short_name: 'Carroll', ghin_index: 3.7,  ghin_number: '1312506', is_favorite: true,  email: 'alexcarroll333@gmail.com',     nickname: 'Al',     use_nickname: true  },
    { id: 'default_3',  name: 'Andy Shpiz',         short_name: 'Shpiz',   ghin_index: 4.5,  ghin_number: '6858154', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_4',  name: 'Brian Cimons',       short_name: 'Cimons',  ghin_index: 6.3,  ghin_number: '4143469', is_favorite: true,  email: 'bcimons19@yahoo.com',          nickname: 'Brian',  use_nickname: false },
    { id: 'default_5',  name: 'Chris Raggo',        short_name: 'Chris',   ghin_index: 4.5,  ghin_number: '712114',  is_favorite: true,  email: 'craggo@recordandreturn.com',   nickname: 'Chris',  use_nickname: false },
    { id: 'default_6',  name: 'Harry Spadaro',      short_name: 'Harry',   ghin_index: 10.9, ghin_number: '3080777', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_7',  name: 'Jeremy Court',       short_name: 'Jeremy',  ghin_index: 4.6,  ghin_number: '3370926', is_favorite: true,  email: 'jcourt93@gmail.com',           nickname: 'Jeremy', use_nickname: false },
    { id: 'default_8',  name: 'Joe Tomei',          short_name: 'Tomei',   ghin_index: 10.0, ghin_number: '6858150', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_9',  name: 'Marty Durkin',       short_name: 'Marty',   ghin_index: 8.3,  ghin_number: '348255',  is_favorite: true,  email: 'martydurkin17@verizon.net',    nickname: 'Marty',  use_nickname: false },
    { id: 'default_10', name: 'Matt Derosa',        short_name: 'Matt',    ghin_index: 6.6,  ghin_number: '3011863', is_favorite: true,  email: null,                           nickname: 'Matt',   use_nickname: false },
    { id: 'default_11', name: 'Sam Waters',         short_name: 'Waters',  ghin_index: 7.3,  ghin_number: '1154293', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_12', name: 'Shang Chen',         short_name: 'Shang',   ghin_index: 5.8,  ghin_number: '1243328', is_favorite: true,  email: 'bonga13@gmail.com',            nickname: 'Wang',   use_nickname: true  },
    // ── Non-favorites (owner's extended roster only) ──────────
    { id: 'default_13', name: 'Alex Dubin',         short_name: 'Dubin',   ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_14', name: 'Alex Pugatch',       short_name: 'Pugatch', ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_15', name: 'Benny Salerno',      short_name: 'Benny',   ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_16', name: 'Bryan Pinto',        short_name: 'Pinto',   ghin_index: 15.8, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_17', name: 'Craig Sedaka',       short_name: 'Sedaka',  ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_18', name: 'Dan Ko',             short_name: 'Ko',      ghin_index: 15.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_19', name: 'Jeremy Collet',      short_name: 'Collet',  ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_20', name: 'John Kogel',         short_name: 'Kogel',   ghin_index: 9.1,  is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_21', name: 'Jonathan Grant',     short_name: 'Grant',   ghin_index: 1.3,  is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_22', name: 'Nick Boccabella',    short_name: 'NickB',   ghin_index: 5.7,  is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_23', name: 'Rocco Cipriano',     short_name: 'Rocco',   ghin_index: 5.0,  is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_24', name: 'Scott Millman',      short_name: 'Scott',   ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_25', name: 'Stephen Berkley',    short_name: 'Berkley', ghin_index: 10.0, is_favorite: false, email: null, nickname: null, use_nickname: false },
    { id: 'default_26', name: 'Todd Boccabella',    short_name: 'ToddB',   ghin_index: 6.5,  is_favorite: false, email: null, nickname: null, use_nickname: false },
  ]

  // Bump to invalidate every client's stale gw_roster localStorage on next load.
  const CACHE_VER = 'v5'

  async function fetchPlayers() {
    const auth = useAuthStore()

    // Always evict stale cache first — this clears old data that lacks ghin_number
    // fields and other columns added in later schema versions.
    _evictStaleCache()

    if (!auth.isAuthenticated) {
      // Guest path — load from localStorage, seed defaults if empty
      const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
      if (saved.length === 0) {
        players.value = [...DEFAULT_PLAYERS]
        _saveLocal()
      } else {
        players.value = saved
      }
      return
    }
    // For authenticated users, purge default_* entries from localStorage cache.
    // These are guest-mode fallbacks that carry stale handicap values.
    try {
      const cached = JSON.parse(localStorage.getItem('gw_roster') || '[]')
      const cleaned = cached.filter(p => !String(p.id).startsWith('default_'))
      if (cleaned.length !== cached.length) {
        localStorage.setItem('gw_roster', JSON.stringify(cleaned))
      }
    } catch {}

    loading.value = true
    try {
      let data = null   // null = both paths failed; [] = confirmed empty; [...] = real rows

      // ── Step 1: supaRaw first — bypasses iOS HTTP/2 zombie socket pool ─────
      // supaRaw opens a fresh TCP/TLS connection (keepalive:false, cache:no-store)
      // via AbortController timeout so it always fails fast when the network is bad.
      // The SJS client (below) reuses pooled connections — on iOS PWA any zombie
      // socket causes it to hang indefinitely, so we try supaRaw first.
      try {
        const { supaRawSelect } = await import('../modules/supaRaw')
        const uid = encodeURIComponent(auth.user.id)
        const rows = await supaRawSelect(
          'roster_players',
          `select=*&owner_id=eq.${uid}&order=is_favorite.desc,name.asc`,
          8000,
        )
        // Non-empty result: we have real data — use it immediately.
        // Empty result is ambiguous (genuine empty roster vs. RLS block with anon
        // key).  We only trust empty after SJS also confirms it below.
        if (Array.isArray(rows) && rows.length > 0) {
          data = rows
        }
      } catch {
        // supaRaw failed — fall through to SJS
      }

      // ── Step 2: SJS with 5s timeout (fallback or empty-roster confirmation) ─
      if (!data) {
        try {
          const { supaCall } = await import('../modules/supabaseOps')
          const res = await supaCall(
            'roster.fetch',
            supabase.from('roster_players').select('*')
              .eq('owner_id', auth.user.id)
              .order('is_favorite', { ascending: false })
              .order('name'),
            5000,
          )
          if (!res.error && res.data && res.data.length > 0) {
            data = res.data
          } else if (!res.error && res.data) {
            data = []   // SJS confirmed empty — safe to seed
          }
          // res.error or res.data null → data stays null → use cache below
        } catch {
          // SJS also failed — data stays null
        }
      }

      if (data && data.length > 0) {
        // ── Got real rows from Supabase ────────────────────────────────────
        players.value = data
        try {
          localStorage.setItem('gw_roster', JSON.stringify(data))
          localStorage.setItem('gw_roster_ts', String(Date.now()))
          localStorage.setItem('gw_roster_ver', CACHE_VER)
        } catch {}

      } else if (data !== null) {
        // ── Both paths returned confirmed-empty roster — seed with self ─────
        const seedKey = `gw_roster_seeded_${auth.user.id}`
        try {
          const p = auth.profile
          const email = auth.user.email?.toLowerCase().trim()
          const fullName = p?.display_name
            || (p?.first_name && p?.last_name
              ? [p.first_name, p.last_name].filter(Boolean).join(' ')
              : null)

          if (fullName && !localStorage.getItem(seedKey)) {
            const nameParts = fullName.trim().split(/\s+/)
            const short_name = nameParts.length >= 2
              ? nameParts[nameParts.length - 1].slice(0, 8)
              : fullName.slice(0, 8)
            const selfRow = {
              owner_id: auth.user.id,
              name: fullName,
              short_name,
              email,
              ghin_number: p?.ghin_number ?? null,
              ghin_index: null,
              is_favorite: true,
              nickname: null,
              use_nickname: false,
            }
            // Use supaCall with timeout — never a bare SJS call here (iOS hangs)
            const { supaCall: _supaCall } = await import('../modules/supabaseOps')
            const ins = await _supaCall(
              'roster.seed',
              supabase.from('roster_players').insert([selfRow]),
              5000,
            )
            if (!ins.error) localStorage.setItem(seedKey, '1')
          }

          // Re-fetch after seed via supaRaw (iOS-safe)
          const { supaRawSelect: _supaRawSelect } = await import('../modules/supaRaw')
          const uid = encodeURIComponent(auth.user.id)
          const freshRows = await _supaRawSelect(
            'roster_players',
            `select=*&owner_id=eq.${uid}&order=is_favorite.desc,name.asc`,
            8000,
          )
          if (Array.isArray(freshRows) && freshRows.length > 0) {
            players.value = freshRows
            try {
              localStorage.setItem('gw_roster', JSON.stringify(freshRows))
              localStorage.setItem('gw_roster_ts', String(Date.now()))
              localStorage.setItem('gw_roster_ver', CACHE_VER)
            } catch {}
          } else {
            players.value = []
          }
        } catch {
          players.value = []
        }

      } else {
        // ── Both paths threw — network/auth failure — use localStorage cache ─
        console.warn('[roster] Both fetch paths failed. Falling back to cache/defaults.')
        const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
        if (saved.length > 0) {
          players.value = saved
        } else if (players.value.length === 0) {
          // Last resort: show DEFAULT_PLAYERS so the roster is never empty
          players.value = [...DEFAULT_PLAYERS]
          _saveLocal()
        }
      }
    } catch {
      // Outer guard
      try {
        const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
        if (saved.length > 0) players.value = saved
      } catch {}
    }
    loading.value = false
  }

  // Clear gw_roster localStorage if the cache version is outdated.
  // This forces a fresh Supabase fetch, discarding stale cached values
  // (e.g., entries that predate the ghin_number column or old handicap values).
  function _evictStaleCache() {
    try {
      if (localStorage.getItem('gw_roster_ver') !== CACHE_VER) {
        localStorage.removeItem('gw_roster')
        localStorage.removeItem('gw_roster_ts')
        localStorage.setItem('gw_roster_ver', CACHE_VER)
      }
    } catch {}
  }

  async function addPlayer(player) {
    const auth = useAuthStore()
    // Prevent duplicate names (case-insensitive)
    const nameNorm = player.name.trim().toLowerCase()
    const existing = players.value.find(p => p.name.trim().toLowerCase() === nameNorm)
    if (existing) {
      // Update the existing player's GHIN instead of creating a dupe
      await updatePlayer(existing.id, {
        ghin_index: player.ghin_index ?? existing.ghin_index,
        ghin_number: player.ghin_number ?? existing.ghin_number,
        club_name: player.club_name ?? existing.club_name,
        is_favorite: player.is_favorite ?? existing.is_favorite,
        email: player.email ?? existing.email,
        nickname: player.nickname ?? existing.nickname,
        use_nickname: player.use_nickname ?? existing.use_nickname,
      })
      return existing
    }

    if (!auth.isAuthenticated) {
      const p = { ...player, id: `local_${Date.now()}` }
      players.value.push(p)
      _saveLocal()
      return p
    }
    const row = { ...player, owner_id: auth.user.id }
    let data, error
    // Note: ghin_number (7-digit USGA ID) is distinct from ghin_index (handicap float).
    // PlayersView currently only sets ghin_index, so ghin_number is always undefined here
    // and we always use insert. The upsert branch is reserved for GHIN-synced players.
    if (row.ghin_number) {
      // Upsert on ghin_number only when a real GHIN exists (NULL cannot match a unique constraint)
      ;({ data, error } = await supabase
        .from('roster_players')
        .upsert(row, { onConflict: 'ghin_number', ignoreDuplicates: false })
        .select().single())
    } else {
      // Plain insert for players without a GHIN number
      ;({ data, error } = await supabase
        .from('roster_players')
        .insert(row)
        .select().single())
    }
    if (error) throw error
    players.value.push(data)
    return data
  }

  async function updatePlayer(id, updates) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const idx = players.value.findIndex(p => p.id === id)
      if (idx >= 0) players.value[idx] = { ...players.value[idx], ...updates }
      _saveLocal()
      return
    }

    // default_* and local_* IDs are local-only fallback entries — they don't exist in Supabase
    if (String(id).startsWith('default_') || String(id).startsWith('local_')) {
      const idx = players.value.findIndex(p => p.id === id)
      if (idx >= 0) players.value[idx] = { ...players.value[idx], ...updates }
      _saveLocal()
      return
    }

    // Optimistic local update — UI reflects the change immediately regardless
    // of whether Supabase round-trip succeeds.
    const idx = players.value.findIndex(p => p.id === id)
    const before = idx >= 0 ? { ...players.value[idx] } : null
    if (idx >= 0) players.value[idx] = { ...players.value[idx], ...updates }

    // Try SJS with tight budget, then raw-fetch fallback (iOS PWA HTTP/2 pool recovery).
    try {
      const { supaCall } = await import('../modules/supabaseOps')
      const res = await supaCall(
        'roster.update',
        supabase.from('roster_players').update(updates).eq('id', id).select().single(),
        5000,
      )
      if (!res.error && res.data && idx >= 0) players.value[idx] = res.data
      else if (res.error) throw res.error
    } catch (e) {
      // 409 = unique constraint violation on (owner_id, name).
      // Give the user a specific, actionable message instead of a generic error.
      const isNameConflict = e?.code === '23505' || e?.status === 409 ||
        (e?.message || '').toLowerCase().includes('unique') ||
        (e?.message || '').toLowerCase().includes('duplicate')
      if (isNameConflict) {
        if (before && idx >= 0) players.value[idx] = before
        throw new Error(`A player named "${updates.name}" already exists in your roster. Use a different name or add a last initial (e.g. "Jason S").`)
      }

      console.warn('[roster] SJS update failed, trying raw fetch:', e?.message)
      try {
        const { supaRawRequest } = await import('../modules/supaRaw')
        const rows = await supaRawRequest('PATCH', `roster_players?id=eq.${id}&select=*`, updates, 10000)
        const row = Array.isArray(rows) ? rows[0] : rows
        if (row && idx >= 0) players.value[idx] = row
      } catch (rawErr) {
        const isRawConflict = rawErr?.status === 409 || rawErr?.message?.includes('409')
        if (before && idx >= 0) players.value[idx] = before
        if (isRawConflict) {
          throw new Error(`A player named "${updates.name}" already exists in your roster. Use a different name or add a last initial.`)
        }
        throw new Error('Could not save changes. Check your connection and try again.')
      }
    }
  }

  async function deletePlayer(id) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      players.value = players.value.filter(p => p.id !== id)
      _saveLocal()
      return
    }
    const { error } = await supabase.from('roster_players').delete().eq('id', id)
    if (error) throw error
    players.value = players.value.filter(p => p.id !== id)
  }

  async function toggleFavorite(id) {
    const player = players.value.find(p => p.id === id)
    if (!player) return
    await updatePlayer(id, { is_favorite: !player.is_favorite })
  }

  // ── Migration: localStorage → Supabase ─────────────────────
  async function migrateFromLocalStorage() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return

    const localPlayers = JSON.parse(localStorage.getItem('golf_players') || '[]')
    if (!localPlayers.length) return

    // Check if already migrated
    const migrated = localStorage.getItem('gw_roster_migrated')
    if (migrated) return

    const rows = localPlayers.map(p => ({
      owner_id: auth.user.id,
      name: p.name,
      short_name: p.short,
      ghin_index: p.ghin ?? null,
      is_favorite: false,
    }))

    const { error } = await supabase.from('roster_players').insert(rows)
    if (!error) {
      localStorage.setItem('gw_roster_migrated', '1')
      await fetchPlayers()
    }
  }

  function _saveLocal() {
    localStorage.setItem('gw_roster', JSON.stringify(players.value))
  }

  const favoritePlayers = computed(() => players.value.filter(p => p.is_favorite))

  return {
    players, favoritePlayers, loading,
    fetchPlayers, addPlayer, updatePlayer, deletePlayer,
    toggleFavorite, migrateFromLocalStorage,
    displayName, displayInitials,
  }
})

export function displayName(player) {
  if (!player) return '?'
  if (player.use_nickname && player.nickname) return player.nickname
  return player.name || player.guest_name || player.short_name || '?'
}

export function displayInitials(player) {
  const name = displayName(player)
  // If nickname is active, use full nickname as the badge label (truncated to 6 chars)
  if (player?.use_nickname && player?.nickname) return player.nickname.slice(0, 6)
  // Otherwise first+last initial from full name
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts[0]?.length >= 2) return (parts[0][0] + parts[0][1]).toUpperCase()
  return (parts[0]?.[0] ?? '?').toUpperCase() + '?'
}
