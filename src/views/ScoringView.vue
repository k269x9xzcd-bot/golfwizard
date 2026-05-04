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
      <p class="empty-message">Start a new round to begin scoring</p>
      <button class="empty-start-btn" @click="openWizard">+ Start a Round</button>
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
            <span v-else-if="!isCaptain && canScore" class="meta-tag meta-scorer" title="You're a member — you can enter scores">✏️ Scorer</span>
            <span v-else-if="!isCaptain && !canScore" class="meta-tag meta-viewer" title="View-only — you're not a member of this round">👀 Viewer</span>
          </div>
          <div v-if="isViewOnly" style="margin-top:6px">
            <button class="back-to-history-btn" @click="goBackToHistory">← Back to History</button>
          </div>
          <!-- Round switcher chip — only when 2+ known active rounds -->
          <button
            v-if="!isViewOnly && roundsStore.knownRounds.length > 1"
            class="round-switch-chip"
            @click.stop="showRoundPicker = true"
          >⇄ Switch round</button>
        </div>
        <div class="header-right-actions">
          <button
            v-if="courseData?.greenCoords?.length"
            class="btn-gps-toggle"
            :class="{ 'gps-toggle--active': gpsEnabled }"
            @click="toggleGps"
            :title="gpsEnabled ? 'GPS On — tap to disable' : 'Enable GPS distance'"
          >⛳</button>
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
          <button class="round-menu-item" v-if="isCaptain && !roundsStore.activeRound?.is_complete" :disabled="finishing" @click="showRoundMenu = false; finishRound()">
            {{ finishing ? '⏳ Finishing…' : '✅ Finish Round' }}
          </button>
          <button class="round-menu-item" v-if="isCaptain && roundsStore.activeRound?.is_complete && !roundsStore.activeRound?.owner_id && authStore.isAuthenticated" :disabled="syncing" @click="syncToAccount">
            {{ syncing ? '⏳ Syncing…' : '☁️ Sync to Account' }}
          </button>
          <button class="round-menu-item" @click="doShareScorecard" :disabled="sharing">
            {{ sharing ? '⏳ Sharing…' : '📸 Share Scorecard' }}
          </button>
          <button class="round-menu-item" @click="doShareRecap" :disabled="sharing">
            {{ sharing ? '⏳ Sharing…' : '📋 Share Recap' }}
          </button>
          <!-- Simulate Scores: dev-only, hidden from production users
          <button v-if="isCaptain" class="round-menu-item" @click="doSimulateFill">
            🎲 Simulate Scores
          </button> -->
          <button v-if="isCaptain" class="round-menu-item round-menu-danger" @click="showRoundMenu = false; confirmDeleteActive = true">
            🗑️ Delete Round
          </button>
          <div v-if="!isCaptain && canScore" class="round-menu-item round-menu-note">
            ✏️ You're a member of this round and can enter scores.
          </div>
          <button class="round-menu-item round-menu-divider" @click="showRoundMenu = false; $router.push('/settings')">
            👤 My Profile &amp; Settings
          </button>
          <div v-if="!isCaptain && !canScore" class="round-menu-item round-menu-note">
            👀 You're viewing this round in read-only mode. Ask the scorer to share the room code so you can join.
          </div>
        </div>
      </header>

      <!-- Opponent group strip -->
      <div v-if="opponentPlayers.length" class="opp-strip">
        <span class="opp-strip-label">vs</span>
        <span v-for="p in opponentPlayers" :key="p.id" class="opp-strip-player">{{ p.shortName || p.name }}</span>
      </div>

      <!-- HCP / Date / Opponent Editor Modals -->
      <HcpEditorModal
        :show-date-editor="showDateEditor"
        :edit-date-value="editDateValue"
        :date-edit-error="dateEditError"
        :date-saving="dateSaving"
        :show-hcp-editor="showHcpEditor"
        :members="roundsStore.activeMembers"
        :course-hcp="hcpEditorCourseHcp"
        :is-modified="hcpEditorIsModified"
        :strokes-per-hole="hcpEditorStrokes"
        :show-opp-editor="showOppEditor"
        :edit-opp-players="editOppPlayers"
        :opp-editor-search="oppEditorSearch"
        :opp-editor-guest-name="oppEditorGuestName"
        :opp-editor-filtered="oppEditorFiltered"
        :is-opp-added="isEditOppAdded"
        :is-my-player="isMyPlayer"
        @close-date-editor="showDateEditor = false"
        @update:edit-date-value="editDateValue = $event"
        @save-date-edit="saveDateEdit"
        @close-hcp-editor="showHcpEditor = false"
        @update-hcp="updateMemberHcp"
        @update-strokes="updateMemberStrokes"
        @update-strokes-local="updateMemberStrokesLocal"
        @close-opp-editor="showOppEditor = false"
        @remove-opp="editOppPlayers.splice($event, 1)"
        @toggle-opp="toggleEditOpp"
        @add-opp-guest="oppEditorAddGuest"
        @save-opp-editor="saveOppEditor"
        @update:opp-editor-search="oppEditorSearch = $event"
        @update:opp-editor-guest-name="oppEditorGuestName = $event"
      />

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

      <!-- ── Round picker bottom sheet ────────────────────────── -->
      <RoundPickerSheet
        :show="showRoundPicker"
        :known-rounds="roundsStore.knownRounds"
        :active-round-id="roundsStore.activeRound?.id"
        @close="showRoundPicker = false"
        @switch="switchToRound"
      />

      <!-- ── Game Editor Overlay ────────────────────────────────── -->
      <WizardOverlay v-if="showGameEditor" edit-mode @close="showGameEditor = false" />

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
                <td v-if="hasBack9" class="col-subtotal" style="font-weight:600;font-size:10px">{{ frontHoles.reduce((s,h) => s + (yardsForHole(h)||0), 0) || '' }}</td>
                <td v-for="h in backHoles" :key="'y'+h" class="col-yards-val">{{ yardsForHole(h) || '' }}</td>
                <!-- IN yards -->
                <td v-if="hasBack9" class="col-subtotal" style="font-weight:600;font-size:10px">{{ backHoles.reduce((s,h) => s + (yardsForHole(h)||0), 0) || '' }}</td>
                <td class="col-total" style="font-weight:700;font-size:10px">{{ visibleHoles.reduce((s,h) => s + (yardsForHole(h)||0), 0) || '' }}</td>
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
                    :class="{ 'cell-winner': isNetWinner(group.member.id, h), 'cell-defidget': isFidgetWinner(group.member.id, h), [sixesCellClass(group.member.id, h)]: true }"
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
                    :class="{ 'cell-winner': isNetWinner(group.member.id, h), 'cell-defidget': isFidgetWinner(group.member.id, h), [sixesCellClass(group.member.id, h)]: true }"
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

            <!-- Game notation rows: always expanded per-hole -->
            <tfoot v-if="gameNotationRows.length > 0 && showGameRows">
              <template v-for="(row, ri) in gameNotationRows" :key="'gn-'+ri">

                <!-- ── Sixes segment row: merged label + per-hole cells ── -->
                <tr v-if="row.isSixesSeg" class="row-game-notation row-sixes-seg">
                  <!-- Sticky label: merged with non-segment holes (left blank) -->
                  <td class="col-sticky col-notation-label col-sixes-label">
                    <span class="notation-name" v-html="row.labelHtml"></span>
                  </td>
                  <!-- Front holes -->
                  <template v-for="h in frontHoles" :key="'gn-'+ri+'-'+h">
                    <!-- Holes outside this segment: blank, dimmed -->
                    <td v-if="h < row.segFrom || h > row.segTo"
                        class="col-notation-cell col-sixes-outside"></td>
                    <!-- Holes inside this segment: winner cell -->
                    <td v-else
                        class="col-notation-cell col-sixes-inside"
                        :class="row.cells[h]?.cls || ''"
                        v-html="row.cells[h]?.text || ''"></td>
                  </template>
                  <td v-if="hasBack9" class="col-subtotal col-notation-sub"></td>
                  <!-- Back holes -->
                  <template v-for="h in backHoles" :key="'gn-'+ri+'-'+h">
                    <td v-if="h < row.segFrom || h > row.segTo"
                        class="col-notation-cell col-sixes-outside"></td>
                    <td v-else
                        class="col-notation-cell col-sixes-inside"
                        :class="row.cells[h]?.cls || ''"
                        v-html="row.cells[h]?.text || ''"></td>
                  </template>
                  <!-- Segment result: spans IN+G+N (or G+N for 9-hole) -->
                  <td :colspan="hasBack9 ? 3 : 2" class="col-notation-summary" v-html="row.totalSummary || ''"></td>
                </tr>

                <!-- ── All other notation rows (standard) ── -->
                <tr v-else class="row-game-notation notation-row-expanded" :class="row.cls || ''">
                  <td class="col-sticky col-notation-label">
                    <span class="notation-icon">{{ row.icon }}</span>
                    <span class="notation-name" v-if="!row.labelHtml">{{ row.label }}</span>
                    <span class="notation-name" v-else v-html="row.labelHtml"></span>
                  </td>
                  <td v-for="h in frontHoles" :key="'gn-'+ri+'-'+h"
                      class="col-notation-cell" :class="row.cells[h]?.cls || ''"
                      v-html="row.cells[h]?.text || ''"></td>
                  <!-- Blank OUT subtotal (keep column widths, show nothing) -->
                  <td v-if="hasBack9" class="col-subtotal col-notation-sub"></td>
                  <td v-for="h in backHoles" :key="'gn-'+ri+'-'+h"
                      class="col-notation-cell" :class="row.cells[h]?.cls || ''"
                      v-html="row.cells[h]?.text || ''"></td>
                  <!-- Summary spans IN+G+N (3 cols for 18h) or G+N (2 cols for 9h) -->
                  <td :colspan="hasBack9 ? 3 : 2" class="col-notation-summary" v-html="row.totalSummary || ''"></td>
                </tr>

              </template>
            </tfoot>
          </table>
        </div>
        </div><!-- /.scorecard-outer -->

        <!-- Unified Live panel — one source of truth for tournament + side games + pair bets + cross-match -->
        <div v-if="liveSections.length > 0" class="live-panel">
          <div v-for="section in liveSections" :key="section.key" class="live-section">
            <div class="live-section-header">
              <span class="live-section-title">{{ section.title }}</span>
              <span v-if="section.headerNote" class="live-section-note">— {{ section.headerNote }}</span>
            </div>

            <template v-for="item in section.items" :key="item.key">
              <!-- Tournament Team BB row -->
              <div v-if="item.kind === 'tournament-bb'" class="live-row tourn-row">
                <span class="live-row-label">Team BB</span>
                <span v-if="item.teamLabel" class="live-row-detail">{{ item.teamLabel }}</span>
                <span class="live-row-status">{{ item.statusLabel }}</span>
                <span v-if="item.money > 0" class="live-row-money">+${{ item.money }}</span>
              </div>

              <!-- Tournament 1v1 row -->
              <div v-else-if="item.kind === 'tournament-1v1'" class="live-row tourn-row">
                <span class="live-row-label">1v1</span>
                <span class="live-row-detail">{{ item.matchup }}</span>
                <span class="live-row-status">{{ item.statusLabel }}</span>
                <span v-if="item.money > 0" class="live-row-money">+${{ item.money }}</span>
              </div>

              <!-- Side game / pair bet row — tap to edit -->
              <div
                v-else-if="item.kind === 'side-game' || item.kind === 'pair-bet'"
                class="live-row live-row-game"
                role="button"
                tabindex="0"
                @click="selectedGame = item.game"
                @keyup.enter="selectedGame = item.game"
                v-html="gameSummaryHtml(item.game)"
              ></div>

              <!-- Cross-match row — tap to standings -->
              <router-link
                v-else-if="item.kind === 'cross-match'"
                :to="`/cross-match/${item.match.id}`"
                class="live-row cross-row"
              >
                <span class="live-row-label">vs Foursome {{ item.match.round_a_id === roundsStore.activeRound?.id ? 'B' : 'A' }}</span>
                <span class="live-row-status">Standings ›</span>
              </router-link>
            </template>
          </div>
        </div>

        <!-- Settle Up Panel -->
        <div v-if="liveSettlements && (roundsStore.activeGames.length > 0 || tournamentWagerGames.length > 0) && (roundsStore.activeRound?.is_complete || roundCompletionInfo.allScored)" class="settle-box">
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
          <!-- Tournament breakdown — one line per component -->
          <div v-if="tournamentSettlementLines.length > 0" class="settle-tournament">
            <div class="settle-group-label">🏆 Tournament</div>
            <div v-for="(line, i) in tournamentSettlementLines" :key="'ts-'+i" class="settle-tourn-line">
              <span class="settle-tourn-lbl">{{ line.label }}</span>
              <span class="settle-tourn-sep">·</span>
              <span class="settle-tourn-detail">{{ line.detail }}</span>
              <span class="settle-tourn-sep">·</span>
              <span class="settle-tourn-status">{{ line.status }}</span>
              <span v-if="line.winnerName && line.amount > 0" class="settle-tourn-money">{{ line.winnerName }} +${{ line.amount }}</span>
              <span v-else class="settle-tourn-tie">tie · no $</span>
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
      <div v-else ref="holeViewEl" class="hole-view" @touchstart="onTouchStart" @touchend="onTouchEnd">

        <!-- Offline pending scores banner -->
        <div v-if="pendingScores > 0" class="offline-pending-banner">
          <span class="pending-dot"></span> {{ pendingScores }} score{{ pendingScores > 1 ? 's' : '' }} pending sync
        </div>

        <!-- Hole Banner -->
        <div class="hole-banner">
          <div class="hole-banner-left">
            <div class="hole-big-number">Hole {{ activeHole }}</div>
            <div class="hole-course-meta">{{ roundsStore.activeRound.course_name }} · {{ roundsStore.activeRound.tee }}</div>
          </div>
          <!-- GPS distance — centered in banner, only when GPS is enabled -->
          <div v-if="gpsEnabled && greenCoordsForHole(activeHole)" class="gps-center">
            <div class="gps-center-dist" :style="{ color: gpsAccuracyColor }">
              {{ gpsDistance !== null ? gpsDistance + 'y' : '…' }}
            </div>
          </div>
          <div class="hole-banner-right">
            <div class="hole-big-number">Par {{ parForHole(activeHole) }}</div>
            <div class="hole-course-meta">
              SI {{ siForHole(activeHole) }}<template v-if="yardsForHole(activeHole)"> · {{ yardsForHole(activeHole) }}y</template>
            </div>
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
          <div v-if="!nassauGameForAloha.config?.aloha?.status && nassauLosingTeam(nassauGameForAloha) !== null"
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


        <!-- Double Fidget prompt — fires once when all players have won a hole -->
        <div v-if="showDoubleFidgetPrompt" class="aloha-banner aloha-call double-fidget-prompt">
          <span class="aloha-icon">😬</span>
          <div class="aloha-text">
            <strong>Everyone's off the hook!</strong> Start a second Fidget pot from the next hole?
          </div>
          <div class="aloha-respond">
            <button class="aloha-btn aloha-accept" @click="startDoubleFidget">Yes, run it</button>
            <button class="aloha-btn aloha-decline" @click="dismissDoubleFidget">No thanks</button>
          </div>
        </div>

        <!-- Hammer banner: shows on every hole when a hammer game is active -->
        <template v-if="hammerGame">
          <div v-if="!hammerHoleLog(activeHole).conceded && hammerHoleLog(activeHole).status !== 'accepted'"
               class="aloha-banner aloha-call"
               :class="{ 'hammer-inactive': !canThrowHammer }">
            <span class="aloha-icon">🔨</span>
            <div class="aloha-text">
              <strong v-if="canThrowHammer">Throw the Hammer</strong>
              <strong v-else>{{ hammerHolderName }} holds the hammer</strong>
              &mdash; ${{ hammerHoleValue(activeHole) }} on this hole
              <span v-if="hammerHoleLog(activeHole).throws > 0"> ({{ hammerHoleLog(activeHole).throws }}x thrown)</span>
            </div>
            <button v-if="canThrowHammer" class="aloha-btn" @click="throwHammer">Throw 🔨</button>
          </div>
          <div v-else-if="hammerHoleLog(activeHole).status === 'pending' && !canThrowHammer"
               class="aloha-banner aloha-pending">
            <span class="aloha-icon">🔨</span>
            <div class="aloha-text"><strong>Hammer thrown!</strong> Worth ${{ hammerHoleValue(activeHole) }} — accept or concede?</div>
            <div class="aloha-respond">
              <button class="aloha-btn aloha-accept" @click="respondHammer(true)">Accept</button>
              <button class="aloha-btn aloha-decline" @click="respondHammer(false)">Concede</button>
            </div>
          </div>
          <div v-else-if="hammerHoleLog(activeHole).status === 'accepted'"
               class="aloha-banner aloha-active">
            <span class="aloha-icon">🔨</span>
            <div class="aloha-text"><strong>Hammer accepted!</strong> Hole worth ${{ hammerHoleValue(activeHole) }}
              <span v-if="hammerGame.config.fuHammer && canThrowHammer"> — F-U available</span>
            </div>
            <button v-if="hammerGame.config.fuHammer && canThrowHammer" class="aloha-btn" @click="throwHammer">F-U 🔨</button>
          </div>
          <div v-else-if="hammerHoleLog(activeHole).conceded"
               class="aloha-banner aloha-declined">
            <span class="aloha-icon">🔨</span>
            <div class="aloha-text">Hole conceded at ${{ hammerHoleLog(activeHole).holeValue ?? hammerHoleValue(activeHole) }}.</div>
          </div>
        </template>
        <!-- Player Score Cards — inline +/- entry -->
        <div class="hole-players-list">
          <div
            v-for="group in holePlayerGroups"
            :key="group.member.id"
            class="player-hole-card"
            :class="[teamCardClass(group.member), { 'card-winner': isNetWinner(group.member.id, activeHole) }]"
          >
            <div class="phc-identity">
              <div class="phc-initials" :class="teamBadgeClass(group.member)">
                <span class="phc-init-chars">{{ playerInitials(group.member) }}</span>
                <span v-if="memberHandicapDisplay(group.member) !== ''" class="phc-init-hcp">{{ memberHandicapDisplay(group.member) }}</span>
              </div>
              <span v-if="lowManStrokes(group.member) !== null" class="phc-init-lowman">({{ lowManStrokes(group.member) }})</span>
              <div class="phc-name-col">
                <div class="phc-hcp-row">
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
            <div v-if="scoreSaveState[group.member.id + '-' + activeHole]" class="score-save-state">{{ scoreSaveState[group.member.id + '-' + activeHole] }}</div>
            </div>
            <div class="phc-net-col">
              <div class="phc-net-label">NET</div>
              <div class="phc-net-value" :class="getScore(group.member.id, activeHole) ? (showNotations ? scoreNotation(netScore(getScore(group.member.id, activeHole), memberEffectiveHcp(group.member), siForHole(activeHole)), parForHole(activeHole)) : '') : 'muted'">
                {{ getScore(group.member.id, activeHole) ? netScore(getScore(group.member.id, activeHole), memberEffectiveHcp(group.member), siForHole(activeHole)) : '—' }}
              </div>
            </div>
            <div v-if="wolfGame && wolfOnThisHole === group.member.id && wolfChoiceForHole?.partner" class="wolf-badge-row">
              <template v-if="wolfChoiceForHole.partner === 'lone'">🐺 Lone</template>
              <template v-else-if="wolfChoiceForHole.partner === 'blind'">🙈 Blind</template>
              <template v-else>🐺 +{{ fLastName(roundsStore.activeMembers.find(m => m.id === wolfChoiceForHole.partner)) }}</template>
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
            <span class="wolf-current">{{ wolfOnThisHoleName }} is Wolf<span v-if="wolfGame?.config?.wolfTeesFirst === false" class="wolf-tee-badge"> tees last</span><span v-else class="wolf-tee-badge"> tees first</span></span>
          </div>

          <!-- CHOSEN STATE: compact single-line teams -->
          <template v-if="wolfTeamForHole">
            <div class="wolf-teams-compact">
              <span class="wolf-compact-mode">{{ wolfTeamForHole.mode === 'lone' ? '🐺' : wolfTeamForHole.mode === 'blind' ? '🙈' : '🤝' }}</span>
              <span class="wolf-compact-wolfside">{{ wolfTeamForHole.wolfTeam.map(fLastName).join('+') }}<span v-if="wolfTeamForHole.mode !== 'partner'" class="wolf-team-mult">&nbsp;{{ wolfTeamForHole.mode === 'blind' ? (wolfGame.config?.blindWolfMultiplier ?? 8) : (wolfGame.config?.wolfLoneMultiplier ?? 4) }}×</span></span>
              <span class="wolf-compact-vs">vs</span>
              <span class="wolf-compact-fieldside">{{ wolfTeamForHole.field.map(fLastName).join('+') }}</span>
            </div>
            <button class="wolf-change-btn" @click="setWolfChoice(wolfChoiceForHole.partner)">✕ Clear choice</button>
          </template>

          <!-- PICKING STATE: show partner/lone/blind buttons -->
          <template v-else>
            <div class="wolf-prompt">{{ wolfGame?.config?.wolfTeesFirst === false ? 'Wolf tees last — watch all shots, then pick' : 'Tap a player to pick as partner after their tee shot' }}</div>
            <div class="wolf-buttons">
              <button
                v-for="member in wolfPickableMembers"
                :key="'wolf-pick-' + member.id"
                class="wolf-pick-btn"
                @click="setWolfChoice(member.id)"
              >{{ memberDisplay(member) }}</button>
            </div>
            <button class="wolf-lone-btn" @click="setWolfChoice('lone')">🐺 Lone Wolf</button>
            <button
              v-if="wolfGame.config?.blindWolfEnabled !== false"
              class="wolf-blind-btn"
              @click="setWolfChoice('blind')"
            >🙈 Blind Wolf ({{ wolfGame?.config?.blindWolfMultiplier ?? 8 }}× stakes)</button>
          </template>
        </div>


        <!-- Sixes team rotation panel -->
        <div v-if="sixesGame" class="bonus-panel sixes-rotation-panel">
          <div class="bonus-header">
            <span class="bonus-label">🎲 Sixes — {{ sixesSegmentLabel }}</span>
          </div>
          <div class="sixes-teams">
            <div class="sixes-team-col">
              <div class="sixes-team-label">Team A</div>
              <div v-for="pid in sixesTeamA" :key="pid" class="sixes-player">{{ sixesMemberName(pid) }}</div>
            </div>
            <div class="sixes-vs">VS</div>
            <div class="sixes-team-col">
              <div class="sixes-team-label">Team B</div>
              <div v-for="pid in sixesTeamB" :key="pid" class="sixes-player">{{ sixesMemberName(pid) }}</div>
            </div>
          </div>
          <div style="font-size:11px;opacity:.5;margin-top:6px;text-align:center">Partners rotate every 6 holes — low-man handicap</div>
        </div>

        <div v-if="bbbGame" class="bbb-strip">
          <div class="bbb-strip-header">
            <span class="bbb-strip-title">🏌️ BBB — Hole {{ activeHole }}</span>
            <button
              v-if="bbbHoleAward(activeHole).bingo && bbbHoleAward(activeHole).bango && bbbHoleAward(activeHole).bongo"
              class="bbb-sweep-btn"
              @click="setBbbSweep(activeHole)"
            >Sweep ⚡</button>
          </div>
          <div class="bbb-row">
            <!-- BINGO: first on green -->
            <div class="bbb-point" :class="{ assigned: bbbHoleAward(activeHole).bingo }">
              <div class="bbb-point-label">B1 BINGO</div>
              <div class="bbb-point-sub">First on green</div>
              <div class="bbb-player-row">
                <button
                  v-for="m in bbbMembers"
                  :key="m.id"
                  class="bbb-player-btn"
                  :class="{ active: bbbHoleAward(activeHole).bingo === m.id }"
                  @click="setBbbPoint(activeHole, 'bingo', m.id)"
                >{{ m.short_name || m.name }}</button>
              </div>
            </div>
            <!-- BANGO: closest once all on green -->
            <div class="bbb-point" :class="{ assigned: bbbHoleAward(activeHole).bango, locked: !bbbHoleAward(activeHole).bingo }">
              <div class="bbb-point-label">B2 BANGO</div>
              <div class="bbb-point-sub">Closest to pin</div>
              <div class="bbb-player-row">
                <button
                  v-for="m in bbbMembers"
                  :key="m.id"
                  class="bbb-player-btn"
                  :class="{ active: bbbHoleAward(activeHole).bango === m.id }"
                  :disabled="!bbbHoleAward(activeHole).bingo"
                  @click="setBbbPoint(activeHole, 'bango', m.id)"
                >{{ m.short_name || m.name }}</button>
              </div>
            </div>
            <!-- BONGO: first to hole out -->
            <div class="bbb-point" :class="{ assigned: bbbHoleAward(activeHole).bongo, locked: !bbbHoleAward(activeHole).bango }">
              <div class="bbb-point-label">B3 BONGO</div>
              <div class="bbb-point-sub">First to hole out</div>
              <div class="bbb-player-row">
                <button
                  v-for="m in bbbMembers"
                  :key="m.id"
                  class="bbb-player-btn"
                  :class="{ active: bbbHoleAward(activeHole).bongo === m.id }"
                  :disabled="!bbbHoleAward(activeHole).bango"
                  @click="setBbbPoint(activeHole, 'bongo', m.id, true)"
                >{{ m.short_name || m.name }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Junk Sheet button — only when dots/junk game is active -->
        <div v-if="dotsGame" class="junk-sheet-trigger">
          <button class="junk-sheet-btn" @click="openJunkSheet(activeHole)">🎯 Log Junk — H{{ activeHole }}</button>
        </div>

        <!-- Junk Sheet bottom sheet -->
        <div v-if="showJunkSheet" class="junk-sheet-backdrop" @click.self="showJunkSheet = false">
          <div class="junk-sheet">
            <div class="junk-sheet-header">
              <span>🎯 Junk — Hole {{ junkSheetHole }}</span>
              <button class="junk-sheet-close" @click="showJunkSheet = false">Done</button>
            </div>
            <div class="junk-sheet-body">
              <div v-for="junkType in activeJunkTypes" :key="junkType.key" class="junk-row">
                <div class="junk-row-label">
                  <span class="junk-type-icon">{{ junkType.icon }}</span>
                  <span>{{ junkType.label }}</span>
                  <span v-if="junkType.par3Only" class="junk-par3-badge">par 3</span>
                  <span v-if="junkType.auto" class="junk-auto-badge">auto</span>
                </div>
                <div class="junk-player-buttons">
                  <button
                    v-for="m in junkSheetMembers"
                    :key="m.id"
                    class="junk-player-btn"
                    :class="{ active: isJunkMarked(m.id, junkSheetHole, junkType.key), 'auto-marked': junkType.auto && isJunkMarked(m.id, junkSheetHole, junkType.key) }"
                    :disabled="junkType.par3Only && parForHole(junkSheetHole) !== 3"
                    @click="!junkType.auto && toggleJunk(m.id, junkSheetHole, junkType.key)"
                  >{{ m.short_name || m.name }}</button>
                </div>
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

        <!-- Per-hole game math breakdown for current hole -->
        <div v-if="holeGameMath.length" class="hole-math-section">
          <div v-for="gm in holeGameMath" :key="gm.id" class="hole-math-game">
            <span class="hole-math-icon">{{ gm.icon }}</span>
            <span class="hole-math-lbl">{{ gm.label }}</span>
            <span v-for="(line, li) in gm.lines" :key="li" class="hole-math-line">{{ line }}</span>
          </div>
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

        <!-- BBB Strip — BINGO/BANGO/BONGO sequential unlock -->
        <div v-if="!isViewOnly && activeHole === visibleHoles[visibleHoles.length - 1] && !roundCompletionInfo.allScored && roundCompletionInfo.scoredCount > 0 && !roundsStore.activeRound?.is_complete" class="hole-finish-banner hole-finish-partial">
          <div class="hole-finish-text">{{ roundCompletionInfo.missingHoles.length }} holes still need scores</div>
          <button class="finish-btn finish-btn-review" @click="activeHole = roundCompletionInfo.missingHoles[0]">Go to H{{ roundCompletionInfo.missingHoles[0] }}</button>
        </div>

        <!-- Finish Round Review overlay -->
        <FinishRoundOverlay
          :show="showFinishReview"
          :members="roundsStore.activeMembers"
          :finishing="finishing"
          :error="finishError"
          :member-display="memberDisplay"
          :player-total="playerTotal"
          :player-net-total="playerNetTotal"
          @close="showFinishReview = false"
          @finish="finishRound"
        />
      </div>

      <!-- Score entry modal removed — inline +/- on player cards -->
    </div>
  </div>
</template>


<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore, displayName as rosterDisplayName, displayInitials as rosterDisplayInitials } from '../stores/roster'
import { useTournamentStore } from '../stores/tournament'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { shareScorecard, shareRecap } from '../modules/scorecardShare'
import CrossMatchBanner from '../components/CrossMatchBanner.vue'
import WizardOverlay from '../components/WizardOverlay.vue'
import RetroScoreOverlay from '../components/RetroScoreOverlay.vue'
import HcpEditorModal from '../components/scoring/HcpEditorModal.vue'
import RoundPickerSheet from '../components/scoring/RoundPickerSheet.vue'
import FinishRoundOverlay from '../components/scoring/FinishRoundOverlay.vue'
import { useScorecardHelpers } from '../composables/useScorecardHelpers'
import { useGameNotation } from '../composables/useGameNotation'
import { useHoleMath } from '../composables/useHoleMath'
import { useLiveSettlements } from '../composables/useLiveSettlements'
import { computeNassau, computeHammer, computeFidget, courseHandicap, holeSI, strokesOnHole } from '../modules/gameEngine'
import { normalizeWagers, buildTournamentWagerGames } from '../modules/tournamentWagers'
import { simulateRound } from '../modules/simulator'

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const tournamentStore = useTournamentStore()
const linkedStore = useLinkedMatchesStore()
const coursesStore = useCoursesStore()
const rosterStore = useRosterStore()
const router = useRouter()
const route = useRoute()
const openWizard = inject('openWizard')

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
  HALVED_HTML, buildCtx, gameIcon, gameLabel, pressHoles, gameNotationRows, sixesHoleTeamMap,
  fidgetHoleWinners, isFidgetWinner,
} = useGameNotation({ courseData, visibleHoles, teamInitialsStr, pInit })

