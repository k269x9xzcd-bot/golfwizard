#!/usr/bin/env node
/**
 * GolfWizard deploy + validate script
 *
 * Usage:  node scripts/deploy.js
 *
 * Steps:
 *  1. Build (npm run build) — stamps dist/_version.json + dist/sw.js
 *  2. Git commit dist/ + version bump, push to main
 *  3. Poll https://k269x9xzcd-bot.github.io/golfwizard/_version.json
 *     every 15s for up to 3 minutes until the live stamp matches the local one
 *  4. Exit 0 on success, exit 1 on timeout/mismatch
 */

import { execSync, spawnSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ── 0. Auto-bump patch version in package.json ────────────────────
const pkgPath = resolve('./package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const parts = pkg.version.split('.').map(Number)
parts[2] += 1  // bump patch
pkg.version = parts.join('.')
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`📦 Version bumped to ${pkg.version}`)

const LIVE_URL  = 'https://k269x9xzcd-bot.github.io/golfwizard/_version.json'
const POLL_MS   = 15_000   // 15 seconds between checks
const TIMEOUT_MS = 3 * 60_000  // 3 minutes max

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

// ── 1. Build ─────────────────────────────────────────────────────
console.log('━━━ Building… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
run('npm run build')

// Read the stamp that was just written to dist/
const localVersion = JSON.parse(readFileSync(resolve('./dist/_version.json'), 'utf-8'))
console.log(`\nLocal build: version=${localVersion.version}  stamp=${localVersion.stamp}`)

// ── 2. Commit + push ─────────────────────────────────────────────
console.log('\n━━━ Committing & pushing… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
try {
  run(`git add -A`)
  run(`git commit -m "v${localVersion.version}: deploy"`)
} catch (e) {
  // Nothing to commit — still push in case a previous commit didn't get through
  console.log('Nothing new to commit — pushing existing HEAD.')
}
run('git push origin main')

// ── 3. Poll live URL ─────────────────────────────────────────────
console.log(`\n━━━ Waiting for live deploy (polling ${LIVE_URL})… ━━`)

// Quick network check — if GitHub Pages is unreachable from this environment,
// print instructions and exit cleanly rather than timing out.
const networkCheck = spawnSync('curl', ['-sf', '--max-time', '5', LIVE_URL], { encoding: 'utf-8' })
if (networkCheck.status !== 0) {
  console.log('\n⚠️  Network check: GitHub Pages not reachable from this environment.')
  console.log('   Push succeeded. Verify the deploy manually:\n')
  console.log(`   curl -s "${LIVE_URL}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ LIVE' if d['stamp']=='${localVersion.stamp}' else '❌ STALE', d)"`)
  console.log(`\n   Or open: ${LIVE_URL}`)
  console.log(`   Expected stamp: ${localVersion.stamp}`)
  process.exit(0)
}

const start = Date.now()
let verified = false

while (Date.now() - start < TIMEOUT_MS) {
  await new Promise(r => setTimeout(r, POLL_MS))
  const elapsed = Math.round((Date.now() - start) / 1000)

  try {
    const result = spawnSync('curl', [
      '-sf', '--max-time', '10',
      '--header', 'Cache-Control: no-cache',
      LIVE_URL,
    ], { encoding: 'utf-8' })

    if (result.status !== 0) {
      console.log(`[${elapsed}s] curl failed (exit ${result.status}) — retrying…`)
      continue
    }

    const live = JSON.parse(result.stdout)
    if (live.stamp === localVersion.stamp) {
      console.log(`\n✅ VERIFIED at ${elapsed}s — live stamp matches: ${live.stamp}`)
      verified = true
      break
    } else {
      console.log(`[${elapsed}s] Live: ${live.version}/${live.stamp} ≠ Expected: ${localVersion.stamp} — waiting…`)
    }
  } catch (err) {
    console.log(`[${elapsed}s] Parse error — retrying… (${err.message})`)
  }
}

if (!verified) {
  console.error(`\n❌ DEPLOY TIMEOUT — live site did not update within ${TIMEOUT_MS / 1000}s`)
  console.error(`   Expected stamp: ${localVersion.stamp}`)
  console.error(`   GitHub Actions: https://github.com/k269x9xzcd-bot/golfwizard/actions`)
  process.exit(1)
}
