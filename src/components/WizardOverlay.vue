<template>
  <div :class="props.inline ? 'wizard-inline' : 'modal-overlay wizard-overlay'">
    <div :class="props.inline ? 'wizard-inline-body' : 'modal wizard-modal'">
      <div class="wizard-header">
        <div class="wizard-step-indicator">Step {{ step }} of {{ totalSteps }}</div>
        <div v-if="stepTitle" class="wizard-header-title">{{ stepTitle }}</div>
        <button class="wizard-close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- Pre-flight connectivity warning — shown ONLY when we've confirmed
           the connection pool is stuck. The ONLY real fix is force-quitting
           the app. JS-based reload cannot restart the WKWebView connection pool.
           Show clear step-by-step instructions instead. -->
      <div v-if="preflightOk === false" class="wiz-preflight-warn">
        <div class="wpw-title">⚠️ iOS connection is stuck</div>
        <div class="wpw-body">
          Round creation <strong>will fail</strong> until you fix this. Takes 5 seconds:
        </div>
        <ol class="wpw-steps">
          <li><strong>Swipe up</strong> from the bottom of your screen to open the app switcher</li>
          <li><strong>Find GolfWizard</strong> and swipe it UP off the screen to force-quit it</li>
          <li><strong>Reopen GolfWizard</strong> — the connection resets on launch</li>
        </ol>
        <div v-if="preflightRetrying" class="wpw-checking">⟳ Checking connection…</div>
        <button v-else class="wpw-btn wpw-btn--recheck" @click="recheckPreflight">
          ✓ I did it — check again
        </button>
        <div class="wpw-note">
          (The "Reload" approach doesn't work on iOS — only a full force-quit clears the stuck socket.)
        </div>
      </div>

      <!-- ── Step 1: Course & Date ───────────────────────────── -->
      <div v-if="step === 1" class="wizard-step">

        <!-- Locked course notice (shown for linked-match invitees) -->
        <div v-if="props.lockedCourse" class="wiz-locked-card">
          <div class="wiz-locked-label">🔒 Course locked by linked match</div>
          <div class="wiz-locked-course">{{ props.lockedCourse }}</div>
          <div v-if="props.lockedTee" class="wiz-locked-tee">Tee: {{ props.lockedTee }}</div>
          <div class="wiz-locked-hint">
            {{ props.lockedHint || 'Both foursomes must play the same course for the 4v4 to settle.' }}
          </div>
        </div>

        <input
          v-if="!props.lockedCourse"
          v-model="courseSearch"
          class="wiz-input"
          placeholder="Search courses…"
          @focus="scrollInputIntoView"
        />
        <div v-if="!props.lockedCourse" class="course-list">
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

        <!-- Tee selector (hidden when locked by a linked match) -->
        <div v-if="!apiLoadingWizard && form.courseName && teesForCourse.length && !props.lockedTee" class="tee-section">
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
      <div v-if="step === 2" class="wizard-step wizard-step--players">
        <input
          v-model="playerSearch"
          class="wiz-input"
          placeholder="Search roster…"
          @focus="scrollInputIntoView"
        />

        <!-- Selected players: compact horizontal chip strip -->
        <div v-if="form.players.length" class="player-chip-strip">
          <div
            v-for="(p, i) in form.players"
            :key="p.id"
            class="player-chip"
            :class="{ 'dragging': dragIdx === i }"
            draggable="true"
            @dragstart="onDragStart(i)"
            @dragover.prevent="onDragOver(i)"
            @dragend="onDragEnd"
            @touchstart.passive="onTouchDragStart($event, i)"
            @touchmove.prevent="onTouchDragMove"
            @touchend="onTouchDragEnd"
          >
            <span class="chip-drag">⠿</span>
            <div class="chip-body">
              <span class="chip-name">{{ p.shortName || p.name.split(' ')[0] }}</span>
              <div class="chip-idx-row">
                <span
                  v-if="p.ghinSyncedAt"
                  class="ghin-dot"
                  :class="ghinDotClass(p.ghinSyncedAt)"
                  :title="ghinDotTitle(p.ghinSyncedAt)"
                />
                <input
                  type="number"
                  step="0.1"
                  class="chip-idx-input"
                  :value="p.ghinIndex"
                  @input="p.ghinIndex = $event.target.value ? parseFloat($event.target.value) : null"
                  placeholder="—"
                />
              </div>
            </div>
            <button class="chip-remove" @click.stop="form.players.splice(i, 1)" title="Remove">×</button>
          </div>
        </div>

        <!-- Roster list — fills remaining space -->
        <div class="roster-list">
          <!-- Favorites section -->
          <template v-if="!playerSearch">
            <template v-if="rosterFavorites.length">
              <div class="section-label-sm">Favorites</div>
              <div
                v-for="p in rosterFavorites"
                :key="p.id"
                class="roster-option"
                :class="{ selected: isPlayerAdded(p) }"
                @click="togglePlayer(p)"
              >
                <div class="roster-info">
                  <span class="roster-name">{{ p.name }}</span>
                  <div class="roster-hcp-row">
                    <span
                      v-if="p.ghin_synced_at"
                      class="ghin-dot"
                      :class="ghinDotClass(p.ghin_synced_at)"
                      :title="ghinDotTitle(p.ghin_synced_at)"
                    />
                    <span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span>
                  </div>
                </div>
                <span class="roster-check">{{ isPlayerAdded(p) ? '✓' : '+' }}</span>
              </div>
            </template>
            <template v-if="rosterOthers.length">
              <div class="section-label-sm" style="margin-top:6px">All Players</div>
              <div
                v-for="p in rosterOthers"
                :key="p.id"
                class="roster-option"
                :class="{ selected: isPlayerAdded(p) }"
                @click="togglePlayer(p)"
              >
                <div class="roster-info">
                  <span class="roster-name">{{ p.name }}</span>
                  <div class="roster-hcp-row">
                    <span
                      v-if="p.ghin_synced_at"
                      class="ghin-dot"
                      :class="ghinDotClass(p.ghin_synced_at)"
                      :title="ghinDotTitle(p.ghin_synced_at)"
                    />
                    <span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span>
                  </div>
                </div>
                <span class="roster-check">{{ isPlayerAdded(p) ? '✓' : '+' }}</span>
              </div>
            </template>
          </template>
          <!-- Search results -->
          <template v-else>
            <div
              v-for="p in filteredRoster"
              :key="p.id"
              class="roster-option"
              :class="{ selected: isPlayerAdded(p) }"
              @click="togglePlayer(p)"
            >
              <div class="roster-info">
                <span class="roster-name">{{ p.name }}</span>
                <div class="roster-hcp-row">
                  <span
                    v-if="p.ghin_synced_at"
                    class="ghin-dot"
                    :class="ghinDotClass(p.ghin_synced_at)"
                    :title="ghinDotTitle(p.ghin_synced_at)"
                  />
                  <span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span>
                </div>
              </div>
              <span class="roster-check">{{ isPlayerAdded(p) ? '✓' : '+' }}</span>
            </div>
          </template>
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

        <!-- Main game selector -->
        <div class="game-section-label">Main Game</div>

        <!-- Collapsed: show selected game chip + change button -->
        <div v-if="!showMainGrid && mainGame.type !== 'none'" class="main-game-selected">
          <div class="main-game-chip">
            <span class="gtb-icon">{{ MAIN_GAMES.find(g => g.key === mainGame.type)?.icon }}</span>
            <span class="gtb-label">{{ MAIN_GAMES.find(g => g.key === mainGame.type)?.label }}</span>
            <button class="btn-game-info" @click.stop="toggleGameInfo(mainGame.type)" title="How to play">ℹ️</button>
          </div>
          <button class="btn-change-game" @click="showMainGrid = true">Change</button>
        </div>

        <!-- Game info popover (shown when ℹ️ tapped for main game chip) -->
        <div v-if="gameInfoKey && !showMainGrid && getGameDef(gameInfoKey)" class="game-info-popover">
          <div class="game-info-title">{{ getGameDef(gameInfoKey).name }}</div>
          <p class="game-info-desc">{{ getGameDef(gameInfoKey).desc }}</p>
          <div class="game-info-section"><strong>Rules:</strong> {{ getGameDef(gameInfoKey).rules }}</div>
          <div class="game-info-section"><strong>Wagering:</strong> {{ getGameDef(gameInfoKey).wagering }}</div>
          <div v-if="getGameDef(gameInfoKey).example" class="game-info-section"><strong>Example:</strong> {{ getGameDef(gameInfoKey).example }}</div>
          <div class="game-info-section game-info-hcp"><strong>Handicap:</strong> {{ getGameDef(gameInfoKey).hcpNote }}</div>
          <button class="btn-close-info" @click="gameInfoKey = null">Got it</button>
        </div>

        <!-- Expanded grid: pick a main game -->
        <div v-if="showMainGrid" class="game-type-grid">
          <button
            v-for="g in MAIN_GAMES"
            :key="g.key"
            class="game-type-btn"
            :class="{ selected: mainGame.type === g.key, 'game-type-btn--disabled': g.key === 'fiveThreeOne' && (props.lockedPlayers ?? form.players).length !== 3 }"
            :disabled="g.key === 'fiveThreeOne' && (props.lockedPlayers ?? form.players).length !== 3"
            :title="g.key === 'fiveThreeOne' && (props.lockedPlayers ?? form.players).length !== 3 ? '5-3-1 requires exactly 3 players' : ''"
            @click="setMainGame(g.key)"
          >
            <span class="gtb-icon">{{ g.icon }}</span>
            <span class="gtb-label">{{ g.label }}<span v-if="g.key === 'fiveThreeOne' && (props.lockedPlayers ?? form.players).length !== 3" style="font-size:9px;display:block;opacity:.6;">3 players only</span></span>
            <button class="btn-game-info btn-game-info-grid" @click.stop="toggleGameInfo(g.key)" title="How to play" v-if="g.key !== 'none'">ℹ️</button>
          </button>
        </div>

        <!-- Game info popover (shown when ℹ️ tapped in grid) -->
        <div v-if="gameInfoKey && showMainGrid && getGameDef(gameInfoKey)" class="game-info-popover">
          <div class="game-info-title">{{ getGameDef(gameInfoKey).name }}</div>
          <p class="game-info-desc">{{ getGameDef(gameInfoKey).desc }}</p>
          <div class="game-info-section"><strong>Rules:</strong> {{ getGameDef(gameInfoKey).rules }}</div>
          <div class="game-info-section"><strong>Wagering:</strong> {{ getGameDef(gameInfoKey).wagering }}</div>
          <div v-if="getGameDef(gameInfoKey).example" class="game-info-section"><strong>Example:</strong> {{ getGameDef(gameInfoKey).example }}</div>
          <div class="game-info-section game-info-hcp"><strong>Handicap:</strong> {{ getGameDef(gameInfoKey).hcpNote }}</div>
          <button class="btn-close-info" @click="gameInfoKey = null">Got it</button>
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
                  <option v-for="p in form.players" :key="p.id" :value="p.id">{{ wizDisplayName(p) }}</option>
                </select>
              </div>
              <div class="config-field">
                <label>Player 2</label>
                <select v-model="mainGame.config.player2" class="config-select">
                  <option value="">— select —</option>
                  <option v-for="p in form.players" :key="p.id" :value="p.id">{{ wizDisplayName(p) }}</option>
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
              <label>Scoring</label>
              <select v-model="mainGame.config.scoring" class="config-select">
                <option value="net">Net (strokes)</option>
                <option value="gross">Gross (no strokes)</option>
              </select>
            </div>
            <div class="config-field">
              <label>Birdie flip?</label>
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

          <!-- Tee Order -->
          <div class="wolf-tee-order-section">
            <div class="config-sublabel">🐺 Tee Order (Wolf rotates in this order)</div>
            <div v-if="mainGame.config.wolfTeeOrder && mainGame.config.wolfTeeOrder.length" class="wolf-order-list">
              <div v-for="(pid, oi) in mainGame.config.wolfTeeOrder" :key="pid" class="wolf-order-item">
                <span class="wolf-order-num">{{ oi + 1 }}</span>
                <span class="wolf-order-name">{{ wolfPlayerName(pid) }}</span>
                <span v-if="oi === 0" class="wolf-h1-badge">WOLF H1</span>
                <button v-if="oi > 0" class="wolf-order-btn" @click="wolfMoveUp(oi)">↑</button>
                <button v-if="oi < mainGame.config.wolfTeeOrder.length - 1" class="wolf-order-btn" @click="wolfMoveDown(oi)">↓</button>
              </div>
            </div>
            <div v-if="!mainGame.config.wolfTeeOrder || !mainGame.config.wolfTeeOrder.length" class="wolf-order-prompt">
              <div class="config-note">Tap each player in tee order (1st = Wolf on hole 1):</div>
              <div class="wolf-pick-players">
                <button v-for="p in form.players" :key="p.id" class="wolf-pick-player-btn" @click="wolfAddToOrder(p.id)">
                  {{ wizDisplayName(p) }}
                </button>
              </div>
            </div>
            <div v-if="mainGame.config.wolfTeeOrder && mainGame.config.wolfTeeOrder.length && mainGame.config.wolfTeeOrder.length < form.players.length" class="wolf-pick-players">
              <button v-for="p in form.players.filter(p => !mainGame.config.wolfTeeOrder.includes(p.id))" :key="p.id" class="wolf-pick-player-btn" @click="wolfAddToOrder(p.id)">
                + {{ wizDisplayName(p) }}
              </button>
            </div>
            <button v-if="mainGame.config.wolfTeeOrder && mainGame.config.wolfTeeOrder.length" class="wolf-reset-btn" @click="mainGame.config.wolfTeeOrder = []">Reset Order</button>
            <button class="wolf-auto-btn" @click="wolfRandomizeOrder">🎲 Randomize Order</button>
            <button v-if="!mainGame.config.wolfTeeOrder || !mainGame.config.wolfTeeOrder.length" class="wolf-auto-btn" @click="mainGame.config.wolfTeeOrder = form.players.map(p => p.id)">Use Player List Order</button>
          </div>

          <!-- Options -->
          <div class="wolf-options">
            <label class="wolf-option-toggle" @click="mainGame.config.blindWolfEnabled = !mainGame.config.blindWolfEnabled">
              <span class="wolf-toggle" :class="{ on: mainGame.config.blindWolfEnabled !== false }"></span>
              <span>🙈 Blind Wolf (declare before tee shots, 2× stakes)</span>
            </label>
            <label class="wolf-option-toggle" @click="mainGame.config.lastPlaceWolf = !mainGame.config.lastPlaceWolf">
              <span class="wolf-toggle" :class="{ on: mainGame.config.lastPlaceWolf }"></span>
              <span>📉 Last Place Wolf (holes 17-18: trailing player picks)</span>
            </label>
          </div>
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
          <div class="side-game-row" :class="{ 'side-game-on': sideGames.skins.enabled }" v-if="mainGame.type !== 'skins'">
            <div class="side-game-header" @click="toggleSideGame('skins')">
              <span>🏆 Skins</span>
              <span class="side-header-actions">
                <button class="btn-game-info btn-game-info-sm" @click.stop="toggleGameInfo('skins')" title="How to play">ℹ️</button>
                <span class="side-toggle">{{ sideGames.skins.enabled ? '▲' : '▼' }}</span>
              </span>
            </div>
            <div v-if="gameInfoKey === 'skins'" class="game-info-popover game-info-inline">
              <p class="game-info-desc">{{ getGameDef('skins')?.desc }}</p>
              <div class="game-info-section"><strong>Rules:</strong> {{ getGameDef('skins')?.rules }}</div>
              <div v-if="getGameDef('skins')?.example" class="game-info-section"><strong>Example:</strong> {{ getGameDef('skins')?.example }}</div>
              <button class="btn-close-info" @click="gameInfoKey = null">Got it</button>
            </div>
            <div v-if="sideGames.skins.enabled" class="side-game-config">
              <input v-model.number="sideGames.skins.ppt" type="number" class="config-input" placeholder="$5/skin" />
            </div>
          </div>

          <!-- Dots/Junk -->
          <div class="side-game-row" :class="{ 'side-game-on': sideGames.dots.enabled }">
            <div class="side-game-header" @click="toggleSideGame('dots')">
              <span>🎯 Dots (Birdies, Greenies, Sandies)</span>
              <span class="side-header-actions">
                <button class="btn-game-info btn-game-info-sm" @click.stop="toggleGameInfo('dots')" title="How to play">ℹ️</button>
                <span class="side-toggle">{{ sideGames.dots.enabled ? '▲' : '▼' }}</span>
              </span>
            </div>
            <div v-if="gameInfoKey === 'dots'" class="game-info-popover game-info-inline">
              <p class="game-info-desc">{{ getGameDef('dots')?.desc }}</p>
              <div class="game-info-section"><strong>Rules:</strong> {{ getGameDef('dots')?.rules }}</div>
              <div v-if="getGameDef('dots')?.example" class="game-info-section"><strong>Example:</strong> {{ getGameDef('dots')?.example }}</div>
              <button class="btn-close-info" @click="gameInfoKey = null">Got it</button>
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
          <div class="side-game-row" :class="{ 'side-game-on': sideGames.snake.enabled }">
            <div class="side-game-header" @click="toggleSideGame('snake')">
              <span>🐍 Snake (3-putt tracker)</span>
              <span class="side-header-actions">
                <button class="btn-game-info btn-game-info-sm" @click.stop="toggleGameInfo('snake')" title="How to play">ℹ️</button>
                <span class="side-toggle">{{ sideGames.snake.enabled ? '▲' : '▼' }}</span>
              </span>
            </div>
            <div v-if="gameInfoKey === 'snake'" class="game-info-popover game-info-inline">
              <p class="game-info-desc">{{ getGameDef('snake')?.desc }}</p>
              <div class="game-info-section"><strong>Rules:</strong> {{ getGameDef('snake')?.rules }}</div>
              <div v-if="getGameDef('snake')?.example" class="game-info-section"><strong>Example:</strong> {{ getGameDef('snake')?.example }}</div>
              <button class="btn-close-info" @click="gameInfoKey = null">Got it</button>
            </div>
            <div v-if="sideGames.snake.enabled" class="side-game-config">
              <div class="config-field">
                <label>$ per hole holding snake</label>
                <input v-model.number="sideGames.snake.ppt" type="number" class="config-input" placeholder="5" />
              </div>
            </div>
          </div>

          <!-- Fidget -->
          <div class="side-game-row" :class="{ 'side-game-on': sideGames.fidget.enabled }">
            <div class="side-game-header" @click="toggleSideGame('fidget')">
              <span>😬 Fidget (never win a hole = pay everyone)</span>
              <span class="side-header-actions">
                <button class="btn-game-info btn-game-info-sm" @click.stop="toggleGameInfo('fidget')" title="How to play">ℹ️</button>
                <span class="side-toggle">{{ sideGames.fidget.enabled ? '▲' : '▼' }}</span>
              </span>
            </div>
            <div v-if="gameInfoKey === 'fidget'" class="game-info-popover game-info-inline">
              <p class="game-info-desc">{{ getGameDef('fidget')?.desc }}</p>
              <div class="game-info-section"><strong>Rules:</strong> {{ getGameDef('fidget')?.rules }}</div>
              <div v-if="getGameDef('fidget')?.example" class="game-info-section"><strong>Example:</strong> {{ getGameDef('fidget')?.example }}</div>
              <button class="btn-close-info" @click="gameInfoKey = null">Got it</button>
            </div>
            <div v-if="sideGames.fidget.enabled" class="side-game-config">
              <div class="config-field">
                <label>$ paid to each player</label>
                <input v-model.number="sideGames.fidget.ppp" type="number" class="config-input" placeholder="10" />
              </div>
            </div>
          </div>

          <!-- 1v1 Side Match -->
          <div class="side-game-row" :class="{ 'side-game-on': sideGames.match1.enabled }">
            <div class="side-game-header" @click="toggleSideGame('match1')">
              <span>⚔️ 1v1 Side Match</span>
              <span class="side-toggle">{{ sideGames.match1.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.match1.enabled" class="side-game-config">
              <!-- Players row: 2 cols side-by-side with vs separator -->
              <div class="sm-players-row">
                <div class="sm-player-field">
                  <label>Player A</label>
                  <select v-model="sideGames.match1.player1" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ wizDisplayName(p) }}</option>
                  </select>
                </div>
                <div class="sm-vs">vs</div>
                <div class="sm-player-field">
                  <label>Player B</label>
                  <select v-model="sideGames.match1.player2" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ wizDisplayName(p) }}</option>
                  </select>
                </div>
              </div>

              <!-- Scoring mode: full width -->
              <div class="config-field sm-full">
                <label>Scoring mode</label>
                <select v-model="sideGames.match1.scoring" class="config-select">
                  <option value="closeout">Closeout — fixed stake on match result</option>
                  <option value="nassau">Nassau — front / back / overall + presses</option>
                  <option value="skins">Skins — $ per hole won</option>
                </select>
              </div>

              <!-- Closeout / Skins: single stake field -->
              <div v-if="sideGames.match1.scoring !== 'nassau'" class="config-field sm-full">
                <label>{{ sideGames.match1.scoring === 'closeout' ? '$ stake (paid on win)' : '$ per hole won' }}</label>
                <input v-model.number="sideGames.match1.ppt" type="number" class="config-input" placeholder="10" />
              </div>

              <!-- Nassau: front/back/overall + press -->
              <template v-else>
                <div class="sm-nassau-row">
                  <div class="config-field">
                    <label>Front 9 $</label>
                    <input v-model.number="sideGames.match1.front" type="number" min="1" class="config-input" placeholder="10" />
                  </div>
                  <div class="config-field">
                    <label>Back 9 $</label>
                    <input v-model.number="sideGames.match1.back" type="number" min="1" class="config-input" placeholder="10" />
                  </div>
                  <div class="config-field">
                    <label>Overall $</label>
                    <input v-model.number="sideGames.match1.overall" type="number" min="1" class="config-input" placeholder="20" />
                  </div>
                </div>
                <div class="config-field sm-full">
                  <label>Auto-press at</label>
                  <select v-model.number="sideGames.match1.pressAt" class="config-select">
                    <option :value="0">No press</option>
                    <option :value="1">1 down</option>
                    <option :value="2">2 down</option>
                    <option :value="3">3 down</option>
                  </select>
                </div>
              </template>
            </div>
          </div>

          <!-- 2nd 1v1 Side Match -->
          <div v-if="sideGames.match1.enabled" class="side-game-row" :class="{ 'side-game-on': sideGames.match2.enabled }">
            <div class="side-game-header" @click="toggleSideGame('match2')">
              <span>⚔️ 2nd Side Match</span>
              <span class="side-toggle">{{ sideGames.match2.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.match2.enabled" class="side-game-config">
              <div class="sm-players-row">
                <div class="sm-player-field">
                  <label>Player A</label>
                  <select v-model="sideGames.match2.player1" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ wizDisplayName(p) }}</option>
                  </select>
                </div>
                <div class="sm-vs">vs</div>
                <div class="sm-player-field">
                  <label>Player B</label>
                  <select v-model="sideGames.match2.player2" class="config-select">
                    <option value="">— select —</option>
                    <option v-for="p in form.players" :key="p.id" :value="p.id">{{ wizDisplayName(p) }}</option>
                  </select>
                </div>
              </div>

              <div class="config-field sm-full">
                <label>Scoring mode</label>
                <select v-model="sideGames.match2.scoring" class="config-select">
                  <option value="closeout">Closeout — fixed stake on match result</option>
                  <option value="nassau">Nassau — front / back / overall + presses</option>
                  <option value="skins">Skins — $ per hole won</option>
                </select>
              </div>

              <div v-if="sideGames.match2.scoring !== 'nassau'" class="config-field sm-full">
                <label>{{ sideGames.match2.scoring === 'closeout' ? '$ stake (paid on win)' : '$ per hole won' }}</label>
                <input v-model.number="sideGames.match2.ppt" type="number" class="config-input" placeholder="10" />
              </div>

              <template v-else>
                <div class="sm-nassau-row">
                  <div class="config-field">
                    <label>Front 9 $</label>
                    <input v-model.number="sideGames.match2.front" type="number" min="1" class="config-input" placeholder="10" />
                  </div>
                  <div class="config-field">
                    <label>Back 9 $</label>
                    <input v-model.number="sideGames.match2.back" type="number" min="1" class="config-input" placeholder="10" />
                  </div>
                  <div class="config-field">
                    <label>Overall $</label>
                    <input v-model.number="sideGames.match2.overall" type="number" min="1" class="config-input" placeholder="20" />
                  </div>
                </div>
                <div class="config-field sm-full">
                  <label>Auto-press at</label>
                  <select v-model.number="sideGames.match2.pressAt" class="config-select">
                    <option :value="0">No press</option>
                    <option :value="1">1 down</option>
                    <option :value="2">2 down</option>
                    <option :value="3">3 down</option>
                  </select>
                </div>
              </template>
            </div>
          </div>

          <!-- Best Ball trackers -->
          <div class="side-game-row" :class="{ 'side-game-on': sideGames.bbn.enabled }">
            <div class="side-game-header" @click="toggleSideGame('bbn')">
              <span>🏅 Best Ball Tracker</span>
              <span class="side-toggle">{{ sideGames.bbn.enabled ? '▲' : '▼' }}</span>
            </div>
            <div v-if="sideGames.bbn.enabled" class="side-game-config">
              <div v-for="tracker in bbnTrackers" :key="tracker.id" style="margin-bottom:8px">
                <div class="config-row">
                  <div class="config-field">
                    <label>Balls</label>
                    <select v-model.number="tracker.ballsToCount" class="config-select">
                      <option :value="1">1 Best</option>
                      <option :value="2">2 Best</option>
                      <option :value="3">3 Best</option>
                      <option :value="4">All 4</option>
                    </select>
                  </div>
                  <div class="config-field">
                    <label>Scoring</label>
                    <select v-model="tracker.scoring" class="config-select">
                      <option value="net">Net</option>
                      <option value="gross">Gross</option>
                    </select>
                  </div>
                  <div class="config-field" style="flex:0;align-self:flex-end">
                    <button class="remove-btn" @click="removeBbnTracker(tracker.id)" v-if="bbnTrackers.length > 1" title="Remove">✕</button>
                  </div>
                </div>
              </div>
              <button class="btn-ghost btn-sm" style="align-self:flex-start" @click="addBbnTracker">+ Add tracker</button>
            </div>
          </div>
        </div>

      </div>

      <!-- ── Step 4: Opponent group ─────────────────────────── -->
      <div v-if="step === 4" class="wizard-step">
        <div class="opp-step-question">Playing against another group today?</div>
        <div class="opp-step-sub">You can always set this later from the ⚙️ menu.</div>

        <!-- Yes / No cards -->
        <div v-if="form.withOpponents === null" class="opp-yn-row">
          <button class="opp-yn-btn opp-yn-btn--yes" @click="form.withOpponents = true">
            <span class="opp-yn-icon">⚔️</span>
            <span class="opp-yn-label">Yes — pick their players</span>
          </button>
          <button class="opp-yn-btn opp-yn-btn--no" @click="skipOpponents">
            <span class="opp-yn-icon">🚫</span>
            <span class="opp-yn-label">No — just our group</span>
          </button>
        </div>

        <!-- Picker (shown after Yes) -->
        <div v-if="form.withOpponents === true" class="opp-pick-area">
          <div class="opp-pick-header">
            <span class="opp-pick-title">Opponent group</span>
            <button class="opp-pick-change" @click="form.withOpponents = null; form.opponentPlayers = []">Change answer</button>
          </div>

          <!-- Selected chips -->
          <div v-if="form.opponentPlayers.length" class="opp-selected">
            <div v-for="(p, i) in form.opponentPlayers" :key="p.id" class="opp-chip">
              <span>{{ p.shortName || p.name }}</span>
              <button class="opp-chip-remove" @click="form.opponentPlayers.splice(i, 1)">×</button>
            </div>
          </div>
          <div v-else class="opp-pick-hint">Tap players below to add them</div>

          <!-- Search -->
          <input v-model="oppSearch" class="wiz-input" placeholder="Search roster…" style="margin-bottom:6px" @focus="scrollInputIntoView" />

          <!-- Roster list -->
          <div class="opp-roster">
            <template v-if="!oppSearch">
              <div v-if="oppFavorites.length" class="section-label-sm">Favorites</div>
              <div v-for="p in oppFavorites" :key="p.id"
                class="roster-option"
                :class="{ selected: isOppAdded(p), 'roster-option--dim': isPlayerAdded(p) }"
                @click="toggleOpp(p)">
                <div class="roster-info"><span class="roster-name">{{ p.name }}</span><span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span></div>
                <span class="roster-check">{{ isOppAdded(p) ? '✓' : isPlayerAdded(p) ? '(yours)' : '+' }}</span>
              </div>
              <div v-if="oppOthers.length" class="section-label-sm" style="margin-top:6px">All Players</div>
              <div v-for="p in oppOthers" :key="p.id"
                class="roster-option"
                :class="{ selected: isOppAdded(p), 'roster-option--dim': isPlayerAdded(p) }"
                @click="toggleOpp(p)">
                <div class="roster-info"><span class="roster-name">{{ p.name }}</span><span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span></div>
                <span class="roster-check">{{ isOppAdded(p) ? '✓' : isPlayerAdded(p) ? '(yours)' : '+' }}</span>
              </div>
            </template>
            <template v-else>
              <div v-for="p in oppFiltered" :key="p.id"
                class="roster-option"
                :class="{ selected: isOppAdded(p), 'roster-option--dim': isPlayerAdded(p) }"
                @click="toggleOpp(p)">
                <div class="roster-info"><span class="roster-name">{{ p.name }}</span><span class="roster-hcp">idx {{ p.ghin_index ?? '—' }}</span></div>
                <span class="roster-check">{{ isOppAdded(p) ? '✓' : isPlayerAdded(p) ? '(yours)' : '+' }}</span>
              </div>
            </template>
          </div>

          <!-- Guest quick-add -->
          <div class="quick-add-row" style="margin-top:8px">
            <input v-model="oppGuestName" class="wiz-input" placeholder="Add guest opponent…" @keydown.enter="quickAddOpp" />
            <input v-model="oppGuestHcp" class="wiz-input wiz-input-sm" placeholder="HCP" type="number" step="0.1" />
            <button class="btn-ghost btn-sm" @click="quickAddOpp">Add</button>
          </div>
        </div>
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

    <!-- Creation error overlay with copy-to-diagnose -->
    <div v-if="creationError" class="gw-error-backdrop" @click.self="creationError = null">
      <div class="gw-error-card">
        <div class="gw-error-title">⚠️ Couldn't create round</div>
        <div class="gw-error-msg">{{ creationError.message }}</div>

        <details class="gw-error-details">
          <summary>Diagnostic info</summary>
          <pre id="gw-diag-text" class="gw-error-pre">{{ formatDiagnostic(creationError.info) }}</pre>
        </details>

        <!-- If we've timed out multiple times recently, the iOS connection pool
             is likely stuck. A full reload is the reliable way to recover. -->
        <div v-if="creationError.recentTimeouts >= 2" class="gw-error-reload-card">
          <div class="gw-error-reload-title">🔄 Stuck connection detected</div>
          <div class="gw-error-reload-body">
            iOS has gotten stuck on a dead network connection. Tap below to fully reload the app — this almost always fixes it.
          </div>
          <button class="gw-error-btn gw-error-btn--reload" @click="reloadApp">
            Reload GolfWizard
          </button>
        </div>

        <div class="gw-error-actions">
          <button class="gw-error-btn gw-error-btn--copy" @click="copyDiagnostic">
            {{ creationError.copied ? '✓ Copied' : '📋 Copy diagnostic info' }}
          </button>
          <button class="gw-error-btn" @click="creationError = null">Close</button>
        </div>
        <div class="gw-error-hint">
          Paste the diagnostic into chat and I can pinpoint the exact failure.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore } from '../stores/roster'
