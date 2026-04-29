<template>
  <div v-if="show" class="delete-overlay" @click="emit('close')">
    <div class="finish-review-panel" @click.stop>
      <div class="finish-review-title">Review Round</div>
      <div class="finish-review-sub">Confirm scores before finishing</div>
      <div class="finish-review-grid">
        <div v-for="member in members" :key="'fr-' + member.id" class="finish-review-player">
          <span class="fr-name">{{ memberDisplay(member) }}</span>
          <span class="fr-total">{{ playerTotal(member.id) || '—' }}</span>
          <span class="fr-net">NET {{ playerNetTotal(member.id) || '—' }}</span>
        </div>
      </div>
      <div v-if="error" class="finish-error">{{ error }}</div>
      <div class="finish-review-actions">
        <button class="btn-cancel" :disabled="finishing" @click="emit('close')">Back to Scoring</button>
        <button class="finish-btn" :disabled="finishing" @click="emit('finish')">
          {{ finishing ? 'Finishing…' : 'Finish Round ✓' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show:          { type: Boolean,  required: true },
  members:       { type: Array,    default: () => [] },
  finishing:     { type: Boolean,  default: false },
  error:         { type: String,   default: null },
  memberDisplay: { type: Function, required: true },
  playerTotal:   { type: Function, required: true },
  playerNetTotal:{ type: Function, required: true },
})
const emit = defineEmits(['close', 'finish'])
</script>
