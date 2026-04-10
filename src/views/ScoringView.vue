<template>
  <div class="view scoring-view">
    <!-- Empty State -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🏌️</div>
      <h2 class="empty-title">No Active Round</h2>
      <p class="empty-message">Start a new round to begin tracking scores</p>
      <button class="btn-start-round">Start New Round</button>
    </div>

    <!-- Active Round -->
    <div v-else class="round-container">
      <!-- Header -->
      <header class="scoring-header">
        <div class="header-left">
          <h1 class="course-name">{{ roundsStore.activeRound.course_name }}</h1>
          <div class="header-meta">
            <span class="date">{{ formatDate(roundsStore.activeRound.date) }}</span>
            <span class="holes-mode">{{ holesLabel }}</span>
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
            :class="`game-${gameStatusClass(game)}`"
            @click="selectedGame = game"
          >
            <span class="game-icon">{{ gameIcon(game) }}</span>
            <span class="game-name">{{ game.type }}</span>
            <span class="game-balance">{{ gameBalance(game) }}</span>
          </button>
        </div>
      </div>

      <!-- Scorecard Grid -->
      <div class="scorecard-wrapper">
        <table class="scorecard">
          <thead>
            <tr>
              <th class="col-hole">Hole</th>
              <th v-for="member in roundsStore.activeMembers" :key="member.id" class="col-player">
                {{ member.short_name || member.guest_name || 'P' }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Par Row -->
            <tr class="row-par">
              <td class="col-hole">Par</td>
              <td
                v-for="member in roundsStore.activeMembers"
                :key="`par-${member.id}`"
                class="col-player"
              >
                {{ parForHole(1) }}
              </td>
            </tr>

            <!-- SI Row -->
            <tr class="row-si">
              <td class="col-hole">SI</td>
              <td
                v-for="member in roundsStore.activeMembers"
                :key="`si-${member.id}`"
                class="col-player"
              >
                {{ siForHole(1) }}
              </td>
            </tr>

            <!-- Hole Rows -->
            <tr
              v-for="(hole, idx) in visibleHoles"
              :key="hole"
              class="row-hole"
              :class="{ 'row-alt': idx % 2 === 1 }"
            >
              <td class="col-hole">{{ hole }}</td>
              <td
                v-for="member in roundsStore.activeMembers"
                :key="`${hole}-${member.id}`"
                class="col-player col-score"
                @click="openScoreEntry(member, hole)"
              >
                <span
                  v-if="getScore(member.id, hole) !== null"
                  class="score-cell"
                  :class="scoreClass(getScore(member.id, hole), parForHole(hole))"
                >
                  {{ getScore(member.id, hole) }}
                </span>
                <span v-else class="score-cell score-empty">—</span>
              </td>
            </tr>

            <!-- OUT (Front 9) -->
            <tr class="row-total">
              <td class="col-hole">OUT</td>
              <td
                v-for="member in roundsStore.activeMembers"
                :key="`out-${member.id}`"
                class="col-player col-total"
              >
                {{ grossTotal(member.id, 1, 9) }}
              </td>
            </tr>

            <!-- IN (Back 9) -->
            <tr class="row-total">
              <td class="col-hole">IN</td>
              <td
                v-for="member in roundsStore.activeMembers"
                :key="`in-${member.id}`"
                class="col-player col-total"
              >
                {{ grossTotal(member.id, 10, 18) }}
              </td>
            </tr>

            <!-- TOTAL -->
            <tr class="row-grand-total">
              <td class="col-hole">TOT</td>
              <td
                v-for="member in roundsStore.activeMembers"
                :key="`tot-${member.id}`"
                class="col-player col-total"
              >
                {{ grossTotal(member.id, 1, 18) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Score Entry Overlay -->
      <Transition name="overlay">
        <div v-if="entryMode" class="score-entry-overlay" @click="closeScoreEntry">
          <div class="score-entry-modal" @click.stop>
            <!-- Header -->
            <div class="entry-header">
              <div class="entry-title">
                <span class="entry-hole">Hole {{ entryHole }}</span>
                <span class="entry-par">Par {{ parForHole(entryHole) }}</span>
                <span class="entry-si">SI {{ siForHole(entryHole) }}</span>
              </div>
              <div class="entry-player">{{ entryMember.short_name || entryMember.guest_name }}</div>
            </div>

            <!-- Score Display -->
            <div class="score-input-area">
              <button class="btn-adjust btn-minus" @click="decrementScore">−</button>
              <div class="score-display">
                <div class="score-number" :class="scoreClass(entryScore, parForHole(entryHole))">
                  {{ entryScore }}
                </div>
                <div class="score-label">{{ scoreLabel(entryScore - parForHole(entryHole)) }}</div>
              </div>
              <button class="btn-adjust btn-plus" @click="incrementScore">+</button>
            </div>

            <!-- Buttons -->
            <button class="btn-done" @click="saveScore">Done</button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { COURSES } from '../modules/courses'

const roundsStore = useRoundsStore()

// Score entry state
const entryMode = ref(false)
const entryMember = ref(null)
const entryHole = ref(null)
const entryScore = ref(null)
const selectedGame = ref(null)

// Computed: course data
const courseData = computed(() => {
  if (!roundsStore.activeRound) return null
  return COURSES[roundsStore.activeRound.course_name] || null
})

// Computed: holes label (18, front 9, back 9)
const holesLabel = computed(() => {
  const mode = roundsStore.activeRound?.holes_mode || '18'
  if (mode === 'front9') return '⛳ Front 9'
  if (mode === 'back9') return '⛳ Back 9'
  return '⛳ 18 Holes'
})

// Computed: visible holes based on mode
const visibleHoles = computed(() => {
  const mode = roundsStore.activeRound?.holes_mode || '18'
  if (mode === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1)
  if (mode === 'back9') return Array.from({ length: 9 }, (_, i) => i + 10)
  return Array.from({ length: 18 }, (_, i) => i + 1)
})

// ── Score getters ───────────────────────────────────────
function parForHole(hole) {
  const tee = roundsStore.activeRound?.tee
  const cd = courseData.value
  if (!cd || !tee || !cd.teesData || !cd.teesData[tee]) {
    return 4
  }
  const holeIdx = hole - 1
  return cd.par?.[holeIdx] ?? 4
}

function siForHole(hole) {
  const tee = roundsStore.activeRound?.tee
  const cd = courseData.value
  if (!cd || !tee || !cd.teesData || !cd.teesData[tee]) {
    return hole
  }
  const holeIdx = hole - 1
  return cd.si?.[holeIdx] ?? hole
}

function getScore(memberId, hole) {
  return roundsStore.activeScores[memberId]?.[hole] ?? null
}

function scoreVsPar(score, par) {
  if (score === null) return null
  return score - par
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

function scoreClass(score, par) {
  if (score === null) return 'score-empty'
  const diff = score - par
  if (diff <= -2) return 'score-eagle'
  if (diff === -1) return 'score-birdie'
  if (diff === 0) return 'score-par'
  if (diff === 1) return 'score-bogey'
  return 'score-double'
}

function grossTotal(memberId, startHole = 1, endHole = 18) {
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

// ── Game helpers ───────────────────────────────────────
function gameIcon(game) {
  const type = game.type?.toLowerCase() || ''
  if (type === 'nassau') return '💰'
  if (type === 'match') return '⚔️'
  if (type === 'vegas') return '🎰'
  if (type === 'wolf') return '🐺'
  if (type === 'skins') return '💎'
  return '🎮'
}

function gameBalance(game) {
  // Placeholder: would calculate actual balance from game config
  // For now, return neutral state
  return '—'
}

function gameStatusClass(game) {
  // 'winning' | 'losing' | 'even'
  // Placeholder: would determine from game state
  return 'even'
}

// ── Score entry modal ───────────────────────────────────
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

// ── Utilities ───────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
  min-width: 44px;
  -webkit-tap-highlight-color: transparent;
}

.btn-start-round:hover {
  background: var(--gw-green-600);
}

.btn-start-round:active {
  background: var(--gw-green-700);
}

/* ══════════════════════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════════════════════ */

.scoring-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 1rem;
  background: white;
  border-bottom: 1px solid var(--gw-neutral-200);
  box-shadow: var(--gw-shadow-card);
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
}

.header-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  font-family: var(--gw-font-body);
  font-size: 0.875rem;
  color: var(--gw-neutral-600);
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
  font-size: 1.25rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-btn:hover {
  opacity: 0.7;
}

/* ══════════════════════════════════════════════════════════════════
   GAMES STRIP
   ══════════════════════════════════════════════════════════════════ */

.games-strip {
  padding: 1rem;
  background: white;
  border-bottom: 1px solid var(--gw-neutral-100);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
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

.game-chip:hover {
  background: var(--gw-neutral-200);
}

.game-chip.game-winning {
  background: var(--gw-green-100);
  border-color: var(--gw-green-300);
  color: var(--gw-green-700);
}

.game-chip.game-losing {
  background: var(--gw-bogey);
  background-color: rgba(239, 68, 68, 0.1);
  border-color: var(--gw-bogey);
  color: var(--gw-bogey);
}

.game-icon {
  font-size: 1.25rem;
}

.game-name {
  font-weight: 600;
}

.game-balance {
  opacity: 0.75;
}

/* ══════════════════════════════════════════════════════════════════
   SCORECARD GRID
   ══════════════════════════════════════════════════════════════════ */

.scorecard-wrapper {
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background: white;
}

.scorecard {
  border-collapse: collapse;
  width: 100%;
  min-width: 100%;
  font-family: var(--gw-font-body);
}

.scorecard thead {
  position: sticky;
  top: 0;
  background: var(--gw-neutral-50);
  z-index: 10;
}

.scorecard th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gw-neutral-700);
  border-bottom: 2px solid var(--gw-neutral-200);
  white-space: nowrap;
}

.col-hole {
  min-width: 3rem;
  width: 3rem;
  position: sticky;
  left: 0;
  z-index: 5;
  background: var(--gw-neutral-50);
}

.col-player {
  min-width: 4rem;
  width: 4rem;
}

.scorecard td {
  padding: 0.75rem 0.5rem;
  text-align: center;
  border-bottom: 1px solid var(--gw-neutral-100);
  font-size: 0.875rem;
}

.col-hole {
  font-weight: 600;
  color: var(--gw-neutral-700);
  background: white;
}

.row-alt .col-hole {
  background: var(--gw-neutral-50);
}

.row-alt {
  background: var(--gw-neutral-50);
}

.row-par .col-hole,
.row-si .col-hole {
  color: var(--gw-neutral-600);
  font-weight: 500;
}

.row-par,
.row-si {
  background: var(--gw-neutral-100);
}

.row-par .col-player,
.row-si .col-player {
  color: var(--gw-neutral-600);
  font-weight: 500;
}

.row-total,
.row-grand-total {
  background: var(--gw-neutral-100);
  border-top: 2px solid var(--gw-neutral-300);
  border-bottom: 2px solid var(--gw-neutral-300);
}

.row-total .col-hole,
.row-grand-total .col-hole {
  font-weight: 700;
  color: var(--gw-neutral-900);
}

.row-total .col-player,
.row-grand-total .col-player {
  font-weight: 700;
  color: var(--gw-neutral-900);
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

/* Score cell styling */
.score-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  border-radius: 50%;
  font-family: var(--gw-font-mono);
  font-weight: 600;
  transition: all 0.2s ease;
}

.score-cell.score-empty {
  color: var(--gw-neutral-400);
  font-weight: 400;
}

.score-cell.score-par {
  color: var(--gw-neutral-900);
}

.score-cell.score-birdie {
  background: var(--gw-green-500);
  color: white;
}

.score-cell.score-eagle {
  background: var(--gw-eagle);
  color: white;
}

.score-cell.score-bogey {
  color: var(--gw-bogey);
  font-weight: 700;
}

.score-cell.score-double {
  color: var(--gw-double);
  font-weight: 700;
}

.col-total {
  font-weight: 700;
  color: var(--gw-neutral-900);
  background: var(--gw-neutral-100);
}

/* ══════════════════════════════════════════════════════════════════
   SCORE ENTRY OVERLAY & MODAL
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
  box-shadow: var(--gw-shadow-lg);
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

.entry-par,
.entry-si {
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
  font-size: 7.5rem;
  font-weight: 700;
  line-height: 1;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gw-neutral-900);
  animation: score-pop 0.4s ease;
}

.score-number.score-eagle {
  color: var(--gw-eagle);
}

.score-number.score-birdie {
  color: var(--gw-green-500);
}

.score-number.score-par {
  color: var(--gw-neutral-900);
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

@keyframes score-pop {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.15);
  }
  70% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
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

.btn-done:hover {
  background: var(--gw-green-600);
}

.btn-done:active {
  background: var(--gw-green-700);
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

.overlay-enter-from .score-entry-modal {
  transform: translateY(100%);
}

.overlay-leave-to {
  opacity: 0;
}

.overlay-leave-to .score-entry-modal {
  transform: translateY(100%);
}

/* ══════════════════════════════════════════════════════════════════
   MOBILE & RESPONSIVE
   ══════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .scoring-header {
    padding: 1rem 0.75rem;
  }

  .course-name {
    font-size: 1.5rem;
  }

  .header-meta {
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .scorecard th,
  .scorecard td {
    padding: 0.5rem 0.25rem;
    font-size: 0.75rem;
  }

  .col-hole {
    min-width: 2.5rem;
    width: 2.5rem;
  }

  .col-player {
    min-width: 3.5rem;
    width: 3.5rem;
  }

  .score-cell {
    min-width: 1.75rem;
    height: 1.75rem;
    font-size: 0.75rem;
  }

  .score-number {
    font-size: 5rem;
    min-height: 80px;
  }

  .btn-adjust {
    width: 56px;
    height: 56px;
    font-size: 1.5rem;
    min-height: 56px;
    min-width: 56px;
  }

  .score-input-area {
    gap: 1rem;
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
    font-size: 4rem;
    min-height: 80px;
  }

  .btn-adjust {
    width: 52px;
    height: 52px;
    min-height: 52px;
    min-width: 52px;
  }
}
</style>
