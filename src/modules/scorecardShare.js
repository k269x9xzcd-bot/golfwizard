/**
 * scorecardShare.js
 * Renders an off-screen scorecard image and shares via iOS share sheet.
 *
 * shareScorecard(round, members, scores, course, games, result)
 * shareRecap(round, members, scores, course, games, result)
 *
 * `result` is the output of computeAllSettlements() — optional, used for recap only.
 */

// ── Helpers ───────────────────────────────────────────────────────
function totalFor(memberId, scores, holes) {
  return holes.reduce((s, h) => s + (scores[memberId]?.[h] ?? 0), 0)
}

function parFor(course, tee, holes) {
  const teePar = course?.teesData?.[tee]?.parByHole || course?.par || []
  return holes.reduce((s, h) => s + (teePar[h - 1] ?? 4), 0)
}

function siFor(course, tee) {
  return course?.teesData?.[tee]?.siByHole || course?.si || []
}

function yardsFor(course, tee) {
  return course?.teesData?.[tee]?.yardsByHole || []
}

function scoreColor(gross, par) {
  if (!gross || !par) return '#e8e0cc'
  const diff = gross - par
  if (diff <= -2) return '#ffd700'   // eagle — gold
  if (diff === -1) return '#60a5fa'  // birdie — blue
  if (diff === 0)  return '#e8e0cc'  // par — cream
  if (diff === 1)  return '#f97316'  // bogey — orange
  return '#ef4444'                   // double+ — red
}

function scoreBorder(gross, par) {
  if (!gross || !par) return '1px solid #444'
  const diff = gross - par
  if (diff <= -1) return '2px solid #60a5fa'
  return '1px solid #555'
}

function netScore(gross, roundHcp, siArr, hole) {
  if (!gross) return null
  const si = siArr[hole - 1] ?? 18
  const strokes = roundHcp > 0 && si <= roundHcp ? 1 : 0
  return gross - strokes
}

