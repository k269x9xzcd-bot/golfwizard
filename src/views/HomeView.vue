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

    <button v-if="roundsStore.activeRound || roundsStore.rounds.length" class="new-round-pill" @click="openWizard()">+ New Round</button>

    <!-- Tournament / Cup entry card (only for authorized users) -->
    <RouterLink v-if="showTournament" to="/tournament" class="cup-home-card">
      <div class="cup-home-icon">🏆</div>
      <div class="cup-home-body">
        <div class="cup-home-title">The Cup</div>
        <div class="cup-home-sub">Tournament standings & matches</div>
      </div>
      <div class="cup-home-arrow">›</div>
    </RouterLink>


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
      <div class="empty-sub">Start tracking your round</div>
      <button class="new-round-pill" @click="openWizard()">+ New Round</button>
    </div>

    <!-- Auth modal -->
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { hasTournamentAccess } from '../stores/tournament.js'
import AuthModal from '../components/AuthModal.vue'

const appVersion = __APP_VERSION__

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const router = useRouter()
const showAuth = ref(false)
const openWizard = inject('openWizard', () => {})
const showTournament = computed(() => hasTournamentAccess(authStore.user?.email))

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

<style scoped>
.new-round-pill {
  display: block;
  margin: 16px auto 0;
  padding: 14px 32px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d;
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-radius: 28px;
  cursor: pointer;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 12px rgba(212,175,55,.3);
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s, box-shadow .12s;
}
.new-round-pill:active {
  transform: scale(0.95);
  box-shadow: 0 1px 6px rgba(212,175,55,.2);
}

.cup-home-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 20px var(--gw-space-4) 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(212,175,55,.12) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.3);
  text-decoration: none;
  color: var(--gw-text);
  cursor: pointer;
  transition: transform .12s, border-color .12s;
  -webkit-tap-highlight-color: transparent;
}
.cup-home-card:active {
  transform: scale(0.98);
  border-color: rgba(212,175,55,.6);
}
.cup-home-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.cup-home-body {
  flex: 1;
  min-width: 0;
}
.cup-home-title {
  font-family: var(--gw-font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--gw-gold, #d4af37);
  line-height: 1.2;
}
.cup-home-sub {
  font-size: 12px;
  color: rgba(240,237,224,.55);
  margin-top: 2px;
}
.cup-home-arrow {
  font-size: 28px;
  color: rgba(212,175,55,.6);
  font-weight: 300;
  flex-shrink: 0;
}
</style>
