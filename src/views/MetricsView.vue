<template>
  <div class="metrics-page">
    <header class="view-header">
      <h2>Metrics Lab</h2>
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
          >{{ p.label }}</button>
        </div>
      </div>

      <!-- Course filter (Scoring/Games tabs) -->
      <div class="selector-section" v-if="allCourses.length > 1 && activeTab !== 'course'">
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

      <!-- Tab bar -->
      <div class="tab-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'scoring' }" @click="activeTab = 'scoring'">Scoring</button>
        <button class="tab-btn" :class="{ active: activeTab === 'games' }" @click="activeTab = 'games'">Games</button>
        <button class="tab-btn" :class="{ active: activeTab === 'course' }" @click="activeTab = 'course'">Course</button>
      </div>

      <!-- ── SCORING TAB ── -->
      <template v-if="activeTab === 'scoring'">
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
                <div class="recent-scores-row">
                  <div class="recent-score-block">
                    <div class="recent-score-label">Gross</div>
                    <div class="recent-score" :class="scoreToPar(r)">{{ r.total }}</div>
                    <div class="recent-to-par">{{ formatToPar(r) }}</div>
                  </div>
                  <div class="recent-score-block">
                    <div class="recent-score-label">Net</div>
                    <div class="recent-score" :class="netScoreToPar(r)">{{ r.total - (r.strokes || 0) }}</div>
                    <div class="recent-to-par">{{ formatNetToPar(r) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Head-to-head -->
        <div class="section" v-if="h2hRecords.length">
          <div class="section-title">Head-to-Head (Net)</div>
          <div class="h2h-list">
            <div v-for="h in h2hRecords" :key="h.opponentId" class="h2h-row">
              <div class="h2h-name">{{ h.opponentName }}</div>
              <div class="h2h-right">
                <div class="h2h-record">
                  <span class="h2h-win">{{ h.wins }}W</span>
                  <span class="h2h-sep">–</span>
                  <span class="h2h-loss">{{ h.losses }}L</span>
                  <span v-if="h.ties" class="h2h-sep">–{{ h.ties }}T</span>
                </div>
                <div class="h2h-sub-row">
                  <span class="h2h-diff" :class="{ positive: h.avgNetDiff < 0, negative: h.avgNetDiff > 0 }">
                    avg {{ h.avgNetDiff > 0 ? '+' : '' }}{{ h.avgNetDiff }} net
                  </span>
                  <span v-if="h.moneyRounds > 0" class="h2h-money" :class="{ positive: h.moneyNet > 0, negative: h.moneyNet < 0 }">
                    {{ h.moneyNet > 0 ? '+' : '' }}${{ Math.abs(h.moneyNet) }}
                  </span>
                </div>
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

      <!-- ── GAMES TAB ── -->
      <template v-if="activeTab === 'games'">
        <div v-if="!gameStats.length" class="empty-state" style="padding: 40px 20px;">
          <div class="empty-icon">🎰</div>
          <div class="empty-title">No game data yet</div>
          <div class="empty-sub">Complete rounds with games and settlements to see stats here.</div>
        </div>

        <template v-else>
          <!-- Per-game type rows -->
          <div class="section">
            <div class="section-title">By Game Type</div>
            <div class="h2h-list">
              <div v-for="g in gameStats" :key="g.type" class="h2h-row game-row">
                <div class="game-row-left">
                  <div class="game-name">{{ g.label }}</div>
                  <div class="game-rounds">{{ g.rounds }} round{{ g.rounds !== 1 ? 's' : '' }}</div>
                </div>
                <div class="game-record">
                  <span class="h2h-win">{{ g.wins }}W</span>
                  <span class="h2h-sep">–</span>
                  <span class="h2h-loss">{{ g.losses }}L</span>
                  <span v-if="g.pushes > 0">
                    <span class="h2h-sep">–</span>
                    <span class="h2h-tie">{{ g.pushes }}P</span>
                  </span>
                </div>
                <div class="game-net" :class="{ positive: g.net > 0, negative: g.net < 0 }">
                  {{ g.net > 0 ? '+' : '' }}${{ Math.abs(g.net).toFixed(0) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Wolf-specific stats -->
          <div class="section" v-if="wolfStats">
            <div class="section-title">Wolf — Lone Wolf</div>
            <div class="h2h-row game-row">
              <div class="game-row-left">
                <div class="game-name">Lone Wolf Attempts</div>
                <div class="game-rounds">{{ wolfStats.attempts }} attempt{{ wolfStats.attempts !== 1 ? 's' : '' }}</div>
              </div>
              <div class="game-record">
                <span class="h2h-win">{{ wolfStats.wins }}W</span>
                <span class="h2h-sep">–</span>
                <span class="h2h-loss">{{ wolfStats.losses }}L</span>
              </div>
              <div class="game-net" :class="{ positive: wolfStats.net > 0, negative: wolfStats.net < 0 }">
                {{ wolfStats.net > 0 ? '+' : '' }}${{ Math.abs(wolfStats.net).toFixed(0) }}
              </div>
            </div>
          </div>

          <!-- Total across all games -->
          <div class="section">
            <div class="section-title">Overall</div>
            <div class="winnings-card" :class="{ positive: gamesTotalNet > 0, negative: gamesTotalNet < 0 }">
              <div class="winnings-amount">{{ gamesTotalNet > 0 ? '+' : '' }}${{ Math.abs(gamesTotalNet).toFixed(0) }}</div>
              <div class="winnings-label">net across all game types</div>
            </div>
          </div>
        </template>
      </template>

      <!-- ── COURSE TAB ── -->
      <div v-if="activeTab === 'course'">
        <!-- Course dropdown (shown when >1 course played) -->
        <div class="selector-section" v-if="courseNames.length > 1">
          <label class="selector-label" for="course-select">Course</label>
          <select
            id="course-select"
            class="course-select"
            :value="selectedCourseTab"
            @change="onCourseTabChange"
          >
            <option v-for="c in courseNames" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div v-if="!courseHoleStats" class="empty-state" style="padding: 40px 0;">
          <div class="empty-icon">⛳</div>
          <div class="empty-title" style="font-size:16px;">No course data yet</div>
          <div class="empty-sub">Play some rounds to see hole-by-hole stats.</div>
        </div>

        <template v-else>
          <div class="section-header-row">
            <div class="section-title">{{ courseHoleStats.courseName }}</div>
            <div class="section-sub">{{ courseHoleStats.roundCount }} round{{ courseHoleStats.roundCount !== 1 ? 's' : '' }}</div>
          </div>

          <!-- Hole grid header -->
          <div class="hole-grid-header">
            <span class="hg-hole">Hole</span>
            <span class="hg-par">Par</span>
            <span class="hg-si">SI</span>
            <span class="hg-yds">Yds</span>
            <span class="hg-avg">Avg</span>
            <span class="hg-net">Net</span>
            <span class="hg-best">Best</span>
            <span class="hg-bird">🐦</span>
          </div>

          <div class="hole-grid-body">
            <div
              v-for="h in courseHoleStats.holes"
              :key="h.holeNum"
              class="hole-grid-row"
              :class="{ 'front-nine': h.holeNum <= 9, 'back-nine': h.holeNum > 9 }"
            >
              <span class="hg-hole">{{ h.holeNum }}</span>
              <span class="hg-par">{{ h.holePar }}</span>
              <span class="hg-si">{{ h.holeSI }}</span>
              <span class="hg-yds">{{ h.holeYards || '—' }}</span>
              <template v-if="h.noData">
                <span class="hg-avg">—</span>
                <span class="hg-net">—</span>
                <span class="hg-best">—</span>
                <span class="hg-bird"></span>
              </template>
              <template v-else>
                <span class="hg-avg" :class="diffClass(h.avgVsPar)">
                  {{ h.avgVsPar > 0 ? '+' : '' }}{{ h.avgVsPar.toFixed(1) }}
                </span>
                <span class="hg-net" :class="diffClass(h.avgNetVsPar)">
                  {{ h.avgNetVsPar > 0 ? '+' : '' }}{{ h.avgNetVsPar.toFixed(1) }}
                </span>
                <span class="hg-best" :class="bestScoreClass(h.bestGross, h.holePar)">
                  {{ h.bestGross }}
                </span>
                <span class="hg-bird">
                  <template v-if="h.birdies > 0">🐦<span class="bird-count">{{ h.birdies > 1 ? h.birdies : '' }}</span></template>
                  <template v-else-if="h.eagles > 0">🦅</template>
                  <template v-else>—</template>
                </span>
              </template>
            </div>
          </div>

          <!-- Hardest / Easiest holes summary -->
          <div class="section" style="margin-top: 16px;">
            <div class="section-title">Hardest Holes (vs Par)</div>
            <div class="h2h-list">
              <div
                v-for="h in [...courseHoleStats.holes].filter(h => !h.noData).sort((a,b) => b.avgVsPar - a.avgVsPar).slice(0, 3)"
                :key="h.holeNum"
                class="h2h-row"
              >
                <div class="h2h-name">Hole {{ h.holeNum }} · Par {{ h.holePar }} · SI {{ h.holeSI }}</div>
                <div class="hg-avg negative">+{{ h.avgVsPar.toFixed(2) }}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Best Holes (vs Par)</div>
            <div class="h2h-list">
              <div
                v-for="h in [...courseHoleStats.holes].filter(h => !h.noData).sort((a,b) => a.avgVsPar - b.avgVsPar).slice(0, 3)"
                :key="h.holeNum"
                class="h2h-row"
              >
                <div class="h2h-name">Hole {{ h.holeNum }} · Par {{ h.holePar }} · SI {{ h.holeSI }}</div>
                <div class="hg-avg" :class="diffClass(h.avgVsPar)">{{ h.avgVsPar > 0 ? '+' : '' }}{{ h.avgVsPar.toFixed(2) }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { useAuthStore } from '../stores/auth'
import { getCourse } from '../modules/courses'
import { canonicalPlayerKey, groupMembersByCanonicalPlayer } from '../modules/canonicalPlayer'

defineOptions({ name: 'MetricsView' })

const LS_COURSE_KEY = 'gw_metrics_course_tab'

const roundsStore = useRoundsStore()
const authStore = useAuthStore()
const loading = ref(true)
const allRounds = ref([])
const settlementsMap = ref({}) // roundId → settlement_json
const lastRoundCount = ref(0) // staleness tracker

const selectedPlayer = ref(null)
const selectedCourse = ref(null)  // used by Scoring/Games tabs
const selectedCourseTab = ref(null) // used by Course tab — persisted
const activeTab = ref('scoring')

async function loadMetrics() {
  loading.value = true
  try {
    await roundsStore.fetchRounds()
  } catch (e) {
    console.warn('[MetricsView] fetchRounds failed:', e?.message)
  }
  allRounds.value = roundsStore.myRounds

  // Default to current user if they appear in any round, else first player
  const players = extractPlayers()
  if (players.length && !selectedPlayer.value) {
    const uid = authStore.user?.id
    const profile = authStore.profile
    const ghinNum = profile?.ghin_number
    const myEntry = players.find(p =>
      (uid && p.id === `pid:${uid}`) ||
      (ghinNum && p.ghin_number && String(p.ghin_number) === String(ghinNum))
    )
    selectedPlayer.value = myEntry ? myEntry.id : players[0].id
  }

  // Restore last selected course for Course tab
  const saved = localStorage.getItem(LS_COURSE_KEY)
  if (saved) selectedCourseTab.value = saved

  // Pre-fetch settlements — hard 8s timeout to prevent infinite hang
  try {
    await Promise.race([
      (async () => {
        for (const r of allRounds.value) {
          if (r.is_complete && r.game_configs?.length && !settlementsMap.value[r.id]) {
            try {
              const s = await roundsStore.fetchSettlements(r.id)
              if (s) settlementsMap.value[r.id] = s
            } catch (e) { /* silent */ }
          }
        }
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('settlements timeout')), 8000))
    ])
  } catch (e) {
    console.warn('[MetricsView] settlements prefetch timed out or failed:', e?.message)
  }

  loading.value = false
}

onMounted(loadMetrics)

// When KeepAlive reactivates, only refresh if rounds changed
onActivated(() => {
  const storeCount = roundsStore.rounds.length
  if (storeCount !== lastRoundCount.value) {
    console.log(`[MetricsView] rounds changed (${lastRoundCount.value} → ${storeCount}), refreshing`)
    loadMetrics()
  } else {
    console.log(`[MetricsView] reactivated, ${storeCount} rounds unchanged — using cache`)
  }
})

function onCourseTabChange(e) {
  selectedCourseTab.value = e.target.value
  localStorage.setItem(LS_COURSE_KEY, e.target.value)
}

// Player identity — see src/modules/canonicalPlayer.js.
// Same person across rounds (e.g. "Spiels" vs "Spieler") collapses into one chip.

function extractPlayers() {
  return groupMembersByCanonicalPlayer(allRounds.value)
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
  return (round.round_members || []).find(m => canonicalPlayerKey(m) === selectedPlayer.value)
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
      strokes: m.stroke_override ?? m.round_hcp ?? 0,
    })
  }
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return results
})

