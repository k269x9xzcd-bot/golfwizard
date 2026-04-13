<template>
  <div class="tournament-view">

    <!-- Header -->
    <header class="t-header">
      <div class="t-header-top">
        <div class="t-trophy">🏆</div>
        <div class="t-header-text">
          <div class="t-title">{{ editedName || TOURNAMENT.name }}</div>
          <div class="t-subtitle">{{ TOURNAMENT.season }} · {{ editedFormat || TOURNAMENT.format }}</div>
        </div>
        <button class="t-edit-btn" @click="openEdit" title="Edit tournament">✎</button>
      </div>

      <!-- Next match countdown -->
      <div v-if="upcoming" class="next-match-banner">
        <div class="nm-label">NEXT MATCH</div>
        <div class="nm-matchup">
          <span class="nm-team" :style="{ color: getTeam(upcoming.match.team1).color }">{{ teamLabel(upcoming.match.team1) }}</span>
          <span class="nm-vs">vs</span>
          <span class="nm-team" :style="{ color: getTeam(upcoming.match.team2).color }">{{ teamLabel(upcoming.match.team2) }}</span>
          <template v-if="upcoming.match2">
            <span class="nm-sep">·</span>
            <span class="nm-team" :style="{ color: getTeam(upcoming.match2.team1).color }">{{ teamLabel(upcoming.match2.team1) }}</span>
            <span class="nm-vs">vs</span>
            <span class="nm-team" :style="{ color: getTeam(upcoming.match2.team2).color }">{{ teamLabel(upcoming.match2.team2) }}</span>
          </template>
        </div>
        <div class="nm-date">{{ fmtDate(upcoming.round.deadline) }}
          <span class="nm-countdown" :class="countdownClass">{{ countdownLabel }}</span>
        </div>
      </div>
      <div v-else-if="allDone" class="next-match-banner next-match-banner--done">
        <div class="nm-label">SEASON COMPLETE</div>
        <div class="nm-matchup">Top 2 teams advance to the Final 🏆</div>
      </div>
    </header>

    <!-- Tab bar -->
    <div class="t-tabs">
      <button class="t-tab" :class="{ active: tab === 'standings' }" @click="tab = 'standings'">Standings</button>
      <button class="t-tab" :class="{ active: tab === 'schedule' }"  @click="tab = 'schedule'">Schedule</button>
      <button class="t-tab" :class="{ active: tab === 'teams' }"     @click="tab = 'teams'">Teams</button>
      <button class="t-tab" :class="{ active: tab === 'rules' }"     @click="tab = 'rules'">Rules</button>
    </div>

    <!-- ── STANDINGS TAB ─────────────────────────────────────── -->
    <div v-if="tab === 'standings'" class="t-section">

      <!-- Points explanation -->
      <div class="points-key">
        <span class="pk-item"><strong>4 pts</strong> per match</span>
        <span class="pk-sep">·</span>
        <span class="pk-item"><strong>2</strong> best ball</span>
        <span class="pk-sep">·</span>
        <span class="pk-item"><strong>1+1</strong> singles</span>
        <span class="pk-sep">·</span>
        <span class="pk-item">Top 2 → Final</span>
      </div>

      <!-- Standings table -->
      <div class="standings-list">
        <div
          v-for="(row, idx) in standings"
          :key="row.team.id"
          class="standings-row"
          :class="{ 'finalists': idx < 2, 'leader': idx === 0 }"
          :style="{ '--tc': row.team.color, '--tc-dim': row.team.colorDim }"
        >
          <div class="sr-rank">
            <span v-if="idx === 0" class="rank-crown">👑</span>
            <span v-else class="rank-num">{{ idx + 1 }}</span>
          </div>
          <div class="sr-team-color" :style="{ background: row.team.color }"></div>
          <div class="sr-info">
            <div class="sr-name">{{ row.team.name }}</div>
            <div class="sr-players">
              {{ row.team.players.map(p => p.name).join(' & ') }}
            </div>
          </div>
          <div class="sr-stats">
            <div class="sr-record">{{ row.wins }}W · {{ row.losses }}L<span v-if="row.halved"> · {{ row.halved }}T</span></div>
            <div class="sr-played">{{ row.matchesPlayed }} played</div>
          </div>
          <div class="sr-pts-wrap">
            <div class="sr-pts">{{ row.pts % 1 === 0 ? row.pts : row.pts.toFixed(1) }}</div>
            <div class="sr-pts-label">pts</div>
          </div>
          <!-- Finals badge -->
          <div v-if="idx < 2 && standings[0].matchesPlayed > 0" class="finals-badge">FINAL</div>
        </div>
      </div>

      <!-- Head-to-head matrix -->
      <div class="h2h-section">
        <div class="section-title">Head to Head</div>
        <div class="h2h-table-wrap">
          <table class="h2h-table">
            <thead>
              <tr>
                <th class="h2h-corner"></th>
                <th v-for="t in TEAMS" :key="t.id" class="h2h-col-head">
                  <span class="h2h-team-dot" :style="{ background: t.color }"></span>
                  {{ teamLabel(t.id) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rowTeam in TEAMS" :key="rowTeam.id">
                <td class="h2h-row-head">
                  <span class="h2h-team-dot" :style="{ background: rowTeam.color }"></span>
                  {{ teamLabel(rowTeam.id) }}
                </td>
                <td
                  v-for="colTeam in TEAMS"
                  :key="colTeam.id"
                  class="h2h-cell"
                  :class="h2hCellClass(rowTeam.id, colTeam.id)"
                >
                  <span v-if="rowTeam.id === colTeam.id" class="h2h-self">—</span>
                  <span v-else>{{ h2hRecord(rowTeam.id, colTeam.id) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── SCHEDULE TAB ──────────────────────────────────────── -->
    <div v-if="tab === 'schedule'" class="t-section">
      <div
        v-for="round in SCHEDULE"
        :key="round.round"
        class="round-block"
        :class="{ 'round-past': isRoundPast(round), 'round-upcoming': isRoundUpcoming(round), 'round-future': isRoundFuture(round) }"
      >
        <!-- Round header -->
        <div class="round-header">
          <div class="round-label-wrap">
            <span class="round-label">{{ round.label }}</span>
            <span v-if="isRoundUpcoming(round)" class="round-next-pill">NEXT</span>
            <span v-if="isRoundPast(round)" class="round-done-pill">✓</span>
          </div>
          <span class="round-date"><span class="round-date-dl">by</span> {{ fmtDate(round.deadline) }}</span>
        </div>

        <!-- Matches in this round -->
        <div class="round-matches">
          <div
            v-for="match in round.matches"
            :key="match.id"
            class="match-card"
            :class="{ 'match-played': match.result, 'match-pending': !match.result }"
            @click="openMatch(round, match)"
          >
            <div class="mc-teams">
              <div class="mc-team" :style="{ '--tc': getTeam(match.team1).color }">
                <span class="mc-dot" :style="{ background: getTeam(match.team1).color }"></span>
                <span class="mc-team-name">{{ getTeam(match.team1).name }}</span>
              </div>
              <div class="mc-vs-col">
                <span class="mc-vs">vs</span>
              </div>
              <div class="mc-team mc-team--right" :style="{ '--tc': getTeam(match.team2).color }">
                <span class="mc-team-name">{{ getTeam(match.team2).name }}</span>
                <span class="mc-dot" :style="{ background: getTeam(match.team2).color }"></span>
              </div>
            </div>

            <!-- Result summary if played -->
            <div v-if="match.result" class="mc-result">
              <div v-if="match.result.playedDate" class="mc-played-date">Played {{ fmtDate(match.result.playedDate) }}</div>
              <div class="mc-result-row">
                <span class="mc-result-label">Best Ball</span>
                <span class="mc-result-val" :class="resultClass(match, 'bestBall')">
                  {{ bestBallLabel(match) }}
                </span>
              </div>
              <div class="mc-result-row" v-for="(s, si) in (match.result.singles || [])" :key="si">
                <span class="mc-result-label">{{ singlesLabel(match, si) }}</span>
                <span class="mc-result-val" :class="singlesClass(match, s)">
                  {{ singlesWinnerLabel(match, s) }}
                </span>
              </div>
              <div class="mc-pts-row">
                <span class="mc-pts-team" :style="{ color: getTeam(match.team1).color }">
                  {{ teamLabel(match.team1) }} {{ matchPoints(match.result).t1pts }}
                </span>
                <span class="mc-pts-sep">—</span>
                <span class="mc-pts-team" :style="{ color: getTeam(match.team2).color }">
                  {{ matchPoints(match.result).t2pts }} {{ teamLabel(match.team2) }}
                </span>
              </div>
            </div>

            <!-- Pending -->
            <div v-else class="mc-pending">
              <span class="mc-pending-dot"></span>
              <span class="mc-pending-text">Not yet played</span>
              <span class="mc-arrow">›</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Finals teaser -->
      <div class="finals-teaser">
        <div class="ft-icon">🏆</div>
        <div class="ft-text">
          <div class="ft-title">Championship Final</div>
          <div class="ft-sub">18-hole best ball · Top 2 teams advance</div>
        </div>
        <div class="ft-badge" :class="finalistsKnown ? 'ft-badge--set' : 'ft-badge--pending'">
          {{ finalistsKnown ? 'Set' : 'TBD' }}
        </div>
      </div>
    </div>

    <!-- ── TEAMS TAB ─────────────────────────────────────────── -->
    <div v-if="tab === 'teams'" class="t-section">
      <div
        v-for="team in TEAMS"
        :key="team.id"
        class="team-detail-card"
        :style="{ '--tc': team.color, '--tc-dim': team.colorDim }"
      >
        <div class="tdc-header">
          <div class="tdc-color-bar" :style="{ background: team.color }"></div>
          <div class="tdc-name">{{ team.name }}</div>
          <div class="tdc-pts">
            <span class="tdc-pts-num">{{ teamStanding(team.id)?.pts ?? 0 }}</span>
            <span class="tdc-pts-label">pts</span>
          </div>
        </div>
        <div class="tdc-players">
          <div v-for="p in team.players" :key="p.id" class="tdc-player">
            <div class="tdc-player-badge" :style="{ background: team.color + '33', color: team.color }">
              {{ (p.nickname || p.name)[0] }}
            </div>
            <span class="tdc-player-name">{{ p.nickname || p.name }}</span>
          </div>
        </div>
        <!-- Mini schedule for this team -->
        <div class="tdc-schedule">
          <div v-for="{ round, match } in teamMatches(team.id)" :key="match.id" class="tdc-match-row">
            <span class="tdc-match-round">R{{ round.round }}</span>
            <span class="tdc-match-date">{{ fmtDate(round.deadline) }}</span>
            <span class="tdc-match-opp">
              vs
              <span :style="{ color: getTeam(match.team1 === team.id ? match.team2 : match.team1).color }">
                {{ teamLabel(match.team1 === team.id ? match.team2 : match.team1) }}
              </span>
            </span>
            <span class="tdc-match-result" v-if="match.result">
              <span :class="matchResultForTeam(match, team.id)">
                {{ matchScoreForTeam(match, team.id) }}
              </span>
            </span>
            <span v-else class="tdc-match-tbd">—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RULES TAB ──────────────────────────────────────────── -->
    <div v-if="tab === 'rules'" class="t-section rules-section">
      <div class="rule-card">
        <div class="rule-icon">🏆</div>
        <div class="rule-content">
          <div class="rule-title">Tournament Format</div>
          <div class="rule-body">
            Round Robin — each team plays every other team twice (6 rounds total, 2 matches per round). The top 2 teams by points advance to the Championship Final.
          </div>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-icon">⛳</div>
        <div class="rule-content">
          <div class="rule-title">Each Match — 4 Points Total</div>
          <div class="rule-body">
            Every match is worth 4 points:
          </div>
          <div class="rule-breakdown">
            <div class="rb-row">
              <span class="rb-pts">2 pts</span>
              <span class="rb-desc">Best Ball — all 4 players together, team with lower score wins</span>
            </div>
            <div class="rb-row">
              <span class="rb-pts">1 pt</span>
              <span class="rb-desc">Singles Match #1 — one player from each team</span>
            </div>
            <div class="rb-row">
              <span class="rb-pts">1 pt</span>
              <span class="rb-desc">Singles Match #2 — the other player from each team</span>
            </div>
          </div>
          <div class="rule-body" style="margin-top:8px">
            Halved matches split the points (1 each for best ball, 0.5 each for singles).
          </div>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-icon">🔄</div>
        <div class="rule-content">
          <div class="rule-title">Singles Rotation</div>
          <div class="rule-body">
            In the first match between two teams, Player A faces Player A and Player B faces Player B. In the rematch (rounds 4–6), the singles opponents swap — Player A faces Player B and vice versa.
          </div>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-icon">📊</div>
        <div class="rule-content">
          <div class="rule-title">Standings &amp; Tiebreaker</div>
          <div class="rule-body">
            Teams are ranked by total points earned across all matches. In the event of a tie, point differential (points for minus points against) is used as the tiebreaker.
          </div>
        </div>
      </div>

      <div class="rule-card rule-card--gold">
        <div class="rule-icon">🥇</div>
        <div class="rule-content">
          <div class="rule-title">Championship Final</div>
          <div class="rule-body">
            The top 2 teams after all 6 rounds meet in an 18-hole Championship Final — same format: Best Ball + 2 singles matches, 4 points total.
          </div>
        </div>
      </div>
    </div>

    <!-- ── MATCH DETAIL MODAL ────────────────────────────────── -->
    <Teleport to="body">
      <transition name="sheet">
        <div v-if="activeMatch" class="match-modal-backdrop" @click.self="activeMatch = null">
          <div class="match-modal">
            <div class="mm-handle"></div>
            <div class="mm-header">
              <div class="mm-round">{{ activeMatch.round.label }} · {{ fmtDate(activeMatch.round.deadline) }}</div>
              <button class="mm-close" @click="activeMatch = null">✕</button>
            </div>

            <!-- Teams banner -->
            <div class="mm-teams-banner">
              <div class="mm-tb-team" :style="{ color: getTeam(activeMatch.match.team1).color }">
                <div class="mm-tb-name">{{ getTeam(activeMatch.match.team1).name }}</div>
                <div class="mm-tb-players">{{ getTeam(activeMatch.match.team1).players.map(p => p.nickname || p.name).join(' & ') }}</div>
              </div>
              <div class="mm-tb-vs">VS</div>
              <div class="mm-tb-team mm-tb-team--right" :style="{ color: getTeam(activeMatch.match.team2).color }">
                <div class="mm-tb-name">{{ getTeam(activeMatch.match.team2).name }}</div>
                <div class="mm-tb-players">{{ getTeam(activeMatch.match.team2).players.map(p => p.nickname || p.name).join(' & ') }}</div>
              </div>
            </div>

            <!-- Result entry / display -->
            <div class="mm-result-section">
              <div class="mm-section-label">Best Ball (2 pts)</div>
              <div class="mm-result-btns">
                <button
                  v-for="opt in bbOptions(activeMatch.match)"
                  :key="opt.val"
                  class="mm-result-btn"
                  :class="{ selected: editResult.bestBall === opt.val }"
                  :style="opt.color ? { '--btn-color': opt.color } : {}"
                  @click="editResult.bestBall = opt.val"
                >{{ opt.label }}</button>
              </div>

              <div class="mm-section-label">Singles (1 pt each)</div>
              <div v-for="(si, idx) in singlesMatchups(activeMatch.match)" :key="idx" class="mm-singles-row">
                <span class="mm-singles-matchup">
                  <span :style="{ color: getTeam(activeMatch.match.team1).color }">{{ si.p1 }}</span>
                  <span class="mm-s-vs">vs</span>
                  <span :style="{ color: getTeam(activeMatch.match.team2).color }">{{ si.p2 }}</span>
                </span>
                <div class="mm-result-btns mm-result-btns--sm">
                  <button
                    class="mm-result-btn"
                    :class="{ selected: editResult.singles[idx]?.winner === 't1' }"
                    :style="{ '--btn-color': getTeam(activeMatch.match.team1).color }"
                    @click="setSingles(idx, 't1')"
                  >{{ si.p1 }}</button>
                  <button
                    class="mm-result-btn"
                    :class="{ selected: editResult.singles[idx]?.winner === 'halved' }"
                    @click="setSingles(idx, 'halved')"
                  >Halved</button>
                  <button
                    class="mm-result-btn"
                    :class="{ selected: editResult.singles[idx]?.winner === 't2' }"
                    :style="{ '--btn-color': getTeam(activeMatch.match.team2).color }"
                    @click="setSingles(idx, 't2')"
                  >{{ si.p2 }}</button>
                </div>
              </div>

              <!-- Played date -->
              <div class="mm-section-label">Date Played</div>
              <input
                v-model="editResult.playedDate"
                type="date"
                class="mm-date-input"
              />

              <!-- Points preview -->
              <div v-if="editResultReady" class="mm-pts-preview">
                <div class="mm-pts-team" :style="{ color: getTeam(activeMatch.match.team1).color }">
                  <span class="mm-pts-num">{{ editPoints.t1pts }}</span>
                  <span class="mm-pts-lbl">{{ teamLabel(activeMatch.match.team1) }}</span>
                </div>
                <div class="mm-pts-dash">—</div>
                <div class="mm-pts-team" :style="{ color: getTeam(activeMatch.match.team2).color }">
                  <span class="mm-pts-lbl">{{ teamLabel(activeMatch.match.team2) }}</span>
                  <span class="mm-pts-num">{{ editPoints.t2pts }}</span>
                </div>
              </div>
            </div>

            <!-- Launch round wizard button -->
            <div class="mm-launch-wrap">
              <button class="mm-btn-launch" @click="launchRound">
                <span class="mm-launch-icon">⛳</span>
                Start Round in Wizard
              </button>
              <div class="mm-launch-hint">Pre-fills Best Ball + 2 Singles with tournament players</div>
            </div>

            <div class="mm-footer">
              <button class="mm-btn-cancel" @click="activeMatch = null">Cancel</button>
              <button
                class="mm-btn-save"
                :disabled="!editResultReady"
                @click="saveResult"
              >Save Result</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ── EDIT TOURNAMENT MODAL ──────────────────────────────── -->
    <Teleport to="body">
      <transition name="sheet">
        <div v-if="showEditModal" class="match-modal-backdrop" @click.self="showEditModal = false">
          <div class="match-modal">
            <div class="mm-handle"></div>
            <div class="mm-header">
              <div class="mm-round">Edit Tournament</div>
              <button class="mm-close" @click="showEditModal = false">✕</button>
            </div>
            <div class="mm-result-section">
              <div class="field-group-edit">
                <label class="mm-section-label">Tournament Name</label>
                <input v-model="editModalName" class="mm-text-input" placeholder="e.g. 2025 Match Play Championship" />
              </div>
              <div class="field-group-edit">
                <label class="mm-section-label">Format</label>
                <input v-model="editModalFormat" class="mm-text-input" placeholder="e.g. Round Robin" />
              </div>
            </div>
            <div class="mm-footer">
              <button class="mm-btn-cancel" @click="showEditModal = false">Cancel</button>
              <button class="mm-btn-save" @click="saveEdit">Save</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  TOURNAMENT, TEAMS, SCHEDULE,
  getTeam, matchPoints, computeStandings, teamMatches,
  nextMatch, fmtDate, daysUntil,
} from '../stores/tournament.js'

const router = useRouter()
const tab = ref('standings')

// ── Tournament name/format override (persisted to localStorage) ─
const EDIT_KEY = 'gw_tournament_meta_2025'
const savedMeta = (() => { try { return JSON.parse(localStorage.getItem(EDIT_KEY) || '{}') } catch { return {} } })()
const editedName = ref(savedMeta.name || '')
const editedFormat = ref(savedMeta.format || '')

// Edit modal
const showEditModal = ref(false)
const editModalName = ref('')
const editModalFormat = ref('')

function openEdit() {
  editModalName.value = editedName.value || TOURNAMENT.name
  editModalFormat.value = editedFormat.value || TOURNAMENT.format
  showEditModal.value = true
}

function saveEdit() {
  editedName.value = editModalName.value.trim()
  editedFormat.value = editModalFormat.value.trim()
  localStorage.setItem(EDIT_KEY, JSON.stringify({ name: editedName.value, format: editedFormat.value }))
  showEditModal.value = false
}

// ── teamLabel: "Spiels+Matt" style using player nicknames ──────
function teamLabel(teamId) {
  const team = getTeam(teamId)
  if (!team) return ''
  return team.players.map(p => p.nickname || p.name.split(' ')[0]).join('+')
}

// ── Standings ───────────────────────────────────────────────────
const standings = computed(() => computeStandings())

function teamStanding(teamId) {
  return standings.value.find(s => s.team.id === teamId)
}

const allDone = computed(() =>
  SCHEDULE.every(r => r.matches.every(m => m.result))
)

const finalistsKnown = computed(() =>
  standings.value[0]?.matchesPlayed > 0 &&
  SCHEDULE.filter(r => r.matches.some(m => m.result)).length >= 4
)

// ── Next match / countdown ──────────────────────────────────────
const upcoming = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  for (const round of SCHEDULE) {
    const unplayed = round.matches.filter(m => !m.result)
    if (unplayed.length && round.deadline >= today) {
      return { round, match: unplayed[0], match2: unplayed[1] || null }
    }
  }
  return null
})

const otherUpcoming = computed(() => {
  if (!upcoming.value?.match2) return null
  return upcoming.value.match2
})

const countdownLabel = computed(() => {
  if (!upcoming.value) return ''
  const d = daysUntil(upcoming.value.round.deadline)
  if (d < 0) return 'Overdue'
  if (d === 0) return 'Today!'
  if (d === 1) return 'Tomorrow'
  return `${d}d away`
})

const countdownClass = computed(() => {
  if (!upcoming.value) return ''
  const d = daysUntil(upcoming.value.round.deadline)
  if (d <= 0) return 'countdown--urgent'
  if (d <= 7) return 'countdown--soon'
  return ''
})

// ── Round status helpers ────────────────────────────────────────
function isRoundPast(round) {
  return round.matches.every(m => m.result)
}
function isRoundUpcoming(round) {
  const today = new Date().toISOString().slice(0, 10)
  return !isRoundPast(round) && round.deadline >= today &&
    SCHEDULE.filter(r => !r.matches.every(m => m.result) && r.deadline <= today).length === 0
}
function isRoundFuture(round) {
  return !isRoundPast(round) && !isRoundUpcoming(round)
}

// ── H2H matrix ──────────────────────────────────────────────────
function h2hRecord(t1, t2) {
  let t1pts = 0, t2pts = 0, played = 0
  for (const round of SCHEDULE) {
    for (const match of round.matches) {
      if (!match.result) continue
      let pts
      if (match.team1 === t1 && match.team2 === t2) {
        pts = matchPoints(match.result); t1pts += pts.t1pts; t2pts += pts.t2pts; played++
      } else if (match.team1 === t2 && match.team2 === t1) {
        pts = matchPoints(match.result); t1pts += pts.t2pts; t2pts += pts.t1pts; played++
      }
    }
  }
  if (!played) return '—'
  const t1d = t1pts % 1 === 0 ? t1pts : t1pts.toFixed(1)
  const t2d = t2pts % 1 === 0 ? t2pts : t2pts.toFixed(1)
  return `${t1d}-${t2d}`
}

function h2hCellClass(t1, t2) {
  if (t1 === t2) return 'h2h-cell--self'
  const rec = h2hRecord(t1, t2)
  if (rec === '—') return 'h2h-cell--empty'
  const [a, b] = rec.split('-').map(Number)
  if (a > b) return 'h2h-cell--win'
  if (b > a) return 'h2h-cell--loss'
  return 'h2h-cell--halved'
}

// ── Team detail helpers ─────────────────────────────────────────
function matchResultForTeam(match, teamId) {
  const isT1 = match.team1 === teamId
  const { t1pts, t2pts } = matchPoints(match.result)
  const myPts = isT1 ? t1pts : t2pts
  const theirPts = isT1 ? t2pts : t1pts
  if (myPts > theirPts) return 'result-win'
  if (theirPts > myPts) return 'result-loss'
  return 'result-halved'
}
function matchScoreForTeam(match, teamId) {
  const isT1 = match.team1 === teamId
  const { t1pts, t2pts } = matchPoints(match.result)
  const myPts = isT1 ? t1pts : t2pts
  const theirPts = isT1 ? t2pts : t1pts
  const fmt = n => n % 1 === 0 ? n : n.toFixed(1)
  return `${fmt(myPts)}–${fmt(theirPts)}`
}

// ── Match card display ──────────────────────────────────────────
function bestBallLabel(match) {
  if (!match.result) return ''
  if (match.result.bestBall === 'halved') return 'Halved'
  const winner = match.result.bestBall === 't1' ? match.team1 : match.team2
  return teamLabel(winner) + ' win'
}
function resultClass(match, field) {
  if (field === 'bestBall') {
    if (match.result?.bestBall === 'halved') return 'rc-halved'
  }
  return ''
}
function singlesLabel(match, idx) {
  const mu = singlesMatchups(match)
  return mu[idx] ? `${mu[idx].p1} vs ${mu[idx].p2}` : `Singles ${idx + 1}`
}
function singlesClass(match, s) {
  if (s.winner === 'halved') return 'rc-halved'
  return ''
}
function singlesWinnerLabel(match, s) {
  if (s.winner === 'halved') return 'Halved'
  const teamId = s.winner === 't1' ? match.team1 : match.team2
  return teamLabel(teamId) + ' win'
}

// Singles matchup builder
function singlesMatchups(match) {
  const t1 = getTeam(match.team1)
  const t2 = getTeam(match.team2)
  const order = match.singlesOrder || 0
  return [
    { p1: t1.players[order === 0 ? 0 : 1].nickname || t1.players[order === 0 ? 0 : 1].name, p2: t2.players[order === 0 ? 0 : 1].nickname || t2.players[order === 0 ? 0 : 1].name },
    { p1: t1.players[order === 0 ? 1 : 0].nickname || t1.players[order === 0 ? 1 : 0].name, p2: t2.players[order === 0 ? 1 : 0].nickname || t2.players[order === 0 ? 1 : 0].name },
  ]
}

// ── Match modal ─────────────────────────────────────────────────
const activeMatch = ref(null)
const editResult = reactive({ bestBall: null, singles: [], playedDate: '' })

function openMatch(round, match) {
  activeMatch.value = { round, match }
  // Pre-fill if result exists
  if (match.result) {
    editResult.bestBall = match.result.bestBall
    editResult.singles = (match.result.singles || []).map(s => ({ ...s }))
    editResult.playedDate = match.result.playedDate || ''
  } else {
    editResult.bestBall = null
    editResult.singles = [null, null]
    editResult.playedDate = new Date().toISOString().slice(0, 10)
  }
}

function bbOptions(match) {
  const t1 = getTeam(match.team1)
  const t2 = getTeam(match.team2)
  return [
    { val: 't1',     label: teamLabel(match.team1) + ' win', color: t1.color },
    { val: 'halved', label: 'Halved',                        color: null },
    { val: 't2',     label: teamLabel(match.team2) + ' win', color: t2.color },
  ]
}

function setSingles(idx, winner) {
  editResult.singles[idx] = { winner }
}

const editResultReady = computed(() =>
  editResult.bestBall !== null &&
  editResult.singles.length === 2 &&
  editResult.singles[0]?.winner &&
  editResult.singles[1]?.winner
)

const editPoints = computed(() => {
  if (!editResultReady.value) return { t1pts: 0, t2pts: 0 }
  return matchPoints({
    bestBall: editResult.bestBall,
    singles: editResult.singles,
  })
})

function saveResult() {
  if (!activeMatch.value || !editResultReady.value) return
  const match = activeMatch.value.match
  match.result = {
    bestBall: editResult.bestBall,
    singles: editResult.singles.map(s => ({ ...s })),
    playedDate: editResult.playedDate || new Date().toISOString().slice(0, 10),
  }
  activeMatch.value = null
  // Persist to localStorage so results survive refresh
  _saveResults()
}

// Launch round wizard pre-configured for this match
function launchRound() {
  if (!activeMatch.value) return
  const match = activeMatch.value.match
  const t1 = getTeam(match.team1)
  const t2 = getTeam(match.team2)
  // Build player list: team1 players first, then team2
  const allPlayers = [...t1.players, ...t2.players]
  const playerIds = allPlayers.map(p => p.id)
  // Encode match config into query params for the wizard to pick up
  const params = new URLSearchParams({
    tournament: '1',
    matchId: match.id,
    t1players: t1.players.map(p => p.email || p.id).join(','),
    t2players: t2.players.map(p => p.email || p.id).join(','),
  })
  activeMatch.value = null
  // Navigate home and trigger wizard (store config in sessionStorage for wizard to read)
  sessionStorage.setItem('gw_wizard_tournament_prefill', JSON.stringify({
    matchId: match.id,
    team1Id: match.team1,
    team2Id: match.team2,
    team1Name: t1.name,
    team2Name: t2.name,
    team1Players: t1.players.map(p => ({ id: p.id, name: p.name, nickname: p.nickname, email: p.email })),
    team2Players: t2.players.map(p => ({ id: p.id, name: p.name, nickname: p.nickname, email: p.email })),
    games: ['best_ball', 'singles', 'singles'],
  }))
  router.push({ path: '/', query: { launchWizard: '1' } })
}

// Persist/restore match results to localStorage
const RESULTS_KEY = 'gw_tournament_results_2025'

function _saveResults() {
  const saved = {}
  for (const round of SCHEDULE) {
    for (const match of round.matches) {
      if (match.result) saved[match.id] = match.result
    }
  }
  localStorage.setItem(RESULTS_KEY, JSON.stringify(saved))
}

function _loadResults() {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    for (const round of SCHEDULE) {
      for (const match of round.matches) {
        if (saved[match.id]) match.result = saved[match.id]
      }
    }
  } catch (e) { /* ignore */ }
}

