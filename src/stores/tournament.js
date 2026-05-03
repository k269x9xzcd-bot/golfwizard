// ── Tournament Store ─────────────────────────────────────────────
// v3.9.20 — All data migrated from hardcoded constants to Supabase.
// Named exports (TOURNAMENT, TEAMS, SCHEDULE, etc.) are kept as
// computed getters that proxy store state so TournamentView.vue
// imports continue to work without modification.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { supaCall, supaCallWithRetry } from '../modules/supabaseOps'
import { supaRawRequest } from '../modules/supaRaw'

const TOURNAMENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// ─── PINIA STORE ─────────────────────────────────────────────────
export const useTournamentStore = defineStore('tournament', () => {
  const tournament = ref(null)     // row from `tournaments`
  const members = ref([])          // rows from `tournament_members`
  const teams = ref([])            // assembled team objects
  const schedule = ref([])         // assembled schedule (rounds with nested matches)
  const loaded = ref(false)
  const loading = ref(false)
  const initError = ref('')

  // ── init: fetch all tournament data from Supabase ──────────────
  async function init() {
    // Skip if already successfully loaded or currently in-flight
    if (loaded.value) return
    if (loading.value) return
    loading.value = true
    initError.value = ''
    try {
      // All fetches use supaRawRequest — proven reliable on iOS PWA (fresh HTTP connection,
      // not subject to WKWebView HTTP/2 pool stalls that kill supabase-js calls).

      // 1. Tournament meta
      const tRows = await supaRawRequest('GET', `tournaments?id=eq.${TOURNAMENT_ID}&select=*`, null, 6000)
      const tRow = Array.isArray(tRows) ? tRows[0] : null
      if (tRow) tournament.value = tRow

      // 2. Members
      const mRows = await supaRawRequest('GET', `tournament_members?tournament_id=eq.${TOURNAMENT_ID}&select=*`, null, 6000)
      members.value = Array.isArray(mRows) ? mRows : []

      // 3. Teams
      const rawTeams = await supaRawRequest('GET', `tournament_teams?tournament_id=eq.${TOURNAMENT_ID}&select=*&order=sort_order.asc`, null, 6000)

      // 4. Players (all teams in one query)
      const teamIds = (Array.isArray(rawTeams) ? rawTeams : []).map(t => t.id)
      let rawPlayers = []
      if (teamIds.length) {
        rawPlayers = await supaRawRequest('GET', `tournament_team_players?team_id=in.(${teamIds.join(',')})&select=*&order=sort_order.asc`, null, 6000)
        if (!Array.isArray(rawPlayers)) rawPlayers = []
      }

      teams.value = (Array.isArray(rawTeams) ? rawTeams : []).map(t => ({
        id: t.team_key,
        name: t.name,
        short: t.short ?? t.name,
        color: t.color ?? '#888',
        colorDim: t.color_dim ?? 'rgba(136,136,136,.15)',
        players: rawPlayers
          .filter(p => p.team_id === t.id)
          .map(p => ({
            id: p.player_key,
            name: p.name,
            nickname: p.nickname ?? p.name,
            email: p.email ?? null,
            ghinIndex: p.ghin_index ?? null,
          })),
        _dbId: t.id,
      }))

      // Refresh handicaps with live values from roster_players
      await _refreshHandicapsFromRoster()

      // 5. Schedule
      const rawRounds = await supaRawRequest('GET', `tournament_schedule?tournament_id=eq.${TOURNAMENT_ID}&select=*&order=sort_order.asc`, null, 6000)

      // 6. Matches
      const rawMatches = await supaRawRequest('GET', `tournament_matches?tournament_id=eq.${TOURNAMENT_ID}&select=*`, null, 6000)

      schedule.value = (Array.isArray(rawRounds) ? rawRounds : []).map(r => ({
        round: r.round_num,
        deadline: r.deadline,
        label: r.label ?? `Round ${r.round_num}`,
        matches: (Array.isArray(rawMatches) ? rawMatches : [])
          .filter(m => m.schedule_id === r.id)
          .map(m => ({
            id: m.match_key,
            team1: m.team1_key,
            team2: m.team2_key,
            singlesOrder: m.singles_order ?? 0,
            result: m.result ?? null,
            roundId: m.round_id ?? null,
            _dbId: m.id,
          })),
      }))

      loaded.value = true
    } catch (e) {
      console.warn('[tournament.init] error:', e?.message, e?.status, e?.detail)
      // Store error for UI display
      initError.value = e?.message || 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  // ── refreshHandicaps: pull live ghin_index from roster for all tournament players ──
  // Called automatically in init() and can be called explicitly after a GHIN sync.
  async function _refreshHandicapsFromRoster() {
    const allEmails = teams.value.flatMap(t => t.players.map(p => p.email).filter(Boolean))
    if (!allEmails.length) return
    try {
      // Query roster_players for all player emails. The roster_select_by_email RLS policy
      // allows cross-owner lookup so we see each player's own authoritative row.
      // Order by ghin_synced_at descending so the most recently synced value wins.
      const emailList = allEmails.map(e => encodeURIComponent(e.toLowerCase())).join(',')
      const liveRows = await supaRawRequest(
        'GET',
        `roster_players?email=in.(${emailList})&select=email,ghin_index,ghin_synced_at&order=ghin_synced_at.desc.nullslast`,
        null,
        5000,
      )
      if (!Array.isArray(liveRows) || !liveRows.length) return

      // Keep the most recently synced row per email
      const liveByEmail = {}
      for (const row of liveRows) {
        const key = row.email?.toLowerCase()
        if (key && !liveByEmail[key] && row.ghin_index != null) {
          liveByEmail[key] = row.ghin_index
        }
      }

      // Update teams in place
      teams.value = teams.value.map(t => ({
        ...t,
        players: t.players.map(p => {
          const live = p.email ? liveByEmail[p.email.toLowerCase()] : undefined
          return live != null ? { ...p, ghinIndex: live } : p
        }),
      }))
    } catch (e) {
      console.warn('[tournament] live HCP refresh failed:', e?.message)
    }
  }

  // Public wrapper — call after a GHIN bulk sync to pick up new indices without
  // reloading the entire tournament. Resets `loaded` so a full init also re-runs HCPs.
  async function refreshHandicaps() {
    await _refreshHandicapsFromRoster()
  }

  // ── hasTournamentAccess (async — checks Supabase) ──────────────
  async function hasTournamentAccessAsync(email) {
    if (!email) return false
    const norm = email.toLowerCase().trim()
    // Check cached members first
    if (members.value.length > 0) {
      return members.value.some(m => m.email?.toLowerCase().trim() === norm)
    }
    // Fallback: direct query
    try {
      const res = await supaCall(
        'tournament.accessCheck',
        supabase
          .from('tournament_members')
          .select('email')
          .eq('tournament_id', TOURNAMENT_ID)
          .eq('email', norm)
          .limit(1),
        5000,
      )
      return !res.error && (res.data?.length ?? 0) > 0
    } catch {
      return false
    }
  }

  // ── saveTeamPlayers: delete+insert for a team ──────────────────
  async function saveTeamPlayers(teamKey, players) {
    // teamKey is the internal key (BC, JA etc.) — find the UUID _dbId for the DB operation
    const teamRow = teams.value.find(t => t.id === teamKey)
    const teamDbId = teamRow?._dbId
    if (!teamDbId) { console.warn('[tournament] saveTeamPlayers: unknown teamKey', teamKey); return }

    // Delete existing players for this team (team_id is FK to tournament_teams.id UUID)
    await supaCallWithRetry(
      'tournament.deleteTeamPlayers',
      () => supabase.from('tournament_team_players').delete().eq('team_id', teamDbId),
      8000,
    )
    // Insert new players using correct column names
    if (players && players.length > 0) {
      const rows = players.map((p, i) => ({
        team_id: teamDbId,           // UUID FK to tournament_teams.id
        player_key: p.id,            // internal key (brian, chris, etc.)
        name: p.name,
        nickname: p.nickname ?? p.name,
        email: p.email ?? null,
        ghin_index: p.ghinIndex ?? null,
        sort_order: i,
      }))
      await supaCallWithRetry(
        'tournament.insertTeamPlayers',
        () => supabase.from('tournament_team_players').insert(rows),
        8000,
      )
    }
    // Update local state
    const idx = teams.value.findIndex(t => t.id === teamKey)
    if (idx >= 0) {
      teams.value[idx] = {
        ...teams.value[idx],
        players: players.map(p => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname ?? p.name,
          email: p.email ?? null,
          ghinIndex: p.ghinIndex ?? null,
        })),
      }
    }
  }

  // ── linkRoundToMatch: write round_id back to tournament_matches ──
  async function linkRoundToMatch(matchDbId, roundId) {
    if (!matchDbId || !roundId) return
    await supaCallWithRetry(
      'tournament.linkRound',
      () => supabase.from('tournament_matches').update({ round_id: roundId }).eq('id', matchDbId),
      8000,
    )
    // Patch local schedule so roundId reflects immediately
    const sch = schedule.value
    if (sch) {
      for (const round of sch) {
        for (const m of (round.matches || [])) {
          if (m._dbId === matchDbId) { m.roundId = roundId; break }
        }
      }
    }
  }

  // ── saveMatchResult: write result JSON to tournament_matches ──────
  async function saveMatchResult(matchDbId, result) {
    if (!matchDbId) return
    await supaCallWithRetry(
      'tournament.saveResult',
      () => supabase.from('tournament_matches').update({ result }).eq('id', matchDbId),
      8000,
    )
  }

  // ── updateTournamentMeta: update name/format in Supabase ───────
  async function updateTournamentMeta(updates) {
    const { data, error } = await supaCallWithRetry(
      'tournament.updateMeta',
      () =>
        supabase
          .from('tournaments')
          .update(updates)
          .eq('id', TOURNAMENT_ID)
          .select()
          .single(),
      8000,
    )
    if (!error && data) {
      tournament.value = { ...tournament.value, ...data }
    }
    return { data, error }
  }

  return {
    tournament,
    members,
    teams,
    schedule,
    loaded,
    loading,
    initError,
    init,
    refreshHandicaps,
    hasTournamentAccessAsync,
    saveTeamPlayers,
    updateTournamentMeta,
    linkRoundToMatch,
    saveMatchResult,
  }
})

