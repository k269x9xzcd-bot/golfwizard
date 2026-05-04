import { describe, it, expect } from 'vitest'
import { buildLiveSections } from './liveSections.js'

const tournamentStatus = {
  wagers: { bb: 10, s1: 5, s2: 5 },
  thru: 12,
  bb: { teamLabel: 'BC+CR vs JC+AC', label: 'Up 2', diff: 2 },
  // Singles pairings: Marty(p1) v Spieler(p2), Wang(p3) v Matt(p4)
  singles: [
    { p1Name: 'MD', p2Name: 'JS', p1Id: 'marty', p2Id: 'spieler', label: '2 up thru 12', standing: 2 },
    { p1Name: 'WC', p2Name: 'MD', p1Id: 'wang',  p2Id: 'matt',    label: 'AS thru 12', standing: 0 },
  ],
}

const sideBB    = { id: 'g1', type: 'best_ball', config: { ppt: 1 } }
const sideSkins = { id: 'g2', type: 'skins',     config: { ppp: 5 } }
const pairBet   = { id: 'g3', type: 'match1v1',  config: { player1: 'a', player2: 'b', ppt: 20 } }
const crossMatch = { id: 'cm1', name: 'Foursome A vs B', status: 'linked', round_a_id: 'r1', round_b_id: 'r2' }

describe('buildLiveSections', () => {
  it('tournament round with all section types renders all four', () => {
    const sections = buildLiveSections({
      tournamentStatus,
      activeGames: [sideSkins, pairBet], // best_ball excluded by tournament dedup; using skins
      isTournamentRound: true,
      liveCrossMatch: crossMatch,
    })
    expect(sections.map(s => s.key)).toEqual(['tournament', 'side', 'pair', 'cross'])

    const tourn = sections.find(s => s.key === 'tournament')
    expect(tourn.items[0].kind).toBe('tournament-bb')
    expect(tourn.items[0].money).toBe(10)
    expect(tourn.items[1].kind).toBe('tournament-1v1')
    expect(tourn.items[1].matchup).toBe('MD v JS')
    expect(tourn.items[1].money).toBe(5)  // standing != 0 so wager applies
    expect(tourn.items[2].money).toBe(0)  // tied (standing=0) → no money
    expect(tourn.headerNote).toBe('match thru 12')
  })

  it('tournament round excludes best_ball from side games (would dup Team BB)', () => {
    const sections = buildLiveSections({
      tournamentStatus,
      activeGames: [sideBB, sideSkins, pairBet],
      isTournamentRound: true,
      liveCrossMatch: null,
    })
    const side = sections.find(s => s.key === 'side')
    expect(side.items.map(i => i.game.id)).toEqual(['g2'])  // skins only, BB excluded
  })

  it('tournament round with no side games renders just TOURNAMENT', () => {
    const sections = buildLiveSections({
      tournamentStatus,
      activeGames: [],
      isTournamentRound: true,
      liveCrossMatch: null,
    })
    expect(sections.map(s => s.key)).toEqual(['tournament'])
  })

  it('non-tournament round with side games + cross-match (no tournament section)', () => {
    const sections = buildLiveSections({
      tournamentStatus: null,
      activeGames: [sideBB, sideSkins, pairBet],
      isTournamentRound: false,
      liveCrossMatch: crossMatch,
    })
    expect(sections.map(s => s.key)).toEqual(['side', 'pair', 'cross'])

    const side = sections.find(s => s.key === 'side')
    // Non-tournament: best_ball stays as a side game
    expect(side.items.map(i => i.game.id).sort()).toEqual(['g1', 'g2'])

    const pair = sections.find(s => s.key === 'pair')
    expect(pair.items[0].game.id).toBe('g3')
    expect(pair.items[0].kind).toBe('pair-bet')

    const cross = sections.find(s => s.key === 'cross')
    expect(cross.items[0].match.id).toBe('cm1')
    expect(cross.headerNote).toBe('Foursome A vs B')
  })

  it('round with no games at all returns []', () => {
    const sections = buildLiveSections({
      tournamentStatus: null,
      activeGames: [],
      isTournamentRound: false,
      liveCrossMatch: null,
    })
    expect(sections).toEqual([])
  })

  it('handles missing args defensively (called with no params)', () => {
    expect(buildLiveSections()).toEqual([])
  })

  it('tournament round: keeps side-bet match1v1 with non-structural pair, drops legacy duplicate', () => {
    const sideBet   = { id: 'pb-side',   type: 'match1v1', config: { player1: 'spieler', player2: 'wang', ppt: 20 } }
    const legacyDup = { id: 'pb-legacy', type: 'match1v1', config: { player1: 'marty',   player2: 'spieler', ppt: 5 } }
    const sections = buildLiveSections({
      tournamentStatus,
      activeGames: [sideBet, legacyDup],
      isTournamentRound: true,
      liveCrossMatch: null,
    })
    const pair = sections.find(s => s.key === 'pair')
    expect(pair).toBeTruthy()
    expect(pair.items.map(i => i.game.id)).toEqual(['pb-side'])
  })

  it('tournament round: legacy duplicate matches even with player order reversed', () => {
    const reversedDup = { id: 'pb-rev', type: 'match1v1', config: { player1: 'spieler', player2: 'marty', ppt: 5 } }
    const sections = buildLiveSections({
      tournamentStatus,
      activeGames: [reversedDup],
      isTournamentRound: true,
      liveCrossMatch: null,
    })
    expect(sections.find(s => s.key === 'pair')).toBeUndefined()
  })

  it('non-tournament round: never dedups match1v1 (no tournament structure to dup)', () => {
    const m1v1 = { id: 'pb-1', type: 'match1v1', config: { player1: 'marty', player2: 'spieler', ppt: 20 } }
    const sections = buildLiveSections({
      tournamentStatus: null,
      activeGames: [m1v1],
      isTournamentRound: false,
      liveCrossMatch: null,
    })
    const pair = sections.find(s => s.key === 'pair')
    expect(pair.items.map(i => i.game.id)).toEqual(['pb-1'])
  })

  it('SIDE GAMES: 2BB Net (bbn) renders last, even when listed first in activeGames', () => {
    const bbn  = { id: 'bbn-1',  type: 'bbn',     config: {} }
    const fid  = { id: 'fid-1',  type: 'fidget',  config: {} }
    const nas  = { id: 'nas-1',  type: 'nassau',  config: {} }
    const sections = buildLiveSections({
      tournamentStatus: null,
      activeGames: [bbn, nas, fid],
      isTournamentRound: false,
      liveCrossMatch: null,
    })
    const side = sections.find(s => s.key === 'side')
    expect(side.items.map(i => i.game.id)).toEqual(['nas-1', 'fid-1', 'bbn-1'])
  })
})