import { useRoundsStore } from '../stores/rounds'
import { GAME_DEFS } from '../modules/courses'

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
        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        background: isOn
          ? (team === 1 ? 'rgba(96,165,250,.25)' : 'rgba(248,113,113,.25)')
          : 'rgba(255,255,255,.04)',
        color: isOn
          ? (team === 1 ? '#60a5fa' : '#f87171')
          : 'rgba(240,237,224,.5)',
      }
    }
    function randomize() {
      const ids = (props.players || []).map(p => p.id)
      // Fisher-Yates shuffle
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]]
      }
      const half = Math.ceil(ids.length / 2)
      emit('update:team1', ids.slice(0, half))
      emit('update:team2', ids.slice(half))
    }
    const randomBtnStyle = {
      display: 'block', width: '100%', padding: '9px', marginBottom: '10px',
      borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
      border: '1px solid rgba(212,175,55,.3)', background: 'rgba(212,175,55,.08)',
      color: '#d4af37', fontFamily: 'inherit', textAlign: 'center',
      WebkitTapHighlightColor: 'transparent',
    }
    return () => h('div', { style: { marginTop: '12px' } }, [
      h('button', { style: randomBtnStyle, onClick: randomize }, '🎲 Randomize Teams'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, [
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
      ]),
    ])
  },
}

