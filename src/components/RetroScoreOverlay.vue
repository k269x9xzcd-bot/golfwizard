<template>
  <div v-if="show" class="delete-overlay" @click="$emit('close')">
    <div class="retro-panel" @click.stop>
      <div class="retro-header">
        <div>
          <h3 class="retro-title">📝 Enter Scores from Card</h3>
          <div class="retro-sub">Empty cells in red — tap any cell to type a score. Missing holes won't be saved.</div>
        </div>
        <button class="close-btn-sm" @click="$emit('close')">✕</button>
      </div>

      <div class="retro-scroll">
        <table class="retro-grid">
          <thead>
            <tr>
              <th class="retro-th retro-th--player">Player</th>
              <th v-for="h in visibleHoles" :key="h" class="retro-th">{{ h }}</th>
            </tr>
            <tr class="retro-par-row">
              <th class="retro-th retro-th--player">Par</th>
              <th v-for="h in visibleHoles" :key="'par-'+h" class="retro-th retro-par">{{ parForHole(h) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in roundsStore.activeMembers" :key="m.id">
              <td class="retro-td retro-td--player">{{ memberGridName(m) }}</td>
              <td
                v-for="h in visibleHoles"
                :key="'rc-'+m.id+'-'+h"
                class="retro-td"
                :class="{ 'retro-empty': retroScores[m.id]?.[h] == null || retroScores[m.id]?.[h] === '' }"
              >
                <input
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="20"
                  :value="retroScores[m.id]?.[h] ?? ''"
                  @input="onRetroInput(m.id, h, $event.target.value)"
                  class="retro-input"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="retro-footer">
        <div class="retro-count">{{ retroFilledCount }} / {{ roundsStore.activeMembers.length * visibleHoles.length }} cells filled</div>
        <button class="btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="retroSaving" @click="saveRetroScores">
          {{ retroSaving ? 'Saving…' : `Save ${retroFilledCount} scores` }}
        </button>
      </div>
      <div v-if="retroError" class="retro-error">{{ retroError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'

const props = defineProps({
  show: { type: Boolean, required: true },
  visibleHoles: { type: Array, required: true },
  parForHole: { type: Function, required: true },
  memberGridName: { type: Function, required: true },
})

const emit = defineEmits(['close', 'saved'])

const roundsStore = useRoundsStore()

const retroScores = ref({})
const retroSaving = ref(false)
const retroError = ref('')

// Initialize empty score map for all members when overlay opens
function openRetroScore() {
  retroScores.value = {}
  retroError.value = ''
  for (const m of roundsStore.activeMembers) {
    retroScores.value[m.id] = {}
    for (const h of props.visibleHoles) {
      const existing = roundsStore.activeScores[m.id]?.[h]
      retroScores.value[m.id][h] = existing != null ? existing : ''
    }
  }
}

defineExpose({ openRetroScore })

function onRetroInput(memberId, hole, value) {
  if (!retroScores.value[memberId]) retroScores.value[memberId] = {}
  const n = parseInt(value, 10)
  retroScores.value[memberId][hole] = (isNaN(n) || n < 1) ? '' : n
}

const retroFilledCount = computed(() => {
  let count = 0
  for (const mid of Object.keys(retroScores.value)) {
    for (const h of props.visibleHoles) {
      const v = retroScores.value[mid]?.[h]
      if (v !== '' && v != null) count++
    }
  }
  return count
})

async function saveRetroScores() {
  retroSaving.value = true
  retroError.value = ''
  try {
    const entries = []
    for (const [memberId, holes] of Object.entries(retroScores.value)) {
      for (const [holeStr, score] of Object.entries(holes)) {
        if (score !== '' && score != null) {
          entries.push({ memberId, hole: +holeStr, score: +score })
        }
      }
    }
    for (const e of entries) {
      await roundsStore.setScore(e.memberId, e.hole, e.score)
    }
    emit('saved')
    emit('close')
  } catch (e) {
    retroError.value = e?.message || 'Save failed'
  } finally {
    retroSaving.value = false
  }
}
</script>