// ── Double Fidget ──────────────────────────────────────────────────
const showDoubleFidgetPrompt = ref(false)
const doubleFidgetGame = ref(null)

const fidgetGame = computed(() => roundsStore.activeGames.find(g => g.type === 'fidget'))

// Watch for all-cleared condition after each score change
watch(
  () => roundsStore.activeScores,
  () => {
    const game = fidgetGame.value
    if (!game?.config?.doubleFidget) return
    if (game.config.fidget2Active) return  // already triggered
    if (showDoubleFidgetPrompt.value) return
    const ctx = buildCtx()
    if (!ctx?.course) return
    try {
      const r = computeFidget(ctx, game.config)
      if (r.allClearedHole != null && !game.config.fidget2Active) {
        doubleFidgetGame.value = game
        showDoubleFidgetPrompt.value = true
      }
    } catch (e) { /* scores incomplete */ }
  },
  { deep: true }
)

async function startDoubleFidget() {
  const game = doubleFidgetGame.value
  if (!game) return
  const ctx = buildCtx()
  const r = computeFidget(ctx, game.config)
  const startHole = (r.allClearedHole ?? activeHole.value) + 1
  await roundsStore.updateGameConfig(game.id, {
    ...game.config,
    fidget2Active: true,
    fidget2StartHole: startHole,
  })
  showDoubleFidgetPrompt.value = false
  doubleFidgetGame.value = null
}

