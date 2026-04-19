/**
 * scorecardShare.js
 * Captures the live scorecard DOM and shares via iOS share sheet.
 *
 * For ScoringView: targets #gw-capture-target (.scorecard-outer).
 * Forces landscape CSS (.is-landscape on the scoring-view root) before capture
 * so the screenshot matches the landscape layout shown in the example.
 * Captures the full scrollable table width (reads from .scorecard-scroll).
 *
 * For HistoryView: renders a hidden ScorecardGrid component, captures it
 * landscape, and attaches a plain-text game results + settlement summary.
 */

/**
 * Core capture — handles full-width expansion, landscape mode toggle,
 * capture header reveal, and settle-box inclusion.
 *
 * @param {HTMLElement} el            - element to capture (.scorecard-outer)
 * @param {string}      filename      - output filename
 * @param {string}      text          - share message text
 * @param {object}      opts
 * @param {boolean}     opts.landscape     - force .is-landscape before capture
 * @param {string}      opts.landscapeRoot - CSS selector for element to add .is-landscape to
 *                                           (defaults to .scoring-view for ScoringView,
 *                                            use '#gw-history-capture-target' wrapper for History)
 */
async function captureElement(el, filename, text, opts = {}) {
  const html2canvas = (await import('html2canvas')).default

  // --- 1. Force landscape layout if requested ---
  // For ScoringView: add .is-landscape to .scoring-view (triggers CSS layout)
  // For HistoryView: the hidden grid is already full-width; just widen el itself
  const landscapeRootSel = opts.landscapeRoot || '.scoring-view'
  const scoringRoot = opts.landscape
    ? document.querySelector(landscapeRootSel)
    : null
  if (scoringRoot) scoringRoot.classList.add('is-landscape')

  // --- 2. Unlock overflow so the full table is visible ---
  const prevOverflow   = el.style.overflow
  const prevMaxHeight  = el.style.maxHeight
  const prevBorderRadius = el.style.borderRadius
  el.style.overflow    = 'visible'
  el.style.maxHeight   = 'none'
  el.style.borderRadius = '0'

  // Also unlock the inner scroll container so html2canvas sees everything
  const scrollEl = el.querySelector('.scorecard-scroll')
  const prevScrollOverflow = scrollEl ? scrollEl.style.overflow : null
  if (scrollEl) scrollEl.style.overflow = 'visible'

  // --- 3. Reveal the capture header (course + branding) ---
  el.classList.add('gw-capturing')

  // --- 4. Optionally wrap settle-box in the same capture ---
  const settleBox = el.nextElementSibling?.classList.contains('settle-box')
    ? el.nextElementSibling : null

  let wrapper = null
  let captureTarget = el

  if (settleBox) {
    wrapper = document.createElement('div')
    wrapper.style.cssText = 'background:#faf7f0;border-radius:12px;overflow:hidden;display:inline-block;'
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    wrapper.appendChild(settleBox)
    captureTarget = wrapper
  }

  // --- 5. Disable position:sticky — html2canvas mis-renders sticky columns
  //        when the element is off-screen or inside a clipped container.
  //        Convert all sticky cells to position:static before capture and restore after.
  const stickyEls = Array.from(captureTarget.querySelectorAll('.col-sticky'))
  const stickyPrev = stickyEls.map(s => ({ el: s, pos: s.style.position, zIndex: s.style.zIndex, left: s.style.left }))
  stickyEls.forEach(s => { s.style.position = 'static'; s.style.zIndex = ''; s.style.left = '' })

  // --- 6. Measure full scrollable width ---
  const tableEl = el.querySelector('.scorecard-grid')
  const captureWidth = tableEl
    ? tableEl.scrollWidth + 32
    : captureTarget.scrollWidth

  try {
    const canvas = await html2canvas(captureTarget, {
      backgroundColor: '#faf7f0',
      scale: 2,
      useCORS: true,
      logging: false,
      width: captureWidth,
      windowWidth: captureWidth + 100,
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
    // Restore sticky positioning
    stickyPrev.forEach(({ el: s, pos, zIndex, left }) => {
      s.style.position = pos
      s.style.zIndex = zIndex
      s.style.left = left
    })
    el.style.overflow      = prevOverflow
    el.style.maxHeight     = prevMaxHeight
    el.style.borderRadius  = prevBorderRadius
    if (scrollEl) scrollEl.style.overflow = prevScrollOverflow
    el.classList.remove('gw-capturing')
    if (scoringRoot) scoringRoot.classList.remove('is-landscape')

    if (wrapper) {
      wrapper.parentNode.insertBefore(el, wrapper)
      if (settleBox) wrapper.parentNode.insertBefore(settleBox, wrapper)
      wrapper.parentNode.removeChild(wrapper)
    }
  }
}

/**
 * Share just the scorecard image (from ScoringView).
 */
export async function shareScorecard(round) {
  const el = document.getElementById('gw-capture-target')
  if (!el) throw new Error('Scorecard element not found')
  const filename = `${(round.course_name || 'scorecard').replace(/\s+/g, '-')}-${round.date || 'today'}.png`
  await captureElement(el, filename, `${round.course_name} scorecard`, { landscape: true })
}

/**
 * Share scorecard + settle-box (from ScoringView).
 * @param {object} round      - active round
 * @param {Array}  gameRows   - result of buildGameLines() from ScoringView
 * @param {object} settlement - liveSettlements.value
 */
export async function shareRecap(round, gameRows, settlement) {
  const el = document.getElementById('gw-capture-target')
  if (!el) throw new Error('Scorecard element not found')
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  const gamesSummary = buildGamesSummaryText(gameRows, settlement)
  const header = `GolfWizard Recap \u00b7 ${round.course_name} \u00b7 ${round.date || ''}`
  const text = gamesSummary ? `${header}\n\n${gamesSummary}` : header
  await captureElement(el, filename, text, { landscape: true })
}

/**
 * Build a plain-text games + settlement summary for the share message body.
 * This appears in the iOS share sheet text field so recipients get the data
 * even if they can't view the image.
 */
function buildGamesSummaryText(gameRows, settlement) {
  const lines = []

  if (gameRows?.length) {
    lines.push('\u26f3 GAMES')
    for (const g of gameRows) {
      const icon = g.icon || '\ud83c\udfcc\ufe0f'
      const label = g.label || ''
      if (g.winnerLine) {
        lines.push(`${icon} ${label}: ${g.winnerLine}`)
        if (g.detail) lines.push(`   ${g.detail}`)
      } else if (g.detail) {
        lines.push(`${icon} ${label}: ${g.detail}`)
      }
    }
  }

  if (settlement?.ledger?.length) {
    if (lines.length) lines.push('')
    lines.push('\ud83d\udcb5 SETTLE UP')
    for (const e of settlement.ledger) {
      lines.push(`${e.from_name} \u2192 ${e.to_name}: $${e.amount}`)
    }
  } else if (settlement?.playerTotals) {
    const totals = Object.values(settlement.playerTotals)
    if (totals.some(t => t.total !== 0)) {
      if (lines.length) lines.push('')
      lines.push('\ud83d\udcb5 SETTLE UP')
      for (const t of totals) {
        const sign = t.total > 0 ? '+' : ''
        lines.push(`${t.name}: ${sign}$${Math.abs(t.total)}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Share a recap from the History view.
 * Captures the hidden ScorecardGrid (#gw-history-capture-{roundId}) in landscape,
 * and attaches a plain-text game results + settlement summary.
 *
 * @param {object} round      - round object
 * @param {Array}  gameRows   - result of gameRecapRows(round)
 * @param {object} settlement - settlementsCache[round.id]
 */
export async function shareHistoryRecap(round, gameRows, settlement) {
  const captureId = `gw-history-capture-${round.id}`
  const el = document.getElementById(captureId)
  if (!el) throw new Error('History scorecard grid not found — is the round expanded?')
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  const gamesSummary = buildGamesSummaryText(gameRows, settlement)
  const header = `GolfWizard Recap \u00b7 ${round.course_name} \u00b7 ${round.date || ''}`
  const text = gamesSummary ? `${header}\n\n${gamesSummary}` : header
  // The hidden wrapper is already 900px wide (effectively landscape).
  // We don't need landscape: true here — that flag only applies to ScoringView's
  // .is-landscape CSS class which controls its own layout. The hidden grid
  // renders full-width by virtue of the off-screen 900px container.
  await captureElement(el, filename, text)
}
