import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'

export const useRosterStore = defineStore('roster', () => {
  const players = ref([])
  const loading = ref(false)

  const DEFAULT_PLAYERS = [
    // ── Favorites (seeded for all new users) ──────────────────
    { id: 'default_1',  name: 'Jason Spieler',     short_name: 'Spieler', ghin_index: 9.8,  ghin_number: '1321498', is_favorite: true,  email: null, nickname: 'Spiels', use_nickname: true  },
    { id: 'default_2',  name: 'Alex Carroll',       short_name: 'Carroll', ghin_index: 3.7,  ghin_number: '1312506', is_favorite: true,  email: null, nickname: 'Al',     use_nickname: true  },
    { id: 'default_3',  name: 'Andy Shpiz',         short_name: 'Shpiz',   ghin_index: 4.5,  ghin_number: '6858154', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_4',  name: 'Brian Cimons',       short_name: 'Cimons',  ghin_index: 6.3,  ghin_number: '4143469', is_favorite: true,  email: null, nickname: 'Brian',  use_nickname: false },
    { id: 'default_5',  name: 'Chris Raggo',        short_name: 'Chris',   ghin_index: 4.5,  ghin_number: '712114',  is_favorite: true,  email: null, nickname: 'Chris',  use_nickname: false },
    { id: 'default_6',  name: 'Harry Spadaro',      short_name: 'Harry',   ghin_index: 10.9, ghin_number: '3080777', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_7',  name: 'Jeremy Court',       short_name: 'Jeremy',  ghin_index: 4.6,  ghin_number: '3370926', is_favorite: true,  email: null, nickname: 'Jeremy', use_nickname: false },
    { id: 'default_8',  name: 'Joe Tomei',          short_name: 'Tomei',   ghin_index: 10.0, ghin_number: '6858150', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_9',  name: 'Marty Durkin',       short_name: 'Marty',   ghin_index: 8.3,  ghin_number: '348255',  is_favorite: true,  email: null, nickname: 'Marty',  use_nickname: false },
    { id: 'default_10', name: 'Matt Derosa',        short_name: 'Matt',    ghin_index: 6.6,  ghin_number: '3011863', is_favorite: true,  email: null, nickname: 'Matt',   use_nickname: false },
    { id: 'default_11', name: 'Sam Waters',         short_name: 'Waters',  ghin_index: 7.3,  ghin_number: '1154293', is_favorite: true,  email: null, nickname: null, use_nickname: false },
    { id: 'default_12', name: 'Shang Chen',         short_name: 'Shang',   ghin_index: 5.8,  ghin_number: '1243328', is_favorite: true,  email: null, nickname: 'Wang',   use_nickname: true  },
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

  const CACHE_VER = 'v5'

  async function fetchPlayers() {
    const auth = useAuthStore()
    _evictStaleCache()

    if (!auth.isAuthenticated) {
      const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
      if (saved.length === 0) {
        players.value = [...DEFAULT_PLAYERS]
        _saveLocal()
      } else {
        players.value = saved
      }
      return
    }
    try {
      const cached = JSON.parse(localStorage.getItem('gw_roster') || '[]')
      const cleaned = cached.filter(p => !String(p.id).startsWith('default_'))
      if (cleaned.length !== cached.length) {
        localStorage.setItem('gw_roster', JSON.stringify(cleaned))
      }
    } catch {}

    loading.value = true
    try {
      let data = null

      try {
        const { supaRawSelect } = await import('../modules/supaRaw')
        const uid = encodeURIComponent(auth.user.id)
        const rows = await supaRawSelect(
          'roster_players',
          `select=*&owner_id=eq.${uid}&order=is_favorite.desc,name.asc`,
          8000,
        )
        if (Array.isArray(rows) && rows.length > 0) {
          data = rows
        }
      } catch {
        // supaRaw failed — fall through to SJS
      }

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
            data = []
          }
        } catch {
          // SJS also failed
        }
      }

      if (data && data.length > 0) {
        players.value = data
        try {
          localStorage.setItem('gw_roster', JSON.stringify(data))
          localStorage.setItem('gw_roster_ts', String(Date.now()))
          localStorage.setItem('gw_roster_ver', CACHE_VER)
        } catch {}

      } else if (data !== null) {
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
            const { supaCall: _supaCall } = await import('../modules/supabaseOps')
            const ins = await _supaCall(
              'roster.seed',
              supabase.from('roster_players').insert([selfRow]),
              5000,
            )
            if (!ins.error) localStorage.setItem(seedKey, '1')
          }

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
        console.warn('[roster] Both fetch paths failed. Falling back to cache/defaults.')
        const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
        if (saved.length > 0) {
          players.value = saved
        } else if (players.value.length === 0) {
          players.value = [...DEFAULT_PLAYERS]
          _saveLocal()
        }
      }
    } catch {
      try {
        const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
        if (saved.length > 0) players.value = saved
      } catch {}
    }
    loading.value = false
  }

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
    const nameNorm = player.name.trim().toLowerCase()
    const existing = players.value.find(p =>
      p.name.trim().toLowerCase() === nameNorm &&
      !String(p.id).startsWith('default_') &&
      !String(p.id).startsWith('local_')
    )
    if (existing) {
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
    // Try plain insert first. Partial unique indexes (ghin_number, email) can't be
    // used as ON CONFLICT targets in Supabase — use insert + catch-and-update instead.
    ;({ data, error } = await supabase
      .from('roster_players')
      .insert(row)
      .select().single())
    if (error && error.code === '23505') {
      // Unique violation — find the existing row and update it
      let matchQuery = supabase.from('roster_players').select('id').eq('owner_id', auth.user.id)
      if (row.ghin_number) matchQuery = matchQuery.eq('ghin_number', row.ghin_number)
      else if (row.email)   matchQuery = matchQuery.eq('email', row.email)
      else                  matchQuery = matchQuery.eq('name', row.name)
      const { data: existing } = await matchQuery.maybeSingle()
      if (existing?.id) {
        ;({ data, error } = await supabase
          .from('roster_players')
          .update(row)
          .eq('id', existing.id)
          .select().single())
      }
    }
    if (error) throw error
    // Replace if already in list (23505 path updates an existing row), otherwise push
    const existIdx = players.value.findIndex(p => p.id === data.id)
    if (existIdx >= 0) players.value[existIdx] = data
    else players.value.push(data)
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

    if (String(id).startsWith('default_') || String(id).startsWith('local_')) {
      const idx = players.value.findIndex(p => p.id === id)
      if (idx >= 0) players.value[idx] = { ...players.value[idx], ...updates }
      _saveLocal()
      return
    }

    const idx = players.value.findIndex(p => p.id === id)
    const before = idx >= 0 ? { ...players.value[idx] } : null
    if (idx >= 0) players.value[idx] = { ...players.value[idx], ...updates }

    // Trivial single-column updates (e.g. is_favorite toggle) bypass SJS entirely
    // and use raw fetch with longer timeout — SJS's 5s ceiling is aggressive on
    // iOS PWA where stuck-socket re-establishment can take >5s.
    const isTrivialUpdate = Object.keys(updates).length === 1 &&
      ['is_favorite', 'is_archived'].includes(Object.keys(updates)[0])

    try {
      if (isTrivialUpdate) {
        const { supaRawRequest } = await import('../modules/supaRaw')
        const rows = await supaRawRequest('PATCH', `roster_players?id=eq.${id}&select=*`, updates, 12000)
        const row = Array.isArray(rows) ? rows[0] : rows
        if (row && idx >= 0) players.value[idx] = row
        return
      }
      const { supaCall } = await import('../modules/supabaseOps')
      const res = await supaCall(
        'roster.update',
        supabase.from('roster_players').update(updates).eq('id', id).select().single(),
        8000,
      )
      if (!res.error && res.data && idx >= 0) players.value[idx] = res.data
      else if (res.error) throw res.error
    } catch (e) {
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
        const rows = await supaRawRequest('PATCH', `roster_players?id=eq.${id}&select=*`, updates, 12000)
        const row = Array.isArray(rows) ? rows[0] : rows
        if (row && idx >= 0) players.value[idx] = row
      } catch (rawErr) {
        const isRawConflict = rawErr?.status === 409 || rawErr?.message?.includes('409')
        if (isRawConflict) {
          if (before && idx >= 0) players.value[idx] = before
          throw new Error(`A player named "${updates.name}" already exists in your roster. Use a different name or add a last initial.`)
        }
        // For non-conflict failures: keep optimistic update locally so the user
        // doesn't see a flicker. The change might still have committed server-side
        // (timeout != failure on iOS PWA). Log only.
        console.warn('[roster] update did not confirm — keeping optimistic state:', rawErr?.message)
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

  async function migrateFromLocalStorage() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return

    const localPlayers = JSON.parse(localStorage.getItem('golf_players') || '[]')
    if (!localPlayers.length) return

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
