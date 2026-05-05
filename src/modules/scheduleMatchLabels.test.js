import { describe, it, expect } from 'vitest'
import { singles1v1Label } from './scheduleMatchLabels.js'

// Round 1 r1m2 (MW vs MS) team rosters per Jason's spec
const TEAMS = {
  MW: { players: [{ id: 'marty', nickname: 'MDu' }, { id: 'wang', nickname: 'SC' }], short: 'MDu+SC' },
  MS: { players: [{ id: 'matt',  nickname: 'MDe' }, { id: 'spieler', nickname: 'JS' }], short: 'MDe+JS' },
  // Round 1 r1m1 (BC vs JA) — singles_order=0
  BC: { players: [{ id: 'brian', nickname: 'BC' }, { id: 'chris', nickname: 'CR' }], short: 'BC+CR' },
  JA: { players: [{ id: 'jeremy', nickname: 'JC' }, { id: 'alex', nickname: 'AC' }], short: 'JC+AC' },
}

const getTeam = key => TEAMS[key]

describe('singles1v1Label', () => {
  it('returns empty when no result yet', () => {
    expect(singles1v1Label({ match: { team1: 'MW', team2: 'MS', result: null }, idx: 0, getTeam })).toBe('')
  })

  it('halved → "1v1 AS"', () => {
    const match = {
      team1: 'MW', team2: 'MS', singlesOrder: 1,
      result: { singles: [{ winner: 'halved' }] },
    }
    expect(singles1v1Label({ match, idx: 0, getTeam })).toBe('1v1 AS')
  })

  it('Round 1 r1m2 #1: Marty (MDu) beats Spieler (JS) by 4 (singles_order=1)', () => {
    const match = {
      team1: 'MW', team2: 'MS', singlesOrder: 1,
      result: {
        singles: [{ winner: 't1' }, { winner: 't1' }],
        singlesStandings: [4, 2],
      },
    }
    expect(singles1v1Label({ match, idx: 0, getTeam })).toBe('1v1 MDu by 4')
  })

  it('Round 1 r1m2 #2: Wang (SC) beats Matt (MDe) by 2 (singles_order=1)', () => {
    const match = {
      team1: 'MW', team2: 'MS', singlesOrder: 1,
      result: {
        singles: [{ winner: 't1' }, { winner: 't1' }],
        singlesStandings: [4, 2],
      },
    }
    expect(singles1v1Label({ match, idx: 1, getTeam })).toBe('1v1 SC by 2')
  })

  it('singles_order=0: pairs t1[0]↔t2[0] and t1[1]↔t2[1]', () => {
    const match = {
      team1: 'BC', team2: 'JA', singlesOrder: 0,
      result: {
        singles: [{ winner: 't1' }, { winner: 't2' }],
        singlesStandings: [3, -1],
      },
    }
    // idx=0: t1[0]=BC vs t2[0]=JC, BC wins → "1v1 BC by 3"
    expect(singles1v1Label({ match, idx: 0, getTeam })).toBe('1v1 BC by 3')
    // idx=1: t1[1]=CR vs t2[1]=AC, AC wins → "1v1 AC by 1"
    expect(singles1v1Label({ match, idx: 1, getTeam })).toBe('1v1 AC by 1')
  })

  it('omits margin when standing missing — falls back to "won"', () => {
    const match = {
      team1: 'MW', team2: 'MS', singlesOrder: 1,
      result: { singles: [{ winner: 't1' }] },
    }
    expect(singles1v1Label({ match, idx: 0, getTeam })).toBe('1v1 MDu won')
  })

  it('prefers live round data when available', () => {
    const match = {
      team1: 'MW', team2: 'MS', singlesOrder: 1, roundId: 'r1',
      result: { singles: [{ winner: 't1' }], singlesStandings: [3] },
    }
    const live = {
      members: [
        { id: 'marty',   nickname: 'MartyLive', short_name: 'M' },
        { id: 'spieler', nickname: 'SpielerLive', short_name: 'S' },
      ],
      singles: [{ p1: 'marty', p2: 'spieler' }],
    }
    expect(singles1v1Label({ match, idx: 0, getTeam, live })).toBe('1v1 MartyLive by 3')
  })

  it('never returns a team label as the winner', () => {
    // Regression for v3.10.252 bug where missing live data → "1v1 MDu+SC won"
    const match = {
      team1: 'MW', team2: 'MS', singlesOrder: 1,
      result: { singles: [{ winner: 't1' }], singlesStandings: [4] },
    }
    const out = singles1v1Label({ match, idx: 0, getTeam })  // no `live` provided
    expect(out).not.toContain('+')  // team labels contain "+", player nicknames don't
  })
})
