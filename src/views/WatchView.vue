<template>
  <div class="watch-view">
    <!-- Header -->
    <div class="watch-header">
      <button class="watch-back" @click="$router.back()">← Back</button>
      <div class="watch-title">
        <span class="watch-course">{{ round?.course_name || 'Loading…' }}</span>
        <span class="watch-badge">👁 Live</span>
      </div>
      <div class="watch-meta" v-if="round">
        {{ round.date }} · {{ holesLabel }} · {{ members.length }} players
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="watch-loading">
      <div class="watch-spinner"></div>
      <div>Connecting…</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="watch-error">
      <div class="watch-error-icon">⚠️</div>
      <div>{{ error }}</div>
      <button class="watch-retry" @click="init">Retry</button>
    </div>

    <!-- Scoreboard -->
    <div v-else-if="round" class="watch-body">
      <!-- Thru indicator -->
      <div class="watch-thru-row">
        <span v-for="m in members" :key="m.id" class="watch-thru-chip">
          {{ displayName(m) }}: <strong>{{ thruHole(m.id) || '—' }}</strong>
        </span>
      </div>

      <!-- Scorecard grid -->
      <div class="watch-table-wrap">
        <table class="watch-table">
          <thead>
            <tr>
              <th class="wt-name">Player</th>
              <th v-for="h in holeCount" :key="h" class="wt-hole">{{ h }}</th>
              <th class="wt-total">Tot</th>
            </tr>
            <!-- Par row -->
            <tr class="wt-par-row">
              <td class="wt-name">Par</td>
              <td v-for="h in holeCount" :key="h" class="wt-hole wt-par">{{ par[h - 1] }}</td>
              <td class="wt-total wt-par">{{ parTotal }}</td>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td class="wt-name">
                <span class="wt-player-name">{{ displayName(m) }}</span>
                <span class="wt-thru" v-if="thruHole(m.id)">thru {{ thruHole(m.id) }}</span>
              </td>
              <td
                v-for="h in holeCount" :key="h"
                class="wt-hole"
                :class="scoreClass(m.id, h)"
              >
                {{ scores[m.id]?.[h] ?? '' }}
              </td>
              <td class="wt-total">
                <span :class="totalClass(m.id)">{{ totalScore(m.id) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- To-par summary -->
      <div class="watch-summary">
        <div v-for="m in membersSortedByToPar" :key="m.id" class="watch-summary-row">
          <span class="ws-name">{{ displayName(m) }}</span>
          <span class="ws-topar" :class="toParClass(m.id)">{{ toParDisplay(m.id) }}</span>
          <span class="ws-thru">{{ thruHole(m.id) ? 'thru ' + thruHole(m.id) : 'not started' }}</span>
        </div>
      </div>

      <!-- Last updated -->
      <div class="watch-updated">Last updated: {{ lastUpdated }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import { getCourse } from '../modules/courses'

const route = useRoute()

const round = ref(null)
const members = ref([])
const scores = ref({})   // { memberId: { hole: score } }
const loading = ref(true)
const error = ref(null)
const lastUpdated = ref('—')

let scoreSub = null
let memberSub = null

// ── Derived data ─────────────────────────────────────────────
const holeCount = computed(() => {
  const mode = round.value?.holes_mode || '18'
  if (mode === '9f' || mode === '9b') return 9
  return 18
})

const holeOffset = computed(() => {
  return round.value?.holes_mode === '9b' ? 9 : 0
})

const par = computed(() => {
  const snap = round.value?.course_snapshot
  if (snap?.par) {
    const full = snap.par
    if (holeOffset.value) return full.slice(9, 18)
    return full.slice(0, holeCount.value)
  }
  const course = getCourse(round.value?.course_name)
  if (course?.par) {
    if (holeOffset.value) return course.par.slice(9, 18)
    return course.par.slice(0, holeCount.value)
  }
  return Array(holeCount.value).fill(4)
})

const parTotal = computed(() => par.value.reduce((a, b) => a + b, 0))

const holesLabel = computed(() => {
  const mode = round.value?.holes_mode || '18'
  if (mode === '9f') return 'Front 9'
  if (mode === '9b') return 'Back 9'
  return '18 holes'
})

function displayName(m) {
  if (m.use_nickname && m.nickname) return m.nickname
  return m.short_name || m.guest_name || '?'
}

function thruHole(memberId) {
  const s = scores.value[memberId] || {}
  const entered = Object.keys(s).map(Number).filter(h => s[h] != null && s[h] > 0)
  if (!entered.length) return null
  return Math.max(...entered)
}

function totalScore(memberId) {
  const s = scores.value[memberId] || {}
  let total = 0
  for (let h = 1; h <= holeCount.value; h++) {
    if (s[h] != null) total += s[h]
  }
  return total || ''
}

function toPar(memberId) {
  const s = scores.value[memberId] || {}
  let total = 0
  let holesPlayed = 0
  for (let h = 1; h <= holeCount.value; h++) {
    if (s[h] != null && s[h] > 0) {
      total += s[h] - par.value[h - 1]
      holesPlayed++
    }
  }
  if (!holesPlayed) return null
  return total
}

function toParDisplay(memberId) {
  const tp = toPar(memberId)
  if (tp == null) return '—'
  if (tp === 0) return 'E'
  return tp > 0 ? `+${tp}` : `${tp}`
}

const membersSortedByToPar = computed(() => {
  return [...members.value].sort((a, b) => {
    const ta = toPar(a.id) ?? 999
    const tb = toPar(b.id) ?? 999
    return ta - tb
  })
})

function scoreClass(memberId, hole) {
  const s = scores.value[memberId]?.[hole]
  if (s == null) return ''
  const p = par.value[hole - 1]
  const diff = s - p
  if (diff <= -2) return 'sc-eagle'
  if (diff === -1) return 'sc-birdie'
  if (diff === 0) return 'sc-par'
  if (diff === 1) return 'sc-bogey'
  if (diff === 2) return 'sc-double'
  return 'sc-worse'
}

function toParClass(memberId) {
  const tp = toPar(memberId)
  if (tp == null) return ''
  if (tp < 0) return 'tp-under'
  if (tp === 0) return 'tp-even'
  return 'tp-over'
}

function totalClass(memberId) {
  const tp = toPar(memberId)
  if (tp == null) return ''
  if (tp < 0) return 'tp-under'
  if (tp === 0) return 'tp-even'
  if (tp > 0) return 'tp-over'
  return ''
}

// ── Data loading ─────────────────────────────────────────────
async function init() {
  loading.value = true
  error.value = null
  const roundId = route.params.id

  try {
    const { data, error: err } = await supabase
      .from('rounds')
      .select('*, round_members(*), scores(*)')
      .eq('id', roundId)
      .single()

    if (err) throw err

    round.value = data
    members.value = data.round_members ?? []

    // Build scores map
    const sm = {}
    for (const s of (data.scores ?? [])) {
      if (!sm[s.member_id]) sm[s.member_id] = {}
      sm[s.member_id][s.hole] = s.score
    }
    scores.value = sm
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (e) {
    error.value = e.message || 'Could not load round'
  } finally {
    loading.value = false
  }

  // Subscribe to live updates
  subscribe(roundId)
}

function subscribe(roundId) {
  if (scoreSub) supabase.removeChannel(scoreSub)
  if (memberSub) supabase.removeChannel(memberSub)

  scoreSub = supabase
    .channel(`watch-scores:${roundId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'scores',
      filter: `round_id=eq.${roundId}`,
    }, payload => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const s = payload.new
        if (!scores.value[s.member_id]) scores.value[s.member_id] = {}
        scores.value[s.member_id][s.hole] = s.score
        lastUpdated.value = new Date().toLocaleTimeString()
      }
    })
    .subscribe()

  memberSub = supabase
    .channel(`watch-members:${roundId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'round_members',
      filter: `round_id=eq.${roundId}`,
    }, payload => {
      if (!members.value.find(m => m.id === payload.new.id)) {
        members.value.push(payload.new)
      }
    })
    .subscribe()
}

onMounted(init)

onUnmounted(() => {
  if (scoreSub) supabase.removeChannel(scoreSub)
  if (memberSub) supabase.removeChannel(memberSub)
})
</script>

<style scoped>
.watch-view {
  min-height: 100vh;
  background: var(--gw-bg, #0a0d0b);
  color: var(--gw-text, #e8f5ee);
  display: flex;
  flex-direction: column;
  padding-bottom: 80px;
}

.watch-header {
  background: linear-gradient(150deg, #0f3d28 0%, #0c1810 80%);
  padding: 16px 16px 12px;
  border-bottom: 1px solid #1e3528;
}
.watch-back {
  background: none;
  border: none;
  color: #34c77e;
  font-size: 15px;
  padding: 0;
  cursor: pointer;
  margin-bottom: 8px;
}
.watch-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.watch-course {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}
.watch-badge {
  font-size: 11px;
  font-weight: 600;
  background: rgba(52, 199, 126, 0.15);
  border: 1px solid rgba(52, 199, 126, 0.4);
  color: #34c77e;
  border-radius: 20px;
  padding: 2px 8px;
  letter-spacing: 0.5px;
  animation: pulse-badge 2s ease-in-out infinite;
}
@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.watch-meta {
  font-size: 12px;
  color: #7d9283;
  margin-top: 4px;
}

/* Loading / error */
.watch-loading, .watch-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 24px;
  color: #7d9283;
  font-size: 14px;
}
.watch-spinner {
  width: 28px; height: 28px;
  border: 3px solid #1e3528;
  border-top-color: #34c77e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.watch-error-icon { font-size: 32px; }
.watch-retry {
  background: #1a7a55; color: #fff; border: none;
  border-radius: 10px; padding: 10px 20px; font-size: 14px;
  cursor: pointer;
}

/* Body */
.watch-body { padding: 12px 0 0; }

/* Thru chips */
.watch-thru-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 12px 10px;
}
.watch-thru-chip {
  font-size: 12px;
  color: #a3b8aa;
  background: #0d1a12;
  border: 1px solid #1e3528;
  border-radius: 20px;
  padding: 3px 10px;
}
.watch-thru-chip strong { color: #34c77e; }

/* Scorecard table */
.watch-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 4px;
}
.watch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 600px;
}
.wt-name {
  position: sticky;
  left: 0;
  background: #0d1a12;
  z-index: 2;
  text-align: left;
  padding: 6px 8px;
  border-right: 1px solid #1e3528;
  min-width: 80px;
  max-width: 110px;
}
th.wt-name { color: #7d9283; font-weight: 500; }
.wt-hole {
  text-align: center;
  padding: 6px 5px;
  min-width: 26px;
  border-right: 1px solid #111;
}
th.wt-hole { color: #7d9283; font-weight: 500; }
.wt-total {
  text-align: center;
  padding: 6px 8px;
  font-weight: 700;
  border-left: 1px solid #1e3528;
  min-width: 36px;
  position: sticky;
  right: 0;
  background: #0d1a12;
}
.wt-par-row td { color: #7d9283; font-size: 11px; }
.wt-par { font-weight: 500; }

/* Score colours */
.sc-eagle  { background: #1a4d6e; color: #7ed4ff; border-radius: 50%; font-weight: 700; }
.sc-birdie { background: #0d3d28; color: #34c77e; border-radius: 50%; }
.sc-par    { color: #e8f5ee; }
.sc-bogey  { background: #3d1a1a; color: #ff7b7b; }
.sc-double { background: #5c1a1a; color: #ff5252; font-weight: 600; }
.sc-worse  { background: #7a1a1a; color: #ff2222; font-weight: 700; }

.wt-player-name { display: block; color: #e8f5ee; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wt-thru { display: block; font-size: 10px; color: #5a7060; }

/* To-par summary */
.watch-summary {
  margin: 12px 12px 0;
  background: #0d1a12;
  border: 1px solid #1e3528;
  border-radius: 12px;
  overflow: hidden;
}
.watch-summary-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #111;
}
.watch-summary-row:last-child { border-bottom: none; }
.ws-name { flex: 1; font-size: 14px; color: #e8f5ee; font-weight: 500; }
.ws-topar { font-size: 16px; font-weight: 700; min-width: 36px; text-align: center; }
.ws-thru { font-size: 11px; color: #5a7060; }

.tp-under { color: #34c77e; }
.tp-even  { color: #7d9283; }
.tp-over  { color: #ff7b7b; }

.watch-updated {
  text-align: center;
  font-size: 11px;
  color: #3d5444;
  padding: 10px;
}
</style>
