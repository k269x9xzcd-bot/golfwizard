<template>
  <div class="players-view">

    <!-- Sync status banner -->
    <div v-if="syncMsg" class="sync-banner" :class="syncMsgType">{{ syncMsg }}</div>

    <!-- Multiple matches modal -->
    <Teleport to="body">
      <div v-if="multipleMatchPlayer" class="match-sheet-backdrop" @click.self="multipleMatchPlayer = null">
        <div class="match-sheet">
          <div class="match-sheet-title">Multiple Matches</div>
          <div class="match-sheet-sub">Select the correct golfer for <strong>{{ multipleMatchPlayer.name }}</strong></div>
          <div class="match-list">
            <div v-for="m in multipleMatchPlayer.matches" :key="m.ghin_number" class="match-option" @click="selectMatch(multipleMatchPlayer.player_id, m)">
              <div class="match-name">{{ m.full_name }}</div>
              <div class="match-meta">{{ [m.club_name, m.handicap_index != null ? `HCP ${m.handicap_index}` : 'HCP NH', `#${m.ghin_number}`].filter(Boolean).join(' · ') }}</div>
            </div>
          </div>
          <div class="match-sheet-footer">
            <button class="btn-ghost" @click="multipleMatchPlayer = null">Skip</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Invite hint -->
    <div v-if="inviteHint" class="invite-hint-banner">{{ inviteHint }}</div>

    <!-- Add form -->
    <div class="view-header">
      <h2>Players</h2>
      <div class="header-actions">
        <button class="btn-ghost btn-sm sort-btn" @click="toggleSort">{{ sortLabel }}</button>
        <button class="btn-ghost btn-sm invite-all-btn" @click="shareGroupInvite" title="Invite a player to GolfWizard">📨</button>
        <button class="btn-ghost btn-sm sync-all-btn" @click="syncAllGhin" :disabled="ghinSyncing" title="Sync all handicaps from GHIN">
          <span v-if="ghinSyncing" class="spin">⟳</span>
          <span v-else>⟳ Sync</span>
        </button>
      </div>
    </div>

    <div v-if="showAdd" class="add-form">
      <div class="name-row">
        <input v-model="newFirst" class="wiz-input" placeholder="First name" autocomplete="given-name" />
        <input v-model="newLast" class="wiz-input" placeholder="Last name" autocomplete="family-name" />
      </div>
      <input v-model="newNickname" class="wiz-input" placeholder="Nickname (optional)" />
      <input v-model="newEmail" class="wiz-input" placeholder="Email (optional)" type="email" autocomplete="email" />
      <div class="add-ghin-search-row">
        <input v-model="newGhin" class="wiz-input" placeholder="GHIN Index (e.g. 14.2)" type="number" step="0.1" />
        <button class="ghin-lookup-btn" @click="addSearchGhin" :disabled="addGhinSearching" type="button">
          {{ addGhinSearching ? "…" : "🔍 GHIN" }}
        </button>
      </div>
      <div v-if="!newGhinNumber && newFirst && newLast" class="add-ghin-warning">
        ⚠️ No GHIN linked — handicap won't auto-update. Tap 🔍 GHIN to search.
      </div>
      <div v-if="addGhinResults.length" class="ghin-search-results">
        <div class="ghin-search-label">Select the correct golfer:</div>
        <div v-for="r in addGhinResults" :key="r.ghin_number" class="ghin-search-option" @click="applyAddGhinResult(r)">
          <div class="ghin-search-name">{{ r.full_name }} <span v-if="r._source === 'bb'" class="bb-badge">BB</span></div>
          <div class="ghin-search-meta">{{ r.club_name }} · HCP {{ r.handicap_index ?? 'NH' }} · #{{ r.ghin_number }}</div>
        </div>
      </div>
      <div v-if="addGhinMsg" class="ghin-search-msg">{{ addGhinMsg }}</div>
      <div v-if="addError" class="edit-error">{{ addError }}</div>
      <div class="edit-footer">
        <button class="btn-ghost" @click="showAdd = false">Cancel</button>
        <button class="btn-primary" :disabled="addingPlayer" @click="add">{{ addingPlayer ? 'Adding…' : 'Add Player' }}</button>
      </div>
    </div>
    <button v-if="!showAdd" class="btn-ghost btn-sm" style="margin-bottom:12px;width:100%;" @click="showAdd = true">+ Add Player</button>

    <!-- You section -->
    <div v-if="myRosterPlayer" class="player-card player-card--you">
      <div class="player-info" @click="openGhinSheet">
        <div class="player-name">
          {{ myRosterPlayer.name }}
          <span class="you-badge">YOU</span>
          <span v-if="myRosterPlayer.ghin_index != null" class="player-hcp">
            ({{ Number(myRosterPlayer.ghin_index).toFixed(1) }}<span class="ghin-dot-inline" :class="ghinSyncStatus(myRosterPlayer)" :title="ghinSyncTitle(myRosterPlayer)"></span>)
          </span>
        </div>
      </div>
      <button v-if="myRosterPlayer.ghin_number" class="ghin-sheet-btn" @click.stop="openGhinSheet">GHIN</button>
    </div>

    <!-- GHIN score history sheet -->
    <GhinSheet
      v-model="showGhinSheet"
      :player="myRosterPlayer"
      :has-credentials="!!authStore.profile?.ghin_password"
      :loading="ghinScoresLoading"
      :error="ghinScoresError"
      :scores-fetched="ghinScoresFetched"
      :scores="ghinScores"
      :scores-posted="ghinScoresPosted"
      :score-stats="ghinScoreStats"
      :agg-stats="ghinAggStats"
      :live-h-i="ghinLiveHI"
      :live-low-h-i="ghinLiveLowHI"
      :computed-trend="ghinComputedTrend"
      @refresh="fetchGhinScores"
      @go-settings="showGhinSheet = false; $router.push('/settings')"
    />

    <!-- Public player GHIN sheet -->
    <PlayerSheet :player="playerSheetTarget" @close="playerSheetTarget = null" />

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
            <span v-if="p.email" class="player-email-dot" title="Has email">✓</span>
          </div>
        </div>
        <button v-if="p.ghin_number" class="player-info-btn" @click.stop="openPlayerSheet(p)" title="GHIN info">⛳</button>
        <button v-if="p.email" class="player-invite-btn" @click.stop="invitePlayer(p)" title="Invite to GolfWizard">📨</button>
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
            <span v-if="p.email" class="player-email-dot" title="Has email">✓</span>
          </div>
        </div>
        <button v-if="p.ghin_number" class="player-info-btn" @click.stop="openPlayerSheet(p)" title="GHIN info">⛳</button>
        <button v-if="p.email" class="player-invite-btn" @click.stop="invitePlayer(p)" title="Invite to GolfWizard">📨</button>
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

    <!-- Edit modal -->
    <PlayerEditModal
      v-model="editTarget"
      :searching="ghinSearching"
      :search-results="ghinSearchResults"
      :search-msg="ghinSearchMsg"
      :saving="editSaving"
      :edit-error="editError"
      @search-ghin="handleEditGhinSearch"
      @apply-result="handleApplyResult"
      @save="handleSave"
    />

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRosterStore } from '../stores/roster'
import { buildInviteUrl, buildInviteEmail } from '../modules/preset'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../supabase'
import GhinSheet from '../components/GhinSheet.vue'
import PlayerSheet from '../components/PlayerSheet.vue'
import PlayerEditModal from '../components/PlayerEditModal.vue'