function dismissDoubleFidget() {
  showDoubleFidgetPrompt.value = false
  doubleFidgetGame.value = null
}

// ── Composable: hole math breakdown ─────────────────────────────────
const { holeMathLines } = useHoleMath({ buildCtx, pInit, teamInitialsStr })

// ── Composable: live settlements ──────────────────────────────────
const {
  liveSettlements, gameSummaryHtml,
} = useLiveSettlements({ buildCtx, gameIcon, gameLabel, teamInitialsStr, pInit, memberDisplay, visibleHoles, rosterPlayers: computed(() => rosterStore.players), tournamentWagerGames: computed(() => tournamentWagerGames.value) })


// ── Tournament match status (single source of truth — tournament tables only) ──
// Computes live Team BB + 1v1 standings from activeMembers/activeScores plus the
// tournament_match record (singles_order + wagers). Never reads game_configs for
// tournament structure. Tournament structure is locked: launched pairings come
// from tournament_matches.singles_order, swap is persisted there at launch.
const tournamentMatchStatus = computed(() => {
  const round = roundsStore.activeRound
  if (round?.format !== 'tournament') return null
  const members = roundsStore.activeMembers
  const scores = roundsStore.activeScores
  const si = round.course_snapshot?.si || []
  const t1 = members.filter(m => m.team === 1)
  const t2 = members.filter(m => m.team === 2)
  if (!t1.length || !t2.length) return null

  let thru = 0
  for (const memberId of Object.keys(scores)) {
    const holes = Object.keys(scores[memberId]).map(Number)
    if (holes.length) thru = Math.max(thru, ...holes)
  }

  // Team Best Ball (net) — winner of each hole +1, no carryover
  let t1Up = 0, t2Up = 0
  for (let h = 1; h <= thru; h++) {
    const siH = si[h - 1] ?? h
    const t1Nets = t1.map(m => { const g = scores[m.id]?.[h]; return g != null ? g - strokesOnHole(m.round_hcp ?? 0, siH) : null }).filter(n => n != null)
    const t2Nets = t2.map(m => { const g = scores[m.id]?.[h]; return g != null ? g - strokesOnHole(m.round_hcp ?? 0, siH) : null }).filter(n => n != null)
    if (!t1Nets.length || !t2Nets.length) continue
    const t1BB = Math.min(...t1Nets), t2BB = Math.min(...t2Nets)
    if (t1BB < t2BB) t1Up++
    else if (t2BB < t1BB) t2Up++
  }
  const bbDiff = t1Up - t2Up
  const bbLabel = bbDiff === 0 ? (thru ? 'AS' : '—') : `${Math.abs(bbDiff)} up`
  const teamNames = team => team.map(m => m.nickname || m.short_name || '?').join('+')
  const bbTeamLabel = bbDiff > 0 ? teamNames(t1) : bbDiff < 0 ? teamNames(t2) : ''

  const hcpMap = Object.fromEntries(members.map(m => [m.id, m.round_hcp ?? 0]))
  function _calcStanding(p1id, p2id) {
    let standing = 0
    for (let h = 1; h <= thru; h++) {
      const siH = si[h - 1] ?? h
      const g1 = scores[p1id]?.[h], g2 = scores[p2id]?.[h]
      if (g1 == null || g2 == null) continue
      const n1 = g1 - strokesOnHole(hcpMap[p1id] ?? 0, siH)
      const n2 = g2 - strokesOnHole(hcpMap[p2id] ?? 0, siH)
      if (n1 < n2) standing++
      else if (n2 < n1) standing--
    }
    return standing
  }

  // Singles pairings come from tournament_matches.singles_order (0=straight, 1=swapped).
  // Falls back to straight order if the tournament store doesn't yet know about this round.
  const tournMatch = tournamentStore.matchByRoundId?.(round.id) || null
  const order = tournMatch?.singlesOrder === 1 ? 1 : 0
  const singlesPairs = order === 1
    ? [{ p1: t1[0], p2: t2[1] }, { p1: t1[1], p2: t2[0] }]
    : [{ p1: t1[0], p2: t2[0] }, { p1: t1[1], p2: t2[1] }]

  const singlesMatches = []
  for (const { p1, p2 } of singlesPairs) {
    if (!p1 || !p2) continue
    const standing = _calcStanding(p1.id, p2.id)
    const p1Name = p1.nickname || p1.short_name || '?'
    const p2Name = p2.nickname || p2.short_name || '?'
    const label = standing === 0 ? (thru ? 'AS' : '—') : `${standing > 0 ? p1Name : p2Name} ${Math.abs(standing)} up`
    singlesMatches.push({ p1Name, p2Name, p1Id: p1.id, p2Id: p2.id, label, standing })
  }

  return {
    thru,
    bb: { diff: bbDiff, label: bbLabel, teamLabel: bbTeamLabel },
    singles: singlesMatches,
    wagers: normalizeWagers(tournMatch?.wagers),
  }
})

