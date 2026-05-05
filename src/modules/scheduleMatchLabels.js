/**
 * scheduleMatchLabels — pure helpers for ScheduleMatchCard / TournamentView labels.
 *
 * `singles1v1Label` resolves a single's winner to the player NICKNAME (never a
 * team label) plus the margin from `match.result.singlesStandings`. Falls back
 * to tournament_team_players when live round data isn't loaded — e.g. the
 * History → Schedule view after both rounds are completed and unloaded.
 */

/**
 * @param {Object}   args
 * @param {Object}   args.match  — tournament match row { team1, team2, singlesOrder, result }
 * @param {number}   args.idx    — 0 or 1
 * @param {Function} args.getTeam — fn(teamKey) → { players: [{ nickname, name }], short }
 * @param {Object?}  args.live   — optional liveRoundData[match.roundId] for nicer names
 * @returns {string} e.g. "1v1 MDu by 4", "1v1 SC won", "1v1 AS"
 */
export function singles1v1Label({ match, idx, getTeam, live }) {
  const s = match?.result?.singles?.[idx]
  if (!s) return ''
  if (s.winner === 'halved') return '1v1 AS'

  let p1Name, p2Name
  const livePair = live?.singles?.[idx]
  if (livePair) {
    const p1 = live.members?.find?.(m => m.id === livePair.p1)
    const p2 = live.members?.find?.(m => m.id === livePair.p2)
    p1Name = p1?.nickname || p1?.short_name
    p2Name = p2?.nickname || p2?.short_name
  } else {
    const t1 = getTeam?.(match.team1)
    const t2 = getTeam?.(match.team2)
    const order = match?.singlesOrder === 1 ? 1 : 0
    const pairs = order === 1
      ? [[t1?.players?.[0], t2?.players?.[1]], [t1?.players?.[1], t2?.players?.[0]]]
      : [[t1?.players?.[0], t2?.players?.[0]], [t1?.players?.[1], t2?.players?.[1]]]
    const [p1, p2] = pairs[idx] || []
    p1Name = p1?.nickname || p1?.name
    p2Name = p2?.nickname || p2?.name
  }
  const winnerName = s.winner === 't1' ? p1Name : p2Name
  if (!winnerName) return '1v1 ?'
  const standing = match?.result?.singlesStandings?.[idx]
  if (typeof standing === 'number' && standing !== 0) {
    return `1v1 ${winnerName} by ${Math.abs(standing)}`
  }
  return `1v1 ${winnerName} won`
}