const emit = defineEmits(['close', 'created', 'setup-course'])
const props = defineProps({
  // When a linked-match invitee opens the wizard we lock course/tee to the
  // host's selection so the 4v4 math is apples-to-apples. Empty string or
  // null means "no lock, full picker available".
  lockedCourse: { type: String, default: null },
  lockedTee: { type: String, default: null },
  lockedHint: { type: String, default: null },
  // Pre-populated players (linked match accept flow). When provided the
  // wizard skips straight to the games step.
  lockedPlayers: { type: Array, default: null },
  // Start on a specific step (1-4). Used by accept flow to skip to games.
  startStep: { type: Number, default: 1 },
  // Render without the full-screen modal overlay (embedded in another view).
  inline: { type: Boolean, default: false },
})
const coursesStore = useCoursesStore()
const rosterStore = useRosterStore()
const roundsStore = useRoundsStore()

const step = ref(props.startStep || 1)
// When lockedPlayers is set (inline accept flow), skip the opponent step — already linked via invite
const totalSteps = computed(() => props.lockedPlayers ? 3 : 4)
const stepTitle = computed(() => {
  return { 1: 'Where are you playing?', 2: "Who's playing?", 3: 'Set up games', 4: 'Opponent group?' }[step.value] || ''
})
const creating = ref(false)
const creationError = ref(null) // { message, log, copied }

