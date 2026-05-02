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
      <!-- DEBUG: on-screen diagnostics (remove after fix confirmed) -->
      <div v-if="debugInfo" style="background:#1a1a2e;border:1px solid #e94560;border-radius:8px;margin:8px 16px;padding:10px 12px;font-size:12px;color:#eee;font-family:monospace;line-height:1.5;word-break:break-all;">
        <div style="color:#e94560;font-weight:bold;margin-bottom:4px;">v3.10.119 debug</div>
        <div>match: {{ match?.id?.slice(0,8) }} status={{ match?.status }}</div>
        <div>roundA: {{ roundA ? `${roundA.id?.slice(0,8)} members=${roundA.round_members?.length} scores=${roundA.scores?.length}` : 'null' }}</div>
        <div>roundB: {{ roundB ? `${roundB.id?.slice(0,8)} members=${roundB.round_members?.length} scores=${roundB.scores?.length}` : 'null' }}</div>
        <div>result: holesBoth={{ result?.holesBoth ?? '?' }} leader={{ result?.currentLeader ?? 'none' }} teamA={{ result?.teamA?.name || '?' }} teamB={{ result?.teamB?.name || '?' }}</div>
        <div v-if="computeError" style="color:#ff4444;margin-top:4px;">ERROR: {{ computeError }}</div>
        <div>config: balls={{ match?.match_config?.ballsToCount }} stake={{ match?.match_config?.stake }} hcpPct={{ match?.match_config?.hcpPct }}</div>
      </div>

      <!-- Status card -->
      <div class="lmd-status-card" :class="`lmd-status--${summary.state}`">
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
      <div class="lmd-section-label">Hole-by-Hole <span class="lmd-legend">2BB net vs par · Lead = cumulative advantage</span></div>
      <div class="lmd-holes-grid">
        <div class="lmd-hole-row lmd-hole-row--head">
          <div class="lmd-hole-cell lmd-hole-cell--label">Hole</div>
          <div class="lmd-hole-cell">Par</div>
          <div class="lmd-hole-cell">A</div>
          <div class="lmd-hole-cell">B</div>
          <div class="lmd-hole-cell">Lead</div>
        </div>
        <div
          v-for="row in perHoleCumulative"
          :key="row.hole"
          class="lmd-hole-row"
          :class="{
            'lmd-hole-row--a-wins': row.cumDiff != null && row.cumDiff < 0,
            'lmd-hole-row--b-wins': row.cumDiff != null && row.cumDiff > 0,
          }"
        >
          <div class="lmd-hole-cell lmd-hole-cell--label">{{ row.hole }}</div>
          <div class="lmd-hole-cell">{{ row.par }}</div>
          <div class="lmd-hole-cell">{{ row.a ? formatVsPar(row.a.vsPar) : '—' }}</div>
          <div class="lmd-hole-cell">{{ row.b ? formatVsPar(row.b.vsPar) : '—' }}</div>
          <div class="lmd-hole-cell lmd-hole-cell--diff">
            <template v-if="row.cumDiff == null">—</template>
            <template v-else-if="row.cumDiff < 0">A +{{ Math.abs(row.cumDiff) }}</template>
            <template v-else-if="row.cumDiff > 0">B +{{ row.cumDiff }}</template>
            <template v-else>AS</template>
          </div>
        </div>
      </div>

      <!-- Final settlement + side bets -->
      <div v-if="result?.allHolesComplete || result?.sideBetResults?.length" class="lmd-settlement">
        <div class="lmd-section-label">Settlement</div>

        <!-- Net summary (main + all side bets combined) -->
        <div v-if="result?.netSettlement" class="lmd-net-card" :class="result.netSettlement.winningTeam ? 'lmd-net-card--winner' : 'lmd-net-card--tied'">
          <span class="lmd-net-icon">{{ result.netSettlement.winningTeam ? '🏆' : '🤝' }}</span>
          <div class="lmd-net-body">
            <div class="lmd-net-summary">{{ result.netSettlement.summary }}</div>
            <div class="lmd-net-perplayer" v-if="result.netSettlement.winningTeam">
              ${{ result.netSettlement.totalNetPerPlayer.toFixed(0) }} / player · all bets included
            </div>
          </div>
        </div>
        <div v-else-if="result?.settlement && !result?.netSettlement" class="lmd-settlement-card" :class="result.settlement.winner ? 'lmd-settlement-card--payout' : ''">
          <span class="lmd-settlement-icon">{{ result.settlement.winner ? '💰' : '🤝' }}</span>
          <span>{{ result.settlement.winner ? result.settlement.description : 'All square — no payment.' }}</span>
        </div>

        <!-- Main match line -->
        <div v-if="result?.settlement" class="lmd-settle-line">
          <span class="lmd-settle-line-label">Main match (${{ result.settlement.stakePerPlayer }}/player)</span>
          <span class="lmd-settle-line-val" :class="result.settlement.winner ? 'lmd-val--win' : 'lmd-val--tie'">
            {{ result.settlement.winner ? `Foursome ${result.settlement.winner} wins` : 'Tied' }}
          </span>
        </div>

        <!-- Side bet lines -->
        <template v-if="result?.sideBetResults?.length">
          <div class="lmd-settle-divider">Side bets</div>
          <div v-for="sb in result.sideBetResults" :key="sb.type" class="lmd-settle-line">
            <span class="lmd-settle-line-label">
              {{ sideBetLabel(sb.type) }}
              <span class="lmd-sb-stake-tag">${{ sb.stake }}/player</span>
            </span>
            <span class="lmd-settle-line-val"
              :class="sb.settled ? (sb.winner || sb.netA !== 0 ? 'lmd-val--win' : 'lmd-val--tie') : 'lmd-val--pending'">
              {{ sideBetStatus(sb) }}
            </span>
          </div>
        </template>
      </div>


      <!-- ── Scorecards ── -->
      <div class="lmd-section-label" style="margin-top:20px">Scorecards</div>

      <!-- Scorecard toggle -->
      <div class="lmd-sc-tabs">
        <button
          v-for="tab in scorecardTabs"
          :key="tab.key"
          class="lmd-sc-tab"
          :class="{ active: scorecardTab === tab.key }"
          @click="scorecardTab = tab.key"
        >
          <span class="lmd-sc-tab-badge">{{ tab.key.toUpperCase() }}</span>
          <span class="lmd-sc-tab-name">{{ tab.label }}</span>
        </button>
      </div>

      <!-- Scorecard — split front/back 9 stacked vertically -->
      <div v-if="activeScorecardRound" class="lmd-sc-container">
        <template v-for="nine in scorecardNines" :key="nine.label">
          <div class="lmd-sc-nine-label">{{ nine.label }}</div>
          <div class="lmd-sc-table">
            <!-- Header row: hole numbers + total -->
            <div class="lmd-sc-row lmd-sc-row--head">
              <div class="lmd-sc-name-cell"></div>
              <div v-for="h in nine.holes" :key="h" class="lmd-sc-hole-cell lmd-sc-hole-num">{{ h }}</div>
              <div class="lmd-sc-tot-cell lmd-sc-hole-num">{{ nine.totalLabel }}</div>
            </div>
            <!-- Par row -->
            <div class="lmd-sc-row lmd-sc-row--par">
              <div class="lmd-sc-name-cell lmd-sc-par-label">Par</div>
              <div v-for="h in nine.holes" :key="h" class="lmd-sc-hole-cell">{{ parForHole(activeScorecardRound, h) || '—' }}</div>
              <div class="lmd-sc-tot-cell">{{ parRangeTotal(activeScorecardRound, nine.from, nine.to) }}</div>
            </div>
            <!-- Player rows -->
            <div v-for="m in activeScorecardMembers" :key="m.id" class="lmd-sc-row">
              <div class="lmd-sc-name-cell lmd-sc-player-name">{{ m.short_name || m.full_name?.split(' ')[0] || '?' }}</div>
              <div
                v-for="h in nine.holes"
                :key="h"
                class="lmd-sc-hole-cell lmd-sc-score"
                :class="scoreClass(activeScorecardRound, m.id, h)"
              >
                <span class="lmd-sc-score-val">{{ scoreForMember(activeScorecardRound, m.id, h) }}</span>
                <span v-if="memberStrokesOnHole(activeScorecardRound, m.id, h) > 0" class="lmd-sc-stroke-pip"></span>
              </div>
              <div class="lmd-sc-tot-cell lmd-sc-range-tot">{{ memberRangeTotal(activeScorecardRound, m.id, nine.from, nine.to) }}</div>
            </div>
          </div>
        </template>
      </div>
      <div v-else class="lmd-sc-empty">Scores not yet available</div>

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
const computeError = ref(null)

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

