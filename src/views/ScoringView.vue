<template>
  <div class="view scoring-view" :class="{ 'landscape-mode': isLandscape }">
    <!-- Empty State -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🏌️</div>
      <h2 class="empty-title">No Active Round</h2>
      <p class="empty-message">Start a new round to begin tracking scores</p>
      <button class="btn-start-round">Start New Round</button>
    </div>

    <!-- Active Round -->
    <div v-else class="round-container">
      <!-- Portrait Layout -->
      <template v-if="!isLandscape">
        <!-- Header -->
        <header class="scoring-header">
          <div class="header-left">
            <h1 class="course-name">{{ roundsStore.activeRound.course_name }}</h1>
            <div class="header-meta">
              <span class="date">{{ formatDate(roundsStore.activeRound.date) }}</span>
              <span class="tee">{{ roundsStore.activeRound.tee }}</span>
              <span class="holes-label">{{ holesLabel }}</span>
              <span v-if="roundsStore.activeRound.room_code" class="room-code-badge">
                🔗 {{ roundsStore.activeRound.room_code }}
              </span>
            </div>
          </div>
          <button class="btn-icon share-btn" title="Share">
            <span>📤</span>
          </button>
        </header>

        <!-- Games Chips Strip -->
        <div v-if="roundsStore.activeGames.length > 0" class="games-strip">
          <div class="games-scroll">
            <button
              v-for="game in roundsStore.activeGames"
              :key="game.id"
              class="game-chip"
              :class="gameChipClass(game)"
              @click="selectedGame = game"
            >
              <span class="game-icon">{{ gameIcon(game.type) }}</span>
              <span class="game-name">{{ gameLabel(game.type) }}</span>
              <span class="game-status">{{ gameStatusEmoji(game) }}</span>
            </button>
          </div>
        </div>

        <!-- Hole Navigator -->
        <div class="hole-navigator">
          <button class="nav-btn nav-prev" @click="previousHole" :disabled="currentHoleIdx <= 0">
            <span>‹</span>
          </button>
          <div class="nav-display">
            <span class="nav-label">Hole</span>
            <span class="nav-number">{{ currentHole }}</span>
            <span class="nav-of">of {{ maxHole }}</span>
          </div>
          <button class="nav-btn nav-next" @click="nextHole" :disabled="currentHoleIdx >= maxHoleIdx">
            <span>›</span>
          </button>
        </div>

        <!-- Current Hole Card -->
        <div class="hole-card">
          <div class="hole-header">
            <div class="hole-title">
              <span class="hole-number">Hole {{ currentHole }}</span>
              <span class="hole-par">Par {{ parForHole(currentHole) }}</span>
            </div>
            <div class="hole-meta">
              <span class="hole-si">SI {{ siForHole(currentHole) }}</span>
              <span class="hole-yards" v-if="yardsForHole(currentHole)">{{ yardsForHole(currentHole) }}y</span>
            </div>
          </div>

          <!-- Player Scores -->
          <div class="hole-players">
            <div
              v-for="member in roundsStore.activeMembers"
              :key="member.id"
              class="player-row"
              @click="openScoreEntry(member, currentHole)"
            >
              <div class="player-info">
                <div class="player-name">{{ member.short_name || member.guest_name }}</div>
                <div class="player-hcp-indicator">
                  <span v-for="s in strokesOnHole(memberHandicap(member), siForHole(currentHole))" :key="s" class="stroke-dot">•</span>
                </div>
              </div>
              <div class="score-display">
                <div class="gross-score" :class="scoreClass(getScore(member.id, currentHole), parForHole(currentHole))">
                  {{ getScore(member.id, currentHole) || '—' }}
                </div>
                <div v-if="getScore(member.id, currentHole)" class="net-score">
                  {{ netScore(getScore(member.id, currentHole), memberHandicap(member), siForHole(currentHole)) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- View Scorecard Button -->
        <button class="btn-view-scorecard" @click="showScorecardModal = true">
          📋 View Full Scorecard
        </button>
      </template>

      <!-- Landscape Layout -->
      <template v-else>
        <div class="landscape-header">
          <h1>{{ roundsStore.activeRound.course_name }}</h1>
          <span class="landscape-meta">{{ formatDate(roundsStore.activeRound.date) }} • {{ roundsStore.activeRound.tee }}</span>
        </div>

        <!-- Landscape Scorecard Table -->
        <div class="scorecard-wrapper">
          <table class="scorecard-landscape">
            <thead>
              <tr>
                <th class="col-hole">Hole</th>
                <th v-for="member in roundsStore.activeMembers" :key="member.id" class="col-player">
                  {{ member.short_name || member.guest_name }}
                </th>
                <th class="col-hole">OUT</th>
                <th v-for="member in roundsStore.activeMembers" :key="`out-${member.id}`" class="col-player">
                  {{ (memberGrossTotal(member.id, 1, 9) !== '—') ? memberGrossTotal(member.id, 1, 9) : '—' }}
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Holes 1-9 -->
              <tr v-for="hole in [1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="`hole-${hole}`" class="row-hole">
                <td class="col-hole">{{ hole }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`${hole}-${member.id}`" class="col-player col-score" @click="openScoreEntry(member, hole)">
                  <span class="score-gross" :class="scoreClass(getScore(member.id, hole), parForHole(hole))">
                    {{ getScore(member.id, hole) || '—' }}
                  </span>
                  <span v-if="getScore(member.id, hole)" class="score-net">
                    {{ netScore(getScore(member.id, hole), memberHandicap(member), siForHole(hole)) }}
                  </span>
                </td>
                <td class="col-hole">{{ parForHole(hole) }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`par-${hole}-${member.id}`" class="col-player">
                  {{ parForHole(hole) }}
                </td>
              </tr>

              <!-- OUT row -->
              <tr class="row-total">
                <td class="col-hole">OUT</td>
                <td v-for="member in roundsStore.activeMembers" :key="`out-${member.id}`" class="col-player col-total">
                  {{ memberGrossTotal(member.id, 1, 9) }}
                </td>
                <td class="col-hole">{{ parTotal(1, 9) }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`out-net-${member.id}`" class="col-player col-total">
                  {{ memberNetTotal(member.id, 1, 9) }}
                </td>
              </tr>

              <!-- Holes 10-18 -->
              <tr v-for="hole in [10, 11, 12, 13, 14, 15, 16, 17, 18]" :key="`hole-${hole}`" class="row-hole">
                <td class="col-hole">{{ hole }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`${hole}-${member.id}`" class="col-player col-score" @click="openScoreEntry(member, hole)">
                  <span class="score-gross" :class="scoreClass(getScore(member.id, hole), parForHole(hole))">
                    {{ getScore(member.id, hole) || '—' }}
                  </span>
                  <span v-if="getScore(member.id, hole)" class="score-net">
                    {{ netScore(getScore(member.id, hole), memberHandicap(member), siForHole(hole)) }}
                  </span>
                </td>
                <td class="col-hole">{{ parForHole(hole) }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`par-${hole}-${member.id}`" class="col-player">
                  {{ parForHole(hole) }}
                </td>
              </tr>

              <!-- IN row -->
              <tr class="row-total">
                <td class="col-hole">IN</td>
                <td v-for="member in roundsStore.activeMembers" :key="`in-${member.id}`" class="col-player col-total">
                  {{ memberGrossTotal(member.id, 10, 18) }}
                </td>
                <td class="col-hole">{{ parTotal(10, 18) }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`in-net-${member.id}`" class="col-player col-total">
                  {{ memberNetTotal(member.id, 10, 18) }}
                </td>
              </tr>

              <!-- TOTAL row -->
              <tr class="row-grand-total">
                <td class="col-hole">TOTAL</td>
                <td v-for="member in roundsStore.activeMembers" :key="`tot-${member.id}`" class="col-player col-total">
                  {{ memberGrossTotal(member.id, 1, 18) }}
                </td>
                <td class="col-hole">{{ parTotal(1, 18) }}</td>
                <td v-for="member in roundsStore.activeMembers" :key="`tot-net-${member.id}`" class="col-player col-total">
                  {{ memberNetTotal(member.id, 1, 18) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Score Entry Modal -->
      <Transition name="overlay">
        <div v-if="entryMode" class="score-entry-overlay" @click="closeScoreEntry">
          <div class="score-entry-modal" @click.stop>
            <div class="entry-header">
              <div class="entry-title">
                <span class="entry-hole">Hole {{ entryHole }}</span>
                <span class="entry-par">Par {{ parForHole(entryHole) }}</span>
                <span class="entry-si">SI {{ siForHole(entryHole) }}</span>
              </div>
              <div class="entry-player">{{ entryMember.short_name || entryMember.guest_name }}</div>
            </div>

            <div class="score-input-area">
              <button class="btn-adjust btn-minus" @click="decrementScore">−</button>
              <div class="score-display">
                <div class="score-number" :class="scoreClass(entryScore, parForHole(entryHole))">
                  {{ entryScore }}
                </div>
                <div class="score-label">{{ scoreLabel(entryScore - parForHole(entryHole)) }}</div>
                <div v-if="entryScore" class="net-display">
                  Net: {{ netScore(entryScore, memberHandicap(entryMember), siForHole(entryHole)) }}
                </div>
              </div>
              <button class="btn-adjust btn-plus" @click="incrementScore">+</button>
            </div>

            <button class="btn-done" @click="saveScore">Done</button>
          </div>
        </div>
      </Transition>

      <!-- Full Scorecard Modal (Portrait) -->
      <Transition name="overlay">
        <div v-if="showScorecardModal && !isLandscape" class="score-entry-overlay" @click="showScorecardModal = false">
          <div class="scorecard-modal" @click.stop>
            <div class="modal-header">
              <h2>Full Scorecard</h2>
              <button class="btn-close" @click="showScorecardModal = false">✕</button>
            </div>
            <div class="modal-content">
              <table class="scorecard-in-modal">
                <thead>
                  <tr>
                    <th class="col-hole">Hole</th>
                    <th v-for="member in roundsStore.activeMembers" :key="member.id" class="col-player">
                      {{ member.short_name || member.guest_name }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="hole in allVisibleHoles" :key="`hole-${hole}`" class="row-hole">
                    <td class="col-hole">{{ hole }}</td>
                    <td v-for="member in roundsStore.activeMembers" :key="`${hole}-${member.id}`" class="col-player col-score" @click="openScoreEntry(member, hole)">
                      <span class="score-gross" :class="scoreClass(getScore(member.id, hole), parForHole(hole))">
                        {{ getScore(member.id, hole) || '—' }}
                      </span>
                      <span v-if="getScore(member.id, hole)" class="score-net">
                        {{ netScore(getScore(member.id, hole), memberHandicap(member), siForHole(hole)) }}
                      </span>
                    </td>
                  </tr>
                  <tr class="row-total">
                    <td class="col-hole">TOTAL</td>
                    <td v-for="member in roundsStore.activeMembers" :key="`tot-${member.id}`" class="col-player col-total">
                      {{ memberGrossTotal(member.id, 1, 18) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { COURSES } from '../modules/courses'
import { memberHandicap as _memberHandicap, strokesOnHole, holeSI, holePar, holeYards, netScore as calcNetScore } from '../modules/gameEngine'

const roundsStore = useRoundsStore()

// Screen orientation
const isLandscape = ref(false)
const currentHoleIdx = ref(0)
const entryMode = ref(false)
const entryMember = ref(null)
const entryHole = ref(null)
const entryScore = ref(null)
const selectedGame = ref(null)
const showScorecardModal = ref(false)

// Orientation detection
function updateOrientation() {
  isLandscape.value = window.matchMedia('(orientation: landscape)').matches
}

onMounted(() => {
  updateOrientation()
  window.addEventListener('orientationchange', updateOrientation)
  window.addEventListener('resize', updateOrientation)
})

onUnmounted(() => {
  window.removeEventListener('orientationchange', updateOrientation)
  window.removeEventListener('resize', updateOrientation)
})

// Course data
const courseData = computed(() => {
  if (!roundsStore.activeRound) return null
  return COURSES[roundsStore.activeRound.course_name] || null
})

const holesLabel = computed(() => {
  const mode = roundsStore.activeRound?.holes_mode || '18'
  if (mode === 'front9') return 'Front 9'
  if (mode === 'back9') return 'Back 9'
  return '18 Holes'
})

const visibleHoles = computed(() => {
  const mode = roundsStore.activeRound?.holes_mode || '18'
  if (mode === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1)
  if (mode === 'back9') return Array.from({ length: 9 }, (_, i) => i + 10)
  return Array.from({ length: 18 }, (_, i) => i + 1)
})

const allVisibleHoles = computed(() => visibleHoles.value)

const maxHole = computed(() => visibleHoles.value[visibleHoles.value.length - 1])
const maxHoleIdx = computed(() => visibleHoles.value.length - 1)

const currentHole = computed(() => visibleHoles.value[currentHoleIdx.value] ?? 1)

// Hole navigation
function previousHole() {
  if (currentHoleIdx.value > 0) currentHoleIdx.value--
}

function nextHole() {
  if (currentHoleIdx.value < maxHoleIdx.value) currentHoleIdx.value++
}

// Course helpers
function parForHole(hole) {
  const cd = courseData.value
  if (!cd || !cd.par) return 4
  return cd.par[hole - 1] ?? 4
}

function siForHole(hole) {
  const cd = courseData.value
  if (!cd || !cd.si) return hole
  return cd.si[hole - 1] ?? hole
}

function yardsForHole(hole) {
  const cd = courseData.value
  const tee = roundsStore.activeRound?.tee
  if (!cd || !tee || !cd.teesData || !cd.teesData[tee]) return null
  return cd.teesData[tee].yardsByHole?.[hole - 1] ?? null
}

// Score getters
function getScore(memberId, hole) {
  return roundsStore.activeScores[memberId]?.[hole] ?? null
}

function memberHandicapValue(member) {
  return _memberHandicap(member, courseData.value, roundsStore.activeRound?.tee)
}

// Alias used by template
const memberHandicap = memberHandicapValue

function netScore(gross, hcp, si) {
  if (gross == null) return null
  return gross - strokesOnHole(hcp, si)
}

function scoreClass(score, par) {
  if (score === null) return 'score-empty'
  const diff = score - par
  if (diff <= -2) return 'score-eagle'
  if (diff === -1) return 'score-birdie'
  if (diff === 0) return 'score-par'
  if (diff === 1) return 'score-bogey'
  return 'score-double'
}

function scoreLabel(diff) {
  if (diff === null || diff === undefined) return ''
  if (diff <= -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double'
  return `+${diff}`
}

function memberGrossTotal(memberId, startHole = 1, endHole = 18) {
  let total = 0
  let count = 0
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s !== null) {
      total += s
      count++
    }
  }
  return count > 0 ? total : '—'
}

function memberNetTotal(memberId, startHole = 1, endHole = 18) {
  let total = 0
  let count = 0
  const member = roundsStore.activeMembers.find(m => m.id === memberId)
  if (!member) return '—'
  const hcp = memberHandicapValue(member)
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s !== null) {
      const si = siForHole(h)
      const strokes = strokesOnHole(hcp, si)
      total += s - strokes
      count++
    }
  }
  return count > 0 ? total : '—'
}

function parTotal(startHole = 1, endHole = 18) {
  let total = 0
  for (let h = startHole; h <= endHole; h++) {
    total += parForHole(h)
  }
  return total
}

// Game helpers
function gameIcon(type) {
  const t = type?.toLowerCase() || ''
  const icons = {
    nassau: '💰', skins: '💎', match: '⚔️', matchplay: '⚔️',
    bestball: '🤝', snake: '🐍', dots: '●', fidget: '🎲',
    bbn: '🏌️', match1v1: '1v1',
  }
  return icons[t] || '🎮'
}

function gameLabel(type) {
  const t = type?.toLowerCase() || ''
  const labels = {
    nassau: 'Nassau', skins: 'Skins', match: 'Match', matchplay: 'Match Play',
    bestball: 'Best Ball', snake: 'Snake', dots: 'Dots', fidget: 'Fidget',
    bbn: 'BBN', match1v1: '1v1',
  }
  return labels[t] || type
}

function gameStatusEmoji(game) {
  return '▶'
}

function gameChipClass(game) {
  return 'game-chip-active'
}

// Score entry modal
function openScoreEntry(member, hole) {
  entryMember.value = member
  entryHole.value = hole
  const existing = getScore(member.id, hole)
  entryScore.value = existing !== null ? existing : parForHole(hole)
  entryMode.value = true
}

function closeScoreEntry() {
  entryMode.value = false
  setTimeout(() => {
    entryMember.value = null
    entryHole.value = null
    entryScore.value = null
  }, 300)
}

function incrementScore() {
  if (entryScore.value < 13) {
    entryScore.value++
  }
}

function decrementScore() {
  if (entryScore.value > 1) {
    entryScore.value--
  }
}

async function saveScore() {
  try {
    await roundsStore.setScore(entryMember.value.id, entryHole.value, entryScore.value)
    closeScoreEntry()
  } catch (error) {
    console.error('Failed to save score:', error)
  }
}

// Utilities
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════════
   ROOT & LAYOUT
   ══════════════════════════════════════════════════════════════════ */

.scoring-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--gw-neutral-50);
  overflow: hidden;
}

.scoring-view.landscape-mode {
  flex-direction: row;
}

.round-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ══════════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════════ */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-title {
  font-family: var(--gw-font-display);
  font-size: 1.75rem;
  color: var(--gw-neutral-900);
  margin: 0 0 0.5rem 0;
}

.empty-message {
  font-family: var(--gw-font-body);
  font-size: 1rem;
  color: var(--gw-neutral-600);
  margin: 0 0 2rem 0;
}

.btn-start-round {
  padding: 0.75rem 2rem;
  background: var(--gw-green-500);
  color: white;
  border: none;
  border-radius: 999px;
  font-family: var(--gw-font-body);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}

.btn-start-round:hover {
  background: var(--gw-green-600);
}

.btn-start-round:active {
  background: var(--gw-green-700);
}

/* ══════════════════════════════════════════════════════════════════
   PORTRAIT: HEADER
   ══════════════════════════════════════════════════════════════════ */

.scoring-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 1rem 1rem;
  background: white;
  border-bottom: 1px solid var(--gw-neutral-200);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.header-left {
  flex: 1;
}

.course-name {
  font-family: var(--gw-font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gw-neutral-900);
  margin: 0 0 0.5rem 0;
  line-height: 1.2;
}

.header-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  font-family: var(--gw-font-body);
  font-size: 0.8rem;
  color: var(--gw-neutral-600);
}

.date, .tee, .holes-label {
  padding: 0.25rem 0.5rem;
}

.room-code-badge {
  padding: 0.375rem 0.75rem;
  background: var(--gw-green-100);
  color: var(--gw-green-700);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.share-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* ══════════════════════════════════════════════════════════════════
   PORTRAIT: GAMES STRIP
   ══════════════════════════════════════════════════════════════════ */

.games-strip {
  padding: 0.75rem 1rem;
  background: white;
  border-bottom: 1px solid var(--gw-neutral-100);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  flex-shrink: 0;
}

.games-scroll {
  display: flex;
  gap: 0.75rem;
  min-width: min-content;
}

.game-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--gw-neutral-100);
  border: 1px solid var(--gw-neutral-200);
  border-radius: 999px;
  font-family: var(--gw-font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gw-neutral-700);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.game-chip:active {
  background: var(--gw-neutral-200);
}

.game-chip-active {
  background: var(--gw-green-100);
  border-color: var(--gw-green-300);
  color: var(--gw-green-700);
}

.game-icon {
  font-size: 1.25rem;
}

.game-name {
  font-weight: 600;
}

.game-status {
  opacity: 0.7;
  font-size: 0.75rem;
}

/* ══════════════════════════════════════════════════════════════════
   PORTRAIT: HOLE NAVIGATOR
   ══════════════════════════════════════════════════════════════════ */

.hole-navigator {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-bottom: 1px solid var(--gw-neutral-100);
  gap: 1rem;
  flex-shrink: 0;
}

.nav-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--gw-green-500);
  color: white;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  min-width: 50px;
  -webkit-tap-highlight-color: transparent;
  font-weight: 300;
}

.nav-btn:active {
  background: var(--gw-green-600);
}

.nav-btn:disabled {
  background: var(--gw-neutral-300);
  cursor: not-allowed;
}

.nav-display {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nav-label {
  font-family: var(--gw-font-body);
  font-size: 0.75rem;
  color: var(--gw-neutral-500);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nav-number {
  font-family: var(--gw-font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--gw-neutral-900);
  line-height: 1;
}

.nav-of {
  font-family: var(--gw-font-body);
  font-size: 0.75rem;
  color: var(--gw-neutral-500);
  margin-top: 0.25rem;
}

/* ══════════════════════════════════════════════════════════════════
   PORTRAIT: HOLE CARD
   ══════════════════════════════════════════════════════════════════ */

.hole-card {
  flex: 1;
  background: white;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.hole-header {
  padding: 1rem;
  background: var(--gw-neutral-50);
  border-bottom: 1px solid var(--gw-neutral-200);
  flex-shrink: 0;
}

.hole-title {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.hole-number {
  font-family: var(--gw-font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gw-neutral-900);
}

.hole-par {
  font-family: var(--gw-font-body);
  font-size: 1rem;
  color: var(--gw-neutral-600);
  font-weight: 600;
}

.hole-meta {
  display: flex;
  gap: 1rem;
  font-family: var(--gw-font-body);
  font-size: 0.85rem;
  color: var(--gw-neutral-600);
}

.hole-si, .hole-yards {
  padding: 0.25rem 0.5rem;
}

.hole-players {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.75rem;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: var(--gw-neutral-50);
  border-radius: var(--gw-radius-lg);
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  min-height: 80px;
  -webkit-tap-highlight-color: transparent;
}

.player-row:active {
  background: var(--gw-neutral-100);
  border-color: var(--gw-green-300);
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-name {
  font-family: var(--gw-font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--gw-neutral-900);
}

.player-hcp-indicator {
  display: flex;
  gap: 0.25rem;
  font-size: 0.6rem;
  color: var(--gw-neutral-400);
}

.stroke-dot {
  font-weight: bold;
}

.score-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 60px;
}

.gross-score {
  font-family: var(--gw-font-mono);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  min-width: 60px;
  text-align: center;
  border-radius: 0.5rem;
  padding: 0.5rem;
}

.gross-score.score-empty {
  color: var(--gw-neutral-400);
  font-weight: 400;
}

.gross-score.score-par {
  color: var(--gw-neutral-900);
}

.gross-score.score-birdie {
  background: var(--gw-green-500);
  color: white;
}

.gross-score.score-eagle {
  background: var(--gw-eagle);
  color: white;
}

.gross-score.score-bogey {
  color: var(--gw-bogey);
  font-weight: 700;
}

.gross-score.score-double {
  color: var(--gw-double);
  font-weight: 700;
}

.net-score {
  font-family: var(--gw-font-body);
  font-size: 0.75rem;
  color: var(--gw-neutral-500);
  font-weight: 500;
}

/* ══════════════════════════════════════════════════════════════════
   PORTRAIT: VIEW SCORECARD BUTTON
   ══════════════════════════════════════════════════════════════════ */

.btn-view-scorecard {
  padding: 1rem;
  background: var(--gw-green-500);
  color: white;
  border: none;
  border-radius: 0;
  font-family: var(--gw-font-body);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 56px;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  margin-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom));
}

.btn-view-scorecard:active {
  background: var(--gw-green-600);
}

/* ══════════════════════════════════════════════════════════════════
   LANDSCAPE: HEADER
   ══════════════════════════════════════════════════════════════════ */

.landscape-header {
  padding: 1rem;
  background: white;
  border-bottom: 1px solid var(--gw-neutral-200);
  flex-shrink: 0;
}

.landscape-header h1 {
  font-family: var(--gw-font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gw-neutral-900);
  margin: 0 0 0.5rem 0;
}

.landscape-meta {
  font-family: var(--gw-font-body);
  font-size: 0.875rem;
  color: var(--gw-neutral-600);
}

/* ══════════════════════════════════════════════════════════════════
   LANDSCAPE: SCORECARD TABLE
   ══════════════════════════════════════════════════════════════════ */

.scorecard-wrapper {
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background: white;
}

.scorecard-landscape {
  border-collapse: collapse;
  width: 100%;
  font-family: var(--gw-font-body);
  font-size: 0.85rem;
}

.scorecard-landscape thead {
  position: sticky;
  top: 0;
  background: var(--gw-neutral-50);
  z-index: 10;
}

.scorecard-landscape th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gw-neutral-700);
  border-bottom: 2px solid var(--gw-neutral-200);
  white-space: nowrap;
}

.scorecard-landscape td {
  padding: 0.75rem 0.5rem;
  text-align: center;
  border-bottom: 1px solid var(--gw-neutral-100);
  font-size: 0.85rem;
}

.col-hole {
  min-width: 3rem;
  width: 3rem;
  position: sticky;
  left: 0;
  z-index: 5;
  background: var(--gw-neutral-50);
  font-weight: 600;
  color: var(--gw-neutral-700);
}

.col-player {
  min-width: 4rem;
  width: 4rem;
}

.col-score {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.col-score:active {
  background: var(--gw-neutral-200);
}

.score-gross {
  display: block;
  font-family: var(--gw-font-mono);
  font-weight: 600;
}

.score-gross.score-birdie {
  color: var(--gw-green-500);
}

.score-gross.score-eagle {
  color: var(--gw-eagle);
}

.score-gross.score-bogey {
  color: var(--gw-bogey);
}

.score-gross.score-double {
  color: var(--gw-double);
}

.score-net {
  display: block;
  font-size: 0.7rem;
  color: var(--gw-neutral-500);
  margin-top: 0.2rem;
}

.col-total {
  background: var(--gw-neutral-100);
  font-weight: 700;
  color: var(--gw-neutral-900);
}

.row-total {
  background: var(--gw-neutral-100);
  border-top: 2px solid var(--gw-neutral-300);
  border-bottom: 1px solid var(--gw-neutral-300);
}

.row-grand-total {
  background: var(--gw-neutral-100);
  border-top: 2px solid var(--gw-neutral-300);
  border-bottom: 2px solid var(--gw-neutral-300);
  font-weight: 700;
}

/* ══════════════════════════════════════════════════════════════════
   SCORE ENTRY MODAL & OVERLAY
   ══════════════════════════════════════════════════════════════════ */

.score-entry-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 100;
  -webkit-tap-highlight-color: transparent;
}

.score-entry-modal {
  width: 100%;
  background: white;
  border-radius: var(--gw-radius-xl) var(--gw-radius-xl) 0 0;
  padding: 1.5rem 1rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
}

.entry-header {
  text-align: center;
  margin-bottom: 2rem;
}

.entry-title {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  font-family: var(--gw-font-body);
  font-size: 0.875rem;
  color: var(--gw-neutral-600);
  margin-bottom: 0.5rem;
}

.entry-hole {
  font-weight: 700;
  color: var(--gw-neutral-900);
}

.entry-par, .entry-si {
  opacity: 0.7;
}

.entry-player {
  font-family: var(--gw-font-display);
  font-size: 1.5rem;
  color: var(--gw-neutral-900);
  font-weight: 700;
}

.score-input-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.btn-adjust {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--gw-neutral-100);
  border: 2px solid var(--gw-neutral-300);
  font-size: 2rem;
  font-weight: 300;
  color: var(--gw-neutral-700);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  min-height: 72px;
  min-width: 72px;
}

.btn-adjust:active {
  background: var(--gw-neutral-200);
  border-color: var(--gw-neutral-400);
}

.score-display {
  text-align: center;
}

.score-number {
  font-family: var(--gw-font-mono);
  font-size: 5rem;
  font-weight: 700;
  line-height: 1;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gw-neutral-900);
}

.score-number.score-eagle {
  color: var(--gw-eagle);
}

.score-number.score-birdie {
  color: var(--gw-green-500);
}

.score-number.score-bogey {
  color: var(--gw-bogey);
}

.score-number.score-double {
  color: var(--gw-double);
}

.score-label {
  font-family: var(--gw-font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--gw-neutral-600);
  margin-top: 0.5rem;
}

.net-display {
  font-family: var(--gw-font-body);
  font-size: 0.875rem;
  color: var(--gw-neutral-500);
  margin-top: 0.5rem;
}

.btn-done {
  width: 100%;
  padding: 1rem;
  background: var(--gw-green-500);
  color: white;
  border: none;
  border-radius: var(--gw-radius-lg);
  font-family: var(--gw-font-body);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-height: 56px;
  -webkit-tap-highlight-color: transparent;
}

.btn-done:active {
  background: var(--gw-green-600);
}

/* ══════════════════════════════════════════════════════════════════
   SCORECARD MODAL
   ══════════════════════════════════════════════════════════════════ */

.scorecard-modal {
  width: 100%;
  max-width: 90vh;
  max-height: 80vh;
  background: white;
  border-radius: var(--gw-radius-xl);
  display: flex;
  flex-direction: column;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--gw-neutral-200);
  flex-shrink: 0;
}

.modal-header h2 {
  font-family: var(--gw-font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gw-neutral-900);
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gw-neutral-500);
  padding: 0.5rem;
  min-width: 44px;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1rem;
}

.scorecard-in-modal {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85rem;
}

.scorecard-in-modal thead {
  position: sticky;
  top: 0;
  background: var(--gw-neutral-50);
}

.scorecard-in-modal th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gw-neutral-700);
  border-bottom: 1px solid var(--gw-neutral-200);
}

