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
  if (member.stroke_override != null) return member.stroke_override
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

/**
 * memberNetOnHoleLowMan: net score using low-man adjusted handicap.
 * The lowest-hcp player in the group plays scratch; others get the difference.
 * Used by team games: Nassau, Match, Best Ball (team), Vegas, Hi-Low, Hammer.
 */
export function memberNetOnHoleLowMan(ctx, member, hole, allMembers) {
  const gross = getScore(ctx, member.id, hole)
  if (gross == null) return null
  const participants = allMembers || ctx.members
  const minHcp = lowestHcp(participants, ctx.course, ctx.tee)
  const adjHcp = adjustedHcp(member, minHcp, ctx.course, ctx.tee)
  const si = holeSI(ctx.course, hole, ctx.tee)
  return gross - strokesOnHole(adjHcp, si)
}

// ─────────────────────────────────────────────────────────────────
// ── SKINS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function computeSkins(ctx, config) {
  const {
    ppt = 5,
    players: pids,
    carry = true,              // carry pot on ties (true) or dead skins (false)
    payoutModel = 'pool',      // 'pool' = pot-based, 'perPlayer' = each player pays ppt per skin won by others
    lastHoleTie = 'carry',     // 'carry' = pot carries (dead), 'split' = tied players split pot on hole 18
    back9Multiplier = false,   // holes 10-18 worth 2x skin value
    hcpMode = 'lowman',        // 'lowman' = low-man adjusted, 'course' = full course HCP
    teamMode = false,          // false = individual, true = 2v2 team skins (best ball per team)
    team1 = [],                // team1 player IDs (when teamMode=true)
    team2 = [],                // team2 player IDs (when teamMode=true)
  } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  const netFn = hcpMode === 'course'
    ? (m, h) => memberNetOnHole(ctx, m, h)
    : (m, h) => memberNetOnHoleLowMan(ctx, m, h, members)

  // ── TEAM MODE: 2v2 best-ball skins ──────────────────────────────
  if (teamMode && team1.length && team2.length) {
    const t1 = ctx.members.filter(m => team1.includes(m.id))
    const t2 = ctx.members.filter(m => team2.includes(m.id))
    const t1Name = t1.map(m => m.short_name).join('+')
    const t2Name = t2.map(m => m.short_name).join('+')

    function teamBestNet(teamMembers, h) {
      const nets = teamMembers.map(m => netFn(m, h)).filter(n => n != null)
      return nets.length ? Math.min(...nets) : null
    }

    const holeResults = []
    let pot = 0
    let potValue = ppt

    for (let h = from; h <= to; h++) {
      const holeVal = (back9Multiplier && h >= 10) ? ppt * 2 : ppt
      const n1 = teamBestNet(t1, h)
      const n2 = teamBestNet(t2, h)

      if (n1 === null || n2 === null) {
        holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'incomplete' })
        if (carry) { pot += holeVal; potValue += holeVal }
        continue
      }

      if (n1 < n2) {
        holeResults.push({ hole: h, winner: 't1', winnerName: t1Name, pot: potValue, n1, n2 })
        pot = 0
        potValue = (back9Multiplier && h >= 10 && h < to) ? ppt * 2 : ppt
      } else if (n2 < n1) {
        holeResults.push({ hole: h, winner: 't2', winnerName: t2Name, pot: potValue, n1, n2 })
        pot = 0
        potValue = (back9Multiplier && h >= 10 && h < to) ? ppt * 2 : ppt
      } else {
        // Tie
        if (h === to && lastHoleTie === 'split') {
          holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'split', splitAmount: potValue / 2, n1, n2 })
        } else if (carry) {
          holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'tie', n1, n2 })
          pot += holeVal
          potValue += holeVal
        } else {
          holeResults.push({ hole: h, winner: null, pot: holeVal, reason: 'dead', n1, n2 })
          pot = 0
          potValue = (back9Multiplier && h >= 10 && h < to) ? ppt * 2 : ppt
        }
      }
    }

    // Team totals
    let t1Skins = 0, t1Winnings = 0, t2Skins = 0, t2Winnings = 0
    for (const hr of holeResults) {
      if (hr.winner === 't1') { t1Skins++; t1Winnings += hr.pot }
      else if (hr.winner === 't2') { t2Skins++; t2Winnings += hr.pot }
      else if (hr.reason === 'split') { t1Winnings += hr.splitAmount; t2Winnings += hr.splitAmount }
    }
    const totalSkins = t1Skins + t2Skins
    const costPerTeam = totalSkins * ppt
    const t1Net = t1Winnings - costPerTeam
    // Pairwise: each player on losing team pays each player on winning team ppt per skin diff
    const skinDiff = Math.abs(t1Skins - t2Skins)
    const settlements = []
    if (skinDiff > 0) {
      const winners = t1Net > 0 ? t1 : t2
      const losers = t1Net > 0 ? t2 : t1
      const winName = t1Net > 0 ? t1Name : t2Name
      const loseName = t1Net > 0 ? t2Name : t1Name
      settlements.push({
        fromName: loseName, toName: winName,
        amount: Math.abs(t1Net),
        skins: skinDiff,
      })
    }
    return {
      holeResults,
      teamMode: true,
      t1Name, t2Name, t1Skins, t2Skins, t1Net,
      settlements, ppt, potValue,
    }
  }

  // ── INDIVIDUAL MODE (default) ────────────────────────────────────
  const holeResults = []
  let pot = 0
  let potValue = ppt

  for (let h = from; h <= to; h++) {
    const nets = members.map(m => ({
      id: m.id,
      name: m.short_name,
      net: netFn(m, h),
    }))

    const holeVal = (back9Multiplier && h >= 10) ? ppt * 2 : ppt
    if (nets.some(n => n.net === null)) {
      holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'incomplete' })
      if (carry) { pot += holeVal; potValue += holeVal }
      continue
    }

    const min = Math.min(...nets.map(n => n.net))
    const winners = nets.filter(n => n.net === min)

    if (winners.length === 1) {
      holeResults.push({ hole: h, winner: winners[0].id, winnerName: winners[0].name, pot: potValue, net: min })
      pot = 0
      potValue = (back9Multiplier && h >= 10 && h < to) ? ppt * 2 : ppt
    } else {
      // Tie
      if (h === to && lastHoleTie === 'split' && winners.length > 0) {
        holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'split', tied: winners.map(w => w.id), splitAmount: potValue / winners.length })
      } else if (carry) {
        holeResults.push({ hole: h, winner: null, pot: potValue, reason: 'tie', tied: winners.map(w => w.id) })
        pot += holeVal
        potValue += holeVal
      } else {
        // Dead skins
        holeResults.push({ hole: h, winner: null, pot: holeVal, reason: 'dead', tied: winners.map(w => w.id) })
        pot = 0
        potValue = (back9Multiplier && h >= 10 && h < to) ? ppt * 2 : ppt
      }
    }
  }

  // Tally winnings
  const totals = {}
  for (const m of members) totals[m.id] = { name: m.short_name, skins: 0, winnings: 0 }
  for (const hr of holeResults) {
    if (hr.winner) {
      totals[hr.winner].skins += 1
      totals[hr.winner].winnings += hr.pot
    } else if (hr.reason === 'split' && hr.tied) {
      for (const tid of hr.tied) {
        totals[tid].winnings += hr.splitAmount
      }
    }
  }

  // Settlement
  if (payoutModel === 'perPlayer') {
    const totalSkins = Object.values(totals).reduce((s, t) => s + t.skins, 0)
    const settlements = members.map(m => {
      const mySkins = totals[m.id].skins
      const othersSkins = totalSkins - mySkins
      return {
        id: m.id,
        name: m.short_name,
        skins: mySkins,
        net: (mySkins * ppt * (members.length - 1)) - (othersSkins * ppt),
      }
    })
    return { holeResults, totals, settlements, potValue, ppt, payoutModel }
  }

  // Pool model (default)
  const totalSkins = Object.values(totals).reduce((s, t) => s + t.skins, 0)
  const perPlayerCost = totalSkins * ppt
  const settlements = members.map(m => ({
    id: m.id,
    name: m.short_name,
    skins: totals[m.id].skins,
    net: totals[m.id].winnings - perPlayerCost,
  }))

  return { holeResults, totals, settlements, potValue, ppt, payoutModel }
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
    hcpMode = 'lowman',  // 'lowman' or 'course'
  } = config

  const t1 = ctx.members.filter(m => team1.includes(m.id))
  const t2 = ctx.members.filter(m => team2.includes(m.id))
  const allPlayers = [...t1, ...t2]

  const netFn = hcpMode === 'course'
    ? (m, h) => memberNetOnHole(ctx, m, h)
    : (m, h) => memberNetOnHoleLowMan(ctx, m, h, allPlayers)

  function bestNetOnHole(teamMembers, hole) {
    const nets = teamMembers.map(m => netFn(m, hole)).filter(n => n != null)
    if (!nets.length) return null
    return Math.min(...nets)
  }

  function processSegment(fromH, toH, betValue) {
    const holeResults = []
    // Each bet: { start, score (positive=t1 leading), value, pressed }
    const bets = [{ start: fromH, score: 0, value: betValue, pressed: false }]

    for (let h = fromH; h <= toH; h++) {
      const n1 = bestNetOnHole(t1, h)
      const n2 = bestNetOnHole(t2, h)

      if (n1 === null || n2 === null) {
        holeResults.push({ hole: h, winner: null, n1: null, n2: null })
        continue
      }

      let holeWinner = null
      if (n1 < n2) holeWinner = 't1'
      else if (n2 < n1) holeWinner = 't2'

      // Update all active bets
      for (const bet of bets) {
        if (h < bet.start) continue
        if (holeWinner === 't1') bet.score += 1
        else if (holeWinner === 't2') bet.score -= 1
      }

      holeResults.push({ hole: h, winner: holeWinner, n1, n2 })

      // Check for new press: any active bet where trailing team is down by pressAt
      if (pressAt > 0) {
        const rem = toH - h
        const newPresses = []
        for (const bet of bets) {
          if (bet.pressed) continue // already pressed this bet
          if (h < bet.start) continue
          // A team presses when they're down by pressAt on THIS bet.
          // Require rem > 1 so a press never auto-opens on the very last hole
          // (hole 18 / hole 9): that's Aloha, which is a manual optional bet.
          if (Math.abs(bet.score) >= pressAt && rem > 1) {
            bet.pressed = true
            newPresses.push({ start: h + 1, score: 0, value: betValue, pressed: false })
          }
        }
        bets.push(...newPresses)
      }
    }

    // Compute running t1Up for display
    let runUp = 0
    for (const hr of holeResults) {
      if (hr.winner === 't1') runUp++
      else if (hr.winner === 't2') runUp--
      hr.t1Up = runUp
    }

    const t1UpFinal = holeResults.length ? holeResults.at(-1).t1Up : 0

    // Settlement: main bet = bets[0], presses = bets[1..]
    const mainBet = bets[0]
    const t1Wins = mainBet.score > 0 ? betValue : mainBet.score < 0 ? -betValue : 0

    let pressWins = 0
    const presses = []
    for (let i = 1; i < bets.length; i++) {
      const b = bets[i]
      presses.push({ start: b.start, value: b.value, score: b.score })
      pressWins += b.score > 0 ? b.value : b.score < 0 ? -b.value : 0
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

  // Aloha: side bet on hole 18 winner
  let aloha = null
  const alohaCfg = config.aloha
  if (alohaCfg?.status === 'accepted' && alohaCfg?.amount != null) {
    const lastHole = backSeg.holeResults.at(-1)  // hole 18 (or hole 9 for back9)
    if (lastHole && lastHole.n1 !== null && lastHole.n2 !== null) {
      // Resolved even on a halved hole (winner null = tie = 0 delta)
      const t1Delta = lastHole.winner === 't1' ? alohaCfg.amount
                    : lastHole.winner === 't2' ? -alohaCfg.amount
                    : 0  // halved
      aloha = { winner: lastHole.winner ?? 'halved', amount: alohaCfg.amount, t1Delta }
    }
  }
  const alohaDelta = aloha?.t1Delta ?? 0

  const settlement = {
    t1Name, t2Name,
    front: frontSeg.t1Wins + frontSeg.pressWins,
    back: backSeg.t1Wins + backSeg.pressWins,
    overall: overallT1Wins,
    aloha: alohaDelta,
    total: t1Total + alohaDelta,
    // positive = t1 wins that amount from t2
  }

  return {
    frontSeg, backSeg, overallUp, overallT1Wins, settlement,
    t1, t2, t1Name, t2Name, aloha,
  }
}

// ─────────────────────────────────────────────────────────────────
// ── MATCH PLAY (1v1 or 2v2) ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
export function computeMatch(ctx, config) {
  const {
    player1, player2,
    ppt = 10,
    hcpMode = 'lowman',
    scoring = 'closeout',  // 'closeout' (default): stake paid once on win. 'nassau': per-hole value. 'skins': each won hole pays ppt
    closeoutBonus = 0,     // $ bonus paid by loser if match ends early (closeout only)
  } = config
  const m1 = ctx.members.find(m => m.id === player1)
  const m2 = ctx.members.find(m => m.id === player2)
  if (!m1 || !m2) return null
  const matchPlayers = [m1, m2]

  const netFn = hcpMode === 'course'
    ? (m, h) => memberNetOnHole(ctx, m, h)
    : (m, h) => memberNetOnHoleLowMan(ctx, m, h, matchPlayers)

  const { from, to } = holeRange(ctx.holesMode)
  const holeResults = []
  let p1Up = 0
  let p1HolesWon = 0
  let p2HolesWon = 0

  for (let h = from; h <= to; h++) {
    const n1 = netFn(m1, h)
    const n2 = netFn(m2, h)

    if (n1 === null || n2 === null) {
      holeResults.push({ hole: h, winner: null, p1Up, incomplete: true })
      continue
    }

    let winner = null
    if (n1 < n2) { winner = 'p1'; p1Up += 1; p1HolesWon += 1 }
    else if (n2 < n1) { winner = 'p2'; p1Up -= 1; p2HolesWon += 1 }
    holeResults.push({ hole: h, winner, p1Up, n1, n2 })
  }

  const holesLeft = holeResults.filter(r => r.incomplete).length
  const playedHoles = holeResults.filter(r => !r.incomplete)
  const lastPlayed = playedHoles.at(-1)
  const finalUp = lastPlayed?.p1Up ?? 0
  const holesRemaining = holeResults.filter(r => r.hole > (lastPlayed?.hole ?? 0)).length + holesLeft

  // Match over when |up| > remaining
  const matchOver = Math.abs(finalUp) > holesRemaining
  const isDormie = !matchOver && holesRemaining > 0 && Math.abs(finalUp) === holesRemaining
  const result = matchOver
    ? (finalUp > 0 ? `${finalUp}&${holesRemaining}` : `${-finalUp}&${holesRemaining}`)
    : isDormie
      ? (finalUp > 0 ? `${finalUp} UP (Dormie)` : `${-finalUp} DOWN (Dormie)`)
      : (finalUp > 0 ? `${finalUp} UP` : finalUp < 0 ? `${-finalUp} DOWN` : 'A/S')

  // Settlement computation depends on scoring mode:
  // - closeout: fixed stake paid by loser; halved = 0 (+ optional closeoutBonus if match ended early)
  // - nassau: winner gets ppt × final up count
  // - skins: each won hole pays ppt (so p1Net = (p1HolesWon - p2HolesWon) × ppt)
  let p1Net = 0
  if (scoring === 'nassau') {
    p1Net = finalUp * ppt
  } else if (scoring === 'skins') {
    p1Net = (p1HolesWon - p2HolesWon) * ppt
  } else {
    // closeout (default)
    const bonus = matchOver && closeoutBonus > 0 ? closeoutBonus : 0
    p1Net = finalUp > 0 ? (ppt + bonus) : finalUp < 0 ? -(ppt + bonus) : 0
  }

  return {
    holeResults, finalUp, result, matchOver, isDormie,
    p1: { id: m1.id, name: m1.short_name },
    p2: { id: m2.id, name: m2.short_name },
    p1HolesWon, p2HolesWon,
    settlement: { p1Name: m1.short_name, p2Name: m2.short_name, p1Net, ppt, scoring, closeoutBonus },
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
  const allPlayers = [...t1, ...t2]
  const { from, to } = holeRange(ctx.holesMode)

  function teamScore(teamMembers, hole) {
    const nets = teamMembers.map(m => memberNetOnHoleLowMan(ctx, m, hole, allPlayers)).filter(n => n != null).sort((a, b) => a - b)
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
// Event-based: 3-putt = you hold the snake.
// Events recorded manually during the round via tap UI.
// Payout: holder at end of round owes $ppt × total snakes to the group.
// config.events = [{ hole, pid, ts }]
// ─────────────────────────────────────────────────────────────────
export function computeSnake(ctx, config) {
  const { ppt = 5 } = config
  const members = ctx.members
  const events = config.events || []

  // Current holder = last event's pid
  const holder = events.length ? events[events.length - 1].pid : null
  const snakeCount = events.length

  // Per-player snake count
  const perPlayer = {}
  for (const m of members) perPlayer[m.id] = { name: m.short_name, snakes: 0 }
  for (const ev of events) {
    if (perPlayer[ev.pid]) perPlayer[ev.pid].snakes += 1
  }

  // Settlement: the current holder (last to 3-putt) owes everyone else
  // ppt × snakeCount. All other players collect that amount.
  const othersCount = members.length - 1
  const totalOwed = snakeCount * ppt
  const settlements = members.map(m => {
    const isHolder = m.id === holder
    return {
      id: m.id,
      name: m.short_name,
      snakes: perPlayer[m.id]?.snakes || 0,
      net: isHolder ? -(totalOwed * othersCount) : totalOwed,
    }
  })

  return { holder, holderName: holder ? (perPlayer[holder]?.name || '?') : null, snakeCount, perPlayer, events, settlements, ppt }
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
    barkieEnabled = false,  // hit a tree AND make par
    arnieEnabled = false,   // miss fairway AND make par
    ferretEnabled = false,  // hole out from off green
    negativeEnabled = false,// water/OB costs a dot
    netBirdie = true,       // true=net birdie/eagle, false=gross
    // manual: { [memberId+'-'+hole+'-'+type]: true|false }
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
      const strokes = strokesOnHole(hcp, si)
      const net = gross != null ? gross - strokes : null
      const scoreVsPar = netBirdie ? net : gross  // which score to use for birdie/eagle

      if (net === null) continue

      // Birdie/Eagle
      if (eagleEnabled && scoreVsPar != null && scoreVsPar <= par - 2) {
        dots[m.id].dots += 2
        dots[m.id].amount += ppt * 2
        dots[m.id].breakdown.push({ hole: h, type: netBirdie ? 'Eagle (net)' : 'Eagle', pts: 2 })
      } else if (birdieEnabled && scoreVsPar != null && scoreVsPar === par - 1) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: netBirdie ? 'Birdie (net)' : 'Birdie', pts: 1 })
      }

      // Greenie: par 3, closest to pin (manual)
      const greenKey = `${m.id}-${h}-greenie`
      if (greenieEnabled && par === 3 && manual[greenKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Greenie', pts: 1 })
      }

      // Sandy: up-and-down from bunker (manual)
      const sandKey = `${m.id}-${h}-sandy`
      if (sandieEnabled && manual[sandKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Sandy', pts: 1 })
      }

      // Chip-in (manual)
      const chipKey = `${m.id}-${h}-chipin`
      if (chipinEnabled && manual[chipKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Chip-in', pts: 1 })
      }

      // Barkie: hit tree + make par (manual)
      const barkKey = `${m.id}-${h}-barkie`
      if (barkieEnabled && manual[barkKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Barkie', pts: 1 })
      }

      // Arnie: miss fairway + make par (manual)
      const arnieKey = `${m.id}-${h}-arnie`
      if (arnieEnabled && manual[arnieKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Arnie', pts: 1 })
      }

      // Ferret: hole out from off green (manual)
      const ferretKey = `${m.id}-${h}-ferret`
      if (ferretEnabled && manual[ferretKey]) {
        dots[m.id].dots += 1
        dots[m.id].amount += ppt
        dots[m.id].breakdown.push({ hole: h, type: 'Ferret', pts: 1 })
      }

      // Negative: water/OB costs a dot (manual)
      const negKey = `${m.id}-${h}-negative`
      if (negativeEnabled && manual[negKey]) {
        dots[m.id].dots -= 1
        dots[m.id].amount -= ppt
        dots[m.id].breakdown.push({ hole: h, type: 'OB/Water', pts: -1 })
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
// ── Internal helper: run fidget logic over a hole range ──────────
function _runFidget(ctx, members, from, to, ppp) {
  const hasWon = {}
  const holeLog = []
  for (const m of members) hasWon[m.id] = false

  for (let h = from; h <= to; h++) {
    const nets = members.map(m => ({ id: m.id, net: memberNetOnHoleLowMan(ctx, m, h, members) }))
    if (nets.some(n => n.net === null)) {
      holeLog.push({ hole: h, winner: null, incomplete: true })
      continue
    }
    const min = Math.min(...nets.map(n => n.net))
    const minWinners = nets.filter(n => n.net === min)
    if (minWinners.length === 1) {
      hasWon[minWinners[0].id] = true
      holeLog.push({ hole: h, winner: minWinners[0].id })
    } else {
      holeLog.push({ hole: h, winner: null, tied: minWinners.map(w => w.id) })
    }
  }

  const fidgeters = members.filter(m => !hasWon[m.id])
  const winners = members.filter(m => hasWon[m.id])
  const settlements = []
  for (const loser of fidgeters) {
    for (const other of members) {
      if (other.id === loser.id) continue
      settlements.push({ from: loser.id, fromName: loser.short_name, to: other.id, toName: other.short_name, amount: ppp })
    }
  }
  return { hasWon, holeLog, fidgeters, winners, settlements }
}

export function computeFidget(ctx, config) {
  const { ppp = 10, players: pids, doubleFidget = false, fidget2Active = false, fidget2StartHole = null } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  // Fidget 1: always runs full range
  const f1 = _runFidget(ctx, members, from, to, ppp)

  // Find the earliest hole where all players have won at least once
  const allClearedHole = (() => {
    if (!doubleFidget) return null
    const wonBy = {}
    for (const m of members) wonBy[m.id] = false
    for (const hl of f1.holeLog) {
      if (hl.winner) wonBy[hl.winner] = true
      if (members.every(m => wonBy[m.id])) return hl.hole
    }
    return null
  })()

  // Fidget 2: runs from fidget2StartHole to end if group confirmed it
  let f2 = null
  if (doubleFidget && fidget2Active && fidget2StartHole != null) {
    f2 = _runFidget(ctx, members, fidget2StartHole, to, ppp)
  }

  // Merge settlements: fidget1 + fidget2 (if active)
  const settlements = [...f1.settlements, ...(f2 ? f2.settlements : [])]

  return {
    hasWon: f1.hasWon,
    holeLog: f1.holeLog,
    fidgeters: f1.fidgeters,
    winners: f1.winners,
    settlements,
    ppp,
    doubleFidget,
    allClearedHole,
    fidget2Active,
    fidget2StartHole,
    fidget2: f2,
  }
}

// ─────────────────────────────────────────────────────────────────
// ── AGGREGATE BEST BALL (group lowest N net) ─────────────────────
// For tracking group-wide best ball net total across 18 holes.
// ─────────────────────────────────────────────────────────────────
export function computeBestBallNet(ctx, config = {}) {
  const { ballsToCount = 1, scoring = 'net', players: pids } = config
  const useGross = scoring === 'gross'
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  const holeResults = []
  let totalScore = 0
  let parTotal = 0

  for (let h = from; h <= to; h++) {
    const par = holePar(ctx.course, h)
    const scores = members
      .map(m => {
        const gross = getScore(ctx, m.id, h)
        if (gross == null) return null
        const val = useGross ? gross : memberNetOnHole(ctx, m, h)
        return { id: m.id, name: m.short_name, score: val }
      })
      .filter(n => n != null)
      .sort((a, b) => a.score - b.score)

    if (scores.length === 0) {
      holeResults.push({ hole: h, scores: [], countedScores: [], sum: null, toPar: null })
      continue
    }

    const counted = scores.slice(0, ballsToCount)
    const sum = counted.reduce((s, n) => s + n.score, 0)
    const parBasis = par * ballsToCount
    totalScore += sum
    parTotal += parBasis

    holeResults.push({
      hole: h,
      par,
      scores,
      countedScores: counted,
      sum,
      toPar: sum - parBasis,
    })
  }

  const overallToPar = totalScore - parTotal

  return { holeResults, totalScore, totalNet: totalScore, parTotal, overallToPar, ballsToCount, scoring }
}

// ─────────────────────────────────────────────────────────────────
// ── VEGAS ────────────────────────────────────────────────────────
// Team game: combine scores into 2-digit numbers (low tens, high ones)
// ─────────────────────────────────────────────────────────────────
export function computeVegas(ctx, config) {
  const {
    team1 = [], team2 = [],
    ppt = 1,                   // $ per point difference
    birdieFlip = true,         // flip opponent's number on birdie
    eagleFlip = true,          // flip + double on eagle
    doubleBirdie = false,      // double the diff when both teammates birdie
    penaltyThreshold = 0,      // "7-flip": if a player scores >= this, flip their team's number (0 = off)
    scoring = 'net',
    hcpMode = 'lowman',
  } = config
  const useGross = scoring === 'gross'

  const t1 = ctx.members.filter(m => team1.includes(m.id))
  const t2 = ctx.members.filter(m => team2.includes(m.id))
  const allPlayers = [...t1, ...t2]
  const { from, to } = holeRange(ctx.holesMode)

  function playerScore(m, hole) {
    if (useGross) return getScore(ctx, m.id, hole)
    if (hcpMode === 'course') return memberNetOnHole(ctx, m, hole)
    return memberNetOnHoleLowMan(ctx, m, hole, allPlayers)
  }

  function teamVegasNumber(teamMembers, hole) {
    const nets = teamMembers
      .map(m => playerScore(m, hole))
      .filter(n => n != null)
    if (nets.length < 2) return null
    const sorted = [...nets].sort((a, b) => a - b)
    const lo = Math.max(sorted[0], 1)
    const hi = Math.max(sorted[1], 1)
    return lo * 10 + hi
  }

  function flipNumber(num) {
    if (num == null) return null
    const lo = Math.floor(num / 10)
    const hi = num % 10
    return hi * 10 + lo
  }

  const holeResults = []
  let t1Total = 0
  let t2Total = 0

  for (let h = from; h <= to; h++) {
    let n1 = teamVegasNumber(t1, h)
    let n2 = teamVegasNumber(t2, h)

    if (n1 === null || n2 === null) {
      holeResults.push({ hole: h, incomplete: true, t1Num: null, t2Num: null, diff: 0 })
      continue
    }

    const par = holePar(ctx.course, h)
    let holeMultiplier = 1
    let anyVariant = false

    // Penalty threshold (7-flip): if any player scored gross >= threshold, flip their team's number
    if (penaltyThreshold > 0) {
      const t1HasPenalty = t1.some(m => { const g = getScore(ctx, m.id, h); return g != null && g >= penaltyThreshold })
      const t2HasPenalty = t2.some(m => { const g = getScore(ctx, m.id, h); return g != null && g >= penaltyThreshold })
      if (t1HasPenalty && !t2HasPenalty) { n1 = flipNumber(n1); anyVariant = true }
      else if (t2HasPenalty && !t1HasPenalty) { n2 = flipNumber(n2); anyVariant = true }
    }

    // Birdie/Eagle flip logic uses net scores (playerScore) — net Vegas uses net birdies/eagles.
    const t1BirdieCount = t1.filter(m => { const n = playerScore(m, h); return n != null && n <= par - 1 }).length
    const t2BirdieCount = t2.filter(m => { const n = playerScore(m, h); return n != null && n <= par - 1 }).length
    const t1HasEagle = eagleFlip && t1.some(m => { const n = playerScore(m, h); return n != null && n <= par - 2 })
    const t2HasEagle = eagleFlip && t2.some(m => { const n = playerScore(m, h); return n != null && n <= par - 2 })

    let flipReason = null
    if (t1HasEagle && !t2HasEagle) {
      n2 = flipNumber(n2); holeMultiplier = 2; anyVariant = true; flipReason = 't1eagle'
    } else if (t2HasEagle && !t1HasEagle) {
      n1 = flipNumber(n1); holeMultiplier = 2; anyVariant = true; flipReason = 't2eagle'
    } else if (birdieFlip) {
      const t1HasBirdie = t1BirdieCount > 0
      const t2HasBirdie = t2BirdieCount > 0
      if (t1HasBirdie && !t2HasBirdie) { n2 = flipNumber(n2); anyVariant = true; flipReason = 't1birdie' }
      else if (t2HasBirdie && !t1HasBirdie) { n1 = flipNumber(n1); anyVariant = true; flipReason = 't2birdie' }
    }

    // Double-birdie: both teammates birdie = double the diff
    if (doubleBirdie && t1BirdieCount >= 2) { holeMultiplier = Math.max(holeMultiplier, 2); anyVariant = true; if (!flipReason) flipReason = 't1dbl' }
    if (doubleBirdie && t2BirdieCount >= 2) { holeMultiplier = Math.max(holeMultiplier, 2); anyVariant = true; if (!flipReason) flipReason = 't2dbl' }

    const diff = (n2 - n1) * holeMultiplier
    t1Total += diff
    holeResults.push({ hole: h, t1Num: n1, t2Num: n2, diff, multiplier: holeMultiplier, variant: anyVariant, flipReason })
  }

  const t1Net = t1Total * ppt

  return {
    holeResults,
    t1Total, t2Total: -t1Total,
    t1Name: t1.map(m => m.short_name).join('+'),
    t2Name: t2.map(m => m.short_name).join('+'),
    settlement: {
      t1Net,
      ppt,
      t1Name: t1.map(m => m.short_name).join('+'),
      t2Name: t2.map(m => m.short_name).join('+'),
    },
  }
}

// ─────────────────────────────────────────────────────────────────
// ── HI-LOW ──────────────────────────────────────────────────────
// Team game: compare best (low) and worst (high) ball per hole
// ─────────────────────────────────────────────────────────────────
export function computeHiLow(ctx, config) {
  const {
    team1 = [], team2 = [],
    ppt = 5,               // $ per point
    carryOnTie = true,     // carry points on tie to next hole
    birdieDouble = false,  // birdie on low ball doubles the point value for that hole
    aggregatePoint = true, // include aggregate (3rd) point per hole
    hcpMode = 'lowman',
  } = config

  const t1 = ctx.members.filter(m => team1.includes(m.id))
  const t2 = ctx.members.filter(m => team2.includes(m.id))
  const allPlayers = [...t1, ...t2]
  const { from, to } = holeRange(ctx.holesMode)

  const netFn = hcpMode === 'course'
    ? (m, h) => memberNetOnHole(ctx, m, h)
    : (m, h) => memberNetOnHoleLowMan(ctx, m, h, allPlayers)

  const holeResults = []
  let t1Pts = 0
  let t2Pts = 0
  let lowCarry = 0
  let highCarry = 0
  let aggCarry = 0

  for (let h = from; h <= to; h++) {
    const t1Nets = t1.map(m => netFn(m, h)).filter(n => n != null).sort((a, b) => a - b)
    const t2Nets = t2.map(m => netFn(m, h)).filter(n => n != null).sort((a, b) => a - b)

    if (t1Nets.length < 1 || t2Nets.length < 1) {
      holeResults.push({ hole: h, incomplete: true })
      continue
    }

    const t1Low = t1Nets[0]
    const t1High = t1Nets[t1Nets.length - 1]
    const t2Low = t2Nets[0]
    const t2High = t2Nets[t2Nets.length - 1]
    const par = holePar(ctx.course, h)

    // Birdie bonus: check if the winning low-ball is a birdie or better
    let lowMultiplier = 1
    if (birdieDouble) {
      const bestLow = Math.min(t1Low, t2Low)
      if (bestLow <= par - 1) lowMultiplier = 2
    }

    // Low ball point
    let lowWin = null
    const lowPts = (1 + lowCarry) * lowMultiplier
    if (t1Low < t2Low) { lowWin = 't1'; t1Pts += lowPts; lowCarry = 0 }
    else if (t2Low < t1Low) { lowWin = 't2'; t2Pts += lowPts; lowCarry = 0 }
    else if (carryOnTie) { lowCarry += 1 }
    else { lowCarry = 0 }

    // High ball point
    let highWin = null
    const highPts = 1 + highCarry
    if (t1High < t2High) { highWin = 't1'; t1Pts += highPts; highCarry = 0 }
    else if (t2High < t1High) { highWin = 't2'; t2Pts += highPts; highCarry = 0 }
    else if (carryOnTie) { highCarry += 1 }
    else { highCarry = 0 }

    // Aggregate point (optional)
    const t1Agg = t1Low + t1High
    const t2Agg = t2Low + t2High
    let aggWin = null
    if (aggregatePoint) {
      const aggPts = 1 + aggCarry
      if (t1Agg < t2Agg) { aggWin = 't1'; t1Pts += aggPts; aggCarry = 0 }
      else if (t2Agg < t1Agg) { aggWin = 't2'; t2Pts += aggPts; aggCarry = 0 }
      else if (carryOnTie) { aggCarry += 1 }
      else { aggCarry = 0 }
    } else {
      aggCarry = 0  // reset regardless when agg is off
    }

    holeResults.push({
      hole: h, t1Low, t1High, t2Low, t2High, t1Agg, t2Agg,
      lowWin, highWin, aggWin, lowMultiplier,
    })
  }

  const ptDiff = t1Pts - t2Pts
  const t1Net = ptDiff * ppt

  return {
    holeResults, t1Pts, t2Pts,
    t1Name: t1.map(m => m.short_name).join('+'),
    t2Name: t2.map(m => m.short_name).join('+'),
    settlement: {
      t1Net, ppt, t1Pts, t2Pts,
      t1Name: t1.map(m => m.short_name).join('+'),
      t2Name: t2.map(m => m.short_name).join('+'),
    },
  }
}

// ─────────────────────────────────────────────────────────────────
// ── STABLEFORD ──────────────────────────────────────────────────
// Point-based scoring per hole relative to par
// ─────────────────────────────────────────────────────────────────
export function computeStableford(ctx, config) {
  const {
    ppt = 1,       // $ per point
    variant = 'standard', // 'standard', 'modified', or custom via pts
    pts: customPts,        // optional custom pts map: { eagle, birdie, par, bogey, double }
    players: pids,
    teamMode = 'individual', // 'individual', 'aggregate' (sum team pts), 'bestball' (best per hole)
    team1 = [], team2 = [],
    hcpMode = 'lowman',
  } = config

  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members
  const { from, to } = holeRange(ctx.holesMode)

  // Point tables: custom overrides variant defaults
  const STD_PTS  = { eagle: 4, birdie: 3, par: 2, bogey: 1, double: 0 }
  const MOD_PTS  = { eagle: 5, birdie: 2, par: 0, bogey: -1, double: -3 }
  const variantPts = variant === 'modified' ? MOD_PTS : STD_PTS
  const ptsTable = customPts ? { ...variantPts, ...customPts } : variantPts

  function stablefordPoints(net, par) {
    const diff = net - par
    if (diff <= -2) return ptsTable.eagle  // eagle or better
    if (diff === -1) return ptsTable.birdie // birdie
    if (diff === 0)  return ptsTable.par    // par
    if (diff === 1)  return ptsTable.bogey  // bogey
    return ptsTable.double                  // double bogey or worse
  }

  const playerResults = {}
  for (const m of members) {
    playerResults[m.id] = { name: m.short_name, holePoints: [], totalPoints: 0 }
  }

  for (let h = from; h <= to; h++) {
    const par = holePar(ctx.course, h)
    for (const m of members) {
      const net = memberNetOnHole(ctx, m, h)
      if (net === null) {
        playerResults[m.id].holePoints.push({ hole: h, pts: null })
        continue
      }
      const pts = stablefordPoints(net, par)
      playerResults[m.id].holePoints.push({ hole: h, pts })
      playerResults[m.id].totalPoints += pts
    }
  }

  // Rank players by total points (descending)
  const ranked = members
    .map(m => ({ id: m.id, name: m.short_name, pts: playerResults[m.id].totalPoints }))
    .sort((a, b) => b.pts - a.pts)

  // Settlement: each player gets/loses ppt per point difference from average
  const avgPts = ranked.reduce((s, r) => s + r.pts, 0) / members.length
  const settlements = members.map(m => ({
    id: m.id,
    name: m.short_name,
    pts: playerResults[m.id].totalPoints,
    net: Math.round((playerResults[m.id].totalPoints - avgPts) * ppt * 100) / 100,
  }))

  return { playerResults, ranked, settlements, ppt, variant }
}

// ─────────────────────────────────────────────────────────────────
// ── WOLF ────────────────────────────────────────────────────────
// Rotating wolf picks partner or goes lone each hole
// ─────────────────────────────────────────────────────────────────
export function computeWolf(ctx, config) {
  const {
    ppt = 1,
    wolfLoneMultiplier = 4,      // lone wolf multiplier (default 4×)
    blindWolfMultiplier = 8,     // blind wolf multiplier (default 8×)
    wolfTeesFirst = true,        // wolf tees FIRST (true) or LAST (false)
    wolfTeeOrder = [],           // explicit tee order: array of member IDs
    hcpMode = 'lowman',
    tieRule = 'push',            // 'push' | 'wolfLoses' | 'carryOver'
    players: pids,
  } = config

  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members

  if (members.length < 3) return null

  // Build rotation using wolfTeeOrder if set, else member join order
  const rotationIds = wolfTeeOrder.length >= members.length
    ? wolfTeeOrder.slice(0, members.length)
    : members.map(m => m.id)
  const rotation = rotationIds.map(id => members.find(m => m.id === id)).filter(Boolean)
  const orderedMembers = rotation.length >= members.length ? rotation : members

  const { from, to } = holeRange(ctx.holesMode)
  const n = members.length
  const holeResults = []
  const totals = {}
  let carry = 0   // accumulated pot for tieRule='carryOver'
  for (const m of members) totals[m.id] = { name: m.short_name, net: 0 }

  // wolfChoices: { [hole]: { partner: memberId | 'lone' | 'blind' } }
  const wolfChoices = config.wolfChoices || {}

  for (let h = from; h <= to; h++) {
    const wolfIdx = (h - from) % orderedMembers.length
    const wolf = orderedMembers[wolfIdx]
    const choice = wolfChoices[h]
    const isLone = choice?.partner === 'lone'
    const isBlind = choice?.partner === 'blind'
    const partnerId = (!isLone && !isBlind) ? choice?.partner : null
    const partner = partnerId ? members.find(m => m.id === partnerId) : null

    // Get all net scores
    const wolfNetFn = hcpMode === 'course'
      ? (m, hole) => memberNetOnHole(ctx, m, hole)
      : (m, hole) => memberNetOnHoleLowMan(ctx, m, hole, members)
    const nets = {}
    let allScored = true
    for (const m of members) {
      const net = wolfNetFn(m, h)
      if (net === null) allScored = false
      nets[m.id] = net
    }

    if (!allScored || !choice) {
      holeResults.push({
        hole: h, wolf: wolf.id, wolfName: wolf.short_name,
        partner: partnerId, partnerName: partner?.short_name,
        isLone: isLone || false, isBlind: isBlind || false, wolfTeesFirst,
        winner: null, incomplete: true,
      })
      continue
    }

    if (isLone || isBlind) {
      // Lone/Blind wolf: wolf vs all others
      const wolfNet = nets[wolf.id]
      const others = members.filter(m => m.id !== wolf.id)
      const otherBest = Math.min(...others.map(m => nets[m.id]))
      const mult = isBlind ? blindWolfMultiplier : wolfLoneMultiplier

      let winner = null
      if (wolfNet < otherBest) {
        winner = 'wolf'
        const winAmount = ppt * mult + carry
        carry = 0
        totals[wolf.id].net += winAmount * (n - 1)
        for (const o of others) totals[o.id].net -= winAmount
      } else if (otherBest < wolfNet) {
        winner = 'field'
        const loseAmount = ppt * mult + carry
        carry = 0
        totals[wolf.id].net -= loseAmount * (n - 1)
        for (const o of others) totals[o.id].net += loseAmount
      } else {
        // Tie
        if (tieRule === 'wolfLoses') {
          winner = 'field'
          const loseAmount = ppt * mult + carry
          carry = 0
          totals[wolf.id].net -= loseAmount * (n - 1)
          for (const o of others) totals[o.id].net += loseAmount
        } else if (tieRule === 'carryOver') {
          carry += ppt * mult
        }
        // push: no money moves
      }

      holeResults.push({
        hole: h, wolf: wolf.id, wolfName: wolf.short_name,
        isLone, isBlind, winner,
        wolfNet, otherBest, multiplier: mult,
      })
    } else {
      // Wolf + partner vs others
      const wolfTeam = [wolf, partner].filter(Boolean)
      const others = members.filter(m => m.id !== wolf.id && m.id !== partnerId)

      const wolfBest = Math.min(...wolfTeam.map(m => nets[m.id]))
      const otherBest = Math.min(...others.map(m => nets[m.id]))

      let winner = null
      if (wolfBest < otherBest) {
        winner = 'wolf'
        // Distribute any carry evenly per opponent won
        const perOpp = ppt + carry / Math.max(others.length, 1)
        carry = 0
        for (const w of wolfTeam) totals[w.id].net += perOpp * others.length
        for (const o of others) totals[o.id].net -= perOpp * wolfTeam.length
      } else if (otherBest < wolfBest) {
        winner = 'field'
        const perOpp = ppt + carry / Math.max(wolfTeam.length, 1)
        carry = 0
        for (const w of wolfTeam) totals[w.id].net -= perOpp * others.length
        for (const o of others) totals[o.id].net += perOpp * wolfTeam.length
      } else {
        // Tie
        if (tieRule === 'wolfLoses') {
          winner = 'field'
          const perOpp = ppt + carry / Math.max(wolfTeam.length, 1)
          carry = 0
          for (const w of wolfTeam) totals[w.id].net -= perOpp * others.length
          for (const o of others) totals[o.id].net += perOpp * wolfTeam.length
        } else if (tieRule === 'carryOver') {
          carry += ppt
        }
        // push: no money moves
      }

      holeResults.push({
        hole: h, wolf: wolf.id, wolfName: wolf.short_name,
        partner: partnerId, partnerName: partner?.short_name,
        isLone: false, winner,
        wolfBest, otherBest,
      })
    }
  }

  const settlements = members.map(m => ({
    id: m.id, name: m.short_name, net: totals[m.id].net,
  }))

  return { holeResults, totals, settlements, ppt, wolfTeesFirst, tieRule, carry, rotationOrder: orderedMembers.map(m => m.id) }
}

// ─────────────────────────────────────────────────────────────────
// ── HAMMER ──────────────────────────────────────────────────────
// Teams throw hammer to double the bet per hole
// airHammer: throw before tee shot; fuHammer: counter-hammer + retain;
// birdieDouble: auto-double if winner birdied; carryover: tie carries value
// ─────────────────────────────────────────────────────────────────
export function computeHammer(ctx, config) {
  const {
    team1 = [], team2 = [],
    ppt = 1,
    airHammer = false,
    fuHammer = false,
    birdieDouble = false,
    carryover = false,
  } = config

  const t1 = ctx.members.filter(m => team1.includes(m.id))
  const t2 = ctx.members.filter(m => team2.includes(m.id))
  const allPlayers = [...t1, ...t2]
  const { from, to } = holeRange(ctx.holesMode)

  // hammerLog: { [hole]: { throws: number, conceded: boolean, concededBy: 't1'|'t2', holder: 't1'|'t2' } }
  const hammerLog = config.hammerLog || {}

  function bestNet(teamMembers, hole) {
    const nets = teamMembers.map(m => memberNetOnHoleLowMan(ctx, m, hole, allPlayers)).filter(n => n != null)
    if (!nets.length) return null
    return Math.min(...nets)
  }

  function bestGross(teamMembers, hole) {
    const scores = teamMembers.map(m => getScore(ctx, m.id, hole)).filter(s => s != null)
    if (!scores.length) return null
    return Math.min(...scores)
  }

  const holeResults = []
  let t1Total = 0
  let carryAmt = 0

  for (let h = from; h <= to; h++) {
    const log = hammerLog[h] || { throws: 0, conceded: false, holder: 't1' }
    const mult = Math.pow(2, log.throws)
    let holeValue = ppt * mult + carryAmt

    if (log.conceded) {
      const concededValue = ppt * Math.pow(2, Math.max(0, log.throws - 1)) + carryAmt
      const t1Wins = log.concededBy === 't2' ? concededValue : -concededValue
      t1Total += t1Wins
      carryAmt = 0
      holeResults.push({ hole: h, conceded: true, concededBy: log.concededBy, holeValue: concededValue, t1Wins })
      continue
    }

    const n1 = bestNet(t1, h)
    const n2 = bestNet(t2, h)

    if (n1 === null || n2 === null) {
      holeResults.push({ hole: h, incomplete: true, holeValue })
      continue
    }

    let finalValue = holeValue
    if (birdieDouble) {
      const par1 = holePar(ctx.course, h)
      const g1 = bestGross(t1, h)
      const g2 = bestGross(t2, h)
      if (n1 < n2 && g1 != null && g1 <= par1 - 1) finalValue *= 2
      if (n2 < n1 && g2 != null && g2 <= par1 - 1) finalValue *= 2
    }

    let winner = null
    let t1Wins = 0
    if (n1 < n2) { winner = 't1'; t1Wins = finalValue }
    else if (n2 < n1) { winner = 't2'; t1Wins = -finalValue }

    if (winner === null && carryover) {
      carryAmt = finalValue
      holeResults.push({ hole: h, winner: null, n1, n2, holeValue: finalValue, t1Wins: 0, throws: log.throws, carried: true })
      continue
    }

    carryAmt = 0
    t1Total += t1Wins
    holeResults.push({ hole: h, winner, n1, n2, holeValue: finalValue, t1Wins, throws: log.throws })
  }

  return {
    holeResults, t1Total,
    t1Name: t1.map(m => m.short_name).join('+'),
    t2Name: t2.map(m => m.short_name).join('+'),
    airHammer, fuHammer, birdieDouble, carryover,
    settlement: {
      t1Net: t1Total, ppt,
      t1Name: t1.map(m => m.short_name).join('+'),
      t2Name: t2.map(m => m.short_name).join('+'),
    },
  }
}
// ── SIXES (Round Robin) ─────────────────────────────────────────
// 4 players rotate teams every 6 holes (3 segments)
// ─────────────────────────────────────────────────────────────────
export function computeSixes(ctx, config) {
  const {
    ppt = 1,               // $ per point
    scoringModel = 'segment', // 'segment': winner of most holes wins segment (6/3/0 pts); 'perhole': 4/2 win/loss, 3/3 tie
    players: pids,
  } = config

  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members.slice(0, 4)

  if (members.length < 4) return null

  const [p1, p2, p3, p4] = members
  const { from, to } = holeRange(ctx.holesMode)

  // Rotation: 3 segments of 6 holes
  const segments = [
    { from: 1, to: 6,   teamA: [p1, p2], teamB: [p3, p4], label: 'Holes 1-6' },
    { from: 7, to: 12,  teamA: [p1, p3], teamB: [p2, p4], label: 'Holes 7-12' },
    { from: 13, to: 18, teamA: [p1, p4], teamB: [p2, p3], label: 'Holes 13-18' },
  ]

  const totals = {}
  for (const m of members) totals[m.id] = { name: m.short_name, pts: 0 }

  const segResults = []

  for (const seg of segments) {
    if (seg.from < from || seg.to > to) {
      segResults.push({ ...seg, skipped: true })
      continue
    }

    let aWins = 0
    let bWins = 0
    const holeDetails = []

    for (let h = seg.from; h <= seg.to; h++) {
      const aNets = seg.teamA.map(m => memberNetOnHoleLowMan(ctx, m, h, members)).filter(n => n != null)
      const bNets = seg.teamB.map(m => memberNetOnHoleLowMan(ctx, m, h, members)).filter(n => n != null)

      if (!aNets.length || !bNets.length) {
        holeDetails.push({ hole: h, incomplete: true })
        continue
      }

      const aBest = Math.min(...aNets)
      const bBest = Math.min(...bNets)

      let winner = null
      if (aBest < bBest) { winner = 'a'; aWins++ }
      else if (bBest < aBest) { winner = 'b'; bWins++ }
      holeDetails.push({ hole: h, aBest, bBest, winner })
    }

    // Distribute points based on scoring model
    let aPts, bPts
    if (scoringModel === 'segment') {
      // Segment match: winner of most holes in segment wins 6 pts, loser 0, tie 3 each
      if (aWins > bWins) { aPts = 6; bPts = 0 }
      else if (bWins > aWins) { aPts = 0; bPts = 6 }
      else { aPts = 3; bPts = 3 }
    } else {
      // Per-hole: 4 pts to winner, 2 to loser, 3/3 on tie
      aPts = 0; bPts = 0
      for (const hd of holeDetails) {
        if (hd.incomplete) continue
        if (hd.winner === 'a') { aPts += 4; bPts += 2 }
        else if (hd.winner === 'b') { aPts += 2; bPts += 4 }
        else { aPts += 3; bPts += 3 }
      }
    }
    for (const m of seg.teamA) totals[m.id].pts += aPts
    for (const m of seg.teamB) totals[m.id].pts += bPts

    segResults.push({
      ...seg,
      teamAIds: seg.teamA.map(m => m.id),
      teamBIds: seg.teamB.map(m => m.id),
      teamANames: seg.teamA.map(m => m.short_name).join('+'),
      teamBNames: seg.teamB.map(m => m.short_name).join('+'),
      aWins, bWins, aPts, bPts, holeDetails, scoringModel,
    })
  }

  // Settlement: pairwise, each player's pts × ppt minus average
  const totalPts = Object.values(totals).reduce((s, t) => s + t.pts, 0)
  const avgPts = totalPts / members.length
  const settlements = members.map(m => ({
    id: m.id, name: m.short_name,
    pts: totals[m.id].pts,
    net: Math.round((totals[m.id].pts - avgPts) * ppt * 100) / 100,
  }))

  return { segResults, totals, settlements, ppt }
}

// ─────────────────────────────────────────────────────────────────
// ── 5-3-1 (Nines) ──────────────────────────────────────────────
// Best gets 5, second gets 3, last gets 1. 9 pts per hole total.
// ─────────────────────────────────────────────────────────────────
export function computeNines(ctx, config) {
  const {
    ppt = 1,          // $ per point
    players: pids,
    sweepBonus = false,   // if sole winner beats 2nd place by ≥ sweepMargin net strokes, wins all 9 pts
    sweepMargin = 2,      // net strokes margin required to trigger sweep
    birdieBonus = false,  // if exactly one player nets a birdie, they get +1 extra pt
    birdieBonusPts = 1,   // extra points awarded for solo net birdie
    birdieDouble = false, // birdie on hole doubles that player's pts (5→10, 3→6, 1→2)
  } = config

  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members

  if (members.length !== 3) return null

  const { from, to } = holeRange(ctx.holesMode)
  const totals = {}
  for (const m of members) totals[m.id] = { name: m.short_name, pts: 0 }

  const holeResults = []

  for (let h = from; h <= to; h++) {
    const scores = members
      .map(m => ({ id: m.id, name: m.short_name, net: memberNetOnHoleLowMan(ctx, m, h, members) }))
      .filter(s => s.net != null)
      .sort((a, b) => a.net - b.net)

    if (scores.length < members.length) {
      holeResults.push({ hole: h, incomplete: true })
      continue
    }

    // Assign points based on ranking with tie handling — 5-3-1 is strictly 3 players
    const pointSlots = [5, 3, 1]

    // Group by net score
    const groups = []
    let i = 0
    while (i < scores.length) {
      const group = [scores[i]]
      while (i + 1 < scores.length && scores[i + 1].net === scores[i].net) {
        i++
        group.push(scores[i])
      }
      groups.push(group)
      i++
    }

    // Distribute points: tied players share the sum of their slots
    let slotIdx = 0
    const holePts = {}
    for (const group of groups) {
      const slotsForGroup = pointSlots.slice(slotIdx, slotIdx + group.length)
      const avgPts = slotsForGroup.reduce((s, p) => s + p, 0) / group.length
      for (const player of group) {
        const roundedPts = Math.round(avgPts * 100) / 100
        holePts[player.id] = roundedPts
      }
      slotIdx += group.length
    }

    // ── Sweep bonus ──────────────────────────────────────────────
    // Sole winner beats 2nd place by ≥ sweepMargin: they take all 9 pts, others get 0.
    let sweepWinnerId = null
    if (sweepBonus && groups[0].length === 1) {
      const best = scores[0].net
      const second = scores[1].net  // scores is sorted ascending
      if (second - best >= sweepMargin) {
        sweepWinnerId = scores[0].id
        for (const m of members) holePts[m.id] = 0
        holePts[sweepWinnerId] = 9
      }
    }

    // ── Birdie bonus ─────────────────────────────────────────────
    // Exactly one player nets a birdie → +birdieBonusPts to that player.
    let birdieBonusId = null
    if (birdieBonus) {
      const par = holePar(ctx.course, h)
      // Low-man net — compare against par adjusted for the fact that the low-man
      // gets no strokes.  A net score below par counts as a birdie.
      const birdieScorers = scores.filter(s => s.net < par)
      if (birdieScorers.length === 1) {
        birdieBonusId = birdieScorers[0].id
        holePts[birdieBonusId] = Math.round((holePts[birdieBonusId] + birdieBonusPts) * 100) / 100
      }
    }

    // Accumulate
    for (const m of members) {
      totals[m.id].pts += holePts[m.id] ?? 0
    }

    holeResults.push({
      hole: h, scores, holePts,
      ...(sweepWinnerId ? { sweep: sweepWinnerId } : {}),
      ...(birdieBonusId ? { birdieBonus: birdieBonusId } : {}),
    })
  }

  // Settlement: each player's points minus average, times ppt
  const totalPts = Object.values(totals).reduce((s, t) => s + t.pts, 0)
  const avgPts = totalPts / members.length
  // Standard settlement: everyone pays everyone directly based on point difference.
  // Each pair (A, B): lower-pts player pays higher-pts player (ptsDiff × ppt).
  const playerList = members.map(m => ({
    id: m.id, name: m.short_name,
    pts: Math.round(totals[m.id].pts * 100) / 100,
  }))

  const netMap = {}
  for (const m of members) netMap[m.id] = 0

  for (let i = 0; i < playerList.length; i++) {
    for (let j = i + 1; j < playerList.length; j++) {
      const a = playerList[i]
      const b = playerList[j]
      const diff = Math.round((a.pts - b.pts) * ppt * 100) / 100
      // diff > 0: a wins from b; diff < 0: b wins from a
      netMap[a.id] += diff
      netMap[b.id] -= diff
    }
  }

  const settlements = members.map(m => ({
    id: m.id, name: m.short_name,
    pts: Math.round(totals[m.id].pts * 100) / 100,
    net: Math.round(netMap[m.id] * 100) / 100,
  }))

  const hasSweep = holeResults.some(h => h.sweep)
  const hasBirdie = holeResults.some(h => h.birdieBonus)

  return { holeResults, totals, settlements, ppt, hasSweep, hasBirdie }
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
// ── BINGO BANGO BONGO (BBB) ───────────────────────────────────────
// Three points per hole: first on green (bingo), closest to pin (bango),
// first in hole (bongo). Awards tracked manually in config.awards.
// Settlement: pairwise — each player pays every player they trail.
// ─────────────────────────────────────────────────────────────────
export function computeBbb(ctx, config) {
  const { ppt = 1, awards = {}, players: pids, doubleBongo = false } = config
  const members = pids
    ? ctx.members.filter(m => pids.includes(m.id))
    : ctx.members

  // Tally points — doubleBongo: bongo winner who birdied gets 2 pts
  const pts = {}
  for (const m of members) pts[m.id] = 0

  for (const holeKey of Object.keys(awards)) {
    const h = awards[holeKey]
    if (h.bingo && pts[h.bingo] !== undefined) pts[h.bingo]++
    if (h.bango && pts[h.bango] !== undefined) pts[h.bango]++
    if (h.bongo && pts[h.bongo] !== undefined) {
      const bongoPts = (doubleBongo && h.bongoBirdied) ? 2 : 1
      pts[h.bongo] += bongoPts
    }
  }

  // Pairwise settlement
  const settlements = []
  const ids = members.map(m => m.id)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const diff = pts[ids[i]] - pts[ids[j]]
      if (diff !== 0) {
        const winner = diff > 0 ? ids[i] : ids[j]
        const loser  = diff > 0 ? ids[j] : ids[i]
        const wm = members.find(m => m.id === winner)
        const lm = members.find(m => m.id === loser)
        settlements.push({ from: loser, fromName: lm.short_name, to: winner, toName: wm.short_name, amount: Math.abs(diff) * ppt })
      }
    }
  }

  const netMap = {}
  for (const m of members) netMap[m.id] = 0
  for (const s of settlements) {
    netMap[s.from] -= s.amount
    netMap[s.to]   += s.amount
  }
  const standings = members.map(m => ({ id: m.id, name: m.short_name, pts: pts[m.id], net: netMap[m.id] }))

  return { pts, ppt, awards, settlements, standings, doubleBongo }
}

// ── SCOTCH 6s ────────────────────────────────────────────────────
// 2v2 team game. Per hole: low ball (2 pts), low total (2 pts),
// prox on par 3 (1 pt, manual), birdie (1 pt, auto or manual).
// Umbrella: if one team sweeps all 6 pts, doubled to 12.
// Press multiplier: any team can press from any hole (×2 from that hole on).
// Roll multiplier: per-hole side bet (manual, ×2 or ×4).
// ─────────────────────────────────────────────────────────────────
export function computeScotch6s(ctx, config) {
  const {
    ppt = 1,
    team1 = [], team2 = [],
    netGross = 'net',
    hcpPercent = 100,
    birdieMode = 'gross',
    awards = {},   // awards[hole] = { prox: 't1'|'t2'|null, birdie: 't1'|'t2'|'both'|null }
    presses = [],  // [{ hole: N, team: 't1'|'t2' }]
    rolls = {},    // rolls[hole] = 2|4
  } = config

  if (team1.length < 2 || team2.length < 2) return null

  const useNet = netGross !== 'gross'
  const hcpPct = hcpPercent / 100
  const { from, to } = holeRange(ctx.holesMode)

  const getMember = id => ctx.members.find(m => m.id === id)
  const t1n = team1.map(id => getMember(id)?.short_name || id).join('+')
  const t2n = team2.map(id => getMember(id)?.short_name || id).join('+')

  // Build press multiplier per hole
  const pressMult = {}
  for (let h = from; h <= to; h++) pressMult[h] = 1
  for (const pr of presses) {
    for (let h = pr.hole; h <= to; h++) pressMult[h] *= 2
  }

  const getNet = (id, h) => {
    const m = getMember(id)
    if (!m) return null
    const gross = getScore(ctx, id, h)
    if (gross == null) return null
    if (!useNet) return gross
    const hcp = Math.round(memberHandicap(m, ctx.course, ctx.tee) * hcpPct)
    return gross - strokesOnHole(hcp, holeSI(ctx.course, h, ctx.tee))
  }

  let t1total = 0, t2total = 0
  const holes = []
  let played = 0

  for (let h = from; h <= to; h++) {
    const mult = pressMult[h] || 1
    const rollMult = rolls[String(h)] || 1
    const hAwards = awards[h] || {}
    let t1hPts = 0, t2hPts = 0
    const detail = { h, mult, rollMult, lowBall: null, lowTotal: null, prox: null, birdie: null, umbrella: false }

    const t1nets = team1.map(id => getNet(id, h))
    const t2nets = team2.map(id => getNet(id, h))
    const t1valid = t1nets.filter(x => x !== null)
    const t2valid = t2nets.filter(x => x !== null)

    if (!t1valid.length || !t2valid.length) { holes.push(detail); continue }
    played++

    // Low ball (2 pts)
    const t1low = Math.min(...t1valid)
    const t2low = Math.min(...t2valid)
    if      (t1low < t2low) { t1hPts += 2; detail.lowBall = 't1' }
    else if (t2low < t1low) { t2hPts += 2; detail.lowBall = 't2' }

    // Low total (2 pts)
    const t1sum = t1valid.reduce((a, b) => a + b, 0)
    const t2sum = t2valid.reduce((a, b) => a + b, 0)
    if      (t1sum < t2sum) { t1hPts += 2; detail.lowTotal = 't1' }
    else if (t2sum < t1sum) { t2hPts += 2; detail.lowTotal = 't2' }

    // Prox (1 pt, manual)
    if      (hAwards.prox === 't1') { t1hPts += 1; detail.prox = 't1' }
    else if (hAwards.prox === 't2') { t2hPts += 1; detail.prox = 't2' }

    // Birdie (1 pt) — auto-detect or manual override
    const par = holePar(ctx.course, h)
    let t1Birdie = false, t2Birdie = false
    if (birdieMode === 'gross') {
      t1Birdie = team1.some(id => { const g = getScore(ctx, id, h); return g != null && g < par })
      t2Birdie = team2.some(id => { const g = getScore(ctx, id, h); return g != null && g < par })
    } else {
      t1Birdie = t1valid.some(n => n < par)
      t2Birdie = t2valid.some(n => n < par)
    }
    if (hAwards.birdie) {
      t1Birdie = hAwards.birdie === 't1' || hAwards.birdie === 'both'
      t2Birdie = hAwards.birdie === 't2' || hAwards.birdie === 'both'
    }
    if      (t1Birdie && t2Birdie) { t1hPts += 1; t2hPts += 1; detail.birdie = 'both' }
    else if (t1Birdie)             { t1hPts += 1; detail.birdie = 't1' }
    else if (t2Birdie)             { t2hPts += 1; detail.birdie = 't2' }

    // Umbrella: one team sweeps all distributed points (≥6) → double
    const totalPts = t1hPts + t2hPts
    if (totalPts >= 6 && (t1hPts === 0 || t2hPts === 0)) {
      if (t1hPts > 0) { t1hPts = 12; t2hPts = 0 }
      else            { t2hPts = 12; t1hPts = 0 }
      detail.umbrella = true
    }

    // Apply press multiplier + roll bonus (independent side bet)
    const rollBonus = rollMult > 1 ? (rollMult - 1) : 0
    detail.t1pts = t1hPts * mult + t1hPts * rollBonus
    detail.t2pts = t2hPts * mult + t2hPts * rollBonus
    t1total += detail.t1pts
    t2total += detail.t2pts
    holes.push(detail)
  }

  const diff = (t1total - t2total) * ppt
  return { t1n, t2n, t1total, t2total, diff, ppt, holes, played }
}

// ─────────────────────────────────────────────────────────────────
// ── TEAM DAY ─────────────────────────────────────────────────────
// 2-team aggregate game. Per hole: take best N net scores + best M
// gross scores from each team, sum them. Lower team aggregate wins.
// config: { team1, team2, bestNets=2, bestGross=1, ppt=1 }
// ─────────────────────────────────────────────────────────────────
export function computeTeamDay(ctx, config) {
  const {
    team1 = [], team2 = [],
    bestNets = 2,
    bestGross = 1,
    ppt = 1,
  } = config

  if (!team1.length || !team2.length) return null

  const { from, to } = holeRange(ctx.holesMode)
  const getMember = id => ctx.members.find(m => m.id === id)
  const t1n = team1.map(id => getMember(id)?.short_name || id).join('+')
  const t2n = team2.map(id => getMember(id)?.short_name || id).join('+')

  const calcHole = (teamIds, h) => {
    const scores = teamIds.map(id => {
      const m = getMember(id)
      if (!m) return null
      const gross = getScore(ctx, id, h)
      if (gross == null) return null
      const hcp = memberHandicap(m, ctx.course, ctx.tee)
      const si  = holeSI(ctx.course, h, ctx.tee)
      const net = gross - strokesOnHole(hcp, si)
      return { id, gross, net }
    }).filter(Boolean)

    if (scores.length < Math.max(bestNets, bestGross)) return null
    const byNet   = scores.slice().sort((a, b) => a.net - b.net)
    const byGross = scores.slice().sort((a, b) => a.gross - b.gross)
    let netSum = 0
    for (let i = 0; i < bestNets && i < byNet.length; i++) netSum += byNet[i].net
    let grossSum = 0
    for (let i = 0; i < bestGross && i < byGross.length; i++) grossSum += byGross[i].gross
    return netSum + grossSum
  }

  let t1agg = 0, t2agg = 0, played = 0
  const holes = []

  for (let h = from; h <= to; h++) {
    const t1hole = calcHole(team1, h)
    const t2hole = calcHole(team2, h)
    if (t1hole !== null) t1agg += t1hole
    if (t2hole !== null) t2agg += t2hole
    if (t1hole !== null || t2hole !== null) played++
    holes.push({ h, t1hole, t2hole, t1agg, t2agg })
  }

  if (!played) return null

  // Lower aggregate wins (like stroke play)
  const diff = t1agg - t2agg  // negative = t1 winning
  const totalHoles = to - from + 1
  const t1short = team1.map(id => getMember(id)?.short_name || id).join('+')
  const t2short = team2.map(id => getMember(id)?.short_name || id).join('+')
  const leader = diff < 0 ? t1short : diff > 0 ? t2short : null
  let status = diff === 0 ? 'All Square' : `${leader} leads by ${Math.abs(diff)}`
  if (played >= totalHoles) {
    status = diff === 0 ? 'Tied' : `${leader} wins by ${Math.abs(diff)}`
  }

  // Settlement: winning team collects ppt × |diff| per player
  const winAmt = Math.abs(diff) * ppt
  const t1Net  = diff < 0 ? winAmt : diff > 0 ? -winAmt : 0
  const standings = []
  for (const id of team1) {
    const m = getMember(id)
    standings.push({ id, name: m?.short_name || id, net: t1Net })
  }
  for (const id of team2) {
    const m = getMember(id)
    standings.push({ id, name: m?.short_name || id, net: -t1Net })
  }

  return { t1n, t2n, t1agg, t2agg, diff, ppt, holes, played, totalHoles, status, bestNets, bestGross, standings }
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

// Backward-compatibility alias
export const computeFiveThreeOne = computeNines


// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// ── CROSS BEST BALL (4v4 linked match engine) ────────────────────
// Takes two full round bundles (each with .round_members + .scores[])
// and computes aggregate best-ball net vs par for each foursome,
// with optional side bets.
//
// Handicap method: USGA stroke play four-ball
//   Each player gets 90% of their full Course Handicap off the course.
//   (Not low-man relative — that's match play.)
//   courseHandicap = round(ghin_index * slope/113 + (rating - par))
//   playingHandicap = round(courseHandicap * hcpPct)
//   Strokes given on holes per SI ranking up to playingHandicap.
// ─────────────────────────────────────────────────────────────────

function _crossParFor(round) {
  const par = round?.course_snapshot?.par || round?.par || []
  if (Array.isArray(par) && par.length >= 18) return par
  return Array(18).fill(4)
}

function _crossSiFor(round) {
  const si = round?.course_snapshot?.handicap_stroke_index || round?.stroke_index || []
  if (Array.isArray(si) && si.length >= 18) return si
  return Array.from({ length: 18 }, (_, i) => i + 1)
}

function _crossCourseInfo(round) {
  const snap = round?.course_snapshot
  const slope = snap?.slope ?? 113
  const rating = snap?.rating ?? 72
  const par = (_crossParFor(round)).reduce((s, p) => s + p, 0) || 72
  return { slope, rating, par }
}

function _crossScoreMap(round) {
  const map = {}
  for (const m of (round?.round_members || [])) map[m.id] = {}
  for (const s of (round?.scores || [])) {
    if (!map[s.member_id]) map[s.member_id] = {}
    map[s.member_id][s.hole] = s.score
  }
  return map
}

/**
 * Compute a player's playing handicap for stroke-play four-ball.
 * @param {object} member  - round_member row (ghin_index or round_hcp)
 * @param {object} courseInfo - { slope, rating, par }
 * @param {number} hcpPct  - e.g. 0.90 for 90%
 */
function _crossPlayingHcp(member, courseInfo, hcpPct) {
  const raw = member?.ghin_index ?? member?.round_hcp ?? 0
  const { slope, rating, par } = courseInfo
  const ch = Math.round(raw * (slope / 113) + (rating - par))
  return Math.round(ch * hcpPct)
}

/**
 * Strokes given to a player on a specific hole.
 * Standard USGA method: player gets 1 stroke on holes whose SI <= playingHcp,
 * and 2 strokes on holes whose SI <= (playingHcp - 18) for high-hcp players.
 */
function _crossStrokes(playingHcp, holeSI) {
  if (playingHcp <= 0) return 0
  let s = 0
  if (playingHcp >= holeSI) s++
  if (playingHcp >= 18 + holeSI) s++
  return s
}

/**
 * Compute the best-ball net result for a team on one hole.
 * Returns { nets, counted, sum } or null if not enough scores.
 */
function _crossTeamHole(members, hole, scoreMap, si, hcpMap, ballsToCount) {
  const nets = []
  for (const m of members) {
    const gross = scoreMap[m.id]?.[hole]
    if (gross == null) continue
    const holeSI = si?.[hole - 1] ?? 18
    const strokes = _crossStrokes(hcpMap[m.id] ?? 0, holeSI)
    nets.push(gross - strokes)
  }
  if (nets.length < ballsToCount) return null
  nets.sort((a, b) => a - b)
  const counted = nets.slice(0, ballsToCount)
  return { nets, counted, sum: counted.reduce((a, b) => a + b, 0) }
}

function _crossHoleRange(holesMode) {
  if (holesMode === '9f') return { from: 1, to: 9 }
  if (holesMode === '9b') return { from: 10, to: 18 }
  return { from: 1, to: 18 }
}

function _crossTeamName(members) {
  return (members || [])
    .map(m => ((m.guest_name || m.short_name || '').trim()[0] || '?').toUpperCase())
    .join('+')
}

// ── Side bet helpers ──────────────────────────────────────────────

/**
 * Count birdies (gross < par) for a team across played holes.
 * Returns { A: n, B: n }.
 */
function _countBirdies(membersA, membersB, smA, smB, parA, parB, from, to) {
  let a = 0; let b = 0
  for (let h = from; h <= to; h++) {
    const p = parA[h - 1] ?? 4
    const pb = parB[h - 1] ?? 4
    for (const m of membersA) { const g = smA[m.id]?.[h]; if (g != null && g < p) a++ }
    for (const m of membersB) { const g = smB[m.id]?.[h]; if (g != null && g < pb) b++ }
  }
  return { A: a, B: b }
}

/**
 * Count eagles (gross <= par - 2) for a team.
 */
function _countEagles(membersA, membersB, smA, smB, parA, parB, from, to) {
  let a = 0; let b = 0
  for (let h = from; h <= to; h++) {
    const p = parA[h - 1] ?? 4
    const pb = parB[h - 1] ?? 4
    for (const m of membersA) { const g = smA[m.id]?.[h]; if (g != null && g <= p - 2) a++ }
    for (const m of membersB) { const g = smB[m.id]?.[h]; if (g != null && g <= pb - 2) b++ }
  }
  return { A: a, B: b }
}

/**
 * Count double-bogeys or worse (gross >= par + 2) for a team.
 * Fewest doubles wins.
 */
function _countDoubles(membersA, membersB, smA, smB, parA, parB, from, to) {
  let a = 0; let b = 0
  for (let h = from; h <= to; h++) {
    const p = parA[h - 1] ?? 4
    const pb = parB[h - 1] ?? 4
    for (const m of membersA) { const g = smA[m.id]?.[h]; if (g != null && g >= p + 2) a++ }
    for (const m of membersB) { const g = smB[m.id]?.[h]; if (g != null && g >= pb + 2) b++ }
  }
  return { A: a, B: b }
}

/**
 * Aggregate vsPar for holes in a range subset.
 */
function _subsetVsPar(perHole, from, to) {
  let a = null; let b = null; let aScored = 0; let bScored = 0
  const total = to - from + 1
  for (const row of perHole) {
    if (row.hole < from || row.hole > to) continue
    if (row.a?.vsPar != null) { a = (a ?? 0) + row.a.vsPar; aScored++ }
    if (row.b?.vsPar != null) { b = (b ?? 0) + row.b.vsPar; bScored++ }
  }
  const complete = aScored === total && bScored === total
  return { a, b, aScored, bScored, complete }
}

/**
 * Compute all active side bets from perHole + raw score maps.
 * @param {Array}  sideBets   - [{ type, stake, enabled }]
 * @param {object} ctx        - { membersA, membersB, smA, smB, parA, parB, perHole, from, to, allComplete }
 * @returns Array of side bet result objects
 */
function _computeSideBets(sideBets, ctx) {
  const { membersA, membersB, smA, smB, parA, parB, perHole, from, to, allComplete, holesMode } = ctx
  const results = []

  for (const bet of sideBets) {
    if (bet.enabled === false) continue
    const stake = bet.stake ?? 0
    const type = bet.type

    if (type === 'mostBirdies') {
      const birds = _countBirdies(membersA, membersB, smA, smB, parA, parB, from, to)
      const winner = birds.A > birds.B ? 'A' : birds.B > birds.A ? 'B' : null
      const settled = allComplete
      results.push({
        type, stake, settled,
        counts: birds,
        winner: settled ? winner : null,
        payout: settled && winner ? stake * membersA.length : 0,
        description: settled
          ? (winner ? `Foursome ${winner} wins Most Birdies (${birds[winner]} vs ${birds[winner === 'A' ? 'B' : 'A']})` : 'Most Birdies tied')
          : `Most Birdies: A=${birds.A} B=${birds.B}`,
      })
    }

    else if (type === 'front9') {
      if (holesMode === '9b') continue  // no front 9 in back-9-only round
      const f = _subsetVsPar(perHole, 1, 9)
      const winner = f.complete ? (f.a < f.b ? 'A' : f.b < f.a ? 'B' : null) : null
      results.push({
        type, stake, settled: f.complete,
        scores: { A: f.a, B: f.b },
        winner,
        payout: f.complete && winner ? stake * membersA.length : 0,
        description: f.complete
          ? (winner ? `Front 9: Foursome ${winner} wins ($${stake * membersA.length})` : 'Front 9: Tied')
          : `Front 9: A=${formatVsParEngine(f.a)} B=${formatVsParEngine(f.b)} (thru ${f.aScored}/9)`,
      })
    }

    else if (type === 'back9') {
      if (holesMode === '9f') continue  // no back 9 in front-9-only round
      const b = _subsetVsPar(perHole, 10, 18)
      const winner = b.complete ? (b.a < b.b ? 'A' : b.b < b.a ? 'B' : null) : null
      results.push({
        type, stake, settled: b.complete,
        scores: { A: b.a, B: b.b },
        winner,
        payout: b.complete && winner ? stake * membersA.length : 0,
        description: b.complete
          ? (winner ? `Back 9: Foursome ${winner} wins ($${stake * membersA.length})` : 'Back 9: Tied')
          : `Back 9: A=${formatVsParEngine(b.a)} B=${formatVsParEngine(b.b)} (thru ${b.bScored}/9)`,
      })
    }

    else if (type === 'eagleBounty') {
      // Each eagle by any player in winning team earns stake from losing team
      // Settled at end — count total eagles per team
      const eagles = _countEagles(membersA, membersB, smA, smB, parA, parB, from, to)
      const aEarned = eagles.A * stake * membersB.length
      const bEarned = eagles.B * stake * membersA.length
      const net = aEarned - bEarned // positive = A earns
      results.push({
        type, stake, settled: allComplete,
        counts: eagles,
        netA: net,
        description: allComplete
          ? `Eagle Bounty: A=${eagles.A} eagle${eagles.A !== 1 ? 's' : ''} B=${eagles.B} eagle${eagles.B !== 1 ? 's' : ''} · net ${net > 0 ? 'A +$' + net : net < 0 ? 'B +$' + Math.abs(net) : 'even'}`
          : `Eagle Bounty: A=${eagles.A} B=${eagles.B}`,
      })
    }

    else if (type === 'fewestDoubles') {
      const doubles = _countDoubles(membersA, membersB, smA, smB, parA, parB, from, to)
      const winner = allComplete ? (doubles.A < doubles.B ? 'A' : doubles.B < doubles.A ? 'B' : null) : null
      results.push({
        type, stake, settled: allComplete,
        counts: doubles,
        winner,
        payout: allComplete && winner ? stake * membersA.length : 0,
        description: allComplete
          ? (winner ? `Fewest Doubles: Foursome ${winner} wins (${doubles[winner]} vs ${doubles[winner === 'A' ? 'B' : 'A']})` : 'Fewest Doubles: Tied')
          : `Fewest Doubles: A=${doubles.A} B=${doubles.B}`,
      })
    }
  }
  return results
}

function formatVsParEngine(v) {
  if (v == null) return '—'
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
}

// ─────────────────────────────────────────────────────────────────
// DEFAULT SIDE BETS CONFIG
// ─────────────────────────────────────────────────────────────────
export const DEFAULT_SIDE_BETS = [
  { type: 'mostBirdies',   label: 'Most Birdies',    stake: 4,  enabled: true,  description: 'Team with most birdies wins the pot.' },
  { type: 'front9',        label: 'Front 9',          stake: 5,  enabled: true,  description: 'Best-ball net on the front 9.' },
  { type: 'back9',         label: 'Back 9',           stake: 5,  enabled: true,  description: 'Best-ball net on the back 9.' },
  { type: 'eagleBounty',   label: 'Eagle Bounty',     stake: 3,  enabled: true,  description: 'Per eagle made, the other team pays $stake/player.' },
  { type: 'fewestDoubles', label: 'Fewest Doubles',   stake: 4,  enabled: true,  description: 'Team with fewest double-bogeys or worse wins.' },
]

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────

/**
 * computeCrossBestBall — 4v4 linked match engine
 *
 * @param {object} roundA   - full round bundle { round_members[], scores[], course_snapshot, holes_mode, ... }
 * @param {object} roundB   - full round bundle for the other foursome
 * @param {object} config   - match_config from linked_matches row
 *   config.ballsToCount    - 1 or 2 (default 1)
 *   config.stake           - main match stake per player (default 20)
 *   config.hcpPct          - handicap allowance 0–1 (default 0.90)
 *   config.sideBets        - array of { type, stake, enabled } (default DEFAULT_SIDE_BETS)
 * @returns result object
 */
export function computeCrossBestBall(roundA, roundB, config = {}) {
  const {
    ballsToCount = 1,
    stake = 20,
    hcpPct = 0.90,
    sideBets = DEFAULT_SIDE_BETS,
  } = config

  const holesMode = roundA?.holes_mode || '18'
  const { from, to } = _crossHoleRange(holesMode)

  const parA = _crossParFor(roundA)
  const siA  = _crossSiFor(roundA)
  const parB = roundB ? _crossParFor(roundB) : parA
  const siB  = roundB ? _crossSiFor(roundB)  : siA

  const ciA  = _crossCourseInfo(roundA)
  const ciB  = roundB ? _crossCourseInfo(roundB) : ciA

  const membersA = roundA?.round_members || []
  const membersB = roundB?.round_members || []
  const smA = _crossScoreMap(roundA)
  const smB = roundB ? _crossScoreMap(roundB) : {}

  // Build playing-hcp map per member (keyed by member.id)
  const hcpMapA = {}
  for (const m of membersA) hcpMapA[m.id] = _crossPlayingHcp(m, ciA, hcpPct)
  const hcpMapB = {}
  for (const m of membersB) hcpMapB[m.id] = _crossPlayingHcp(m, ciB, hcpPct)

  const perHole = []
  let vsParA = 0; let vsParB = 0
  let scoredA = 0; let scoredB = 0; let scoredBoth = 0

  for (let h = from; h <= to; h++) {
    const ph    = parA[h - 1] ?? 4
    const basis = ph * ballsToCount

    const resA = _crossTeamHole(membersA, h, smA, siA, hcpMapA, ballsToCount)
    const resB = roundB ? _crossTeamHole(membersB, h, smB, siB, hcpMapB, ballsToCount) : null

    const aVs = resA ? resA.sum - basis : null
    const bVs = resB ? resB.sum - (parB[h - 1] ?? 4) * ballsToCount : null

    if (aVs != null) { vsParA += aVs; scoredA++ }
    if (bVs != null) { vsParB += bVs; scoredB++ }
    if (aVs != null && bVs != null) scoredBoth++

    perHole.push({
      hole: h, par: ph,
      a: resA ? { ...resA, vsPar: aVs } : null,
      b: resB ? { ...resB, vsPar: bVs } : null,
      diff: (aVs != null && bVs != null) ? aVs - bVs : null,
    })
  }

  const totalHoles  = to - from + 1
  const allComplete = scoredA === totalHoles && scoredB === totalHoles
  const delta       = vsParA - vsParB
  const currentLeader = scoredBoth === 0 ? null : delta < 0 ? 'A' : delta > 0 ? 'B' : null

  // ── Main match settlement (foursome-to-foursome) ──────────────
  let settlement = null
  if (allComplete) {
    const winner = delta < 0 ? 'A' : delta > 0 ? 'B' : null
    const loser  = winner === 'A' ? 'B' : winner === 'B' ? 'A' : null
    const stakePerPlayer = stake
    const totalPot = winner ? stakePerPlayer * membersA.length : 0

    settlement = {
      winner,
      stakePerPlayer,
      totalPot,
      // Foursome-to-foursome: each losing player pays each winning player
      description: winner
        ? `Foursome ${loser}: each player pays $${stakePerPlayer} to their Foursome ${winner} counterpart ($${totalPot} total)`
        : 'All square — no main match payment',
    }
  }

  // ── Side bets ──────────────────────────────────────────────────
  const sideBetResults = _computeSideBets(sideBets, {
    membersA, membersB, smA, smB, parA, parB, perHole, from, to, allComplete, holesMode,
  })

  // ── Net settlement summary (main + side bets combined) ─────────
  let netSettlement = null
  if (allComplete && settlement) {
    // Compute net per-player amounts (positive = A wins from B, negative = B wins from A)
    let netA = 0 // net $ each A player collects from each B player
    if (settlement.winner === 'A') netA += settlement.stakePerPlayer
    else if (settlement.winner === 'B') netA -= settlement.stakePerPlayer

    const sideBetLines = []
    for (const sb of sideBetResults) {
      if (!sb.settled) continue
      if (sb.type === 'eagleBounty') {
        // Eagle bounty: netA is already per-player (net / membersA.length)
        const perPlayer = membersA.length ? sb.netA / membersA.length : 0
        netA += perPlayer
        if (sb.netA !== 0) sideBetLines.push(sb.description)
      } else if (sb.winner) {
        if (sb.winner === 'A') netA += sb.stake
        else netA -= sb.stake
        sideBetLines.push(sb.description)
      } else {
        sideBetLines.push(`${sb.description} (tied)`)
      }
    }

    netSettlement = {
      netPerPlayer: netA, // positive → each B player pays each A player $netA; negative → reverse
      winningTeam: netA > 0 ? 'A' : netA < 0 ? 'B' : null,
      totalNetPerPlayer: Math.abs(netA),
      summary: netA > 0
        ? `Each Foursome B player owes each Foursome A player $${Math.abs(netA).toFixed(0)}`
        : netA < 0
          ? `Each Foursome A player owes each Foursome B player $${Math.abs(netA).toFixed(0)}`
          : 'All square across all bets',
      sideBetLines,
    }
  }

  return {
    perHole,
    teamA: {
      vsPar: vsParA,
      holesFullyScored: scoredA,
      name: _crossTeamName(membersA) || 'Foursome A',
      hcpMap: hcpMapA,
    },
    teamB: {
      vsPar: vsParB,
      holesFullyScored: scoredB,
      name: _crossTeamName(membersB) || 'Foursome B',
      hcpMap: hcpMapB,
    },
    allHolesComplete: allComplete,
    holesBoth: scoredBoth,
    currentLeader,
    delta,
    settlement,
    sideBetResults,
    netSettlement,
    ballsToCount,
    holesMode,
    hcpPct,
  }
}
