/**
 * simulator.js — generate realistic scores + game choices for a full round.
 * Used by the "Simulate Round" dev/testing feature.
 */
import { holeRange, holePar, holeSI, strokesOnHole, memberHandicap, memberNetOnHoleLowMan } from './gameEngine'

// ── RNG helpers ──────────────────────────────────────────────────────────────
function randNormal() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function chance(prob) {
  return Math.random() < prob
}

// ── Score simulation ─────────────────────────────────────────────────────────
function simulateScore(par, hcp) {
  // Expected strokes above par scales with course handicap
  const mean = par + hcp / 18
  // Variance grows slightly with handicap so high-hcp rounds look noisier
  const stddev = 0.75 + hcp * 0.02
  const raw = mean + randNormal() * stddev
  const floor = Math.max(1, par - 2)  // eagle / ace floor
  const ceil = par + Math.max(4, Math.ceil(hcp / 18) + 3)
  return Math.min(ceil, Math.max(floor, Math.round(raw)))
}

// ── Wolf choice simulation ────────────────────────────────────────────────────
function simulateWolfChoices(members, wolfConfig, holesMode) {
  const { wolfTeeOrder = [], blindWolfEnabled = true } = wolfConfig
  const { from, to } = holeRange(holesMode)
  const n = members.length

  // Build rotation (mirrors engine logic)
  const rotationIds = wolfTeeOrder.length >= n
    ? wolfTeeOrder.slice(0, n)
    : members.map(m => m.id)
  const rotation = rotationIds.map(id => members.find(m => m.id === id)).filter(Boolean)
  const ordered = rotation.length >= n ? rotation : members

  const wolfChoices = {}
  for (let h = from; h <= to; h++) {
    const wolfIdx = (h - from) % ordered.length
    const wolf = ordered[wolfIdx]
    const others = members.filter(m => m.id !== wolf.id)

    const r = Math.random()
    let partner
    if (blindWolfEnabled && r < 0.05) {
      partner = 'blind'
    } else if (r < 0.20) {
      partner = 'lone'
    } else {
      partner = pick(others)?.id ?? 'lone'
    }
    wolfChoices[h] = { partner }
  }
  return wolfChoices
}

// ── Snake event simulation ────────────────────────────────────────────────────
// 3-putt probability increases with score vs par
function simulateSnakeEvents(members, scores, course, tee, holesMode) {
  const { from, to } = holeRange(holesMode)
  const events = []

  for (let h = from; h <= to; h++) {
    const par = holePar(course, h)
    for (const m of members) {
      const gross = scores[m.id]?.[h]
      if (gross == null) continue
      const diff = gross - par
      // Probability of 3-putt: par = 10%, bogey = 25%, db = 40%, +3 = 55%
      const prob = Math.min(0.55, Math.max(0, 0.10 + diff * 0.15))
      if (chance(prob)) {
        events.push({ hole: h, pid: m.id, ts: Date.now() + h * 1000 + members.indexOf(m) })
      }
    }
  }
  return events
}

// ── Dots manual simulation ────────────────────────────────────────────────────
function simulateDotsManual(members, dotsConfig, scores, course, tee, holesMode) {
  const {
    greenieEnabled = true, sandieEnabled = true, chipinEnabled = false,
    barkieEnabled = false, arnieEnabled = false, ferretEnabled = false,
    negativeEnabled = false,
  } = dotsConfig
  const { from, to } = holeRange(holesMode)
  const manual = {}

  for (let h = from; h <= to; h++) {
    const par = holePar(course, h)
    const hcp = holeSI(course, h, tee)

    // Greenie: one player per par-3 (closest to pin)
    if (greenieEnabled && par === 3) {
      // Only award to a player who made par or better (more realistic)
      const eligible = members.filter(m => {
        const g = scores[m.id]?.[h]
        return g != null && g <= par
      })
      if (eligible.length && chance(0.8)) {
        const winner = pick(eligible)
        manual[`${winner.id}-${h}-greenie`] = true
      }
    }

    for (const m of members) {
      const gross = scores[m.id]?.[h]
      if (gross == null) continue

      const hcpVal = memberHandicap(m, course, tee)
      const strokes = strokesOnHole(hcpVal, hcp)
      const net = gross - strokes

      // Sandy: par or better AND looks like could have been in sand (20% when par or better)
      if (sandieEnabled && gross <= par && chance(0.20)) {
        manual[`${m.id}-${h}-sandy`] = true
      }

      // Chip-in: par or better, rare (5%)
      if (chipinEnabled && gross <= par && chance(0.05)) {
        manual[`${m.id}-${h}-chipin`] = true
      }

      // Barkie: par or better, very rare (3%)
      if (barkieEnabled && gross <= par && chance(0.03)) {
        manual[`${m.id}-${h}-barkie`] = true
      }

      // Arnie: par or better, rare (4%)
      if (arnieEnabled && gross <= par && chance(0.04)) {
        manual[`${m.id}-${h}-arnie`] = true
      }

      // Ferret: holing out from off-green (2%)
      if (ferretEnabled && chance(0.02)) {
        manual[`${m.id}-${h}-ferret`] = true
      }

      // Negative: water/OB (8% when double bogey or worse)
      if (negativeEnabled && gross >= par + 2 && chance(0.08)) {
        manual[`${m.id}-${h}-negative`] = true
      }
    }
  }
  return manual
}

