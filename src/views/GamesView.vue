<template>
  <div class="games-view">
    <!-- Header -->
    <header class="games-header">
      <h1 class="games-title">Games</h1>
      <div v-if="roundsStore.activeRound" class="round-badge">
        <span class="round-badge-dot" />
        Live
      </div>
    </header>

    <!-- No active round -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🎯</div>
      <div class="empty-title">No active round</div>
      <div class="empty-sub">Start a round from the home screen to configure and track games.</div>
      <router-link to="/" class="btn-primary">Go Home</router-link>
    </div>

    <!-- Active round with games -->
    <template v-else>
      <!-- Round info strip -->
      <div class="round-info">
        <div class="round-course">{{ roundsStore.activeRound.course_name }}</div>
        <div class="round-date">{{ formatDate(roundsStore.activeRound.date) }}</div>
        <div v-if="roundsStore.activeRound.room_code" class="round-code">
          <span class="code-icon">📡</span>
          {{ roundsStore.activeRound.room_code }}
        </div>
      </div>

      <!-- Scoreboard summary -->
      <div class="scoreboard-section">
        <div class="section-label">Scores Through {{ holesPlayed }} Holes</div>
        <div class="scoreboard-strip">
          <div
            v-for="member in sortedMembers"
            :key="member.id"
            class="player-score-card"
            :class="{ 'player-score-card--leading': member.isLeading }"
          >
            <div class="ps-name">{{ member.short_name || member.guest_name }}</div>
            <div class="ps-total" :class="totalClass(member)">
              {{ formatTotal(member) }}
            </div>
            <div class="ps-thru">
              <span v-if="memberHolesPlayed(member) > 0">thru {{ memberHolesPlayed(member) }}</span>
              <span v-else class="ps-thru-empty">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- No games configured -->
      <div v-if="!roundsStore.activeGames.length" class="no-games-state">
        <div class="no-games-icon">🎮</div>
        <div class="no-games-title">No games added</div>
        <div class="no-games-sub">
          Games are set up when you start a round. To add games, finish this round and start a new one.
        </div>
      </div>

      <!-- Game cards -->
      <div v-else class="games-list">
        <div class="section-label">Active Games</div>

        <div
          v-for="game in roundsStore.activeGames"
          :key="game.id"
          class="game-card"
          :class="`game-card--${gameStyle(game.type)}`"
          @click="toggleExpanded(game.id)"
        >
          <!-- Card header -->
          <div class="game-card-header">
            <div class="game-icon">{{ gameIcon(game.type) }}</div>
            <div class="game-info">
              <div class="game-name">{{ gameLabel(game.type) }}</div>
              <div class="game-config-summary">{{ configSummary(game) }}</div>
            </div>
            <div class="game-status">
              <div class="expand-arrow" :class="{ expanded: expandedIds.has(game.id) }">›</div>
            </div>
          </div>

          <!-- Expanded standings -->
          <transition name="expand">
            <div v-if="expandedIds.has(game.id)" class="game-standings">
              <div class="standings-divider" />

              <!-- Nassau -->
              <template v-if="game.type === 'nassau'">
                <div class="nassau-grid">
                  <div class="nassau-header">Segment</div>
                  <div class="nassau-header">Status</div>
                  <div class="nassau-header">Leader</div>

                  <div class="nassau-cell">Front</div>
                  <div class="nassau-cell">
                    <span class="status-badge">{{ nassauSegStatus(game, 'front').status }}</span>
                  </div>
                  <div class="nassau-cell" :class="balanceClass(nassauSegStatus(game, 'front').balance)">
                    {{ nassauSegStatus(game, 'front').leader }}
                  </div>

                  <div class="nassau-cell">Back</div>
                  <div class="nassau-cell">
                    <span class="status-badge">{{ nassauSegStatus(game, 'back').status }}</span>
                  </div>
                  <div class="nassau-cell" :class="balanceClass(nassauSegStatus(game, 'back').balance)">
                    {{ nassauSegStatus(game, 'back').leader }}
                  </div>

                  <div class="nassau-cell">Overall</div>
                  <div class="nassau-cell">
                    <span class="status-badge">{{ nassauSegStatus(game, 'overall').status }}</span>
                  </div>
                  <div class="nassau-cell" :class="balanceClass(nassauSegStatus(game, 'overall').balance)">
                    {{ nassauSegStatus(game, 'overall').leader }}
                  </div>
                </div>
              </template>

              <!-- Skins -->
              <template v-else-if="game.type === 'skins'">
                <div class="skins-grid">
                  <div
                    v-for="hole in 18"
                    :key="hole"
                    class="skin-cell"
                    :class="skinClass(game, hole)"
                  >
                    <div class="skin-hole">{{ hole }}</div>
                    <div class="skin-winner">{{ skinWinner(game, hole) }}</div>
                    <div class="skin-value">${{ (game.config?.ppt || 5) }}</div>
                  </div>
                </div>
                <div class="skins-summary">
                  <div class="skins-pot">
                    <span>Pot: </span>
                    <span class="skins-pot-amount">${{ skinsCarryTotal(game) }}</span>
                  </div>
                  <div class="skins-count">{{ skinsWonCount(game) }} skins won</div>
                </div>
              </template>

              <!-- Generic standings -->
              <template v-else>
                <div class="generic-standings">
                  <div
                    v-for="member in sortedMembersForGame(game)"
                    :key="member.id"
                    class="standing-row"
                  >
                    <span class="standing-pos">{{ member.rank }}</span>
                    <span class="standing-name">{{ member.short_name || member.guest_name }}</span>
                    <span class="standing-value" :class="balanceClass(member.balance)">
                      {{ formatBalance(member.balance) }}
                    </span>
                  </div>
                  <div v-if="!sortedMembersForGame(game).length" class="standing-empty">
                    Waiting for scores…
                  </div>
                </div>
              </template>

            </div>
          </transition>
        </div>
      </div>

      <!-- Settlement preview (if round complete) -->
      <div v-if="holesPlayed >= 18" class="settlement-section">
        <div class="section-label">Settlement</div>
        <div class="settlement-card">
          <div class="settlement-icon">🏆</div>
          <div class="settlement-title">Round Complete</div>
          <div class="settlement-sub">Go to History to see final settlement and share results.</div>
          <router-link to="/history" class="btn-primary btn-settlement">View Settlement</router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'