const rosterStore = useRosterStore()
const authStore = useAuthStore()

// ── GHIN sync dot helpers ────────────────────────────────────────
function ghinSyncStatus(p) {
  if (!p.ghin_synced_at) return 'dot-none'
  const hoursAgo = (Date.now() - new Date(p.ghin_synced_at).getTime()) / (1000 * 60 * 60)
  if (hoursAgo < 26) return 'dot-blue'
  if (hoursAgo < 72) return 'dot-yellow'
  return 'dot-red'
}
function ghinSyncTitle(p) {
  if (!p.ghin_synced_at) return 'Not synced'
  const hoursAgo = Math.round((Date.now() - new Date(p.ghin_synced_at).getTime()) / (1000 * 60 * 60))
  if (hoursAgo < 2) return 'Synced recently'
  if (hoursAgo < 26) return `Synced ${hoursAgo}h ago`
  const days = Math.floor(hoursAgo / 24)
  return `Synced ${days}d ago`
}

// ── Sync All GHIN ────────────────────────────────────────────────
const ghinSyncing = ref(false)
const syncMsg = ref('')
const syncMsgType = ref('success')
const multipleMatchPlayer = ref(null)
const multipleMatchQueue = ref([])

async function syncAllGhin() {
  const profile = authStore.profile
  if (!profile?.ghin_number || !profile?.ghin_password) {
    syncMsg.value = 'Add GHIN credentials in Settings → Profile to sync handicaps.'
    syncMsgType.value = 'warn'
    setTimeout(() => { syncMsg.value = '' }, 4000)
    return
  }
  ghinSyncing.value = true
  syncMsg.value = ''
  try {
    const toSync = rosterStore.players.filter(p => p.ghin_number)
    if (!toSync.length) { syncMsg.value = 'No players have GHIN numbers linked.'; syncMsgType.value = 'info'; return }
    const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
      body: {
        ghin_number: profile.ghin_number,
        password: profile.ghin_password,
        state: 'NY',
        players: toSync.map(p => ({ id: p.id, name: p.name, ghin_number: p.ghin_number })),
      }
    })
    if (error) throw error
    const results = data?.results || []
    const updated = results.filter(r => r.status === 'updated' || r.status === 'found')
    const multiple = results.filter(r => r.status === 'multiple_matches')
    for (const r of updated) {
      await rosterStore.updatePlayer(r.player_id, {
        ghin_index: r.handicap_index,
        ghin_synced_at: new Date().toISOString(),
        low_hi: r.low_hi || undefined,
        club_name: r.club_name || undefined,
        soft_cap: r.soft_cap,
        hard_cap: r.hard_cap,
      })
    }
    if (multiple.length) {
      multipleMatchQueue.value = multiple
      advanceMultipleQueue()
    }
    syncMsg.value = `✓ Synced ${updated.length} of ${toSync.length} players`
    syncMsgType.value = updated.length === toSync.length ? 'success' : 'warn'
  } catch (e) {
    syncMsg.value = e?.message || 'Sync failed'
    syncMsgType.value = 'error'
  } finally {
    ghinSyncing.value = false
    setTimeout(() => { syncMsg.value = '' }, 5000)
  }
}

