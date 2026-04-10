import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/',         name: 'home',     component: () => import('../views/HomeView.vue') },
  { path: '/scoring',  name: 'scoring',  component: () => import('../views/ScoringView.vue') },
  { path: '/games',    name: 'games',    component: () => import('../views/GamesView.vue') },
  { path: '/history',  name: 'history',  component: () => import('../views/HistoryView.vue') },
  { path: '/players',  name: 'players',  component: () => import('../views/PlayersView.vue') },
  { path: '/courses',  name: 'courses',  component: () => import('../views/CoursesView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/join/:code?', name: 'join',  component: () => import('../views/JoinView.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
