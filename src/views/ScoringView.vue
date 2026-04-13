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
        <div class="header-right-actions">
          <router-link to="/library" class="btn-rules-sm">📖</router-link>
          <button class="btn-round-menu" @click="showRoundMenu = !showRoundMenu">⚙️</button>
        </div>
        <div v-if="showRoundMenu" class="round-menu-dropdown">
          <button class="round-menu-item" @click="showRoundMenu = false; showGameEditor = true">
            🎲 Edit Games & Stakes
          </button>
          <button class="round-menu-item" @click="showRoundMenu = false; finishRound()" v-if="!roundsStore.activeRound?.is_complete">
            ✅ Finish Round
          </button>
          <button class="round-menu-item round-menu-danger" @click="showRoundMenu = false; confirmDeleteActive = true">
            🗑️ Delete Round
          </button>
        </div>
      </header>

      <!-- Delete active round confirmation -->
      <div v-if="confirmDeleteActive" class="delete-overlay" @click="confirmDeleteActive = false">
        <div class="delete-dialog" @click.stop>
          <div class="delete-title">Delete this round?</div>
          <div class="delete-msg">This will permanently delete the current round and all scores. This cannot be undone.</div>
          <div class="delete-actions">
            <button class="btn-cancel" @click="confirmDeleteActive = false">Cancel</button>
            <button class="btn-delete-confirm" @click="deleteActiveRound">Delete</button>
          </div>
        </div>
      </div>

      <!-- ── Game Editor Overlay ────────────────────────────────── -->
      <div v-if="showGameEditor" class="delete-overlay" @click="showGameEditor = false">
        <div class="game-editor-panel" @click.stop>
          <div class="game-editor-header">
            <h3 class="game-editor-title">🎲 Edit Games</h3>
            <button class="close-btn-sm" @click="showGameEditor = false">✕</button>
          </div>

          <!-- Existing games -->
          <div v-for="game in roundsStore.activeGames" :key="game.id" class="ge-game-row">
            <div class="ge-game-info">
              <span class="ge-game-icon">{{ gameIcon(game.type) }}</span>
              <span class="ge-game-name">{{ gameLabel(game.type, game.config) }}</span>
            </div>
            <div class="ge-game-controls">
              <!-- Editable stakes -->
              <template v-if="game.type?.toLowerCase() === 'nassau'">
                <label class="ge-stake-label">F/B/O $</label>
                <input type="number" class="ge-stake-input" :value="game.config?.front ?? 10" min="1" @change="updateGameStake(game, 'nassau-front', +$event.target.value)" />
                <input type="number" class="ge-stake-input" :value="game.config?.back ?? 10" min="1" @change="updateGameStake(game, 'nassau-back', +$event.target.value)" />
                <input type="number" class="ge-stake-input" :value="game.config?.overall ?? 20" min="1" @change="updateGameStake(game, 'nassau-overall', +$event.target.value)" />
              </template>
              <template v-else-if="game.config?.ppt != null">
                <label class="ge-stake-label">$/pt</label>
                <input type="number" class="ge-stake-input" :value="game.config.ppt" min="1" @change="updateGameStake(game, 'ppt', +$event.target.value)" />
              </template>
              <template v-else-if="game.config?.ppp != null">
                <label class="ge-stake-label">$/player</label>
                <input type="number" class="ge-stake-input" :value="game.config.ppp" min="1" @change="updateGameStake(game, 'ppp', +$event.target.value)" />
              </template>
              <button class="ge-remove-btn" @click="removeGame(game.id)">✕</button>
            </div>
          </div>

          <div v-if="roundsStore.activeGames.length === 0" class="ge-empty">No games added yet</div>

          <!-- Add new game -->
          <div class="ge-add-section">
            <div class="ge-add-label">Add Game:</div>
            <div class="ge-add-btns">
              <button v-for="gt in addableGameTypes" :key="gt.type" class="ge-add-btn" @click="addNewGame(gt.type)">
                {{ gt.icon }} {{ gt.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

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

        <!-- Finish Round Banner -->
        <div v-if="roundCompletionInfo.allScored && !roundsStore.activeRound?.is_complete" class="finish-banner finish-ready">
          <div class="finish-banner-text">
            <div class="finish-banner-title">All {{ visibleHoles.length }} holes scored!</div>
            <div class="finish-banner-sub">Ready to finalize this round?</div>
          </div>
          <button class="finish-btn" @click="finishRound">Finish Round</button>
        </div>
        <div v-else-if="roundCompletionInfo.scoredCount > 0 && !roundCompletionInfo.allScored && !roundsStore.activeRound?.is_complete" class="finish-banner finish-partial">
          <div class="finish-banner-text">
            <div class="finish-banner-title">{{ roundCompletionInfo.scoredCount }}/{{ visibleHoles.length }} holes scored</div>
            <div class="finish-banner-sub">{{ roundCompletionInfo.missingHoles.length }} holes missing scores</div>
          </div>
          <button class="finish-btn finish-btn-review" @click="activeHole = roundCompletionInfo.missingHoles[0]">Go to H{{ roundCompletionInfo.missingHoles[0] }}</button>
        </div>
        <div v-else-if="roundsStore.activeRound?.is_complete" class="finish-banner finish-done">
          <div class="finish-banner-text">
            <div class="finish-banner-title">Round Complete ✓</div>
          </div>
        </div>

        <!-- Live Games Summary -->
        <div v-if="roundsStore.activeGames.length > 0" class="live-games-box">
          <div class="live-games-label">🎲 Live Games</div>
          <div v-for="game in roundsStore.activeGames" :key="game.id" class="live-game-row">
            <span class="live-game-icon">{{ gameIcon(game.type) }}</span>
            <span class="live-game-name">{{ gameLabel(game.type, game.config) }}</span>
            <span class="live-game-status" v-html="gameLiveSummary(game)"></span>
          </div>
        </div>

        <!-- Scorecard controls -->
        <div v-if="gameNotationRows.length > 0" class="scorecard-controls">
          <button class="notation-toggle-btn" @click="showNotations = !showNotations">
            {{ showNotations ? '🔽 Hide Games' : '🔼 Show Games' }}
          </button>
        </div>

        <!-- Horizontal Scorecard Grid -->
        <div class="scorecard-scroll">
          <table class="scorecard-grid">
            <thead>
              <tr class="row-header">
                <th class="col-sticky col-player-header">Player</th>
                <!-- Front 9 -->
                <th v-for="h in frontHoles" :key="h" class="col-hole-num" @click="activeHole = h">{{ h }}</th>
                <!-- OUT subtotal -->
                <th v-if="hasBack9" class="col-subtotal">OUT</th>
                <!-- Back 9 -->
                <th v-for="h in backHoles" :key="h" class="col-hole-num" @click="activeHole = h">{{ h }}</th>
                <!-- IN subtotal -->
                <th v-if="hasBack9" class="col-subtotal">IN</th>
                <!-- Totals -->
                <th class="col-total">G</th>
                <th class="col-total">N</th>
              </tr>
              <!-- Par row -->
              <tr class="row-par">
                <td class="col-sticky col-par-label">Par</td>
                <!-- Front 9 par -->
                <td v-for="h in frontHoles" :key="'p'+h" class="col-par-val">{{ parForHole(h) }}</td>
                <!-- OUT par -->
                <td v-if="hasBack9" class="col-subtotal par-sub">{{ parTotal(frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
                <!-- Back 9 par -->
                <td v-for="h in backHoles" :key="'p'+h" class="col-par-val">{{ parForHole(h) }}</td>
                <!-- IN par -->
                <td v-if="hasBack9" class="col-subtotal par-sub">{{ parTotal(backHoles[0], backHoles[backHoles.length-1]) }}</td>
                <!-- Total par -->
                <td class="col-total par-sub">{{ parTotal(visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
                <td class="col-total"></td>
              </tr>
              <!-- SI row -->
              <tr class="row-si">
                <td class="col-sticky col-par-label">SI</td>
                <!-- Front 9 SI -->
                <td v-for="h in frontHoles" :key="'si'+h" class="col-si-val">{{ siForHole(h) }}</td>
                <!-- OUT SI -->
                <td v-if="hasBack9" class="col-subtotal"></td>
                <!-- Back 9 SI -->
                <td v-for="h in backHoles" :key="'si'+h" class="col-si-val">{{ siForHole(h) }}</td>
                <!-- IN SI -->
                <td v-if="hasBack9" class="col-subtotal"></td>
                <!-- Total SI -->
                <td class="col-total"></td>
                <td class="col-total"></td>
              </tr>
              <!-- Yardage row -->
              <tr v-if="hasYardage" class="row-yards">
                <td class="col-sticky col-par-label">Yds</td>
                <!-- Front 9 yards -->
                <td v-for="h in frontHoles" :key="'y'+h" class="col-yards-val">{{ yardsForHole(h) || '' }}</td>
                <!-- OUT yards -->
                <td v-if="hasBack9" class="col-subtotal"></td>
                <!-- Back 9 yards -->
                <td v-for="h in backHoles" :key="'y'+h" class="col-yards-val">{{ yardsForHole(h) || '' }}</td>
                <!-- IN yards -->
                <td v-if="hasBack9" class="col-subtotal"></td>
                <!-- Total yards -->
                <td class="col-total"></td>
                <td class="col-total"></td>
              </tr>
            </thead>
            <tbody>
              <!-- Players grouped by team with divider -->
              <template v-for="(group, gi) in sortedPlayerGroups" :key="'grp-'+gi">
                <tr v-if="gi > 0 && group.team !== sortedPlayerGroups[gi-1].team" class="row-team-divider">
                  <td :colspan="visibleHoles.length + (hasBack9 ? 6 : 2) + 1" class="team-divider-cell"></td>
                </tr>
                <tr
                  class="row-player"
                  :class="teamRowClass(group.member)"
                >
                  <td class="col-sticky col-player-name" :class="teamStickyClass(group.member)">
                    <span class="team-color-bar" :class="teamBarClass(group.member)"></span>
                    <span class="player-nm" :class="teamTextClass(group.member)">{{ group.member.short_name || group.member.guest_name }}</span>
                    <span class="player-hcp">{{ memberHandicapDisplay(group.member) }}<span v-if="lowManStrokes(group.member) !== null" class="hcp-lowman">({{ lowManStrokes(group.member) }})</span></span>
                  </td>
                  <!-- Front 9 scores -->
                  <td
                    v-for="h in frontHoles"
                    :key="h"
                    class="col-score-cell"
                    :class="{ 'cell-winner': isNetWinner(group.member.id, h), 'cell-defidget': isFidgetWinner(group.member.id, h) }"
                    @click="activeHole = h"
                  >
                    <span v-if="getScore(group.member.id, h)" :class="scoreNotation(getScore(group.member.id, h), parForHole(h))">{{ getScore(group.member.id, h) }}</span>
                    <span v-else class="score-empty-dot">·</span>
                    <span v-if="strokeDotsOnHole(group.member, h)" class="stroke-dots">{{ '•'.repeat(strokeDotsOnHole(group.member, h)) }}</span>
                  </td>
                  <!-- OUT subtotal -->
                  <td v-if="hasBack9" class="col-subtotal">{{ memberGrossTotal(group.member.id, frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
                  <!-- Back 9 scores -->
                  <td
                    v-for="h in backHoles"
                    :key="h"
                    class="col-score-cell"
                    :class="{ 'cell-winner': isNetWinner(group.member.id, h), 'cell-defidget': isFidgetWinner(group.member.id, h) }"
                    @click="activeHole = h"
                  >
                    <span v-if="getScore(group.member.id, h)" :class="scoreNotation(getScore(group.member.id, h), parForHole(h))">{{ getScore(group.member.id, h) }}</span>
                    <span v-else class="score-empty-dot">·</span>
                    <span v-if="strokeDotsOnHole(group.member, h)" class="stroke-dots">{{ '•'.repeat(strokeDotsOnHole(group.member, h)) }}</span>
                  </td>
                  <!-- IN subtotal -->
                  <td v-if="hasBack9" class="col-subtotal">{{ memberGrossTotal(group.member.id, backHoles[0], backHoles[backHoles.length-1]) }}</td>
                  <!-- Gross total -->
                  <td class="col-total col-gross">{{ memberGrossTotal(group.member.id, visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
                  <!-- Net total -->
                  <td class="col-total col-net">{{ memberNetTotal(group.member.id, visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
                </tr>
              </template>
            </tbody>

            <!-- Game notation rows -->
            <tfoot v-if="gameNotationRows.length > 0 && showNotations">
              <tr v-for="(row, ri) in gameNotationRows" :key="'gn-'+ri" class="row-game-notation" :class="row.cls || ''">
                <td class="col-sticky col-notation-label">
                  <span class="notation-icon">{{ row.icon }}</span>
                  <span class="notation-name">{{ row.label }}</span>
                </td>
                <!-- Front 9 notation -->
                <td v-for="h in frontHoles" :key="'gn-'+ri+'-'+h" class="col-notation-cell" :class="row.cells[h]?.cls || ''" v-html="row.cells[h]?.text || ''"></td>
                <!-- OUT notation summary -->
                <td v-if="hasBack9" class="col-subtotal col-notation-sub" v-html="row.outSummary || ''"></td>
                <!-- Back 9 notation -->
                <td v-for="h in backHoles" :key="'gn-'+ri+'-'+h" class="col-notation-cell" :class="row.cells[h]?.cls || ''" v-html="row.cells[h]?.text || ''"></td>
                <!-- IN notation summary -->
                <td v-if="hasBack9" class="col-subtotal col-notation-sub" v-html="row.inSummary || ''"></td>
                <!-- Total notation -->
                <td class="col-total col-notation-total" v-html="row.totalSummary || ''"></td>
                <td class="col-total"></td>
              </tr>
            </tfoot>
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

        <!-- Hole watermark -->
        <div class="hole-watermark">{{ activeHole }}</div>

        <!-- Player Score Cards — inline +/- entry -->
        <div class="hole-players-list">
          <div
            v-for="member in roundsStore.activeMembers"
            :key="member.id"
            class="player-hole-card"
            :class="[teamCardClass(member), { 'card-winner': isNetWinner(member.id, activeHole) }]"
          >
            <div class="phc-identity">
              <div class="phc-initials" :class="teamBadgeClass(member)">{{ playerInitials(member) }}</div>
              <div class="phc-name-col">
                <div class="phc-name" :class="teamTextClass(member)">{{ member.short_name || member.guest_name }}</div>
                <div class="phc-hcp-row">
                  <span class="phc-hcp-badge">{{ memberHandicapDisplay(member) }}</span>
                  <span v-if="strokeDotsOnHole(member, activeHole)" class="phc-stroke-dots">{{ '•'.repeat(strokeDotsOnHole(member, activeHole)) }}</span>
                </div>
              </div>
            </div>
            <div class="phc-score-entry">
              <button class="score-tap score-tap-minus" @click="inlineDec(member)">−</button>
              <div
                class="score-display"
                :class="getScore(member.id, activeHole) ? 'has-score' : ''"
                @click="inlineSetPar(member)"
              >
                <span :class="getScore(member.id, activeHole) ? scoreNotation(getScore(member.id, activeHole), parForHole(activeHole)) : 'muted'">
                  {{ getScore(member.id, activeHole) || '—' }}
                </span>
              </div>
              <button class="score-tap score-tap-plus" @click="inlineInc(member)">+</button>
            </div>
            <div class="phc-net-col">
              <div class="phc-net-label">NET</div>
              <div class="phc-net-value" :class="getScore(member.id, activeHole) ? '' : 'muted'">
                {{ getScore(member.id, activeHole) ? netScore(getScore(member.id, activeHole), memberHandicapValue(member), siForHole(activeHole)) : '—' }}
              </div>
              <div class="phc-net-sublabel">net</div>
            </div>
          </div>
        </div>

        <!-- Game Status on Hole View -->
        <div v-if="roundsStore.activeGames.length > 0" class="hole-game-status">
          <div class="hole-gs-header">GAME STATUS · THRU {{ lastScoredHole }}</div>
          <div v-for="game in roundsStore.activeGames" :key="'hgs-'+game.id" class="hole-gs-row">
            <span class="hole-gs-icon">{{ gameIcon(game.type) }}</span>
            <span class="hole-gs-name">{{ gameLabel(game.type, game.config) }}</span>
            <span class="hole-gs-detail" v-html="gameLiveSummary(game)"></span>
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

        <!-- Wolf partner pick panel -->
        <div v-if="wolfGame" class="wolf-panel">
          <div class="wolf-header">
            <span class="wolf-label">🐺 Wolf — Hole {{ activeHole }}</span>
            <span class="wolf-current">{{ wolfOnThisHoleName }} is Wolf</span>
          </div>
          <div v-if="wolfChoiceForHole" class="wolf-prompt">
            <template v-if="wolfChoiceForHole.partner === 'lone'">🐺 Lone Wolf — 1 vs {{ roundsStore.activeMembers.length - 1 }}</template>
            <template v-else-if="wolfChoiceForHole.partner === 'blind'">🙈 Blind Wolf — declared before tee shots (2×)</template>
            <template v-else-if="wolfChoiceForHole.partner">🤝 Partner: {{ memberName(wolfChoiceForHole.partner) }}</template>
          </div>
          <div v-else class="wolf-prompt">Tap a player to pick as partner, or go Lone / Blind Wolf</div>
          <div class="wolf-buttons">
            <button
              v-for="member in wolfPickableMembers"
              :key="'wolf-pick-' + member.id"
              class="wolf-pick-btn"
              :class="{ active: wolfChoiceForHole?.partner === member.id }"
              @click="setWolfChoice(member.id)"
            >{{ member.short_name || member.guest_name }}</button>
          </div>
          <button
            class="wolf-lone-btn"
            :class="{ active: wolfChoiceForHole?.partner === 'lone' }"
            @click="setWolfChoice('lone')"
          >🐺 Lone Wolf</button>
          <button
            v-if="wolfGame.config?.blindWolfEnabled !== false"
            class="wolf-blind-btn"
            :class="{ active: wolfChoiceForHole?.partner === 'blind' }"
            @click="setWolfChoice('blind')"
          >🙈 Blind Wolf (2× stakes)</button>
        </div>

        <div class="hole-nav-buttons">
          <button v-if="activeHole > visibleHoles[0]" class="hole-nav-btn hole-nav-prev" @click="activeHole = activeHole - 1">← H{{ activeHole - 1 }}</button>
          <span v-else class="hole-nav-spacer"></span>
          <span class="hole-nav-swipe-hint">swipe ← → to change holes</span>
          <button v-if="activeHole < visibleHoles[visibleHoles.length - 1]" class="hole-nav-btn hole-nav-next" @click="activeHole = activeHole + 1">H{{ activeHole + 1 }} →</button>
          <span v-else class="hole-nav-spacer"></span>
        </div>

        <!-- Finish Round on last hole -->
        <div v-if="activeHole === visibleHoles[visibleHoles.length - 1] && roundCompletionInfo.allScored && !roundsStore.activeRound?.is_complete" class="hole-finish-banner">
          <div class="hole-finish-text">All {{ visibleHoles.length }} holes scored!</div>
          <button class="finish-btn finish-btn-lg" @click="showFinishReview = true">Review & Finish Round</button>
        </div>
        <div v-else-if="activeHole === visibleHoles[visibleHoles.length - 1] && !roundCompletionInfo.allScored && roundCompletionInfo.scoredCount > 0 && !roundsStore.activeRound?.is_complete" class="hole-finish-banner hole-finish-partial">
          <div class="hole-finish-text">{{ roundCompletionInfo.missingHoles.length }} holes still need scores</div>
          <button class="finish-btn finish-btn-review" @click="activeHole = roundCompletionInfo.missingHoles[0]">Go to H{{ roundCompletionInfo.missingHoles[0] }}</button>
        </div>

        <!-- Finish Round Review overlay -->
        <div v-if="showFinishReview" class="delete-overlay" @click="showFinishReview = false">
          <div class="finish-review-panel" @click.stop>
            <div class="finish-review-title">Review Round</div>
            <div class="finish-review-sub">Confirm scores before finishing</div>
            <div class="finish-review-grid">
              <div v-for="member in roundsStore.activeMembers" :key="'fr-'+member.id" class="finish-review-player">
                <span class="fr-name">{{ member.short_name || member.guest_name }}</span>
                <span class="fr-total">{{ playerTotal(member.id) || '—' }}</span>
                <span class="fr-net">NET {{ playerNetTotal(member.id) || '—' }}</span>
              </div>
            </div>
            <div class="finish-review-actions">
              <button class="btn-cancel" @click="showFinishReview = false">Back to Scoring</button>
              <button class="finish-btn" @click="showFinishReview = false; finishRound()">Finish Round ✓</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Score entry modal removed — inline +/- on player cards -->
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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
const router = useRouter()

// ── View state ──────────────────────────────────────────────────
const activeHole = ref(0) // 0 = Card view, >0 = Hole entry
const selectedGame = ref(null)
const showRoundMenu = ref(false)
const confirmDeleteActive = ref(false)
const showGameEditor = ref(false)
const showNotations = ref(true)
const showFinishReview = ref(false)

// ── Game editor helpers ──────────────────────────────────────────
const addableGameTypes = computed(() => {
  const existing = new Set(roundsStore.activeGames.map(g => g.type?.toLowerCase()))
  const types = [
    { type: 'nassau', icon: '💰', label: 'Nassau' },
    { type: 'skins', icon: '💎', label: 'Skins' },
    { type: 'dots', icon: '🎯', label: 'Dots' },
    { type: 'snake', icon: '🐍', label: 'Snake' },
    { type: 'fidget', icon: '😬', label: 'Fidget' },
    { type: 'match1v1', icon: '⚔️', label: '1v1 Match' },
    { type: 'bbn', icon: '🏌️', label: 'Best Ball' },
    { type: 'vegas', icon: '🎰', label: 'Vegas' },
    { type: 'wolf', icon: '🐺', label: 'Wolf' },
  ]
  // Allow duplicates for match1v1 and bbn, otherwise filter existing
  return types.filter(t => t.type === 'match1v1' || t.type === 'bbn' || !existing.has(t.type))
})

async function updateGameStake(game, field, value) {
  const newConfig = { ...game.config }
  if (field === 'ppt') newConfig.ppt = value
  else if (field === 'ppp') newConfig.ppp = value
  else if (field === 'nassau-front') newConfig.front = value
  else if (field === 'nassau-back') newConfig.back = value
  else if (field === 'nassau-overall') newConfig.overall = value
  await roundsStore.updateGameConfig(game.id, newConfig)
}

async function removeGame(gameId) {
  await roundsStore.deleteGameConfig(gameId)
}

async function addNewGame(type) {
  const members = roundsStore.activeMembers
  const memberIds = members.map(m => m.id)
  let config = {}

  switch (type) {
    case 'nassau': {
      const half = Math.ceil(members.length / 2)
      config = { front: 10, back: 10, overall: 20, pressAt: 2, team1: memberIds.slice(0, half), team2: memberIds.slice(half) }
      break
    }
    case 'skins': config = { ppt: 5, players: memberIds }; break
    case 'dots': config = { ppt: 1, birdieEnabled: true, eagleEnabled: true, greenieEnabled: true, sandieEnabled: true }; break
    case 'snake': config = { ppt: 5 }; break
    case 'fidget': config = { ppp: 10 }; break
    case 'match1v1': config = { player1: memberIds[0] ?? null, player2: memberIds[1] ?? null, ppt: 5 }; break
    case 'bbn': config = { ballsToCount: 1, scoring: 'net', label: '1BB Net' }; break
    case 'vegas': {
      const half = Math.ceil(members.length / 2)
      config = { team1: memberIds.slice(0, half), team2: memberIds.slice(half), ppt: 1 }
      break
    }
    case 'wolf': config = { ppt: 5 }; break
  }

  await roundsStore.saveGameConfig({
    round_id: roundsStore.activeRound?.id,
    type,
    config,
    sort_order: roundsStore.activeGames.length,
  })
}

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

function playerTotal(memberId) {
  let sum = 0; let any = false
  for (const h of visibleHoles.value) {
    const s = getScore(memberId, h)
    if (s != null) { sum += s; any = true }
  }
  return any ? sum : null
}

function playerNetTotal(memberId) {
  const member = roundsStore.activeMembers.find(m => m.id === memberId)
  if (!member) return null
  const hcp = memberHandicapValue(member)
  let sum = 0; let any = false
  for (const h of visibleHoles.value) {
    const s = getScore(memberId, h)
    if (s != null) {
      sum += s - strokesOnHole(hcp, holeSI(courseData.value, h, roundsStore.activeRound?.tee))
      any = true
    }
  }
  return any ? sum : null
}

function memberHandicapDisplay(member) {
  const h = memberHandicapValue(member)
  if (h == null) return ''
  return Math.round(h)
}

function lowManStrokes(member) {
  const members = roundsStore.activeMembers
  if (members.length < 2) return null
  const hcps = members.map(m => memberHandicapValue(m)).filter(h => h != null)
  if (hcps.length < 2) return null
  const lowest = Math.min(...hcps)
  const myHcp = memberHandicapValue(member)
  if (myHcp == null) return null
  return myHcp - lowest
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

// Fidget: did this player de-fidget (win net) on this hole?
const fidgetHoleWinners = computed(() => {
  const map = {} // { hole: winnerId }
  const games = roundsStore.activeGames
  for (const game of games) {
    if (game.type?.toLowerCase() !== 'fidget') continue
    try {
      const ctx = buildCtx()
      const r = computeFidget(ctx, game.config)
      for (const hl of (r.holeLog || [])) {
        if (hl.winner) map[hl.hole] = hl.winner
      }
    } catch(e) { /* skip */ }
  }
  return map
})
function isFidgetWinner(memberId, hole) {
  return fidgetHoleWinners.value[hole] === memberId
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

// scoreLabel removed — inline entry doesn't need it

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
function teamBarClass(m) { return m.team === 1 ? 'bar-t1' : m.team === 2 ? 'bar-t2' : '' }

// ── Sorted players: group by team, T1 first, then T2, then no-team ──
const sortedPlayerGroups = computed(() => {
  const members = roundsStore.activeMembers
  const t1 = members.filter(m => m.team === 1).map(m => ({ member: m, team: 1 }))
  const t2 = members.filter(m => m.team === 2).map(m => ({ member: m, team: 2 }))
  const noTeam = members.filter(m => !m.team || (m.team !== 1 && m.team !== 2)).map(m => ({ member: m, team: 0 }))
  return [...t1, ...t2, ...noTeam]
})

// ── Game notation rows for the scorecard grid ───────────────────
// Shared: "J. Spieler" → "JS", "Jason Spieler" → "JS", "Spieler" → "SP"
function nameToInitials(name) {
  if (!name || name === '?') return '??'
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Helper: build team initials string like "JS+BC"
function teamInitialsStr(teamIds) {
  return teamIds.map(id => {
    const m = roundsStore.activeMembers.find(m => m.id === id)
    const name = m?.short_name || m?.guest_name || '?'
    return nameToInitials(name)
  }).join('+')
}

// Helper: player short initial (2 chars) for attribution
function pInit(memberId) {
  const m = roundsStore.activeMembers.find(m => m.id === memberId)
  const name = m?.short_name || m?.guest_name || '?'
  return nameToInitials(name)
}

const gameNotationRows = computed(() => {
  const rows = []
  const ctx = buildCtx()
  const games = roundsStore.activeGames

  for (const game of games) {
    const t = game.type?.toLowerCase()

    // ── NASSAU — team initials, ½/W/L, +N format ──
    if (t === 'nassau') {
      try {
        const r = computeNassau(ctx, game.config)
        const cfg = game.config || {}
        const t1Label = teamInitialsStr(cfg.team1 || [])
        const t2Label = teamInitialsStr(cfg.team2 || [])
        const cells = {}
        const allHR = [...(r.frontSeg?.holeResults || []), ...(r.backSeg?.holeResults || [])]

        // Running t1Up per hole so we can show cumulative status
        for (const hr of allHR) {
          let sym = '', cls = ''
          if (hr.winner === 't1') { sym = 'W'; cls = 'nota-t1' }
          else if (hr.winner === 't2') { sym = 'L'; cls = 'nota-t2' }
          else if (hr.n1 != null && hr.n2 != null) { sym = '½'; cls = 'nota-halved' }
          cells[hr.hole] = { text: sym, cls }
        }

        // Dormie checks per segment
        const fPlayed = r.frontSeg?.holeResults?.filter(hr => hr.n1 != null).length || 0
        const fRem = 9 - fPlayed
        const fUp = r.frontSeg?.t1Up || 0
        const fDormie = fRem > 0 && Math.abs(fUp) === fRem
        const bPlayed = r.backSeg?.holeResults?.filter(hr => hr.n1 != null).length || 0
        const bRem = 9 - bPlayed
        const bUp = r.backSeg?.t1Up || 0
        const bDormie = bRem > 0 && Math.abs(bUp) === bRem
        const oRem = 18 - fPlayed - bPlayed
        const oUp = r.overallUp || 0
        const oDormie = oRem > 0 && Math.abs(oUp) === oRem

        // Format: "T2 3up" or "AS", with D! for dormie — use team initials
        const fmtSeg = (up, dormie) => {
          if (up === 0) return 'AS'
          const leader = up > 0 ? t1Label : t2Label
          const s = `${leader} ${Math.abs(up)}up`
          return dormie ? `<span class="nota-dormie">${s} D!</span>` : s
        }

        rows.push({
          icon: '💰', label: `${t1Label} v ${t2Label}`,
          cells,
          outSummary: fmtSeg(fUp, fDormie),
          inSummary: fmtSeg(bUp, bDormie),
          totalSummary: fmtSeg(oUp, oDormie),
          cls: 'row-nassau-nota',
        })
      } catch(e) { /* skip */ }
    }

    // ── SKINS — show winner initials on won holes ──
    if (t === 'skins') {
      try {
        const r = computeSkins(ctx, game.config)
        const cells = {}
        let carryCount = 0, totalWon = 0
        for (const hr of (r.holeResults || [])) {
          if (hr.winner) {
            const val = carryCount + 1
            const winInit = pInit(hr.winner)
            cells[hr.hole] = { text: `💎${winInit}${val > 1 ? '×' + val : ''}`, cls: 'nota-skin-won' }
            carryCount = 0
            totalWon += val
          } else if (hr.reason === 'tie') {
            cells[hr.hole] = { text: 'C', cls: 'nota-carry' }
            carryCount++
          }
        }
        rows.push({
          icon: '💎', label: 'Skins', cells,
          outSummary: '', inSummary: '',
          totalSummary: `${totalWon} won`,
        })
      } catch(e) { /* skip */ }
    }

    // ── MATCH / 1v1 — ½/W/L with dormie ──
    if (t === 'match' || t === 'match1v1') {
      try {
        const r = computeMatch(ctx, game.config)
        if (!r) continue
        const cells = {}
        const played = r.holeResults?.filter(hr => !hr.incomplete) || []
        const totalHoles = visibleHoles.value.length
        for (const hr of (r.holeResults || [])) {
          if (hr.incomplete) continue
          let sym = '', cls = ''
          if (hr.winner === 'p1') { sym = 'W'; cls = 'nota-t1' }
          else if (hr.winner === 'p2') { sym = 'L'; cls = 'nota-t2' }
          else { sym = '½'; cls = 'nota-halved' }
          cells[hr.hole] = { text: sym, cls }
        }
        const up = r.finalUp
        const remaining = totalHoles - played.length
        const isDormie = remaining > 0 && Math.abs(up) === remaining
        const p1Init = pInit(r.p1?.id) || r.p1?.name?.slice(0,2) || 'P1'
        const p2Init = pInit(r.p2?.id) || r.p2?.name?.slice(0,2) || 'P2'
        const leader = up > 0 ? p1Init : p2Init
        let summary = up === 0 ? 'AS' : `${leader} ${Math.abs(up)}up`
        if (isDormie) summary = `<span class="nota-dormie">${summary} D!</span>`
        rows.push({
          icon: '⚔️', label: `${p1Init} v ${p2Init}`,
          cells, outSummary: '', inSummary: '', totalSummary: summary,
        })
      } catch(e) { /* skip */ }
    }

    // ── DOTS — show WHO earned each dot: "JS●" "JC★" ──
    if (t === 'dots') {
      try {
        const r = computeDots(ctx, game.config)
        const cells = {}
        const holeMarks = {} // hole → [{init, sym}]
        for (const [mid, data] of Object.entries(r.dots || {})) {
          for (const bd of (data.breakdown || [])) {
            if (!holeMarks[bd.hole]) holeMarks[bd.hole] = []
            const sym = bd.type === 'Eagle' ? '★' : bd.type === 'Birdie' ? '●' : bd.type === 'Greenie' ? 'G' : bd.type === 'Sandy' ? 'S' : bd.type === 'Chip-in' ? 'C' : '?'
            holeMarks[bd.hole].push(`<span class="nota-dot-who">${pInit(mid)}</span>${sym}`)
          }
        }
        for (const [hole, marks] of Object.entries(holeMarks)) {
          cells[+hole] = { text: marks.join(' '), cls: 'nota-dots' }
        }
        // All players with totals
        const sorted = Object.entries(r.dots || {}).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.dots - a.dots)
        const summaryParts = sorted.filter(d => d.dots > 0).map(d => `${pInit(d.id)}:${d.dots}`)
        rows.push({
          icon: '🎯', label: 'Dots', cells,
          outSummary: '', inSummary: '',
          totalSummary: summaryParts.join(' ') || '',
        })
      } catch(e) { /* skip */ }
    }

    // ── FIDGET — no notation row; handled by cell-defidget class on player score cells ──
    // Fidget summary still shown in Live Games above the grid.
    // The player who de-fidgets gets their score cell background highlighted.

    // ── BEST BALL NET ──
    if (t === 'bbn') {
      try {
        const r = computeBestBallNet(ctx, game.config)
        const cells = {}
        let runTotal = 0, runPar = 0
        for (const hr of (r.holeResults || [])) {
          if (hr.sum != null) {
            runTotal += hr.sum
            runPar += hr.par * (r.ballsToCount || 1)
            const tp = hr.toPar
            cells[hr.hole] = { text: tp === 0 ? 'E' : (tp > 0 ? `+${tp}` : `${tp}`), cls: tp < 0 ? 'nota-under' : tp > 0 ? 'nota-over' : '' }
          }
        }
        const overall = runTotal - runPar
        const overallStr = overall === 0 ? 'E' : (overall > 0 ? `+${overall}` : `${overall}`)
        rows.push({
          icon: '🏌️', label: game.config?.label || 'BB Net', cells,
          outSummary: '', inSummary: '',
          totalSummary: `${runTotal} (${overallStr})`,
        })
      } catch(e) { /* skip */ }
    }

    // ── SNAKE — show WHO 3-putted: "JS🐍" ──
    if (t === 'snake') {
      try {
        const r = computeSnake(ctx, game.config)
        const cells = {}
        const holeEvents = {}
        for (const evt of (game.config?.events || [])) {
          if (!holeEvents[evt.hole]) holeEvents[evt.hole] = []
          holeEvents[evt.hole].push(pInit(evt.pid))
        }
        for (const [hole, names] of Object.entries(holeEvents)) {
          const text = names.map(n => `${n}🐍`).join(' ')
          cells[+hole] = { text, cls: 'nota-snake' }
        }
        rows.push({
          icon: '🐍', label: 'Snake', cells,
          outSummary: '', inSummary: '',
          totalSummary: r.holderName ? `${r.holderName} holds` : '',
        })
      } catch(e) { /* skip */ }
    }
  }

  return rows
})

// ── Game helpers ────────────────────────────────────────────────
function gameIcon(type) {
  const icons = { nassau:'💰', skins:'💎', match:'⚔️', matchplay:'⚔️', bestball:'🤝', snake:'🐍', dots:'🎯', fidget:'😬', bbn:'🏌️', match1v1:'⚔️', vegas:'🎰', hilow:'📊', stableford:'⭐', wolf:'🐺', hammer:'🔨', sixes:'🎲', fivethreeone:'5️⃣' }
  return icons[type?.toLowerCase()] || '🎮'
}

function gameLabel(type, config) {
  if (type?.toLowerCase() === 'bbn' && config?.label) return config.label
  if (type?.toLowerCase() === 'nassau' && config) {
    const t1 = teamInitialsStr(config.team1 || [])
    const t2 = teamInitialsStr(config.team2 || [])
    if (t1 && t2) return `Nassau ${t1} v ${t2}`
  }
  if ((type?.toLowerCase() === 'match' || type?.toLowerCase() === 'match1v1') && config) {
    const p1 = config.player1 ? pInit(config.player1) : null
    const p2 = config.player2 ? pInit(config.player2) : null
    if (p1 && p2) return `Match ${p1} v ${p2}`
  }
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
      function fmtNassauSeg(seg, segFrom, segTo) {
        // Format: +3/+1 meaning 3 up on main, 1 on press(es)
        const up = seg.t1Up
        const mainStr = up === 0 ? 'AS' : (up > 0 ? `+${up}` : `${up}`)
        // Dormie check: played holes in this segment
        const played = seg.holeResults?.filter(hr => hr.n1 != null || hr.n2 != null).length || 0
        const segHoles = segTo - segFrom + 1
        const remaining = segHoles - played
        const isDormie = remaining > 0 && Math.abs(up) === remaining
        const pressTotal = seg.presses?.length || 0
        let result = mainStr
        if (pressTotal > 0) {
          let pressUp = 0
          for (const press of seg.presses) {
            const pressHoles = seg.holeResults.filter(r => r.hole >= press.start)
            pressUp += pressHoles.reduce((acc, r) => {
              if (r.winner === 't1') return acc + 1
              if (r.winner === 't2') return acc - 1
              return acc
            }, 0)
          }
          const pressStr = pressUp === 0 ? 'AS' : (pressUp > 0 ? `+${pressUp}` : `${pressUp}`)
          result = `${mainStr}/${pressStr}`
        }
        if (isDormie) result += ' D!'
        return result
      }
      const f = fmtNassauSeg(r.frontSeg, 1, 9)
      const b = fmtNassauSeg(r.backSeg, 10, 18)
      // Overall dormie
      const allPlayed = [...(r.frontSeg.holeResults || []), ...(r.backSeg.holeResults || [])].filter(hr => hr.n1 != null || hr.n2 != null).length
      const oUp = r.overallUp
      const oRemaining = 18 - allPlayed
      const oDormie = oRemaining > 0 && Math.abs(oUp) === oRemaining
      const oStr = (oUp === 0 ? 'AS' : (oUp > 0 ? `+${oUp}` : `${oUp}`)) + (oDormie ? ' D!' : '')
      const cfg = game.config || {}
      const t1L = teamInitialsStr(cfg.team1 || [])
      const t2L = teamInitialsStr(cfg.team2 || [])
      const cls = (val) => val > 0 ? 'gw-winning' : val < 0 ? 'gw-losing' : ''
      return `F: <span class="${cls(r.frontSeg.t1Up)}">${f}</span> · B: <span class="${cls(r.backSeg.t1Up)}">${b}</span> · O: <span class="${cls(oUp)}">${oStr}</span>`
    }
    if (t === 'skins') {
      const r = computeSkins(ctx, game.config)
      const won = r.results?.filter(s => s.winner).length || 0
      const carry = r.results?.filter(s => !s.winner).length || 0
      return `${won} won · ${carry} carry`
    }
    if (t === 'match' || t === 'match1v1') {
      const r = computeMatch(ctx, game.config)
      if (!r) return '—'
      const played = r.holeResults?.filter(hr => !hr.incomplete) || []
      const up = played.at(-1)?.p1Up ?? 0
      const totalHoles = visibleHoles.value.length
      const remaining = totalHoles - played.length
      if (r.matchOver) return r.result
      // Dormie detection: leading by exactly as many holes as remain
      if (remaining > 0 && Math.abs(up) === remaining) {
        const leader = up > 0 ? (r.p1?.name || 'P1') : (r.p2?.name || 'P2')
        return `<span class="gw-winning">${leader} DORMIE!</span> (${Math.abs(up)}UP, ${remaining} left)`
      }
      if (up === 0) return `AS (${remaining} left)`
      const leader = up > 0 ? (r.p1?.name || 'P1') : (r.p2?.name || 'P2')
      return `<span class="${up > 0 ? 'gw-winning' : 'gw-losing'}">${leader} ${Math.abs(up)}UP</span> (${remaining} left)`
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
      const safe = r.winners || []
      const atRisk = r.fidgeters || []
      if (safe.length === 0) return `All ${atRisk.length} players at risk`
      if (atRisk.length === 0) return 'All safe!'
      const atRiskNames = atRisk.map(m => m.short_name || m.guest_name).join(', ')
      return `⚠️ ${atRiskNames} still at risk (${safe.length} safe)`
    }
    if (t === 'bbn') {
      const r = computeBestBallNet(ctx, game.config)
      const scored = r.holeResults?.filter(hr => hr.sum != null) || []
      if (scored.length === 0) return '—'
      const runningTotal = scored.reduce((s, hr) => s + hr.sum, 0)
      const runningPar = scored.reduce((s, hr) => s + (hr.par * (r.ballsToCount || 1)), 0)
      const toPar = runningTotal - runningPar
      const toParStr = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`
      return `${runningTotal} (${toParStr}) thru ${scored.length}`
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

// ── Inline score entry (replaces modal) ─────────────────────────
function inlineSetPar(member) {
  // Tap the score box: if no score, set par; if already has score, reset to par
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  const newScore = existing === null ? par : existing  // first tap = par
  roundsStore.setScore(member.id, hole, newScore)
}

function inlineInc(member) {
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  if (existing === null) {
    // No score yet — set to par+1 (bogey)
    roundsStore.setScore(member.id, hole, par + 1)
  } else if (existing < 13) {
    roundsStore.setScore(member.id, hole, existing + 1)
  }
}

function inlineDec(member) {
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  if (existing === null) {
    // No score yet — set to par-1 (birdie)
    roundsStore.setScore(member.id, hole, Math.max(1, par - 1))
  } else if (existing > 1) {
    roundsStore.setScore(member.id, hole, existing - 1)
  }
}

// saveScore removed — inline entry auto-saves

// ── Snake 3-putt ────────────────────────────────────────────────
const snakeGame = computed(() => roundsStore.activeGames.find(g => g.type?.toLowerCase() === 'snake') || null)
const snakeHolder = computed(() => { const e = snakeGame.value?.config?.events || []; return e.length ? e[e.length - 1].pid : null })
const snakeHolderName = computed(() => { if (!snakeHolder.value) return null; const m = roundsStore.activeMembers.find(m => m.id === snakeHolder.value); return m?.short_name || m?.guest_name || '?' })
const snakeEventsOnHole = computed(() => (snakeGame.value?.config?.events || []).filter(e => e.hole === activeHole.value))

const lastScoredHole = computed(() => {
  let last = 0
  for (const h of visibleHoles.value) {
    const hasAny = roundsStore.activeMembers.some(m => getScore(m.id, h) != null)
    if (hasAny) last = h
  }
  return last
})

// ── Round completion tracking ──────────────────────────────────
const roundCompletionInfo = computed(() => {
  const members = roundsStore.activeMembers
  if (!members.length) return { scoredCount: 0, allScored: false, missingHoles: [] }
  const missing = []
  let scored = 0
  for (const h of visibleHoles.value) {
    // A hole is "scored" when ALL players have a score
    const allHave = members.every(m => getScore(m.id, h) != null)
    if (allHave) scored++
    else missing.push(h)
  }
  return {
    scoredCount: scored,
    allScored: scored === visibleHoles.value.length && scored > 0,
    missingHoles: missing,
  }
})

async function finishRound() {
  if (!roundsStore.activeRound) return
  try {
    await roundsStore.completeRound(roundsStore.activeRound.id)
  } catch (e) {
    console.error('Finish round error:', e)
  }
}

async function deleteActiveRound() {
  if (!roundsStore.activeRound) return
  try {
    await roundsStore.deleteRound(roundsStore.activeRound.id)
    confirmDeleteActive.value = false
    router.push('/')
  } catch (e) {
    console.error('Delete round error:', e)
  }
}

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

// ── Wolf helpers ─────────────────────────────────────────────────
const wolfGame = computed(() => roundsStore.activeGames.find(g => g.type?.toLowerCase() === 'wolf') || null)

const wolfOnThisHole = computed(() => {
  if (!wolfGame.value) return null
  const members = roundsStore.activeMembers
  const teeOrder = wolfGame.value.config?.wolfTeeOrder || members.map(m => m.id)
  if (!teeOrder.length) return null
  const n = teeOrder.length
  const wolfIdx = (activeHole.value - 1) % n
  return teeOrder[wolfIdx]
})

const wolfOnThisHoleName = computed(() => {
  if (!wolfOnThisHole.value) return '?'
  const m = roundsStore.activeMembers.find(m => m.id === wolfOnThisHole.value)
  return m?.short_name || m?.guest_name || '?'
})

const wolfChoiceForHole = computed(() => {
  if (!wolfGame.value) return null
  return wolfGame.value.config?.wolfChoices?.[activeHole.value] || null
})

const wolfPickableMembers = computed(() => {
  if (!wolfOnThisHole.value) return []
  return roundsStore.activeMembers.filter(m => m.id !== wolfOnThisHole.value)
})

function memberName(memberId) {
  const m = roundsStore.activeMembers.find(m => m.id === memberId)
  return m?.short_name || m?.guest_name || '?'
}

async function setWolfChoice(partnerId) {
  if (!wolfGame.value) return
  const choices = { ...(wolfGame.value.config?.wolfChoices || {}) }
  // Toggle: if same choice, clear it
  if (choices[activeHole.value]?.partner === partnerId) {
    delete choices[activeHole.value]
  } else {
    choices[activeHole.value] = { partner: partnerId }
  }
  await roundsStore.updateGameConfig(wolfGame.value.id, { ...wolfGame.value.config, wolfChoices: choices })
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
  position: relative;
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
.header-right-actions { display: flex; align-items: center; gap: 6px; }
.btn-round-menu {
  font-size: 18px; background: none; border: none; cursor: pointer; padding: 4px;
  -webkit-tap-highlight-color: transparent;
}
.round-menu-dropdown {
  position: absolute; top: 100%; right: 12px; z-index: 20;
  background: var(--gw-green-800, #0d3325);
  border: 1px solid rgba(212,175,55,.25);
  border-radius: 12px; padding: 6px; min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
}
.round-menu-item {
  display: block; width: 100%; text-align: left;
  padding: 10px 12px; border-radius: 8px;
  background: none; border: none; cursor: pointer;
  color: var(--gw-text, #f0ede0); font-size: 13px; font-weight: 600;
  -webkit-tap-highlight-color: transparent;
}
.round-menu-item:active { background: rgba(255,255,255,.06); }
.round-menu-danger { color: #f87171; }

/* Delete overlay (reused pattern) */
.scoring-view .delete-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.scoring-view .delete-dialog {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid rgba(248,113,113,.3);
  border-radius: 16px; padding: 24px; max-width: 340px; width: 100%;
}
.scoring-view .delete-title { font-size: 18px; font-weight: 800; color: #f87171; margin-bottom: 10px; }
.scoring-view .delete-msg { font-size: 13px; color: rgba(240,237,224,.7); line-height: 1.5; margin-bottom: 18px; }
.scoring-view .delete-actions { display: flex; gap: 10px; }
.scoring-view .btn-cancel {
  flex: 1; padding: 12px; border-radius: 10px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text, #f0ede0); font-size: 14px; font-weight: 600; cursor: pointer;
}
.scoring-view .btn-delete-confirm {
  flex: 1; padding: 12px; border-radius: 10px;
  background: rgba(248,113,113,.2); border: 1px solid rgba(248,113,113,.4);
  color: #f87171; font-size: 14px; font-weight: 700; cursor: pointer;
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
/* ── Finish Round Banner ────────────────────────────────────── */
.finish-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; margin: 8px 12px; border-radius: 14px;
  gap: 12px;
}
.finish-ready {
  background: rgba(74,222,128,.1);
  border: 1.5px solid rgba(74,222,128,.4);
}
.finish-partial {
  background: rgba(251,191,36,.08);
  border: 1px solid rgba(251,191,36,.3);
}
.finish-done {
  background: rgba(74,222,128,.06);
  border: 1px solid rgba(74,222,128,.2);
}
.finish-banner-title {
  font-size: 14px; font-weight: 800; color: var(--gw-text, #f0ede0);
}
.finish-banner-sub {
  font-size: 11px; color: rgba(240,237,224,.5); margin-top: 2px;
}
.finish-btn {
  padding: 10px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  border: none;
  background: var(--gw-green-500, #1a7a55);
  color: white; white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}
.finish-btn:active { opacity: .8; }
.finish-btn-review {
  background: rgba(251,191,36,.2); color: var(--gw-gold, #d4af37);
  border: 1px solid rgba(251,191,36,.3);
}

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

.row-si { background: rgba(0,0,0,.15); border-bottom: 1px solid rgba(255,255,255,.05); }
.col-si-val { padding: 2px 4px; text-align: center; font-size: 9px; color: rgba(212,175,55,.4); }
.row-yards { background: rgba(0,0,0,.1); border-bottom: 1px solid rgba(255,255,255,.05); }
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
  position: relative;
  padding-left: 14px;
}
.sticky-t1 { background: rgba(7,20,30,.97); }
.sticky-t2 { background: rgba(18,7,7,.97); }
.sticky-default { background: rgba(7,14,7,.97); }

.player-nm { font-size: 12px; font-weight: 700; color: var(--gw-text, #f0ede0); }
.player-hcp { font-size: 9px; color: rgba(240,237,224,.35); margin-left: 4px; }
.hcp-lowman { color: rgba(96,165,250,.7); margin-left: 2px; }
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
.cell-defidget { background: rgba(251,191,36,.12); box-shadow: inset 0 0 0 1px rgba(251,191,36,.25); }

.score-empty-dot { color: rgba(240,237,224,.2); }

/* Team color bars */
.team-color-bar {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
}
.bar-t1 { background: #60a5fa; }
.bar-t2 { background: #f87171; }

/* Team divider row */
.row-team-divider { height: 2px; }
.team-divider-cell {
  background: rgba(255,255,255,.08);
  height: 2px; padding: 0; border: none;
}

/* ── Game notation rows (tfoot) ─────────────────────────────── */
.row-game-notation {
  border-top: 1px solid rgba(255,255,255,.06);
  background: rgba(0,0,0,.15);
}
.col-notation-label {
  padding: 3px 6px;
  background: rgba(7,14,7,.97);
  white-space: nowrap;
  position: sticky; left: 0; z-index: 2;
}
.notation-icon { font-size: 10px; margin-right: 3px; }
.notation-name { font-size: 9px; font-weight: 700; color: rgba(240,237,224,.5); text-transform: uppercase; letter-spacing: .3px; }

.col-notation-cell {
  padding: 2px 3px; text-align: center;
  font-size: 9px; font-weight: 700; min-width: 24px;
}
.col-notation-sub { font-size: 8px; font-weight: 700; color: rgba(240,237,224,.5); }
.col-notation-total { font-size: 8px; font-weight: 700; color: rgba(240,237,224,.6); }

/* Notation cell classes */
.nota-t1 { color: #60a5fa; }
.nota-t2 { color: #f87171; }
.nota-halved { color: rgba(240,237,224,.3); }
.nota-dormie { color: #fbbf24; font-weight: 900; }
.nota-skin-won { color: #a78bfa; }
.nota-carry { color: rgba(240,237,224,.25); font-style: italic; }
.nota-dots { color: #4ade80; }
.nota-dot-who { color: rgba(240,237,224,.5); font-size: 8px; margin-right: 1px; }
.nota-safe { color: #4ade80; }
.nota-under { color: #60a5fa; }
.nota-over { color: #f87171; }
.nota-snake { }

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
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid #f59e0b; color: #f59e0b; font-weight: 900;
}
.sn-eagle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid #4ade80; color: #4ade80; font-weight: 900;
}
.sn-birdie {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  border: 1.5px solid #60a5fa; color: #60a5fa; font-weight: 900;
}
.sn-par { color: var(--gw-text, #f0ede0); font-weight: 700; }
.sn-bogey {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 3px;
  border: 1.5px solid #94a3b8; color: #f87171; font-weight: 900;
}
.sn-dbl {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 3px;
  border: 2px solid #f87171; color: #f87171; font-weight: 900;
}
.sn-trip {
  color: #dc2626; font-weight: 900;
}
.sn-empty { color: rgba(240,237,224,.2); }

/* ═══════════════════════════════════════════════════════════════════
   HOLE VIEW — Per-hole entry
   ═══════════════════════════════════════════════════════════════════ */
.hole-view {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 100px;
  -webkit-overflow-scrolling: touch;
  position: relative;
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
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  transition: border-color .12s, background .12s;
  -webkit-tap-highlight-color: transparent;
}
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
   INLINE SCORE ENTRY (replaces modal)
   ═══════════════════════════════════════════════════════════════════ */
.phc-inline-entry {
  display: flex; align-items: center; gap: 8px;
}
.score-tap {
  width: 44px; height: 44px; border-radius: 12px;
  font-size: 24px; font-weight: 700; cursor: pointer;
  border: none; display: flex; align-items: center; justify-content: center;
  transition: transform .1s; font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
.score-tap:active { transform: scale(.86); }
.score-tap-minus { background: rgba(248,113,113,.18); color: #f87171; }
.score-tap-plus { background: rgba(74,222,128,.18); color: #4ade80; }
.score-display {
  min-width: 50px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 900;
  background: rgba(255,255,255,.09); border: 2px solid rgba(212,175,55,.35);
  color: #f0ede0; cursor: pointer; font-family: var(--gw-font-mono, monospace);
  -webkit-tap-highlight-color: transparent;
}
.score-display.has-score { border-color: rgba(212,175,55,.45); background: transparent; }
.phc-net-line {
  font-size: 10px; color: rgba(240,237,224,.45);
  text-align: right; padding-right: 4px; margin-top: -4px;
}
.phc-hcp-badge {
  font-size: 10px; font-weight: 600; color: rgba(212,175,55,.7);
  background: rgba(212,175,55,.12); padding: 1px 5px; border-radius: 4px;
  margin-left: 5px; vertical-align: middle;
}
.phc-stroke-dots {
  font-size: 10px; color: rgba(212,175,55,.9); margin-left: 3px; vertical-align: middle;
}

/* Hole watermark */
.hole-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 280px;
  font-weight: 900;
  color: rgba(255,255,255,.03);
  pointer-events: none;
  z-index: 0;
  line-height: 1;
  font-family: var(--gw-font-display, Georgia, serif);
}

/* Redesigned player card layout */
.phc-identity {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.phc-name-col { display: flex; flex-direction: column; }
.phc-hcp-row { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.phc-score-entry {
  display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center;
}
.phc-net-col {
  display: flex; flex-direction: column; align-items: center;
  min-width: 44px; flex-shrink: 0;
}
.phc-net-label { font-size: 9px; font-weight: 700; color: rgba(240,237,224,.35); text-transform: uppercase; letter-spacing: .5px; }
.phc-net-value { font-size: 22px; font-weight: 900; color: var(--gw-text, #f0ede0); font-family: var(--gw-font-mono, monospace); line-height: 1.1; }
.phc-net-sublabel { font-size: 8px; color: rgba(240,237,224,.3); }

/* Hole game status section */
.hole-game-status {
  background: rgba(13,51,37,.6);
  border: 1px solid rgba(212,175,55,.15);
  border-radius: 14px;
  padding: 12px 14px;
  margin: 14px 0;
}
.hole-gs-header {
  font-size: 11px; font-weight: 800; color: var(--gw-gold, #d4af37);
  letter-spacing: .8px; text-transform: uppercase; margin-bottom: 10px;
}
.hole-gs-row {
  display: flex; align-items: baseline; gap: 6px;
  padding: 5px 0;
  border-top: 1px solid rgba(255,255,255,.05);
  font-size: 12px; color: var(--gw-text, #f0ede0);
  flex-wrap: wrap;
}
.hole-gs-row:first-of-type { border-top: none; }
.hole-gs-icon { font-size: 13px; }
.hole-gs-name { font-weight: 700; white-space: nowrap; }
.hole-gs-detail { font-size: 12px; color: rgba(240,237,224,.7); }

/* Hole nav buttons */
.hole-nav-buttons {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0 16px; gap: 8px;
}
.hole-nav-btn {
  padding: 10px 18px; border-radius: 12px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  border: 1px solid rgba(212,175,55,.25);
  background: rgba(212,175,55,.08);
  color: var(--gw-gold, #d4af37);
  -webkit-tap-highlight-color: transparent;
  min-width: 80px; text-align: center;
}
.hole-nav-btn:active { background: rgba(212,175,55,.2); }
.hole-nav-next { background: rgba(212,175,55,.15); }
.hole-nav-spacer { flex: 1; }
.hole-nav-swipe-hint {
  font-size: 10px; color: rgba(240,237,224,.2); white-space: nowrap;
}

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

/* ── Game Editor Panel ──────────────────────────────────────── */
.game-editor-panel {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: var(--gw-neutral-900, #111a14);
  border-top-left-radius: 20px; border-top-right-radius: 20px;
  border: 1px solid var(--gw-green-700, #134d38); border-bottom: none;
  padding: 20px 16px calc(env(safe-area-inset-bottom) + 80px) 16px;
  max-height: 80vh; overflow-y: auto;
  box-shadow: 0 -8px 30px rgba(0,0,0,.5);
}
.game-editor-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
}
.game-editor-title { font-size: 18px; font-weight: 700; color: var(--gw-text); }
.close-btn-sm {
  width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,.08);
  border: none; color: var(--gw-text-muted); font-size: 16px; cursor: pointer;
}
.ge-game-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.06);
}
.ge-game-info { display: flex; align-items: center; gap: 8px; }
.ge-game-icon { font-size: 16px; }
.ge-game-name { font-size: 14px; color: var(--gw-text); font-weight: 500; }
.ge-game-controls { display: flex; align-items: center; gap: 6px; }
.ge-stake-label { font-size: 10px; color: var(--gw-text-muted); text-transform: uppercase; letter-spacing: .3px; }
.ge-stake-input {
  width: 48px; background: var(--gw-green-900, #0a2218); border: 1px solid var(--gw-green-600);
  color: var(--gw-gold); border-radius: 6px; padding: 5px 4px; font-size: 14px;
  text-align: center; font-weight: 600;
}
.ge-stake-input:focus { outline: none; border-color: var(--gw-gold); }
.ge-remove-btn {
  width: 28px; height: 28px; border-radius: 50%; background: rgba(220,38,38,.15);
  border: 1px solid rgba(220,38,38,.3); color: #f87171; font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.ge-empty { padding: 20px; text-align: center; color: var(--gw-text-muted); font-size: 14px; }
.ge-add-section { margin-top: 16px; }
.ge-add-label { font-size: 11px; color: var(--gw-gold); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
.ge-add-btns { display: flex; flex-wrap: wrap; gap: 6px; }
.ge-add-btn {
  padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text); cursor: pointer; transition: all .15s;
}
.ge-add-btn:active { background: var(--gw-green-700); border-color: var(--gw-gold); }

/* ── Notation Toggle ────────────────────────────────────────── */
.scorecard-controls {
  display: flex; justify-content: flex-end; padding: 4px 12px 0;
}
.notation-toggle-btn {
  font-size: 11px; color: var(--gw-text-muted); background: none; border: none;
  cursor: pointer; padding: 3px 8px;
}
.notation-toggle-btn:active { color: var(--gw-gold); }

/* ── Finish Review Panel (hole-by-hole) ─────────────────────── */
.hole-finish-banner {
  margin: 16px 0 0; padding: 16px; text-align: center;
  background: linear-gradient(135deg, rgba(22,96,68,.4), rgba(22,96,68,.15));
  border: 1px solid var(--gw-green-600); border-radius: 12px;
}
.hole-finish-banner.hole-finish-partial {
  background: linear-gradient(135deg, rgba(202,138,4,.15), rgba(202,138,4,.05));
  border-color: rgba(202,138,4,.3);
}
.hole-finish-text { font-size: 14px; color: var(--gw-text); margin-bottom: 10px; font-weight: 500; }
.finish-btn-lg { padding: 12px 24px; font-size: 15px; }
.finish-review-panel {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: var(--gw-neutral-900, #111a14);
  border-top-left-radius: 20px; border-top-right-radius: 20px;
  border: 1px solid var(--gw-green-700); border-bottom: none;
  padding: 24px 20px calc(env(safe-area-inset-bottom) + 80px) 20px;
  box-shadow: 0 -8px 30px rgba(0,0,0,.5);
}
.finish-review-title { font-size: 20px; font-weight: 700; color: var(--gw-text); }
.finish-review-sub { font-size: 13px; color: var(--gw-text-muted); margin: 4px 0 16px; }
.finish-review-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.finish-review-player {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; background: var(--gw-card-bg, rgba(255,255,255,.04));
  border-radius: 10px; border: 1px solid rgba(255,255,255,.06);
}
.fr-name { flex: 1; font-size: 15px; font-weight: 600; color: var(--gw-text); }
.fr-total { font-size: 18px; font-weight: 700; color: var(--gw-text); }
.fr-net { font-size: 12px; color: var(--gw-text-muted); }
.finish-review-actions { display: flex; gap: 10px; }
.finish-review-actions .btn-cancel { flex: 1; }
.finish-review-actions .finish-btn { flex: 1; }

/* ── Wolf partner pick panel on hole view ───────────────────── */
.wolf-panel {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-600);
  border-radius: 12px; padding: 14px 16px; margin: 12px 0;
}
.wolf-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.wolf-label { font-size: 13px; font-weight: 600; color: var(--gw-gold); }
.wolf-current { font-size: 12px; color: var(--gw-text-secondary, #a3b8aa); }
.wolf-prompt { font-size: 11px; color: rgba(240,237,224,.5); margin-bottom: 6px; }
.wolf-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.wolf-pick-btn {
  flex: 1; min-width: 70px; padding: 10px 8px; border-radius: 10px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text); font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all .15s; text-align: center;
}
.wolf-pick-btn.active { background: var(--gw-green-600); border-color: var(--gw-gold); color: var(--gw-gold); }
.wolf-pick-btn:active { transform: scale(.95); }
.wolf-lone-btn {
  width: 100%; padding: 10px; border-radius: 10px; margin-top: 6px;
  background: rgba(212,175,55,.1); border: 1px solid rgba(212,175,55,.3);
  color: var(--gw-gold); font-size: 13px; font-weight: 600; cursor: pointer;
}
.wolf-lone-btn.active { background: rgba(212,175,55,.25); border-color: var(--gw-gold); }
.wolf-blind-btn {
  width: 100%; padding: 10px; border-radius: 10px; margin-top: 4px;
  background: rgba(220,38,38,.08); border: 1px solid rgba(220,38,38,.2);
  color: #f87171; font-size: 13px; font-weight: 600; cursor: pointer;
}
.wolf-blind-btn.active { background: rgba(220,38,38,.2); border-color: #f87171; }
</style>
