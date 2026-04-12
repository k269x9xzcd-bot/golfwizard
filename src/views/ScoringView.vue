<template>
  <div class="view scoring-view">
    <!-- Empty State -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🏌️</div>
      <h2 class="empty-title">No Active Round</h2>
      <p class="empty-message">Start a new round to begin tracking scores</p>
    </div>

    <!-- Active Round -->
    <div v-else class="round-container">
      <!-- Header -->
      <header class="scoring-header">
        <div class="header-left">
          <h1 class="course-name">{{ roundsStore.activeRound.course_name }}</h1>
          <div class="header-meta">
            <span class="meta-tag">{{ roundsStore.activeRound.tee }}</span>
            <span class="meta-tag">{{ holesLabel }}</span>
            <span v-if="roundsStore.activeRound.room_code" class="meta-tag meta-live">🔗 {{ roundsStore.activeRound.room_code }}</span>
          </div>
        </div>
        <router-link to="/library" class="btn-rules-sm">📖</router-link>
      </header>

      <!-- ── Tab Strip: Card + Hole numbers ────────────────────── -->
      <div class="tab-strip">
        <div class="tab-strip-inner">
          <button class="hole-btn" :class="{ active: activeHole === 0 }" @click="activeHole = 0">Card</button>
          <div class="tab-divider"></div>
          <div class="hole-strip">
            <button
              v-for="h in visibleHoles"
              :key="h"
              class="hole-btn"
              :class="{ active: activeHole === h, scored: activeHole !== h && holeHasData(h) }"
              @click="activeHole = h"
            >{{ h }}</button>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           CARD VIEW (activeHole === 0) — Scorecard grid + live games
           ═══════════════════════════════════════════════════════════ -->
      <div v-if="activeHole === 0" class="card-view" @touchstart="onTouchStart" @touchend="onTouchEnd">

        <!-- Live Games Summary -->
        <div v-if="roundsStore.activeGames.length > 0" class="live-games-box">
          <div class="live-games-label">🎲 Live Games</div>
          <div v-for="game in roundsStore.activeGames" :key="game.id" class="live-game-row">
            <span class="live-game-icon">{{ gameIcon(game.type) }}</span>
            <span class="live-game-name">{{ gameLabel(game.type, game.config) }}</span>
            <span class="live-game-status" v-html="gameLiveSummary(game)"></span>
          </div>
        </div>

        <!-- Horizontal Scorecard Grid -->
        <div class="scorecard-scroll">
          <table class="scorecard-grid">
            <thead>
              <tr class="row-header">
                <th class="col-sticky col-player-header">Player</th>
                <th v-for="h in visibleHoles" :key="h" class="col-hole-num" @click="activeHole = h">{{ h }}</th>
                <th v-if="hasBack9" class="col-subtotal">OUT</th>
                <th v-if="hasBack9" class="col-subtotal">IN</th>
                <th class="col-total">G</th>
                <th class="col-total">N</th>
              </tr>
              <!-- Par row -->
              <tr class="row-par">
                <td class="col-sticky col-par-label">Par</td>
                <td v-for="h in visibleHoles" :key="'p'+h" class="col-par-val">{{ parForHole(h) }}</td>
                <td v-if="hasBack9" class="col-subtotal par-sub">{{ parTotal(frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
                <td v-if="hasBack9" class="col-subtotal par-sub">{{ parTotal(backHoles[0], backHoles[backHoles.length-1]) }}</td>
                <td class="col-total par-sub">{{ parTotal(visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
                <td class="col-total"></td>
              </tr>
              <!-- Yardage row -->
              <tr v-if="hasYardage" class="row-yards">
                <td class="col-sticky col-par-label">Yds</td>
                <td v-for="h in visibleHoles" :key="'y'+h" class="col-yards-val">{{ yardsForHole(h) || '' }}</td>
                <td v-if="hasBack9" class="col-subtotal"></td>
                <td v-if="hasBack9" class="col-subtotal"></td>
                <td class="col-total"></td>
                <td class="col-total"></td>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="member in roundsStore.activeMembers"
                :key="member.id"
                class="row-player"
                :class="teamRowClass(member)"
              >
                <td class="col-sticky col-player-name" :class="teamStickyClass(member)">
                  <span class="player-nm" :class="teamTextClass(member)">{{ member.short_name || member.guest_name }}</span>
                  <span class="player-hcp">{{ memberHandicapDisplay(member) }}</span>
                </td>
                <td
                  v-for="h in visibleHoles"
                  :key="h"
                  class="col-score-cell"
                  :class="{ 'cell-winner': isNetWinner(member.id, h) }"
                  @click="activeHole = h"
                >
                  <span v-if="getScore(member.id, h)" :class="scoreNotation(getScore(member.id, h), parForHole(h))">{{ getScore(member.id, h) }}</span>
                  <span v-else class="score-empty-dot">·</span>
                  <span v-if="strokeDotsOnHole(member, h)" class="stroke-dots">{{ '•'.repeat(strokeDotsOnHole(member, h)) }}</span>
                </td>
                <td v-if="hasBack9" class="col-subtotal">{{ memberGrossTotal(member.id, frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
                <td v-if="hasBack9" class="col-subtotal">{{ memberGrossTotal(member.id, backHoles[0], backHoles[backHoles.length-1]) }}</td>
                <td class="col-total col-gross">{{ memberGrossTotal(member.id, visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
                <td class="col-total col-net">{{ memberNetTotal(member.id, visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- In-round game config editor (tap a game chip) -->
        <div v-if="selectedGame" class="game-edit-panel">
          <div class="game-edit-header">
            <span class="game-edit-title">{{ gameIcon(selectedGame.type) }} {{ gameLabel(selectedGame.type, selectedGame.config) }}</span>
            <div class="game-edit-actions">
              <router-link to="/library" class="btn-rules-link">📖 Rules</router-link>
              <button class="btn-close-edit" @click="selectedGame = null">✕</button>
            </div>
          </div>
          <div class="game-edit-fields">
            <div v-if="selectedGame.config.ppt !== undefined" class="edit-field">
              <label>$ value</label>
              <input type="number" :value="selectedGame.config.ppt" @change="updateSelectedConfig('ppt', +$event.target.value)" class="edit-input" min="1" />
            </div>
            <template v-if="selectedGame.type === 'nassau'">
              <div class="edit-field"><label>Front $</label><input type="number" :value="selectedGame.config.front" @change="updateSelectedConfig('front', +$event.target.value)" class="edit-input" min="1" /></div>
              <div class="edit-field"><label>Back $</label><input type="number" :value="selectedGame.config.back" @change="updateSelectedConfig('back', +$event.target.value)" class="edit-input" min="1" /></div>
              <div class="edit-field"><label>Overall $</label><input type="number" :value="selectedGame.config.overall" @change="updateSelectedConfig('overall', +$event.target.value)" class="edit-input" min="1" /></div>
            </template>
            <div v-if="selectedGame.config.ppp !== undefined" class="edit-field">
              <label>$ per player</label>
              <input type="number" :value="selectedGame.config.ppp" @change="updateSelectedConfig('ppp', +$event.target.value)" class="edit-input" min="1" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           HOLE VIEW (activeHole > 0) — Per-hole score entry
           ═══════════════════════════════════════════════════════════ -->
      <div v-else class="hole-view" @touchstart="onTouchStart" @touchend="onTouchEnd">

        <!-- Hole Banner -->
        <div class="hole-banner">
          <div class="hole-banner-left">
            <div class="hole-big-number">Hole {{ activeHole }}</div>
            <div class="hole-course-meta">{{ roundsStore.activeRound.course_name }} · {{ roundsStore.activeRound.tee }}</div>
          </div>
          <div class="hole-banner-right">
            <div class="hole-big-number">Par {{ parForHole(activeHole) }}</div>
            <div class="hole-course-meta">SI {{ siForHole(activeHole) }}<template v-if="yardsForHole(activeHole)"> · {{ yardsForHole(activeHole) }}y</template></div>
          </div>
        </div>

        <!-- Player Score Cards -->
        <div class="hole-players-list">
          <div
            v-for="member in roundsStore.activeMembers"
            :key="member.id"
            class="player-hole-card"
            :class="[teamCardClass(member), { 'card-winner': isNetWinner(member.id, activeHole) }]"
            @click="openScoreEntry(member, activeHole)"
          >
            <div class="phc-left">
              <div class="phc-initials" :class="teamBadgeClass(member)">{{ playerInitials(member) }}</div>
              <div class="phc-info">
                <div class="phc-name" :class="teamTextClass(member)">{{ member.short_name || member.guest_name }}</div>
                <div class="phc-running">
                  <span v-if="memberGrossTotal(member.id, visibleHoles[0], activeHole) !== '—'">
                    Thru {{ activeHole }}: {{ memberGrossTotal(member.id, visibleHoles[0], activeHole) }}
                    ({{ memberGrossToPar(member.id, visibleHoles[0], activeHole) }})
                  </span>
                  <span v-else class="muted">No scores yet</span>
                </div>
              </div>
            </div>
            <div class="phc-right">
              <div class="phc-score" :class="scoreNotation(getScore(member.id, activeHole), parForHole(activeHole))">
                {{ getScore(member.id, activeHole) || '—' }}
              </div>
              <div v-if="getScore(member.id, activeHole)" class="phc-net">
                net {{ netScore(getScore(member.id, activeHole), memberHandicapValue(member), siForHole(activeHole)) }}
              </div>
              <div v-if="strokeDotsOnHole(member, activeHole)" class="phc-strokes">
                {{ '•'.repeat(strokeDotsOnHole(member, activeHole)) }} stroke{{ strokeDotsOnHole(member, activeHole) > 1 ? 's' : '' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Snake 3-putt panel -->
        <div v-if="snakeGame" class="bonus-panel">
          <div class="bonus-header">
            <span class="bonus-label">🐍 Snake</span>
            <span v-if="snakeHolder" class="snake-current">{{ snakeHolderName }} holds</span>
            <span v-else class="snake-current muted">No holder yet</span>
          </div>
          <div class="snake-prompt">Tap who 3-putted:</div>
          <div class="snake-buttons">
            <button
              v-for="member in roundsStore.activeMembers"
              :key="'snake-' + member.id"
              class="snake-tap-btn"
              @click="addSnakeEvent(member.id)"
            >{{ member.short_name || member.guest_name }}</button>
          </div>
          <div v-if="snakeEventsOnHole.length" class="snake-hole-events">
            🐍 × {{ snakeEventsOnHole.length }} on this hole
            <button class="btn-undo-snake" @click="undoLastSnake">Undo</button>
          </div>
        </div>

        <div class="swipe-hint">swipe ← → to change holes</div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           SCORE ENTRY MODAL
           ═══════════════════════════════════════════════════════════ -->
      <Transition name="overlay">
        <div v-if="entryMode" class="score-entry-overlay" @click="closeScoreEntry">
          <div class="score-entry-modal" @click.stop>
            <div class="entry-header">
              <div>
                <span class="entry-hole">Hole {{ entryHole }}</span>
                <span class="entry-par">Par {{ parForHole(entryHole) }}</span>
                <span class="entry-si">SI {{ siForHole(entryHole) }}</span>
              </div>
              <div class="entry-player">{{ entryMember?.short_name || entryMember?.guest_name }}</div>
            </div>

            <div class="score-input-area">
              <button class="btn-adjust btn-minus" @click="decrementScore">−</button>
              <div class="score-hero">
                <div class="score-number" :class="scoreNotation(entryScore, parForHole(entryHole))">{{ entryScore }}</div>
                <div class="score-label-text">{{ scoreLabel(entryScore - parForHole(entryHole)) }}</div>
                <div v-if="entryScore && entryMember" class="net-display">
                  Net: {{ netScore(entryScore, memberHandicapValue(entryMember), siForHole(entryHole)) }}
                </div>
              </div>
              <button class="btn-adjust btn-plus" @click="incrementScore">＋</button>
            </div>

            <button class="btn-done" @click="saveScore">Done</button>
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
import {
  memberHandicap as _memberHandicap, strokesOnHole, holeSI, holePar, holeYards,
  netScore as calcNetScore, memberNetOnHoleLowMan, getScore as _getScore,
  computeNassau, computeSkins, computeMatch, computeVegas, computeSnake,
  computeHiLow, computeStableford, computeWolf, computeHammer, computeSixes,
  computeFiveThreeOne, computeDots, computeFidget, computeBestBallNet,
  holeRange
} from '../modules/gameEngine'

const roundsStore = useRoundsStore()

// ── View state ──────────────────────────────────────────────────
const activeHole = ref(0) // 0 = Card view, >0 = Hole entry
const entryMode = ref(false)
const entryMember = ref(null)
const entryHole = ref(null)
const entryScore = ref(null)
const selectedGame = ref(null)

// Swipe
const swipeStartX = ref(0)
const swipeStartY = ref(0)

function onTouchStart(e) {
  swipeStartX.value = e.touches[0].clientX
  swipeStartY.value = e.touches[0].clientY
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - swipeStartX.value
  const dy = e.changedTouches[0].clientY - swipeStartY.value
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (activeHole.value === 0) return // no swipe on card view
    const idx = visibleHoles.value.indexOf(activeHole.value)
    if (dx < 0 && idx < visibleHoles.value.length - 1) {
      activeHole.value = visibleHoles.value[idx + 1]
    } else if (dx > 0 && idx > 0) {
      activeHole.value = visibleHoles.value[idx - 1]
    }
  }
}

// ── Course data ─────────────────────────────────────────────────
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

const hasBack9 = computed(() => visibleHoles.value.length > 9)
const frontHoles = computed(() => visibleHoles.value.filter(h => h <= 9))
const backHoles = computed(() => visibleHoles.value.filter(h => h > 9))

const hasYardage = computed(() => {
  if (!courseData.value) return false
  const tee = roundsStore.activeRound?.tee
  return !!(courseData.value.teesData?.[tee]?.yardsByHole)
})

// ── Hole helpers ────────────────────────────────────────────────
function parForHole(hole) {
  return courseData.value?.par?.[hole - 1] ?? 4
}

function siForHole(hole) {
  // Use per-tee SI if available (custom courses store SI per tee box)
  return holeSI(courseData.value, hole, roundsStore.activeRound?.tee)
}

function yardsForHole(hole) {
  const tee = roundsStore.activeRound?.tee
  return courseData.value?.teesData?.[tee]?.yardsByHole?.[hole - 1] ?? null
}

function holeHasData(hole) {
  return roundsStore.activeMembers.some(m => getScore(m.id, hole) !== null)
}

// ── Score helpers ───────────────────────────────────────────────
function getScore(memberId, hole) {
  return roundsStore.activeScores[memberId]?.[hole] ?? null
}

function memberHandicapValue(member) {
  return _memberHandicap(member, courseData.value, roundsStore.activeRound?.tee)
}

function memberHandicapDisplay(member) {
  const h = memberHandicapValue(member)
  if (h == null) return ''
  return Math.round(h)
}

function netScore(gross, hcp, si) {
  if (gross == null) return null
  return gross - strokesOnHole(hcp, si)
}

function strokeDotsOnHole(member, hole) {
  const hcp = memberHandicapValue(member)
  const si = siForHole(hole)
  return strokesOnHole(hcp, si)
}

function isNetWinner(memberId, hole) {
  // Quick check: lowest net on this hole?
  const scores = roundsStore.activeMembers.map(m => {
    const g = getScore(m.id, hole)
    if (g == null) return null
    return { id: m.id, net: netScore(g, memberHandicapValue(m), siForHole(hole)) }
  }).filter(s => s !== null)
  if (scores.length < 2) return false
  const minNet = Math.min(...scores.map(s => s.net))
  const winners = scores.filter(s => s.net === minNet)
  return winners.length === 1 && winners[0].id === memberId
}

function scoreNotation(score, par) {
  if (score == null) return 'sn-empty'
  const diff = score - par
  if (diff <= -3) return 'sn-alb'
  if (diff === -2) return 'sn-eagle'
  if (diff === -1) return 'sn-birdie'
  if (diff === 0) return 'sn-par'
  if (diff === 1) return 'sn-bogey'
  if (diff === 2) return 'sn-dbl'
  return 'sn-trip'
}

function scoreLabel(diff) {
  if (diff == null) return ''
  if (diff <= -3) return 'Albatross!'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double'
  return `+${diff}`
}

function memberGrossTotal(memberId, startHole, endHole) {
  let total = 0, count = 0
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s !== null) { total += s; count++ }
  }
  return count > 0 ? total : '—'
}

function memberNetTotal(memberId, startHole, endHole) {
  let total = 0, count = 0
  const member = roundsStore.activeMembers.find(m => m.id === memberId)
  if (!member) return '—'
  const hcp = memberHandicapValue(member)
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s !== null) {
      total += s - strokesOnHole(hcp, siForHole(h))
      count++
    }
  }
  return count > 0 ? total : '—'
}

function memberGrossToPar(memberId, startHole, endHole) {
  let total = 0, count = 0
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s !== null) { total += s - parForHole(h); count++ }
  }
  if (count === 0) return 'E'
  if (total === 0) return 'E'
  return total > 0 ? `+${total}` : `${total}`
}

function parTotal(startHole, endHole) {
  let t = 0
  for (let h = startHole; h <= endHole; h++) t += parForHole(h)
  return t
}

function playerInitials(member) {
  const name = member.short_name || member.guest_name || '?'
  return name.slice(0, 2).toUpperCase()
}

// ── Team styling ────────────────────────────────────────────────
function teamRowClass(m) { return m.team === 1 ? 'team1-row' : m.team === 2 ? 'team2-row' : '' }
function teamStickyClass(m) { return m.team === 1 ? 'sticky-t1' : m.team === 2 ? 'sticky-t2' : 'sticky-default' }
function teamTextClass(m) { return m.team === 1 ? 't1' : m.team === 2 ? 't2' : '' }
function teamCardClass(m) { return m.team === 1 ? 'card-t1' : m.team === 2 ? 'card-t2' : '' }
function teamBadgeClass(m) { return m.team === 1 ? 'badge-t1' : m.team === 2 ? 'badge-t2' : 'badge-default' }

// ── Game helpers ────────────────────────────────────────────────
function gameIcon(type) {
  const icons = { nassau:'💰', skins:'💎', match:'⚔️', matchplay:'⚔️', bestball:'🤝', snake:'🐍', dots:'🎯', fidget:'😬', bbn:'🏌️', match1v1:'⚔️', vegas:'🎰', hilow:'📊', stableford:'⭐', wolf:'🐺', hammer:'🔨', sixes:'🎲', fivethreeone:'5️⃣' }
  return icons[type?.toLowerCase()] || '🎮'
}

function gameLabel(type, config) {
  if (type?.toLowerCase() === 'bbn' && config?.label) return config.label
  const labels = { nassau:'Nassau', skins:'Skins', match:'Match', matchplay:'Match Play', bestball:'Best Ball', snake:'Snake', dots:'Dots', fidget:'Fidget', bbn:'Best Ball', match1v1:'1v1', vegas:'Vegas', hilow:'Hi-Low', stableford:'Stableford', wolf:'Wolf', hammer:'Hammer', sixes:'Sixes', fivethreeone:'5-3-1' }
  return labels[type?.toLowerCase()] || type
}

function buildCtx() {
  return {
    course: courseData.value,
    tee: roundsStore.activeRound?.tee,
    members: roundsStore.activeMembers,
    scores: roundsStore.activeScores,
    holesMode: roundsStore.activeRound?.holes_mode || '18',
  }
}

function gameLiveSummary(game) {
  const ctx = buildCtx()
  const t = game.type?.toLowerCase()
  try {
    if (t === 'nassau') {
      const r = computeNassau(ctx, game.config)
      const front = r.front?.status || 'AS'
      const back = r.back?.status || 'AS'
      const overall = r.overall?.status || 'AS'
      return `F: ${front} · B: ${back} · O: ${overall}`
    }
    if (t === 'skins') {
      const r = computeSkins(ctx, game.config)
      const won = r.results?.filter(s => s.winner).length || 0
      const carry = r.results?.filter(s => !s.winner).length || 0
      return `${won} won · ${carry} carry`
    }
    if (t === 'match' || t === 'match1v1') {
      const r = computeMatch(ctx, game.config)
      return r.status || 'AS'
    }
    if (t === 'vegas') {
      const r = computeVegas(ctx, game.config)
      const diff = r.runningTotal || 0
      if (diff === 0) return 'Even'
      return diff > 0 ? `<span class="gw-winning">T1 +${diff}</span>` : `<span class="gw-losing">T2 +${Math.abs(diff)}</span>`
    }
    if (t === 'snake') {
      const r = computeSnake(ctx, game.config)
      return r.holderName ? `${r.holderName} holds · ${r.snakeCount} 🐍` : 'No snakes yet'
    }
    if (t === 'hilow') {
      const r = computeHiLow(ctx, game.config)
      const diff = (r.team1Pts || 0) - (r.team2Pts || 0)
      if (diff === 0) return 'Even'
      return diff > 0 ? `<span class="gw-winning">T1 +${diff}</span>` : `<span class="gw-losing">T2 +${Math.abs(diff)}</span>`
    }
    if (t === 'stableford') {
      const r = computeStableford(ctx, game.config)
      const top = r.standings?.[0]
      return top ? `${top.name}: ${top.pts} pts` : '—'
    }
    if (t === 'wolf') {
      const r = computeWolf(ctx, game.config)
      const top = r.standings?.[0]
      return top ? `${top.name}: ${top.balance > 0 ? '+' : ''}${top.balance}` : '—'
    }
    if (t === 'hammer') {
      const r = computeHammer(ctx, game.config)
      const diff = (r.team1Total || 0) - (r.team2Total || 0)
      if (diff === 0) return 'Even'
      return diff > 0 ? `<span class="gw-winning">T1 +$${diff}</span>` : `<span class="gw-losing">T2 +$${Math.abs(diff)}</span>`
    }
    if (t === 'sixes') {
      const r = computeSixes(ctx, game.config)
      const top = r.standings?.[0]
      return top ? `${top.name}: ${top.pts} pts` : '—'
    }
    if (t === 'fivethreeone') {
      const r = computeFiveThreeOne(ctx, game.config)
      const top = r.standings?.[0]
      return top ? `${top.name}: ${top.pts} pts` : '—'
    }
    if (t === 'dots') {
      const r = computeDots(ctx, game.config)
      const top = r.standings?.[0]
      return top ? `${top.name}: ${top.dots} dots` : '—'
    }
    if (t === 'fidget') {
      const r = computeFidget(ctx, game.config)
      const fidgets = r.results?.filter(p => p.isFidget) || []
      return fidgets.length ? `⚠️ ${fidgets.map(f => f.name).join(', ')} fidgeting` : 'No fidgets yet'
    }
    if (t === 'bbn') {
      const r = computeBestBallNet(ctx, game.config)
      const total = r.teamTotal ?? null
      if (total == null) return '—'
      const toPar = total - parTotal(visibleHoles.value[0], visibleHoles.value[visibleHoles.value.length - 1])
      return toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`
    }
  } catch(e) {
    // Engine may throw if insufficient data
  }
  return '—'
}

// ── In-round config editing ─────────────────────────────────────
async function updateSelectedConfig(field, value) {
  if (!selectedGame.value) return
  selectedGame.value.config[field] = value
  await roundsStore.updateGameConfig(selectedGame.value.id, { ...selectedGame.value.config })
}

// ── Score entry modal ───────────────────────────────────────────
function openScoreEntry(member, hole) {
  entryMember.value = member
  entryHole.value = hole
  const existing = getScore(member.id, hole)
  entryScore.value = existing !== null ? existing : parForHole(hole)
  entryMode.value = true
}

function closeScoreEntry() {
  entryMode.value = false
  setTimeout(() => { entryMember.value = null; entryHole.value = null; entryScore.value = null }, 300)
}

function incrementScore() { if (entryScore.value < 13) entryScore.value++ }
function decrementScore() { if (entryScore.value > 1) entryScore.value-- }

async function saveScore() {
  try {
    await roundsStore.setScore(entryMember.value.id, entryHole.value, entryScore.value)
    closeScoreEntry()
  } catch (error) {
    console.error('Failed to save score:', error)
  }
}

// ── Snake 3-putt ────────────────────────────────────────────────
const snakeGame = computed(() => roundsStore.activeGames.find(g => g.type?.toLowerCase() === 'snake') || null)
const snakeHolder = computed(() => { const e = snakeGame.value?.config?.events || []; return e.length ? e[e.length - 1].pid : null })
const snakeHolderName = computed(() => { if (!snakeHolder.value) return null; const m = roundsStore.activeMembers.find(m => m.id === snakeHolder.value); return m?.short_name || m?.guest_name || '?' })
const snakeEventsOnHole = computed(() => (snakeGame.value?.config?.events || []).filter(e => e.hole === activeHole.value))

async function addSnakeEvent(pid) {
  if (!snakeGame.value) return
  const events = snakeGame.value.config.events || []
  events.push({ hole: activeHole.value, pid, ts: Date.now() })
  snakeGame.value.config.events = events
  await roundsStore.updateGameConfig(snakeGame.value.id, { ...snakeGame.value.config, events })
}

async function undoLastSnake() {
  if (!snakeGame.value) return
  const events = snakeGame.value.config.events || []
  if (!events.length) return
  events.pop()
  snakeGame.value.config.events = events
  await roundsStore.updateGameConfig(snakeGame.value.id, { ...snakeGame.value.config, events })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════
   SCORING VIEW — Premium golf scorecard
   ═══════════════════════════════════════════════════════════════════ */

.scoring-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--gw-neutral-950, #0c0f0d);
}

.round-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ── Empty state ──────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80vh;
  text-align: center;
  padding: 2rem;
}
.empty-icon { font-size: 4rem; margin-bottom: 1rem; }
.empty-title { font-family: var(--gw-font-display); font-size: 1.75rem; color: var(--gw-text); margin: 0 0 0.5rem; }
.empty-message { color: var(--gw-text-muted); margin: 0; }

/* ── Header ───────────────────────────────────────────────────── */
.scoring-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
  flex-shrink: 0;
}
.course-name {
  font-family: var(--gw-font-display, Georgia);
  font-size: 20px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
  margin: 0;
  line-height: 1.2;
}
.header-meta {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.meta-tag {
  font-size: 10px;
  color: rgba(240,237,224,.5);
  background: rgba(255,255,255,.05);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.meta-live { color: var(--gw-gold, #d4af37); background: rgba(212,175,55,.1); }
.btn-rules-sm {
  font-size: 18px;
  text-decoration: none;
  padding: 4px;
}

/* ── Tab Strip (Card + Hole buttons) ─────────────────────────── */
.tab-strip {
  padding: 8px 12px;
  flex-shrink: 0;
}
.tab-strip-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tab-divider {
  width: 1px;
  height: 24px;
  background: rgba(255,255,255,.1);
  flex-shrink: 0;
}
.hole-strip {
  display: flex;
  overflow-x: auto;
  gap: 5px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  flex: 1;
}
.hole-strip::-webkit-scrollbar { display: none; }

.hole-btn {
  flex-shrink: 0;
  min-width: 38px;
  height: 38px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.05);
  color: rgba(240,237,224,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .15s;
  font-family: inherit;
  padding: 0 6px;
  -webkit-tap-highlight-color: transparent;
}
.hole-btn.active {
  background: rgba(212,175,55,.2);
  border-color: var(--gw-gold, #d4af37);
  color: var(--gw-gold, #d4af37);
}
.hole-btn.scored {
  background: rgba(74,222,128,.1);
  border-color: rgba(74,222,128,.35);
  color: #4ade80;
}

/* ═══════════════════════════════════════════════════════════════════
   CARD VIEW — Scorecard grid + live games
   ═══════════════════════════════════════════════════════════════════ */
.card-view {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 100px;
  -webkit-overflow-scrolling: touch;
}

/* ── Live Games Box ──────────────────────────────────────────── */
.live-games-box {
  background: rgba(74,222,128,.06);
  border: 1px solid rgba(74,222,128,.2);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 8px 12px;
}
.live-games-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: rgba(240,237,224,.45);
  margin-bottom: 8px;
}
.live-game-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid rgba(255,255,255,.04);
  font-size: 12px;
}
.live-game-row:first-of-type { border-top: none; }
.live-game-icon { font-size: 14px; flex-shrink: 0; }
.live-game-name { font-weight: 700; color: var(--gw-text, #f0ede0); min-width: 60px; }
.live-game-status { color: rgba(240,237,224,.7); flex: 1; }
:deep(.gw-winning) { color: #4ade80; font-weight: 700; }
:deep(.gw-losing) { color: #f87171; font-weight: 700; }

/* ── Scorecard Grid ──────────────────────────────────────────── */
.scorecard-scroll {
  overflow-x: auto;
  margin: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  -webkit-overflow-scrolling: touch;
}

.scorecard-grid {
  border-collapse: collapse;
  font-size: 11px;
  min-width: 100%;
  font-family: var(--gw-font-mono, 'DM Mono', monospace);
}

/* Sticky player column */
.col-sticky {
  position: sticky;
  left: 0;
  z-index: 2;
  white-space: nowrap;
}

.col-player-header {
  padding: 6px 10px;
  text-align: left;
  background: rgba(7,15,7,.97);
  color: rgba(240,237,224,.45);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
}

.col-hole-num {
  padding: 5px 4px;
  text-align: center;
  cursor: pointer;
  min-width: 24px;
  color: var(--gw-gold, #d4af37);
  font-size: 10px;
  font-weight: 700;
}
.col-hole-num:active { background: rgba(212,175,55,.1); }

.col-subtotal {
  padding: 5px 6px;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  background: rgba(212,175,55,.06);
  border-left: 1px solid rgba(212,175,55,.15);
  color: var(--gw-text, #f0ede0);
}
.col-total {
  padding: 5px 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  color: var(--gw-text, #f0ede0);
}
.col-gross { }
.col-net { color: rgba(240,237,224,.6); }

.par-sub { color: rgba(240,237,224,.4); font-weight: 600; }

/* Header rows */
.row-header { background: rgba(0,0,0,.3); }
.row-par {
  background: rgba(0,0,0,.2);
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.col-par-label {
  padding: 4px 10px;
  font-size: 10px;
  color: rgba(240,237,224,.35);
  background: rgba(7,15,7,.97);
}
.col-par-val {
  padding: 3px 4px;
  text-align: center;
  font-size: 10px;
  color: rgba(240,237,224,.4);
}

.row-yards { background: rgba(0,0,0,.15); border-bottom: 1px solid rgba(255,255,255,.05); }
.col-yards-val { padding: 2px 4px; text-align: center; font-size: 9px; color: rgba(240,237,224,.25); }

/* Player rows */
.row-player {
  border-top: 1px solid rgba(255,255,255,.05);
}
.team1-row { background: rgba(96,165,250,.05); }
.team2-row { background: rgba(248,113,113,.05); }

.col-player-name {
  padding: 5px 10px;
  background: rgba(7,14,7,.97);
}
.sticky-t1 { background: rgba(7,20,30,.97); }
.sticky-t2 { background: rgba(18,7,7,.97); }
.sticky-default { background: rgba(7,14,7,.97); }

.player-nm { font-size: 12px; font-weight: 700; color: var(--gw-text, #f0ede0); }
.player-hcp { font-size: 9px; color: rgba(240,237,224,.35); margin-left: 4px; }
.t1 { color: #60a5fa; }
.t2 { color: #f87171; }

.col-score-cell {
  padding: 3px 3px;
  text-align: center;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  position: relative;
  min-width: 24px;
}
.col-score-cell:active { background: rgba(255,255,255,.06); }
.cell-winner { background: rgba(74,222,128,.1); }

.score-empty-dot { color: rgba(240,237,224,.2); }

.stroke-dots {
  position: absolute;
  top: 1px;
  right: 1px;
  font-size: 6px;
  color: rgba(212,175,55,.9);
  line-height: 1;
}

/* ── Score notation classes ───────────────────────────────────── */
.sn-alb {
  display: inline-block;
  border-radius: 50%;
  padding: 0 3px;
  line-height: 1.6;
  border: 1.5px solid #ffd700;
  color: #ffd700;
  font-weight: 900;
  text-shadow: 0 0 6px rgba(255,215,0,.5);
}
.sn-eagle {
  display: inline-block;
  border-radius: 50%;
  padding: 0 3px;
  line-height: 1.6;
  border: 1.5px solid #4ade80;
  color: #4ade80;
  font-weight: 800;
  background: rgba(74,222,128,.08);
}
.sn-birdie {
  display: inline-block;
  border-radius: 50%;
  padding: 0 3px;
  line-height: 1.6;
  border: 1.5px solid #60a5fa;
  color: #60a5fa;
  font-weight: 700;
}
.sn-par { color: var(--gw-text, #f0ede0); }
.sn-bogey {
  display: inline-block;
  border-radius: 3px;
  padding: 0 3px;
  line-height: 1.6;
  border: 1.5px solid rgba(148,163,184,.5);
  color: #94a3b8;
}
.sn-dbl {
  display: inline-block;
  border-radius: 3px;
  padding: 0 3px;
  line-height: 1.6;
  border: 1.5px solid #f87171;
  color: #f87171;
  font-weight: 700;
}
.sn-trip { color: #dc2626; font-weight: 900; }
.sn-empty { color: rgba(240,237,224,.2); }

/* ═══════════════════════════════════════════════════════════════════
   HOLE VIEW — Per-hole entry
   ═══════════════════════════════════════════════════════════════════ */
.hole-view {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 100px;
  -webkit-overflow-scrolling: touch;
}

.hole-banner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 14px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, rgba(13,59,13,.7), rgba(7,21,7,.9));
  border: 1px solid rgba(212,175,55,.25);
}
.hole-big-number {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  color: var(--gw-text, #f0ede0);
}
.hole-banner-right .hole-big-number { text-align: right; }
.hole-course-meta {
  font-size: 11px;
  color: rgba(240,237,224,.45);
  margin-top: 4px;
}

.hole-players-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Player hole card */
.player-hole-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  cursor: pointer;
  transition: border-color .12s, background .12s;
  -webkit-tap-highlight-color: transparent;
}
.player-hole-card:active { background: rgba(255,255,255,.08); }
.card-t1 { background: rgba(96,165,250,.06); border-color: rgba(96,165,250,.2); }
.card-t2 { background: rgba(248,113,113,.06); border-color: rgba(248,113,113,.2); }
.card-winner { border-color: rgba(74,222,128,.4) !important; background: rgba(74,222,128,.07) !important; }

.phc-left { display: flex; align-items: center; gap: 10px; }
.phc-initials {
  width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 11px; flex-shrink: 0;
}
.badge-default { background: rgba(212,175,55,.2); color: #d4af37; }
.badge-t1 { background: rgba(96,165,250,.2); color: #60a5fa; }
.badge-t2 { background: rgba(248,113,113,.2); color: #f87171; }

.phc-name { font-size: 14px; font-weight: 700; color: var(--gw-text, #f0ede0); }
.phc-running { font-size: 11px; color: rgba(240,237,224,.45); margin-top: 2px; }
.muted { color: rgba(240,237,224,.35); }

.phc-right { text-align: right; }
.phc-score {
  font-size: 28px;
  font-weight: 900;
  font-family: var(--gw-font-mono, monospace);
  line-height: 1;
}
.phc-net { font-size: 11px; color: rgba(240,237,224,.5); margin-top: 2px; }
.phc-strokes { font-size: 10px; color: rgba(212,175,55,.7); }

/* ── Snake bonus panel ───────────────────────────────────────── */
.bonus-panel {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-600, #166044);
  border-radius: 12px;
  padding: 14px 16px;
  margin: 12px 0;
}
.bonus-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.bonus-label { font-size: 13px; font-weight: 600; color: var(--gw-gold, #d4af37); }
.snake-current {
  font-size: 12px;
  color: var(--gw-text-secondary, #a3b8aa);
  background: rgba(255,255,255,.06);
  padding: 3px 10px;
  border-radius: 20px;
}
.snake-prompt { font-size: 11px; color: rgba(240,237,224,.5); margin-bottom: 6px; }
.snake-buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.snake-tap-btn {
  flex: 1; min-width: 70px;
  padding: 10px 6px;
  border: 1.5px solid var(--gw-green-600, #166044);
  border-radius: 10px;
  background: var(--gw-green-900, #0a2218);
  color: var(--gw-text, #f0ede0);
  font-size: 13px; font-weight: 600;
  text-align: center; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.snake-tap-btn:active { background: var(--gw-green-600, #166044); border-color: var(--gw-gold, #d4af37); }
.snake-hole-events { font-size: 11px; color: rgba(240,237,224,.4); padding-top: 4px; }
.btn-undo-snake {
  background: none; border: 1px solid var(--gw-green-600); color: var(--gw-text-secondary, #a3b8aa);
  font-size: 11px; padding: 3px 10px; border-radius: 6px; cursor: pointer; margin-left: 8px;
}

.swipe-hint {
  text-align: center; font-size: 10px; color: rgba(240,237,224,.25);
  padding: 10px 0; user-select: none;
}

/* ═══════════════════════════════════════════════════════════════════
   SCORE ENTRY MODAL
   ═══════════════════════════════════════════════════════════════════ */
.score-entry-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  padding: 20px;
}
.score-entry-modal {
  background: var(--gw-green-900, #0a2218);
  border: 1px solid var(--gw-green-600, #166044);
  border-radius: 20px;
  padding: 24px;
  width: 100%;
  max-width: 340px;
}
.entry-header {
  text-align: center;
  margin-bottom: 20px;
}
.entry-hole {
  font-size: 20px; font-weight: 900;
  color: var(--gw-gold, #d4af37);
}
.entry-par, .entry-si {
  font-size: 13px; color: rgba(240,237,224,.5); margin-left: 8px;
}
.entry-player {
  font-size: 16px; font-weight: 700; color: var(--gw-text, #f0ede0); margin-top: 6px;
}

.score-input-area {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  margin-bottom: 24px;
}
.btn-adjust {
  width: 60px; height: 60px;
  border-radius: 50%;
  border: 2px solid var(--gw-green-600, #166044);
  background: var(--gw-green-800, #0d3325);
  color: var(--gw-text, #f0ede0);
  font-size: 28px; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
  transition: background .1s, border-color .1s;
}
.btn-adjust:active {
  background: var(--gw-green-600, #166044);
  border-color: var(--gw-gold, #d4af37);
}

.score-hero { text-align: center; }
.score-number {
  font-size: 72px;
  font-weight: 900;
  font-family: var(--gw-font-mono, monospace);
  line-height: 1;
}
.score-label-text {
  font-size: 14px;
  font-weight: 600;
  color: rgba(240,237,224,.6);
  margin-top: 4px;
}
.net-display {
  font-size: 12px;
  color: rgba(240,237,224,.4);
  margin-top: 4px;
}

.btn-done {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #d4af37, #b8962e);
  color: #071507;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.btn-done:active { opacity: 0.85; }

/* Modal transition */
.overlay-enter-active { transition: opacity .2s; }
.overlay-leave-active { transition: opacity .15s; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }

/* ── Game edit panel (reused from card view) ─────────────────── */
.game-edit-panel {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-600, #166044);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 8px 12px;
}
.game-edit-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.game-edit-title { font-size: 14px; font-weight: 700; color: var(--gw-text, #f0ede0); }
.game-edit-actions { display: flex; align-items: center; gap: 10px; }
.btn-rules-link {
  font-size: 11px; color: var(--gw-gold, #d4af37); text-decoration: none;
  padding: 3px 8px; border: 1px solid rgba(212,175,55,.3); border-radius: 6px;
}
.btn-close-edit {
  background: none; border: none; color: rgba(240,237,224,.5); font-size: 16px; cursor: pointer; padding: 2px 6px;
}
.game-edit-fields { display: flex; gap: 8px; flex-wrap: wrap; }
.edit-field { display: flex; flex-direction: column; gap: 3px; min-width: 70px; flex: 1; }
.edit-field label { font-size: 10px; color: rgba(240,237,224,.5); font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.edit-input {
  background: var(--gw-green-900, #0a2218); border: 1px solid var(--gw-green-600, #166044);
  color: var(--gw-text, #f0ede0); border-radius: 8px; padding: 8px 10px;
  font-size: 16px; font-weight: 600; width: 100%; text-align: center;
}
.edit-input:focus { outline: none; border-color: var(--gw-gold, #d4af37); }
</style>
