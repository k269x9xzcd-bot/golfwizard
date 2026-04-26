<template>
  <div class="games-view">
    <!-- Header -->
    <header class="games-header">
      <h1 class="games-title">Games</h1>
      <div class="games-header-right">
        <router-link to="/library" class="btn-library">📖 Rules</router-link>
        <div v-if="roundsStore.activeRound" class="round-badge">
          <span class="round-badge-dot" />
          Live
        </div>
      </div>
    </header>

    <!-- No active round -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🎯</div>
      <div class="empty-title">No active round</div>
      <div class="empty-sub">Start a round from the home screen to configure and track games.</div>
      <router-link to="/" class="btn-primary">Go Home</router-link>
      <router-link to="/library" class="btn-secondary" style="margin-top:8px">📖 Browse Game Rules</router-link>
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
              <div class="game-name">{{ gameLabel(game.type, game.config) }}</div>
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
              <template v-if="isGameType(game, 'nassau')">
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
                <div class="game-settlement">
                  <div v-if="nassauSettlement(game)" class="settlement-detail">
                    <div class="settlement-line">
                      <span>{{ nassauSettlement(game).t1Name }}</span>
                      <span :class="balanceClass(nassauSettlement(game).total)">
                        {{ formatBalance(nassauSettlement(game).total) }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Skins -->
              <template v-else-if="isGameType(game, 'skins')">
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

              <!-- Match Play (includes 1v1 side matches) -->
              <template v-else-if="isGameType(game, 'match') || isGameType(game, 'match1v1')">
                <div v-if="matchPlayResult(game)" class="match-standings">
                  <div class="match-player">
                    <span class="match-name">{{ matchPlayResult(game).p1.name }}</span>
                    <span class="match-status" :class="matchStatusClass(matchPlayResult(game).finalUp)">
                      {{ matchPlayResult(game).result }}
                    </span>
                  </div>
                  <div class="match-vs">VS</div>
                  <div class="match-player">
                    <span class="match-name">{{ matchPlayResult(game).p2.name }}</span>
                    <span class="match-status" :class="matchStatusClass(-matchPlayResult(game).finalUp)">
                      —
                    </span>
                  </div>
                </div>
              </template>

              <!-- Best Ball -->
              <template v-else-if="isGameType(game, 'bestball')">
                <div v-if="bestBallResult(game)" class="bestball-standings">
                  <div class="team-row">
                    <span>{{ bestBallResult(game).t1Name }}</span>
                    <span :class="balanceClass(bestBallResult(game).finalUp)">
                      {{ formatBalance(bestBallResult(game).finalUp) }}
                    </span>
                  </div>
                  <div class="team-row">
                    <span>{{ bestBallResult(game).t2Name }}</span>
                    <span :class="balanceClass(-bestBallResult(game).finalUp)">
                      {{ formatBalance(-bestBallResult(game).finalUp) }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Snake (3-putt based) -->
              <template v-else-if="isGameType(game, 'snake')">
                <div v-if="snakeResult(game)" class="snake-standings">
                  <div class="snake-holder-row" v-if="snakeResult(game).holder">
                    <span>🐍 Holder:</span>
                    <span class="snake-holder-name">{{ snakeResult(game).holderName }}</span>
                  </div>
                  <div class="snake-holder-row" v-else>
                    <span class="snake-no-holder">🐍 No holder yet</span>
                  </div>
                  <div class="snake-count">{{ snakeResult(game).snakeCount }} total 3-putts</div>
                  <div v-for="s in snakeResult(game).settlements" :key="s.id" class="standing-row">
                    <span class="standing-name">{{ s.name }}</span>
                    <span class="snake-count-badge">{{ s.snakes }}🐍</span>
                    <span class="standing-value" :class="balanceClass(s.net)">
                      {{ formatBalance(s.net) }}
                    </span>
                  </div>
                  <div class="game-note">Tap "who 3-putted" in scoring view to record</div>
                </div>
              </template>

              <!-- Dots -->
              <template v-else-if="isGameType(game, 'dots')">
                <div v-if="dotsResult(game)" class="dots-standings">
                  <div v-for="(player, id) in dotsResult(game).dots" :key="id" class="dots-player">
                    <span class="dots-name">{{ player.name }}</span>
                    <div class="dots-info">
                      <span class="dots-count">{{ player.dots }} dots</span>
                      <span class="dots-amount" :class="balanceClass(player.amount)">
                        {{ formatBalance(player.amount) }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Fidget -->
              <template v-else-if="isGameType(game, 'fidget')">
                <div v-if="fidgetResult(game)" class="fidget-standings">
                  <!-- Fidget 1 -->
                  <div class="fidget-pot-label" v-if="fidgetResult(game).doubleFidget">Fidget 1</div>
                  <div class="fidget-group">
                    <div class="fidget-label">Fidgeters (no wins)</div>
                    <div v-for="player in fidgetResult(game).fidgeters" :key="player.id" class="fidget-player">
                      <span class="fidget-name">{{ player.short_name || player.guest_name }}</span>
                      <span class="fidget-owes">Owes {{ (roundsStore.activeMembers.length - 1) * (game.config?.ppp || 10) }}</span>
                    </div>
                    <div v-if="!fidgetResult(game).fidgeters.length" class="fidget-safe">All safe ✓</div>
                  </div>
                  <div class="fidget-group">
                    <div class="fidget-label">Winners</div>
                    <div v-for="player in fidgetResult(game).winners" :key="player.id" class="fidget-player winning">
                      <span class="fidget-name">{{ player.short_name || player.guest_name }}</span>
                    </div>
                  </div>
                  <!-- Double Fidget -->
                  <template v-if="fidgetResult(game).doubleFidget">
                    <div class="fidget-divider"></div>
                    <div class="fidget-pot-label">
                      Fidget 2
                      <span v-if="!fidgetResult(game).fidget2Active" class="fidget-2-status">
                        {{ fidgetResult(game).allClearedHole ? '· Eligible (not started)' : '· Waiting for all to win a hole' }}
                      </span>
                      <span v-else class="fidget-2-status">· From hole {{ fidgetResult(game).fidget2StartHole }}</span>
                    </div>
                    <template v-if="fidgetResult(game).fidget2Active && fidgetResult(game).fidget2?.fidgeters">
                      <div class="fidget-group">
                        <div class="fidget-label">Fidgeters</div>
                        <div v-for="player in fidgetResult(game).fidget2.fidgeters" :key="player.id" class="fidget-player">
                          <span class="fidget-name">{{ player.short_name || player.guest_name }}</span>
                          <span class="fidget-owes">Owes {{ (roundsStore.activeMembers.length - 1) * (game.config?.ppp || 10) }}</span>
                        </div>
                        <div v-if="!fidgetResult(game).fidget2.fidgeters.length" class="fidget-safe">All safe ✓</div>
                      </div>
                    </template>
                  </template>
                </div>
              </template>

              <!-- BBN (Best Ball Net) -->
              <template v-else-if="isGameType(game, 'bbn')">
                <div v-if="bbnResult(game)" class="bbn-standings">
                  <div class="bbn-summary">
                    <div class="bbn-stat">
                      <span class="bbn-label">Total {{ bbnResult(game).scoring === 'gross' ? 'Gross' : 'Net' }}</span>
                      <span class="bbn-value">{{ bbnResult(game).totalScore }}</span>
                    </div>
                    <div class="bbn-stat">
                      <span class="bbn-label">To Par</span>
                      <span class="bbn-value" :class="balanceClass(bbnResult(game).overallToPar)">
                        {{ formatBalance(bbnResult(game).overallToPar) }}
                      </span>
                    </div>
                    <div class="bbn-stat">
                      <span class="bbn-label">Balls</span>
                      <span class="bbn-value">{{ bbnResult(game).ballsToCount }}</span>
                    </div>
                  </div>
                  <div class="bbn-hcp-toggle">
                    <span class="bbn-toggle-label">HCP mode:</span>
                    <button
                      class="bbn-toggle-btn"
                      :class="{ active: (game.config?.hcpMode ?? 'course') === 'course' }"
                      @click.stop="setBbnHcpMode(game, 'course')"
                    >Course</button>
                    <button
                      class="bbn-toggle-btn"
                      :class="{ active: (game.config?.hcpMode ?? 'course') === 'lowman' }"
                      @click.stop="setBbnHcpMode(game, 'lowman')"
                    >Low Man</button>
                  </div>
                </div>
              </template>

              <!-- Vegas -->
              <template v-else-if="isGameType(game, 'vegas')">
                <div v-if="vegasResult(game)" class="team-standings">
                  <div class="team-row">
                    <span>{{ vegasResult(game).t1Name }}</span>
                    <span :class="balanceClass(vegasResult(game).t1Total)">
                      {{ formatBalance(vegasResult(game).settlement.t1Net) }}
                    </span>
                  </div>
                  <div class="team-row">
                    <span>{{ vegasResult(game).t2Name }}</span>
                    <span :class="balanceClass(-vegasResult(game).t1Total)">
                      {{ formatBalance(-vegasResult(game).settlement.t1Net) }}
                    </span>
                  </div>
                  <div class="game-note">Point diff: {{ vegasResult(game).t1Total }} × ${{ game.config?.ppt || 1 }}/pt</div>
                </div>
              </template>

              <!-- Hi-Low -->
              <template v-else-if="isGameType(game, 'hilow')">
                <div v-if="hilowResult(game)" class="team-standings">
                  <div class="team-row">
                    <span>{{ hilowResult(game).t1Name }}</span>
                    <span class="team-pts">{{ hilowResult(game).t1Pts }} pts</span>
                    <span :class="balanceClass(hilowResult(game).settlement.t1Net)">
                      {{ formatBalance(hilowResult(game).settlement.t1Net) }}
                    </span>
                  </div>
                  <div class="team-row">
                    <span>{{ hilowResult(game).t2Name }}</span>
                    <span class="team-pts">{{ hilowResult(game).t2Pts }} pts</span>
                    <span :class="balanceClass(-hilowResult(game).settlement.t1Net)">
                      {{ formatBalance(-hilowResult(game).settlement.t1Net) }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Stableford -->
              <template v-else-if="isGameType(game, 'stableford')">
                <div v-if="stablefordResult(game)" class="individual-standings">
                  <div v-for="p in stablefordResult(game).ranked" :key="p.id" class="standing-row">
                    <span class="standing-name">{{ p.name }}</span>
                    <span class="standing-pts">{{ p.pts }} pts</span>
                    <span class="standing-value" :class="balanceClass(stablefordSettlement(game, p.id))">
                      {{ formatBalance(stablefordSettlement(game, p.id)) }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Wolf -->
              <template v-else-if="isGameType(game, 'wolf')">
                <!-- Current wolf indicator -->
                <div class="wolf-status-row">
                  <span class="wolf-status-label">H{{ wolfCurrentHole(game) }} Wolf:</span>
                  <span class="wolf-status-name">{{ wolfCurrentName(game) }}</span>
                  <span v-if="wolfChoiceLabel(game, wolfCurrentHole(game))" class="wolf-status-choice">{{ wolfChoiceLabel(game, wolfCurrentHole(game)) }}</span>
                  <span v-else class="wolf-status-pending">picking…</span>
                </div>
                <!-- Per-player standings -->
                <div v-if="wolfResult(game)" class="individual-standings">
                  <div v-for="s in wolfResult(game).settlements" :key="s.id" class="standing-row">
                    <span class="standing-name">{{ s.name }}</span>
                    <span class="standing-value" :class="balanceClass(s.net)">
                      {{ formatBalance(s.net) }}
                    </span>
                  </div>
                </div>
                <!-- Recent hole results -->
                <div v-if="wolfResult(game)?.holeResults?.length" class="wolf-hole-results">
                  <div
                    v-for="hr in wolfResult(game).holeResults.filter(h => !h.incomplete).slice(-4)"
                    :key="hr.hole"
                    class="wolf-hole-chip"
                    :class="hr.winner === 'wolf' ? 'chip-wolf' : hr.winner === 'field' ? 'chip-field' : 'chip-push'"
                  >
                    <span class="chip-hole">H{{ hr.hole }}</span>
                    <span class="chip-result">{{ hr.isBlind ? '🙈' : hr.isLone ? '🐺' : `+${hr.partnerName?.slice(0,3) ?? '?'}` }}{{ hr.winner === 'wolf' ? '✓' : hr.winner === 'field' ? '✗' : '=' }}</span>
                  </div>
                </div>
              </template>

              <!-- Hammer -->
              <template v-else-if="isGameType(game, 'hammer')">
                <div v-if="hammerResult(game)" class="team-standings">
                  <div class="team-row">
                    <span>{{ hammerResult(game).t1Name }}</span>
                    <span :class="balanceClass(hammerResult(game).t1Total)">
                      {{ formatBalance(hammerResult(game).settlement.t1Net) }}
                    </span>
                  </div>
                  <div class="team-row">
                    <span>{{ hammerResult(game).t2Name }}</span>
                    <span :class="balanceClass(-hammerResult(game).t1Total)">
                      {{ formatBalance(-hammerResult(game).settlement.t1Net) }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Sixes -->
              <template v-else-if="isGameType(game, 'sixes')">
                <div v-if="sixesResult(game)" class="individual-standings">
                  <div v-for="s in sixesResult(game).settlements" :key="s.id" class="standing-row">
                    <span class="standing-name">{{ s.name }}</span>
                    <span class="standing-pts">{{ s.pts }} pts</span>
                    <span class="standing-value" :class="balanceClass(s.net)">
                      {{ formatBalance(s.net) }}
                    </span>
                  </div>
                  <div class="pairwise-settlement" v-if="pairwiseLines(sixesResult(game).settlements).length">
                    <div v-for="line in pairwiseLines(sixesResult(game).settlements)" :key="line.from+line.to" class="pairwise-line">
                      <span class="pw-from">{{ line.from }}</span>
                      <span class="pw-arrow">→</span>
                      <span class="pw-to">{{ line.to }}</span>
                      <span class="pw-amount bal-winning">${{ line.amount }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- 5-3-1 -->
              <template v-else-if="isGameType(game, 'fivethreeone') || isGameType(game, 'nines')">
                <div v-if="fiveThreeOneResult(game)" class="individual-standings">
                  <div class="fto-badges" v-if="fiveThreeOneResult(game)?.hasSweep || fiveThreeOneResult(game)?.hasBirdie">
                    <span v-if="fiveThreeOneResult(game)?.hasSweep" class="fto-badge">🧹 Sweep on</span>
                    <span v-if="fiveThreeOneResult(game)?.hasBirdie" class="fto-badge">🐦 Birdie bonus on</span>
                  </div>
                  <div v-for="(s, idx) in [...fiveThreeOneResult(game).settlements].sort((a,b) => b.pts - a.pts)" :key="s.id" class="standing-row">
                    <span class="standing-medal">{{ ['🥇','🥈','🥉'][idx] ?? '' }}</span>
                    <span class="standing-name">{{ s.name }}</span>
                    <span class="standing-pts">{{ s.pts }}pts</span>
                    <span class="standing-value" :class="balanceClass(s.net)">
                      {{ formatBalance(s.net) }}
                    </span>
                    <span class="fto-icons" v-if="fiveThreeOneTallies(fiveThreeOneResult(game))[s.id]">
                      <span v-if="fiveThreeOneTallies(fiveThreeOneResult(game))[s.id]?.sweeps" class="fto-tally">🧹×{{ fiveThreeOneTallies(fiveThreeOneResult(game))[s.id].sweeps }}</span>
                      <span v-if="fiveThreeOneTallies(fiveThreeOneResult(game))[s.id]?.birdies" class="fto-tally">🐦×{{ fiveThreeOneTallies(fiveThreeOneResult(game))[s.id].birdies }}</span>
                    </span>
                  </div>
                  <!-- Pairwise settlement -->
                  <div class="pairwise-settlement" v-if="pairwiseLines(fiveThreeOneResult(game).settlements).length">
                    <div v-for="line in pairwiseLines(fiveThreeOneResult(game).settlements)" :key="line.from+line.to" class="pairwise-line">
                      <span class="pw-from">{{ line.from }}</span>
                      <span class="pw-arrow">→</span>
                      <span class="pw-to">{{ line.to }}</span>
                      <span class="pw-amount bal-winning">${{ line.amount }}</span>
                    </div>
                  </div>
                  <!-- Per-hole sweep/birdie events -->
                  <div class="fto-events" v-if="fiveThreeOneEvents(fiveThreeOneResult(game)).length">
                    <div v-for="ev in fiveThreeOneEvents(fiveThreeOneResult(game))" :key="ev.hole" class="fto-event">
                      <span class="fto-event-hole">H{{ ev.hole }}</span>
                      <span class="fto-event-icon">{{ ev.icon }}</span>
                      <span class="fto-event-name">{{ ev.name }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Generic standings (fallback) -->
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
import { COURSES } from '../modules/courses'
import {
  computeNassau, computeSkins, computeMatch, computeSnake, computeDots, computeFidget,
  computeBestBall, computeBestBallNet, computeVegas, computeHiLow, computeStableford,
  computeWolf, computeHammer, computeSixes, computeFiveThreeOne,
  memberHandicap, memberNetOnHole,
  holePar, holeSI, strokesOnHole, holeRange
} from '../modules/gameEngine'

const roundsStore = useRoundsStore()

// Expanded state
const expandedIds = ref(new Set())
function toggleExpanded(id) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
  expandedIds.value = new Set(expandedIds.value)
}

// Course data
const courseData = computed(() => {
  if (!roundsStore.activeRound) return null
  return COURSES[roundsStore.activeRound.course_name] || null
})

// Game context for engine functions
const gameCtx = computed(() => ({
  scores: roundsStore.activeScores,
  members: roundsStore.activeMembers,
  course: courseData.value,
  tee: roundsStore.activeRound?.tee,
  holesMode: roundsStore.activeRound?.holes_mode || '18',
}))

// Date formatting
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Score helpers
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
  const gross = memberGrossTotal(member)
  if (!gross) return null
  const holesIn = memberHolesPlayed(member)
  if (!holesIn) return null
  const expectedPar = holesIn * 4
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
  if (members.length > 0 && memberGrossTotal(members[0]) > 0) {
    members[0].isLeading = true
  }
  return members
})

// Game type checking
function isGameType(game, type) {
  return game.type?.toLowerCase() === type.toLowerCase()
}

// Game helpers
const GAME_ICONS = {
  nassau: '💰', skins: '💎', wolf: '🐺', vegas: '🎲', match: '⚔️', matchplay: '⚔️',
  bestball: '🤝', stableford: '📊', sixes: '🎯', snake: '🐍', dots: '●',
  junk: '✨', fidget: '🎲', hilow: '📈', hammer: '🔨', teamday: '👥', fivethreeone: '5', nines: '9',
  bbn: '🏌️', match1v1: '1v1', bbb: '🏌️',
}
const GAME_LABELS = {
  nassau: 'Nassau', skins: 'Skins', wolf: 'Wolf', vegas: 'Vegas', match: 'Match Play', matchplay: 'Match Play',
  bestball: 'Best Ball', stableford: 'Stableford', sixes: 'Sixes', snake: 'Snake', dots: 'Dots',
  junk: 'Junk', fidget: 'Fidget', hilow: 'Hi-Low', hammer: 'Hammer', teamday: 'Team Day', fivethreeone: '5-3-1', nines: '9s',
  bbn: 'Best Ball', match1v1: '1v1', bbb: 'BBB',
}
const GAME_STYLE = {
  nassau: 'gold', skins: 'green', wolf: 'purple', vegas: 'blue', match: 'red', matchplay: 'red',
  bestball: 'teal', stableford: 'green', sixes: 'orange', snake: 'purple', dots: 'orange',
  fidget: 'blue', bbn: 'teal', match1v1: 'red', hilow: 'teal', hammer: 'red', fivethreeone: 'orange', nines: 'orange', bbb: 'gold',
}

function gameIcon(type) { return GAME_ICONS[type?.toLowerCase()] || '🏌️' }
function gameLabel(type, config) {
  if (type?.toLowerCase() === 'bbn' && config?.label) return config.label
  if (type?.toLowerCase() === 'match1v1' && config?.player1 && config?.player2) {
    // Find player short names
    const p1 = roundsStore.activeMembers?.find(m => m.id === config.player1)
    const p2 = roundsStore.activeMembers?.find(m => m.id === config.player2)
    if (p1 && p2) return `${p1.short_name || p1.guest_name} v ${p2.short_name || p2.guest_name}`
  }
  return GAME_LABELS[type?.toLowerCase()] || type
}
function gameStyle(type) { return GAME_STYLE[type?.toLowerCase()] || 'default' }

function configSummary(game) {
  const c = game.config || {}
  const t = game.type?.toLowerCase() || ''
  const parts = []
  if (c.front != null && c.back != null) parts.push(`$${c.front}/$${c.back}`)
  else if (t === 'match1v1' || t === 'match') parts.push(c.ppt ? `$${c.ppt} closeout` : '')
  else if (c.ppt != null) parts.push(`$${c.ppt}/pt`)
  if (c.ppp != null) parts.push(`$${c.ppp}/pt`)
  if (c.unit != null) parts.push(`$${c.unit}/unit`)
  if (c.ballsToCount) parts.push(`${c.ballsToCount} ball${c.ballsToCount > 1 ? 's' : ''}`)
  const scoring = c.scoring || c.netGross
  if (scoring === 'gross') parts.push('Gross')
  else parts.push('Net')
  return parts.filter(Boolean).join(' · ')
}

// Nassau
function nassauSegStatus(game, segment) {
  if (!gameCtx.value || !gameCtx.value.course) return { status: '—', balance: 0, leader: '—' }
  const result = computeNassau(gameCtx.value, game.config)
  if (!result) return { status: '—', balance: 0, leader: '—' }

  let seg = null
  if (segment === 'front') seg = result.frontSeg
  else if (segment === 'back') seg = result.backSeg
  else seg = { t1Up: result.overallUp, t1Wins: result.overallT1Wins }

  const t1Names = result.t1Name
  const t2Names = result.t2Name
  const up = seg.t1Up ?? 0
  let status = 'AS'
  if (up > 0) status = `${t1Names} +${up}`
  else if (up < 0) status = `${t2Names} +${Math.abs(up)}`

  return {
    status,
    balance: up,
    leader: up > 0 ? t1Names : up < 0 ? t2Names : 'All Square',
  }
}

function nassauSettlement(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  const result = computeNassau(gameCtx.value, game.config)
  return result?.settlement ?? null
}

// Skins
function skinWinner(game, hole) {
  const members = roundsStore.activeMembers
  const scores = members.map(m => ({ m, s: (roundsStore.activeScores[m.id] || {})[hole] }))
    .filter(x => x.s != null)
  if (!scores.length) return null
  const minScore = Math.min(...scores.map(x => x.s))
  const winners = scores.filter(x => x.s === minScore)
  if (winners.length === 1) return winners[0].m.short_name || winners[0].m.guest_name
  return null
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

// Match Play
function matchPlayResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeMatch(gameCtx.value, game.config) ?? null
}

function matchStatusClass(diff) {
  if (diff > 0) return 'bal-winning'
  if (diff < 0) return 'bal-losing'
  return 'bal-even'
}

// Best Ball
function bestBallResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeBestBall(gameCtx.value, game.config) ?? null
}

// Snake
function snakeResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeSnake(gameCtx.value, game.config) ?? null
}

// Dots
function dotsResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeDots(gameCtx.value, game.config) ?? null
}

// Fidget
function fidgetResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeFidget(gameCtx.value, game.config) ?? null
}

// BBN
function bbnResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeBestBallNet(gameCtx.value, game.config) ?? null
}