.scorecard-in-modal td {
  padding: 0.75rem 0.5rem;
  text-align: center;
  border-bottom: 1px solid var(--gw-neutral-100);
}

.scorecard-in-modal .col-score {
  cursor: pointer;
}

.scorecard-in-modal .col-total {
  background: var(--gw-neutral-100);
  font-weight: 700;
}

/* ══════════════════════════════════════════════════════════════════
   TRANSITIONS
   ══════════════════════════════════════════════════════════════════ */

.overlay-enter-active,
.overlay-leave-active {
  transition: all 0.3s ease;
}

.overlay-enter-from {
  opacity: 0;
}

.overlay-enter-from .score-entry-modal,
.overlay-enter-from .scorecard-modal {
  transform: translateY(100%);
}

.overlay-leave-to {
  opacity: 0;
}

.overlay-leave-to .score-entry-modal,
.overlay-leave-to .scorecard-modal {
  transform: translateY(100%);
}

/* ══════════════════════════════════════════════════════════════════
   RESPONSIVE & MOBILE
   ══════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .course-name {
    font-size: 1.5rem;
  }

  .hole-number {
    font-size: 1.25rem;
  }

  .player-row {
    padding: 0.75rem;
    min-height: 70px;
  }

  .score-number {
    font-size: 3.5rem;
    min-height: 80px;
  }

  .btn-adjust {
    width: 60px;
    height: 60px;
    font-size: 1.5rem;
    min-height: 60px;
    min-width: 60px;
  }
}

@media (max-height: 600px) {
  .score-entry-modal {
    padding: 1rem 1rem;
  }

  .entry-header {
    margin-bottom: 1rem;
  }

  .score-input-area {
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .score-number {
    font-size: 3rem;
    min-height: 70px;
  }

  .btn-adjust {
    width: 52px;
    height: 52px;
    min-height: 52px;
    min-width: 52px;
  }
}
</style>
