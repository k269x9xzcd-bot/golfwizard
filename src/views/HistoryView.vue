<template>
  <div class="history-view">
    <!-- Header -->
    <header class="history-header">
      <h1 class="history-title">History</h1>
      <div v-if="roundsStore.rounds.length" class="round-count">
        {{ roundsStore.rounds.length }} round{{ roundsStore.rounds.length !== 1 ? 's' : '' }}
      </div>
    </header>

    <!-- Loading — only when we truly have nothing to show -->
    <div v-if="roundsStore.loading && !roundsStore.rounds.length" class="loading-state">
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
          :data-round-id="round.id"
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
              <!-- Compact summary: leader + how many strokes ahead -->
              <div v-if="roundLeaderSummary(round)" class="round-leader-chip">
                <span class="rls-name">🏆 {{ roundLeaderSummary(round).name }}</span>
                <span class="rls-total">{{ roundLeaderSummary(round).total }}</span>
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

              <!-- Game Recap — per-game outcome -->
              <template v-if="round.game_configs?.length">
                <div class="detail-section-label">Game Recap</div>
                <div class="game-recap-list">
                  <div
                    v-for="g in gameRecapRows(round)"
                    :key="g.id"
                    class="game-recap-row"
                  >
                    <div class="grr-head">
                      <span class="grr-icon">{{ g.icon }}</span>
                      <span class="grr-name">{{ g.label }}</span>
                      <span v-if="g.winnerLine" class="grr-winner">
                        <span class="grr-star">⭐️</span>
                        {{ g.winnerLine }}
                      </span>
                    </div>
                    <div v-if="g.detail" class="grr-detail">{{ g.detail }}</div>
                  </div>
                </div>
              </template>

              <!-- Settlement -->
              <template v-if="round.game_configs?.length">
                <div class="detail-section-label">Settlement</div>
                <div class="settlement-block">
                  <!-- Loading: only for the first fraction of a second -->
                  <div v-if="settlementLoading[round.id]" class="settlement-placeholder">
                    <div class="settlement-ph-icon">💰</div>
                    <div class="settlement-ph-text">Computing…</div>
                  </div>
                  <!-- Has settlement data -->
                  <template v-else-if="settlementsCache[round.id]">
                    <!-- Player totals -->
                    <div v-if="settlementsCache[round.id].playerTotals" class="settlement-totals">
                      <div
                        v-for="(info, pid) in settlementsCache[round.id].playerTotals"
                        :key="pid"
                        class="settlement-player"
                        :class="{ positive: info.total > 0, negative: info.total < 0 }"
                      >
                        <span class="settlement-name">{{ info.name }}</span>
                        <span class="settlement-amount">{{ info.total > 0 ? '+' : '' }}{{ formatMoney(info.total) }}</span>
                      </div>
                    </div>
                    <!-- Ledger (who pays whom) -->
                    <div v-if="settlementsCache[round.id].ledger?.length" class="settlement-ledger">
                      <div
                        v-for="(entry, i) in settlementsCache[round.id].ledger"
                        :key="i"
                        class="ledger-entry"
                      >
                        <span class="ledger-from">{{ entry.from_name }}</span>
                        <span class="ledger-arrow">→</span>
                        <span class="ledger-to">{{ entry.to_name }}</span>
                        <span class="ledger-amount">${{ entry.amount }}</span>
                      </div>
                    </div>
                    <div v-else class="settlement-even">All square — no payments needed</div>
                  </template>
                  <!-- No settlement yet -->
                  <div v-else class="settlement-placeholder">
                    <div class="settlement-ph-icon">💰</div>
                    <div class="settlement-ph-text">Not enough scores yet to compute settlement.</div>
                  </div>
                </div>
              </template>

              <!-- Round actions -->
              <div class="round-actions">
                <button class="round-action-btn round-action-view" @click.stop="viewScorecard(round)">
                  👁 View Scorecard
                </button>
                <button class="round-action-btn round-action-edit" @click.stop="reopenRound(round)">
                  ✏️ Edit Scores
                </button>
                <button class="round-action-btn round-action-delete" @click.stop="confirmDelete(round)">
                  🗑️ Delete
                </button>
              </div>

            </div>
          </transition>
        </div>
      </template>
    </div>

    <!-- Delete confirmation -->
    <div v-if="deleteTarget" class="delete-overlay" @click="deleting ? null : (deleteTarget = null)">
      <div class="delete-dialog" @click.stop>
        <div class="delete-title">Delete Round?</div>
        <div class="delete-msg">This will permanently delete the round at <strong>{{ deleteTarget.course_name }}</strong> on {{ formatDate(deleteTarget.date) }} and all its scores/games.</div>
        <div v-if="deleteError" class="delete-error">{{ deleteError }}</div>
        <div class="delete-actions">
          <button class="btn-cancel" :disabled="deleting" @click="deleteTarget = null">Cancel</button>
          <button class="btn-delete-confirm" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { useCoursesStore } from '../stores/courses'
