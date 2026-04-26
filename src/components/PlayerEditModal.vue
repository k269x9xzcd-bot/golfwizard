<template>
  <Teleport to="body">
    <div v-if="modelValue" class="edit-backdrop" @click.self="$emit('update:modelValue', null)">
      <div class="edit-sheet">
        <div class="edit-header">
          <span class="edit-title">Edit Player</span>
          <button class="close-btn" @click="$emit('update:modelValue', null)">✕</button>
        </div>
        <div class="name-row">
          <input v-model="editFirst" class="wiz-input" placeholder="First name" />
          <input v-model="editLast" class="wiz-input" placeholder="Last name" />
        </div>
        <input v-model="editGhin" class="wiz-input" placeholder="GHIN Index" type="number" step="0.1" />
        <div v-if="modelValue?.club_name" class="edit-club-row">
          <img
            v-if="modelValue.club_name.toLowerCase().includes('bonnie briar')"
            src="../assets/bonnie-briar-logo.png"
            class="edit-club-logo"
            alt=""
          />
          <span v-else class="edit-club-icon">⛳</span>
          <span class="edit-club-name">{{ modelValue.club_name }}</span>
        </div>
        <div class="ghin-number-row">
          <input v-model="editGhinNumber" class="wiz-input" placeholder="GHIN # (e.g. 1321498)" type="text" inputmode="numeric" style="flex:1" />
          <button class="ghin-lookup-btn" @click="$emit('search-ghin', { first: editFirst, last: editLast, ghinNumber: editGhinNumber, prefix: editGhinPrefix })" :disabled="searching" type="button">
            {{ searching ? '…' : '🔍 GHIN' }}
          </button>
        </div>
        <div class="ghin-prefix-row">
          <input v-model="editGhinPrefix" class="wiz-input ghin-prefix-input" placeholder="Narrow by first name (e.g. &quot;Br&quot; for Brian)" />
        </div>
        <div v-if="searchResults.length" class="ghin-search-results">
          <div class="ghin-search-label">Select the correct golfer:</div>
          <div v-for="r in searchResults" :key="r.ghin_number" class="ghin-search-option" @click="applyResult(r)">
            <div class="ghin-search-name">{{ r.full_name }} <span v-if="r._source === 'bb'" class="bb-badge">BB</span></div>
            <div class="ghin-search-meta">{{ r.club_name }} · HCP {{ r.handicap_index ?? 'NH' }} · #{{ r.ghin_number }}</div>
          </div>
        </div>
        <div v-if="searchMsg" class="ghin-search-msg">{{ searchMsg }}</div>
        <div class="edit-nickname-row">
          <input v-model="editNickname" class="wiz-input" placeholder="Nickname (e.g. Spiels)" style="flex:1" />
          <label class="nick-toggle-label">
            <input type="checkbox" v-model="editUseNickname" class="nick-toggle-cb" />
            <span class="nick-toggle-text">Use nickname</span>
          </label>
        </div>
        <input v-model="editEmail" class="wiz-input" placeholder="Email address" type="email" autocomplete="email" />
        <div v-if="editError" class="edit-error">{{ editError }}</div>
        <div class="edit-footer">
          <button class="btn-ghost" :disabled="saving" @click="$emit('update:modelValue', null)">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null }, // the player being edited
  searching: Boolean,
  searchResults: { type: Array, default: () => [] },
  searchMsg: String,
  saving: Boolean,
  editError: String,
})
const emit = defineEmits(['update:modelValue', 'search-ghin', 'apply-result', 'save'])

const editFirst = ref('')
const editLast = ref('')
const editGhin = ref('')
const editGhinNumber = ref('')
const editGhinPrefix = ref('')
const editNickname = ref('')
const editUseNickname = ref(false)
const editEmail = ref('')

watch(() => props.modelValue, (p) => {
  if (!p) return
  if (p.first_name) {
    editFirst.value = p.first_name
    editLast.value = p.last_name || ''
  } else {
    const parts = (p.name || '').trim().split(' ')
    editFirst.value = parts[0] || ''
    editLast.value = parts.slice(1).join(' ')
  }
  editGhin.value = p.ghin_index ?? ''
  editGhinNumber.value = p.ghin_number || ''
  editNickname.value = p.nickname || ''
  editUseNickname.value = p.use_nickname || false
  editEmail.value = p.email || ''
  editGhinPrefix.value = ''
}, { immediate: true })

function applyResult(r) {
  editGhinNumber.value = r.ghin_number
  editGhin.value = r.handicap_index != null ? String(r.handicap_index) : editGhin.value
  emit('apply-result', r)
}

