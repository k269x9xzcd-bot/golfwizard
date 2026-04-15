<template>
  <div id="golfwizard-app" :class="{ 'guest-mode': authStore.isGuest }">

    <!-- Loading splash -->
    <div v-if="authStore.loading" class="splash">
      <div class="splash-logo">⛳ GolfWizard</div>
      <div class="splash-spinner"></div>
    </div>

    <!-- Main app -->
    <template v-else>
      <!-- Wizard overlay for creating a new round -->
      <WizardOverlay v-if="showWizard" @close="showWizard = false" @created="onRoundCreated" @setup-course="onSetupCourse" />

      <!-- Join by room code overlay -->
      <JoinOverlay v-if="showJoin" @close="showJoin = false" />

      <!-- Main content -->
      <div class="app-container">
        <RouterView />
      </div>

      <!-- Bottom nav — hidden when wizard is open or on full-screen wizard routes -->
      <nav
        v-if="!showWizard && !isWizardRoute"
        class="bottom-nav"
      >
        <!-- 5 equal nav items -->
        <RouterLink to="/" class="nav-item" :class="{ active: $route.name === 'home' }">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </RouterLink>
        <RouterLink to="/scoring" class="nav-item" :class="{ active: $route.name === 'scoring' }">
          <span class="nav-icon">🏌️</span>
          <span class="nav-label">Score</span>
        </RouterLink>
        <RouterLink to="/courses" class="nav-item" :class="{ active: $route.name === 'courses' }">
          <span class="nav-icon">⛳</span>
          <span class="nav-label">Courses</span>
        </RouterLink>
        <RouterLink to="/players" class="nav-item" :class="{ active: $route.name === 'players' }">
          <span class="nav-icon">👥</span>
          <span class="nav-label">Players</span>
        </RouterLink>
        <RouterLink to="/history" class="nav-item" :class="{ active: $route.name === 'history' }">
          <span class="nav-icon">📋</span>
          <span class="nav-label">History</span>
        </RouterLink>
      </nav>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useRosterStore } from './stores/roster'
import { useCoursesStore } from './stores/courses'
import { hasTournamentAccess } from './stores/tournament.js'
import WizardOverlay from './components/WizardOverlay.vue'
import JoinOverlay from './components/JoinOverlay.vue'

const authStore = useAuthStore()
const rosterStore = useRosterStore()
const coursesStore = useCoursesStore()
const router = useRouter()
const route = useRoute()

const showTournament = computed(() => hasTournamentAccess(authStore.user?.email))

// Routes that are full-screen wizard-like flows — hide the bottom nav
const WIZARD_ROUTES = new Set(['cross-match-new', 'cross-match-accept', 'cross-match-detail'])
const isWizardRoute = computed(() => WIZARD_ROUTES.has(route.name))

const showWizard = ref(false)
const showJoin = ref(false)

provide('openWizard', () => { showWizard.value = true })

onMounted(async () => {
  try { await authStore.init() } catch (e) { console.warn('Auth init failed:', e) }

  if (authStore.isAuthenticated) {
    try {
      await Promise.all([
        rosterStore.migrateFromLocalStorage(),
        coursesStore.migrateFromLocalStorage(),
      ])
    } catch (e) { console.warn('Migration error:', e) }
  }

  try {
    await Promise.all([
      rosterStore.fetchPlayers(),
      coursesStore.fetchCustomCourses(),
    ])
  } catch (e) { console.warn('Data load error:', e) }

  const hash = window.location.hash
  const joinMatch = hash.match(/\/join\/([A-Z0-9]{6})/i)
  if (joinMatch) showJoin.value = true

  // Auto-launch wizard if navigated from tournament match
  // Use Vue Router's parsed query (works with hash history) instead of window.location.search
  if (router.currentRoute.value.query.launchWizard === '1') {
    showWizard.value = true
    // Clean URL
    router.replace({ query: {} })
  }
})

function onRoundCreated(round) {
  showWizard.value = false
  router.push('/scoring')
}

function onSetupCourse(courseName, apiId) {
  showWizard.value = false
  // Navigate to courses view with pre-fill query param
  const query = { add: courseName }
  if (apiId) query.apiId = apiId
  router.push({ path: '/courses', query })
}
</script>