function advanceMultipleQueue() {
  if (!multipleMatchQueue.value.length) { multipleMatchPlayer.value = null; return }
  multipleMatchPlayer.value = multipleMatchQueue.value.shift()
}

async function selectMatch(playerId, golfer) {
  await rosterStore.updatePlayer(playerId, {
    ghin_index: golfer.handicap_index,
    ghin_number: golfer.ghin_number,
    ghin_synced_at: new Date().toISOString(),
    club_name: golfer.club_name || undefined,
  })
  advanceMultipleQueue()
}

// ── Invite ───────────────────────────────────────────────────────
const inviteHint = ref('')
function invitePlayer(player) {
  const url = buildInviteUrl(player.id)
  const body = buildInviteEmail(player.name, url)
  window.open(`mailto:${player.email}?subject=Join me on GolfWizard&body=${encodeURIComponent(body)}`)
}
async function shareGroupInvite() {
  const url = buildInviteUrl()
  if (navigator.share) {
    await navigator.share({ title: 'GolfWizard', text: 'Join our golf group!', url })
  } else {
    await navigator.clipboard.writeText(url)
    showInviteHint('Link copied!')
  }
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
const sortMode = ref('name')
const sortLabel = computed(() => sortMode.value === 'name' ? 'A–Z' : 'Added')
function toggleSort() { sortMode.value = sortMode.value === 'name' ? 'added' : 'name' }
function sortByLastName(arr) {
  if (sortMode.value !== 'name') return arr
  return [...arr].sort((a, b) => {
    const la = (a.last_name || a.name?.split(' ').pop() || '').toLowerCase()
    const lb = (b.last_name || b.name?.split(' ').pop() || '').toLowerCase()
    return la.localeCompare(lb)
  })
}
const favoritePlayers = computed(() => sortByLastName(rosterStore.players.filter(p => p.is_favorite)))
const otherPlayers = computed(() => sortByLastName(rosterStore.players.filter(p => !p.is_favorite)))

// ── You section + GHIN sheet ─────────────────────────────────────
const showGhinSheet = ref(false)
const ghinScores = ref([])
const ghinScoresLoading = ref(false)
const ghinScoresFetched = ref(false)
const ghinScoresError = ref('')
const ghinScoresPosted = ref(null)
const ghinScoreStats = ref(null)
const ghinAggStats = ref(null)
const playerSheetTarget = ref(null)
function openPlayerSheet(p) { playerSheetTarget.value = p }
const ghinLiveHI = ref(null)
const ghinLiveLowHI = ref(null)

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

const myRosterPlayer = computed(() => {
  const profile = authStore.profile
  if (!profile) return null
  const name = profile.display_name || ''
  const ghinNum = profile.ghin_number
  const email = authStore.user?.email?.toLowerCase().trim()
  return rosterStore.players.find(p =>
    (ghinNum && p.ghin_number && String(p.ghin_number) === String(ghinNum)) ||
    (email && p.email?.toLowerCase().trim() === email) ||
    (name && name.includes(' ') && p.name?.toLowerCase() === name.toLowerCase())
  ) || null
})

function ghinSyncDate(p) {
  if (!p.ghin_synced_at) return '—'
  const d = new Date(p.ghin_synced_at)
  const diffDays = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function openGhinSheet() {
  showGhinSheet.value = true
  if (!ghinScores.value.length && !ghinScoresLoading.value) fetchGhinScores()
}

async function fetchGhinScores() {
  const profile = authStore.profile
  if (!profile?.ghin_number || !profile?.ghin_password) return
  ghinScoresLoading.value = true
  ghinScoresError.value = ''
  try {
    const player = myRosterPlayer.value
    const { data, error } = await supabase.functions.invoke('ghin-scores', {
      body: {
        ghin_number: String(profile.ghin_number),
        password: profile.ghin_password,
        player_id: player?.id || undefined,
      }
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    ghinScores.value = data.scores || []
    ghinScoresPosted.value = data.scores_posted ?? null
    ghinScoreStats.value = data.score_stats ?? null
    ghinAggStats.value  = data.aggregate_stats ?? null
    ghinLiveHI.value = data.handicap_index ?? null
    ghinLiveLowHI.value = data.low_hi_display ?? null
    ghinScoresFetched.value = true
    if (player?.id) await rosterStore.fetchPlayers()
  } catch (e) {
    ghinScoresError.value = e?.message || 'Failed to load scores'
  } finally {
    ghinScoresLoading.value = false
  }
}

async function addSearchGhin() {
  const first = newFirst.value.trim()
  const last = newLast.value.trim()
  if (!last) { addGhinMsg.value = 'Enter at least a last name to search'; return }
  addGhinSearching.value = true
  addGhinResults.value = []
  addGhinMsg.value = ''
  try {
    const { data: bbRows } = await supabase
      .from('bb_member_index')
      .select('ghin_number, first_name, last_name, handicap_index')
      .ilike('last_name', `%${last}%`)
      .order('last_name').limit(15)
    let filtered = bbRows || []
    if (first && filtered.length > 0) {
      const fl = first.toLowerCase()
      const exact = filtered.filter(p => p.first_name?.toLowerCase().startsWith(fl))
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
    const profile = authStore.profile
    if (!profile?.ghin_number || !profile?.ghin_password) {
      addGhinMsg.value = 'Not found in BB directory. Add GHIN credentials in Profile to search the full GHIN database.'
      return
    }
    const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
      body: {
        ghin_number: profile.ghin_number,
        password: profile.ghin_password,
        players: [{ id: 'lookup', name: `${first || ''} ${last}`.trim(), first_name_prefix: first || '' }],
      }
    })
    if (error) throw error
    const results = data?.results?.filter(r => r.status === 'updated') || []
    if (results.length) {
      addGhinResults.value = results.map(r => ({ ghin_number: r.ghin_number, full_name: r.full_name, handicap_index: r.handicap_index, club_name: r.club_name || '' }))
    } else {
      addGhinMsg.value = `No golfer found for "${first ? first + ' ' : ''}${last}". Enter HCP manually or type their GHIN # directly.`
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
      name: fullName, first_name: first, last_name: last || null,
      short_name: last || first.slice(0, 8),
      ghin_index: newGhin.value !== '' ? parseFloat(newGhin.value) : null,
      ghin_number: newGhinNumber.value || null,
      nickname: newNickname.value.trim() || null,
      email: newEmail.value.trim() || null,
      use_nickname: false, is_favorite: true,
    })
    newFirst.value = ''; newLast.value = ''; newGhin.value = ''; newNickname.value = ''; newEmail.value = ''; newGhinNumber.value = null
    showAdd.value = false
    showToast(`${fullName} added`, 'gold')
  } catch (err) {
    addError.value = err?.message || 'Could not add player.'
  } finally {
    addingPlayer.value = false
  }
}

// ── Swipe ────────────────────────────────────────────────────────
const swiping = ref(null)
const swipeX = ref({})
const swipeStartX = ref(0)
const SWIPE_THRESHOLD = 80

function swipeContainerStyle(id) { return {} }
function swipeCardStyle(id) {
  const x = swipeX.value[id] || 0
  return x !== 0 ? { transform: `translateX(${x}px)` } : {}
}
function swipeRevealOpacity(id, side) {
  const x = swipeX.value[id] || 0
  if (side === 'left' && x < 0) return Math.min(1, Math.abs(x) / SWIPE_THRESHOLD)
  if (side === 'right' && x > 0) return Math.min(1, x / SWIPE_THRESHOLD)
  return 0
}
function onSwipeStart(e, id) {
  swiping.value = id
  swipeStartX.value = e.touches[0].clientX
  if (!swipeX.value[id]) swipeX.value[id] = 0
}
function onSwipeMove(e, id) {
  if (swiping.value !== id) return
  const dx = e.touches[0].clientX - swipeStartX.value
  swipeX.value = { ...swipeX.value, [id]: dx }
}
async function onSwipeEnd(e, player) {
  const id = player.id
  const x = swipeX.value[id] || 0
  if (x < -SWIPE_THRESHOLD) {
    confirmDelete(id, player.name)
  } else if (x > SWIPE_THRESHOLD) {
    const wasFav = player.is_favorite
    await rosterStore.updatePlayer(id, { is_favorite: !wasFav })
    showToast(wasFav ? 'Removed from favorites' : '★ Added to favorites!', wasFav ? 'neutral' : 'gold')
  }
  swipeX.value = { ...swipeX.value, [id]: 0 }
  swiping.value = null
}

// ── Toast ────────────────────────────────────────────────────────
const toastMsg = ref('')
const toastType = ref('neutral')
let toastTimer = null
function showToast(msg, type = 'neutral') {
  toastMsg.value = msg; toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}

// ── Delete ───────────────────────────────────────────────────────
const deleteConfirmId = ref(null)
const deleteConfirmName = ref('')
function confirmDelete(id, name) { deleteConfirmId.value = id; deleteConfirmName.value = name }
async function performDelete() {
  const id = deleteConfirmId.value
  deleteConfirmId.value = null
  await rosterStore.deletePlayer(id)
  showToast('Player deleted', 'neutral')
}

// ── Edit (delegated to PlayerEditModal) ──────────────────────────
const editTarget = ref(null)
const ghinSearching = ref(false)
const ghinSearchResults = ref([])
const ghinSearchMsg = ref('')
const editSaving = ref(false)
const editError = ref('')

function startEdit(p) {
  ghinSearchResults.value = []
  ghinSearchMsg.value = ''
  editError.value = ''
  editTarget.value = p
}

async function handleEditGhinSearch({ first, last, ghinNumber, prefix }) {
  if (ghinSearching.value) return
  ghinSearching.value = true
  ghinSearchResults.value = []
  ghinSearchMsg.value = ''
  try {
    if (ghinNumber) {
      const { data: bbRows } = await supabase.from('bb_member_index')
        .select('ghin_number, first_name, last_name, handicap_index')
        .eq('ghin_number', ghinNumber).limit(1)
      if (bbRows?.length) {
        const bb = bbRows[0]
        ghinSearchResults.value = [{ ghin_number: bb.ghin_number, full_name: `${bb.first_name} ${bb.last_name}`, handicap_index: bb.handicap_index, club_name: 'Bonnie Briar Country Club', _source: 'bb' }]
        ghinSearchMsg.value = '🏌️ Found in Bonnie Briar directory'
        return
      }
    } else if (last) {
      const { data: bbRows } = await supabase.from('bb_member_index')
        .select('ghin_number, first_name, last_name, handicap_index')
        .ilike('last_name', `%${last}%`).order('last_name').limit(15)
      let filtered = bbRows || []
      if (first && filtered.length > 0) {
        const fl = first.toLowerCase()
        const exact = filtered.filter(p => p.first_name?.toLowerCase().startsWith(fl))
        if (exact.length > 0) filtered = exact
      }
      if (filtered.length > 0) {
        ghinSearchResults.value = filtered.map(bb => ({ ghin_number: bb.ghin_number, full_name: `${bb.first_name} ${bb.last_name}`, handicap_index: bb.handicap_index, club_name: 'Bonnie Briar Country Club', _source: 'bb' }))
        ghinSearchMsg.value = `🏌️ ${filtered.length} match${filtered.length > 1 ? 'es' : ''} in Bonnie Briar directory`
        return
      }
    }
    const profile = authStore.profile
    if (!profile?.ghin_number || !profile?.ghin_password) {
      ghinSearchMsg.value = first && last ? 'Not found in BB directory. Add GHIN credentials in Profile to search the full GHIN database.' : 'Enter a GHIN # or first + last name'
      return
    }
    if (ghinNumber) {
      const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
        body: { ghin_number: profile.ghin_number, password: profile.ghin_password, players: [{ id: 'lookup', name: `${first} ${last}`.trim() || 'Unknown', ghin_number: ghinNumber }] }
      })
      if (error) throw error
      const r = data?.results?.[0]
      if (r?.status === 'updated') {
        ghinSearchResults.value = [{ ghin_number: r.ghin_number, full_name: r.full_name, handicap_index: r.handicap_index, club_name: r.club_name }]
      } else {
        ghinSearchMsg.value = `No golfer found for GHIN # ${ghinNumber}`
      }
      return
    }
    if (!first || !last) { ghinSearchMsg.value = 'Enter a GHIN # or first + last name'; return }
    const { data, error } = await supabase.functions.invoke('ghin-roster-sync', {
      body: { ghin_number: profile.ghin_number, password: profile.ghin_password, players: [{ id: 'lookup', name: `${first} ${last}`, first_name_prefix: prefix || first }] }
    })
    if (error) throw error
    const r = data?.results?.[0]
    if (!r) throw new Error('No response')
    if (r.status === 'updated') {
      ghinSearchResults.value = [{ ghin_number: r.ghin_number, full_name: r.full_name, handicap_index: r.handicap_index, club_name: r.club_name }]
    } else if (r.status === 'multiple_matches') {
      ghinSearchResults.value = r.matches ?? []
      ghinSearchMsg.value = ghinSearchResults.value.length ? `Found ${ghinSearchResults.value.length} golfers named "${last}" — select one:` : `No GHIN record found for "${first} ${last}".`
    } else {
      ghinSearchMsg.value = `No GHIN record found for "${first} ${last}". Try entering their GHIN # directly.`
    }
  } catch (e) {
    ghinSearchMsg.value = e?.message || 'Search failed'
  } finally {
    ghinSearching.value = false
  }
}

