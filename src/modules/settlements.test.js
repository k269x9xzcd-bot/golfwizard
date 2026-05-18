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