const roundsStore = useRoundsStore()

// ── Expanded state ───────────────────────────────────────────
const expandedIds = ref(new Set())
function toggleExpanded(id) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
  expandedIds.value = new Set(expandedIds.value)
}

// ── Date formatting ──────────────────────────────────────────
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Scores helpers ───────────────────────────────────────────
function getMemberScores(member) {
  return roundsStore.activeScores[member.id] || {}
}

function memberHolesPlayed(member) {
  return Object.keys(getMemberScores(member)).filter(h => getMemberScores(member)[h] != null).length
}

const holesPlayed = computed(() => {
  if (!roundsStore.activeMembers.length) return 0
  return Math.max(...roundsStore.activeMembers.map(m => memberHolesPlayed(m)), 0)
})

function memberGrossTotal(member) {
  return Object.values(getMemberScores(member)).reduce((s, v) => s + (v || 0), 0)
}

function memberNetVsPar(member) {
  // Quick relative-to-par: would need course par data, return gross for now
  // We'll show E, +1, -2 style from gross vs expected par
  const gross = memberGrossTotal(member)
  if (!gross) return null
  const holesIn = memberHolesPlayed(member)
  if (!holesIn) return null
  const expectedPar = holesIn * 4  // rough estimate; ideally from course data
  return gross - expectedPar
}

function formatTotal(member) {
  const total = memberGrossTotal(member)
  if (!total) return '—'
  return String(total)
}

