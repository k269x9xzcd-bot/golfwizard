<template>
  <div class="players-view">
    <header class="view-header">
      <h2>Players</h2>
      <div class="header-actions">
        <button class="btn-ghost btn-sm sort-btn" @click="toggleSort" :title="sortLabel">⇅ {{ sortLabel }}</button>
        <button class="btn-ghost btn-sm invite-all-btn" @click="shareGroupInvite" title="Invite a player to GolfWizard">📨 Invite</button>
        <button class="btn-ghost btn-sm" @click="showAdd = !showAdd">{{ showAdd ? 'Cancel' : '+ Add' }}</button>
      </div>
    </header>

    <!-- Invite hint (shown briefly after tapping Invite) -->
    <div v-if="inviteHint" class="invite-hint-banner">
      {{ inviteHint }}
    </div>

    <!-- Add form -->
    <div v-if="showAdd" class="add-form card">
      <div class="name-row">
        <input v-model="newFirst" class="wiz-input" placeholder="First name" />
        <input v-model="newLast" class="wiz-input" placeholder="Last name" />
      </div>
      <input v-model="newGhin" class="wiz-input" placeholder="GHIN Index (e.g. 14.2)" type="number" step="0.1" />
      <input v-model="newNickname" class="wiz-input" placeholder="Nickname (optional, e.g. Wang)" />
      <input v-model="newEmail"    class="wiz-input" placeholder="Email address" type="email" autocomplete="email" />
      <div v-if="addError" class="edit-error">{{ addError }}</div>
      <button class="btn-primary btn-sm" :disabled="addingPlayer" @click="add">
        {{ addingPlayer ? 'Adding…' : 'Add Player' }}
      </button>
    </div>

    <!-- Favorites section -->
    <div v-if="favoritePlayers.length" class="section-label">
      Favorites <span class="swipe-hint">← delete &nbsp;·&nbsp; unfav →</span>
    </div>
    <div
      v-for="p in favoritePlayers"
      :key="p.id"
      class="swipe-container"
      :style="swipeContainerStyle(p.id)"
    >
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
          <div class="player-name">{{ p.name }}</div>
          <div class="player-meta">
            <span class="player-ghin">GHIN {{ p.ghin_index != null ? p.ghin_index : '—' }}</span>
            <span v-if="p.nickname" class="player-nick-badge" :class="{ active: p.use_nickname }">{{ p.nickname }}</span>
            <span v-if="p.email" class="player-email-check" :title="p.email">✓ email</span>
          </div>
        </div>
        <button v-if="p.email && authStore.isAuthenticated" class="player-challenge-btn" @click.stop="challengePlayer(p)" title="Challenge to cross-match">⚔️</button>
        <button v-if="p.email" class="player-invite-btn" @click.stop="invitePlayer(p)" title="Invite to GolfWizard">📨</button>
        <span class="player-fav-star">★</span>
      </div>
    </div>

    <!-- All players section -->
    <div v-if="otherPlayers.length" class="section-label">
      All Players <span class="swipe-hint">← delete &nbsp;·&nbsp; favorite →</span>
    </div>
    <div
      v-for="p in otherPlayers"
      :key="p.id"
      class="swipe-container"
      :style="swipeContainerStyle(p.id)"
    >
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
          <div class="player-name">{{ p.name }}</div>
          <div class="player-meta">
            <span class="player-ghin">GHIN {{ p.ghin_index != null ? p.ghin_index : '—' }}</span>
            <span v-if="p.nickname" class="player-nick-badge" :class="{ active: p.use_nickname }">{{ p.nickname }}</span>
            <span v-if="p.email" class="player-email-check" :title="p.email">✓ email</span>
          </div>
        </div>
        <button v-if="p.email && authStore.isAuthenticated" class="player-challenge-btn" @click.stop="challengePlayer(p)" title="Challenge to cross-match">⚔️</button>
        <button v-if="p.email" class="player-invite-btn" @click.stop="invitePlayer(p)" title="Invite to GolfWizard">📨</button>
      </div>
    </div>

    <div v-if="rosterStore.players.length === 0" class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-text">No players yet — tap + Add above</div>
    </div>

    <!-- Swipe toast -->
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
          <div class="delete-message">
            Are you sure you want to delete <strong>{{ deleteConfirmName }}</strong>? This cannot be undone.
          </div>
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
          <input v-model="editGhin" class="wiz-input" placeholder="GHIN Index" type="number" step="0.1" />
          <div class="edit-nickname-row">
            <input v-model="editNickname" class="wiz-input" placeholder="Nickname (e.g. Wang)" style="flex:1" />
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

    <!-- Challenge modal -->
    <Teleport to="body">
      <div v-if="challengeTarget" class="delete-backdrop" @click.self="challengeTarget = null">
        <div class="delete-modal challenge-modal">
          <div class="challenge-modal-icon">⚔️</div>
          <div class="challenge-modal-title">Challenge {{ challengeTarget.name.split(' ')[0] }}?</div>
          <div class="challenge-modal-sub">
            They'll see a banner when they open GolfWizard. You both start your own rounds normally — the app links them automatically.
          </div>

          <!-- Format picker -->
          <div class="challenge-format-row">
            <button
              v-for="f in [{ id:'tbd', label:'Decide on 1st tee' }, { id:'1bb', label:'1-Ball Best Ball' }, { id:'2bb', label:'2-Ball Best Ball' }]"
              :key="f.id"
              class="challenge-format-btn"
              :class="{ active: challengeFormat === f.id }"
              @click="challengeFormat = f.id"
            >{{ f.label }}</button>
          </div>

          <div v-if="challengeError" class="edit-error">
            {{ challengeError }}
            <button v-if="challengeError.includes('hasn\'t joined')" class="challenge-invite-link" @click="sendInviteInstead">
              Send invite instead →
            </button>
          </div>

          <div class="delete-modal-actions">
            <button class="delete-modal-cancel" @click="challengeTarget = null">Cancel</button>
            <button class="delete-modal-confirm challenge-confirm-btn" :disabled="challengeSending" @click="sendChallenge">
              {{ challengeSending ? 'Sending…' : 'Send Challenge ⚔️' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRosterStore } from '../stores/roster'
import { useChallengesStore } from '../stores/challenges'
import { buildInviteUrl, buildInviteEmail } from '../modules/preset'
import { useAuthStore } from '../stores/auth'

const rosterStore = useRosterStore()
const authStore = useAuthStore()
const challengesStore = useChallengesStore()

// ── Invite players to GolfWizard ────────────────────────────────
const inviteHint = ref('')

function invitePlayer(player) {
  if (!player.email) return
  const senderName = authStore.profile?.display_name?.split(' ')[0] || 'Jason'
  const mailtoLink = buildInviteEmail(player, senderName)
  window.location.href = mailtoLink
  showInviteHint(`Invite sent to ${player.name.split(' ')[0]}!`)
}

async function shareGroupInvite() {
  const url = buildInviteUrl()
  const senderName = authStore.profile?.display_name?.split(' ')[0] || 'Jason'
  const text = `${senderName} invited you to GolfWizard — golf scoring with handicaps, Nassau, Skins, and more. Open this link to get started with our group already loaded:\n${url}`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Join GolfWizard', text, url })
    } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(url)
      showInviteHint('Invite link copied to clipboard!')
    } catch {
      showInviteHint(`Share this link: ${url}`)
    }
  }
}

