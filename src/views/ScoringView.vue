<template>
  <div class="view scoring-view" :class="{ 'is-landscape': isLandscape }">
    <!-- Landscape corner hint -->
    <div v-if="isLandscape && roundsStore.activeRound" class="landscape-hint">
      <span class="lh-arrow">↻</span> rotate to exit
    </div>

    <!-- Empty State -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🏌️</div>
      <h2 class="empty-title">No Active Round</h2>
      <p class="empty-message">Start a new round to begin tracking scores</p>
    </div>

    <!-- Active Round -->
    <div v-else class="round-container">
      <!-- Viewer-mode toast (shown when a non-captain taps a score cell) -->
      <transition name="fade">
        <div v-if="viewerToast" class="viewer-toast">{{ viewerToast }}</div>
      </transition>
      <!-- Header -->
      <header class="scoring-header">
        <div class="header-left">
          <h1 class="course-name">{{ roundsStore.activeRound.course_name }}</h1>
          <div class="header-meta">
            <span class="meta-tag">{{ roundsStore.activeRound.tee }}</span>
            <span class="meta-tag">{{ holesLabel }}</span>
            <span v-if="!isCaptain" class="meta-tag meta-viewer" title="View-only — you're not the scorer for this round">👀 Viewer</span>
          </div>
        </div>
        <div class="header-right-actions">
          <router-link to="/library" class="btn-rules-sm">📖</router-link>
          <button class="btn-round-menu" @click.stop="showRoundMenu = !showRoundMenu">⚙️</button>
        </div>
        <div v-if="showRoundMenu" class="round-menu-backdrop" @click="showRoundMenu = false"></div>
        <div v-if="showRoundMenu" class="round-menu-dropdown" @click.stop>
          <button v-if="isCaptain" class="round-menu-item" @click="showRoundMenu = false; showOppEditor = true">
            ⚔️ Set Opponent Group
          </button>
          <button v-if="isCaptain" class="round-menu-item" @click="showRoundMenu = false; showHcpEditor = true">
            ✏️ Edit Player Handicaps
          </button>
          <button v-if="isCaptain" class="round-menu-item" @click="showRoundMenu = false; showGameEditor = true">
            🎲 Edit Games & Stakes
          </button>
          <button v-if="isCaptain" class="round-menu-item" @click="showRoundMenu = false; openRetroScore()">
            📝 Enter Scores from Card
          </button>
          <button class="round-menu-item" v-if="isCaptain && !roundsStore.activeRound?.is_complete" @click="showRoundMenu = false; finishRound()">
            ✅ Finish Round
          </button>
          <button v-if="isCaptain" class="round-menu-item round-menu-danger" @click="showRoundMenu = false; confirmDeleteActive = true">
            🗑️ Delete Round
          </button>
          <div v-if="!isCaptain" class="round-menu-item round-menu-note">
            👀 You're viewing this round in read-only mode. Ask the scorer to transfer the role if needed.
          </div>
        </div>
      </header>

      <!-- Opponent group strip -->
      <div v-if="opponentPlayers.length" class="opp-strip">
        <span class="opp-strip-label">vs</span>
        <span v-for="p in opponentPlayers" :key="p.id" class="opp-strip-player">{{ p.shortName || p.name }}</span>
      </div>

      <!-- HCP Editor Modal -->
      <div v-if="showHcpEditor" class="hcp-editor-overlay" @click.self="showHcpEditor = false">
        <div class="hcp-editor-modal">
          <div class="hcp-editor-title">Edit Handicap Indexes</div>
          <div class="hcp-editor-note">Changes apply to this round only and recalculate strokes immediately.</div>
          <div v-for="m in roundsStore.activeMembers" :key="m.id" class="hcp-editor-row">
            <span class="hcp-editor-name">{{ m.short_name || m.guest_name }}</span>
            <input
              type="number"
              step="0.1"
              class="hcp-editor-input"
              :value="m.ghin_index"
              @change="updateMemberHcp(m.id, $event.target.value)"
              placeholder="—"
            />
          </div>
          <button class="hcp-editor-done" @click="showHcpEditor = false">Done</button>
        </div>
      </div>

      <!-- Opponent Group Editor -->
      <div v-if="showOppEditor" class="hcp-editor-overlay" @click.self="showOppEditor = false">
        <div class="hcp-editor-modal opp-editor-modal">
          <div class="hcp-editor-title">⚔️ Opponent Group</div>
          <div class="hcp-editor-note">Pick the players you're competing against today.</div>

          <!-- Current opponents as removable chips -->
          <div v-if="editOppPlayers.length" class="opp-edit-chips">
            <div v-for="(p, i) in editOppPlayers" :key="p.id" class="opp-edit-chip">
              <span>{{ p.shortName || p.name }}</span>
              <button @click="editOppPlayers.splice(i, 1)">×</button>
            </div>
          </div>
          <div v-else class="opp-edit-empty">No opponents set — pick from roster below</div>

          <!-- Roster picker -->
          <input v-model="oppEditorSearch" class="hcp-editor-input opp-editor-search" placeholder="Search roster…" style="width:100%;margin:8px 0" />
          <div class="opp-editor-roster">
            <div
              v-for="p in oppEditorFiltered"
              :key="p.id"
              class="opp-editor-row"
              :class="{ 'opp-editor-row--on': isEditOppAdded(p), 'opp-editor-row--mine': isMyPlayer(p) }"
              @click="toggleEditOpp(p)"
            >
              <span class="opp-editor-name">{{ p.name }}</span>
              <span class="opp-editor-hcp">idx {{ p.ghin_index ?? '—' }}</span>
              <span class="opp-editor-check">{{ isEditOppAdded(p) ? '✓' : isMyPlayer(p) ? '—' : '+' }}</span>
            </div>
          </div>

          <!-- Guest quick-add -->
          <div class="quick-add-row" style="margin-top:8px">
            <input v-model="oppEditorGuestName" class="hcp-editor-input" placeholder="Add guest…" style="flex:1" @keydown.enter="oppEditorAddGuest" />
            <button class="hcp-editor-done" style="padding:8px 14px;flex-shrink:0" @click="oppEditorAddGuest">Add</button>
          </div>

          <div class="opp-editor-actions">
            <button class="hcp-editor-done" @click="saveOppEditor">Save</button>
          </div>
        </div>
      </div>

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

      <!-- ── Retro score overlay (bulk-enter scores from paper card) ── -->
      <div v-if="showRetroScore" class="delete-overlay" @click="showRetroScore = false">
        <div class="retro-panel" @click.stop>
          <div class="retro-header">
            <div>
              <h3 class="retro-title">📝 Enter Scores from Card</h3>
              <div class="retro-sub">Empty cells in red — tap any cell to type a score. Missing holes won't be saved.</div>
            </div>
            <button class="close-btn-sm" @click="showRetroScore = false">✕</button>
          </div>

          <div class="retro-scroll">
            <table class="retro-grid">
              <thead>
                <tr>
                  <th class="retro-th retro-th--player">Player</th>
                  <th v-for="h in visibleHoles" :key="h" class="retro-th">{{ h }}</th>
                </tr>
                <tr class="retro-par-row">
                  <th class="retro-th retro-th--player">Par</th>
                  <th v-for="h in visibleHoles" :key="'par-'+h" class="retro-th retro-par">{{ parForHole(h) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in roundsStore.activeMembers" :key="m.id">
                  <td class="retro-td retro-td--player">{{ memberGridName(m) }}</td>
                  <td
                    v-for="h in visibleHoles"
                    :key="'rc-'+m.id+'-'+h"
                    class="retro-td"
                    :class="{ 'retro-empty': retroScores[m.id]?.[h] == null || retroScores[m.id]?.[h] === '' }"
                  >
                    <input
                      type="number"
                      inputmode="numeric"
                      min="1"
                      max="20"
                      :value="retroScores[m.id]?.[h] ?? ''"
                      @input="onRetroInput(m.id, h, $event.target.value)"
                      class="retro-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="retro-footer">
            <div class="retro-count">{{ retroFilledCount }} / {{ roundsStore.activeMembers.length * visibleHoles.length }} cells filled</div>
            <button class="btn-ghost" @click="showRetroScore = false">Cancel</button>
            <button class="btn-primary" :disabled="retroSaving" @click="saveRetroScores">
              {{ retroSaving ? 'Saving…' : `Save ${retroFilledCount} scores` }}
            </button>
          </div>
          <div v-if="retroError" class="retro-error">{{ retroError }}</div>
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

        <!-- Cross-match banner (shown only when a linked match touches this round) -->
        <CrossMatchBanner />

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

        <!-- ── Unified scorecard toolbar — chips + action icons ─── -->
        <div class="scorecard-toolbar">
          <button
            v-if="gameNotationRows.length > 0"
            class="dt-chip"
            :class="{ 'dt-chip--on': showGameRows }"
            @click="showGameRows = !showGameRows"
            :title="showGameRows ? 'Hide game rows below grid' : 'Show game rows below grid'"
          >
            <span class="dt-dot" :class="{ 'dt-dot--on': showGameRows }"></span>
            Games
          </button>
          <button
            class="dt-chip"
            :class="{ 'dt-chip--on': showNotations }"
            @click="showNotations = !showNotations"
            :title="showNotations ? 'Hide score notations' : 'Show score notations'"
          >
            <span class="dt-dot" :class="{ 'dt-dot--on': showNotations }"></span>
            Notations
          </button>
          <button
            class="dt-chip"
            :class="{ 'dt-chip--on': !showFullHcp }"
            @click="showFullHcp = !showFullHcp"
            :title="showFullHcp ? 'Full handicap' : 'Low-man handicap (strokes relative to lowest index)'"
          >
            <span class="dt-dot" :class="{ 'dt-dot--on': !showFullHcp }"></span>
            {{ showFullHcp ? 'Full HCP' : 'Low-Man HCP' }}
          </button>
          <span class="sct-spacer"></span>
          <button class="sim-btn" @click="simulateFill" title="Fill random scores">🎲</button>
          <button class="sim-btn sim-btn-reset" @click="resetScores" title="Reset all scores">↺</button>
        </div>

        <!-- Horizontal Scorecard Grid -->
        <div class="scorecard-outer">
        <div class="scorecard-scroll">
          <table class="scorecard-grid">
            <thead>
              <tr class="row-header">
                <th class="col-sticky col-player-header">Player</th>
                <!-- Front 9 -->
                <th v-for="h in frontHoles" :key="h" class="col-hole-num" @click="activeHole = h">
                  {{ h }}
                  <span v-if="pressHoles.has(h)" class="press-badge" title="Nassau press opened on this hole">P</span>
                </th>
                <!-- OUT subtotal -->
                <th v-if="hasBack9" class="col-subtotal">OUT</th>
                <!-- Back 9 -->
                <th v-for="h in backHoles" :key="h" class="col-hole-num" @click="activeHole = h">
                  {{ h }}
                  <span v-if="pressHoles.has(h)" class="press-badge" title="Nassau press opened on this hole">P</span>
                </th>
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
                    <span class="player-nm" :class="teamTextClass(group.member)">{{ memberGridName(group.member) }}</span>
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
                    <span v-if="getScore(group.member.id, h)" :class="showNotations ? scoreNotation(getScore(group.member.id, h), parForHole(h)) : ''">{{ getScore(group.member.id, h) }}</span>
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
                    <span v-if="getScore(group.member.id, h)" :class="showNotations ? scoreNotation(getScore(group.member.id, h), parForHole(h)) : ''">{{ getScore(group.member.id, h) }}</span>
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
            <tfoot v-if="gameNotationRows.length > 0 && showGameRows">
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
        </div><!-- /.scorecard-outer -->

        <!-- Live Games Summary -->
        <div v-if="roundsStore.activeGames.length > 0" class="live-games-box">
          <div class="live-games-label collapsible-header" @click="gamesExpanded = !gamesExpanded">
            {{ gamesExpanded ? '▼' : '▶' }} 🎲 Live Games
          </div>
          <div v-show="gamesExpanded">
            <div v-for="game in roundsStore.activeGames" :key="game.id" class="live-game-summary" v-html="gameSummaryHtml(game)"></div>
          </div>
        </div>

        <!-- Settle Up Panel -->
        <div v-if="liveSettlements && roundsStore.activeGames.length > 0 && roundsStore.activeRound?.is_complete" class="settle-box">
          <div class="settle-box-label">💵 Settle Up</div>
          <!-- Player totals row -->
          <div class="settle-totals">
            <div
              v-for="(pt, id) in liveSettlements.playerTotals"
              :key="'pt-'+id"
              class="settle-player"
              :class="pt.total > 0 ? 'settle-up' : pt.total < 0 ? 'settle-down' : 'settle-even'"
            >
              <span class="settle-name">{{ pt.name }}</span>
              <span class="settle-amount">{{ pt.total > 0 ? '+' : '' }}${{ pt.total.toFixed(0) }}</span>
            </div>
          </div>
          <!-- Ledger -->
          <div v-if="liveSettlements.ledger.length > 0" class="settle-ledger">
            <div v-for="(entry, i) in liveSettlements.ledger" :key="'le-'+i" class="settle-entry">
              <span class="settle-from">{{ entry.from_name }}</span>
              <span class="settle-arrow">→</span>
              <span class="settle-to">{{ entry.to_name }}</span>
              <span class="settle-pay">${{ entry.amount.toFixed(0) }}</span>
            </div>
          </div>
          <div v-else class="settle-even-msg">All square 🤝</div>
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

        <!-- Press banner — a Nassau press opened on this hole -->
        <div v-if="pressHoles.has(activeHole)" class="press-banner">
          <span class="press-banner-icon">💥</span>
          <span class="press-banner-text">
            <strong>Press opened!</strong> A new bet is on — stakes doubled from this hole.
          </span>
        </div>


        <!-- Player Score Cards — inline +/- entry -->
        <div class="hole-players-list">
          <div
            v-for="group in sortedPlayerGroups"
            :key="group.member.id"
            class="player-hole-card"
            :class="[teamCardClass(group.member), { 'card-winner': isNetWinner(group.member.id, activeHole) }]"
          >
            <div class="phc-identity">
              <div class="phc-initials" :class="teamBadgeClass(group.member)">{{ playerInitials(group.member) }}</div>
              <div class="phc-name-col">
                <div class="phc-hcp-row">
                  <span class="phc-hcp-course" :class="teamTextClass(group.member)">{{ memberHandicapDisplay(group.member) }}</span>
                  <span v-if="lowManStrokes(group.member) !== null" class="phc-hcp-lowman">({{ lowManStrokes(group.member) }})</span>
                  <span v-if="strokeDotsOnHole(group.member, activeHole)" class="phc-stroke-dots">{{ '•'.repeat(strokeDotsOnHole(group.member, activeHole)) }}</span>
                </div>
              </div>
            </div>
            <div class="phc-score-entry">
              <button class="score-tap score-tap-minus" @click="inlineDec(group.member)">−</button>
              <div
                class="score-display"
                :class="[getScore(group.member.id, activeHole) ? 'has-score' : '', showNotations ? 'nota-mode' : '']"
                @click="inlineSetPar(group.member)"
              >
                <span :class="getScore(group.member.id, activeHole) ? (showNotations ? scoreNotation(getScore(group.member.id, activeHole), parForHole(activeHole)) : '') : 'muted'">
                  {{ getScore(group.member.id, activeHole) || '—' }}
                </span>
              </div>
              <button class="score-tap score-tap-plus" @click="inlineInc(group.member)">+</button>
            </div>
            <div class="phc-net-col">
              <div class="phc-net-label">NET</div>
              <div class="phc-net-value" :class="getScore(group.member.id, activeHole) ? (showNotations ? scoreNotation(netScore(getScore(group.member.id, activeHole), memberEffectiveHcp(group.member), siForHole(activeHole)), parForHole(activeHole)) : '') : 'muted'">
                {{ getScore(group.member.id, activeHole) ? netScore(getScore(group.member.id, activeHole), memberEffectiveHcp(group.member), siForHole(activeHole)) : '—' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Game Status on Hole View -->
        <div v-if="roundsStore.activeGames.length > 0" class="hole-game-status">
          <div class="hole-gs-header collapsible-header" @click="gamesExpanded = !gamesExpanded">
            {{ gamesExpanded ? '▼' : '▶' }} GAME STATUS · THRU {{ lastScoredHole }}
          </div>
          <div v-show="gamesExpanded">
            <div v-for="game in roundsStore.activeGames" :key="'hgs-'+game.id" class="hole-gs-summary" v-html="gameSummaryHtml(game)"></div>
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
            >{{ memberDisplay(member) }}</button>
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
            >{{ memberDisplay(member) }}</button>
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
                <span class="fr-name">{{ memberDisplay(member) }}</span>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore, displayName as rosterDisplayName, displayInitials as rosterDisplayInitials } from '../stores/roster'
import { COURSES } from '../modules/courses'
import {
  memberHandicap as _memberHandicap, strokesOnHole, holeSI, holePar, holeYards,
  netScore as calcNetScore, memberNetOnHoleLowMan, getScore as _getScore,
  computeNassau, computeSkins, computeMatch, computeVegas, computeSnake,
  computeHiLow, computeStableford, computeWolf, computeHammer, computeSixes,
  computeFiveThreeOne, computeDots, computeFidget, computeBestBallNet, computeBestBall,
  holeRange
} from '../modules/gameEngine'
import { computeAllSettlements } from '../modules/settlements'
import CrossMatchBanner from '../components/CrossMatchBanner.vue'

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const coursesStore = useCoursesStore()
const rosterStore = useRosterStore()
const router = useRouter()

// ── View state ──────────────────────────────────────────────────
const activeHole = ref(0) // 0 = Card view, >0 = Hole entry
const selectedGame = ref(null)
const showRoundMenu = ref(false)
const confirmDeleteActive = ref(false)
const showGameEditor = ref(false)
const showHcpEditor = ref(false)
const showOppEditor = ref(false)

// ── Opponent editor state ─────────────────────────────────────────
const editOppPlayers = ref([])
const oppEditorSearch = ref('')
const oppEditorGuestName = ref('')

watch(showOppEditor, (open) => {
  if (open) {
    // Seed from active round
    editOppPlayers.value = [...(roundsStore.activeRound?.opponent_players || [])]
    oppEditorSearch.value = ''
    oppEditorGuestName.value = ''
  }
})

const oppEditorFiltered = computed(() => {
  const q = oppEditorSearch.value.toLowerCase()
  const all = rosterStore.players
  const list = q ? all.filter(p => p.name.toLowerCase().includes(q)) : all
  return list.slice().sort((a, b) => {
    const la = (a.name.split(' ').pop() + a.name).toLowerCase()
    const lb = (b.name.split(' ').pop() + b.name).toLowerCase()
    return la.localeCompare(lb)
  })
})

function isEditOppAdded(p) { return editOppPlayers.value.some(op => op.id === p.id) }
function isMyPlayer(p) { return roundsStore.activeMembers.some(m => (m.profile_id === p.id) || (m.guest_name === p.name)) }

function toggleEditOpp(p) {
  if (isMyPlayer(p)) return
  if (isEditOppAdded(p)) {
    editOppPlayers.value = editOppPlayers.value.filter(op => op.id !== p.id)
  } else {
    editOppPlayers.value.push({ id: p.id, name: p.name, shortName: p.short_name, ghinIndex: p.ghin_index })
  }
}

function oppEditorAddGuest() {
  if (!oppEditorGuestName.value.trim()) return
  editOppPlayers.value.push({
    id: `opp_guest_${Date.now()}`,
    name: oppEditorGuestName.value.trim(),
    shortName: oppEditorGuestName.value.trim().split(' ')[0].slice(0, 8),
    ghinIndex: null,
  })
  oppEditorGuestName.value = ''
}

async function saveOppEditor() {
  if (!roundsStore.activeRound) return
  const players = editOppPlayers.value
  // Update local state immediately
  roundsStore.activeRound.opponent_players = players
  showOppEditor.value = false
  // Persist to Supabase
  try {
    const { supaRawRequest } = await import('../modules/supaRaw')
    await supaRawRequest(
      'PATCH',
      `rounds?id=eq.${roundsStore.activeRound.id}`,
      { opponent_players: players },
      8000,
      { Prefer: 'return=minimal' }
    )
  } catch (e) {
    console.warn('[scoring] saveOppEditor failed:', e?.message)
  }
}
const showNotations = ref(true)   // per-score-cell shapes (birdie circle, bogey box, etc.)
const showGameRows = ref(true)    // game-outcome tfoot rows (Nassau status, match L/W/½, etc.)
const showFinishReview = ref(false)
const showFullHcp = ref(false) // false = low-man dots (default), true = full course HCP dots

// ── Landscape mode (glance-only scorecard) ──────────────────────
// When the phone rotates to landscape we switch to a stripped-down
// scorecard-only view so the grid fills the full viewport.
const isLandscape = ref(false)
let _landscapeMql = null
let _landscapeHandler = null
// Remember what the user was on in portrait so rotating back restores it
let _preLandscapeHole = 0

function _applyLandscape(match) {
  isLandscape.value = match
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('gw-landscape', match)
  }
  if (match) {
    // Snap to card view — landscape is glance-only
    _preLandscapeHole = activeHole.value
    activeHole.value = 0
  } else {
    // Rotate back → restore previous hole (if they were on one)
    if (_preLandscapeHole > 0) activeHole.value = _preLandscapeHole
  }
}

onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  // Narrow enough to be a phone/tablet in landscape; avoids desktop browsers triggering
  _landscapeMql = window.matchMedia('(orientation: landscape) and (max-height: 600px)')
  _landscapeHandler = (e) => _applyLandscape(e.matches)
  // Initial value
  _applyLandscape(_landscapeMql.matches)
  // Listener (newer API falls back to older one on Safari <14)
  if (_landscapeMql.addEventListener) _landscapeMql.addEventListener('change', _landscapeHandler)
  else if (_landscapeMql.addListener) _landscapeMql.addListener(_landscapeHandler)
})