// ── BBB (Bingo Bango Bongo) simulation ───────────────────────────────────────
function simulateBbbAwards(members, scores, course, tee, holesMode) {
  const { from, to } = holeRange(holesMode)
  const awards = {}
  const ctx = { scores, members, course, tee, holesMode }

  for (let h = from; h <= to; h++) {
    const eligible = members.filter(m => scores[m.id]?.[h] != null)
    if (!eligible.length) continue

    // Bingo: awarded to lowest net score (proxy for first on green)
    const netScores = eligible.map(m => ({
      id: m.id,
      net: memberNetOnHoleLowMan(ctx, m, h, members) ?? scores[m.id][h],
    }))
    const minNet = Math.min(...netScores.map(n => n.net))
    const bingoPool = netScores.filter(n => n.net === minNet)
    if (bingoPool.length) {
      if (!awards[h]) awards[h] = {}
      awards[h].bingo = pick(bingoPool).id
    }

    // Bango: closest to pin — awarded with 60% chance to a par-or-better player
    const parOrBetter = eligible.filter(m => scores[m.id][h] <= holePar(course, h))
    if (parOrBetter.length && chance(0.6)) {
      if (!awards[h]) awards[h] = {}
      awards[h].bango = pick(parOrBetter).id
    } else if (eligible.length && chance(0.3)) {
      if (!awards[h]) awards[h] = {}
      awards[h].bango = pick(eligible).id
    }

    // Bongo: first in hole — awarded to lowest gross score
    const minGross = Math.min(...eligible.map(m => scores[m.id][h]))
    const bongoPool = eligible.filter(m => scores[m.id][h] === minGross)
    if (bongoPool.length) {
      if (!awards[h]) awards[h] = {}
      awards[h].bongo = pick(bongoPool).id
    }
  }
  return awards
}

// ── Hammer simulation ─────────────────────────────────────────────────────────
// Simulate a modest number of throws (20% chance per hole), no concessions
function simulateHammerLog(holesMode) {
  const { from, to } = holeRange(holesMode)
  const hammerLog = {}
  let holder = 't1'
  for (let h = from; h <= to; h++) {
    const throws = chance(0.20) ? 1 : 0
    if (throws) {
      holder = holder === 't1' ? 't2' : 't1'
    }
    if (throws > 0) {
      hammerLog[h] = { throws, conceded: false, holder }
    }
  }
  return hammerLog
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * simulateRound — generate scores + game choices for all holes.
 *
 * @param {object} params
 * @param {Array}  params.members     - activeMembers array
 * @param {Array}  params.games       - activeGames array
 * @param {object} params.course      - courseData (with par[], si[], teesData)
 * @param {string} params.tee         - active tee name
 * @param {string} params.holesMode   - '18' | 'front9' | 'back9'
 *
 * @returns {{ scores: Object, gameUpdates: Array }}
 *   scores      = { [memberId]: { [hole]: score } }
 *   gameUpdates = [{ gameId, config }] — gameId preserves original type (number or string)
 *                 so updateGameConfig's strict-equality search always finds the game.
 */
export function simulateRound({ members, games, course, tee, holesMode }) {
  const { from, to } = holeRange(holesMode)

  // ── Scores ──────────────────────────────────────────────────────
  const scores = {}
  for (const m of members) {
    scores[m.id] = {}
    const hcp = memberHandicap(m, course, tee)
    for (let h = from; h <= to; h++) {
      const par = holePar(course, h)
      scores[m.id][h] = simulateScore(par, hcp)
    }
  }

  // ── Game-specific choices ────────────────────────────────────────
  // Use an array (not a dict) so game.id is never stringified by object key coercion —
  // Supabase integer IDs would become '42' as dict keys but updateGameConfig uses
  // strict equality (42 !== '42'), causing the game lookup to silently fail.
  const gameUpdates = []

  for (const game of games) {
    const t = game.type?.toLowerCase()
    const cfg = { ...game.config }

    if (t === 'wolf') {
      cfg.wolfChoices = simulateWolfChoices(members, cfg, holesMode)
      gameUpdates.push({ gameId: game.id, config: cfg })
    } else if (t === 'snake') {
      cfg.events = simulateSnakeEvents(members, scores, course, tee, holesMode)
      gameUpdates.push({ gameId: game.id, config: cfg })
    } else if (t === 'dots') {
      cfg.manual = simulateDotsManual(members, cfg, scores, course, tee, holesMode)
      gameUpdates.push({ gameId: game.id, config: cfg })
    } else if (t === 'hammer') {
      cfg.hammerLog = simulateHammerLog(holesMode)
      gameUpdates.push({ gameId: game.id, config: cfg })
    } else if (t === 'bbb') {
      cfg.awards = simulateBbbAwards(members, scores, course, tee, holesMode)
      gameUpdates.push({ gameId: game.id, config: cfg })
    }
  }

  return { scores, gameUpdates }
}
