/**
 * scorecardShare.js
 * Captures the live scorecard DOM and shares via iOS share sheet.
 *
 * For ScoringView: targets #gw-capture-target (.scorecard-outer).
 * Forces landscape CSS (.is-landscape on the scoring-view root) before capture
 * so the screenshot matches the landscape layout shown in the example.
 * Captures the full scrollable table width (reads from .scorecard-scroll).
 *
 * For HistoryView: captures the .round-detail card as-is, and builds a
 * plain-text summary of game results + settlement to attach to the share message.
 */

/**
 * Core capture — handles full-width expansion, landscape mode toggle,
 * capture header reveal, and settle-box inclusion.
 *
 * @param {HTMLElement} el            - element to capture (.scorecard-outer)
 * @param {string}      filename      - output filename
 * @param {string}      text          - share message text
 * @param {object}      opts
 * @param {boolean}     opts.landscape - force .is-landscape before capture
 */
async function captureElement(el, filename, text, opts = {}) {
  const html2canvas = (await import('html2canvas')).default

  // --- 1. Force landscape layout if requested ---
  const scoringRoot = opts.landscape
    ? document.querySelector('.scoring-view')
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

  // --- 5. Measure full scrollable width ---
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
 */
export async function shareRecap(round) {
  const el = document.getElementById('gw-capture-target')
  if (!el) throw new Error('Scorecard element not found')
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  await captureElement(el, filename, `GolfWizard Recap · ${round.course_name}`, { landscape: true })
}

/**
 * Build a plain-text games + settlement summary for the share message body.
 * This appears in the iOS share sheet text field so recipients get the data
 * even if they can't view the image.
 */
function buildGamesSummaryText(gameRows, settlement) {
  const lines = []

  if (gameRows?.length) {
    lines.push('⛳ GAMES')
    for (const g of gameRows) {
      const icon = g.icon || '🏌️'
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
    lines.push('💵 SETTLE UP')
    for (const e of settlement.ledger) {
      lines.push(`${e.from_name} → ${e.to_name}: $${e.amount}`)
    }
  } else if (settlement?.playerTotals) {
    const totals = Object.values(settlement.playerTotals)
    if (totals.some(t => t.total !== 0)) {
      if (lines.length) lines.push('')
      lines.push('💵 SETTLE UP')
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
 * Captures the expanded .round-detail card as the image.
 * Attaches a plain-text game results + settlement summary to the share message.
 *
 * @param {object}      round      - round object from the rounds store
 * @param {HTMLElement} detailEl   - the .round-detail DOM element
 * @param {Array}       gameRows   - result of gameRecapRows(round)
 * @param {object}      settlement - settlementsCache[round.id]
 */
export async function shareHistoryRecap(round, detailEl, gameRows, settlement) {
  if (!detailEl) throw new Error('Round detail element not found')
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  const gamesSummary = buildGamesSummaryText(gameRows, settlement)
  const header = `GolfWizard Recap · ${round.course_name} · ${round.date || ''}`
  const text = gamesSummary ? `${header}\n\n${gamesSummary}` : header
  await captureElement(detailEl, filename, text)
}
