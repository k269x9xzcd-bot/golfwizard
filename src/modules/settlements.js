/**
 * settlements.js — Computes final settlements for all games in a round.
 *
 * Takes the same ctx shape as gameEngine plus the list of game_configs,
 * and returns:
 *   { summary: { [gameType]: { ... } }, ledger: [ { from, to, amount, note } ] }
 */
import {
  computeNassau, computeSkins, computeMatch, computeVegas,
  computeSnake, computeHiLow, computeStableford, computeWolf,
  computeHammer, computeSixes, computeFiveThreeOne, computeDots,
  computeFidget, computeBestBallNet, computeBestBall,
} from './gameEngine.js'

const ENGINE_MAP = {
  nassau: computeNassau,
  skins: computeSkins,
  match: computeMatch,
  match1v1: computeMatch,
  vegas: computeVegas,
  snake: computeSnake,
  hilow: computeHiLow,
  stableford: computeStableford,
  wolf: computeWolf,
  hammer: computeHammer,
  sixes: computeSixes,
  fivethreeone: computeFiveThreeOne,
  dots: computeDots,
  fidget: computeFidget,
  bestball: computeBestBall,
  bbn: computeBestBallNet,
}

/**
 * Extract per-player net amounts from a game result.
 * Returns array of { id, name, net } where net>0 means player won that much.
 */
function extractPlayerNets(type, result, config, members) {
  const t = type.toLowerCase()

  // Fidget: settlements are { from, fromName, to, toName, amount } — convert to per-player net
  if (t === 'fidget' && result.settlements && Array.isArray(result.settlements)) {
    const netMap = {}
    for (const m of members) netMap[m.id] = 0
    for (const s of result.settlements) {
      if (netMap[s.from] !== undefined) netMap[s.from] -= s.amount
      if (netMap[s.to]   !== undefined) netMap[s.to]   += s.amount
    }
    return members.map(m => ({ id: m.id, name: m.short_name, net: netMap[m.id] || 0 }))
  }

  // Games that return a settlements array: [{ id, name, net }]
  if (result.settlements && Array.isArray(result.settlements)) {
    return result.settlements
  }

  // Nassau: team bet — s.total is what T1 wins from T2 (or loses if negative).
  // Each winning-team player wins s.total; each losing-team player pays s.total.
  // (It's not split — in a 2v2 Nassau each loser pays the full stake to each winner)
  if (t === 'nassau' && result.settlement) {
    const s = result.settlement
    if (s.total === 0) return []
    const t1Ids = config.team1 || []
    const t2Ids = config.team2 || []
    const nets = []
    // Each T1 player wins s.total from each T2 player, so net per T1 = s.total * t2Size
    // Each T2 player loses s.total to each T1 player, so net per T2 = -s.total * t1Size
    // But conventionally for 2v2, the amount is per-pair: each loser pays each winner.
    // s.total already = frontWins + pressWins + backWins + pressWins + overallWins
    // and those are scaled by the stake values already.
    // So each T1 player nets: +s.total and each T2 player nets: -s.total
    for (const id of t1Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: s.total })
    }
    for (const id of t2Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: -s.total })
    }
    return nets
  }

  // Match: status-based, player1 vs player2
  if ((t === 'match' || t === 'match1v1') && result.payout != null) {
    const m1 = members.find(m => m.id === config.player1)
    const m2 = members.find(m => m.id === config.player2)
    if (!m1 || !m2) return []
    return [
      { id: m1.id, name: m1.short_name, net: result.payout },
      { id: m2.id, name: m2.short_name, net: -result.payout },
    ]
  }

  // Vegas: team-based, runningTotal > 0 means t1 wins
  if (t === 'vegas' && result.runningTotal != null) {
    const total = result.runningTotal
    if (total === 0) return []
    const t1Ids = config.team1 || []
    const t2Ids = config.team2 || []
    const perPlayer = total / Math.max(t1Ids.length, 1)
    const nets = []
    for (const id of t1Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: perPlayer })
    }
    for (const id of t2Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: -perPlayer })
    }
    return nets
  }

  // Hi-Low: team-based
  if (t === 'hilow') {
    const t1Pts = result.team1Pts || 0
    const t2Pts = result.team2Pts || 0
    const ppt = config.ppt || 1
    const diff = (t1Pts - t2Pts) * ppt
    if (diff === 0) return []
    const t1Ids = config.team1 || []
    const t2Ids = config.team2 || []
    const perPlayer = diff / Math.max(t1Ids.length, 1)
    const nets = []
    for (const id of t1Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: perPlayer })
    }
    for (const id of t2Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: -perPlayer })
    }
    return nets
  }

  // Hammer: team-based
  if (t === 'hammer') {
    const total = (result.team1Total || 0) - (result.team2Total || 0)
    if (total === 0) return []
    const t1Ids = config.team1 || []
    const t2Ids = config.team2 || []
    const perPlayer = total / Math.max(t1Ids.length, 1)
    const nets = []
    for (const id of t1Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: perPlayer })
    }
    for (const id of t2Ids) {
      const m = members.find(m => m.id === id)
      nets.push({ id, name: m?.short_name || '?', net: -perPlayer })
    }
    return nets
  }

  // Standings-based games: wolf, stableford, sixes, fiveThreeOne, dots
  if (result.standings && Array.isArray(result.standings)) {
    // These typically have { id, name, balance/pts/dots }
    return result.standings.map(s => ({
      id: s.id,
      name: s.name,
      net: s.balance ?? s.net ?? s.winnings ?? 0,
    }))
  }

  // Snake: holder pays everyone
  if (t === 'snake' && result.holder) {
    const ppt = config.ppt || 5
    const count = result.snakeCount || 0
    if (!count) return []
    const others = members.filter(m => m.id !== result.holder)
    const totalOwed = ppt * count
    const nets = [{ id: result.holder, name: result.holderName, net: -totalOwed }]
    const perOther = totalOwed / Math.max(others.length, 1)
    for (const m of others) {
      nets.push({ id: m.id, name: m.short_name, net: perOther })
    }
    return nets
  }

  return []
}