function totalClass(member) {
  const rel = memberNetVsPar(member)
  if (rel == null) return ''
  if (rel < -1) return 'score-under'
  if (rel < 0) return 'score-one-under'
  if (rel === 0) return 'score-even'
  if (rel <= 3) return 'score-over'
  return 'score-double-over'
}

const sortedMembers = computed(() => {
  const members = [...roundsStore.activeMembers]
  members.sort((a, b) => {
    const aPlayed = memberHolesPlayed(a)
    const bPlayed = memberHolesPlayed(b)
    if (!aPlayed && !bPlayed) return 0
    if (!aPlayed) return 1
    if (!bPlayed) return -1
    return memberGrossTotal(a) - memberGrossTotal(b)
  })
  // Mark leader
  if (members.length > 0 && memberGrossTotal(members[0]) > 0) {
    members[0].isLeading = true
  }
  return members
})

// ── Game helpers ─────────────────────────────────────────────
const GAME_ICONS = {
  nassau: '🏆', skins: '💰', wolf: '🐺', vegas: '🎲', matchPlay: '⚔️',
  bestBall: '🤝', stableford: '📊', sixes: '🎯', snake: '🐍', dots: '●',
  junk: '✨', fidget: '🎲', hiLow: '📈', hammer: '🔨', teamDay: '👥', fiveThreeOne: '5',
}
const GAME_LABELS = {
  nassau: 'Nassau', skins: 'Skins', wolf: 'Wolf', vegas: 'Vegas', matchPlay: 'Match Play',
  bestBall: 'Best Ball', stableford: 'Stableford', sixes: 'Sixes', snake: 'Snake', dots: 'Dots',
  junk: 'Junk', fidget: 'Fidget', hiLow: 'Hi-Low', hammer: 'Hammer', teamDay: 'Team Day', fiveThreeOne: '5-3-1',
}
const GAME_STYLE = {
  nassau: 'gold', skins: 'green', wolf: 'purple', vegas: 'blue', matchPlay: 'red',
  bestBall: 'teal', stableford: 'green', sixes: 'orange',
}
function gameIcon(type) { return GAME_ICONS[type] || '🏌️' }
function gameLabel(type) { return GAME_LABELS[type] || type }
function gameStyle(type) { return GAME_STYLE[type] || 'default' }

function configSummary(game) {
  const c = game.config || {}
  const parts = []
  if (c.front != null && c.back != null) parts.push(`$${c.front}/$${c.back}/${c.overall || c.front + c.back}`)
  if (c.ppt != null) parts.push(`$${c.ppt}/skin`)
  if (c.ppp != null) parts.push(`$${c.ppp}/pt`)
  if (c.unit != null) parts.push(`$${c.unit}/unit`)
  const netGross = c.netGross === 'gross' ? 'Gross' : 'Net'
  parts.push(netGross)
  return parts.join(' · ')
}

// ── Nassau calculations ──────────────────────────────────────
function nassauSegStatus(game, segment) {
  const config = game.config || {}
  const t1 = config.team1 || []
  const t2 = config.team2 || []
  const t1Names = t1.map(id => memberName(id)).join(' & ')
  const t2Names = t2.map(id => memberName(id)).join(' & ')

  const range = segment === 'front' ? [1, 9] : segment === 'back' ? [10, 18] : [1, 18]
  let score = 0
  let holesInSeg = 0

  for (let h = range[0]; h <= range[1]; h++) {
    const t1Scores = t1.map(id => memberScoreForHole(id, h)).filter(s => s != null)
    const t2Scores = t2.map(id => memberScoreForHole(id, h)).filter(s => s != null)
    if (!t1Scores.length || !t2Scores.length) continue
    holesInSeg++
    const t1Best = Math.min(...t1Scores)
    const t2Best = Math.min(...t2Scores)
    if (t1Best < t2Best) score++
    else if (t2Best < t1Best) score--
  }

  const segTotal = range[1] - range[0] + 1
  const remaining = segTotal - holesInSeg

  let status = 'AS'
  if (score > 0) status = `${t1Names || 'T1'} ${score} UP`
  else if (score < 0) status = `${t2Names || 'T2'} ${Math.abs(score)} UP`

  return {
    status,
    balance: score,
    leader: score > 0 ? t1Names || 'Team 1' : score < 0 ? t2Names || 'Team 2' : 'All Square',
  }
}

