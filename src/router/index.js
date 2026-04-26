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
  { path: '/player-courses', name: 'player-courses', component: () => import('../views/PlayerCoursesView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/library',  name: 'library',  component: () => import('../views/GameLibraryView.vue') },
  { path: '/metrics',  name: 'metrics',  component: () => import('../views/MetricsView.vue') },
  { path: '/join/:code?',    name: 'join',       component: () => import('../views/JoinView.vue') },
  { path: '/tournament',     name: 'tournament', component: () => import('../views/TournamentView.vue') },
  { path: '/cross-match/new', name: 'cross-match-new', component: () => import('../views/LinkedMatchSetup.vue') },
  { path: '/accept/:code',    name: 'cross-match-accept', component: () => import('../views/LinkedMatchAccept.vue') },
  { path: '/cross-match/:id', name: 'cross-match-detail', component: () => import('../views/LinkedMatchDetail.vue') },
  { path: '/invite',          name: 'invite',             component: () => import('../views/InviteWelcome.vue') },
  { path: '/watch/:id',       name: 'watch',              component: () => import('../views/WatchView.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// If a lazy-loaded chunk fails (stale cache after redeploy), force a hard reload.
// This clears the cached old JS and picks up the latest build from the server.
// We track whether we already tried reloading to avoid an infinite loop.
router.onError((err) => {
  const isChunkError =
    err?.message?.includes('Failed to fetch dynamically imported module') ||
    err?.message?.includes('Importing a module script failed') ||
    err?.message?.includes('Unable to preload CSS') ||
    err?.code === 'MODULE_NOT_FOUND'
  if (isChunkError) {
    const alreadyReloaded = sessionStorage.getItem('gw_chunk_reload')
    if (!alreadyReloaded) {
      sessionStorage.setItem('gw_chunk_reload', '1')
      window.location.reload()
    } else {
      // Already reloaded once — just go home to avoid loop
      sessionStorage.removeItem('gw_chunk_reload')
      router.push('/')
    }
  }
})
