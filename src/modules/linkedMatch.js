/**
 * linkedMatch.js — Compute the cross-foursome best-ball result.
 *
 * Inputs:
 *   roundA, roundB — round objects shaped { course_snapshot | course_name, round_members, scores, holes_mode }
 *   config — { ballsToCount: 1 | 2, stake: number }
 *
 * Output: {
 *   perHole: [{ hole, par, a: {scores, counted, sum, vsPar}, b: {...}, diff }],
 *   teamA: { vsPar, holesFullyScored, name },
 *   teamB: { vsPar, holesFullyScored, name },
 *   allHolesComplete: boolean,
 *   currentLeader: 'A' | 'B' | null,   // null while tied
 *   delta: number,                     // teamA.vsPar - teamB.vsPar; negative = A ahead
 *   settlement: {
 *     stakePerPlayer, winner: 'A'|'B'|null, payoutsFromB: number, payoutsFromA: number
 *   } | null
 * }
 */
import { COURSES as BUILTIN_COURSES } from './courses.js'

/**
 * Resolve course par array for a round. Prefers the frozen course_snapshot,
 * falls back to the built-in library. Does NOT touch custom courses; the
 * cross-match uses what was frozen at round creation so edits don't retroactively
 * move the match result.
 */
function parArrayFor(round) {
  const snap = round?.course_snapshot
  if (snap && Array.isArray(snap.par) && snap.par.length >= 18) {
    return snap.par.slice(0, 18)
  }
  const live = round?.course_name ? BUILTIN_COURSES[round.course_name] : null
  if (live && Array.isArray(live.par)) return live.par.slice(0, 18)
  // Last resort: par 4 everywhere
  return Array(18).fill(4)
}

/**
 * Build a {memberId: {hole: score}} map from a flat scores array.
 */
function scoresByMember(round) {
  const map = {}
  for (const s of (round?.scores || [])) {
    const val = s.score ?? s.strokes
    if (val == null) continue
    if (!map[s.member_id]) map[s.member_id] = {}
    map[s.member_id][s.hole] = val
  }
  return map
}

/**
 * Strokes that member m gets on hole h given the round's handicap mode.
 * We use the classic "low-man net" style: compute every member's strokes
 * relative to the field's lowest index, then apply SI.
 *
 * For the cross-match we treat each foursome independently: strokes are
 * computed WITHIN each foursome, not across the 8 players. This matches
 * how real-world best-ball handicaps work when two different handicap
 * distributions face each other — each side plays its own low-man.
 */
function strokesOnHole(member, hole, par, siArray, fieldLowIndex) {
  const index = member?.ghin_index ?? member?.round_hcp ?? null
  if (index == null || fieldLowIndex == null) return 0
  // Course handicap approximation: round(index - lowIndex). Positive = strokes given.
  const strokesOverField = Math.round(index - fieldLowIndex)
  if (strokesOverField <= 0) return 0
  const si = siArray?.[hole - 1] ?? 18
  // One stroke on every hole with SI <= strokesOverField; extra strokes wrap around
  let strokes = 0
  if (strokesOverField >= si) strokes += 1
  if (strokesOverField >= 18 + si) strokes += 1
  return strokes
}

function fieldLowIndex(members) {
  const indices = (members || [])
    .map(m => m?.ghin_index ?? m?.round_hcp)
    .filter(v => v != null)
  if (!indices.length) return 0
  return Math.min(...indices)
}

function siArrayFor(round) {
  const snap = round?.course_snapshot
  if (snap && Array.isArray(snap.si) && snap.si.length >= 18) {
    return snap.si.slice(0, 18)
  }
  const live = round?.course_name ? BUILTIN_COURSES[round.course_name] : null
  if (live && Array.isArray(live.si)) return live.si.slice(0, 18)
  return Array.from({ length: 18 }, (_, i) => i + 1)
}

function netScoreOnHole(member, hole, gross, siArray, lowIndex) {
  const par = 0 // not used inside strokesOnHole here
  const strokes = strokesOnHole(member, hole, par, siArray, lowIndex)
  return gross - strokes
}

/**
 * Compute team score on one hole:
 * - Gather all N members' net scores for the hole
 * - Filter out unscored members
 * - Sort ascending, take the lowest K (ballsToCount)
 * - If fewer than K scored, the hole is not fully-scored for this team — return null
 */
function teamHoleScore(members, hole, scoreMap, siArray, lowIndex, ballsToCount) {
  const nets = []
  for (const m of members) {
    const gross = scoreMap[m.id]?.[hole]
    if (gross == null) continue
    nets.push(netScoreOnHole(m, hole, gross, siArray, lowIndex))
  }
  if (nets.length < ballsToCount) return null
  nets.sort((a, b) => a - b)
  const counted = nets.slice(0, ballsToCount)
  return {
    nets,               // all net scores for this hole
    counted,            // the ones that count toward team total
    sum: counted.reduce((s, n) => s + n, 0),
  }
}

