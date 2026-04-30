<template>
  <div class="view lma-view">

    <!-- Loading -->
    <div v-if="loading" class="lma-splash">
      <div class="lma-splash-spinner"></div>
      <div class="lma-splash-text">Loading invite…</div>
    </div>

    <!-- Error states -->
    <template v-else-if="errorState">
      <header class="lma-header">
        <button class="lma-back" @click="$router.push('/')">← Home</button>
      </header>
      <div class="lma-state">
        <div class="lma-state-icon">{{ errorState.icon }}</div>
        <div class="lma-state-title">{{ errorState.title }}</div>
        <div class="lma-state-sub">{{ errorState.sub }}</div>
        <button v-if="errorState.cta" class="lma-btn-primary" @click="$router.push(errorState.ctaRoute)">
          {{ errorState.cta }}
        </button>
      </div>
    </template>

    <!-- Already linked + I'm the owner → redirect handled in onMounted -->

    <!-- Main accept flow -->
    <template v-else>
      <!-- Header -->
      <header class="lma-header">
        <button class="lma-back" @click="handleBack">
          {{ step > 1 ? '←' : '← Home' }}
        </button>
        <div class="lma-step-dots">
          <span v-for="n in 3" :key="n" class="lma-dot" :class="{ active: step >= n }"></span>
        </div>
      </header>

      <!-- Match hero card (always visible) -->
      <div class="lma-hero">
        <div v-if="isBonnieBriar" class="lma-hero-logo-wrap">
          <img src="../assets/bonnie-briar-logo.png" alt="Bonnie Briar" class="lma-hero-logo" />
        </div>
        <div v-else class="lma-hero-emoji">⛳</div>
        <div class="lma-hero-title">{{ match?.name }}</div>
        <div class="lma-hero-pills">
          <span class="lma-pill">{{ matchFormatLabel }}</span>
          <span class="lma-pill">${{ cfg.stake ?? 20 }}/player</span>
          <span v-if="cfg.courseName" class="lma-pill lma-pill--course">{{ cfg.courseName }}</span>
        </div>
      </div>

      <!-- ── STEP 1: Confirm Your Foursome ── -->
      <div v-if="step === 1" class="lma-step" key="step1">
        <div class="lma-step-heading">
          <div class="lma-step-num">1 of 3</div>
          <div class="lma-step-title">Your Foursome</div>
          <div class="lma-step-sub">Confirm the players for your group</div>
        </div>

        <div class="lma-player-list">
          <div
            v-for="p in players"
            :key="p.id"
            class="lma-player-row"
          >
            <div class="lma-player-avatar">{{ initials(p.name) }}</div>
            <div class="lma-player-info">
              <div class="lma-player-name">{{ p.nickname && p.use_nickname ? p.nickname : p.name }}</div>
              <div v-if="p.ghin_index != null" class="lma-player-hcp">HCP {{ p.ghin_index }}</div>
            </div>
            <div class="lma-player-check">✓</div>
          </div>
        </div>

        <div class="lma-step-actions">
          <button class="lma-btn-primary" @click="step = 2">
            Looks good →
          </button>
          <button class="lma-btn-ghost" @click="openFullWizard">
            Different players?
          </button>
        </div>
      </div>

      <!-- ── STEP 2: Confirm Match Terms ── -->
      <div v-else-if="step === 2" class="lma-step" key="step2">
        <div class="lma-step-heading">
          <div class="lma-step-num">2 of 3</div>
          <div class="lma-step-title">Match Terms</div>
          <div class="lma-step-sub">The host set these stakes — confirm before you set up your round</div>
        </div>

        <div class="lma-terms-card">
          <div class="lma-terms-row">
            <span class="lma-terms-label">Format</span>
            <span class="lma-terms-value">{{ cfg.ballsToCount === 1 ? '1 Ball Net' : '2 Ball Net' }}</span>
          </div>
          <div class="lma-terms-row">
            <span class="lma-terms-label">Main stake</span>
            <span class="lma-terms-value lma-terms-value--gold">${{ cfg.stake ?? 20 }} / player</span>
          </div>
          <template v-if="activeSideBets.length">
            <div class="lma-terms-divider"></div>
            <div class="lma-terms-row lma-terms-row--header">
              <span class="lma-terms-label">Side bets</span>
            </div>
            <div v-for="bet in activeSideBets" :key="bet.type" class="lma-terms-row lma-terms-row--sidebet">
              <span class="lma-terms-label">{{ bet.label }}</span>
              <span class="lma-terms-value">${{ bet.stake }} / player</span>
            </div>
          </template>
        </div>

        <div class="lma-step-actions">
          <button class="lma-btn-primary" @click="step = 3">
            Agree & continue →
          </button>
        </div>
      </div>

      <!-- ── STEP 3: Side Games via WizardOverlay ── -->
      <div v-else-if="step === 3" class="lma-step" key="step3">
        <div class="lma-step-heading">
          <div class="lma-step-num">3 of 3</div>
          <div class="lma-step-title">Your Side Games</div>
          <div class="lma-step-sub">Pick the games your foursome plays internally</div>
        </div>

        <!-- Inline WizardOverlay at step 3 (games), with players + course locked -->
        <WizardOverlay
          v-if="!creating"
          :lockedCourse="cfg.courseName || hostCourseName"
          :lockedTee="cfg.tee || null"
          :lockedHint="'Course locked to match the host\'s round.'"
          :lockedPlayers="players"
          :startStep="3"
          inline
          @created="onRoundCreated"
          @close="step = 2"
        />

        <div v-if="creating" class="lma-creating">
          <div class="lma-creating-spinner"></div>
          <div class="lma-creating-title">Starting your round…</div>
          <div class="lma-creating-sub">Linking to the match</div>
        </div>
      </div>

      <div v-if="error" class="lma-error">{{ error }}</div>
    </template>

    <!-- Roster import offer -->
    <Teleport to="body">
      <div v-if="showRosterOffer" class="lma-roster-backdrop" @click.self="declineRosterImport">
        <div class="lma-roster-sheet">
          <div class="lma-roster-handle"></div>
          <div class="lma-roster-icon">👥</div>
          <div class="lma-roster-title">Import {{ hostName }}'s roster?</div>
          <div class="lma-roster-sub">{{ rosterOfferCount }} player{{ rosterOfferCount === 1 ? '' : 's' }} not yet in your roster</div>
          <button class="lma-btn-primary" @click="acceptRosterImport">Add {{ rosterOfferCount }} Player{{ rosterOfferCount === 1 ? '' : 's' }}</button>
          <button class="lma-btn-ghost" @click="declineRosterImport">No thanks</button>
        </div>
      </div>
    </Teleport>

    <!-- Auth modal -->
    <AuthModal v-if="showAuth" @close="showAuth = false" />

    <!-- Full wizard fallback (different players path) -->
    <WizardOverlay
      v-if="fullWizardOpen"
      :lockedCourse="cfg.courseName || hostCourseName"
      :lockedTee="cfg.tee || null"
      @close="fullWizardOpen = false"
      @created="onRoundCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { useRosterStore } from '../stores/roster'