// ── Tournament wagers as synthetic settlement entries ──────────────
// Each component (Team BB, 1v1 Match 1, 1v1 Match 2) is a standalone bet at a
// flat dollar amount — no $/point math. Wager dictionary on tournament_matches
// is { bb, s1, s2 }. Components with $0 are omitted (no settlement entry).
const tournamentWagerGames = computed(() => {
  const round = roundsStore.activeRound
  if (round?.format !== 'tournament') return []
  const status = tournamentMatchStatus.value
  if (!status) return []
  const members = roundsStore.activeMembers
  const t1Ids = members.filter(m => m.team === 1).map(m => m.id)
  const t2Ids = members.filter(m => m.team === 2).map(m => m.id)
  return buildTournamentWagerGames({
    wagers: status.wagers,
    t1Ids,
    t2Ids,
    singles: status.singles,
  })
})

// ── Tournament settlement breakdown (per-component $ for the settle box) ──
// Reads liveSettlements.summary keyed by the synthetic ids built above
// (__tourn_bb, __tourn_s1, __tourn_s2) and renders one line per non-zero
// component so users see exactly where the $ came from.
const tournamentSettlementLines = computed(() => {
  if (!liveSettlements.value) return []
  const status = tournamentMatchStatus.value
  if (!status) return []
  const summary = liveSettlements.value.summary || {}
  const lines = []
  // Team BB
  const bb = summary.__tourn_bb
  if (bb && status.wagers.bb > 0) {
    const winners = (bb.nets || []).filter(n => n.net > 0)
    const matchup = `${status.bb.teamLabel || 'Team BB'}`
    if (winners.length) {
      lines.push({ label: 'Team BB', detail: matchup, status: status.bb.label, winnerName: winners.map(w => w.name).join('+'), amount: status.wagers.bb })
    } else {
      lines.push({ label: 'Team BB', detail: matchup, status: status.bb.label, winnerName: null, amount: 0 })
    }
  }
  // Singles
  for (let i = 0; i < status.singles.length; i++) {
    const s = status.singles[i]
    const key = i === 0 ? '__tourn_s1' : '__tourn_s2'
    const wagerKey = i === 0 ? 's1' : 's2'
    const wager = status.wagers[wagerKey]
    if (wager <= 0) continue
    const game = summary[key]
    if (!game) continue
    const winners = (game.nets || []).filter(n => n.net > 0)
    lines.push({
      label: i === 0 ? '1v1 Match 1' : '1v1 Match 2',
      detail: `${s.p1Name} v ${s.p2Name}`,
      status: s.label,
      winnerName: winners[0]?.name || null,
      amount: winners[0] ? wager : 0,
    })
  }
  return lines
})

