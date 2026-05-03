// Simulate today's two tournament matches (2026-05-03)
// Match 1 (Foursome 1): Team Marty/Shang vs Team Spieler/Matt — 1v1: Marty v Spieler, Shang v Matt
// Match 2 (Foursome 2): Team Brian/Alex vs Team Jeremy/Chris  — 1v1: Brian v Jeremy, Alex v Chris
// Course: Bonnie Briar Blue — slope 140, rating 71.7, par 71

// ── Course data ─────────────────────────────────────────────────
const COURSE = {
  slope: 140, rating: 71.7,
  par:  [4,4,3,4,3,4,4,4,5, 3,4,4,4,4,3,5,5,4],
  si:   [4,12,18,10,14,2,16,6,8, 13,3,9,1,11,17,7,5,15],
}
const totalPar = COURSE.par.reduce((a,b)=>a+b,0) // 71

// ── Course handicap ──────────────────────────────────────────────
function courseHcp(ghin) {
  return Math.round(ghin * (140/113) + (71.7 - 71))
}

// ── Strokes on a hole ────────────────────────────────────────────
function strokesOnHole(hcp, si) {
  const base = Math.floor(hcp / 18)
  const extra = hcp % 18
  return base + (si <= extra ? 1 : 0)
}

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────
function makePRNG(seed) {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Normal distribution via Box-Muller
function normal(rng) {
  const u = 1 - rng(), v = rng()
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v)
}

// ── Simulate one player's 18-hole round ─────────────────────────
// Returns array of 18 gross scores, hole-by-hole
function simulateRound(ghin, rng) {
  const hcp = courseHcp(ghin)
  const scores = []
  for (let h = 0; h < 18; h++) {
    const par = COURSE.par[h]
    const si  = COURSE.si[h]
    const strokes = strokesOnHole(hcp, si)
    // Target net = par. Simulate with stddev ~0.9 strokes/hole.
    // Birdie probability ~15%, double bogey+ is rarer for lower hdcp.
    const raw = par + strokes + normal(rng) * 0.95
    let gross = Math.max(par - 1, Math.round(raw)) // floor at birdie (no eagles in sim)
    if (gross > par + 3) gross = par + 3            // cap at triple
    scores.push(gross)
  }
  return scores
}

// ── 1v1 Match Play (match play, net) ────────────────────────────
function match1v1(p1, p2) {
  // p1, p2: { name, hcp, scores[] }
  let standing = 0 // positive = p1 up
  const holeLog = []
  for (let h = 0; h < 18; h++) {
    const si   = COURSE.si[h]
    const net1 = p1.scores[h] - strokesOnHole(p1.hcp, si)
    const net2 = p2.scores[h] - strokesOnHole(p2.hcp, si)
    const holesLeft = 17 - h
    let result
    if      (net1 < net2) { standing++; result = `${p1.name} wins` }
    else if (net2 < net1) { standing--; result = `${p2.name} wins` }
    else                  { result = 'Halved' }
    holeLog.push({ hole: h+1, net1, net2, result })
    // Closeout: if lead > holes remaining
    if (Math.abs(standing) > holesLeft) break
  }
  const holesPlayed = holeLog.length
  const winner = standing > 0 ? p1.name : standing < 0 ? p2.name : null
  const margin = Math.abs(standing)
  const holesLeft = 18 - holesPlayed
  return { winner, margin, holesLeft, standing, holeLog }
}

// ── 2BB Best Ball (net) ──────────────────────────────────────────
function bestBall2v2(t1, t2) {
  // t1/t2: [playerA, playerB]
  let t1Holes = 0, t2Holes = 0
  const holeLog = []
  for (let h = 0; h < 18; h++) {
    const si = COURSE.si[h]
    const t1Nets = t1.map(p => p.scores[h] - strokesOnHole(p.hcp, si))
    const t2Nets = t2.map(p => p.scores[h] - strokesOnHole(p.hcp, si))
    const t1BB = Math.min(...t1Nets)
    const t2BB = Math.min(...t2Nets)
    let result
    if      (t1BB < t2BB) { t1Holes++; result = 'T1' }
    else if (t2BB < t1BB) { t2Holes++; result = 'T2' }
    else                  { result = 'Halved' }
    holeLog.push({ hole: h+1, t1Nets, t2Nets, t1BB, t2BB, result })
  }
  const winner = t1Holes > t2Holes ? 't1' : t2Holes > t1Holes ? 't2' : 'halved'
  return { t1Holes, t2Holes, winner, holeLog }
}

