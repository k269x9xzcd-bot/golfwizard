import { describe, it, expect } from 'vitest'
import { computeAllSettlements } from './settlements.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMember(id, name) {
  return { id, short_name: name, name, guest_name: name, ghin_index: 0, stroke_override: null }
}

const FLAT_COURSE = {
  name: 'Test', par: [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  si:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  teesData: { white: { siByHole: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18], slope: 113, rating: 72, par: 72 } },
}

function makeScores(ids, perHole) {
  const s = {}
  for (const id of ids) { s[id] = {}; for (let h = 1; h <= 18; h++) s[id][h] = perHole }
  return s
}

function makeCtx(ids, perHole = 4) {
  return {
    course: FLAT_COURSE, tee: 'white', holesMode: '18',
    members: ids.map((id, i) => makeMember(id, `Player${i+1}`)),
    scores: makeScores(ids, perHole),
    discards: {},
  }
}

// ── Snake extractPlayerNets ───────────────────────────────────────────────────

describe('settlements — snake extractPlayerNets', () => {
  it('2-player: holder pays (ppt × count) to the one other player', () => {
    const ctx = makeCtx(['a', 'b'])
    const events = [{ hole: 1, pid: 'a' }, { hole: 2, pid: 'b' }]
    const games = [{ id: 'g1', type: 'snake', config: { ppt: 5, events } }]
    const { summary } = computeAllSettlements(ctx, games)
    const nets = summary.g1.nets
    const bNet = nets.find(n => n.id === 'b').net
    const aNet = nets.find(n => n.id === 'a').net
    // b holds 2 snakes at $5, 1 other player → b owes 2*5*1 = 10, a collects 10
    expect(bNet).toBe(-10)
    expect(aNet).toBe(10)
    expect(bNet + aNet).toBe(0)
  })

  it('4-player: holder pays ppt×count to EACH other player (not split)', () => {
    const ctx = makeCtx(['a', 'b', 'c', 'd'])
    // d ends up holding, snakeCount = 4
    const events = [
      { hole: 1, pid: 'a' }, { hole: 2, pid: 'b' },
      { hole: 3, pid: 'c' }, { hole: 4, pid: 'd' },
    ]
    const games = [{ id: 'g1', type: 'snake', config: { ppt: 5, events } }]
    const { summary } = computeAllSettlements(ctx, games)
    const nets = summary.g1.nets
    const dNet = nets.find(n => n.id === 'd').net
    // d holds 4 snakes at $5, 3 others → d owes 4*5*3 = 60, each other collects 4*5 = 20
    expect(dNet).toBe(-60)
    for (const id of ['a', 'b', 'c']) {
      expect(nets.find(n => n.id === id).net).toBe(20)
    }
  })

  it('settlements sum to zero in 4-player game', () => {
    const ctx = makeCtx(['a', 'b', 'c', 'd'])
    const events = [{ hole: 5, pid: 'b' }, { hole: 10, pid: 'c' }]
    const games = [{ id: 'g1', type: 'snake', config: { ppt: 5, events } }]
    const { summary } = computeAllSettlements(ctx, games)
    const sum = summary.g1.nets.reduce((s, n) => s + n.net, 0)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  })

  it('no events → all nets zero', () => {
    const ctx = makeCtx(['a', 'b', 'c'])
    const games = [{ id: 'g1', type: 'snake', config: { ppt: 5, events: [] } }]
    const { summary } = computeAllSettlements(ctx, games)
    expect(summary.g1.nets.every(n => n.net === 0)).toBe(true)
  })
})

// ── Match — 2v2 routing (regression: 2026-08-15 team-vs-1v1 bug) ─────────────
//
// The wizard used to seed config.player1/player2 from the round's first two
// players even when format was '2v2', so every downstream consumer that routed
// on "player1 && player2 present" (instead of config.format) silently settled
// a 2v2 team match as a 1v1 between the wrong two players — ignoring the other
// two entirely. isMatch1v1()/config.format is now the source of truth. This
// test pins that a 2v2 config carrying stale player1/player2 (the exact shape
// a pre-fix save would have produced) still settles as team1 vs team2.
describe('settlements — match 2v2 vs stale 1v1 fields', () => {
  function makeMatchCtx() {
    const members = [
      { id: 'jason', short_name: 'Jason', name: 'Jason', ghin_index: 0, stroke_override: null },
      { id: 'rocco', short_name: 'Rocco', name: 'Rocco', ghin_index: 0, stroke_override: null },
      { id: 'jeremy', short_name: 'Jeremy', name: 'Jeremy', ghin_index: 0, stroke_override: null },
      { id: 'neil', short_name: 'Neil', name: 'Neil', ghin_index: 0, stroke_override: null },
    ]
    // Team 1 (jason, rocco) shoots par every hole; Team 2 (jeremy, neil) shoots
    // bogey every hole, so team1 wins every hole and jason/rocco tie each other.
    const scores = {}
    for (const id of ['jason', 'rocco']) { scores[id] = {}; for (let h = 1; h <= 18; h++) scores[id][h] = 4 }
    for (const id of ['jeremy', 'neil']) { scores[id] = {}; for (let h = 1; h <= 18; h++) scores[id][h] = 5 }
    return { course: FLAT_COURSE, tee: 'white', holesMode: '18', members, scores, discards: {} }
  }

  it('routes to team1 vs team2 even when player1/player2 are stale-populated', () => {
    const ctx = makeMatchCtx()
    const games = [{
      id: 'g1', type: 'match',
      config: {
        format: '2v2', ppt: 20,
        team1: ['jason', 'rocco'], team2: ['jeremy', 'neil'],
        // Stale fields a pre-fix wizard save would have left behind — must be ignored.
        player1: 'jason', player2: 'rocco',
      },
    }]
    const { summary } = computeAllSettlements(ctx, games)
    const nets = summary.g1.nets
    expect(nets).toHaveLength(4)
    expect(nets.find(n => n.id === 'jason').net).toBe(20)
    expect(nets.find(n => n.id === 'rocco').net).toBe(20)
    expect(nets.find(n => n.id === 'jeremy').net).toBe(-20)
    expect(nets.find(n => n.id === 'neil').net).toBe(-20)
  })

  it('still routes 1v1 correctly when format is 1v1 and no teams are set', () => {
    const ctx = makeMatchCtx()
    const games = [{
      id: 'g1', type: 'match',
      config: { format: '1v1', ppt: 20, player1: 'jason', player2: 'jeremy', team1: [], team2: [] },
    }]
    const { summary } = computeAllSettlements(ctx, games)
    const nets = summary.g1.nets
    expect(nets).toHaveLength(2)
    expect(nets.find(n => n.id === 'jason').net).toBe(20)
    expect(nets.find(n => n.id === 'jeremy').net).toBe(-20)
  })
})