// Hole-by-hole with cumulative delta
const perHoleCumulative = computed(() => {
  let cum = 0
  return (result.value?.perHole || []).map(row => {
    if (row.diff != null) cum += row.diff
    return { ...row, cumDiff: row.diff != null ? cum : null }
  })
})
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

function sideBetLabel(type) {
  const labels = {
    mostBirdies: 'Most Birdies',
    front9: 'Front 9',
    back9: 'Back 9',
    eagleBounty: 'Eagle Bounty',
    fewestDoubles: 'Fewest Doubles',
  }
  return labels[type] || type
}

function sideBetStatus(sb) {
  if (!sb.settled) return 'In progress'
  if (sb.type === 'eagleBounty') {
    if (sb.netA > 0) return 'A leads'
    if (sb.netA < 0) return 'B leads'
    return 'Even'
  }
  return sb.winner ? `Foursome ${sb.winner} wins` : 'Tied'
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
  if (!match.value || !roundA.value) { result.value = null; computeError.value = 'no match or roundA'; return }
  try {
    computeError.value = null
    result.value = computeLinkedMatch(roundA.value, roundB.value, match.value.match_config || {})
    // Always re-persist settlement_json when match is complete — ensures stale data gets overwritten
    // (e.g. after SI bug fix, old snapshots had wrong stroke allocations)
    if (match.value.status === 'complete' && result.value?.allHolesComplete) {
      linkedStore._checkAndPersistSettlement(match.value).catch(() => {})
    }
  } catch (e) {
    console.warn('[lmd] compute failed:', e)
    computeError.value = e?.message || String(e)
    result.value = null
  }
}

