<template>
  <div v-if="show" class="junk-sheet-backdrop" @click.self="emit('close')">
    <div class="junk-sheet round-picker-sheet">
      <div class="junk-sheet-header">
        <span>Switch Round</span>
        <button class="junk-sheet-close" @click="emit('close')">Done</button>
      </div>
      <div class="junk-sheet-body">
        <button
          v-for="kr in knownRounds"
          :key="kr.id"
          class="round-picker-row"
          :class="{ 'round-picker-row--active': kr.id === activeRoundId }"
          @click="emit('switch', kr.id)"
        >
          <div class="rpr-left">
            <span class="rpr-course">{{ kr.courseName }}</span>
            <span class="rpr-meta">{{ kr.holesMode }}h · {{ kr.date }}</span>
            <span v-if="kr.players" class="rpr-players">{{ kr.players }}</span>
          </div>
          <span v-if="kr.id === activeRoundId" class="rpr-active-dot">✓</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show:         { type: Boolean, required: true },
  knownRounds:  { type: Array,   default: () => [] },
  activeRoundId:{ type: String,  default: null },
})
const emit = defineEmits(['close', 'switch'])
</script>