// Pre-flight connectivity warning state.
// We do NOT run a proactive ping on open — that caused false positives on
// slow-but-working connections. Instead we show the stuck-connection warning
// ONLY after a creation attempt has actually timed out in this session
// (detected by counting timeout entries in the create log).
// The user can also manually trigger a re-check after force-quitting.
const preflightOk = ref(true)   // default true — don't block the wizard
const preflightRetrying = ref(false)

// Re-run preflight after the user says they've force-quit.
// If it passes now → dismiss the warning. If still stuck → keep showing it.
async function recheckPreflight() {
  preflightRetrying.value = true
  preflightOk.value = null
  try {
    const { supaPreflightOk } = await import('../modules/supaRaw')
    const ok = await supaPreflightOk(5000)
    preflightOk.value = ok
    if (ok) {
      // Connection is back — clear the create log so the next attempt starts fresh
      try { localStorage.removeItem('gw_create_log') } catch {}
    }
  } catch {
    preflightOk.value = false
  }
  preflightRetrying.value = false
}

function reloadNow() {
  // Note: on iOS PWA, window.location.reload() / replace() does NOT restart
  // WKWebView's connection pool — only a force-quit does. Kept here as last
  // resort but the UI now emphasizes force-quit instead.
  try { localStorage.removeItem('gw_create_log') } catch {}
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('_reload', Date.now().toString())
    window.location.replace(u.toString())
  } catch {
    window.location.reload()
  }
}

