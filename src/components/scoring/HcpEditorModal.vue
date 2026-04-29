<template>
  <!-- Date editor -->
  <div v-if="showDateEditor" class="hcp-editor-overlay" @click.self="emit('closeDateEditor')">
    <div class="hcp-editor-modal" style="max-width:320px">
      <div class="hcp-editor-title">Edit Round Date</div>
      <div style="margin:16px 0">
        <input
          type="date"
          :value="editDateValue"
          @input="emit('update:editDateValue', $event.target.value)"
          class="wiz-input"
          style="width:100%;font-size:16px;text-align:center"
        />
      </div>
      <div v-if="dateEditError" style="color:#f87171;font-size:12px;margin-bottom:10px">{{ dateEditError }}</div>
      <div style="display:flex;gap:8px">
        <button class="hcp-editor-done" style="flex:1;background:rgba(255,255,255,.08);color:var(--gw-text)" @click="emit('closeDateEditor')">Cancel</button>
        <button class="hcp-editor-done" style="flex:1" @click="emit('saveDateEdit')" :disabled="dateSaving">{{ dateSaving ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>
  </div>

  <!-- HCP editor -->
  <div v-if="showHcpEditor" class="hcp-editor-overlay" @click.self="emit('closeHcpEditor')">
    <div class="hcp-editor-modal">
      <div class="hcp-editor-title">Edit Strokes / Handicap</div>
      <div class="hcp-editor-note">Set strokes directly to override, or edit handicap index to recalculate.</div>
      <div v-for="m in members" :key="m.id" class="hcp-editor-row hcp-editor-row--expanded">
        <!-- Name + index + course HCP -->
        <div class="hcp-editor-top">
          <span class="hcp-editor-name">{{ m.short_name || m.guest_name }}</span>
          <div class="hcp-editor-right">
            <div class="hcp-dual-inputs">
              <div class="hcp-input-group">
                <span class="hcp-input-label">Strokes</span>
                <input type="number" min="0" max="54" step="1" class="hcp-editor-input"
                  :value="m.stroke_override != null ? m.stroke_override : courseHcp(m)"
                  :class="{ 'hcp-editor-input--modified': m.stroke_override != null }"
                  @input="emit('updateStrokesLocal', m.id, $event.target.value)"
                  @change="emit('updateStrokes', m.id, $event.target.value)" />
              </div>
              <div class="hcp-input-group">
                <span class="hcp-input-label">Index</span>
                <input type="number" step="0.1" class="hcp-editor-input"
                  :class="{ 'hcp-editor-input--modified': isModified(m) }"
                  :value="m.ghin_index"
                  @change="emit('updateHcp', m.id, $event.target.value)" placeholder="—" />
              </div>
            </div>
          </div>
        </div>
        <!-- Strokes per hole grid -->
        <div class="hcp-editor-holes">
          <div
            v-for="(strokes, hIdx) in strokesPerHole(m)"
            :key="hIdx"
            class="hcp-editor-hole"
            :class="{ 'hcp-editor-hole--has': strokes > 0 }"
          >
            <div class="hcp-editor-hole-num">{{ hIdx + 1 }}</div>
            <div class="hcp-editor-hole-val">{{ strokes > 0 ? '+'.repeat(strokes) : '·' }}</div>
          </div>
        </div>
      </div>
      <button class="hcp-editor-done" @click="emit('closeHcpEditor')">Done</button>
    </div>
  </div>

  <!-- Opponent group editor -->
  <div v-if="showOppEditor" class="hcp-editor-overlay" @click.self="emit('closeOppEditor')">
    <div class="hcp-editor-modal opp-editor-modal">
      <div class="hcp-editor-title">⚔️ Opponent Group</div>
      <div class="hcp-editor-note">Pick the players you're competing against today.</div>

      <div v-if="editOppPlayers.length" class="opp-edit-chips">
        <div v-for="(p, i) in editOppPlayers" :key="p.id" class="opp-edit-chip">
          <span>{{ p.shortName || p.name }}</span>
          <button @click="emit('removeOpp', i)">×</button>
        </div>
      </div>
      <div v-else class="opp-edit-empty">No opponents set — pick from roster below</div>

      <input :value="oppEditorSearch" @input="emit('update:oppEditorSearch', $event.target.value)"
        class="hcp-editor-input opp-editor-search" placeholder="Search roster…" style="width:100%;margin:8px 0" />
      <div class="opp-editor-roster">
        <div
          v-for="p in oppEditorFiltered"
          :key="p.id"
          class="opp-editor-row"
          :class="{ 'opp-editor-row--on': isOppAdded(p), 'opp-editor-row--mine': isMyPlayer(p) }"
          @click="emit('toggleOpp', p)"
        >
          <span class="opp-editor-name">{{ p.name }}</span>
          <span class="opp-editor-hcp">idx {{ p.ghin_index ?? '—' }}</span>
          <span class="opp-editor-check">{{ isOppAdded(p) ? '✓' : isMyPlayer(p) ? '—' : '+' }}</span>
        </div>
      </div>

      <div class="quick-add-row" style="margin-top:8px">
        <input :value="oppEditorGuestName" @input="emit('update:oppEditorGuestName', $event.target.value)"
          class="hcp-editor-input" placeholder="Add guest…" style="flex:1"
          @keydown.enter="emit('addOppGuest')" />
        <button class="hcp-editor-done" style="padding:8px 14px;flex-shrink:0" @click="emit('addOppGuest')">Add</button>
      </div>

      <div class="opp-editor-actions">
        <button class="hcp-editor-done" @click="emit('saveOppEditor')">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  // Date editor
  showDateEditor:  { type: Boolean, default: false },
  editDateValue:   { type: String,  default: '' },
  dateEditError:   { type: String,  default: '' },
  dateSaving:      { type: Boolean, default: false },
  // HCP editor
  showHcpEditor:   { type: Boolean, default: false },
  members:         { type: Array,   default: () => [] },
  // Opp editor
  showOppEditor:      { type: Boolean, default: false },
  editOppPlayers:     { type: Array,   default: () => [] },
  oppEditorSearch:    { type: String,  default: '' },
  oppEditorGuestName: { type: String,  default: '' },
  oppEditorFiltered:  { type: Array,   default: () => [] },
  // HCP calc helpers (passed as functions)
  courseHcp:       { type: Function, default: () => 0 },
  isModified:      { type: Function, default: () => false },
  strokesPerHole:  { type: Function, default: () => [] },
  isOppAdded:      { type: Function, default: () => false },
  isMyPlayer:      { type: Function, default: () => false },
})

const emit = defineEmits([
  'closeDateEditor', 'update:editDateValue', 'saveDateEdit',
  'closeHcpEditor', 'updateHcp', 'updateStrokes', 'updateStrokesLocal',
  'closeOppEditor', 'removeOpp', 'toggleOpp', 'addOppGuest', 'saveOppEditor',
  'update:oppEditorSearch', 'update:oppEditorGuestName',
])
</script>
