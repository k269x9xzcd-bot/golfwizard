<template>
  <div class="history-view">
    <!-- Header -->
    <header class="history-header">
      <h1 class="history-title">History</h1>
      <div v-if="roundsStore.rounds.length" class="round-count">
        {{ roundsStore.rounds.length }} round{{ roundsStore.rounds.length !== 1 ? 's' : '' }}
      </div>
    </header>

    <!-- Loading -->
    <div v-if="roundsStore.loading" class="loading-state">
      <div class="loading-spinner" />
      <div class="loading-text">Loading rounds…</div>
    </div>

    <!-- Empty -->
    <div v-else-if="!roundsStore.rounds.length" class="empty-state">
      <div class="empty-icon">⛳</div>
      <div class="empty-title">No rounds yet</div>
      <div class="empty-sub">Complete a round to see your history here.</div>
      <router-link to="/" class="btn-primary">Start a Round</router-link>
    </div>

    <!-- Round list -->
    <div v-else class="rounds-list">
      <!-- Group by month -->
      <template v-for="group in groupedRounds" :key="group.month">
        <div class="month-label">{{ group.month }}</div>

        <div
          v-for="round in group.rounds"
          :key="round.id"
          class="round-card"
          @click="toggleRound(round.id)"
        >
          <!-- Card header -->
          <div class="round-card-header">
            <div class="round-card-left">
              <div class="round-course-name">{{ round.course_name }}</div>
              <div class="round-meta-row">
                <span class="round-date">{{ formatDate(round.date) }}</span>
                <span class="round-dot">·</span>
                <span class="round-players">{{ playerCount(round) }} players</span>
                <span v-if="round.format" class="round-dot">·</span>
                <span v-if="round.format" class="round-format">{{ capitalize(round.format) }}</span>
              </div>
            </div>
            <div class="round-card-right">
              <div class="round-scores-strip">
                <div
                  v-for="m in topPlayers(round)"
                  :key="m.id"
                  class="mini-score"
                >
                  <div class="mini-name">{{ m.short_name || m.guest_name?.slice(0,4) }}</div>
                  <div class="mini-total">{{ m.total || '—' }}</div>
                </div>
              </div>
              <div class="expand-arrow" :class="{ expanded: expandedIds.has(round.id) }">›</div>
            </div>
          </div>

          <!-- Expanded: full scorecard + settlement -->
          <transition name="expand">
            <div v-if="expandedIds.has(round.id)" class="round-detail">
              <div class="detail-divider" />

              <!-- Mini scorecard: just totals per player -->
              <div class="detail-section-label">Scores</div>
              <div class="scores-table">
                <div class="scores-row scores-header">
                  <div class="score-player-col">Player</div>
                  <div class="score-num-col">Out</div>
                  <div class="score-num-col">In</div>
                  <div class="score-num-col score-total-col">Total</div>
                </div>
                <div
                  v-for="m in getMembersWithScores(round)"
                  :key="m.id"
                  class="scores-row"
                >
                  <div class="score-player-col">{{ m.short_name || m.guest_name }}</div>
                  <div class="score-num-col score-nine">{{ m.front9 || '—' }}</div>
                  <div class="score-num-col score-nine">{{ m.back9 || '—' }}</div>
                  <div class="score-num-col score-total-col score-total">{{ m.total || '—' }}</div>
                </div>
              </div>

              <!-- Games played -->
              <template v-if="round.game_configs?.length">
                <div class="detail-section-label">Games</div>
                <div class="games-tags">
                  <span
                    v-for="g in round.game_configs"
                    :key="g.id"
                    class="game-tag"
                    :class="`game-tag--${gameStyle(g.type)}`"
                  >{{ gameIcon(g.type) }} {{ gameLabel(g.type) }}</span>
                </div>
              </template>

              <!-- Settlement -->
              <template v-if="round.game_configs?.length">
                <div class="detail-section-label">Settlement</div>
                <div class="settlement-block">
                  <div class="settlement-placeholder">
                    <div class="settlement-ph-icon">💰</div>
                    <div class="settlement-ph-text">Settlement details available in the active round view.</div>
                  </div>
                </div>
              </template>

            </div>
          </transition>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoundsStore } from '../stores/rounds'

const roundsStore = useRoundsStore()
onMounted(() => roundsStore.fetchRounds())

const expandedIds = ref(new Set())
function toggleRound(id) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
  expandedIds.value = new Set(expandedIds.value)
}

