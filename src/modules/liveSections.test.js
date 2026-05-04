import { describe, it, expect } from 'vitest'
import { buildLiveSections } from './liveSections.js'

const tournamentStatus = {
  wagers: { bb: 10, s1: 5, s2: 5 },
  thru: 12,
  bb: { teamLabel: 'BC+CR vs JC+AC', label: 'Up 2', diff: 2 },
  singles: [
    { p1Name: 'BC', p2Name: 'JC', label: '2 up thru 12', standing: 2 },
    { p1Name: 'CR', p2Name: 'AC', label: 'AS thru 12', standing: 0 },
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
    expect(tourn.items[1].matchup).toBe('BC v JC')
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
})