// Load results on mount
_loadResults()
</script>

<style scoped>
.tournament-view {
  padding: 0 0 100px;
  min-height: 100vh;
  background: var(--gw-bg, #0c150e);
}

/* ── Header ─────────────────────────────────────────────── */
.t-header {
  padding: 20px 16px 0;
  background: linear-gradient(180deg, rgba(22,96,68,.25) 0%, transparent 100%);
}
.t-header-top {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 16px;
}
.t-trophy { font-size: 32px; line-height: 1; }
.t-header-text { flex: 1; }
.t-title {
  font-family: var(--gw-font-display, Georgia, serif);
  font-size: 20px; font-weight: 700; color: #f0ede0;
  line-height: 1.2;
}
.t-subtitle { font-size: 12px; color: rgba(240,237,224,.5); margin-top: 2px; }

/* Next match banner */
.next-match-banner {
  background: rgba(26,122,85,.15);
  border: 1px solid rgba(26,122,85,.3);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.next-match-banner--done {
  background: rgba(212,175,55,.1);
  border-color: rgba(212,175,55,.3);
}
.nm-label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  color: #22a06b; margin-bottom: 6px;
}
.nm-matchup {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 14px; font-weight: 700;
}
.nm-team { font-weight: 800; }
.nm-vs { color: rgba(240,237,224,.4); font-size: 11px; }
.nm-sep { color: rgba(240,237,224,.25); }
.nm-date { font-size: 12px; color: rgba(240,237,224,.6); margin-top: 5px; }
.nm-countdown {
  margin-left: 8px; font-weight: 700;
  color: rgba(240,237,224,.5);
}
.nm-countdown.countdown--soon { color: #fbbf24; }
.nm-countdown.countdown--urgent { color: #f87171; }

/* ── Tabs ───────────────────────────────────────────────── */
.t-tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid rgba(255,255,255,.08);
  padding: 0 16px;
  margin-bottom: 4px;
}
.t-tab {
  flex: 1; background: none; border: none; cursor: pointer;
  padding: 12px 0; font-size: 13px; font-weight: 600;
  color: rgba(240,237,224,.45); letter-spacing: .03em;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
}
.t-tab.active {
  color: #22a06b;
  border-bottom-color: #22a06b;
}

.t-section { padding: 12px 16px; }

/* ── Points key ─────────────────────────────────────────── */
.points-key {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 11px; color: rgba(240,237,224,.5);
  padding: 8px 12px;
  background: rgba(255,255,255,.03);
  border-radius: 10px;
  margin-bottom: 14px;
}
.points-key strong { color: #f0ede0; }
.pk-sep { color: rgba(240,237,224,.2); }

/* ── Standings ──────────────────────────────────────────── */
.standings-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }

.standings-row {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 12px 14px;
  position: relative;
  overflow: hidden;
  animation: card-in 300ms ease-out both;
  transition: border-color .2s;
}
.standings-row.finalists {
  background: rgba(var(--tc-dim, rgba(255,255,255,.06)));
  border-color: color-mix(in srgb, var(--tc) 25%, transparent);
}
.standings-row.leader {
  border-color: color-mix(in srgb, var(--tc) 45%, transparent);
}

.sr-rank { width: 24px; text-align: center; flex-shrink: 0; }
.rank-crown { font-size: 18px; }
.rank-num { font-size: 16px; font-weight: 700; color: rgba(240,237,224,.4); }

.sr-team-color {
  width: 4px; height: 36px; border-radius: 2px; flex-shrink: 0;
}

.sr-info { flex: 1; min-width: 0; }
.sr-name { font-size: 15px; font-weight: 700; color: #f0ede0; }
.sr-players { font-size: 11px; color: rgba(240,237,224,.5); margin-top: 1px; }

.sr-stats { text-align: right; flex-shrink: 0; }
.sr-record { font-size: 11px; font-weight: 600; color: rgba(240,237,224,.6); }
.sr-played { font-size: 10px; color: rgba(240,237,224,.35); margin-top: 1px; }

.sr-pts-wrap { text-align: center; flex-shrink: 0; min-width: 44px; }
.sr-pts {
  font-family: var(--gw-font-mono, monospace);
  font-size: 26px; font-weight: 900;
  color: var(--tc, #f0ede0);
  line-height: 1;
}
.sr-pts-label { font-size: 10px; color: rgba(240,237,224,.4); margin-top: 1px; }

.finals-badge {
  position: absolute; top: 6px; right: 6px;
  font-size: 8px; font-weight: 800; letter-spacing: .1em;
  color: #fbbf24; background: rgba(251,191,36,.15);
  border: 1px solid rgba(251,191,36,.3);
  padding: 2px 6px; border-radius: 6px;
}

/* ── H2H ────────────────────────────────────────────────── */
.h2h-section { margin-top: 8px; }
.section-title {
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(240,237,224,.45);
  margin-bottom: 10px;
}
.h2h-table-wrap { overflow-x: auto; }
.h2h-table {
  width: 100%; border-collapse: collapse;
  font-size: 12px;
}
.h2h-corner, .h2h-col-head, .h2h-row-head {
  padding: 6px 8px; text-align: center;
  font-weight: 700; color: rgba(240,237,224,.6);
}
.h2h-col-head, .h2h-row-head {
  white-space: nowrap; font-size: 11px;
}
.h2h-team-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; margin-right: 4px; vertical-align: middle;
}
.h2h-cell {
  padding: 6px 8px; text-align: center;
  border: 1px solid rgba(255,255,255,.05);
  font-weight: 700; font-size: 12px;
  color: rgba(240,237,224,.5);
}
.h2h-cell--self { color: rgba(240,237,224,.2); }
.h2h-cell--win   { color: #34d399; background: rgba(52,211,153,.08); }
.h2h-cell--loss  { color: #f87171; background: rgba(248,113,113,.08); }
.h2h-cell--halved { color: #fbbf24; background: rgba(251,191,36,.06); }
.h2h-cell--empty { color: rgba(240,237,224,.2); }

/* ── Schedule ───────────────────────────────────────────── */
.round-block { margin-bottom: 20px; }

.round-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.round-label-wrap { display: flex; align-items: center; gap: 8px; }
.round-label {
  font-size: 12px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: rgba(240,237,224,.7);
}
.round-next-pill {
  font-size: 9px; font-weight: 800; letter-spacing: .1em;
  color: #22a06b; background: rgba(34,160,107,.15);
  border: 1px solid rgba(34,160,107,.3);
  padding: 2px 7px; border-radius: 99px;
}
.round-done-pill {
  font-size: 10px; font-weight: 700;
  color: rgba(240,237,224,.3);
}
.round-date { font-size: 12px; color: rgba(240,237,224,.4); }

.round-past .round-label { color: rgba(240,237,224,.4); }

.round-matches { display: flex; flex-direction: column; gap: 8px; }

.match-card {
  background: #1e2b22;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 14px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color .15s;
  animation: card-in 250ms ease-out both;
}
.match-card.match-played { border-color: rgba(34,160,107,.2); }
.match-card:active { transform: scale(.99); }

.mc-teams {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px;
}
.mc-team { display: flex; align-items: center; gap: 6px; flex: 1; }
.mc-team--right { justify-content: flex-end; }
.mc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.mc-team-name { font-size: 13px; font-weight: 700; color: #f0ede0; }
.mc-vs-col { text-align: center; }
.mc-vs { font-size: 11px; color: rgba(240,237,224,.35); font-weight: 700; }

.mc-result { display: flex; flex-direction: column; gap: 4px; }
.mc-played-date { font-size: 10px; color: rgba(240,237,224,.4); margin-bottom: 6px; }
.mc-result-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px;
}
.mc-result-label { color: rgba(240,237,224,.5); }
.mc-result-val { font-weight: 700; color: #f0ede0; }
.mc-result-val.rc-halved { color: #fbbf24; }

.mc-pts-row {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,.06);
  font-size: 15px; font-weight: 800;
}
.mc-pts-team {}
.mc-pts-sep { color: rgba(240,237,224,.3); }

.mc-pending {
  display: flex; align-items: center; gap: 8px;
  color: rgba(240,237,224,.35); font-size: 12px;
}
.mc-pending-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(240,237,224,.2);
}
.mc-pending-text { flex: 1; }
.mc-arrow { font-size: 16px; color: rgba(240,237,224,.2); }

/* Finals teaser */
.finals-teaser {
  display: flex; align-items: center; gap: 12px;
  background: rgba(212,175,55,.07);
  border: 1px solid rgba(212,175,55,.2);
  border-radius: 14px;
  padding: 16px;
  margin-top: 8px;
}
.ft-icon { font-size: 28px; }
.ft-text { flex: 1; }
.ft-title { font-size: 15px; font-weight: 700; color: #d4af37; }
.ft-sub { font-size: 11px; color: rgba(240,237,224,.5); margin-top: 2px; }
.ft-badge {
  font-size: 11px; font-weight: 800;
  padding: 4px 10px; border-radius: 20px;
}
.ft-badge--pending {
  background: rgba(255,255,255,.07); color: rgba(240,237,224,.4);
}
.ft-badge--set {
  background: rgba(212,175,55,.2); color: #d4af37;
  border: 1px solid rgba(212,175,55,.4);
}

/* ── Teams tab ──────────────────────────────────────────── */
.team-detail-card {
  background: #1e2b22;
  border: 1px solid rgba(255,255,255,.08);
  border-left: 3px solid var(--tc);
  border-radius: 14px;
  margin-bottom: 12px;
  overflow: hidden;
  animation: card-in 280ms ease-out both;
}
.tdc-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 14px 10px;
  background: var(--tc-dim);
}
.tdc-color-bar {
  width: 4px; height: 32px; border-radius: 2px; flex-shrink: 0;
}
.tdc-name { flex: 1; font-size: 16px; font-weight: 700; color: #f0ede0; }
.tdc-pts { text-align: right; }
.tdc-pts-num {
  font-family: var(--gw-font-mono, monospace);
  font-size: 24px; font-weight: 900; color: var(--tc);
  line-height: 1;
}
.tdc-pts-label { font-size: 10px; color: rgba(240,237,224,.4); }

.tdc-players {
  display: flex; gap: 10px; padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.tdc-player { display: flex; align-items: center; gap: 8px; }
.tdc-player-badge {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800;
}
.tdc-player-name { font-size: 14px; font-weight: 600; color: #f0ede0; }

.tdc-schedule { padding: 8px 14px 12px; }
.tdc-match-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255,255,255,.04);
  font-size: 12px;
}
.tdc-match-row:last-child { border-bottom: none; }
.tdc-match-round { font-weight: 700; color: rgba(240,237,224,.4); width: 20px; }
.tdc-match-date { color: rgba(240,237,224,.5); flex: 1; }
.tdc-match-opp { font-weight: 600; color: #f0ede0; }
.tdc-match-result { margin-left: auto; font-weight: 700; }
.tdc-match-tbd { margin-left: auto; color: rgba(240,237,224,.25); }
.result-win   { color: #34d399; }
.result-loss  { color: #f87171; }
.result-halved { color: #fbbf24; }

/* ── Match modal ────────────────────────────────────────── */
.match-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  z-index: 500; display: flex; align-items: flex-end;
}
.match-modal {
  width: 100%;
  background: #111a14;
  border-radius: 22px 22px 0 0;
  border: 1px solid rgba(255,255,255,.1);
  border-bottom: none;
  max-height: 90vh;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
.mm-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.2);
  margin: 12px auto 0;
}
.mm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 8px;
}
.mm-round { font-size: 12px; font-weight: 700; color: rgba(240,237,224,.5); letter-spacing: .05em; }
.mm-close { background: none; border: none; font-size: 18px; color: rgba(240,237,224,.5); cursor: pointer; padding: 4px 8px; }

.mm-teams-banner {
  display: flex; align-items: stretch;
  padding: 16px 16px;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.mm-tb-team { flex: 1; }
.mm-tb-team--right { text-align: right; }
.mm-tb-name { font-size: 15px; font-weight: 800; margin-bottom: 2px; }
.mm-tb-players { font-size: 11px; color: rgba(240,237,224,.5); }
.mm-tb-vs {
  font-size: 12px; font-weight: 700;
  color: rgba(240,237,224,.3);
  align-self: center; flex-shrink: 0;
}

.mm-result-section { padding: 14px 16px; }
.mm-section-label {
  font-size: 11px; font-weight: 700; letter-spacing: .07em;
  text-transform: uppercase; color: rgba(240,237,224,.45);
  margin-bottom: 10px; margin-top: 14px;
}
.mm-section-label:first-child { margin-top: 0; }

.mm-result-btns {
  display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;
}
.mm-result-btns--sm { gap: 6px; }

.mm-result-btn {
  flex: 1; min-width: 70px;
  padding: 10px 8px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  font-size: 13px; font-weight: 600;
  color: rgba(240,237,224,.7);
  cursor: pointer; transition: all .15s;
  -webkit-tap-highlight-color: transparent;
}
.mm-result-btn.selected {
  background: color-mix(in srgb, var(--btn-color, #22a06b) 20%, transparent);
  border-color: var(--btn-color, #22a06b);
  color: var(--btn-color, #22a06b);
  font-weight: 800;
}

.mm-singles-row {
  margin-bottom: 12px;
}
.mm-singles-matchup {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700;
  margin-bottom: 8px;
}
.mm-s-vs { color: rgba(240,237,224,.35); font-size: 11px; }

/* Points preview */
.mm-pts-preview {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 16px;
  padding: 14px;
  background: rgba(255,255,255,.04);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
}
.mm-pts-team { display: flex; align-items: baseline; gap: 6px; }
.mm-pts-num {
  font-family: var(--gw-font-mono, monospace);
  font-size: 36px; font-weight: 900; line-height: 1;
}
.mm-pts-lbl { font-size: 13px; font-weight: 700; }
.mm-pts-dash { font-size: 20px; color: rgba(240,237,224,.3); }

.mm-footer {
  display: flex; gap: 10px;
  padding: 12px 16px 8px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.mm-btn-cancel, .mm-btn-save {
  flex: 1; padding: 14px;
  border-radius: 12px; font-size: 15px; font-weight: 700;
  cursor: pointer; border: none;
  transition: all .15s;
}
.mm-btn-cancel {
  background: rgba(255,255,255,.06);
  color: rgba(240,237,224,.6);
}
.mm-btn-save {
  background: #22a06b; color: white;
}
.mm-btn-save:disabled {
  background: rgba(34,160,107,.3); color: rgba(240,237,224,.4); cursor: default;
}
.mm-btn-save:not(:disabled):active { background: #1a7a55; }

/* Sheet transition */
.sheet-enter-active, .sheet-leave-active { transition: all .3s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .match-modal, .sheet-leave-to .match-modal { transform: translateY(100%); }

.mm-date-input {
  width: 100%; padding: 12px 14px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 10px;
  color: #f0ede0; font-size: 15px;
  margin-bottom: 4px;
  -webkit-appearance: none;
}
.round-date-dl { color: rgba(240,237,224,.3); margin-right: 2px; font-weight: 400; }

/* ── Edit button ─────────────────────────────────────── */
.t-edit-btn {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  color: rgba(240,237,224,.5);
  font-size: 16px;
  padding: 6px 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s, color .15s;
}
.t-edit-btn:active { background: rgba(255,255,255,.1); color: #f0ede0; }

/* ── Edit modal fields ───────────────────────────────── */
.field-group-edit { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
.mm-text-input {
  width: 100%; padding: 12px 14px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 10px;
  color: #f0ede0; font-size: 15px;
  -webkit-appearance: none;
  box-sizing: border-box;
}
.mm-text-input:focus { outline: none; border-color: rgba(34,160,107,.5); }

/* ── Launch round button ─────────────────────────────── */
.mm-launch-wrap {
  padding: 12px 16px 0;
}
.mm-btn-launch {
  width: 100%;
  padding: 13px 16px;
  background: linear-gradient(135deg, rgba(26,122,85,.3) 0%, rgba(22,96,68,.2) 100%);
  border: 1px solid rgba(26,122,85,.4);
  border-radius: 12px;
  color: #34d399;
  font-size: 14px; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: background .15s;
  -webkit-tap-highlight-color: transparent;
}
.mm-btn-launch:active { background: rgba(26,122,85,.4); }
.mm-launch-icon { font-size: 18px; }
.mm-launch-hint {
  font-size: 11px; color: rgba(240,237,224,.35);
  text-align: center; margin-top: 6px;
}

/* ── Rules tab ───────────────────────────────────────── */
.rules-section { display: flex; flex-direction: column; gap: 10px; }
.rule-card {
  display: flex; gap: 14px;
  background: #1e2b22;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 16px;
  animation: card-in 250ms ease-out both;
}
.rule-card--gold {
  background: rgba(212,175,55,.06);
  border-color: rgba(212,175,55,.2);
}
.rule-icon { font-size: 24px; flex-shrink: 0; line-height: 1; margin-top: 1px; }
.rule-content { flex: 1; }
.rule-title {
  font-size: 14px; font-weight: 700; color: #f0ede0;
  margin-bottom: 6px;
}
.rule-body {
  font-size: 13px; color: rgba(240,237,224,.6); line-height: 1.55;
}
.rule-breakdown { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.rb-row { display: flex; align-items: baseline; gap: 10px; }
.rb-pts {
  font-size: 13px; font-weight: 800; color: #fbbf24;
  background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.2);
  padding: 2px 8px; border-radius: 6px; white-space: nowrap; flex-shrink: 0;
}
.rb-desc { font-size: 12px; color: rgba(240,237,224,.55); line-height: 1.4; }

@keyframes card-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
