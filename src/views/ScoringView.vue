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
    await shareScorecard(roundsStore.activeRound)
  } catch (e) { console.error('Share scorecard failed:', e) }
  finally { sharing.value = false }
}

async function doShareRecap() {
  if (sharing.value) return
  sharing.value = true
  showRoundMenu.value = false
  try {
    await shareRecap(roundsStore.activeRound, buildGameLines(), liveSettlements.value)
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
/* ── Challenge another foursome strip ───────────────────── */
.challenge-strip {
  padding: 8px 16px 4px;
}
.challenge-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: rgba(212,175,55,.08);
  border: 1px solid rgba(212,175,55,.22);
  border-radius: 10px;
  text-decoration: none;
  color: #d4af37;
  transition: background 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.challenge-btn:active {
  background: rgba(212,175,55,.16);
  border-color: rgba(212,175,55,.4);
}
.challenge-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.challenge-label {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #d4af37;
}
.challenge-arrow {
  font-size: 18px;
  font-weight: 300;
  color: rgba(212,175,55,.6);
  line-height: 1;
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
.course-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.course-logo {
  height: 28px;
  width: 28px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
}
.course-name {
  font-family: var(--gw-font-display, Georgia);
  font-size: 20px;
  font-weight: 700;
  color: var(--gw-text, #f0ede0);
  margin: 0;
  line-height: 1.2;
}
.course-name--with-logo {
  font-size: 17px;
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
.back-to-history-btn {
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.15);
  color: #cbd5e1;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
}
.back-to-history-btn:active { background: rgba(255,255,255,.14); }
.edit-score-input {
  width: 100%;
  padding: 10px;
  font-size: 24px;
  text-align: center;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.08);
  color: #f1f5f9;
  margin: 12px 0;
  box-sizing: border-box;
}
.edit-score-input:disabled { opacity: .5; }
.edit-score-toast {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 0;
  border-radius: 6px;
  margin-bottom: 8px;
}
.edit-score-toast--ok  { color: #22c55e; }
.edit-score-toast--err { color: #f87171; }

/* Score sync error banner */
.sync-error-banner {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #7f1d1d;
  border-bottom: 1px solid #ef4444;
  color: #fca5a5;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  padding: 8px 16px;
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
.hcp-editor-modal { width: min(380px, 92vw); }
.hcp-editor-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06);
}
.hcp-editor-row--expanded { flex-direction: column; align-items: stretch; gap: 6px; }
.hcp-editor-top { display: flex; align-items: center; justify-content: space-between; }
.hcp-editor-right { display: flex; align-items: center; gap: 8px; }
.hcp-editor-coursehcp { font-size: 11px; color: rgba(255,255,255,.45); white-space: nowrap; }
.hcp-editor-name { font-size: 14px; color: rgba(255,255,255,.85); }
.hcp-editor-input {
  width: 60px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15);
  border-radius: 8px; color: #fff; font-size: 14px; text-align: center; padding: 6px 8px;
}
.hcp-editor-input--modified {
  border-color: #d4af37; color: #d4af37;
}
/* Strokes-per-hole grid inside HCP editor */
.hcp-editor-holes {
  display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px;
  margin-bottom: 4px;
}
.hcp-editor-hole {
  display: flex; flex-direction: column; align-items: center;
  background: rgba(255,255,255,.04); border-radius: 5px; padding: 3px 0;
}
.hcp-editor-hole--has { background: rgba(74,222,128,.12); }
.hcp-editor-hole-num { font-size: 9px; color: rgba(255,255,255,.35); line-height: 1; }
.hcp-editor-hole-val { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.5); line-height: 1.2; }
.hcp-editor-hole--has .hcp-editor-hole-val { color: #4ade80; }
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
.settle-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.settle-club-logo {
  height: 24px;
  width: 24px;
  object-fit: contain;
  opacity: 0.7;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
}
.settle-box-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .8px; color: rgba(240,237,224,.45); margin-bottom: 0;
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

/* Scorecard grid styles moved to style.css (shared with ScorecardGrid.vue) */

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
