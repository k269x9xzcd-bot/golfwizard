<template>
  <div class="players-view">
    <header class="view-header">
      <h2>Players</h2>
      <div class="header-actions">
        <button class="btn-ghost btn-sm sort-btn" @click="toggleSort" :title="sortLabel">⇅ {{ sortLabel }}</button>
        <button class="btn-ghost btn-sm sync-all-btn" @click="syncAllGhin" :disabled="ghinSyncing" title="Sync all handicaps from GHIN">
          <span v-if="ghinSyncing" class="spin">⟳</span>
          <span v-else>⟳</span> HCP
        </button>
        <button class="btn-ghost btn-sm gear-btn" @click="showGearMenu = true" title="Invite & share roster">⚙️</button>
        <button class="btn-ghost btn-sm" @click="showAdd = !showAdd">{{ showAdd ? 'Cancel' : '+ Add' }}</button>
      </div>
    </header>

    <!-- Sync status banner -->
    <div v-if="syncMsg" class="sync-banner" :class="syncMsgType">{{ syncMsg }}</div>

    <!-- Multiple matches modal -->
    <Teleport to="body">
      <div v-if="multipleMatchPlayer" class="match-backdrop" @click.self="advanceMultipleQueue">
        <div class="match-sheet">
          <div class="match-sheet-header">
            <div class="match-sheet-title">Multiple matches</div>
            <div class="match-sheet-sub">
              {{ multipleMatchQueue.length > 1 ? `${multipleMatchQueue.indexOf(multipleMatchPlayer)+1} of ${multipleMatchQueue.length} · ` : '' }}"{{ multipleMatchPlayer.name }}" — tap the correct golfer
            </div>
          </div>
          <div class="match-list">
            <div v-for="m in multipleMatchPlayer.matches" :key="m.ghin_number" class="match-option" @click="selectMatch(multipleMatchPlayer.player_id, m)">
              <div class="match-name">{{ m.full_name }}</div>
              <div class="match-meta">{{ [m.club_name, m.handicap_index != null ? `HCP ${m.handicap_index}` : 'HCP NH', `#${m.ghin_number}`].filter(Boolean).join(' · ') }}</div>
            </div>
          </div>
          <div class="match-sheet-footer">
            <button class="btn-ghost" style="width:100%" @click="advanceMultipleQueue">
              {{ multipleMatchQueue.indexOf(multipleMatchPlayer) < multipleMatchQueue.length - 1 ? 'Skip → next player' : 'Skip' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Invite hint -->
    <div v-if="inviteHint" class="invite-hint-banner">{{ inviteHint }}</div>

    <!-- Gear menu bottom sheet -->
    <Teleport to="body">
      <div v-if="showGearMenu" class="gear-backdrop" @click.self="showGearMenu = false; gearSubMenu = null">
        <div class="gear-sheet">
          <div class="gear-sheet-handle"></div>

          <!-- Main menu -->
          <template v-if="gearSubMenu === null">
            <div class="gear-sheet-title">Players</div>
            <button class="gear-action" @click="gearSubMenu = 'invite'">
              <span class="gear-action-icon">📨</span>
              <div class="gear-action-body">
                <div class="gear-action-label">Invite to GolfWizard</div>
                <div class="gear-action-sub">Send a setup link to a roster player or someone new</div>
              </div>
              <span class="gear-action-arrow">›</span>
            </button>
            <button class="gear-action" @click="gearSubMenu = 'share'">
              <span class="gear-action-icon">📋</span>
              <div class="gear-action-body">
                <div class="gear-action-label">Share my roster</div>
                <div class="gear-action-sub">Send your favorites list to a player so they get everyone loaded</div>
              </div>
              <span class="gear-action-arrow">›</span>
            </button>
            <button class="gear-cancel" @click="showGearMenu = false; gearSubMenu = null">Cancel</button>
          </template>

          <!-- Invite sub-menu: pick from roster or enter new -->
          <template v-else-if="gearSubMenu === 'invite'">
            <div class="gear-sheet-title">
              <button class="gear-back" @click="gearSubMenu = null">←</button>
              Invite to GolfWizard
            </div>
            <div class="gear-sub-hint">Players with an email can receive a setup link</div>
            <div class="gear-player-list">
              <button
                v-for="p in playersWithEmail"
                :key="p.id"
                class="gear-player-row"
                @click="confirmInvite(p); showGearMenu = false"
              >
                <span class="gear-player-avatar">{{ displayInitials(p) }}</span>
                <div class="gear-player-info">
                  <div class="gear-player-name">{{ p.name }}</div>
                  <div class="gear-player-email">{{ p.email }}</div>
                </div>
                <span class="gear-player-send">📨</span>
              </button>
              <div v-if="!playersWithEmail.length" class="gear-empty">No players with email yet. Add emails via the edit button.</div>
            </div>
            <button class="gear-cancel" @click="showGearMenu = false; gearSubMenu = null">Cancel</button>
          </template>

          <!-- Share roster sub-menu: pick recipient -->
          <template v-else-if="gearSubMenu === 'share'">
            <div class="gear-sheet-title">
              <button class="gear-back" @click="gearSubMenu = null">←</button>
              Share my roster
            </div>
            <div class="gear-sub-hint">Recipient gets your {{ favoritePlayers.length }} favorites pre-loaded when they open the app</div>
            <div class="gear-player-list">
              <button
                v-for="p in playersWithEmail"
                :key="p.id"
                class="gear-player-row"
                @click="shareRosterWith(p); showGearMenu = false"
              >
                <span class="gear-player-avatar">{{ displayInitials(p) }}</span>
                <div class="gear-player-info">
                  <div class="gear-player-name">{{ p.name }}</div>
                  <div class="gear-player-email">{{ p.email }}</div>
                </div>
                <span class="gear-player-send">📋</span>
              </button>
              <div v-if="!playersWithEmail.length" class="gear-empty">No players with email yet.</div>
            </div>
            <button class="gear-cancel" @click="showGearMenu = false; gearSubMenu = null">Cancel</button>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- Add form -->
    <div v-if="showAdd" class="add-form card">
      <div class="name-row">
        <input v-model="newFirst" class="wiz-input" placeholder="First name"
          @input="addGhinResults = []; addGhinMsg = ''"
          @keydown.enter="addSearchGhin" />
        <input v-model="newLast" class="wiz-input" placeholder="Last name (required)"
          @input="addGhinResults = []; addGhinMsg = ''"
          @keydown.enter="addSearchGhin" />
      </div>
      <div class="add-ghin-search-row">
        <input v-model="newGhin" class="wiz-input" placeholder="GHIN Index (e.g. 14.2)" type="number" step="0.1" />
        <button class="ghin-lookup-btn" @click="addSearchGhin" :disabled="addGhinSearching" type="button">
          {{ addGhinSearching ? "…" : "🔍 GHIN" }}
        </button>
      </div>
      <!-- GHIN search results -->
      <div v-if="addGhinResults.length" class="ghin-search-results">
        <div class="ghin-search-label">Select the correct golfer:</div>
        <div v-for="r in addGhinResults" :key="r.ghin_number" class="ghin-search-option" @click="applyAddGhinResult(r)">
          <div class="ghin-search-name">{{ r.full_name }} <span v-if="r._source === 'bb'" class="bb-badge">BB</span></div>
          <div class="ghin-search-meta">{{ r.club_name }} · HCP {{ r.handicap_index ?? 'NH' }} · #{{ r.ghin_number }}</div>
        </div>
      </div>
      <div v-if="addGhinMsg" class="ghin-search-msg">{{ addGhinMsg }}</div>
      <input v-model="newNickname" class="wiz-input" placeholder="Nickname (optional)" />
      <input v-model="newEmail" class="wiz-input" placeholder="Email address" type="email" autocomplete="email" />
      <div v-if="!newGhinNumber && newFirst && newLast" class="add-ghin-warning">
        ⚠️ No GHIN linked — handicap won't auto-update. Tap 🔍 GHIN to search.
      </div>
      <div v-if="addError" class="edit-error">{{ addError }}</div>
      <button class="btn-primary btn-sm" :disabled="addingPlayer" @click="add">
        {{ addingPlayer ? 'Adding…' : 'Add Player' }}
      </button>
    </div>

    <!-- You section -->
    <div v-if="myRosterPlayer" class="section-label">You</div>
    <div v-if="myRosterPlayer" class="player-card player-card--you">
      <div class="player-info" @click="openGhinSheet">
        <div class="player-name">
          {{ myRosterPlayer.name }}
          <span class="you-badge">YOU</span>
          <span v-if="myRosterPlayer.ghin_index != null" class="player-hcp">
            ({{ Number(myRosterPlayer.ghin_index).toFixed(1) }}<span class="trend-arrow" v-if="myRosterPlayer.ghin_trend" :class="'trend-' + myRosterPlayer.ghin_trend">{{ myRosterPlayer.ghin_trend === 'up' ? '↑' : myRosterPlayer.ghin_trend === 'down' ? '↓' : '' }}</span><span class="ghin-dot-inline" :class="ghinSyncStatus(myRosterPlayer)" :title="ghinSyncTitle(myRosterPlayer)"></span>)
          </span>
          <span v-if="myRosterPlayer.hard_cap === 'true' || myRosterPlayer.hard_cap === true" class="cap-badge cap-hard" title="Hard Cap applied">HC</span>
          <span v-else-if="myRosterPlayer.soft_cap === 'true' || myRosterPlayer.soft_cap === true" class="cap-badge cap-soft" title="Soft Cap applied">SC</span>
        </div>
      </div>
      <button v-if="myRosterPlayer.ghin_number || authStore.profile?.ghin_number" class="ghin-sheet-btn" @click.stop="openGhinSheet">GHIN</button>
    </div>

    <!-- GHIN score history sheet (logged-in user only) -->
    <Teleport to="body">
      <div v-if="showGhinSheet" class="ghin-sheet-backdrop" @click.self="showGhinSheet = false">
        <div class="ghin-sheet-panel">
          <div class="ghin-sheet-handle"></div>

          <!-- ── Hero header (green gradient) ── -->
          <div class="ghin-hero-header">
            <!-- Close -->
            <button class="ghin-close-btn" @click="showGhinSheet = false">✕</button>

            <!-- Club logo + Name row -->
            <div class="ghin-header-identity">
              <div class="ghin-club-logo-wrap">
                <img v-if="ghinIsBonnieBriar" :src="bbLogo" class="ghin-club-logo" alt="BB" />
                <span v-else class="ghin-club-icon">⛳</span>
              </div>
              <div class="ghin-header-name-block">
                <div class="ghin-header-name">{{ myRosterPlayer?.name }}</div>
                <div class="ghin-header-sub">
                  <span v-if="myRosterPlayer?.ghin_number">GHIN #{{ myRosterPlayer.ghin_number }}</span>
                  <span v-if="myRosterPlayer?.club_name" class="ghin-header-club"> · {{ myRosterPlayer.club_name }}</span>
                </div>
              </div>

              <!-- HI badge top-right -->
              <div class="ghin-hi-badge">
                <div class="ghin-hi-num">{{ ghinLiveHI ?? (myRosterPlayer?.ghin_index != null ? Number(myRosterPlayer.ghin_index).toFixed(1) : '—') }}</div>
                <div class="ghin-hi-label">
                  HI
                  <span v-if="ghinScoresFetched" class="ghin-hi-trend" :class="'trend-' + ghinComputedTrend">
                    {{ ghinComputedTrend === 'improving' ? '↓' : ghinComputedTrend === 'declining' ? '↑' : '→' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Sparkline (last 10 differentials) -->
            <div v-if="ghinSparkBars.length" class="ghin-spark-row">
              <div class="ghin-spark-label">Last {{ ghinSparkBars.length }} rounds</div>
              <div class="ghin-spark-bars">
                <div
                  v-for="(bar, i) in ghinSparkBars"
                  :key="i"
                  class="ghin-spark-bar"
                  :class="{ 'ghin-spark-bar--latest': bar.isLatest }"
                  :style="{ height: bar.pct + '%' }"
                ></div>
                <div v-if="sparkAvgPct != null" class="ghin-spark-avg-line" :style="{ bottom: sparkAvgPct + '%' }"></div>
              </div>
            </div>
          </div>

          <!-- ── Stats pills row ── -->
          <div class="ghin-stats-grid">
            <div class="ghin-stat">
              <div class="ghin-stat-label">Low HI</div>
              <div class="ghin-stat-val">{{ ghinLiveLowHI ?? (myRosterPlayer?.ghin_low_hi != null ? Number(myRosterPlayer.ghin_low_hi).toFixed(1) : '—') }}</div>
              <div class="ghin-stat-sub">career low</div>
            </div>
            <div class="ghin-stat">
              <div class="ghin-stat-label">Posted</div>
              <div class="ghin-stat-val">{{ ghinScoresPosted ?? myRosterPlayer?.ghin_scores_posted ?? '—' }}</div>
              <div class="ghin-stat-sub">total rounds</div>
            </div>
            <div class="ghin-stat">
              <div class="ghin-stat-label">Avg Score</div>
              <div class="ghin-stat-val">{{ ghinScoreStats?.average != null ? Number(ghinScoreStats.average).toFixed(1) : '—' }}</div>
              <div class="ghin-stat-sub">last 20</div>
            </div>
            <div class="ghin-stat">
              <div class="ghin-stat-label">Used / Total</div>
              <div class="ghin-stat-val" style="font-size:15px;">{{ ghinScores.filter(s => s.used_for_hi).length }}<span style="font-size:11px;color:var(--gw-text-muted)">/{{ ghinScores.length || (myRosterPlayer?.ghin_scores_posted ?? '—') }}</span></div>
              <div class="ghin-stat-sub">HI rounds</div>
            </div>
          </div>

          <!-- ── Scoring bar (birdie/par/bogey) ── -->
          <div v-if="ghinScoreStats?.avg_birdie_pct != null" class="ghin-scoring-section">
            <div class="ghin-scoring-labels">
              <span class="ghin-scoring-lbl" style="color:var(--gw-birdie)">{{ Math.round((ghinScoreStats.avg_birdie_pct ?? 0) * 100) }}% Birdie</span>
              <span class="ghin-scoring-lbl">{{ Math.round((ghinScoreStats.avg_par_pct ?? 0) * 100) }}% Par</span>
              <span class="ghin-scoring-lbl" style="color:#f87171">{{ Math.round(((ghinScoreStats.avg_bogey_pct ?? 0) + (ghinScoreStats.avg_double_pct ?? 0) + (ghinScoreStats.avg_worse_pct ?? 0)) * 100) }}% Bogey+</span>
              <span class="ghin-scoring-lbl" style="color:var(--gw-text-muted)">{{ Math.round((ghinScoreStats.avg_gir_pct ?? 0) * 100) }}% GIR</span>
            </div>
            <div class="ghin-scoring-bar-wrap">
              <div class="ghin-scoring-bar">
                <div class="ghin-bar-seg ghin-bar-seg--birdie" :style="{ width: Math.round((ghinScoreStats.avg_birdie_pct ?? 0) * 100) + '%' }">
                  <div class="ghin-bar-gloss"></div>
                </div>
                <div class="ghin-bar-seg ghin-bar-seg--par" :style="{ width: Math.round((ghinScoreStats.avg_par_pct ?? 0) * 100) + '%' }">
                  <div class="ghin-bar-gloss"></div>
                </div>
                <div class="ghin-bar-seg ghin-bar-seg--bogey" :style="{ width: Math.round((ghinScoreStats.avg_bogey_pct ?? 0) * 100) + '%' }">
                  <div class="ghin-bar-gloss"></div>
                </div>
                <div class="ghin-bar-seg ghin-bar-seg--double" :style="{ width: Math.round(((ghinScoreStats.avg_double_pct ?? 0) + (ghinScoreStats.avg_worse_pct ?? 0)) * 100) + '%' }">
                  <div class="ghin-bar-gloss"></div>
                </div>
                <div class="ghin-bar-overlay"></div>
              </div>
            </div>

            <!-- Par 3/4/5 averages -->
            <div class="ghin-par-grid">
              <div class="ghin-par-cell">
                <div class="ghin-par-val">{{ ghinScoreStats.avg_par3 != null ? Number(ghinScoreStats.avg_par3).toFixed(2) : '—' }}</div>
                <div class="ghin-par-label">Par 3</div>
              </div>
              <div class="ghin-par-divider"></div>
              <div class="ghin-par-cell">
                <div class="ghin-par-val">{{ ghinScoreStats.avg_par4 != null ? Number(ghinScoreStats.avg_par4).toFixed(2) : '—' }}</div>
                <div class="ghin-par-label">Par 4</div>
              </div>
              <div class="ghin-par-divider"></div>
              <div class="ghin-par-cell">
                <div class="ghin-par-val">{{ ghinScoreStats.avg_par5 != null ? Number(ghinScoreStats.avg_par5).toFixed(2) : '—' }}</div>
                <div class="ghin-par-label">Par 5</div>
              </div>
            </div>
          </div>

          <!-- ── Score range strip ── -->
          <div v-if="ghinScoreStats" class="ghin-range-strip">
            <div class="ghin-range-item">
              <span class="ghin-range-label">Low</span>
              <span class="ghin-range-val ghin-range-val--low">{{ ghinScoreStats.lowest_score }}</span>
            </div>
            <div class="ghin-range-divider"></div>
            <div class="ghin-range-item">
              <span class="ghin-range-label">High</span>
              <span class="ghin-range-val ghin-range-val--high">{{ ghinScoreStats.highest_score }}</span>
            </div>
            <div class="ghin-range-divider"></div>
            <div class="ghin-range-item">
              <span class="ghin-range-label">Trend</span>
              <span class="ghin-range-val" :class="'trend-' + ghinComputedTrend">
                {{ ghinComputedTrend === 'improving' ? '↓ Impr' : ghinComputedTrend === 'declining' ? '↑ Rising' : '→ Stable' }}
              </span>
            </div>
          </div>

          <!-- ── Cap badges ── -->
          <div v-if="myRosterPlayer?.soft_cap === 'true' || myRosterPlayer?.hard_cap === 'true'" class="ghin-cap-row">
            <div v-if="myRosterPlayer?.hard_cap === 'true'" class="ghin-cap-badge ghin-cap-badge--hard">⚠ Hard Cap Applied</div>
            <div v-else-if="myRosterPlayer?.soft_cap === 'true'" class="ghin-cap-badge ghin-cap-badge--soft">Soft Cap Applied</div>
          </div>

          <!-- ── Score history ── -->
          <div class="ghin-history-section">
            <div class="ghin-history-header">
              <span class="ghin-history-title">Score History</span>
              <button class="ghin-refresh-btn" @click="fetchGhinScores" :disabled="ghinScoresLoading" title="Refresh">
                <span :class="{ spin: ghinScoresLoading }">⟳</span>
              </button>
            </div>

            <!-- No credentials -->
            <div v-if="!authStore.profile?.ghin_password" class="ghin-no-creds">
              <div class="ghin-scores-note">GHIN login required</div>
              <div class="ghin-scores-sub">Add your GHIN password in Settings → Profile to load score history.</div>
              <button class="btn-ghost btn-sm" style="margin-top:10px;" @click="showGhinSheet = false; $router.push('/settings')">Go to Settings →</button>
            </div>

            <!-- Loading -->
            <div v-else-if="ghinScoresLoading" class="ghin-scores-loading">
              <span class="spin" style="font-size:22px;">⟳</span>
              <span style="margin-left:8px;color:var(--gw-text-muted)">Loading scores…</span>
            </div>

            <!-- Error -->
            <div v-else-if="ghinScoresError" class="ghin-scores-error">{{ ghinScoresError }}</div>

            <!-- Scores list -->
            <div v-else-if="ghinScores.length" class="ghin-scores-list">
              <div class="ghin-scores-cols">
                <span>Date</span>
                <span>Course / Tee</span>
                <span class="col-center">Gross</span>
                <span class="col-center">Net</span>
                <span class="col-right">Diff</span>
              </div>
              <div
                v-for="(s, i) in ghinScores"
                :key="i"
                class="ghin-score-row"
                :class="{ 'ghin-score-row--used': s.used_for_hi }"
              >
                <span class="score-date">{{ formatScoreDate(s.date) }}</span>
                <span class="score-course-wrap">
                  <span class="score-course" :title="s.course_name">{{ s.course_name }}</span>
                  <span class="score-tee" v-if="s.tee_name">{{ s.tee_name }}</span>
                </span>
                <span class="score-ags col-center">{{ s.adjusted_gross_score ?? '—' }}</span>
                <span class="score-net col-center">{{ s.net_score ?? '—' }}</span>
                <span class="score-diff col-right" :class="s.used_for_hi ? 'diff-used' : ''">
                  <span v-if="s.used_for_hi" class="hi-star" title="Used for HI">★</span>{{ s.differential != null ? Number(s.differential).toFixed(1) : '—' }}
                </span>
              </div>
              <div class="ghin-scores-legend">
                <span class="hi-star" style="font-size:11px;">★</span>
                Used for HI calculation ({{ ghinScores.filter(s => s.used_for_hi).length }} of {{ ghinScores.length }})
              </div>
            </div>

            <!-- Empty after fetch -->
            <div v-else-if="ghinScoresFetched" class="ghin-scores-empty">No scores found</div>

            <!-- Prompt to load -->
            <div v-else class="ghin-scores-prompt">
              <button class="btn-primary btn-sm" @click="fetchGhinScores">Load Score History</button>
            </div>
          </div>

          <div style="height:32px;"></div>
        </div>
      </div>
    </Teleport>

    <!-- Public player GHIN sheet -->
    <Teleport to="body">
      <div v-if="playerSheetTarget" class="ghin-sheet-backdrop" @click.self="playerSheetTarget = null">
        <div class="ghin-sheet-panel">
          <div class="ghin-sheet-handle"></div>
          <div class="ghin-sheet-top">
            <div>
              <div class="ghin-sheet-name">{{ playerSheetTarget.name }}</div>
              <div class="ghin-sheet-meta">
                <span v-if="playerSheetTarget.ghin_number">GHIN #{{ playerSheetTarget.ghin_number }}</span>
                <span v-if="playerSheetTarget.club_name"> · {{ playerSheetTarget.club_name }}</span>
              </div>
            </div>
            <button class="close-btn" @click="playerSheetTarget = null">✕</button>
          </div>
          <div class="ghin-stats-grid">
            <div class="ghin-stat">
              <div class="ghin-stat-label">Index</div>
              <div class="ghin-stat-val">{{ playerSheetTarget.ghin_index != null ? Number(playerSheetTarget.ghin_index).toFixed(1) : '—' }}</div>
              <div class="ghin-stat-sub">current</div>
            </div>
            <div class="ghin-stat">
              <div class="ghin-stat-label">Low HI</div>
              <div class="ghin-stat-val">{{ playerSheetTarget.low_hi != null ? Number(playerSheetTarget.low_hi).toFixed(1) : '—' }}</div>
              <div class="ghin-stat-sub">season low</div>
            </div>
            <div class="ghin-stat">
              <div class="ghin-stat-label">Cap</div>
              <div class="ghin-stat-val ghin-stat-val--sm">
                <span v-if="playerSheetTarget.hard_cap === 'true' || playerSheetTarget.hard_cap === true" class="cap-badge cap-hard">Hard</span>
                <span v-else-if="playerSheetTarget.soft_cap === 'true' || playerSheetTarget.soft_cap === true" class="cap-badge cap-soft">Soft</span>
                <span v-else class="cap-badge cap-none">None</span>
              </div>
              <div class="ghin-stat-sub">cap status</div>
            </div>
          </div>
          <div class="ghin-player-sheet-note">
            <div class="ghin-sync-row">
              <span class="ghin-dot-inline" :class="ghinSyncStatus(playerSheetTarget)"></span>
              Synced {{ playerSheetTarget.ghin_synced_at ? ghinSyncDate(playerSheetTarget) : 'never' }}
            </div>
            <div class="ghin-public-note">Score history is only available for your own account via GHIN credentials.</div>
          </div>
          <div style="height:40px;"></div>
        </div>
      </div>
    </Teleport>

    <!-- Favorites section -->
    <div v-if="favoritePlayers.length" class="section-label">
      Favorites <span class="swipe-hint">← delete &nbsp;·&nbsp; unfav →</span>
    </div>
    <div v-for="p in favoritePlayers" :key="p.id" class="swipe-container" :style="swipeContainerStyle(p.id)">
      <div class="swipe-reveal swipe-reveal-left" :style="{ opacity: swipeRevealOpacity(p.id, 'left') }">🗑 Delete</div>
      <div class="swipe-reveal swipe-reveal-right" :style="{ opacity: swipeRevealOpacity(p.id, 'right') }">☆ Unfav</div>
      <div
        class="player-card player-card--fav"
        :style="{ ...swipeCardStyle(p.id), transition: swiping === p.id ? 'none' : 'transform .25s ease, background .1s ease, border-color .1s ease' }"
        @touchstart="onSwipeStart($event, p.id)"
        @touchmove="onSwipeMove($event, p.id)"
        @touchend="onSwipeEnd($event, p)"
      >
        <div class="player-info" @click="startEdit(p)">
          <div class="player-name">
            {{ p.name }}
            <span v-if="p.ghin_index != null" class="player-hcp">
              ({{ Number(p.ghin_index).toFixed(1) }}<span class="trend-arrow" v-if="p.ghin_trend" :class="'trend-' + p.ghin_trend">{{ p.ghin_trend === 'up' ? '↑' : p.ghin_trend === 'down' ? '↓' : '' }}</span><span class="ghin-dot-inline" :class="ghinSyncStatus(p)" :title="ghinSyncTitle(p)"></span>)
            </span>
            <span v-if="p.hard_cap === 'true' || p.hard_cap === true" class="cap-badge cap-hard" title="Hard Cap applied">HC</span>
            <span v-else-if="p.soft_cap === 'true' || p.soft_cap === true" class="cap-badge cap-soft" title="Soft Cap applied">SC</span>
          </div>
          <div class="player-meta">
            <span v-if="p.user_id" class="invite-status invite-status--joined" title="Has account">● In app</span>
            <span v-else-if="inviteStatus[p.id] === 'sending'" class="invite-status invite-status--sending">Sending…</span>
            <span v-else-if="inviteStatus[p.id] === 'sent' || p.invited_at" class="invite-status invite-status--sent" title="Invite sent">✉ Invited</span>
            <span v-else-if="p.email" class="invite-status invite-status--pending" title="Not yet invited">Not invited</span>
          </div>
        </div>
        <button v-if="p.email && !p.user_id" class="invite-btn" @click.stop="confirmInvite(p)" :disabled="inviteStatus[p.id] === 'sending'" title="Send app invite">
          {{ inviteStatus[p.id] === 'sending' ? '…' : p.invited_at ? 'Resend' : 'Invite' }}
        </button>
        <button v-else-if="p.ghin_number" class="player-info-btn" @click.stop="openPlayerSheet(p)" title="GHIN info">⛳</button>

        <span class="player-fav-star">★</span>
      </div>
    </div>

    <!-- All players section -->
    <div v-if="otherPlayers.length" class="section-label">
      All Players <span class="swipe-hint">← delete &nbsp;·&nbsp; favorite →</span>
    </div>
    <div v-for="p in otherPlayers" :key="p.id" class="swipe-container" :style="swipeContainerStyle(p.id)">
      <div class="swipe-reveal swipe-reveal-left" :style="{ opacity: swipeRevealOpacity(p.id, 'left') }">🗑 Delete</div>
      <div class="swipe-reveal swipe-reveal-right" :style="{ opacity: swipeRevealOpacity(p.id, 'right') }">★ Fav</div>
      <div
        class="player-card"
        :style="{ ...swipeCardStyle(p.id), transition: swiping === p.id ? 'none' : 'transform .25s ease, background .1s ease, border-color .1s ease' }"
        @touchstart="onSwipeStart($event, p.id)"
        @touchmove="onSwipeMove($event, p.id)"
        @touchend="onSwipeEnd($event, p)"
      >
        <div class="player-info" @click="startEdit(p)">
          <div class="player-name">
            {{ p.name }}
            <span v-if="p.ghin_index != null" class="player-hcp">
              ({{ Number(p.ghin_index).toFixed(1) }}<span class="trend-arrow" v-if="p.ghin_trend" :class="'trend-' + p.ghin_trend">{{ p.ghin_trend === 'up' ? '↑' : p.ghin_trend === 'down' ? '↓' : '' }}</span><span class="ghin-dot-inline" :class="ghinSyncStatus(p)" :title="ghinSyncTitle(p)"></span>)
            </span>
            <span v-if="p.hard_cap === 'true' || p.hard_cap === true" class="cap-badge cap-hard" title="Hard Cap applied">HC</span>
            <span v-else-if="p.soft_cap === 'true' || p.soft_cap === true" class="cap-badge cap-soft" title="Soft Cap applied">SC</span>
          </div>
          <div class="player-meta">
            <span v-if="p.user_id" class="invite-status invite-status--joined" title="Has account">● In app</span>
            <span v-else-if="inviteStatus[p.id] === 'sending'" class="invite-status invite-status--sending">Sending…</span>
            <span v-else-if="inviteStatus[p.id] === 'sent' || p.invited_at" class="invite-status invite-status--sent" title="Invite sent">✉ Invited</span>
            <span v-else-if="p.email" class="invite-status invite-status--pending" title="Not yet invited">Not invited</span>
          </div>
        </div>
        <button v-if="p.email && !p.user_id" class="invite-btn" @click.stop="confirmInvite(p)" :disabled="inviteStatus[p.id] === 'sending'" title="Send app invite">
          {{ inviteStatus[p.id] === 'sending' ? '…' : p.invited_at ? 'Resend' : 'Invite' }}
        </button>
        <button v-else-if="p.ghin_number" class="player-info-btn" @click.stop="openPlayerSheet(p)" title="GHIN info">⛳</button>

      </div>
    </div>

    <div v-if="rosterStore.players.length === 0" class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-text">No players yet — tap + Add above</div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <transition name="toast">
        <div v-if="toastMsg" class="swipe-toast" :class="toastType">{{ toastMsg }}</div>
      </transition>
    </Teleport>

    <!-- Invite confirmation modal -->
    <Teleport to="body">
      <div v-if="pendingInvitePlayer" class="delete-backdrop" @click.self="pendingInvitePlayer = null">
        <div class="delete-modal">
          <div class="delete-header">Send Invite?</div>
          <div class="delete-message">Send a GolfWizard setup link to <strong>{{ pendingInvitePlayer.name }}</strong> at <strong>{{ pendingInvitePlayer.email }}</strong>?</div>
          <div class="delete-footer">
            <button class="btn-ghost" @click="pendingInvitePlayer = null">Cancel</button>
            <button class="btn-primary" @click="invitePlayer(pendingInvitePlayer); pendingInvitePlayer = null">Send Invite</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="deleteConfirmId" class="delete-backdrop" @click.self="deleteConfirmId = null">
        <div class="delete-modal">
          <div class="delete-header">Delete Player?</div>
          <div class="delete-message">Are you sure you want to delete <strong>{{ deleteConfirmName }}</strong>? This cannot be undone.</div>
          <div class="delete-footer">
            <button class="btn-ghost" @click="deleteConfirmId = null">Cancel</button>
            <button class="btn-danger" @click="performDelete">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit overlay -->
    <Teleport to="body">
      <div v-if="editTarget" class="edit-backdrop" @click.self="editTarget = null">
        <div class="edit-sheet">
          <div class="edit-header">
            <span class="edit-title">Edit Player</span>
            <button class="close-btn" @click="editTarget = null">✕</button>
          </div>
          <div class="name-row">
            <input v-model="editFirst" class="wiz-input" placeholder="First name" />
            <input v-model="editLast" class="wiz-input" placeholder="Last name" />
          </div>
          <input v-model="editGhin" class="wiz-input" placeholder="GHIN Index (e.g. 12.4)" type="text" inputmode="decimal" />
          <div v-if="editTarget?.club_name" class="edit-club-row">
            <img
              v-if="editTarget.club_name.toLowerCase().includes('bonnie briar')"
              src="../assets/bonnie-briar-logo.png"
              class="edit-club-logo"
              alt=""
            />
            <span v-else class="edit-club-icon">⛳</span>
            <span class="edit-club-name">{{ editTarget.club_name }}</span>
          </div>
          <div class="ghin-number-row">
            <input v-model="editGhinNumber" class="wiz-input" placeholder="GHIN # (e.g. 1321498)" type="text" inputmode="numeric" style="flex:1" />
            <button class="ghin-lookup-btn" @click="searchGhinForEdit" :disabled="ghinSearching" type="button">
              {{ ghinSearching ? '…' : '🔍 GHIN' }}
            </button>
          </div>
          <!-- First-name prefix hint for ambiguous names -->
          <div class="ghin-prefix-row">
            <input v-model="editGhinPrefix" class="wiz-input ghin-prefix-input" placeholder="Narrow by first name (e.g. &quot;Br&quot; for Brian)" />
          </div>
          <!-- In-app GHIN search results -->
          <div v-if="ghinSearchResults.length" class="ghin-search-results">
            <div class="ghin-search-label">Select the correct golfer:</div>
            <div v-for="r in ghinSearchResults" :key="r.ghin_number" class="ghin-search-option" @click="applyGhinResult(r)">
              <div class="ghin-search-name">{{ r.full_name }} <span v-if="r._source === 'bb'" class="bb-badge">BB</span></div>
              <div class="ghin-search-meta">{{ r.club_name }} · HCP {{ r.handicap_index ?? 'NH' }} · #{{ r.ghin_number }}</div>
            </div>
          </div>
          <div v-if="ghinSearchMsg" class="ghin-search-msg">{{ ghinSearchMsg }}</div>
          <div class="edit-nickname-row">
            <input v-model="editNickname" class="wiz-input" placeholder="Nickname (e.g. Spiels)" style="flex:1" />
            <label class="nick-toggle-label">
              <input type="checkbox" v-model="editUseNickname" class="nick-toggle-cb" />
              <span class="nick-toggle-text">Use nickname</span>
            </label>
          </div>
          <input v-model="editEmail" class="wiz-input" placeholder="Email address" type="email" autocomplete="email" />
          <div v-if="editError" class="edit-error">{{ editError }}</div>
          <div class="edit-footer">
            <button class="btn-ghost" :disabled="editSaving" @click="editTarget = null">Cancel</button>
            <button class="btn-primary" :disabled="editSaving" @click="saveEdit">
              {{ editSaving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, reactive, nextTick } from 'vue'
import { useRosterStore, displayInitials } from '../stores/roster'
import { buildInviteUrl, buildInviteEmail } from '../modules/preset'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../supabase'
import bbLogo from '../assets/bonnie-briar-logo.png'
import { supaCall } from '../modules/supabaseOps'
import { supaRawEdgeFunction } from '../modules/supaRaw'

const rosterStore = useRosterStore()
const authStore = useAuthStore()

// ── GHIN sync dot helpers ────────────────────────────────────────
function ghinSyncStatus(p) {
  if (!p.ghin_synced_at) return 'dot-none'
  const hoursAgo = (Date.now() - new Date(p.ghin_synced_at).getTime()) / (1000 * 60 * 60)
  if (hoursAgo < 26) return 'dot-blue'
  if (hoursAgo < 72) return 'dot-red'
  return 'dot-none'
}

function ghinSyncTitle(p) {
  if (!p.ghin_synced_at) return 'Not synced'
  const hoursAgo = Math.round((Date.now() - new Date(p.ghin_synced_at).getTime()) / (1000 * 60 * 60))
  if (hoursAgo < 2) return 'Synced just now'
  if (hoursAgo < 26) return `Synced ${hoursAgo}h ago`
  const days = Math.round(hoursAgo / 24)
  return `Last synced ${days} day${days > 1 ? 's' : ''} ago`
}

// ── Sync All GHIN ────────────────────────────────────────────────
const ghinSyncing = ref(false)
const syncMsg = ref('')
const syncMsgType = ref('success')
const multipleMatchPlayer = ref(null)
const multipleMatchQueue = ref([])

async function syncAllGhin() {
  if (ghinSyncing.value) return
  ghinSyncing.value = true
  syncMsg.value = 'Syncing handicaps…'
  syncMsgType.value = 'info'

  try {
    // ── Step 1: fresh roster read via fetchPlayers (supaRaw-first inside) ────
    // fetchPlayers() now tries supaRaw before SJS, clearing stale localStorage
    // caches via the CACHE_VER eviction. This is what actually updates the
    // displayed handicap values from Supabase.
    await rosterStore.fetchPlayers().catch(() => {})

    // ── Step 2: query bb_member_index for BB-member updates ───────────────
    // Wrapped in supaCall so it never hangs on iOS WKWebView zombie socket.
    let bbMap = {}
    try {
      const { supaCall } = await import('../modules/supabaseOps')
      const bbRes = await supaCall(
        'bb_member_index.select',
        supabase
          .from('bb_member_index')
          .select('ghin_number, handicap_index, updated_at')
          .not('ghin_number', 'is', null),
        8000,
      )
      if (!bbRes.error) {
        for (const m of bbRes.data || []) {
          bbMap[m.ghin_number] = m
        }
      }
    } catch {
      // bb_member_index unavailable — BB sync skipped, roster display already refreshed
    }

    let updated = 0
    let notFound = 0
    const updatePromises = []

    for (const player of rosterStore.players) {
      if (!player.ghin_number) continue
      const bb = bbMap[player.ghin_number]
      if (bb?.handicap_index != null) {
        updatePromises.push(
          rosterStore.updatePlayer(player.id, {
            ghin_index: bb.handicap_index,
            ghin_synced_at: bb.updated_at,
          })
        )
        updated++
      } else {
        notFound++
      }
    }
    await Promise.all(updatePromises)

    // Show a useful message based on what actually happened
    const withGhin = rosterStore.players.filter(
      p => p.ghin_number && !(authStore.isAuthenticated && String(p.id).startsWith('default_'))
    ).length

    if (withGhin === 0) {
      syncMsg.value = '✓ Roster refreshed from server'
    } else if (updated > 0) {
      const parts = [`✓ ${updated} updated from BB`]
      if (notFound) parts.push(`${notFound} not in BB`)
      syncMsg.value = parts.join(', ')
    } else {
      syncMsg.value = `✓ Roster refreshed · ${notFound} not in BB roster`
    }
    syncMsgType.value = 'success'
    setTimeout(() => { syncMsg.value = '' }, 4000)
  } catch (e) {
    syncMsg.value = `Sync failed: ${e?.message || e}`
    syncMsgType.value = 'error'
    setTimeout(() => { syncMsg.value = '' }, 5000)
  } finally {
    ghinSyncing.value = false
  }
}

function advanceMultipleQueue() {
  const queue = multipleMatchQueue.value
  const current = multipleMatchPlayer.value
  const idx = queue.indexOf(current)
  if (idx >= 0 && idx < queue.length - 1) {
    multipleMatchPlayer.value = queue[idx + 1]
  } else {
    multipleMatchPlayer.value = null
    multipleMatchQueue.value = []
  }
}

async function selectMatch(playerId, golfer) {
  const today = new Date().toISOString()
  await rosterStore.updatePlayer(playerId, {
    ghin_index: golfer.handicap_index,
    ghin_number: golfer.ghin_number,
    ghin_synced_at: today,
    low_hi: golfer.low_hi || undefined,
    club_name: golfer.club_name || undefined,
  })
  showToast(`Updated ${golfer.full_name}`, 'gold')
  advanceMultipleQueue()
}

// ── Invite ───────────────────────────────────────────────────────
const inviteHint = ref('')
const pendingInvitePlayer = ref(null)  // player awaiting invite confirmation
const showGearMenu = ref(false)
const gearSubMenu = ref(null)  // null | 'invite' | 'share'

const playersWithEmail = computed(() =>
  rosterStore.players.filter(p => p.email).sort((a, b) => a.name.localeCompare(b.name))
)

// Track per-player invite state: 'sending' | 'sent' | 'joined' | 'error'
const inviteStatus = ref({})  // { [roster_player_id]: status }

function confirmInvite(player) {
  pendingInvitePlayer.value = player
}

async function invitePlayer(player) {
  if (!player.email) return
  if (player.user_id) {
    showInviteHint(`${player.name.split(' ')[0]} already has an account`)
    return
  }
  inviteStatus.value[player.id] = 'sending'
  try {
    const { data, error } = await supabase.functions.invoke('invite-player', {
      body: { roster_player_id: player.id },
    })
    if (error) throw error
    if (data?.already_joined || data?.already_registered) {
      inviteStatus.value[player.id] = 'joined'
      showInviteHint(`${player.name.split(' ')[0]} already has an account — they can sign in directly`)
      return
    }
    inviteStatus.value[player.id] = 'sent'
    // Stamp invited_at locally so UI updates without refetch
    await rosterStore.updatePlayer(player.id, { invited_at: new Date().toISOString() })
    showInviteHint(`Invite sent to ${player.name.split(' ')[0]}!`)
  } catch (e) {
    inviteStatus.value[player.id] = 'error'
    showInviteHint(`Failed to invite ${player.name.split(' ')[0]}: ${e?.message ?? 'unknown error'}`)
  }
}

async function shareGroupInvite() {
  const url = buildInviteUrl()
  const senderName = authStore.profile?.display_name?.split(' ')[0] || 'Jason'
  const text = `${senderName} invited you to GolfWizard — golf scoring with handicaps, Nassau, Skins, and more. Open this link to get started with our group already loaded:\n${url}`
  if (navigator.share) {
    try { await navigator.share({ title: 'Join GolfWizard', text, url }) } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(url)
      showInviteHint('Invite link copied to clipboard!')
    } catch {
      showInviteHint(`Share this link: ${url}`)
    }
  }
}

function shareRosterWith(recipient) {
  if (!recipient.email) return
  const senderName = authStore.profile?.display_name?.split(' ')[0] || 'Me'
  const favorites = rosterStore.players.filter(p => p.is_favorite)
  const rosterLines = favorites
    .map(p => `• ${p.name}${p.ghin_index != null ? ' (' + Number(p.ghin_index).toFixed(1) + ')' : ''}`)
    .join('\n')

  // Build invite URL — preset encodes Jason's roster for new users
  const url = buildInviteUrl(recipient.email || '', '', '', '', '')

  const first = recipient.name.split(' ')[0]
  const subject = `${senderName} shared their GolfWizard roster with you`
  const body = [
    `Hey ${first},`,
    '',
    `I shared my GolfWizard player list with you (${favorites.length} players). When you open the link below and sign in, they'll all be in your roster:`,
    '',
    url,
    '',
    `Here's who's included:`,
    rosterLines,
    '',
    `See you on the course,`,
    senderName,
  ].join('\n')

  window.open(`mailto:${encodeURIComponent(recipient.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
  showInviteHint(`Roster shared with ${first}!`)
}

function showInviteHint(msg) {
  inviteHint.value = msg
  setTimeout(() => { inviteHint.value = '' }, 3000)
}

// ── Add player ───────────────────────────────────────────────────
const showAdd = ref(false)
const newFirst = ref('')
const newLast = ref('')
const newGhin = ref('')
const newNickname = ref('')
const newEmail = ref('')
const addError = ref('')
const addingPlayer = ref(false)

const addGhinSearching = ref(false)
const addGhinResults = ref([])
const addGhinMsg = ref('')
const newGhinNumber = ref(null)
const newClubName = ref(null)
const sortMode = ref('name')
const sortLabel = computed(() => sortMode.value === 'name' ? 'A–Z' : 'Added')

function toggleSort() {
  sortMode.value = sortMode.value === 'name' ? 'added' : 'name'
}

function sortByLastName(arr) {
  if (sortMode.value !== 'name') return arr
  return [...arr].sort((a, b) => {
    const lastName = n => { const parts = (n.name || '').trim().split(' '); return (parts[parts.length - 1] || '').toLowerCase() }
    return lastName(a).localeCompare(lastName(b))
  })
}

const favoritePlayers = computed(() => sortByLastName(rosterStore.players.filter(p => p.is_favorite)))
const otherPlayers = computed(() => sortByLastName(rosterStore.players.filter(p => !p.is_favorite)))

// ── You section + GHIN sheet (logged-in user only) ──────────────
const showGhinSheet = ref(false)
const ghinScores = ref([])
const ghinScoresLoading = ref(false)
const ghinScoresFetched = ref(false)
const ghinScoresError = ref('')
const ghinScoresPosted = ref(null)
const ghinScoreStats = ref(null)
const playerSheetTarget = ref(null)
function openPlayerSheet(p) { playerSheetTarget.value = p }
const ghinLiveHI = ref(null)
const ghinLiveLowHI = ref(null)

// Compute trend from differentials: lower = improving = 'down' (good in golf)
const ghinComputedTrend = computed(() => {
  const scores = ghinScores.value
  if (!scores || scores.length < 4) return 'neutral'
  const recent = scores.slice(0, 3).map(s => s.differential).filter(d => d != null)
  const older  = scores.slice(3, 6).map(s => s.differential).filter(d => d != null)
  if (!recent.length || !older.length) return 'neutral'
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
  const avgOlder  = older.reduce((a, b) => a + b, 0) / older.length
  if (avgRecent < avgOlder - 0.3) return 'improving'
  if (avgRecent > avgOlder + 0.3) return 'declining'
  return 'neutral'
})

// Sparkline bars from last 10 score differentials
const ghinSparkBars = computed(() => {
  const s = ghinScores.value.slice(0, 10).reverse()
  if (s.length < 2) return []
  const diffs = s.map(r => r.differential ?? 0)
  const mn = Math.min(...diffs)
  const mx = Math.max(...diffs)
  const range = mx - mn || 1
  return diffs.map((d, i) => ({
    pct: 20 + ((d - mn) / range) * 75,
    isLatest: i === diffs.length - 1
  }))
})

const sparkAvgPct = computed(() => {
  const s = ghinScores.value.slice(0, 10).reverse()
  if (s.length < 2) return null
  const diffs = s.map(r => r.differential ?? 0)
  const mn = Math.min(...diffs)
  const mx = Math.max(...diffs)
  const range = mx - mn || 1
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
  // Same scale as bars: 20–95% height range. Convert to bottom% for absolute positioning.
  return 20 + ((avg - mn) / range) * 75
})

const ghinIsBonnieBriar = computed(() =>
  myRosterPlayer.value?.club_name?.toLowerCase().includes('bonnie briar') ?? false
)

const myRosterPlayer = computed(() => {
  const profile = authStore.profile
  if (!profile) return null
  const name = profile.display_name || ''
  const ghinNum = profile.ghin_number
  return rosterStore.players.find(p =>
    (ghinNum && p.ghin_number && String(p.ghin_number) === String(ghinNum)) ||
    (name && p.name?.toLowerCase() === name.toLowerCase())
  ) || null
})

function ghinSyncDate(p) {
  if (!p.ghin_synced_at) return '—'
  const d = new Date(p.ghin_synced_at)
  const now = new Date()
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatScoreDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr.slice(0, 10)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function openGhinSheet() {
  showGhinSheet.value = true
  // Auto-load if we have creds and haven't fetched yet
  const profile = authStore.profile
  if (profile?.ghin_password && !ghinScoresFetched.value && !ghinScoresLoading.value) {
    fetchGhinScores()
  }
}

async function fetchGhinScores() {
  const profile = authStore.profile
  if (!profile?.ghin_number || !profile?.ghin_password) return

  ghinScoresLoading.value = true
  ghinScoresError.value = ''

  const body = {
    ghin_number: String(profile.ghin_number),
    password: profile.ghin_password,
    player_id: myRosterPlayer.value?.id || undefined,
  }

  let data
  try {
    // Try via SJS client with 6s timeout — if stuck socket, this times out fast
    const result = await supaCall(
      'ghin-scores.invoke',
      supabase.functions.invoke('ghin-scores', { body }),
      6000,
    )
    if (result.error) throw result.error
    if (result.data?.error) throw new Error(result.data.error)
    data = result.data
  } catch (e) {
    if (!e.message?.includes('timed out')) {
      ghinScoresError.value = e?.message || 'Failed to load scores'
      ghinScoresLoading.value = false
      return
    }
    // Timeout: retry via raw fetch — opens a fresh socket, bypassing the stuck pool
    try {
      data = await supaRawEdgeFunction('ghin-scores', body, 15000)
      if (data?.error) throw new Error(data.error)
    } catch (e2) {
      ghinScoresError.value = e2?.message || 'Failed to load scores'
      ghinScoresLoading.value = false
      return
    }
  }

  ghinScores.value = data.scores || []
  ghinScoresPosted.value = data.scores_posted ?? null
  // aggregate_stats has birdie/par/GIR; score range computed from scores array (not GHIN field names)
  const aggStats = data.aggregate_stats ?? null
  const rawScores = (data.scores || []).map(s => s.adjusted_gross_score).filter(v => v != null)
  const scoreRange = rawScores.length ? {
    lowest_score: Math.min(...rawScores),
    highest_score: Math.max(...rawScores),
    average: rawScores.reduce((a, b) => a + b, 0) / rawScores.length,
  } : {}
  ghinScoreStats.value = aggStats ? { ...aggStats, ...scoreRange } : (rawScores.length ? scoreRange : null)
  ghinLiveHI.value = data.handicap_index ?? null
  ghinLiveLowHI.value = data.low_hi_display ?? null
  ghinScoresFetched.value = true

  if (myRosterPlayer.value?.id) {
    await rosterStore.fetchPlayers()
  }
  ghinScoresLoading.value = false
}

async function addSearchGhin() {
  const first = newFirst.value.trim()
  const last = newLast.value.trim()
  if (!last) { addGhinMsg.value = 'Enter at least a last name to search'; return }
  addGhinSearching.value = true
  addGhinResults.value = []
  addGhinMsg.value = ''
  try {
    const query = supabase
      .from('bb_member_index')
      .select('ghin_number, first_name, last_name, handicap_index')
      .ilike('last_name', `%${last}%`)
      .order('last_name').limit(15)
    const { data: bbRows } = await query
    let filtered = bbRows || []
    if (first && filtered.length > 0) {
      const firstLower = first.toLowerCase()
      const exact = filtered.filter(p => p.first_name?.toLowerCase().startsWith(firstLower))
      if (exact.length > 0) filtered = exact
    }
    if (filtered.length > 0) {
      addGhinResults.value = filtered.map(bb => ({
        ghin_number: bb.ghin_number,
        full_name: `${bb.first_name} ${bb.last_name}`,
        handicap_index: bb.handicap_index,
        club_name: 'Bonnie Briar Country Club',
        _source: 'bb',
      }))
      addGhinMsg.value = `🏌️ ${filtered.length} match${filtered.length > 1 ? 'es' : ''} in Bonnie Briar directory`
      return
    }
    // Fall back to ghin-player-search edge fn (reads creds server-side)
    const searchQuery = `${first ? first + ' ' : ''}${last}`.trim()
    const { data, error } = await supabase.functions.invoke('ghin-player-search', {
      body: { query: searchQuery },
    })
    if (error) throw error
    if (data?.error?.includes('No GHIN credentials')) {
      addGhinMsg.value = 'Not found in BB directory. Add GHIN credentials in Profile to enable full GHIN search.'
      return
    }
    const results = data?.results || []
    if (results.length) {
      addGhinResults.value = results.map(r => ({
        ghin_number: r.ghin_number,
        full_name: r.full_name,
        handicap_index: r.handicap_index,
        club_name: r.club_name || '',
      }))
      addGhinMsg.value = `⛳ ${results.length} match${results.length > 1 ? 'es' : ''} in GHIN`
    } else {
      addGhinMsg.value = `No golfer found for "${searchQuery}". Enter HCP manually or type their GHIN # directly.`
    }
  } catch(e) {
    addGhinMsg.value = 'Search failed — check connection and try again'
  } finally {
    addGhinSearching.value = false
  }
}

function applyAddGhinResult(r) {
  const parts = (r.full_name || '').trim().split(' ')
  newFirst.value = parts[0] || newFirst.value
  newLast.value = parts.slice(1).join(' ') || newLast.value
  newGhin.value = r.handicap_index != null ? String(r.handicap_index) : newGhin.value
  newGhinNumber.value = r.ghin_number
  newClubName.value = r.club_name || null
  addGhinResults.value = []
  addGhinMsg.value = `✓ ${r.full_name} selected`
}

async function add() {
  const first = newFirst.value.trim()
  const last = newLast.value.trim()
  if (!first) { addError.value = 'First name is required.'; return }
  addError.value = ''
  addingPlayer.value = true
  try {
    const fullName = last ? `${first} ${last}` : first
    await rosterStore.addPlayer({
      name: fullName,
      first_name: first,
      last_name: last || null,
      short_name: last || first.slice(0, 8),
      ghin_index: newGhin.value !== '' ? parseFloat(newGhin.value) : null,
      ghin_number: newGhinNumber.value || null,
      club_name: newClubName.value || null,
      nickname: newNickname.value.trim() || null,
      email: newEmail.value.trim() || null,
      use_nickname: false,
      is_favorite: true,
    })
    newFirst.value = ''; newLast.value = ''; newGhin.value = ''; newNickname.value = ''; newEmail.value = ''; newGhinNumber.value = null; newClubName.value = null
    showAdd.value = false
    showToast(`${fullName} added`, 'gold')
  } catch (err) {
    addError.value = err?.message || 'Could not add player.'
  } finally {
    addingPlayer.value = false
  }
}

// ── Swipe ────────────────────────────────────────────────────────
const swipeX = reactive({})
const swiping = ref(null)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const SWIPE_THRESHOLD = 80

function swipeContainerStyle(id) { return {} }

function swipeCardStyle(id) {
  const dx = swipeX[id] || 0
  if (dx < -10) {
    const t = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD)
    return { transform: `translateX(${dx}px)`, background: `rgba(185,28,28,${0.08 + t * 0.55})`, borderColor: `rgba(248,113,113,${t * 0.6})` }
  } else if (dx > 10) {
    const t = Math.min(1, dx / SWIPE_THRESHOLD)
    return { transform: `translateX(${dx}px)`, background: `rgba(161,98,7,${0.08 + t * 0.55})`, borderColor: `rgba(212,175,55,${t * 0.6})` }
  }
  return { transform: `translateX(${dx}px)` }
}

function swipeRevealOpacity(id, side) {
  const dx = swipeX[id] || 0
  if (side === 'left' && dx < -20) return Math.min(1, (Math.abs(dx) - 20) / 40)
  if (side === 'right' && dx > 20) return Math.min(1, (dx - 20) / 40)
  return 0
}

function onSwipeStart(e, id) {
  swipeStartX.value = e.touches[0].clientX
  swipeStartY.value = e.touches[0].clientY
  swiping.value = id
}

function onSwipeMove(e, id) {
  if (swiping.value !== id) return
  const dx = e.touches[0].clientX - swipeStartX.value
  const dy = e.touches[0].clientY - swipeStartY.value
  if (Math.abs(dy) > Math.abs(dx) * 0.8) return
  swipeX[id] = Math.max(-120, Math.min(120, dx))
}

async function onSwipeEnd(e, player) {
  const id = player.id
  const dx = swipeX[id] || 0
  swiping.value = null
  if (dx < -SWIPE_THRESHOLD) {
    swipeX[id] = 0
    confirmDelete(id, player.name)
  } else if (dx > SWIPE_THRESHOLD) {
    const wasFav = player.is_favorite
    swipeX[id] = 0
    await rosterStore.toggleFavorite(id)
    showToast(wasFav ? 'Removed from favorites' : '★ Added to favorites!', wasFav ? 'neutral' : 'gold')
  } else {
    swipeX[id] = 0
  }
}

// ── Toast ────────────────────────────────────────────────────────
const toastMsg = ref('')
const toastType = ref('')
let toastTimer = null

function showToast(msg, type = 'neutral') {
  toastMsg.value = msg
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 1800)
}

// ── Delete ───────────────────────────────────────────────────────
const deleteConfirmId = ref(null)
const deleteConfirmName = ref('')

function confirmDelete(id, name) {
  deleteConfirmId.value = id
  deleteConfirmName.value = name
}

async function performDelete() {
  if (!deleteConfirmId.value) return
  try {
    await rosterStore.deletePlayer(deleteConfirmId.value)
    showToast('Player deleted', 'neutral')
  } catch (err) {
    console.error('Failed to delete player:', err)
  }
  deleteConfirmId.value = null
}

// ── Edit ─────────────────────────────────────────────────────────
const editTarget = ref(null)
const editFirst = ref('')
const editLast = ref('')
const editGhin = ref('')
const editGhinNumber = ref('')
const editGhinPrefix = ref('')
const editClubName = ref('')
const editNickname = ref('')
const editUseNickname = ref(false)
const ghinSearching = ref(false)
const ghinSearchResults = ref([])
const ghinSearchMsg = ref('')
const editEmail = ref('')
const editError = ref('')
const editSaving = ref(false)

function startEdit(p) {
  ghinSearchResults.value = []
  ghinSearchMsg.value = ''
  editGhinPrefix.value = ''
  editTarget.value = p
  if (p.first_name) {
    editFirst.value = p.first_name
    editLast.value = p.last_name || ''
  } else {
    const parts = p.name.trim().split(' ')
    editFirst.value = parts[0] || ''
    editLast.value = parts.slice(1).join(' ')
  }
  editGhin.value = p.ghin_index ?? ''
  editGhinNumber.value = p.ghin_number || ''
  editClubName.value = p.club_name || ''
  editNickname.value = p.nickname || ''
  editUseNickname.value = p.use_nickname || false
  editEmail.value = p.email || ''
  editError.value = ''
  editSaving.value = false
}

async function searchGhinForEdit() {
  if (ghinSearching.value) return
  ghinSearching.value = true
  ghinSearchResults.value = []
  ghinSearchMsg.value = ''

  const typedGhinNumber = editGhinNumber.value.trim()
  const first = editFirst.value.trim()
  const last = editLast.value.trim()

  try {
    if (typedGhinNumber) {
      const { data: bbRows } = await supabase
        .from('bb_member_index')
        .select('ghin_number, first_name, last_name, handicap_index')
        .eq('ghin_number', typedGhinNumber)
        .limit(1)
      if (bbRows?.length) {
        const bb = bbRows[0]
        ghinSearchResults.value = [{
          ghin_number: bb.ghin_number,
          full_name: `${bb.first_name} ${bb.last_name}`,
          handicap_index: bb.handicap_index,
          club_name: 'Bonnie Briar Country Club',
          _source: 'bb',
        }]
        ghinSearchMsg.value = '🏌️ Found in Bonnie Briar directory'
        return
      }
    } else if (last) {
      const { data: bbRows } = await supabase
        .from('bb_member_index')
        .select('ghin_number, first_name, last_name, handicap_index')
        .ilike('last_name', `%${last}%`)
        .order('last_name')
        .limit(15)
      let filtered = bbRows || []
      if (first && filtered.length > 0) {
        const fl = first.toLowerCase()
        const exact = filtered.filter(p => p.first_name?.toLowerCase().startsWith(fl))
        if (exact.length > 0) filtered = exact
      }
      if (filtered.length > 0) {
        ghinSearchResults.value = filtered.map(bb => ({
          ghin_number: bb.ghin_number,
          full_name: `${bb.first_name} ${bb.last_name}`,
          handicap_index: bb.handicap_index,
          club_name: 'Bonnie Briar Country Club',
          _source: 'bb',
        }))
        ghinSearchMsg.value = `🏌️ ${filtered.length} match${filtered.length > 1 ? 'es' : ''} in Bonnie Briar directory`
        return
      }
    }

    const profile = authStore.profile
    if (!profile?.ghin_number || !profile?.ghin_password) {
      ghinSearchMsg.value = first && last
        ? 'Not found in BB directory. Add GHIN credentials in Profile to search the full GHIN database.'
        : 'Enter a GHIN # or first + last name'
      return
    }

    if (typedGhinNumber) {
      const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
        body: {
          ghin_number: profile.ghin_number,
          password: profile.ghin_password,
          players: [{ id: 'lookup', name: `${first} ${last}`.trim() || 'Unknown', ghin_number: typedGhinNumber }],
        }
      })
      if (error) throw error
      const r = data?.results?.[0]
      if (r?.status === 'updated') {
        ghinSearchResults.value = [{
          ghin_number: r.ghin_number,
          full_name: r.full_name,
          handicap_index: r.handicap_index,
          club_name: r.club_name,
        }]
      } else {
        ghinSearchMsg.value = `No golfer found for GHIN # ${typedGhinNumber}`
      }
      return
    }

    if (!first || !last) {
      ghinSearchMsg.value = 'Enter a GHIN # or first + last name'
      return
    }
    const prefix = editGhinPrefix.value.trim() || first
    const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
      body: {
        ghin_number: profile.ghin_number,
        password: profile.ghin_password,
        players: [{ id: 'lookup', name: `${first} ${last}`, first_name_prefix: prefix }],
      }
    })
    if (error) throw error
    const r = data?.results?.[0]
    if (!r) throw new Error('No response')
    if (r.status === 'updated') {
      ghinSearchResults.value = [{
        ghin_number: r.ghin_number,
        full_name: r.full_name,
        handicap_index: r.handicap_index,
        club_name: r.club_name,
      }]
    } else if (r.status === 'multiple_matches') {
      ghinSearchResults.value = r.matches ?? []
      if (ghinSearchResults.value.length) ghinSearchMsg.value = `Found ${ghinSearchResults.value.length} golfer${ghinSearchResults.value.length > 1 ? 's' : ''} named "${last}" — select one:`
      if (!ghinSearchResults.value.length) ghinSearchMsg.value = `No GHIN record found for "${first} ${last}". Check spelling or enter their GHIN # directly.`
    } else {
      ghinSearchMsg.value = `No GHIN record found for "${first} ${last}". Try clearing the prefix field, or enter their GHIN # directly.`
    }
  } catch (e) {
    ghinSearchMsg.value = e?.message || 'Search failed'
  } finally {
    ghinSearching.value = false
  }
}