async function onManualB() {
  if (!match.value) return
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

// ── Scorecards ────────────────────────────────────────────────────
const scorecardTab = ref('a')

const scorecardTabs = computed(() => {
  const tabs = [{ key: 'a', label: result.value?.teamA?.name || 'Foursome A' }]
  if (roundB.value) tabs.push({ key: 'b', label: result.value?.teamB?.name || 'Foursome B' })
  return tabs
})

const activeScorecardRound = computed(() =>
  scorecardTab.value === 'a' ? roundA.value : roundB.value
)

const activeScorecardMembers = computed(() => {
  const r = activeScorecardRound.value
  return r?.round_members || []
})

const activeScorecardHoles = computed(() => {
  const r = activeScorecardRound.value
  const mode = r?.holes_mode || '18'
  if (mode === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1)
  if (mode === 'back9')  return Array.from({ length: 9 }, (_, i) => i + 10)
  return Array.from({ length: 18 }, (_, i) => i + 1)
})

// Split scorecard into front/back nines for stacked display
const scorecardNines = computed(() => {
  const r = activeScorecardRound.value
  const mode = r?.holes_mode || '18'
  if (mode === 'front9') {
    return [{ label: 'Front 9', totalLabel: 'Out', holes: Array.from({length:9},(_,i)=>i+1), from:1, to:9 }]
  }
  if (mode === 'back9') {
    return [{ label: 'Back 9', totalLabel: 'In', holes: Array.from({length:9},(_,i)=>i+10), from:10, to:18 }]
  }
  return [
    { label: 'Front 9', totalLabel: 'Out', holes: Array.from({length:9},(_,i)=>i+1), from:1, to:9 },
    { label: 'Back 9',  totalLabel: 'In',  holes: Array.from({length:9},(_,i)=>i+10), from:10, to:18 },
  ]
})

function parRangeTotal(round, from, to) {
  const par = round?.course_snapshot?.par
  if (!Array.isArray(par)) return '—'
  let sum = 0
  for (let h = from; h <= to; h++) sum += par[h - 1] ?? 4
  return sum
}

function memberRangeTotal(round, memberId, from, to) {
  if (!round?.scores) return '—'
  let sum = 0; let found = 0
  for (let h = from; h <= to; h++) {
    const s = round.scores.find(sc => sc.member_id === memberId && sc.hole === h)
    if (s?.score != null) { sum += s.score; found++ }
  }
  return found > 0 ? sum : '—'
}

// Stroke dots: how many strokes does this player get on this hole in the cross match
function memberStrokesOnHole(round, memberId, hole) {
  if (!round) return 0
  const m = round.round_members?.find(rm => rm.id === memberId)
  if (!m) return 0
  const si = round?.course_snapshot?.si
  if (!Array.isArray(si) || si.length < 18) return 0
  const holeSI = si[hole - 1]
  // Playing hcp: round(ghin * slope/113 + (rating - par)) * 0.90
  const raw = m.ghin_index ?? m.round_hcp ?? 0
  const snap = round.course_snapshot || {}
  const slope = snap.slope_rating ?? snap.slope ?? 113
  const rating = snap.course_rating ?? snap.rating ?? 72
  const par = Array.isArray(snap.par) ? snap.par.reduce((a, b) => a + b, 0) : 72
  const ch = Math.round(raw * (slope / 113) + (rating - par))
  const playingHcp = Math.round(ch * 0.90)
  if (playingHcp <= 0) return 0
  const base = Math.floor(playingHcp / 18)
  const extra = playingHcp % 18
  return base + (holeSI <= extra ? 1 : 0)
}

function parForHole(round, hole) {
  // course_snapshot.par is a 0-indexed array stored at round creation time
  const par = round?.course_snapshot?.par
  if (Array.isArray(par)) return par[hole - 1] ?? null
  return null
}

function scoreForMember(round, memberId, hole) {
  if (!round?.scores) return '—'
  const s = round.scores.find(sc => sc.member_id === memberId && sc.hole === hole)
  return s?.score ?? '—'
}

function memberTotal(round, memberId) {
  if (!round?.scores) return '—'
  const scores = round.scores.filter(sc => sc.member_id === memberId && sc.score != null)
  if (!scores.length) return '—'
  return scores.reduce((sum, sc) => sum + sc.score, 0)
}

function scoreClass(round, memberId, hole) {
  const score = scoreForMember(round, memberId, hole)
  if (score === '—') return 'lmd-sc-empty-cell'
  const par = parForHole(round, hole)
  if (!par) return ''
  const diff = score - par
  if (diff <= -2) return 'sc-eagle'
  if (diff === -1) return 'sc-birdie'
  if (diff === 0)  return 'sc-par'
  if (diff === 1)  return 'sc-bogey'
  if (diff >= 2)   return 'sc-double'
  return ''
}

onMounted(load)
onUnmounted(() => linkedStore.unsubscribeLinkedMatch())
watch(() => route.params.id, (id) => { if (id) load() })
</script>

<style scoped>
.lmd-view {
  min-height: 100%;
  background: var(--gw-bg-app);
  padding: 0 0 calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}
.lmd-header {
  display: flex; align-items: center; gap: 10px;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px;
  position: sticky; top: 0; z-index: 20;
  background: var(--gw-bg-app);
  border-bottom: 1px solid rgba(255,255,255,.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
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
  font-family: var(--gw-font-body, system-ui);
  font-size: 12px; font-weight: 700; color: var(--gw-text);
  line-height: 1.3; word-break: break-word;
}
.lmd-team-score {
  display: flex; align-items: baseline; gap: 8px; margin-top: 4px;
}
.lmd-team-vs {
  font-family: var(--gw-font-mono, monospace);
  font-size: 20px; font-weight: 900; color: var(--gw-text);
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
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.lmd-legend {
  font-size: 9px; font-weight: 500; letter-spacing: .02em;
  text-transform: none; color: var(--gw-text-muted);
  opacity: 0.7;
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

.lmd-net-card {
  margin: 0 16px 6px; padding: 14px 16px; border-radius: 14px;
  display: flex; align-items: flex-start; gap: 12px;
  border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04);
}
.lmd-net-card--winner {
  background: linear-gradient(135deg, rgba(212,175,55,.14), rgba(212,175,55,.04));
  border-color: rgba(212,175,55,.4);
}
.lmd-net-card--tied {
  background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.1);
}
.lmd-net-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
.lmd-net-body { display: flex; flex-direction: column; gap: 3px; }
.lmd-net-summary { font-size: 14px; font-weight: 700; color: var(--gw-text); line-height: 1.3; }
.lmd-net-perplayer { font-size: 11px; color: var(--gw-text-muted); }

.lmd-settle-line {
  display: flex; justify-content: space-between; align-items: center;
  margin: 0 16px; padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
  font-size: 13px;
}
.lmd-settle-line:last-child { border-bottom: none; }
.lmd-settle-line-label {
  color: rgba(240,237,224,.6); display: flex; align-items: center; gap: 6px;
}
.lmd-sb-stake-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: rgba(255,255,255,.07); color: var(--gw-text-muted); font-weight: 600;
}
.lmd-settle-line-val { font-weight: 700; font-size: 12px; }
.lmd-val--win { color: #4ade80; }
.lmd-val--tie { color: var(--gw-text-muted); }
.lmd-val--pending { color: #fbbf24; font-style: italic; }

.lmd-settle-divider {
  margin: 6px 16px 2px;
  font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: var(--gw-text-muted);
}

/* ── Scorecard ── */
.lmd-sc-tabs {
  display: flex; gap: 8px; margin: 0 16px 10px;
}
.lmd-sc-tab {
  flex: 1; min-width: 0;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 8px; border-radius: 10px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04); color: var(--gw-text-muted);
  font-family: inherit; -webkit-tap-highlight-color: transparent;
  transition: background .12s, border-color .12s, color .12s;
  overflow: hidden;
}
.lmd-sc-tab.active {
  background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.5);
  color: var(--gw-gold);
}
.lmd-sc-tab-badge {
  flex-shrink: 0;
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 900;
  background: rgba(255,255,255,.1);
}
.lmd-sc-tab.active .lmd-sc-tab-badge {
  background: rgba(212,175,55,.3);
}
.lmd-sc-tab-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px;
}

