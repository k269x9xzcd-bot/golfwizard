<template>
  <div class="view games-view">
    <header class="view-header"><h2>Games</h2></header>
    <div v-if="!roundsStore.activeRound" class="no-round">
      <p>Start a round to configure games.</p>
    </div>
    <div v-else>
      <div v-for="game in roundsStore.activeGames" :key="game.id" class="game-card card">
        <div class="game-type">{{ game.type }}</div>
        <div class="game-config">{{ JSON.stringify(game.config) }}</div>
      </div>
      <p v-if="!roundsStore.activeGames.length">No games configured yet.</p>
    </div>
  </div>
</template>
<script setup>
import { useRoundsStore } from '../stores/rounds'
const roundsStore = useRoundsStore()
</script>
