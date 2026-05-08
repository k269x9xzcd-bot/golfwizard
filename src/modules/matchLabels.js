/**
 * matchLabels — pure helpers that surface stroke allocation in 1v1 and 2v2
 * Match labels.
 *
 * 1v1: the higher-HCP player carries the (+N) marker, where N is the raw
 *      course-handicap difference. e.g. JS(7) v JR(3) -> "JS(+4) v JR".
 *
 * 2v2: each player on team1 is annotated with strokes vs team2's lowest
 *      handicap, and vice versa. Zero-stroke players render bare. e.g.
 *      JS(7)+FR(6) v AC(0)+JR(3), t2low=0, t1low=6 ->
 *      "JS(+7)+FR(+6) v AC+JR" (JR plays at -3, floored to 0).
 *
 * Pulls course handicap from memberHandicap() — same source the engines use,
 * so the displayed strokes match what the score-net pipeline applies.
 */
import { memberHandicap } from './gameEngine.js'

function _annotate(init, strokes) {
  if (!strokes || strokes <= 0) return init
  return `${init}(+${strokes})`
}

/**
 * Build a stroke-annotated label for a Match game (1v1 or 2v2).
 *
 * @param {Object} args
 * @param {Object} args.config         game.config: {player1,player2} or {team1[],team2[]}
 * @param {Array}  args.members        ctx.members
 * @param {Object} args.course         ctx.course
 * @param {string} args.tee            ctx.tee
 * @param {(id:string)=>string} args.getInit  returns the member's initials
 * @returns {string}  '' when config is incomplete or members not found.
 */
export function formatMatchLabel({ config, members, course, tee, getInit }) {
  if (!config || !Array.isArray(members) || !members.length) return ''
  const init = id => getInit?.(id) || '?'
  const hcp = m => memberHandicap(m, course, tee)

  // 1v1
  if (config.player1 && config.player2) {
    const m1 = members.find(m => m.id === config.player1)
    const m2 = members.find(m => m.id === config.player2)
    if (!m1 || !m2) return ''
    const diff = hcp(m1) - hcp(m2)
    const i1 = init(m1.id), i2 = init(m2.id)
    if (diff > 0) return `${_annotate(i1, diff)} v ${i2}`
    if (diff < 0) return `${i1} v ${_annotate(i2, -diff)}`
    return `${i1} v ${i2}`
  }

  // 2v2
  if (Array.isArray(config.team1) && config.team1.length &&
      Array.isArray(config.team2) && config.team2.length) {
    const t1 = config.team1.map(id => members.find(m => m.id === id)).filter(Boolean)
    const t2 = config.team2.map(id => members.find(m => m.id === id)).filter(Boolean)
    if (!t1.length || !t2.length) return ''
    const t1Low = Math.min(...t1.map(hcp))
    const t2Low = Math.min(...t2.map(hcp))
    const side = (team, oppLow) =>
      team.map(m => _annotate(init(m.id), Math.max(0, hcp(m) - oppLow))).join('+')
    return `${side(t1, t2Low)} v ${side(t2, t1Low)}`
  }

  return ''
}
