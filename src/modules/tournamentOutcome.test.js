/**
 * tournamentOutcome.test.js — verifies the computeMatchOutcome helper that
 * BOTH the live tournament banner (ScoringView) and the persisted result
 * (roundsStore.completeRound → tournament_matches.result) call into.
 *
 * If these break, the schedule card state derivation in TournamentView.vue
 * also breaks (state 'final' depends on `match.result` being populated).
 */
import { describe, it, expect } from 'vitest'
import { computeMatchOutcome } from './tournamentOutcome.js'

const SI = Array.from({ length: 18 }, (_, i) => i + 1)

function members() {
  return [
    { id: 't1p1', team: 1, round_hcp: 0, short_name: 'A' },
    { id: 't1p2', team: 1, round_hcp: 0, short_name: 'B' },
    { id: 't2p1', team: 2, round_hcp: 0, short_name: 'C' },
    { id: 't2p2', team: 2, round_hcp: 0, short_name: 'D' },
  ]
}
function emptyScores() {
  return { t1p1: {}, t1p2: {}, t2p1: {}, t2p2: {} }
}

describe('computeMatchOutcome', () => {
  it('returns null with no scores', () => {
    expect(computeMatchOutcome({ members: members(), scores: emptyScores(), si: SI }, {})).toBeNull()
  })

  it('returns null when a team has no members', () => {
    const m = members().filter(x => x.team === 1)
    const s = { t1p1: { 1: 4 }, t1p2: { 1: 4 } }
    expect(computeMatchOutcome({ members: m, scores: s, si: SI }, {})).toBeNull()
  })

  it('persisted shape — all halved', () => {
    const scores = emptyScores()
    for (let h = 1; h <= 18; h++) {
      scores.t1p1[h] = 4; scores.t1p2[h] = 4
      scores.t2p1[h] = 4; scores.t2p2[h] = 4
    }
    const out = computeMatchOutcome({ members: members(), scores, si: SI }, { singlesOrder: 0 })
    expect(out.bestBall).toBe('halved')
    expect(out.singles).toEqual([{ winner: 'halved' }, { winner: 'halved' }])
    expect(out.bbDiff).toBe(0)
    expect(out.singlesStandings).toEqual([0, 0])
    expect(out.thru).toBe(18)
  })

  it('t1 sweeps every hole — BB t1, both singles t1', () => {
    const scores = emptyScores()
    for (let h = 1; h <= 18; h++) {
      scores.t1p1[h] = 4; scores.t1p2[h] = 4
      scores.t2p1[h] = 5; scores.t2p2[h] = 5
    }
    const out = computeMatchOutcome({ members: members(), scores, si: SI }, { singlesOrder: 0 })
    expect(out.bestBall).toBe('t1')
    expect(out.singles).toEqual([{ winner: 't1' }, { winner: 't1' }])
    expect(out.bbDiff).toBe(18)
    expect(out.singlesStandings).toEqual([18, 18])
  })

  it('mixed result — t2 BB, split singles, with singlesOrder=1 swap', () => {
    // Team 2 plays a hair better overall (BB to t2). On singles:
    // - p1p1 vs p2p2 (swapped) — Alice 4 every hole, Dave 5 → t1 wins single 1
    // - p1p2 vs p2p1 (swapped) — Bob 5 every hole, Carol 4 → t2 wins single 2
    const scores = emptyScores()
    for (let h = 1; h <= 18; h++) {
      scores.t1p1[h] = 4; scores.t1p2[h] = 5
      scores.t2p1[h] = 4; scores.t2p2[h] = 5
    }
    // t1 best ball each hole = 4 (Alice). t2 best ball = 4 (Carol). All halved → BB halved.
    const out = computeMatchOutcome({ members: members(), scores, si: SI }, { singlesOrder: 1 })
    expect(out.bestBall).toBe('halved')
    // Swapped singles: pair0 = Alice(t1) vs Dave(t2) → Alice wins (4 < 5) every hole
    //                  pair1 = Bob(t1)   vs Carol(t2) → Carol wins (4 < 5) every hole
    expect(out.singles).toEqual([{ winner: 't1' }, { winner: 't2' }])
    expect(out.singlesStandings).toEqual([18, -18])
  })

  it('partial round — thru reflects highest scored hole', () => {
    const scores = emptyScores()
    for (let h = 1; h <= 9; h++) {
      scores.t1p1[h] = 4; scores.t1p2[h] = 4
      scores.t2p1[h] = 5; scores.t2p2[h] = 5
    }
    const out = computeMatchOutcome({ members: members(), scores, si: SI }, {})
    expect(out.thru).toBe(9)
    expect(out.bestBall).toBe('t1')
    expect(out.bbDiff).toBe(9)
  })

  it('honors stroke index — handicap strokes flip a hole outcome', () => {
    // t2p1 has a 1 hcp → gets a stroke on SI=1 (hole 1). Net 4 vs t1 net 4 → halved.
    // Without stroke t2 would lose that hole (5 gross vs 4).
    const m = members()
    const t2p1 = m.find(x => x.id === 't2p1')
    t2p1.round_hcp = 1
    const scores = emptyScores()
    scores.t1p1[1] = 4; scores.t1p2[1] = 4
    scores.t2p1[1] = 5; scores.t2p2[1] = 5
    const out = computeMatchOutcome({ members: m, scores, si: SI }, {})
    // Hole 1: t1 BB net = 4, t2 BB net = min(5-1, 5) = 4 → halved → bbDiff=0
    expect(out.bbDiff).toBe(0)
    // Singles: pair0 = t1p1 vs t2p1 → 4 vs 4 (with stroke) → halved
    expect(out.singlesStandings[0]).toBe(0)
    // pair1 = t1p2 vs t2p2 → 4 vs 5, no stroke → t1 1 up
    expect(out.singlesStandings[1]).toBe(1)
  })

  it('canonical persisted shape can be sliced from result', () => {
    const scores = emptyScores()
    for (let h = 1; h <= 18; h++) {
      scores.t1p1[h] = 4; scores.t1p2[h] = 4
      scores.t2p1[h] = 5; scores.t2p2[h] = 5
    }
    const out = computeMatchOutcome({ members: members(), scores, si: SI }, { singlesOrder: 0 })
    const persistPayload = { bestBall: out.bestBall, singles: out.singles, playedDate: '2026-05-04' }
    expect(persistPayload).toEqual({
      bestBall: 't1',
      singles: [{ winner: 't1' }, { winner: 't1' }],
      playedDate: '2026-05-04',
    })
  })
})