import AuthModal from '../components/AuthModal.vue'
import WizardOverlay from '../components/WizardOverlay.vue'
import { applyPreset } from '../modules/preset'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const linkedStore = useLinkedMatchesStore()
const rosterStore = useRosterStore()

const loading = ref(true)
const match = ref(null)
const step = ref(1)
const creating = ref(false)
const fullWizardOpen = ref(false)
const error = ref('')
const showAuth = ref(false)
const hostCourseName = ref(null)
const hostDisplayName = ref(null)
const roundBOwnerId = ref(null)
const showRosterOffer = ref(false)
const rosterOfferPlayers = ref([])
const rosterOfferCount = computed(() => rosterOfferPlayers.value.length)
const hostName = computed(() => hostDisplayName.value || cfg.value?.hostName || 'the host')
let pendingRoundId = null

const codeUpper = computed(() => (route.params.code || '').toUpperCase())
const cfg = computed(() => match.value?.match_config ?? {})

const players = computed(() =>
  (cfg.value.foursomeBPlayers || []).map(p => ({
    id: p.id,
    name: p.name,
    short_name: p.short_name || p.name.split(' ')[0],
    ghin_index: p.ghin_index ?? p.ghinIndex ?? null,
    ghin_number: p.ghin_number ?? p.ghinNumber ?? null,
    nickname: p.nickname ?? null,
    use_nickname: p.use_nickname ?? false,
  }))
)

