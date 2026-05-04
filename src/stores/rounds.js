import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, generateRoomCode } from '../supabase'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useRosterStore } from './roster'
import { computeAllSettlements } from '../modules/settlements'
import { getCourse, COURSES as BUILTIN_COURSES } from '../modules/courses'
import { supaRawInsert, supaRawSelect, supaRawUpdate, supaRawRequest, supaRawDelete } from '../modules/supaRaw'
import { supaCall } from '../modules/supabaseOps'

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

  // Rounds this user owns or is a member of (excludes cross-match opponent rounds fetched via RLS)
  const myRounds = computed(() => {
    const uid = authStore.user?.id
    if (!uid) return rounds.value
    return rounds.value.filter(r =>
      r.owner_id === uid ||
      r.round_members?.some(m => m.profile_id === uid)
    )
  })

  // ── Known rounds registry ────────────────────────────────────
  // Tracks rounds this user has created or joined so they can switch between them.
  // Stored as lightweight summaries; full data is loaded on demand via loadRound().
  const _KNOWN_KEY = 'gw_known_rounds'
  const knownRounds = ref([])  // [{ id, courseName, date, holesMode, isComplete }]

  function _loadKnownList() {
    try { return JSON.parse(localStorage.getItem(_KNOWN_KEY) || '[]') } catch { return [] }
  }
  function _saveKnownList(list) {
    try { localStorage.setItem(_KNOWN_KEY, JSON.stringify(list.slice(0, 10))) } catch {}
  }
  function _registerKnownRound(round) {
    if (!round?.id || String(round.id).startsWith('guest_')) return
    const list = _loadKnownList()
    const memberNames = activeMembers.value.length
      ? activeMembers.value.map(m => m.short_name || m.full_name?.split(' ')[0] || '?').join(', ')
      : ''
    const entry = {
      id: round.id,
      courseName: round.course_name,
      date: round.date,
      holesMode: round.holes_mode || '18',
      isComplete: !!round.is_complete,
      players: memberNames,
    }
    const idx = list.findIndex(r => r.id === round.id)
    if (idx >= 0) list[idx] = entry
    else list.unshift(entry)
    _saveKnownList(list)
    knownRounds.value = list.filter(r => !r.isComplete)
  }
  function _removeKnownRound(roundId) {
    const list = _loadKnownList().filter(r => r.id !== roundId)
    _saveKnownList(list)
    knownRounds.value = list.filter(r => !r.isComplete)
  }
  // Boot: restore from localStorage, strip completed rounds
  knownRounds.value = _loadKnownList().filter(r => !r.isComplete)

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
      let saved = false
      // Try SJS first
      try {
        const { error } = await Promise.race([
          supabase.from('scores').upsert(entry, { onConflict: 'round_id,member_id,hole' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('flush SJS timeout')), 2000))
        ])
        if (!error) saved = true
      } catch {}
      // Raw fetch fallback if SJS failed/timed out
      if (!saved) {
        try {
          await supaRawRequest(
            'POST',
            'scores?on_conflict=round_id,member_id,hole',
            entry,
            8000,
            { Prefer: 'resolution=merge-duplicates,return=representation' },
          )
          saved = true
        } catch {}
      }
      if (!saved) failed.push(entry)
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

      if (data !== null) {
        rounds.value = data
        // Reconcile knownRounds against server — purge stale entries whose IDs
        // no longer exist in the fetched list (ghost rounds from failed creations).
        const serverIds = new Set(data.map(r => r.id))
        const cleaned = _loadKnownList().filter(r => serverIds.has(r.id))
        if (cleaned.length !== _loadKnownList().length) {
          _saveKnownList(cleaned)
          knownRounds.value = cleaned.filter(r => !r.isComplete)
        }
      }
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
        stroke_override: p.stroke_override ?? null,
        team: p.team ?? null,
        group_index: p.groupIndex ?? 0,
        role: i === 0 ? 'admin' : 'player',
        nickname: p.nickname ?? null,
        use_nickname: p.use_nickname ?? false,
      }))

      // Map wizard player IDs → guest member IDs for config remapping
      const guestIdMap = {}
      players.forEach((p, i) => { if (p.id) guestIdMap[p.id] = members[i].id })

      const gameConfigs = games.map((g, i) => {
        const config = { ...g.config }
        if (Array.isArray(config.team1)) config.team1 = config.team1.map(id => guestIdMap[id] || id)
        if (Array.isArray(config.team2)) config.team2 = config.team2.map(id => guestIdMap[id] || id)
        if (config.player1) config.player1 = guestIdMap[config.player1] || config.player1
        if (config.player2) config.player2 = guestIdMap[config.player2] || config.player2
        if (Array.isArray(config.players)) config.players = config.players.map(id => guestIdMap[id] || id)
        if (Array.isArray(config.wolfTeeOrder)) config.wolfTeeOrder = config.wolfTeeOrder.map(id => guestIdMap[id] || id)
        return {
          id: `gg_${i}_${Date.now()}`,
          round_id: roundId,
          type: g.type,
          config,
          sort_order: i,
          created_by: null,
        }
      })

      activeRound.value = round
      activeMembers.value = members
      activeGames.value = gameConfigs
      activeScores.value = {}

      _persistGuest()
      return round
    }

    // ── AUTHENTICATED PATH ──────────────────────────────────
    console.log('[rounds] Authenticated path, user:', auth.user?.id)

    function _debugLog(msg) {
      try {
        const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
        log.push({ t: new Date().toISOString(), msg })
        localStorage.setItem('gw_create_log', JSON.stringify(log.slice(-100)))
      } catch {}
      console.log('[rounds]', msg)
    }
    // 2 s SJS budget — pivot to raw fetch quickly on iOS stuck-socket
    async function supaWithTimeout(label, promise, ms = 2000) {
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
      roomCode = await supaWithTimeout('generateRoomCode', generateRoomCode(), 3000).catch(() => null)
    }

    // ── Pre-generate ALL IDs client-side (Tier-2 optimistic) ──────
    // Using crypto.randomUUID() means IDs are determined before any DB call:
    // • game configs reference the correct member UUIDs immediately — no post-insert
    //   short_name matching that could silently produce wrong IDs
    // • games insert can fire in the background after store state is set
    const roundId = crypto.randomUUID()
    const memberIds = players.map(() => crypto.randomUUID())
    const gameIds = games.map(() => crypto.randomUUID())

    // Build idMap deterministically: wizard player index → pre-generated member UUID
    const idMap = {}
    players.forEach((p, i) => { if (p.id) idMap[p.id] = memberIds[i] })

    // Helper: remap all player/team references in a game config from wizard IDs → member UUIDs
    function _remapConfig(cfg) {
      const c = { ...cfg }
      if (Array.isArray(c.team1)) c.team1 = c.team1.map(id => idMap[id] ?? id)
      if (Array.isArray(c.team2)) c.team2 = c.team2.map(id => idMap[id] ?? id)
      if (c.player1) c.player1 = idMap[c.player1] ?? c.player1
      if (c.player2) c.player2 = idMap[c.player2] ?? c.player2
      if (Array.isArray(c.players)) c.players = c.players.map(id => idMap[id] ?? id)
      if (Array.isArray(c.wolfTeeOrder)) c.wolfTeeOrder = c.wolfTeeOrder.map(id => idMap[id] ?? id)
      return c
    }

    // Build all entity rows with pre-generated IDs
    const roundBody = {
      id: roundId,
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

    const memberRows = players.map((p, i) => ({
      id: memberIds[i],
      round_id: roundId,
      profile_id: p.profileId ?? null,
      guest_name: p.profileId ? null : p.name,
      short_name: p.shortName ?? p.name?.slice(0, 6),
      ghin_index: p.ghinIndex ?? null,
      round_hcp: p.roundHcp ?? null,
      stroke_override: p.stroke_override ?? null,
      team: p.team ?? null,
      group_index: p.groupIndex ?? 0,
      role: i === 0 && auth.user?.id ? 'admin' : 'player',
      nickname: p.nickname ?? null,
      use_nickname: p.use_nickname ?? false,
      email: p.email ?? null,
    }))

    const gameRows = games.map((g, i) => ({
      id: gameIds[i],
      round_id: roundId,
      type: g.type,
      config: _remapConfig(g.config),
      sort_order: i,
      created_by: auth.user?.id ?? null,
    }))

    // ── Insert round ────────────────────────────────────────────────
    let round
    try {
      const res = await supaWithTimeout(
        'rounds.insert',
        supabase.from('rounds').insert(roundBody).select().single(),
        2000,
      )
      round = res.data
      if (res.error) throw res.error
    } catch (e) {
      _debugLog(`[rounds] SJS insert timed out, trying raw fetch fallback…`)
      try {
        const rows = await supaRawInsert('rounds', roundBody, 12000)
        round = Array.isArray(rows) ? rows[0] : rows
        _debugLog(`[rounds] raw insert SUCCEEDED — round id ${round?.id?.slice(0, 8) || '?'}`)
      } catch (rawErr) {
        _debugLog(`[rounds] raw insert also failed: ${rawErr.message} (HTTP ${rawErr.status || '?'})`)
        if (rawErr.status === 400 || rawErr.message?.includes('400')) {
          throw new Error(`Round data is incomplete — make sure you selected a course and tee before tapping Start Round. (${rawErr.message})`)
        }
        if (rawErr.status === 409) {
          throw new Error('Room code conflict — please try again.')
        }
        throw new Error(
          'Could not reach the server. iOS sometimes gets stuck on old connections — try force-quitting GolfWizard (swipe up from the app switcher) and reopening.'
        )
      }
    }

    if (!round) throw new Error('Failed to create round in database.')
    if (round.id !== roundId) {
      // Supabase accepted the insert but the returned id differs — shouldn't happen with explicit id,
      // but if it does, patch idMap so score FK writes use the correct id.
      _debugLog(`[rounds] WARNING: returned id ${round.id} differs from pre-generated ${roundId}`)
    }
    console.log('[rounds] Round inserted:', round.id)

    // ── Insert members ──────────────────────────────────────────────
    let insertedMembers = []
    if (players.length) {
      try {
        const { data: mData, error: mErr } = await supaWithTimeout(
          'round_members.insert',
          supabase.from('round_members').insert(memberRows).select(),
          2000,
        )
        if (mErr) throw mErr
        insertedMembers = mData ?? []
      } catch (e) {
        _debugLog('[rounds] members SJS insert failed, trying raw fetch…')
        try {
          const rows = await supaRawInsert('round_members', memberRows, 10000)
          insertedMembers = Array.isArray(rows) ? rows : []
        } catch (rawErr) {
          try {
            const rows = await supaRawSelect('round_members', `select=*&round_id=eq.${round.id}`, 8000)
            insertedMembers = Array.isArray(rows) ? rows : []
          } catch {
            // Last resort: use pre-generated rows so IDs are consistent
            console.warn('[rounds] all member insert paths failed — using pre-generated rows')
            insertedMembers = memberRows
          }
        }
      }
    }

    // ── Set store state immediately ─────────────────────────────────
    // Games are inserted in the background below. We already have their pre-generated
    // rows, so the store is fully usable (notation, scoring) without waiting for the DB.
    activeRound.value = round
    activeMembers.value = insertedMembers.length ? insertedMembers : memberRows
    activeGames.value = gameRows
    activeScores.value = {}

    // Cache game rows to localStorage so loadRound can recover them if the background
    // insert fails or RLS blocks the SELECT on resume.
    if (gameRows.length) {
      try { localStorage.setItem(`gw_games_cache_${round.id}`, JSON.stringify(gameRows)) } catch {}
    }

    console.log('[rounds] Round active, members:', activeMembers.value.length, 'games:', gameRows.length)

    // ── Insert games in background — non-blocking ───────────────────
    // Round and members are in DB now (FK constraints satisfied for score writes).
    // Games insert in the background so the scorecard appears without waiting.
    if (gameRows.length) {
      setTimeout(async () => {
        try {
          const { data: gData, error: gErr } = await supabase.from('game_configs').insert(gameRows).select()
          if (gErr) throw gErr
          // Patch store with DB-returned rows (e.g. server-set timestamps)
          if (gData?.length) activeGames.value = gData
          _debugLog(`✓ game_configs.insert (background, ${gData?.length} rows)`)
        } catch (e) {
          _debugLog(`✗ game_configs.insert (SJS bg): ${e.message} — trying raw…`)
          try {
            const rows = await supaRawInsert('game_configs', gameRows, 10000)
            if (Array.isArray(rows) && rows.length) activeGames.value = rows
          } catch (rawErr) {
            // Games failed to persist — active store still has pre-generated rows so
            // the UI works; they just won't survive a reload.
            console.warn('[rounds] background game_configs insert failed:', rawErr.message)
          }
        }
      }, 0)
    }

    // Subscribe to real-time and auto-save roster — deferred to avoid blocking
    setTimeout(() => {
      try { subscribeToRound(round.id) } catch (e) { console.warn('[rounds] Subscribe failed (non-critical):', e) }
    }, 0)

    setTimeout(() => {
      try { _autoSaveCoPlayers(players, auth) } catch (e) { console.warn('[rounds] autoSaveCoPlayers failed:', e) }
    }, 500)

    _registerKnownRound(round)
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
    // Timeout + raw fallback: same iOS stuck-socket guard as fetchRounds
    let data = null
    try {
      const res = await Promise.race([
        supabase.from('rounds').select(`*, round_members(*), game_configs(*), scores(*)`).eq('id', roundId).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('loadRound timed out')), 5000)),
      ])
      if (res.error) throw res.error
      data = res.data
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      console.warn('[rounds] loadRound SJS timed out, trying raw fetch fallback')
      const rows = await supaRawSelect(
        'rounds',
        `select=*,round_members(*),game_configs(*),scores(*)&id=eq.${roundId}`,
        12000,
      )
      data = Array.isArray(rows) ? rows[0] : rows
    }

    if (!data) throw new Error(`Round ${roundId} not found`)

    activeRound.value = data
    activeGames.value = data.game_configs ?? []

    // If Supabase returned no game_configs (background insert may have failed,
    // or RLS gap for tournament rounds), recover from localStorage cache.
    if (activeGames.value.length === 0) {
      const cached = rounds.value.find(r => r.id === roundId)
      if (cached?.game_configs?.length) {
        activeGames.value = cached.game_configs
      } else {
        try {
          const raw = localStorage.getItem(`gw_games_cache_${roundId}`)
          if (raw) {
            const cached = JSON.parse(raw)
            if (Array.isArray(cached) && cached.length) activeGames.value = cached
          }
        } catch {}
      }
    }

    // Tournament rounds: strip stale best_ball entries (tournament Team BB is
    // now derived from tournament_matches.wagers, not from a game_configs row).
    // match1v1 is NOT stripped here — those are legitimate user-created side
    // bets distinct from the tournament's structural singles pairings. The
    // display layer (buildLiveSections) is responsible for de-duping any
    // match1v1 whose players match the tournament's singles_order pairing.
    if (data.format === 'tournament') {
      activeGames.value = activeGames.value.filter(g => g.type !== 'best_ball')
      try { localStorage.setItem(`gw_games_cache_${roundId}`, JSON.stringify(activeGames.value)) } catch {}
    }

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
    _registerKnownRound(data)
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

    // Try SJS with short timeout; fall back to raw fetch to survive stuck iOS sockets
    let sjsErr = null
    try {
      const { error } = await Promise.race([
        supabase.from('scores').upsert(entry, { onConflict: 'round_id,member_id,hole' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('score SJS timeout')), 2000)),
      ])
      if (error) throw error
      scoreSyncError.value = null
      return  // success
    } catch (e) {
      sjsErr = e
    }

    // SJS failed or timed out — try raw fetch with fresh connection
    try {
      await supaRawRequest(
        'POST',
        'scores?on_conflict=round_id,member_id,hole',
        entry,
        8000,
        { Prefer: 'resolution=merge-duplicates,return=representation' },
      )
      scoreSyncError.value = null
    } catch (rawErr) {
      console.warn('Score save failed (SJS + raw):', rawErr.message)
      _enqueue(entry)
      const isAuthErr = sjsErr?.code === '42501' || rawErr.status === 401 || rawErr.status === 403
        || sjsErr?.message?.includes('row-level') || sjsErr?.message?.includes('policy')
      scoreSyncError.value = isAuthErr ? 'rls' : 'db'
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

    const row = { ...game, round_id: activeRound.value.id, created_by: auth.user?.id ?? null }
    let data
    try {
      const res = await supaCall(
        'game_configs.upsert',
        supabase.from('game_configs').upsert(row).select().single(),
        6000,
      )
      if (res.error) throw res.error
      data = res.data
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      if (game.id) {
        const { id: _id, ...patch } = row
        const rows = await supaRawUpdate('game_configs', `id=eq.${game.id}`, patch, 10000)
        data = Array.isArray(rows) ? rows[0] : rows
      } else {
        const rows = await supaRawInsert('game_configs', row, 10000)
        data = Array.isArray(rows) ? rows[0] : rows
      }
    }
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

    try {
      const res = await supaCall(
        'game_configs.delete',
        supabase.from('game_configs').delete().eq('id', gameId),
        6000,
      )
      if (res.error) throw res.error
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      await supaRawDelete('game_configs', `id=eq.${gameId}`, 10000)
    }
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

    try {
      const res = await supaCall(
        'rounds.date-update',
        supabase.from('rounds').update({ date: dateStr }).eq('id', roundId),
        6000,
      )
      if (res.error) throw res.error
    } catch (e) {
      if (!e.message?.includes('timed out')) throw e
      await supaRawUpdate('rounds', `id=eq.${roundId}`, { date: dateStr }, 10000)
    }
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
        const memberRow = {
          round_id: round.id,
          profile_id: auth.user.id,
          short_name: auth.profile?.short_name ?? auth.profile?.display_name?.slice(0, 6),
          ghin_index: auth.profile?.ghin_index,
          role: 'scorer',
        }
        try {
          const res = await supaCall('round_members.join', supabase.from('round_members').insert(memberRow), 6000)
          if (res.error) throw res.error
        } catch (e) {
          if (!e.message?.includes('timed out')) throw e
          await supaRawInsert('round_members', memberRow, 10000)
        }
      }
    }

    await loadRound(round.id)
    // loadRound already calls _registerKnownRound; ensure we also mark this device as knowing about this round
    _registerKnownRound(activeRound.value ?? round)
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
    // Compute settlements before marking complete.
    // If activeGames is empty (e.g. finish triggered after page reload), fetch from DB.
    let settlementData = null
    let gamesForSettlement = activeGames.value
    if (activeRound.value?.id === roundId && !gamesForSettlement.length) {
      try {
        const { data: fetchedGames } = await supabase.from('game_configs').select('*').eq('round_id', roundId)
        if (fetchedGames?.length) {
          gamesForSettlement = fetchedGames.map(g => ({
            ...g,
            config: typeof g.config === 'string' ? JSON.parse(g.config) : g.config,
          }))
          activeGames.value = gamesForSettlement
        }
      } catch (e) {
        console.warn('[rounds] completeRound: game_configs fetch failed:', e.message)
      }
    }
    if (activeRound.value?.id === roundId && gamesForSettlement.length) {
      const ctx = _buildSettlementCtx()
      if (ctx) {
        try {
          settlementData = computeAllSettlements(ctx, gamesForSettlement)
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
      activeRound.value = { ...activeRound.value, is_complete: true }
    }
    _removeKnownRound(roundId)
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
    // Optimistic clear — unblock UI immediately so delete never "hangs".
    // All child tables have ON DELETE CASCADE; one parent delete wipes everything.
    if (activeRound.value?.id === roundId) {
      activeRound.value = null
      activeMembers.value = []
      activeScores.value = {}
      activeGames.value = []
    }
    rounds.value = rounds.value.filter(r => r.id !== roundId)
    _removeKnownRound(roundId)

    // Delete child rows first (FK safety — ON DELETE CASCADE may not be configured),
    // then delete the parent round. All four steps use the raw fetch path so iOS
    // stuck-socket issues don't block the operation.
    const tables = ['scores', 'round_games', 'round_members', 'rounds']
    const filters = [
      `round_id=eq.${roundId}`,
      `round_id=eq.${roundId}`,
      `round_id=eq.${roundId}`,
      `id=eq.${roundId}`,
    ]
    for (let i = 0; i < tables.length; i++) {
      try {
        await supaRawDelete(tables[i], filters[i], 10000)
      } catch (e) {
        // scores/round_games/round_members failures are non-fatal (row may not exist);
        // a rounds delete failure is the one that actually matters.
        if (tables[i] === 'rounds') {
          console.warn('[rounds] deleteRound failed:', e.message, e.detail)
          throw new Error('Could not delete round from server. It may reappear after reload.')
        }
        console.warn(`[rounds] deleteRound child delete failed (${tables[i]}):`, e.message)
      }
    }
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
    const sm = {}
    for (const s of (scores ?? [])) {
      if (!sm[s.member_id]) sm[s.member_id] = {}
      sm[s.member_id][s.hole] = s.score
    }
    activeScores.value = sm
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

  // ── Sync a completed guest round to Supabase ───────────────
  // Called when a user was signed out during a round, then signs in and
  // wants to recover the round into their account history.
  async function syncGuestRoundToDb() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated || !activeRound.value) return
    const r = activeRound.value
    if (!r.is_complete) throw new Error('Round is not complete')
    if (r.owner_id) throw new Error('Round already linked to an account')

    const uid = auth.user.id

    // 1. Insert the round row
    const { data: newRound, error: rErr } = await supabase
      .from('rounds')
      .insert({
        id: r.id,
        date: r.date,
        format: r.format,
        course_id: r.course_id,
        course_name: r.course_name,
        tee_name: r.tee_name,
        hole_count: r.hole_count,
        owner_id: uid,
        is_complete: true,
        room_code: r.room_code || null,
      })
      .select()
      .single()

    if (rErr) {
      // If already exists (duplicate round_id), just update owner
      if (rErr.code === '23505') {
        await supabase.from('rounds').update({ owner_id: uid, is_complete: true }).eq('id', r.id)
      } else {
        throw rErr
      }
    }

    // 2. Insert members
    if (activeMembers.value?.length) {
      const memberRows = activeMembers.value.map(m => ({
        round_id: r.id,
        guest_name: m.guest_name || m.name || null,
        short_name: m.short_name || null,
        ghin_index: m.ghin_index ?? null,
        ghin_number: m.ghin_number || null,
        email: m.email || null,
        profile_id: m.profile_id || (m.is_self ? uid : null) || null,
        nickname: m.nickname || null,
        use_nickname: m.use_nickname || false,
        tee_name: m.tee_name || r.tee_name || null,
        group_index: m.group_index ?? null,
      }))
      await supabase.from('round_members').upsert(memberRows, { onConflict: 'round_id,guest_name', ignoreDuplicates: true })
    }

    // 3. Insert scores
    if (activeScores.value?.length) {
      const scoreRows = activeScores.value.map(s => ({
        round_id: r.id,
        member_id: s.member_id,
        hole: s.hole,
        strokes: s.strokes,
        putts: s.putts ?? null,
        fairway: s.fairway ?? null,
      }))
      await supabase.from('scores').upsert(scoreRows, { onConflict: 'round_id,member_id,hole', ignoreDuplicates: true })
    }

    // 4. Insert game configs
    if (activeGames.value?.length) {
      const gameRows = activeGames.value.map(g => ({
        round_id: r.id,
        type: g.type,
        config: g.config,
        created_by: uid,
      }))
      await supabase.from('game_configs').upsert(gameRows, { onConflict: 'round_id,type', ignoreDuplicates: true })
    }

    // 5. Save settlement snapshot if present
    if (r.settlements) {
      await supabase.from('round_settlements').upsert({
        round_id: r.id,
        settlement_json: r.settlements,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'round_id' }).catch(() => {})
    }

    // 6. Update local state to reflect it's now a DB round
    activeRound.value = { ...activeRound.value, owner_id: uid }
    // Remove from guest index
    const idx = JSON.parse(localStorage.getItem('gw_guest_rounds_index') || '[]')
    localStorage.setItem('gw_guest_rounds_index', JSON.stringify(idx.filter(id => id !== r.id)))
    localStorage.removeItem(_guestKey(r.id))
  }

  return {
    activeRound, activeMembers, activeScores, activeGames,
    knownRounds,
    rounds, myRounds, loading, activeRoundId, scoreSyncError,
    pendingQueueCount,
    flushQueue: _flushQueue,
    patchActiveGames: (games) => { activeGames.value = games },
    fetchRounds, createRound, loadRound, setScore,
    saveGameConfig, updateGameConfig, deleteGameConfig,
    updateRoundDate,
    joinByRoomCode, completeRound, deleteRound, setActiveRound,
    fetchSettlements, fetchLedgerEntries,
    subscribeToRound, unsubscribe,
    saveGuestRound, loadGuestRounds,
    clearActiveRound,
    syncGuestRoundToDb,
  }
})