// ── Unified Live panel sections (single source of truth for live status) ──
// Replaces the old separate Match + Live Games panels. Sections render only
// when they have at least one row.
const liveCrossMatch = computed(() => {
  const round = roundsStore.activeRound
  if (!round?.id || !authStore.isAuthenticated) return null
  const matches = linkedStore.linkedMatches || []
  return matches.find(m =>
    m.status === 'linked' && (m.round_a_id === round.id || m.round_b_id === round.id),
  ) || null
})

const liveSections = computed(() => {
  const sections = []

  // 1) TOURNAMENT (only on tournament rounds) — three flat $ per matchup
  const t = tournamentMatchStatus.value
  if (t) {
    const w = t.wagers || { bb: 0, s1: 0, s2: 0 }
    const items = []
    items.push({
      kind: 'tournament-bb',
      key: 'bb',
      teamLabel: t.bb.teamLabel,
      statusLabel: t.bb.label,
      money: w.bb > 0 && t.bb.diff !== 0 ? w.bb : 0,
    })
    t.singles.forEach((s, i) => {
      const wager = i === 0 ? w.s1 : w.s2
      items.push({
        kind: 'tournament-1v1',
        key: 's' + i,
        matchup: `${s.p1Name} v ${s.p2Name}`,
        statusLabel: s.label,
        money: wager > 0 && s.standing !== 0 ? wager : 0,
      })
    })
    sections.push({
      key: 'tournament',
      title: 'TOURNAMENT',
      headerNote: t.thru ? `match thru ${t.thru}` : '',
      items,
    })
  }

  // 2) SIDE GAMES (foursome) — exclude match1v1 (those are pair bets);
  //    in tournament rounds also exclude best_ball (would dup the BB row above).
  const allGames = roundsStore.activeGames || []
  const isTourn = roundsStore.activeRound?.format === 'tournament'
  const sideGames = allGames.filter(g => {
    if (g.type === 'match1v1') return false
    if (isTourn && g.type === 'best_ball') return false
    return true
  })
  if (sideGames.length) {
    sections.push({
      key: 'side',
      title: 'SIDE GAMES',
      headerNote: 'foursome',
      items: sideGames.map(g => ({ kind: 'side-game', key: g.id, game: g })),
    })
  }

  // 3) PAIR BETS — every match1v1 in activeGames (tournament 1v1's are synthetic,
  //    not persisted as game_configs, so anything here is a side pair bet).
  const pairBets = allGames.filter(g => g.type === 'match1v1')
  if (pairBets.length) {
    sections.push({
      key: 'pair',
      title: 'PAIR BETS',
      headerNote: '',
      items: pairBets.map(g => ({ kind: 'pair-bet', key: g.id, game: g })),
    })
  }

  // 4) CROSS-MATCH (linked match for this round, if linked)
  const cm = liveCrossMatch.value
  if (cm) {
    sections.push({
      key: 'cross',
      title: 'CROSS-MATCH',
      headerNote: cm.name || '',
      items: [{ kind: 'cross-match', key: cm.id, match: cm }],
    })
  }

  return sections
})

const showRetroScore = ref(false)
const retroOverlayRef = ref(null)
function openRetroScore() {
  showRetroScore.value = true
  retroOverlayRef.value?.openRetroScore()
}
// ── View-only mode (opened from history to review a completed round) ──
const isViewOnly = computed(() => route.query.viewOnly === 'true')

// ── GPS distance to hole ─────────────────────────────────────────
// Must be triggered by a user tap (iOS Safari blocks auto geolocation)
const gpsDistance = ref(null)   // yards, null = no fix yet
const gpsAccuracy = ref(null)   // metres, from GeolocationCoordinates.accuracy
const gpsWatchId = ref(null)
const gpsActive = ref(false)    // true once user has tapped GPS button
const gpsEnabled = ref(false)   // user toggled GPS on via flag button

// Color-code the yardage by GPS accuracy (metres)
// red >15m, amber 8-15m, yellow-green 4-8m, bright green <4m
const gpsAccuracyColor = computed(() => {
  const a = gpsAccuracy.value
  if (a === null) return 'rgba(240,237,224,0.4)'
  if (a < 4)  return '#4ade80'   // bright green — excellent
  if (a < 8)  return '#86efac'   // soft green — good
  if (a < 15) return '#fbbf24'   // amber — fair
  return '#f87171'               // red — poor
})

const gpsAccuracyLabel = computed(() => {
  const a = gpsAccuracy.value
  if (a === null) return 'locating…'
  if (a < 4)  return `±${Math.round(a)}m`
  if (a < 8)  return `±${Math.round(a)}m`
  if (a < 15) return `±${Math.round(a)}m`
  return `±${Math.round(a)}m`
})

function haversineYards(lat1, lng1, lat2, lng2) {
  const R = 6371000 // metres
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 1.09361)
}

function greenCoordsForHole(hole) {
  return courseData.value?.greenCoords?.[hole - 1] ?? null
}

function startGpsWatch() {
  if (!navigator.geolocation) return
  gpsActive.value = true
  // Already watching — distance updates via the existing callback
  if (gpsWatchId.value !== null) return
  gpsWatchId.value = navigator.geolocation.watchPosition(
    (pos) => {
      gpsAccuracy.value = pos.coords.accuracy
      const green = greenCoordsForHole(activeHole.value)
      if (green) {
        gpsDistance.value = haversineYards(pos.coords.latitude, pos.coords.longitude, green.lat, green.lng)
      } else {
        gpsDistance.value = null
      }
    },
    () => { gpsDistance.value = null; gpsAccuracy.value = null },
    { enableHighAccuracy: true, maximumAge: 5000 }
  )
}

function stopGpsWatch() {
  if (gpsWatchId.value !== null) {
    navigator.geolocation.clearWatch(gpsWatchId.value)
    gpsWatchId.value = null
  }
  gpsDistance.value = null
  gpsAccuracy.value = null
  gpsActive.value = false
}

function toggleGps() {
  if (gpsEnabled.value) {
    // Turn off — stop watching and hide everything
    gpsEnabled.value = false
    stopGpsWatch()
  } else {
    // Turn on — enable display and immediately start watching
    gpsEnabled.value = true
    startGpsWatch()
  }
}

// When hole changes while GPS is active, clear distance/accuracy until next position update
watch(() => activeHole.value, () => {
  if (holeViewEl.value) holeViewEl.value.scrollTop = 0
  if (gpsActive.value) {
    gpsDistance.value = null
    gpsAccuracy.value = null
  }
})

onUnmounted(() => stopGpsWatch())

// ── Offline / save state indicators ───────────────────────────────────
const pendingScores = ref(0)
const isOffline = ref(typeof navigator !== 'undefined' && !navigator.onLine)
const scoreSaveState = ref({})
let _pendingInterval = null

if (typeof window !== 'undefined') {
  window.addEventListener('online',  () => { isOffline.value = false })
  window.addEventListener('offline', () => { isOffline.value = true  })
}

function showSaveState(memberId, hole, state) {
  const key = memberId + '-' + hole
  scoreSaveState.value = { ...scoreSaveState.value, [key]: state }
  if (state === 'saved ✓') setTimeout(() => {
    const s = { ...scoreSaveState.value }; delete s[key]; scoreSaveState.value = s
  }, 1500)
}

async function retryPendingScores() {
  if (roundsStore.flushQueue) await roundsStore.flushQueue()
  pendingScores.value = roundsStore.pendingQueueCount()
}

onMounted(async () => {
  _pendingInterval = setInterval(() => {
    pendingScores.value = roundsStore.pendingQueueCount()
  }, 2000)

  // Auto-open the user's in-progress round when none is currently loaded —
  // covers participants returning to the Score tab after the active state was cleared.
  if (!roundsStore.activeRound && authStore.isAuthenticated) {
    const uid = authStore.user?.id
    const candidate = roundsStore.rounds.find(r =>
      !r.is_complete &&
      (r.owner_id === uid || r.round_members?.some(m => m.profile_id === uid))
    )
    if (candidate) {
      try { await roundsStore.loadRound(candidate.id) } catch (e) { console.warn('[scoring] auto-load failed:', e?.message) }
    }
  }

  // Tournament rounds: ensure the tournament store is loaded so the Match
  // panel can derive singles_order + wagers from tournament_matches.
  if (roundsStore.activeRound?.format === 'tournament' && !tournamentStore.loaded) {
    tournamentStore.init().catch(e => console.warn('[scoring] tournament init failed:', e?.message))
  }

  // If the round is loaded but games are missing (tournament round where game_configs
  // weren't fetched — background insert failed or RLS gap), try a targeted fetch now.
  if (roundsStore.activeRound && roundsStore.activeGames.length === 0 && authStore.isAuthenticated) {
    try {
      const { data } = await import('../supabase').then(m =>
        m.supabase.from('game_configs').select('*').eq('round_id', roundsStore.activeRound.id)
      )
      if (data?.length) roundsStore.patchActiveGames(data)
    } catch {}
  }
})