// ─── NAMED EXPORT PROXIES ─────────────────────────────────────────
// These thin wrappers expose the same API that TournamentView.vue
// currently imports, so no changes are needed in that file.

function _getStore() {
  // Lazy-get the store. Works both during setup and after.
  // Pinia must be active before this is called (it is — called from
  // computed getters / functions that run inside Vue components).
  return useTournamentStore()
}

// TOURNAMENT — proxy object (reactive via store)
export const TOURNAMENT = new Proxy({}, {
  get(_target, prop) {
    const store = _getStore()
    const t = store.tournament
    if (!t) {
      // Fallback defaults while loading
      const defaults = {
        name: 'Loading…',
        season: '',
        format: '',
        pointsPerMatch: 4,
        bestBallPoints: 2,
        singlesPoints: 1,
        finalistsCount: 2,
      }
      return defaults[prop]
    }
    // Map Supabase column names → expected property names
    const map = {
      name: t.name,
      season: t.season,
      format: t.format,
      pointsPerMatch: t.points_per_match ?? 4,
      bestBallPoints: t.best_ball_points ?? 2,
      singlesPoints: t.singles_points ?? 1,
      finalistsCount: t.finalists_count ?? 2,
    }
    return prop in map ? map[prop] : t[prop]
  },
})

// TEAMS — returns current teams array from store
Object.defineProperty(TOURNAMENT, '__isProxy', { value: true })

