/**
 * tournamentOutcome — single source of truth for the BB/singles match-play
 * derivation that powers BOTH the live banner in ScoringView's
 * `tournamentMatchStatus` computed AND the persisted `tournament_matches.result`
 * payload written from roundsStore.completeRound.
 *
 * Factoring this out avoids the silent drift bug we hit in v3.10.251: live
 * status said "BC 2up", finish saved nothing, standings stayed stale.
 *
 * Result fields:
 *   bestBall          't1' | 't2' | 'halved'
 *   singles           [{ winner }, { winner }]      — canonical persist shape
 *   bbDiff            t1Up - t2Up (signed, for labels)
 *   singlesStandings  [n, n]   — signed per-pair standings (for "X up" labels)
 *   thru              highest hole index with any score (display "thru N")
 *
 * Returns null when context is insufficient (no scores, missing teams).
 */
import { strokesOnHole } from './gameEngine'

export function computeMatchOutcome(ctx, match) {
  const members = ctx?.members || []
  const scores = ctx?.scores || {}
  const si = ctx?.si || []
  const t1 = members.filter(m => m.team === 1)
  const t2 = members.filter(m => m.team === 2)
  if (!t1.length || !t2.length) return null

  let thru = 0
  for (const memberId of Object.keys(scores)) {
    const holes = Object.keys(scores[memberId] || {}).map(Number)
    if (holes.length) thru = Math.max(thru, ...holes)
  }
  if (!thru) return null

  let t1Up = 0, t2Up = 0
  for (let h = 1; h <= thru; h++) {
    const siH = si[h - 1] ?? h
    const t1Nets = t1
      .map(m => { const g = scores[m.id]?.[h]; return g != null ? g - strokesOnHole(m.round_hcp ?? 0, siH) : null })
      .filter(n => n != null)
    const t2Nets = t2
      .map(m => { const g = scores[m.id]?.[h]; return g != null ? g - strokesOnHole(m.round_hcp ?? 0, siH) : null })
      .filter(n => n != null)
    if (!t1Nets.length || !t2Nets.length) continue
    const t1BB = Math.min(...t1Nets), t2BB = Math.min(...t2Nets)
    if (t1BB < t2BB) t1Up++
    else if (t2BB < t1BB) t2Up++
  }
  const bbDiff = t1Up - t2Up
  const bestBall = bbDiff > 0 ? 't1' : bbDiff < 0 ? 't2' : 'halved'

  const order = match?.singlesOrder === 1 ? 1 : 0
  const pairs = order === 1
    ? [{ p1: t1[0], p2: t2[1] }, { p1: t1[1], p2: t2[0] }]
    : [{ p1: t1[0], p2: t2[0] }, { p1: t1[1], p2: t2[1] }]

  const hcpMap = Object.fromEntries(members.map(m => [m.id, m.round_hcp ?? 0]))
  const singles = []
  const singlesStandings = []
  for (const { p1, p2 } of pairs) {
    if (!p1 || !p2) {
      singles.push({ winner: 'halved' })
      singlesStandings.push(0)
      continue
    }
    let standing = 0
    for (let h = 1; h <= thru; h++) {
      const siH = si[h - 1] ?? h
      const g1 = scores[p1.id]?.[h], g2 = scores[p2.id]?.[h]
      if (g1 == null || g2 == null) continue
      const n1 = g1 - strokesOnHole(hcpMap[p1.id] ?? 0, siH)
      const n2 = g2 - strokesOnHole(hcpMap[p2.id] ?? 0, siH)
      if (n1 < n2) standing++
      else if (n2 < n1) standing--
    }
    singles.push({ winner: standing > 0 ? 't1' : standing < 0 ? 't2' : 'halved' })
    singlesStandings.push(standing)
  }

  return { bestBall, singles, bbDiff, singlesStandings, thru }
}