// ── Challenge a player to a cross-match ─────────────────────────
const challengeTarget = ref(null)  // player being challenged
const challengeFormat = ref('tbd')
const challengeSending = ref(false)
const challengeError = ref('')

async function challengePlayer(player) {
  if (!player.email) return
  challengeTarget.value = player
  challengeFormat.value = 'tbd'
  challengeError.value = ''
}

async function sendChallenge() {
  if (!challengeTarget.value) return
  challengeSending.value = true
  challengeError.value = ''
  try {
    const senderName = authStore.profile?.display_name?.split(' ')[0] || 'Jason'
    await challengesStore.sendChallenge(challengeTarget.value, challengeFormat.value, senderName)
    showToast(`Challenge sent to ${challengeTarget.value.name.split(' ')[0]}!`, 'gold')
    challengeTarget.value = null
  } catch (e) {
    if (e?.message === 'no_account') {
      // No GolfWizard account — offer to send invite instead
      challengeError.value = `${challengeTarget.value.name.split(' ')[0]} hasn't joined GolfWizard yet.`
    } else if (e?.message === 'already_challenged') {
      challengeError.value = 'You already have a pending challenge with this player.'
    } else {
      challengeError.value = e?.message || 'Could not send challenge. Try again.'
    }
  } finally {
    challengeSending.value = false
  }
}

function sendInviteInstead() {
  const player = challengeTarget.value
  challengeTarget.value = null
  if (player) invitePlayer(player)
}

