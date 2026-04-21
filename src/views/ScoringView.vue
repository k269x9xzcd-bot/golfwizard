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
      <!-- Score sync error banner -->
      <div v-if="roundsStore.scoreSyncError" class="sync-error-banner">
        <span v-if="roundsStore.scoreSyncError === 'rls'">⚠️ Scores not saving — session issue. Please sign out and back in.</span>
        <span v-else>⚠️ Scores not saving to cloud. Check your connection.</span>
      </div>
      <!-- Header -->
      <header class="scoring-header">
        <div class="header-left">
          <div class="course-name-row">
            <img
              v-if="isBonnieBriar"
              src="../assets/bonnie-briar-logo.png"
              class="course-logo"
              alt="Bonnie Briar Country Club"
            />
            <h1 class="course-name" :class="{ 'course-name--with-logo': isBonnieBriar }">{{ roundsStore.activeRound.course_name }}</h1>
          </div>
          <div class="header-meta">
            <span class="meta-tag">{{ roundsStore.activeRound.tee }}</span>
            <span class="meta-tag">{{ holesLabel }}</span>
            <span v-if="isViewOnly" class="meta-tag meta-viewer" title="Viewing completed round — tap any score to edit">📋 History View</span>
            <span v-else-if="!isCaptain" class="meta-tag meta-viewer" title="View-only — you're not the scorer for this round">👀 Viewer</span>
          </div>
          <div v-if="isViewOnly" style="margin-top:6px">
            <button class="back-to-history-btn" @click="goBackToHistory">← Back to History</button>
          </div>
        </div>
        <div class="header-right-actions">
          <router-link to="/library" class="btn-rules-sm">📖</router-link>
          <button class="btn-round-menu" @click.stop="showRoundMenu = !showRoundMenu">⚙️</button>
        </div>
        <div v-if="showRoundMenu" class="round-menu-backdrop" @click="showRoundMenu = false"></div>
        <div v-if="showRoundMenu" class="round-menu-dropdown" @click.stop>
          <button v-if="isCaptain" class="round-menu-item" @click="showRoundMenu = false; openDateEditor()">
            📅 Edit Round Date
          </button>
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
          <button class="round-menu-item" @click="doShareScorecard" :disabled="sharing">
            {{ sharing ? '⏳ Sharing…' : '📸 Share Scorecard' }}
          </button>
          <button class="round-menu-item" @click="doShareRecap" :disabled="sharing">
            {{ sharing ? '⏳ Sharing…' : '📋 Share Recap' }}
          </button>
          <button v-if="isCaptain" class="round-menu-item" @click="doSimulateFill">
            🎲 Simulate Scores
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
      <!-- Date editor modal -->
      <div v-if="showDateEditor" class="hcp-editor-overlay" @click.self="showDateEditor = false">
        <div class="hcp-editor-modal" style="max-width:320px">
          <div class="hcp-editor-title">Edit Round Date</div>
          <div style="margin:16px 0">
            <input
              type="date"
              v-model="editDateValue"
              class="wiz-input"
              style="width:100%;font-size:16px;text-align:center"
            />
          </div>
          <div v-if="dateEditError" style="color:#f87171;font-size:12px;margin-bottom:10px">{{ dateEditError }}</div>
          <div style="display:flex;gap:8px">
            <button class="hcp-editor-done" style="flex:1;background:rgba(255,255,255,.08);color:var(--gw-text)" @click="showDateEditor = false">Cancel</button>
            <button class="hcp-editor-done" style="flex:1" @click="saveDateEdit" :disabled="dateSaving">{{ dateSaving ? 'Saving…' : 'Save' }}</button>
          </div>
        </div>
      </div>

      <div v-if="showHcpEditor" class="hcp-editor-overlay" @click.self="showHcpEditor = false">
        <div class="hcp-editor-modal">
          <div class="hcp-editor-title">Edit Handicap Indexes</div>
          <div class="hcp-editor-note">Changes apply to this round only and recalculate strokes immediately.</div>
          <div v-for="m in roundsStore.activeMembers" :key="m.id" class="hcp-editor-row hcp-editor-row--expanded">
            <!-- Name + index + course HCP -->
            <div class="hcp-editor-top">
              <span class="hcp-editor-name">{{ m.short_name || m.guest_name }}</span>
              <div class="hcp-editor-right">
                <span class="hcp-editor-coursehcp">
                  Course HCP: {{ hcpEditorCourseHcp(m) }}
                </span>
                <input
                  type="number"
                  step="0.1"
                  :class="['hcp-editor-input', { 'hcp-editor-input--modified': hcpEditorIsModified(m) }]"
                  :value="m.ghin_index"
                  @change="updateMemberHcp(m.id, $event.target.value)"
                  placeholder="—"
                />
              </div>
            </div>
            <!-- Strokes per hole grid -->
            <div class="hcp-editor-holes">
              <div
                v-for="(strokes, hIdx) in hcpEditorStrokes(m)"
                :key="hIdx"
                class="hcp-editor-hole"
                :class="{ 'hcp-editor-hole--has': strokes > 0 }"
              >
                <div class="hcp-editor-hole-num">{{ hIdx + 1 }}</div>
                <div class="hcp-editor-hole-val">{{ strokes > 0 ? '+'.repeat(strokes) : '·' }}</div>
              </div>
            </div>
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
      <!-- ── Edit Score Dialog (viewOnly mode) ───────────────────── -->
      <div v-if="editScoreDialog" class="delete-overlay" @click="!editScoreSaving && (editScoreDialog = null)">
        <div class="delete-dialog" @click.stop>
          <div class="delete-title">Edit Score</div>
          <div class="delete-msg">{{ editScoreDialog.memberName }} — Hole {{ editScoreDialog.hole }}</div>
          <input
            class="edit-score-input"
            type="number"
            min="1"
            max="20"
            v-model="editScoreValue"
            @keyup.enter="saveEditScore"
            :disabled="editScoreSaving"
            autofocus
          />
          <transition name="fade">
            <div v-if="editScoreToast === 'saved'" class="edit-score-toast edit-score-toast--ok">✓ Saved</div>
            <div v-else-if="editScoreToast === 'error'" class="edit-score-toast edit-score-toast--err">⚠ Save failed — try again</div>
          </transition>
          <div class="delete-actions">
            <button class="btn-cancel" @click="editScoreDialog = null" :disabled="editScoreSaving">Cancel</button>
            <button class="btn-delete-confirm" style="background:#22c55e" @click="saveEditScore" :disabled="editScoreSaving">
              {{ editScoreSaving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>

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
      <GameEditorOverlay :show="showGameEditor" :game-icon="gameIcon" :game-label="gameLabel" @close="showGameEditor = false" />

      <!-- ── Retro score overlay (bulk-enter scores from paper card) ── -->
      <RetroScoreOverlay
        ref="retroOverlayRef"
        :show="showRetroScore"
        :visible-holes="visibleHoles"
        :par-for-hole="parForHole"
        :member-grid-name="memberGridName"
        @close="showRetroScore = false"
        @saved="showRetroScore = false"
      />

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

        <!-- Challenge another foursome — only when no games/opponents set yet.
             Once you have games configured, cross-team scoring is already live in the card. -->
        <div v-if="isCaptain && !roundsStore.activeRound?.is_complete && roundsStore.activeGames.length === 0 && !opponentPlayers.length" class="challenge-strip">
          <router-link to="/cross-match/new" class="challenge-btn">
            <span class="challenge-icon">⚔️</span>
            <span class="challenge-label">Challenge another foursome (separate device)</span>
            <span class="challenge-arrow">›</span>
          </router-link>
        </div>

        <!-- Finish Round Banner -->
        <!-- Round complete badge — only shown after the round is finalized -->
        <div v-if="roundsStore.activeRound?.is_complete" class="finish-banner finish-done">
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
          <button class="sim-btn" @click="doShareScorecard" :disabled="sharing" title="Share scorecard">{{ sharing ? '⏳' : '↑' }}</button>
          <button class="sim-btn sim-btn-reset" @click="resetScores" title="Reset all scores">↺</button>
        </div>

        <!-- Horizontal Scorecard Grid -->
        <div class="scorecard-outer" id="gw-capture-target">
          <!-- Capture-only header: hidden in app, shown when taking screenshot -->
          <div class="capture-header">
            <div class="capture-header-left">
              <div class="capture-course">{{ roundsStore.activeRound.course_name }}</div>
              <div class="capture-meta">{{ roundsStore.activeRound.date }} · {{ roundsStore.activeRound.tee }} tees · {{ holesLabel }}</div>
            </div>
            <div class="capture-header-right">⛳ GolfWizard</div>
          </div>
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
                    @click="isViewOnly ? openEditScoreDialog(group.member.id, h) : (activeHole = h)"
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
                    @click="isViewOnly ? openEditScoreDialog(group.member.id, h) : (activeHole = h)"
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
                  <span class="notation-name" v-if="!row.labelHtml">{{ row.label }}</span>
                  <span class="notation-name" v-else v-html="row.labelHtml"></span>
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
          <div class="settle-box-header">
            <div class="settle-box-label">💵 Settle Up</div>
            <img
              v-if="isBonnieBriar"
              src="../assets/bonnie-briar-logo.png"
              class="settle-club-logo"
              alt="Bonnie Briar Country Club"
            />
          </div>
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


        <!-- Aloha banner / button — hole 18 only -->
        <template v-if="nassauGameForAloha">
          <div v-if="!nassauGameForAloha.config?.aloha?.status && nassauLosingTeam(nassauGameForAloha) !== null && (myNassauTeam(nassauGameForAloha) === null || nassauLosingTeam(nassauGameForAloha) === myNassauTeam(nassauGameForAloha))"
               class="aloha-banner aloha-call">
            <span class="aloha-icon">🌺</span>
            <div class="aloha-text"><strong>{{ alohaLosingTeamNames(nassauGameForAloha) }}</strong> can call Aloha — double or nothing on hole 18</div>
            <button class="aloha-btn" @click="openAlohaCallModal(nassauGameForAloha)">Call Aloha</button>
          </div>
          <div v-else-if="nassauGameForAloha.config?.aloha?.status === 'pending' && (myNassauTeam(nassauGameForAloha) === null || myNassauTeam(nassauGameForAloha) !== nassauGameForAloha.config.aloha.calledBy)"
               class="aloha-banner aloha-pending">
            <span class="aloha-icon">🌺</span>
            <div class="aloha-text"><strong>Aloha called!</strong> ${{ nassauGameForAloha.config.aloha.amount }} on hole 18 — accept?</div>
            <div class="aloha-respond">
              <button class="aloha-btn aloha-accept" @click="respondAloha(nassauGameForAloha, true)">Accept</button>
              <button class="aloha-btn aloha-decline" @click="respondAloha(nassauGameForAloha, false)">Decline</button>
            </div>
          </div>
          <div v-else-if="nassauGameForAloha.config?.aloha?.status === 'accepted'"
               class="aloha-banner aloha-active">
            <span class="aloha-icon">🌺</span>
            <div class="aloha-text"><strong>Aloha is on!</strong> ${{ nassauGameForAloha.config.aloha.amount }} rides on this hole.</div>
          </div>
          <div v-else-if="nassauGameForAloha.config?.aloha?.status === 'declined'"
               class="aloha-banner aloha-declined">
            <span class="aloha-icon">🌺</span>
            <div class="aloha-text">Aloha declined.</div>
          </div>
        </template>
        <!-- Aloha call modal -->
        <div v-if="showAlohaModal" class="aloha-modal-backdrop" @click.self="showAlohaModal = false">
          <div class="aloha-modal">
            <div class="aloha-modal-title">🌺 Call Aloha</div>
            <div class="aloha-modal-body">
              <p>Double or nothing on hole 18. Set the amount:</p>
              <input type="number" v-model.number="alohaCustomAmount" class="aloha-amount-input" min="1" />
            </div>
            <div class="aloha-modal-actions">
              <button class="aloha-btn aloha-accept" @click="callAloha">Call Aloha</button>
              <button class="aloha-btn aloha-decline" @click="showAlohaModal = false">Cancel</button>
            </div>
          </div>
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

        <!-- Finish Round on last hole (hidden in viewOnly mode) -->
        <div v-if="!isViewOnly && activeHole === visibleHoles[visibleHoles.length - 1] && roundCompletionInfo.allScored && !roundsStore.activeRound?.is_complete" class="hole-finish-banner">
          <div class="hole-finish-text">All {{ visibleHoles.length }} holes scored!</div>
          <button class="finish-btn finish-btn-lg" @click="showFinishReview = true">Review & Finish Round</button>
        </div>
        <div v-else-if="!isViewOnly && activeHole === visibleHoles[visibleHoles.length - 1] && !roundCompletionInfo.allScored && roundCompletionInfo.scoredCount > 0 && !roundsStore.activeRound?.is_complete" class="hole-finish-banner hole-finish-partial">
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
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore, displayName as rosterDisplayName, displayInitials as rosterDisplayInitials } from '../stores/roster'
import { shareScorecard, shareRecap } from '../modules/scorecardShare'
import CrossMatchBanner from '../components/CrossMatchBanner.vue'
import GameEditorOverlay from '../components/GameEditorOverlay.vue'
import RetroScoreOverlay from '../components/RetroScoreOverlay.vue'
import { useScorecardHelpers } from '../composables/useScorecardHelpers'
import { useGameNotation } from '../composables/useGameNotation'
import { useLiveSettlements } from '../composables/useLiveSettlements'
import { computeNassau } from '../modules/gameEngine'

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const coursesStore = useCoursesStore()
const rosterStore = useRosterStore()
const router = useRouter()
const route = useRoute()

// ── Composable: scorecard helpers ────────────────────────────────
const showFullHcp = ref(false) // must be declared before composables
const {
  courseData, holesLabel, visibleHoles, hasBack9, frontHoles, backHoles, hasYardage,
  parForHole, siForHole, yardsForHole, holeHasData,
  getScore, memberHandicapValue, playerTotal, playerNetTotal, memberHandicapDisplay,
  lowManStrokes, memberEffectiveHcp, netScore, strokeDotsOnHole,
  isNetWinner, scoreNotation,
  memberGrossTotal, memberNetTotal, memberGrossToPar, parTotal,
  teamRowClass, teamStickyClass, teamTextClass, teamCardClass, teamBadgeClass, teamBarClass,
  sortedPlayerGroups,
  nameToInitials, memberDisplay, memberGridName, memberInitials,
  teamInitialsStr, pInit, playerInitials,
} = useScorecardHelpers({ showFullHcp })

// ── Composable: game notation ─────────────────────────────────────
// buildCtx is returned here so all composables share one definition
const {
  HALVED_HTML, buildCtx, gameIcon, gameLabel, pressHoles, gameNotationRows,
  fidgetHoleWinners, isFidgetWinner,
} = useGameNotation({ courseData, visibleHoles, teamInitialsStr, pInit })

// ── Composable: live settlements ──────────────────────────────────
const {
  liveSettlements, gameSummaryHtml,
} = useLiveSettlements({ buildCtx, gameIcon, gameLabel, teamInitialsStr, pInit, memberDisplay, visibleHoles })


const showRetroScore = ref(false)
const retroOverlayRef = ref(null)
function openRetroScore() {
  showRetroScore.value = true
  retroOverlayRef.value?.openRetroScore()
}
// ── View-only mode (opened from history to review a completed round) ──
const isViewOnly = computed(() => route.query.viewOnly === 'true')

// ── View state ──────────────────────────────────────────────────
const activeHole = ref(0) // 0 = Card view, >0 = Hole entry
const selectedGame = ref(null)
const showRoundMenu = ref(false)
const confirmDeleteActive = ref(false)
const showGameEditor = ref(false)
const showHcpEditor = ref(false)
const showOppEditor = ref(false)
const showDateEditor = ref(false)
const editDateValue  = ref('')
const dateSaving     = ref(false)
const dateEditError  = ref('')

function openDateEditor() {
  editDateValue.value = roundsStore.activeRound?.date || new Date().toISOString().slice(0, 10)
  dateEditError.value = ''
  showDateEditor.value = true
}

async function saveDateEdit() {
  if (!editDateValue.value) { dateEditError.value = 'Pick a date'; return }
  dateSaving.value = true
  dateEditError.value = ''
  try {
    await roundsStore.updateRoundDate(roundsStore.activeRound.id, editDateValue.value)
    showDateEditor.value = false
  } catch (e) {
    dateEditError.value = e?.message || 'Save failed'
  } finally {
    dateSaving.value = false
  }
}

// ── View-only edit score dialog ───────────────────────────────────
const editScoreDialog = ref(null) // { memberId, memberName, hole, current }
const editScoreValue = ref('')
const editScoreSaving = ref(false)
const editScoreToast = ref('') // '' | 'saved' | 'error'

function openEditScoreDialog(memberId, hole) {
  if (!isViewOnly.value) return
  const member = roundsStore.activeMembers.find(m => m.id === memberId)
  editScoreDialog.value = {
    memberId,
    memberName: member?.short_name || memberId,
    hole,
    current: roundsStore.activeScores[memberId]?.[hole] ?? '',
  }
  editScoreValue.value = String(editScoreDialog.value.current || '')
  editScoreToast.value = ''
}

async function saveEditScore() {
  if (!editScoreDialog.value || editScoreSaving.value) return
  const { memberId, hole } = editScoreDialog.value
  const val = parseInt(editScoreValue.value)
  if (!val || val < 1 || val > 20) return
  editScoreSaving.value = true
  editScoreToast.value = ''
  try {
    await roundsStore.setScore(memberId, hole, val)
    editScoreToast.value = 'saved'
    setTimeout(() => {
      editScoreDialog.value = null
      editScoreToast.value = ''
      editScoreSaving.value = false
    }, 800)
  } catch (e) {
    editScoreToast.value = 'error'
    editScoreSaving.value = false
  }
}

// ── ALOHA (Nassau side bet on hole 18) ──────────────────────────────────────
const showAlohaModal = ref(false)
const alohaModalGame = ref(null)
const alohaCustomAmount = ref(0)

const nassauGameForAloha = computed(() => {
  const hole = activeHole.value
  const isComplete = roundsStore.activeRound?.is_complete
  const games = roundsStore.activeGames || []
  const nassau = games.find(g => g.type?.toLowerCase() === 'nassau') ?? null
  if (hole !== 18) return null
  if (isComplete && !nassau?.config?.aloha?.status) return null
  return nassau
})

function nassauLosingTeam(game) {
  const ctx = buildCtx()
  if (!ctx) return null
  try {
    const r = computeNassau(ctx, { ...game.config, aloha: null })
    const total = r.settlement?.total ?? 0
    if (total === 0) return null
    return total > 0 ? 't2' : 't1'
  } catch { return null }
}

function defaultAlohaAmount(game) {
  const ctx = buildCtx()
  if (!ctx) return 0
  try {
    const r = computeNassau(ctx, { ...game.config, aloha: null })
    return Math.abs(r.settlement?.total ?? 0) * 2
  } catch { return 0 }
}

function alohaLosingTeamNames(game) {
  const loser = nassauLosingTeam(game)
  if (!loser) return ''
  const ids = loser === 't1' ? (game.config?.team1 || []) : (game.config?.team2 || [])
  return ids.map(id => {
    const m = roundsStore.activeMembers.find(x => x.id === id)
    return m?.short_name || m?.name || '?'
  }).join(' + ')
}

function myNassauTeam(game) {
  const myId = roundsStore.activeMembers.find(m => m.profile_id === authStore.user?.id)?.id
  if (!myId) return null
  if ((game.config?.team1 || []).includes(myId)) return 't1'
  if ((game.config?.team2 || []).includes(myId)) return 't2'
  return null
}

function openAlohaCallModal(game) {
  alohaModalGame.value = game
  alohaCustomAmount.value = defaultAlohaAmount(game)
  showAlohaModal.value = true
}

async function callAloha() {
  const game = alohaModalGame.value
  if (!game) return
  const loser = nassauLosingTeam(game)
  if (!loser) return
  const newConfig = { ...game.config, aloha: { status: 'pending', calledBy: loser, amount: alohaCustomAmount.value } }
  await roundsStore.updateGameConfig(game.id, newConfig)
  showAlohaModal.value = false
}

async function respondAloha(game, accept) {
  const newConfig = { ...game.config, aloha: { ...game.config.aloha, status: accept ? 'accepted' : 'declined' } }
  await roundsStore.updateGameConfig(game.id, newConfig)
}

function goBackToHistory() {
  router.push('/history')
}

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
  // If we were in viewOnly mode, clear activeRound so Home doesn't show it as in-progress
  if (isViewOnly.value && roundsStore.activeRound?.is_complete) {
    roundsStore.clearActiveRound()
  }
  // Leaving the view: make sure the body class is cleared
  if (typeof document !== 'undefined') document.body.classList.remove('gw-landscape')
  if (!_landscapeMql) return
  if (_landscapeMql.removeEventListener) _landscapeMql.removeEventListener('change', _landscapeHandler)
  else if (_landscapeMql.removeListener) _landscapeMql.removeListener(_landscapeHandler)
  _landscapeMql = null
  _landscapeHandler = null
})
const gamesExpanded = ref(true)

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

