import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'

export const useRosterStore = defineStore('roster', () => {
  const players = ref([])
  const loading = ref(false)

  const DEFAULT_PLAYERS = [
    // ── Bandon Boys group ──────────────────────────────────────
    { id: 'default_1',  name: 'Jason Spieler',     short_name: 'Spieler', ghin_index: 9.1,  is_favorite: true },
    { id: 'default_2',  name: 'Alex Dubin',         short_name: 'Dubin',   ghin_index: 6.6,  is_favorite: true },
    { id: 'default_3',  name: 'Craig Sedaka',       short_name: 'Sedaka',  ghin_index: 9.8,  is_favorite: true },
    { id: 'default_4',  name: 'Stephen Berkley',    short_name: 'Berkley', ghin_index: 15.8, is_favorite: true },
    { id: 'default_5',  name: 'Alex Pugatch',       short_name: 'Pugatch', ghin_index: 7.5,  is_favorite: true },
    { id: 'default_6',  name: 'Scott Millman',      short_name: 'Millman', ghin_index: 8.5,  is_favorite: true },
    { id: 'default_7',  name: 'Jeremy Collet',      short_name: 'Collet',  ghin_index: 10.3, is_favorite: true },
    { id: 'default_8',  name: 'Benny Salerno',      short_name: 'Salerno', ghin_index: 14.6, is_favorite: true },
    // ── Other regular players from backup ─────────────────────
    { id: 'default_9',  name: 'Matt Derosa',        short_name: 'Derosa',  ghin_index: 6.0,  is_favorite: false },
    { id: 'default_10', name: 'Rocco Cipriano',     short_name: 'Rocco',   ghin_index: 5.0,  is_favorite: false },
    { id: 'default_11', name: 'Andy Shpiz',         short_name: 'Shpiz',   ghin_index: 6.0,  is_favorite: false },
    { id: 'default_12', name: 'Marty Durkin',       short_name: 'Durkin',  ghin_index: 8.0,  is_favorite: false },
    { id: 'default_13', name: 'Harry Spadaro',      short_name: 'Harry',   ghin_index: 15.0, is_favorite: false },
    { id: 'default_14', name: 'Joe Tomei',          short_name: 'Tomei',   ghin_index: 14.0, is_favorite: false },
    { id: 'default_15', name: 'Alex Carroll',       short_name: 'Carroll', ghin_index: 2.7,  is_favorite: false },
    { id: 'default_16', name: 'Sam Waters',         short_name: 'Waters',  ghin_index: 5.0,  is_favorite: false },
    { id: 'default_17', name: 'Chris Raggo',        short_name: 'Raggo',   ghin_index: 4.4,  is_favorite: false },
    { id: 'default_18', name: 'Dan Ko',             short_name: 'Ko',      ghin_index: 15.0, is_favorite: false },
    { id: 'default_19', name: 'Nick Boccabella',    short_name: 'NickB',   ghin_index: 5.7,  is_favorite: false },
    { id: 'default_20', name: 'John Kogel',         short_name: 'Kogel',   ghin_index: 9.1,  is_favorite: false },
    { id: 'default_21', name: 'Shang Chen',         short_name: 'Shang',   ghin_index: 5.8,  is_favorite: false },
    { id: 'default_22', name: 'Jeremy Court',       short_name: 'Court',   ghin_index: 4.8,  is_favorite: false },
    { id: 'default_23', name: 'Todd Boccabella',    short_name: 'ToddB',   ghin_index: 6.5,  is_favorite: false },
    { id: 'default_24', name: 'Brian Cimons',       short_name: 'Cimons',  ghin_index: 6.0,  is_favorite: false },
    { id: 'default_25', name: 'Jonathan Grant',     short_name: 'Grant',   ghin_index: 1.3,  is_favorite: false },
    { id: 'default_26', name: 'Bryan Pinto',        short_name: 'Pinto',   ghin_index: 15.8, is_favorite: false },
  ]

  async function fetchPlayers() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      // Load from localStorage for guests; seed defaults if empty
      const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
      if (saved.length === 0) {
        players.value = [...DEFAULT_PLAYERS]
        _saveLocal()
      } else {
        players.value = saved
      }
      return
    }
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('roster_players')
        .select('*')
        .eq('owner_id', auth.user.id)
        .order('is_favorite', { ascending: false })
        .order('name')
      if (!error) {
        if (data && data.length > 0) {
          players.value = data
        } else {
          // Supabase roster is empty — seed with defaults ONCE
          // Guard against re-seeding: check localStorage flag keyed by user id
          const seedKey = `gw_roster_seeded_${auth.user.id}`
          if (localStorage.getItem(seedKey)) {
            // Already seeded before — user deleted all players intentionally, don't re-seed
            players.value = []
          } else {
            try {
              const rows = DEFAULT_PLAYERS.map(p => ({
                owner_id: auth.user.id,
                name: p.name,
                short_name: p.short_name,
                ghin_index: p.ghin_index,
                is_favorite: p.is_favorite,
              }))
              const { error: insertErr } = await supabase.from('roster_players').insert(rows)
              localStorage.setItem(seedKey, '1')
              if (!insertErr) {
                const { data: freshData } = await supabase
                  .from('roster_players')
                  .select('*')
                  .eq('owner_id', auth.user.id)
                  .order('is_favorite', { ascending: false })
                  .order('name')
                players.value = freshData ?? [...DEFAULT_PLAYERS]
              } else {
                players.value = [...DEFAULT_PLAYERS]
              }
            } catch {
              players.value = [...DEFAULT_PLAYERS]
            }
          }
        }
      } else {
        players.value = [...DEFAULT_PLAYERS]
      }
    } catch {
      players.value = [...DEFAULT_PLAYERS]
    }
    loading.value = false
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
        is_favorite: player.is_favorite ?? existing.is_favorite,
      })
      return existing
    }

    if (!auth.isAuthenticated) {
      const p = { ...player, id: `local_${Date.now()}` }
      players.value.push(p)
      _saveLocal()
      return p
    }
    const { data, error } = await supabase
      .from('roster_players')
      .insert({ ...player, owner_id: auth.user.id })
      .select().single()
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
    const { data, error } = await supabase
      .from('roster_players').update(updates).eq('id', id).select().single()
    if (error) throw error
    const idx = players.value.findIndex(p => p.id === id)
    if (idx >= 0) players.value[idx] = data
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

  return {
    players, loading,
    fetchPlayers, addPlayer, updatePlayer, deletePlayer,
    toggleFavorite, migrateFromLocalStorage,
  }
})