// ── Aggregate stats ─────────────────────────────────────
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

// ── Game type label map ─────────────────────────────────
const GAME_LABELS = {
  skins: 'Skins',
  nassau: 'Nassau',
  wolf: 'Wolf',
  stroke: 'Stroke Play',
  stableford: 'Stableford',
  match: 'Match Play',
  bingo_bango_bongo: 'Bingo Bango Bongo',
  '5_3_1': '5-3-1',
  banker: 'Banker',
  scramble: 'Scramble',
}

function gameLabel(type) {
  return GAME_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown')
}

// ── Games tab computed data ─────────────────────────────
const gameStats = computed(() => {
  if (!selectedPlayer.value) return []
  const byType = new Map() // type → { rounds, wins, losses, pushes, net }

  for (const r of allRounds.value) {
    if (selectedCourse.value && r.course_name !== selectedCourse.value) continue
    const me = findMember(r)
    if (!me) continue

    const settlement = settlementsMap.value[r.id]
    if (!settlement) continue

    // settlement.summary is keyed by game_config id, each entry has { type, nets: [{id, net}] }
    const summary = settlement.summary
    if (summary && typeof summary === 'object') {
      for (const entry of Object.values(summary)) {
        const type = entry.type
        if (!type || entry.error) continue
        const playerNet = entry.nets?.find(n => n.id === me.id)
        if (!playerNet) continue
        const net = playerNet.net ?? 0
        if (!byType.has(type)) {
          byType.set(type, { type, rounds: 0, wins: 0, losses: 0, pushes: 0, net: 0 })
        }
        const rec = byType.get(type)
        rec.rounds++
        rec.net += net
        if (net > 0) rec.wins++
        else if (net < 0) rec.losses++
        else rec.pushes++
      }
    } else {
      // Legacy fallback: single-game rounds where playerTotals is flat
      const gameConfigs = r.game_configs || []
      if (gameConfigs.length === 1 && settlement.playerTotals) {
        const type = gameConfigs[0].type
        if (!type) continue
        const pt = settlement.playerTotals[me.id]
        if (pt == null) continue
        const net = typeof pt === 'object' ? (pt.total ?? 0) : pt
        if (!byType.has(type)) {
          byType.set(type, { type, rounds: 0, wins: 0, losses: 0, pushes: 0, net: 0 })
        }
        const rec = byType.get(type)
        rec.rounds++
        rec.net += net
        if (net > 0) rec.wins++
        else if (net < 0) rec.losses++
        else rec.pushes++
      }
    }
  }

  return Array.from(byType.values())
    .map(r => ({ ...r, label: gameLabel(r.type), net: Math.round(r.net * 100) / 100 }))
    .sort((a, b) => b.rounds - a.rounds)
})