async function setBbnHcpMode(game, mode) {
  const newConfig = { ...game.config, hcpMode: mode }
  // Update label to reflect mode
  const balls = newConfig.ballsToCount ?? 1
  const scoring = newConfig.scoring === 'gross' ? 'Gross' : 'Net'
  const suffix = mode === 'lowman' ? ' (LM)' : ''
  newConfig.label = `${balls}BB ${scoring}${suffix}`
  await roundsStore.updateGameConfig(game.id, newConfig)
}

// Vegas
function vegasResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeVegas(gameCtx.value, game.config) ?? null
}

// Hi-Low
function hilowResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeHiLow(gameCtx.value, game.config) ?? null
}

// Stableford
function stablefordResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeStableford(gameCtx.value, game.config) ?? null
}

function stablefordSettlement(game, playerId) {
  const result = stablefordResult(game)
  if (!result) return 0
  const s = result.settlements.find(s => s.id === playerId)
  return s?.net ?? 0
}

// Wolf
function wolfResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeWolf(gameCtx.value, game.config) ?? null
}

function wolfCurrentHole(game) {
  // The "active" hole is the next one not yet complete (holesPlayed + 1), min 1
  const hp = holesPlayed.value
  const mode = roundsStore.activeRound?.holes_mode || '18'
  const from = mode === 'back9' ? 10 : 1
  const to = mode === 'front9' ? 9 : 18
  return Math.min(Math.max(from, hp + 1), to)
}

