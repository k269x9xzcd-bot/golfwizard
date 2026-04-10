<template>
  <div class="view scoring-view">
    <div v-if="!roundsStore.activeRound" class="no-round">
      <p>No active round. Tap <strong>New Round</strong> to start.</p>
    </div>
    <div v-else>
      <header class="scoring-header">
        <div class="scoring-course">{{ roundsStore.activeRound.course_name }}</div>
        <div class="scoring-date">{{ roundsStore.activeRound.date }}</div>
        <div v-if="roundsStore.activeRound.room_code" class="scoring-roomcode">
          🔗 {{ roundsStore.activeRound.room_code }}
        </div>
      </header>
      <!-- Full scorecard will be wired in from the existing monolith's scoring UI -->
      <div class="scorecard-placeholder">
        <p>Scorecard coming — game logic is loaded, UI integration in progress.</p>
        <pre style="font-size:11px; overflow:auto;">{{ JSON.stringify(roundsStore.activeScores, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoundsStore } from '../stores/rounds'
const roundsStore = useRoundsStore()
</script>