async function applyGhinResult(r) {
  ghinSearchResults.value = []
  ghinSearchMsg.value = `✓ Selected ${r.full_name}`
  await nextTick()
  editGhinNumber.value = r.ghin_number
  editGhin.value = r.handicap_index != null ? String(r.handicap_index) : editGhin.value
  editClubName.value = r.club_name || editClubName.value
}

async function saveEdit() {
  editError.value = ''
  if (!editFirst.value.trim()) { editError.value = 'First name is required.'; return }
  const emailTrimmed = editEmail.value.trim()
  if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    editError.value = 'Email looks invalid.'
    return
  }
  const fullName = editLast.value.trim() ? `${editFirst.value.trim()} ${editLast.value.trim()}` : editFirst.value.trim()
  const newGhinNumber = editGhinNumber.value.trim() || null
  const prevGhinNumber = editTarget.value?.ghin_number || null
  const ghinNumberChanged = newGhinNumber && newGhinNumber !== prevGhinNumber
  const playerId = editTarget.value.id

  editSaving.value = true
  try {
    await rosterStore.updatePlayer(playerId, {
      name: fullName,
      first_name: editFirst.value.trim(),
      last_name: editLast.value.trim() || null,
      short_name: editLast.value.trim() || editFirst.value.trim().slice(0, 8),
      ghin_index: editGhin.value !== '' ? parseFloat(editGhin.value) : null,
      ghin_number: newGhinNumber,
      club_name: editClubName.value.trim() || null,
      nickname: editNickname.value.trim() || null,
      use_nickname: editUseNickname.value,
      email: emailTrimmed || null,
    })
    editTarget.value = null

    if (ghinNumberChanged) {
      const profile = authStore.profile
      if (profile?.ghin_number && profile?.ghin_password) {
        _autoSyncGhinNumber(playerId, newGhinNumber, profile)
      }
    }
  } catch (e) {
    editError.value = e?.message || 'Could not save.'
  } finally {
    editSaving.value = false
  }
}

