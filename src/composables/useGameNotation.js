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
  computeDots, computeFidget, computeBestBall, computeBestBallNet, computeFiveThreeOne, computeNines,
  computeVegas, computeHiLow, computeSixes, computeStableford, computeHammer, computeBbb, computeWolf,
  holePar,
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
    const icons = { nassau:'💰', skins:'💎', match:'⚔️', matchplay:'⚔️', bestball:'🤝', snake:'🐍', dots:'🎯', fidget:'😬', bbn:'🏌️', match1v1:'⚔️', vegas:'🎰', hilow:'📊', stableford:'⭐', wolf:'🐺', hammer:'🔨', sixes:'🎲', fivethreeone:'5️⃣', nines:'9️⃣', bbb:'🏌️' }
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
    const labels = { nassau:'Nassau', skins:'Skins', match:'Match', matchplay:'Match Play', bestball:'Best Ball', snake:'Snake', dots:'Dots', fidget:'Fidget', bbn:'Best Ball', match1v1:'1v1', vegas:'Vegas', hilow:'Hi-Low', stableford:'Stableford', wolf:'Wolf', hammer:'Hammer', sixes:'Sixes', fivethreeone:'5-3-1', nines:'9s', bbb:'BBB' }
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
            game,
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
            game,
          })
        } catch(e) { /* skip */ }
      }

      // ── MATCH / 1v1 ──
      if (t === 'match' || t === 'match1v1') {
        try {
          const cfg = game.config || {}
          // 1v1: use computeMatch; 2v2: fall back to computeBestBall (team match play)
          const is1v1 = cfg.player1 && cfg.player2
          let holeResults, finalUp, p1Label, p2Label, isDormie

          if (is1v1) {
            const r = computeMatch(ctx, cfg)
            if (!r) continue
            holeResults = r.holeResults || []
            finalUp = r.finalUp
            const played = holeResults.filter(hr => !hr.incomplete)
            const remaining = visibleHoles.value.length - played.length
            isDormie = remaining > 0 && Math.abs(finalUp) === remaining
            p1Label = pInit(r.p1?.id) || r.p1?.name?.slice(0, 2) || 'P1'
            p2Label = pInit(r.p2?.id) || r.p2?.name?.slice(0, 2) || 'P2'
          } else if (cfg.team1?.length && cfg.team2?.length) {
            const r = computeBestBall(ctx, { ...cfg, ballsPerTeam: 1 })
            if (!r) continue
            holeResults = (r.holeResults || []).map(hr => ({
              ...hr,
              p1Up: hr.t1Up,  // normalise field name for shared cell-build below
            }))
            finalUp = r.finalUp
            const played = holeResults.filter(hr => !hr.incomplete)
            const remaining = visibleHoles.value.length - played.length
            isDormie = remaining > 0 && Math.abs(finalUp) === remaining
            p1Label = teamInitialsStr(cfg.team1)
            p2Label = teamInitialsStr(cfg.team2)
          } else {
            continue  // config incomplete — skip
          }

          const cells = {}
          for (const hr of holeResults) {
            if (hr.incomplete) { cells[hr.hole] = { text: '', cls: '' }; continue }
            const up = hr.p1Up ?? 0
            if (up > 0) cells[hr.hole] = { text: `U${up}`, cls: 'nota-t1' }
            else if (up < 0) cells[hr.hole] = { text: `D${Math.abs(up)}`, cls: 'nota-t2' }
            else cells[hr.hole] = { text: 'AS', cls: 'nota-halved' }
          }
          const leader = finalUp > 0 ? p1Label : p2Label
          let summary = finalUp === 0 ? 'AS' : `${leader} ${Math.abs(finalUp)}up`
          if (isDormie) summary = `<span class="nota-dormie">${summary} D!</span>`
          rows.push({
            icon: '⚔️', label: `${p1Label} v ${p2Label}`,
            cells, outSummary: '', inSummary: '', totalSummary: summary,
            game,
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
              const sym = bd.pts < 0 ? '−' : bd.type.startsWith('Eagle') ? '★★' : bd.type.startsWith('Birdie') ? '●' : bd.type === 'Greenie' ? 'G' : bd.type === 'Sandy' ? 'S' : bd.type === 'Chip-in' ? 'C' : bd.type === 'Barkie' ? 'B' : bd.type === 'Arnie' ? 'A' : bd.type === 'Ferret' ? 'F' : '◦'
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
            game,
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
            game,
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
            game,
          })
        } catch(e) { /* skip */ }
      }


      // ── VEGAS ──
      if (t === 'vegas') {
        try {
          const r = computeVegas(ctx, game.config)
          if (!r) continue
          const cfg = game.config || {}
          const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
          const ppt = cfg.ppt || 1
          const fmtAmt = (n) => n >= 0 ? `$${n}` : `($${Math.abs(n)})`
          const holeCells = {}, runCells = {}
          let running = 0
          for (const hr of (r.holeResults || [])) {
            if (hr.incomplete || hr.t1Num == null) continue
            const holeDollars = hr.diff * ppt
            running += holeDollars
            const star = hr.variant ? '★' : ''
            if (holeDollars > 0) {
              holeCells[hr.hole] = { text: `$${holeDollars}${star}`, cls: 'nota-t1' }
            } else if (holeDollars < 0) {
              holeCells[hr.hole] = { text: `($${Math.abs(holeDollars)})${star}`, cls: 'nota-t2' }
            } else {
              holeCells[hr.hole] = { text: '-', cls: 'nota-halved' }
            }
            const runText = running === 0 ? 'E' : fmtAmt(running)
            runCells[hr.hole] = {
              text: runText,
              cls: running > 0 ? 'nota-t1' : running < 0 ? 'nota-t2' : 'nota-halved',
            }
          }
          const finalNet = r.t1Total * ppt
          const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
          const summary = finalNet === 0 ? 'AS' : `${finalNet > 0 ? t1n : t2n} ${fmtAmt(Math.abs(finalNet))}`
          rows.push({ icon: '🎰', label: t1n, cells: holeCells, outSummary: '', inSummary: '', totalSummary: '', netSummary: '', game })
          rows.push({ icon: '', label: 'Δ', cells: runCells, outSummary: '', inSummary: '', totalSummary: summary, netSummary: '', game })
        } catch(e) { /* skip */ }
      }

      // ── HILOW ──
      if (t === 'hilow') {
        try {
          const r = computeHiLow(ctx, game.config)
          if (!r) continue
          const cells = {}
          const t1n = teamInitialsStr(game.config?.team1 || []) || 'T1'
          const t2n = teamInitialsStr(game.config?.team2 || []) || 'T2'
          for (const hr of (r.holeResults || [])) {
            if (hr.incomplete) continue
            const parts = []
            if (hr.lowWin === 't1') parts.push(`<span class="nota-t1">L✓</span>`)
            else if (hr.lowWin === 't2') parts.push(`<span class="nota-t2">L✓</span>`)
            else parts.push('<span class="nota-halved">L=</span>')
            if (hr.highWin === 't1') parts.push(`<span class="nota-t1">H✓</span>`)
            else if (hr.highWin === 't2') parts.push(`<span class="nota-t2">H✓</span>`)
            else parts.push('<span class="nota-halved">H=</span>')
            if (hr.aggWin != null) {
              if (hr.aggWin === 't1') parts.push(`<span class="nota-t1">A✓</span>`)
              else if (hr.aggWin === 't2') parts.push(`<span class="nota-t2">A✓</span>`)
              else parts.push('<span class="nota-halved">A=</span>')
            }
            cells[hr.hole] = { text: parts.join(''), cls: '' }
          }
          const ppt = game.config?.ppt || 5
          const net = (r.t1Pts - r.t2Pts) * ppt
          const summary = net === 0 ? 'AS' : `${net > 0 ? t1n : t2n} +$${Math.abs(net)}`
          rows.push({ icon: '📊', label: `${t1n}v${t2n}`, cells, outSummary: `${r.t1Pts}`, inSummary: `${r.t2Pts}`, totalSummary: summary, game })
        } catch(e) { /* skip */ }
      }

      // ── WOLF ──
      if (t === 'wolf') {
        try {
          const r = computeWolf(ctx, game.config)
          if (!r) continue
          const cells = {}
          for (const hr of (r.holeResults || [])) {
            if (hr.incomplete) { cells[hr.hole] = { text: '', cls: '' }; continue }
            const wolfInit = pInit(hr.wolf) || hr.wolfName?.slice(0, 2) || '?'
            const partnerInit = hr.partner ? (pInit(hr.partner) || hr.partnerName?.slice(0, 2) || '?') : null
            const tag = hr.isBlind ? '×' + (game.config?.blindWolfMultiplier ?? 8)
              : hr.isLone ? '×' + (game.config?.wolfLoneMultiplier ?? 4)
              : partnerInit ? `+${partnerInit}` : ''
            const cls = hr.winner === 'wolf' ? 'nota-t1'
              : hr.winner === 'field' ? 'nota-t2'
              : 'nota-halved'
            const resultMark = hr.winner === 'wolf' ? '▲' : hr.winner === 'field' ? '▼' : '='
            cells[hr.hole] = { text: `🐺${wolfInit}${tag} ${resultMark}`, cls }
          }
          // Summary: player with highest net gain
          const sorted = [...(r.settlements || [])].sort((a, b) => b.net - a.net)
          const leader = sorted[0]
          const summary = (leader && leader.net > 0)
            ? `${pInit(leader.id) || leader.name} +$${leader.net}`
            : 'AS'
          rows.push({
            icon: '🐺', label: 'Wolf', cells,
            outSummary: '', inSummary: '', totalSummary: summary,
            game,
          })
        } catch(e) { /* skip */ }
      }

      // ── SIXES ──
      if (t === 'sixes') {
        try {
          const r = computeSixes(ctx, game.config)
          if (!r) continue

          // One row per 6-hole segment — shows pairing + per-hole hole-winner
          for (const seg of (r.segResults || [])) {
            if (seg.skipped) continue
            const aNms = seg.teamANames || 'A'
            const bNms = seg.teamBNames || 'B'
            const cells = {}
            for (const hd of (seg.holeDetails || [])) {
              if (hd.incomplete) { cells[hd.hole] = { text: '', cls: '' }; continue }
              const cls = hd.winner === 'a' ? 'nota-t1' : hd.winner === 'b' ? 'nota-t2' : 'nota-halved'
              const sym = hd.winner === 'a' ? aNms.slice(0,2) : hd.winner === 'b' ? bNms.slice(0,2) : '='
              cells[hd.hole] = { text: sym, cls }
            }
            const played = (seg.holeDetails || []).filter(hd => !hd.incomplete)
            const segResult = played.length === 0 ? ''
              : seg.aWins > seg.bWins ? `${aNms} ${seg.aWins}-${seg.bWins}`
              : seg.bWins > seg.aWins ? `${bNms} ${seg.bWins}-${seg.aWins}`
              : `AS ${seg.aWins}-${seg.bWins}`
            const ptsStr = seg.aPts != null && played.length === (seg.to - seg.from + 1)
              ? ` (${seg.aPts}/${seg.bPts}pts)` : ''
            rows.push({
              icon: '🎲',
              label: `${aNms}v${bNms}`,
              cells,
              outSummary: '', inSummary: '',
              totalSummary: segResult + ptsStr,
              game,
              cls: 'row-sixes-seg',
            })
          }

          // Settlement row
          const sorted = [...(r.settlements || [])].sort((a, b) => b.net - a.net)
          const topNet = sorted[0]?.net || 0
          const summary = topNet > 0 ? `${sorted[0].name} +$${topNet}` : 'AS'
          rows.push({ icon: '', label: '💰 Total', cells: {}, outSummary: '', inSummary: '', totalSummary: summary, game })
        } catch(e) { /* skip */ }
      }

      // ── STABLEFORD ──
      if (t === 'stableford') {
        try {
          const r = computeStableford(ctx, game.config)
          if (!r) continue
          const to = ctx.holesMode === 9 ? 9 : 18
          const frontEnd = to === 9 ? to : 9
          const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']
          const sorted = [...(r.settlements || [])].sort((a, b) => b.pts - a.pts)

          for (const player of (r.settlements || [])) {
            const m = ctx.members.find(x => x.id === player.id)
            const initials = m ? (m.short_name || m.guest_name || '?').slice(0,3) : '?'
            const holePoints = r.playerResults?.[player.id]?.holePoints || []
            const cells = {}
            let outPts = 0, inPts = 0
            for (const hp of holePoints) {
              if (hp.pts == null) { cells[hp.hole] = { text: '', cls: '' }; continue }
              const cls = hp.pts >= 3 ? 'nota-t1' : hp.pts === 2 ? '' : hp.pts === 1 ? 'nota-halved' : 'nota-t2'
              cells[hp.hole] = { text: hp.pts > 0 ? `+${hp.pts}` : `${hp.pts}`, cls }
              if (hp.hole <= frontEnd) outPts += hp.pts
              else inPts += hp.pts
            }
            const totalPts = outPts + inPts
            const rank = sorted.findIndex(s => s.id === player.id)
            const dotColor = rank < 3 ? medalColors[rank] : '#888'
            const netStr = player.net > 0 ? `+$${player.net}` : player.net < 0 ? `-$${Math.abs(player.net)}` : 'even'
            const netColor = player.net > 0 ? '#4ade80' : player.net < 0 ? '#f87171' : '#d4af37'
            rows.push({
              icon: '⭐', label: initials,
              labelHtml: `<span style="color:${dotColor};margin-right:3px">●</span>${initials}`,
              cells,
              outSummary: ctx.holesMode !== 9 ? `${outPts}` : '',
              inSummary: ctx.holesMode !== 9 ? `${inPts}` : '',
              totalSummary: `<span style="font-weight:700">${totalPts}pts</span>`,
              netSummary: `<span style="color:${netColor};font-size:11px;font-weight:700">${netStr}</span>`,
              cls: 'row-531',
              game,
            })
          }
        } catch(e) { /* skip */ }
      }

      // ── HAMMER ──
      if (t === 'hammer') {
        try {
          const r = computeHammer(ctx, game.config)
          if (!r) continue
          const cfg = game.config || {}
          const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
          const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
          const eventCells = {}, netCells = {}
          let running = 0
          for (const hr of (r.holeResults || [])) {
            if (hr.incomplete) continue
            running += hr.t1Wins
            // Row 1: hammer events — only holes with hammer activity get text
            if (hr.conceded) {
              const winner = hr.concededBy === 't2' ? t1n : t2n
              eventCells[hr.hole] = { text: `${winner}🏳️$${hr.holeValue}`, cls: hr.concededBy === 't2' ? 'nota-t1' : 'nota-t2' }
            } else if (hr.throws > 0) {
              const cls = hr.winner === 't1' ? 'nota-t1' : hr.winner === 't2' ? 'nota-t2' : 'nota-halved'
              eventCells[hr.hole] = { text: `🔨$${hr.holeValue}`, cls }
            } else if (hr.carried) {
              eventCells[hr.hole] = { text: `→$${hr.holeValue}`, cls: 'nota-halved' }
            }
            // Row 2: running dollar total from T1's perspective
            const runText = running > 0 ? `+$${running}` : running < 0 ? `-$${Math.abs(running)}` : 'E'
            netCells[hr.hole] = {
              text: runText,
              cls: running > 0 ? 'nota-t1' : running < 0 ? 'nota-t2' : 'nota-halved',
            }
          }
          const finalNet = r.settlement?.t1Net || 0
          const summary = finalNet === 0 ? 'AS' : `${finalNet > 0 ? t1n : t2n} +$${Math.abs(finalNet)}`
          rows.push({ icon: '🔨', label: t1n, cells: eventCells, outSummary: '', inSummary: '', totalSummary: '', netSummary: '', game })
          rows.push({ icon: '', label: 'Δ', cells: netCells, outSummary: '', inSummary: '', totalSummary: summary, netSummary: '', game })
        } catch(e) { /* skip */ }
      }

      // -- 5-3-1 / 9s -- one row per player showing pts per hole --
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
              game,
            })
          }
        } catch(e) { /* skip */ }
      }

      // ── BBB ──
      if (t === 'bbb') {
        try {
          const r = computeBbb(ctx, game.config)
          const cells = {}
          for (const [holeKey, award] of Object.entries(r.awards || {})) {
            const h = parseInt(holeKey)
            const parts = []
            if (award.bingo) parts.push(`<span class="nota-dot-who">${pInit(award.bingo)}</span>B1`)
            if (award.bango) parts.push(`<span class="nota-dot-who">${pInit(award.bango)}</span>B2`)
            if (award.bongo) parts.push(`<span class="nota-dot-who">${pInit(award.bongo)}</span>B3`)
            if (parts.length) cells[h] = { text: parts.join(' '), cls: 'nota-bbb' }
          }
          const sorted = (r.standings || []).slice().sort((a, b) => b.pts - a.pts)
          const summaryParts = sorted.filter(s => s.pts > 0).map(s => `${pInit(s.id)}:${s.pts}`)
          rows.push({
            icon: '🏌️', label: 'BBB', cells,
            outSummary: '', inSummary: '',
            totalSummary: summaryParts.join(' ') || '',
            game,
          })
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