function wolfCurrentId(game) {
  const members = roundsStore.activeMembers
  if (!members.length) return null
  const order = game.config?.wolfTeeOrder || []
  const teeOrder = order.length >= members.length ? order : members.map(m => m.id)
  const mode = roundsStore.activeRound?.holes_mode || '18'
  const from = mode === 'back9' ? 10 : 1
  const hole = wolfCurrentHole(game)
  return teeOrder[(hole - from) % teeOrder.length] || null
}

function wolfCurrentName(game) {
  const wolfId = wolfCurrentId(game)
  if (!wolfId) return '?'
  const members = roundsStore.activeMembers
  const m = members.find(m => m.id === wolfId)
    || members.find(m => m.profile_id && m.profile_id === wolfId)
  return m?.short_name || m?.guest_name || '?'
}

function wolfChoiceLabel(game, hole) {
  const choice = game.config?.wolfChoices?.[hole]
  if (!choice) return null
  if (choice.partner === 'lone') return '🐺 Lone'
  if (choice.partner === 'blind') return '🙈 Blind'
  const members = roundsStore.activeMembers
  const partner = members.find(m => m.id === choice.partner)
    || members.find(m => m.profile_id === choice.partner)
  return partner ? `+${partner.short_name || partner.guest_name}` : '+?'
}

