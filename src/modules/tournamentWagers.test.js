/**
 * tournamentWagers.test.js — Wager-shape normalization + end-to-end settlement
 * for the three-flat-dollar wager model (v3.10.246+).
 *
 * Each component (Team BB, 1v1 Match 1, 1v1 Match 2) is a standalone bet:
 *   - Winner takes the full $ from the loser(s)
 *   - Tie on a component → $0 exchanged for that component
 *   - All components tied → no settlement entries
 */

import { describe, it, expect } from 'vitest'
import { normalizeWagers, hasAnyWager, buildTournamentWagerGames } from './tournamentWagers.js'
import { computeAllSettlements } from './settlements.js'

function makeCourse(holes = 18) {
  return {
    par: Array.from({ length: holes }, () => 4),
    si: Array.from({ length: holes }, (_, i) => i + 1),
    teesData: {},
    name: 'Test Course',
  }
}

function makeMember(id, name, team) {
  return { id, short_name: name, round_hcp: 0, ghin_index: 0, team }
}

function fourPlayerTournCtx(scores) {
  return {
    course: makeCourse(),
    tee: 'white',
    holesMode: '18',
    members: [
      makeMember('t1p1', 'Alice', 1),
      makeMember('t1p2', 'Bob', 1),
      makeMember('t2p1', 'Carol', 2),
      makeMember('t2p2', 'Dave', 2),
    ],
    scores,
  }
}

// All-pars from t1, all-bogeys from t2 → t1 wins every hole on every component
function t1SweepScores() {
  const s = { t1p1: {}, t1p2: {}, t2p1: {}, t2p2: {} }
  for (let h = 1; h <= 18; h++) {
    s.t1p1[h] = 4; s.t1p2[h] = 4
    s.t2p1[h] = 5; s.t2p2[h] = 5
  }
  return s
}

// All players make par on every hole → every component ties
function allTiedScores() {
  const s = { t1p1: {}, t1p2: {}, t2p1: {}, t2p2: {} }
  for (let h = 1; h <= 18; h++) {
    s.t1p1[h] = 4; s.t1p2[h] = 4; s.t2p1[h] = 4; s.t2p2[h] = 4
  }
  return s
}

const SINGLES = [
  { p1Id: 't1p1', p2Id: 't2p1' },
  { p1Id: 't1p2', p2Id: 't2p2' },
]
const T1 = ['t1p1', 't1p2']
const T2 = ['t2p1', 't2p2']

describe('normalizeWagers', () => {
  it('returns zeros for null / undefined', () => {
    expect(normalizeWagers(null)).toEqual({ bb: 0, s1: 0, s2: 0 })
    expect(normalizeWagers(undefined)).toEqual({ bb: 0, s1: 0, s2: 0 })
  })

  it('coerces and clamps the new shape', () => {
    expect(normalizeWagers({ bb: 10, s1: 5, s2: 5 })).toEqual({ bb: 10, s1: 5, s2: 5 })
    expect(normalizeWagers({ bb: '20', s1: '0', s2: 7 })).toEqual({ bb: 20, s1: 0, s2: 7 })
  })

  it('treats negative or non-numeric values as 0', () => {
    expect(normalizeWagers({ bb: -5, s1: 'x', s2: NaN })).toEqual({ bb: 0, s1: 0, s2: 0 })
  })

  it('legacy { pricePerPoint } shape parses to all zeros (no surprise bets carried forward)', () => {
    expect(normalizeWagers({ pricePerPoint: 3 })).toEqual({ bb: 0, s1: 0, s2: 0 })
  })

  it('hasAnyWager reflects any non-zero component', () => {
    expect(hasAnyWager(null)).toBe(false)
    expect(hasAnyWager({ bb: 0, s1: 0, s2: 0 })).toBe(false)
    expect(hasAnyWager({ pricePerPoint: 5 })).toBe(false)  // legacy → zeros → false
    expect(hasAnyWager({ bb: 10, s1: 0, s2: 0 })).toBe(true)
  })
})

describe('buildTournamentWagerGames', () => {
  it('returns [] when no team ids are provided', () => {
    expect(buildTournamentWagerGames({ wagers: { bb: 10 }, t1Ids: [], t2Ids: [], singles: [] })).toEqual([])
  })

  it('returns [] when all wagers are zero', () => {
    const games = buildTournamentWagerGames({ wagers: { bb: 0, s1: 0, s2: 0 }, t1Ids: T1, t2Ids: T2, singles: SINGLES })
    expect(games).toEqual([])
  })

  it('omits the BB game when bb is 0 but includes singles', () => {
    const games = buildTournamentWagerGames({ wagers: { bb: 0, s1: 5, s2: 7 }, t1Ids: T1, t2Ids: T2, singles: SINGLES })
    expect(games).toHaveLength(2)
    expect(games[0].id).toBe('__tourn_s1')
    expect(games[0].config.ppt).toBe(5)
    expect(games[1].id).toBe('__tourn_s2')
    expect(games[1].config.ppt).toBe(7)
  })

  it('emits flat $ as ppt with no points multiplier', () => {
    const games = buildTournamentWagerGames({ wagers: { bb: 10, s1: 5, s2: 5 }, t1Ids: T1, t2Ids: T2, singles: SINGLES })
    expect(games.find(g => g.id === '__tourn_bb').config.ppt).toBe(10)
    expect(games.find(g => g.id === '__tourn_s1').config.ppt).toBe(5)
    expect(games.find(g => g.id === '__tourn_s2').config.ppt).toBe(5)
  })

  it('skips a single with missing player id', () => {
    const games = buildTournamentWagerGames({
      wagers: { bb: 0, s1: 5, s2: 5 },
      t1Ids: T1, t2Ids: T2,
      singles: [{ p1Id: 't1p1', p2Id: 't2p1' }, { p1Id: null, p2Id: 't2p2' }],
    })
    expect(games).toHaveLength(1)
    expect(games[0].id).toBe('__tourn_s1')
  })
})