function buildDiagnosticPayload(errorMessage) {
  const log = []
  try {
    const raw = localStorage.getItem('gw_create_log') || '[]'
    log.push(...JSON.parse(raw))
  } catch {}
  const ua = navigator.userAgent
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone
  const info = {
    when: new Date().toISOString(),
    error: errorMessage,
    app: __APP_VERSION__,
    online: navigator.onLine,
    pwa: !!isStandalone,
    ua,
    log: log.slice(-40),
  }
  return info
}

function formatDiagnostic(info) {
  return [
    `GolfWizard creation failure — ${info.when}`,
    `Error: ${info.error}`,
    `App version: ${info.app}`,
    `Online: ${info.online}  PWA: ${info.pwa}`,
    `UA: ${info.ua}`,
    '',
    'Recent trace:',
    ...info.log.map(l => `  ${l.t}  ${l.msg}`),
  ].join('\n')
}

async function copyDiagnostic() {
  if (!creationError.value) return
  const text = formatDiagnostic(creationError.value.info)
  try {
    await navigator.clipboard.writeText(text)
    creationError.value.copied = true
    setTimeout(() => { if (creationError.value) creationError.value.copied = false }, 2000)
  } catch {
    // Fallback: select the <pre> so user can long-press to copy manually
    const el = document.getElementById('gw-diag-text')
    if (el) {
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
}

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
  vegas:       { ppt: 1, birdieFlip: true, scoring: 'net', team1: [], team2: [] },
  match:       { ppt: 20, format: '2v2', player1: '', player2: '', team1: [], team2: [] },
  skins:       { ppt: 5, carry: true },
  hilow:       { ppt: 5, team1: [], team2: [] },
  stableford:  { ppt: 1 },
  wolf:        { ppt: 5, wolfLoneMultiplier: 2, wolfTeeOrder: [], blindWolfEnabled: true, lastPlaceWolf: false, wolfChoices: {} },
  hammer:      { ppt: 1, team1: [], team2: [] },
  sixes:       { ppt: 1 },
  fiveThreeOne:{ ppt: 1 },
  bestball:    { ppt: 5, ballsPerTeam: 1, team1: [], team2: [] },
  none:        {},
}

const mainGame = ref({
  type: 'none',
  config: { ...GAME_DEFAULTS.none },
})
const showMainGrid = ref(true)
const gameInfoKey = ref(null) // which game's info popover is open

function toggleGameInfo(key) {
  gameInfoKey.value = gameInfoKey.value === key ? null : key
}
function getGameDef(key) {
  // Map wizard keys to GAME_DEFS keys
  const keyMap = { hilow: 'hilow', fiveThreeOne: 'fiveThreeOne', bestball: 'bestball', match1: 'match1v1', match2: 'match1v1' }
  return GAME_DEFS[keyMap[key] || key] || null
}

const sideGames = ref({
  skins:  { enabled: false, ppt: 5, carry: true },
  dots:   { enabled: false, ppt: 2, birdieEnabled: true, eagleEnabled: true, greenieEnabled: true, sandieEnabled: true },
  snake:  { enabled: false, ppt: 5 },
  fidget: { enabled: false, ppp: 10 },
  match1: { enabled: false, player1: '', player2: '', ppt: 10, scoring: 'closeout', front: 10, back: 10, overall: 20, pressAt: 2 },
  match2: { enabled: false, player1: '', player2: '', ppt: 10, scoring: 'closeout', front: 10, back: 10, overall: 20, pressAt: 2 },
  bbn:    { enabled: false },
})

// Best Ball trackers — multiple allowed (foursome-wide, not team-based)
const bbnTrackers = ref([
  { id: 1, ballsToCount: 1, scoring: 'net' },
])
let bbnNextId = 2

function addBbnTracker() {
  bbnTrackers.value.push({ id: bbnNextId++, ballsToCount: 1, scoring: 'net' })
}

function removeBbnTracker(id) {
  bbnTrackers.value = bbnTrackers.value.filter(t => t.id !== id)
}

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
  // Collapse grid once a real game is picked
  if (key !== 'none') showMainGrid.value = false
  gameInfoKey.value = null
}

function toggleSideGame(key) {
  sideGames.value[key].enabled = !sideGames.value[key].enabled
}