/**
 * Compute all settlements for a round.
 * @param {Object} ctx - Game engine context { course, tee, members, scores, holesMode }
 * @param {Array} games - Array of game_config objects [{ id, type, config }]
 * @returns {{ summary: Object, ledger: Array }}
 */
export function computeAllSettlements(ctx, games) {
  const summary = {}
  const playerTotals = {} // { memberId: { name, total } }

  // Initialize player totals
  for (const m of ctx.members) {
    playerTotals[m.id] = { name: m.short_name, total: 0 }
  }

  for (const game of games) {
    const t = game.type?.toLowerCase()
    const engineFn = ENGINE_MAP[t]
    if (!engineFn) continue

    try {
      const result = engineFn(ctx, game.config || {})
      const nets = extractPlayerNets(t, result, game.config || {}, ctx.members)

      summary[game.id] = {
        type: t,
        gameName: game.type,
        nets,
        rawResult: result,
      }

      // Accumulate per-player totals
      for (const n of nets) {
        if (playerTotals[n.id]) {
          playerTotals[n.id].total += n.net
        }
      }
    } catch (e) {
      summary[game.id] = { type: t, gameName: game.type, error: e.message }
    }
  }

  // Build ledger entries (pairwise transfers from losers to winners)
  const ledger = buildLedger(playerTotals, ctx.members)

  return { summary, playerTotals, ledger }
}

/**
 * Convert player totals into minimal pairwise transfers.
 * Uses a greedy settle-up: pair largest debtor with largest creditor.
 */
function buildLedger(playerTotals, members) {
  const entries = Object.entries(playerTotals)
    .map(([id, { name, total }]) => ({ id, name, total: Math.round(total * 100) / 100 }))
    .filter(e => Math.abs(e.total) > 0.01)

  const debtors = entries.filter(e => e.total < 0).map(e => ({ ...e, owed: -e.total }))
  const creditors = entries.filter(e => e.total > 0).map(e => ({ ...e, owed: e.total }))

  debtors.sort((a, b) => b.owed - a.owed)
  creditors.sort((a, b) => b.owed - a.owed)

  const ledger = []
  let di = 0, ci = 0
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di]
    const c = creditors[ci]
    const amount = Math.min(d.owed, c.owed)
    if (amount > 0.01) {
      ledger.push({
        from_member_id: d.id,
        from_name: d.name,
        to_member_id: c.id,
        to_name: c.name,
        amount: Math.round(amount * 100) / 100,
        note: 'Round settlement',
      })
    }
    d.owed -= amount
    c.owed -= amount
    if (d.owed < 0.01) di++
    if (c.owed < 0.01) ci++
  }

  return ledger
}
