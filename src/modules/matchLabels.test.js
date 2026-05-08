import { describe, it, expect } from 'vitest'
import { formatMatchLabel } from './matchLabels.js'

// Mock course: par totals 72, slope 113, rating 72 → courseHandicap === ghin_index round
const course = {
  par: Array(18).fill(4),
  teesData: { white: { slope: 113, rating: 72, siByHole: Array(18).fill(0).map((_, i) => i + 1) } },
}
const tee = 'white'

const m = (id, ghin, init) => ({ id, ghin_index: ghin, short_name: init })
const initOf = id => ({ JS: 'JS', JR: 'JR', FR: 'FR', AL: 'AL', AC: 'AC' })[id] || '?'

describe('formatMatchLabel — 1v1', () => {
  const members = [m('JS', 7, 'JS'), m('JR', 3, 'JR'), m('FR', 6, 'FR'), m('AL', 0, 'AL')]

  it('annotates higher-HCP player with stroke diff', () => {
    expect(formatMatchLabel({
      config: { player1: 'JS', player2: 'JR' },
      members, course, tee, getInit: initOf,
    })).toBe('JS(+4) v JR')
  })

  it('annotates p2 when p2 is higher HCP', () => {
    expect(formatMatchLabel({
      config: { player1: 'JR', player2: 'JS' },
      members, course, tee, getInit: initOf,
    })).toBe('JR v JS(+4)')
  })

  it('no marker when handicaps even', () => {
    const evenMembers = [m('A', 5, 'A'), m('B', 5, 'B')]
    expect(formatMatchLabel({
      config: { player1: 'A', player2: 'B' },
      members: evenMembers, course, tee, getInit: id => id,
    })).toBe('A v B')
  })

  it('honors stroke_override over ghin_index', () => {
    const ms = [{ id: 'X', ghin_index: 20, stroke_override: 10, short_name: 'X' },
                { id: 'Y', ghin_index: 0, stroke_override: 2, short_name: 'Y' }]
    expect(formatMatchLabel({
      config: { player1: 'X', player2: 'Y' }, members: ms, course, tee, getInit: id => id,
    })).toBe('X(+8) v Y')
  })

  it('Seaview spot check: JS(7) v JR(3) → JS(+4) v JR', () => {
    expect(formatMatchLabel({
      config: { player1: 'JS', player2: 'JR' },
      members, course, tee, getInit: initOf,
    })).toBe('JS(+4) v JR')
  })

  it('Seaview spot check: FR(6) v AL(0) → FR(+6) v AL', () => {
    expect(formatMatchLabel({
      config: { player1: 'FR', player2: 'AL' },
      members, course, tee, getInit: initOf,
    })).toBe('FR(+6) v AL')
  })
})

describe('formatMatchLabel — 2v2', () => {
  // Seaview cohort: team1 JS(7)+FR(6), team2 AL(0)+JR(3)
  const members = [m('JS', 7, 'JS'), m('FR', 6, 'FR'), m('AL', 0, 'AL'), m('JR', 3, 'JR')]

  it('annotates each player with strokes vs opposing team low', () => {
    // t2Low = 0 (AL), t1Low = 6 (FR)
    // JS: 7-0=7, FR: 6-0=6, AL: 0-6 floored=0, JR: 3-6 floored=0
    expect(formatMatchLabel({
      config: { team1: ['JS', 'FR'], team2: ['AL', 'JR'] },
      members, course, tee, getInit: initOf,
    })).toBe('JS(+7)+FR(+6) v AL+JR')
  })

  it('zero-stroke side renders bare initials joined with +', () => {
    // both teams have HCP 0
    const ms = [m('A', 0, 'A'), m('B', 0, 'B'), m('C', 0, 'C'), m('D', 0, 'D')]
    expect(formatMatchLabel({
      config: { team1: ['A', 'B'], team2: ['C', 'D'] },
      members: ms, course, tee, getInit: id => id,
    })).toBe('A+B v C+D')
  })
})

describe('formatMatchLabel — edge cases', () => {
  it('returns empty when config missing', () => {
    expect(formatMatchLabel({ config: null, members: [], course, tee, getInit: id => id })).toBe('')
  })

  it('returns empty when 1v1 player not in members', () => {
    expect(formatMatchLabel({
      config: { player1: 'ghost', player2: 'X' },
      members: [m('X', 5, 'X')], course, tee, getInit: id => id,
    })).toBe('')
  })

  it('returns empty for 2v2 with no resolvable players', () => {
    expect(formatMatchLabel({
      config: { team1: ['ghost1'], team2: ['ghost2'] },
      members: [], course, tee, getInit: id => id,
    })).toBe('')
  })

  it('falls back to "?" when getInit returns falsy', () => {
    const ms = [m('A', 5, 'A'), m('B', 0, 'B')]
    expect(formatMatchLabel({
      config: { player1: 'A', player2: 'B' },
      members: ms, course, tee, getInit: () => null,
    })).toBe('?(+5) v ?')
  })
})
