/**
 * buildLiveSections — Pure builder for the unified Live panel on Score tab.
 *
 * Returns an ordered list of sections (TOURNAMENT, SIDE GAMES, PAIR BETS,
 * CROSS-MATCH). Each section is rendered only when it has at least one
 * item — empty sections are omitted.
 *
 * @param {Object} args
 * @param {Object|null} args.tournamentStatus  Output of tournamentMatchStatus
 *        ({ wagers, bb, singles, thru }) for tournament rounds, else null.
 * @param {Array<Object>} args.activeGames     game_configs rows for the round.
 * @param {boolean} args.isTournamentRound     True iff round.format === 'tournament'.
 * @param {Object|null} args.liveCrossMatch    The cross-match record for this
 *        round (status linked or pending), else null.
 * @returns {Array<{key:string, title:string, headerNote:string, items:Array}>}
 */
export function buildLiveSections({
  tournamentStatus,
  activeGames = [],
  isTournamentRound = false,
  liveCrossMatch = null,
} = {}) {
  const sections = []

  // 1) TOURNAMENT — three flat $ per matchup
  if (tournamentStatus) {
    const t = tournamentStatus
    const w = t.wagers || { bb: 0, s1: 0, s2: 0 }
    const items = []
    items.push({
      kind: 'tournament-bb',
      key: 'bb',
      teamLabel: t.bb?.teamLabel,
      statusLabel: t.bb?.label,
      money: w.bb > 0 && t.bb?.diff !== 0 ? w.bb : 0,
    })
    ;(t.singles || []).forEach((s, i) => {
      const wager = i === 0 ? w.s1 : w.s2
      items.push({
        kind: 'tournament-1v1',
        key: 's' + i,
        matchup: `${s.p1Name} v ${s.p2Name}`,
        statusLabel: s.label,
        money: wager > 0 && s.standing !== 0 ? wager : 0,
      })
    })
    sections.push({
      key: 'tournament',
      title: 'TOURNAMENT',
      headerNote: t.thru ? `match thru ${t.thru}` : '',
      items,
    })
  }

  // 2) SIDE GAMES (foursome) — exclude match1v1 (those are pair bets);
  //    in tournament rounds also exclude best_ball (would dup the BB row).
  const sideGames = activeGames.filter(g => {
    if (g.type === 'match1v1') return false
    if (isTournamentRound && g.type === 'best_ball') return false
    return true
  })
  if (sideGames.length) {
    sections.push({
      key: 'side',
      title: 'SIDE GAMES',
      headerNote: 'foursome',
      items: sideGames.map(g => ({ kind: 'side-game', key: g.id, game: g })),
    })
  }

  // 3) PAIR BETS — every match1v1 in activeGames
  const pairBets = activeGames.filter(g => g.type === 'match1v1')
  if (pairBets.length) {
    sections.push({
      key: 'pair',
      title: 'PAIR BETS',
      headerNote: '',
      items: pairBets.map(g => ({ kind: 'pair-bet', key: g.id, game: g })),
    })
  }

  // 4) CROSS-MATCH (linked or pending match for this round)
  if (liveCrossMatch) {
    sections.push({
      key: 'cross',
      title: 'CROSS-MATCH',
      headerNote: liveCrossMatch.name || '',
      items: [{ kind: 'cross-match', key: liveCrossMatch.id, match: liveCrossMatch }],
    })
  }

  return sections
}