// Hammer
function hammerResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeHammer(gameCtx.value, game.config) ?? null
}

// Sixes
function sixesResult(game) {
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeSixes(gameCtx.value, game.config) ?? null
}

// 5-3-1
function fiveThreeOneResult(game) {  // also handles 'nines'
  if (!gameCtx.value || !gameCtx.value.course) return null
  return computeFiveThreeOne(gameCtx.value, game.config) ?? null
}

/**
 * Build pairwise settlement lines from a settlements array:
 * [{ id, name, pts, net }] → [{ from, to, amount }]
 * "from pays to $amount" where amount > 0.
 * Shows running settlement (partial rounds included).
 */
function pairwiseLines(settlements) {
  if (!settlements?.length) return []
  const lines = []
  for (let i = 0; i < settlements.length; i++) {
    for (let j = i + 1; j < settlements.length; j++) {
      const a = settlements[i]
      const b = settlements[j]
      const diff = Math.round((a.net - b.net) * 100) / 100
      if (diff === 0) continue
      if (diff > 0) lines.push({ from: b.name, to: a.name, amount: diff })
      else lines.push({ from: a.name, to: b.name, amount: -diff })
    }
  }
  return lines.sort((a, b) => b.amount - a.amount)
}

// Build a name lookup from hole result scores arrays (avoids gameCtx dependency)
function _ftoNameMap(result) {
  const map = {}
  for (const hr of (result?.holeResults ?? [])) {
    if (!hr?.scores) continue
    for (const s of hr.scores) {
      if (s.id && s.name) map[s.id] = s.name
    }
  }
  return map
}