function memberName(id) {
  const m = roundsStore.activeMembers.find(m => m.id === id || m.profile_id === id)
  return m ? (m.short_name || m.guest_name || '?') : '?'
}

function memberScoreForHole(id, hole) {
  const m = roundsStore.activeMembers.find(m => m.id === id || m.profile_id === id)
  if (!m) return null
  return (roundsStore.activeScores[m.id] || {})[hole] || null
}

// ── Skins calculations ───────────────────────────────────────
function skinWinner(game, hole) {
  const ppp = game.config?.ppt || 5
  const members = roundsStore.activeMembers
  const scores = members.map(m => ({ m, s: (roundsStore.activeScores[m.id] || {})[hole] }))
    .filter(x => x.s != null)
  if (!scores.length) return null
  const minScore = Math.min(...scores.map(x => x.s))
  const winners = scores.filter(x => x.s === minScore)
  if (winners.length === 1) return winners[0].m.short_name || winners[0].m.guest_name
  return null // carry
}

function skinClass(game, hole) {
  const winner = skinWinner(game, hole)
  const scores = roundsStore.activeMembers.map(m => (roundsStore.activeScores[m.id] || {})[hole]).filter(s => s != null)
  if (!scores.length) return 'skin-pending'
  if (!winner) return 'skin-carry'
  return 'skin-won'
}

function skinsCarryTotal(game) {
  let carryHoles = 0
  for (let h = 1; h <= 18; h++) {
    if (skinClass(game, h) === 'skin-carry') carryHoles++
  }
  return carryHoles * (game.config?.ppt || 5)
}

function skinsWonCount(game) {
  let count = 0
  for (let h = 1; h <= 18; h++) {
    if (skinClass(game, h) === 'skin-won') count++
  }
  return count
}

// ── Generic per-player standings ─────────────────────────────
function sortedMembersForGame(game) {
  // Generic: sort by gross total for now
  return roundsStore.activeMembers
    .map((m, i) => ({
      ...m,
      balance: memberGrossTotal(m),
      rank: i + 1,
    }))
    .sort((a, b) => a.balance - b.balance)
    .map((m, i) => ({ ...m, rank: i + 1 }))
}

function formatBalance(val) {
  if (!val && val !== 0) return '—'
  return String(val)
}

function balanceClass(val) {
  if (!val && val !== 0) return ''
  if (val > 0) return 'bal-winning'
  if (val < 0) return 'bal-losing'
  return 'bal-even'
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.games-view {
  min-height: 100%;
  background: var(--gw-neutral-50);
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}

.games-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 0;
}

.games-title {
  font-family: var(--gw-font-display);
  font-size: 28px;
  color: var(--gw-neutral-900);
  margin: 0;
  flex: 1;
}

.round-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--gw-green-50);
  color: var(--gw-green-600);
  border: 1px solid var(--gw-green-200);
  border-radius: var(--gw-radius-full);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
}
.round-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--gw-green-500);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
}

/* ── Round info strip ────────────────────────────────────── */
.round-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  flex-wrap: wrap;
}
.round-course {
  font-family: var(--gw-font-body);
  font-size: 15px;
  font-weight: 600;
  color: var(--gw-neutral-800);
}
.round-date {
  font-size: 13px;
  color: var(--gw-neutral-400);
}
.round-code {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--gw-font-mono);
  font-size: 13px;
  color: var(--gw-green-600);
  background: var(--gw-green-50);
  border: 1px solid var(--gw-green-200);
  border-radius: var(--gw-radius-full);
  padding: 3px 10px;
}
.code-icon { font-size: 11px; }