onUnmounted(() => {
  if (_pendingInterval) clearInterval(_pendingInterval)
})

// ── View state ──────────────────────────────────────────────────
const activeHole = ref(0) // 0 = Card view, >0 = Hole entry
const holeViewEl = ref(null)
const selectedGame = ref(null)
const showRoundMenu = ref(false)
const showRoundPicker = ref(false)
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
    // Aloha caller = whoever is down the most $ in the total match
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
    // Default = double the current back-9 bet value
    const backBet = game.config?.back ?? game.config?.front ?? 10
    return backBet * 2
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


// ── HAMMER live UI ─────────────────────────────────────────────────────
const hammerGame = computed(() => {
  const games = roundsStore.activeGames || []
  return games.find(g => g.type?.toLowerCase() === 'hammer') ?? null
})

function myHammerTeam(game) {
  const myId = roundsStore.activeMembers.find(m => m.profile_id === authStore.user?.id)?.id
  if (!myId) return null
  if ((game.config?.team1 || []).includes(myId)) return 't1'
  if ((game.config?.team2 || []).includes(myId)) return 't2'
  return null
}

function hammerHoleLog(hole) {
  const log = hammerGame.value?.config?.hammerLog?.[hole] || {}
  return { throws: 0, conceded: false, holder: 't1', status: null, ...log }
}

function hammerHoleValue(hole) {
  const game = hammerGame.value
  if (!game) return 0
  const log = hammerHoleLog(hole)
  const ppt = game.config?.ppt || 1
  return ppt * Math.pow(2, log.throws)
}

const canThrowHammer = computed(() => {
  const game = hammerGame.value
  if (!game) return false
  const myTeam = myHammerTeam(game)
  if (!myTeam) return true // spectator: allow
  const log = hammerHoleLog(activeHole.value)
  if (log.conceded) return false
  if (log.status === 'pending') {
    // F-U: receiver can counter-hammer if fuHammer is on and they just received
    return game.config?.fuHammer && log.holder !== myTeam
  }
  // Normal: either team can throw (any time) — holder alternates with each throw
  return log.holder === myTeam || log.throws === 0
})

const hammerHolderName = computed(() => {
  const game = hammerGame.value
  if (!game) return ''
  const log = hammerHoleLog(activeHole.value)
  const holderTeam = log.holder || 't1'
  const ids = holderTeam === 't1' ? (game.config?.team1 || []) : (game.config?.team2 || [])
  return ids.map(id => {
    const m = roundsStore.activeMembers.find(x => x.id === id)
    return m?.short_name || '?'
  }).join('+')
})

async function throwHammer() {
  const game = hammerGame.value
  if (!game) return
  const hole = activeHole.value
  const log = hammerHoleLog(hole)
  const myTeam = myHammerTeam(game)
  const newHolder = myTeam === 't1' ? 't2' : 't1' // throw passes hammer to other team
  const newLog = {
    ...log,
    throws: log.throws + 1,
    status: 'pending',
    holder: newHolder,
  }
  if (game.config?.fuHammer && log.status === 'accepted') {
    // F-U: counter-hammer, retain
    newLog.holder = myTeam
  }
  const hammerLog = { ...(game.config?.hammerLog || {}), [hole]: newLog }
  await roundsStore.updateGameConfig(game.id, { ...game.config, hammerLog })
}

async function respondHammer(accept) {
  const game = hammerGame.value
  if (!game) return
  const hole = activeHole.value
  const log = hammerHoleLog(hole)
  if (accept) {
    const newLog = { ...log, status: 'accepted' }
    const hammerLog = { ...(game.config?.hammerLog || {}), [hole]: newLog }
    await roundsStore.updateGameConfig(game.id, { ...game.config, hammerLog })
  } else {
    // Concede — mark conceded, record who conceded
    const myTeam = myHammerTeam(game)
    const newLog = { ...log, conceded: true, concededBy: myTeam, status: 'conceded' }
    const hammerLog = { ...(game.config?.hammerLog || {}), [hole]: newLog }
    await roundsStore.updateGameConfig(game.id, { ...game.config, hammerLog })
  }
}


// ── BBB (Bingo Bango Bongo) STRIP ───────────────────────────────────────
const bbbGame = computed(() => {
  const games = roundsStore.activeGames || []
  return games.find(g => g.type?.toLowerCase() === 'bbb') ?? null
})

const bbbMembers = computed(() => roundsStore.activeMembers || [])

function bbbHoleAward(hole) {
  return bbbGame.value?.config?.awards?.[hole] || {}
}

async function setBbbPoint(hole, point, memberId, checkBirdie = false) {
  const game = bbbGame.value
  if (!game) return
  const awards = { ...(game.config?.awards || {}) }
  const current = { ...(awards[hole] || {}) }
  // Toggle: clicking same player clears the point
  if (current[point] === memberId) {
    delete current[point]
    // Also clear downstream points to preserve sequence
    if (point === 'bingo') { delete current.bango; delete current.bongo }
    if (point === 'bango') { delete current.bongo }
  } else {
    current[point] = memberId
    // Double Bongo: flag if winner birdied
    if (point === 'bongo' && checkBirdie && game.config?.doubleBongo) {
      const gross = getScore(memberId, hole)
      const par = parForHole(hole)
      current.bongoBirdied = gross != null && gross <= par - 1
    }
  }
  awards[hole] = current
  await roundsStore.updateGameConfig(game.id, { ...game.config, awards })
}

async function setBbbSweep(hole) {
  // Quick-assign all 3 points to first player who has bingo
  const game = bbbGame.value
  if (!game) return
  const award = bbbHoleAward(hole)
  const sweeper = award.bingo
  if (!sweeper) return
  const awards = { ...(game.config?.awards || {}) }
  awards[hole] = { bingo: sweeper, bango: sweeper, bongo: sweeper }
  await roundsStore.updateGameConfig(game.id, { ...game.config, awards })
}

// ── DOTS / JUNK SHEET ─────────────────────────────────────────────
const dotsGame = computed(() => {
  const games = roundsStore.activeGames || []
  return games.find(g => g.type?.toLowerCase() === 'dots') ?? null
})

const showJunkSheet = ref(false)
const junkSheetHole = ref(1)

const junkSheetMembers = computed(() => roundsStore.activeMembers || [])

const JUNK_TYPE_DEFS = [
  { key: 'greenie', label: 'Greenie', icon: '🌳', par3Only: true, auto: false, configKey: 'greenieEnabled' },
  { key: 'sandy',   label: 'Sandy',   icon: '🏖️', par3Only: false, auto: false, configKey: 'sandieEnabled' },
  { key: 'barkie',  label: 'Barkie',  icon: '🪵', par3Only: false, auto: false, configKey: 'barkieEnabled' },
  { key: 'arnie',   label: 'Arnie',   icon: '🌳', par3Only: false, auto: false, configKey: 'arnieEnabled' },
  { key: 'ferret',  label: 'Ferret',  icon: '🐰', par3Only: false, auto: false, configKey: 'ferretEnabled' },
  { key: 'negative',label: 'OB/Water',icon: '💧', par3Only: false, auto: false, configKey: 'negativeEnabled' },
]

const AUTO_JUNK_TYPES = [
  { key: 'birdie', label: 'Birdie', icon: '🐦', par3Only: false, auto: true, configKey: 'birdieEnabled' },
  { key: 'eagle',  label: 'Eagle',  icon: '🦅', par3Only: false, auto: true, configKey: 'eagleEnabled' },
]

const activeJunkTypes = computed(() => {
  const cfg = dotsGame.value?.config || {}
  const auto = AUTO_JUNK_TYPES.filter(t => cfg[t.configKey] !== false)
  const manual = JUNK_TYPE_DEFS.filter(t => cfg[t.configKey])
  return [...auto, ...manual]
})

function isJunkMarked(memberId, hole, type) {
  const manual = dotsGame.value?.config?.manual || {}
  // For auto types (birdie/eagle), check from score
  if (type === 'birdie' || type === 'eagle') {
    const ctx = buildCtx()
    if (!ctx) return false
    const m = roundsStore.activeMembers.find(x => x.id === memberId)
    if (!m) return false
    const gross = getScore(memberId, hole)
    if (!gross) return false
    const par2 = parForHole(hole)
    if (type === 'eagle') return gross != null && gross <= par2 - 2
    if (type === 'birdie') return gross != null && gross === par2 - 1
    return false
  }
  return !!manual[`${memberId}-${hole}-${type}`]
}

async function toggleJunk(memberId, hole, type) {
  const game = dotsGame.value
  if (!game) return
  const manual = { ...(game.config?.manual || {}) }
  const key = `${memberId}-${hole}-${type}`
  if (manual[key]) {
    delete manual[key]
  } else {
    manual[key] = true
  }
  await roundsStore.updateGameConfig(game.id, { ...game.config, manual })
}

function openJunkSheet(hole) {
  junkSheetHole.value = hole
  showJunkSheet.value = true
}

function goBackToHistory() {
  router.push('/history')
}

