// ── Tournament Store ─────────────────────────────────────────────
// Hardcoded 2025 season data. Emails/names will be filled in when
// Jason provides them. Access is gated by TOURNAMENT_EMAILS whitelist.

// ─── ACCESS CONTROL ─────────────────────────────────────────────
// Replace placeholder emails with real ones when provided.
export const TOURNAMENT_EMAILS = [
  // 'jason@example.com',   ← fill these in
  // 'brian@example.com',
  // 'chris@example.com',
  // 'jeremy@example.com',
  // 'al@example.com',
  // 'marty@example.com',
  // 'wang@example.com',
  // 'matt@example.com',
  '__ALL__',  // ← remove this once real emails are added; allows everyone for now
]

export function hasTournamentAccess(email) {
  if (TOURNAMENT_EMAILS.includes('__ALL__')) return true
  if (!email) return false
  return TOURNAMENT_EMAILS.includes(email.toLowerCase().trim())
}

// ─── TOURNAMENT DEFINITION ──────────────────────────────────────
export const TOURNAMENT = {
  name: '2025 Match Play Championship',
  season: '2025',
  format: 'Round Robin',
  pointsPerMatch: 4,          // 2 best ball + 1 + 1 singles
  bestBallPoints: 2,
  singlesPoints: 1,           // per singles match (2 singles per match)
  finalistsCount: 2,
}

// ─── TEAMS ──────────────────────────────────────────────────────
// id is used everywhere internally. names are display names.
// emails[] maps to GolfWizard roster when available.
export const TEAMS = [
  {
    id: 'BC',
    name: 'Brian & Chris',
    short: 'B+C',
    color: '#60a5fa',          // blue
    colorDim: 'rgba(96,165,250,.15)',
    players: [
      { id: 'brian', name: 'Brian', email: null },
      { id: 'chris', name: 'Chris', email: null },
    ],
  },
  {
    id: 'JA',
    name: 'Jeremy & Al',
    short: 'J+A',
    color: '#f87171',          // red
    colorDim: 'rgba(248,113,113,.15)',
    players: [
      { id: 'jeremy', name: 'Jeremy', email: null },
      { id: 'al',     name: 'Al',     email: null },
    ],
  },
  {
    id: 'MW',
    name: 'Marty & Wang',
    short: 'M+W',
    color: '#34d399',          // emerald
    colorDim: 'rgba(52,211,153,.15)',
    players: [
      { id: 'marty', name: 'Marty', email: null },
      { id: 'wang',  name: 'Wang',  email: null },
    ],
  },
  {
    id: 'MS',
    name: 'Matt & Spieler',
    short: 'M+S',
    color: '#fbbf24',          // gold
    colorDim: 'rgba(251,191,36,.15)',
    players: [
      { id: 'matt',    name: 'Matt',    email: null },
      { id: 'spieler', name: 'Spieler', email: null },
    ],
  },
]

// ─── SCHEDULE ───────────────────────────────────────────────────
// 6 rounds of round-robin. Each round has 2 matches (4 teams → 2 pairs).
// deadline: the LAST date by which the match must be played (not necessarily the actual date).
// singles rotation:
//   Each pair of teams plays twice. In the FIRST match, player[0] faces player[0] and
//   player[1] faces player[1]. In the SECOND (rematch), the singles opponents swap:
//   player[0] faces player[1] and player[1] faces player[0].
//   singlesOrder: 0 = first meeting, 1 = rematch (swapped)
// result fields (filled in when played):
//   bestBall: 't1' | 't2' | 'halved'
//   singles: [{ winner: 't1'|'t2'|'halved' }, { winner: 't1'|'t2'|'halved' }]
//   roundId: links to an existing GolfWizard round
//   playedDate: actual date the match was played (ISO string)