const matchFormatLabel = computed(() =>
  cfg.value.ballsToCount === 2 ? '2 BB Net' : '1 BB Net'
)

const activeSideBets = computed(() =>
  (cfg.value.sideBets ?? []).filter(b => b.enabled)
)

const isBonnieBriar = computed(() =>
  (cfg.value.courseName ?? '').toLowerCase().includes('bonnie briar') ||
  (hostCourseName.value ?? '').toLowerCase().includes('bonnie briar')
)

// Computed error state — covers all guard cases
const errorState = computed(() => {
  if (!match.value) return { icon: '⚠️', title: 'Invite not found', sub: `Code ${codeUpper.value} doesn't match any active match. Ask the host to re-share.`, cta: null }
  if (!authStore.isAuthenticated) return { icon: '🔒', title: 'Sign in to join', sub: "We need to know who you are before linking your round.", cta: null }
  if (match.value.status === 'cancelled') return { icon: '🚫', title: 'Match was cancelled', sub: 'The host cancelled this match. Ask them to create a new one.', cta: null }
  if (match.value.status === 'complete') return { icon: '🏆', title: 'Match is complete', sub: 'Both foursomes have already finished.', cta: 'View Result →', ctaRoute: `/cross-match/${match.value.id}` }
  if (match.value.status === 'linked' && roundBOwnerId.value !== authStore.user?.id)
    return { icon: '👀', title: 'Match already linked', sub: 'Someone else accepted this match.', cta: 'View Standings →', ctaRoute: `/cross-match/${match.value.id}` }
  return null // show the flow
})

function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function handleBack() {
  if (step.value > 1) { step.value-- } else { router.push('/') }
}


function openFullWizard() {
  fullWizardOpen.value = true
}

onMounted(async () => {
  applyPreset()
  loading.value = true
  try {
    const m = await linkedStore.fetchByCode(codeUpper.value)
    match.value = m
    if (!m) { loading.value = false; return }

    // Fetch host display name from profiles
    if (m.owner_id) {
      const { supabase: sb } = await import('../supabase')
      const { data: hostProfile } = await sb
        .from('profiles').select('display_name').eq('id', m.owner_id).maybeSingle()
      hostDisplayName.value = hostProfile?.display_name?.split(' ')[0] ?? null
    }

    // Auth guard — show auth modal if not signed in
    if (!authStore.isAuthenticated) {
      showAuth.value = true
      loading.value = false
      return
    }

    const { supabase } = await import('../supabase')

    // If already linked, check ownership
    if (m?.round_b_id) {
      const { data: rb } = await supabase
        .from('rounds').select('id,owner_id').eq('id', m.round_b_id).maybeSingle()
      roundBOwnerId.value = rb?.owner_id ?? null
      // Already linked as the owner → go straight to scoring
      if (m.status === 'linked' && rb?.owner_id === authStore.user?.id) {
        await roundsStore.loadRound(m.round_b_id)
        router.replace('/scoring')
        return
      }
    }

    // Fetch host course if no prebuilt config
    if (m?.round_a_id && !cfg.value.courseName) {
      const { data } = await supabase
        .from('rounds').select('id,course_name,tee').eq('id', m.round_a_id).maybeSingle()
      hostCourseName.value = data?.course_name ?? null
    }
  } catch (e) {
    console.warn('[lma] fetch failed:', e)
  } finally {
    loading.value = false
  }
})