describe('three-flat-wager settlement (end-to-end)', () => {
  it('all three components set, t1 wins everything → correct flat totals', () => {
    const ctx = fourPlayerTournCtx(t1SweepScores())
    const games = buildTournamentWagerGames({
      wagers: { bb: 10, s1: 5, s2: 5 },
      t1Ids: T1, t2Ids: T2, singles: SINGLES,
    })
    const { playerTotals, summary } = computeAllSettlements(ctx, games)
    // Per-player nets: t1 each +bb (BB) +singleAmount (their single) = 10+5 = 15
    expect(playerTotals.t1p1.total).toBe(15)
    expect(playerTotals.t1p2.total).toBe(15)
    expect(playerTotals.t2p1.total).toBe(-15)
    expect(playerTotals.t2p2.total).toBe(-15)
    // Per-component summary should also be present
    expect(summary.__tourn_bb).toBeDefined()
    expect(summary.__tourn_s1).toBeDefined()
    expect(summary.__tourn_s2).toBeDefined()
  })

  it('one component tied → no $ on that component', () => {
    // t1 wins BB and s1; s2 (t1p2 vs t2p2) is tied each hole
    const s = { t1p1: {}, t1p2: {}, t2p1: {}, t2p2: {} }
    for (let h = 1; h <= 18; h++) {
      s.t1p1[h] = 3; s.t2p1[h] = 4  // t1p1 wins s1 every hole → also drives BB (t1 best=3, t2 best=4)
      s.t1p2[h] = 5; s.t2p2[h] = 5  // tied → s2 is AS, doesn't move BB (t2 best still 4 from t2p1)
    }
    const ctx = fourPlayerTournCtx(s)
    const games = buildTournamentWagerGames({
      wagers: { bb: 10, s1: 5, s2: 5 },
      t1Ids: T1, t2Ids: T2, singles: SINGLES,
    })
    const { playerTotals, summary } = computeAllSettlements(ctx, games)
    // s2 tied — no nets emitted for that game
    expect((summary.__tourn_s2.nets || []).every(n => n.net === 0)).toBe(true)
    // BB and s1 won by t1 — no s2 contribution
    expect(playerTotals.t1p1.total).toBe(10 + 5)  // BB + s1
    expect(playerTotals.t1p2.total).toBe(10)      // BB only (their single tied)
    expect(playerTotals.t2p1.total).toBe(-(10 + 5))
    expect(playerTotals.t2p2.total).toBe(-10)
  })

  it('all components tied → zero settlement everywhere', () => {
    const ctx = fourPlayerTournCtx(allTiedScores())
    const games = buildTournamentWagerGames({
      wagers: { bb: 10, s1: 5, s2: 5 },
      t1Ids: T1, t2Ids: T2, singles: SINGLES,
    })
    const { playerTotals, ledger } = computeAllSettlements(ctx, games)
    expect(playerTotals.t1p1.total).toBe(0)
    expect(playerTotals.t1p2.total).toBe(0)
    expect(playerTotals.t2p1.total).toBe(0)
    expect(playerTotals.t2p2.total).toBe(0)
    expect(ledger).toHaveLength(0)
  })

  // Round 1 e01e8f37 canonical (v3.10.253) — verifies tournament wagers, team
  // Nassau, and a 1v1 pair bet all aggregate into the same playerTotals dict,
  // which is what HistoryView's recap settlement footer reads from.
  it('Round 1 canonical: 1v1 wagers + Nassau + pair bet aggregate per-player', () => {
    const ctx = fourPlayerTournCtx(t1SweepScores())
    const games = [
      ...buildTournamentWagerGames({
        wagers: { bb: 0, s1: 20, s2: 20 },
        t1Ids: T1, t2Ids: T2, singles: SINGLES,
      }),
      // Team Nassau (t1 vs t2): t1 sweeps front+back+overall = $40 per t1 player.
      // pressAt:0 disables auto-presses so the dollar math is deterministic.
      { id: 'nassau', type: 'nassau', config: { team1: T1, team2: T2, front: 10, back: 10, overall: 20, pressAt: 0 } },
      // Pair bet (t1p2 vs t2p2): closeout $20 to t1p2
      { id: 'pair', type: 'match1v1', config: { player1: 't1p2', player2: 't2p2', ppt: 20, scoring: 'closeout' } },
    ]
    const { playerTotals } = computeAllSettlements(ctx, games)
    expect(playerTotals.t1p1.total).toBe(20 + 40)        // 1v1 #1 + Nassau
    expect(playerTotals.t1p2.total).toBe(20 + 40 + 20)   // 1v1 #2 + Nassau + pair bet
    expect(playerTotals.t2p1.total).toBe(-20 - 40)
    expect(playerTotals.t2p2.total).toBe(-20 - 40 - 20)
  })

  it('legacy { pricePerPoint } shape → defensive zero (no crash, no $)', () => {
    const ctx = fourPlayerTournCtx(t1SweepScores())
    const games = buildTournamentWagerGames({
      wagers: { pricePerPoint: 1 },
      t1Ids: T1, t2Ids: T2, singles: SINGLES,
    })
    expect(games).toEqual([])
    const { playerTotals } = computeAllSettlements(ctx, games)
    expect(playerTotals.t1p1.total).toBe(0)
    expect(playerTotals.t2p1.total).toBe(0)
  })
})