// Returns list of notable events (sweeps, birdie bonuses) from hole results
function fiveThreeOneEvents(result) {
  if (!result?.holeResults) return []
  const names = _ftoNameMap(result)
  const events = []
  for (const hr of result.holeResults) {
    if (!hr || hr.incomplete) continue
    if (hr.sweep) {
      const name = names[hr.sweep] ?? hr.sweep
      events.push({ hole: hr.hole, icon: '🧹', name: `${name} swept` })
    }
    if (hr.birdieBonus) {
      const name = names[hr.birdieBonus] ?? hr.birdieBonus
      events.push({ hole: hr.hole, icon: '🐦', name: `${name} birdie +1` })
    }
  }
  return events
}

// Per-player sweep + birdie bonus counts keyed by player id
function fiveThreeOneTallies(result) {
  const tallies = {}
  if (!result?.holeResults) return tallies
  for (const hr of result.holeResults) {
    if (!hr || hr.incomplete) continue
    if (hr.sweep) {
      tallies[hr.sweep] = tallies[hr.sweep] || { sweeps: 0, birdies: 0 }
      tallies[hr.sweep].sweeps++
    }
    if (hr.birdieBonus) {
      tallies[hr.birdieBonus] = tallies[hr.birdieBonus] || { sweeps: 0, birdies: 0 }
      tallies[hr.birdieBonus].birdies++
    }
  }
  return tallies
}