// ── Date helpers ─────────────────────────────────────────────
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthGroup(d) {
  if (!d) return 'Unknown'
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

// ── Grouping ─────────────────────────────────────────────────
const groupedRounds = computed(() => {
  const map = new Map()
  for (const r of roundsStore.rounds) {
    const key = monthGroup(r.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r)
  }
  return Array.from(map.entries()).map(([month, rounds]) => ({ month, rounds }))
})

// ── Member/score helpers ─────────────────────────────────────
function playerCount(round) {
  return round.round_members?.length ?? 0
}

function topPlayers(round) {
  const members = round.round_members || []
  return members.slice(0, 3)
}

function getMembersWithScores(round) {
  const members = round.round_members || []
  const scores = round.scores || []

  return members.map(m => {
    const memberScores = scores.filter(s => s.member_id === m.id)
    const byHole = {}
    memberScores.forEach(s => { byHole[s.hole] = s.strokes })

    const front9 = [1,2,3,4,5,6,7,8,9].reduce((sum, h) => sum + (byHole[h] || 0), 0)
    const back9  = [10,11,12,13,14,15,16,17,18].reduce((sum, h) => sum + (byHole[h] || 0), 0)
    const total  = front9 + back9

    return {
      ...m,
      front9: front9 || null,
      back9: back9 || null,
      total: total || null,
    }
  })
}

// ── Game helpers ─────────────────────────────────────────────
const GAME_ICONS = {
  nassau: '🏆', skins: '💰', wolf: '🐺', vegas: '🎲', matchPlay: '⚔️',
  bestBall: '🤝', stableford: '📊', sixes: '🎯', snake: '🐍',
}
const GAME_LABELS = {
  nassau: 'Nassau', skins: 'Skins', wolf: 'Wolf', vegas: 'Vegas', matchPlay: 'Match Play',
  bestBall: 'Best Ball', stableford: 'Stableford', sixes: 'Sixes', snake: 'Snake',
}
const GAME_STYLES = {
  nassau: 'gold', skins: 'green', wolf: 'purple', vegas: 'blue', matchPlay: 'red', bestBall: 'teal',
}

function gameIcon(type) { return GAME_ICONS[type] || '🏌️' }
function gameLabel(type) { return GAME_LABELS[type] || type }
function gameStyle(type) { return GAME_STYLES[type] || 'default' }
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.history-view {
  min-height: 100%;
  background: var(--gw-neutral-950);
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 0;
}

.history-title {
  font-family: var(--gw-font-display);
  font-size: 28px;
  color: var(--gw-text);
  margin: 0;
  flex: 1;
}

.round-count {
  font-size: 13px;
  color: var(--gw-text-muted);
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--gw-radius-full);
  padding: 4px 12px;
}

/* ── Loading ─────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  gap: 12px;
}
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--gw-gold);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-text { font-size: 14px; color: var(--gw-text-muted); }

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
  color: var(--gw-text);
  margin-bottom: 8px;
}
.empty-sub {
  font-size: 14px;
  color: var(--gw-text-muted);
  margin-bottom: 24px;
  line-height: 1.5;
}
.btn-primary {
  padding: 14px 28px;
  background: var(--gw-gold);
  color: #000;
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

/* ── Rounds list ─────────────────────────────────────────── */
.rounds-list { padding: 12px 16px; }

.month-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-text-muted);
  padding: 12px 4px 6px;
}

.round-card {
  background: var(--gw-card-bg);
  border-radius: var(--gw-radius-lg);
  margin-bottom: 10px;
  box-shadow: var(--gw-shadow-card);
  overflow: hidden;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: card-in 250ms ease-out both;
  border-left: 3px solid var(--gw-gold);
}

.round-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 12px 14px 16px;
}

.round-card-left { flex: 1; min-width: 0; }

.round-course-name {
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  color: var(--gw-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.round-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  flex-wrap: wrap;
}
.round-date { font-size: 12px; color: var(--gw-text-muted); }
.round-dot  { font-size: 12px; color: rgba(240, 237, 224, 0.2); }
.round-players { font-size: 12px; color: var(--gw-text-muted); }
.round-format  { font-size: 12px; color: var(--gw-gold); font-weight: 500; }

.round-card-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.round-scores-strip {
  display: flex;
  gap: 6px;
}

.mini-score {
  text-align: center;
  min-width: 32px;
}
.mini-name {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--gw-text-muted);
}
.mini-total {
  font-family: var(--gw-font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--gw-text);
  line-height: 1.2;
}

.expand-arrow {
  font-size: 22px;
  color: rgba(240, 237, 224, 0.3);
  transform: rotate(90deg);
  transition: transform .2s;
}
.expand-arrow.expanded { transform: rotate(-90deg); }

/* ── Round detail ────────────────────────────────────────── */
.detail-divider {
  height: 1px;
  background: var(--gw-card-border);
}

.round-detail { padding: 0 16px 16px; }

.detail-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--gw-text-muted);
  padding: 12px 0 8px;
}

/* Scores table */
.scores-table { display: flex; flex-direction: column; gap: 2px; }
.scores-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  border-bottom: 1px solid var(--gw-card-border);
}
.scores-header {
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
  margin-bottom: 2px;
}
.scores-header .score-player-col,
.scores-header .score-num-col {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--gw-text-muted);
}

.score-player-col {
  flex: 1;
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-text);
}
.score-num-col {
  width: 36px;
  text-align: center;
  font-family: var(--gw-font-mono);
  font-size: 14px;
  color: var(--gw-text-muted);
}
.score-nine { color: var(--gw-text-muted); }
.score-total-col { width: 44px; }
.score-total {
  font-family: var(--gw-font-mono);
  font-size: 17px;
  font-weight: 700;
  color: var(--gw-text);
}

/* Game tags */
.games-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 4px;
}
.game-tag {
  padding: 4px 12px;
  border-radius: var(--gw-radius-full);
  font-family: var(--gw-font-body);
  font-size: 12px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.08);
  color: var(--gw-text-muted);
}
.game-tag--gold   { background: rgba(212, 175, 55, 0.15); color: var(--gw-gold); }
.game-tag--green  { background: rgba(34, 197, 94, 0.15); color: #86efac; }
.game-tag--purple { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; }
.game-tag--blue   { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
.game-tag--red    { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
.game-tag--teal   { background: rgba(20, 184, 166, 0.15); color: #99f6e4; }

/* Settlement block */
.settlement-block { margin-bottom: 4px; }
.settlement-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--gw-radius-md);
}
.settlement-ph-icon { font-size: 20px; }
.settlement-ph-text { font-size: 13px; color: var(--gw-text-muted); line-height: 1.4; }

/* ── Animations ──────────────────────────────────────────── */
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.expand-enter-active, .expand-leave-active {
  transition: opacity .2s, max-height .25s ease;
  overflow: hidden;
  max-height: 800px;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