export const SCHEDULE = [
  // ── Round 1 — May 3 ──────────────────────────────────────────
  {
    round: 1,
    deadline: '2025-05-03',
    label: 'Round 1',
    matches: [
      {
        id: 'r1m1',
        team1: 'BC', team2: 'JA',
        singlesOrder: 0,   // 0 = Brian vs Jeremy, Chris vs Al
        result: null,
        roundId: null,
      },
      {
        id: 'r1m2',
        team1: 'MW', team2: 'MS',
        singlesOrder: 0,   // 0 = Marty vs Matt, Wang vs Spieler
        result: null,
        roundId: null,
      },
    ],
  },
  // ── Round 2 — May 31 ─────────────────────────────────────────
  {
    round: 2,
    deadline: '2025-05-31',
    label: 'Round 2',
    matches: [
      {
        id: 'r2m1',
        team1: 'BC', team2: 'MW',
        singlesOrder: 0,
        result: null,
        roundId: null,
      },
      {
        id: 'r2m2',
        team1: 'JA', team2: 'MS',
        singlesOrder: 0,
        result: null,
        roundId: null,
      },
    ],
  },
  // ── Round 3 — June 21 ────────────────────────────────────────
  {
    round: 3,
    deadline: '2025-06-21',
    label: 'Round 3',
    matches: [
      {
        id: 'r3m1',
        team1: 'BC', team2: 'MS',
        singlesOrder: 0,
        result: null,
        roundId: null,
      },
      {
        id: 'r3m2',
        team1: 'JA', team2: 'MW',
        singlesOrder: 0,
        result: null,
        roundId: null,
      },
    ],
  },
  // ── Round 4 — July 19 (rematches — singles opponents swap) ───
  {
    round: 4,
    deadline: '2025-07-19',
    label: 'Round 4',
    matches: [
      {
        id: 'r4m1',
        team1: 'BC', team2: 'JA',
        singlesOrder: 1,   // 1 = Brian vs Al, Chris vs Jeremy
        result: null,
        roundId: null,
      },
      {
        id: 'r4m2',
        team1: 'MW', team2: 'MS',
        singlesOrder: 1,
        result: null,
        roundId: null,
      },
    ],
  },
  // ── Round 5 — Sep 7 ──────────────────────────────────────────
  {
    round: 5,
    deadline: '2025-09-07',
    label: 'Round 5',
    matches: [
      {
        id: 'r5m1',
        team1: 'BC', team2: 'MW',
        singlesOrder: 1,
        result: null,
        roundId: null,
      },
      {
        id: 'r5m2',
        team1: 'JA', team2: 'MS',
        singlesOrder: 1,
        result: null,
        roundId: null,
      },
    ],
  },
  // ── Round 6 — Oct 3 ──────────────────────────────────────────
  {
    round: 6,
    deadline: '2025-10-03',
    label: 'Round 6',
    matches: [
      {
        id: 'r6m1',
        team1: 'BC', team2: 'MS',
        singlesOrder: 1,
        result: null,
        roundId: null,
      },
      {
        id: 'r6m2',
        team1: 'JA', team2: 'MW',
        singlesOrder: 1,
        result: null,
        roundId: null,
      },
    ],
  },
]

// ─── HELPERS ────────────────────────────────────────────────────
export function getTeam(id) {
  return TEAMS.find(t => t.id === id)
}

// Compute points for a single match result
// result: { bestBall: 't1'|'t2'|'halved', singles: [{winner:'t1'|'t2'|'halved'}, {winner:...}] }
// Returns { t1pts, t2pts }
export function matchPoints(result) {
  if (!result) return { t1pts: 0, t2pts: 0 }
  let t1pts = 0, t2pts = 0

  // Best ball (2 pts)
  if (result.bestBall === 't1')     t1pts += 2
  else if (result.bestBall === 't2') t2pts += 2
  else { t1pts += 1; t2pts += 1 }   // halved = 1 each

  // Singles (1 pt each)
  for (const s of (result.singles || [])) {
    if (s.winner === 't1')      t1pts += 1
    else if (s.winner === 't2') t2pts += 1
    else { t1pts += 0.5; t2pts += 0.5 }  // halved
  }

  return { t1pts, t2pts }
}

// Build standings from schedule
export function computeStandings() {
  const standings = {}
  for (const team of TEAMS) {
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

  for (const round of SCHEDULE) {
    for (const match of round.matches) {
      if (!match.result) continue
      const { t1pts, t2pts } = matchPoints(match.result)
      const s1 = standings[match.team1]
      const s2 = standings[match.team2]

      s1.pts += t1pts
      s2.pts += t2pts
      s1.ptsFor += t1pts; s1.ptsAgainst += t2pts
      s2.ptsFor += t2pts; s2.ptsAgainst += t1pts
      s1.matchesPlayed++
      s2.matchesPlayed++

      if (t1pts > t2pts)      { s1.wins++;   s2.losses++ }
      else if (t2pts > t1pts) { s2.wins++;   s1.losses++ }
      else                    { s1.halved++; s2.halved++ }
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    // Tiebreak: point differential
    return (b.ptsFor - b.ptsAgainst) - (a.ptsFor - a.ptsAgainst)
  })
}

// Get all matches for a team
export function teamMatches(teamId) {
  const result = []
  for (const round of SCHEDULE) {
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
  const today = new Date().toISOString().slice(0, 10)
  for (const round of SCHEDULE) {
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
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(iso + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}