function showInviteHint(msg) {
  inviteHint.value = msg
  setTimeout(() => { inviteHint.value = '' }, 3000)
}

const showAdd = ref(false)
const newFirst = ref('')
const newLast = ref('')
const newGhin = ref('')
const newNickname = ref('')
const newEmail = ref('')

// Sort: 'added' (default) or 'name' (last name)
const sortMode = ref('name')
const sortLabel = computed(() => sortMode.value === 'name' ? 'A–Z' : 'Added')

function toggleSort() {
  sortMode.value = sortMode.value === 'name' ? 'added' : 'name'
}

function sortByLastName(arr) {
  if (sortMode.value !== 'name') return arr
  return [...arr].sort((a, b) => {
    const lastName = n => {
      const parts = (n.name || '').trim().split(' ')
      return (parts[parts.length - 1] || '').toLowerCase()
    }
    return lastName(a).localeCompare(lastName(b))
  })
}

const favoritePlayers = computed(() => sortByLastName(rosterStore.players.filter(p => p.is_favorite)))
const otherPlayers = computed(() => sortByLastName(rosterStore.players.filter(p => !p.is_favorite)))

const addError = ref('')
const addingPlayer = ref(false)

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
      short_name: last || first.slice(0, 8),
      ghin_index: newGhin.value !== '' ? parseFloat(newGhin.value) : null,
      nickname: newNickname.value.trim() || null,
      email: newEmail.value.trim() || null,
      use_nickname: false,
      is_favorite: true,
    })
    newFirst.value = ''; newLast.value = ''; newGhin.value = ''; newNickname.value = ''; newEmail.value = ''
    showAdd.value = false
    showToast(`${fullName} added`, 'gold')
  } catch (err) {
    addError.value = err?.message || 'Could not add player. Check your connection and try again.'
  } finally {
    addingPlayer.value = false
  }
}

// ── Swipe gestures ──────────────────────────────────────────────
const swipeX = reactive({})
const swiping = ref(null)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const SWIPE_THRESHOLD = 80

function swipeContainerStyle(id) {
  // Container just needs to clip the sliding card; no background needed now
  return {}
}

function swipeCardStyle(id) {
  const dx = swipeX[id] || 0
  if (dx < -10) {
    const t = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD)
    return {
      transform: `translateX(${dx}px)`,
      background: `rgba(185,28,28,${0.08 + t * 0.55})`,
      borderColor: `rgba(248,113,113,${t * 0.6})`,
    }
  } else if (dx > 10) {
    const t = Math.min(1, dx / SWIPE_THRESHOLD)
    return {
      transform: `translateX(${dx}px)`,
      background: `rgba(161,98,7,${0.08 + t * 0.55})`,
      borderColor: `rgba(212,175,55,${t * 0.6})`,
    }
  }
  return {
    transform: `translateX(${dx}px)`,
  }
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
  // Only allow horizontal swipe
  if (Math.abs(dy) > Math.abs(dx) * 0.8) return
  // Clamp: left up to -120, right up to 120
  swipeX[id] = Math.max(-120, Math.min(120, dx))
}