// TEAMS getter (array-like export — TournamentView.vue uses `v-for="team in TEAMS"`)
// We export a reactive computed-like array by using a Proxy over an empty array
// that reads from the store on every access.
export const TEAMS = new Proxy([], {
  get(target, prop) {
    const store = _getStore()
    const arr = store.teams
    if (prop === 'length') return arr.length
    if (prop === Symbol.iterator) return arr[Symbol.iterator].bind(arr)
    if (prop === 'find') return arr.find.bind(arr)
    if (prop === 'map') return arr.map.bind(arr)
    if (prop === 'filter') return arr.filter.bind(arr)
    if (prop === 'forEach') return arr.forEach.bind(arr)
    if (prop === 'some') return arr.some.bind(arr)
    if (prop === 'every') return arr.every.bind(arr)
    if (prop === 'reduce') return arr.reduce.bind(arr)
    if (prop === 'slice') return arr.slice.bind(arr)
    if (typeof prop === 'string' && !isNaN(Number(prop))) return arr[Number(prop)]
    return arr[prop]
  },
})

// SCHEDULE getter
export const SCHEDULE = new Proxy([], {
  get(target, prop) {
    const store = _getStore()
    const arr = store.schedule
    if (prop === 'length') return arr.length
    if (prop === Symbol.iterator) return arr[Symbol.iterator].bind(arr)
    if (prop === 'find') return arr.find.bind(arr)
    if (prop === 'map') return arr.map.bind(arr)
    if (prop === 'filter') return arr.filter.bind(arr)
    if (prop === 'forEach') return arr.forEach.bind(arr)
    if (prop === 'some') return arr.some.bind(arr)
    if (prop === 'every') return arr.every.bind(arr)
    if (prop === 'reduce') return arr.reduce.bind(arr)
    if (prop === 'slice') return arr.slice.bind(arr)
    if (typeof prop === 'string' && !isNaN(Number(prop))) return arr[Number(prop)]
    return arr[prop]
  },
})

