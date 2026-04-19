#!/usr/bin/env node
/**
 * GolfWizard deploy script — build, commit, push. That's it.
 * GitHub Actions handles the actual Pages deployment.
 * No polling, no hanging, Ctrl+C always works.
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

process.on('SIGINT',  () => { console.log('\n🛑 Interrupted.'); process.exit(1) })
process.on('SIGTERM', () => { console.log('\n🛑 Terminated.'); process.exit(1) })

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

// 1. Bump patch version
const pkgPath = resolve('./package.json')
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
run('git push origin main')

console.log(`\n✅ Done — v${pkg.version} pushed. GitHub Actions will deploy in ~30s.`)
console.log(`   Check: https://github.com/k269x9xzcd-bot/golfwizard/actions`)
