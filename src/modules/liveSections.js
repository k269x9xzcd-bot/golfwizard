/**
 * buildLiveSections — Pure builder for the unified Live panel on Score tab.
 *
 * Returns an ordered list of sections (TOURNAMENT, SIDE GAMES, PAIR BETS,
 * CROSS-MATCH). Each section is rendered only when it has at least one
 * item — empty sections are omitted.
 *
 * Side-game ordering: 2BB Net trackers ("bbn") render at the bottom of the
 * SIDE GAMES section (Jason wants them after Fidget / Nassau / etc).
 *
 * Match1v1 dedup: in tournament rounds, a match1v1 game_config whose two
 * players match one of the tournament's singles pairings (in either order)
 * is filtered out — that's a legacy duplicate of the synthetic tournament
 * 1v1 already shown in TOURNAMENT. Side-bet match1v1s with different player
 * pairs are kept in PAIR BETS.
 *
 * @param {Object} args
 * @param {Object|null} args.tournamentStatus  Output of tournamentMatchStatus
 *        ({ wagers, bb, singles, thru }) for tournament rounds, else null.
 *        singles[i].p1Id / .p2Id used for match1v1 dedup.
 * @param {Array<Object>} args.activeGames     game_configs rows for the round.
 * @param {boolean} args.isTournamentRound     True iff round.format === 'tournament'.
 * @param {Object|null} args.liveCrossMatch    The cross-match record for this
 *        round (status linked or pending), else null.
 * @returns {Array<{key:string, title:string, headerNote:string, items:Array}>}
 */
function _isTournamentSinglesPair(game, tournamentSingles) {
  const p1 = game.config?.player1
  const p2 = game.config?.player2
  if (!p1 || !p2 || !tournamentSingles?.length) return false
  return tournamentSingles.some(s => {
    if (!s?.p1Id || !s?.p2Id) return false
    return (
      (s.p1Id === p1 && s.p2Id === p2) ||
      (s.p1Id === p2 && s.p2Id === p1)
    )
  })
}

// Side games render last-priority types at the bottom (currently just bbn —
// 2BB Net tracker). Lower priority value = renders first.
const SIDE_GAME_ORDER = { bbn: 100 }
function _sideGameSortKey(g) {
  return SIDE_GAME_ORDER[g.type] ?? 0
}

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
  //    Sort with low-priority types (bbn) at the bottom.
  const tournamentSingles = isTournamentRound ? (tournamentStatus?.singles || []) : []
  const sideGames = activeGames
    .filter(g => {
      if (g.type === 'match1v1') return false
      if (isTournamentRound && g.type === 'best_ball') return false
      return true
    })
    .slice()
    .sort((a, b) => _sideGameSortKey(a) - _sideGameSortKey(b))
  if (sideGames.length) {
    sections.push({
      key: 'side',
      title: 'SIDE GAMES',
      headerNote: 'foursome',
      items: sideGames.map(g => ({ kind: 'side-game', key: g.id, game: g })),
    })
  }

  // 3) PAIR BETS — every match1v1 in activeGames, MINUS those that duplicate
  //    the tournament's structural singles pairing (legacy from older app
  //    versions where singles were persisted as match1v1 game_configs).
  const pairBets = activeGames.filter(g =>
    g.type === 'match1v1' &&
    !(isTournamentRound && _isTournamentSinglesPair(g, tournamentSingles))
  )
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
