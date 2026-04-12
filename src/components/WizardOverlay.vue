<template>
  <div class="modal-overlay wizard-overlay">
    <div class="modal wizard-modal">
      <div class="wizard-header">
        <button class="modal-close" @click="$emit('close')">✕</button>
        <div class="wizard-title">New Round</div>
        <div class="wizard-step-indicator">{{ step }}/{{ totalSteps }}</div>
      </div>

      <!-- ── Step 1: Course & Date ───────────────────────────── -->
      <div v-if="step === 1" class="wizard-step">
        <h3>Where are you playing?</h3>
        <input
          v-model="courseSearch"
          class="wiz-input"
          placeholder="Search courses…"
          @focus="scrollInputIntoView"
        />
        <div class="course-list">
          <div v-if="apiSearching" class="course-searching">Searching…</div>

          <!-- Favorites label when no search -->
          <div v-if="!courseSearch && favoriteCourseCount > 0" class="course-section-label">Favorites</div>
          <div
            v-for="c in favoriteCoursesList"
            :key="'fav-' + c.name"
            class="course-option course-option--fav"
            :class="{ selected: form.courseName === c.name }"
            @click="selectCourse(c)"
          >
            <span class="course-option-name">★ {{ c.name }}</span>
          </div>

          <!-- All courses / search results -->
          <div v-if="!courseSearch && favoriteCourseCount > 0" class="course-section-label">All Courses</div>
          <div
            v-for="c in nonFavoriteCoursesList.slice(0, 15)"
            :key="c.name"
            class="course-option"
            :class="{ selected: form.courseName === c.name, 'course-option--api': c.isApiResult }"
            @click="selectCourse(c)"
          >
            <span class="course-option-name">{{ c.name }}</span>
            <span v-if="c.location" class="course-option-loc">{{ c.location }}</span>
          </div>
        </div>

        <!-- Loading API data -->
        <div v-if="apiLoadingWizard" class="api-loading-inline">
          <span class="api-loading-spinner">⟳</span> Fetching course data from API…
        </div>

        <!-- Tee selector -->
        <div v-if="!apiLoadingWizard && form.courseName && teesForCourse.length" class="tee-section">
          <label class="wiz-label">Select Tee:</label>
          <div class="tee-options">
            <button
              v-for="t in teesForCourse"
              :key="t.name"
              class="tee-option-btn"
              :class="{ 'tee-selected': form.tee === t.name }"
              :style="{ '--tee-dot': teeColorMap(t.name) }"
              @click="form.tee = t.name"
            >
              <span class="tee-dot" />
              <span class="tee-option-info">
                <span class="tee-option-name">{{ t.name }}</span>
                <span class="tee-option-detail" v-if="t.yards || t.rating">
                  {{ t.yards ? t.yards.toLocaleString() + ' yds' : '' }}{{ t.rating ? ' · ' + t.rating + '/' + t.slope : '' }}
                </span>
              </span>
            </button>
          </div>
        </div>

        <!-- API course with no tee data -->
        <div v-if="!apiLoadingWizard && form.courseName && !teesForCourse.length" class="api-course-notice">
          <div class="api-notice-text">📋 <strong>{{ form.courseName }}</strong> needs tee/SI setup.</div>
          <button class="btn-primary btn-sm" @click="openCourseSetup">Set up course →</button>
        </div>

        <div class="wiz-row">
          <div class="wiz-field">
            <label class="wiz-label">Date</label>
            <input v-model="form.date" type="date" class="wiz-input" />
          </div>
          <div class="wiz-field">
            <label class="wiz-label">Holes</label>
            <div class="holes-toggle">
              <button v-for="h in [['18','Full 18'],['front9','Front 9'],['back9','Back 9']]" :key="h[0]"
                class="holes-btn" :class="{ active: form.holesMode === h[0] }" @click="form.holesMode = h[0]">
                {{ h[1] }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Step 2: Players ────────────────────────────────── -->
      <div v-if="step === 2" class="wizard-step">
        <h3>Who's playing?</h3>

        <!-- Added players (chips at top) -->
        <div v-if="form.players.length" class="added-chips">
          <div v-for="(p, i) in form.players" :key="p.id" class="added-chip">
            <span>{{ p.shortName || p.name }}</span>
            <span class="chip-hcp">{{ p.ghinIndex ?? '—' }}</span>
            <button @click="form.players.splice(i, 1)">×</button>
          </div>
        </div>

        <input
          v-model="playerSearch"
          class="wiz-input"
          placeholder="Search roster…"
          @focus="scrollInputIntoView"
        />
        <div class="roster-list">
          <!-- Favorites first -->
          <div v-if="!playerSearch" class="section-label-sm">Favorites</div>
          <div
            v-for="p in filteredRoster"
            :key="p.id"
            class="roster-option"
            :class="{ selected: isPlayerAdded(p) }"
            @click="togglePlayer(p)"
          >
            <div class="roster-info">
              <span class="roster-name">{{ p.name }}</span>
              <span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span>
            </div>
            <span class="roster-check">{{ isPlayerAdded(p) ? '✓' : '+' }}</span>
          </div>
        </div>

        <!-- Quick add guest -->
        <div class="quick-add-row">
          <input v-model="newName" class="wiz-input" placeholder="Add guest name…" @keydown.enter="quickAddPlayer" />
          <input v-model="newHcp" class="wiz-input wiz-input-sm" placeholder="HCP" type="number" step="0.1" />
          <button class="btn-ghost btn-sm" @click="quickAddPlayer">Add</button>
        </div>
      </div>

      <!-- ── Step 3: Games ──────────────────────────────────── -->
      <div v-if="step === 3" class="wizard-step">
        <h3>Set up games</h3>

        <!-- Main game selector -->
        <div class="game-section-label">Main Game</div>
        <div class="game-type-grid">
          <button
            v-for="g in MAIN_GAMES"
            :key="g.key"
            class="game-type-btn"
            :class="{ selected: mainGame.type === g.key }"
            @click="setMainGame(g.key)"
          >
            <span class="gtb-icon">{{ g.icon }}</span>
            <span class="gtb-label">{{ g.label }}</span>
          </button>
        </div>

        <!-- Nassau config -->
        <div v-if="mainGame.type === 'nassau'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>Front 9 $</label>
              <input v-model.number="mainGame.config.front" type="number" min="1" class="config-input" placeholder="10" />
            </div>
            <div class="config-field">
              <label>Back 9 $</label>
              <input v-model.number="mainGame.config.back" type="number" min="1" class="config-input" placeholder="10" />
            </div>
            <div class="config-field">
              <label>Overall $</label>
              <input v-model.number="mainGame.config.overall" type="number" min="1" class="config-input" placeholder="20" />
            </div>
          </div>
          <div class="config-row">
            <div class="config-field">
              <label>Auto-press at</label>
              <select v-model.number="mainGame.config.pressAt" class="config-select">
                <option :value="0">No press</option>
                <option :value="1">1 down</option>
                <option :value="2">2 down</option>
                <option :value="3">3 down</option>
              </select>
            </div>
          </div>
          <TeamPicker :players="form.players" v-model:team1="mainGame.config.team1" v-model:team2="mainGame.config.team2" />
        </div>

        <!-- Match Play config -->
        <div v-if="mainGame.type === 'match'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>Match value $</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="20" />
            </div>
            <div class="config-field">
              <label>Format</label>
              <select v-model="mainGame.config.format" class="config-select">
                <option value="1v1">1v1 Singles</option>
                <option value="2v2">2v2 Best Ball</option>
              </select>
            </div>
          </div>
          <template v-if="mainGame.config.format === '1v1'">
            <div class="config-row">
              <div class="config-field">
                <label>Player 1</label>
                <select v-model="mainGame.config.player1" class="config-select">
                  <option value="">— select —</option>
                  <option v-for="p in form.players" :key="p.id" :value="p.id">{{ p.shortName || p.name }}</option>
                </select>
              </div>
              <div class="config-field">
                <label>Player 2</label>
                <select v-model="mainGame.config.player2" class="config-select">
                  <option value="">— select —</option>
                  <option v-for="p in form.players" :key="p.id" :value="p.id">{{ p.shortName || p.name }}</option>
                </select>
              </div>
            </div>
          </template>
          <template v-else>
            <TeamPicker :players="form.players" v-model:team1="mainGame.config.team1" v-model:team2="mainGame.config.team2" />
          </template>
        </div>

        <!-- Skins config -->
        <div v-if="mainGame.type === 'skins'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per skin</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="5" />
            </div>
            <div class="config-field">
              <label>Carry ties?</label>
              <select v-model="mainGame.config.carry" class="config-select">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </div>
          <div class="config-note">All {{ form.players.length }} players participate unless you restrict below</div>
        </div>

        <!-- Best Ball config -->
        <div v-if="mainGame.type === 'bestball'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>Balls per team</label>
              <select v-model.number="mainGame.config.ballsPerTeam" class="config-select">
                <option :value="1">1 (Best Ball)</option>
                <option :value="2">2 (Better Ball)</option>
              </select>
            </div>
            <div class="config-field">
              <label>$ per hole</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="5" />
            </div>
          </div>
          <TeamPicker :players="form.players" v-model:team1="mainGame.config.team1" v-model:team2="mainGame.config.team2" />
        </div>

        <!-- Vegas config -->
        <div v-if="mainGame.type === 'vegas'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per point</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="1" />
            </div>
            <div class="config-field">
              <label>Flip on birdie?</label>
              <select v-model="mainGame.config.birdieFlip" class="config-select">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </div>
          <TeamPicker :players="form.players" v-model:team1="mainGame.config.team1" v-model:team2="mainGame.config.team2" />
        </div>

        <!-- Hi-Low config -->
        <div v-if="mainGame.type === 'hilow'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per hole</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="5" />
            </div>
          </div>
          <TeamPicker :players="form.players" v-model:team1="mainGame.config.team1" v-model:team2="mainGame.config.team2" />
        </div>

        <!-- Stableford config -->
        <div v-if="mainGame.type === 'stableford'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per point</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="1" />
            </div>
          </div>
          <div class="config-note">Eagle +3, Birdie +2, Par +1, Bogey 0, Double −1. All {{ form.players.length }} players compete.</div>
        </div>

        <!-- Wolf config -->
        <div v-if="mainGame.type === 'wolf'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per point</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="5" />
            </div>
            <div class="config-field">
              <label>Lone Wolf multiplier</label>
              <select v-model.number="mainGame.config.wolfLoneMultiplier" class="config-select">
                <option :value="1">1×</option>
                <option :value="2">2×</option>
                <option :value="3">3×</option>
              </select>
            </div>
          </div>
          <div class="config-note">Wolf picks a partner each hole (or goes lone). Tee order rotates automatically.</div>
        </div>

        <!-- Hammer config -->
        <div v-if="mainGame.type === 'hammer'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>Starting $ per hole</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="1" />
            </div>
          </div>
          <TeamPicker :players="form.players" v-model:team1="mainGame.config.team1" v-model:team2="mainGame.config.team2" />
          <div class="config-note">Throw the hammer to double the bet. Opponent must accept or concede.</div>
        </div>

        <!-- Sixes config -->
        <div v-if="mainGame.type === 'sixes'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per point</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="1" />
            </div>
          </div>
          <div class="config-note">Teams rotate every 6 holes. 6 pts per hole split among winners.</div>
        </div>

        <!-- 5-3-1 config -->
        <div v-if="mainGame.type === 'fiveThreeOne'" class="game-config-card">
          <div class="config-row">
            <div class="config-field">
              <label>$ per point</label>
              <input v-model.number="mainGame.config.ppt" type="number" min="1" class="config-input" placeholder="1" />
            </div>
          </div>
          <div class="config-note">Best net gets 5, second gets 3, third gets 1, worst gets 0. All {{ form.players.length }} players compete.</div>
        </div>

        <!-- No main game -->
        <div v-if="mainGame.type === 'none'" class="config-note">Select a main game or just track scores.</div>

        <!-- ── Side Games ─────────────────────────────────────── -->
        <div class="game-section-label" style="margin-top:20px">Side Games</div>

        <div class="side-games-list">
          <!-- Skins as side game -->
          <div class="side-game-row" v-if="mainGame.type !== 'skins'">
            <div class="side-game-header" @click="toggleSideGame('skins')">
              <span>🏆 Skins</span>
              <span class="side-toggle">{{ sideGames.skins.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.skins.enabled" class="side-game-config">
              <input v-model.number="sideGames.skins.ppt" type="number" class="config-input" placeholder="$5/skin" />
            </div>
          </div>

          <!-- Dots/Junk -->
          <div class="side-game-row">
            <div class="side-game-header" @click="toggleSideGame('dots')">
              <span>🎯 Dots (Birdies, Greenies, Sandies)</span>
              <span class="side-toggle">{{ sideGames.dots.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.dots.enabled" class="side-game-config">
              <div class="config-row">
                <div class="config-field">
                  <label>$ per dot</label>
                  <input v-model.number="sideGames.dots.ppt" type="number" class="config-input" placeholder="2" />
                </div>
              </div>
              <div class="dots-options">
                <label><input type="checkbox" v-model="sideGames.dots.birdieEnabled" /> Birdies</label>
                <label><input type="checkbox" v-model="sideGames.dots.eagleEnabled" /> Eagles (+2)</label>
                <label><input type="checkbox" v-model="sideGames.dots.greenieEnabled" /> Greenies</label>
                <label><input type="checkbox" v-model="sideGames.dots.sandieEnabled" /> Sandies</label>
              </div>
            </div>
          </div>

          <!-- Snake -->
          <div class="side-game-row">
            <div class="side-game-header" @click="toggleSideGame('snake')">
              <span>🐍 Snake (worst scorer carries it)</span>
              <span class="side-toggle">{{ sideGames.snake.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.snake.enabled" class="side-game-config">
              <div class="config-field">
                <label>$ per hole holding snake</label>
                <input v-model.number="sideGames.snake.ppt" type="number" class="config-input" placeholder="5" />
              </div>
            </div>
          </div>

          <!-- Fidget -->
          <div class="side-game-row">
            <div class="side-game-header" @click="toggleSideGame('fidget')">
              <span>😬 Fidget (never win a hole = pay everyone)</span>
              <span class="side-toggle">{{ sideGames.fidget.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.fidget.enabled" class="side-game-config">
              <div class="config-field">
                <label>$ paid to each player</label>
                <input v-model.number="sideGames.fidget.ppp" type="number" class="config-input" placeholder="10" />
              </div>
            </div>
          </div>

          <!-- 1v1 Side Match -->
          <div class="side-game-row">
            <div class="side-game-header" @click="toggleSideGame('match1')">
              <span>⚔️ 1v1 Side Match</span>
              <span class="side-toggle">{{ sideGames.match1.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.match1.enabled" class="side-game-config">
              <div class="config-row">
                <div class="config-field">
                  <label>Player A</label>
                  <select v-model="sideGames.match1.player1" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ p.shortName || p.name }}</option>
                  </select>
                </div>
                <div class="config-field">
                  <label>vs Player B</label>
                  <select v-model="sideGames.match1.player2" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ p.shortName || p.name }}</option>
                  </select>
                </div>
                <div class="config-field">
                  <label>$ per hole</label>
                  <input v-model.number="sideGames.match1.ppt" type="number" class="config-input" placeholder="10" />
                </div>
              </div>
            </div>
          </div>

          <!-- 2nd 1v1 Side Match -->
          <div v-if="sideGames.match1.enabled" class="side-game-row">
            <div class="side-game-header" @click="toggleSideGame('match2')">
              <span>⚔️ 2nd Side Match</span>
              <span class="side-toggle">{{ sideGames.match2.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.match2.enabled" class="side-game-config">
              <div class="config-row">
                <div class="config-field">
                  <label>Player A</label>
                  <select v-model="sideGames.match2.player1" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ p.shortName || p.name }}</option>
                  </select>
                </div>
                <div class="config-field">
                  <label>vs Player B</label>
                  <select v-model="sideGames.match2.player2" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ p.shortName || p.name }}</option>
                  </select>
                </div>
                <div class="config-field">
                  <label>$ per hole</label>
                  <input v-model.number="sideGames.match2.ppt" type="number" class="config-input" placeholder="10" />
                </div>
              </div>
            </div>
          </div>

          <!-- Best Ball net tracker -->
          <div class="side-game-row">
            <div class="side-game-header" @click="toggleSideGame('bbn')">
              <span>🏅 Best Ball Net Total (group tracker)</span>
              <span class="side-toggle">{{ sideGames.bbn.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.bbn.enabled" class="side-game-config">
              <div class="config-field">
                <label>Balls to count per hole</label>
                <select v-model.number="sideGames.bbn.ballsToCount" class="config-select">
                  <option :value="1">1 (Best Ball)</option>
                  <option :value="2">2 (Better Ball)</option>
                  <option :value="3">3</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Room code -->
        <label class="toggle-label" style="margin-top:16px;display:flex;gap:8px;align-items:center">
          <input type="checkbox" v-model="form.withRoomCode" />
          Share with another foursome (room code)
        </label>
      </div>

      <!-- Nav -->
      <div class="wizard-nav">
        <button v-if="step > 1" class="btn-ghost" @click="step--">← Back</button>
        <span v-else />
        <button v-if="step < totalSteps" class="btn-primary" :disabled="!canNext" @click="nextStep">Next →</button>
        <button v-else class="btn-primary" :disabled="!canFinish || creating" @click="create">
          {{ creating ? 'Creating…' : 'Start Round 🏌️' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore } from '../stores/roster'
import { useRoundsStore } from '../stores/rounds'

// ── TeamPicker component (inline) ────────────────────────────────
// Old-version style: two-column side-by-side, tap player to assign to that team
const TeamPicker = {
  name: 'TeamPicker',
  props: { players: Array, team1: Array, team2: Array },
  emits: ['update:team1', 'update:team2'],
  setup(props, { emit }) {
    function assign(pid, teamNum) {
      // Remove from both teams first
      const newT1 = (props.team1 || []).filter(id => id !== pid)
      const newT2 = (props.team2 || []).filter(id => id !== pid)
      // Add to the target team
      if (teamNum === 1) newT1.push(pid)
      else newT2.push(pid)
      emit('update:team1', newT1)
      emit('update:team2', newT2)
    }
    function getTeam(pid) {
      if ((props.team1 || []).includes(pid)) return 1
      if ((props.team2 || []).includes(pid)) return 2
      return 0
    }
    const colStyle = (team) => ({
      flex: '1', padding: '10px', borderRadius: '12px',
      background: team === 1 ? 'rgba(96,165,250,.07)' : 'rgba(248,113,113,.07)',
      border: `1px solid ${team === 1 ? 'rgba(96,165,250,.2)' : 'rgba(248,113,113,.2)'}`,
    })
    const labelStyle = (team) => ({
      fontSize: '10px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase',
      color: team === 1 ? '#60a5fa' : '#f87171',
    })
    const btnStyle = (pid, team) => {
      const isOn = getTeam(pid) === team
      return {
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 12px', marginBottom: '5px', borderRadius: '9px',
        fontSize: '13px', fontWeight: isOn ? '700' : '500', cursor: 'pointer',
        border: 'none', fontFamily: 'inherit',
        background: isOn
          ? (team === 1 ? 'rgba(96,165,250,.25)' : 'rgba(248,113,113,.25)')
          : 'rgba(255,255,255,.04)',
        color: isOn
          ? (team === 1 ? '#60a5fa' : '#f87171')
          : 'rgba(240,237,224,.5)',
      }
    }
    return () => h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' } }, [
      h('div', { style: colStyle(1) }, [
        h('div', { style: labelStyle(1) }, 'TEAM 1'),
        ...(props.players || []).map(p =>
          h('button', {
            key: 't1-' + p.id,
            style: btnStyle(p.id, 1),
            onClick: () => assign(p.id, 1),
          }, p.shortName || p.name)
        ),
      ]),
      h('div', { style: colStyle(2) }, [
        h('div', { style: labelStyle(2) }, 'TEAM 2'),
        ...(props.players || []).map(p =>
          h('button', {
            key: 't2-' + p.id,
            style: btnStyle(p.id, 2),
            onClick: () => assign(p.id, 2),
          }, p.shortName || p.name)
        ),
      ]),
    ])
  },
}

const emit = defineEmits(['close', 'created', 'setup-course'])
const coursesStore = useCoursesStore()
const rosterStore = useRosterStore()
const roundsStore = useRoundsStore()

const step = ref(1)
const totalSteps = 3
const creating = ref(false)

// ── Main game ────────────────────────────────────────────────────
const MAIN_GAMES = [
  { key: 'nassau',      icon: '💰', label: 'Nassau' },
  { key: 'vegas',       icon: '🎰', label: 'Vegas' },
  { key: 'match',       icon: '⚔️', label: 'Match Play' },
  { key: 'skins',       icon: '🏆', label: 'Skins' },
  { key: 'hilow',       icon: '📊', label: 'Hi-Low' },
  { key: 'stableford',  icon: '⭐', label: 'Stableford' },
  { key: 'wolf',        icon: '🐺', label: 'Wolf' },
  { key: 'hammer',      icon: '🔨', label: 'Hammer' },
  { key: 'sixes',       icon: '🎲', label: 'Sixes' },
  { key: 'fiveThreeOne',icon: '5️⃣', label: '5-3-1' },
  { key: 'bestball',    icon: '🏅', label: 'Best Ball' },
  { key: 'none',        icon: '📋', label: 'Scores Only' },
]

// Default configs per game type
const GAME_DEFAULTS = {
  nassau:      { front: 10, back: 10, overall: 20, pressAt: 2, team1: [], team2: [] },
  vegas:       { ppt: 1, birdieFlip: true, team1: [], team2: [] },
  match:       { ppt: 20, format: '2v2', player1: '', player2: '', team1: [], team2: [] },
  skins:       { ppt: 5, carry: true },
  hilow:       { ppt: 5, team1: [], team2: [] },
  stableford:  { ppt: 1 },
  wolf:        { ppt: 5, wolfLoneMultiplier: 2 },
  hammer:      { ppt: 1, team1: [], team2: [] },
  sixes:       { ppt: 1 },
  fiveThreeOne:{ ppt: 1 },
  bestball:    { ppt: 5, ballsPerTeam: 1, team1: [], team2: [] },
  none:        {},
}

const mainGame = ref({
  type: 'nassau',
  config: { ...GAME_DEFAULTS.nassau },
})

const sideGames = ref({
  skins:  { enabled: false, ppt: 5, carry: true },
  dots:   { enabled: false, ppt: 2, birdieEnabled: true, eagleEnabled: true, greenieEnabled: true, sandieEnabled: true },
  snake:  { enabled: false, ppt: 5 },
  fidget: { enabled: false, ppp: 10 },
  match1: { enabled: false, player1: '', player2: '', ppt: 10 },
  match2: { enabled: false, player1: '', player2: '', ppt: 10 },
  bbn:    { enabled: true,  ballsToCount: 1 },
})

function setMainGame(key) {
  // Preserve team assignments if switching between team games
  const oldTeam1 = mainGame.value.config.team1 || []
  const oldTeam2 = mainGame.value.config.team2 || []
  mainGame.value.type = key
  mainGame.value.config = { ...GAME_DEFAULTS[key] || {} }
  // Restore teams if the new game supports them
  if (mainGame.value.config.team1 !== undefined) {
    mainGame.value.config.team1 = oldTeam1
    mainGame.value.config.team2 = oldTeam2
  }
}

function toggleSideGame(key) {
  sideGames.value[key].enabled = !sideGames.value[key].enabled
}

// ── Form state ───────────────────────────────────────────────────
const form = ref({
  courseName: '',
  tee: '',
  date: new Date().toISOString().slice(0, 10),
  holesMode: '18',
  players: [],
  withRoomCode: false,
})

const courseSearch = ref('')
const playerSearch = ref('')
const newName = ref('')
const newHcp = ref('')
const apiResults = ref([])
const apiSearching = ref(false)

// ── Course search ────────────────────────────────────────────────
const filteredCourses = computed(() => {
  const q = courseSearch.value.toLowerCase()
  const favSet = coursesStore.favoriteNames

  if (!q) {
    // No search: show favorites first, then the rest
    const favs = coursesStore.allCourses.filter(c => favSet.has(c.name))
    const rest = coursesStore.allCourses.filter(c => !favSet.has(c.name))
    return [...favs, ...rest]
  }

  // With search: filter local, then append matching API results
  const local = coursesStore.allCourses.filter(c => c.name.toLowerCase().includes(q))
  const localNames = new Set(local.map(c => c.name.toLowerCase()))
  const extras = apiResults.value.filter(c => !localNames.has(c.name.toLowerCase()))
  return [...local, ...extras]
})

const favoriteCoursesList = computed(() => {
  if (courseSearch.value) return []  // When searching, no separate favorites section
  return filteredCourses.value.filter(c => coursesStore.favoriteNames.has(c.name))
})

const nonFavoriteCoursesList = computed(() => {
  if (courseSearch.value) return filteredCourses.value  // When searching, show all results
  return filteredCourses.value.filter(c => !coursesStore.favoriteNames.has(c.name))
})

const favoriteCourseCount = computed(() => favoriteCoursesList.value.length)

let searchTimer = null
watch(courseSearch, async (q) => {
  apiResults.value = []
  clearTimeout(searchTimer)
  if (q.length < 3) return
  searchTimer = setTimeout(async () => {
    apiSearching.value = true
    apiResults.value = await coursesStore.searchCoursesApi(q)
    apiSearching.value = false
  }, 400)
})

const teesForCourse = computed(() => {
  const courseName = form.value.courseName
  if (!courseName) return []

  // Prefer API-enriched tee data (has ALL tees from the real API)
  const enriched = apiEnrichedTees.value[courseName]
  if (enriched && typeof enriched === 'object') {
    return Object.entries(enriched).map(([name, data]) => ({
      name, yards: data.yards, rating: data.rating, slope: data.slope,
    }))
  }

  // Fall back to store data
  const c = coursesStore.getCourse(courseName)
  if (!c) return []
  if (c.teesData && typeof c.teesData === 'object') {
    return Object.entries(c.teesData).map(([name, data]) => ({
      name, yards: data.yards, rating: data.rating, slope: data.slope,
    }))
  }
  if (typeof c.tees === 'string') return [{ name: c.tees, yards: null, rating: null, slope: null }]
  return []
})

// ── Roster ───────────────────────────────────────────────────────
const filteredRoster = computed(() => {
  const q = playerSearch.value.toLowerCase()
  const all = rosterStore.players
  if (!q) {
    // favorites first
    return [...all.filter(p => p.is_favorite), ...all.filter(p => !p.is_favorite)]
  }
  return all.filter(p => p.name.toLowerCase().includes(q))
})

// ── Navigation guards ────────────────────────────────────────────
const canNext = computed(() => {
  if (step.value === 1) return !!form.value.courseName && teesForCourse.value.length > 0
  if (step.value === 2) return form.value.players.length >= 1
  return true
})
const canFinish = computed(() => form.value.players.length >= 1)

function nextStep() {
  if (step.value === 1 && canNext.value) step.value++
  else if (step.value === 2 && canNext.value) {
    // Auto-split players into teams when entering the games step
    autoSplitTeams()
    step.value++
  }
}

function autoSplitTeams() {
  // Only auto-split if teams are empty (haven't been manually set)
  if (mainGame.value.config.team1.length || mainGame.value.config.team2.length) return
  const players = form.value.players
  if (players.length < 2) return
  const half = Math.ceil(players.length / 2)
  mainGame.value.config.team1 = players.slice(0, half).map(p => p.id)
  mainGame.value.config.team2 = players.slice(half).map(p => p.id)
}

// ── Course selection ─────────────────────────────────────────────
const apiLoadingWizard = ref(false)
// Cache of API-enriched tee data by course name (only lives during this wizard session)
const apiEnrichedTees = ref({})

async function selectCourse(c) {
  form.value.courseName = c.name

  // Try to enrich from API if we have an apiId or can search for one
  const apiId = c.apiId || null

  if (apiId) {
    await fetchAndApplyApiDetail(c.name, apiId, c.tees)
    return
  }

  // No apiId — try a quick API search for the course name
  // (this enriches built-in courses with real API tee data)
  if (!c.isApiResult && !apiEnrichedTees.value[c.name]) {
    apiLoadingWizard.value = true
    try {
      const results = await coursesStore.searchCoursesApi(c.name)
      // Find a matching result (fuzzy match on name)
      const match = results.find(r =>
        r.name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]) ||
        c.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
      )
      if (match?.apiId) {
        await fetchAndApplyApiDetail(c.name, match.apiId, c.tees)
        apiLoadingWizard.value = false
        return
      }
    } catch { /* ignore search failures */ }
    apiLoadingWizard.value = false
  }

  // Use already-enriched data if available
  if (apiEnrichedTees.value[c.name]) {
    const defaultTee = typeof c.tees === 'string' ? c.tees : Object.keys(apiEnrichedTees.value[c.name])[0]
    form.value.tee = defaultTee ?? ''
    return
  }

  // Fallback to whatever tee data is in the store
  if (c.teesData && typeof c.teesData === 'object') {
    const defaultTee = c.tees && typeof c.tees === 'string' ? c.tees : Object.keys(c.teesData)[0]
    form.value.tee = defaultTee ?? ''
  } else if (typeof c.tees === 'string') {
    form.value.tee = c.tees
  } else {
    form.value.tee = Object.keys(c.tees ?? {})[0] ?? ''
  }
}

async function fetchAndApplyApiDetail(courseName, apiId, defaultTees) {
  apiLoadingWizard.value = true
  try {
    const detail = await coursesStore.fetchCourseDetail(apiId)
    if (detail && Object.keys(detail.teesData || {}).length) {
      // Store the enriched tee data
      apiEnrichedTees.value[courseName] = detail.teesData
      // Also update/save the course in the store with full API data
      const existing = coursesStore.getCourse(courseName)
      if (existing && !existing.isCustom) {
        // Built-in course — save as custom override with full API data
        const teesData = detail.teesData
        const teeNames = Object.keys(teesData)
        try {
          await coursesStore.addCourse({
            name: courseName,
            teesData,
            tees: teesData,
            par: detail.par,
            si: detail.si,
            defaultTee: (typeof defaultTees === 'string' ? defaultTees : teeNames[0]),
          })
        } catch { /* may already exist as custom */ }
      } else if (!existing) {
        // New API course
        const teesData = detail.teesData
        const teeNames = Object.keys(teesData)
        await coursesStore.addCourse({
          name: courseName,
          teesData,
          tees: teesData,
          par: detail.par,
          si: detail.si,
          defaultTee: teeNames[0],
        })
      }
      // Select default tee
      const teeNames = Object.keys(detail.teesData)
      const preferred = typeof defaultTees === 'string' ? defaultTees : null
      const defaultTee = preferred && teeNames.some(t => t.toLowerCase().includes(preferred.toLowerCase()))
        ? teeNames.find(t => t.toLowerCase().includes(preferred.toLowerCase()))
        : teeNames[0]
      form.value.tee = defaultTee ?? ''
    }
  } catch (e) {
    console.warn('API fetch failed for', courseName, e)
  }
  apiLoadingWizard.value = false
}

function openCourseSetup() {
  const apiResult = apiResults.value.find(c => c.name === form.value.courseName)
  emit('setup-course', form.value.courseName, apiResult?.apiId ?? null)
}

function scrollInputIntoView(e) {
  setTimeout(() => { e.target?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 350)
}

const TEE_COLORS = {
  black: '#1c1c1e', championship: '#1c1c1e', tips: '#1c1c1e',
  blue: '#1d4ed8', white: '#d1d5db', silver: '#9ca3af',
  gold: '#ca8a04', yellow: '#eab308',
  red: '#dc2626', forward: '#dc2626',
  green: '#16a34a', orange: '#ea580c',
  'royal blue': '#1d4ed8',
}
function teeColorMap(name = '') {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(TEE_COLORS)) {
    if (key.includes(k)) return v
  }
  return '#16a34a'
}

// ── Player management ─────────────────────────────────────────────
function isPlayerAdded(p) { return form.value.players.some(fp => fp.id === p.id) }

function togglePlayer(p) {
  if (isPlayerAdded(p)) {
    form.value.players = form.value.players.filter(fp => fp.id !== p.id)
  } else {
    form.value.players.push({
      id: p.id, name: p.name,
      shortName: p.short_name,
      ghinIndex: p.ghin_index,
      profileId: null,
    })
  }
}

function quickAddPlayer() {
  if (!newName.value.trim()) return
  form.value.players.push({
    id: `guest_${Date.now()}`,
    name: newName.value.trim(),
    shortName: newName.value.trim().split(' ')[0].slice(0, 8),
    ghinIndex: newHcp.value ? parseFloat(newHcp.value) : null,
    profileId: null,
  })
  newName.value = ''
  newHcp.value = ''
}

// ── Build game configs for round creation ────────────────────────
function buildGameConfigs() {
  const games = []

  // Main game
  if (mainGame.value.type !== 'none') {
    games.push({ type: mainGame.value.type, config: { ...mainGame.value.config } })
  }

  // Side games
  const sg = sideGames.value
  if (sg.skins.enabled && mainGame.value.type !== 'skins') {
    games.push({ type: 'skins', config: { ppt: sg.skins.ppt, carry: sg.skins.carry } })
  }
  if (sg.dots.enabled) {
    games.push({ type: 'dots', config: {
      ppt: sg.dots.ppt,
      birdieEnabled: sg.dots.birdieEnabled,
      eagleEnabled: sg.dots.eagleEnabled,
      greenieEnabled: sg.dots.greenieEnabled,
      sandieEnabled: sg.dots.sandieEnabled,
    }})
  }
  if (sg.snake.enabled) {
    games.push({ type: 'snake', config: { ppt: sg.snake.ppt } })
  }
  if (sg.fidget.enabled) {
    games.push({ type: 'fidget', config: { ppp: sg.fidget.ppp } })
  }
  if (sg.match1.enabled && sg.match1.player1 && sg.match1.player2) {
    games.push({ type: 'match1v1', config: { player1: sg.match1.player1, player2: sg.match1.player2, ppt: sg.match1.ppt } })
  }
  if (sg.match2.enabled && sg.match2.player1 && sg.match2.player2) {
    games.push({ type: 'match1v1', config: { player1: sg.match2.player1, player2: sg.match2.player2, ppt: sg.match2.ppt } })
  }
  if (sg.bbn.enabled) {
    games.push({ type: 'bbn', config: { ballsToCount: sg.bbn.ballsToCount } })
  }

  return games
}

// ── Create round ─────────────────────────────────────────────────
async function create() {
  creating.value = true
  try {
    const round = await roundsStore.createRound({
      courseName: form.value.courseName,
      tee: form.value.tee,
      date: form.value.date,
      holesMode: form.value.holesMode,
      withRoomCode: form.value.withRoomCode,
      players: form.value.players,
      games: buildGameConfigs(),
    })
    emit('created', round)
  } catch (e) {
    console.error('Failed to create round:', e)
  } finally {
    creating.value = false
  }
}
</script>

