<template>
  <div class="view lma-view">
    <header class="lma-header">
      <button class="lma-back" @click="$router.push('/')">← Home</button>
      <h1 class="lma-title">Accept Match</h1>
    </header>

    <div v-if="loading" class="lma-state">
      <div class="lma-spinner">⟳</div>
      <div>Loading invite…</div>
    </div>

    <div v-else-if="!match" class="lma-state lma-state--error">
      <div class="lma-state-icon">⚠️</div>
      <div class="lma-state-title">Invite not found</div>
      <div class="lma-state-sub">
        Code <code>{{ codeUpper }}</code> doesn't match any active match. Ask the host to re-share the link.
      </div>
    </div>

    <div v-else-if="!authStore.isAuthenticated" class="lma-state">
      <div class="lma-state-icon">🔒</div>
      <div class="lma-state-title">Sign in to accept</div>
      <div class="lma-state-sub">
        You need to sign in so we can save your foursome's scores. We'll pick up where you left off after.
      </div>
      <button class="lma-btn-primary" @click="showAuth = true">Sign In</button>
      <AuthModal v-if="showAuth" @close="showAuth = false" />
    </div>

    <div v-else-if="match.status === 'linked' && !amIOwner" class="lma-state">
      <div class="lma-state-icon">👀</div>
      <div class="lma-state-title">Match already linked</div>
      <div class="lma-state-sub">
        Someone in Foursome B already accepted this match. You can open the live standings instead.
      </div>
      <button class="lma-btn-primary" @click="$router.push(`/cross-match/${match.id}`)">
        View Standings →
      </button>
    </div>

    <div v-else-if="match.status === 'cancelled'" class="lma-state lma-state--error">
      <div class="lma-state-icon">🚫</div>
      <div class="lma-state-title">Match was cancelled</div>
      <div class="lma-state-sub">The host cancelled this match. Ask them to create a new one.</div>
    </div>

    <div v-else-if="match.status === 'complete'" class="lma-state">
      <div class="lma-state-icon">🏆</div>
      <div class="lma-state-title">Match is complete</div>
      <div class="lma-state-sub">Both foursomes have already finished.</div>
      <button class="lma-btn-primary" @click="$router.push(`/cross-match/${match.id}`)">
        View Result →
      </button>
    </div>

    <!-- Pending — pre-built flow OR wizard fallback -->
    <div v-else class="lma-accept">
      <!-- Match card -->
      <div class="lma-invite-card">
        <div v-if="isBonnieBriar" class="lma-bb-logo-wrap">
          <img src="../assets/bonnie-briar-logo.png" alt="Bonnie Briar" class="lma-bb-logo" />
        </div>
        <div v-else class="lma-invite-emoji">⛳</div>
        <div class="lma-invite-title">{{ match.name }}</div>
        <div class="lma-invite-sub">
          {{ matchFormatLabel }} · ${{ cfg.stake ?? 20 }}/player
        </div>
        <div v-if="cfg.courseName" class="lma-invite-course">
          at <strong>{{ cfg.courseName }}</strong>
        </div>
      </div>

      <!-- ── PRE-BUILT FLOW ── -->
      <template v-if="hasPrebuilt">
        <div class="lma-section-label">Your foursome is ready to go:</div>

        <div class="lma-player-list">
          <div
            v-for="p in cfg.foursomeBPlayers"
            :key="p.id"
            class="lma-player-chip"
          >
            <span class="lma-player-avatar">{{ initials(p.name) }}</span>
            <span class="lma-player-name">{{ p.nickname && p.use_nickname ? p.nickname : p.name }}</span>
            <span v-if="p.ghin_index != null" class="lma-player-hcp">{{ p.ghin_index }}</span>
          </div>
        </div>

        <p class="lma-body-text">
          The host has already set up your foursome. Tap below to start scoring — your round will be created instantly and linked to the match.
        </p>

        <div v-if="accepting" class="lma-state lma-state--tight">
          <div class="lma-spinner">⟳</div>
          <div>Creating your round…</div>
        </div>
        <button v-else class="lma-btn-primary" @click="acceptPrebuilt">
          ⛳ Start scoring →
        </button>
      </template>

      <!-- ── WIZARD FALLBACK (old-style or host didn't pick players) ── -->
      <template v-else>
        <p class="lma-body-text">
          You're joining as the scorer for <strong>Foursome B</strong>. Tap below to open the round wizard — your course is locked to match the host's, but you pick your own foursome and side games.
        </p>

        <div v-if="accepting" class="lma-state lma-state--tight">
          <div class="lma-spinner">⟳</div>
          <div>Opening wizard…</div>
        </div>
        <button v-else class="lma-btn-primary" @click="startWizard">
          Set up Foursome B →
        </button>

        <WizardOverlay
          v-if="wizardOpen"
          :lockedCourse="cfg.courseName || hostCourseName"
          :lockedTee="cfg.tee || null"
          @close="wizardOpen = false"
          @created="onRoundBCreated"
        />
      </template>
    </div>

    <div v-if="error" class="lma-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import AuthModal from '../components/AuthModal.vue'
import WizardOverlay from '../components/WizardOverlay.vue'
import { applyPreset } from '../modules/preset'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const linkedStore = useLinkedMatchesStore()

const loading = ref(true)
const match = ref(null)
const accepting = ref(false)
const wizardOpen = ref(false)
const error = ref('')
const showAuth = ref(false)
// Used only in wizard-fallback path to get course name from round_a
const hostCourseName = ref(null)

const codeUpper = computed(() => (route.params.code || '').toUpperCase())

const cfg = computed(() => match.value?.match_config ?? {})

const hasPrebuilt = computed(() =>
  Array.isArray(cfg.value.foursomeBPlayers) && cfg.value.foursomeBPlayers.length > 0
)

const matchFormatLabel = computed(() =>
  cfg.value.ballsToCount === 2 ? '2 BB Net' : '1 BB Net'
)

const isBonnieBriar = computed(() =>
  (cfg.value.courseName ?? '').toLowerCase().includes('bonnie briar') ||
  (hostCourseName.value ?? '').toLowerCase().includes('bonnie briar')
)

const amIOwner = computed(() => {
  if (!match.value?.round_b_id) return false
  // If the match is already linked, user is the owner if they're not the host
  return authStore.user?.id != null
})

function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

onMounted(async () => {
  applyPreset()
  loading.value = true
  try {
    const m = await linkedStore.fetchByCode(codeUpper.value)
    match.value = m
    // Only need host round_a if wizard fallback (no pre-built config)
    if (m?.round_a_id && !(m.match_config?.foursomeBPlayers?.length)) {
      const { supabase } = await import('../supabase')
      const { data } = await supabase
        .from('rounds')
        .select('id,course_name,tee,owner_id')
        .eq('id', m.round_a_id)
        .maybeSingle()
      hostCourseName.value = data?.course_name ?? null
    }
  } catch (e) {
    console.warn('[lma] fetch failed:', e)
  } finally {
    loading.value = false
  }
})

/**
 * Pre-built path: create round from stored players, link, go to standings.
 */
async function acceptPrebuilt() {
  accepting.value = true
  error.value = ''
  try {
    const config = cfg.value
    const players = config.foursomeBPlayers.map(p => ({
      id: p.id,
      name: p.name,
      short_name: p.short_name || p.name.split(' ')[0],
      ghin_index: p.ghin_index ?? null,
      ghin_number: p.ghin_number ?? null,
      nickname: p.nickname ?? null,
      use_nickname: p.use_nickname ?? false,
    }))

    // Create the round using stored config
    const round = await roundsStore.createRound({
      courseName: config.courseName,
      courseSnapshot: config.courseSnapshot ?? null,
      tee: config.tee,
      holesMode: config.holesMode ?? '18',
      players,
      games: [],
    })

    if (!round?.id) throw new Error('Round creation returned no data.')

    await linkedStore.acceptLinkedMatch(codeUpper.value, round.id)
    router.push(`/cross-match/${match.value.id}`)
  } catch (e) {
    console.error('[lma] acceptPrebuilt failed:', e)
    error.value = e?.message || 'Could not start your round. Check your connection and try again.'
  } finally {
    accepting.value = false
  }
}

/**
 * Wizard fallback path: round was created by WizardOverlay.
 */
function startWizard() {
  wizardOpen.value = true
}

async function onRoundBCreated(round) {
  accepting.value = true
  error.value = ''
  try {
    await linkedStore.acceptLinkedMatch(codeUpper.value, round.id)
    router.push(`/cross-match/${match.value.id}`)
  } catch (e) {
    console.error('[lma] accept failed:', e)
    error.value = e?.message || 'Could not attach your round to the match. Your round is saved — ask the host to check the link.'
  } finally {
    accepting.value = false
  }
}
</script>

<style scoped>
.lma-view {
  min-height: 100%;
  background: var(--gw-neutral-950);
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}
.lma-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 6px;
}
.lma-back {
  background: transparent; border: none;
  color: var(--gw-text-muted); font-size: 14px; cursor: pointer; padding: 4px 6px;
  -webkit-tap-highlight-color: transparent;
}
.lma-title {
  margin: 0;
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-text);
}

