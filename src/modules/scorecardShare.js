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
 * text summary of scores + game results to attach to the share message.
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
  // Use the inner table width so we capture all 18 columns, not the clipped outer div.
  const tableEl = el.querySelector('.scorecard-grid')
  const captureWidth = tableEl
    ? tableEl.scrollWidth + 32   // +32 for sticky col + padding
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
    // Restore everything
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
  await captureElement(el, filename, `GolfWizard Recap \u00b7 ${round.course_name}`, { landscape: true })
}

/**
 * Share a history round recap from HistoryView.
 *
 * Captures the expanded .round-detail card as the image.
 * Builds a plain-text score + game summary to attach to the share message
 * so recipients get the data even if they can't see the image.
 *
 * @param {object}      round  - round object from the rounds store
 * @param {HTMLElement} el     - the .round-detail DOM element
 * @param {string}      [textSummary] - optional pre-built text (gameRecap lines)
 */
export async function shareHistoryRecap(round, el, textSummary) {
  if (!el) throw new Error('Round detail element not found')

  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`

  // Build share text from round data
  const members = round.round_members || []
  const scores  = round.scores || []
  const scoreLines = members.map(m => {
    const total = scores
      .filter(s => s.member_id === m.id)
      .reduce((sum, s) => sum + (s.score ?? s.strokes ?? 0), 0)
    return `${m.short_name || m.guest_name || '?'}: ${total || '—'}`
  }).join(', ')

  const header = `\u26f3 ${round.course_name} \u00b7 ${round.date || ''}\n`
  const text = textSummary
    ? `${header}${scoreLines}\n\n${textSummary}`
    : `${header}${scoreLines}`

  // Unlock the card so html2canvas captures full height
  const prevMaxHeight = el.style.maxHeight
  const prevOverflow  = el.style.overflow
  el.style.maxHeight  = 'none'
  el.style.overflow   = 'visible'

  const html2canvas = (await import('html2canvas')).default
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#0c150e',
      scale: 2,
      useCORS: true,
      logging: false,
      width: el.scrollWidth,
      windowWidth: el.scrollWidth + 40,
    })
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const file = new File([blob], filename, { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'GolfWizard Recap', text })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }
  } finally {
    el.style.maxHeight = prevMaxHeight
    el.style.overflow  = prevOverflow
  }
}