// ── Form state ───────────────────────────────────────────────────
const form = ref({
  courseName: props.lockedCourse || '',
  tee: props.lockedTee || '',
  date: new Date().toISOString().slice(0, 10),
  holesMode: '18',
  players: props.lockedPlayers ? props.lockedPlayers.map(p => ({ ...p, ghinIndex: p.ghinIndex ?? p.ghin_index ?? null })) : [],
  withOpponents: props.lockedPlayers ? false : null,   // auto-false in accept flow (already linked via invite)
  opponentPlayers: [],
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
// Sort by last name (last word in name), then first name as tiebreaker
function lastNameKey(p) {
  const parts = (p.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '~~~' // push empties to end
  const last = parts[parts.length - 1].toLowerCase()
  const first = (parts[0] || '').toLowerCase()
  return last + '|' + first
}
function byLastName(a, b) {
  return lastNameKey(a).localeCompare(lastNameKey(b))
}

const rosterFavorites = computed(() =>
  rosterStore.players.filter(p => p.is_favorite).slice().sort(byLastName)
)
const rosterOthers = computed(() =>
  rosterStore.players.filter(p => !p.is_favorite).slice().sort(byLastName)
)

const filteredRoster = computed(() => {
  const q = playerSearch.value.toLowerCase()
  const all = rosterStore.players
  if (!q) {
    return [...rosterFavorites.value, ...rosterOthers.value]
  }
  return all.filter(p => p.name.toLowerCase().includes(q)).slice().sort(byLastName)
})

// ── Drag-to-reorder selected players ────────────────────────────
const dragIdx = ref(null)
let touchDragIdx = null
let touchDragTargetIdx = null

function onDragStart(i) { dragIdx.value = i }
function onDragOver(i) {
  if (dragIdx.value === null || dragIdx.value === i) return
  const arr = form.value.players
  const moved = arr.splice(dragIdx.value, 1)[0]
  arr.splice(i, 0, moved)
  dragIdx.value = i
}
function onDragEnd() { dragIdx.value = null }

function onTouchDragStart(e, i) {
  touchDragIdx = i
  touchDragTargetIdx = i
}
function onTouchDragMove(e) {
  if (touchDragIdx === null) return
  const touch = e.touches[0]
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  const card = el?.closest?.('.player-card')
  if (!card) return
  const cards = [...document.querySelectorAll('.player-cards .player-card')]
  const idx = cards.indexOf(card)
  if (idx >= 0 && idx !== touchDragTargetIdx) {
    const arr = form.value.players
    const moved = arr.splice(touchDragIdx, 1)[0]
    arr.splice(idx, 0, moved)
    touchDragIdx = idx
    touchDragTargetIdx = idx
  }
}
function onTouchDragEnd() {
  touchDragIdx = null
  touchDragTargetIdx = null
}

// ── Navigation guards ────────────────────────────────────────────
const canNext = computed(() => {
  if (step.value === 1) {
    if (!form.value.courseName) return false
    if (props.lockedCourse) return !!form.value.tee || true
    return teesForCourse.value.length === 0 || !!form.value.tee
  }
  if (step.value === 2) return form.value.players.length >= 1
  if (step.value === 3) return true
  // Step 4: can proceed if they answered No, or answered Yes and picked at least 1 player
  if (step.value === 4) return form.value.withOpponents === false || (form.value.withOpponents === true && form.value.opponentPlayers.length >= 1)
  return true
})
const canFinish = computed(() => {
  if (!form.value.players.length || !form.value.courseName) return false
  // Step 4: must have answered the opponent question
  if (step.value === 4) {
    if (form.value.withOpponents === null) return false
    if (form.value.withOpponents === true && form.value.opponentPlayers.length === 0) return false
  }
  return true
})

function nextStep() {
  if (step.value === 1 && canNext.value) step.value++
  else if (step.value === 2 && canNext.value) {
    autoSplitTeams()
    step.value++
  } else if (step.value === 3 && canNext.value) {
    step.value++
  }
}

function skipOpponents() {
  form.value.withOpponents = false
  form.value.opponentPlayers = []
}

function autoSplitTeams() {
  // Only auto-split if teams are empty (haven't been manually set)
  if (!mainGame.value.config.team1 && !mainGame.value.config.team2) return
  if (mainGame.value.config.team1?.length || mainGame.value.config.team2?.length) return
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

  // If this is a saved custom course in the store, use its data directly
  // Don't re-fetch from API — user may have edited tees/SI/par
  const stored = coursesStore.getCourse(c.name)
  if (stored?.isCustom && stored.teesData && Object.keys(stored.teesData).length > 0) {
    console.log('[GW-wizard] Using saved custom course data for', c.name)
    apiEnrichedTees.value[c.name] = stored.teesData
    const teeNames = Object.keys(stored.teesData)
    const preferred = typeof stored.tees === 'string' ? stored.tees : null
    form.value.tee = (preferred && teeNames.includes(preferred)) ? preferred : (teeNames[0] ?? '')
    return
  }

  // If builtin already has complete tee data, use it — don't overwrite with API data
  if (!stored?.isCustom && stored?.teesData && Object.keys(stored.teesData).length > 0) {
    console.log('[GW-wizard] Using builtin course data for', c.name)
    apiEnrichedTees.value[c.name] = stored.teesData
    const teeNames = Object.keys(stored.teesData)
    const preferred = typeof stored.tees === 'string' ? stored.tees : null
    form.value.tee = (preferred && teeNames.includes(preferred)) ? preferred : (teeNames[0] ?? '')
    return
  }

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
      // Save the course in the store ONLY if it doesn't already exist as a custom course
      // (custom courses have user edits that should not be overwritten)
      const existing = coursesStore.getCourse(courseName)
      if (existing?.isCustom) {
        // Already saved as custom — don't overwrite user edits
        console.log('[GW-wizard] Skipping API save — course already exists as custom:', courseName)
      } else if (existing && !existing.isCustom) {
        // Built-in course — only save API override if builtin has no tee data
        const hasBuiltinTees = existing.teesData && Object.keys(existing.teesData).length > 0
        if (!hasBuiltinTees) {
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
        } else {
          console.log('[GW-wizard] Builtin has complete tee data — skipping API save for', courseName)
        }
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

// ── Player display helpers ────────────────────────────────────────
function wizDisplayName(p) {
  if (!p) return '?'
  if (p?.use_nickname && p?.nickname) return p.nickname
  return p?.shortName || p?.name || '?'
}

// ── Wolf tee order helpers ────────────────────────────────────────
function wolfPlayerName(pid) {
  const p = form.value.players.find(p => p.id === pid)
  return wizDisplayName(p)
}

function wolfRandomizeOrder() {
  const ids = form.value.players.map(p => p.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]]
  }
  mainGame.value.config.wolfTeeOrder = ids
}

function wolfAddToOrder(pid) {
  if (!mainGame.value.config.wolfTeeOrder) mainGame.value.config.wolfTeeOrder = []
  if (mainGame.value.config.wolfTeeOrder.includes(pid)) return
  mainGame.value.config.wolfTeeOrder.push(pid)
}

function wolfMoveUp(idx) {
  const order = mainGame.value.config.wolfTeeOrder
  if (idx <= 0) return
  ;[order[idx - 1], order[idx]] = [order[idx], order[idx - 1]]
}

function wolfMoveDown(idx) {
  const order = mainGame.value.config.wolfTeeOrder
  if (idx >= order.length - 1) return
  ;[order[idx], order[idx + 1]] = [order[idx + 1], order[idx]]
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
      ghinSyncedAt: p.ghin_synced_at ?? null,
      nickname: p.nickname ?? null,
      use_nickname: p.use_nickname ?? false,
      profileId: p.user_id ?? null,
      email: p.email ?? null,
    })
  }
}

// ── GHIN sync dot helpers ────────────────────────────────────────
function ghinDotClass(syncedAt) {
  if (!syncedAt) return 'ghin-dot--manual'
  const days = (Date.now() - new Date(syncedAt).getTime()) / 86400000
  if (days <= 30) return 'ghin-dot--fresh'   // blue — synced within 30 days
  if (days <= 90) return 'ghin-dot--stale'   // gray — synced 30-90 days ago
  return 'ghin-dot--old'                      // red — older than 90 days
}
function ghinDotTitle(syncedAt) {
  if (!syncedAt) return 'Handicap entered manually'
  const days = Math.floor((Date.now() - new Date(syncedAt).getTime()) / 86400000)
  if (days === 0) return 'GHIN synced today'
  if (days === 1) return 'GHIN synced yesterday'
  return `GHIN synced ${days} days ago`
}

function quickAddPlayer() {
  if (!newName.value.trim()) return
  form.value.players.push({
    id: `guest_${Date.now()}`,
    name: newName.value.trim(),
    shortName: newName.value.trim().split(' ')[0].slice(0, 8),
    ghinIndex: newHcp.value ? parseFloat(newHcp.value) : null,
    nickname: null,
    use_nickname: false,
    profileId: null,
  })
  newName.value = ''
  newHcp.value = ''
}

// ── Opponent group ───────────────────────────────────────────────
const oppSearch = ref('')
const oppGuestName = ref('')
const oppGuestHcp = ref('')

const oppFavorites = computed(() =>
  rosterStore.players.filter(p => p.is_favorite).slice().sort(byLastName)
)
const oppOthers = computed(() =>
  rosterStore.players.filter(p => !p.is_favorite).slice().sort(byLastName)
)
const oppFiltered = computed(() => {
  const q = oppSearch.value.toLowerCase()
  return rosterStore.players.filter(p => p.name.toLowerCase().includes(q)).slice().sort(byLastName)
})

function isOppAdded(p) { return form.value.opponentPlayers.some(op => op.id === p.id) }