// ── Wolf lone-wolf specific stats ────────────────────────
const wolfStats = computed(() => {
  if (!selectedPlayer.value) return null
  let attempts = 0, wins = 0, losses = 0, net = 0

  for (const r of allRounds.value) {
    if (selectedCourse.value && r.course_name !== selectedCourse.value) continue
    const me = findMember(r)
    if (!me) continue

    const settlement = settlementsMap.value[r.id]
    if (!settlement) continue

    const hasWolf = (r.game_configs || []).some(g => g.type === 'wolf')
    if (!hasWolf) continue

    // Find wolf entry in settlement.summary (keyed by game_config id)
    const wolfEntry = settlement.summary
      ? Object.values(settlement.summary).find(e => e.type === 'wolf')
      : null
    if (!wolfEntry) continue

    const loneWolfRounds = wolfEntry.rawResult?.loneWolf || wolfEntry.rawResult?.lone_wolf || wolfEntry.loneWolf || []
    for (const lw of loneWolfRounds) {
      const playerId = lw.playerId || lw.player_id || lw.memberId
      if (playerId !== me.id) continue
      attempts++
      const lwNet = lw.net ?? lw.total ?? 0
      net += lwNet
      if (lwNet > 0) wins++
      else if (lwNet < 0) losses++
    }
  }

  if (attempts === 0) return null
  return { attempts, wins, losses, net: Math.round(net * 100) / 100 }
})