async function _autoSyncGhinNumber(playerId, ghinNumber, profile) {
  try {
    const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
      body: {
        ghin_number: profile.ghin_number,
        password: profile.ghin_password,
        state: 'NY',
        players: [{ id: playerId, name: '', ghin_number: ghinNumber }],
      }
    })
    if (error || data?.error) return
    const r = data?.results?.[0]
    if (r?.status === 'found') {
      await rosterStore.updatePlayer(playerId, {
        ghin_index: r.handicap_index,
        ghin_synced_at: new Date().toISOString(),
        low_hi: r.low_hi || undefined,
        club_name: r.club_name || undefined,
      })
      showToast(`HCP synced: ${r.handicap_index}`, 'green')
    }
  } catch { /* silent */ }
}
</script>

<style scoped>
.players-view { padding: 16px; padding-bottom: 80px; }

/* ── Trend arrows ───────────────────────────────────────────── */
.trend-arrow {
  font-size: 11px; font-weight: 800; margin-left: 1px;
  vertical-align: middle; line-height: 1;
}
.trend-up { color: var(--gw-bogey); }      /* going up = harder = red */
.trend-down { color: var(--gw-birdie); }   /* going down = easier = green */

/* ── You card ───────────────────────────────────────────────── */
.player-card--you {
  border: 1.5px solid var(--gw-green-400);
  background: rgba(34, 160, 107, 0.06);
  margin-bottom: 4px;
}
.you-badge {
  font-size: 9px; font-weight: 800; color: var(--gw-green-400);
  letter-spacing: 0.5px; margin-left: 6px; vertical-align: middle;
  text-transform: uppercase;
}
.you-meta { margin-top: 3px; font-size: 12px; color: var(--gw-text-muted); }
.you-no-ghin { color: var(--gw-text-muted); font-style: italic; }
.you-sync-time { color: var(--gw-green-400); }
.ghin-sheet-btn {
  background: var(--gw-green-800);
  color: var(--gw-green-300);
  font-size: 11px; font-weight: 700;
  padding: 5px 11px; border-radius: 8px;
  border: 1px solid var(--gw-green-700);
  cursor: pointer; flex-shrink: 0;
  letter-spacing: 0.3px;
  -webkit-tap-highlight-color: transparent;
}