onUnmounted(() => {
  // Leaving the view: make sure the body class is cleared
  if (typeof document !== 'undefined') document.body.classList.remove('gw-landscape')
  if (!_landscapeMql) return
  if (_landscapeMql.removeEventListener) _landscapeMql.removeEventListener('change', _landscapeHandler)
  else if (_landscapeMql.removeListener) _landscapeMql.removeListener(_landscapeHandler)
  _landscapeMql = null
  _landscapeHandler = null
})
const gamesExpanded = ref(true)

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

// ── Captain / viewer role ──────────────────────────────────────
// Captain = the signed-in user who OWNS this round. For local/guest rounds
// everyone is effectively the captain. Non-captain viewers can read the
// scorecard but can't tap to enter scores (RLS would block the write anyway
// at the DB level, but we preempt it client-side with a clear toast).
// Opponent group from the active round
const opponentPlayers = computed(() => {
  const r = roundsStore.activeRound
  if (!r || !Array.isArray(r.opponent_players)) return []
  return r.opponent_players
})

const isCaptain = computed(() => {
  const r = roundsStore.activeRound
  if (!r) return true
  // Guest round (no owner) — whoever is looking at it is effectively the captain
  if (!r.owner_id) return true
  // Unauthenticated user viewing a real round — not the captain
  if (!authStore.isAuthenticated) return false
  return r.owner_id === authStore.user?.id
})

const viewerToast = ref('')
function flashViewerToast() {
  viewerToast.value = 'View-only — ask the scorer to enter this score, or request scorer role in the ⚙️ menu.'
  setTimeout(() => { viewerToast.value = '' }, 3500)
}