const gamesTotalNet = computed(() => {
  return Math.round(gameStats.value.reduce((s, g) => s + g.net, 0) * 100) / 100
})

// ── Head-to-head (Net) ───────────────────────────────────
const h2hRecords = computed(() => {
  if (!selectedPlayer.value) return []
  const opponents = new Map()

  for (const r of allRounds.value) {
    if (selectedCourse.value && r.course_name !== selectedCourse.value) continue
    const me = findMember(r)
    if (!me) continue

    const scores = r.scores || []
    const myGross = scores.filter(s => s.member_id === me.id).reduce((sum, s) => sum + (s.score ?? 0), 0)
    if (!myGross) continue

    const myStrokes = me.stroke_override ?? me.round_hcp ?? 0
    const myNet = myGross - myStrokes

    const myMoney = settlementsMap.value[r.id]?.playerTotals?.[me.id]?.total ?? null

    for (const opp of (r.round_members || [])) {
      const oppKey = canonicalPlayerKey(opp)
      if (oppKey === selectedPlayer.value) continue

      const oppGross = scores.filter(s => s.member_id === opp.id).reduce((sum, s) => sum + (s.score ?? 0), 0)
      if (!oppGross) continue

      const oppStrokes = opp.stroke_override ?? opp.round_hcp ?? 0
      const oppNet = oppGross - oppStrokes

      if (!opponents.has(oppKey)) {
        opponents.set(oppKey, {
          wins: 0, losses: 0, ties: 0,
          totalNetDiff: 0, count: 0,
          moneyNet: 0, moneyRounds: 0,
          opponentName: opp.short_name || opp.guest_name || '?'
        })
      }
      const rec = opponents.get(oppKey)
      rec.count++
      const diff = myNet - oppNet
      rec.totalNetDiff += diff
      if (diff < 0) rec.wins++
      else if (diff > 0) rec.losses++
      else rec.ties++

      if (myMoney !== null) {
        rec.moneyNet += myMoney
        rec.moneyRounds++
      }
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
      avgNetDiff: v.count ? +(v.totalNetDiff / v.count).toFixed(1) : 0,
      moneyNet: Math.round(v.moneyNet),
      moneyRounds: v.moneyRounds,
    }))
    .sort((a, b) => b.wins - a.wins || a.avgNetDiff - b.avgNetDiff)
})

