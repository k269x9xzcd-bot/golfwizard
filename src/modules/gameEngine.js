/**
 * gameEngine.js — Pure game calculation functions for GolfWizard Vue app.
 *
 * All functions take explicit arguments (no global T references).
 * Context shape:
 *   ctx = {
 *     scores: { [memberId]: { [hole]: grossScore } },
 *     members: [{ id, short_name, round_hcp, ghin_index }],
 *     course: { par: [], si: [], teesData: {}, name },
 *     tee: string,             // selected tee name
 *     holesMode: '18'|'front9'|'back9',
 *   }
 */

// ── Hole range ──────────────────────────────────────────────────
export function holeRange(holesMode) {
  if (holesMode === 'front9') return { from: 1, to: 9 }
  if (holesMode === 'back9')  return { from: 10, to: 18 }
  return { from: 1, to: 18 }
}

export function holeCount(holesMode) {
  return holesMode === '18' ? 18 : 9
}

// ── Course helpers ───────────────────────────────────────────────
export function holePar(course, hole) {
  return course?.par?.[hole - 1] ?? 4
}

export function holeSI(course, hole, tee) {
  // Per-tee SI if available, else global si
  const teeSI = course?.teesData?.[tee]?.siByHole?.[hole - 1]
  if (teeSI != null) return teeSI
  return course?.si?.[hole - 1] ?? hole
}

export function holeYards(course, hole, tee) {
  return course?.teesData?.[tee]?.yardsByHole?.[hole - 1] ?? null
}

// ── Handicap calculation ─────────────────────────────────────────
/**
 * strokesOnHole: how many strokes a player gets on a given hole
 * based on their course handicap and the hole's stroke index.
 */
export function strokesOnHole(courseHcp, si) {
  if (!courseHcp || courseHcp <= 0) return 0
  const base = Math.floor(courseHcp / 18)
  const extra = courseHcp % 18
  return base + (si <= extra ? 1 : 0)
}

/**
 * courseHandicap: convert GHIN index to course handicap
 * Formula: Math.round(ghin * (slope/113) + (rating - par))
 */
export function courseHandicap(ghinIndex, course, tee) {
  if (ghinIndex == null) return 0
  const td = course?.teesData?.[tee]
  const slope = td?.slope ?? 113
  const rating = td?.rating ?? 72
  const par = (course?.par ?? []).reduce((s, p) => s + p, 0) || 72
  return Math.round(ghinIndex * (slope / 113) + (rating - par))
}

/**
 * memberHandicap: get a member's round handicap (pre-computed or derived)
 */
export function memberHandicap(member, course, tee) {
  if (member.round_hcp != null) return member.round_hcp
  return courseHandicap(member.ghin_index ?? 0, course, tee)
}

/**
 * netScore: gross - strokes on that hole
 */
export function netScore(gross, hcp, si) {
  if (gross == null) return null
  return gross - strokesOnHole(hcp, si)
}

// ── Adjusted net for low-man game handicap ───────────────────────
export function lowestHcp(members, course, tee) {
  return Math.min(...members.map(m => memberHandicap(m, course, tee)))
}

export function adjustedHcp(member, minHcp, course, tee, pct = 1.0) {
  const full = memberHandicap(member, course, tee)
  return Math.round((full - minHcp) * pct)
}

// ── Score helpers ────────────────────────────────────────────────
export function getScore(ctx, memberId, hole) {
  return ctx.scores?.[memberId]?.[hole] ?? null
}

export function memberNetOnHole(ctx, member, hole) {
  const gross = getScore(ctx, member.id, hole)
  if (gross == null) return null
  const hcp = memberHandicap(member, ctx.course, ctx.tee)
  const si = holeSI(ctx.course, hole, ctx.tee)
  return gross - strokesOnHole(hcp, si)
}

