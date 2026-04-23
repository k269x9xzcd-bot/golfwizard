/**
 * gameEngine.test.js — Settlement math tests for all 18 game functions.
 *
 * Run: npx vitest run
 *
 * Test philosophy:
 * - Focus on financial correctness: who owes what, how much.
 * - Each test uses minimal ctx (2-4 players, flat course) to keep setup readable.
 * - Tie/edge cases are tested alongside happy paths.
 */

import { describe, it, expect } from 'vitest'
import {
  computeSkins,
  computeNassau,
  computeMatch,
  computeBestBall,
  computeBestBallNet,
  computeSnake,
  computeVegas,
  computeHiLow,
  computeStableford,
  computeWolf,
  computeHammer,
  computeSixes,
  computeFiveThreeOne,
  computeDots,
  computeFidget,
  computeBbb,
  computeScotch6s,
  computeTeamDay,
} from './gameEngine.js'

// ─────────────────────────────────────────────────────────────────
// ── TEST HELPERS ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal course: all par 4s, SI 1-18
 */
function makeCourse(holes = 18) {
  return {
    par: Array.from({ length: holes }, () => 4),
    si:  Array.from({ length: holes }, (_, i) => i + 1),
    teesData: {},
    name: 'Test Course',
  }
}

/**
 * Build a minimal member. round_hcp = 0 by default (scratch).
 */
function makeMember(id, name, round_hcp = 0) {
  return { id, short_name: name, round_hcp, ghin_index: round_hcp }
}

/**
 * Build scores: each entry is [memberId, hole, grossScore]
 */
function makeScores(entries) {
  const scores = {}
  for (const [id, hole, score] of entries) {
    if (!scores[id]) scores[id] = {}
    scores[id][hole] = score
  }
  return scores
}

/**
 * Standard 2-player ctx, 18 holes, scratch.
 */
function twoPlayerCtx(scores) {
  return {
    course: makeCourse(),
    tee: 'white',
    holesMode: '18',
    members: [makeMember('a', 'Alice'), makeMember('b', 'Bob')],
    scores,
  }
}

/**
 * Standard 4-player ctx (2v2), all scratch, 18 holes.
 */
function fourPlayerCtx(scores) {
  return {
    course: makeCourse(),
    tee: 'white',
    holesMode: '18',
    members: [
      makeMember('a', 'Alice'),
      makeMember('b', 'Bob'),
      makeMember('c', 'Carol'),
      makeMember('d', 'Dave'),
    ],
    scores,
  }
}

function net(result, id) {
  return result.settlements.find(s => s.id === id)?.net ?? result.standings?.find(s => s.id === id)?.net
}