function handleApplyResult(r) {
  ghinSearchResults.value = []
  ghinSearchMsg.value = `✓ Selected ${r.full_name}`
}

async function handleSave({ id, first, last, ghinIndex, ghinNumber, nickname, useNickname, email, prevGhinNumber }) {
  editError.value = ''
  if (!first) { editError.value = 'First name is required.'; return }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { editError.value = 'Email looks invalid.'; return }
  const fullName = last ? `${first} ${last}` : first
  const ghinNumberChanged = ghinNumber && ghinNumber !== prevGhinNumber
  editSaving.value = true
  try {
    await rosterStore.updatePlayer(id, {
      name: fullName, first_name: first, last_name: last || null,
      short_name: last || first.slice(0, 8),
      ghin_index: ghinIndex !== '' ? parseFloat(ghinIndex) : null,
      ghin_number: ghinNumber,
      nickname: nickname || null, use_nickname: useNickname,
      email: email || null,
    })
    editTarget.value = null
    if (ghinNumberChanged) {
      const profile = authStore.profile
      if (profile?.ghin_number && profile?.ghin_password) _autoSyncGhinNumber(id, ghinNumber, profile)
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
      body: { ghin_number: profile.ghin_number, password: profile.ghin_password, state: 'NY', players: [{ id: playerId, name: '', ghin_number: ghinNumber }] }
    })
    if (error || data?.error) return
    const r = data?.results?.[0]
    if (r?.status === 'found') {
      await rosterStore.updatePlayer(playerId, { ghin_index: r.handicap_index, ghin_synced_at: new Date().toISOString(), low_hi: r.low_hi || undefined, club_name: r.club_name || undefined })
      showToast(`HCP synced: ${r.handicap_index}`, 'green')
    }
  } catch { /* silent */ }
}
</script>

