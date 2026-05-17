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

// Escape HTML special chars — prevents XSS when player names are interpolated into v-html strings
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
import {
  computeNassau, computeSkins, computeMatch, computeVegas, computeSnake,
  computeHiLow, computeStableford, computeWolf, computeHammer, computeSixes,
  computeFiveThreeOne, computeDots, computeFidget, computeBestBallNet, computeBestBall, computeBbb,
  computeFourteen,
  memberHandicap,
} from '../modules/gameEngine'
import { formatMatchLabel } from '../modules/matchLabels'
import { isSettled, nassauBetSettled } from '../modules/betSettled'

// Inline amber pill — drawn loud so live players can't miss the dormie state.
const DORMIE_PILL = '<span class="gs-dormie-pill" aria-label="dormie">🚨 DORMIE</span>'
const CLOSED_PILL = '<span class="gs-closed-pill" aria-label="closed">🔒 CLOSED</span>'

// Generates unique short labels for a set of members.
// Starts with last name; bumps collisions → "F.LastName" → "Fi.LastName".
function makeUniqueLabels(members, partsOf) {
  const pm = new Map(members.map(m => [m.id, partsOf(m)]))
  const L = new Map(members.map(m => {
    const p = pm.get(m.id)
    return [m.id, p.length >= 2 ? p[p.length - 1] : (p[0] || '?')]
  }))
  for (const fmt of [
    p => p.length >= 2 ? `${p[0][0]}.${p[p.length - 1]}` : null,
    p => p.length >= 2 ? `${p[0].slice(0, 2)}.${p[p.length - 1]}` : null,
  ]) {
    const counts = {}
    for (const v of L.values()) counts[v] = (counts[v] || 0) + 1
    for (const [id, v] of L) {
      if (counts[v] > 1) { const n = fmt(pm.get(id)); if (n) L.set(id, n) }
    }
  }
  return L
}