const isBonnieBriar = computed(() => {
  const name = roundsStore.activeRound?.course_name ?? ''
  return name.toLowerCase().includes('bonnie briar')
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
function doSimulateFill() {
  showRoundMenu.value = false
  if (!confirm('Simulate random scores for all players? This will overwrite any existing scores.')) return
  simulateFill()
}

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

const sharing = ref(false)

function buildGameLines() {
  if (!liveSettlements.value?.summary) return []
  const rows = []
  for (const [gameId, s] of Object.entries(liveSettlements.value.summary)) {
    const game = roundsStore.activeGames.find(g => g.id === gameId)
    if (!game) continue
    const icon  = gameIcon(game.type)
    const label = gameLabel(game.type, game.config || {})
    if (s?.error) {
      rows.push({ icon, label, winnerLine: null, detail: '—' })
      continue
    }
    const nets = s?.nets || []
    if (!nets.length) {
      rows.push({ icon, label, winnerLine: 'All square', detail: null })
      continue
    }
    // Winners (positive net) → winnerLine; full breakdown → detail
    const sorted = [...nets].sort((a, b) => b.net - a.net)
    const winners = sorted.filter(n => n.net > 0).map(n => `${n.name} +$${n.net}`).join(', ')
    const detail  = sorted
      .filter(n => n.net !== 0)
      .map(n => {
        const sign = n.net > 0 ? '+' : '-'
        return `${n.name}: ${sign}$${Math.abs(n.net)}`
      })
      .join(' · ')
    rows.push({ icon, label, winnerLine: winners || 'All square', detail: detail || null })
  }
  return rows
}

function _shareCtx() {
  const round = roundsStore.activeRound
  const members = roundsStore.activeMembers
  const scores = roundsStore.activeScores
  const course = coursesStore.getCourse(round?.course_name) || {}
  return { round, members, scores, course }
}

async function doShareScorecard() {
  if (sharing.value) return
  sharing.value = true
  showRoundMenu.value = false
  try {
    await shareScorecard(
      roundsStore.activeRound,
      roundsStore.activeMembers,
      roundsStore.activeScores,
      courseData.value,
      gameNotationRows.value,
    )
  } catch (e) { console.error('Share scorecard failed:', e) }
  finally { sharing.value = false }
}

async function doShareRecap() {
  if (sharing.value) return
  sharing.value = true
  showRoundMenu.value = false
  try {
    await shareRecap(
      roundsStore.activeRound,
      roundsStore.activeMembers,
      roundsStore.activeScores,
      courseData.value,
      roundsStore.activeGames,
      liveSettlements.value,
      buildGameLines(),
      gameNotationRows.value,
    )
  } catch (e) { console.error('Share recap failed:', e) }
  finally { sharing.value = false }
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

// ── HCP editor helpers ──────────────────────────────────────────
function hcpEditorCourseHcp(member) {
  const course = courseData.value
  const tee = roundsStore.activeRound?.tee
  return courseHandicap(member.ghin_index ?? 0, course, tee)
}

function hcpEditorIsModified(member) {
  // Amber highlight when live ghin_index differs from the stored round_hcp
  if (member.round_hcp == null) return false
  return hcpEditorCourseHcp(member) !== member.round_hcp
}

function hcpEditorStrokes(member) {
  const course = courseData.value
  const tee = roundsStore.activeRound?.tee
  const holesMode = roundsStore.activeRound?.holes_mode || '18'
  const numHoles = holesMode === '9f' || holesMode === '9b' ? 9 : 18
  const hcp = hcpEditorCourseHcp(member)
  return Array.from({ length: numHoles }, (_, i) => {
    const hole = holesMode === '9b' ? i + 10 : i + 1
    const si = holeSI(course, hole, tee)
    return strokesOnHole(hcp, si)
  })
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

<style scoped src="../styles/ScoringView.css" />