// ── Course tab computeds ────────────────────────────────
const courseNames = computed(() => {
  const set = new Set()
  for (const r of allRounds.value) {
    if (r.course_name) set.add(r.course_name)
  }
  return Array.from(set).sort()
})

const courseHoleStats = computed(() => {
  if (!selectedPlayer.value) return null

  const courseMap = new Map()

  for (const r of allRounds.value) {
    if (!r.course_snapshot?.par) continue
    const me = findMember(r)
    if (!me) continue
    const scores = r.scores || []
    const myScores = scores.filter(s => s.member_id === me.id)
    if (!myScores.length) continue

    const name = r.course_name
    if (!courseMap.has(name)) {
      courseMap.set(name, { snapshot: r.course_snapshot, tee: r.tee, rounds: [] })
    }
    courseMap.get(name).rounds.push({ round: r, member: me, myScores })
  }

  // Use selectedCourseTab; fall back to first available; validate saved value still exists
  const available = Array.from(courseMap.keys())
  let courseName = selectedCourseTab.value
  if (!courseName || !courseMap.has(courseName)) {
    courseName = available[0] || null
    // Update the ref so the dropdown reflects reality
    if (courseName && selectedCourseTab.value !== courseName) {
      selectedCourseTab.value = courseName
    }
  }
  if (!courseName) return null

  const { snapshot, tee, rounds } = courseMap.get(courseName)
  const par = snapshot.par
  const si = snapshot.si
  const yards = snapshot.teesData?.[tee]?.yardsByHole || []

  const holes = []
  for (let h = 0; h < 18; h++) {
    const holeNum = h + 1
    const holePar = par[h] || 4
    const holeSI = si[h] || (h + 1)
    const holeYards = yards[h] || null

    const holeScores = []
    const holeNetScores = []
    let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0

    for (const { member, myScores } of rounds) {
      const scoreRow = myScores.find(s => s.hole === holeNum)
      if (!scoreRow || scoreRow.score == null) continue

      const gross = scoreRow.score
      const strokes = member.stroke_override ?? member.round_hcp ?? 0
      const strokesOnHole = strokes > 18
        ? (holeSI <= (strokes - 18) ? 2 : holeSI <= strokes ? 1 : 0)
        : (holeSI <= strokes ? 1 : 0)
      const net = gross - strokesOnHole

      holeScores.push(gross)
      holeNetScores.push(net)

      const diff = gross - holePar
      if (diff <= -2) eagles++
      else if (diff === -1) birdies++
      else if (diff === 0) pars++
      else if (diff === 1) bogeys++
      else doubles++
    }

    if (!holeScores.length) {
      holes.push({ holeNum, holePar, holeSI, holeYards, noData: true, birdies: 0, eagles: 0 })
      continue
    }

    const avgGross = holeScores.reduce((s, v) => s + v, 0) / holeScores.length
    const avgNet = holeNetScores.reduce((s, v) => s + v, 0) / holeNetScores.length
    const bestGross = Math.min(...holeScores)

    holes.push({
      holeNum, holePar, holeSI, holeYards,
      avgGross: +avgGross.toFixed(2),
      avgNet: +avgNet.toFixed(2),
      avgVsPar: +(avgGross - holePar).toFixed(2),
      avgNetVsPar: +(avgNet - holePar).toFixed(2),
      bestGross,
      rounds: holeScores.length,
      eagles, birdies, pars, bogeys, doubles,
      noData: false
    })
  }

  return { courseName, holes, roundCount: rounds.length }
})

