#!/usr/bin/env node
/**
 * GolfWizard deploy script — build, commit, push. That's it.
 * GitHub Actions handles the actual Pages deployment.
 * No polling, no hanging, Ctrl+C always works.
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

process.on('SIGINT',  () => { console.log('\n🛑 Interrupted.'); process.exit(1) })
process.on('SIGTERM', () => { console.log('\n🛑 Terminated.'); process.exit(1) })

// Always resolve git root relative to this script — works regardless of cwd
const __dirname = dirname(fileURLToPath(import.meta.url))
const GIT_ROOT = resolve(__dirname, '..')   // src/ is one level up from scripts/

if (!existsSync(resolve(GIT_ROOT, '.git'))) {
  console.error(`\n❌ No .git found at ${GIT_ROOT}`)
  console.error('   Run deploy from the Desktop copy, not the iCloud copy.')
  process.exit(1)
}

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: GIT_ROOT, ...opts })
}

// 0. Remove stale lock files and pull latest from remote
const headLock = resolve(GIT_ROOT, '.git/HEAD.lock')
const indexLock = resolve(GIT_ROOT, '.git/index.lock')
const origHeadLock = resolve(GIT_ROOT, '.git/ORIG_HEAD.lock')
for (const [label, p] of [['HEAD.lock', headLock], ['index.lock', indexLock], ['ORIG_HEAD.lock', origHeadLock]]) {
  if (existsSync(p)) {
    try { unlinkSync(p); console.log(`🔓 Removed stale ${label}`) }
    catch { console.warn(`⚠️  Could not remove ${label} — delete manually if pull fails`) }
  }
}

console.log('\n━━━ Syncing with remote… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
try {
  run('git pull --rebase --autostash origin main')
} catch (e) {
  console.error('❌ Pull/rebase failed — resolve conflicts manually, then re-run deploy.')
  process.exit(1)
}

// 1. Bump patch version
const pkgPath = resolve(GIT_ROOT, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const parts = pkg.version.split('.').map(Number)
parts[2] += 1
pkg.version = parts.join('.')
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`📦 Version bumped to ${pkg.version}`)

// 2. Build
console.log('\n━━━ Building… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
run('npm run build')

// 3. Commit + push
console.log('\n━━━ Committing & pushing… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
try {
  run('git add -A')
  run(`git commit -m "v${pkg.version}: deploy"`)
} catch (e) {
  console.log('Nothing new to commit — pushing existing HEAD.')
}
run('git push origin HEAD:main')

console.log(`\n✅ Done — v${pkg.version} pushed. GitHub Actions will deploy in ~30s.`)
console.log(`   Check: https://github.com/k269x9xzcd-bot/golfwizard/actions`)