async function onRoundCreated(round) {
  creating.value = true
  error.value = ''
  try {
    await linkedStore.acceptLinkedMatch(codeUpper.value, round.id)
    pendingRoundId = round.id

    // Check if host has favorites worth offering for roster import
    const { supabase } = await import('../supabase')
    if (match.value?.round_a_id) {
      const { data: hostRound } = await supabase
        .from('rounds').select('owner_id').eq('id', match.value.round_a_id).maybeSingle()
      if (hostRound?.owner_id) {
        const { data: hostFavs } = await supabase
          .from('roster_players')
          .select('id, name, short_name, ghin_index, ghin_number, email, nickname, use_nickname')
          .eq('owner_id', hostRound.owner_id)
          .eq('is_favorite', true)
        if (hostFavs?.length) {
          const myEmails = new Set(rosterStore.players.map(p => p.email?.toLowerCase()).filter(Boolean))
          const myNames = new Set(rosterStore.players.map(p => p.name?.toLowerCase()).filter(Boolean))
          const newPlayers = hostFavs.filter(p => {
            if (p.email && myEmails.has(p.email.toLowerCase())) return false
            if (p.name && myNames.has(p.name.toLowerCase())) return false
            return true
          })
          if (newPlayers.length > 0) {
            rosterOfferPlayers.value = newPlayers
            showRosterOffer.value = true
            creating.value = false
            return  // wait for user decision
          }
        }
      }
    }

    await goToScoring()
  } catch (e) {
    console.error('[lma] accept failed:', e)
    error.value = e?.message || 'Could not link your round. Your round is saved — ask the host to check.'
    creating.value = false
  }
}

async function acceptRosterImport() {
  showRosterOffer.value = false
  try {
    const { supabase } = await import('../supabase')
    const rows = rosterOfferPlayers.value.map(p => ({
      owner_id: authStore.user.id,
      name: p.name,
      short_name: p.short_name,
      ghin_index: p.ghin_index ?? null,
      ghin_number: p.ghin_number ?? null,
      email: p.email ?? null,
      nickname: p.nickname ?? null,
      use_nickname: p.use_nickname ?? false,
      is_favorite: true,
    }))
    await supabase.from('roster_players').insert(rows)
  } catch (e) {
    console.warn('[lma] roster import failed:', e?.message)
  }
  await goToScoring()
}

async function declineRosterImport() {
  showRosterOffer.value = false
  await goToScoring()
}

async function goToScoring() {
  if (pendingRoundId) await roundsStore.loadRound(pendingRoundId)
  router.push('/scoring')
}
</script>

<style scoped>
.lma-view {
  min-height: 100%;
  background: var(--gw-bg-app);
  padding-bottom: calc(var(--gw-nav-height, 64px) + env(safe-area-inset-bottom) + 24px);
}

/* ── Splash / loading ── */
.lma-splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
}
.lma-splash-spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(212,175,55,.2);
  border-top-color: #d4af37;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.lma-splash-text { font-size: 14px; color: rgba(240,237,224,.5); }

/* ── Header ── */
.lma-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
}
.lma-back {
  background: transparent; border: none;
  color: rgba(240,237,224,.5); font-size: 14px;
  cursor: pointer; padding: 6px 0;
  -webkit-tap-highlight-color: transparent;
  font-family: var(--gw-font-body);
}
.lma-step-dots { display: flex; gap: 6px; }
.lma-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,.15);
  transition: background .2s;
}
.lma-dot.active { background: #d4af37; }

/* ── Match hero ── */
.lma-hero {
  margin: 8px 16px 20px;
  padding: 20px 16px;
  background: linear-gradient(135deg, rgba(212,175,55,.14) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.35);
  border-radius: 20px;
  text-align: center;
  animation: card-in 0.25s ease-out;
}
.lma-hero-logo-wrap { margin-bottom: 8px; }
.lma-hero-logo { height: 48px; object-fit: contain; }
.lma-hero-emoji { font-size: 36px; margin-bottom: 6px; }
.lma-hero-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--gw-gold, #d4af37);
  line-height: 1.2;
  margin-bottom: 10px;
}
.lma-hero-pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.lma-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  font-size: 12px;
  font-weight: 600;
  color: rgba(240,237,224,.7);
}
.lma-pill--course {
  background: rgba(212,175,55,.1);
  border-color: rgba(212,175,55,.25);
  color: rgba(212,175,55,.9);
}

