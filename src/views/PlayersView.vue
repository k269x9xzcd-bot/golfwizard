<template>
  <div class="players-view">
    <header class="view-header">
      <h2>Players</h2>
      <button class="btn-ghost btn-sm" @click="showAdd = !showAdd">{{ showAdd ? 'Cancel' : '+ Add' }}</button>
    </header>

    <!-- Add form -->
    <div v-if="showAdd" class="add-form card">
      <div class="name-row">
        <input v-model="newFirst" class="wiz-input" placeholder="First name" />
        <input v-model="newLast" class="wiz-input" placeholder="Last name" />
      </div>
      <input v-model="newGhin" class="wiz-input" placeholder="GHIN Index (e.g. 14.2)" type="number" step="0.1" />
      <button class="btn-primary btn-sm" @click="add">Add Player</button>
    </div>

    <!-- Favorites section -->
    <div v-if="favoritePlayers.length" class="section-label">Favorites</div>
    <div
      v-for="p in favoritePlayers"
      :key="p.id"
      class="swipe-container"
    >
      <div class="swipe-action swipe-action-delete">🗑 Delete</div>
      <div class="swipe-action swipe-action-unfav">☆ Unfavorite</div>
      <div
        class="player-card player-card--fav"
        :style="{ transform: `translateX(${swipeX[p.id] || 0}px)`, transition: swiping === p.id ? 'none' : 'transform .25s ease' }"
        @touchstart="onSwipeStart($event, p.id)"
        @touchmove="onSwipeMove($event, p.id)"
        @touchend="onSwipeEnd($event, p)"
      >
        <div class="player-info" @click="startEdit(p)">
          <div class="player-name">{{ p.name }}</div>
          <div class="player-meta">
            <span class="player-ghin">GHIN {{ p.ghin_index != null ? p.ghin_index : '—' }}</span>
            <span class="player-fav-badge">★ Saved</span>
          </div>
        </div>
      </div>
    </div>

    <!-- All players section -->
    <div v-if="otherPlayers.length" class="section-label">All Players</div>
    <div
      v-for="p in otherPlayers"
      :key="p.id"
      class="swipe-container"
    >
      <div class="swipe-action swipe-action-delete">🗑 Delete</div>
      <div class="swipe-action swipe-action-fav">★ Favorite</div>
      <div
        class="player-card"
        :style="{ transform: `translateX(${swipeX[p.id] || 0}px)`, transition: swiping === p.id ? 'none' : 'transform .25s ease' }"
        @touchstart="onSwipeStart($event, p.id)"
        @touchmove="onSwipeMove($event, p.id)"
        @touchend="onSwipeEnd($event, p)"
      >
        <div class="player-info" @click="startEdit(p)">
          <div class="player-name">{{ p.name }}</div>
          <div class="player-meta">
            <span class="player-ghin">GHIN {{ p.ghin_index != null ? p.ghin_index : '—' }}</span>
          </div>
        </div>
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
          <div class="edit-footer">
            <button class="btn-ghost" @click="editTarget = null">Cancel</button>
            <button class="btn-primary" @click="saveEdit">Save</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRosterStore } from '../stores/roster'

const rosterStore = useRosterStore()

const showAdd = ref(false)
const newFirst = ref('')
const newLast = ref('')
const newGhin = ref('')

const favoritePlayers = computed(() => rosterStore.players.filter(p => p.is_favorite))
const otherPlayers = computed(() => rosterStore.players.filter(p => !p.is_favorite))

async function add() {
  const first = newFirst.value.trim()
  const last = newLast.value.trim()
  if (!first) return
  const fullName = last ? `${first} ${last}` : first
  await rosterStore.addPlayer({
    name: fullName,
    short_name: last || first.slice(0, 8),
    ghin_index: newGhin.value !== '' ? parseFloat(newGhin.value) : null,
    is_favorite: true,
  })
  newFirst.value = ''; newLast.value = ''; newGhin.value = ''; showAdd.value = false
}

// ── Swipe gestures ──────────────────────────────────────────────
const swipeX = reactive({})
const swiping = ref(null)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const SWIPE_THRESHOLD = 80

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

function onSwipeEnd(e, player) {
  const id = player.id
  const dx = swipeX[id] || 0
  swiping.value = null

  if (dx < -SWIPE_THRESHOLD) {
    // Swipe left → delete
    swipeX[id] = 0
    confirmDelete(id, player.name)
  } else if (dx > SWIPE_THRESHOLD) {
    // Swipe right → toggle favorite
    swipeX[id] = 0
    rosterStore.toggleFavorite(id)
    if (player.is_favorite) {
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

function startEdit(p) {
  editTarget.value = p
  const parts = p.name.trim().split(' ')
  editFirst.value = parts[0] || ''
  editLast.value = parts.slice(1).join(' ')
  editGhin.value = p.ghin_index ?? ''
}

async function saveEdit() {
  if (!editFirst.value.trim()) return
  const fullName = editLast.value.trim()
    ? `${editFirst.value.trim()} ${editLast.value.trim()}`
    : editFirst.value.trim()
  await rosterStore.updatePlayer(editTarget.value.id, {
    name: fullName,
    short_name: editLast.value.trim() || editFirst.value.trim().slice(0, 8),
    ghin_index: editGhin.value !== '' ? parseFloat(editGhin.value) : null,
  })
  editTarget.value = null
}
</script>

<style scoped>
.players-view { padding: 16px; padding-bottom: 80px; }
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.view-header h2 { font-size: 22px; font-weight: 700; margin: 0; color: var(--gw-text); }

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
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(240,237,224,.6);
  padding: 8px 4px 6px; margin-top: 8px;
}

/* ── Swipe container ────────────────────────────────── */
.swipe-container {
  position: relative; overflow: hidden; border-radius: 14px; margin-bottom: 8px;
}
.swipe-action {
  position: absolute; top: 0; bottom: 0; width: 120px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; letter-spacing: .02em;
}
.swipe-action-delete {
  left: 0; background: linear-gradient(90deg, #dc2626 0%, #b91c1c 100%); color: white;
  border-radius: 14px 0 0 14px;
}
.swipe-action-fav {
  right: 0; background: linear-gradient(270deg, #ca8a04 0%, #a16207 100%); color: white;
  border-radius: 0 14px 14px 0;
}
.swipe-action-unfav {
  right: 0; background: linear-gradient(270deg, rgba(240,237,224,.15) 0%, rgba(240,237,224,.08) 100%);
  color: rgba(240,237,224,.6); border-radius: 0 14px 14px 0;
}

/* ── Player Card (higher contrast) ─────────────────── */
.player-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: var(--gw-card-bg, rgba(255,255,255,.04));
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 14px;
  position: relative; z-index: 1;
  -webkit-tap-highlight-color: transparent;
}
.player-card--fav {
  border-color: rgba(212,175,55,.25);
  background: rgba(212,175,55,.04);
}

.player-info { flex: 1; cursor: pointer; }
.player-name {
  font-weight: 700; font-size: 16px; color: #f0ede0;
  letter-spacing: -.01em;
}
.player-meta {
  display: flex; align-items: center; gap: 8px; margin-top: 2px;
}
.player-ghin {
  font-size: 13px; color: rgba(240,237,224,.6); font-weight: 500;
}
.player-fav-badge {
  font-size: 10px; font-weight: 700; color: #d4af37;
  background: rgba(212,175,55,.12); border: 1px solid rgba(212,175,55,.25);
  padding: 1px 7px; border-radius: 10px;
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
</style>
