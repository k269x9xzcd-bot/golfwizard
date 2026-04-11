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
      <WizardOverlay v-if="showWizard" @close="showWizard = false" @created="onRoundCreated" />

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
          <span class="nav-icon">📋</span>
          <span class="nav-label">Score</span>
        </RouterLink>
        <button class="nav-item nav-new" @click="showWizard = true">
          <span class="nav-icon nav-plus">＋</span>
          <span class="nav-label">New Round</span>
        </button>
        <RouterLink to="/games" class="nav-item" :class="{ active: $route.name === 'games' }">
          <span class="nav-icon">🎮</span>
          <span class="nav-label">Games</span>
        </RouterLink>
        <RouterLink to="/history" class="nav-item" :class="{ active: $route.name === 'history' }">
          <span class="nav-icon">📊</span>
          <span class="nav-label">History</span>
        </RouterLink>
      </nav>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useRosterStore } from './stores/roster'
import { useCoursesStore } from './stores/courses'
import WizardOverlay from './components/WizardOverlay.vue'
import JoinOverlay from './components/JoinOverlay.vue'

const authStore = useAuthStore()
const rosterStore = useRosterStore()
const coursesStore = useCoursesStore()
const router = useRouter()

const showWizard = ref(false)
const showJoin = ref(false)

onMounted(async () => {
  try {
    await authStore.init()
  } catch (e) {
    console.warn('Auth init failed:', e)
  }

  // Run one-time migrations after auth
  if (authStore.isAuthenticated) {
    try {
      await Promise.all([
        rosterStore.migrateFromLocalStorage(),
        coursesStore.migrateFromLocalStorage(),
      ])
    } catch (e) {
      console.warn('Migration error:', e)
    }
  }

  // Load data — failures here should never crash the app
  try {
    await Promise.all([
      rosterStore.fetchPlayers(),
      coursesStore.fetchCustomCourses(),
    ])
  } catch (e) {
    console.warn('Data load error:', e)
  }

  // Handle deep-link room code join (e.g. golfwizard.app/#/join/ABC123)
  const hash = window.location.hash
  const joinMatch = hash.match(/\/join\/([A-Z0-9]{6})/i)
  if (joinMatch) {
    showJoin.value = true
  }
})

function onRoundCreated(round) {
  showWizard.value = false
  router.push('/scoring')
}
</script>
