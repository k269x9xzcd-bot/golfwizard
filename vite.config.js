import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const BUILD_TS = Date.now()
const BUILD_STAMP = `${pkg.version}-${BUILD_TS}`

// Plugin to stamp the build version into sw.js after build
// Also writes a _version.json file to dist/ for post-deploy validation
function stampServiceWorker() {
  return {
    name: 'stamp-sw',
    closeBundle() {
      const distPath = resolve('./dist')

      // Stamp sw.js
      const swPath = resolve(distPath, 'sw.js')
      try {
        let sw = readFileSync(swPath, 'utf-8')
        sw = sw.replace('__BUILD_VERSION__', BUILD_STAMP)
        writeFileSync(swPath, sw)
      } catch (e) {
        console.warn('Could not stamp sw.js:', e.message)
      }

      // Write a version manifest — used by deploy validation
      try {
        mkdirSync(distPath, { recursive: true })
        const versionPath = resolve(distPath, '_version.json')
        writeFileSync(versionPath, JSON.stringify({
          version: pkg.version,
          stamp: BUILD_STAMP,
          builtAt: new Date(BUILD_TS).toISOString(),
        }, null, 2))
        console.log(`\n✅ Build stamped: ${BUILD_STAMP}\n`)
      } catch (e) {
        console.warn('Could not write _version.json:', e.message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), stampServiceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  // Set base to repo name for GitHub Pages — update if your repo is named differently
  // e.g. if hosted at jtspieler.github.io/GolfWizard set base: '/GolfWizard/'
  // For a custom domain (golfwizard.app) set base: '/'
  base: '/golfwizard/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