// ─────────────────────────────────────────────────────────────────
// ── SKINS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function computeSkins(ctx, config) {
  const { ppt = 5, players: pids } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  const holeResults = []
  let pot = 0
  let potValue = ppt

  for (let h = from; h <= to; h++) {
    const nets = members.map(m => ({
      id: m.id,
      name: m.short_name,
      net: memberNetOnHole(ctx, m, h),
    }))

    if (nets.some(n => n.net === null)) {
      holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'incomplete' })
      pot += ppt
      potValue += ppt
      continue
    }

    const min = Math.min(...nets.map(n => n.net))
    const winners = nets.filter(n => n.net === min)

    if (winners.length === 1) {
      holeResults.push({ hole: h, winner: winners[0].id, winnerName: winners[0].name, pot: potValue, net: min })
      pot = 0
      potValue = ppt
    } else {
      // Tie — carry pot
      holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'tie', tied: winners.map(w => w.id) })
      pot += ppt
      potValue += ppt
    }
  }

  // Tally winnings
  const totals = {}
  for (const m of members) totals[m.id] = { name: m.short_name, skins: 0, winnings: 0 }
  for (const hr of holeResults) {
    if (hr.winner) {
      totals[hr.winner].skins += 1
      totals[hr.winner].winnings += hr.pot
    }
  }

  // Settlement: every player owes skins × ppt for holes they didn't win
  const totalSkins = Object.values(totals).reduce((s, t) => s + t.skins, 0)
  const perPlayerCost = totalSkins * ppt  // each player owes this
  const settlements = members.map(m => ({
    id: m.id,
    name: m.short_name,
    net: totals[m.id].winnings - perPlayerCost,
  }))

  return { holeResults, totals, settlements, potValue, ppt }
}

// ─────────────────────────────────────────────────────────────────
// ── NASSAU ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function computeNassau(ctx, config) {
  const {
    front = 10, back = 10, overall = 20,
    pressAt = 2,
    team1 = [], team2 = [],
    hcpPct = 0.9,  // 90% for best ball
  } = config

  const t1 = ctx.members.filter(m => team1.includes(m.id))
  const t2 = ctx.members.filter(m => team2.includes(m.id))

  function bestNetOnHole(teamMembers, hole) {
    const nets = teamMembers.map(m => memberNetOnHole(ctx, m, hole)).filter(n => n != null)
    if (!nets.length) return null
    return Math.min(...nets)
  }

  function processSegment(fromH, toH, betValue) {
    const holeResults = []
    let t1Up = 0
    const presses = []
    let currentPressStart = fromH
    let currentPressValue = betValue

    for (let h = fromH; h <= toH; h++) {
      const n1 = bestNetOnHole(t1, h)
      const n2 = bestNetOnHole(t2, h)

      if (n1 === null || n2 === null) {
        holeResults.push({ hole: h, winner: null, t1Up })
        continue
      }

      let holeWinner = null
      if (n1 < n2) { t1Up += 1; holeWinner = 't1' }
      else if (n2 < n1) { t1Up -= 1; holeWinner = 't2' }
      holeResults.push({ hole: h, winner: holeWinner, t1Up, n1, n2 })

      // Check press condition
      const remaining = toH - h
      if (pressAt > 0 && Math.abs(t1Up) >= pressAt && remaining > 0) {
        presses.push({ start: h + 1, value: currentPressValue, t1UpAtStart: t1Up })
        currentPressStart = h + 1
        currentPressValue = betValue // each press is worth original bet
      }
    }

    const holesPlayed = holeResults.filter(r => r.winner !== undefined && r.winner !== null || (r.n1 != null && r.n2 != null)).length
    const t1UpFinal = holeResults.at(-1)?.t1Up ?? 0

    let t1Wins = 0
    if (holesPlayed > 0) {
      t1Wins = t1UpFinal > 0 ? betValue : t1UpFinal < 0 ? -betValue : 0
    }

    // Process presses
    let pressWins = 0
    for (const press of presses) {
      const pressHoles = holeResults.filter(r => r.hole >= press.start)
      if (pressHoles.length === 0) continue
      const pressUp = pressHoles.reduce((acc, r) => {
        if (r.winner === 't1') return acc + 1
        if (r.winner === 't2') return acc - 1
        return acc
      }, 0)
      pressWins += pressUp > 0 ? press.value : pressUp < 0 ? -press.value : 0
    }

    return { holeResults, t1Up: t1UpFinal, t1Wins, pressWins, presses }
  }

  const frontSeg = processSegment(1, 9, front)
  const backSeg = processSegment(10, 18, back)

  // Overall
  const allHoles = [...frontSeg.holeResults, ...backSeg.holeResults]
  const overallUp = allHoles.reduce((acc, r) => {
    if (r.winner === 't1') return acc + 1
    if (r.winner === 't2') return acc - 1
    return acc
  }, 0)
  const overallT1Wins = overallUp > 0 ? overall : overallUp < 0 ? -overall : 0

  const t1Total = frontSeg.t1Wins + frontSeg.pressWins + backSeg.t1Wins + backSeg.pressWins + overallT1Wins
  const t1Name = t1.map(m => m.short_name).join('+')
  const t2Name = t2.map(m => m.short_name).join('+')

  const settlement = {
    t1Name, t2Name,
    front: frontSeg.t1Wins + frontSeg.pressWins,
    back: backSeg.t1Wins + backSeg.pressWins,
    overall: overallT1Wins,
    total: t1Total,
    // positive = t1 wins that amount from t2
  }

  return {
    frontSeg, backSeg, overallUp, overallT1Wins, settlement,
    t1, t2, t1Name, t2Name,
  }
}

