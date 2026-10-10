/**
 * Viewer perspective — DISPLAY ONLY.
 *
 * Puts the signed-in player's team first on the scorecard and re-orients
 * team-vs-team / 1v1 game configs so labels and up/down read from the
 * viewer's side ("JS+MJ v SC+JT · Front +1").
 *
 * Never feed oriented games into anything that persists or settles money:
 * completeRound / liveSettlements keep using roundsStore.activeGames as-is.
 * Nassau and Match are side-symmetric, so swapping sides only negates the
 * team-1-relative numbers (covered by viewerPerspective.test.js).
 */

/** round_members row id for the signed-in user, or null. */
export function viewerMemberId(members, { userId, email } = {}) {
  if (!Array.isArray(members) || !members.length) return null
  if (userId) {
    const byProfile = members.find(m => m.profile_id && m.profile_id === userId)
    if (byProfile) return byProfile.id
  }
  if (email) {
    const e = String(email).toLowerCase()
    const byEmail = members.find(m => m.email && String(m.email).toLowerCase() === e)
    if (byEmail) return byEmail.id
  }
  return null
}

/** Team (1|2) of the viewer, or null when unknown / no teams. */
export function viewerTeam(members, viewerId) {
  if (!viewerId) return null
  const m = (members || []).find(x => x.id === viewerId)
  return m && (m.team === 1 || m.team === 2) ? m.team : null
}

/**
 * Stable reorder: viewer's team first, then the other team, then no-team.
 * Within the viewer's team the viewer goes first. Returns the input order
 * unchanged when the viewer isn't in the round.
 */
export function orderMembersForViewer(members, viewerId) {
  const list = Array.isArray(members) ? members.slice() : []
  const team = viewerTeam(list, viewerId)
  if (!viewerId || !list.some(m => m.id === viewerId)) return list
  const rank = (m) => {
    if (m.id === viewerId) return 0
    if (team && m.team === team) return 1
    if (m.team === 1 || m.team === 2) return 2
    return 3
  }
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map(x => x.m)
}

const _TEAM_TYPES = new Set(['nassau', 'match', 'match1v1'])

/**
 * Returns a copy of `game` with sides swapped so the viewer is side 1, or the
 * original object when no swap applies. Swapped copies carry
 * `_viewerFlipped: true` so renderers can swap side colours.
 */
export function orientGameForViewer(game, viewerId) {
  if (!game || !viewerId) return game
  const t = game.type?.toLowerCase()
  if (!_TEAM_TYPES.has(t)) return game
  const cfg = game.config || {}

  // 1v1: viewer listed as player2
  if ((t === 'match' || t === 'match1v1') && cfg.player1 && cfg.player2) {
    if (cfg.player2 === viewerId && cfg.player1 !== viewerId) {
      return { ...game, config: { ...cfg, player1: cfg.player2, player2: cfg.player1 }, _viewerFlipped: true }
    }
    return game
  }

  // Team vs team: viewer in team2
  const t1 = Array.isArray(cfg.team1) ? cfg.team1 : []
  const t2 = Array.isArray(cfg.team2) ? cfg.team2 : []
  if (t2.includes(viewerId) && !t1.includes(viewerId)) {
    return { ...game, config: { ...cfg, team1: t2, team2: t1 }, _viewerFlipped: true }
  }
  return game
}

/** Swap side-colour classes on a flipped game so colours stay tied to the real team. */
export function sideClass(cls, flipped) {
  if (!flipped) return cls
  if (cls === 'nota-t1') return 'nota-t2'
  if (cls === 'nota-t2') return 'nota-t1'
  return cls
}
