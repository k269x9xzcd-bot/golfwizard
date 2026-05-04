/**
 * tournamentWagers — wager shape normalization + synthetic settlement-game builder.
 *
 * Wager model (v3.10.246+):
 *   { bb: number, s1: number, s2: number }
 *   - bb : flat $ on Team Best Ball outcome (winner takes from each loser; tie = $0)
 *   - s1 : flat $ on first 1v1 match
 *   - s2 : flat $ on second 1v1 match
 *
 * Legacy shape: { pricePerPoint: N } — migrated to all-zeros (no surprise bets on
 * existing rows). Both shapes parse safely; unknown fields → 0.
 */

const ZERO = { bb: 0, s1: 0, s2: 0 }

export function normalizeWagers(raw) {
  if (raw == null || typeof raw !== 'object') return { ...ZERO }
  const num = v => (Number.isFinite(+v) && +v > 0 ? +v : 0)
  return {
    bb: num(raw.bb),
    s1: num(raw.s1),
    s2: num(raw.s2),
  }
}

export function hasAnyWager(raw) {
  const n = normalizeWagers(raw)
  return n.bb > 0 || n.s1 > 0 || n.s2 > 0
}

/**
 * Build the synthetic best_ball + match1v1 game configs that feed
 * computeAllSettlements. Empty array if no wager dollars are set or pairings
 * are incomplete.
 *
 * @param {Object} args
 * @param {Object} args.wagers   — raw wagers jsonb (any shape)
 * @param {string[]} args.t1Ids  — team-1 member ids
 * @param {string[]} args.t2Ids  — team-2 member ids
 * @param {Array<{p1Id:string,p2Id:string}>} args.singles — singles pairings (already ordered by singles_order)
 * @returns {Array<{id:string,type:string,config:Object}>}
 */
export function buildTournamentWagerGames({ wagers, t1Ids, t2Ids, singles }) {
  const w = normalizeWagers(wagers)
  if (!t1Ids?.length || !t2Ids?.length) return []
  const games = []
  if (w.bb > 0) {
    games.push({
      id: '__tourn_bb',
      type: 'bestball',
      config: {
        team1: t1Ids,
        team2: t2Ids,
        ballsPerTeam: 1,
        ppt: w.bb,
        scoring: 'closeout',
        __tournament: true,
        __tournamentComponent: 'bb',
        label: 'Team BB',
      },
    })
  }
  for (let i = 0; i < (singles?.length || 0); i++) {
    const s = singles[i]
    if (!s?.p1Id || !s?.p2Id) continue
    const key = i === 0 ? 's1' : i === 1 ? 's2' : null
    if (!key) continue
    const dollars = w[key]
    if (!dollars) continue
    games.push({
      id: `__tourn_${key}`,
      type: 'match1v1',
      config: {
        player1: s.p1Id,
        player2: s.p2Id,
        ppt: dollars,
        scoring: 'closeout',
        __tournament: true,
        __tournamentComponent: key,
        label: i === 0 ? '1v1 Match 1' : '1v1 Match 2',
      },
    })
  }
  return games
}