// Generic per-player standings
function sortedMembersForGame(game) {
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
  if (val > 0) return `+$${val}`
  if (val < 0) return `-$${Math.abs(val)}`
  return '$0'
}

function balanceClass(val) {
  if (!val && val !== 0) return ''
  if (val > 0) return 'bal-winning'
  if (val < 0) return 'bal-losing'
  return 'bal-even'
}
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────── */
.games-view {
  min-height: 100%;
  background: var(--gw-neutral-950);
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
  color: var(--gw-text);
  margin: 0;
  flex: 1;
}

.games-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-library {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-600, #166044);
  color: var(--gw-text-secondary, #a3b8aa);
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.12s;
}
.btn-library:active {
  background: var(--gw-green-700, #114a35);
}

.round-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(212, 175, 55, 0.15);
  color: var(--gw-gold);
  border: 1px solid rgba(212, 175, 55, 0.3);
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
  color: var(--gw-text);
}
.round-date {
  font-size: 13px;
  color: var(--gw-text-muted);
}
.round-code {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--gw-font-mono);
  font-size: 13px;
  color: var(--gw-gold);
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid rgba(212, 175, 55, 0.3);
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
  color: var(--gw-text-muted);
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
  background: var(--gw-card-bg);
  border-radius: var(--gw-radius-lg);
  padding: 12px 10px;
  text-align: center;
  box-shadow: var(--gw-shadow-card);
  border: 2px solid transparent;
  flex-shrink: 0;
  animation: card-in 250ms ease-out both;
}
.player-score-card--leading {
  border-color: var(--gw-gold);
}

.ps-name {
  font-family: var(--gw-font-body);
  font-size: 11px;
  font-weight: 600;
  color: var(--gw-text-muted);
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
  color: var(--gw-text);
}
.ps-thru {
  font-size: 10px;
  color: var(--gw-text-muted);
}
.ps-thru-empty { opacity: .4; }

.score-under   { color: var(--gw-eagle); }
.score-one-under { color: var(--gw-green-500); }
.score-even    { color: var(--gw-neutral-900); }
.score-over    { color: var(--gw-bogey); }
.score-double-over { color: var(--gw-double); }