// ─────────────────────────────────────────────────────────────────
// ── MATCH PLAY (1v1 or 2v2) ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function computeMatch(ctx, config) {
  const { player1, player2, ppt = 10 } = config
  const m1 = ctx.members.find(m => m.id === player1)
  const m2 = ctx.members.find(m => m.id === player2)
  if (!m1 || !m2) return null

  const { from, to } = holeRange(ctx.holesMode)
  const holeResults = []
  let p1Up = 0

  for (let h = from; h <= to; h++) {
    const n1 = memberNetOnHole(ctx, m1, h)
    const n2 = memberNetOnHole(ctx, m2, h)

    if (n1 === null || n2 === null) {
      holeResults.push({ hole: h, winner: null, p1Up, incomplete: true })
      continue
    }

    let winner = null
    if (n1 < n2) { winner = 'p1'; p1Up += 1 }
    else if (n2 < n1) { winner = 'p2'; p1Up -= 1 }
    holeResults.push({ hole: h, winner, p1Up, n1, n2 })
  }

  const holesLeft = holeResults.filter(r => r.incomplete).length
  const playedHoles = holeResults.filter(r => !r.incomplete)
  const lastPlayed = playedHoles.at(-1)
  const finalUp = lastPlayed?.p1Up ?? 0
  const holesRemaining = holeResults.filter(r => r.hole > (lastPlayed?.hole ?? 0)).length + holesLeft

  // Match over when |up| > remaining
  const matchOver = Math.abs(finalUp) > holesRemaining
  const result = matchOver
    ? (finalUp > 0 ? `${finalUp}&${holesRemaining}` : `${-finalUp}&${holesRemaining}`)
    : (finalUp > 0 ? `${finalUp} UP` : finalUp < 0 ? `${-finalUp} DOWN` : 'A/S')

  const p1Net = finalUp > 0 ? ppt : finalUp < 0 ? -ppt : 0

  return {
    holeResults, finalUp, result, matchOver,
    p1: { id: m1.id, name: m1.short_name },
    p2: { id: m2.id, name: m2.short_name },
    settlement: { p1Name: m1.short_name, p2Name: m2.short_name, p1Net, ppt },
  }
}

// ─────────────────────────────────────────────────────────────────
// ── BEST BALL (team format, lowest N net per hole) ───────────────
// ─────────────────────────────────────────────────────────────────
export function computeBestBall(ctx, config) {
  const {
    team1 = [], team2 = [],
    ballsPerTeam = 1,  // 1 = best ball, 2 = better ball
    ppt = 5,
  } = config

  const t1 = ctx.members.filter(m => team1.includes(m.id))
  const t2 = ctx.members.filter(m => team2.includes(m.id))
  const { from, to } = holeRange(ctx.holesMode)

  function teamScore(teamMembers, hole) {
    const nets = teamMembers.map(m => memberNetOnHole(ctx, m, hole)).filter(n => n != null).sort((a, b) => a - b)
    if (nets.length < ballsPerTeam) return null
    return nets.slice(0, ballsPerTeam).reduce((s, n) => s + n, 0)
  }

  let t1Up = 0
  const holeResults = []

  for (let h = from; h <= to; h++) {
    const s1 = teamScore(t1, h)
    const s2 = teamScore(t2, h)

    if (s1 === null || s2 === null) {
      holeResults.push({ hole: h, winner: null, t1Up, incomplete: true })
      continue
    }

    let winner = null
    if (s1 < s2) { winner = 't1'; t1Up += 1 }
    else if (s2 < s1) { winner = 't2'; t1Up -= 1 }
    holeResults.push({ hole: h, winner, t1Up, s1, s2 })
  }

  const finalUp = holeResults.at(-1)?.t1Up ?? 0
  const t1Net = finalUp > 0 ? ppt : finalUp < 0 ? -ppt : 0

  return {
    holeResults, finalUp,
    t1Name: t1.map(m => m.short_name).join('+'),
    t2Name: t2.map(m => m.short_name).join('+'),
    settlement: {
      t1Net, ppt,
      t1Name: t1.map(m => m.short_name).join('+'),
      t2Name: t2.map(m => m.short_name).join('+'),
    },
  }
}