async function onSwipeEnd(e, player) {
  const id = player.id
  const dx = swipeX[id] || 0
  swiping.value = null

  if (dx < -SWIPE_THRESHOLD) {
    // Swipe left → delete
    swipeX[id] = 0
    confirmDelete(id, player.name)
  } else if (dx > SWIPE_THRESHOLD) {
    // Swipe right → toggle favorite
    const wasFav = player.is_favorite
    swipeX[id] = 0
    await rosterStore.toggleFavorite(id)
    if (wasFav) {
      showToast('Removed from favorites', 'neutral')
    } else {
      showToast('★ Added to favorites!', 'gold')
    }
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

// Delete confirmation
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

// Edit
const editTarget = ref(null)
const editFirst = ref('')
const editLast = ref('')
const editGhin = ref('')
const editNickname = ref('')
const editUseNickname = ref(false)
const editEmail = ref('')
const editError = ref('')
const editSaving = ref(false)

function startEdit(p) {
  editTarget.value = p
  const parts = p.name.trim().split(' ')
  editFirst.value = parts[0] || ''
  editLast.value = parts.slice(1).join(' ')
  editGhin.value = p.ghin_index ?? ''
  editNickname.value = p.nickname || ''
  editUseNickname.value = p.use_nickname || false
  editEmail.value = p.email || ''
  editError.value = ''
  editSaving.value = false
}

async function saveEdit() {
  editError.value = ''
  if (!editFirst.value.trim()) {
    editError.value = 'First name is required.'
    return
  }
  const emailTrimmed = editEmail.value.trim()
  if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    editError.value = 'Email looks invalid — double-check it.'
    return
  }
  const fullName = editLast.value.trim()
    ? `${editFirst.value.trim()} ${editLast.value.trim()}`
    : editFirst.value.trim()

  editSaving.value = true
  try {
    await rosterStore.updatePlayer(editTarget.value.id, {
      name: fullName,
      short_name: editLast.value.trim() || editFirst.value.trim().slice(0, 8),
      ghin_index: editGhin.value !== '' ? parseFloat(editGhin.value) : null,
      nickname: editNickname.value.trim() || null,
      use_nickname: editUseNickname.value,
      email: emailTrimmed || null,
    })
    editTarget.value = null
  } catch (e) {
    console.error('[players] saveEdit failed:', e)
    editError.value = e?.message || 'Could not save. Check your connection and try again.'
  } finally {
    editSaving.value = false
  }
}
</script>

<style scoped>
.players-view { padding: 16px; padding-bottom: 80px; }
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.view-header h2 { font-size: 22px; font-weight: 700; margin: 0; color: var(--gw-text); }
.header-actions { display: flex; gap: 8px; align-items: center; }
.sort-btn { font-size: 11px; padding: 5px 9px; opacity: .75; }

.add-form {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 16px; padding: 14px;
  background: var(--gw-card-bg);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
  border: 1px solid var(--gw-card-border);
}
.name-row { display: flex; gap: 8px; }
.name-row .wiz-input { flex: 1; }

.section-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(240,237,224,.6);
  padding: 10px 4px 4px; margin-top: 6px;
}
/* First section-label should hug the header */
.players-view .section-label:first-of-type { margin-top: 2px; }
.swipe-hint {
  font-size: 10px; font-weight: 500; letter-spacing: 0;
  color: rgba(240,237,224,.25); text-transform: none;
}

/* ── Swipe container ────────────────────────────────── */
.swipe-container {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 4px;
  background: rgba(255,255,255,.04);
  transition: background 0.05s linear;
}

/* Reveal labels behind the card */
.swipe-reveal {
  position: absolute; top: 0; bottom: 0;
  display: flex; align-items: center;
  font-size: 13px; font-weight: 700; letter-spacing: .04em;
  color: white; pointer-events: none; z-index: 0;
  transition: opacity 0.1s;
}
.swipe-reveal-left { left: 0; padding-left: 20px; }
.swipe-reveal-right { right: 0; padding-right: 20px; }

/* ── Player Card (slides on top of the action reveal) ─
   Single-row layout: [name …] [nickname] [GHIN N] [★]
   All on one line. No vertical stacking of the meta row. */
.player-card {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  position: relative; z-index: 1;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
}
.player-card--fav {
  border-color: rgba(212,175,55,.2);
  background: rgba(255,255,255,.04);
}

.player-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  /* Name + meta now inline on one row — no more stacking */
}
.player-name {
  font-weight: 600; font-size: 15px; color: #f0ede0;
  letter-spacing: -.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
}
.player-meta {
  display: flex; align-items: center; gap: 6px;
  margin-top: 0;
  margin-left: auto;
  flex-shrink: 0;
}
.player-ghin {
  font-size: 11px; color: rgba(240,237,224,.55); font-weight: 600;
  letter-spacing: .01em;
}
/* Fav star — right side */
.player-fav-star {
  font-size: 14px; color: #d4af37; flex-shrink: 0;
  line-height: 1;
}

.empty-state { text-align: center; padding: 40px 20px; color: rgba(240,237,224,.5); }
.empty-icon { font-size: 40px; margin-bottom: 8px; }

