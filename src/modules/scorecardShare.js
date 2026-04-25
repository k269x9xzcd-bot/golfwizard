/**
 * scorecardShare.js
 * Renders ScorecardCapture.vue off-screen, captures it with html2canvas,
 * and shares via iOS share sheet (or downloads on desktop).
 *
 * No DOM surgery. No sticky hacks. No overflow unlocking.
 * The capture component is a pure, print-optimized Vue component with
 * fixed 940px width and no interactive layout constraints.
 */

import { createApp, defineComponent, h } from 'vue'
import ScorecardCapture from '../components/ScorecardCapture.vue'

/**
 * Mount ScorecardCapture off-screen, take a screenshot, unmount.
 *
 * @param {object} captureProps - props to pass to ScorecardCapture
 * @param {string} filename
 * @param {string} text         - share sheet message body
 */
async function captureComponent(captureProps, filename, text) {
  const html2canvas = (await import('html2canvas')).default

  // ── Mount off-screen container ────────────────────────────────
  const container = document.createElement('div')
  container.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'width:960px',       // matches sc-wrap min-width in ScorecardCapture
    'background:#faf7f0',
    'pointer-events:none',
    'z-index:-1',
    'overflow:visible',  // ensure scrollHeight is accurate
  ].join(';')
  document.body.appendChild(container)

  // Mount a minimal wrapper app that renders ScorecardCapture with our props
  const WrapperApp = defineComponent({
    render() {
      return h(ScorecardCapture, captureProps)
    },
  })
  const app = createApp(WrapperApp)
  app.mount(container)

  // Give Vue two frames to finish rendering + layout
  await new Promise(resolve => setTimeout(resolve, 120))

  const captureEl = container.firstElementChild
  const captureWidth  = captureEl ? captureEl.scrollWidth  : 960
  const captureHeight = captureEl ? captureEl.scrollHeight : 600

  try {
    const canvas = await html2canvas(captureEl || container, {
      backgroundColor: '#faf7f0',
      scale: 2,
      useCORS: true,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      x: 0,
      y: 0,
    })

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const file = new File([blob], filename, { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'GolfWizard Scorecard', text })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }
  } finally {
    app.unmount()
    document.body.removeChild(container)
  }
}

/**
 * Build a plain-text games + settlement summary for the share message body.
 * Appears in the iOS share sheet text field.
 */
function buildGamesSummaryText(gameRows, settlement) {
  const lines = []
  const HR = '─────────────────────────'

  if (gameRows?.length) {
    lines.push('⛳ GAMES')
    lines.push(HR)
    for (const g of gameRows) {
      const icon = g.icon || '🏌️'
      const label = g.label || ''
      if (g.winnerLine) {
        lines.push(`${icon} ${label}`)
        lines.push(`   🏆 ${g.winnerLine}`)
        if (g.detail) {
          // break detail "A: +$X · B: -$Y" into one line each
          const parts = g.detail.split(' · ')
          for (const p of parts) lines.push(`   ${p}`)
        }
      } else if (g.detail) {
        lines.push(`${icon} ${label}: ${g.detail}`)
      }
      lines.push('')
    }
  }

  if (settlement?.ledger?.length) {
    lines.push('💵 SETTLE UP')
    lines.push(HR)
    // player totals first
    const totals = Object.values(settlement.playerTotals || {})
    const winners = totals.filter(t => t.total > 0).sort((a,b) => b.total - a.total)
    const losers  = totals.filter(t => t.total < 0).sort((a,b) => a.total - b.total)
    const evens   = totals.filter(t => t.total === 0)
    for (const t of winners) lines.push(`✅ ${t.name}: +$${t.total}`)
    for (const t of losers)  lines.push(`❌ ${t.name}: -$${Math.abs(t.total)}`)
    for (const t of evens)   lines.push(`➖ ${t.name}: even`)
    lines.push('')
    lines.push('💸 Transfers:')
    for (const e of settlement.ledger) {
      lines.push(`   ${e.from_name} → ${e.to_name}  $${e.amount}`)
    }
  } else if (settlement?.playerTotals) {
    const totals = Object.values(settlement.playerTotals)
    if (totals.some(t => t.total !== 0)) {
      lines.push('💵 SETTLE UP')
      lines.push(HR)
      const sorted = [...totals].sort((a,b) => b.total - a.total)
      for (const t of sorted) {
        const sign = t.total > 0 ? '+' : t.total < 0 ? '-' : ''
        const prefix = t.total > 0 ? '✅' : t.total < 0 ? '❌' : '➖'
        lines.push(`${prefix} ${t.name}: ${sign}$${Math.abs(t.total)}`)
      }
    }
  }

  return lines.join('\n').trimEnd()
}

