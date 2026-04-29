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
        >{{ tab.label }}</button>
      </div>

      <!-- Scorecard table -->
      <div v-if="activeScorecardRound" class="lmd-sc-wrap">
        <div class="lmd-sc-grid" :style="scorecardGridStyle">
          <!-- Header: hole numbers -->
          <div class="lmd-sc-cell lmd-sc-head lmd-sc-label">Hole</div>
          <template v-for="col in scorecardColumns" :key="'h-'+col.key">
            <div class="lmd-sc-cell lmd-sc-head" :class="col.isTotal ? 'lmd-sc-sub-head' : ''">{{ col.label }}</div>
          </template>

          <!-- Par row -->
          <div class="lmd-sc-cell lmd-sc-par-label">Par</div>
          <template v-for="col in scorecardColumns" :key="'par-'+col.key">
            <div class="lmd-sc-cell lmd-sc-par" :class="col.isTotal ? 'lmd-sc-sub-val' : ''">
              {{ col.isTotal ? col.parTotal : (parForHole(activeScorecardRound, col.hole) || '—') }}
            </div>
          </template>

          <!-- Player rows -->
          <template v-for="m in activeScorecardMembers" :key="m.id">
            <div class="lmd-sc-cell lmd-sc-player">{{ m.short_name || '?' }}</div>
            <template v-for="col in scorecardColumns" :key="m.id+'-'+col.key">
              <div
                v-if="!col.isTotal"
                class="lmd-sc-cell lmd-sc-score-cell"
                :class="scoreClass(activeScorecardRound, m.id, col.hole)"
              >
                <span class="lmd-sc-score-num">{{ scoreForMember(activeScorecardRound, m.id, col.hole) }}</span>
                <span v-if="memberStrokesOnHole(activeScorecardRound, m.id, col.hole) > 0" class="lmd-sc-stroke-dot">{{ '•'.repeat(memberStrokesOnHole(activeScorecardRound, m.id, col.hole)) }}</span>
              </div>
              <div v-else class="lmd-sc-cell lmd-sc-sub-val">
                {{ memberRangeTotal(activeScorecardRound, m.id, col.from, col.to) }}
              </div>
            </template>
          </template>
        </div>
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
    // Back-fill settlement_json on the DB row if match is complete but was never persisted
    if (match.value.status === 'complete' && !match.value.settlement_json && result.value?.allHolesComplete) {
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

// Build column definitions for the scorecard grid (holes + Out/In/Total subtotals)
const scorecardColumns = computed(() => {
  const r = activeScorecardRound.value
  const mode = r?.holes_mode || '18'
  const cols = []
  if (mode === 'front9') {
    for (let h = 1; h <= 9; h++) cols.push({ key: h, label: String(h), hole: h, isTotal: false })
    cols.push({ key: 'out', label: 'Out', isTotal: true, from: 1, to: 9, parTotal: parRangeTotal(r, 1, 9) })
  } else if (mode === 'back9') {
    for (let h = 10; h <= 18; h++) cols.push({ key: h, label: String(h), hole: h, isTotal: false })
    cols.push({ key: 'in', label: 'In', isTotal: true, from: 10, to: 18, parTotal: parRangeTotal(r, 10, 18) })
  } else {
    for (let h = 1; h <= 9; h++) cols.push({ key: h, label: String(h), hole: h, isTotal: false })
    cols.push({ key: 'out', label: 'Out', isTotal: true, from: 1, to: 9, parTotal: parRangeTotal(r, 1, 9) })
    for (let h = 10; h <= 18; h++) cols.push({ key: h, label: String(h), hole: h, isTotal: false })
    cols.push({ key: 'in', label: 'In', isTotal: true, from: 10, to: 18, parTotal: parRangeTotal(r, 10, 18) })
    cols.push({ key: 'tot', label: 'Tot', isTotal: true, from: 1, to: 18, parTotal: parRangeTotal(r, 1, 18) })
  }
  return cols
})

// Grid style: 48px name col, 26px per hole, 34px per subtotal col
const scorecardGridStyle = computed(() => {
  const cols = scorecardColumns.value
  const colDefs = cols.map(c => c.isTotal ? '34px' : '26px').join(' ')
  return `grid-template-columns: 48px ${colDefs}`
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
  font-family: var(--gw-font-body, system-ui);
  font-size: 13px; font-weight: 700; color: var(--gw-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.2;
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
  flex: 1; padding: 8px 12px; border-radius: 10px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04); color: var(--gw-text-muted);
  font-family: inherit; -webkit-tap-highlight-color: transparent;
  transition: background .12s, border-color .12s, color .12s;
}
.lmd-sc-tab.active {
  background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.5);
  color: var(--gw-gold);
}

.lmd-sc-wrap {
  margin: 0 16px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.06);
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.lmd-sc-wrap::-webkit-scrollbar { display: none; }
.lmd-sc-grid {
  display: grid;
  min-width: max-content;
}
.lmd-sc-cell {
  padding: 4px 1px;
  text-align: center;
  font-family: var(--gw-font-mono, monospace);
  font-size: 11px;
  color: var(--gw-text);
  border-top: 1px solid rgba(255,255,255,.05);
  position: relative;
}
.lmd-sc-head {
  background: rgba(0,0,0,.25);
  font-family: var(--gw-font-body);
  font-size: 9px; font-weight: 800; letter-spacing: .04em;
  text-transform: uppercase; color: var(--gw-text-muted);
  border-top: none; padding: 5px 1px;
}
.lmd-sc-sub-head {
  background: rgba(0,0,0,.35);
  color: var(--gw-gold);
}
.lmd-sc-sub-val {
  background: rgba(0,0,0,.2);
  font-weight: 800;
  color: var(--gw-text);
  border-left: 1px solid rgba(255,255,255,.07);
}
.lmd-sc-label, .lmd-sc-par-label, .lmd-sc-total-label, .lmd-sc-player {
  text-align: left; padding-left: 6px;
}
.lmd-sc-label { color: var(--gw-gold); }
.lmd-sc-par-label { font-size: 8px; font-weight: 700; color: var(--gw-text-muted); text-transform: uppercase; background: rgba(0,0,0,.1); }
.lmd-sc-par { background: rgba(0,0,0,.1); color: var(--gw-text-muted); font-size: 10px; }
.lmd-sc-player { font-family: var(--gw-font-body); font-size: 10px; font-weight: 700; color: var(--gw-text); white-space: nowrap; }
.lmd-sc-empty-cell { color: var(--gw-text-muted); }
.lmd-sc-score-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 30px; }
.lmd-sc-score-num { line-height: 1; }
.lmd-sc-stroke-dot { font-size: 6px; color: rgba(255,255,255,.45); line-height: 1; margin-top: 1px; letter-spacing: -1px; }

/* Score coloring — circle style like ScoringView */
.sc-eagle  { background: rgba(245,158,11,.30); color: #fbbf24; font-weight: 900; border-radius: 50%; }
.sc-birdie { background: rgba(34,197,94,.25);  color: #4ade80; font-weight: 800; border-radius: 50%; }
.sc-par    { color: var(--gw-text); }
.sc-bogey  { background: rgba(239,68,68,.20); color: #f87171; border-radius: 50%; }
.sc-double { background: rgba(153,27,27,.30); color: #fca5a5; border-radius: 50%; font-weight: 700; }

.lmd-sc-empty {
  margin: 0 16px; padding: 16px; text-align: center;
  font-size: 13px; color: var(--gw-text-muted);
  background: rgba(255,255,255,.03); border-radius: 12px;
  border: 1px solid rgba(255,255,255,.06);
}
</style>