// ── Run simulation ───────────────────────────────────────────────
const rng = makePRNG(20260503) // seeded with today's date

// Player GHIN indexes from roster
const PLAYERS = {
  Spieler: { name: 'Spieler', ghin: 9.8 },
  Matt:    { name: 'Matt',    ghin: 6.6 },
  Marty:   { name: 'Marty',   ghin: 8.3 },
  Shang:   { name: 'Shang',   ghin: 5.8 },
  Brian:   { name: 'Brian',   ghin: 6.3 },
  Alex:    { name: 'Alex',    ghin: 3.7 },
  Jeremy:  { name: 'Jeremy',  ghin: 4.6 },
  Chris:   { name: 'Chris',   ghin: 4.5 },
}

for (const p of Object.values(PLAYERS)) {
  p.hcp    = courseHcp(p.ghin)
  p.scores = simulateRound(p.ghin, rng)
  p.gross  = p.scores.reduce((a,b)=>a+b,0)
  p.net    = p.gross - p.hcp
}

function scorecard(p) {
  const front = p.scores.slice(0,9).reduce((a,b)=>a+b,0)
  const back  = p.scores.slice(9).reduce((a,b)=>a+b,0)
  return `  ${p.name.padEnd(8)} HCP ${String(p.hcp).padStart(2)}  F:${front}  B:${back}  Gross:${p.gross}  Net:${p.net}`
}

console.log('═══════════════════════════════════════════════════════')
console.log('   GOLFWIZARD TOURNAMENT SIMULATION — 2026-05-03')
console.log('   Bonnie Briar Country Club · Blue tees · Par 71')
console.log('═══════════════════════════════════════════════════════\n')

// ── MATCH 1 ──────────────────────────────────────────────────────
console.log('MATCH 1: Marty/Shang  vs  Spieler/Matt')
console.log('─────────────────────────────────────────────────────')
console.log('Scorecards:')
for (const name of ['Marty','Shang','Spieler','Matt']) console.log(scorecard(PLAYERS[name]))

const m1BB = bestBall2v2([PLAYERS.Marty, PLAYERS.Shang], [PLAYERS.Spieler, PLAYERS.Matt])
const m1_1v1a = match1v1(PLAYERS.Marty, PLAYERS.Spieler)
const m1_1v1b = match1v1(PLAYERS.Shang, PLAYERS.Matt)

console.log('\n2BB Best Ball (2 pts):')
console.log(`  Marty/Shang won ${m1BB.t1Holes} holes — Spieler/Matt won ${m1BB.t2Holes} holes`)
const bbWinner1 = m1BB.winner === 't1' ? 'Marty/Shang ✓  (2 pts)' : m1BB.winner === 't2' ? 'Spieler/Matt ✓  (2 pts)' : 'Halved  (1 pt each)'
console.log(`  Result: ${bbWinner1}`)

console.log('\n1v1 Singles (1 pt each):')
const fmt1v1 = (r, p1, p2) => r.winner
  ? `  ${p1} vs ${p2}: ${r.winner} wins ${r.margin}&${r.holesLeft}`
  : `  ${p1} vs ${p2}: Halved`
console.log(fmt1v1(m1_1v1a, 'Marty', 'Spieler'))
console.log(fmt1v1(m1_1v1b, 'Shang', 'Matt'))

// Compute points
const m1T1pts = (m1BB.winner==='t1'?2:m1BB.winner==='halved'?1:0)
              + (m1_1v1a.winner===PLAYERS.Marty.name?1:m1_1v1a.winner===null?0.5:0)
              + (m1_1v1b.winner===PLAYERS.Shang.name?1:m1_1v1b.winner===null?0.5:0)