function toggleOpp(p) {
  if (isPlayerAdded(p)) return // can't be in both groups
  if (isOppAdded(p)) {
    form.value.opponentPlayers = form.value.opponentPlayers.filter(op => op.id !== p.id)
  } else {
    form.value.opponentPlayers.push({
      id: p.id, name: p.name,
      shortName: p.short_name,
      ghinIndex: p.ghin_index,
    })
  }
}

function quickAddOpp() {
  if (!oppGuestName.value.trim()) return
  form.value.opponentPlayers.push({
    id: `opp_guest_${Date.now()}`,
    name: oppGuestName.value.trim(),
    shortName: oppGuestName.value.trim().split(' ')[0].slice(0, 8),
    ghinIndex: oppGuestHcp.value ? parseFloat(oppGuestHcp.value) : null,
  })
  oppGuestName.value = ''
  oppGuestHcp.value = ''
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
  // 1v1 Side Matches — route based on scoring mode
  // closeout/skins → type:match1v1 (uses computeMatch with scoring field)
  // nassau → type:nassau with single-player teams (reuses full Nassau engine)
  function buildSideMatch(m) {
    if (!m.enabled || !m.player1 || !m.player2) return null
    if (m.scoring === 'nassau') {
      return { type: 'nassau', config: {
        team1: [m.player1], team2: [m.player2],
        front: m.front ?? 10, back: m.back ?? 10, overall: m.overall ?? 20,
        pressAt: m.pressAt ?? 2,
        _sideMatch: true,  // flag so the summary can label it "1v1 Nassau"
      }}
    }
    return { type: 'match1v1', config: {
      player1: m.player1, player2: m.player2,
      ppt: m.ppt,
      scoring: m.scoring || 'closeout',
    }}
  }
  const sm1 = buildSideMatch(sg.match1); if (sm1) games.push(sm1)
  const sm2 = buildSideMatch(sg.match2); if (sm2) games.push(sm2)
  // Best Ball trackers (only if enabled)
  if (sideGames.value.bbn.enabled) {
    for (const tracker of bbnTrackers.value) {
      games.push({
        type: 'bbn',
        config: {
          ballsToCount: tracker.ballsToCount,
          scoring: tracker.scoring,
          label: `${tracker.ballsToCount}BB ${tracker.scoring === 'gross' ? 'Gross' : 'Net'}`,
        },
      })
    }
  }

  return games
}

// ── Create round ─────────────────────────────────────────────────
function _wizLog(msg) {
  try {
    const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
    log.push({ t: new Date().toISOString(), msg: `[wiz] ${msg}` })
    localStorage.setItem('gw_create_log', JSON.stringify(log.slice(-100)))
  } catch {}
}

async function create() {
  if (creating.value) return
  creating.value = true
  // Reset log at the start of each attempt so the trace is self-contained
  try { localStorage.setItem('gw_create_log', '[]') } catch {}
  _wizLog(`create() start — app v${__APP_VERSION__}`)
  try {
    const games = buildGameConfigs()
    _wizLog(`built ${games.length} game configs`)
    // Resolve slope/rating/par for USGA course handicap formula
    const _selectedTee = teesForCourse.value.find(t => t.name === form.value.tee)
    const _slope = _selectedTee?.slope || 113
    const _rating = _selectedTee?.rating || null
    const _courseObj = coursesStore.getCourse(form.value.courseName)
    const _coursePar = Array.isArray(_courseObj?.par)
      ? _courseObj.par.reduce((s, v) => s + v, 0)
      : 72

    function _courseHcp(ghinIndex) {
      if (ghinIndex == null) return null
      if (_rating != null) {
        // USGA formula: round(index × slope/113 + (rating - par))
        return Math.round(ghinIndex * _slope / 113 + (_rating - _coursePar))
      }
      // No rating: fall back to slope-only approximation
      return Math.round(ghinIndex * _slope / 113)
    }

    const players = form.value.players.map(p => {
      const team1 = mainGame.value.config?.team1 || []
      const team2 = mainGame.value.config?.team2 || []
      const team = team1.includes(p.id) ? 1 : team2.includes(p.id) ? 2 : null
      const idx = p.ghinIndex ?? p.ghin_index ?? null
      return {
        ...p,
        team,
        roundHcp: _courseHcp(idx),
      }
    })

    console.log('[Wizard] Creating round:', { course: form.value.courseName, tee: form.value.tee, players: players.length, games: games.length })

    const roundName = form.value.courseName + ' – ' + (form.value.date || new Date().toISOString().slice(0, 10))

    // Outer timeout must be longer than SJS(5s) + raw-fetch(12s) + buffer = 25s.
    // If it fires anyway, check if the round landed in Supabase — the raw-fetch
    // often succeeds server-side but the response stream stalls on iOS.
    let round = null
    const outerTimeoutMs = 25000
    try {
      round = await Promise.race([
        roundsStore.createRound({
          name: roundName,
          courseName: form.value.courseName,
          tee: form.value.tee,
          date: form.value.date,
          holesMode: form.value.holesMode,
          withRoomCode: false,
          opponentPlayers: form.value.withOpponents ? form.value.opponentPlayers : [],
          players,
          games,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), outerTimeoutMs)
        ),
      ])
    } catch (outerErr) {
      if (outerErr.message === 'TIMEOUT') {
        // The outer timeout fired — but the round may have been created successfully.
        // Check if activeRound was set by createRound (the store sets it before returning).
        if (roundsStore.activeRound?.course_name === form.value.courseName) {
          _wizLog('outer timeout but activeRound is set — treating as success')
          round = roundsStore.activeRound
        } else {
          // Try a quick lookup for a round created in the last 30s with our course name
          try {
            const { supaRawRequest } = await import('../modules/supaRaw')
            const rows = await supaRawRequest(
              'GET',
              `rounds?select=*&course_name=eq.${encodeURIComponent(form.value.courseName)}&order=created_at.desc&limit=1`,
              null, 5000
            )
            const candidate = Array.isArray(rows) ? rows[0] : rows
            const age = candidate?.created_at ? Date.now() - new Date(candidate.created_at).getTime() : Infinity
            if (candidate && age < 60_000) {
              _wizLog(`outer timeout recovery: found round ${candidate.id.slice(0,8)} created ${age}ms ago`)
              roundsStore.activeRound = candidate
              round = candidate
            }
          } catch { /* ignore recovery failures */ }
        }
        if (!round) throw new Error('Round creation timed out. Check your connection and try again.')
      } else {
        throw outerErr
      }
    }

    console.log('[Wizard] Round created:', round?.id)

    if (round) {
      emit('created', round, {
        withOpponents: form.value.withOpponents === true,
        opponentPlayers: form.value.opponentPlayers ?? [],
        courseName: form.value.courseName,
        tee: form.value.tee,
        holesMode: form.value.holesMode,
      })
    } else {
      console.error('[Wizard] createRound returned null/undefined')
      const msg = 'Round creation returned no data.'
      creationError.value = {
        message: msg,
        info: buildDiagnosticPayload(msg),
        copied: false,
        recentTimeouts: _countRecentTimeouts(),
      }
    }
  } catch (e) {
    console.error('[Wizard] Round creation error:', e)
    const msg = e.message || 'Unknown error creating round'
    const timeouts = _countRecentTimeouts()
    // Only set preflightOk=false (show stuck-connection warning) if we've
    // seen actual timeout failures — not for other error types like 400/401.
    if (timeouts >= 2 || msg.includes('timed out') || msg.includes('timeout')) {
      preflightOk.value = false
    }
    creationError.value = {
      message: msg,
      info: buildDiagnosticPayload(msg),
      copied: false,
      recentTimeouts: timeouts,
    }
  } finally {
    creating.value = false
  }
}

// How many Supabase calls timed out in the last 60s?
// When >=2, we show the "Reload GolfWizard" button — iOS is stuck.
function _countRecentTimeouts() {
  try {
    const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
    const now = Date.now()
    return log.filter(e => {
      const age = now - new Date(e.t).getTime()
      return age < 60_000 && /timed out after \d+ms/.test(e.msg || '')
    }).length
  } catch { return 0 }
}

function reloadApp() {
  // Clear the create log so the new attempt starts fresh, then hard-reload
  try { localStorage.removeItem('gw_create_log') } catch {}
  // location.reload(true) is deprecated; replace() with cache-buster is reliable
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('_reload', Date.now().toString())
    window.location.replace(u.toString())
  } catch {
    window.location.reload()
  }
}
</script>