/* ── Scorecard stacked 9-hole tables ── */
.lmd-sc-container {
  margin: 0 16px;
  display: flex; flex-direction: column; gap: 12px;
}

.lmd-sc-nine-label {
  font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: var(--gw-text-muted);
  margin-bottom: 4px;
}

.lmd-sc-table {
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.07);
  overflow: hidden;
  background: rgba(0,0,0,.2);
}

/* Each row is a flex row */
.lmd-sc-row {
  display: flex; align-items: stretch;
  border-top: 1px solid rgba(255,255,255,.05);
}
.lmd-sc-row:first-child { border-top: none; }

/* Name column — fixed width, left-aligned */
.lmd-sc-name-cell {
  width: 52px; min-width: 52px;
  display: flex; align-items: center;
  padding: 0 6px;
  font-family: var(--gw-font-body);
  border-right: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0;
}

/* Hole columns — equal flex */
.lmd-sc-hole-cell {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--gw-font-mono, monospace);
  font-size: 13px;
  min-width: 0;
  position: relative;
  height: 34px;
}

/* Total column — slightly wider, visually separated */
.lmd-sc-tot-cell {
  width: 36px; min-width: 36px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--gw-font-mono, monospace);
  font-size: 13px; font-weight: 800;
  border-left: 1px solid rgba(255,255,255,.1);
  background: rgba(0,0,0,.2);
  flex-shrink: 0;
}

