import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'

export const useRosterStore = defineStore('roster', () => {
  const players = ref([])
  const loading = ref(false)

  const DEFAULT_PLAYERS = [
    { id: 'default_1', name: 'Jason Spieler',   short_name: 'Spieler', ghin_index: 9.1,  is_favorite: true },
    { id: 'default_2', name: 'Alex Dubin',       short_name: 'Dubin',   ghin_index: 6.6,  is_favorite: true },
    { id: 'default_3', name: 'Craig Sedaka',     short_name: 'Sedaka',  ghin_index: 9.8,  is_favorite: true },
    { id: 'default_4', name: 'Stephen Berkley',  short_name: 'Berkley', ghin_index: 15.8, is_favorite: true },
    { id: 'default_5', name: 'Alex Pugatch',     short_name: 'Pugatch', ghin_index: 7.5,  is_favorite: true },
    { id: 'default_6', name: 'Scott Millman',    short_name: 'Millman', ghin_index: 8.5,  is_favorite: true },
    { id: 'default_7', name: 'Jeremy Collet',    short_name: 'Collet',  ghin_index: 10.3, is_favorite: true },
    { id: 'default_8', name: 'Benny Salerno',    short_name: 'Salerno', ghin_index: 14.6, is_favorite: true },
  ]

  async function fetchPlayers() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      // Load from localStorage for guests; seed defaults if empty
      const saved = JSON.parse(localStorage.getItem('gw_roster') || '[]')
      if (saved.length === 0) {
        players.value = DEFAULT_PLAYERS
      } else {
        players.value = saved
      }
      return
    }
    loading.value = true
    const { data, error } = await supabase
      .from('roster_players')
      .select('*')
      .eq('owner_id', auth.user.id)
      .order('is_favorite', { ascending: false })
      .order('name')
    if (!error) players.value = data ?? []
    loading.value = false
  }

  async function addPlayer(player) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const p = { ...player, id: `local_${Date.now()}`, is_favorite: false }
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
