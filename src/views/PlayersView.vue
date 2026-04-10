<template>
  <div class="view players-view">
    <header class="view-header">
      <h2>Players</h2>
      <button class="btn-ghost btn-sm" @click="showAdd = true">+ Add</button>
    </header>
    <div v-for="p in rosterStore.players" :key="p.id" class="player-card card">
      <div class="player-name">{{ p.name }}</div>
      <div class="player-hcp">HCP {{ p.ghin_index ?? '—' }}</div>
      <button class="fav-btn" @click="rosterStore.toggleFavorite(p.id)">
        {{ p.is_favorite ? '★' : '☆' }}
      </button>
    </div>
    <div v-if="showAdd" class="add-player-form card">
      <input v-model="newName" class="wiz-input" placeholder="Name" />
      <input v-model="newHcp" class="wiz-input" placeholder="GHIN index" type="number" />
      <button class="btn-primary btn-sm" @click="add">Add Player</button>
      <button class="btn-ghost btn-sm" @click="showAdd = false">Cancel</button>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { useRosterStore } from '../stores/roster'
const rosterStore = useRosterStore()
const showAdd = ref(false)
const newName = ref('')
const newHcp = ref('')
async function add() {
  if (!newName.value.trim()) return
  await rosterStore.addPlayer({ name: newName.value.trim(), short_name: newName.value.trim().slice(0,6), ghin_index: newHcp.value ? parseFloat(newHcp.value) : null })
  newName.value = ''; newHcp.value = ''; showAdd.value = false
}
</script>
