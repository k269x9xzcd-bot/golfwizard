/**
 * useHoleMath — per-hole game math breakdown.
 * holeMathLines(game, hole) → string[] (one line per fact)
 */
import {
  computeNassau, computeSkins, computeMatch, computeBestBall,
  computeVegas, computeHiLow, computeWolf, computeHammer, computeFiveThreeOne, computeSixes,
} from '../modules/gameEngine'

export function useHoleMath({ buildCtx, pInit, teamInitialsStr }) {

  function holeMathLines(game, hole) {
    if (!game || !hole) return []
    const ctx = buildCtx()
    const t = game.type?.toLowerCase()
    const cfg = game.config || {}
    try {
      if (t === 'nassau') return _nassau(ctx, cfg, hole)
      if (t === 'match' || t === 'match1v1') return _match(ctx, cfg, hole)
      if (t === 'vegas') return _vegas(ctx, cfg, hole)
      if (t === 'skins') return _skins(ctx, cfg, hole)
      if (t === 'wolf') return _wolf(ctx, cfg, hole)
      if (t === 'hammer') return _hammer(ctx, cfg, hole)
      if (t === 'hilow') return _hilow(ctx, cfg, hole)
      if (t === 'fivethreeone' || t === 'nines') return _531(ctx, cfg, hole)
      if (t === 'sixes') return _sixes(ctx, cfg, hole)
    } catch { /* silent */ }
    return []
  }

  function _nassau(ctx, cfg, hole) {
    const r = computeNassau(ctx, cfg)
    const allHR = [...(r.frontSeg?.holeResults || []), ...(r.backSeg?.holeResults || [])]
    const hr = allHR.find(x => x.hole === hole)
    if (!hr || hr.n1 == null) return []
    const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
    const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
    const up = hr.t1Up ?? 0
    const upStr = up === 0 ? 'AS' : up > 0 ? `${t1n} ${up}up` : `${t2n} ${Math.abs(up)}up`
    const resultStr = hr.winner === 't1' ? `${t1n} wins` : hr.winner === 't2' ? `${t2n} wins` : 'Halved'
    return [
      `${t1n} net ${hr.n1} · ${t2n} net ${hr.n2}`,
      `${resultStr} · ${upStr}`,
    ]
  }

  function _match(ctx, cfg, hole) {
    if (cfg.player1 && cfg.player2) {
      const r = computeMatch(ctx, cfg)
      if (!r) return []
      const hr = r.holeResults.find(x => x.hole === hole)
      if (!hr || hr.incomplete) return []
      const p1 = pInit(cfg.player1) || 'P1'
      const p2 = pInit(cfg.player2) || 'P2'
      const up = hr.p1Up ?? 0
      const upStr = up === 0 ? 'AS' : up > 0 ? `${p1} ${up}up` : `${p2} ${Math.abs(up)}up`
      const resultStr = hr.winner === 'p1' ? `${p1} wins` : hr.winner === 'p2' ? `${p2} wins` : 'Halved'
      return [
        `${p1} net ${hr.n1} · ${p2} net ${hr.n2}`,
        `${resultStr} · ${upStr}`,
      ]
    }
    if (cfg.team1?.length && cfg.team2?.length) {
      const r = computeBestBall(ctx, { ...cfg, ballsPerTeam: 1 })
      if (!r) return []
      const hr = r.holeResults.find(x => x.hole === hole)
      if (!hr || hr.incomplete) return []
      const t1n = teamInitialsStr(cfg.team1) || 'T1'
      const t2n = teamInitialsStr(cfg.team2) || 'T2'
      const up = hr.t1Up ?? 0
      const upStr = up === 0 ? 'AS' : up > 0 ? `${t1n} ${up}up` : `${t2n} ${Math.abs(up)}up`
      const resultStr = hr.winner === 't1' ? `${t1n} wins` : hr.winner === 't2' ? `${t2n} wins` : 'Halved'
      return [
        `${t1n} best ${hr.s1} · ${t2n} best ${hr.s2}`,
        `${resultStr} · ${upStr}`,
      ]
    }
    return []
  }

  function _vegas(ctx, cfg, hole) {
    const r = computeVegas(ctx, cfg)
    if (!r) return []
    const hr = r.holeResults.find(x => x.hole === hole)
    if (!hr || hr.incomplete || hr.t1Num == null) return []
    const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
    const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
    const ppt = cfg.ppt || 1
    const dollars = hr.diff * ppt
    const star = hr.variant ? ' ★' : ''
    const multStr = hr.multiplier > 1 ? ` ×${hr.multiplier}` : ''
    const dollarStr = dollars > 0 ? `$${dollars} → ${t1n}` : dollars < 0 ? `($${Math.abs(dollars)}) → ${t2n}` : 'Even'
    return [
      `${t1n}: ${hr.t1Num} · ${t2n}: ${hr.t2Num}${star}`,
      `diff ${hr.diff}${multStr} × $${ppt} = ${dollarStr}`,
    ]
  }

  function _skins(ctx, cfg, hole) {
    const r = computeSkins(ctx, cfg)
    if (!r) return []
    const hr = r.holeResults.find(x => x.hole === hole)
    if (!hr || hr.reason === 'incomplete') return []
    if (cfg.teamMode) {
      const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
      const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
      const nets = hr.n1 != null ? `${t1n} ${hr.n1} · ${t2n} ${hr.n2}` : null
      const resultStr = hr.winner === 't1'
        ? `${t1n} wins $${hr.pot} skin`
        : hr.winner === 't2'
        ? `${t2n} wins $${hr.pot} skin`
        : `Tie → ${hr.reason === 'dead' ? 'dead' : `carry $${hr.pot}`}`
      return nets ? [nets, resultStr] : [resultStr]
    }
    if (hr.winner) {
      const winName = pInit(hr.winner) || hr.winnerName || '?'
      return [`${winName} wins $${hr.pot} skin (net ${hr.net})`]
    }
    if (hr.tied?.length) {
      const names = hr.tied.map(id => pInit(id)).join(', ')
      return [`Tied (${names}) → ${hr.reason === 'dead' ? 'dead' : `carry $${hr.pot}`}`]
    }
    return []
  }

  function _wolf(ctx, cfg, hole) {
    const r = computeWolf(ctx, cfg)
    if (!r) return []
    const hr = r.holeResults.find(x => x.hole === hole)
    if (!hr) return []
    const wolfName = pInit(hr.wolf) || hr.wolfName || '?'
    if (hr.isLone || hr.isBlind) {
      const mult = hr.isBlind ? (cfg.blindWolfMultiplier ?? 8) : (cfg.wolfLoneMultiplier ?? 4)
      const resultStr = hr.winner === 'wolf' ? 'Wolf wins' : hr.winner === 'field' ? 'Field wins' : 'Tie'
      return [
        `Wolf: ${wolfName} (${hr.isBlind ? 'BLIND' : 'LONE'} ×${mult})`,
        `Wolf net ${hr.wolfNet} vs Field best ${hr.otherBest} → ${resultStr}`,
      ]
    }
    const partnerName = hr.partner ? (pInit(hr.partner) || hr.partnerName || '?') : ''
    const wolfBest = hr.wolfBest ?? hr.wolfNet ?? '?'
    const resultStr = hr.winner === 'wolf' ? 'Wolf wins' : hr.winner === 'field' ? 'Field wins' : 'Tie'
    return [
      `Wolf: ${wolfName}${partnerName ? `+${partnerName}` : ''}`,
      `Wolf best ${wolfBest} vs Others ${hr.otherBest} → ${resultStr}`,
    ]
  }

  function _hammer(ctx, cfg, hole) {
    const r = computeHammer(ctx, cfg)
    if (!r) return []
    const hr = r.holeResults.find(x => x.hole === hole)
    if (!hr || hr.incomplete) return []
    const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
    const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
    if (hr.conceded) {
      const conceder = hr.concededBy === 't2' ? t2n : t1n
      const winner = hr.concededBy === 't2' ? t1n : t2n
      return [`${conceder} concedes → ${winner} +$${hr.holeValue}`]
    }
    const lines = [`${t1n} net ${hr.n1} · ${t2n} net ${hr.n2}`]
    if ((hr.throws ?? 0) > 0) lines.push(`Hammers: ${hr.throws} → $${hr.holeValue}`)
    if (hr.carried) lines.push(`Tied → carries ($${hr.holeValue})`)
    else if (hr.winner === 't1') lines.push(`${t1n} wins $${hr.holeValue}`)
    else if (hr.winner === 't2') lines.push(`${t2n} wins $${hr.holeValue}`)
    else lines.push(`Halved → base $${hr.holeValue}`)
    return lines
  }

  function _hilow(ctx, cfg, hole) {
    const r = computeHiLow(ctx, cfg)
    if (!r) return []
    const hr = r.holeResults.find(x => x.hole === hole)
    if (!hr || hr.incomplete) return []
    const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
    const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
    const lowStr = hr.lowWin === 't1' ? `${t1n}✓` : hr.lowWin === 't2' ? `${t2n}✓` : '='
    const highStr = hr.highWin === 't1' ? `${t1n}✓` : hr.highWin === 't2' ? `${t2n}✓` : '='
    const multStr = (hr.lowMultiplier ?? 1) > 1 ? ` (×${hr.lowMultiplier})` : ''
    const lines = [
      `${t1n}: ${hr.t1Low}/${hr.t1High} · ${t2n}: ${hr.t2Low}/${hr.t2High}`,
      `Low: ${lowStr}${multStr} · High: ${highStr}`,
    ]
    if (hr.aggWin != null) {
      const aggStr = hr.aggWin === 't1' ? `${t1n}✓` : hr.aggWin === 't2' ? `${t2n}✓` : '='
      lines.push(`Agg: ${t1n} ${hr.t1Agg} · ${t2n} ${hr.t2Agg} → ${aggStr}`)
    }
    return lines
  }

  function _sixes(ctx, cfg, hole) {
    const r = computeSixes(ctx, cfg)
    if (!r) return []
    const seg = r.segResults.find(s => !s.skipped && hole >= s.from && hole <= s.to)
    if (!seg) return []
    const hd = seg.holeDetails.find(h => h.hole === hole)
    if (!hd || hd.incomplete) return []
    const aNms = seg.teamANames || 'A'
    const bNms = seg.teamBNames || 'B'
    const aRun = seg.holeDetails.filter(h => h.hole <= hole && h.winner === 'a').length
    const bRun = seg.holeDetails.filter(h => h.hole <= hole && h.winner === 'b').length
    const holeResult = hd.winner === 'a' ? `${aNms} wins` : hd.winner === 'b' ? `${bNms} wins` : 'Tied'
    const runStr = aRun > bRun ? `${aNms} ${aRun}-${bRun}` : bRun > aRun ? `${bNms} ${bRun}-${aRun}` : `AS ${aRun}-${bRun}`
    return [
      `${aNms} best ${hd.aBest} · ${bNms} best ${hd.bBest}`,
      `${holeResult} · ${seg.label}: ${runStr}`,
    ]
  }

  function _531(ctx, cfg, hole) {
    const r = computeFiveThreeOne(ctx, cfg)
    if (!r) return []
    const hr = r.holeResults.find(x => x.hole === hole)
    if (!hr || hr.incomplete || !hr.scores?.length) return []
    const parts = hr.scores.map(s => {
      const pts = hr.holePts?.[s.id]
      const initials = pInit(s.id) || s.name?.slice(0, 2) || '?'
      return `${initials}: ${s.net}(${pts}pts)`
    })
    const lines = [parts.join(' · ')]
    if (hr.sweep) lines.push(`★ Sweep: ${pInit(hr.sweep)}`)
    return lines
  }

  return { holeMathLines }
}