.lma-state {
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.lma-state--tight { padding: 12px; }
.lma-state--error { color: #fca5a5; }
.lma-state-icon { font-size: 40px; }
.lma-state-title { font-family: var(--gw-font-display); font-size: 20px; color: var(--gw-text); }
.lma-state-sub {
  font-size: 13px;
  color: rgba(240,237,224,.6);
  line-height: 1.5;
  max-width: 340px;
}
.lma-spinner {
  font-size: 28px;
  color: var(--gw-gold);
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.lma-accept {
  padding: 4px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lma-invite-card {
  background: linear-gradient(135deg, rgba(212,175,55,.14) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.4);
  border-radius: 20px;
  padding: 24px 18px;
  text-align: center;
}
.lma-bb-logo-wrap { margin-bottom: 8px; }
.lma-bb-logo { height: 52px; object-fit: contain; }
.lma-invite-emoji { font-size: 40px; margin-bottom: 6px; }
.lma-invite-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-gold);
  line-height: 1.2;
}
.lma-invite-sub { font-size: 13px; color: rgba(240,237,224,.7); margin-top: 4px; }
.lma-invite-course {
  margin-top: 10px;
  font-size: 13px;
  color: rgba(240,237,224,.7);
}

.lma-section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(240,237,224,.45);
  padding: 0 2px;
}

.lma-player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lma-player-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: 10px 14px;
}
.lma-player-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(212,175,55,.2);
  border: 1px solid rgba(212,175,55,.35);
  color: var(--gw-gold);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lma-player-name {
  flex: 1;
  font-size: 15px;
  color: var(--gw-text);
  font-weight: 500;
}
.lma-player-hcp {
  font-size: 13px;
  color: rgba(240,237,224,.5);
  font-variant-numeric: tabular-nums;
}

.lma-body-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(240,237,224,.7);
  padding: 0 4px;
}

.lma-btn-primary {
  padding: 14px 24px;
  border-radius: 14px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d;
  border: none;
  font-family: var(--gw-font-body);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: .3px;
  box-shadow: 0 2px 10px rgba(212,175,55,.25);
  -webkit-tap-highlight-color: transparent;
}
.lma-btn-primary:active { transform: scale(.98); }

.lma-error {
  margin: 0 16px;
  padding: 10px 12px;
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3);
  color: #f87171;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
}
</style>