async function switchToRound(roundId) {
  if (roundId === roundsStore.activeRound?.id) { showRoundPicker.value = false; return }
  showRoundPicker.value = false
  activeHole.value = 0
  await roundsStore.loadRound(roundId)
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
// IMPORTANT: always replace the Set (new Set()) rather than mutating in place;
// Vue 3 ref does not track Set.add/delete mutations, only top-level assignment.
const expandedNotationRows = ref(new Set())
function toggleNotationRow(ri) {
  const s = new Set(expandedNotationRows.value)
  s.has(ri) ? s.delete(ri) : s.add(ri)
  expandedNotationRows.value = s
}

const holeGameMath = computed(() => {
  const result = []
  for (const game of (roundsStore.activeGames || [])) {
    const lines = holeMathLines(game, activeHole.value)
    if (lines.length) {
      result.push({ id: game.id, icon: gameIcon(game.type), label: gameLabel(game.type, game.config), lines })
    }
  }
  return result
})
// Auto-expand 5-3-1 / nines rows — per-hole points are the whole game,
// collapsing them to a single total defeats the purpose.
// ── Sixes team color per player per hole ──────────────────────────
function sixesCellClass(memberId, hole) {
  const seg = sixesHoleTeamMap.value?.[hole]
  if (!seg) return ''
  if (seg.aIds?.includes(memberId)) return 'six-score-a'
  if (seg.bIds?.includes(memberId)) return 'six-score-b'
  return ''
}

watch(gameNotationRows, (rows) => {
  const s = new Set(expandedNotationRows.value)
  rows.forEach((row, ri) => {
    if (row.cls === 'row-531') s.add(ri)
  })
  expandedNotationRows.value = s
}, { immediate: true })
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

// ── Captain / scorer / viewer roles ───────────────────────────
// Captain  = the round owner (edit games, finish round, delete)
// canScore = captain OR any round_member linked to this user (enter scores)
// viewer   = authenticated but not a member (read-only)
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
  if (!r.owner_id) return true
  if (!authStore.isAuthenticated) return false
  return r.owner_id === authStore.user?.id
})

// Any authenticated member of the round can enter scores (not just the owner).
const canScore = computed(() => {
  if (isCaptain.value) return true
  const r = roundsStore.activeRound
  if (!r?.owner_id) return true  // guest round
  if (!authStore.isAuthenticated) return false
  return roundsStore.activeMembers.some(m => m.profile_id === authStore.user?.id)
})

const viewerToast = ref('')
function flashViewerToast() {
  viewerToast.value = 'View-only — you\'re not a member of this round. Ask the scorer to share the room code.'
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
  if (!canScore.value) return flashViewerToast()
  const hole = activeHole.value
  const existing = getScore(member.id, hole)
  const par = parForHole(hole)
  const newScore = existing === null ? par : existing
  roundsStore.setScore(member.id, hole, newScore)
}

