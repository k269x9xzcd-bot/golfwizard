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
    <div v-for="p in favoritePlayers" :key="p.id" class="player-card">
      <button class="fav-btn fav-btn--on" @click="rosterStore.toggleFavorite(p.id)">★</button>
      <div class="player-info" @click="startEdit(p)">
        <div class="player-name">{{ p.name }}</div>
        <div class="player-ghin">GHIN {{ p.ghin_index != null ? p.ghin_index : '—' }}</div>
      </div>
      <button class="delete-btn" @click="rosterStore.deletePlayer(p.id)">✕</button>
    </div>

    <!-- All players section -->
    <div v-if="otherPlayers.length" class="section-label">All Players</div>
    <div v-for="p in otherPlayers" :key="p.id" class="player-card player-card--dim">
      <button class="fav-btn" @click="rosterStore.toggleFavorite(p.id)">☆</button>
      <div class="player-info" @click="startEdit(p)">
        <div class="player-name">{{ p.name }}</div>
        <div class="player-ghin">GHIN {{ p.ghin_index != null ? p.ghin_index : '—' }}</div>
      </div>
      <button class="delete-btn" @click="rosterStore.deletePlayer(p.id)">✕</button>
    </div>

    <div v-if="rosterStore.players.length === 0" class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-text">No players yet — tap + Add above</div>
    </div>

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
import { ref, computed } from 'vue'
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

// Edit
const editTarget = ref(null)
const editFirst = ref('')
const editLast = ref('')
const editGhin = ref('')

function startEdit(p) {
  editTarget.value = p
  // Split name into first/last
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
.view-header h2 { font-size: 22px; font-weight: 700; margin: 0; }

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
  font-size: 11px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: var(--gw-text-muted);
  padding: 4px 4px 6px; margin-top: 8px;
}

.player-card {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; margin-bottom: 8px;
  border-radius: 12px;
  background: var(--gw-card-bg);
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
  border: 1px solid var(--gw-card-border);
}
.player-card--dim { opacity: 0.75; }

.fav-btn {
  font-size: 22px; background: none; border: none;
  cursor: pointer; padding: 0; line-height: 1;
  color: rgba(240, 237, 224, 0.3);
}
.fav-btn--on { color: var(--gw-gold); }

.player-info { flex: 1; cursor: pointer; }
.player-name { font-weight: 600; font-size: 15px; color: var(--gw-text); }
.player-ghin { font-size: 12px; color: var(--gw-text-muted); margin-top: 1px; }

.delete-btn {
  font-size: 13px; color: rgba(240, 237, 224, 0.3); background: none;
  border: none; cursor: pointer; padding: 4px;
}

.empty-state { text-align: center; padding: 40px 20px; color: var(--gw-text-muted); }
.empty-icon { font-size: 40px; margin-bottom: 8px; }

/* Edit overlay */
.edit-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  z-index: 200; display: flex; align-items: flex-end;
}
.edit-sheet {
  width: 100%; background: var(--gw-card-bg); border-radius: 20px 20px 0 0;
  padding: 20px 16px 36px; display: flex; flex-direction: column; gap: 12px;
  border: 1px solid var(--gw-card-border);
}
.edit-header { display: flex; justify-content: space-between; align-items: center; }
.edit-title { font-size: 17px; font-weight: 700; color: var(--gw-text); }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--gw-text-muted); }
.edit-footer { display: flex; gap: 10px; margin-top: 4px; }
.edit-footer .btn-ghost, .edit-footer .btn-primary { flex: 1; }
</style>
