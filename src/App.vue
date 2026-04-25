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

      <!-- 4v4 Invite modal — shown after round + linked match created -->
      <div v-if="inviteModal" class="invite-modal-backdrop" @click.self="inviteModal = null">
        <div class="invite-modal">
          <div class="invite-modal-icon">🤝</div>
          <div class="invite-modal-title">4v4 Match Created!</div>
          <div class="invite-modal-sub">Share this link with the other foursome</div>
          <div class="invite-modal-code">{{ inviteModal.inviteCode }}</div>
          <button class="invite-modal-copy" @click="copyInvite">
            {{ inviteModal.copied ? '✓ Copied!' : '📋 Copy invite link' }}
          </button>
          <button class="invite-modal-dismiss" @click="inviteModal = null">Go to scorecard →</button>
        </div>
      </div>

      <!-- Main content -->
      <div class="app-container">
        <RouterView />
      </div>

      <!-- Bottom nav — hidden when wizard is open or on full-screen wizard routes -->
      <nav
        v-if="!showWizard && !isWizardRoute"
        class="bottom-nav"
      >
        <RouterLink to="/" class="nav-item" :class="{ active: $route.name === 'home' }">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </RouterLink>
        <RouterLink to="/scoring" class="nav-item" :class="{ active: $route.name === 'scoring' }">
          <span class="nav-icon">🏌️</span>
          <span class="nav-label">Score</span>
        </RouterLink>
        <RouterLink to="/metrics" class="nav-item" :class="{ active: $route.name === 'metrics' }">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Stats</span>
        </RouterLink>
        <RouterLink to="/player-courses" class="nav-item" :class="{ active: $route.name === 'player-courses' || $route.name === 'players' || $route.name === 'courses' }">
          <span class="nav-icon">🏌️</span>
          <span class="nav-label">Roster</span>
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
import { useRoundsStore } from './stores/rounds'
import { useCoursesStore } from './stores/courses'
import { hasTournamentAccess, useTournamentStore } from './stores/tournament.js'
import { useLinkedMatchesStore } from './stores/linkedMatches'
import WizardOverlay from './components/WizardOverlay.vue'
import JoinOverlay from './components/JoinOverlay.vue'

const authStore = useAuthStore()
const rosterStore = useRosterStore()
const roundsStore = useRoundsStore()
const coursesStore = useCoursesStore()
const tournamentStore = useTournamentStore()
const linkedMatchesStore = useLinkedMatchesStore()
const router = useRouter()
const route = useRoute()

const showTournament = computed(() => hasTournamentAccess(authStore.user?.email))

const WIZARD_ROUTES = new Set(['cross-match-new', 'cross-match-accept', 'cross-match-detail'])
const isWizardRoute = computed(() => WIZARD_ROUTES.has(route.name))

const showWizard = ref(false)
const showJoin = ref(false)
const inviteModal = ref(null)

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
      tournamentStore.init(),
    ])
  } catch (e) { console.warn('Data load error:', e) }

  if (!roundsStore.activeRound) {
    if (authStore.isAuthenticated) {
      const known = roundsStore.knownRounds
      if (known.length > 0) {
        try { await roundsStore.loadRound(known[0].id) } catch (e) { console.warn('knownRound reload failed:', e) }
      }
      if (!roundsStore.activeRound) {
        try {
          const { supabase } = await import('./supabase')
          const { data } = await supabase
            .from('rounds')
            .select('id')
            .eq('owner_id', authStore.user.id)
            .eq('is_complete', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (data?.id) await roundsStore.loadRound(data.id)
        } catch (e) { console.warn('Auto-rehydrate fallback failed:', e) }
      }
    } else {
      try {
        const index = JSON.parse(localStorage.getItem('gw_guest_rounds_index') || '[]')
        for (const id of index) {
          const raw = localStorage.getItem(`gw_guest_round_${id}`)
          if (!raw) continue
          const payload = JSON.parse(raw)
          if (payload.round && !payload.round.is_complete) {
            await roundsStore.loadRound(payload.round.id)
            break
          }
        }
      } catch (e) { console.warn('Guest round restore failed:', e) }
    }
  }

  const hash = window.location.hash
  const joinMatch = hash.match(/\/join\/([A-Z0-9]{6})/i)
  if (joinMatch) showJoin.value = true

  if (router.currentRoute.value.query.launchWizard === '1') {
    showWizard.value = true
    router.replace({ query: {} })
  }
})

async function onRoundCreated(round, meta) {
  showWizard.value = false
  if (meta?.withOpponents && meta.opponentPlayers?.length > 0 && authStore.isAuthenticated) {
    try {
      const result = await linkedMatchesStore.createLinkedMatch({
        name: (meta.courseName || 'GolfWizard') + ' 4v4',
        roundAId: round.id,
        ballsToCount: 1,
        stake: 20,
        courseName: meta.courseName,
        tee: meta.tee,
        holesMode: meta.holesMode,
        foursomeBPlayers: meta.opponentPlayers,
      })
      inviteModal.value = {
        inviteCode: result.match?.invite_code,
        inviteUrl: result.inviteUrl,
        copied: false,
      }
    } catch (e) {
      console.warn('[app] linked match creation failed:', e)
    }
  }
  router.push('/scoring')
}

async function copyInvite() {
  if (!inviteModal.value?.inviteUrl) return
  try {
    await navigator.clipboard.writeText(inviteModal.value.inviteUrl)
    inviteModal.value.copied = true
    setTimeout(() => { if (inviteModal.value) inviteModal.value.copied = false }, 2000)
  } catch {
    inviteModal.value.copied = true
  }
}

function onSetupCourse(courseName, apiId) {
  showWizard.value = false
  const query = { add: courseName }
  if (apiId) query.apiId = apiId
  router.push({ path: '/courses', query })
}
</script>

<style>
.invite-modal-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.invite-modal {
  background: #1e2720;
  border: 1px solid #22a06b;
  border-radius: 20px;
  padding: 32px 24px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  display: flex; flex-direction: column; gap: 12px;
}
.invite-modal-icon { font-size: 48px; }
.invite-modal-title { font-size: 22px; font-weight: 700; color: #fff; }
.invite-modal-sub { font-size: 14px; color: #a3b8aa; }
.invite-modal-code {
  font-size: 32px; font-weight: 800; letter-spacing: 6px;
  color: #34c77e; font-family: 'DM Mono', monospace;
  background: #0d3325; border-radius: 12px; padding: 12px;
}
.invite-modal-copy {
  background: #1a7a55; color: #fff; border: none;
  border-radius: 12px; padding: 14px; font-size: 16px;
  font-weight: 600; cursor: pointer; width: 100%;
}
.invite-modal-copy:active { background: #166044; }
.invite-modal-dismiss {
  background: transparent; color: #7d9283; border: none;
  font-size: 14px; cursor: pointer; padding: 4px;
}
</style>