// ── Retro scoring (bulk-enter 18 holes from paper card) ───────
const showRetroScore = ref(false)
const retroScores = ref({})   // { memberId: { hole: number|string|'' } }
const retroSaving = ref(false)
const retroError = ref('')

function openRetroScore() {
  // Seed the editor with existing scores
  const seeded = {}
  for (const m of roundsStore.activeMembers) {
    seeded[m.id] = {}
    const live = roundsStore.activeScores[m.id] || {}
    for (const h of (visibleHoles.value || [])) {
      if (live[h] != null) seeded[m.id][h] = live[h]
    }
  }
  retroScores.value = seeded
  retroError.value = ''
  showRetroScore.value = true
}

function onRetroInput(memberId, hole, value) {
  const v = value === '' || value == null ? null : Number(value)
  if (!retroScores.value[memberId]) retroScores.value[memberId] = {}
  if (v == null || Number.isNaN(v)) {
    delete retroScores.value[memberId][hole]
  } else if (v >= 1 && v <= 20) {
    retroScores.value[memberId][hole] = v
  }
}

const retroFilledCount = computed(() => {
  let n = 0
  for (const mid in retroScores.value) {
    for (const h in retroScores.value[mid]) {
      if (retroScores.value[mid][h] != null && retroScores.value[mid][h] !== '') n++
    }
  }
  return n
})

async function saveRetroScores() {
  if (retroSaving.value) return
  retroSaving.value = true
  retroError.value = ''
  let saved = 0
  let failed = 0
  try {
    for (const m of roundsStore.activeMembers) {
      const byHole = retroScores.value[m.id] || {}
      for (const h of (visibleHoles.value || [])) {
        const v = byHole[h]
        if (v == null || v === '') continue
        const existing = roundsStore.activeScores[m.id]?.[h]
        if (existing === v) continue // no-op
        try {
          await roundsStore.setScore(m.id, h, v)
          saved++
        } catch (e) {
          failed++
        }
      }
    }
    if (failed > 0) {
      retroError.value = `Saved ${saved}. ${failed} score(s) failed — check your connection and try again.`
    } else {
      showRetroScore.value = false
    }
  } finally {
    retroSaving.value = false
  }
}