/* ── Step container ── */
.lma-step {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: card-in 0.2s ease-out;
}
.lma-step-heading { text-align: left; }
.lma-step-num {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(212,175,55,.6);
  margin-bottom: 4px;
}
.lma-step-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-text, #f0ede0);
  line-height: 1.2;
}
.lma-step-sub {
  font-size: 13px;
  color: rgba(240,237,224,.5);
  margin-top: 4px;
}

/* ── Player list ── */
.lma-player-list { display: flex; flex-direction: column; gap: 8px; }
.lma-player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  animation: card-in 0.2s ease-out;
}
.lma-player-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(212,175,55,.18);
  border: 1.5px solid rgba(212,175,55,.4);
  color: #d4af37;
  font-size: 13px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-family: var(--gw-font-body);
}
.lma-player-info { flex: 1; min-width: 0; }
.lma-player-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--gw-text, #f0ede0);
}
.lma-player-hcp {
  font-size: 12px;
  color: rgba(240,237,224,.45);
  margin-top: 1px;
}
.lma-player-check {
  font-size: 15px;
  color: #22c55e;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Step actions ── */
.lma-step-actions { display: flex; flex-direction: column; gap: 10px; }

/* ── Buttons ── */
.lma-btn-primary {
  padding: 16px 24px;
  border-radius: 14px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d;
  border: none;
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: .3px;
  box-shadow: 0 4px 16px rgba(212,175,55,.3);
  -webkit-tap-highlight-color: transparent;
  transition: transform .1s, box-shadow .1s;
}
.lma-btn-primary:active { transform: scale(.97); box-shadow: 0 2px 8px rgba(212,175,55,.2); }

.lma-btn-ghost {
  padding: 13px 24px;
  border-radius: 14px;
  background: transparent;
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.5);
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.lma-btn-ghost:active { background: rgba(255,255,255,.05); }

/* ── Creating spinner ── */
.lma-creating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
}
.lma-creating-spinner {
  width: 44px; height: 44px;
  border: 3px solid rgba(212,175,55,.2);
  border-top-color: #d4af37;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.lma-creating-title {
  font-family: var(--gw-font-display);
  font-size: 20px;
  color: var(--gw-text, #f0ede0);
}
.lma-creating-sub { font-size: 13px; color: rgba(240,237,224,.5); }

/* ── Error states ── */
.lma-state {
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: card-in 0.25s ease-out;
}
.lma-state-icon { font-size: 44px; }
.lma-state-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-text, #f0ede0);
}
.lma-state-sub {
  font-size: 13px;
  color: rgba(240,237,224,.55);
  line-height: 1.55;
  max-width: 320px;
}

.lma-error {
  margin: 0 16px 16px;
  padding: 12px 14px;
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3);
  color: #f87171;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes card-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Terms card (step 2) ── */
.lma-terms-card {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 16px;
  padding: 4px 0;
  overflow: hidden;
}
.lma-terms-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  gap: 12px;
}
.lma-terms-row--header { padding-bottom: 4px; }
.lma-terms-row--sidebet { padding-top: 6px; padding-bottom: 6px; }
.lma-terms-label {
  font-size: 14px;
  color: rgba(240,237,224,.55);
  font-weight: 500;
}
.lma-terms-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
}
.lma-terms-value--gold { color: #d4af37; }
.lma-terms-divider {
  height: 1px;
  background: rgba(255,255,255,.07);
  margin: 0 16px;
}

/* ── Roster import offer sheet ── */
.lma-roster-backdrop {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0,0,0,.6); backdrop-filter: blur(3px);
  display: flex; align-items: flex-end;
}
.lma-roster-sheet {
  width: 100%; background: var(--gw-neutral-900);
  border-radius: 20px 20px 0 0;
  border-top: 1px solid var(--gw-card-border);
  padding: 16px 20px calc(32px + env(safe-area-inset-bottom));
  text-align: center; display: flex; flex-direction: column; gap: 12px;
}
.lma-roster-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.2); margin: 0 auto 4px;
}
.lma-roster-icon { font-size: 40px; }
.lma-roster-title {
  font-family: var(--gw-font-display); font-size: 20px; font-weight: 700;
  color: var(--gw-text);
}
.lma-roster-sub { font-size: 14px; color: var(--gw-text-muted); line-height: 1.5; }
</style>