/**
 * Build the props object for ScorecardCapture from ScoringView context.
 * Called by both shareScorecard and shareRecap.
 */
function buildCaptureProps(round, members, scores, courseData, games, settlement, gameRows, notationRows, sixesHoleTeamMap) {
  return {
    round,
    members,
    scores,
    course: courseData,
    games,
    settlement: settlement || null,
    gameRows: gameRows || [],
    notationRows: notationRows || [],
    sixesHoleTeamMap: sixesHoleTeamMap || {},
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Share just the scorecard image (no settlement).
 *
 * @param {object} round
 * @param {Array}  members        - roundsStore.activeMembers
 * @param {object} scores         - roundsStore.activeScores
 * @param {object} courseData     - resolved course object
 * @param {Array}  notationRows   - gameNotationRows computed value
 */
export async function shareScorecard(round, members, scores, courseData, notationRows, sixesHoleTeamMap) {
  const filename = `${(round.course_name || 'scorecard').replace(/\s+/g, '-')}-${round.date || 'today'}.png`
  const props = buildCaptureProps(round, members, scores, courseData, [], null, [], notationRows, sixesHoleTeamMap)
  await captureComponent(props, filename, `${round.course_name} scorecard`)
}

/**
 * Share scorecard + game summary + settlement.
 *
 * @param {object} round
 * @param {Array}  members
 * @param {object} scores
 * @param {object} courseData
 * @param {Array}  games          - roundsStore.activeGames
 * @param {object} settlement     - liveSettlements.value
 * @param {Array}  gameRows       - buildGameLines() result
 * @param {Array}  notationRows   - gameNotationRows computed value
 */
export async function shareRecap(round, members, scores, courseData, games, settlement, gameRows, notationRows, sixesHoleTeamMap) {
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  const gamesSummary = buildGamesSummaryText(gameRows, settlement)
  const header = `GolfWizard Recap \u00b7 ${round.course_name} \u00b7 ${round.date || ''}`
  const text = gamesSummary ? `${header}\n\n${gamesSummary}` : header
  const props = buildCaptureProps(round, members, scores, courseData, games, settlement, gameRows, notationRows, sixesHoleTeamMap)
  await captureComponent(props, filename, text)
}

/**
 * Share a recap from the History view.
 *
 * @param {object} round
 * @param {Array}  members
 * @param {object} scores         - { [memberId]: { [hole]: score } }
 * @param {object} courseData
 * @param {Array}  games
 * @param {object} settlement
 * @param {Array}  gameRows
 * @param {Array}  notationRows
 */
export async function shareHistoryRecap(round, members, scores, courseData, games, settlement, gameRows, notationRows) {
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  const gamesSummary = buildGamesSummaryText(gameRows, settlement)
  const header = `GolfWizard Recap \u00b7 ${round.course_name} \u00b7 ${round.date || ''}`
  const text = gamesSummary ? `${header}\n\n${gamesSummary}` : header
  const props = buildCaptureProps(round, members, scores, courseData, games, settlement, gameRows, notationRows)
  await captureComponent(props, filename, text)
}