function inlineInc(member) {
  if (!canScore.value) return flashViewerToast()
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
  if (!canScore.value) return flashViewerToast()
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
async function doSimulateFill() {
  showRoundMenu.value = false
  if (!confirm('Simulate random scores for all players? This will overwrite any existing scores and game choices.')) return
  await simulateFill()
}

async function simulateFill() {
  // Wipe stale hole-by-hole game state before generating fresh simulated choices
  await clearGameState()

  const members = roundsStore.activeMembers
  const games = roundsStore.activeGames
  const course = courseData.value
  const tee = roundsStore.activeRound?.tee
  const holesMode = roundsStore.activeRound?.holes_mode || '18'

  const { scores, gameUpdates } = simulateRound({ members, games, course, tee, holesMode })

  // Apply all scores
  const scoreCalls = []
  for (const [memberId, holeMap] of Object.entries(scores)) {
    for (const [hole, score] of Object.entries(holeMap)) {
      scoreCalls.push(roundsStore.setScore(memberId, Number(hole), score))
    }
  }
  await Promise.all(scoreCalls)

  // Apply game config updates (wolf choices, snake events, dots manual, hammer log).
  // Use gameUpdates array (not a dict) to preserve the original gameId type —
  // Object.entries() stringifies numeric keys, breaking strict-equality lookups.
  for (const { gameId, config } of gameUpdates) {
    await roundsStore.updateGameConfig(gameId, config)
  }
}

// Per-game keys that hold hole-by-hole state (not setup config).
// Cleared on reset and before simulate so stale state never bleeds through.
const GAME_HOLE_STATE_KEYS = {
  wolf:   ['wolfChoices'],
  snake:  ['events'],
  dots:   ['manual'],
  bbb:    ['awards'],
  hammer: ['hammerLog'],
  fidget: ['fidget2Active', 'fidget2StartHole'],
}

async function clearGameState() {
  const calls = []
  for (const game of roundsStore.activeGames) {
    const t = game.type?.toLowerCase()
    const keys = GAME_HOLE_STATE_KEYS[t]
    if (!keys) continue
    const cfg = { ...game.config }
    let changed = false
    for (const k of keys) {
      if (k in cfg) { delete cfg[k]; changed = true }
    }
    if (changed) calls.push(roundsStore.updateGameConfig(game.id, cfg))
  }
  await Promise.all(calls)
}

async function resetScores() {
  if (!confirm('Reset all scores? This cannot be undone.')) return
  for (const memberId of Object.keys(roundsStore.activeScores)) {
    roundsStore.activeScores[memberId] = {}
  }
  await clearGameState()
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

const finishing = ref(false)
const finishError = ref(null)
const syncing = ref(false)

async function syncToAccount() {
  syncing.value = true
  showRoundMenu.value = false
  try {
    await roundsStore.syncGuestRoundToDb()
    router.push('/history')
  } catch (e) {
    alert('Sync failed: ' + (e.message || 'Unknown error'))
  } finally {
    syncing.value = false
  }
}

async function finishRound() {
  if (!roundsStore.activeRound || finishing.value) return
  finishing.value = true
  finishError.value = null
  try {
    await roundsStore.completeRound(roundsStore.activeRound.id)
    showFinishReview.value = false
    // Brief delay so Supabase scores flush before HistoryView fetches
    await new Promise(r => setTimeout(r, 800))
    router.push('/history')
  } catch (e) {
    console.error('Finish round error:', e)
    finishError.value = 'Could not finish round. Check your connection and try again.'
  } finally {
    finishing.value = false
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
      sixesHoleTeamMap.value,
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
      sixesHoleTeamMap.value,
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
    const { supaCall: _sc } = await import('../modules/supabaseOps')
    const res = await _sc('round_members.hcp', supabase.from('round_members').update({ ghin_index: newIndex }).eq('id', memberId), 5000)
    if (res.error) throw res.error
  } catch (e) {
    if (e.message?.includes('timed out')) {
      const { supaRawUpdate: _ru } = await import('../modules/supaRaw')
      await _ru('round_members', `id=eq.${memberId}`, { ghin_index: newIndex }, 8000).catch(() => {})
    } else {
      console.warn('[ScoringView] updateMemberHcp failed:', e)
    }
  }
}

async function updateMemberStrokes(memberId, rawValue) {
  const strokes = (rawValue === '' || rawValue == null) ? null : parseInt(rawValue)
  const m = roundsStore.activeMembers.find(x => x.id === memberId)
  if (!m) return
  m.stroke_override = strokes
  try {
    const { supabase } = await import('../supabase')
    const { supaCall: _sc } = await import('../modules/supabaseOps')
    const res = await _sc('round_members.strokes', supabase.from('round_members').update({ stroke_override: strokes }).eq('id', memberId), 5000)
    if (res.error) throw res.error
  } catch (e) {
    if (e.message?.includes('timed out')) {
      const { supaRawUpdate: _ru } = await import('../modules/supaRaw')
      await _ru('round_members', `id=eq.${memberId}`, { stroke_override: strokes }, 8000).catch(() => {})
    } else {
      console.warn('[ScoringView] updateMemberStrokes failed:', e)
    }
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
  // Use stroke_override when set — this makes the hole grid react to edits in real-time
  const hcp = member.stroke_override != null ? member.stroke_override : hcpEditorCourseHcp(member)
  return Array.from({ length: numHoles }, (_, i) => {
    const hole = holesMode === '9b' ? i + 10 : i + 1
    const si = holeSI(course, hole, tee)
    return strokesOnHole(hcp, si)
  })
}

function updateMemberStrokesLocal(memberId, rawValue) {
  const strokes = rawValue === '' || rawValue == null ? null : parseInt(rawValue)
  if (strokes !== null && !Number.isFinite(strokes)) return  // ignore partial/invalid input mid-type
  const m = roundsStore.activeMembers.find(x => x.id === memberId)
  if (m) m.stroke_override = strokes
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

// Unique labels computed once for all round members: last name, bumped to F.LastName on collision.
function _memberNameParts(m) {
  let full = (m.guest_name || m.name || '').trim()
  if (!full && m.profile_id) {
    const rp = rosterStore.players?.find(p =>
      (m.nickname && p.nickname === m.nickname) ||
      (m.short_name && p.short_name === m.short_name)
    )
    full = (rp?.name || '').trim()
  }
  const parts = full.split(/\s+/).filter(Boolean)
  return parts.length >= 2 ? parts : (memberDisplay(m) || '?').split(' ').filter(Boolean)
}

function _makeUniqueLabels(members) {
  const pm = new Map(members.map(m => [m.id, _memberNameParts(m)]))
  const L = new Map(members.map(m => {
    const p = pm.get(m.id)
    return [m.id, p.length >= 2 ? p[p.length - 1] : (p[0] || '?')]
  }))
  for (const fmt of [
    p => p.length >= 2 ? `${p[0][0]}.${p[p.length - 1]}` : null,
    p => p.length >= 2 ? `${p[0].slice(0, 2)}.${p[p.length - 1]}` : null,
  ]) {
    const counts = {}
    for (const v of L.values()) counts[v] = (counts[v] || 0) + 1
    for (const [id, v] of L) {
      if (counts[v] > 1) { const n = fmt(pm.get(id)); if (n) L.set(id, n) }
    }
  }
  return L
}

const wolfMemberLabels = computed(() => _makeUniqueLabels(roundsStore.activeMembers))
function fLastName(m) { return m ? (wolfMemberLabels.value.get(m.id) || '?') : '?' }

// Resolve a raw teeOrder entry (may be wizard ID, profile ID, or member ID)
// to a validated activeMembers .id. Falls back to position if all lookups fail.
function _resolveWolfId(rawId, positionIdx) {
  const members = roundsStore.activeMembers
  if (!members.length) return null
  // 1. Direct round_member id
  if (members.some(m => m.id === rawId)) return rawId
  // 2. Profile id (old rounds before ID-remap fix)
  const byProfile = members.find(m => m.profile_id && m.profile_id === rawId)
  if (byProfile) return byProfile.id
  // 3. Position fallback (wizard IDs that weren't remapped)
  return members[positionIdx]?.id ?? null
}

const wolfOnThisHole = computed(() => {
  if (!wolfGame.value) return null
  const members = roundsStore.activeMembers
  if (!members.length) return null
  const configured = wolfGame.value.config?.wolfTeeOrder || []
  const n = members.length
  const wolfIdx = (activeHole.value - 1) % n
  if (configured.length >= n) {
    return _resolveWolfId(configured[wolfIdx], wolfIdx)
  }
  // No tee order set — use member join order
  return members[wolfIdx]?.id ?? null
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

// Wolf team and field derived from current hole choice
const wolfTeamForHole = computed(() => {
  const choice = wolfChoiceForHole.value
  const wolfId = wolfOnThisHole.value
  if (!choice || !wolfId) return null
  const members = roundsStore.activeMembers
  if (choice.partner === 'lone' || choice.partner === 'blind') {
    return {
      mode: choice.partner,
      wolfTeam: members.filter(m => m.id === wolfId),
      field: members.filter(m => m.id !== wolfId),
    }
  }
  const partnerId = choice.partner
  return {
    mode: 'partner',
    wolfTeam: members.filter(m => m.id === wolfId || m.id === partnerId),
    field: members.filter(m => m.id !== wolfId && m.id !== partnerId),
  }
})

// Hole-view player order: rotates with wolf tee order when wolf game is active.
// wolfTeesFirst=true (default) → wolf card first; false → wolf card last.
const holePlayerGroups = computed(() => {
  if (!wolfGame.value) return sortedPlayerGroups.value
  const members = roundsStore.activeMembers
  const n = members.length
  if (!n) return sortedPlayerGroups.value

  const configured = wolfGame.value.config?.wolfTeeOrder || []
  const wolfTeesFirst = wolfGame.value.config?.wolfTeesFirst !== false

  let orderedIds
  if (configured.length >= n) {
    orderedIds = configured.slice(0, n).map((rawId, i) => _resolveWolfId(rawId, i)).filter(Boolean)
  } else {
    orderedIds = members.map(m => m.id)
  }
  if (!orderedIds.length) return sortedPlayerGroups.value

  const wolfIdx = (activeHole.value - 1) % orderedIds.length
  const wolfId = orderedIds[wolfIdx]
  const others = [
    ...orderedIds.slice(wolfIdx + 1),
    ...orderedIds.slice(0, wolfIdx),
  ]
  const displayIds = wolfTeesFirst ? [wolfId, ...others] : [...others, wolfId]

  const groupMap = new Map(sortedPlayerGroups.value.map(g => [g.member.id, g]))
  return displayIds.map(id => groupMap.get(id)).filter(Boolean)
})

const sixesGame = computed(() => roundsStore.activeGames.find(g => g.type?.toLowerCase() === 'sixes') || null)

const sixesCurrentSeg = computed(() => {
  const h = activeHole.value
  return h <= 6 ? 0 : h <= 12 ? 1 : 2
})

const sixesPlayerIds = computed(() => {
  const cfg = sixesGame.value?.config || {}
  const pids = cfg.players || roundsStore.activeMembers.map(m => m.id)
  return pids.slice(0, 4)
})

const sixesTeamA = computed(() => {
  const p = sixesPlayerIds.value
  if (p.length < 4) return p
  const seg = sixesCurrentSeg.value
  return seg === 0 ? [p[0], p[1]] : seg === 1 ? [p[0], p[2]] : [p[0], p[3]]
})

const sixesTeamB = computed(() => {
  const p = sixesPlayerIds.value
  if (p.length < 4) return p
  const seg = sixesCurrentSeg.value
  return seg === 0 ? [p[2], p[3]] : seg === 1 ? [p[1], p[3]] : [p[1], p[2]]
})

const sixesSegmentLabel = computed(() => {
  return ['Holes 1-6', 'Holes 7-12', 'Holes 13-18'][sixesCurrentSeg.value]
})

function sixesMemberName(pid) {
  const m = roundsStore.activeMembers.find(m => m.id === pid)
  return m ? memberDisplay(m) : '?'
}

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

<style src="../styles/ScoringView.css" />

<style>
/* ── ScoringView light theme overrides (non-scoped to beat scoped specificity) ── */
[data-theme="light"] .hole-banner {
  background: linear-gradient(135deg, #0d3325, #166044);
  border-color: rgba(212,175,55,.35);
}
[data-theme="light"] .hole-big-number { color: #f0ede0 !important; }
[data-theme="light"] .hole-course-meta { color: rgba(240,237,224,.7) !important; }

[data-theme="light"] .player-hole-card {
  background: #ffffff !important;
  border-color: rgba(13,95,60,0.15) !important;
}
[data-theme="light"] .card-t1 { background: rgba(96,165,250,.12) !important; border-color: rgba(96,165,250,.4) !important; }
[data-theme="light"] .card-t2 { background: rgba(248,113,113,.12) !important; border-color: rgba(248,113,113,.4) !important; }

[data-theme="light"] .phc-name  { color: #0d1f12 !important; }
[data-theme="light"] .phc-running { color: rgba(13,31,18,.5) !important; }
[data-theme="light"] .muted     { color: rgba(13,31,18,.3) !important; }
[data-theme="light"] .phc-net-label { color: rgba(13,31,18,.4) !important; }
[data-theme="light"] .phc-net-value { color: #0d1f12 !important; }
[data-theme="light"] .phc-init-lowman { color: rgba(37,99,235,.9) !important; }

[data-theme="light"] .hole-game-status {
  background: #f0f7f3 !important;
  border-color: rgba(13,95,60,.2) !important;
}
[data-theme="light"] .hole-gs-header { color: #9a7a1e !important; }
[data-theme="light"] .hole-gs-row {
  color: #0d1f12 !important;
  border-top-color: rgba(13,95,60,.08) !important;
}
[data-theme="light"] .hole-gs-detail { color: rgba(13,31,18,.6) !important; }
[data-theme="light"] .hole-gs-summary { border-top-color: rgba(13,95,60,.08) !important; }

[data-theme="light"] .hole-math-section {
  background: #e8f4ec !important;
  border-color: rgba(13,95,60,.15) !important;
}
[data-theme="light"] .hole-math-line { color: rgba(13,31,18,.75) !important; }
[data-theme="light"] .hole-math-line:not(:first-of-type)::before { color: rgba(13,31,18,.3) !important; }

[data-theme="light"] .hole-nav-btn {
  background: rgba(13,95,60,.08) !important;
  color: #0d3325 !important;
  border-color: rgba(13,95,60,.2) !important;
}
[data-theme="light"] .hole-nav-swipe-hint { color: rgba(13,31,18,.35) !important; }

/* ── Tournament match status rows ── */
.tourn-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--gw-text-primary, #f0ede0);
  border-top: 1px solid rgba(240,237,224,.08);
}
.tourn-stat-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  opacity: .6;
  min-width: 56px;
  flex-shrink: 0;
}
.tourn-stat-matchup {
  font-size: 12px;
  opacity: .8;
}
.tourn-stat-sep {
  opacity: .4;
}
.tourn-stat-val {
  font-size: 13px;
  font-weight: 600;
  margin-left: auto;
}
.tourn-stat-money {
  font-size: 12px;
  font-weight: 700;
  color: #4ade80;
  margin-left: 8px;
  white-space: nowrap;
}
.tourn-wager-pill {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(212,175,55,.12);
  border: 1px solid rgba(212,175,55,.3);
  color: #d4af37;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .3px;
}

/* ── Live games box ── */
[data-theme="light"] .live-games-box {
  background: rgba(22,101,52,.06) !important;
  border-color: rgba(22,101,52,.2) !important;
}
[data-theme="light"] .live-games-label { color: rgba(13,31,18,.55) !important; }

[data-theme="light"] .gs-game-title   { color: #0d1f12 !important; }
[data-theme="light"] .gs-dash         { color: rgba(13,31,18,.3) !important; }
[data-theme="light"] .gs-value-muted  { color: rgba(13,31,18,.5) !important; }
[data-theme="light"] .gs-detail-row   { color: rgba(13,31,18,.7) !important; }
[data-theme="light"] .gs-strokes-line { color: rgba(154,122,30,.85) !important; }
[data-theme="light"] .gs-line         { border-top-color: rgba(13,95,60,.08) !important; }

[data-theme="light"] .live-game-name   { color: #0d1f12 !important; }
[data-theme="light"] .live-game-status { color: rgba(13,31,18,.65) !important; }
[data-theme="light"] .live-game-summary { border-top-color: rgba(13,95,60,.08) !important; }
[data-theme="light"] .live-game-row   { border-top-color: rgba(13,95,60,.06) !important; }
</style>
