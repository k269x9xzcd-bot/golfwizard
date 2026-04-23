import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, generateRoomCode } from '../supabase'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useRosterStore } from './roster'
import { computeAllSettlements } from '../modules/settlements'
import { getCourse, COURSES as BUILTIN_COURSES } from '../modules/courses'
import { supaRawInsert, supaRawSelect, supaRawUpdate, supaRawRequest } from '../modules/supaRaw'

/**
 * Build a deterministic, self-contained snapshot of a course at the moment
 * a round is created. Once written to rounds.course_snapshot it is never
 * updated — future edits to the course never retroactively change history.
 *
 * Shape: { name, par: number[18], si: number[18], teesData: {...}, defaultTee: string, capturedAt: ISO }
 * Returns null if the course can't be resolved (e.g. API course with no SI).
 */
function _buildCourseSnapshot(courseName) {
  if (!courseName) return null
  // Prefer a user-edited custom copy if one exists (merged via courses store);
  // fall back to the hard-coded built-in library.
  let course = null
  try {
    const cs = useCoursesStore()
    // allCourses puts custom courses first, builtins second — first match is always the user's version
    course = cs.allCourses?.find?.(c => c.name === courseName) ?? null
  } catch {}
  // Only fall back to builtin if store wasn't ready yet
  if (!course) course = BUILTIN_COURSES[courseName] ?? null
  if (!course) return null

  // Extract par/si: built-in courses use top-level par/si arrays.
  // Custom courses from Supabase have tees/teesData and per-tee SI.
  const par = Array.isArray(course.par)
    ? course.par.slice(0, 18)
    : Array(18).fill(4)
  const si = Array.isArray(course.si)
    ? course.si.slice(0, 18)
    : Array.from({ length: 18 }, (_, i) => i + 1)
  const teesData = course.teesData ?? course.tees ?? {}
  const defaultTee = course.defaultTee ?? Object.keys(teesData)[0] ?? null

  return {
    name: courseName,
    par,
    si,
    teesData,
    defaultTee,
    capturedAt: new Date().toISOString(),
  }
}

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

  // Sync error visible to UI — set when scores fail to save for non-offline reasons
  const scoreSyncError = ref(null)  // null | 'rls' | 'db'

  // ── Offline write queue ─────────────────────────────────────
  // Scores that failed to save get queued and retried when back online
  const _QUEUE_KEY = 'gw_score_queue'
  let _flushTimer = null

  function _loadQueue() {
    try { return JSON.parse(localStorage.getItem(_QUEUE_KEY) || '[]') } catch { return [] }
  }
  function _saveQueue(q) {
    localStorage.setItem(_QUEUE_KEY, JSON.stringify(q))
  }
  function _enqueue(entry) {
    const q = _loadQueue()
    // Deduplicate: one entry per (round_id, member_id, hole) — keep latest
    const idx = q.findIndex(e => e.round_id === entry.round_id && e.member_id === entry.member_id && e.hole === entry.hole)
    if (idx >= 0) q[idx] = entry
    else q.push(entry)
    _saveQueue(q)
  }

  let _flushInFlight = false  // guard against concurrent flush calls
  async function _flushQueue() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return
    if (_flushInFlight) return  // already running — skip concurrent call
    const q = _loadQueue()
    if (!q.length) return
    _flushInFlight = true
    const failed = []
    for (const entry of q) {
      try {
        const { error } = await Promise.race([
          supabase.from('scores').upsert(entry, { onConflict: 'round_id,member_id,hole' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('flush entry timeout')), 4000))
        ])
        if (error) failed.push(entry)
      } catch { failed.push(entry) }
    }
    _saveQueue(failed)
    _flushInFlight = false
  }

  // Flush whenever we come back online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => _flushQueue())
  }

  // ── Computed ────────────────────────────────────────────────
  const activeRoundId = computed(() => activeRound.value?.id)

  // ── Helpers ─────────────────────────────────────────────────
  function _isGuest() {
    const auth = useAuthStore()
    return !auth.isAuthenticated
  }

  function _guestKey(roundId) {
    return `gw_guest_round_${roundId}`
  }

  function _persistGuest() {
    if (!activeRound.value) return
    const payload = {
      round: activeRound.value,
      members: activeMembers.value,
      games: activeGames.value,
      scores: activeScores.value,
    }
    localStorage.setItem(_guestKey(activeRound.value.id), JSON.stringify(payload))
    // Also keep an index of all guest rounds
    const index = JSON.parse(localStorage.getItem('gw_guest_rounds_index') || '[]')
    if (!index.includes(activeRound.value.id)) {
      index.unshift(activeRound.value.id)
      localStorage.setItem('gw_guest_rounds_index', JSON.stringify(index.slice(0, 50)))
    }
  }

  // ── Fetch history ───────────────────────────────────────────
  async function fetchRounds() {
    if (_isGuest()) {
      const index = JSON.parse(localStorage.getItem('gw_guest_rounds_index') || '[]')
      rounds.value = index.map(id => {
        const raw = localStorage.getItem(_guestKey(id))
        return raw ? JSON.parse(raw).round : null
      }).filter(Boolean)
      return
    }
    loading.value = true
    try {
      // Try Supabase JS client first (5s budget), then fall back to raw fetch.
      // iOS PWA HTTP/2 stuck socket causes SJS to queue behind a zombie request —
      // raw fetch() with cache:'no-store' forces a fresh connection.
      let data = null
      let sjsOk = false
      try {
        const query = supabase
          .from('rounds')
          .select(`*, round_members (*), game_configs (*), scores (*)`)
          .order('date', { ascending: false })
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('fetchRounds timed out after 5s')), 5000)
        )
        const res = await Promise.race([query, timeout])
        if (!res.error) { data = res.data; sjsOk = true }
        else console.warn('[rounds] SJS fetchRounds error:', res.error.message)
      } catch (e) {
        console.warn('[rounds] SJS fetchRounds timed out, trying raw fetch fallback:', e?.message)
      }

      if (!sjsOk) {
        // Raw fetch fallback — forces a fresh HTTP connection, bypassing stuck pool
        try {
          const rows = await supaRawSelect(
            'rounds',
            'select=*,round_members(*),game_configs(*),scores(*)&order=date.desc',
            12000
          )
          data = Array.isArray(rows) ? rows : []
          console.log('[rounds] raw fetchRounds succeeded, count:', data.length)
        } catch (rawErr) {
          console.warn('[rounds] raw fetchRounds also failed:', rawErr?.message)
          // Keep existing rounds.value — don't wipe what we had
        }
      }

      if (data !== null) rounds.value = data
    } finally {
      // ALWAYS clear loading — even on timeout or error — so UI doesn't hang.
      loading.value = false
    }
  }

  // ── Auto-save co-players to roster after round creation ────
  async function _autoSaveCoPlayers(players, auth) {
    if (!auth?.isAuthenticated || !auth?.user?.id) return
    const rosterStore = useRosterStore()

    // Ensure roster is loaded before checking for duplicates
    if (rosterStore.players.length === 0) {
      await rosterStore.fetchPlayers()
    }

    const existingEmails = new Set(rosterStore.players.map(p => p.email).filter(Boolean))
    const existingNames = new Set(rosterStore.players.map(p => p.name?.toLowerCase()).filter(Boolean))

    for (const p of players) {
      // Skip the current user themselves
      if (p.email && p.email === auth.user?.email) continue
      if (!p.email && p.name === auth.profile?.display_name) continue
      // Skip if already in roster (by email or exact name)
      if (p.email && existingEmails.has(p.email)) continue
      if (!p.email && p.name && existingNames.has(p.name.toLowerCase())) continue

      const name = (p.name || p.guest_name || '').trim()
      if (!name) continue

      // Add to roster — catch 409 conflicts silently (race condition between check and insert)
      try {
        await rosterStore.addPlayer({
          name,
          short_name: p.shortName || name.split(' ')[0].slice(0, 8),
          nickname: p.nickname || null,
          use_nickname: p.use_nickname || false,
          ghin_index: p.ghinIndex ?? null,
          email: p.email || null,
          is_favorite: false,
        })
        // Keep sets in sync so subsequent loop iterations don't re-attempt
        existingNames.add(name.toLowerCase())
        if (p.email) existingEmails.add(p.email)
      } catch (e) {
        // 409 = already exists — not an error worth surfacing
        const is409 = e?.code === '23505' || e?.status === 409 ||
          (e?.message || '').toLowerCase().includes('unique') ||
          (e?.message || '').toLowerCase().includes('duplicate') ||
          (e?.message || '').toLowerCase().includes('already exists')
        if (!is409) console.warn('[rounds] autoSave player failed:', name, e)
      }
    }
  }

  // ── Create a new round ──────────────────────────────────────
  async function createRound({ name, courseName, tee, date, holesMode, format, withRoomCode = false, opponentPlayers = [], players = [], games = [] }) {
    const auth = useAuthStore()
    console.log('[rounds] createRound called, isAuthenticated:', auth.isAuthenticated, 'course:', courseName, 'players:', players.length)

    // Freeze course data NOW so later edits don't retro-change this round
    const courseSnapshot = _buildCourseSnapshot(courseName)

    // ── GUEST PATH ──────────────────────────────────────────
    if (!auth.isAuthenticated) {
      const roundId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const round = {
        id: roundId,
        name: name || courseName || 'Round',
        course_name: courseName,
        course_snapshot: courseSnapshot,
        tee,
        date: date || new Date().toISOString().slice(0, 10),
        holes_mode: holesMode || '18',
        format: format || 'social',
        room_code: null,
        owner_id: null,
        is_complete: false,
        created_at: new Date().toISOString(),
      }

      const members = players.map((p, i) => ({
        id: `gm_${i}_${Date.now()}`,
        round_id: roundId,
        profile_id: null,
        guest_name: p.name,
        short_name: p.shortName ?? p.name?.slice(0, 6),
        ghin_index: p.ghinIndex ?? null,
        round_hcp: p.roundHcp ?? null,
        team: p.team ?? null,
        group_index: p.groupIndex ?? 0,
        role: i === 0 ? 'admin' : 'player',
        nickname: p.nickname ?? null,
        use_nickname: p.use_nickname ?? false,
      }))

      const gameConfigs = games.map((g, i) => ({
        id: `gg_${i}_${Date.now()}`,
        round_id: roundId,
        type: g.type,
        config: g.config,
        sort_order: i,
        created_by: null,
      }))

      activeRound.value = round
      activeMembers.value = members
      activeGames.value = gameConfigs
      activeScores.value = {}

      _persistGuest()
      return round
    }

    // ── AUTHENTICATED PATH ──────────────────────────────────
    console.log('[rounds] Authenticated path, user:', auth.user?.id)

    // Helper: race a Supabase call against a short timeout so a stuck
    // HTTP/2 stream on iOS PWA doesn't hang the whole creation forever.
    function _debugLog(msg) {
      try {
        const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
        log.push({ t: new Date().toISOString(), msg })
        localStorage.setItem('gw_create_log', JSON.stringify(log.slice(-100)))
      } catch {}
      console.log('[rounds]', msg)
    }
    async function supaWithTimeout(label, promise, ms = 6000) {
      _debugLog(`→ ${label}`)
      const t0 = Date.now()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      )
      try {
        const result = await Promise.race([promise, timeoutPromise])
        _debugLog(`✓ ${label} (${Date.now() - t0}ms)`)
        return result
      } catch (e) {
        _debugLog(`✗ ${label} (${Date.now() - t0}ms): ${e.message}`)
        throw e
      }
    }

    let roomCode = null
    if (withRoomCode) {
      roomCode = await supaWithTimeout('generateRoomCode', generateRoomCode(), 4000).catch(() => null)
    }

    // Build the insert body once so raw-fetch fallback can reuse it
    const roundBody = {
      name: name || courseName || 'Round',
      course_name: courseName,
      course_snapshot: courseSnapshot,
      tee,
      date: date || new Date().toISOString().slice(0, 10),
      holes_mode: holesMode || '18',
      format: format || 'social',
      room_code: roomCode,
      owner_id: auth.user?.id ?? null,
      opponent_players: opponentPlayers.length > 0 ? opponentPlayers : [],
    }

    // Try Supabase JS first, fall back to raw fetch() on timeout.
    // The Supabase JS client's internal fetch reuses connections, so when
    // WKWebView's HTTP/2 pool has a stuck socket EVERY SJS call times out.
    // Raw fetch with cache:'no-store' + keepalive:false forces a fresh connection.
    let round, error
    try {
      const res = await supaWithTimeout(
        'rounds.insert',
        supabase.from('rounds').insert(roundBody).select().single(),
        5000  // 5s SJS budget — pivot to raw quickly so user isn't stuck waiting
      )
      round = res.data
      error = res.error
    } catch (e) {
      _debugLog(`[rounds] SJS insert timed out, trying raw fetch fallback…`)
      try {
        const rows = await supaRawInsert('rounds', roundBody, 15000)
        round = Array.isArray(rows) ? rows[0] : rows
        error = null
        _debugLog(`[rounds] raw insert SUCCEEDED — round id ${round?.id?.slice(0, 8) || '?'}`)
      } catch (rawErr) {
        _debugLog(`[rounds] raw insert also failed: ${rawErr.message} (HTTP ${rawErr.status || '?'})`)
        // 400 = invalid/missing required field (e.g. course_name is empty)
        if (rawErr.status === 400 || rawErr.message?.includes('400')) {
          throw new Error(`Round data is incomplete — make sure you selected a course and tee before tapping Start Round. (${rawErr.message})`)
        }
        // 409 = unique constraint (room_code collision — very rare)
        if (rawErr.status === 409) {
          throw new Error('Room code conflict — please try again.')
        }
        throw new Error(
          'Could not reach the server. iOS sometimes gets stuck on old connections — try force-quitting GolfWizard (swipe up from the app switcher) and reopening.'
        )
      }
    }

    if (error) {
      console.error('[rounds] Supabase insert error:', error)
      if (error.code === '42501' || error.message?.includes('policy') || error.code === 'PGRST301') {
        throw new Error('Session expired — please sign in again and retry.')
      }
      throw new Error(error.message || 'Failed to create round in database.')
    }
    console.log('[rounds] Round inserted:', round.id)

    // Add members — use .select() to get back the new UUIDs
    let insertedMembers = []
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
        nickname: p.nickname ?? null,
        use_nickname: p.use_nickname ?? false,
        email: p.email ?? null,
      }))
      try {
        const { data: mData, error: mErr } = await supaWithTimeout(
          'round_members.insert',
          supabase.from('round_members').insert(memberRows).select(),
          5000
        )
        if (mErr) throw mErr
        insertedMembers = mData ?? []
      } catch (e) {
        _debugLog('[rounds] members SJS insert failed, trying raw fetch…')
        try {
          const rows = await supaRawInsert('round_members', memberRows, 10000)
          insertedMembers = Array.isArray(rows) ? rows : []
        } catch (rawErr) {
          // If insert truly can't land, try a raw SELECT in case the previous
          // attempts actually wrote something before the stream stalled
          try {
            const rows = await supaRawSelect('round_members', `select=*&round_id=eq.${round.id}`, 8000)
            insertedMembers = Array.isArray(rows) ? rows : []
          } catch {
            console.warn('[rounds] raw members fallback failed, using local fallback')
            insertedMembers = memberRows.map((row, i) => ({
              ...row,
              id: `local_${round.id}_${i}`,
            }))
          }
        }
      }
    }

    // Build a mapping from wizard player IDs → new Supabase member IDs
    // Match by short_name since that's unique within a round
    const idMap = {}
    for (const p of players) {
      const shortName = p.shortName ?? p.name?.slice(0, 6)
      const match = insertedMembers.find(m => m.short_name === shortName)
      if (match && p.id) idMap[p.id] = match.id
    }

    // Add games — remap team1/team2/player IDs from wizard IDs to real member IDs
    let insertedGames = []
    if (games.length) {
      const gameRows = games.map((g, i) => {
        const config = { ...g.config }
        // Remap team arrays
        if (Array.isArray(config.team1)) config.team1 = config.team1.map(id => idMap[id] || id)
        if (Array.isArray(config.team2)) config.team2 = config.team2.map(id => idMap[id] || id)
        // Remap individual player refs
        if (config.player1) config.player1 = idMap[config.player1] || config.player1
        if (config.player2) config.player2 = idMap[config.player2] || config.player2
        // Remap players array (fidget, etc.)
        if (Array.isArray(config.players)) config.players = config.players.map(id => idMap[id] || id)
        return {
          round_id: round.id,
          type: g.type,
          config,
          sort_order: i,
          created_by: auth.user?.id ?? null,
        }
      })
      try {
        const { data: gData, error: gErr } = await supaWithTimeout(
          'game_configs.insert',
          supabase.from('game_configs').insert(gameRows).select(),
          5000
        )
        if (gErr) throw gErr
        insertedGames = gData ?? []
      } catch (e) {
        _debugLog('[rounds] games SJS insert failed, trying raw fetch…')
        try {
          const rows = await supaRawInsert('game_configs', gameRows, 10000)
          insertedGames = Array.isArray(rows) ? rows : []
        } catch (rawErr) {
          try {
            const rows = await supaRawSelect('game_configs', `select=*&round_id=eq.${round.id}&order=sort_order`, 8000)
            insertedGames = Array.isArray(rows) ? rows : []
          } catch {
            console.warn('[rounds] raw games fallback failed, using local fallback')
            insertedGames = gameRows.map((row, i) => ({ ...row, id: `local_g_${round.id}_${i}` }))
          }
        }
      }
    }

    // Set active state directly from insert results — no extra round-trip.
    activeRound.value = round
    activeMembers.value = insertedMembers
    activeGames.value = insertedGames
    activeScores.value = {}

    console.log('[rounds] Round active, members:', insertedMembers.length, 'games:', insertedGames.length)

    // Set up real-time subscriptions AFTER returning.
    // iOS PWA (WKWebView) has stricter WebSocket timing than regular Safari —
    // calling .subscribe() synchronously here can block the microtask queue.
    // Push it to the next macrotask so the promise resolves immediately.
    setTimeout(() => {
      try { subscribeToRound(round.id) } catch (e) { console.warn('[rounds] Subscribe failed (non-critical):', e) }
    }, 0)

    // Auto-save co-players to this user's roster (fire-and-forget)
    setTimeout(() => {
      try { _autoSaveCoPlayers(players, auth) } catch (e) { console.warn('[rounds] autoSaveCoPlayers failed:', e) }
    }, 500)

    return round
  }

  // ── Load a round as "active" ────────────────────────────────
  async function loadRound(roundId) {
    // ── GUEST PATH ──────────────────────────────────────────
    if (_isGuest() || String(roundId).startsWith('guest_')) {
      const raw = localStorage.getItem(_guestKey(roundId))
      if (!raw) throw new Error(`Guest round ${roundId} not found`)
      const payload = JSON.parse(raw)
      activeRound.value = payload.round
      activeMembers.value = payload.members ?? []
      activeGames.value = payload.games ?? []
      activeScores.value = payload.scores ?? {}
      return payload.round
    }

    // ── AUTHENTICATED PATH ──────────────────────────────────
    const { data, error } = await supabase
      .from('rounds')
      .select(`*, round_members(*), game_configs(*), scores(*)`)
      .eq('id', roundId)
      .single()

    if (error) throw error

    activeRound.value = data
    activeGames.value = data.game_configs ?? []

    // Derive team from game config if round_member.team is null
    // (handles rounds created before the team-derivation fix)
    const members = data.round_members ?? []
    const needsTeamDerive = members.some(m => m.team == null)
    if (needsTeamDerive) {
      // Find first game config with team1/team2 arrays
      const gameWithTeams = (data.game_configs ?? []).find(g => g.config?.team1?.length || g.config?.team2?.length)
      if (gameWithTeams) {
        const t1 = gameWithTeams.config.team1 || []
        const t2 = gameWithTeams.config.team2 || []
        for (const m of members) {
          if (m.team == null) {
            if (t1.includes(m.id)) m.team = 1
            else if (t2.includes(m.id)) m.team = 2
          }
        }
      }
    }
    activeMembers.value = members

    // Build scores map: { memberId: { hole: score } }
    const sm = {}
    for (const s of (data.scores ?? [])) {
      if (!sm[s.member_id]) sm[s.member_id] = {}
      sm[s.member_id][s.hole] = s.score
    }
    activeScores.value = sm

    // Subscribe to real-time updates
    subscribeToRound(roundId)
    return data
  }

  // ── Upsert a score ──────────────────────────────────────────
  async function setScore(memberId, hole, score) {
    const auth = useAuthStore()
    // Optimistic update — always apply immediately to local state
    if (!activeScores.value[memberId]) activeScores.value[memberId] = {}
    activeScores.value[memberId][hole] = score

    // ── GUEST PATH ──────────────────────────────────────────
    if (!auth.isAuthenticated || String(activeRound.value?.id ?? '').startsWith('guest_')) {
      _persistGuest()
      return
    }

    // ── AUTHENTICATED PATH ──────────────────────────────────
    // Also persist to localStorage so we have a local copy if offline
    _persistGuest()

    const entry = {
      round_id: activeRound.value.id,
      member_id: memberId,
      hole,
      score,
      entered_by: auth.user?.id ?? null,
      entered_at: new Date().toISOString(),
    }

    try {
      const { error } = await supabase.from('scores').upsert(entry, { onConflict: 'round_id,member_id,hole' })
      if (error) {
        console.warn('Score save failed, queuing for retry:', error.message)
        _enqueue(entry)
        // RLS / auth errors won't be fixed by retrying — surface to UI
        if (error.code === '42501' || error.message?.includes('row-level') || error.message?.includes('policy')) {
          scoreSyncError.value = 'rls'
        } else {
          scoreSyncError.value = 'db'
        }
      } else {
        scoreSyncError.value = null  // clear on success
      }
    } catch (e) {
      // Offline — queue silently, no error banner (expected)
      console.warn('Score save offline, queued:', e.message)
      _enqueue(entry)
    }
    // Non-blocking: never throw — the optimistic update already applied
  }

  // ── Save game configs ───────────────────────────────────────
  async function saveGameConfig(game) {
    const auth = useAuthStore()

    if (!auth.isAuthenticated || String(activeRound.value?.id ?? '').startsWith('guest_')) {
      const newGame = { ...game, id: game.id || `gg_${Date.now()}`, round_id: activeRound.value?.id }
      const idx = activeGames.value.findIndex(g => g.id === newGame.id)
      if (idx >= 0) activeGames.value[idx] = newGame
      else activeGames.value.push(newGame)
      _persistGuest()
      return newGame
    }

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

  // Update just the config object of an existing game (e.g., snake events)
  async function updateGameConfig(gameId, newConfig) {
    const game = activeGames.value.find(g => g.id === gameId)
    if (!game) return
    game.config = { ...newConfig }
    return saveGameConfig(game)
  }

  async function deleteGameConfig(gameId) {
    const auth = useAuthStore()

    if (!auth.isAuthenticated || String(activeRound.value?.id ?? '').startsWith('guest_')) {
      activeGames.value = activeGames.value.filter(g => g.id !== gameId)
      _persistGuest()
      return
    }

    const { error } = await supabase.from('game_configs').delete().eq('id', gameId)
    if (error) throw error
    activeGames.value = activeGames.value.filter(g => g.id !== gameId)
  }

  // ── Update round date ────────────────────────────────────────
  async function updateRoundDate(roundId, newDate) {
    const auth = useAuthStore()
    const dateStr = typeof newDate === 'string' ? newDate : newDate.toISOString().slice(0, 10)

    if (!auth.isAuthenticated || String(roundId).startsWith('guest_')) {
      if (activeRound.value?.id === roundId) activeRound.value.date = dateStr
      _persistGuest()
      return
    }

    const { error } = await supabase.from('rounds').update({ date: dateStr }).eq('id', roundId)
    if (error) throw error
    if (activeRound.value?.id === roundId) activeRound.value.date = dateStr
    // Also update in history list
    const idx = rounds.value.findIndex(r => r.id === roundId)
    if (idx !== -1) rounds.value[idx] = { ...rounds.value[idx], date: dateStr }
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
    // Skip subscriptions for guest rounds
    if (String(roundId).startsWith('guest_')) return

    // Clean up previous subscriptions
    try {
      if (scoreSubscription) supabase.removeChannel(scoreSubscription)
      if (memberSubscription) supabase.removeChannel(memberSubscription)
    } catch (e) { console.warn('Failed to clean up subscriptions:', e) }
    scoreSubscription = null
    memberSubscription = null

    // Subscribe in a non-blocking way — don't let subscription failures block round creation
    try {
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
        .subscribe((status, err) => {
          if (err) console.warn('Score subscription error:', err)
        })

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
        .subscribe((status, err) => {
          if (err) console.warn('Member subscription error:', err)
        })
    } catch (e) {
      console.warn('Real-time subscription setup failed (non-critical):', e)
    }
  }

  function unsubscribe() {
    if (scoreSubscription) supabase.removeChannel(scoreSubscription)
    if (memberSubscription) supabase.removeChannel(memberSubscription)
    scoreSubscription = null
    memberSubscription = null
  }

  // ── Compute settlements for a round ─────────────────────────
  function _buildSettlementCtx() {
    const round = activeRound.value
    if (!round) return null
    // Use frozen course snapshot first — handles custom + API courses correctly.
    // Fallback to live builtin lookup for rounds created before snapshots existed.
    const course = round.course_snapshot ?? getCourse(round.course_name)
    if (!course) return null
    return {
      course,
      tee: round.tee,
      members: activeMembers.value,
      scores: activeScores.value,
      holesMode: round.holes_mode || '18',
    }
  }

  // ── Complete / archive a round ──────────────────────────────
  async function completeRound(roundId) {
    // Compute settlements before marking complete
    let settlementData = null
    if (activeRound.value?.id === roundId && activeGames.value.length) {
      const ctx = _buildSettlementCtx()
      if (ctx) {
        try {
          settlementData = computeAllSettlements(ctx, activeGames.value)
        } catch (e) {
          console.warn('Settlement computation failed:', e)
        }
      }
    }

    // ── GUEST PATH ──────────────────────────────────────────
    if (_isGuest() || String(roundId).startsWith('guest_')) {
      if (activeRound.value?.id === roundId) {
        activeRound.value.is_complete = true
        activeRound.value.settlements = settlementData
        _persistGuest()
      }
      return settlementData
    }

    // ── AUTHENTICATED PATH ──────────────────────────────────
    // 0. Flush queued scores — retry up to 3x before completing
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await _flushQueue()
        const remaining = _loadQueue()
        if (!remaining.length) break
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt))
      } catch (e) {
        console.warn(`[rounds] flush attempt ${attempt} failed:`, e.message)
      }
    }

    // 1. Mark round complete — use raw fetch with timeout to avoid iOS hang
    const _withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
    ])

    try {
      await _withTimeout(
        supabase.from('rounds').update({ is_complete: true }).eq('id', roundId),
        5000, 'rounds.complete'
      )
    } catch (e) {
      // SJS timed out or failed — fall back to raw fetch
      console.warn('[rounds] completeRound SJS failed, trying raw:', e.message)
      await supaRawUpdate('rounds', `id=eq.${roundId}`, { is_complete: true }, 8000)
    }

    // 2. Save settlement JSON snapshot
    if (settlementData) {
      try {
        await _withTimeout(
          supabase.from('round_settlements').upsert({
            round_id: roundId,
            settlement_json: settlementData,
            computed_at: new Date().toISOString(),
          }, { onConflict: 'round_id' }),
          5000, 'round_settlements.upsert'
        )
      } catch (e) {
        console.warn('Failed to save settlement snapshot:', e.message)
        // Non-fatal — round is already marked complete
      }

      // 3. Save individual ledger entries — upsert so iOS double-complete retries are safe
      if (settlementData.ledger?.length) {
        const rows = settlementData.ledger.map(l => ({
          round_id: roundId,
          from_member_id: l.from_member_id,
          to_member_id: l.to_member_id,
          amount: l.amount,
          note: l.note || 'Round settlement',
        }))
        try {
          await _withTimeout(
            supabase.from('ledger_entries').upsert(rows, { onConflict: 'round_id,from_member_id,to_member_id' }),
            5000, 'ledger_entries.upsert'
          )
        } catch (e) {
          console.warn('Failed to save ledger entries:', e.message)
          // Non-fatal
        }
      }
    }

    if (activeRound.value?.id === roundId) {
      // Reassign to trigger Vue reactivity
      activeRound.value = { ...activeRound.value, is_complete: true }
    }
    unsubscribe()
    return settlementData
  }

  // ── Delete a round ──────────────────────────────────────
  async function deleteRound(roundId) {
    // ── GUEST PATH ──
    if (_isGuest() || String(roundId).startsWith('guest_')) {
      if (activeRound.value?.id === roundId) {
        activeRound.value = null
        activeMembers.value = []
        activeScores.value = {}
        activeGames.value = []
      }
      rounds.value = rounds.value.filter(r => r.id !== roundId)
      _persistGuest()
      return
    }

    // ── AUTHENTICATED PATH ──
    // All child tables (scores, round_members, game_configs, round_settlements)
    // have ON DELETE CASCADE — one delete on the parent round wipes everything.
    const { error } = await supabase.from('rounds').delete().eq('id', roundId)
    if (error) throw new Error(error.message)

    // Clear active if this was the active round
    if (activeRound.value?.id === roundId) {
      activeRound.value = null
      activeMembers.value = []
      activeScores.value = {}
      activeGames.value = []
    }
    rounds.value = rounds.value.filter(r => r.id !== roundId)
  }

  // ── Set a round as active and reload data ────────────────
  async function setActiveRound(round) {
    activeRound.value = round
    // Re-fetch members, scores, games
    if (_isGuest() || String(round.id).startsWith('guest_')) {
      const gData = JSON.parse(localStorage.getItem('golf_active_round') || 'null')
      if (gData) {
        activeMembers.value = gData.members || []
        activeScores.value = gData.scores || {}
        activeGames.value = gData.games || []
      }
      return
    }
    const { data: members } = await supabase.from('round_members').select('*').eq('round_id', round.id)
    activeMembers.value = members ?? []
    const { data: scores } = await supabase.from('scores').select('*').eq('round_id', round.id)
    activeScores.value = {}
    for (const s of (scores ?? [])) {
      const key = `${s.member_id}_${s.hole}`
      activeScores.value[key] = s.strokes
    }
    const { data: games } = await supabase.from('game_configs').select('*').eq('round_id', round.id)
    activeGames.value = (games ?? []).map(g => ({ ...g, config: typeof g.config === 'string' ? JSON.parse(g.config) : g.config }))
  }

  // ── Fetch settlements for a round ───────────────────────────
  async function fetchSettlements(roundId) {
    if (_isGuest() || String(roundId).startsWith('guest_')) {
      const raw = localStorage.getItem(_guestKey(roundId))
      if (!raw) return null
      const payload = JSON.parse(raw)
      return payload.round?.settlements || null
    }

    const { data, error } = await supabase
      .from('round_settlements')
      .select('settlement_json')
      .eq('round_id', roundId)
      .maybeSingle()
    if (error || !data) return null
    return data.settlement_json
  }

  // ── Fetch ledger entries for metrics ───────────────────────
  async function fetchLedgerEntries(filters = {}) {
    if (_isGuest()) return []

    let q = supabase.from('ledger_entries').select('*')
    if (filters.roundId) q = q.eq('round_id', filters.roundId)
    if (filters.memberId) {
      q = q.or(`from_member_id.eq.${filters.memberId},to_member_id.eq.${filters.memberId}`)
    }
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) return []
    return data ?? []
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

  function clearActiveRound() {
    activeRound.value = null
  }

  function pendingQueueCount() {
    return _loadQueue().length
  }

  return {
    activeRound, activeMembers, activeScores, activeGames,
    rounds, loading, activeRoundId, scoreSyncError,
    pendingQueueCount,
    flushQueue: _flushQueue,
    fetchRounds, createRound, loadRound, setScore,
    saveGameConfig, updateGameConfig, deleteGameConfig,
    updateRoundDate,
    joinByRoomCode, completeRound, deleteRound, setActiveRound,
    fetchSettlements, fetchLedgerEntries,
    subscribeToRound, unsubscribe,
    saveGuestRound, loadGuestRounds,
    clearActiveRound,
  }
})
