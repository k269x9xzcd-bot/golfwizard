import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, generateRoomCode } from '../supabase'
import { useAuthStore } from './auth'

export const useRoundsStore = defineStore('rounds', () => {
  const authStore = useAuthStore()

  // Active round being played right now
  const activeRound = ref(null)
  const activeMembers = ref([])   // round_members rows
  const activeScores = ref({})    // { memberId: { hole: score } }
  const activeGames = ref([])     // game_configs rows

  // Round history
  const rounds = ref([])
  const loading = ref(false)

  // Real-time subscription handle
  let scoreSubscription = null
  let memberSubscription = null

  // ── Computed ────────────────────────────────────────────────
  const activeRoundId = computed(() => activeRound.value?.id)

  // ── Fetch history ───────────────────────────────────────────
  async function fetchRounds() {
    loading.value = true
    const { data, error } = await supabase
      .from('rounds')
      .select(`
        *,
        round_members (*),
        game_configs (*),
        scores (*)
      `)
      .order('date', { ascending: false })
    if (!error) rounds.value = data ?? []
    loading.value = false
  }

  // ── Create a new round ──────────────────────────────────────
  async function createRound({ name, courseName, tee, date, holesMode, format, withRoomCode = false, players = [], games = [] }) {
    const auth = useAuthStore()
    let roomCode = null
    if (withRoomCode) roomCode = await generateRoomCode()

    const { data: round, error } = await supabase
      .from('rounds')
      .insert({
        name,
        course_name: courseName,
        tee,
        date: date || new Date().toISOString().slice(0, 10),
        holes_mode: holesMode || '18',
        format: format || 'social',
        room_code: roomCode,
        owner_id: auth.user?.id ?? null,
      })
      .select()
      .single()

    if (error) throw error

    // Add members
    if (players.length) {
      const memberRows = players.map((p, i) => ({
        round_id: round.id,
        profile_id: p.profileId ?? null,
        guest_name: p.profileId ? null : p.name,
        short_name: p.shortName ?? p.name?.slice(0, 6),
        ghin_index: p.ghinIndex ?? null,
        round_hcp: p.roundHcp ?? null,
        team: p.team ?? null,
        group_index: p.groupIndex ?? 0,
        role: i === 0 && auth.user?.id ? 'admin' : 'player',
      }))
      const { error: mErr } = await supabase.from('round_members').insert(memberRows)
      if (mErr) throw mErr
    }

    // Add games
    if (games.length) {
      const gameRows = games.map((g, i) => ({
        round_id: round.id,
        type: g.type,
        config: g.config,
        sort_order: i,
        created_by: auth.user?.id ?? null,
      }))
      const { error: gErr } = await supabase.from('game_configs').insert(gameRows)
      if (gErr) throw gErr
    }

    await loadRound(round.id)
    return round
  }

  // ── Load a round as "active" ────────────────────────────────
  async function loadRound(roundId) {
    const { data, error } = await supabase
      .from('rounds')
      .select(`*, round_members(*), game_configs(*), scores(*)`)
      .eq('id', roundId)
      .single()

    if (error) throw error

    activeRound.value = data
    activeMembers.value = data.round_members ?? []
    activeGames.value = data.game_configs ?? []

    // Build scores map: { memberId: { hole: score } }
    const sm = {}
    for (const s of (data.scores ?? [])) {
      if (!sm[s.member_id]) sm[s.member_id] = {}
      sm[s.member_id][s.hole] = s.score
    }
    activeScores.value = sm

    // Subscribe to real-time updates
    subscribeToRound(roundId)
  }

  // ── Upsert a score ──────────────────────────────────────────
  async function setScore(memberId, hole, score) {
    const auth = useAuthStore()
    // Optimistic update
    if (!activeScores.value[memberId]) activeScores.value[memberId] = {}
    activeScores.value[memberId][hole] = score

    const { error } = await supabase
      .from('scores')
      .upsert({
        round_id: activeRound.value.id,
        member_id: memberId,
        hole,
        score,
        entered_by: auth.user?.id ?? null,
        entered_at: new Date().toISOString(),
      }, { onConflict: 'round_id,member_id,hole' })

    if (error) {
      // Rollback optimistic update on error
      console.error('Score save failed:', error)
      throw error
    }
  }

  // ── Save game configs ───────────────────────────────────────
  async function saveGameConfig(game) {
    const auth = useAuthStore()
    const { data, error } = await supabase
      .from('game_configs')
      .upsert({
        ...game,
        round_id: activeRound.value.id,
        created_by: auth.user?.id ?? null,
      })
      .select()
      .single()
    if (error) throw error
    const idx = activeGames.value.findIndex(g => g.id === data.id)
    if (idx >= 0) activeGames.value[idx] = data
    else activeGames.value.push(data)
    return data
  }

  async function deleteGameConfig(gameId) {
    const { error } = await supabase.from('game_configs').delete().eq('id', gameId)
    if (error) throw error
    activeGames.value = activeGames.value.filter(g => g.id !== gameId)
  }

  // ── Join a round via room code ──────────────────────────────
  async function joinByRoomCode(code) {
    const auth = useAuthStore()
    const { data: round, error } = await supabase
      .from('rounds')
      .select('id, name, course_name, date')
      .eq('room_code', code.toUpperCase())
      .single()
    if (error) throw new Error('Room code not found')

    // Add self as member if authenticated
    if (auth.user) {
      const { data: existing } = await supabase
        .from('round_members')
        .select('id')
        .eq('round_id', round.id)
        .eq('profile_id', auth.user.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from('round_members').insert({
          round_id: round.id,
          profile_id: auth.user.id,
          short_name: auth.profile?.short_name ?? auth.profile?.display_name?.slice(0, 6),
          ghin_index: auth.profile?.ghin_index,
          role: 'scorer',
        })
      }
    }

    await loadRound(round.id)
    return round
  }

  // ── Real-time subscriptions ─────────────────────────────────
  function subscribeToRound(roundId) {
    // Clean up previous subscriptions
    if (scoreSubscription) supabase.removeChannel(scoreSubscription)
    if (memberSubscription) supabase.removeChannel(memberSubscription)

    // Subscribe to score changes
    scoreSubscription = supabase
      .channel(`scores:${roundId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scores',
        filter: `round_id=eq.${roundId}`,
      }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const s = payload.new
          if (!activeScores.value[s.member_id]) activeScores.value[s.member_id] = {}
          activeScores.value[s.member_id][s.hole] = s.score
        }
      })
      .subscribe()

    // Subscribe to member changes (someone joins)
    memberSubscription = supabase
      .channel(`members:${roundId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'round_members',
        filter: `round_id=eq.${roundId}`,
      }, payload => {
        if (!activeMembers.value.find(m => m.id === payload.new.id)) {
          activeMembers.value.push(payload.new)
        }
      })
      .subscribe()
  }

  function unsubscribe() {
    if (scoreSubscription) supabase.removeChannel(scoreSubscription)
    if (memberSubscription) supabase.removeChannel(memberSubscription)
    scoreSubscription = null
    memberSubscription = null
  }

  // ── Complete / archive a round ──────────────────────────────
  async function completeRound(roundId) {
    const { error } = await supabase
      .from('rounds')
      .update({ is_complete: true })
      .eq('id', roundId)
    if (error) throw error
    if (activeRound.value?.id === roundId) {
      activeRound.value.is_complete = true
    }
    unsubscribe()
  }

  // ── Guest mode: save to localStorage ───────────────────────
  function saveGuestRound(roundData) {
    const saved = JSON.parse(localStorage.getItem('gw_guest_rounds') || '[]')
    const idx = saved.findIndex(r => r.id === roundData.id)
    if (idx >= 0) saved[idx] = roundData
    else saved.unshift(roundData)
    localStorage.setItem('gw_guest_rounds', JSON.stringify(saved.slice(0, 50)))
  }

  function loadGuestRounds() {
    return JSON.parse(localStorage.getItem('gw_guest_rounds') || '[]')
  }

  return {
    activeRound, activeMembers, activeScores, activeGames,
    rounds, loading, activeRoundId,
    fetchRounds, createRound, loadRound, setScore,
    saveGameConfig, deleteGameConfig,
    joinByRoomCode, completeRound,
    subscribeToRound, unsubscribe,
    saveGuestRound, loadGuestRounds,
  }
})