<style scoped>
/* ── Inline mode (embedded in accept view) ── */
.wizard-inline { display: block; }
.wizard-inline-body {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  max-height: none;
  overflow: visible;
  padding: 0;
}
/* Hide header close button and step indicator in inline mode */
.wizard-inline-body .wizard-header { display: none; }
/* Hide step 4 (opponent group) in inline mode — not relevant for accept flow */
.wizard-inline-body .wizard-step:last-child { display: none; }

/* ── Step 4: Opponent group ────────────────────────── */
.opp-step-question {
  font-family: var(--gw-font-display, Georgia);
  font-size: 22px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
  text-align: center;
  margin-top: 12px;
  margin-bottom: 6px;
  line-height: 1.25;
}
.opp-step-sub {
  font-size: 12px;
  color: rgba(240,237,224,.45);
  text-align: center;
  margin-bottom: 20px;
}
.opp-yn-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.opp-yn-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 16px;
  border: 2px solid transparent;
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: transform .1s, border-color .15s;
}
.opp-yn-btn:active { transform: scale(.97); }
.opp-yn-btn--yes {
  background: rgba(248,113,113,.1);
  border-color: rgba(248,113,113,.4);
}
.opp-yn-btn--no {
  background: rgba(255,255,255,.04);
  border-color: rgba(255,255,255,.12);
}
.opp-yn-icon { font-size: 28px; flex-shrink: 0; }
.opp-yn-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
  text-align: left;
}
.opp-pick-area { display: flex; flex-direction: column; gap: 8px; }
.opp-pick-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.opp-pick-title { font-size: 14px; font-weight: 700; color: #fca5a5; }
.opp-pick-change {
  font-size: 12px; color: rgba(240,237,224,.45); background: none;
  border: none; cursor: pointer; font-family: inherit; text-decoration: underline;
}
.opp-pick-hint { font-size: 12px; color: rgba(240,237,224,.4); }
.opp-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.opp-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  background: rgba(248,113,113,.15);
  border: 1px solid rgba(248,113,113,.35);
  font-size: 13px;
  font-weight: 700;
  color: #fca5a5;
}
.opp-chip-remove {
  background: none; border: none; color: rgba(252,165,165,.7);
  cursor: pointer; font-size: 15px; padding: 0; line-height: 1;
}
.opp-roster {
  max-height: 220px;
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.08);
}
.roster-option--dim { opacity: 0.35; pointer-events: none; }
.wiz-input--sm { padding: 8px 12px; font-size: 13px; }

/* ── Wolf Tee Order ────────────────────────────────── */
.wolf-tee-order-section { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(96,165,250,.06); border: 1px solid rgba(96,165,250,.2); }
.config-sublabel { font-size: 12px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; }
.wolf-order-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; }
.wolf-order-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
}
.wolf-order-num { font-size: 18px; font-weight: 900; color: #60a5fa; width: 24px; text-align: center; }
.wolf-order-name { flex: 1; font-size: 14px; font-weight: 700; color: var(--gw-text, #f0ede0); }
.wolf-h1-badge {
  font-size: 9px; background: rgba(212,175,55,.15); border: 1px solid rgba(212,175,55,.3);
  border-radius: 5px; padding: 2px 7px; color: #d4af37; font-weight: 700;
}
.wolf-order-btn {
  padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12); color: #f0ede0; cursor: pointer;
  font-family: inherit; font-size: 13px;
}
.wolf-pick-players { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.wolf-pick-player-btn {
  padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
  border: 1px solid rgba(96,165,250,.3); background: rgba(96,165,250,.1); color: #60a5fa;
  font-family: inherit;
}
.wolf-reset-btn, .wolf-auto-btn {
  margin-top: 8px; font-size: 10px; padding: 5px 10px; border-radius: 6px;
  background: none; border: 1px solid rgba(255,255,255,.15); color: rgba(240,237,224,.5);
  cursor: pointer; font-family: inherit;
}
.wolf-options { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.wolf-option-toggle {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--gw-text, #f0ede0);
}
.wolf-toggle {
  width: 28px; height: 16px; border-radius: 8px; background: rgba(255,255,255,.15);
  position: relative; flex-shrink: 0; transition: background .2s;
}
.wolf-toggle::after {
  content: ''; width: 12px; height: 12px; border-radius: 50%; background: #f0ede0;
  position: absolute; top: 2px; left: 2px; transition: left .2s;
}
.wolf-toggle.on { background: rgba(212,175,55,.5); }
.wolf-toggle.on::after { left: 14px; }

/* ── Creation error overlay with diagnostic copy ─────────── */
.gw-error-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  z-index: 10000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.gw-error-card {
  width: 100%; max-width: 440px;
  background: var(--gw-neutral-800, #1e2720);
  border: 1px solid rgba(239,68,68,.3);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
  animation: card-in 200ms ease-out;
}
.gw-error-title {
  font-family: var(--gw-font-display, serif);
  font-size: 20px; font-weight: 700;
  color: #f87171;
  margin-bottom: 8px;
}
.gw-error-msg {
  color: var(--gw-text, #f0ede0);
  font-size: 14px; line-height: 1.4;
  margin-bottom: 14px;
}
.gw-error-details {
  margin-bottom: 14px;
}
.gw-error-details summary {
  cursor: pointer;
  font-size: 12px; font-weight: 600;
  color: var(--gw-text-muted, #a3b8aa);
  padding: 6px 0;
  user-select: none;
}
.gw-error-pre {
  margin: 8px 0 0;
  max-height: 200px;
  overflow: auto;
  background: rgba(0,0,0,.4);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px;
  padding: 8px 10px;
  font-family: var(--gw-font-mono, monospace);
  font-size: 10px;
  color: rgba(240,237,224,.8);
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-all;
  -webkit-user-select: text;
  user-select: text;
}
.gw-error-actions {
  display: flex; gap: 8px;
  margin-bottom: 10px;
}
.gw-error-btn {
  flex: 1;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px; font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.06);
  color: var(--gw-text, #f0ede0);
  -webkit-tap-highlight-color: transparent;
}
.gw-error-btn:active { transform: scale(.97); }
.gw-error-btn--copy {
  background: linear-gradient(135deg, #d4af37 0%, #b8961e 100%);
  color: #0c0f0d;
  border: none;
}
.gw-error-reload-card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(59,130,246,.1);
  border: 1px solid rgba(59,130,246,.4);
}

/* Wizard pre-flight warning (stuck connection detected on open) */
.wiz-preflight-warn {
  margin: 10px 14px 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(239,68,68,.12);
  border: 2px solid rgba(239,68,68,.5);
}
.wpw-title {
  font-size: 15px; font-weight: 900; color: #f87171; margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
}
.wpw-body {
  font-size: 13px; line-height: 1.5; color: rgba(240,237,224,.85); margin-bottom: 10px;
}
.wpw-body strong { color: #fecaca; }

.wpw-steps {
  margin: 0 0 14px 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wpw-steps li {
  font-size: 14px;
  line-height: 1.45;
  color: rgba(240,237,224,.9);
}
.wpw-steps li strong { color: #fff; font-weight: 800; }

.wpw-btn {
  width: 100%; padding: 13px 14px; border-radius: 12px;
  font-weight: 800; border: none; cursor: pointer;
  font-family: inherit; font-size: 14px;
  -webkit-tap-highlight-color: transparent;
  letter-spacing: .2px;
}
.wpw-btn--recheck {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #052e16;
}
.wpw-btn--recheck:active { transform: scale(.98); }

.wpw-checking {
  text-align: center;
  padding: 12px;
  font-size: 14px;
  color: rgba(240,237,224,.7);
  font-weight: 600;
  animation: wpw-spin 1s linear infinite;
}
@keyframes wpw-spin {
  0% { opacity: .4; } 50% { opacity: 1; } 100% { opacity: .4; }
}

.wpw-note {
  margin-top: 10px;
  font-size: 10px;
  color: rgba(240,237,224,.35);
  line-height: 1.4;
  text-align: center;
}
.gw-error-reload-title {
  font-size: 13px;
  font-weight: 800;
  color: #93c5fd;
  margin-bottom: 6px;
}
.gw-error-reload-body {
  font-size: 12px;
  color: rgba(240,237,224,.75);
  line-height: 1.45;
  margin-bottom: 10px;
}
.gw-error-btn--reload {
  width: 100%;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  color: #0c1836;
  border: none;
  font-weight: 800;
}
.gw-error-hint {
  font-size: 11px;
  color: rgba(240,237,224,.4);
  text-align: center;
  line-height: 1.4;
}
</style>
