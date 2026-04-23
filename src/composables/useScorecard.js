/**
 * useScorecard(round, ctx)
 *
 * Composable that drives the read-only scorecard grid.
 * Accepts a round object and a pre-built ctx (same shape as _buildCtxForRound).
 * Used by ScorecardGrid.vue (rendered hidden in HistoryView for sharing).
 *
 * ScoringView keeps its own inline versions of these — this composable is
 * NOT imported there to avoid any risk of regression.
 */
import { computed } from 'vue'
import {
  memberHandicap as _memberHandicap,
  strokesOnHole,
  holeSI,
  computeNassau,
  computeSkins,
  computeMatch,
  computeSnake,
  computeDots,
  computeFidget,
  computeBestBallNet,
} from '../modules/gameEngine'

export function useScorecard(round, ctx) {
  // ── Holes ──────────────────────────────────────────────────────
  const holesLabel = computed(() => {
    const mode = round.value?.holes_mode || '18'
    if (mode === 'front9') return 'Front 9'
    if (mode === 'back9') return 'Back 9'
    return '18 Holes'
  })

  const visibleHoles = computed(() => {
    const mode = round.value?.holes_mode || '18'
    if (mode === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1)
    if (mode === 'back9') return Array.from({ length: 9 }, (_, i) => i + 10)
    return Array.from({ length: 18 }, (_, i) => i + 1)
  })

  const hasBack9 = computed(() => visibleHoles.value.length > 9)
  const frontHoles = computed(() => visibleHoles.value.filter(h => h <= 9))
  const backHoles = computed(() => visibleHoles.value.filter(h => h > 9))

  const hasYardage = computed(() => {
    const c = ctx.value?.course
    const tee = round.value?.tee
    return !!(c?.teesData?.[tee]?.yardsByHole)
  })

  // ── Hole helpers ────────────────────────────────────────────────
  function parForHole(hole) {
    return ctx.value?.course?.par?.[hole - 1] ?? 4
  }

  function siForHole(hole) {
    return holeSI(ctx.value?.course, hole, round.value?.tee)
  }

  function yardsForHole(hole) {
    const tee = round.value?.tee
    return ctx.value?.course?.teesData?.[tee]?.yardsByHole?.[hole - 1] ?? null
  }

  function parTotal(startHole, endHole) {
    let t = 0
    for (let h = startHole; h <= endHole; h++) t += parForHole(h)
    return t
  }

  // ── Score helpers ───────────────────────────────────────────────
  function getScore(memberId, hole) {
    return ctx.value?.scores?.[memberId]?.[hole] ?? null
  }

  function memberHandicapValue(member) {
    return _memberHandicap(member, ctx.value?.course, round.value?.tee)
  }

  function memberHandicapDisplay(member) {
    const h = memberHandicapValue(member)
    if (h == null) return ''
    return Math.round(h)
  }

  function lowManStrokes(member) {
    const members = ctx.value?.members || []
    if (members.length < 2) return null
    const hcps = members.map(m => memberHandicapValue(m)).filter(h => h != null)
    if (hcps.length < 2) return null
    const lowest = Math.min(...hcps)
    const myHcp = memberHandicapValue(member)
    if (myHcp == null) return null
    return myHcp - lowest
  }

  function memberEffectiveHcp(member) {
    if (member?.stroke_override != null) return member.stroke_override
    const lm = lowManStrokes(member)
    return lm != null ? lm : memberHandicapValue(member)
  }

  function strokeDotsOnHole(member, hole) {
    const si = siForHole(hole)
    const lm = lowManStrokes(member)
    return lm != null ? strokesOnHole(lm, si) : strokesOnHole(memberHandicapValue(member), si)
  }

  function isNetWinner(memberId, hole) {
    const members = ctx.value?.members || []
    const scores = members.map(m => {
      const g = getScore(m.id, hole)
      if (g == null) return null
      return { id: m.id, net: g - strokesOnHole(memberHandicapValue(m), siForHole(hole)) }
    }).filter(s => s !== null)
    if (scores.length < 2) return false
    const minNet = Math.min(...scores.map(s => s.net))
    const winners = scores.filter(s => s.net === minNet)
    return winners.length === 1 && winners[0].id === memberId
  }

  function scoreNotation(score, par) {
    if (score == null) return 'sn-empty'
    const diff = score - par
    if (diff <= -3) return 'sn-alb'
    if (diff === -2) return 'sn-eagle'
    if (diff === -1) return 'sn-birdie'
    if (diff === 0) return 'sn-par'
    if (diff === 1) return 'sn-bogey'
    if (diff === 2) return 'sn-dbl'
    return 'sn-trip'
  }

  function memberGrossTotal(memberId, startHole, endHole) {
    let total = 0, count = 0
    for (let h = startHole; h <= endHole; h++) {
      const s = getScore(memberId, h)
      if (s !== null) { total += s; count++ }
    }
    return count > 0 ? total : '—'
  }

  function memberNetTotal(memberId, startHole, endHole) {
    let total = 0, count = 0
    const member = (ctx.value?.members || []).find(m => m.id === memberId)
    if (!member) return '—'
    const hcp = memberEffectiveHcp(member)
    for (let h = startHole; h <= endHole; h++) {
      const s = getScore(memberId, h)
      if (s !== null) {
        total += s - strokesOnHole(hcp, siForHole(h))
        count++
      }
    }
    return count > 0 ? total : '—'
  }

  // ── Team styling ────────────────────────────────────────────────
  function teamRowClass(m) { return m.team === 1 ? 'team1-row' : m.team === 2 ? 'team2-row' : '' }
  function teamStickyClass(m) { return m.team === 1 ? 'sticky-t1' : m.team === 2 ? 'sticky-t2' : 'sticky-default' }
  function teamTextClass(m) { return m.team === 1 ? 't1' : m.team === 2 ? 't2' : '' }
  function teamBarClass(m) { return m.team === 1 ? 'bar-t1' : m.team === 2 ? 'bar-t2' : '' }

  // ── Sorted player groups ────────────────────────────────────────
  const sortedPlayerGroups = computed(() => {
    const members = ctx.value?.members || []
    const games = round.value?.game_configs || []
    const wolfGame = games.find(g => g.type === 'wolf')
    const wolfOrder = wolfGame?.config?.wolfTeeOrder || []

    // When wolf game is active with a full tee order, sort rows by rotation
    if (wolfOrder.length >= members.length) {
      return wolfOrder
        .map(id => members.find(m => m.id === id))
        .filter(Boolean)
        .map(m => ({ member: m, team: 0 }))
    }

    const t1 = members.filter(m => m.team === 1).map(m => ({ member: m, team: 1 }))
    const t2 = members.filter(m => m.team === 2).map(m => ({ member: m, team: 2 }))
    const noTeam = members.filter(m => !m.team || (m.team !== 1 && m.team !== 2)).map(m => ({ member: m, team: 0 }))
    return [...t1, ...t2, ...noTeam]
  })

  // ── Initials (collision-aware) ──────────────────────────────────
  function nameToInitials(name) {
    if (!name || name === '?') return '??'
    const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    if (parts[0]?.length >= 2) return (parts[0][0] + parts[0][1]).toUpperCase()
    return (parts[0]?.[0] ?? '?').toUpperCase() + '?'
  }

  function _baseInitials(m) {
    if (!m) return '??'
    const src = m.guest_name || m.name || m.short_name || ''
    return nameToInitials(src)
  }

  let _initialsCache = { key: null, map: null }
  function _buildInitialsMap() {
    const members = ctx.value?.members || []
    const key = members.map(m => m.id).join('|')
    if (_initialsCache.key === key && _initialsCache.map) return _initialsCache.map
    const map = new Map()
    const base = new Map()
    for (const m of members) base.set(m.id, _baseInitials(m))
    const counts = new Map()
    for (const v of base.values()) counts.set(v, (counts.get(v) || 0) + 1)
    for (const m of members) {
      const b = base.get(m.id)
      if ((counts.get(b) || 0) <= 1) { map.set(m.id, b); continue }
      const full = (m.guest_name || m.name || m.short_name || '').trim()
      const parts = full.replace(/\./g, '').split(/\s+/).filter(Boolean)
      let ext = b
      const word = parts.length >= 2 ? parts[parts.length - 1] : (parts[0] || '')
      for (let extra = 1; extra <= 3 && ext.length < 5; extra++) {
        const candidate = b + (word[extra] || '').toLowerCase()
        const stillCollides = members.some(o => o.id !== m.id && _baseInitials(o) === b && (() => {
          const oFull = (o.guest_name || o.name || o.short_name || '').trim()
          const oParts = oFull.replace(/\./g, '').split(/\s+/).filter(Boolean)
          const oWord = oParts.length >= 2 ? oParts[oParts.length - 1] : (oParts[0] || '')
          return (b + (oWord[extra] || '').toLowerCase()) === candidate
        })())
        ext = candidate
        if (!stillCollides) break
      }
      map.set(m.id, ext)
    }
    _initialsCache = { key, map }
    return map
  }

  function memberGridName(member) {
    if (!member) return '?'
    return _buildInitialsMap().get(member.id) || _baseInitials(member)
  }

  function memberInitials(m) {
    if (!m) return '??'
    return _buildInitialsMap().get(m.id) || _baseInitials(m)
  }

  function pInit(memberId) {
    const m = (ctx.value?.members || []).find(m => m.id === memberId)
    return memberInitials(m)
  }

  function teamInitialsStr(teamIds) {
    return (teamIds || []).map(id => pInit(id)).join('+')
  }

  // ── Press holes (Nassau) ────────────────────────────────────────
  const pressHoles = computed(() => {
    const set = new Set()
    if (!ctx.value) return set
    for (const game of (round.value?.game_configs || [])) {
      if (game.type?.toLowerCase() !== 'nassau') continue
      try {
        const r = computeNassau(ctx.value, game.config || {})
        for (const p of [...(r.frontSeg?.presses || []), ...(r.backSeg?.presses || [])]) {
          if (p?.start) set.add(p.start)
        }
      } catch { /* skip */ }
    }
    return set
  })

  // ── Fidget hole winners ─────────────────────────────────────────
  const fidgetHoleWinners = computed(() => {
    const map = {}
    if (!ctx.value) return map
    for (const game of (round.value?.game_configs || [])) {
      if (game.type?.toLowerCase() !== 'fidget') continue
      try {
        const r = computeFidget(ctx.value, game.config)
        for (const hl of (r.holeLog || [])) {
          if (hl.winner) map[hl.hole] = hl.winner
        }
      } catch { /* skip */ }
    }
    return map
  })

  function isFidgetWinner(memberId, hole) {
    return fidgetHoleWinners.value[hole] === memberId
  }

  const HALVED_HTML = '<span class="nota-frac" aria-label="halved"><span class="nf-num">1</span><span class="nf-den">2</span></span>'

  // ── Game notation rows ──────────────────────────────────────────
  const gameNotationRows = computed(() => {
    const rows = []
    if (!ctx.value) return rows
    const games = round.value?.game_configs || []

    for (const game of games) {
      const t = game.type?.toLowerCase()

      if (t === 'nassau') {
        try {
          const r = computeNassau(ctx.value, game.config)
          const cfg = game.config || {}
          const t1Label = teamInitialsStr(cfg.team1 || [])
          const t2Label = teamInitialsStr(cfg.team2 || [])
          const cells = {}
          const allHR = [...(r.frontSeg?.holeResults || []), ...(r.backSeg?.holeResults || [])]
          for (const hr of allHR) {
            if (hr.n1 == null || hr.n2 == null) { cells[hr.hole] = { text: '', cls: '' }; continue }
            const up = hr.t1Up ?? 0
            if (up > 0) cells[hr.hole] = { text: `U${up}`, cls: 'nota-t1' }
            else if (up < 0) cells[hr.hole] = { text: `D${Math.abs(up)}`, cls: 'nota-t2' }
            else cells[hr.hole] = { text: 'AS', cls: 'nota-halved' }
          }
          const fPlayed = r.frontSeg?.holeResults?.filter(hr => hr.n1 != null).length || 0
          const fRem = 9 - fPlayed, fUp = r.frontSeg?.t1Up || 0
          const fDormie = fRem > 0 && Math.abs(fUp) === fRem
          const bPlayed = r.backSeg?.holeResults?.filter(hr => hr.n1 != null).length || 0
          const bRem = 9 - bPlayed, bUp = r.backSeg?.t1Up || 0
          const bDormie = bRem > 0 && Math.abs(bUp) === bRem
          const oRem = 18 - fPlayed - bPlayed, oUp = r.overallUp || 0
          const oDormie = oRem > 0 && Math.abs(oUp) === oRem
          const fmtSeg = (up, dormie) => {
            if (up === 0) return 'AS'
            const leader = up > 0 ? t1Label : t2Label
            const s = `${leader} ${Math.abs(up)}up`
            return dormie ? `<span class="nota-dormie">${s} D!</span>` : s
          }
          rows.push({ icon: '💰', label: `${t1Label} v ${t2Label}`, cells, outSummary: fmtSeg(fUp, fDormie), inSummary: fmtSeg(bUp, bDormie), totalSummary: fmtSeg(oUp, oDormie), cls: 'row-nassau-nota' })
        } catch { /* skip */ }
      }

      if (t === 'skins') {
        try {
          const r = computeSkins(ctx.value, game.config)
          const cells = {}
          let carryCount = 0, totalWon = 0
          for (const hr of (r.holeResults || [])) {
            if (hr.winner) {
              const val = carryCount + 1
              cells[hr.hole] = { text: `💎${pInit(hr.winner)}${val > 1 ? '×' + val : ''}`, cls: 'nota-skin-won' }
              carryCount = 0; totalWon += val
            } else if (hr.reason === 'tie') {
              cells[hr.hole] = { text: 'C', cls: 'nota-carry' }; carryCount++
            }
          }
          rows.push({ icon: '💎', label: 'Skins', cells, outSummary: '', inSummary: '', totalSummary: `${totalWon} won` })
        } catch { /* skip */ }
      }

      if (t === 'match' || t === 'match1v1') {
        try {
          const r = computeMatch(ctx.value, game.config)
          if (!r) continue
          const cells = {}
          const played = r.holeResults?.filter(hr => !hr.incomplete) || []
          const totalHoles = visibleHoles.value.length
          for (const hr of (r.holeResults || [])) {
            if (hr.incomplete) { cells[hr.hole] = { text: '', cls: '' }; continue }
            const up = hr.p1Up ?? 0
            if (up > 0) cells[hr.hole] = { text: `U${up}`, cls: 'nota-t1' }
            else if (up < 0) cells[hr.hole] = { text: `D${Math.abs(up)}`, cls: 'nota-t2' }
            else cells[hr.hole] = { text: 'AS', cls: 'nota-halved' }
          }
          const up = r.finalUp, remaining = totalHoles - played.length
          const isDormie = remaining > 0 && Math.abs(up) === remaining
          const p1Init = pInit(r.p1?.id) || 'P1', p2Init = pInit(r.p2?.id) || 'P2'
          const leader = up > 0 ? p1Init : p2Init
          let summary = up === 0 ? 'AS' : `${leader} ${Math.abs(up)}up`
          if (isDormie) summary = `<span class="nota-dormie">${summary} D!</span>`
          rows.push({ icon: '⚔️', label: `${p1Init} v ${p2Init}`, cells, outSummary: '', inSummary: '', totalSummary: summary })
        } catch { /* skip */ }
      }

      if (t === 'dots') {
        try {
          const r = computeDots(ctx.value, game.config)
          const cells = {}, holeMarks = {}
          for (const [mid, data] of Object.entries(r.dots || {})) {
            for (const bd of (data.breakdown || [])) {
              if (!holeMarks[bd.hole]) holeMarks[bd.hole] = []
              const sym = bd.type === 'Eagle' ? '★' : bd.type === 'Birdie' ? '●' : bd.type === 'Greenie' ? 'G' : bd.type === 'Sandy' ? 'S' : bd.type === 'Chip-in' ? 'C' : '?'
              holeMarks[bd.hole].push(`<span class="nota-dot-who">${pInit(mid)}</span>${sym}`)
            }
          }
          for (const [hole, marks] of Object.entries(holeMarks)) {
            cells[+hole] = { text: marks.join(' '), cls: 'nota-dots' }
          }
          const sorted = Object.entries(r.dots || {}).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.dots - a.dots)
          rows.push({ icon: '🎯', label: 'Dots', cells, outSummary: '', inSummary: '', totalSummary: sorted.filter(d => d.dots > 0).map(d => `${pInit(d.id)}:${d.dots}`).join(' ') || '' })
        } catch { /* skip */ }
      }

      if (t === 'bbn') {
        try {
          const r = computeBestBallNet(ctx.value, game.config)
          const cells = {}
          let runTotal = 0, runPar = 0
          for (const hr of (r.holeResults || [])) {
            if (hr.sum != null) {
              runTotal += hr.sum; runPar += hr.par * (r.ballsToCount || 1)
              const tp = hr.toPar
              cells[hr.hole] = { text: tp === 0 ? 'E' : (tp > 0 ? `+${tp}` : `${tp}`), cls: tp < 0 ? 'nota-under' : tp > 0 ? 'nota-over' : '' }
            }
          }
          const overall = runTotal - runPar
          rows.push({ icon: '🏌️', label: game.config?.label || 'BB Net', cells, outSummary: '', inSummary: '', totalSummary: `${runTotal} (${overall === 0 ? 'E' : overall > 0 ? '+' + overall : overall})` })
        } catch { /* skip */ }
      }

      if (t === 'snake') {
        try {
          const r = computeSnake(ctx.value, game.config)
          const cells = {}, holeEvents = {}
          for (const evt of (game.config?.events || [])) {
            if (!holeEvents[evt.hole]) holeEvents[evt.hole] = []
            holeEvents[evt.hole].push(pInit(evt.pid))
          }
          for (const [hole, names] of Object.entries(holeEvents)) {
            cells[+hole] = { text: names.map(n => `${n}🐍`).join(' '), cls: 'nota-snake' }
          }
          rows.push({ icon: '🐍', label: 'Snake', cells, outSummary: '', inSummary: '', totalSummary: r.holderName ? `${r.holderName} holds` : '' })
        } catch { /* skip */ }
      }
    }

    return rows
  })

  return {
    holesLabel,
    visibleHoles,
    hasBack9,
    frontHoles,
    backHoles,
    hasYardage,
    pressHoles,
    sortedPlayerGroups,
    gameNotationRows,
    parForHole,
    siForHole,
    yardsForHole,
    parTotal,
    getScore,
    memberHandicapDisplay,
    lowManStrokes,
    strokeDotsOnHole,
    isNetWinner,
    isFidgetWinner,
    scoreNotation,
    memberGrossTotal,
    memberNetTotal,
    memberGridName,
    teamRowClass,
    teamStickyClass,
    teamTextClass,
    teamBarClass,
  }
}
