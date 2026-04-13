<template>
  <div class="view home-view">
    <header class="view-header">
      <div class="header-logo-group">
        <div class="header-logo">⛳ GolfWizard</div>
        <div class="header-version">v{{ appVersion }}</div>
      </div>
      <div class="header-actions">
        <button v-if="!authStore.isAuthenticated" class="btn-signin" @click="showAuth = true">
          Sign In
        </button>
        <RouterLink v-else to="/settings" class="avatar-btn">
          {{ authStore.profile?.short_name?.[0] ?? authStore.profile?.display_name?.[0] ?? '👤' }}
        </RouterLink>
      </div>
    </header>

    <!-- Active round card -->
    <div v-if="roundsStore.activeRound" class="active-round-card card" @click="$router.push('/scoring')">
      <div class="card-label">In Progress</div>
      <div class="card-title">{{ roundsStore.activeRound.course_name }}</div>
      <div class="card-sub">{{ roundsStore.activeRound.date }} · {{ roundsStore.activeMembers.length }} players</div>
      <div class="card-cta">Continue →</div>
    </div>


    <!-- Recent rounds -->
    <section v-if="roundsStore.rounds.length" class="section">
      <h2 class="section-title">Recent Rounds</h2>
      <div class="rounds-list">
        <div
          v-for="round in roundsStore.rounds.slice(0, 5)"
          :key="round.id"
          class="round-card card"
          @click="openRound(round.id)"
        >
          <div class="round-course">{{ round.course_name }}</div>
          <div class="round-meta">{{ round.date }} · {{ round.round_members?.length ?? 0 }} players</div>
          <div v-if="round.room_code" class="round-code">🔗 {{ round.room_code }}</div>
        </div>
      </div>
    </section>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-icon">⛳</div>
      <div class="empty-title">No rounds yet</div>
      <div class="empty-sub">Tap <strong>New Round</strong> to get started</div>
    </div>

    <!-- Auth modal -->
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import AuthModal from '../components/AuthModal.vue'

const appVersion = __APP_VERSION__

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const router = useRouter()
const showAuth = ref(false)

onMounted(async () => {
  if (authStore.isAuthenticated) await roundsStore.fetchRounds()
})

// Auth might not be restored yet when onMounted fires (async session init).
// Watch for isAuthenticated becoming true and fetch rounds if we haven't yet.
watch(() => authStore.isAuthenticated, async (authed) => {
  if (authed && roundsStore.rounds.length === 0) {
    await roundsStore.fetchRounds()
  }
})

async function openRound(id) {
  await roundsStore.loadRound(id)
  router.push('/scoring')
}
</script>
