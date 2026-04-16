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
        You need to sign in with your email so we can save your foursome's scores. We'll pick up where you left off after.
      </div>
      <button class="lma-btn-primary" @click="showAuth = true">Sign In</button>
      <AuthModal v-if="showAuth" @close="showAuth = false" />
    </div>

    <div v-else-if="match.status === 'linked' && !amIOwner" class="lma-state">
      <div class="lma-state-icon">👀</div>
      <div class="lma-state-title">Match already linked</div>
      <div class="lma-state-sub">
        Someone in Foursome B already accepted this match and set up their round. You can open the live standings instead.
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

    <!-- Pending — show accept flow -->
    <div v-else class="lma-accept">
      <div class="lma-invite-card">
        <div class="lma-invite-emoji">⛳</div>
        <div class="lma-invite-title">{{ match.name }}</div>
        <div class="lma-invite-sub">
          {{ matchFormatLabel }} · ${{ match.match_config?.stake ?? 20 }}/player
        </div>
        <div v-if="courseName" class="lma-invite-course">
          at <strong>{{ courseName }}</strong>
        </div>
      </div>

      <p class="lma-body-text">
        You're joining as the scorer for <strong>Foursome B</strong>. Tap below to open the round wizard — your course is locked to match the host's, but you pick your own foursome players and side games.
      </p>

      <div v-if="accepting" class="lma-state lma-state--tight">
        <div class="lma-spinner">⟳</div>
        <div>Opening wizard…</div>
      </div>
      <button v-else class="lma-btn-primary" @click="startWizard">
        Set up Foursome B →
      </button>

      <!-- Wizard (opens after user taps the button) -->
      <WizardOverlay
        v-if="wizardOpen"
        :lockedCourse="courseName"
        :lockedTee="match.course_snapshot?.defaultTee || null"
        @close="wizardOpen = false"
        @created="onRoundBCreated"
      />
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
const hostRoundA = ref(null) // we load round_a to know the course + tee

const codeUpper = computed(() => (route.params.code || '').toUpperCase())
const matchFormatLabel = computed(() =>
  match.value?.match_config?.ballsToCount === 2 ? '2 BB Net' : '1 BB Net'
)
const courseName = computed(() => hostRoundA.value?.course_name || null)
const amIOwner = computed(() => {
  // "I own round B" means I'm the one who already accepted
  if (!match.value?.round_b_id) return false
  return authStore.user?.id && hostRoundA.value?.owner_id !== authStore.user.id
})

onMounted(async () => {
  // Seed the preset for first-timers opening a cross-match invite —
  // same group players + Bonnie Briar get loaded into local storage.
  applyPreset()

  loading.value = true
  try {
    const m = await linkedStore.fetchByCode(codeUpper.value)
    match.value = m
    if (m?.round_a_id) {
      // Load host's round just to get course + tee (public SELECT policy allows this)
      const { supabase } = await import('../supabase')
      const { data } = await supabase.from('rounds').select('id,course_name,course_snapshot,tee,owner_id').eq('id', m.round_a_id).maybeSingle()
      hostRoundA.value = data
    }
  } catch (e) {
    console.warn('[lma] fetch failed:', e)
  } finally {
    loading.value = false
  }
})

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
