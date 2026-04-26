<template>
  <div id="golfwizard-app" :class="{ 'guest-mode': authStore.isGuest }">

    <div v-if="authStore.loading" class="splash">
      <div class="splash-logo">⛳ GolfWizard</div>
      <div class="splash-spinner"></div>
    </div>

    <template v-else>
      <WizardOverlay v-if="showWizard" @close="showWizard = false" @created="onRoundCreated" @setup-course="onSetupCourse" />
      <JoinOverlay v-if="showJoin" @close="showJoin = false" />

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

      <div class="app-container">
        <RouterView />
      </div>

      <!-- First-time name prompt for OTP users who have no last name set -->
      <div v-if="namePrompt" class="name-prompt-backdrop">
        <div class="name-prompt-modal">
          <div class="name-prompt-icon">⛳</div>
          <div class="name-prompt-title">What's your name?</div>
          <div class="name-prompt-sub">So your group knows who you are in the app.</div>
          <div class="name-prompt-split">
            <input
              v-model="namePromptFirst"
              class="name-prompt-input"
              placeholder="First"
              @keyup.enter="saveNamePrompt"
              autofocus
            />
            <input
              v-model="namePromptLast"
              class="name-prompt-input"
              placeholder="Last"
              @keyup.enter="saveNamePrompt"
            />
          </div>
          <button class="name-prompt-btn" :disabled="!namePromptFirst.trim() || !namePromptLast.trim() || namePromptSaving" @click="saveNamePrompt">
            {{ namePromptSaving ? 'Saving…' : 'Save' }}
          </button>
          <button class="name-prompt-skip" @click="namePrompt = false">Skip for now</button>
        </div>
      </div>

      <nav v-if="!showWizard && !isWizardRoute" class="bottom-nav">
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
        <RouterLink
          to="/player-courses"
          class="nav-item nav-item--text-only"
          :class="{ active: $route.name === 'player-courses' || $route.name === 'players' || $route.name === 'courses' }"
        >
          <span class="nav-label">Courses &amp;<br>Roster</span>
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
const namePrompt = ref(false)
const namePromptFirst = ref('')
const namePromptLast = ref('')
const namePromptSaving = ref(false)

provide('openWizard', () => { showWizard.value = true })

onMounted(async () => {
  try { await authStore.init() } catch (e) { console.warn('Auth init failed:', e) }

  // Only prompt if authenticated AND last_name is missing
  // (first_name alone is fine — don't re-prompt users who have their name set)
  if (authStore.isAuthenticated && authStore.profile) {
    const hasFirst = !!(authStore.profile.first_name || '').trim()
    const hasLast  = !!(authStore.profile.last_name  || '').trim()
    if (!hasLast) {
      // Pre-fill first name if we already have it
      namePromptFirst.value = authStore.profile.first_name || ''
      namePromptLast.value = ''
      namePrompt.value = true
    }
  }

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

async function saveNamePrompt() {
  const f = namePromptFirst.value.trim()
  const l = namePromptLast.value.trim()
  if (!f || !l || namePromptSaving.value) return
  namePromptSaving.value = true
  try {
    await authStore.updateProfile({
      first_name: f,
      last_name: l,
      display_name: [f, l].join(' '),
    })
    namePrompt.value = false
  } catch (e) {
    console.warn('saveNamePrompt failed:', e)
  } finally {
    namePromptSaving.value = false
  }
}

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
/* Courses & Roster nav item: no icon, label wraps to two lines */
.nav-item--text-only {
  justify-content: center;
}
.nav-item--text-only .nav-label {
  font-size: 10.5px;
  text-align: center;
  line-height: 1.25;
  white-space: normal;
}

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

.name-prompt-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.name-prompt-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.name-prompt-modal {
  background: #1e2720;
  border: 1px solid #2a3d31;
  border-radius: 20px;
  padding: 32px 24px;
  max-width: 340px;
  width: 100%;
  display: flex; flex-direction: column; gap: 14px;
  text-align: center;
}
.name-prompt-icon { font-size: 40px; }
.name-prompt-title { font-size: 22px; font-weight: 700; color: #fff; }
.name-prompt-sub { font-size: 14px; color: #a3b8aa; }
.name-prompt-input {
  background: #111c14; border: 1px solid #2a3d31;
  border-radius: 10px; padding: 12px 14px;
  color: #fff; font-size: 16px; width: 100%;
  box-sizing: border-box; text-align: center;
}
.name-prompt-input:focus { outline: none; border-color: #34c77e; }
.name-prompt-btn {
  background: #1a7a55; color: #fff; border: none;
  border-radius: 12px; padding: 14px; font-size: 16px;
  font-weight: 600; cursor: pointer; width: 100%;
}
.name-prompt-btn:disabled { opacity: 0.5; cursor: default; }
.name-prompt-skip {
  background: transparent; color: #7d9283; border: none;
  font-size: 13px; cursor: pointer; padding: 2px;
}
</style>
