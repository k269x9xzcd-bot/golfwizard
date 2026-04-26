<template>
  <div class="view lmd-view">
    <header class="lmd-header">
      <button class="lmd-back" @click="goBack">← Back</button>
      <h1 class="lmd-title">4v4 Match</h1>
    </header>

    <div v-if="loading" class="lmd-state">
      <div class="lmd-spinner">⟳</div>
      <div>Loading match…</div>
    </div>

    <div v-else-if="!match" class="lmd-state lmd-state--error">
      <div class="lmd-state-icon">⚠️</div>
      <div>Match not found.</div>
    </div>

    <template v-else>
      <!-- Status card -->
      <div class="lmd-status-card" :class="`lmd-status--${summary.state}`">
        <div class="lmd-status-emoji">
          {{ summary.state === 'final' ? '🏆' : summary.state === 'live' ? '🎮' : summary.state === 'waiting' ? '⏳' : '⛳' }}
        </div>
        <div class="lmd-status-label">{{ summary.label }}</div>
      </div>

      <!-- Two team tiles -->
      <div class="lmd-teams">
        <div class="lmd-team lmd-team--a" :class="{ 'lmd-team--leading': result?.currentLeader === 'A' }">
          <div class="lmd-team-label">Foursome A</div>
          <div class="lmd-team-name">{{ result?.teamA?.name || 'A' }}</div>
          <div class="lmd-team-score">
            <span class="lmd-team-vs">{{ formatVsPar(result?.teamA?.vsPar) }}</span>
            <span class="lmd-team-holes">thru {{ result?.teamA?.holesFullyScored || 0 }}</span>
          </div>
        </div>
        <div class="lmd-vs-chip">vs</div>
        <div class="lmd-team lmd-team--b" :class="{ 'lmd-team--leading': result?.currentLeader === 'B' }">
          <div class="lmd-team-label">Foursome B</div>
          <div class="lmd-team-name">{{ result?.teamB?.name || 'B' }}</div>
          <div class="lmd-team-score">
            <span class="lmd-team-vs">{{ formatVsPar(result?.teamB?.vsPar) }}</span>
            <span class="lmd-team-holes">thru {{ result?.teamB?.holesFullyScored || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Match config -->
      <div class="lmd-config">
        <div class="lmd-config-row">
          <span>Format</span>
          <strong>{{ ballsLabel }}</strong>
        </div>
        <div class="lmd-config-row">
          <span>Stake</span>
          <strong>${{ match.match_config?.stake ?? 20 }}/player</strong>
        </div>
        <div class="lmd-config-row">
          <span>Course</span>
          <strong>{{ roundA?.course_name || '—' }}</strong>
        </div>
        <div class="lmd-config-row">
          <span>Status</span>
          <strong>{{ statusText }}</strong>
        </div>
      </div>

      <!-- Per-hole detail -->
      <div class="lmd-section-label">Hole-by-Hole</div>
      <div class="lmd-holes-grid">
        <div class="lmd-hole-row lmd-hole-row--head">
          <div class="lmd-hole-cell lmd-hole-cell--label">Hole</div>
          <div class="lmd-hole-cell">Par</div>
          <div class="lmd-hole-cell">A</div>
          <div class="lmd-hole-cell">B</div>
          <div class="lmd-hole-cell">Δ</div>
        </div>
        <div
          v-for="row in result?.perHole || []"
          :key="row.hole"
          class="lmd-hole-row"
          :class="{
            'lmd-hole-row--a-wins': row.diff != null && row.diff < 0,
            'lmd-hole-row--b-wins': row.diff != null && row.diff > 0,
          }"
        >
          <div class="lmd-hole-cell lmd-hole-cell--label">{{ row.hole }}</div>
          <div class="lmd-hole-cell">{{ row.par }}</div>
          <div class="lmd-hole-cell">{{ row.a ? formatVsPar(row.a.vsPar) : '—' }}</div>
          <div class="lmd-hole-cell">{{ row.b ? formatVsPar(row.b.vsPar) : '—' }}</div>
          <div class="lmd-hole-cell lmd-hole-cell--diff">
            <template v-if="row.diff == null">—</template>
            <template v-else-if="row.diff < 0">A +{{ Math.abs(row.diff) }}</template>
            <template v-else-if="row.diff > 0">B +{{ row.diff }}</template>
            <template v-else>AS</template>
          </div>
        </div>
      </div>

      <!-- Final settlement -->
      <div v-if="result?.settlement" class="lmd-settlement">
        <div class="lmd-section-label">Settlement</div>
        <div v-if="result.settlement.winner" class="lmd-settlement-card lmd-settlement-card--payout">
          <span class="lmd-settlement-icon">💰</span>
          <span>{{ result.settlement.description }}</span>
        </div>
        <div v-else class="lmd-settlement-card">
          <span class="lmd-settlement-icon">🤝</span>
          <span>Match tied — no payment.</span>
        </div>
      </div>


      <!-- Foursome B scoring CTA -->
      <div v-if="isRoundBOwner && match.status === 'linked'" class="lmd-score-cta">
        <button class="lmd-btn-score" @click="goScore">
          🏌️ Score your round →
        </button>
      </div>
      <!-- Host actions -->
      <div v-if="isHost" class="lmd-host-actions">
        <!-- Manual Foursome B override — when no one in Foursome B has the app -->
        <div v-if="match.status === 'pending'" class="lmd-manual-override">
          <div class="lmd-section-label" style="margin:0 0 8px">Nobody in Foursome B has the app?</div>
          <div class="lmd-override-body">
            Create Foursome B's round manually and score it yourself. The cross-match will auto-compute once both rounds have scores.
          </div>
          <button class="lmd-btn-override" @click="onManualB">
            📝 Score Foursome B myself
          </button>
        </div>

        <button
          v-if="match.status !== 'cancelled' && match.status !== 'complete'"
          class="lmd-btn-danger"
          @click="onCancel"
        >
          Cancel Match
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { computeLinkedMatch, summarizeLinkedMatch } from '../modules/linkedMatch'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const linkedStore = useLinkedMatchesStore()

const loading = ref(true)
const match = ref(null)
const roundA = ref(null)
const roundB = ref(null)
const result = ref(null)

const ballsLabel = computed(() =>
  match.value?.match_config?.ballsToCount === 2 ? '2 BB Net' : '1 BB Net'
)
const statusText = computed(() => {
  const s = match.value?.status
  if (s === 'pending') return 'Waiting for Foursome B'
  if (s === 'linked') return 'Live'
  if (s === 'complete') return 'Final'
  if (s === 'cancelled') return 'Cancelled'
  return s || '—'
})

// Which round does the current user own? Used for "Your team" perspective labels.
const myRoundId = computed(() => {
  if (!authStore.user?.id || !match.value) return null
  if (roundA.value?.owner_id === authStore.user.id) return match.value.round_a_id
  if (roundB.value?.owner_id === authStore.user.id) return match.value.round_b_id
  return null
})

const summary = computed(() => summarizeLinkedMatch(match.value, roundA.value, roundB.value, result.value, myRoundId.value))
const isHost = computed(() => authStore.user?.id && match.value?.created_by === authStore.user.id)

// Foursome B scorer CTA: show when this user owns round B and match is live
const isRoundBOwner = computed(() =>
  authStore.user?.id && roundB.value?.owner_id === authStore.user.id
)

function goScore() {
  if (roundB.value?.id) {
    // Load round B as active then navigate to scoring
    import('../stores/rounds').then(({ useRoundsStore }) => {
      const roundsStore = useRoundsStore()
      roundsStore.loadRound(roundB.value.id).then(() => router.push('/scoring'))
    })
  }
}

function formatVsPar(v) {
  if (v == null) return '—'
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
}

async function load() {
  loading.value = true
  try {
    const detail = await linkedStore.loadLinkedMatchDetail(route.params.id)
    if (!detail) return
    match.value = detail.match
    roundA.value = detail.roundA
    roundB.value = detail.roundB
    recompute()

    // Subscribe to live updates
    linkedStore.subscribeLinkedMatch(match.value, () => {
      linkedStore.reloadActiveMatchScores().then(() => {
        roundA.value = linkedStore.activeRoundA
        roundB.value = linkedStore.activeRoundB
        recompute()
      })
    })
  } finally {
    loading.value = false
  }
}

function recompute() {
  if (!match.value || !roundA.value) { result.value = null; return }
  try {
    result.value = computeLinkedMatch(roundA.value, roundB.value, match.value.match_config || {})
  } catch (e) {
    console.warn('[lmd] compute failed:', e)
    result.value = null
  }
}

/**
 * Manual override: host creates Foursome B's round by running the normal
 * wizard. Once the round is created it's automatically linked to this match
 * as round_b_id (via acceptLinkedMatch). The invite code gets used just like
 * the invitee flow — but the host does it all on their own phone.
 */
async function onManualB() {
  if (!match.value) return
  // Navigate to the accept flow for this match's code so the same wizard
  // + acceptLinkedMatch path runs. The user is already the host so the
  // "already linked" guard won't fire (they own round A, not round B).
  router.push(`/accept/${match.value.invite_code}`)
}

async function onCancel() {
  if (!match.value) return
  if (!confirm('Cancel this match? The invite code will stop working.')) return
  await linkedStore.cancelLinkedMatch(match.value.id)
  match.value = { ...match.value, status: 'cancelled' }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

onMounted(load)
onUnmounted(() => linkedStore.unsubscribeLinkedMatch())
watch(() => route.params.id, (id) => { if (id) load() })
</script>

<style scoped>
.lmd-view {
  min-height: 100%;
  background: var(--gw-neutral-950);
  padding: 0 0 calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}
.lmd-header {
  display: flex; align-items: center; gap: 10px;
  padding: 18px 16px 6px;
}
.lmd-back {
  background: transparent; border: none; color: var(--gw-text-muted);
  font-size: 14px; cursor: pointer; padding: 4px 6px;
  -webkit-tap-highlight-color: transparent;
}
.lmd-title {
  margin: 0; font-family: var(--gw-font-display); font-size: 22px; color: var(--gw-text);
}

.lmd-state {
  padding: 40px 24px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.lmd-state--error { color: #fca5a5; }
.lmd-state-icon { font-size: 40px; }
.lmd-spinner { font-size: 28px; color: var(--gw-gold); animation: spin 1s linear infinite; }
@keyframes spin { from {transform: rotate(0)} to {transform: rotate(360deg)} }

.lmd-status-card {
  display: flex; align-items: center; gap: 12px;
  margin: 8px 16px 12px; padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
}
.lmd-status-card.lmd-status--live {
  background: linear-gradient(135deg, rgba(212,175,55,.14), rgba(212,175,55,.04));
  border-color: rgba(212,175,55,.4);
}
.lmd-status-card.lmd-status--final {
  background: linear-gradient(135deg, rgba(34,197,94,.15), rgba(34,197,94,.04));
  border-color: rgba(34,197,94,.4);
}
.lmd-status-emoji { font-size: 24px; flex-shrink: 0; }
.lmd-status-label { font-size: 14px; font-weight: 700; color: var(--gw-text); line-height: 1.3; }

.lmd-teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: stretch;
  margin: 0 16px 14px;
}
.lmd-team {
  padding: 14px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  display: flex; flex-direction: column; gap: 4px;
}
.lmd-team--leading {
  background: rgba(34,197,94,.1);
  border-color: rgba(34,197,94,.4);
}
.lmd-team-label {
  font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: var(--gw-text-muted);
}
.lmd-team-name {
  font-family: var(--gw-font-mono, monospace);
  font-size: 15px; font-weight: 700; color: var(--gw-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lmd-team-score {
  display: flex; align-items: baseline; gap: 8px; margin-top: 4px;
}
.lmd-team-vs {
  font-family: var(--gw-font-mono, monospace);
  font-size: 24px; font-weight: 900; color: var(--gw-text);
}
.lmd-team-holes {
  font-size: 11px; color: var(--gw-text-muted);
}
.lmd-vs-chip {
  align-self: center;
  font-size: 12px; font-weight: 800; letter-spacing: .08em;
  color: var(--gw-text-muted); text-transform: uppercase;
}

.lmd-config {
  margin: 0 16px 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.06);
  display: flex; flex-direction: column; gap: 6px;
}
.lmd-config-row {
  display: flex; justify-content: space-between;
  font-size: 12px; color: rgba(240,237,224,.55);
}
.lmd-config-row strong { color: var(--gw-text); font-weight: 700; }

.lmd-section-label {
  margin: 14px 16px 6px;
  font-size: 11px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--gw-text-muted);
}

.lmd-holes-grid {
  margin: 0 16px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 12px;
  overflow: hidden;
}
.lmd-hole-row {
  display: grid;
  grid-template-columns: 44px 44px 1fr 1fr 1fr;
  padding: 6px 10px;
  border-top: 1px solid rgba(255,255,255,.05);
  font-family: var(--gw-font-mono, monospace);
  font-size: 13px;
}
.lmd-hole-row:first-child { border-top: none; }
.lmd-hole-row--head {
  background: rgba(0,0,0,.2);
  font-size: 10px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--gw-text-muted);
  font-family: var(--gw-font-body);
}
.lmd-hole-cell { text-align: center; color: var(--gw-text); }
.lmd-hole-cell--label { color: var(--gw-gold); font-weight: 800; text-align: left; }
.lmd-hole-cell--diff { font-weight: 800; }
.lmd-hole-row--a-wins .lmd-hole-cell--diff { color: #60a5fa; }
.lmd-hole-row--b-wins .lmd-hole-cell--diff { color: #f87171; }

.lmd-settlement {
  margin: 14px 0 0;
}
.lmd-settlement-card {
  margin: 6px 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(34,197,94,.08);
  border: 1px solid rgba(34,197,94,.3);
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--gw-text); line-height: 1.4;
}
.lmd-settlement-icon { font-size: 20px; flex-shrink: 0; }

.lmd-host-actions {
  display: flex; justify-content: center; padding: 20px 16px;
}
.lmd-btn-danger {
  padding: 10px 18px; border-radius: 10px;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.4);
  color: #f87171; font-size: 13px; font-weight: 700; cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

/* Manual override for when Foursome B has nobody with the app */
.lmd-manual-override {
  margin: 8px 16px 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(212,175,55,.08);
  border: 1px solid rgba(212,175,55,.3);
}
.lmd-override-body {
  font-size: 12px;
  color: rgba(240,237,224,.65);
  line-height: 1.45;
  margin-bottom: 10px;
}
.lmd-btn-override {
  width: 100%; padding: 12px 14px; border-radius: 12px;
  background: linear-gradient(135deg, #edd655, #d4af37, #b8961e);
  color: #0c0f0d; font-weight: 800; border: none; cursor: pointer;
  font-family: inherit; font-size: 14px; letter-spacing: .2px;
  -webkit-tap-highlight-color: transparent;
}
.lmd-btn-override:active { transform: scale(.98); }
</style>