// ── Helpers ─────────────────────────────────────────
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

function netScoreToPar(r) {
  const net = r.total - (r.strokes || 0)
  const diff = net - r.coursePar
  if (diff <= -3) return 'sp-hot'
  if (diff < 0) return 'sp-under'
  if (diff === 0) return 'sp-even'
  if (diff <= 5) return 'sp-over'
  return 'sp-way-over'
}

function formatNetToPar(r) {
  const diff = (r.total - (r.strokes || 0)) - r.coursePar
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}

function diffClass(val) {
  if (val < -0.1) return 'sp-under'
  if (val > 0.1) return 'sp-way-over'
  return 'sp-even'
}

function bestScoreClass(score, par) {
  const diff = score - par
  if (diff <= -2) return 'dist-eagle'
  if (diff === -1) return 'dist-birdie'
  if (diff === 0) return 'dist-par'
  if (diff === 1) return 'dist-bogey'
  return 'dist-double'
}
</script>

<style scoped>
.metrics-page {
  padding: 16px 16px 100px;
  max-width: 600px;
  margin: 0 auto;
  background: var(--gw-bg-app);
  min-height: 100%;
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

/* Course dropdown */
.course-select {
  width: 100%;
  padding: 10px 14px;
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-700, #114a35);
  border-radius: 10px;
  color: var(--gw-text, #f0ede0);
  font-size: 15px;
  font-weight: 600;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23a3b8aa' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
  cursor: pointer;
}
.course-select:focus {
  outline: none;
  border-color: var(--gw-gold, #d4af37);
}

/* Tab bar */
.tab-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  background: var(--gw-green-800, #0d3325);
  border-radius: 12px;
  padding: 4px;
}
.tab-btn {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--gw-text-secondary, #a3b8aa);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.tab-btn.active {
  background: var(--gw-green-600, #166044);
  color: #fff;
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
.recent-scores-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.recent-score-block {
  text-align: right;
}
.recent-score-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--gw-text-muted, #7d9283);
  margin-bottom: 1px;
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
  align-items: flex-start;
  gap: 10px;
  justify-content: space-between;
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
.h2h-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.h2h-sub-row {
  display: flex;
  gap: 8px;
  align-items: center;
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
  font-size: 11px;
  color: var(--gw-text-muted, #7d9283);
}
.h2h-diff.positive { color: #86efac; }
.h2h-diff.negative { color: #fca5a5; }
.h2h-money {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 700;
}
.h2h-money.positive { color: #86efac; }
.h2h-money.negative { color: #fca5a5; }

/* Game rows */
.game-row-left {
  flex: 1;
}
.game-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--gw-text, #f0ede0);
}
.game-rounds {
  font-size: 11px;
  color: var(--gw-text-muted, #7d9283);
  margin-top: 2px;
}
.game-record {
  display: flex;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
.game-net {
  font-family: var(--gw-font-mono);
  font-size: 14px;
  font-weight: 700;
  min-width: 44px;
  text-align: right;
  color: var(--gw-text-muted, #7d9283);
}
.game-net.positive { color: #86efac; }
.game-net.negative { color: #fca5a5; }

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

/* Course tab */
.section-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.section-sub {
  font-size: 11px;
  color: var(--gw-text-muted, #7d9283);
}
.hole-grid-header, .hole-grid-row {
  display: grid;
  grid-template-columns: 28px 28px 28px 40px 46px 46px 36px 28px;
  gap: 2px;
  align-items: center;
  padding: 4px 8px;
  font-size: 12px;
}
.hole-grid-header {
  color: var(--gw-text-muted, #7d9283);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--gw-green-700, #114a35);
  margin-bottom: 2px;
}
.hole-grid-row {
  background: var(--gw-green-800, #0d3325);
  border-radius: 6px;
  margin-bottom: 2px;
  font-family: var(--gw-font-mono, monospace);
}
.hole-grid-row.back-nine {
  background: rgba(13,51,37,0.6);
}
.hg-hole { font-weight: 700; color: var(--gw-text, #f0ede0); }
.hg-par { color: var(--gw-text-muted, #7d9283); }
.hg-si { color: var(--gw-text-muted, #7d9283); font-size: 10px; }
.hg-yds { color: var(--gw-text-muted, #7d9283); font-size: 11px; }
.hg-avg, .hg-net { font-weight: 700; }
.hg-best { font-weight: 700; }
.hg-bird { font-size: 13px; line-height: 1; display: flex; align-items: center; gap: 1px; }
.bird-count { font-size: 10px; font-weight: 700; color: #60a5fa; font-family: var(--gw-font-mono); }
.negative { color: #fca5a5; }
.sp-under { color: #86efac; }
.sp-even { color: var(--gw-text, #f0ede0); }
.sp-way-over { color: #fca5a5; }

@keyframes spin {
  from { transform: rotate(0deg); } to { transform: rotate(360deg); }
}
</style>