import { useRouter, useRoute } from 'vue-router'
import { computeAllSettlements } from '../modules/settlements'
import {
  computeNassau, computeSkins, computeMatch, computeBestBall, computeBestBallNet,
  computeVegas, computeDots, computeFidget, computeSnake, computeWolf,
  computeHiLow, computeStableford, computeSixes, computeFiveThreeOne, computeHammer,
} from '../modules/gameEngine'
import { COURSES as BUILTIN_COURSES } from '../modules/courses'

const roundsStore = useRoundsStore()
const coursesStore = useCoursesStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  await roundsStore.fetchRounds()
  // Support ?expand=<roundId> coming from Home "Recent Rounds" tap
  const id = route.query?.expand
  if (id && !expandedIds.value.has(id)) {
    await toggleRound(String(id))
    // Clean the URL so a refresh doesn't re-expand
    router.replace({ path: '/history', query: {} })
    // Scroll the expanded card into view on next tick
    setTimeout(() => {
      const el = document.querySelector(`[data-round-id="${id}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }
})

const expandedIds = ref(new Set())
const settlementsCache = reactive({})
const settlementLoading = reactive({})

async function toggleRound(id) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else {
    expandedIds.value.add(id)
    // Populate settlement cache if we don't have it yet.
    if (!settlementsCache[id] && !settlementLoading[id]) {
      settlementLoading[id] = true
      const round = roundsStore.rounds.find(r => r.id === id)
      let data = null
      // 1) Try saved snapshot first (fast, no engine run)
      try {
        const saved = await Promise.race([
          roundsStore.fetchSettlements(id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('settlement fetch timeout')), 4000)),
        ])
        if (saved) data = saved
      } catch { /* fall through to compute */ }
      // 2) Otherwise compute from stored scores on demand
      if (!data && round) {
        try { data = _computeSettlementFromRound(round) } catch (e) { console.warn('compute settlement failed:', e) }
      }
      if (data) settlementsCache[id] = data
      settlementLoading[id] = false
    }
  }
  expandedIds.value = new Set(expandedIds.value)
}

const deleteTarget = ref(null)
const deleteError = ref('')
const deleting = ref(false)

function confirmDelete(round) {
  deleteTarget.value = round
  deleteError.value = ''
}

async function doDelete() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await roundsStore.deleteRound(deleteTarget.value.id)
    deleteTarget.value = null
    // Refresh the list so the deleted card disappears
    await roundsStore.fetchRounds()
  } catch (e) {
    console.error('Delete failed:', e)
    deleteError.value = e?.message || 'Delete failed. Please try again.'
  } finally {
    deleting.value = false
  }
}

async function reopenRound(round) {
  try {
    await roundsStore.loadRound(round.id)
    router.push('/scoring')
  } catch (e) {
    console.error('[history] reopenRound failed:', e)
    alert('Could not open round: ' + (e?.message || 'unknown error'))
  }
}

async function viewScorecard(round) {
  try {
    await roundsStore.loadRound(round.id)
    router.push('/scoring')
  } catch (e) {
    console.error('[history] viewScorecard failed:', e)
    alert('Could not open scorecard: ' + (e?.message || 'unknown error'))
  }
}

function formatMoney(val) {
  if (val == null || val === 0) return '$0'
  return '$' + Math.abs(Math.round(val * 100) / 100)
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
    memberScores.forEach(s => { byHole[s.hole] = s.score ?? s.strokes })

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
  nassau: '💰', skins: '💎', match: '⚔️', matchplay: '⚔️', match1v1: '⚔️',
  bestball: '🎮', best_ball: '🎮', bbn: '🏌️',
  wolf: '🐺', vegas: '🎰', hilow: '📊', stableford: '⭐',
  snake: '🐍', dots: '🎯', fidget: '😬', hammer: '🔨', sixes: '🎲', fivethreeone: '5️⃣',
}
const GAME_LABELS = {
  nassau: 'Nassau', skins: 'Skins', match: 'Match', matchplay: 'Match Play', match1v1: '1v1 Match',
  bestball: 'Best Ball', best_ball: 'Best Ball', bbn: 'Best Ball Net',
  wolf: 'Wolf', vegas: 'Vegas', hilow: 'Hi-Low', stableford: 'Stableford',
  snake: 'Snake', dots: 'Dots', fidget: 'Fidget', hammer: 'Hammer', sixes: 'Sixes', fivethreeone: '5-3-1',
}

function gameIcon(type) { return GAME_ICONS[(type || '').toLowerCase()] || '🏌️' }
function gameLabel(type) { return GAME_LABELS[(type || '').toLowerCase()] || type }

// ── Card-header: round leader chip ─────────────────────────
function roundLeaderSummary(round) {
  const rows = getMembersWithScores(round).filter(m => m.total)
  if (!rows.length) return null
  // Lowest total = leader
  rows.sort((a, b) => a.total - b.total)
  const leader = rows[0]
  return {
    name: leader.short_name || leader.guest_name?.split(/\s+/)[0] || '?',
    total: leader.total,
  }
}

// ── Game Recap: per-game outcome lines ─────────────────────
// Uses the same engine the live scorecard uses so the recap reads identically.
function resolveCourseForRound(round) {
  // Prefer frozen snapshot (immutable history), fall back to live.
  const snap = round.course_snapshot
  if (snap && Array.isArray(snap.par) && snap.par.length) {
    return {
      name: snap.name || round.course_name,
      par: snap.par,
      si: snap.si,
      teesData: snap.teesData,
      tees: snap.teesData,
    }
  }
  const live = coursesStore.allCourses?.find(c => c.name === round.course_name)
  if (live) return live
  return BUILTIN_COURSES[round.course_name] || null
}

function _buildCtxForRound(round) {
  const course = resolveCourseForRound(round)
  if (!course) return null
  const members = round.round_members || []
  // Build {memberId: {hole: score}} map from the flat scores table
  const scoreMap = {}
  for (const s of (round.scores || [])) {
    const score = s.score ?? s.strokes
    if (!scoreMap[s.member_id]) scoreMap[s.member_id] = {}
    scoreMap[s.member_id][s.hole] = score
  }
  return {
    course,
    tee: round.tee,
    members,
    scores: scoreMap,
    holesMode: round.holes_mode || '18',
  }
}

function gameRecapRows(round) {
  const ctx = _buildCtxForRound(round)
  if (!ctx) return []
  const games = round.game_configs || []
  return games.map(g => _recapOne(ctx, g)).filter(Boolean)
}

function _recapOne(ctx, game) {
  const t = (game.type || '').toLowerCase()
  const cfg = game.config || {}
  const icon = gameIcon(game.type)
  const label = gameLabel(game.type)
  const base = { id: game.id, icon, label, winnerLine: null, detail: null }

  try {
    if (t === 'best_ball' || t === 'bestball') {
      const r = computeBestBall(ctx, cfg)
      if (!r) return base
      const t1n = r.t1Name || 'T1'
      const t2n = r.t2Name || 'T2'
      const up = r.finalUp || 0
      const played = (r.holeResults || []).filter(h => !h.incomplete).length
      const remaining = (r.holeResults || []).filter(h => h.incomplete).length
      const matchOver = Math.abs(up) > remaining && played > 0
      const isTournament = !!cfg.tournament
      const pts = cfg.points || 2
      const ppt = r.settlement?.ppt || cfg.ppt || 0

      if (played === 0) { base.detail = `${t1n} vs ${t2n} — not started`; return base }
      if (matchOver) {
        const win = up > 0 ? t1n : t2n
        const lose = up > 0 ? t2n : t1n
        base.winnerLine = _fmtWinnerValue(win, { pts: isTournament ? pts : null, dollars: ppt || null })
        base.detail = `${win} (${Math.abs(up)}&${remaining}) vs ${lose}`
      } else if (up === 0) {
        base.detail = `${t1n} vs ${t2n} — AS thru ${played}`
        if (isTournament) base.winnerLine = `halved · ${pts / 2}pt each`
      } else {
        const leader = up > 0 ? t1n : t2n
        const trail = up > 0 ? t2n : t1n
        base.winnerLine = _fmtWinnerValue(leader, { pts: isTournament ? pts : null, dollars: ppt || null })
        base.detail = `${leader} (${Math.abs(up)} UP thru ${played}) vs ${trail}`
      }
      return base
    }

    if (t === 'match' || t === 'match1v1') {
      const r = computeMatch(ctx, cfg)
      if (!r) return base
      const p1n = r.p1?.name || '?'
      const p2n = r.p2?.name || '?'
      const up = r.finalUp
      const played = (r.holeResults || []).filter(h => !h.incomplete).length
      const p1Net = r.settlement?.p1Net || 0
      const isTournament = !!cfg.tournament
      const pts = cfg.points || 1
      const ppt = r.settlement?.ppt || cfg.ppt || 0

      if (played === 0) { base.detail = `${p1n} vs ${p2n} — not started`; return base }
      if (r.matchOver) {
        const win = up > 0 ? p1n : p2n
        const lose = up > 0 ? p2n : p1n
        base.winnerLine = _fmtWinnerValue(win, { pts: isTournament ? pts : null, dollars: Math.abs(p1Net) || ppt || null })
        base.detail = `${win} (${r.result}) vs ${lose}`
      } else if (up === 0) {
        base.detail = `${p1n} vs ${p2n} — AS thru ${played}`
        if (isTournament) base.winnerLine = `halved · ${pts / 2}pt each`
      } else {
        const leader = up > 0 ? p1n : p2n
        const trail = up > 0 ? p2n : p1n
        base.winnerLine = _fmtWinnerValue(leader, { pts: isTournament ? pts : null, dollars: Math.abs(p1Net) || ppt || null })
        base.detail = `${leader} (${Math.abs(up)} UP thru ${played}) vs ${trail}`
      }
      return base
    }

    if (t === 'nassau') {
      const r = computeNassau(ctx, cfg)
      if (!r) return base
      const s = r.settlement
      const t1n = s.t1Name || 'T1'
      const t2n = s.t2Name || 'T2'
      const total = s.total || 0
      if (total === 0) {
        base.detail = `${t1n} vs ${t2n} — all square`
      } else {
        const winner = total > 0 ? t1n : t2n
        base.winnerLine = `${winner} +$${Math.abs(total)}`
        const parts = []
        if (s.front) parts.push(`F ${s.front > 0 ? '+' : ''}$${Math.abs(s.front)}`)
        if (s.back) parts.push(`B ${s.back > 0 ? '+' : ''}$${Math.abs(s.back)}`)
        if (s.overall) parts.push(`O ${s.overall > 0 ? '+' : ''}$${Math.abs(s.overall)}`)
        base.detail = parts.length ? parts.join(' · ') : `${t1n} vs ${t2n}`
      }
      return base
    }

    if (t === 'skins') {
      const r = computeSkins(ctx, cfg)
      if (!r) return base
      const won = (r.holeResults || []).filter(h => h.winner).length
      const topWinners = (r.settlements || [])
        .filter(s => (s.net || 0) > 0)
        .sort((a, b) => (b.net || 0) - (a.net || 0))
        .slice(0, 2)
      if (topWinners.length) {
        base.winnerLine = topWinners.map(w => `${w.name} +$${w.net}`).join(', ')
      }
      base.detail = won ? `${won} skin${won === 1 ? '' : 's'} paid` : 'No skins won yet'
      return base
    }

    if (t === 'dots') {
      const r = computeDots(ctx, cfg)
      if (!r) return base
      const top = (r.settlements || [])
        .filter(s => (s.net || 0) > 0)
        .sort((a, b) => (b.net || 0) - (a.net || 0))[0]
      if (top) base.winnerLine = `${top.name} +$${top.net}`
      base.detail = (r.settlements || []).map(s => `${s.name}: ${s.myDots || 0}`).join(' · ')
      return base
    }

    if (t === 'fidget') {
      const r = computeFidget(ctx, cfg)
      if (!r) return base
      base.detail = (r.atRisk || []).length
        ? `At risk: ${(r.atRisk || []).map(m => m.name).join(', ')}`
        : 'Everyone has won at least one hole'
      return base
    }

    if (t === 'snake') {
      const r = computeSnake(ctx, cfg)
      if (!r) return base
      if (r.holderName) base.detail = `${r.holderName} holds the snake (${r.snakeCount || 0} events)`
      else base.detail = 'No 3-putts recorded'
      return base
    }

    if (t === 'bbn') {
      const r = computeBestBallNet(ctx, cfg)
      if (!r) return base
      const tp = r.overallToPar
      const toPar = tp === 0 ? 'E' : (tp > 0 ? `+${tp}` : `${tp}`)
      base.detail = `Total: ${r.totalScore} (${toPar})`
      return base
    }

    // Fallback: just show the game label
    return base
  } catch (e) {
    console.warn('recap error for', t, e)
    return base
  }
}

function _fmtWinnerValue(name, { pts, dollars }) {
  const parts = []
  if (pts != null) parts.push(`+${pts} pt${pts === 1 ? '' : 's'}`)
  if (dollars != null && dollars > 0) parts.push(`+$${dollars}`)
  return parts.length ? `${name} ${parts.join(' · ')}` : name
}

// ── Settlement: compute on demand when no snapshot is saved ───────
function _computeSettlementFromRound(round) {
  const ctx = _buildCtxForRound(round)
  if (!ctx) return null
  const games = round.game_configs || []
  if (!games.length) return null
  return computeAllSettlements(ctx, games)
}
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

/* Settlement totals */
.settlement-totals {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.settlement-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--gw-radius-sm, 8px);
}
.settlement-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-text);
}
.settlement-amount {
  font-family: var(--gw-font-mono);
  font-size: 15px;
  font-weight: 700;
}
.settlement-player.positive .settlement-amount { color: #86efac; }
.settlement-player.negative .settlement-amount { color: #fca5a5; }

/* Ledger entries */
.settlement-ledger {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ledger-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(212, 175, 55, 0.06);
  border-radius: var(--gw-radius-sm, 8px);
  border-left: 3px solid var(--gw-gold);
}
.ledger-from {
  font-size: 13px;
  font-weight: 600;
  color: #fca5a5;
}
.ledger-arrow {
  font-size: 13px;
  color: var(--gw-text-muted);
}
.ledger-to {
  font-size: 13px;
  font-weight: 600;
  color: #86efac;
  flex: 1;
}
.ledger-amount {
  font-family: var(--gw-font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--gw-gold);
}
.settlement-even {
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--gw-text-muted);
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--gw-radius-sm, 8px);
}

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

/* Round actions */
.round-actions {
  display: flex; gap: 8px; padding-top: 12px; margin-top: 8px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.round-action-btn {
  flex: 1; padding: 10px 12px; border-radius: 10px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04);
  color: var(--gw-text, #f0ede0);
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}
.round-action-btn:active { background: rgba(255,255,255,.08); }
.round-action-edit { border-color: rgba(96,165,250,.3); color: #60a5fa; }
.round-action-view { border-color: rgba(147,197,253,.25); color: #93c5fd; }
.round-action-delete { border-color: rgba(248,113,113,.3); color: #f87171; }

/* Delete confirmation overlay */
.delete-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.delete-dialog {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid rgba(248,113,113,.3);
  border-radius: 16px;
  padding: 24px; max-width: 340px; width: 100%;
}
.delete-title {
  font-size: 18px; font-weight: 800; color: #f87171; margin-bottom: 10px;
}
.delete-msg {
  font-size: 13px; color: rgba(240,237,224,.7); line-height: 1.5; margin-bottom: 18px;
}
.delete-actions { display: flex; gap: 10px; }
.btn-cancel {
  flex: 1; padding: 12px; border-radius: 10px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text, #f0ede0); font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-delete-confirm {
  flex: 1; padding: 12px; border-radius: 10px;
  background: rgba(248,113,113,.2); border: 1px solid rgba(248,113,113,.4);
  color: #f87171; font-size: 14px; font-weight: 700; cursor: pointer;
}
.btn-delete-confirm:active { background: rgba(248,113,113,.35); }
.btn-cancel:disabled,
.btn-delete-confirm:disabled {
  opacity: .5;
  cursor: wait;
}
.delete-error {
  margin: -6px 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3);
  color: #f87171;
  font-size: 12px;
  line-height: 1.4;
}

/* ── Leader chip on the round card header ──────────────── */
.round-leader-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 10px;
  background: rgba(212,175,55,.12);
  border: 1px solid rgba(212,175,55,.3);
  font-size: 12px;
  white-space: nowrap;
}
.rls-name {
  font-weight: 700;
  color: var(--gw-gold, #d4af37);
}
.rls-total {
  font-family: var(--gw-font-mono, monospace);
  font-weight: 800;
  color: var(--gw-text, #f0ede0);
  font-size: 13px;
}

/* ── Game Recap rows ─────────────────────────────────── */
.game-recap-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 4px;
}
.game-recap-row {
  padding: 10px 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 10px;
}
.grr-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 1.3;
}
.grr-icon { font-size: 14px; flex-shrink: 0; }
.grr-name {
  font-weight: 800;
  color: var(--gw-text, #f0ede0);
}
.grr-winner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #22c55e;
  font-weight: 700;
  font-size: 12px;
  margin-left: auto;
}
.grr-star {
  font-size: 12px;
}
.grr-detail {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(240,237,224,.7);
  line-height: 1.4;
}
</style>
