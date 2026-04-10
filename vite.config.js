import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Set base to repo name for GitHub Pages — update if your repo is named differently
  // e.g. if hosted at jtspieler.github.io/GolfWizard set base: '/GolfWizard/'
  // For a custom domain (golfwizard.app) set base: '/'
  base: '/GolfWizard/',
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