/* ── Games list ────────────────────────────────────────── */
.games-list { padding: 0 16px; }

.game-card {
  background: var(--gw-card-bg);
  border-radius: var(--gw-radius-lg);
  margin-bottom: 10px;
  box-shadow: var(--gw-shadow-card);
  overflow: hidden;
  border-left: 4px solid rgba(255, 255, 255, 0.15);
  border: 1px solid var(--gw-card-border);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: card-in 250ms ease-out both;
}
.game-card--gold  { border-left-color: var(--gw-eagle); }
.game-card--green { border-left-color: var(--gw-green-500); }
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
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--gw-radius-md);
  flex-shrink: 0;
}
.game-info { flex: 1; min-width: 0; }
.game-name {
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  color: var(--gw-text);
}
.game-config-summary {
  font-family: var(--gw-font-body);
  font-size: 12px;
  color: var(--gw-text-muted);
  margin-top: 2px;
}
.game-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.expand-arrow {
  font-size: 22px;
  color: var(--gw-text-muted);
  transform: rotate(90deg);
  transition: transform .2s;
}
.expand-arrow.expanded { transform: rotate(-90deg); }

/* ── Expanded standings ──────────────────────────────────── */
.standings-divider {
  height: 1px;
  background: var(--gw-card-border);
  margin: 0;
}
.game-standings { padding: 12px 16px 16px; }

/* Nassau grid */
.nassau-grid {
  display: grid;
  grid-template-columns: 70px 1fr 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.nassau-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--gw-text-muted);
  padding: 4px 0;
}
.nassau-cell {
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--gw-text);
  padding: 6px 0;
  border-bottom: 1px solid var(--gw-card-border);
}

.game-settlement {
  padding: 12px 0 0;
  border-top: 1px solid var(--gw-card-border);
}
.settlement-detail {
  padding: 8px 0;
}
.settlement-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}

/* Skins grid */
.skins-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}
.skin-cell {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 6px 4px;
  text-align: center;
}
.skin-cell.skin-won { background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.3); }
.skin-cell.skin-carry { background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.25); }
.skin-cell.skin-pending { background: rgba(255, 255, 255, 0.05); }
.skin-hole {
  font-family: var(--gw-font-mono);
  font-size: 10px;
  color: var(--gw-text-muted);
  font-weight: 700;
}
.skin-winner {
  font-size: 9px;
  font-weight: 600;
  color: var(--gw-gold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 2px 0;
  min-height: 11px;
}
.skin-value {
  font-family: var(--gw-font-mono);
  font-size: 9px;
  color: var(--gw-text-muted);
}
.skins-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 0;
}
.skins-pot {
  font-size: 13px;
  color: var(--gw-text-muted);
}
.skins-pot-amount {
  font-family: var(--gw-font-mono);
  font-weight: 700;
  color: var(--gw-gold);
}
.skins-count { font-size: 12px; color: var(--gw-text-muted); }

/* Match Play */
.match-dormie-badge {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #b45309;
  background: rgba(180,83,9,0.1);
  border-radius: 6px;
  padding: 2px 8px;
  margin-top: 4px;
}
.match-standings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}
.match-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.match-name {
  font-weight: 600;
  color: var(--gw-text);
}
.match-vs {
  text-align: center;
  color: var(--gw-text-muted);
  font-weight: 600;
  font-size: 12px;
}
.match-status {
  font-family: var(--gw-font-mono);
  font-weight: 700;
}

/* Best Ball */
.bestball-standings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}
.team-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--gw-card-border);
}

/* Snake */
.snake-standings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.snake-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--gw-card-border);
}
.snake-name {
  font-weight: 600;
  color: var(--gw-text);
}
.snake-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.snake-holes {
  color: var(--gw-text-muted);
}
.snake-amount {
  font-family: var(--gw-font-mono);
  font-weight: 600;
  color: #ff6b6b;
}
.snake-amount.owes-amount {
  color: var(--gw-double);
}

/* Dots */
.dots-standings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dots-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--gw-card-border);
}
.dots-name {
  font-weight: 600;
  color: var(--gw-text);
}
.dots-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.dots-count {
  color: var(--gw-text-muted);
}
.dots-amount {
  font-family: var(--gw-font-mono);
  font-weight: 600;
}

/* Fidget */
.fidget-standings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fidget-group {
  padding: 8px 0;
}
.fidget-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--gw-text-muted);
  margin-bottom: 6px;
}
.fidget-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--gw-card-border);
}
.fidget-player.winning {
  color: var(--gw-gold);
}
.fidget-name {
  font-weight: 500;
  color: var(--gw-text);
}
.fidget-pot-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  margin: 6px 0 2px;
}
.fidget-2-status {
  font-weight: 400;
  opacity: 0.7;
  text-transform: none;
  letter-spacing: 0;
}
.fidget-divider {
  height: 1px;
  background: var(--color-border, rgba(255,255,255,0.1));
  margin: 8px 0;
}
.fidget-safe {
  font-size: 12px;
  opacity: 0.6;
  padding: 2px 0;
}
.fidget-owes {
  font-size: 12px;
  color: var(--gw-text-muted);
}

/* BBN */
.bbn-standings {
  padding: 12px 0;
}
.bbn-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.bbn-stat {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}
.bbn-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--gw-text-muted);
  text-transform: uppercase;
}
.bbn-value {
  font-family: var(--gw-font-mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--gw-text);
  margin-top: 4px;
}