// ─────────────────────────────────────────────────────────────────
// ── SNAKE ────────────────────────────────────────────────────────
// The player who scores worst on a hole "carries the snake".
// They owe $ppt per hole they hold it.
// ─────────────────────────────────────────────────────────────────
export function computeSnake(ctx, config) {
  const { ppt = 5, players: pids } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  let snakeHolder = null
  const holeLog = []
  const owes = {}
  for (const m of members) owes[m.id] = { name: m.short_name, holes: 0, amount: 0 }

  for (let h = from; h <= to; h++) {
    const nets = members.map(m => ({ id: m.id, net: memberNetOnHole(ctx, m, h) }))
    if (nets.some(n => n.net === null)) {
      holeLog.push({ hole: h, snake: snakeHolder, newHolder: null, incomplete: true })
      if (snakeHolder) { owes[snakeHolder].holes += 1; owes[snakeHolder].amount += ppt }
      continue
    }

    const max = Math.max(...nets.map(n => n.net))
    const worst = nets.filter(n => n.net === max)

    // Snake passes to worst scorer (if unique)
    let newHolder = null
    if (worst.length === 1) newHolder = worst[0].id

    if (snakeHolder) {
      owes[snakeHolder].holes += 1
      owes[snakeHolder].amount += ppt
    }

    holeLog.push({ hole: h, prevHolder: snakeHolder, newHolder, netScores: nets })
    if (newHolder !== null) snakeHolder = newHolder
    // else: tie → snake stays (current holder keeps it through next hole)
  }

  return { holeLog, owes, ppt }
}

