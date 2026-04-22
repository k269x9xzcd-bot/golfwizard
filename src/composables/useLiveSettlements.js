/**
 * useLiveSettlements — liveSettlements computed + gameSummaryHtml.
 *
 * Extracted from ScoringView.vue (ADR-003, Phase 3a).
 * Depends on buildCtx, gameIcon, gameLabel, teamInitialsStr, pInit, memberDisplay,
 * visibleHoles from sister composables.
 */
import { computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { computeAllSettlements } from '../modules/settlements'
import {
  computeNassau, computeSkins, computeMatch, computeVegas, computeSnake,
  computeHiLow, computeStableford, computeWolf, computeHammer, computeSixes,
  computeFiveThreeOne, computeDots, computeFidget, computeBestBallNet, computeBestBall,
} from '../modules/gameEngine'

export function useLiveSettlements({ buildCtx, gameIcon, gameLabel, teamInitialsStr, pInit, memberDisplay, visibleHoles }) {
  const roundsStore = useRoundsStore()

  const liveSettlements = computed(() => {
    if (!roundsStore.activeRound || roundsStore.activeGames.length === 0) return null
    const ctx = buildCtx()
    try {
      return computeAllSettlements(ctx, roundsStore.activeGames)
    } catch (e) {
      return null
    }
  })

  function gameSummaryHtml(game) {
    const ctx = buildCtx()
    const cfg = game.config || {}
    const icon = gameIcon(game.type)
    const t = game.type?.toLowerCase()

    function _gameLine({ gameName, winner, value, detail }) {
      const valStr = (() => {
        if (!value) return ''
        const parts = []
        if (value.pts != null) parts.push(`+${value.pts} pt${value.pts === 1 ? '' : 's'}`)
        if (value.dollars != null) parts.push(`+$${value.dollars}`)
        return parts.join(' · ')
      })()
      const titleRight = winner
        ? `<span class="gs-winner"><span class="gs-star">⭐️</span> <span class="gs-winner-name">${winner}</span><span class="gs-value">${valStr ? '&nbsp;' + valStr : ''}</span></span>`
        : (valStr ? `<span class="gs-value gs-value-muted">${valStr}</span>` : '')
      const titleLeft = `<span class="gs-game-title">${icon} ${gameName}</span>`
      const titleRow = `<div class="gs-title-row">${titleLeft}${titleRight ? '<span class="gs-dash">·</span>' + titleRight : ''}</div>`
      const detailRow = detail ? `<div class="gs-detail-row">${detail}</div>` : ''
      return `<div class="gs-line">${titleRow}${detailRow}</div>`
    }

    try {
      // ── Nassau ──
      if (t === 'nassau') {
        const r = computeNassau(ctx, cfg)
        const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
        const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'

        function fmtSeg(label, seg, segDollar) {
          if (!seg) return `<span style="opacity:.35">${label}: —</span>`
          const up = seg.t1Up
          const fmtUp = up === 0 ? 'AS' : (up > 0 ? `+${up}` : `${up}`)
          const pressStrs = (seg.presses || []).map(p => {
            const s = p.score || 0
            return s === 0 ? 'AS' : (s > 0 ? `+${s}` : `${s}`)
          })
          const slashStatus = [fmtUp, ...pressStrs].join('/')
          let html = `<span style="font-weight:600">${label}:</span> <span style="font-family:monospace;letter-spacing:0.5px">${slashStatus}</span>`
          if (segDollar !== 0) {
            const winner = segDollar > 0 ? t1n : t2n
            html += ` · <span style="color:#4ade80;font-weight:700">${winner} $${Math.abs(segDollar)}</span>`
          }
          return html
        }

        const s = r.settlement
        const fHtml = fmtSeg('Front', r.frontSeg, s.front)
        const bHtml = fmtSeg('Back', r.backSeg, s.back)
        const oUp = r.overallUp
        const oFmt = oUp === 0 ? 'AS' : (oUp > 0 ? `+${oUp}` : `${oUp}`)
        let oHtml = `<span style="font-weight:600">Overall:</span> <span style="font-family:monospace;letter-spacing:0.5px">${oFmt}</span>`
        if (s.overall !== 0) {
          const oWinner = s.overall > 0 ? t1n : t2n
          oHtml += ` · <span style="color:#4ade80;font-weight:700">${oWinner} $${Math.abs(s.overall)}</span>`
        }

        let alohaHtml = ''
        if (r.alohaResult) {
          const ar = r.alohaResult
          const alohaWinner = ar.t1Delta > 0 ? t1n : t2n
          alohaHtml = `<div>🌺 <span style="font-weight:600">Aloha:</span> <span style="color:#4ade80;font-weight:700">${alohaWinner} +$${ar.amount}</span></div>`
        } else if (cfg.aloha?.status === 'accepted') {
          alohaHtml = `<div>🌺 <span style="font-weight:600">Aloha:</span> <span style="opacity:.5">accepted — h18 pending</span></div>`
        } else if (cfg.aloha?.status === 'pending') {
          alohaHtml = `<div>🌺 <span style="font-weight:600">Aloha:</span> <span style="opacity:.5">offered — waiting</span></div>`
        }

        let totLine = ''
        const netOwed = s.total
        if (netOwed !== 0) {
          const payer = netOwed < 0 ? t1n : t2n
          const payee = netOwed < 0 ? t2n : t1n
          const grossTotal = Math.abs(s.front) + Math.abs(s.back) + Math.abs(s.overall) + Math.abs(s.aloha || 0)
          const grossNote = grossTotal > Math.abs(netOwed) ? ` <span style="font-size:10px;opacity:.5">(gross: $${grossTotal})</span>` : ''
          totLine = `<div style="font-size:12px;font-weight:700;margin-top:5px;padding:5px 8px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:8px;color:#4ade80">💰 ${payer} owe ${payee} $${Math.abs(netOwed)}${grossNote}</div>`
        } else if (Math.abs(s.front) + Math.abs(s.back) + Math.abs(s.overall) > 0) {
          totLine = `<div style="font-size:11px;margin-top:4px;opacity:.5">All square · $${Math.abs(s.front) + Math.abs(s.back) + Math.abs(s.overall)} action</div>`
        }

        const fAmt = cfg.front ?? 10
        const bAmt = cfg.back ?? 10
        const oAmt = cfg.overall ?? 20
        const pressInfo = cfg.pressAt ? ` · press@${cfg.pressAt}` : ''
        const nassauLabel = cfg._sideMatch ? '1v1 Nassau' : 'Nassau'
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${nassauLabel}</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${fAmt}/$${bAmt}/$${oAmt}${pressInfo}</span><div style="font-size:11px;margin-top:3px;display:flex;flex-direction:column;gap:2px"><div>${fHtml}</div><div>${bHtml}</div><div>${oHtml}</div>${alohaHtml}</div>${totLine}</div>`
      }

      // ── Skins ──
      if (t === 'skins') {
        const r = computeSkins(ctx, cfg)
        if (!r || !r.holeResults) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Skins</span> <span class="muted" style="font-size:11px">No scores yet</span></div>`

        const won = r.holeResults.filter(s => s.winner) || []
        const ppt = r.ppt || cfg.ppt || 5
        let holeStr = won.length > 0 ? won.map(s => `H${s.hole}→${s.winnerName || '?'}($${s.pot || ppt})`).join(', ') : 'No skins won yet'

        let carryStr = ''
        const allHoles = r.holeResults
        let carry = 0
        for (let i = allHoles.length - 1; i >= 0; i--) {
          if (!allHoles[i].winner) carry++
          else break
        }
        if (carry > 0 && allHoles.length < (visibleHoles.value.length || 18)) {
          const nextVal = (carry + 1) * ppt
          carryStr = ` · <span style="color:#d4af37;font-weight:700">${carry} skin${carry > 1 ? 's' : ''} in pot ($${nextVal} next)</span>`
        } else if (carry > 0) {
          carryStr = ` · <span style="color:rgba(212,175,55,.6)">${carry} unclaimed (carry died)</span>`
        }

        let standStr = ''
        if (r.settlements && r.settlements.length > 0) {
          const sorted = [...r.settlements].sort((a, b) => b.net - a.net)
          standStr = '<div style="margin-top:4px;font-size:11px">'
          sorted.forEach(s => {
            const color = s.net > 0 ? '#4ade80' : s.net < 0 ? '#f87171' : '#d4af37'
            standStr += `<span style="color:${color};font-weight:700">${s.name}: ${s.net > 0 ? '+$' : s.net < 0 ? '-$' : '$'}${Math.abs(s.net)} (${s.skins} skin${s.skins !== 1 ? 's' : ''})</span> · `
          })
          standStr = standStr.replace(/ · $/, '') + '</div>'
        }

        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Skins</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/skin</span><div style="font-size:11px;margin-top:3px;line-height:1.6">${holeStr}${carryStr}</div>${standStr}</div>`
      }

      // ── Match ──
      if (t === 'match' || t === 'match1v1') {
        const r = computeMatch(ctx, cfg)
        if (!r) return _gameLine({ gameName: 'Match', winner: null, value: null, detail: 'Waiting for scores' })

        const p1n = r.p1?.name || '?'
        const p2n = r.p2?.name || '?'
        const up = r.finalUp
        const ppt = r.settlement?.ppt || cfg.ppt || 0
        const p1Net = r.settlement?.p1Net || 0
        const isTournament = !!cfg.tournament
        const points = cfg.points || 1
        const played = (r.holeResults || []).filter(h => !h.incomplete).length
        const scoring = r.settlement?.scoring || cfg.scoring || 'closeout'

        let winner = null, value = null, detail
        if (played === 0) {
          detail = `${p1n} vs ${p2n} — waiting for scores`
        } else if (r.matchOver) {
          winner = up > 0 ? p1n : p2n
          const loser = up > 0 ? p2n : p1n
          detail = `${winner} (${r.result}) vs ${loser}`
          value = { pts: isTournament ? points : null, dollars: p1Net !== 0 ? Math.abs(p1Net) : (ppt > 0 ? ppt : null) }
        } else if (up === 0) {
          detail = `${p1n} vs ${p2n} — AS thru ${played}`
          if (isTournament) value = { pts: points / 2, dollars: null }
        } else {
          winner = up > 0 ? p1n : p2n
          const loser = up > 0 ? p2n : p1n
          detail = `${winner} (${Math.abs(up)} UP thru ${played}) vs ${loser}`
          value = { pts: isTournament ? points : null, dollars: p1Net !== 0 ? Math.abs(p1Net) : (ppt > 0 ? ppt : null) }
        }

        const scoringBadge = scoring === 'nassau' ? ' Nassau' : scoring === 'skins' ? ' Skins' : ''

        let strokesLine = null
        try {
          const m1 = ctx.members.find(m => m.id === cfg.player1)
          const m2 = ctx.members.find(m => m.id === cfg.player2)
          if (m1 && m2) {
            const h1 = m1.round_hcp ?? 0
            const h2 = m2.round_hcp ?? 0
            if (h1 !== h2) {
              const giver = h1 < h2 ? m1 : m2
              const receiver = h1 < h2 ? m2 : m1
              const strokeDiff = Math.abs(h1 - h2)
              const course = ctx.course || {}
              const teeSiByHole = course?.teesData?.[ctx.tee]?.siByHole
              const siArr = teeSiByHole || course.si || []
              const holesWithStrokes = []
              for (let h = 1; h <= 18; h++) {
                const si = siArr[h - 1] ?? 18
                if (si <= strokeDiff) holesWithStrokes.push(h)
              }
              if (holesWithStrokes.length) {
                const giverName = giver.short_name || giver.guest_name?.split(/\s+/)[0] || '?'
                const recvName = receiver.short_name || receiver.guest_name?.split(/\s+/)[0] || '?'
                strokesLine = `↳ ${giverName} gives ${recvName} ${strokeDiff} stroke${strokeDiff === 1 ? '' : 's'} on hole${holesWithStrokes.length === 1 ? '' : 's'} ${holesWithStrokes.join(', ')}`
              }
            }
          }
        } catch { /* skip */ }

        const base = _gameLine({ gameName: `Match${scoringBadge}`, winner, value, detail })
        return strokesLine
          ? base.replace('</div></div>', `</div><div class="gs-strokes-line">${strokesLine}</div></div>`)
          : base
      }

      // ── Vegas ──
      if (t === 'vegas') {
        const r = computeVegas(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Vegas</span></div>`
        const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
        const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
        const diff = r.runningTotal || 0
        const ppt = cfg.ppt || 1
        const amt = Math.abs(diff) * ppt
        let dollarLine = ''
        if (diff !== 0) {
          const loser = diff > 0 ? t2n : t1n
          const winner = diff > 0 ? t1n : t2n
          dollarLine = ` · <span style="color:#4ade80;font-weight:700">${loser} owe $${amt}</span>`
        }
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Vegas</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n}${dollarLine}</span></div>`
      }

      // ── Snake ──
      if (t === 'snake') {
        const r = computeSnake(ctx, cfg)
        const val = cfg.ppt || 5
        if (!r || !r.holderName) {
          return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Snake</span><span class="muted" style="font-size:10px;margin-left:4px">$${val}/snake — No 3-putts yet</span></div>`
        }
        const payout = r.snakeCount > 1 ? `$${val * r.snakeCount} total (${r.snakeCount} × $${val})` : `$${val}`
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Snake</span><span class="muted" style="font-size:10px;margin-left:4px">$${val}/snake · ${r.snakeCount} 🐍</span><div style="font-size:11px;margin-top:3px"><span style="color:#f87171;font-weight:700">🐍 ${r.holderName} holds it</span> · owes ${payout} to each</div></div>`
      }

      // ── Hi-Low ──
      if (t === 'hilow') {
        const r = computeHiLow(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hi-Low</span><span class="muted" style="font-size:11px">—</span></div>`
        const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
        const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
        const diff = (r.t1Pts || 0) - (r.t2Pts || 0)
        const status = diff === 0 ? 'All square' : (diff > 0 ? `${t1n} leads ${r.t1Pts}-${r.t2Pts}` : `${t2n} leads ${r.t2Pts}-${r.t1Pts}`)
        let money = ''
        if (diff !== 0) {
          const loser = diff > 0 ? t2n : t1n
          const ppt = cfg.ppt || 1
          const amt = Math.abs(diff) * ppt
          money = ` · <span style="color:#4ade80;font-weight:700">${loser} owe $${amt}</span>`
        }
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hi-Low</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n}</span><div style="font-size:11px;margin-top:2px">${status}${money}</div></div>`
      }

      // ── Hammer ──
      if (t === 'hammer') {
        const r = computeHammer(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hammer</span></div>`
        const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
        const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
        const ppt = cfg.ppt || 5
        const net = (r.team1Total || 0) - (r.team2Total || 0)
        const netStr = net !== 0 ? `<div style="margin-top:4px;font-size:12px;font-weight:700;color:#4ade80">💰 ${net < 0 ? t1n : t2n} owe ${net > 0 ? t1n : t2n} $${Math.abs(net)}</div>` : ''
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Hammer</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${ppt}/hole</span>${netStr}</div>`
      }

      // ── Fidget ──
      if (t === 'fidget') {
        const r = computeFidget(ctx, cfg)
        if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span></div>`
        const ppp = r.ppp || cfg.ppp || cfg.ppt || 10
        const members = ctx.members
        const completedHoles = r.holeLog?.filter(h => !h.incomplete).length || 0
        const totalHoles = visibleHoles.value.length || 18
        const safe = members.filter(m => r.hasWon[m.id])
        const atRisk = members.filter(m => !r.hasWon[m.id])
        let lines = '', fStatus = ''
        if (completedHoles >= totalHoles) {
          if (atRisk.length > 0) {
            lines = atRisk.map(m => `❌ ${memberDisplay(m)}: owes $${ppp * (members.length - 1)}`).join('<br>')
            fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#f87171">${safe.length} safe · ${atRisk.length} fidgeted</div>`
          } else {
            fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#4ade80">Everyone won a hole — no fidgets!</div>`
          }
        } else {
          if (atRisk.length > 0) lines = atRisk.map(m => `⚠️ ${memberDisplay(m)}: no win yet`).join('<br>')
          fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#4ade80">${safe.length}/${members.length} safe</div>`
        }
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppp}/player${completedHoles < totalHoles ? ' · thru ' + completedHoles + '/' + totalHoles : ''}</span>${lines ? '<div style="font-size:11px;margin-top:3px">' + lines + '</div>' : ''}${fStatus}</div>`
      }

      // ── Stableford ──
      if (t === 'stableford') {
        const r = computeStableford(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span></div>`
        const standings = r.settlements?.map(s => `${s.name}: ${s.pts || 0} pts`).join(' · ') || '—'
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span><div style="font-size:11px;margin-top:2px">${standings}</div></div>`
      }

      // ── Wolf ──
      if (t === 'wolf') {
        const r = computeWolf(ctx, cfg)
        if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Wolf</span></div>`
        const ppt = cfg.ppt || 1
        const standings = r.settlements?.map(s => `${s.name}: <span style="color:${(s.net||0) > 0 ? '#4ade80' : (s.net||0) < 0 ? '#f87171' : '#d4af37'};font-weight:700">${(s.net||0) > 0 ? '+' : ''}$${Math.abs(s.net||0)}</span>`).join(' · ') || ''
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Wolf</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/pt</span>${standings ? `<div style="font-size:11px;margin-top:3px">${standings}</div>` : ''}</div>`
      }

      // ── Sixes ──
      if (t === 'sixes') {
        const r = computeSixes(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:11px">Need 4 players</span></div>`
        const ppt = cfg.ppt || 1
        const standings = r.settlements?.map(s => `${s.name}: <span style="color:${(s.net||0) > 0 ? '#4ade80' : (s.net||0) < 0 ? '#f87171' : '#d4af37'};font-weight:700">${(s.net||0) > 0 ? '+' : ''}$${Math.abs(s.net||0)}</span>`).join(' · ') || '—'
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/segment</span><div style="font-size:11px;margin-top:3px">${standings}</div></div>`
      }

      // ── Dots ──
      if (t === 'dots') {
        const r = computeDots(ctx, cfg)
        if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span></div>`
        const ppt = r.ppt || cfg.ppt || 1
        const counts = r.settlements?.map(s => `${s.name}: ${s.myDots || 0}`).join(' · ') || '—'
        const dollarLine = r.settlements?.filter(s => (s.net||0) !== 0).map(s => `${s.name}${(s.net||0) > 0 ? '<span style="color:#4ade80"> +$' + s.net + '</span>' : '<span style="color:#f87171"> -$' + Math.abs(s.net) + '</span>'}`).join(' · ') || ''
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/dot</span><div style="font-size:11px;margin-top:3px;opacity:.8">${counts}</div>${dollarLine ? '<div style="font-size:11px;margin-top:2px">' + dollarLine + '</div>' : ''}</div>`
      }

      // ── Best Ball ──
      if (t === 'best_ball' || t === 'bestball') {
        const r = computeBestBall(ctx, cfg)
        if (!r) return _gameLine({ gameName: 'Best Ball', winner: null, value: null, detail: 'Waiting for scores' })
        const t1n = r.t1Name || 'Team 1'
        const t2n = r.t2Name || 'Team 2'
        const finalUp = r.finalUp || 0
        const played = (r.holeResults || []).filter(h => !h.incomplete).length
        const remaining = (r.holeResults || []).filter(h => h.incomplete).length
        const matchOver = Math.abs(finalUp) > remaining && played > 0
        const ppt = r.settlement?.ppt || cfg.ppt || 0
        const isTournament = !!cfg.tournament
        const points = cfg.points || 2
        let winner = null, value = null, detail = `${t1n} vs ${t2n}`
        if (played === 0) {
          detail = `${t1n} vs ${t2n} — waiting for scores`
        } else if (matchOver) {
          winner = finalUp > 0 ? t1n : t2n
          const loser = finalUp > 0 ? t2n : t1n
          const resultStr = `${Math.abs(finalUp)}&${remaining}`
          detail = `${winner} (${resultStr}) vs ${loser}`
          value = { pts: isTournament ? points : null, dollars: ppt > 0 ? ppt : null }
        } else if (finalUp === 0) {
          detail = `${t1n} vs ${t2n} — AS thru ${played}`
          if (isTournament) value = { pts: points / 2, dollars: null }
        } else {
          winner = finalUp > 0 ? t1n : t2n
          const loser = finalUp > 0 ? t2n : t1n
          detail = `${winner} (${Math.abs(finalUp)} UP thru ${played}) vs ${loser}`
          value = { pts: isTournament ? points : null, dollars: ppt > 0 ? ppt : null }
        }
        return _gameLine({ gameName: 'Best Ball', winner, value, detail })
      }

      // ── BBN ──
      if (t === 'bbn') {
        const r = computeBestBallNet(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${cfg.label || 'BB Net'}</span><span class="muted" style="font-size:11px">—</span></div>`
        const totalStr = r.totalScore ? `${r.totalScore} (${r.overallToPar === 0 ? 'E' : (r.overallToPar > 0 ? '+' + r.overallToPar : r.overallToPar)})` : '—'
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${cfg.label || 'BB Net'}</span><span class="muted" style="font-size:10px;margin-left:4px">${r.ballsToCount || 1}BB ${r.scoring === 'gross' ? 'Gross' : 'Net'}</span><br><span class="muted" style="font-size:11px">Total: ${totalStr}</span></div>`
      }

      // ── 5-3-1 ──
      if (t === 'fivethreeone' || t === 'nines') {
        const r = computeFiveThreeOne(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${t === 'nines' ? '9s' : '5-3-1'}</span><span class="muted" style="font-size:11px"> Need 3+ players</span></div>`
        const ppt = r.ppt || cfg.ppt || 1
        const played = (r.holeResults || []).filter(h => !h.incomplete).length
        const sorted = [...r.settlements].sort((a, b) => b.pts - a.pts)
        const medalEmojis = ['🥇','🥈','🥉']
        // Build sweep/birdie tallies per player
        const ftoTallies = {}
        for (const hr of (r.holeResults || [])) {
          if (hr.sweep) { ftoTallies[hr.sweep] = ftoTallies[hr.sweep] || { sweeps: 0, birdies: 0 }; ftoTallies[hr.sweep].sweeps++ }
          if (hr.birdieBonus) { ftoTallies[hr.birdieBonus] = ftoTallies[hr.birdieBonus] || { sweeps: 0, birdies: 0 }; ftoTallies[hr.birdieBonus].birdies++ }
        }
        const hasSweep = r.hasSweep
        const hasBirdie = r.hasBirdie
        const badgeHtml = (hasSweep ? '<span style="font-size:10px;margin-left:6px;opacity:.8">🧹 Sweep on</span>' : '')
                        + (hasBirdie ? '<span style="font-size:10px;margin-left:6px;opacity:.8">🐦 Birdie bonus on</span>' : '')
        const standRows = sorted.map((s) => {
          const netColor = s.net > 0 ? '#4ade80' : s.net < 0 ? '#f87171' : '#d4af37'
          const rank = sorted.findIndex(x => x.pts === s.pts)
          const medal = rank < 3 ? medalEmojis[rank] + ' ' : ''
          const rawDollars = Math.round(s.pts * ppt * 100) / 100
          const netStr = s.net > 0 ? `+$${s.net}` : s.net < 0 ? `-$${Math.abs(s.net)}` : 'even'
          const t = ftoTallies[s.id]
          const tallyHtml = t ? ((t.sweeps ? `<span style="font-size:10px;margin-left:4px">🧹×${t.sweeps}</span>` : '') + (t.birdies ? `<span style="font-size:10px;margin-left:4px">🐦×${t.birdies}</span>` : '')) : ''
          return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">`
            + `<span style="min-width:60px">${medal}<span style="font-weight:700">${s.name}</span></span>`
            + `<span style="color:#d4af37;font-weight:700">${s.pts}pts · $${rawDollars}</span>`
            + `<span style="color:${netColor};font-size:10px">(net ${netStr})</span>`
            + tallyHtml
            + `</div>`
        }).join('')
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} ${t === 'nines' ? '9s' : '5-3-1'}</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/pt${played > 0 ? ' · thru ' + played : ''}</span>${badgeHtml}<div style="font-size:11px;margin-top:4px">${standRows || 'No complete holes yet'}</div></div>`
      }


      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${gameLabel(game.type, cfg)}</span></div>`
    } catch(e) {
      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${gameLabel(game.type, cfg)}</span><span class="muted" style="font-size:10px;margin-left:4px">Error loading</span></div>`
    }
  }

  return {
    liveSettlements,
    gameSummaryHtml,
  }
}