function save() {
  emit('save', {
    id: props.modelValue?.id,
    first: editFirst.value.trim(),
    last: editLast.value.trim(),
    ghinIndex: editGhin.value,
    ghinNumber: editGhinNumber.value.trim() || null,
    nickname: editNickname.value.trim() || null,
    useNickname: editUseNickname.value,
    email: editEmail.value.trim(),
    prevGhinNumber: props.modelValue?.ghin_number || null,
  })
}
</script>

<style scoped>
.edit-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.65);
  display: flex; align-items: flex-end; z-index: 300;
}
.edit-sheet {
  background: #1a1f1c; width: 100%; border-radius: 20px 20px 0 0;
  padding: 20px 16px 40px; display: flex; flex-direction: column; gap: 10px;
  border-top: 1px solid rgba(255,255,255,.1); max-height: 90vh; overflow-y: auto;
}
.edit-sheet input, .edit-sheet select { font-size: 16px !important; }
.edit-header { display: flex; justify-content: space-between; align-items: center; }
.edit-title { font-size: 17px; font-weight: 700; color: #f0ede0; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: rgba(240,237,224,.5); }
.name-row { display: flex; gap: 8px; }
.name-row .wiz-input { flex: 1; }
.edit-footer { display: flex; gap: 10px; margin-top: 4px; }
.edit-footer .btn-ghost, .edit-footer .btn-primary { flex: 1; }
.edit-footer button[disabled] { opacity: .55; cursor: wait; }
.edit-error { font-size: 13px; color: #fca5a5; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25); border-radius: 8px; padding: 8px 12px; }
.ghin-number-row { display: flex; align-items: center; gap: 8px; }
.ghin-prefix-row { margin-top: -4px; }
.ghin-prefix-input { font-size: 16px; color: rgba(240,237,224,.6); }
.ghin-prefix-input::placeholder { font-size: 14px; opacity: 0.5; }
.edit-club-row { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(255,255,255,.04); border-radius: 8px; margin-bottom: 4px; }
.edit-club-logo { height: 18px; width: 18px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); }
.edit-club-icon { font-size: 13px; }
.edit-club-name { font-size: 12px; color: rgba(240,237,224,.5); font-style: italic; }
.ghin-lookup-btn {
  background: #22a06b; color: #fff; border: none;
  padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
.ghin-lookup-btn:disabled { opacity: 0.5; cursor: default; }
.ghin-search-results { background: rgba(255,255,255,.05); border-radius: 10px; border: 1px solid rgba(255,255,255,.1); overflow: hidden; }
.ghin-search-label { font-size: 11px; font-weight: 700; color: rgba(240,237,224,.4); text-transform: uppercase; letter-spacing: .04em; padding: 8px 12px 4px; }
.ghin-search-option { padding: 10px 12px; cursor: pointer; border-top: 1px solid rgba(255,255,255,.06); }
.ghin-search-option:active { background: rgba(96,165,250,.15); }
.ghin-search-name { font-size: 14px; font-weight: 600; color: var(--gw-text); }
.ghin-search-meta { font-size: 12px; color: rgba(240,237,224,.5); margin-top: 2px; }
.bb-badge { display: inline-block; font-size: 10px; font-weight: 700; color: #1a1a1a; background: #4ade80; border-radius: 3px; padding: 1px 4px; margin-left: 6px; vertical-align: middle; }
.ghin-search-msg { font-size: 12px; color: rgba(240,237,224,.5); padding: 4px 2px; }
.edit-nickname-row { display: flex; align-items: center; gap: 10px; }
.nick-toggle-label { display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.nick-toggle-cb { width: 16px; height: 16px; accent-color: #22a06b; cursor: pointer; }
.nick-toggle-text { font-size: 12px; color: rgba(240,237,224,.6); }
.btn-ghost { background: none; border: 1px solid rgba(255,255,255,.15); color: rgba(240,237,224,.7); padding: 12px; border-radius: 12px; font-size: 15px; cursor: pointer; }
.btn-primary { background: #22a06b; color: #fff; border: none; padding: 12px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; }
.wiz-input {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
  color: #f0ede0; border-radius: 10px; padding: 10px 12px;
  font-size: 16px; width: 100%; box-sizing: border-box; outline: none;
}
.wiz-input::placeholder { color: rgba(240,237,224,.35); }
.wiz-input:focus { border-color: #22a06b; background: rgba(34,160,107,.08); }
</style>