// ─────────────────────────────────────────────────────────────────
// ── DOTS (Junk) ──────────────────────────────────────────────────
// Track: Greenie, Sandy, Birdie, Eagle, Chip-in
// ─────────────────────────────────────────────────────────────────
export function computeDots(ctx, config) {
  const {
    ppt = 2,
    greenieEnabled = true,
    sandieEnabled = true,
    birdieEnabled = true,
    eagleEnabled = true,
    chipinEnabled = false,
    // manual dot overrides: { [memberId+'-'+hole+'-'+type]: true }
    manual = {},
  } = config
  const members = ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  const dots = {}
  for (const m of members) dots[m.id] = { name: m.short_name, dots: 0, amount: 0, breakdown: [] }

  for (let h = from; h <= to; h++) {
    const par = holePar(ctx.course, h)

    for (const m of members) {
      const gross = getScore(ctx, m.id, h)
      const hcp = memberHandicap(m, ctx.course, ctx.tee)
      const si = holeSI(ctx.course, h, ctx.tee)
      const net = gross != null ? gross - strokesOnHole(hcp, si) : null

      if (net === null) continue

      // Birdie/Eagle based on net vs par
      if (eagleEnabled && net <= par - 2) {
        dots[m.id].dots += 2
        dots[m.id].amount += ppt * 2
        dots[m.id].breakdown.push({ hole: h, type: 'Eagle', pts: 2 })
      } else if (birdieEnabled && net === par - 1) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Birdie', pts: 1 })
      }

      // Greenie: closest to pin on par 3 (marked manually)
      const greenKey = `${m.id}-${h}-greenie`
      if (greenieEnabled && par === 3 && manual[greenKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Greenie', pts: 1 })
      }

      // Sandy: up-and-down from bunker (marked manually)
      const sandKey = `${m.id}-${h}-sandy`
      if (sandieEnabled && manual[sandKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Sandy', pts: 1 })
      }

      // Chip-in (marked manually)
      const chipKey = `${m.id}-${h}-chipin`
      if (chipinEnabled && manual[chipKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Chip-in', pts: 1 })
      }
    }
  }

  // Settlement: each player collects ppt per dot from all other players
  const totalDots = Object.values(dots).reduce((s, d) => s + d.dots, 0)
  const n = members.length
  const settlements = members.map(m => {
    const myDots = dots[m.id].dots
    const othersDots = totalDots - myDots
    const net = myDots * ppt * (n - 1) - othersDots * ppt
    return { id: m.id, name: m.short_name, myDots, net }
  })

  return { dots, settlements, ppt }
}

// ─────────────────────────────────────────────────────────────────
// ── FIDGET ───────────────────────────────────────────────────────
// Player who never wins a hole outright owes every other player $ppp
// ─────────────────────────────────────────────────────────────────
export function computeFidget(ctx, config) {
  const { ppp = 10, players: pids } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  const hasWon = {}
  const holeLog = []
  for (const m of members) hasWon[m.id] = false

  for (let h = from; h <= to; h++) {
    const nets = members.map(m => ({ id: m.id, net: memberNetOnHole(ctx, m, h) }))
    if (nets.some(n => n.net === null)) {
      holeLog.push({ hole: h, winner: null, incomplete: true })
      continue
    }

    const min = Math.min(...nets.map(n => n.net))
    const winners = nets.filter(n => n.net === min)
    if (winners.length === 1) {
      hasWon[winners[0].id] = true
      holeLog.push({ hole: h, winner: winners[0].id })
    } else {
      holeLog.push({ hole: h, winner: null, tied: winners.map(w => w.id) })
    }
  }

  const fidgeters = members.filter(m => !hasWon[m.id])
  const winners = members.filter(m => hasWon[m.id])

  // Each fidgeter owes $ppp to each other player
  const settlements = []
  for (const loser of fidgeters) {
    for (const other of members) {
      if (other.id === loser.id) continue
      settlements.push({ from: loser.id, fromName: loser.short_name, to: other.id, toName: other.short_name, amount: ppp })
    }
  }

  return { hasWon, holeLog, fidgeters, winners, settlements, ppp }
}

// ─────────────────────────────────────────────────────────────────
// ── AGGREGATE BEST BALL (group lowest N net) ─────────────────────
// For tracking group-wide best ball net total across 18 holes.
// ─────────────────────────────────────────────────────────────────
export function computeBestBallNet(ctx, config = {}) {
  const { ballsToCount = 1, players: pids } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  const holeResults = []
  let totalNet = 0
  let parTotal = 0

  for (let h = from; h <= to; h++) {
    const par = holePar(ctx.course, h)
    const nets = members
      .map(m => ({ id: m.id, name: m.short_name, net: memberNetOnHole(ctx, m, h) }))
      .filter(n => n.net != null)
      .sort((a, b) => a.net - b.net)

    if (nets.length === 0) {
      holeResults.push({ hole: h, nets: [], countedNets: [], sum: null, toPar: null })
      continue
    }

    const counted = nets.slice(0, ballsToCount)
    const sum = counted.reduce((s, n) => s + n.net, 0)
    const parBasis = par * ballsToCount
    totalNet += sum
    parTotal += parBasis

    holeResults.push({
      hole: h,
      par,
      nets,
      countedNets: counted,
      sum,
      toPar: sum - parBasis,
    })
  }

  const overallToPar = totalNet - parTotal

  return { holeResults, totalNet, parTotal, overallToPar, ballsToCount }
}

// ─────────────────────────────────────────────────────────────────
// ── SCORECARD SUMMARY ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function scorecardSummary(ctx) {
  const { from, to } = holeRange(ctx.holesMode)
  const summary = {}

  for (const m of ctx.members) {
    const hcp = memberHandicap(m, ctx.course, ctx.tee)
    let frontGross = 0, backGross = 0
    let frontNet = 0, backNet = 0
    let frontPar = 0, backPar = 0
    let holesIn = 0

    for (let h = from; h <= to; h++) {
      const gross = getScore(ctx, m.id, h)
      const par = holePar(ctx.course, h)
      const si = holeSI(ctx.course, h, ctx.tee)
      const strokes = strokesOnHole(hcp, si)
      const net = gross != null ? gross - strokes : null

      if (h <= 9) {
        frontPar += par
        if (gross != null) { frontGross += gross; frontNet += net; holesIn++ }
      } else {
        backPar += par
        if (gross != null) { backGross += gross; backNet += net; holesIn++ }
      }
    }

    summary[m.id] = {
      id: m.id,
      name: m.short_name,
      hcp,
      frontGross, backGross, totalGross: frontGross + backGross,
      frontNet, backNet, totalNet: frontNet + backNet,
      frontPar, backPar, totalPar: frontPar + backPar,
      holesIn,
    }
  }

  return summary
}

// ─────────────────────────────────────────────────────────────────
// ── UTILITY: format score vs par ─────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function scoreToPar(score, par) {
  if (score == null) return ''
  const diff = score - par
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  if (diff === 2) return 'double'
  return 'triple'
}