const m1T2pts = 4 - m1T1pts

console.log('\nMatch 1 Points:')
console.log(`  Marty/Shang:  ${m1T1pts} pts`)
console.log(`  Spieler/Matt: ${m1T2pts} pts`)

// ── MATCH 2 ──────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════')
console.log('MATCH 2: Brian/Alex  vs  Jeremy/Chris')
console.log('─────────────────────────────────────────────────────')
console.log('Scorecards:')
for (const name of ['Brian','Alex','Jeremy','Chris']) console.log(scorecard(PLAYERS[name]))

const m2BB = bestBall2v2([PLAYERS.Brian, PLAYERS.Alex], [PLAYERS.Jeremy, PLAYERS.Chris])
const m2_1v1a = match1v1(PLAYERS.Brian, PLAYERS.Jeremy)
const m2_1v1b = match1v1(PLAYERS.Alex, PLAYERS.Chris)

console.log('\n2BB Best Ball (2 pts):')
console.log(`  Brian/Alex won ${m2BB.t1Holes} holes — Jeremy/Chris won ${m2BB.t2Holes} holes`)
const bbWinner2 = m2BB.winner === 't1' ? 'Brian/Alex ✓  (2 pts)' : m2BB.winner === 't2' ? 'Jeremy/Chris ✓  (2 pts)' : 'Halved  (1 pt each)'
console.log(`  Result: ${bbWinner2}`)

console.log('\n1v1 Singles (1 pt each):')
console.log(fmt1v1(m2_1v1a, 'Brian', 'Jeremy'))
console.log(fmt1v1(m2_1v1b, 'Alex', 'Chris'))

const m2T1pts = (m2BB.winner==='t1'?2:m2BB.winner==='halved'?1:0)
              + (m2_1v1a.winner===PLAYERS.Brian.name?1:m2_1v1a.winner===null?0.5:0)
              + (m2_1v1b.winner===PLAYERS.Alex.name?1:m2_1v1b.winner===null?0.5:0)
const m2T2pts = 4 - m2T1pts

console.log('\nMatch 2 Points:')
console.log(`  Brian/Alex:   ${m2T1pts} pts`)
console.log(`  Jeremy/Chris: ${m2T2pts} pts`)

// ── Hole-by-hole detail for 2BB ──────────────────────────────────
function printBBDetail(label, result, p1a, p1b, p2a, p2b) {
  console.log(`\n${label} — Hole-by-hole 2BB`)
  console.log(`${'H'.padStart(3)} ${'Par'.padStart(3)} ${'SI'.padStart(3)}  ${p1a.padEnd(6)} ${p1b.padEnd(6)} ${' BB'.padEnd(5)}  ${p2a.padEnd(6)} ${p2b.padEnd(6)} ${' BB'.padEnd(5)}  Winner`)
  for (const h of result.holeLog) {
    const par = COURSE.par[h.hole-1]
    const si  = COURSE.si[h.hole-1]
    const t1  = h.t1Nets.map((n,i)=>`${n>=0?'+':''}${n}`).join('/')
    const t2  = h.t2Nets.map((n,i)=>`${n>=0?'+':''}${n}`).join('/')
    const t1bb = `${h.t1BB>=0?'+':''}${h.t1BB}`
    const t2bb = `${h.t2BB>=0?'+':''}${h.t2BB}`
    const w   = h.result==='Halved'? '—' : h.result==='T1' ? `${p1a}/${p1b}` : `${p2a}/${p2b}`
    console.log(`${String(h.hole).padStart(3)} ${String(par).padStart(3)} ${String(si).padStart(3)}  ${t1.padEnd(9)} ${t1bb.padEnd(5)}  ${t2.padEnd(9)} ${t2bb.padEnd(5)}  ${w}`)
  }
}

console.log('\n\n── DETAILED HOLE-BY-HOLE ──────────────────────────────────')
printBBDetail('MATCH 1 2BB', m1BB, 'Marty', 'Shang', 'Spieler', 'Matt')
printBBDetail('MATCH 2 2BB', m2BB, 'Brian', 'Alex', 'Jeremy', 'Chris')