export function computeLinkedMatch(roundA, roundB, config) {
  const { ballsToCount = 1, stake = 20 } = config || {}

  // Par basis uses roundA's snapshot (linked-match invariant: same course, same tees).
  // If roundB exists and somehow has a different par, we still use A's par as the basis —
  // this is the "one truth" for the match, and the data model enforces same course.
  const parA = parArrayFor(roundA)
  const parB = roundB ? parArrayFor(roundB) : parA

  const siA = siArrayFor(roundA)
  const siB = roundB ? siArrayFor(roundB) : siA

  const membersA = roundA?.round_members || []
  const membersB = roundB?.round_members || []
  const scoresA = scoresByMember(roundA)
  const scoresB = roundB ? scoresByMember(roundB) : {}

  const lowA = fieldLowIndex(membersA)
  const lowB = fieldLowIndex(membersB)

  // Only holes 1..18 for MVP (holes_mode tweaks could come later)
  const perHole = []
  let teamAvsPar = 0
  let teamBvsPar = 0
  let holesFullyScoredA = 0
  let holesFullyScoredB = 0
  let holesBoth = 0

  for (let h = 1; h <= 18; h++) {
    const parHoleA = parA[h - 1] ?? 4
    const parHoleB = parB[h - 1] ?? parHoleA
    const parBasisA = parHoleA * ballsToCount
    const parBasisB = parHoleB * ballsToCount

    const resA = teamHoleScore(membersA, h, scoresA, siA, lowA, ballsToCount)
    const resB = roundB ? teamHoleScore(membersB, h, scoresB, siB, lowB, ballsToCount) : null

    const aVs = resA ? resA.sum - parBasisA : null
    const bVs = resB ? resB.sum - parBasisB : null

    if (aVs != null) { teamAvsPar += aVs; holesFullyScoredA++ }
    if (bVs != null) { teamBvsPar += bVs; holesFullyScoredB++ }
    if (aVs != null && bVs != null) holesBoth++

    perHole.push({
      hole: h,
      par: parHoleA,              // use A's par for display (must match B by invariant)
      a: resA ? { ...resA, vsPar: aVs } : null,
      b: resB ? { ...resB, vsPar: bVs } : null,
      // diff is only meaningful if both sides have a fully-scored hole
      diff: (aVs != null && bVs != null) ? (aVs - bVs) : null,
    })
  }

  const allHolesComplete = holesFullyScoredA === 18 && holesFullyScoredB === 18

  const delta = teamAvsPar - teamBvsPar // negative = A is lower (winning)
  const currentLeader = holesBoth === 0 ? null : (delta < 0 ? 'A' : delta > 0 ? 'B' : null)

  // Settlement — only final when both rounds fully scored
  let settlement = null
  if (allHolesComplete) {
    const winner = delta < 0 ? 'A' : delta > 0 ? 'B' : null
    settlement = {
      stakePerPlayer: stake,
      winner,
      // If A wins: each B player pays stake, each A player receives stake.
      // If tied: no money moves.
      payoutsFromA: winner === 'B' ? stake : 0,    // each A player owes this to their counterpart
      payoutsFromB: winner === 'A' ? stake : 0,    // each B player owes this to their counterpart
    }
  }

  const nameA = deriveTeamName(membersA) || 'Foursome A'
  const nameB = deriveTeamName(membersB) || 'Foursome B'

  return {
    perHole,
    teamA: { vsPar: teamAvsPar, holesFullyScored: holesFullyScoredA, name: nameA },
    teamB: { vsPar: teamBvsPar, holesFullyScored: holesFullyScoredB, name: nameB },
    allHolesComplete,
    holesBoth,
    currentLeader,
    delta,
    settlement,
    ballsToCount,
  }
}

function deriveTeamName(members) {
  if (!members?.length) return null
  const initials = members
    .map(m => {
      const full = m.guest_name || m.name || m.short_name || ''
      const parts = full.trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0]?.slice(0, 2) || '?').toUpperCase()
    })
  return initials.join('+')
}

/**
 * Format the cross-match status for the banner.
 * States: 'pending' (no link yet) | 'waiting' (linked but no fully-scored holes yet)
 *       | 'live' (in progress, at least 1 hole scored by both)
 *       | 'final' (both rounds complete)
 */
export function summarizeLinkedMatch(linkedMatch, roundA, roundB, result) {
  if (!linkedMatch) return { state: 'pending', label: 'No linked match' }
  if (linkedMatch.status === 'cancelled') return { state: 'cancelled', label: 'Match cancelled' }

  if (!roundB || linkedMatch.status === 'pending') {
    return {
      state: 'pending',
      label: `⛳ Waiting for Foursome B · code ${linkedMatch.invite_code}`,
    }
  }

  if (!result || result.holesBoth === 0) {
    return { state: 'waiting', label: '⛳ 4v4 linked · waiting for both foursomes to score hole 1' }
  }

  if (result.allHolesComplete && result.settlement) {
    const s = result.settlement
    if (!s.winner) {
      return { state: 'final', label: `🏆 4v4 final · tied · no payout`, tone: 'tie' }
    }
    const winnerName = s.winner === 'A' ? result.teamA.name : result.teamB.name
    const deltaStrokes = Math.abs(result.delta)
    return {
      state: 'final',
      label: `🏆 4v4 final · ${winnerName} wins by ${deltaStrokes} · $${s.stakePerPlayer}/player`,
      tone: 'win',
    }
  }

  // Live
  const leaderName = result.currentLeader === 'A' ? result.teamA.name : result.currentLeader === 'B' ? result.teamB.name : null
  const deltaStrokes = Math.abs(result.delta)
  if (leaderName) {
    return {
      state: 'live',
      label: `🎮 4v4 · ${leaderName} leads by ${deltaStrokes} thru ${result.holesBoth}`,
      tone: 'live',
    }
  }
  return {
    state: 'live',
    label: `🎮 4v4 · AS thru ${result.holesBoth}`,
    tone: 'live',
  }
}
