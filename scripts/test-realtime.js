#!/usr/bin/env node
/**
 * Realtime sync test harness.
 *
 * What it does:
 *   1. Opens two Supabase clients against the same project (sharing the
 *      same signed-in user via a refresh token you supply).
 *   2. Client A creates a disposable round + adds a few members + games.
 *   3. Client B subscribes to realtime scores on that round.
 *   4. Client A writes scores for every hole; we measure per-score latency
 *      from write to realtime-receipt on Client B.
 *   5. Prints a pass/fail summary and cleans up the round.
 *
 * Usage:
 *   cd repo
 *   REFRESH_TOKEN="<your refresh token>" node scripts/test-realtime.js
 *
 * Getting a refresh token:
 *   On a signed-in browser session, open DevTools → Application → Local
 *   Storage → copy the value of `sb-<project>-auth-token` and take
 *   `currentSession.refresh_token` from the JSON.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mhzhdmsiliyfnijzddhu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oemhkbXNpbGl5Zm5panpkZGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQyODcsImV4cCI6MjA5MTQyMDI4N30.dKdXusJw_YqNtd5WEKm_qDyXbdfnKUGkxfDHBhXur3M'

const REFRESH_TOKEN = process.env.REFRESH_TOKEN
if (!REFRESH_TOKEN) {
  console.error('Set REFRESH_TOKEN env var. See comment at top of file for how to find it.')
  process.exit(1)
}

const LATENCY_BUDGET_MS = 3000  // we consider anything > this a failure

function makeClient(label) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
    global: { headers: { 'x-gw-test-client': label } },
  })
}

async function signIn(client) {
  const { data, error } = await client.auth.refreshSession({ refresh_token: REFRESH_TOKEN })
  if (error) throw new Error(`Auth failed: ${error.message}`)
  return data.session
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  console.log('🏌️  GolfWizard realtime sync test')
  console.log('─────────────────────────────────\n')

  const clientA = makeClient('A')
  const clientB = makeClient('B')

  console.log('Authenticating both clients…')
  const [sessA, sessB] = await Promise.all([signIn(clientA), signIn(clientB)])
  console.log(`  ✓ Client A signed in as ${sessA.user?.email || sessA.user?.id}`)
  console.log(`  ✓ Client B signed in as ${sessB.user?.email || sessB.user?.id}\n`)

  // ── Setup: Client A creates a test round ─────────────────────────
  console.log('Setting up test round (Client A)…')
  const { data: round, error: roundErr } = await clientA.from('rounds').insert({
    name: `[TEST-HARNESS] ${new Date().toISOString()}`,
    course_name: 'Bonnie Briar Country Club',
    tee: 'Blue',
    date: new Date().toISOString().slice(0, 10),
    holes_mode: '18',
    format: 'social',
    owner_id: sessA.user.id,
  }).select().single()
  if (roundErr) { console.error('Round insert failed:', roundErr); process.exit(1) }
  console.log(`  ✓ Round created: ${round.id}`)

  const memberRows = [
    { round_id: round.id, guest_name: 'Test A', short_name: 'TA', role: 'admin' },
    { round_id: round.id, guest_name: 'Test B', short_name: 'TB', role: 'player' },
  ]
  const { data: members, error: memErr } = await clientA.from('round_members').insert(memberRows).select()
  if (memErr) { console.error('Members insert failed:', memErr); process.exit(1) }
  console.log(`  ✓ ${members.length} members added\n`)

  // ── Client B subscribes to realtime on this round ──────────────
  console.log('Client B subscribing to scores…')
  const received = new Map() // hash(member_id|hole) -> { wroteAt, receivedAt }
  const subReady = new Promise((resolve) => {
    const channel = clientB
      .channel(`test:${round.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'scores',
        filter: `round_id=eq.${round.id}`,
      }, (payload) => {
        const s = payload.new
        if (!s) return
        const key = `${s.member_id}|${s.hole}`
        const entry = received.get(key)
        if (entry && !entry.receivedAt) {
          entry.receivedAt = Date.now()
          entry.score = s.score
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('  ✓ Client B subscribed\n')
          resolve()
        }
      })
    // If subscription doesn't become ready in 10s, give up and resolve anyway
    setTimeout(resolve, 10_000)
  })
  await subReady

  // ── Write scores on Client A and measure latency ───────────────
  console.log('Writing 20 scores on Client A (10 per member)…')
  const NUM_HOLES = 10
  const writePromises = []
  for (const m of members) {
    for (let h = 1; h <= NUM_HOLES; h++) {
      const key = `${m.id}|${h}`
      received.set(key, { wroteAt: Date.now(), receivedAt: null })
      writePromises.push(
        clientA.from('scores').upsert(
          { round_id: round.id, member_id: m.id, hole: h, score: 3 + (h % 4), entered_by: sessA.user.id },
          { onConflict: 'round_id,member_id,hole' },
        )
      )
    }
  }
  await Promise.all(writePromises)
  console.log('  ✓ All writes dispatched')

  console.log('\nWaiting up to 5s for Client B to receive all events…')
  const started = Date.now()
  while (Date.now() - started < 5000) {
    const missing = [...received.values()].filter(e => e.receivedAt == null).length
    if (missing === 0) break
    await sleep(100)
  }

  // ── Report ────────────────────────────────────────────────────
  const entries = [...received.values()]
  const delivered = entries.filter(e => e.receivedAt != null)
  const latencies = delivered.map(e => e.receivedAt - e.wroteAt)
  const p50 = latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)] || 0
  const p95 = latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || 0
  const maxL = latencies.length ? Math.max(...latencies) : 0

  console.log('\n─────────────────────────────────')
  console.log('📊  Results')
  console.log('─────────────────────────────────')
  console.log(`  Events sent:       ${entries.length}`)
  console.log(`  Events received:   ${delivered.length}`)
  console.log(`  Delivery rate:     ${((delivered.length / entries.length) * 100).toFixed(1)}%`)
  if (delivered.length) {
    console.log(`  Latency p50:       ${p50}ms`)
    console.log(`  Latency p95:       ${p95}ms`)
    console.log(`  Latency max:       ${maxL}ms`)
  }

  let status = 'PASS'
  const reasons = []
  if (delivered.length < entries.length) {
    status = 'FAIL'
    reasons.push(`only ${delivered.length}/${entries.length} events delivered`)
  }
  if (p95 > LATENCY_BUDGET_MS) {
    status = 'FAIL'
    reasons.push(`p95 latency ${p95}ms > ${LATENCY_BUDGET_MS}ms budget`)
  }

  console.log(`\n  ${status === 'PASS' ? '✅' : '❌'}  ${status}`)
  if (reasons.length) reasons.forEach(r => console.log(`      · ${r}`))

  // ── Cleanup ────────────────────────────────────────────────────
  console.log('\nCleaning up test round…')
  await clientA.from('scores').delete().eq('round_id', round.id)
  await clientA.from('round_members').delete().eq('round_id', round.id)
  await clientA.from('rounds').delete().eq('id', round.id)
  console.log('  ✓ Cleaned up\n')

  process.exit(status === 'PASS' ? 0 : 1)
}

run().catch(e => {
  console.error('Harness crashed:', e)
  process.exit(1)
})