/* ── GHIN sheet ─────────────────────────────────────────────── */
.ghin-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; z-index: 200;
}
.ghin-sheet-panel {
  background: var(--gw-neutral-900);
  border-radius: 24px 24px 0 0;
  width: 100%; max-height: 92vh; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  border-top: 1px solid var(--gw-card-border);
  padding-bottom: env(safe-area-inset-bottom);
}
.ghin-sheet-handle {
  width: 36px; height: 4px;
  background: rgba(255,255,255,.15);
  border-radius: 2px; margin: 12px auto 0;
  position: relative; z-index: 1;
}

/* ── Hero header ── */
.ghin-hero-header {
  background: linear-gradient(150deg, #0f3d28 0%, #0c1810 60%, #0a0d0b 100%);
  padding: 0 16px 14px;
  position: relative;
  border-radius: 24px 24px 0 0;
}
.ghin-close-btn {
  position: absolute; top: 14px; right: 16px;
  background: rgba(255,255,255,.1); border: none;
  color: rgba(255,255,255,.6); font-size: 14px;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.ghin-header-identity {
  display: flex; align-items: center; gap: 12px;
  padding-top: 8px;
}
.ghin-club-logo-wrap {
  flex-shrink: 0;
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ghin-club-logo { width: 100%; height: 100%; object-fit: cover; }
.ghin-club-icon { font-size: 22px; line-height: 1; }
.ghin-header-name-block { flex: 1; min-width: 0; }
.ghin-header-name {
  font-size: 18px; font-weight: 700; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ghin-header-sub { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 2px; }
.ghin-header-club { color: rgba(255,255,255,.35); }

/* HI badge */
.ghin-hi-badge {
  flex-shrink: 0; text-align: center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 12px; padding: 6px 12px;
  min-width: 62px;
}
.ghin-hi-num {
  font-size: 30px; font-weight: 700; line-height: 1;
  font-family: var(--gw-font-mono); color: #fff;
  letter-spacing: -1px;
  text-shadow: 0 1px 0 rgba(255,255,255,.07), 0 2px 0 rgba(0,0,0,.5), 0 4px 8px rgba(0,0,0,.4);
}
.ghin-hi-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .06em; color: rgba(255,255,255,.45); margin-top: 2px;
}
.ghin-hi-trend { font-size: 11px; margin-left: 3px; }

/* Sparkline */
.ghin-spark-row {
  margin-top: 14px;
}
.ghin-spark-label {
  font-size: 9px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: rgba(255,255,255,.3); margin-bottom: 6px;
}
.ghin-spark-bars {
  display: flex; align-items: flex-end; gap: 3px; height: 32px;
  position: relative;
}
.ghin-spark-avg-line {
  position: absolute;
  left: 0; right: 0;
  height: 1px;
  background: rgba(239, 68, 68, 0.7);
  pointer-events: none;
}
.ghin-spark-bar {
  flex: 1; border-radius: 3px 3px 0 0;
  background: rgba(255,255,255,.2);
  min-height: 4px;
  position: relative;
  transition: height .3s ease;
}
.ghin-spark-bar::after {
  content: ''; position: absolute; inset: 0 0 50% 0;
  background: rgba(255,255,255,.12); border-radius: 3px 3px 0 0;
}
.ghin-spark-bar--latest {
  background: #34c77e;
  box-shadow: 0 0 8px rgba(52,199,126,.5);
}
.ghin-spark-bar--latest::after { background: rgba(255,255,255,.2); }

/* Stats pills */
.ghin-stats-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 6px; padding: 10px 16px 0;
}
.ghin-stat {
  background: var(--gw-neutral-800);
  border-radius: 10px; border: 1px solid var(--gw-card-border);
  padding: 9px 8px; text-align: center;
}
.ghin-stat-label {
  font-size: 9px; color: var(--gw-text-muted); font-weight: 600;
  letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 4px;
}
.ghin-stat-val {
  font-size: 18px; font-weight: 700;
  color: var(--gw-text); font-family: var(--gw-font-mono);
}
.ghin-stat-sub { font-size: 9px; color: var(--gw-text-muted); margin-top: 2px; }

/* Scoring section */
.ghin-scoring-section { margin: 10px 16px 0; }
.ghin-scoring-labels {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;
}
.ghin-scoring-lbl { font-size: 10px; font-weight: 600; }
.ghin-scoring-bar-wrap { position: relative; }
.ghin-scoring-bar {
  display: flex; height: 14px; border-radius: 7px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.04);
  background: var(--gw-neutral-800);
}
.ghin-bar-seg { position: relative; overflow: hidden; }
.ghin-bar-seg--birdie { background: #22a06b; }
.ghin-bar-seg--par    { background: #4a9eff; }
.ghin-bar-seg--bogey  { background: #f59e0b; }
.ghin-bar-seg--double { background: #ef4444; }
.ghin-bar-gloss {
  position: absolute; top: 0; left: 0; right: 0; height: 5px;
  background: rgba(255,255,255,.22);
}
.ghin-bar-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,.06) 0%, rgba(0,0,0,.12) 100%);
  border-radius: 7px;
  pointer-events: none;
}

/* Par 3/4/5 grid */
.ghin-par-grid {
  display: flex; align-items: center; justify-content: space-around;
  background: var(--gw-neutral-800);
  border-radius: 10px; border: 1px solid var(--gw-card-border);
  padding: 8px 16px; margin-top: 8px;
}
.ghin-par-cell { text-align: center; }
.ghin-par-val { font-size: 16px; font-weight: 700; font-family: var(--gw-font-mono); color: var(--gw-text); }
.ghin-par-label { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--gw-text-muted); margin-top: 2px; font-weight: 600; }
.ghin-par-divider { width: 1px; height: 24px; background: var(--gw-card-border); }

/* Score range strip */
.ghin-range-strip {
  display: flex; align-items: center; justify-content: space-around;
  margin: 8px 16px 0;
  background: var(--gw-neutral-800);
  border-radius: 10px; border: 1px solid var(--gw-card-border);
  padding: 10px 16px;
}
.ghin-range-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ghin-range-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--gw-text-muted); font-weight: 600; }
.ghin-range-val { font-size: 16px; font-weight: 700; font-family: var(--gw-font-mono); color: var(--gw-text); }
.ghin-range-val--low  { color: var(--gw-green-400); }
.ghin-range-val--high { color: #f87171; }
.ghin-range-divider { width: 1px; height: 28px; background: var(--gw-card-border); }

.trend-improving { color: var(--gw-green-400); font-weight: 600; }
.trend-declining  { color: #f87171; font-weight: 600; }
.trend-neutral    { color: var(--gw-text-muted); }

/* Cap badges */
.ghin-cap-row {
  display: flex; gap: 8px; padding: 8px 16px 0;
}
.ghin-cap-badge {
  font-size: 11px; font-weight: 700; padding: 4px 10px;
  border-radius: 6px; letter-spacing: .03em;
}
.ghin-cap-badge--hard {
  background: rgba(239,68,68,.15); color: #fca5a5;
  border: 1px solid rgba(239,68,68,.3);
}
.ghin-cap-badge--soft {
  background: rgba(251,191,36,.12); color: #fcd34d;
  border: 1px solid rgba(251,191,36,.25);
}

/* Score history section */
.ghin-history-section { margin: 10px 16px 0; }
.ghin-history-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.ghin-history-title {
  font-size: 13px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--gw-text-muted);
}
.ghin-refresh-btn {
  background: none; border: none; cursor: pointer;
  color: var(--gw-green-400); font-size: 18px; padding: 4px 6px;
  border-radius: 6px; -webkit-tap-highlight-color: transparent;
}
.ghin-refresh-btn:disabled { opacity: 0.4; }

.ghin-no-creds, .ghin-scores-empty, .ghin-scores-prompt {
  background: var(--gw-neutral-800);
  border-radius: 12px; border: 1px solid var(--gw-card-border);
  padding: 14px 16px; text-align: center;
}
.ghin-scores-note { font-size: 15px; font-weight: 600; color: var(--gw-text); margin-bottom: 6px; }
.ghin-scores-sub { font-size: 13px; color: var(--gw-text-muted); line-height: 1.5; }
.ghin-scores-loading {
  display: flex; align-items: center; justify-content: center; padding: 24px 0;
}
.ghin-scores-error {
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
  border-radius: 10px; padding: 10px 14px;
  color: #fca5a5; font-size: 13px;
}

/* Score rows — 5 columns: date | course+tee | gross | net | diff */
.ghin-scores-list {
  background: var(--gw-neutral-800);
  border-radius: 12px; border: 1px solid var(--gw-card-border);
  overflow: hidden;
}
.ghin-scores-cols {
  display: grid;
  grid-template-columns: 62px 1fr 34px 34px 46px;
  gap: 4px; padding: 7px 10px;
  background: var(--gw-neutral-700);
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--gw-text-muted);
}
.ghin-score-row {
  display: grid;
  grid-template-columns: 62px 1fr 34px 34px 46px;
  gap: 4px; padding: 8px 10px;
  border-top: 1px solid var(--gw-card-border);
  font-size: 13px; color: var(--gw-text);
  align-items: center;
}
.ghin-score-row--used { background: rgba(34,160,107,0.07); }
.score-date { font-size: 11px; color: var(--gw-text-muted); white-space: nowrap; }
.score-course-wrap { display: flex; flex-direction: column; min-width: 0; }
.score-course {
  font-size: 12px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.score-tee { font-size: 10px; color: var(--gw-text-muted); white-space: nowrap; }
.score-ags { font-weight: 700; font-family: var(--gw-font-mono); }
.score-net { font-family: var(--gw-font-mono); font-size: 12px; color: var(--gw-text-muted); }
.score-diff { font-family: var(--gw-font-mono); font-size: 12px; color: var(--gw-text-muted); display: flex; align-items: center; gap: 3px; }
.col-center { text-align: center; }
.col-right  { text-align: right; justify-content: flex-end; }
.diff-used { color: var(--gw-green-400); font-weight: 700; }
.hi-dot { color: var(--gw-green-400); font-size: 7px; line-height: 1; }
.ghin-scores-legend {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; font-size: 11px; color: var(--gw-text-muted);
  border-top: 1px solid var(--gw-card-border);
}

/* ── Rest of styles (unchanged) ─────────────────────────────── */
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.view-header h2 { font-size: 22px; font-weight: 700; margin: 0; color: var(--gw-text); }
.header-actions { display: flex; gap: 6px; align-items: center; }
.sort-btn, .gear-btn { font-size: 11px; padding: 5px 9px; opacity: .75; }
.sync-all-btn {
  font-size: 11px; padding: 5px 10px;
  color: #fff; background: #60a5fa;
  border: none; border-radius: 9999px;
  font-weight: 600; opacity: 1;
}
.spin { display: inline-block; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.sync-banner {
  margin-bottom: 10px; padding: 8px 12px; border-radius: 10px;
  font-size: 12px; font-weight: 600; text-align: center;
}
.sync-banner.success { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); color: #4ade80; }
.sync-banner.error { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; }
.sync-banner.warn { background: rgba(234,179,8,.1); border: 1px solid rgba(234,179,8,.3); color: #fbbf24; }
.sync-banner.info { background: rgba(96,165,250,.1); border: 1px solid rgba(96,165,250,.3); color: #93c5fd; }

.add-form {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 16px; padding: 14px;
  background: var(--gw-card-bg); border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.2); border: 1px solid var(--gw-card-border);
}
.name-row { display: flex; gap: 8px; }
.name-row .wiz-input { flex: 1; }
.add-ghin-search-row { display: flex; gap: 8px; }
.add-ghin-search-row .wiz-input { flex: 1; min-width: 0; }
.add-ghin-warning {
  font-size: 11px; color: #d97706; background: rgba(217,119,6,.08);
  border: 1px solid rgba(217,119,6,.25); border-radius: 8px; padding: 6px 10px;
}

.section-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(240,237,224,.6);
  padding: 10px 4px 4px; margin-top: 6px;
}
.players-view .section-label:first-of-type { margin-top: 2px; }
.swipe-hint { font-size: 10px; font-weight: 500; letter-spacing: 0; color: rgba(240,237,224,.25); text-transform: none; }

.swipe-container {
  position: relative; overflow: hidden; border-radius: 12px;
  margin-bottom: 2px; background: rgba(255,255,255,.04);
}
.swipe-reveal {
  position: absolute; top: 0; bottom: 0; display: flex; align-items: center;
  font-size: 13px; font-weight: 700; letter-spacing: .04em;
  color: white; pointer-events: none; z-index: 0; transition: opacity 0.1s;
}
.swipe-reveal-left { left: 0; padding-left: 20px; }
.swipe-reveal-right { right: 0; padding-right: 20px; }

.player-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px; position: relative; z-index: 1;
  -webkit-tap-highlight-color: transparent; will-change: transform;
}
.player-card--fav { border-color: rgba(212,175,55,.2); }

.player-info {
  flex: 1; min-width: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.player-name {
  font-weight: 600; font-size: 15px; color: #f0ede0;
  letter-spacing: -.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.player-hcp {
  font-size: 13px; font-weight: 500; color: rgba(240,237,224,.55);
  margin-left: 4px;
}
.player-meta {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
}
.player-email-dot {
  font-size: 10px; font-weight: 700; color: #22c55e;
}
.ghin-dot-inline {
  display: inline-block;
  width: 7px; height: 7px; border-radius: 50%;
  margin-left: 3px; margin-bottom: 1px;
  vertical-align: middle; flex-shrink: 0;
}
.dot-blue { background: #60a5fa; }
.dot-red { background: #ef4444; }

.cap-badge {
  display: inline-block;
  font-size: 9px; font-weight: 800; letter-spacing: .04em;
  padding: 1px 4px; border-radius: 4px;
  margin-left: 4px; vertical-align: middle;
  line-height: 14px;
}
.cap-soft { background: rgba(251,191,36,.2); color: #fbbf24; border: 1px solid rgba(251,191,36,.4); }
.cap-hard { background: rgba(239,68,68,.2); color: #f87171; border: 1px solid rgba(239,68,68,.4); }
.dot-none { background: rgba(255,255,255,.2); }

.player-fav-star { font-size: 14px; color: #d4af37; flex-shrink: 0; line-height: 1; }

.empty-state { text-align: center; padding: 40px 20px; color: rgba(240,237,224,.5); }
.empty-icon { font-size: 40px; margin-bottom: 8px; }

.swipe-toast {
  position: fixed; bottom: calc(var(--gw-nav-height, 60px) + env(safe-area-inset-bottom) + 16px);
  left: 50%; transform: translateX(-50%);
  padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 600;
  z-index: 400; pointer-events: none;
  background: rgba(30,40,30,.92); color: #f0ede0;
  border: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(8px);
}
.swipe-toast.gold { color: #d4af37; border-color: rgba(212,175,55,.3); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

.delete-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  z-index: 300; display: flex; align-items: center; justify-content: center;
}
.delete-modal {
  background: var(--gw-neutral-900, #111a14); border-radius: 16px;
  padding: 24px 20px; max-width: 320px; width: 90%;
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 8px 30px rgba(0,0,0,.5);
}
.delete-header { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #f0ede0; }
.delete-message { font-size: 14px; color: rgba(240,237,224,.7); margin-bottom: 20px; line-height: 1.5; }
.delete-message strong { color: #f0ede0; font-weight: 700; }
.delete-footer { display: flex; gap: 10px; }
.delete-footer .btn-ghost, .delete-footer .btn-danger { flex: 1; }

.match-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  z-index: 300; display: flex; align-items: flex-end;
}
.match-sheet {
  width: 100%;
  background: var(--gw-neutral-900, #111a14);
  border-radius: 20px 20px 0 0;
  border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 -8px 30px rgba(0,0,0,.5);
  display: flex; flex-direction: column;
  max-height: 80vh;
  padding-bottom: env(safe-area-inset-bottom);
}
.match-sheet-header {
  padding: 20px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}
.match-sheet-title {
  font-size: 17px; font-weight: 700; color: #f0ede0; margin-bottom: 4px;
}
.match-sheet-sub {
  font-size: 13px; color: rgba(240,237,224,.55); line-height: 1.4;
}
.match-list {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  padding: 12px 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.match-sheet-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}
.match-option {
  padding: 12px 14px; border-radius: 12px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  cursor: pointer; flex-shrink: 0;
}
.match-option:active { background: rgba(255,255,255,.12); }
.match-name { font-size: 15px; font-weight: 600; color: #f0ede0; }
.match-meta { font-size: 12px; color: rgba(240,237,224,.5); margin-top: 3px; }

.btn-danger {
  background: #ef4444; color: white; border: none;
  padding: 12px 16px; border-radius: 10px; font-weight: 700;
  cursor: pointer; font-size: 14px; transition: all .15s;
}
.btn-danger:active { background: #dc2626; transform: scale(.97); }

.edit-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  z-index: 200; display: flex; align-items: flex-end;
}
.edit-sheet {
  width: 100%; background: var(--gw-neutral-900, #111a14); border-radius: 20px 20px 0 0;
  padding: 20px 16px 36px; display: flex; flex-direction: column; gap: 12px;
  border: 1px solid rgba(255,255,255,.12); border-bottom: none;
  max-height: 92vh; overflow-y: auto; -webkit-overflow-scrolling: touch;
}
.edit-sheet input, .edit-sheet select { font-size: 16px !important; }
.edit-header { display: flex; justify-content: space-between; align-items: center; }
.edit-title { font-size: 17px; font-weight: 700; color: #f0ede0; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: rgba(240,237,224,.5); }
.edit-footer { display: flex; gap: 10px; margin-top: 4px; }
.edit-footer .btn-ghost, .edit-footer .btn-primary { flex: 1; }
.edit-footer button[disabled] { opacity: .55; cursor: wait; }
.edit-error {
  padding: 10px 12px; border-radius: 10px;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
  color: #fca5a5; font-size: 12px; line-height: 1.4;
}
.ghin-number-row { display: flex; align-items: center; gap: 8px; }
.ghin-prefix-row { margin-top: -4px; }
.ghin-prefix-input { font-size: 16px; color: rgba(240,237,224,.6); }
.ghin-prefix-input::placeholder { font-size: 14px; opacity: 0.5; }
.edit-club-row { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(255,255,255,.04); border-radius: 8px; margin-bottom: 4px; }
.edit-club-logo { height: 18px; width: 18px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); }
.edit-club-icon { font-size: 13px; }
.edit-club-name { font-size: 12px; color: rgba(240,237,224,.5); font-style: italic; }
.ghin-lookup-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 10px 12px; border-radius: var(--gw-radius-full);
  background: rgba(96,165,250,.15); border: 1px solid rgba(96,165,250,.3);
  color: #60a5fa; font-size: 12px; font-weight: 600;
  text-decoration: none; white-space: nowrap; flex-shrink: 0;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.ghin-lookup-btn:disabled { opacity: 0.5; cursor: default; }
.ghin-search-results {
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  border-radius: var(--gw-radius-md); overflow: hidden;
}
.ghin-search-label {
  font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  color: rgba(240,237,224,.4); padding: 8px 12px 4px;
}
.ghin-search-option {
  padding: 10px 12px; cursor: pointer; border-top: 1px solid rgba(255,255,255,.06);
  -webkit-tap-highlight-color: transparent;
}
.ghin-search-option:active { background: rgba(96,165,250,.15); }
.ghin-search-name { font-size: 14px; font-weight: 600; color: var(--gw-text); }
.ghin-search-meta { font-size: 12px; color: rgba(240,237,224,.5); margin-top: 2px; }
.bb-badge { display: inline-block; font-size: 10px; font-weight: 700; color: #1a1a1a; background: #4ade80; border-radius: 3px; padding: 1px 4px; margin-left: 6px; vertical-align: middle; }
.ghin-search-msg { font-size: 12px; color: rgba(240,237,224,.5); padding: 4px 2px; }
.ghin-search-msg--error { color: #fbbf24; }
.edit-nickname-row { display: flex; align-items: center; gap: 10px; }
.nick-toggle-label { display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.nick-toggle-cb { width: 16px; height: 16px; accent-color: #22a06b; cursor: pointer; }
.nick-toggle-text { font-size: 12px; color: rgba(240,237,224,.6); }

.invite-hint-banner {
  margin: 4px 0 8px; padding: 8px 12px; border-radius: 10px;
  background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3);
  color: #4ade80; font-size: 12px; font-weight: 700; text-align: center;
}
.player-invite-btn {
  font-size: 16px; background: transparent; border: none; cursor: pointer;
  padding: 4px 5px; border-radius: 8px; -webkit-tap-highlight-color: transparent;
  flex-shrink: 0; opacity: .7; transition: opacity .15s;
}
/* ── Player info button ── */
.player-info-btn {
  background: var(--gw-neutral-800);
  color: var(--gw-text-muted);
  font-size: 14px; padding: 5px 8px;
  border-radius: 8px; border: 1px solid var(--gw-card-border);
  cursor: pointer; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  margin-right: 2px;
}
.invite-btn {
  font-size: 11px; font-weight: 600;
  padding: 5px 10px; border-radius: 8px;
  border: 1px solid var(--gw-primary);
  background: transparent; color: var(--gw-primary);
  cursor: pointer; flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  margin-right: 2px;
  transition: background .15s, color .15s;
}
.invite-btn:active { background: var(--gw-primary); color: #fff; }
.invite-btn:disabled { opacity: 0.5; cursor: default; }
.invite-status {
  font-size: 10px; font-weight: 600; letter-spacing: .02em;
}
.invite-status--joined  { color: #22c55e; }
.invite-status--sent    { color: var(--gw-text-muted); }
.invite-status--pending { color: var(--gw-text-muted); opacity: 0.6; }
.invite-status--sending { color: var(--gw-primary); }
/* ── Aggregate stats grid ── */
.ghin-agg-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 6px; padding: 10px 16px 0;
}
.ghin-agg-stat {
  background: var(--gw-neutral-800); border-radius: 8px;
  border: 1px solid var(--gw-card-border);
  padding: 8px 4px; text-align: center;
}
.ghin-agg-val { font-size: 14px; font-weight: 700; color: var(--gw-text); font-family: var(--gw-font-mono); }
.ghin-agg-label { font-size: 9px; color: var(--gw-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }
/* ── HI star ── */
.hi-star { color: var(--gw-birdie); font-size: 11px; margin-right: 2px; }
/* ── Public player note ── */
.ghin-player-sheet-note {
  margin: 12px 16px 0;
  background: var(--gw-neutral-800); border-radius: 10px;
  border: 1px solid var(--gw-card-border); padding: 12px 14px;
}
.ghin-sync-row {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--gw-text-muted); margin-bottom: 6px;
}
.ghin-public-note { font-size: 11px; color: var(--gw-text-muted); line-height: 1.5; font-style: italic; }
.cap-none { background: var(--gw-neutral-700); color: var(--gw-text-muted); font-size:12px; font-weight:700; padding:2px 8px; border-radius:8px; }

</style>

<style>
/* Light theme — non-scoped to beat scoped specificity */
[data-theme="light"] .player-name        { color: #0d1f12 !important; }
[data-theme="light"] .player-hcp         { color: rgba(13,31,18,0.55) !important; }
[data-theme="light"] .player-card        { background: #ffffff !important; border-color: rgba(13,95,60,0.12) !important; }
[data-theme="light"] .empty-state        { color: rgba(13,31,18,0.45) !important; }
[data-theme="light"] .swipe-hint         { color: rgba(13,31,18,0.3) !important; }
[data-theme="light"] .delete-header,
[data-theme="light"] .edit-title,
[data-theme="light"] .match-name         { color: #0d1f12 !important; }
[data-theme="light"] .delete-message,
[data-theme="light"] .match-meta,
[data-theme="light"] .edit-club-name,
[data-theme="light"] .ghin-search-meta,
[data-theme="light"] .ghin-search-msg    { color: rgba(13,31,18,0.55) !important; }
[data-theme="light"] .close-btn          { color: rgba(13,31,18,0.4) !important; }
[data-theme="light"] .ghin-prefix-input  { color: rgba(13,31,18,0.6) !important; }
[data-theme="light"] .player-sheet       { background: #f4f7f5 !important; }

/* ── Gear bottom sheet (teleported to body, needs non-scoped) ── */
.gear-backdrop {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,.5);
  display: flex; align-items: flex-end;
}
.gear-sheet {
  width: 100%; max-height: 80vh; overflow-y: auto;
  background: #1e2720; border-radius: 20px 20px 0 0;
  padding: 0 0 env(safe-area-inset-bottom);
}
.gear-sheet-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.2);
  margin: 12px auto 8px;
}
.gear-sheet-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; font-weight: 600; color: rgba(240,237,224,.5);
  letter-spacing: .6px; text-transform: uppercase;
  padding: 8px 20px 12px;
}
.gear-back {
  background: none; border: none; color: var(--gw-gold,#d4af37);
  font-size: 18px; cursor: pointer; padding: 0 4px 0 0;
  -webkit-tap-highlight-color: transparent;
}
.gear-action {
  display: flex; align-items: center; gap: 14px;
  width: 100%; padding: 14px 20px;
  background: none; border: none; border-top: 1px solid rgba(255,255,255,.06);
  color: var(--gw-text, #f0ede0); cursor: pointer; text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background .12s;
}
.gear-action:active { background: rgba(255,255,255,.05); }
.gear-action-icon { font-size: 22px; flex-shrink: 0; }
.gear-action-body { flex: 1; min-width: 0; }
.gear-action-label { font-size: 15px; font-weight: 600; }
.gear-action-sub { font-size: 12px; color: rgba(240,237,224,.5); margin-top: 2px; }
.gear-action-arrow { font-size: 20px; color: rgba(240,237,224,.3); flex-shrink: 0; }
.gear-cancel {
  display: block; width: calc(100% - 32px); margin: 12px 16px;
  padding: 13px; border-radius: 14px;
  background: rgba(255,255,255,.07); border: none;
  color: rgba(240,237,224,.7); font-size: 15px; font-weight: 600;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gear-cancel:active { background: rgba(255,255,255,.12); }
.gear-player-list { padding: 0 0 8px; }
.gear-player-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid rgba(255,255,255,.06);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background .12s;
}
.gear-player-row:active { background: rgba(255,255,255,.05); }
.gear-player-name { font-size: 15px; font-weight: 500; flex: 1; }
.gear-player-sub { font-size: 12px; color: rgba(240,237,224,.45); margin-top: 1px; }
[data-theme="light"] .gear-sheet { background: #f4f7f5; }
[data-theme="light"] .gear-action { color: #0d1f12; border-top-color: rgba(0,0,0,.07); }
[data-theme="light"] .gear-action-sub { color: rgba(13,31,18,.5); }
[data-theme="light"] .gear-cancel { background: rgba(0,0,0,.06); color: rgba(13,31,18,.7); }
[data-theme="light"] .gear-sheet-title { color: rgba(13,31,18,.45); }
[data-theme="light"] .gear-player-row { border-top-color: rgba(0,0,0,.07); color: #0d1f12; }
[data-theme="light"] .gear-player-sub { color: rgba(13,31,18,.45); }
</style>
