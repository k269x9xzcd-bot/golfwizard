/**
 * scorecardShare.js
 * Captures the live scorecard DOM and shares via iOS share sheet.
 *
 * Targets #gw-capture-target — the actual scorecard-outer div in ScoringView.
 * This means the share image is always an exact replica of what's on screen:
 * same notations, team colors, stroke dots, game rows, and settle-up box.
 *
 * A hidden .capture-header is revealed during capture to add course/tees/date branding.
 */

async function captureElement(el, filename, text) {
  const html2canvas = (await import('html2canvas')).default

  // Expand the element to full width before capture (it may be scrollable/clipped)
  const prevOverflow = el.style.overflow
  const prevMaxHeight = el.style.maxHeight
  const prevBorderRadius = el.style.borderRadius
  el.style.overflow = 'visible'
  el.style.maxHeight = 'none'
  el.style.borderRadius = '0'

  // Add class to reveal the capture header
  el.classList.add('gw-capturing')

  // Also include the settle-box if it exists immediately after this element
  const settleBox = el.nextElementSibling?.classList.contains('settle-box')
    ? el.nextElementSibling : null

  let wrapper = null
  let captureTarget = el

  if (settleBox) {
    // Wrap both elements in a container for a single capture
    wrapper = document.createElement('div')
    wrapper.style.cssText = 'background:#faf7f0;border-radius:12px;overflow:hidden;'
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    wrapper.appendChild(settleBox)
    captureTarget = wrapper
  }

  try {
    const canvas = await html2canvas(captureTarget, {
      backgroundColor: '#faf7f0',
      scale: 2,
      useCORS: true,
      logging: false,
      // Capture full scrollable width
      width: captureTarget.scrollWidth,
      windowWidth: captureTarget.scrollWidth + 100,
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
    // Restore element styles
    el.style.overflow = prevOverflow
    el.style.maxHeight = prevMaxHeight
    el.style.borderRadius = prevBorderRadius
    el.classList.remove('gw-capturing')

    // Unwrap if we wrapped
    if (wrapper) {
      wrapper.parentNode.insertBefore(el, wrapper)
      if (settleBox) wrapper.parentNode.insertBefore(settleBox, wrapper)
      wrapper.parentNode.removeChild(wrapper)
    }
  }
}

/**
 * Share just the scorecard image.
 * round is used only for the filename.
 */
export async function shareScorecard(round) {
  const el = document.getElementById('gw-capture-target')
  if (!el) throw new Error('Scorecard element not found')
  const filename = `${(round.course_name || 'scorecard').replace(/\s+/g, '-')}-${round.date || 'today'}.png`
  await captureElement(el, filename, `${round.course_name} scorecard`)
}

/**
 * Share scorecard + game settlement recap.
 * Same capture — the settle-box is automatically included if present.
 */
export async function shareRecap(round) {
  const el = document.getElementById('gw-capture-target')
  if (!el) throw new Error('Scorecard element not found')
  const filename = `${(round.course_name || 'recap').replace(/\s+/g, '-')}-${round.date || 'today'}-recap.png`
  await captureElement(el, filename, `GolfWizard Recap · ${round.course_name}`)
}
