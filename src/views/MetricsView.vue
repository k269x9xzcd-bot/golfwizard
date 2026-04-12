<template>
  <div class="metrics-page">
    <header class="metrics-header">
      <h1 class="metrics-title">Metrics Lab</h1>
      <p class="metrics-subtitle">Season stats, head-to-head, and performance trends</p>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <div class="loading-text">Crunching numbers…</div>
    </div>

    <!-- Empty -->
    <div v-else-if="!allRounds.length" class="empty-state">
      <div class="empty-icon">📊</div>
      <div class="empty-title">No data yet</div>
      <div class="empty-sub">Complete some rounds to see your stats.</div>
      <router-link to="/" class="btn-primary">Start a Round</router-link>
    </div>

    <template v-else>
      <!-- Player selector -->
      <div class="selector-section">
        <label class="selector-label">Player</label>
        <div class="pill-row">
          <button
            v-for="p in allPlayers"
            :key="p.id"
            class="pill"
            :class="{ active: selectedPlayer === p.id }"
            @click="selectedPlayer = p.id"
          >{{ p.name }}</button>
        </div>
      </div>

      <!-- Course filter -->
      <div class="selector-section" v-if="allCourses.length > 1">
        <label class="selector-label">Course</label>
        <div class="pill-row">
          <button
            class="pill"
            :class="{ active: selectedCourse === null }"
            @click="selectedCourse = null"
          >All Courses</button>
          <button
            v-for="c in allCourses"
            :key="c"
            class="pill"
            :class="{ active: selectedCourse === c }"
            @click="selectedCourse = c"
          >{{ c }}</button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid" v-if="playerStats">
        <div class="kpi-card">
          <div class="kpi-value">{{ playerStats.roundsPlayed }}</div>
          <div class="kpi-label">Rounds</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ playerStats.avgScore || '—' }}</div>
          <div class="kpi-label">Avg Score</div>
        </div>
        <div class="kpi-card kpi-highlight">
          <div class="kpi-value">{{ playerStats.bestRound || '—' }}</div>
          <div class="kpi-label">Best Round</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ playerStats.parPct }}%</div>
          <div class="kpi-label">Par or Better</div>
        </div>
        <div class="kpi-card kpi-birdie">
          <div class="kpi-value">{{ playerStats.birdies }}</div>
          <div class="kpi-label">Birdies</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ playerStats.eagles }}</div>
          <div class="kpi-label">Eagles</div>
        </div>
      </div>

      <!-- Scoring distribution -->
      <div class="section" v-if="playerStats">
        <div class="section-title">Scoring Distribution</div>
        <div class="dist-bars">
          <div v-for="d in playerStats.distribution" :key="d.label" class="dist-row">
            <span class="dist-label" :class="d.class">{{ d.label }}</span>
            <div class="dist-bar-track">
              <div class="dist-bar-fill" :class="d.class" :style="{ width: d.pct + '%' }"></div>
            </div>
            <span class="dist-count">{{ d.count }}</span>
            <span class="dist-pct">{{ d.pct }}%</span>
          </div>
        </div>
      </div>

      <!-- Recent rounds -->
      <div class="section" v-if="playerRounds.length">
        <div class="section-title">Recent Rounds</div>
        <div class="recent-list">
          <div v-for="r in playerRounds.slice(0, 10)" :key="r.roundId" class="recent-row">
            <div class="recent-left">
              <div class="recent-course">{{ r.courseName }}</div>
              <div class="recent-date">{{ formatDate(r.date) }}</div>
            </div>
            <div class="recent-right">
              <div class="recent-score" :class="scoreToPar(r)">{{ r.total }}</div>
              <div class="recent-to-par">{{ formatToPar(r) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Head-to-head -->
      <div class="section" v-if="h2hRecords.length">
        <div class="section-title">Head-to-Head</div>
        <div class="h2h-list">
          <div v-for="h in h2hRecords" :key="h.opponentId" class="h2h-row">
            <div class="h2h-name">{{ h.opponentName }}</div>
            <div class="h2h-record">
              <span class="h2h-win">{{ h.wins }}W</span>
              <span class="h2h-sep">–</span>
              <span class="h2h-loss">{{ h.losses }}L</span>
              <span class="h2h-sep">–</span>
              <span class="h2h-tie">{{ h.ties }}T</span>
            </div>
            <div class="h2h-diff" :class="{ positive: h.avgDiff < 0, negative: h.avgDiff > 0 }">
              {{ h.avgDiff > 0 ? '+' : '' }}{{ h.avgDiff.toFixed(1) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Gambling winnings (if settlements available) -->
      <div class="section" v-if="playerStats && playerStats.totalWinnings !== 0">
        <div class="section-title">Season Winnings</div>
        <div class="winnings-card" :class="{ positive: playerStats.totalWinnings > 0, negative: playerStats.totalWinnings < 0 }">
          <div class="winnings-amount">{{ playerStats.totalWinnings > 0 ? '+' : '' }}${{ Math.abs(playerStats.totalWinnings).toFixed(0) }}</div>
          <div class="winnings-label">across {{ playerStats.roundsWithSettlements }} rounds</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { getCourse } from '../modules/courses'

const roundsStore = useRoundsStore()
const loading = ref(true)
const allRounds = ref([])
const settlementsMap = ref({}) // roundId → settlement_json

const selectedPlayer = ref(null)
const selectedCourse = ref(null)

onMounted(async () => {
  await roundsStore.fetchRounds()
  allRounds.value = roundsStore.rounds
  // Auto-select first player
  const players = extractPlayers()
  if (players.length && !selectedPlayer.value) {
    selectedPlayer.value = players[0].id
  }
  // Pre-fetch settlements for completed rounds
  for (const r of allRounds.value) {
    if (r.is_complete && r.game_configs?.length) {
      try {
        const s = await roundsStore.fetchSettlements(r.id)
        if (s) settlementsMap.value[r.id] = s
      } catch (e) { /* silent */ }
    }
  }
  loading.value = false
})

// ── Player list ─────────────────────────────────────────────
function extractPlayers() {
  const map = new Map()
  for (const r of allRounds.value) {
    for (const m of (r.round_members || [])) {
      const key = m.profile_id || m.id
      if (!map.has(key)) {
        map.set(key, { id: key, name: m.short_name || m.guest_name || '?' })
      }
    }
  }
  return Array.from(map.values())
}

const allPlayers = computed(() => extractPlayers())

const allCourses = computed(() => {
  const set = new Set()
  for (const r of allRounds.value) {
    if (r.course_name) set.add(r.course_name)
  }
  return Array.from(set).sort()
})

// ── Find member in a round matching selectedPlayer ──────────
function findMember(round) {
  if (!selectedPlayer.value) return null
  return (round.round_members || []).find(m =>
    (m.profile_id || m.id) === selectedPlayer.value
  )
}

// ── Filtered rounds for this player + course ────────────────
const playerRounds = computed(() => {
  const results = []
  for (const r of allRounds.value) {
    if (selectedCourse.value && r.course_name !== selectedCourse.value) continue
    const m = findMember(r)
    if (!m) continue

    const scores = r.scores || []
    const memberScores = scores.filter(s => s.member_id === m.id)
    if (!memberScores.length) continue

    const byHole = {}
    memberScores.forEach(s => { byHole[s.hole] = s.score ?? s.strokes })

    const course = getCourse(r.course_name)
    const parArr = course?.par || []
    let total = 0, holesPlayed = 0, pars = 0, birdies = 0, eagles = 0
    let bogeys = 0, doubles = 0, triples = 0

    for (let h = 1; h <= 18; h++) {
      if (byHole[h] == null) continue
      const sc = byHole[h]
      const par = parArr[h - 1] || 4
      total += sc
      holesPlayed++

      const diff = sc - par
      if (diff <= -2) eagles++
      else if (diff === -1) birdies++
      else if (diff === 0) pars++
      else if (diff === 1) bogeys++
      else if (diff === 2) doubles++
      else triples++
    }

    const coursePar = parArr.slice(0, holesPlayed).reduce((s, p) => s + p, 0) || (holesPlayed * 4)

    results.push({
      roundId: r.id,
      courseName: r.course_name,
      date: r.date,
      total,
      holesPlayed,
      coursePar,
      pars, birdies, eagles, bogeys, doubles, triples,
      memberId: m.id,
    })
  }
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return results
})

// ── Aggregate stats ─────────────────────────────────────────
const playerStats = computed(() => {
  const rounds = playerRounds.value
  if (!rounds.length) return null

  const totalScores = rounds.map(r => r.total)
  const avg = totalScores.reduce((s, v) => s + v, 0) / totalScores.length
  const best = Math.min(...totalScores)

  let totalHoles = 0, totalPars = 0, totalBirdies = 0, totalEagles = 0
  let totalBogeys = 0, totalDoubles = 0, totalTriples = 0

  for (const r of rounds) {
    totalHoles += r.holesPlayed
    totalPars += r.pars
    totalBirdies += r.birdies
    totalEagles += r.eagles
    totalBogeys += r.bogeys
    totalDoubles += r.doubles
    totalTriples += r.triples
  }

  const parOrBetter = totalPars + totalBirdies + totalEagles
  const parPct = totalHoles ? Math.round((parOrBetter / totalHoles) * 100) : 0

  const distribution = [
    { label: 'Eagle+', count: totalEagles, class: 'dist-eagle' },
    { label: 'Birdie', count: totalBirdies, class: 'dist-birdie' },
    { label: 'Par', count: totalPars, class: 'dist-par' },
    { label: 'Bogey', count: totalBogeys, class: 'dist-bogey' },
    { label: 'Double+', count: totalDoubles + totalTriples, class: 'dist-double' },
  ].map(d => ({ ...d, pct: totalHoles ? Math.round((d.count / totalHoles) * 100) : 0 }))

  // Winnings from settlements
  let totalWinnings = 0
  let roundsWithSettlements = 0
  for (const r of rounds) {
    const s = settlementsMap.value[r.roundId]
    if (s?.playerTotals) {
      const memberEntry = s.playerTotals[r.memberId]
      if (memberEntry) {
        totalWinnings += memberEntry.total || 0
        roundsWithSettlements++
      }
    }
  }

  return {
    roundsPlayed: rounds.length,
    avgScore: Math.round(avg),
    bestRound: best,
    parPct,
    birdies: totalBirdies,
    eagles: totalEagles,
    distribution,
    totalWinnings: Math.round(totalWinnings * 100) / 100,
    roundsWithSettlements,
  }
})

// ── Head-to-head ────────────────────────────────────────────
const h2hRecords = computed(() => {
  if (!selectedPlayer.value) return []
  const opponents = new Map() // opponentKey → { wins, losses, ties, totalDiff, count, name }

  for (const r of allRounds.value) {
    if (selectedCourse.value && r.course_name !== selectedCourse.value) continue
    const me = findMember(r)
    if (!me) continue

    const scores = r.scores || []
    const myScores = scores.filter(s => s.member_id === me.id)
    const myTotal = myScores.reduce((s, sc) => s + (sc.score ?? sc.strokes ?? 0), 0)
    if (!myTotal) continue

    for (const opp of (r.round_members || [])) {
      if ((opp.profile_id || opp.id) === selectedPlayer.value) continue
      const oppKey = opp.profile_id || opp.id
      const oppScores = scores.filter(s => s.member_id === opp.id)
      const oppTotal = oppScores.reduce((s, sc) => s + (sc.score ?? sc.strokes ?? 0), 0)
      if (!oppTotal) continue

      if (!opponents.has(oppKey)) {
        opponents.set(oppKey, { wins: 0, losses: 0, ties: 0, totalDiff: 0, count: 0, opponentName: opp.short_name || opp.guest_name || '?' })
      }
      const rec = opponents.get(oppKey)
      rec.count++
      const diff = myTotal - oppTotal
      rec.totalDiff += diff
      if (diff < 0) rec.wins++
      else if (diff > 0) rec.losses++
      else rec.ties++
    }
  }

  return Array.from(opponents.entries())
    .filter(([, v]) => v.count >= 1)
    .map(([id, v]) => ({
      opponentId: id,
      opponentName: v.opponentName,
      wins: v.wins,
      losses: v.losses,
      ties: v.ties,
      avgDiff: v.count ? v.totalDiff / v.count : 0,
    }))
    .sort((a, b) => b.wins - a.wins || a.avgDiff - b.avgDiff)
})

// ── Helpers ─────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreToPar(r) {
  const diff = r.total - r.coursePar
  if (diff <= -3) return 'sp-hot'
  if (diff < 0) return 'sp-under'
  if (diff === 0) return 'sp-even'
  if (diff <= 5) return 'sp-over'
  return 'sp-way-over'
}

function formatToPar(r) {
  const diff = r.total - r.coursePar
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}
</script>

<style scoped>
.metrics-page {
  padding: 16px 16px 100px;
  max-width: 600px;
  margin: 0 auto;
}

.metrics-header {
  text-align: center;
  padding: 12px 0 20px;
}
.metrics-title {
  font-family: var(--gw-font-display, Georgia, serif);
  font-size: 28px;
  font-weight: 700;
  color: var(--gw-gold, #d4af37);
  margin: 0;
}
.metrics-subtitle {
  font-size: 13px;
  color: var(--gw-text-secondary, #a3b8aa);
  margin: 6px 0 0;
}

/* Loading / Empty */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  gap: 12px;
}
.loading-spinner {
  width: 32px; height: 32px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--gw-gold, #d4af37);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-text { font-size: 14px; color: var(--gw-text-muted, #7d9283); }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  padding: 60px 20px; text-align: center;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-title { font-size: 22px; font-weight: 700; color: var(--gw-text, #f0ede0); margin-bottom: 8px; }
.empty-sub { font-size: 14px; color: var(--gw-text-muted); margin-bottom: 24px; }
.btn-primary {
  padding: 14px 28px; background: var(--gw-gold); color: #000;
  border: none; border-radius: 12px; font-size: 15px; font-weight: 600;
  text-decoration: none; display: inline-block;
}

/* Selector */
.selector-section {
  margin-bottom: 16px;
}
.selector-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--gw-text-muted, #7d9283);
  margin-bottom: 8px;
}
.pill-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pill {
  padding: 7px 14px;
  border: 1px solid var(--gw-green-700, #114a35);
  border-radius: 20px;
  background: transparent;
  color: var(--gw-text-secondary, #a3b8aa);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.pill.active {
  background: var(--gw-green-700, #114a35);
  color: var(--gw-text, #f0ede0);
  border-color: var(--gw-gold, #d4af37);
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}
.kpi-card {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-700, #114a35);
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
}
.kpi-value {
  font-family: var(--gw-font-mono, 'SF Mono', monospace);
  font-size: 24px;
  font-weight: 800;
  color: var(--gw-text, #f0ede0);
  line-height: 1.2;
}
.kpi-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--gw-text-muted, #7d9283);
  margin-top: 4px;
}
.kpi-highlight { border-color: var(--gw-gold, #d4af37); }
.kpi-highlight .kpi-value { color: var(--gw-gold, #d4af37); }
.kpi-birdie .kpi-value { color: #60a5fa; }

/* Section */
.section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--gw-gold, #d4af37);
  margin-bottom: 10px;
}

/* Distribution bars */
.dist-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dist-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dist-label {
  width: 56px;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}
.dist-bar-track {
  flex: 1;
  height: 18px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  overflow: hidden;
}
.dist-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.4s ease-out;
  min-width: 2px;
}
.dist-count {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
  width: 28px;
  text-align: right;
}
.dist-pct {
  font-size: 11px;
  color: var(--gw-text-muted);
  width: 32px;
  text-align: right;
}

/* Distribution colors */
.dist-eagle { color: #fbbf24; }
.dist-bar-fill.dist-eagle { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.dist-birdie { color: #60a5fa; }
.dist-bar-fill.dist-birdie { background: linear-gradient(90deg, #60a5fa, #3b82f6); }
.dist-par { color: #86efac; }
.dist-bar-fill.dist-par { background: linear-gradient(90deg, #86efac, #22c55e); }
.dist-bogey { color: #a3b8aa; }
.dist-bar-fill.dist-bogey { background: linear-gradient(90deg, #6b7c71, #4a5a50); }
.dist-double { color: #f87171; }
.dist-bar-fill.dist-double { background: linear-gradient(90deg, #f87171, #ef4444); }

/* Recent rounds */
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--gw-green-800, #0d3325);
  border-radius: 10px;
  border: 1px solid var(--gw-green-700, #114a35);
}
.recent-course {
  font-size: 14px;
  font-weight: 600;
  color: var(--gw-text, #f0ede0);
}
.recent-date {
  font-size: 11px;
  color: var(--gw-text-muted);
  margin-top: 2px;
}
.recent-right {
  text-align: right;
}
.recent-score {
  font-family: var(--gw-font-mono);
  font-size: 20px;
  font-weight: 800;
}
.recent-to-par {
  font-size: 11px;
  font-weight: 600;
}
.sp-hot .recent-score, .sp-hot + .recent-to-par { color: #fbbf24; }
.sp-under, .sp-under + .recent-to-par { color: #86efac; }
.sp-even, .sp-even + .recent-to-par { color: var(--gw-text, #f0ede0); }
.sp-over, .sp-over + .recent-to-par { color: #fca5a5; }
.sp-way-over, .sp-way-over + .recent-to-par { color: #f87171; }
.recent-right .recent-to-par { margin-top: 2px; }
.sp-hot + .recent-to-par { color: #fbbf24; }

/* To-par coloring */
.recent-right .sp-hot { color: #fbbf24; }
.recent-right .sp-under { color: #86efac; }
.recent-right .sp-even { color: var(--gw-text, #f0ede0); }
.recent-right .sp-over { color: #fca5a5; }
.recent-right .sp-way-over { color: #f87171; }

/* H2H */
.h2h-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.h2h-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--gw-green-800, #0d3325);
  border-radius: 10px;
  border: 1px solid var(--gw-green-700, #114a35);
}
.h2h-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--gw-text, #f0ede0);
}
.h2h-record {
  display: flex;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
.h2h-win { color: #86efac; }
.h2h-loss { color: #fca5a5; }
.h2h-tie { color: var(--gw-text-muted); }
.h2h-sep { color: rgba(255,255,255,0.2); }
.h2h-diff {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 700;
  min-width: 40px;
  text-align: right;
}
.h2h-diff.positive { color: #86efac; }
.h2h-diff.negative { color: #fca5a5; }

/* Winnings */
.winnings-card {
  padding: 20px;
  border-radius: 14px;
  text-align: center;
  border: 1px solid var(--gw-green-700, #114a35);
}
.winnings-card.positive {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.3);
}
.winnings-card.negative {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
}
.winnings-amount {
  font-family: var(--gw-font-mono);
  font-size: 36px;
  font-weight: 800;
}
.winnings-card.positive .winnings-amount { color: #86efac; }
.winnings-card.negative .winnings-amount { color: #fca5a5; }
.winnings-label {
  font-size: 12px;
  color: var(--gw-text-muted);
  margin-top: 6px;
}

@keyframes spin {
  from { transform: rotate(0deg); } to { transform: rotate(360deg); }
}
</style>
