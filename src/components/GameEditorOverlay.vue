<template>
  <div v-if="show" class="delete-overlay" @click="$emit('close')">
    <div class="game-editor-panel" @click.stop>
      <div class="game-editor-header">
        <h3 class="game-editor-title">🎲 Edit Games</h3>
        <button class="close-btn-sm" @click="$emit('close')">✕</button>
      </div>

      <!-- Existing games -->
      <div v-for="game in roundsStore.activeGames" :key="game.id" class="ge-game-row">
        <div class="ge-game-info">
          <span class="ge-game-icon">{{ gameIcon(game.type) }}</span>
          <span class="ge-game-name">{{ gameLabel(game.type, game.config) }}</span>
        </div>
        <div class="ge-game-controls">
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
</template>

<script setup>
import { computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'

const props = defineProps({
  show: { type: Boolean, required: true },
  gameIcon: { type: Function, required: true },
  gameLabel: { type: Function, required: true },
})

const emit = defineEmits(['close'])

const roundsStore = useRoundsStore()

const addableGameTypes = computed(() => {
  const existing = new Set(roundsStore.activeGames.map(g => g.type?.toLowerCase()))
  const types = [
    { type: 'nassau',   icon: '💰', label: 'Nassau' },
    { type: 'skins',    icon: '💎', label: 'Skins' },
    { type: 'dots',     icon: '🎯', label: 'Dots' },
    { type: 'snake',    icon: '🐍', label: 'Snake' },
    { type: 'fidget',   icon: '😬', label: 'Fidget' },
    { type: 'match1v1', icon: '⚔️', label: '1v1 Match' },
    { type: 'bbn',      icon: '🏌️', label: 'Best Ball' },
    { type: 'vegas',    icon: '🎰', label: 'Vegas' },
    { type: 'wolf',     icon: '🐺', label: 'Wolf' },
  ]
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
    case 'skins':    config = { ppt: 5, players: memberIds }; break
    case 'dots':     config = { ppt: 1, birdieEnabled: true, eagleEnabled: true, greenieEnabled: true, sandieEnabled: true }; break
    case 'snake':    config = { ppt: 5 }; break
    case 'fidget':   config = { ppp: 10 }; break
    case 'match1v1': config = { player1: memberIds[0] ?? null, player2: memberIds[1] ?? null, ppt: 5 }; break
    case 'bbn':      config = { ballsToCount: 1, scoring: 'net', label: '1BB Net' }; break
    case 'vegas': {
      const half = Math.ceil(members.length / 2)
      config = { team1: memberIds.slice(0, half), team2: memberIds.slice(half), ppt: 1 }
      break
    }
    case 'wolf': config = { ppt: 1, wolfLoneMultiplier: 4, blindWolfMultiplier: 8, wolfTeeOrder: [], blindWolfEnabled: true, wolfTeesFirst: true, wolfChoices: {}, tieRule: 'push' }; break
  }
  await roundsStore.saveGameConfig({
    round_id: roundsStore.activeRound?.id,
    type,
    config,
    sort_order: roundsStore.activeGames.length,
  })
}
</script>
