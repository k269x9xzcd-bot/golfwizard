import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// Plugin to stamp the build version into sw.js after build
function stampServiceWorker() {
  return {
    name: 'stamp-sw',
    closeBundle() {
      const swPath = resolve('./dist/sw.js')
      try {
        let sw = readFileSync(swPath, 'utf-8')
        // Replace the placeholder with the actual version + timestamp for uniqueness
        const stamp = `${pkg.version}-${Date.now()}`
        sw = sw.replace('__BUILD_VERSION__', stamp)
        writeFileSync(swPath, sw)
      } catch (e) {
        console.warn('Could not stamp sw.js:', e.message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), stampServiceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
