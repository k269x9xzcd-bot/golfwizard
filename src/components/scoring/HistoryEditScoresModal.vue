<template>
  <div v-if="show" class="hes-backdrop" @click.self="emit('close')">
    <div class="hes-panel">
      <div class="hes-header">
        <div>
          <h3 class="hes-title">✏️ Edit Scores</h3>
          <div class="hes-sub">Tap a cell to change a score. Missing holes won't be overwritten.</div>
        </div>
        <button class="hes-close" @click="emit('close')">✕</button>
      </div>

      <div class="hes-scroll">
        <table class="hes-grid">
          <thead>
            <tr>
              <th class="hes-th hes-th--player">Player</th>
              <th v-for="h in holes" :key="h" class="hes-th">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td class="hes-td hes-td--player">{{ m.short_name || m.guest_name || '?' }}</td>
              <td
                v-for="h in holes"
                :key="'hc-' + m.id + '-' + h"
                class="hes-td"
                :class="{ 'hes-empty': editScores[m.id]?.[h] == null || editScores[m.id]?.[h] === '' }"
              >
                <input
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="20"
                  :value="editScores[m.id]?.[h] ?? ''"
                  @input="onInput(m.id, h, $event.target.value)"
                  class="hes-input"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="hes-footer">
        <div class="hes-count">{{ filledCount }} / {{ members.length * holes.length }} cells filled</div>
        <button class="hes-btn-cancel" @click="emit('close')">Cancel</button>
        <button class="hes-btn-save" :disabled="saving || filledCount === 0" @click="save">
          {{ saving ? 'Saving…' : `Save ${filledCount} scores` }}
        </button>
      </div>
      <div v-if="saveError" class="hes-error">{{ saveError }}</div>
      <div v-if="saveSuccess" class="hes-success">Scores updated ✓</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { supaRawRequest } from '../../modules/supaRaw'

const props = defineProps({
  show:    { type: Boolean, required: true },
  round:   { type: Object,  default: null },
  members: { type: Array,   default: () => [] },
  holes:   { type: Array,   default: () => Array.from({ length: 18 }, (_, i) => i + 1) },
})
const emit = defineEmits(['close', 'saved'])

const editScores = ref({})
const saving     = ref(false)
const saveError  = ref('')
const saveSuccess = ref(false)

// Build editable score map from round.scores (array of {member_id, hole, score})
watch(() => [props.show, props.round, props.members], () => {
  if (!props.show) return
  saveError.value = ''
  saveSuccess.value = false
  const map = {}
  for (const m of props.members) {
    map[m.id] = {}
    for (const h of props.holes) {
      const existing = (props.round?.scores || []).find(s => s.member_id === m.id && s.hole === h)
      map[m.id][h] = existing ? (existing.score ?? existing.strokes ?? '') : ''
    }
  }
  editScores.value = map
}, { immediate: true })

function onInput(memberId, hole, value) {
  if (!editScores.value[memberId]) editScores.value[memberId] = {}
  const n = parseInt(value, 10)
  editScores.value[memberId][hole] = (isNaN(n) || n < 1) ? '' : n
}

const filledCount = computed(() => {
  let count = 0
  for (const mid of Object.keys(editScores.value)) {
    for (const h of props.holes) {
      const v = editScores.value[mid]?.[h]
      if (v !== '' && v != null) count++
    }
  }
  return count
})

async function save() {
  if (!props.round?.id) return
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const roundId = props.round.id
    const entries = []
    for (const [memberId, holes] of Object.entries(editScores.value)) {
      for (const [holeStr, score] of Object.entries(holes)) {
        if (score !== '' && score != null) {
          entries.push({ round_id: roundId, member_id: memberId, hole: +holeStr, score: +score })
        }
      }
    }

    // Batch upsert via REST — upsert on (round_id, member_id, hole)
    if (entries.length > 0) {
      await supaRawRequest(
        'POST',
        `scores?on_conflict=round_id,member_id,hole`,
        entries,
        12000,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }
      )
    }

    // Patch round.scores in-place so the expanded view reflects changes immediately
    if (props.round.scores) {
      for (const e of entries) {
        const existing = props.round.scores.find(s => s.member_id === e.member_id && s.hole === e.hole)
        if (existing) {
          existing.score = e.score
          existing.strokes = e.score
        } else {
          props.round.scores.push({ member_id: e.member_id, hole: e.hole, score: e.score, strokes: e.score })
        }
      }
    }

    saveSuccess.value = true
    emit('saved')
    setTimeout(() => emit('close'), 900)
  } catch (e) {
    saveError.value = e?.message || 'Save failed. Check your connection and try again.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.hes-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  z-index: 9000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.hes-panel {
  background: var(--gw-neutral-900, #111);
  border-radius: 20px 20px 0 0;
  padding: 20px 16px 40px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.hes-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.hes-title {
  font-family: 'DM Serif Display', serif;
  font-size: 18px;
  color: var(--gw-neutral-50, #fafafa);
  margin: 0 0 4px;
}
.hes-sub {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: var(--gw-neutral-500, #666);
}
.hes-close {
  background: none;
  border: none;
  color: var(--gw-neutral-400, #888);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.hes-scroll {
  overflow-x: auto;
  flex: 1;
  min-height: 0;
}
.hes-grid {
  border-collapse: collapse;
  width: max-content;
  min-width: 100%;
}
.hes-th {
  padding: 6px 4px;
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  color: var(--gw-neutral-500, #666);
  text-align: center;
  border-bottom: 1px solid var(--gw-neutral-800, #222);
  white-space: nowrap;
}
.hes-th--player {
  text-align: left;
  padding-left: 0;
  min-width: 72px;
}
.hes-td {
  padding: 3px 2px;
  text-align: center;
}
.hes-td--player {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-neutral-200, #e5e7eb);
  text-align: left;
  padding-left: 0;
  white-space: nowrap;
  padding-right: 8px;
}
.hes-input {
  width: 32px;
  height: 32px;
  text-align: center;
  background: var(--gw-neutral-800, #222);
  border: 1px solid var(--gw-neutral-700, #333);
  border-radius: 6px;
  color: var(--gw-neutral-100, #f3f4f6);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  -moz-appearance: textfield;
}
.hes-input::-webkit-outer-spin-button,
.hes-input::-webkit-inner-spin-button { -webkit-appearance: none; }
.hes-input:focus { outline: none; border-color: var(--gw-green-500, #22c55e); }
.hes-empty .hes-input { border-color: var(--gw-red-700, #991b1b); background: rgba(239,68,68,0.08); }

.hes-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-shrink: 0;
}
.hes-count {
  flex: 1;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: var(--gw-neutral-500, #666);
}
.hes-btn-cancel, .hes-btn-save {
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.hes-btn-cancel {
  background: var(--gw-neutral-700, #333);
  color: var(--gw-neutral-300, #d1d5db);
}
.hes-btn-save {
  background: var(--gw-green-500, #22c55e);
  color: #fff;
}
.hes-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.hes-error {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: var(--gw-red-400, #f87171);
  margin-top: 8px;
}
.hes-success {
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--gw-green-400, #4ade80);
  text-align: center;
  margin-top: 8px;
}
</style>
