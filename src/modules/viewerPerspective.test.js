import { describe, it, expect } from 'vitest'
import { computeNassau, computeMatch } from './gameEngine'
import {
  viewerMemberId, viewerTeam, orderMembersForViewer, orientGameForViewer, sideClass,
} from './viewerPerspective'

// Real round: Bonnie Briar 2026-10-10, thru 6 (snapshot before v3.10.290).
const JS = 'js', JT = 'jt', SC = 'sc', MJ = 'mj'
const members = [
  { id: JS, short_name: 'Spieler', profile_id: 'u-js', email: 'jtspieler@gmail.com', team: 2, ghin_index: 10.2, round_hcp: 13 },
  { id: JT, short_name: 'Tomei', profile_id: null, team: 1, ghin_index: 9.8, round_hcp: 13 },
  { id: SC, short_name: 'Chen', profile_id: 'u-sc', team: 1, ghin_index: 6.5, round_hcp: 9 },
  { id: MJ, short_name: 'Durkin Jr.', profile_id: null, team: 2, ghin_index: 9.4, round_hcp: 12 },
]
const gross = {
  [JT]: [6, 4, 5, 6, 3, 6],
  [SC]: [4, 5, 3, 6, 4, 5],
  [JS]: [7, 5, 4, 6, 3, 5],
  [MJ]: [6, 4, 3, 5, 4, 5],
}
const scores = Object.fromEntries(Object.entries(gross).map(([id, arr]) =>
  [id, Object.fromEntries(arr.map((s, i) => [i + 1, s]))]))
const si = [4, 12, 18, 10, 14, 2, 16, 6, 8, 13, 3, 9, 1, 11, 17, 7, 5, 15]
const par = [4, 4, 3, 4, 3, 4, 4, 4, 5, 3, 4, 4, 4, 4, 3, 5, 5, 4]
const ctx = {
  course: { name: 'Bonnie Briar', par, si, teesData: { Blue: { siByHole: si } } },
  tee: 'Blue', holesMode: '18', members, scores,
}
const nassau = { id: 'n', type: 'nassau', config: { front: 10, back: 10, overall: 20, pressAt: 2, team1: [SC, JT], team2: [JS, MJ] } }
const match = { id: 'm', type: 'match1v1', config: { ppt: 20, player1: SC, player2: JS, scoring: 'closeout' } }

describe('viewerPerspective', () => {
  it('finds the viewer by profile, then email', () => {
    expect(viewerMemberId(members, { userId: 'u-js' })).toBe(JS)
    expect(viewerMemberId(members, { email: 'JTSPIELER@gmail.com' })).toBe(JS)
    expect(viewerMemberId(members, { userId: 'nobody' })).toBe(null)
    expect(viewerTeam(members, JS)).toBe(2)
  })

  it('orders viewer, partner, then opponents', () => {
    expect(orderMembersForViewer(members, JS).map(m => m.id)).toEqual([JS, MJ, JT, SC])
    expect(orderMembersForViewer(members, null).map(m => m.id)).toEqual([JS, JT, SC, MJ])
  })

  it('leaves games alone when the viewer is already side 1 or not playing', () => {
    expect(orientGameForViewer(nassau, SC)).toBe(nassau)
    expect(orientGameForViewer(nassau, 'outsider')).toBe(nassau)
    expect(orientGameForViewer({ type: 'fidget', config: {} }, JS).type).toBe('fidget')
  })

  it('Nassau: swapping sides only negates results (no money change)', () => {
    const flipped = orientGameForViewer(nassau, JS)
    expect(flipped._viewerFlipped).toBe(true)
    expect(flipped.config.team1).toEqual([JS, MJ])
    expect(nassau.config.team1).toEqual([SC, JT]) // original untouched
    const a = computeNassau(ctx, nassau.config)
    const b = computeNassau(ctx, flipped.config)
    expect(b.frontSeg.t1Up + a.frontSeg.t1Up).toBe(0)
    expect(b.overallUp + a.overallUp).toBe(0)
    expect(b.frontSeg.presses.length).toBe(a.frontSeg.presses.length)
    for (const k of ['front', 'back', 'overall', 'total']) {
      expect(b.settlement[k] + a.settlement[k]).toBe(0)
    }
    a.frontSeg.holeResults.forEach((hr, i) => {
      expect((b.frontSeg.holeResults[i].t1Up ?? 0) + (hr.t1Up ?? 0)).toBe(0)
    })
  })

  it('Match 1v1: swap when viewer is player2', () => {
    const flipped = orientGameForViewer(match, JS)
    expect(flipped.config.player1).toBe(JS)
    const a = computeMatch(ctx, match.config)
    const b = computeMatch(ctx, flipped.config)
    expect(b.finalUp + a.finalUp).toBe(0)
    expect(b.settlement.p1Net + a.settlement.p1Net).toBe(0)
    expect(b.p1HolesWon).toBe(a.p2HolesWon)
  })

  it('side colour classes follow the real team when flipped', () => {
    expect(sideClass('nota-t1', true)).toBe('nota-t2')
    expect(sideClass('nota-halved', true)).toBe('nota-halved')
    expect(sideClass('nota-t1', false)).toBe('nota-t1')
  })
})
