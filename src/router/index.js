import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

// HomeView is imported statically so it's always in the main bundle —
// never a stale lazy-loaded chunk that breaks after a redeploy.
const routes = [
  { path: '/',         name: 'home',     component: HomeView },
  { path: '/scoring',  name: 'scoring',  component: () => import('../views/ScoringView.vue') },
  { path: '/games',    name: 'games',    component: () => import('../views/GamesView.vue') },
  { path: '/history',  name: 'history',  component: () => import('../views/HistoryView.vue') },
  { path: '/players',  name: 'players',  component: () => import('../views/PlayersView.vue') },
  { path: '/courses',  name: 'courses',  component: () => import('../views/CoursesView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/library',  name: 'library',  component: () => import('../views/GameLibraryView.vue') },
  { path: '/join/:code?', name: 'join',  component: () => import('../views/JoinView.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// If a lazy-loaded chunk fails (stale cache after redeploy), navigate home.
// HomeView is statically bundled so it always works even with stale cache.
router.onError((err) => {
  if (err?.message?.includes('Failed to fetch dynamically imported module') ||
      err?.message?.includes('Importing a module script failed')) {
    router.push('/')
  }
})