// ── Build scorecard HTML ──────────────────────────────────────────
function buildScorecardHtml(round, members, scores, course, gameResults) {
  const tee = round.tee || ''
  const holes = round.holes_mode === '9f' ? Array.from({length:9},(_,i)=>i+1)
              : round.holes_mode === '9b' ? Array.from({length:9},(_,i)=>i+10)
              : Array.from({length:18},(_,i)=>i+1)
  const front = holes.filter(h => h <= 9)
  const back  = holes.filter(h => h >= 10)
  const hasFront = front.length > 0
  const hasBack  = back.length > 0

  const siArr   = siFor(course, tee)
  const yardsArr = yardsFor(course, tee)
  const parArr  = course?.teesData?.[tee]?.parByHole || course?.par || []

  const parRow = (hs) => hs.map(h => parArr[h-1] ?? 4)
  const siRow  = (hs) => hs.map(h => siArr[h-1] ?? h)
  const ydsRow = (hs) => hs.map(h => yardsArr[h-1] ?? '')

  const frontPar = front.reduce((s,h) => s+(parArr[h-1]??4), 0)
  const backPar  = back.reduce((s,h) => s+(parArr[h-1]??4), 0)
  const totalPar = frontPar + backPar

  // Colors
  const BG       = '#0d1f12'
  const HEADER   = '#1a2e1a'
  const GOLD     = '#d4af37'
  const GREEN    = '#22a06b'
  const CREAM    = '#e8e0cc'
  const MUTED    = '#8a9e8a'
  const CELL     = '#162118'

  // ── Cell builder ───────────────────────────────────────────────
  function scoreCell(gross, par, size='28px') {
    if (!gross) return `<td style="text-align:center;font-size:13px;color:${MUTED};width:${size}">—</td>`
    const bg = scoreColor(gross, par)
    const border = scoreBorder(gross, par)
    const diff = gross - par
    const fg = diff <= 0 ? '#0d1f12' : '#fff'
    const radius = diff <= -1 ? '50%' : '4px'
    return `<td style="text-align:center;padding:2px;">
      <div style="background:${bg};color:${fg};border:${border};border-radius:${radius};
        width:${size};height:${size};line-height:${size};text-align:center;font-size:13px;
        font-weight:700;margin:0 auto;">${gross}</div></td>`
  }

  function holeHeaders(hs) {
    return hs.map(h => `<th style="text-align:center;color:${MUTED};font-size:11px;font-weight:400;width:28px;">${h}</th>`).join('')
  }

  function statRow(label, vals, total, color=MUTED, bold=false) {
    const fw = bold ? '700' : '400'
    return `<tr>
      <td style="padding:2px 8px;color:${color};font-size:11px;font-weight:${fw};white-space:nowrap;">${label}</td>
      ${vals.map(v => `<td style="text-align:center;color:${color};font-size:11px;font-weight:${fw};">${v??''}</td>`).join('')}
      ${total !== undefined ? `<td style="text-align:center;color:${GOLD};font-size:12px;font-weight:700;">${total}</td>` : ''}
    </tr>`
  }

  // ── Member rows ────────────────────────────────────────────────
  function memberRow(m) {
    const name = m.short_name || m.guest_name || '?'
    const idx  = parseFloat(m.ghin_index ?? 0).toFixed(1)
    const hcp  = m.round_hcp ?? '?'
    const frontScores = front.map(h => {
      const g = scores[m.id]?.[h]
      const p = parArr[h-1] ?? 4
      return scoreCell(g, p)
    })
    const backScores = back.map(h => {
      const g = scores[m.id]?.[h]
      const p = parArr[h-1] ?? 4
      return scoreCell(g, p)
    })
    const frontTotal = totalFor(m.id, scores, front)
    const backTotal  = totalFor(m.id, scores, back)
    const gross      = frontTotal + backTotal
    const net        = gross - (m.round_hcp ?? 0)

    const nameColor = m.team === 1 ? '#60a5fa' : m.team === 2 ? '#f87171' : CREAM

    return `<tr style="border-bottom:1px solid #1e3020;">
      <td style="padding:4px 8px;white-space:nowrap;">
        <span style="color:${nameColor};font-weight:700;font-size:13px;">${name}</span>
        <span style="color:${MUTED};font-size:10px;margin-left:4px;">${idx} (${hcp})</span>
      </td>
      ${frontScores.join('')}
      ${hasFront ? `<td style="text-align:center;color:${GOLD};font-size:13px;font-weight:700;padding:0 4px;">${frontTotal||''}</td>` : ''}
      ${backScores.join('')}
      ${hasBack  ? `<td style="text-align:center;color:${GOLD};font-size:13px;font-weight:700;padding:0 4px;">${backTotal||''}</td>` : ''}
      <td style="text-align:center;color:${CREAM};font-size:13px;font-weight:700;padding:0 4px;">${gross||''}</td>
      <td style="text-align:center;color:${GREEN};font-size:13px;font-weight:700;padding:0 4px;">${net||''}</td>
    </tr>`
  }

  // ── Table ──────────────────────────────────────────────────────
  const colGroup = `
    <colgroup>
      <col style="width:120px;">
      ${holes.map(() => '<col style="width:28px;">').join('')}
      ${hasFront ? '<col style="width:36px;">' : ''}
      ${hasBack  ? '<col style="width:36px;">' : ''}
      <col style="width:36px;">
      <col style="width:36px;">
    </colgroup>`

  const thOut = hasFront ? `<th style="text-align:center;color:${GOLD};font-size:12px;font-weight:700;">OUT</th>` : ''
  const thIn  = hasBack  ? `<th style="text-align:center;color:${GOLD};font-size:12px;font-weight:700;">IN</th>`  : ''
  const thG   = `<th style="text-align:center;color:${CREAM};font-size:12px;font-weight:600;">G</th>`
  const thN   = `<th style="text-align:center;color:${GREEN};font-size:12px;font-weight:600;">N</th>`

  const date  = round.date || round.created_at?.slice(0,10) || ''

  const html = `
  <div id="gw-scorecard-export" style="
    background:${BG};color:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    padding:20px;width:780px;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.6);
  ">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        <div style="font-size:24px;font-weight:800;color:${GOLD};">${round.course_name}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:2px;">${date} · ${tee} tees</div>
      </div>
      <div style="font-size:13px;color:${GREEN};font-weight:700;display:flex;align-items:center;gap:6px;">
        ⛳ GolfWizard
      </div>
    </div>

    <!-- Scorecard table -->
    <div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;background:${CELL};border-radius:10px;overflow:hidden;">
      ${colGroup}
      <thead style="background:${HEADER};">
        <tr>
          <th style="text-align:left;padding:6px 8px;color:${MUTED};font-size:11px;font-weight:500;">PLAYER</th>
          ${holeHeaders(front)}
          ${thOut}
          ${holeHeaders(back)}
          ${thIn}
          ${thG}${thN}
        </tr>
      </thead>
      <tbody>
        ${statRow('Par',
          [...parRow(front), ...parRow(back)].map((v,i) => v),
          hasFront && hasBack ? undefined : undefined,
          MUTED)}
        ${statRow('SI',
          [...siRow(front), ...siRow(back)],
          undefined, '#c8a84b')}
        ${yardsArr.length ? statRow('Yds',
          [...ydsRow(front), ...ydsRow(back)],
          undefined, MUTED) : ''}
        ${members.map(m => memberRow(m)).join('')}
      </tbody>
    </table>
    </div>

    <!-- Game results (if provided) -->
    ${gameResults ? `
    <div style="margin-top:16px;padding:12px 16px;background:${HEADER};border-radius:10px;border:1px solid #2a4030;">
      <div style="font-size:11px;font-weight:700;color:${MUTED};margin-bottom:8px;letter-spacing:.05em;">GAME RESULTS</div>
      <div style="font-size:13px;color:${CREAM};line-height:1.8;">${gameResults}</div>
    </div>` : ''}

    <!-- Footer -->
    <div style="margin-top:12px;text-align:center;font-size:10px;color:${MUTED};opacity:.5;">
      Generated by GolfWizard · golfwizard.net
    </div>
  </div>`

  return html
}

// ── Capture + Share ───────────────────────────────────────────────
async function captureAndShare(html, filename, text) {
  // Mount off-screen
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)
  const el = wrapper.firstElementChild

  try {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(el, {
      backgroundColor: '#0d1f12',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const file = new File([blob], filename, { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'GolfWizard Scorecard', text })
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }
  } finally {
    document.body.removeChild(wrapper)
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Share just the scorecard image.
 */
export async function shareScorecard(round, members, scores, course) {
  const html = buildScorecardHtml(round, members, scores, course, null)
  const filename = `${(round.course_name||'scorecard').replace(/\s+/g,'-')}-${round.date||'today'}.png`
  await captureAndShare(html, filename, `${round.course_name} scorecard`)
}

/**
 * Share scorecard + game settlement recap.
 * gameLines: array of plain-text settlement strings (built by caller from settlement data)
 */
export async function shareRecap(round, members, scores, course, gameLines) {
  const gameResultsHtml = (gameLines || []).map(l => `<div>${l}</div>`).join('')
  const html = buildScorecardHtml(round, members, scores, course, gameResultsHtml || null)
  const filename = `${(round.course_name||'recap').replace(/\s+/g,'-')}-${round.date||'today'}-recap.png`
  const text = `GolfWizard Recap · ${round.course_name}\n` + (gameLines||[]).join('\n')
  await captureAndShare(html, filename, text)
}