export function useLiveSettlements({ buildCtx, gameIcon, gameLabel, teamInitialsStr, pInit, memberDisplay, visibleHoles, rosterPlayers, tournamentWagerGames }) {
  const roundsStore = useRoundsStore()

  const liveSettlements = computed(() => {
    if (!roundsStore.activeRound) return null
    const tournGames = tournamentWagerGames?.value ?? []
    const sideGames = roundsStore.activeGames
    if (tournGames.length === 0 && sideGames.length === 0) return null
    const ctx = buildCtx()
    try {
      return computeAllSettlements(ctx, [...tournGames, ...sideGames])
    } catch (e) {
      return null
    }
  })

  function gameSummaryHtml(game) {
    const ctx = buildCtx()
    const cfg = game.config || {}
    const icon = gameIcon(game.type)
    const t = game.type?.toLowerCase()

    function _gameLine({ gameName, winner, value, detail, dormie }) {
      const valStr = (() => {
        if (!value) return ''
        const parts = []
        if (value.pts != null) parts.push(`+${value.pts} pt${value.pts === 1 ? '' : 's'}`)
        if (value.dollars != null) parts.push(`+$${value.dollars}`)
        return parts.join(' · ')
      })()
      const titleRight = dormie
        ? DORMIE_PILL
        : winner
          ? `<span class="gs-winner"><span class="gs-star">⭐️</span> <span class="gs-winner-name">${escHtml(winner)}</span><span class="gs-value">${valStr ? '&nbsp;' + valStr : ''}</span></span>`
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

        // Dormie/closeout state per bet within a segment.
        // settled is from betSettled.js — single source of truth for "$ certain?".
        function betState(seg, bet) {
          if (!seg) return null
          const segHR = seg.holeResults || []
          const start = bet.start
          const inBet = segHR.filter(hr => hr.hole >= start)
          const total = inBet.length
          const played = inBet.filter(hr => hr.n1 != null && hr.n2 != null).length
          const remaining = total - played
          const score = bet.score || 0
          const dormie = remaining > 0 && Math.abs(score) === remaining
          const closed = Math.abs(score) > remaining
          const settled = nassauBetSettled(segHR, start, score)
          return { played, total, remaining, score, dormie, closed, settled }
        }

        function fmtSeg(label, seg, segDollar) {
          if (!seg) return `<span style="opacity:.35">${label}: —</span>`
          const mainBet = { start: seg.holeResults?.[0]?.hole ?? 1, score: seg.t1Up || 0 }
          const mainState = betState(seg, mainBet)
          const pressStates = (seg.presses || []).map(p => betState(seg, p))
          const fmtUp = (s) => s === 0 ? 'AS' : (s > 0 ? `+${s}` : `${s}`)
          // Mark each slash entry with a dormie/closed indicator.
          const slashEntries = [
            mainState ? markEntry(fmtUp(mainState.score), mainState) : fmtUp(seg.t1Up || 0),
            ...pressStates.map((ps, i) => markEntry(fmtUp(ps.score), ps, i + 1)),
          ]
          const slashStatus = slashEntries.join('/')
          let html = `<span style="font-weight:600">${label}:</span> <span style="font-family:monospace;letter-spacing:0.5px">${slashStatus}</span>`
          // Any unsettled bet → segment $ is NOT certain → suppress.
          const allBets = [mainState, ...pressStates].filter(Boolean)
          const anyDormie = allBets.some(b => b.dormie)
          const anyUnsettled = allBets.some(b => !b.settled && b.score !== 0)
          if (anyDormie) html += ` ${DORMIE_PILL}`
          else if (segDollar !== 0 && !anyUnsettled) {
            const winner = segDollar > 0 ? t1n : t2n
            html += ` · <span style="color:#4ade80;font-weight:700">${escHtml(winner)} $${Math.abs(segDollar)}</span>`
          }
          return html
        }
        function markEntry(text, st, pressIdx) {
          if (!st) return text
          if (st.dormie) return `<span class="gs-dormie-mark" title="${pressIdx ? `Press ${pressIdx}` : 'Main'} dormie">${text}*</span>`
          if (st.closed) return `<span class="gs-closed-mark">${text}</span>`
          return text
        }

        const s = r.settlement
        const fHtml = fmtSeg('Front', r.frontSeg, s.front)
        const bHtml = fmtSeg('Back', r.backSeg, s.back)

        // Overall: 18 holes, count played across both segments.
        const allHR = [...(r.frontSeg?.holeResults || []), ...(r.backSeg?.holeResults || [])]
        const oPlayed = allHR.filter(hr => hr.n1 != null && hr.n2 != null).length
        const totalHolesNassau = allHR.length || 18
        const oRem = totalHolesNassau - oPlayed
        const oUp = r.overallUp
        const oDormie = oRem > 0 && Math.abs(oUp) === oRem
        const oClosed = oRem >= 0 && Math.abs(oUp) > oRem
        const oFmt = oUp === 0 ? 'AS' : (oUp > 0 ? `+${oUp}` : `${oUp}`)
        let oHtml = `<span style="font-weight:600">Overall:</span> <span style="font-family:monospace;letter-spacing:0.5px">${oFmt}</span>`
        if (oDormie) {
          oHtml += ` ${DORMIE_PILL}`
        } else if (s.overall !== 0 && (oRem === 0 || oClosed)) {
          const oWinner = s.overall > 0 ? t1n : t2n
          oHtml += ` · <span style="color:#4ade80;font-weight:700">${escHtml(oWinner)} $${Math.abs(s.overall)}</span>`
        }

        let alohaHtml = ''
        // Aloha settles only on H18 (engine returns r.aloha only when last hole resolved).
        if (r.aloha) {
          const ar = r.aloha
          const alohaWinner = ar.t1Delta > 0 ? t1n : t2n
          alohaHtml = `<div>🌺 <span style="font-weight:600">Aloha:</span> <span style="color:#4ade80;font-weight:700">${escHtml(alohaWinner)} +$${ar.amount}</span></div>`
        } else if (cfg.aloha?.status === 'accepted') {
          alohaHtml = `<div>🌺 <span style="font-weight:600">Aloha:</span> <span style="opacity:.5">accepted — h18 pending</span></div>`
        } else if (cfg.aloha?.status === 'pending') {
          alohaHtml = `<div>🌺 <span style="font-weight:600">Aloha:</span> <span style="opacity:.5">offered — waiting</span></div>`
        }

        // Sum only segments whose $ outcome is mathematically certain.
        // s.front/back/overall are the engine's projected deltas; we add them ONLY
        // when their underlying segment is settled.
        function frontSegSettled() {
          const segHR = r.frontSeg?.holeResults || []
          if (!segHR.length) return false
          // Front segment is settled when ALL its bets (main + presses) are settled.
          const startHole = segHR[0].hole
          const main = nassauBetSettled(segHR, startHole, r.frontSeg.t1Up || 0)
          const presses = (r.frontSeg.presses || []).every(p => nassauBetSettled(segHR, p.start, p.score || 0))
          return main && presses
        }
        function backSegSettled() {
          const segHR = r.backSeg?.holeResults || []
          if (!segHR.length) return false
          const startHole = segHR[0].hole
          const main = nassauBetSettled(segHR, startHole, r.backSeg.t1Up || 0)
          const presses = (r.backSeg.presses || []).every(p => nassauBetSettled(segHR, p.start, p.score || 0))
          return main && presses
        }
        const fSet = frontSegSettled()
        const bSet = backSegSettled()
        const oSet = isSettled(oPlayed, totalHolesNassau, oUp)
        const aSet = !!r.aloha  // engine emits aloha only when H18 resolved

        const settledFront = fSet ? s.front : 0
        const settledBack  = bSet ? s.back  : 0
        const settledOverall = oSet ? s.overall : 0
        const settledAloha = aSet ? (s.aloha || 0) : 0
        const settledNet = settledFront + settledBack + settledOverall + settledAloha

        let totLine = ''
        const allSettled = fSet && bSet && oSet && (cfg.aloha?.status !== 'accepted' || aSet)
        const anyUnsettled = !allSettled
        if (settledNet !== 0) {
          const payer = settledNet < 0 ? t1n : t2n
          const payee = settledNet < 0 ? t2n : t1n
          const liveTag = anyUnsettled ? ' <span style="font-size:10px;opacity:.5">(settled so far)</span>' : ''
          totLine = `<div style="font-size:12px;font-weight:700;margin-top:5px;padding:5px 8px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:8px;color:#4ade80">💰 ${escHtml(payer)} owe ${escHtml(payee)} $${Math.abs(settledNet)}${liveTag}</div>`
        } else if (anyUnsettled) {
          totLine = `<div style="font-size:11px;margin-top:4px;opacity:.5">No settled $ yet — bets in flight</div>`
        } else if (allSettled) {
          totLine = `<div style="font-size:11px;margin-top:4px;opacity:.5">All square</div>`
        }

        const fAmt = cfg.front ?? 10
        const bAmt = cfg.back ?? 10
        const oAmt = cfg.overall ?? 20
        const pressInfo = cfg.pressAt ? ` · press@${cfg.pressAt}` : ''
        const nassauLabel = cfg._sideMatch ? '1v1 Nassau' : 'Nassau'
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${nassauLabel}</span><span class="muted" style="font-size:10px;margin-left:4px">${escHtml(t1n)} vs ${escHtml(t2n)} · $${fAmt}/$${bAmt}/$${oAmt}${pressInfo}</span><div style="font-size:11px;margin-top:3px;display:flex;flex-direction:column;gap:2px"><div>${fHtml}</div><div>${bHtml}</div><div>${oHtml}</div>${alohaHtml}</div>${totLine}</div>`
      }

      // ── Skins ──
      if (t === 'skins') {
        const r = computeSkins(ctx, cfg)
        if (!r || !r.holeResults) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Skins</span> <span class="muted" style="font-size:11px">No scores yet</span></div>`
        const ppt = r.ppt || cfg.ppt || 5

        // Team skins display
        if (r.teamMode) {
          const t1n = r.t1Name || 'Team A'
          const t2n = r.t2Name || 'Team B'
          const scoreStr = `${t1n}: ${r.t1Skins} skins — ${t2n}: ${r.t2Skins} skins`
          const net = r.t1Net || 0
          const leader = net > 0 ? t1n : net < 0 ? t2n : null
          const netStr = leader
            ? `<div style="margin-top:3px;font-size:12px;font-weight:700;color:#4ade80">${leader} leads $${Math.abs(net)}</div>`
            : '<div style="margin-top:3px;font-size:11px;color:#d4af37">All square</div>'
          return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Skins (Team)</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/skin</span><div style="font-size:11px;margin-top:3px">${scoreStr}</div>${netStr}</div>`
        }

        // Individual skins display
        const won = r.holeResults.filter(s => s.winner) || []
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
        const is1v1 = !!(cfg.player1 && cfg.player2)
        const is2v2 = !is1v1 && Array.isArray(cfg.team1) && cfg.team1.length && Array.isArray(cfg.team2) && cfg.team2.length

        if (!is1v1 && !is2v2) return _gameLine({ gameName: 'Match', winner: null, value: null, detail: 'Waiting for scores' })

        let r, p1n, p2n, up, ppt, p1Net, played, scoring, isTournament, points

        if (is1v1) {
          r = computeMatch(ctx, cfg)
          if (!r) return _gameLine({ gameName: 'Match', winner: null, value: null, detail: 'Waiting for scores' })
          const m1 = ctx.members.find(m => m.id === cfg.player1)
          const m2 = ctx.members.find(m => m.id === cfg.player2)
          const h1 = m1 ? memberHandicap(m1, ctx.course, ctx.tee) : 0
          const h2 = m2 ? memberHandicap(m2, ctx.course, ctx.tee) : 0
          const diff = h1 - h2
          const baseN1 = r.p1?.name || '?'
          const baseN2 = r.p2?.name || '?'
          p1n = diff > 0 ? `${baseN1}(+${diff})` : baseN1
          p2n = diff < 0 ? `${baseN2}(+${-diff})` : baseN2
          up = r.finalUp
          ppt = r.settlement?.ppt || cfg.ppt || 0
          p1Net = r.settlement?.p1Net || 0
          played = (r.holeResults || []).filter(h => !h.incomplete).length
          scoring = r.settlement?.scoring || cfg.scoring || 'closeout'
          isTournament = !!cfg.tournament
          points = cfg.points || 1
        } else {
          r = computeBestBall(ctx, { ...cfg, ballsPerTeam: 1 })
          if (!r) return _gameLine({ gameName: 'Match', winner: null, value: null, detail: 'Waiting for scores' })
          const annotated = formatMatchLabel({
            config: cfg, members: ctx.members || [],
            course: ctx.course, tee: ctx.tee, getInit: pInit,
          })
          if (annotated && annotated.includes(' v ')) {
            const [a, b] = annotated.split(' v ')
            p1n = a
            p2n = b
          } else {
            p1n = r.t1Name || teamInitialsStr(cfg.team1) || 'T1'
            p2n = r.t2Name || teamInitialsStr(cfg.team2) || 'T2'
          }
          up = r.finalUp
          ppt = cfg.ppt || 0
          p1Net = r.settlement?.t1Net || 0
          played = (r.holeResults || []).filter(h => !h.incomplete).length
          scoring = cfg.scoring || 'closeout'
          isTournament = !!cfg.tournament
          points = cfg.points || 1
        }

        const totalHoles = visibleHoles.value?.length || 18
        const remaining = totalHoles - played
        // Compute locally — computeMatch's r.matchOver double-counts incomplete holes
        // in holesRemaining (pre-existing engine bug), so we derive both flags from
        // played/remaining/up which use the correct visibleHoles count.
        const matchOver = isSettled(played, totalHoles, up) && up !== 0
        const matchResult = up > 0 ? `${up}&${remaining}` : `${-up}&${remaining}`
        const isDormie = !matchOver && remaining > 0 && Math.abs(up) === remaining

        let winner = null, value = null, detail
        if (played === 0) {
          detail = `${p1n} vs ${p2n} — waiting for scores`
        } else if (matchOver) {
          winner = up > 0 ? p1n : p2n
          const loser = up > 0 ? p2n : p1n
          detail = `${winner} (${matchResult}) vs ${loser}`
          value = { pts: isTournament ? points : null, dollars: p1Net !== 0 ? Math.abs(p1Net) : (ppt > 0 ? ppt : null) }
        } else if (up === 0) {
          detail = `${p1n} vs ${p2n} — AS thru ${played}`
          if (isTournament) value = { pts: points / 2, dollars: null }
        } else if (isDormie) {
          // Dormie — match isn't decided yet ($ not certain). Suppress winner/$.
          const leader = up > 0 ? p1n : p2n
          const trailer = up > 0 ? p2n : p1n
          detail = `${leader} ${Math.abs(up)} UP, ${remaining} to play vs ${trailer}`
        } else {
          winner = up > 0 ? p1n : p2n
          const loser = up > 0 ? p2n : p1n
          detail = `${winner} (${Math.abs(up)} UP thru ${played}) vs ${loser}`
          value = { pts: isTournament ? points : null, dollars: p1Net !== 0 ? Math.abs(p1Net) : (ppt > 0 ? ppt : null) }
        }

        const scoringBadge = scoring === 'nassau' ? ' Nassau' : scoring === 'skins' ? ' Skins' : ''

        let strokesLine = null
        if (is1v1) {
          try {
            const m1 = ctx.members.find(m => m.id === cfg.player1)
            const m2 = ctx.members.find(m => m.id === cfg.player2)
            if (m1 && m2) {
              const h1 = memberHandicap(m1, ctx.course, ctx.tee)
              const h2 = memberHandicap(m2, ctx.course, ctx.tee)
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
        }

        const base = _gameLine({ gameName: `Match${scoringBadge}`, winner, value, detail, dormie: isDormie })
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
        const ppt = cfg.ppt || 1
        const t1Total = r.t1Total || 0
        const net = t1Total * ppt
        const played = (r.holeResults || []).filter(h => !h.incomplete)
        const last3 = played.slice(-3)
        const holeStr = last3.length
          ? last3.map(h => {
              const col = h.diff > 0 ? '#4ade80' : h.diff < 0 ? '#f87171' : '#888'
              const pts = h.diff > 0 ? `+${h.diff}` : `${h.diff}`
              const flip = h.multiplier > 1 ? '🔄' : ''
              return `H${h.hole}:${h.t1Num}v${h.t2Num}${flip}(<span style='color:${col}'>${pts}</span>)`
            }).join(' · ')
          : 'No scores yet'
        let moneyLine = ''
        if (net > 0) moneyLine = `<span style='color:#4ade80;font-weight:700'>${t1n} leads +$${net}</span>`
        else if (net < 0) moneyLine = `<span style='color:#f87171;font-weight:700'>${t2n} leads +$${Math.abs(net)}</span>`
        else if (played.length) moneyLine = `<span style='color:#d4af37'>All square</span>`
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Vegas</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${ppt}/pt</span><div style="font-size:11px;margin-top:3px;opacity:.8">${holeStr}</div>${moneyLine ? '<div style="font-size:12px;margin-top:3px">' + moneyLine + '</div>' : ''}</div>`
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
        const ppt = cfg.ppt || 1
        const net = r.t1Total || 0
        const variants = [cfg.airHammer && 'Air', cfg.fuHammer && 'F-U', cfg.birdieDouble && 'Birdie×2', cfg.carryover && 'Carry'].filter(Boolean).join(', ')
        const varStr = variants ? `<span class="muted" style="font-size:10px;margin-left:4px">(${variants})</span>` : ''
        const throwHoles = (r.holeResults || []).filter(h => h.throws > 0 || h.conceded)
        const holeStr = throwHoles.length
          ? '<div style="margin-top:4px;font-size:11px;color:#a0908a">' +
            throwHoles.map(h => {
              if (h.conceded) return `H${h.hole}: conceded($${h.holeValue})`
              return `H${h.hole}: $${h.holeValue}(${h.throws}🔨)`
            }).join(' · ') + '</div>'
          : ''
        const netStr = net !== 0
          ? `<div style="margin-top:4px;font-size:12px;font-weight:700;color:#4ade80">💰 ${net > 0 ? t2n : t1n} owe ${net > 0 ? t1n : t2n} $${Math.abs(net)}</div>`
          : '<div style="margin-top:4px;font-size:11px;color:#888">All square</div>'
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Hammer</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${ppt}/hole</span>${varStr}${holeStr}${netStr}</div>`
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
            lines = atRisk.map(m => `❌ ${escHtml(memberDisplay(m))}: owes $${ppp * (members.length - 1)}`).join('<br>')
            fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#f87171">${safe.length} safe · ${atRisk.length} fidgeted</div>`
          } else {
            fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#4ade80">Everyone won a hole — no fidgets!</div>`
          }
        } else {
          if (atRisk.length > 0) lines = atRisk.map(m => `⚠️ ${escHtml(memberDisplay(m))}: no win yet`).join('<br>')
          fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#4ade80">${safe.length}/${members.length} safe</div>`
        }
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppp}/player${completedHoles < totalHoles ? ' · thru ' + completedHoles + '/' + totalHoles : ''}</span>${lines ? '<div style="font-size:11px;margin-top:3px">' + lines + '</div>' : ''}${fStatus}</div>`
      }

      // ── Stableford ──
      if (t === 'stableford') {
        const r = computeStableford(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span></div>`
        const standings = r.settlements?.map(s => `${escHtml(s.name)}: ${s.pts || 0} pts`).join(' · ') || '—'
        return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span><div style="font-size:11px;margin-top:2px">${standings}</div></div>`
      }

      // ── Wolf ──
      if (t === 'wolf') {
        const r = computeWolf(ctx, cfg)
        if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Wolf</span></div>`
        const ppt = cfg.ppt || 1

        // Resolve full name parts; for profile-linked members, look up roster by nickname
        function fullNameParts(m) {
          const full = (m?.guest_name || m?.name || '').trim()
          const parts = full.split(/\s+/).filter(Boolean)
          if (parts.length >= 2) return parts
          // Profile-linked members have no guest_name — try roster lookup by nickname
          if (m?.profile_id) {
            const roster = typeof rosterPlayers === 'function' ? rosterPlayers() : rosterPlayers?.value
            const rp = roster?.find(p =>
              (m.nickname && p.nickname === m.nickname) ||
              (m.short_name && p.short_name === m.short_name)
            )
            const rf = (rp?.name || '').trim()
            if (rf) return rf.split(/\s+/).filter(Boolean)
          }
          const d = memberDisplay(m)
          return (d && d !== '?') ? d.split(' ').filter(Boolean) : ['?']
        }
        // Unique labels for all round members (last name, bumped to F.LastName on collision)
        const memberLabels = makeUniqueLabels(ctx.members, fullNameParts)
        function abbN(m) { return memberLabels.get(m?.id) || '?' }
        function initLastN(m) { return memberLabels.get(m?.id) || '?' }

        // Build wolf-team and field-team labels for a completed hole
        function holeTeams(hr) {
          const allM = ctx.members
          const wolfM = allM.find(m => m.id === hr.wolf)
          const partnerM = hr.partner ? allM.find(m => m.id === hr.partner) : null
          const fieldMs = allM.filter(m => {
            if (m.id === hr.wolf) return false
            if (!hr.isLone && !hr.isBlind && m.id === hr.partner) return false
            return true
          })
          const wolfLabel = hr.isBlind ? `🙈${escHtml(abbN(wolfM))}`
            : hr.isLone ? `🐺${escHtml(abbN(wolfM))} Lone`
            : `🐺${[wolfM, partnerM].filter(Boolean).map(m => escHtml(abbN(m))).join('+')}`
          const fieldLabel = fieldMs.map(m => escHtml(abbN(m))).join('+')
          return { wolfLabel, fieldLabel }
        }

        // Next incomplete hole = upcoming wolf
        const nextIncomplete = r.holeResults.find(hr => hr.incomplete)
        const nextWolfHtml = nextIncomplete
          ? `<div style="font-size:11px;margin-top:3px;opacity:.85">🐺 H${nextIncomplete.hole}: <span style="font-weight:600">${escHtml(nextIncomplete.wolfName)}</span> is wolf</div>`
          : ''

        // All completed holes — scrollable per-hole breakdown
        const completed = r.holeResults.filter(hr => !hr.incomplete)
        let holesHtml = ''
        if (completed.length) {
          const items = completed.map(hr => {
            const color = hr.winner === 'wolf' ? '#4ade80' : hr.winner === null ? '#d4af37' : '#f87171'
            const { wolfLabel, fieldLabel } = holeTeams(hr)
            const resultStr = hr.winner === 'wolf'
              ? `<span style="color:#4ade80;font-weight:700">${wolfLabel}✓</span> vs ${fieldLabel}`
              : hr.winner === null
              ? `${wolfLabel} vs ${fieldLabel} <span style="color:#d4af37;font-weight:700">Push</span>`
              : `${wolfLabel} vs <span style="color:#f87171;font-weight:700">${fieldLabel}✓</span>`
            return `<div style="border-left:2px solid ${color}55;padding-left:5px;margin-bottom:2px;font-size:13px">H${hr.hole}: ${resultStr}</div>`
          }).join('')
          holesHtml = `<div style="margin-top:4px;max-height:120px;overflow-y:auto">${items}</div>`
        }

        // Standings — "F.LastName: ±$N" format
        const standings = r.settlements?.map(s => {
          const m = ctx.members.find(x => x.id === s.id)
          const label = m ? initLastN(m) : (s.name || '?')
          const color = (s.net||0) > 0 ? '#4ade80' : (s.net||0) < 0 ? '#f87171' : '#d4af37'
          return `${escHtml(label)}: <span style="color:${color};font-weight:700">${(s.net||0) > 0 ? '+' : ''}$${Math.abs(s.net||0)}</span>`
        }).join(' · ') || ''

        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Wolf</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/pt</span>${nextWolfHtml}${holesHtml}${standings ? `<div style="font-size:11px;margin-top:3px">${standings}</div>` : ''}</div>`
      }

      // ── Sixes ──
      if (t === 'sixes') {
        const r = computeSixes(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:11px">Need 4 players</span></div>`
        const ppt = cfg.ppt || 1
        // Each 6-hole segment settles only when all 6 holes are scored. Mid-segment
        // pts are projections (engine treats partial segments as 3/3 ties).
        const incompleteSegs = (r.segResults || []).filter(seg => !seg.skipped && (seg.holeDetails || []).some(h => h.incomplete)).length
        const allSettled = incompleteSegs === 0
        const standings = (r.settlements || []).map(s => {
          if (!allSettled) {
            // Show pts running, but no $ figure mid-segment.
            return `${escHtml(s.name)}: <span style="opacity:.7">${s.pts || 0}pts</span>`
          }
          const col = (s.net||0) > 0 ? '#4ade80' : (s.net||0) < 0 ? '#f87171' : '#d4af37'
          return `${escHtml(s.name)}: <span style="color:${col};font-weight:700">${(s.net||0) > 0 ? '+' : ''}$${Math.abs(s.net||0)}</span>`
        }).join(' · ') || '—'
        const liveTag = !allSettled ? `<span class="muted" style="font-size:10px;margin-left:6px">${incompleteSegs} seg in flight</span>` : ''
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/segment</span>${liveTag}<div style="font-size:11px;margin-top:3px">${standings}</div></div>`
      }

      // ── Dots ──
      if (t === 'dots') {
        const r = computeDots(ctx, cfg)
        if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span></div>`
        const ppt = r.ppt || cfg.ppt || 1
        const counts = r.settlements?.map(s => `${escHtml(s.name)}: ${s.myDots || 0}`).join(' · ') || '—'
        const dollarLine = r.settlements?.filter(s => (s.net||0) !== 0).map(s => `${escHtml(s.name)}${(s.net||0) > 0 ? '<span style="color:#4ade80"> +$' + s.net + '</span>' : '<span style="color:#f87171"> -$' + Math.abs(s.net) + '</span>'}`).join(' · ') || ''
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/dot</span><div style="font-size:11px;margin-top:3px;opacity:.8">${counts}</div>${dollarLine ? '<div style="font-size:11px;margin-top:2px">' + dollarLine + '</div>' : ''}</div>`
      }

      // ── BBB ──
      if (t === 'bbb') {
        const r = computeBbb(ctx, cfg)
        if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} BBB</span></div>`
        const ppt = r.ppt || cfg.ppt || 1
        const variant = cfg.doubleBongo ? ' (Double Bongo)' : ''
        const standingStr = (r.standings || []).slice().sort((a,b)=>b.pts-a.pts).map(s => `${escHtml(s.name)}: ${s.pts}pt`).join(' · ')
        const dollarLine = (r.settlements || []).map(s => `${escHtml(s.fromName)} → ${escHtml(s.toName)} $${s.amount}`).join(' · ')
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} BBB</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/pt${variant}</span><div style="font-size:11px;margin-top:3px;opacity:.8">${standingStr}</div>${dollarLine ? '<div style="font-size:11px;margin-top:2px;color:#4ade80">' + dollarLine + '</div>' : ''}</div>`
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
        const isDormie = !matchOver && remaining > 0 && Math.abs(finalUp) === remaining
        const ppt = r.settlement?.ppt || cfg.ppt || 0
        const isTournament = !!cfg.tournament
        const points = cfg.points || 2
        const t1nE = escHtml(t1n), t2nE = escHtml(t2n)
        let winner = null, value = null, detail = `${t1nE} vs ${t2nE}`
        if (played === 0) {
          detail = `${t1nE} vs ${t2nE} — waiting for scores`
        } else if (matchOver) {
          winner = finalUp > 0 ? t1n : t2n
          const loser = finalUp > 0 ? t2n : t1n
          const resultStr = `${Math.abs(finalUp)}&${remaining}`
          detail = `${escHtml(winner)} (${resultStr}) vs ${escHtml(loser)}`
          value = { pts: isTournament ? points : null, dollars: ppt > 0 ? ppt : null }
        } else if (finalUp === 0) {
          detail = `${t1nE} vs ${t2nE} — AS thru ${played}`
          if (isTournament) value = { pts: points / 2, dollars: null }
        } else if (isDormie) {
          const leader = finalUp > 0 ? t1n : t2n
          const trailer = finalUp > 0 ? t2n : t1n
          detail = `${escHtml(leader)} ${Math.abs(finalUp)} UP, ${remaining} to play vs ${escHtml(trailer)}`
        } else {
          winner = finalUp > 0 ? t1n : t2n
          const loser = finalUp > 0 ? t2n : t1n
          detail = `${escHtml(winner)} (${Math.abs(finalUp)} UP thru ${played}) vs ${escHtml(loser)}`
          value = { pts: isTournament ? points : null, dollars: ppt > 0 ? ppt : null }
        }
        return _gameLine({ gameName: 'Best Ball', winner, value, detail, dormie: isDormie })
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
        let r = computeFiveThreeOne(ctx, cfg)
        // Fallback: if config.players is absent in a 4-player round, auto-select first 3 members
        if (!r && !cfg.players && ctx.members.length > 3) {
          r = computeFiveThreeOne(ctx, { ...cfg, players: ctx.members.slice(0, 3).map(m => m.id) })
        }
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${t === 'nines' ? '9s' : '5-3-1'}</span><span class="muted" style="font-size:11px"> Need 3+ players</span></div>`
        const ppt = r.ppt || cfg.ppt || 1
        const played = (r.holeResults || []).filter(h => !h.incomplete).length
        const sorted = [...r.settlements].sort((a, b) => b.pts - a.pts)
        const medalEmojis = ['🥇','🥈','🥉']
        // Build sweep/birdie tallies per player
        const ftoTallies = {}
        for (const hr of (r.holeResults || [])) {
          if (hr.sweep) { ftoTallies[hr.sweep] = ftoTallies[hr.sweep] || { sweeps: 0, birdies: 0 }; ftoTallies[hr.sweep].sweeps++ }
          if (hr.birdieBonus) {
            for (const entry of hr.birdieBonus) {
              ftoTallies[entry.id] = ftoTallies[entry.id] || { sweeps: 0, birdies: 0 }
              ftoTallies[entry.id].birdies += entry.shots  // count points awarded, not occurrences
            }
          }
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
            + `<span style="min-width:60px">${medal}<span style="font-weight:700">${escHtml(s.name)}</span></span>`
            + `<span style="color:#d4af37;font-weight:700">${s.pts}pts · $${rawDollars}</span>`
            + `<span style="color:${netColor};font-size:10px">(net ${netStr})</span>`
            + tallyHtml
            + `</div>`
        }).join('')
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} ${t === 'nines' ? '9s' : '5-3-1'}</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/pt${played > 0 ? ' · thru ' + played : ''}</span>${badgeHtml}<div style="font-size:11px;margin-top:4px">${standRows || 'No complete holes yet'}</div></div>`
      }


      // ── 14 Holes ──
      if (t === 'fourteen') {
        const r = computeFourteen(ctx, cfg)
        if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} 14 Holes</span></div>`
        const totalHoles = 18
        const holesScored = r.players[0]?.holesScored ?? 0
        const statusTag = r.isComplete
          ? `<span style="font-size:10px;color:#4ade80;margin-left:4px">✓ complete</span>`
          : `<span class="muted" style="font-size:10px;margin-left:4px">${holesScored}/${totalHoles} holes</span>`
        const standRows = r.standings.map(p => {
          const deltaStr = r.isComplete && r.settlement
            ? (() => { const d = r.settlement.perPlayer[p.memberId]; return d > 0 ? `<span style="color:#4ade80">+$${d}</span>` : d < 0 ? `<span style="color:#f87171">-$${Math.abs(d)}</span>` : `<span class="muted">$0</span>` })()
            : (p.projection != null ? `<span class="muted">${Math.round(p.projection)} proj</span>` : '')
          const discardInfo = `${p.manualDiscards}/4 🗑️`
          return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:1px 0"><span>${escHtml(p.name)}</span><span>${p.total14 != null ? p.total14 : '—'} · ${discardInfo} ${deltaStr}</span></div>`
        }).join('')
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} 14 Holes</span>${statusTag}<div style="margin-top:4px">${standRows}</div></div>`
      }

      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${gameLabel(game.type, cfg)}</span></div>`
    } catch(e) {
      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${gameLabel(game.type, cfg)}</span><span class="muted" style="font-size:10px;margin-left:4px">Error loading</span></div>`
    }
  }

  // Force gameSummaryHtml to be reactive by tracking scores inside a computed token
  // Lightweight reactive tick: count total scored holes rather than JSON.stringify entire scores array
  const _scoresTick = computed(() => {
    const scores = roundsStore.activeScores
    const allScores = Object.values(scores || {}).flatMap(h => Object.values(h || {}))
    return allScores.length

  })
  function gameSummaryHtmlReactive(game) {
    // Access the tick to create reactive dependency on scores
    void _scoresTick.value
    return gameSummaryHtml(game)
  }

  // ── Dormie state tracking — emits stable IDs for any segment currently in dormie.
  // ScoringView watches this to fire a one-time toast on transition false→true.
  // Closeout (up > remaining) is intentionally excluded — that's "settled," not "dormie."
  const dormieStates = computed(() => {
    if (!roundsStore.activeRound) return []
    void _scoresTick.value  // reactivity dep on score updates
    const ctx = buildCtx()
    const out = []
    const games = roundsStore.activeGames || []
    const tournGames = tournamentWagerGames?.value ?? []
    for (const game of [...tournGames, ...games]) {
      const t = (game.type || '').toLowerCase()
      try {
        if (t === 'nassau') {
          const r = computeNassau(ctx, game.config || {})
          // Front segment main + presses.
          for (const seg of [
            { key: 'front', segObj: r.frontSeg, holes: 9 },
            { key: 'back', segObj: r.backSeg, holes: 9 },
          ]) {
            if (!seg.segObj) continue
            const segHR = seg.segObj.holeResults || []
            const startHole = segHR[0]?.hole ?? 1
            const main = { start: startHole, score: seg.segObj.t1Up || 0 }
            const allBets = [main, ...(seg.segObj.presses || [])]
            for (let bi = 0; bi < allBets.length; bi++) {
              const b = allBets[bi]
              const inBet = segHR.filter(hr => hr.hole >= b.start)
              const total = inBet.length
              const played = inBet.filter(hr => hr.n1 != null && hr.n2 != null).length
              const remaining = total - played
              const score = b.score || 0
              if (remaining > 0 && Math.abs(score) === remaining) {
                const subLabel = bi === 0 ? '' : ` press ${bi}`
                out.push({
                  id: `nassau:${game.id}:${seg.key}:${bi}`,
                  label: `Nassau ${seg.key === 'front' ? 'Front' : 'Back'}${subLabel}`,
                })
              }
            }
          }
          // Overall.
          const allHR = [...(r.frontSeg?.holeResults || []), ...(r.backSeg?.holeResults || [])]
          const oPlayed = allHR.filter(hr => hr.n1 != null && hr.n2 != null).length
          const oRem = (allHR.length || 18) - oPlayed
          const oUp = r.overallUp || 0
          if (oRem > 0 && Math.abs(oUp) === oRem) {
            out.push({ id: `nassau:${game.id}:overall:0`, label: 'Nassau Overall' })
          }
        } else if (t === 'match' || t === 'match1v1') {
          const cfg = game.config || {}
          const is1v1 = !!(cfg.player1 && cfg.player2)
          let r = null
          if (is1v1) r = computeMatch(ctx, cfg)
          else if (cfg.team1?.length && cfg.team2?.length) r = computeBestBall(ctx, { ...cfg, ballsPerTeam: 1 })
          if (!r) continue
          const played = (r.holeResults || []).filter(h => !h.incomplete).length
          const totalHoles = visibleHoles.value?.length || 18
          const remaining = totalHoles - played
          const up = r.finalUp || 0
          const matchOver = r.matchOver ?? (played > 0 && Math.abs(up) > remaining)
          if (!matchOver && remaining > 0 && Math.abs(up) === remaining) {
            const lbl = is1v1
              ? `${r.p1?.name || 'P1'} vs ${r.p2?.name || 'P2'}`
              : `${r.t1Name || teamInitialsStr(cfg.team1) || 'T1'} vs ${r.t2Name || teamInitialsStr(cfg.team2) || 'T2'}`
            out.push({ id: `match:${game.id}`, label: lbl })
          }
        } else if (t === 'best_ball' || t === 'bestball') {
          const cfg = game.config || {}
          const r = computeBestBall(ctx, cfg)
          if (!r) continue
          const played = (r.holeResults || []).filter(h => !h.incomplete).length
          const remaining = (r.holeResults || []).filter(h => h.incomplete).length
          const up = r.finalUp || 0
          const matchOver = played > 0 && Math.abs(up) > remaining
          if (!matchOver && remaining > 0 && Math.abs(up) === remaining) {
            out.push({ id: `bb:${game.id}`, label: `${r.t1Name || 'T1'} vs ${r.t2Name || 'T2'}` })
          }
        }
      } catch { /* skip */ }
    }
    return out
  })

  return {
    liveSettlements,
    gameSummaryHtml: gameSummaryHtmlReactive,
    dormieStates,
  }
}