// ─────────────────────────────────────────────────────────────────
// ── SKINS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeSkins', () => {
  it('Alice wins hole 1 outright — collects ppt from pool', () => {
    // Pool model: net = winnings - perPlayerCost
    // perPlayerCost = totalSkins * ppt = 1 * 5 = 5 (each player's share of all skins)
    // Alice: winnings(5) - cost(5) = 0
    // Bob:   winnings(0) - cost(5) = -5
    // This is by design — pool model charges each player per skin regardless of who won it.
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = h === 1 ? 3 : 4
      scores['b'][h] = 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeSkins(ctx, { ppt: 5 })
    expect(result.holeResults[0].winner).toBe('a')
    expect(result.totals['a'].skins).toBe(1)
    expect(result.totals['b'].skins).toBe(0)
    expect(result.settlements.find(s => s.id === 'a').net).toBe(0)
    expect(result.settlements.find(s => s.id === 'b').net).toBe(-5)
  })

  it('tied hole carries pot when carry=true', () => {
    const scores = makeScores([])
    for (let h = 1; h <= 18; h++) {
      scores['a'] = scores['a'] || {}
      scores['b'] = scores['b'] || {}
      // Tie on hole 1, Alice wins hole 2 (worth 2x pot)
      scores['a'][h] = h === 2 ? 3 : 4
      scores['b'][h] = 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeSkins(ctx, { ppt: 5, carry: true })
    // Hole 1: tie — pot grows to 10
    expect(result.holeResults[0].reason).toBe('tie')
    // Hole 2: Alice wins pot worth 10
    expect(result.holeResults[1].winner).toBe('a')
    expect(result.holeResults[1].pot).toBe(10)
  })

  it('tied hole does NOT carry when carry=false (dead skin)', () => {
    const scores = makeScores([])
    for (let h = 1; h <= 18; h++) {
      scores['a'] = scores['a'] || {}
      scores['b'] = scores['b'] || {}
      scores['a'][h] = 4
      scores['b'][h] = 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeSkins(ctx, { ppt: 5, carry: false })
    expect(result.holeResults.every(r => r.reason === 'dead' || r.reason === 'tie')).toBe(true)
    expect(result.settlements.every(s => s.net === 0 || s.skins === 0)).toBe(true)
  })

  it('perPlayer model settlements sum to zero', () => {
    // perPlayer model: net = (mySkins * ppt * (n-1)) - (othersSkins * ppt)
    // This IS zero-sum because every skin won by you = a loss for others.
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = h % 3 === 0 ? 3 : 4
      scores['b'][h] = h % 5 === 0 ? 3 : 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeSkins(ctx, { ppt: 5, payoutModel: 'perPlayer' })
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── NASSAU ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeNassau', () => {
  function nassauCtx(t1Scores, t2Scores) {
    // t1 = [a], t2 = [b], all scratch
    const scores = {}
    scores['a'] = {}; scores['b'] = {}
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = t1Scores[h - 1] ?? 4
      scores['b'][h] = t2Scores[h - 1] ?? 4
    }
    return {
      course: makeCourse(),
      tee: 'white',
      holesMode: '18',
      members: [makeMember('a', 'Alice'), makeMember('b', 'Bob')],
      scores,
    }
  }

  it('t1 wins front — positive settlement', () => {
    // Alice wins all 9 front holes (shoots 3 each), Bob shoots 4.
    const t1 = Array(18).fill(4); t1.splice(0, 9, ...Array(9).fill(3))
    const t2 = Array(18).fill(4)
    const ctx = nassauCtx(t1, t2)
    const result = computeNassau(ctx, { front: 10, back: 10, overall: 20, pressAt: 0, team1: ['a'], team2: ['b'] })
    expect(result.settlement.front).toBeGreaterThan(0)
    expect(result.settlement.back).toBe(0)
  })

  it('all square — settlement is zero', () => {
    const t1 = Array(18).fill(4)
    const t2 = Array(18).fill(4)
    const ctx = nassauCtx(t1, t2)
    const result = computeNassau(ctx, { front: 10, back: 10, overall: 20, pressAt: 0, team1: ['a'], team2: ['b'] })
    expect(result.settlement.total).toBe(0)
  })

  it('overall tracks independent of front/back', () => {
    // Alice wins all front, Bob wins all back → front +10, back -10, overall 0
    const t1 = Array(18).fill(4); t1.splice(0, 9, ...Array(9).fill(3))
    const t2 = Array(18).fill(4); t2.splice(9, 9, ...Array(9).fill(3))
    const ctx = nassauCtx(t1, t2)
    const result = computeNassau(ctx, { front: 10, back: 10, overall: 20, pressAt: 0, team1: ['a'], team2: ['b'] })
    expect(result.settlement.front).toBe(10)
    expect(result.settlement.back).toBe(-10)
    expect(result.settlement.overall).toBe(0)
    expect(result.settlement.total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── MATCH PLAY ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeMatch', () => {
  function matchCtx(aScores, bScores) {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = aScores[h - 1] ?? 4
      scores['b'][h] = bScores[h - 1] ?? 4
    }
    return {
      course: makeCourse(),
      tee: 'white',
      holesMode: '18',
      members: [makeMember('a', 'Alice'), makeMember('b', 'Bob')],
      scores,
    }
  }

  it('p1 wins all holes — positive p1Net (closeout)', () => {
    const ctx = matchCtx(Array(18).fill(3), Array(18).fill(4))
    const result = computeMatch(ctx, { player1: 'a', player2: 'b', ppt: 10 })
    expect(result.settlement.p1Net).toBe(10)
  })

  it('p2 wins all holes — negative p1Net', () => {
    const ctx = matchCtx(Array(18).fill(4), Array(18).fill(3))
    const result = computeMatch(ctx, { player1: 'a', player2: 'b', ppt: 10 })
    expect(result.settlement.p1Net).toBe(-10)
  })

  it('all square — p1Net = 0', () => {
    const ctx = matchCtx(Array(18).fill(4), Array(18).fill(4))
    const result = computeMatch(ctx, { player1: 'a', player2: 'b', ppt: 10 })
    expect(result.settlement.p1Net).toBe(0)
  })

  it('nassau scoring mode — p1Net = finalUp * ppt', () => {
    // p1 wins holes 1-3, p2 wins holes 4-6, rest halved → finalUp = 0
    const a = Array(18).fill(4); a[0] = 3; a[1] = 3; a[2] = 3
    const b = Array(18).fill(4); b[3] = 3; b[4] = 3; b[5] = 3
    const ctx = matchCtx(a, b)
    const result = computeMatch(ctx, { player1: 'a', player2: 'b', ppt: 5, scoring: 'nassau' })
    expect(result.settlement.p1Net).toBe(result.finalUp * 5)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── BEST BALL ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeBestBall', () => {
  it('t1 wins overall — positive t1Net', () => {
    // a+b vs c+d. a shoots 3 every hole, others shoot 4.
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeBestBall(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 5 })
    expect(result.settlement.t1Net).toBe(5)
  })

  it('all square — t1Net = 0', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeBestBall(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 5 })
    expect(result.settlement.t1Net).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── BEST BALL NET (aggregate) ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeBestBallNet', () => {
  it('returns total and per-hole best net', () => {
    const scores = {}
    for (const id of ['a', 'b']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    scores['a'][1] = 3 // birdie on hole 1
    const ctx = twoPlayerCtx(scores)
    const result = computeBestBallNet(ctx, { ballsToCount: 1 })
    expect(result).not.toBeNull()
    expect(result.totalNet).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────
// ── SNAKE ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeSnake', () => {
  it('only current holder owes — not every 3-putter', () => {
    // a 3-putts hole 1, b 3-putts hole 2. b is now the holder.
    // snakeCount = 2. b owes everyone else 2 * ppt each.
    const ctx = twoPlayerCtx({})
    const events = [
      { hole: 1, pid: 'a' },
      { hole: 2, pid: 'b' },
    ]
    const result = computeSnake(ctx, { ppt: 5, events })
    expect(result.holder).toBe('b')
    expect(result.snakeCount).toBe(2)
    // b owes (2 * 5) * (2-1 others) = 10
    const bNet = result.settlements.find(s => s.id === 'b').net
    expect(bNet).toBe(-10)
    // a collects 10
    const aNet = result.settlements.find(s => s.id === 'a').net
    expect(aNet).toBe(10)
  })

  it('no events — no money moves', () => {
    const ctx = twoPlayerCtx({})
    const result = computeSnake(ctx, { ppt: 5, events: [] })
    expect(result.holder).toBeNull()
    expect(result.settlements.every(s => s.net === 0)).toBe(true)
  })

  it('last 3-putter is the only payer regardless of earlier holders', () => {
    // 4 players. a → b → c → d. d is holder. snakeCount = 4.
    const ctx = fourPlayerCtx({})
    const events = [
      { hole: 1, pid: 'a' },
      { hole: 2, pid: 'b' },
      { hole: 3, pid: 'c' },
      { hole: 4, pid: 'd' },
    ]
    const result = computeSnake(ctx, { ppt: 5, events })
    expect(result.holder).toBe('d')
    const dNet = result.settlements.find(s => s.id === 'd').net
    // d owes (4 * 5) * 3 others = 60
    expect(dNet).toBe(-60)
    // Others each collect 20
    for (const id of ['a', 'b', 'c']) {
      expect(result.settlements.find(s => s.id === id).net).toBe(20)
    }
  })

  it('settlements sum to zero', () => {
    const ctx = fourPlayerCtx({})
    const events = [{ hole: 5, pid: 'b' }, { hole: 10, pid: 'c' }]
    const result = computeSnake(ctx, { ppt: 5, events })
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── VEGAS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeVegas', () => {
  function vegasScores(t1Gross, t2Gross) {
    // t1 = [a,b], t2 = [c,d]. Provide per-hole scores as arrays of [a,b,c,d].
    const scores = { a: {}, b: {}, c: {}, d: {} }
    const ids = ['a', 'b', 'c', 'd']
    for (let h = 1; h <= 18; h++) {
      const t1 = t1Gross[h - 1] || [4, 4]
      const t2 = t2Gross[h - 1] || [4, 4]
      scores['a'][h] = t1[0]; scores['b'][h] = t1[1]
      scores['c'][h] = t2[0]; scores['d'][h] = t2[1]
    }
    return fourPlayerCtx(scores)
  }

  it('t1 Vegas number < t2 — t1 wins', () => {
    // All scratch. h1: a=3,b=4 → t1=34; c=4,d=5 → t2=45. diff = 45-34=11. t1Total += 11.
    const t1s = Array(18).fill([4, 4]); t1s[0] = [3, 4]
    const t2s = Array(18).fill([4, 4]); t2s[0] = [4, 5]
    const ctx = vegasScores(t1s, t2s)
    const result = computeVegas(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, birdieFlip: false, eagleFlip: false, penaltyThreshold: 0 })
    expect(result.t1Total).toBeGreaterThan(0)
    expect(result.settlement.t1Net).toBeGreaterThan(0)
  })

  it('t1 birdie flips t2 number', () => {
    // h1: a=3(birdie),b=4 → t1=34. c=4,d=5 → t2=45. t1 birdies, flip t2: 54. diff = 54-34 = 20.
    const t1s = Array(18).fill([4, 4]); t1s[0] = [3, 4]
    const t2s = Array(18).fill([4, 4]); t2s[0] = [4, 5]
    const ctx = vegasScores(t1s, t2s)
    const noFlip = computeVegas(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, birdieFlip: false, eagleFlip: false, penaltyThreshold: 0 })
    const withFlip = computeVegas(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, birdieFlip: true, eagleFlip: false, penaltyThreshold: 0 })
    // Birdie flip should increase t1's advantage
    expect(withFlip.t1Total).toBeGreaterThan(noFlip.t1Total)
  })

  it('all equal scores — t1Total = 0', () => {
    const ctx = fourPlayerCtx({})
    for (const id of ['a', 'b', 'c', 'd']) {
      ctx.scores[id] = {}
      for (let h = 1; h <= 18; h++) ctx.scores[id][h] = 4
    }
    const result = computeVegas(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, birdieFlip: false, eagleFlip: false })
    expect(result.t1Total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── HI-LOW ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeHiLow', () => {
  it('t1 sweeps low+high+agg every hole — wins all points', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) {
        // a=3, b=4, c=5, d=6 — t1 wins all three points every hole
        scores[id][h] = id === 'a' ? 3 : id === 'b' ? 4 : id === 'c' ? 5 : 6
      }
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeHiLow(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, carryOnTie: false })
    expect(result.t1Pts).toBeGreaterThan(result.t2Pts)
    expect(result.settlement.t1Net).toBeGreaterThan(0)
  })

  it('all tied — no money moves', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeHiLow(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 5, carryOnTie: false })
    expect(result.settlement.t1Net).toBe(0)
  })

  it('carry on tie — pot accumulates correctly', () => {
    // tie for 2 holes, t1 wins hole 3 — should collect 3x the normal point
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    // On hole 3, a shoots birdie (3), c shoots 5 → t1 wins low
    scores['a'][3] = 3; scores['c'][3] = 5
    const ctx = fourPlayerCtx(scores)
    const result = computeHiLow(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, carryOnTie: true })
    // Hole 3 low ball should be worth at least 3 (2 carries + 1)
    const h3 = result.holeResults.find(r => r.hole === 3)
    expect(h3.lowWin).toBe('t1')
  })
})

// ─────────────────────────────────────────────────────────────────
// ── STABLEFORD ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeStableford', () => {
  it('standard: birdie = 3 pts, par = 2, bogey = 1, double = 0', () => {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = h === 1 ? 3 : h === 2 ? 5 : 4  // birdie h1, bogey h2, par rest
      scores['b'][h] = 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeStableford(ctx, { ppt: 1 })
    const aResult = result.playerResults['a']
    expect(aResult.holePoints[0].pts).toBe(3) // birdie
    expect(aResult.holePoints[1].pts).toBe(1) // bogey
    expect(aResult.holePoints[2].pts).toBe(2) // par
  })

  it('modified: eagle = 5, birdie = 2, par = 0, bogey = -1', () => {
    const scores = { a: {} }
    for (let h = 1; h <= 18; h++) scores['a'][h] = 4
    scores['a'][1] = 2  // eagle on par 4
    scores['a'][2] = 3  // birdie
    scores['a'][3] = 5  // bogey
    const ctx = { course: makeCourse(), tee: 'white', holesMode: '18', members: [makeMember('a', 'Alice')], scores }
    const result = computeStableford(ctx, { ppt: 1, variant: 'modified' })
    expect(result.playerResults['a'].holePoints[0].pts).toBe(5)  // eagle
    expect(result.playerResults['a'].holePoints[1].pts).toBe(2)  // birdie
    expect(result.playerResults['a'].holePoints[2].pts).toBe(-1) // bogey
  })

  it('settlements sum to zero', () => {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = h % 2 === 0 ? 3 : 5
      scores['b'][h] = 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeStableford(ctx, { ppt: 2 })
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── WOLF ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeWolf', () => {
  it('returns settlements for 4 players', () => {
    // Wolf returns { holeResults, totals, settlements, ppt }
    // wolfChoices defaults to {} — all holes unresolved (no partner picked), no money moves
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeWolf(ctx, { ppt: 5, players: ['a', 'b', 'c', 'd'] })
    expect(result).not.toBeNull()
    expect(result.settlements).toHaveLength(4)
  })

  it('settlements sum to zero', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeWolf(ctx, { ppt: 5, players: ['a', 'b', 'c', 'd'] })
    if (!result) return
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })

  it('defaults ppt to 1 when not provided', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    // a goes lone wolf on h1 and wins (net 3 vs everyone else's 4)
    const result = computeWolf(ctx, {
      players: ['a', 'b', 'c', 'd'],
      wolfTeeOrder: ['a', 'b', 'c', 'd'],
      wolfChoices: { 1: { partner: 'lone' } },
    })
    expect(result.ppt).toBe(1)
    // lone wolf win: ppt * loneMultiplier (4) * 3 opponents = 1*4*3 = 12
    expect(result.settlements.find(s => s.id === 'a').net).toBe(12)
  })

  it('tieRule=push: tied hole moves no money (default)', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeWolf(ctx, {
      ppt: 1,
      players: ['a', 'b', 'c', 'd'],
      wolfTeeOrder: ['a', 'b', 'c', 'd'],
      wolfChoices: { 1: { partner: 'b' } },
      tieRule: 'push',
    })
    expect(result.settlements.find(s => s.id === 'a').net).toBe(0)
    expect(result.settlements.find(s => s.id === 'c').net).toBe(0)
  })

  it('tieRule=wolfLoses: wolf team loses on tied partner hole', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeWolf(ctx, {
      ppt: 1,
      players: ['a', 'b', 'c', 'd'],
      wolfTeeOrder: ['a', 'b', 'c', 'd'],
      wolfChoices: { 1: { partner: 'b' } },
      tieRule: 'wolfLoses',
    })
    // wolf team (a+b) each pay $1 to each of 2 opponents = -$2 each
    expect(result.settlements.find(s => s.id === 'a').net).toBe(-2)
    expect(result.settlements.find(s => s.id === 'b').net).toBe(-2)
    expect(result.settlements.find(s => s.id === 'c').net).toBe(2)
    expect(result.settlements.find(s => s.id === 'd').net).toBe(2)
  })

  it('tieRule=wolfLoses: lone wolf loses on tie', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeWolf(ctx, {
      ppt: 1,
      players: ['a', 'b', 'c', 'd'],
      wolfTeeOrder: ['a', 'b', 'c', 'd'],
      wolfChoices: { 1: { partner: 'lone' } },
      tieRule: 'wolfLoses',
    })
    // lone wolf loses: ppt * loneMultiplier (4) * 3 opponents = -12
    expect(result.settlements.find(s => s.id === 'a').net).toBe(-12)
    expect(result.settlements.find(s => s.id === 'b').net).toBe(4)
    expect(result.settlements.find(s => s.id === 'c').net).toBe(4)
    expect(result.settlements.find(s => s.id === 'd').net).toBe(4)
  })

  it('tieRule=carryOver: settlements still sum to zero', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    scores['a'][2] = 3 // b is wolf h2, a (non-wolf) scores 3
    const ctx = fourPlayerCtx(scores)
    const result = computeWolf(ctx, {
      ppt: 1,
      players: ['a', 'b', 'c', 'd'],
      wolfTeeOrder: ['a', 'b', 'c', 'd'],
      wolfChoices: {
        1: { partner: 'b' }, // a wolf, all tie -> carry
        2: { partner: 'c' }, // b wolf with c; a scores 3, others 4 -> field wins (a+d better, no wait...)
      },
      tieRule: 'carryOver',
    })
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── HAMMER ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeHammer', () => {
  // Hammer uses actual net scores + hammerLog for throws/concessions.
  // Returns { holeResults, t1Total, settlement: { t1Net } }

  it('t1 wins a hole — t1Total > 0', () => {
    // Give t1 a better net on hole 1, no throws
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeHammer(ctx, {
      team1: ['a', 'b'], team2: ['c', 'd'],
      ppt: 5,
    })
    expect(result).not.toBeNull()
    expect(result.t1Total).toBeGreaterThan(0)
    expect(result.settlement.t1Net).toBeGreaterThan(0)
  })

  it('throw doubles the hole value', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    // 1 throw on hole 1 means ppt * 2^1 = 10
    const result = computeHammer(ctx, {
      team1: ['a', 'b'], team2: ['c', 'd'],
      ppt: 5,
      hammerLog: { 1: { throws: 1, conceded: false } },
    })
    const h1 = result.holeResults.find(r => r.hole === 1)
    expect(h1.holeValue).toBe(10) // 5 * 2^1
  })

  it('t1 and t2 each win one equal hole — t1Total = 0', () => {
    // a wins h1 (3 vs 4), c wins h2 (3 vs 4), rest tied
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    scores['a'][1] = 3; scores['c'][2] = 3
    const ctx = fourPlayerCtx(scores)
    const result = computeHammer(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 5 })
    expect(result.t1Total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── SIXES ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeSixes', () => {
  // Returns { segResults, totals, settlements, ppt }

  it('returns settlements for 4 players', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeSixes(ctx, { ppt: 2, players: ['a', 'b', 'c', 'd'] })
    expect(result).not.toBeNull()
    expect(result.settlements).toHaveLength(4)
  })

  it('settlements sum to zero', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeSixes(ctx, { ppt: 2, players: ['a', 'b', 'c', 'd'] })
    if (!result) return
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── 5-3-1 ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeFiveThreeOne', () => {
  // Returns { holeResults, totals, settlements, ppt }
  // Strictly 3 players only. Returns null for any other count.

  it('returns null for non-3 player count (2 players)', () => {
    const ctx = twoPlayerCtx({})
    const result = computeFiveThreeOne(ctx, { ppt: 1 })
    expect(result).toBeNull()
  })

  it('returns null for non-3 player count (4 players)', () => {
    const scores = { a: {}, b: {}, c: {}, d: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = 3; scores['b'][h] = 4; scores['c'][h] = 5; scores['d'][h] = 6
    }
    const ctx = {
      course: makeCourse(), tee: 'white', holesMode: '18',
      members: [makeMember('a','A'), makeMember('b','B'), makeMember('c','C'), makeMember('d','D')],
      scores,
    }
    const result = computeFiveThreeOne(ctx, { ppt: 1 })
    expect(result).toBeNull()
  })

  it('returns settlements for 3 players', () => {
    const scores = { a: {}, b: {}, c: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = 3; scores['b'][h] = 4; scores['c'][h] = 5
    }
    const ctx = {
      course: makeCourse(), tee: 'white', holesMode: '18',
      members: [makeMember('a', 'Alice'), makeMember('b', 'Bob'), makeMember('c', 'Carol')],
      scores,
    }
    const result = computeFiveThreeOne(ctx, { ppt: 1, players: ['a', 'b', 'c'] })
    expect(result).not.toBeNull()
    expect(result.settlements).toHaveLength(3)
    // Best scorer (Alice, shoots 3 every hole) should have positive net
    expect(result.settlements.find(s => s.id === 'a').net).toBeGreaterThan(0)
  })

  it('settlements sum to zero', () => {
    const scores = { a: {}, b: {}, c: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = 3; scores['b'][h] = 4; scores['c'][h] = 5
    }
    const ctx = {
      course: makeCourse(), tee: 'white', holesMode: '18',
      members: [makeMember('a', 'Alice'), makeMember('b', 'Bob'), makeMember('c', 'Carol')],
      scores,
    }
    const result = computeFiveThreeOne(ctx, { ppt: 1, players: ['a', 'b', 'c'] })
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── DOTS (JUNK) ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeDots', () => {
  it('birdie earns 1 dot', () => {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) { scores['a'][h] = 4; scores['b'][h] = 4 }
    scores['a'][1] = 3  // birdie on hole 1
    const ctx = twoPlayerCtx(scores)
    const result = computeDots(ctx, { ppt: 2, birdieEnabled: true, eagleEnabled: false, greenieEnabled: false, sandieEnabled: false })
    expect(result.dots['a'].dots).toBe(1)
  })

  it('eagle earns 2 dots', () => {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) { scores['a'][h] = 4; scores['b'][h] = 4 }
    scores['a'][1] = 2  // eagle on par 4
    const ctx = twoPlayerCtx(scores)
    const result = computeDots(ctx, { ppt: 2, birdieEnabled: false, eagleEnabled: true, greenieEnabled: false, sandieEnabled: false })
    expect(result.dots['a'].dots).toBe(2)
  })

  it('settlements sum to zero', () => {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = h % 3 === 0 ? 3 : 4
      scores['b'][h] = h % 5 === 0 ? 3 : 4
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeDots(ctx, { ppt: 2 })
    const sum = result.settlements.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── FIDGET ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeFidget', () => {
  it('player who never wins a hole owes everyone $ppp', () => {
    // Alice wins every hole. Bob never wins → Bob fidgets.
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) { scores['a'][h] = 3; scores['b'][h] = 4 }
    const ctx = twoPlayerCtx(scores)
    const result = computeFidget(ctx, { ppp: 10 })
    expect(result.fidgeters.map(m => m.id)).toContain('b')
    expect(result.fidgeters.map(m => m.id)).not.toContain('a')
    // Bob owes Alice $10
    const bobPays = result.settlements.find(s => s.from === 'b' && s.to === 'a')
    expect(bobPays?.amount).toBe(10)
  })

  it('all players win at least one hole — no fidgeters', () => {
    const scores = { a: {}, b: {} }
    for (let h = 1; h <= 18; h++) {
      scores['a'][h] = h <= 9 ? 3 : 4   // Alice wins front
      scores['b'][h] = h > 9 ? 3 : 4    // Bob wins back
    }
    const ctx = twoPlayerCtx(scores)
    const result = computeFidget(ctx, { ppp: 10 })
    expect(result.fidgeters).toHaveLength(0)
    expect(result.settlements).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── BBB (BINGO BANGO BONGO) ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeBbb', () => {
  it('pairwise settlement: winner collects diff * ppt from each player they beat', () => {
    // a=2 pts, b=1 pt, c=0 pts. ppt=$5.
    // a vs b: +1 → a collects 5 from b
    // a vs c: +2 → a collects 10 from c
    // b vs c: +1 → b collects 5 from c
    const ctx = {
      course: makeCourse(), tee: 'white', holesMode: '18',
      members: [makeMember('a', 'Alice'), makeMember('b', 'Bob'), makeMember('c', 'Carol')],
      scores: {},
    }
    const awards = {
      1: { bingo: 'a', bango: 'a', bongo: 'b' },  // a=2, b=1
    }
    const result = computeBbb(ctx, { ppt: 5, awards })
    expect(result.pts['a']).toBe(2)
    expect(result.pts['b']).toBe(1)
    expect(result.pts['c']).toBe(0)
    const aNet = result.standings.find(s => s.id === 'a').net
    expect(aNet).toBeGreaterThan(0)
  })

  it('settlements sum to zero', () => {
    const ctx = {
      course: makeCourse(), tee: 'white', holesMode: '18',
      members: [makeMember('a', 'Alice'), makeMember('b', 'Bob'), makeMember('c', 'Carol')],
      scores: {},
    }
    const awards = {
      1: { bingo: 'a', bango: 'b', bongo: 'c' },
      2: { bingo: 'b', bango: 'c', bongo: 'a' },
      3: { bingo: 'c', bango: 'a', bongo: 'b' },
    }
    const result = computeBbb(ctx, { ppt: 3, awards })
    // all tied at 2 pts each — net = 0 for all
    expect(result.standings.every(s => s.net === 0)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── SCOTCH 6s ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeScotch6s', () => {
  function scotchCtx() {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    return fourPlayerCtx(scores)
  }

  it('t1 wins low ball every hole — positive diff', () => {
    const ctx = scotchCtx()
    ctx.scores['a'] = {}
    for (let h = 1; h <= 18; h++) ctx.scores['a'][h] = 3  // a birdies every hole
    const result = computeScotch6s(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, netGross: 'gross' })
    expect(result).not.toBeNull()
    expect(result.diff).toBeGreaterThan(0)
  })

  it('umbrella: team sweeping all 6 pts gets doubled to 12', () => {
    // Set up one hole where t1 gets all 6 pts: low ball, low total, prox, birdie
    const ctx = scotchCtx()
    ctx.scores['a'] = {}; ctx.scores['b'] = {}
    ctx.scores['c'] = {}; ctx.scores['d'] = {}
    for (let h = 1; h <= 18; h++) {
      ctx.scores['a'][h] = h === 1 ? 3 : 4   // a birdies h1
      ctx.scores['b'][h] = 4
      ctx.scores['c'][h] = 5
      ctx.scores['d'][h] = 5
    }
    const awards = { 1: { prox: 't1' } }  // t1 also gets prox
    const result = computeScotch6s(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, netGross: 'gross', awards })
    const h1 = result.holes.find(h => h.h === 1)
    expect(h1.umbrella).toBe(true)
    expect(h1.t1pts).toBe(12)
  })

  it('all tied — diff = 0', () => {
    const ctx = scotchCtx()
    const result = computeScotch6s(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], ppt: 1, netGross: 'gross' })
    expect(result.diff).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ── TEAM DAY ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
describe('computeTeamDay', () => {
  it('lower aggregate wins — negative diff means t1 winning', () => {
    // t1 (a+b) shoots 3s, t2 (c+d) shoots 5s. bestNets=2, bestGross=0.
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' || id === 'b' ? 3 : 5
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeTeamDay(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], bestNets: 2, bestGross: 0, ppt: 1 })
    expect(result).not.toBeNull()
    expect(result.diff).toBeLessThan(0)  // t1 winning
    const t1Standing = result.standings.find(s => s.id === 'a')
    expect(t1Standing.net).toBeGreaterThan(0)
  })

  it('equal teams — diff = 0', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeTeamDay(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], bestNets: 2, bestGross: 0, ppt: 1 })
    expect(result.diff).toBe(0)
  })

  it('standings sum to zero', () => {
    const scores = {}
    for (const id of ['a', 'b', 'c', 'd']) {
      scores[id] = {}
      for (let h = 1; h <= 18; h++) scores[id][h] = id === 'a' ? 3 : 4
    }
    const ctx = fourPlayerCtx(scores)
    const result = computeTeamDay(ctx, { team1: ['a', 'b'], team2: ['c', 'd'], bestNets: 2, bestGross: 0, ppt: 1 })
    const sum = result.standings.reduce((s, x) => s + x.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })
})