/* Header row */
.lmd-sc-row--head {
  background: rgba(0,0,0,.3);
}
.lmd-sc-hole-num {
  font-family: var(--gw-font-body);
  font-size: 10px; font-weight: 800;
  color: var(--gw-gold);
  height: 24px;
}

/* Par row */
.lmd-sc-row--par {
  background: rgba(0,0,0,.15);
}
.lmd-sc-par-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  color: var(--gw-text-muted);
}
.lmd-sc-row--par .lmd-sc-hole-cell,
.lmd-sc-row--par .lmd-sc-tot-cell {
  font-size: 11px; color: var(--gw-text-muted); font-weight: 400;
  height: 22px;
}

/* Player name */
.lmd-sc-player-name {
  font-size: 11px; font-weight: 700; color: var(--gw-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Range total cell in player rows */
.lmd-sc-range-tot {
  color: var(--gw-text); font-size: 13px;
}

/* Score cell */
.lmd-sc-score {
  position: relative;
}
.lmd-sc-score-val {
  font-size: 13px; font-weight: 700;
  line-height: 1;
}
/* Stroke pip — small dot top-right corner */
.lmd-sc-stroke-pip {
  position: absolute;
  top: 3px; right: 3px;
  width: 5px; height: 5px; border-radius: 50%;
  background: rgba(255,255,255,.55);
}

/* Score coloring — subtle background fill, no borders */
.sc-eagle  { background: rgba(245,158,11,.22); }
.sc-eagle  .lmd-sc-score-val { color: #fbbf24; font-weight: 900; }
.sc-birdie { background: rgba(34,197,94,.18); }
.sc-birdie .lmd-sc-score-val { color: #4ade80; font-weight: 800; }
.sc-par    .lmd-sc-score-val { color: rgba(240,237,224,.75); }
.sc-bogey  { background: rgba(239,68,68,.18); }
.sc-bogey  .lmd-sc-score-val { color: #f87171; }
.sc-double { background: rgba(153,27,27,.30); }
.sc-double .lmd-sc-score-val { color: #fca5a5; font-weight: 800; }

.lmd-sc-empty {
  margin: 0 16px; padding: 16px; text-align: center;
  font-size: 13px; color: var(--gw-text-muted);
  background: rgba(255,255,255,.03); border-radius: 12px;
  border: 1px solid rgba(255,255,255,.06);
}
</style>