// ─── ACCESS CONTROL ──────────────────────────────────────────────
// Cached sync check (works after init() has run and populated members).
// Async version is on the store itself.
export function hasTournamentAccess(email) {
  if (!email) return false
  const norm = email.toLowerCase().trim()
  try {
    const store = _getStore()
    if (store.members.length > 0) {
      return store.members.some(m => m.email?.toLowerCase().trim() === norm)
    }
  } catch {}
  return false
}

// ─── HELPERS ─────────────────────────────────────────────────────
export function getTeam(id) {
  const store = _getStore()
  return store.teams.find(t => t.id === id) ?? null
}

export function getAllTeams() {
  const store = _getStore()
  return store.teams
}

// Compute points for a single match result
// result: { bestBall: 't1'|'t2'|'halved', singles: [{winner:'t1'|'t2'|'halved'}, {winner:...}] }
// Returns { t1pts, t2pts }
export function matchPoints(result) {
  if (!result) return { t1pts: 0, t2pts: 0 }
  let t1pts = 0, t2pts = 0

  // Best ball (2 pts)
  if (result.bestBall === 't1')      t1pts += 2
  else if (result.bestBall === 't2') t2pts += 2
  else { t1pts += 1; t2pts += 1 }   // halved = 1 each

  // Singles (1 pt each)
  for (const s of (result.singles || [])) {
    if (s.winner === 't1')       t1pts += 1
    else if (s.winner === 't2')  t2pts += 1
    else { t1pts += 0.5; t2pts += 0.5 }  // halved
  }

  return { t1pts, t2pts }
}

// Build standings from schedule
export function computeStandings() {
  const store = _getStore()
  const teamsArr = store.teams
  const scheduleArr = store.schedule
  const standings = {}

  for (const team of teamsArr) {
    standings[team.id] = {
      team,
      pts: 0,
      wins: 0,
      losses: 0,
      halved: 0,
      matchesPlayed: 0,
      ptsFor: 0,
      ptsAgainst: 0,
    }
  }

  for (const round of scheduleArr) {
    for (const match of round.matches) {
      if (!match.result) continue
      const { t1pts, t2pts } = matchPoints(match.result)
      const s1 = standings[match.team1]
      const s2 = standings[match.team2]
      if (!s1 || !s2) continue

      s1.pts += t1pts
      s2.pts += t2pts
      s1.ptsFor += t1pts; s1.ptsAgainst += t2pts
      s2.ptsFor += t2pts; s2.ptsAgainst += t1pts
      s1.matchesPlayed++
      s2.matchesPlayed++

      if (t1pts > t2pts)       { s1.wins++;   s2.losses++ }
      else if (t2pts > t1pts)  { s2.wins++;   s1.losses++ }
      else                     { s1.halved++; s2.halved++ }
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    return (b.ptsFor - b.ptsAgainst) - (a.ptsFor - a.ptsAgainst)
  })
}

// Get all matches for a team
export function teamMatches(teamId) {
  const store = _getStore()
  const result = []
  for (const round of store.schedule) {
    for (const match of round.matches) {
      if (match.team1 === teamId || match.team2 === teamId) {
        result.push({ round, match })
      }
    }
  }
  return result
}

// Get next upcoming match
export function nextMatch() {
  const store = _getStore()
  const today = new Date().toISOString().slice(0, 10)
  for (const round of store.schedule) {
    for (const match of round.matches) {
      if (!match.result && round.deadline >= today) return { round, match }
    }
  }
  return null
}

// Format date nicely
export function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
}

// Days until a date
export function daysUntil(iso) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

// saveTeamPlayers — thin wrapper that delegates to the store
export async function saveTeamPlayers(teamId, players) {
  const store = _getStore()
  return store.saveTeamPlayers(teamId, players)
}

// clearTeamOverride — no-op in Supabase world (kept for API compat)
export function clearTeamOverride(_teamId) {
  // Players are now managed exclusively in Supabase; no local override to clear.
  console.warn('[tournament] clearTeamOverride is a no-op (data now in Supabase)')
}