// ── Course data ─────────────────────────────────────────────────
const courseData = computed(() => {
  if (!roundsStore.activeRound) return null
  const name = roundsStore.activeRound.course_name

  // 1) Prefer the round's frozen course_snapshot so later course edits
  //    never retroactively change this round's net scores / notations.
  const snap = roundsStore.activeRound.course_snapshot
  if (snap && Array.isArray(snap.par) && snap.par.length) {
    return {
      name: snap.name || name,
      par: snap.par,
      si: snap.si,
      teesData: snap.teesData,
      tees: snap.teesData,
      defaultTee: snap.defaultTee,
      _fromSnapshot: true,
    }
  }

  // 2) Fallback for pre-snapshot rounds: use live store (may drift after edits,
  //    but at least renders something).
  const fromStore = coursesStore.allCourses?.find(c => c.name === name)
  if (fromStore) return fromStore
  return COURSES[name] || null
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

// Returns the effective handicap to use for net scoring given the current HCP toggle
function memberEffectiveHcp(member) {
  if (showFullHcp.value) return memberHandicapValue(member)
  const lm = lowManStrokes(member)
  return lm != null ? lm : memberHandicapValue(member)
}

function netScore(gross, hcp, si) {
  if (gross == null) return null
  return gross - strokesOnHole(hcp, si)
}

function strokeDotsOnHole(member, hole) {
  const si = siForHole(hole)
  if (showFullHcp.value) {
    // Full course HCP dots
    return strokesOnHole(memberHandicapValue(member), si)
  }
  // Default: low-man adjusted dots (strokes vs the best player)
  const lm = lowManStrokes(member)
  return lm != null ? strokesOnHole(lm, si) : strokesOnHole(memberHandicapValue(member), si)
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
  const hcp = memberEffectiveHcp(member)
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
  return memberInitials(member)
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
// "Jason Spieler" → "JS", "J. Spieler" → "JS", "Spieler" → "S?"
// Always first initial + last initial from full name
function nameToInitials(name) {
  if (!name || name === '?') return '??'
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  // Single word — use first two chars (best we can do without full name)
  if (parts[0]?.length >= 2) return (parts[0][0] + parts[0][1]).toUpperCase()
  return (parts[0]?.[0] ?? '?').toUpperCase() + '?'
}

// Helper: get member display name with nickname support (full name — used in
// dialogs, buttons, hole-view identity badge labels — where space is plentiful)
function memberDisplay(m) {
  if (!m) return '?'
  if (m.use_nickname && m.nickname) return m.nickname
  return m.guest_name || m.name || m.short_name || '?'
}

// ── Compact initials for the scorecard grid / notation rows ──────────────
// Rule: ALWAYS initials in the grid — never nicknames (they eat horizontal
// space). Collision-aware: if two members in this round produce the same
// initials, extend each collider with the 2nd letter of their last name
// until unique (e.g. "J. Smith" + "J. Smithers" → "JSm" + "JSmi").
function _baseInitials(m) {
  if (!m) return '??'
  const src = m.guest_name || m.name || m.short_name || ''
  return nameToInitials(src)
}

// Build a de-duped initials map across current round members. Cached by
// member-id list identity so we don't recompute every render.
let _initialsCache = { key: null, map: null }
function _buildInitialsMap() {
  const members = roundsStore.activeMembers || []
  const key = members.map(m => m.id).join('|')
  if (_initialsCache.key === key && _initialsCache.map) return _initialsCache.map
  const map = new Map()
  // First pass: base 2-char initials
  const base = new Map()
  for (const m of members) base.set(m.id, _baseInitials(m))
  // Detect collisions and extend
  const counts = new Map()
  for (const v of base.values()) counts.set(v, (counts.get(v) || 0) + 1)
  for (const m of members) {
    const b = base.get(m.id)
    if ((counts.get(b) || 0) <= 1) {
      map.set(m.id, b)
      continue
    }
    // Collision: extend with extra letter of last name (or first name if single word)
    const full = (m.guest_name || m.name || m.short_name || '').trim()
    const parts = full.replace(/\./g, '').split(/\s+/).filter(Boolean)
    let ext = b
    // Try adding letters from last-name (or only-word), starting at index 1
    const word = parts.length >= 2 ? parts[parts.length - 1] : (parts[0] || '')
    for (let extra = 1; extra <= 3 && ext.length < 5; extra++) {
      const candidate = b + (word[extra] || '').toLowerCase()
      // Make sure we stopped colliding
      const stillCollides = members.some(o => o.id !== m.id && _baseInitials(o) === b && (() => {
        const oFull = (o.guest_name || o.name || o.short_name || '').trim()
        const oParts = oFull.replace(/\./g, '').split(/\s+/).filter(Boolean)
        const oWord = oParts.length >= 2 ? oParts[oParts.length - 1] : (oParts[0] || '')
        const oCandidate = b + (oWord[extra] || '').toLowerCase()
        return oCandidate === candidate
      })())
      ext = candidate
      if (!stillCollides) break
    }
    map.set(m.id, ext)
  }
  _initialsCache = { key, map }
  return map
}

// Compact grid label: always initials (never nickname). Safe against collisions.
function memberGridName(member) {
  if (!member) return '?'
  const map = _buildInitialsMap()
  return map.get(member.id) || _baseInitials(member)
}

// Initials used for notation rows / team labels. Same rule: compact initials,
// collision-aware, never the nickname.
function memberInitials(m) {
  if (!m) return '??'
  const map = _buildInitialsMap()
  return map.get(m.id) || _baseInitials(m)
}

// Helper: build team initials string like "JS+BC"
function teamInitialsStr(teamIds) {
  return teamIds.map(id => {
    const m = roundsStore.activeMembers.find(m => m.id === id)
    return memberInitials(m)
  }).join('+')
}

// Helper: player short initial (2 chars) for attribution
function pInit(memberId) {
  const m = roundsStore.activeMembers.find(m => m.id === memberId)
  return memberInitials(m)
}

// Rendered HTML for a "halved" hole — proper fraction with offset 1 / 2.
// Used by Nassau, Match, 1v1 notation rows. Styled in .nota-frac rule below.
// Diagonal slash is drawn with a CSS pseudo-element rather than the ⁄ glyph
// (which renders as a hyphen in Safari's default fallback font).
const HALVED_HTML = '<span class="nota-frac" aria-label="halved"><span class="nf-num">1</span><span class="nf-den">2</span></span>'

// Hole numbers where a Nassau press was auto-opened. Shown as a small P
// badge on the scorecard grid's hole-number header.
const pressHoles = computed(() => {
  const set = new Set()
  const ctx = buildCtx()
  if (!ctx) return set
  for (const game of (roundsStore.activeGames || [])) {
    if (game.type?.toLowerCase() !== 'nassau') continue
    try {
      const r = computeNassau(ctx, game.config || {})
      const allPresses = [
        ...(r.frontSeg?.presses || []),
        ...(r.backSeg?.presses || []),
      ]
      for (const p of allPresses) {
        if (p?.start) set.add(p.start)
      }
    } catch { /* skip */ }
  }
  return set
})

const gameNotationRows = computed(() => {
  const rows = []
  const ctx = buildCtx()
  const games = roundsStore.activeGames

  for (const game of games) {
    const t = game.type?.toLowerCase()

    // ── NASSAU — running Ux/Dx/AS per hole (team1 perspective) ──
    if (t === 'nassau') {
      try {
        const r = computeNassau(ctx, game.config)
        const cfg = game.config || {}
        const t1Label = teamInitialsStr(cfg.team1 || [])
        const t2Label = teamInitialsStr(cfg.team2 || [])
        const cells = {}
        const allHR = [...(r.frontSeg?.holeResults || []), ...(r.backSeg?.holeResults || [])]

        // Each hole shows the match-play standing FROM TEAM 1's perspective
        // AFTER that hole. t1Up > 0 → team 1 is up. t1Up < 0 → team 1 is down.
        // 0 → All Square. Cell stays empty on holes not yet played.
        for (const hr of allHR) {
          if (hr.n1 == null || hr.n2 == null) { cells[hr.hole] = { text: '', cls: '' }; continue }
          const up = hr.t1Up ?? 0
          if (up > 0) cells[hr.hole] = { text: `U${up}`, cls: 'nota-t1' }
          else if (up < 0) cells[hr.hole] = { text: `D${Math.abs(up)}`, cls: 'nota-t2' }
          else cells[hr.hole] = { text: 'AS', cls: 'nota-halved' }
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

    // ── MATCH / 1v1 — running Ux/Dx/AS per hole (player1 perspective) ──
    if (t === 'match' || t === 'match1v1') {
      try {
        const r = computeMatch(ctx, game.config)
        if (!r) continue
        const cells = {}
        const played = r.holeResults?.filter(hr => !hr.incomplete) || []
        const totalHoles = visibleHoles.value.length
        for (const hr of (r.holeResults || [])) {
          if (hr.incomplete) { cells[hr.hole] = { text: '', cls: '' }; continue }
          const up = hr.p1Up ?? 0
          if (up > 0) cells[hr.hole] = { text: `U${up}`, cls: 'nota-t1' }
          else if (up < 0) cells[hr.hole] = { text: `D${Math.abs(up)}`, cls: 'nota-t2' }
          else cells[hr.hole] = { text: 'AS', cls: 'nota-halved' }
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

// ── Live settlements (who owes who) ─────────────────────────────
const liveSettlements = computed(() => {
  if (!roundsStore.activeRound || roundsStore.activeGames.length === 0) return null
  const ctx = buildCtx()
  try {
    return computeAllSettlements(ctx, roundsStore.activeGames)
  } catch (e) {
    return null
  }
})

function gameSummaryHtml(game) {
  const ctx = buildCtx()
  const cfg = game.config || {}
  const icon = gameIcon(game.type)
  const t = game.type?.toLowerCase()

  // Shared compact game-line renderer.
  // Title row: <icon> <GameType> — ⭐ <winner> +<value>
  // Detail row: <detail text>
  // value: { pts: number|null, dollars: number|null }   — both can be present
  function _gameLine({ gameName, winner, value, detail }) {
    const valStr = (() => {
      if (!value) return ''
      const parts = []
      if (value.pts != null) parts.push(`+${value.pts} pt${value.pts === 1 ? '' : 's'}`)
      if (value.dollars != null) parts.push(`+$${value.dollars}`)
      return parts.join(' · ')
    })()
    const titleRight = winner
      ? `<span class="gs-winner"><span class="gs-star">⭐️</span> <span class="gs-winner-name">${winner}</span><span class="gs-value">${valStr ? '&nbsp;' + valStr : ''}</span></span>`
      : (valStr ? `<span class="gs-value gs-value-muted">${valStr}</span>` : '')
    const titleLeft = `<span class="gs-game-title">${icon} ${gameName}</span>`
    const titleRow = `<div class="gs-title-row">${titleLeft}${titleRight ? '<span class="gs-dash">·</span>' + titleRight : ''}</div>`
    const detailRow = detail ? `<div class="gs-detail-row">${detail}</div>` : ''
    return `<div class="gs-line">${titleRow}${detailRow}</div>`
  }

  try {
    // ── Nassau ──
    if (t === 'nassau') {
      const r = computeNassau(ctx, cfg)
      const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
      const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'

      // frontSeg/backSeg return: { holeResults, t1Up, t1Wins, pressWins, presses }
      // settlement returns: { front, back, overall, total } — positive = t1 wins
      function fmtSeg(label, seg, segDollar) {
        if (!seg) return `<span style="opacity:.35">${label}: —</span>`
        const up = seg.t1Up
        const fmtUp = up === 0 ? 'AS' : (up > 0 ? `+${up}` : `${up}`)
        // Include press scores
        const pressStrs = (seg.presses || []).map(p => {
          const s = p.score || 0
          return s === 0 ? 'AS' : (s > 0 ? `+${s}` : `${s}`)
        })
        const slashStatus = [fmtUp, ...pressStrs].join('/')
        let html = `<span style="font-weight:600">${label}:</span> <span style="font-family:monospace;letter-spacing:0.5px">${slashStatus}</span>`
        if (segDollar !== 0) {
          const winner = segDollar > 0 ? t1n : t2n
          html += ` · <span style="color:#4ade80;font-weight:700">${winner} $${Math.abs(segDollar)}</span>`
        }
        return html
      }

      const s = r.settlement
      const fHtml = fmtSeg('Front', r.frontSeg, s.front)
      const bHtml = fmtSeg('Back', r.backSeg, s.back)
      // Overall: compute up from overallUp
      const oUp = r.overallUp
      const oFmt = oUp === 0 ? 'AS' : (oUp > 0 ? `+${oUp}` : `${oUp}`)
      let oHtml = `<span style="font-weight:600">Overall:</span> <span style="font-family:monospace;letter-spacing:0.5px">${oFmt}</span>`
      if (s.overall !== 0) {
        const oWinner = s.overall > 0 ? t1n : t2n
        oHtml += ` · <span style="color:#4ade80;font-weight:700">${oWinner} $${Math.abs(s.overall)}</span>`
      }

      let totLine = ''
      const netOwed = s.total
      if (netOwed !== 0) {
        const payer = netOwed < 0 ? t1n : t2n
        const payee = netOwed < 0 ? t2n : t1n
        const grossTotal = Math.abs(s.front) + Math.abs(s.back) + Math.abs(s.overall)
        const grossNote = grossTotal > Math.abs(netOwed) ? ` <span style="font-size:10px;opacity:.5">(gross: $${grossTotal})</span>` : ''
        totLine = `<div style="font-size:12px;font-weight:700;margin-top:5px;padding:5px 8px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:8px;color:#4ade80">💰 ${payer} owe ${payee} $${Math.abs(netOwed)}${grossNote}</div>`
      } else if (Math.abs(s.front) + Math.abs(s.back) + Math.abs(s.overall) > 0) {
        totLine = `<div style="font-size:11px;margin-top:4px;opacity:.5">All square · $${Math.abs(s.front) + Math.abs(s.back) + Math.abs(s.overall)} action</div>`
      }

      const fAmt = cfg.front ?? 10
      const bAmt = cfg.back ?? 10
      const oAmt = cfg.overall ?? 20
      const pressInfo = cfg.pressAt ? ` · press@${cfg.pressAt}` : ''
      const nassauLabel = cfg._sideMatch ? '1v1 Nassau' : 'Nassau'
      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${nassauLabel}</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${fAmt}/$${bAmt}/$${oAmt}${pressInfo}</span><div style="font-size:11px;margin-top:3px;display:flex;flex-direction:column;gap:2px"><div>${fHtml}</div><div>${bHtml}</div><div>${oHtml}</div></div>${totLine}</div>`
    }

    // ── Skins ──
    // Engine returns: { holeResults, totals, settlements, potValue, ppt, payoutModel }
    // holeResults[]: { hole, winner, winnerName, pot, net } or { hole, winner:null, pot, reason }
    // settlements[]: { id, name, skins, net }
    if (t === 'skins') {
      const r = computeSkins(ctx, cfg)
      if (!r || !r.holeResults) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Skins</span> <span class="muted" style="font-size:11px">No scores yet</span></div>`

      const won = r.holeResults.filter(s => s.winner) || []
      const ppt = r.ppt || cfg.ppt || 5

      let holeStr = ''
      if (won.length > 0) {
        holeStr = won.map(s => `H${s.hole}→${s.winnerName || '?'}($${s.pot || ppt})`).join(', ')
      } else {
        holeStr = 'No skins won yet'
      }

      // Carry: count consecutive non-won holes at end
      let carryStr = ''
      const allHoles = r.holeResults
      let carry = 0
      for (let i = allHoles.length - 1; i >= 0; i--) {
        if (!allHoles[i].winner) carry++
        else break
      }
      if (carry > 0 && allHoles.length < (visibleHoles.value.length || 18)) {
        const nextVal = (carry + 1) * ppt
        carryStr = ` · <span style="color:#d4af37;font-weight:700">${carry} skin${carry > 1 ? 's' : ''} in pot ($${nextVal} next)</span>`
      } else if (carry > 0) {
        carryStr = ` · <span style="color:rgba(212,175,55,.6)">${carry} unclaimed (carry died)</span>`
      }

      // Player standings from settlements array
      let standStr = ''
      if (r.settlements && r.settlements.length > 0) {
        const sorted = [...r.settlements].sort((a, b) => b.net - a.net)
        standStr = '<div style="margin-top:4px;font-size:11px">'
        sorted.forEach(s => {
          const color = s.net > 0 ? '#4ade80' : s.net < 0 ? '#f87171' : '#d4af37'
          standStr += `<span style="color:${color};font-weight:700">${s.name}: ${s.net > 0 ? '+$' : s.net < 0 ? '-$' : '$'}${Math.abs(s.net)} (${s.skins} skin${s.skins !== 1 ? 's' : ''})</span> · `
        })
        standStr = standStr.replace(/ · $/, '') + '</div>'
      }

      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Skins</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/skin</span><div style="font-size:11px;margin-top:3px;line-height:1.6">${holeStr}${carryStr}</div>${standStr}</div>`
    }

    // ── Match ──
    // Engine returns: { holeResults, finalUp, result, matchOver, p1, p2, settlement }
    if (t === 'match' || t === 'match1v1') {
      const r = computeMatch(ctx, cfg)
      if (!r) return _gameLine({ gameName: 'Match', winner: null, value: null, detail: 'Waiting for scores' })

      const p1n = r.p1?.name || '?'
      const p2n = r.p2?.name || '?'
      const up = r.finalUp
      const ppt = r.settlement?.ppt || cfg.ppt || 0
      const scoring = r.settlement?.scoring || cfg.scoring || 'closeout'
      const p1Net = r.settlement?.p1Net || 0
      const isTournament = !!cfg.tournament
      const points = cfg.points || 1
      const played = (r.holeResults || []).filter(h => !h.incomplete).length

      let winner = null, value = null, detail
      if (played === 0) {
        detail = `${p1n} vs ${p2n} — waiting for scores`
      } else if (r.matchOver) {
        winner = up > 0 ? p1n : p2n
        const loser = up > 0 ? p2n : p1n
        detail = `${winner} (${r.result}) vs ${loser}`
        value = {
          pts: isTournament ? points : null,
          dollars: p1Net !== 0 ? Math.abs(p1Net) : (ppt > 0 ? ppt : null),
        }
      } else if (up === 0) {
        detail = `${p1n} vs ${p2n} — AS thru ${played}`
        if (isTournament) value = { pts: points / 2, dollars: null }
      } else {
        winner = up > 0 ? p1n : p2n
        const loser = up > 0 ? p2n : p1n
        detail = `${winner} (${Math.abs(up)} UP thru ${played}) vs ${loser}`
        value = {
          pts: isTournament ? points : null,
          dollars: p1Net !== 0 ? Math.abs(p1Net) : (ppt > 0 ? ppt : null),
        }
      }

      const scoringBadge = scoring === 'nassau' ? ' Nassau' : scoring === 'skins' ? ' Skins' : ''

      // Strokes-on-holes sub-line: which holes does each player receive strokes on?
      // Only meaningful for 1v1 matches where one player has a higher course handicap.
      let strokesLine = null
      try {
        const m1 = ctx.members.find(m => m.id === cfg.player1)
        const m2 = ctx.members.find(m => m.id === cfg.player2)
        if (m1 && m2) {
          const h1 = m1.round_hcp ?? 0
          const h2 = m2.round_hcp ?? 0
          if (h1 !== h2) {
            const giver = h1 < h2 ? m1 : m2
            const receiver = h1 < h2 ? m2 : m1
            const strokeDiff = Math.abs(h1 - h2)
            // Get the course SI array so we can list which holes get strokes
            const course = ctx.course || {}
            const teeSiByHole = course?.teesData?.[ctx.tee]?.siByHole
            const siArr = teeSiByHole || course.si || []
            const holesWithStrokes = []
            for (let h = 1; h <= 18; h++) {
              const si = siArr[h - 1] ?? 18
              if (si <= strokeDiff) holesWithStrokes.push(h)
            }
            if (holesWithStrokes.length) {
              const giverName = giver.short_name || giver.guest_name?.split(/\s+/)[0] || '?'
              const recvName = receiver.short_name || receiver.guest_name?.split(/\s+/)[0] || '?'
              strokesLine = `↳ ${giverName} gives ${recvName} ${strokeDiff} stroke${strokeDiff === 1 ? '' : 's'} on hole${holesWithStrokes.length === 1 ? '' : 's'} ${holesWithStrokes.join(', ')}`
            }
          }
        }
      } catch { /* skip */ }

      const base = _gameLine({ gameName: `Match${scoringBadge}`, winner, value, detail })
      return strokesLine
        ? base.replace('</div></div>', `</div><div class="gs-strokes-line">${strokesLine}</div></div>`)
        : base
    }

    // ── Vegas ──
    if (t === 'vegas') {
      const r = computeVegas(ctx, cfg)
      if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Vegas</span></div>`

      const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
      const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
      const diff = r.runningTotal || 0
      const ppt = cfg.ppt || 1
      const amt = Math.abs(diff) * ppt

      let dollarLine = ''
      if (diff !== 0) {
        const loser = diff > 0 ? t2n : t1n
        const winner = diff > 0 ? t1n : t2n
        dollarLine = ` · <span style="color:#4ade80;font-weight:700">${loser} owe $${amt}</span>`
      }

      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Vegas</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n}${dollarLine}</span></div>`
    }

    // ── Snake ──
    // Engine returns: { holder, holderName, snakeCount, perPlayer, events, settlements, ppt }
    if (t === 'snake') {
      const r = computeSnake(ctx, cfg)
      const val = cfg.ppt || 5

      if (!r || !r.holderName) {
        return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Snake</span><span class="muted" style="font-size:10px;margin-left:4px">$${val}/snake — No 3-putts yet</span></div>`
      }

      const payout = r.snakeCount > 1 ? `$${val * r.snakeCount} total (${r.snakeCount} × $${val})` : `$${val}`
      return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Snake</span><span class="muted" style="font-size:10px;margin-left:4px">$${val}/snake · ${r.snakeCount} 🐍</span><div style="font-size:11px;margin-top:3px"><span style="color:#f87171;font-weight:700">🐍 ${r.holderName} holds it</span> · owes ${payout} to each</div></div>`
    }

    // ── Hi-Low ──
    if (t === 'hilow') {
      const r = computeHiLow(ctx, cfg)
      if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hi-Low</span><span class="muted" style="font-size:11px">—</span></div>`

      const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
      const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
      const diff = (r.team1Pts || 0) - (r.team2Pts || 0)
      const status = diff === 0 ? 'All square' : (diff > 0 ? `${t1n} leads ${r.team1Pts}-${r.team2Pts}` : `${t2n} leads ${r.team2Pts}-${r.team1Pts}`)

      let money = ''
      if (diff !== 0) {
        const loser = diff > 0 ? t2n : t1n
        const ppt = cfg.ppt || 1
        const amt = Math.abs(diff) * ppt
        money = ` · <span style="color:#4ade80;font-weight:700">${loser} owe $${amt}</span>`
      }

      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hi-Low</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n}</span><div style="font-size:11px;margin-top:2px">${status}${money}</div></div>`
    }

    // ── Hammer ──
    // Engine returns: { holeResults, team1Total, team2Total, ... }
    if (t === 'hammer') {
      const r = computeHammer(ctx, cfg)
      if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Hammer</span></div>`

      const t1n = teamInitialsStr(cfg.team1 || []) || 'T1'
      const t2n = teamInitialsStr(cfg.team2 || []) || 'T2'
      const ppt = cfg.ppt || 5
      const net = (r.team1Total || 0) - (r.team2Total || 0)
      const netStr = net !== 0 ? `<div style="margin-top:4px;font-size:12px;font-weight:700;color:#4ade80">💰 ${net < 0 ? t1n : t2n} owe ${net > 0 ? t1n : t2n} $${Math.abs(net)}</div>` : ''

      return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Hammer</span><span class="muted" style="font-size:10px;margin-left:4px">${t1n} vs ${t2n} · $${ppt}/hole</span>${netStr}</div>`
    }

    // ── Fidget ──
    // Engine returns: { hasWon, holeLog, fidgeters, winners, settlements, ppp }
    // hasWon: { memberId: boolean }, fidgeters/winners: member objects
    if (t === 'fidget') {
      const r = computeFidget(ctx, cfg)
      if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span></div>`

      const ppp = r.ppp || cfg.ppp || cfg.ppt || 10
      const members = ctx.members
      const completedHoles = r.holeLog?.filter(h => !h.incomplete).length || 0
      const totalHoles = visibleHoles.value.length || 18

      // Filter: safe (won at least one hole) vs at-risk (no wins yet)
      const safe = members.filter(m => r.hasWon[m.id])
      const atRisk = members.filter(m => !r.hasWon[m.id])

      let lines = ''
      let fStatus = ''

      if (completedHoles >= totalHoles) {
        // Game over
        if (atRisk.length > 0) {
          // Show fidgeters only
          lines = atRisk.map(m => `❌ ${memberDisplay(m)}: owes $${ppp * (members.length - 1)}`).join('<br>')
          fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#f87171">${safe.length} safe · ${atRisk.length} fidgeted</div>`
        } else {
          lines = ''
          fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#4ade80">Everyone won a hole — no fidgets!</div>`
        }
      } else {
        // In progress — only show at-risk players
        if (atRisk.length > 0) {
          lines = atRisk.map(m => `⚠️ ${memberDisplay(m)}: no win yet`).join('<br>')
        } else {
          lines = ''
        }
        fStatus = `<div style="font-size:11px;margin-top:4px;font-weight:600;color:#4ade80">${safe.length}/${members.length} safe</div>`
      }

      return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Fidget</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppp}/player${completedHoles < totalHoles ? ' · thru ' + completedHoles + '/' + totalHoles : ''}</span>${lines ? '<div style="font-size:11px;margin-top:3px">' + lines + '</div>' : ''}${fStatus}</div>`
    }

    // ── Stableford ──
    if (t === 'stableford') {
      const r = computeStableford(ctx, cfg)
      if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span></div>`

      const standings = r.settlements?.map(s => `${s.name}: ${s.pts || 0} pts`).join(' · ') || '—'
      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Stableford</span><div style="font-size:11px;margin-top:2px">${standings}</div></div>`
    }

    // ── Wolf ──
    if (t === 'wolf') {
      const r = computeWolf(ctx, cfg)
      if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Wolf</span></div>`

      const ppt = cfg.ppt || 1
      const standings = r.settlements?.map(s => `${s.name}: <span style="color:${(s.net||0) > 0 ? '#4ade80' : (s.net||0) < 0 ? '#f87171' : '#d4af37'};font-weight:700">${(s.net||0) > 0 ? '+' : ''}$${Math.abs(s.net||0)}</span>`).join(' · ') || ''

      return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Wolf</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/pt</span>${standings ? `<div style="font-size:11px;margin-top:3px">${standings}</div>` : ''}</div>`
    }

    // ── Sixes ──
    if (t === 'sixes') {
      const r = computeSixes(ctx, cfg)
      if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:11px">Need 4 players</span></div>`

      const ppt = cfg.ppt || 1
      const standings = r.settlements?.map(s => `${s.name}: <span style="color:${(s.net||0) > 0 ? '#4ade80' : (s.net||0) < 0 ? '#f87171' : '#d4af37'};font-weight:700">${(s.net||0) > 0 ? '+' : ''}$${Math.abs(s.net||0)}</span>`).join(' · ') || '—'

      return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Sixes</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/segment</span><div style="font-size:11px;margin-top:3px">${standings}</div></div>`
    }

    // ── Dots ──
    // Engine returns: { dots, settlements, ppt }
    // settlements[]: { id, name, myDots, net }
    if (t === 'dots') {
      const r = computeDots(ctx, cfg)
      if (!r) return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span></div>`

      const ppt = r.ppt || cfg.ppt || 1
      const counts = r.settlements?.map(s => `${s.name}: ${s.myDots || 0}`).join(' · ') || '—'
      const dollarLine = r.settlements?.filter(s => (s.net||0) !== 0).map(s => `${s.name}${(s.net||0) > 0 ? '<span style="color:#4ade80"> +$' + s.net + '</span>' : '<span style="color:#f87171"> -$' + Math.abs(s.net) + '</span>'}`).join(' · ') || ''

      return `<div style="margin-bottom:8px"><span style="font-weight:700">${icon} Dots</span><span class="muted" style="font-size:10px;margin-left:4px">$${ppt}/dot</span><div style="font-size:11px;margin-top:3px;opacity:.8">${counts}</div>${dollarLine ? '<div style="font-size:11px;margin-top:2px">' + dollarLine + '</div>' : ''}</div>`
    }

    // ── Best Ball — Match Play (2v2, holes won) ──
    if (t === 'best_ball' || t === 'bestball') {
      const r = computeBestBall(ctx, cfg)
      if (!r) return _gameLine({ gameName: 'Best Ball', winner: null, value: null, detail: 'Waiting for scores' })

      const t1n = r.t1Name || 'Team 1'
      const t2n = r.t2Name || 'Team 2'
      const finalUp = r.finalUp || 0
      const played = (r.holeResults || []).filter(h => !h.incomplete).length
      const remaining = (r.holeResults || []).filter(h => h.incomplete).length
      const matchOver = Math.abs(finalUp) > remaining && played > 0
      const ppt = r.settlement?.ppt || cfg.ppt || 0
      const isTournament = !!cfg.tournament
      const points = cfg.points || 2

      // Value on title line
      let winner = null, value = null
      let detail = `${t1n} vs ${t2n}`
      if (played === 0) {
        detail = `${t1n} vs ${t2n} — waiting for scores`
      } else if (matchOver) {
        winner = finalUp > 0 ? t1n : t2n
        const loser = finalUp > 0 ? t2n : t1n
        const resultStr = `${Math.abs(finalUp)}&${remaining}`
        detail = `${winner} (${resultStr}) vs ${loser}`
        value = {
          pts: isTournament ? points : null,
          dollars: ppt > 0 ? ppt : null,
        }
      } else if (finalUp === 0) {
        detail = `${t1n} vs ${t2n} — AS thru ${played}`
        // Halved value preview
        if (isTournament) value = { pts: points / 2, dollars: null }
      } else {
        winner = finalUp > 0 ? t1n : t2n
        const loser = finalUp > 0 ? t2n : t1n
        const upStr = Math.abs(finalUp)
        detail = `${winner} (${upStr} UP thru ${played}) vs ${loser}`
        value = {
          pts: isTournament ? points : null,
          dollars: ppt > 0 ? ppt : null,
        }
      }

      return _gameLine({ gameName: 'Best Ball', winner, value, detail })
    }

    // ── BBN — Best Ball stroke-play tracker ──
    if (t === 'bbn') {
      const r = computeBestBallNet(ctx, cfg)
      if (!r) return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${cfg.label || 'BB Net'}</span><span class="muted" style="font-size:11px">—</span></div>`
      const totalStr = r.totalScore ? `${r.totalScore} (${r.overallToPar === 0 ? 'E' : (r.overallToPar > 0 ? '+' + r.overallToPar : r.overallToPar)})` : '—'
      return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${cfg.label || 'BB Net'}</span><span class="muted" style="font-size:10px;margin-left:4px">${r.ballsToCount || 1}BB ${r.scoring === 'gross' ? 'Gross' : 'Net'}</span><br><span class="muted" style="font-size:11px">Total: ${totalStr}</span></div>`
    }

    // Default fallback
    return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${gameLabel(game.type, cfg)}</span></div>`
  } catch(e) {
    return `<div style="margin-bottom:6px"><span style="font-weight:700">${icon} ${gameLabel(game.type, cfg)}</span><span class="muted" style="font-size:10px;margin-left:4px">Error loading</span></div>`
  }
}

// ── In-round config editing ─────────────────────────────────────
async function updateSelectedConfig(field, value) {
  if (!selectedGame.value) return
  selectedGame.value.config[field] = value
  await roundsStore.updateGameConfig(selectedGame.value.id, { ...selectedGame.value.config })
}

// ── Inline score entry (replaces modal) ─────────────────────────
function inlineSetPar(member) {
  if (!isCaptain.value) return flashViewerToast()
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  const newScore = existing === null ? par : existing
  roundsStore.setScore(member.id, hole, newScore)
}

function inlineInc(member) {
  if (!isCaptain.value) return flashViewerToast()
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  if (existing === null) {
    roundsStore.setScore(member.id, hole, par + 1)
  } else if (existing < 13) {
    roundsStore.setScore(member.id, hole, existing + 1)
  }
}

function inlineDec(member) {
  if (!isCaptain.value) return flashViewerToast()
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  if (existing === null) {
    roundsStore.setScore(member.id, hole, Math.max(1, par - 1))
  } else if (existing > 1) {
    roundsStore.setScore(member.id, hole, existing - 1)
  }
}

// saveScore removed — inline entry auto-saves

// ── Score Simulator ─────────────────────────────────────────────
function simulateFill() {
  const members = roundsStore.activeMembers
  const holes = visibleHoles.value
  // Weighted random score relative to par: heavy on bogey/par, some birdies/doubles
  // Distribution: eagle(1%), birdie(12%), par(35%), bogey(30%), double(15%), triple+(7%)
  const weights = [
    { offset: -2, w: 1 },   // eagle
    { offset: -1, w: 12 },  // birdie
    { offset:  0, w: 35 },  // par
    { offset:  1, w: 30 },  // bogey
    { offset:  2, w: 15 },  // double
    { offset:  3, w: 7 },   // triple
  ]
  const totalWeight = weights.reduce((s, x) => s + x.w, 0)

  function randomOffset() {
    let r = Math.random() * totalWeight
    for (const { offset, w } of weights) {
      r -= w
      if (r <= 0) return offset
    }
    return 1
  }

  for (const m of members) {
    for (const h of holes) {
      const par = parForHole(h)
      const score = Math.max(1, par + randomOffset())
      roundsStore.setScore(m.id, h, score)
    }
  }
}

function resetScores() {
  if (!confirm('Reset all scores? This cannot be undone.')) return
  // Clear all scores from local reactive state
  for (const memberId of Object.keys(roundsStore.activeScores)) {
    roundsStore.activeScores[memberId] = {}
  }
}


// ── Snake 3-putt ────────────────────────────────────────────────
const snakeGame = computed(() => roundsStore.activeGames.find(g => g.type?.toLowerCase() === 'snake') || null)
const snakeHolder = computed(() => { const e = snakeGame.value?.config?.events || []; return e.length ? e[e.length - 1].pid : null })
const snakeHolderName = computed(() => { if (!snakeHolder.value) return null; const m = roundsStore.activeMembers.find(m => m.id === snakeHolder.value); return memberDisplay(m) })
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

async function updateMemberHcp(memberId, rawValue) {
  const newIndex = rawValue === '' || rawValue === null ? null : parseFloat(rawValue)
  if (isNaN(newIndex) && rawValue !== '' && rawValue !== null) return
  // Optimistic update in store
  const m = roundsStore.activeMembers.find(x => x.id === memberId)
  if (m) m.ghin_index = newIndex
  // Persist to Supabase
  try {
    const { supabase } = await import('../supabase')
    await supabase.from('round_members').update({ ghin_index: newIndex }).eq('id', memberId)
  } catch (e) {
    console.warn('[ScoringView] updateMemberHcp failed:', e)
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
  return memberDisplay(m)
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
  return memberDisplay(m)
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
  height: calc(100vh - 56px - env(safe-area-inset-bottom));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--gw-bg, #0c150e);
  min-height: 56px;
}
.opp-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 16px 8px;
  background: rgba(248,113,113,.05);
  border-bottom: 1px solid rgba(248,113,113,.12);
}
.opp-strip-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: #f87171;
  padding: 3px 7px;
  border-radius: 5px;
  background: rgba(248,113,113,.12);
}
.opp-strip-player {
  font-size: 12px;
  font-weight: 600;
  color: rgba(252,165,165,.85);
  padding: 3px 9px;
  border-radius: 12px;
  background: rgba(248,113,113,.08);
  border: 1px solid rgba(248,113,113,.18);
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
.meta-viewer {
  color: #93c5fd;
  background: rgba(96,165,250,.12);
  border: 1px solid rgba(96,165,250,.3);
}

/* Viewer-mode toast (non-captain taps a score cell) */
.viewer-toast {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  max-width: calc(100vw - 32px);
  padding: 10px 16px;
  border-radius: 14px;
  background: rgba(12,15,13,.96);
  border: 1px solid rgba(96,165,250,.4);
  color: #f0ede0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.fade-enter-active, .fade-leave-active { transition: opacity .2s, transform .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
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

/* HCP Editor Modal */
.hcp-editor-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.hcp-editor-modal {
  background: #1a2218; border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
  padding: 20px; width: min(340px, 90vw); max-height: 70vh; overflow-y: auto;
}
.hcp-editor-title { font-size: 16px; font-weight: 700; color: #d4af37; margin-bottom: 4px; }
.hcp-editor-note { font-size: 12px; color: rgba(255,255,255,.5); margin-bottom: 14px; }
.hcp-editor-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06);
}
.hcp-editor-name { font-size: 14px; color: rgba(255,255,255,.85); }
.hcp-editor-input {
  width: 70px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15);
  border-radius: 8px; color: #fff; font-size: 14px; text-align: center; padding: 6px 8px;
}
.hcp-editor-done {
  width: 100%; margin-top: 14px; padding: 10px; background: #d4af37; color: #0c0f0d;
  font-weight: 700; border: none; border-radius: 10px; font-size: 14px; cursor: pointer;
}
.opp-editor-modal { max-height: 80vh; }
.opp-edit-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.opp-edit-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 20px;
  background: rgba(248,113,113,.15); border: 1px solid rgba(248,113,113,.3);
  font-size: 12px; font-weight: 700; color: #fca5a5;
}
.opp-edit-chip button { background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
.opp-edit-empty { font-size: 12px; color: rgba(255,255,255,.3); margin-bottom: 6px; }
.opp-editor-search { width: 100%; box-sizing: border-box; }
.opp-editor-roster { max-height: 200px; overflow-y: auto; border: 1px solid rgba(255,255,255,.07); border-radius: 8px; }
.opp-editor-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.05);
  cursor: pointer;
}
.opp-editor-row--on { background: rgba(248,113,113,.1); }
.opp-editor-row--mine { opacity: 0.3; pointer-events: none; }
.opp-editor-name { flex: 1; font-size: 13px; color: rgba(255,255,255,.85); }
.opp-editor-hcp { font-size: 11px; color: rgba(255,255,255,.4); }
.opp-editor-check { font-size: 13px; color: #f87171; width: 16px; text-align: center; }
.opp-editor-actions { margin-top: 10px; }

.round-menu-note {
  font-size: 11px;
  color: rgba(147,197,253,.75);
  padding: 8px 12px;
  line-height: 1.4;
  font-weight: 500;
  cursor: default;
  background: rgba(96,165,250,.08);
  border-radius: 8px;
  margin: 4px 0;
}

/* ── Retro-score bulk-entry panel ─────────────────────────── */
.retro-panel {
  background: var(--gw-neutral-900);
  border: 1px solid var(--gw-gold);
  border-radius: 16px;
  max-width: min(96vw, 720px);
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
}
.retro-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.retro-title { font-family: var(--gw-font-display); font-size: 18px; color: var(--gw-text); margin: 0; }
.retro-sub { font-size: 11px; color: var(--gw-text-muted); margin-top: 3px; line-height: 1.4; }
.retro-scroll {
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px;
  background: #faf7f0;
}
.retro-grid {
  border-collapse: separate;
  border-spacing: 0;
  font-family: var(--gw-font-mono, monospace);
  color: #1a1f1b;
  width: 100%;
}
.retro-th {
  position: sticky; top: 0;
  background: #f0ebdd;
  font-size: 11px;
  font-weight: 800;
  padding: 6px 4px;
  border-bottom: 1px solid rgba(0,0,0,.12);
  text-align: center;
  white-space: nowrap;
}
.retro-th--player {
  position: sticky; left: 0;
  z-index: 3;
  background: #f0ebdd;
  text-align: left;
  padding-left: 10px;
  min-width: 70px;
}
.retro-par { color: #9a7a1e; font-weight: 700; background: #fbf6e8; }
.retro-par-row .retro-th--player { background: #fbf6e8; }
.retro-td {
  padding: 2px; text-align: center;
  border-bottom: 1px solid rgba(0,0,0,.05);
}
.retro-td--player {
  position: sticky; left: 0; z-index: 2;
  background: #f0ebdd;
  text-align: left;
  padding: 6px 10px;
  font-weight: 800;
  font-size: 13px;
  color: #1a1f1b;
  border-right: 1px solid rgba(0,0,0,.1);
}
.retro-td.retro-empty { background: rgba(239,68,68,.1); }
.retro-input {
  width: 36px;
  padding: 6px 2px;
  text-align: center;
  background: transparent;
  border: 1px solid rgba(0,0,0,.1);
  border-radius: 4px;
  font-family: var(--gw-font-mono, monospace);
  font-size: 14px;
  font-weight: 700;
  color: #1a1f1b;
  outline: none;
}
.retro-input:focus {
  border-color: var(--gw-gold);
  background: white;
}
.retro-empty .retro-input { border-color: rgba(239,68,68,.3); }
.retro-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,.06);
  background: var(--gw-neutral-900);
}
.retro-count {
  flex: 1;
  font-size: 12px;
  color: var(--gw-text-muted);
  font-weight: 600;
}
.retro-error {
  padding: 10px 16px 14px;
  color: #f87171;
  font-size: 12px;
  background: rgba(239,68,68,.08);
}

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
  position: sticky;
  top: 56px;
  z-index: 9;
  background: var(--gw-bg, #0c150e);
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

/* Display toggles row (notations / hcp — also reused by .scorecard-toolbar) */
.display-toggles {
  display: flex;
  gap: 8px;
  padding: 4px 12px 6px;
  flex-shrink: 0;
}
.dt-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  color: rgba(240,237,224,.6);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all .15s;
}
.dt-chip:active { transform: scale(.96); }
.dt-chip--on {
  background: rgba(212,175,55,.15);
  border-color: rgba(212,175,55,.45);
  color: var(--gw-gold, #d4af37);
}
.dt-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255,255,255,.2);
  transition: background .15s, box-shadow .15s;
}
.dt-dot--on {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34,197,94,.2);
}

/* Round-menu backdrop for click-outside */
.round-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: transparent;
}
.round-menu-dropdown { z-index: 41; }

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
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: rgba(240,237,224,.55);
  margin-bottom: 10px;
}

/* ── New compact game-summary line (matches user spec) ──
   Title row: icon + game — ⭐ winner +pts +$
   Detail row: winner (result) vs loser
*/
.gs-line {
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,.06);
}
.gs-line:first-of-type { border-top: none; padding-top: 2px; }
.gs-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 1.3;
}
.gs-game-title {
  font-weight: 800;
  color: var(--gw-text, #f0ede0);
}
.gs-dash {
  color: rgba(240,237,224,.35);
  font-weight: 400;
}
.gs-winner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  color: #22c55e;
}
.gs-star {
  font-size: 13px;
  line-height: 1;
}
.gs-winner-name {
  color: #22c55e;
}
.gs-value {
  color: #22c55e;
  font-weight: 800;
  font-family: var(--gw-font-mono, monospace);
  font-size: 13px;
}
.gs-value-muted {
  color: rgba(240,237,224,.55);
}
.gs-detail-row {
  font-size: 13px;
  line-height: 1.4;
  color: rgba(240,237,224,.72);
  margin-top: 3px;
  padding-left: 2px;
}
.gs-strokes-line {
  font-size: 11px;
  line-height: 1.4;
  color: rgba(212,175,55,.75);
  margin-top: 2px;
  padding-left: 14px;
  font-weight: 600;
  letter-spacing: .01em;
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

/* Rich game summaries */
.live-game-summary {
  padding: 5px 0;
  border-top: 1px solid rgba(255,255,255,.04);
}
.live-game-summary:first-of-type { border-top: none; }

:deep(.gw-winning) { color: #4ade80; font-weight: 700; }
:deep(.gw-losing) { color: #f87171; font-weight: 700; }
.muted { color: rgba(240,237,224,.5); font-size: 0.95em; }

/* ── Settle Up box ───────────────────────────────────────────── */
.settle-box {
  background: rgba(212,175,55,.05);
  border: 1px solid rgba(212,175,55,.2);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 8px 12px;
}
.settle-box-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .8px; color: rgba(240,237,224,.45); margin-bottom: 8px;
}
.settle-totals {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;
}
.settle-player {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 10px; border-radius: 8px; min-width: 54px;
  background: rgba(255,255,255,.05);
}
.settle-up { border: 1px solid rgba(74,222,128,.3); }
.settle-down { border: 1px solid rgba(248,113,113,.3); }
.settle-even { border: 1px solid rgba(255,255,255,.08); }
.settle-name { font-size: 11px; color: rgba(240,237,224,.55); font-weight: 600; }
.settle-amount { font-size: 14px; font-weight: 800; margin-top: 2px; }
.settle-up .settle-amount { color: #4ade80; }
.settle-down .settle-amount { color: #f87171; }
.settle-even .settle-amount { color: rgba(240,237,224,.4); }
.settle-ledger {
  display: flex; flex-direction: column; gap: 4px;
  border-top: 1px solid rgba(255,255,255,.07); padding-top: 8px;
}
.settle-entry {
  display: flex; align-items: center; gap: 6px; font-size: 12px;
  color: rgba(240,237,224,.75);
}
.settle-from { font-weight: 700; color: #f87171; }
.settle-arrow { color: rgba(240,237,224,.3); }
.settle-to { font-weight: 700; color: #4ade80; }
.settle-pay { margin-left: auto; font-weight: 800; color: var(--gw-gold, #d4af37); }
.settle-even-msg { font-size: 12px; color: rgba(240,237,224,.4); text-align: center; padding: 4px 0; }

/* ── Scorecard Grid ──────────────────────────────────────────── */
/* Outer wrapper holds the border/radius so the scroll div stays clean.
   iOS Safari breaks position:sticky when overflow-x:auto and border-radius
   are on the SAME element. Separating them fixes sticky player column. */
.scorecard-outer {
  margin: 8px 12px;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 12px;
  overflow: hidden;
  background: #faf7f0;
  box-shadow: 0 4px 14px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.2);
}

.scorecard-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Sticky cells need solid backgrounds to cover scrolled content */
.col-sticky {
  position: sticky;
  left: 0;
  z-index: 3;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════════════
   LIGHT-THEMED SCORECARD GRID
   White paper-like surface, dark text, high contrast for sun.
   ═══════════════════════════════════════════════════════════ */
.scorecard-grid {
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 12px;
  min-width: 100%;
  font-family: var(--gw-font-mono, 'DM Mono', monospace);
  background: #faf7f0; /* warm paper white */
  color: #1a1f1b;
}

.col-player-header {
  padding: 7px 10px;
  text-align: left;
  background: #f0ebdd;
  color: #4a5249;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  position: sticky;
  left: 0;
  z-index: 3;
  border-right: 1px solid rgba(0,0,0,.1);
}

.col-hole-num {
  padding: 6px 4px;
  text-align: center;
  cursor: pointer;
  min-width: 26px;
  color: #1a1f1b;
  font-size: 12px;
  font-weight: 800;
  background: #f0ebdd;
  border-bottom: 1px solid rgba(0,0,0,.08);
}
.col-hole-num:active { background: rgba(212,175,55,.15); }

.col-subtotal {
  padding: 5px 6px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  background: rgba(212,175,55,.14);
  border-left: 1px solid rgba(212,175,55,.35);
  color: #1a1f1b;
}
.col-total {
  padding: 5px 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 900;
  color: #1a1f1b;
  background: #f5efde;
}
.col-gross { }
.col-net { color: #4a5249; }

.par-sub { color: #6b7368; font-weight: 700; }

/* Header rows */
.row-header { background: #f0ebdd; }
.row-par {
  background: #faf7f0;
  border-bottom: 1px solid rgba(0,0,0,.08);
}
.col-par-label {
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 700;
  color: #4a5249;
  background: #f0ebdd;
  position: sticky;
  left: 0;
  z-index: 3;
  border-right: 1px solid rgba(0,0,0,.1);
}
.col-par-val {
  padding: 4px 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #1a1f1b;
}

.row-si { background: #f5efde; border-bottom: 1px solid rgba(0,0,0,.06); }
.col-si-val {
  padding: 4px 4px;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #9a7a1e;  /* warm gold — readable on paper */
}
.row-yards { background: #fbf6e8; border-bottom: 1px solid rgba(0,0,0,.05); }
.col-yards-val {
  padding: 3px 4px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #6b7368;
}

/* Player rows */
.row-player {
  border-top: 1px solid rgba(0,0,0,.08);
}

.col-player-name {
  padding: 6px 10px;
  background: #f0ebdd;
  position: sticky;
  left: 0;
  z-index: 3;
  padding-left: 14px;
  border-right: 1px solid rgba(0,0,0,.1);
}
.sticky-t1 { background: #e8f0fa; border-right: 3px solid #3b82f6; }
.sticky-t2 { background: #faebeb; border-right: 3px solid #ef4444; }
.sticky-default { background: #f0ebdd; border-right: 1px solid rgba(0,0,0,.1); }

.player-nm { font-size: 13px; font-weight: 800; color: #1a1f1b; }
.player-hcp { font-size: 10px; color: #4a5249; margin-left: 4px; font-weight: 600; }
.hcp-lowman { color: #1d4ed8; margin-left: 2px; font-weight: 800; }
.t1 { color: #1d4ed8; }
.t2 { color: #b91c1c; }

.col-score-cell {
  padding: 4px 3px;
  text-align: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  position: relative;
  min-width: 28px;
  color: #1a1f1b;
  background: transparent;
  border-right: 1px solid rgba(0,0,0,.04);
}
.col-score-cell:active { background: rgba(0,0,0,.05); }
.cell-winner { background: rgba(34,197,94,.18); }
.cell-defidget { background: rgba(251,191,36,.28); box-shadow: inset 0 0 0 1px rgba(217,119,6,.5); }

/* Team-colored player row backgrounds (subtle) */
.team1-row .col-score-cell { background: rgba(59,130,246,.04); }
.team2-row .col-score-cell { background: rgba(239,68,68,.04); }

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
  background: rgba(0,0,0,.15);
  height: 2px; padding: 0; border: none;
}

/* ── Game notation rows (tfoot) — light theme ─────────────── */
.row-game-notation {
  border-top: 1px solid rgba(0,0,0,.1);
  background: #fbf6e8;
}
.col-notation-label {
  padding: 4px 8px;
  background: #f0ebdd;
  white-space: nowrap;
  position: sticky; left: 0; z-index: 3;
  border-right: 1px solid rgba(0,0,0,.08);
}
.notation-icon { font-size: 11px; margin-right: 3px; }
.notation-name {
  font-size: 11px; font-weight: 800;
  color: #4a5249;
  text-transform: uppercase; letter-spacing: .4px;
}

.col-notation-cell {
  padding: 4px 3px; text-align: center;
  font-size: 12px; font-weight: 800; min-width: 26px;
  color: #1a1f1b;
}
.col-notation-sub { font-size: 10px; font-weight: 700; color: #4a5249; }
.col-notation-total { font-size: 11px; font-weight: 800; color: #1a1f1b; }

/* Notation cell classes — darker saturated hues for paper bg */
.nota-t1 { color: #1d4ed8; }
.nota-t2 { color: #b91c1c; }
.nota-halved { color: #6b7368; }

/* Small red 'P' badge on hole-number cells where a Nassau press opened */
.press-badge {
  display: inline-block;
  min-width: 12px;
  padding: 0 3px;
  margin-left: 2px;
  border-radius: 4px;
  background: #dc2626;
  color: #fff;
  font-size: 9px;
  font-weight: 900;
  line-height: 12px;
  vertical-align: top;
  letter-spacing: 0;
  box-shadow: 0 0 0 1px rgba(255,255,255,.15);
}

/* Press-opened banner on the hole-by-hole view */
.press-banner {
  display: flex; align-items: center; gap: 10px;
  margin: 8px 12px 4px;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(220,38,38,.16), rgba(220,38,38,.04));
  border: 1px solid rgba(220,38,38,.4);
  animation: press-pulse 2.4s ease-in-out infinite;
}
@keyframes press-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,.25); }
  50%      { box-shadow: 0 0 0 4px rgba(220,38,38,.06); }
}
.press-banner-icon { font-size: 22px; flex-shrink: 0; }
.press-banner-text {
  font-size: 13px; line-height: 1.35;
  color: var(--gw-text, #f0ede0);
}
.press-banner-text strong { color: #fca5a5; font-weight: 800; }

/* Diagonal "1⁄2" fraction for halved holes — bigger and more legible
   than the default Unicode ½ glyph, with the numerator and denominator
   properly offset by a thin slash. */
/* "1/2" fraction — diagonal slash drawn with CSS so we don't rely on the
   ⁄ glyph (which renders as a hyphen in Safari's default paper font).
   Layout: relative container, numerator positioned top-left, a 1px line
   rotated -60deg as the slash, denominator bottom-right. */
.nota-frac {
  position: relative;
  display: inline-block;
  width: 18px;
  height: 20px;
  font-family: var(--gw-font-mono, 'DM Mono', monospace);
  font-weight: 800;
  color: #6b7368;
  line-height: 1;
  vertical-align: middle;
}
.nota-frac .nf-num {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 11px;
}
.nota-frac .nf-den {
  position: absolute;
  bottom: 0;
  right: 0;
  font-size: 11px;
}
.nota-frac::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22px;
  height: 1.5px;
  background: currentColor;
  transform: translate(-50%, -50%) rotate(-60deg);
  opacity: .7;
}
.nota-dormie { color: #b45309; font-weight: 900; }
.nota-skin-won { color: #6d28d9; }
.nota-carry { color: #78716c; font-style: italic; }
.nota-dots { color: #15803d; }
.nota-dot-who { color: #4a5249; font-size: 9px; margin-right: 1px; font-weight: 700; }
.nota-safe { color: #15803d; }
.nota-under { color: #1d4ed8; }
.nota-over { color: #b91c1c; }
.nota-snake { }

/* Stroke dots — bold, visible indicator of handicap strokes on a hole */
.stroke-dots {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 14px;
  font-weight: 900;
  color: #b45309; /* warm amber on paper */
  line-height: .7;
  letter-spacing: -1px;
  text-shadow: 0 0 2px #faf7f0, 0 0 2px #faf7f0;
  pointer-events: none;
}

/* ── Score notation classes ───────────────────────────────────── */
/* Albatross: triple concentric circle rings (gold) */
.sn-alb {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  border: 1.5px solid #f59e0b; color: #f59e0b; font-weight: 900;
  box-shadow:
    0 0 0 2px rgba(12, 15, 13, 0.97),
    0 0 0 4px #f59e0b,
    0 0 0 6px rgba(12, 15, 13, 0.97),
    0 0 0 8px #f59e0b;
}
/* Eagle: double concentric circle rings (green) */
.sn-eagle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  border: 1.5px solid #4ade80; color: #4ade80; font-weight: 900;
  box-shadow:
    0 0 0 2px rgba(12, 15, 13, 0.97),
    0 0 0 4px #4ade80;
}
/* Birdie: single circle (blue) */
.sn-birdie {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  border: 1.5px solid #60a5fa; color: #60a5fa; font-weight: 900;
}
.sn-par { color: var(--gw-text, #f0ede0); font-weight: 700; }
/* Bogey: single rounded square (gray border, red text).
   Matches size of the birdie circle (24px) so visual scale is consistent. */
.sn-bogey {
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
  width: 24px; height: 24px; border-radius: 4px;
  border: 1.5px solid #94a3b8; color: #f87171; font-weight: 900;
  line-height: 1;
  aspect-ratio: 1 / 1;
}
/* Double bogey: double rounded square rings (red).
   Slightly smaller inner so the outer ring fits the same visual footprint. */
.sn-dbl {
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
  width: 22px; height: 22px; border-radius: 4px;
  border: 1.5px solid #f87171; color: #f87171; font-weight: 900;
  line-height: 1;
  aspect-ratio: 1 / 1;
  box-shadow:
    0 0 0 2px rgba(12, 15, 13, 0.97),
    0 0 0 4px #f87171;
}
/* Triple+: no box, just red text */
.sn-trip {
  color: #dc2626; font-weight: 900;
}
.sn-empty { color: rgba(240,237,224,.2); }

/* ── Light-theme notation overrides for the scorecard grid ── */
.scorecard-grid .sn-alb {
  border-color: #b45309; color: #b45309;
  box-shadow:
    0 0 0 2px #faf7f0,
    0 0 0 4px #b45309,
    0 0 0 6px #faf7f0,
    0 0 0 8px #b45309;
}
.scorecard-grid .sn-eagle {
  border-color: #15803d; color: #15803d;
  box-shadow:
    0 0 0 2px #faf7f0,
    0 0 0 4px #15803d;
}
.scorecard-grid .sn-birdie {
  border-color: #1d4ed8; color: #1d4ed8;
}
.scorecard-grid .sn-par { color: #1a1f1b; }
.scorecard-grid .sn-bogey {
  border-color: #64748b; color: #b91c1c;
}
.scorecard-grid .sn-dbl {
  border-color: #b91c1c; color: #b91c1c;
  box-shadow:
    0 0 0 2px #faf7f0,
    0 0 0 4px #b91c1c;
}
.scorecard-grid .sn-trip { color: #991b1b; }
.scorecard-grid .sn-empty, .scorecard-grid .score-empty-dot { color: rgba(0,0,0,.2); }
.scorecard-grid .stroke-dots { color: #b45309 !important; }

/* Hole view: keep the notation shapes (circles/squares) so the gross score
   carries the same visual signal as the scorecard grid. Size them up to
   match the bigger hole-view font. */
.score-display.nota-mode .sn-alb,
.score-display.nota-mode .sn-eagle,
.score-display.nota-mode .sn-birdie {
  width: 44px; height: 44px;
}
.score-display.nota-mode .sn-bogey,
.score-display.nota-mode .sn-dbl {
  width: 40px; height: 40px;
}
/* Net score notation color classes (reuse sn- for coloring) */
.phc-net-value.sn-eagle, .phc-net-value.sn-alb { color: #4ade80; }
.phc-net-value.sn-birdie { color: #60a5fa; }
.phc-net-value.sn-par { color: var(--gw-text, #f0ede0); }
.phc-net-value.sn-bogey { color: #f87171; }
.phc-net-value.sn-dbl { color: #f87171; }
.phc-net-value.sn-trip { color: #dc2626; }

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
  position: relative;
}
.hole-big-number {
  font-family: var(--gw-font-display, Georgia, serif);
  font-size: 28px;
  font-weight: 400;
  line-height: 1;
  color: var(--gw-text, #f0ede0);
}
.hole-banner-right .hole-big-number { text-align: right; }
.hole-course-meta {
  font-size: 11px;
  color: rgba(240,237,224,.45);
  margin-top: 4px;
}
.hole-notation-toggle {
  position: absolute;
  top: 10px; right: 10px;
  background: none; border: none; cursor: pointer;
  font-size: 18px; color: rgba(240,237,224,.4);
  -webkit-tap-highlight-color: transparent;
  transition: color .15s;
  padding: 4px;
}
.hole-notation-toggle.active { color: var(--gw-gold); }

.hole-players-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Player hole card — grid keeps +/- aligned across all players */
.player-hole-card {
  display: grid;
  grid-template-columns: 1fr auto 56px;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  transition: border-color .12s, background .12s;
  -webkit-tap-highlight-color: transparent;
}
.card-t1 { background: rgba(96,165,250,.10); border-color: rgba(96,165,250,.35); border-left: 3px solid #60a5fa; }
.card-t2 { background: rgba(248,113,113,.10); border-color: rgba(248,113,113,.35); border-left: 3px solid #f87171; }
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
  min-width: 64px; height: 48px; border-radius: 10px;
  padding: 0 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 900;
  background: transparent; border: none;
  color: #f0ede0; cursor: pointer; font-family: var(--gw-font-mono, monospace);
  -webkit-tap-highlight-color: transparent;
}
.score-display.has-score { background: transparent; border: none; }
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
  font-size: 14px; color: rgba(212,175,55,1); margin-left: 4px;
  vertical-align: middle; letter-spacing: 1px; font-weight: 900;
}


/* Redesigned player card layout — grid columns keep +/- aligned */
.phc-identity {
  display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden;
}
.phc-name-col { display: flex; flex-direction: column; min-width: 0; }
.phc-hcp-row { display: flex; align-items: center; gap: 4px; margin-top: 2px; flex-wrap: wrap; }
.phc-score-entry {
  display: flex; align-items: center; gap: 10px; justify-content: center;
}
.phc-net-col {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.phc-net-label { font-size: 9px; font-weight: 700; color: rgba(240,237,224,.35); text-transform: uppercase; letter-spacing: .5px; }
.phc-net-value { font-size: 22px; font-weight: 900; color: var(--gw-text, #f0ede0); font-family: var(--gw-font-mono, monospace); line-height: 1.1; }

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

/* Collapsible headers */
.collapsible-header {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.collapsible-header:active {
  opacity: 0.7;
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

/* Rich game summary in hole view */
.hole-gs-summary {
  padding: 5px 0;
  border-top: 1px solid rgba(255,255,255,.05);
}
.hole-gs-summary:first-of-type { border-top: none; }

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

/* ── Unified scorecard toolbar: chips + action icons on one row ── */
.scorecard-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.scorecard-toolbar .sct-spacer {
  flex: 1;
}
.scorecard-toolbar .dt-chip {
  padding: 5px 10px;
  font-size: 11px;
}
.scorecard-toolbar .dt-chip .dt-dot {
  width: 7px;
  height: 7px;
}
.sim-btn {
  font-size: 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  cursor: pointer; padding: 4px 9px; border-radius: 12px;
  -webkit-tap-highlight-color: transparent; transition: background .15s;
  color: rgba(240,237,224,.7);
  flex-shrink: 0;
}
.sim-btn:active { background: rgba(212,175,55,.15); }
.sim-btn-reset { opacity: .7; font-size: 16px; }
/* Legacy classes kept for anything still referencing them */
.notation-toggle-btn, .hcp-toggle-btn, .legend-toggle-btn {
  font-size: 11px; color: rgba(240,237,224,.5); background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1); cursor: pointer; padding: 4px 9px;
  border-radius: 12px; font-family: inherit; transition: color .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.notation-toggle-btn:active, .hcp-toggle-btn:active, .legend-toggle-btn:active { color: var(--gw-gold); }
.hcp-toggle-btn.active { color: #60a5fa; border-color: rgba(96,165,250,.4); background: rgba(96,165,250,.08); }

/* Scorecard legend */
.scorecard-legend {
  margin: 6px 12px 0; padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
}
.legend-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: rgba(240,237,224,.4); margin-bottom: 8px;
}
.legend-grid {
  display: grid; grid-template-columns: 36px 1fr; gap: 5px 8px; align-items: center;
}
.legend-swatch {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; min-width: 28px; text-align: center;
}
.legend-label { font-size: 11px; color: rgba(240,237,224,.6); }
.legend-game-icon { font-size: 14px; text-align: center; }

/* Hole-by-hole HCP display */
.phc-hcp-course {
  font-size: 16px; font-weight: 900; color: var(--gw-text, #f0ede0);
}
.phc-hcp-lowman {
  font-size: 12px; font-weight: 600; color: rgba(96,165,250,.8); margin-left: 3px;
}

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

/* ═══════════════════════════════════════════════════════════════════
   LANDSCAPE GLANCE MODE — scorecard + live games fill the viewport
   Everything else is hidden. Portrait-only features like hole entry,
   tab strip, toggles, bottom nav, FABs are removed so the grid can be
   seen clearly at arm's length.
   ═══════════════════════════════════════════════════════════════════ */
.scoring-view.is-landscape {
  padding: 0 !important;
  margin: 0 !important;
}

/* Hide all chrome in landscape */
.scoring-view.is-landscape .scoring-header,
.scoring-view.is-landscape .tab-strip,
.scoring-view.is-landscape .display-toggles,
.scoring-view.is-landscape .finish-banner,
.scoring-view.is-landscape .hole-view,
.scoring-view.is-landscape .round-menu-dropdown,
.scoring-view.is-landscape .round-menu-backdrop,
.scoring-view.is-landscape .delete-overlay,
.scoring-view.is-landscape .game-editor-panel {
  display: none !important;
}

/* Container uses the full screen */
.scoring-view.is-landscape .round-container {
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  background: #0c150e;
}

/* Card view fills viewport */
.scoring-view.is-landscape .card-view {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Scorecard fills the width, no outer margin */
.scoring-view.is-landscape .scorecard-outer {
  margin: 0;
  border-radius: 8px;
  flex-shrink: 0;
  max-height: calc(100vh - 110px); /* leave room for the compact live games */
  display: flex;
  flex-direction: column;
}
.scoring-view.is-landscape .scorecard-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
}

/* Scorecard grid tuned for landscape — bigger numbers, paper-tight columns */
.scoring-view.is-landscape .scorecard-grid {
  font-size: 13px;
  width: 100%;
}
.scoring-view.is-landscape .col-hole-num {
  font-size: 13px;
  padding: 6px 3px;
  min-width: 30px;
}
.scoring-view.is-landscape .col-par-val,
.scoring-view.is-landscape .col-si-val,
.scoring-view.is-landscape .col-yards-val {
  font-size: 12px;
  padding: 4px 3px;
}
.scoring-view.is-landscape .col-score-cell {
  font-size: 15px;
  padding: 5px 3px;
  min-width: 30px;
}
.scoring-view.is-landscape .player-nm {
  font-size: 14px;
}
.scoring-view.is-landscape .player-hcp { font-size: 11px; }
.scoring-view.is-landscape .col-player-header,
.scoring-view.is-landscape .col-player-name,
.scoring-view.is-landscape .col-par-label {
  padding-left: 10px;
  padding-right: 8px;
}
.scoring-view.is-landscape .col-subtotal,
.scoring-view.is-landscape .col-total {
  font-size: 14px;
  padding: 5px 6px;
}
.scoring-view.is-landscape .col-notation-cell {
  font-size: 13px;
  min-width: 30px;
}

/* Live games: compact row at the bottom of the viewport */
.scoring-view.is-landscape .live-games-box {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  flex-shrink: 0;
  max-height: 30vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.scoring-view.is-landscape .live-games-label { display: none; }
.scoring-view.is-landscape .gs-line {
  padding: 4px 0;
  border-top-color: rgba(255,255,255,.04);
}
.scoring-view.is-landscape .gs-title-row { font-size: 13px; gap: 4px; }
.scoring-view.is-landscape .gs-detail-row { font-size: 12px; margin-top: 1px; }

/* Hide the collapsible "▼ LIVE GAMES" header toggle in landscape */
.scoring-view.is-landscape .collapsible-header { display: none; }

/* Settle-up and finish banner: suppressed in landscape — portrait-only */
.scoring-view.is-landscape .settle-up-section,
.scoring-view.is-landscape .scorecard-controls,
.scoring-view.is-landscape .scorecard-toolbar {
  display: none !important;
}

/* Bottom-nav hiding is declared in global src/style.css so the scoped
   CSS rewrite doesn't defeat the body-level selector. */

/* Rotate-to-exit hint — tiny, unobtrusive, top-right corner */
.landscape-hint {
  position: fixed;
  top: calc(4px + env(safe-area-inset-top));
  right: calc(8px + env(safe-area-inset-right));
  z-index: 50;
  padding: 4px 9px;
  border-radius: 10px;
  background: rgba(0,0,0,.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  color: rgba(240,237,224,.65);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .3px;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  animation: card-in 250ms ease-out;
}
.lh-arrow {
  font-size: 12px;
  color: var(--gw-gold, #d4af37);
  font-weight: 900;
}
</style>