/* ── Section label ───────────────────────────────────────── */
.section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-neutral-400);
  padding: 12px 20px 6px;
}

/* ── Scoreboard strip ────────────────────────────────────── */
.scoreboard-section { padding: 0; }
.scoreboard-strip {
  display: flex;
  gap: 10px;
  padding: 0 16px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.player-score-card {
  min-width: 80px;
  background: white;
  border-radius: var(--gw-radius-lg);
  padding: 12px 10px;
  text-align: center;
  box-shadow: var(--gw-shadow-card);
  border: 2px solid transparent;
  flex-shrink: 0;
  animation: card-in 250ms ease-out both;
}
.player-score-card--leading {
  border-color: var(--gw-green-400);
}

.ps-name {
  font-family: var(--gw-font-body);
  font-size: 11px;
  font-weight: 600;
  color: var(--gw-neutral-500);
  text-transform: uppercase;
  letter-spacing: .05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ps-total {
  font-family: var(--gw-font-mono);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  margin: 4px 0 2px;
  color: var(--gw-neutral-900);
}
.ps-thru {
  font-size: 10px;
  color: var(--gw-neutral-400);
}
.ps-thru-empty { opacity: .4; }

.score-under   { color: var(--gw-eagle); }
.score-one-under { color: var(--gw-birdie); }
.score-even    { color: var(--gw-neutral-900); }
.score-over    { color: var(--gw-bogey); }
.score-double-over { color: var(--gw-double); }

/* ── Games list ──────────────────────────────────────────── */
.games-list { padding: 0 16px; }

.game-card {
  background: white;
  border-radius: var(--gw-radius-lg);
  margin-bottom: 10px;
  box-shadow: var(--gw-shadow-card);
  overflow: hidden;
  border-left: 4px solid var(--gw-neutral-200);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: card-in 250ms ease-out both;
}
.game-card--gold  { border-left-color: var(--gw-eagle); }
.game-card--green { border-left-color: var(--gw-birdie); }
.game-card--purple { border-left-color: #8b5cf6; }
.game-card--blue  { border-left-color: #3b82f6; }
.game-card--red   { border-left-color: var(--gw-bogey); }
.game-card--teal  { border-left-color: #14b8a6; }
.game-card--orange { border-left-color: #f97316; }

.game-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.game-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gw-neutral-50);
  border-radius: var(--gw-radius-md);
  flex-shrink: 0;
}
.game-info { flex: 1; min-width: 0; }
.game-name {
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  color: var(--gw-neutral-900);
}
.game-config-summary {
  font-family: var(--gw-font-body);
  font-size: 12px;
  color: var(--gw-neutral-400);
  margin-top: 2px;
}
.game-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.expand-arrow {
  font-size: 22px;
  color: var(--gw-neutral-400);
  transform: rotate(90deg);
  transition: transform .2s;
}
.expand-arrow.expanded { transform: rotate(-90deg); }

/* ── Expanded standings ──────────────────────────────────── */
.standings-divider {
  height: 1px;
  background: var(--gw-neutral-100);
  margin: 0;
}
.game-standings { padding: 12px 16px 16px; }

/* Nassau grid */
.nassau-grid {
  display: grid;
  grid-template-columns: 70px 1fr 1fr;
  gap: 6px;
}
.nassau-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--gw-neutral-400);
  padding: 4px 0;
}
.nassau-cell {
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--gw-neutral-700);
  padding: 6px 0;
  border-bottom: 1px solid var(--gw-neutral-100);
}

/* Skins grid */
.skins-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}
.skin-cell {
  background: var(--gw-neutral-100);
  border-radius: 6px;
  padding: 6px 4px;
  text-align: center;
}
.skin-cell.skin-won { background: var(--gw-green-50); border: 1px solid var(--gw-green-300); }
.skin-cell.skin-carry { background: #fff7ed; border: 1px solid #fed7aa; }
.skin-cell.skin-pending { background: var(--gw-neutral-50); }
.skin-hole {
  font-family: var(--gw-font-mono);
  font-size: 10px;
  color: var(--gw-neutral-500);
  font-weight: 700;
}
.skin-winner {
  font-size: 9px;
  font-weight: 600;
  color: var(--gw-green-600);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 2px 0;
  min-height: 11px;
}
.skin-value {
  font-family: var(--gw-font-mono);
  font-size: 9px;
  color: var(--gw-neutral-400);
}
.skins-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 0;
}
.skins-pot {
  font-size: 13px;
  color: var(--gw-neutral-600);
}
.skins-pot-amount {
  font-family: var(--gw-font-mono);
  font-weight: 700;
  color: var(--gw-winning);
}
.skins-count { font-size: 12px; color: var(--gw-neutral-400); }

