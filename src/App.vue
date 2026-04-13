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

      <!-- Bottom nav -->
      <nav class="bottom-nav">
        <RouterLink to="/" class="nav-item" :class="{ active: $route.name === 'home' }">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </RouterLink>
        <RouterLink to="/scoring" class="nav-item" :class="{ active: $route.name === 'scoring' }">
          <span class="nav-icon">🏌️</span>
          <span class="nav-label">Score</span>
        </RouterLink>
        <button class="nav-new" @click="showWizard = true">
          <span class="nav-plus">＋</span>
          <span class="nav-plus-label">New</span>
        </button>
        <RouterLink to="/courses" class="nav-item" :class="{ active: $route.name === 'courses' }">
          <span class="nav-icon">⛳</span>
          <span class="nav-label">Courses</span>
        </RouterLink>
        <RouterLink to="/players" class="nav-item" :class="{ active: $route.name === 'players' }">
          <span class="nav-icon">👥</span>
          <span class="nav-label">Players</span>
        </RouterLink>
        <RouterLink v-if="showTournament" to="/tournament" class="nav-item nav-item--cup" :class="{ active: $route.name === 'tournament' }">
          <span class="nav-icon">🏆</span>
          <span class="nav-label">Cup</span>
        </RouterLink>
        <RouterLink v-else to="/history" class="nav-item" :class="{ active: $route.name === 'history' }">
          <span class="nav-icon">🕐</span>
          <span class="nav-label">History</span>
        </RouterLink>
      </nav>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterView, RouterLink, useRouter } from 'vue-router'
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

const showTournament = computed(() => hasTournamentAccess(authStore.user?.email))

const showWizard = ref(false)
const showJoin = ref(false)

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
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('launchWizard') === '1') {
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
