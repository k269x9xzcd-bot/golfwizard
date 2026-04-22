/**
 * useGameNotation — pressHoles, gameNotationRows, buildCtx, gameIcon, gameLabel.
 *
 * Extracted from ScoringView.vue (ADR-003, Phase 3a).
 * Depends on helpers from useScorecardHelpers (passed in as params).
 */
import { computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import {
  computeNassau, computeSkins, computeMatch, computeSnake,
  computeDots, computeFidget, computeBestBallNet, computeFiveThreeOne,
} from '../modules/gameEngine'

export function useGameNotation({ courseData, visibleHoles, teamInitialsStr, pInit }) {
  const roundsStore = useRoundsStore()

  const HALVED_HTML = '<span class="nota-frac" aria-label="halved"><span class="nf-num">1</span><span class="nf-den">2</span></span>'

  function buildCtx() {
    return {
      course: courseData.value,
      tee: roundsStore.activeRound?.tee,
      members: roundsStore.activeMembers,
      scores: roundsStore.activeScores,
      holesMode: roundsStore.activeRound?.holes_mode || '18',
    }
  }

  function gameIcon(type) {
    const icons = { nassau:'💰', skins:'💎', match:'⚔️', matchplay:'⚔️', bestball:'🤝', snake:'🐍', dots:'🎯', fidget:'😬', bbn:'🏌️', match1v1:'⚔️', vegas:'🎰', hilow:'📊', stableford:'⭐', wolf:'🐺', hammer:'🔨', sixes:'🎲', fivethreeone:'5️⃣', nines:'9️⃣' }
    return icons[type?.toLowerCase()] || '🎮'
  }

  function gameLabel(type, config) {
    if (type?.toLowerCase() === 'bbn' && config?.label) return config.label
    if (type?.toLowerCase() === 'nassau' && config) {
      const t1 = teamInitialsStr(config.team1 || [])
      const t2 = teamInitialsStr(config.team2 || [])
      if (t1 && t2) return `Nassau ${t1} v ${t2}`
    }
    if ((type?.toLowerCase() === 'match' || type?.toLowerCase() === 'match1v1') && config) {
      const p1 = config.player1 ? pInit(config.player1) : null
      const p2 = config.player2 ? pInit(config.player2) : null
      if (p1 && p2) return `Match ${p1} v ${p2}`
    }
    const labels = { nassau:'Nassau', skins:'Skins', match:'Match', matchplay:'Match Play', bestball:'Best Ball', snake:'Snake', dots:'Dots', fidget:'Fidget', bbn:'Best Ball', match1v1:'1v1', vegas:'Vegas', hilow:'Hi-Low', stableford:'Stableford', wolf:'Wolf', hammer:'Hammer', sixes:'Sixes', fivethreeone:'5-3-1', nines:'9s' }
    return labels[type?.toLowerCase()] || type
  }

  const pressHoles = computed(() => {
    const set = new Set()
    const ctx = buildCtx()
    if (!ctx) return set
    for (const game of (roundsStore.activeGames || [])) {
      if (game.type?.toLowerCase() !== 'nassau') continue
      try {
        const r = computeNassau(ctx, game.config || {})
        const allPresses = [
          ...(r.frontSeg?.presses || []),
          ...(r.backSeg?.presses || []),
        ]
        for (const p of allPresses) {
          if (p?.start) set.add(p.start)
        }
      } catch { /* skip */ }
    }
    return set
  })

  const gameNotationRows = computed(() => {
    const rows = []
    const ctx = buildCtx()
    const games = roundsStore.activeGames

    for (const game of games) {
      const t = game.type?.toLowerCase()

      // ── NASSAU ──
      if (t === 'nassau') {
        try {
          const r = computeNassau(ctx, game.config)
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
          const fRem = 9 - fPlayed
          const fUp = r.frontSeg?.t1Up || 0
          const fDormie = fRem > 0 && Math.abs(fUp) === fRem
          const bPlayed = r.backSeg?.holeResults?.filter(hr => hr.n1 != null).length || 0
          const bRem = 9 - bPlayed
          const bUp = r.backSeg?.t1Up || 0
          const bDormie = bRem > 0 && Math.abs(bUp) === bRem
          const oRem = 18 - fPlayed - bPlayed
          const oUp = r.overallUp || 0
          const oDormie = oRem > 0 && Math.abs(oUp) === oRem
          const fmtSeg = (up, dormie) => {
            if (up === 0) return 'AS'
            const leader = up > 0 ? t1Label : t2Label
            const s = `${leader} ${Math.abs(up)}up`
            return dormie ? `<span class="nota-dormie">${s} D!</span>` : s
          }
          rows.push({
            icon: '💰', label: `${t1Label} v ${t2Label}`,
            cells,
            outSummary: fmtSeg(fUp, fDormie),
            inSummary: fmtSeg(bUp, bDormie),
            totalSummary: fmtSeg(oUp, oDormie),
            cls: 'row-nassau-nota',
          })
        } catch(e) { /* skip */ }
      }

      // ── SKINS ──
      if (t === 'skins') {
        try {
          const r = computeSkins(ctx, game.config)
          const cells = {}
          let carryCount = 0, totalWon = 0
          for (const hr of (r.holeResults || [])) {
            if (hr.winner) {
              const val = carryCount + 1
              const winInit = pInit(hr.winner)
              cells[hr.hole] = { text: `💎${winInit}${val > 1 ? '×' + val : ''}`, cls: 'nota-skin-won' }
              carryCount = 0
              totalWon += val
            } else if (hr.reason === 'tie') {
              cells[hr.hole] = { text: 'C', cls: 'nota-carry' }
              carryCount++
            }
          }
          rows.push({
            icon: '💎', label: 'Skins', cells,
            outSummary: '', inSummary: '',
            totalSummary: `${totalWon} won`,
          })
        } catch(e) { /* skip */ }
      }

      // ── MATCH / 1v1 ──
      if (t === 'match' || t === 'match1v1') {
        try {
          const r = computeMatch(ctx, game.config)
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
          const up = r.finalUp
          const remaining = totalHoles - played.length
          const isDormie = remaining > 0 && Math.abs(up) === remaining
          const p1Init = pInit(r.p1?.id) || r.p1?.name?.slice(0,2) || 'P1'
          const p2Init = pInit(r.p2?.id) || r.p2?.name?.slice(0,2) || 'P2'
          const leader = up > 0 ? p1Init : p2Init
          let summary = up === 0 ? 'AS' : `${leader} ${Math.abs(up)}up`
          if (isDormie) summary = `<span class="nota-dormie">${summary} D!</span>`
          rows.push({
            icon: '⚔️', label: `${p1Init} v ${p2Init}`,
            cells, outSummary: '', inSummary: '', totalSummary: summary,
          })
        } catch(e) { /* skip */ }
      }

      // ── DOTS ──
      if (t === 'dots') {
        try {
          const r = computeDots(ctx, game.config)
          const cells = {}
          const holeMarks = {}
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
          const summaryParts = sorted.filter(d => d.dots > 0).map(d => `${pInit(d.id)}:${d.dots}`)
          rows.push({
            icon: '🎯', label: 'Dots', cells,
            outSummary: '', inSummary: '',
            totalSummary: summaryParts.join(' ') || '',
          })
        } catch(e) { /* skip */ }
      }

      // ── BEST BALL NET ──
      if (t === 'bbn') {
        try {
          const r = computeBestBallNet(ctx, game.config)
          const cells = {}
          let runTotal = 0, runPar = 0
          for (const hr of (r.holeResults || [])) {
            if (hr.sum != null) {
              runTotal += hr.sum
              runPar += hr.par * (r.ballsToCount || 1)
              const tp = hr.toPar
              cells[hr.hole] = { text: tp === 0 ? 'E' : (tp > 0 ? `+${tp}` : `${tp}`), cls: tp < 0 ? 'nota-under' : tp > 0 ? 'nota-over' : '' }
            }
          }
          const overall = runTotal - runPar
          const overallStr = overall === 0 ? 'E' : (overall > 0 ? `+${overall}` : `${overall}`)
          rows.push({
            icon: '🏌️', label: game.config?.label || 'BB Net', cells,
            outSummary: '', inSummary: '',
            totalSummary: `${runTotal} (${overallStr})`,
          })
        } catch(e) { /* skip */ }
      }

      // ── SNAKE ──
      if (t === 'snake') {
        try {
          const r = computeSnake(ctx, game.config)
          const cells = {}
          const holeEvents = {}
          for (const evt of (game.config?.events || [])) {
            if (!holeEvents[evt.hole]) holeEvents[evt.hole] = []
            holeEvents[evt.hole].push(pInit(evt.pid))
          }
          for (const [hole, names] of Object.entries(holeEvents)) {
            const text = names.map(n => `${n}🐍`).join(' ')
            cells[+hole] = { text, cls: 'nota-snake' }
          }
          rows.push({
            icon: '🐍', label: 'Snake', cells,
            outSummary: '', inSummary: '',
            totalSummary: r.holderName ? `${r.holderName} holds` : '',
          })
        } catch(e) { /* skip */ }
      }

      // -- 5-3-1 -- one row per player showing pts per hole --
      if (t === 'fivethreeone' || t === 'nines') {
        try {
          const r = computeFiveThreeOne(ctx, game.config)
          if (!r) continue
          const to = ctx.holesMode === 9 ? 9 : 18
          const frontEnd = ctx.holesMode === 9 ? to : 9
          const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']
          const sorted531 = [...r.settlements].sort((a, b) => b.pts - a.pts)

          for (let pi = 0; pi < r.settlements.length; pi++) {
            const player = r.settlements[pi]
            const m = ctx.members.find(x => x.id === player.id)
            const initials = m ? (m.short_name || m.guest_name || '?').slice(0,3) : '?'
            const cells = {}
            let outPts = 0, inPts = 0

            for (let h = 1; h <= to; h++) {
              const hr = r.holeResults.find(x => x.hole === h)
              if (!hr || hr.incomplete) { cells[h] = { text: '', cls: '' }; continue }
              const pts = hr.holePts?.[player.id]
              if (pts == null) { cells[h] = { text: '', cls: '' }; continue }
              const cls = pts === 5 ? 'nota-t1' : pts === 1 ? 'nota-t2' : 'nota-halved'
              cells[h] = { text: String(pts % 1 === 0 ? pts : pts.toFixed(1)), cls }
              if (h <= frontEnd) outPts += pts
              else inPts += pts
            }

            const totalPts = Math.round((outPts + inPts) * 100) / 100
            const rank = sorted531.findIndex(s => s.id === player.id)
            const dotColor = rank < 3 ? medalColors[rank] : '#888'
            const netStr = player.net > 0 ? `+$${player.net}` : player.net < 0 ? `-$${Math.abs(player.net)}` : 'even'
            const netColor = player.net > 0 ? '#4ade80' : player.net < 0 ? '#f87171' : '#d4af37'

            rows.push({
              icon: '5️⃣',
              label: initials,
              labelHtml: `<span style="color:${dotColor};margin-right:3px">●</span>${initials}`,
              cells,
              outSummary: ctx.holesMode !== 9 ? `<span style="font-weight:700">${Math.round(outPts*100)/100}</span>` : '',
              inSummary: ctx.holesMode !== 9 ? `<span style="font-weight:700">${Math.round(inPts*100)/100}</span>` : '',
              totalSummary: `<span style="font-weight:700">${totalPts}pts</span>`,
              netSummary: `<span style="color:${netColor};font-size:11px;font-weight:700">${netStr}</span>`,
              cls: 'row-531',
            })
          }
        } catch(e) { /* skip */ }
      }
    }

    return rows
  })

  // ── Fidget hole winners (used by scorecard grid cell highlights) ──
  const fidgetHoleWinners = computed(() => {
    const map = {}
    const games = roundsStore.activeGames
    for (const game of games) {
      if (game.type?.toLowerCase() !== 'fidget') continue
      try {
        const ctx = buildCtx()
        const r = computeFidget(ctx, game.config)
        for (const hl of (r.holeLog || [])) {
          if (hl.winner) map[hl.hole] = hl.winner
        }
      } catch(e) { /* skip */ }
    }
    return map
  })

  function isFidgetWinner(memberId, hole) {
    return fidgetHoleWinners.value[hole] === memberId
  }

  return {
    HALVED_HTML,
    buildCtx,
    fidgetHoleWinners,
    isFidgetWinner,
    gameIcon,
    gameLabel,
    pressHoles,
    gameNotationRows,
  }
}