<style scoped>
/* ── Rest of styles (unchanged) ─────────────────────────────── */
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.view-header h2 { font-size: 22px; font-weight: 700; margin: 0; color: var(--gw-text); }
.header-actions { display: flex; gap: 6px; align-items: center; }
.sort-btn, .invite-all-btn { font-size: 11px; padding: 5px 9px; opacity: .75; }
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
  margin-bottom: 4px; background: rgba(255,255,255,.04);
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
  padding: 10px 14px;
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

.player-card--you {
  border-color: rgba(34,160,107,.4);
  background: rgba(34,160,107,.06);
}
.you-badge {
  font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
  background: rgba(34,160,107,.2); color: #4ade80;
  padding: 1px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle;
}
.you-meta {
  font-size: 12px; color: var(--gw-text-muted, rgba(240,237,224,.5)); margin-top: 2px;
}
.you-sync-time { opacity: .7; }
.you-no-ghin { opacity: .5; font-style: italic; }
.player-card--you .player-info { min-width: 0; overflow: hidden; }
.player-card--you .player-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ghin-sheet-btn {
  flex-shrink: 0; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
  border: 1px solid rgba(34,160,107,.5); background: rgba(34,160,107,.15);
  color: #4ade80; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.ghin-sheet-btn:active { background: rgba(34,160,107,.3); }
.player-info-btn {
  flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
  background: rgba(34,160,107,.15); border: 1px solid rgba(34,160,107,.3);
  font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.player-info-btn:active { background: rgba(34,160,107,.3); }

</style>