/* ── Toast ──────────────────────────────────────────── */
.swipe-toast {
  position: fixed; bottom: calc(var(--gw-nav-height, 60px) + env(safe-area-inset-bottom) + 16px);
  left: 50%; transform: translateX(-50%);
  padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 600;
  z-index: 400; pointer-events: none;
  background: rgba(30,40,30,.92); color: #f0ede0;
  border: 1px solid rgba(255,255,255,.1);
  backdrop-filter: blur(8px);
}
.swipe-toast.gold { color: #d4af37; border-color: rgba(212,175,55,.3); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

/* Delete confirmation modal */
.delete-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  z-index: 300; display: flex; align-items: center; justify-content: center;
}
.delete-modal {
  background: var(--gw-neutral-900, #111a14); border-radius: 16px;
  padding: 24px 20px; max-width: 320px; width: 90%;
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 8px 30px rgba(0,0,0,.5);
}
.delete-header {
  font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #f0ede0;
}
.delete-message {
  font-size: 14px; color: rgba(240,237,224,.7); margin-bottom: 20px; line-height: 1.5;
}
.delete-message strong { color: #f0ede0; font-weight: 700; }
.delete-footer { display: flex; gap: 10px; }
.delete-footer .btn-ghost, .delete-footer .btn-danger { flex: 1; }

.btn-danger {
  background: #ef4444; color: white; border: none;
  padding: 12px 16px; border-radius: 10px; font-weight: 700;
  cursor: pointer; font-size: 14px; transition: all .15s;
}
.btn-danger:active { background: #dc2626; transform: scale(.97); }

/* Edit overlay */
.edit-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.65);
  z-index: 200; display: flex; align-items: flex-end;
}
.edit-sheet {
  width: 100%; background: var(--gw-neutral-900, #111a14); border-radius: 20px 20px 0 0;
  padding: 20px 16px 36px; display: flex; flex-direction: column; gap: 12px;
  border: 1px solid rgba(255,255,255,.12); border-bottom: none;
}
.edit-header { display: flex; justify-content: space-between; align-items: center; }
.edit-title { font-size: 17px; font-weight: 700; color: #f0ede0; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: rgba(240,237,224,.5); }
.edit-footer { display: flex; gap: 10px; margin-top: 4px; }
.edit-footer .btn-ghost, .edit-footer .btn-primary { flex: 1; }
.edit-footer button[disabled] { opacity: .55; cursor: wait; }
.edit-error {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3);
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.4;
}

.player-nick-badge {
  font-size: 10px; font-weight: 700;
  color: rgba(240,237,224,.4);
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  padding: 1px 7px; border-radius: 10px;
}
.player-nick-badge.active {
  color: #22a06b;
  background: rgba(34,160,107,.12);
  border-color: rgba(34,160,107,.3);
}
/* Invite button per player */
.player-invite-btn, .player-challenge-btn {
  font-size: 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 5px;
  border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  opacity: .7;
  transition: opacity .15s;
}
.player-invite-btn:active, .player-challenge-btn:active { opacity: 1; transform: scale(.9); }

/* Challenge modal extras */
.challenge-modal { text-align: center; }
.challenge-modal-icon { font-size: 32px; margin-bottom: 8px; }
.challenge-modal-title { font-size: 18px; font-weight: 800; color: var(--gw-text); margin-bottom: 8px; }
.challenge-modal-sub { font-size: 13px; color: rgba(240,237,224,.65); line-height: 1.45; margin-bottom: 16px; }
.challenge-format-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.challenge-format-btn {
  padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
  font-family: inherit; cursor: pointer;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.7); text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.challenge-format-btn.active {
  background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.5);
  color: #d4af37; font-weight: 800;
}
.challenge-confirm-btn { background: rgba(212,175,55,.2) !important; color: #d4af37 !important; border-color: rgba(212,175,55,.4) !important; }
.challenge-invite-link {
  display: block; margin-top: 8px; background: none; border: none;
  color: #d4af37; font-size: 12px; font-weight: 700; cursor: pointer;
  font-family: inherit; text-decoration: underline;
}

/* Header invite button */
.invite-all-btn { font-size: 11px !important; }

/* Invite feedback hint banner */
.invite-hint-banner {
  margin: 4px 16px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(34,197,94,.12);
  border: 1px solid rgba(34,197,94,.3);
  color: #4ade80;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  animation: card-in 200ms ease-out;
}

.player-email-check {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  color: #22c55e;
  background: rgba(34,197,94,.1);
  border: 1px solid rgba(34,197,94,.3);
  padding: 1px 7px;
  border-radius: 10px;
  white-space: nowrap;
}
.edit-nickname-row {
  display: flex; align-items: center; gap: 10px;
}
.nick-toggle-label {
  display: flex; align-items: center; gap: 6px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.nick-toggle-cb { width: 16px; height: 16px; accent-color: #22a06b; cursor: pointer; }
.nick-toggle-text { font-size: 12px; color: rgba(240,237,224,.6); }
</style>