/* Generic standings */
.generic-standings { display: flex; flex-direction: column; gap: 8px; }
.standing-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--gw-neutral-100);
}
.standing-pos {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--gw-neutral-400);
  width: 20px;
}
.standing-name {
  flex: 1;
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-neutral-800);
}
.standing-value {
  font-family: var(--gw-font-mono);
  font-size: 16px;
  font-weight: 700;
}
.standing-empty { font-size: 13px; color: var(--gw-neutral-400); text-align: center; padding: 12px; }

.bal-winning { color: var(--gw-winning); }
.bal-losing  { color: var(--gw-losing); }
.bal-even    { color: var(--gw-neutral-500); }

.status-badge {
  display: inline-block;
  font-family: var(--gw-font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--gw-neutral-600);
}

/* ── Settlement section ──────────────────────────────────── */
.settlement-section { padding: 0 16px; }
.settlement-card {
  background: var(--gw-green-900);
  border-radius: var(--gw-radius-lg);
  padding: 24px;
  text-align: center;
  color: white;
  animation: card-in 250ms ease-out both;
}
.settlement-icon { font-size: 32px; margin-bottom: 8px; }
.settlement-title {
  font-family: var(--gw-font-display);
  font-size: 20px;
  margin-bottom: 6px;
}
.settlement-sub {
  font-size: 13px;
  color: var(--gw-neutral-300);
  margin-bottom: 16px;
  line-height: 1.5;
}
.btn-settlement {
  display: inline-block;
  padding: 12px 24px;
  text-decoration: none;
}

/* ── No games state ──────────────────────────────────────── */
.no-games-state {
  margin: 16px;
  background: white;
  border-radius: var(--gw-radius-lg);
  padding: 32px 20px;
  text-align: center;
  box-shadow: var(--gw-shadow-card);
}
.no-games-icon { font-size: 36px; margin-bottom: 10px; }
.no-games-title {
  font-family: var(--gw-font-body);
  font-size: 17px;
  font-weight: 600;
  color: var(--gw-neutral-800);
  margin-bottom: 8px;
}
.no-games-sub {
  font-size: 13px;
  color: var(--gw-neutral-500);
  line-height: 1.5;
}

/* ── Empty state ─────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-neutral-900);
  margin-bottom: 8px;
}
.empty-sub {
  font-size: 14px;
  color: var(--gw-neutral-500);
  margin-bottom: 24px;
  line-height: 1.5;
  max-width: 260px;
}

/* ── Shared buttons ──────────────────────────────────────── */
.btn-primary {
  padding: 14px 28px;
  background: var(--gw-green-500);
  color: white;
  border: none;
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  -webkit-tap-highlight-color: transparent;
}

/* ── Animations ──────────────────────────────────────────── */
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.expand-enter-active, .expand-leave-active {
  transition: opacity .2s, max-height .25s ease;
  overflow: hidden;
  max-height: 600px;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