.bbn-hcp-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.bbn-toggle-label {
  font-size: 11px;
  color: var(--gw-text-muted);
  text-transform: uppercase;
  font-weight: 600;
  margin-right: 4px;
}
.bbn-toggle-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: var(--gw-text-muted);
  cursor: pointer;
}
.bbn-toggle-btn.active {
  background: var(--gw-accent, #c9a227);
  color: #000;
  border-color: var(--gw-accent, #c9a227);
  font-weight: 600;
}

/* Generic standings */
.generic-standings { display: flex; flex-direction: column; gap: 8px; }
.standing-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--gw-card-border);
}
.standing-pos {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--gw-text-muted);
  width: 20px;
}
.standing-name {
  flex: 1;
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-text);
}
.standing-value {
  font-family: var(--gw-font-mono);
  font-size: 16px;
  font-weight: 700;
}
.standing-empty { font-size: 13px; color: var(--gw-text-muted); text-align: center; padding: 12px; }

.bal-winning { color: var(--gw-gold); }
.bal-losing  { color: #ff6b6b; }
.bal-even    { color: var(--gw-text-muted); }

.status-badge {
  display: inline-block;
  font-family: var(--gw-font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--gw-text-muted);
}

/* ── Settlement section ──────────────────────────────────── */
.settlement-section { padding: 0 16px; }
.settlement-card {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.08) 100%);
  border-radius: var(--gw-radius-lg);
  padding: 24px;
  text-align: center;
  color: var(--gw-text);
  animation: card-in 250ms ease-out both;
  margin-bottom: 16px;
  border: 1px solid rgba(212, 175, 55, 0.2);
}
.settlement-icon { font-size: 32px; margin-bottom: 8px; }
.settlement-title {
  font-family: var(--gw-font-display);
  font-size: 20px;
  margin-bottom: 6px;
}
.settlement-sub {
  font-size: 13px;
  color: var(--gw-text-muted);
  margin-bottom: 16px;
  line-height: 1.5;
}
.btn-settlement {
  display: inline-block;
  padding: 12px 24px;
  text-decoration: none;
}

/* ── No games state ────────────────────────────────────── */
.no-games-state {
  margin: 16px;
  background: var(--gw-card-bg);
  border-radius: var(--gw-radius-lg);
  padding: 32px 20px;
  text-align: center;
  box-shadow: var(--gw-shadow-card);
  border: 1px solid var(--gw-card-border);
}
.no-games-icon { font-size: 36px; margin-bottom: 10px; }
.no-games-title {
  font-family: var(--gw-font-body);
  font-size: 17px;
  font-weight: 600;
  color: var(--gw-text);
  margin-bottom: 8px;
}
.no-games-sub {
  font-size: 13px;
  color: var(--gw-text-muted);
  line-height: 1.5;
}

/* ── Empty state ───────────────────────────────────────── */
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
  max-width: 260px;
}

/* ── Shared buttons ────────────────────────────────────── */
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

/* ── New game standings ──────────────────────────────────── */
.team-standings,
.individual-standings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 4px;
}

.standing-pts,
.team-pts {
  font-size: 12px;
  color: var(--gw-text-muted);
  font-family: var(--gw-font-mono);
}

.game-note {
  font-size: 11px;
  color: var(--gw-text-muted);
  padding-top: 6px;
  font-style: italic;
}

/* ── Wolf card extras ───────────────────────────────── */
.wolf-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 8px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 6px;
  font-size: 13px;
}
.wolf-status-label { color: var(--gw-text-muted); font-size: 11px; }
.wolf-status-name  { font-weight: 700; color: #c4b5fd; }
.wolf-status-choice { font-size: 12px; background: rgba(139,92,246,.15); border-radius: 4px; padding: 1px 6px; }
.wolf-status-pending { font-size: 11px; color: var(--gw-text-muted); font-style: italic; }

.wolf-hole-results {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.wolf-hole-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.chip-wolf  { background: rgba(34,197,94,.15);  color: #4ade80; }
.chip-field { background: rgba(239,68,68,.15);   color: #f87171; }
.chip-push  { background: rgba(255,255,255,.07); color: var(--gw-text-muted); }
.chip-hole  { opacity: .65; }
.chip-result { }

.pairwise-settlement {
  margin-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pairwise-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.pw-from {
  color: var(--gw-text-muted);
  min-width: 48px;
}
.pw-arrow {
  color: rgba(255,255,255,0.25);
  font-size: 11px;
}
.pw-to {
  flex: 1;
  color: var(--gw-text);
  font-weight: 600;
}
.pw-amount {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 700;
}

.standing-medal {
  font-size: 14px;
  min-width: 20px;
}
.fto-icons {
  display: flex;
  gap: 4px;
}
.fto-tally {
  font-size: 11px;
  background: rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 1px 6px;
  white-space: nowrap;
}

.fto-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.fto-badge {
  font-size: 11px;
  background: rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 2px 8px;
  color: var(--gw-text-muted);
}
.fto-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.07);
  padding-top: 6px;
}
.fto-event {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--gw-text-muted);
}
.fto-event-hole {
  font-family: var(--gw-font-mono);
  min-width: 26px;
  opacity: 0.6;
}
.fto-event-name { flex: 1; }

/* ── Animations ────────────────────────────────────────── */
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
