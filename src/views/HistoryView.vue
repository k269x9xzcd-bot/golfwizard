<template>
  <div class="view history-view">
    <header class="view-header"><h2>History</h2></header>
    <div v-if="roundsStore.loading" class="loading">Loading…</div>
    <div v-else-if="!roundsStore.rounds.length" class="empty-state">
      <p>No completed rounds yet.</p>
    </div>
    <div v-else>
      <div v-for="round in roundsStore.rounds" :key="round.id" class="round-card card">
        <div class="round-course">{{ round.course_name }}</div>
        <div class="round-meta">{{ round.date }} · {{ round.round_members?.length ?? 0 }} players</div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted } from 'vue'
import { useRoundsStore } from '../stores/rounds'
const roundsStore = useRoundsStore()
onMounted(() => roundsStore.fetchRounds())
</script>
