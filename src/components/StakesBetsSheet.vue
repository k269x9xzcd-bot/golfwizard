<template>
  <Sheet
    :modelValue="show"
    @update:modelValue="(v) => emit('update:show', v)"
    title="Stakes & Bets"
    :hint="launchMode ? 'Set wagers, side games, and pair bets — then start the round' : 'Edit wagers — saves immediately'"
  >
    <template #title>
      <span>{{ launchMode ? 'Stakes & Bets' : '⚙️ Stakes & Bets' }}</span>
    </template>

    <!-- TOURNAMENT WAGERS (only for tournament rounds) -->
    <section v-if="isTournament" class="sb-section">
      <header class="sb-section-h">Tournament wagers</header>
      <div class="sb-row">
        <label class="sb-row-lbl">Team BB $</label>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          v-model.number="wagerEdits.bb"
          @change="saveTournamentWagers"
          class="sb-input sb-input--money"
        />
      </div>
      <div class="sb-row">
        <label class="sb-row-lbl">1v1 Match 1 $</label>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          v-model.number="wagerEdits.s1"
          @change="saveTournamentWagers"
          class="sb-input sb-input--money"
        />
      </div>
      <div class="sb-row">
        <label class="sb-row-lbl">1v1 Match 2 $</label>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          v-model.number="wagerEdits.s2"
          @change="saveTournamentWagers"
          class="sb-input sb-input--money"
        />
      </div>
      <div class="sb-info">
        Flat $ — winner of each matchup collects from the other team. Tie = $0.
      </div>
    </section>

    <!-- SIDE GAMES -->
    <section class="sb-section">
      <header class="sb-section-h">Side games (foursome)</header>
      <div v-if="!sideGames.length" class="sb-empty">No side games yet</div>
      <div v-for="g in sideGames" :key="g.id" class="sb-row sb-row-game">
        <button class="sb-row-tap" @click="emit('edit-game', g)">
          <span class="sb-row-icon">{{ gameIcon(g.type) }}</span>
          <span class="sb-row-lbl">{{ gameLabel(g.type, g.config) }}</span>
          <span class="sb-row-detail">{{ stakesSummary(g) }}</span>
          <span class="sb-row-arrow">›</span>
        </button>
        <button class="sb-del" @click.stop="confirmRemove(g)" aria-label="Remove">✕</button>
      </div>
      <button class="sb-add-btn" @click="emit('add-side-game')">+ Add side game</button>
    </section>

    <!-- PAIR BETS -->
    <section class="sb-section">
      <header class="sb-section-h">Pair bets</header>
      <div v-if="!pairBets.length" class="sb-empty">No pair bets yet</div>
      <div v-for="g in pairBets" :key="g.id" class="sb-row sb-row-game">
        <span class="sb-row-icon">⚔️</span>
        <span class="sb-row-lbl">{{ pairBetLabel(g) }}</span>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          :value="pairBetEdits[g.id] ?? g.config?.ppt ?? 0"
          @input="onPairBetInput(g, $event)"
          @change="savePairBet(g)"
          class="sb-input sb-input--money"
        />
        <button class="sb-del" @click="confirmRemove(g)" aria-label="Remove">✕</button>
      </div>

      <details class="sb-add-form">
        <summary class="sb-add-btn sb-add-btn--inline">+ Add pair bet</summary>
        <div class="sb-add-fields">
          <select v-model="newPair.p1" class="sb-input">
            <option :value="null">Player 1</option>
            <option v-for="m in members" :key="'p1-' + m.id" :value="m.id">{{ memberLabel(m) }}</option>
          </select>
          <select v-model="newPair.p2" class="sb-input">
            <option :value="null">Player 2</option>
            <option v-for="m in members" :key="'p2-' + m.id" :value="m.id" :disabled="m.id === newPair.p1">{{ memberLabel(m) }}</option>
          </select>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            v-model.number="newPair.ppt"
            placeholder="$"
            class="sb-input sb-input--money"
          />
          <button class="sb-add-go" :disabled="!canAddPair" @click="addPairBet">Add</button>
        </div>
      </details>
    </section>

    <!-- CROSS-MATCH -->
    <section class="sb-section">
      <header class="sb-section-h">Cross-match</header>
      <div v-if="crossMatch" class="sb-row">
        <button class="sb-row-tap" @click="goCrossMatch(crossMatch.id)">
          <span class="sb-row-icon">{{ crossMatch.status === 'linked' ? '🎮' : '⛳' }}</span>
          <span class="sb-row-lbl">{{ crossMatch.name || '4v4 linked' }}</span>
          <span class="sb-row-detail">{{ crossMatch.status === 'linked' ? 'View standings' : 'Awaiting Foursome B' }}</span>
          <span class="sb-row-arrow">›</span>
        </button>
      </div>
      <div v-else class="sb-empty">
        <button class="sb-add-btn" @click="goLink">+ Link to another foursome</button>
      </div>
    </section>

    <!-- Launch button (only in launchMode) -->
    <div v-if="launchMode" class="sb-launch-row">
      <button class="sb-launch-btn" @click="emit('launch')">Start Round →</button>
    </div>

    <!-- Confirm remove dialog -->
    <div v-if="pendingRemove" class="sb-confirm-overlay" @click.self="pendingRemove = null">
      <div class="sb-confirm">
        <div class="sb-confirm-title">Remove this bet?</div>
        <div class="sb-confirm-msg">{{ confirmRemoveLabel }}</div>
        <div class="sb-confirm-actions">
          <button class="sb-confirm-cancel" @click="pendingRemove = null">Cancel</button>
          <button class="sb-confirm-go" @click="doRemove">Remove</button>
        </div>
      </div>
    </div>
  </Sheet>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import Sheet from './ui/Sheet.vue'
import { useRoundsStore } from '../stores/rounds'
import { useTournamentStore } from '../stores/tournament'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { normalizeWagers } from '../modules/tournamentWagers'

const props = defineProps({
  show: { type: Boolean, required: true },
  launchMode: { type: Boolean, default: false },
  gameLabel: { type: Function, required: true },
  gameIcon: { type: Function, required: true },
})
const emit = defineEmits(['update:show', 'edit-game', 'add-side-game', 'launch'])

const roundsStore = useRoundsStore()
const tournamentStore = useTournamentStore()
const linkedStore = useLinkedMatchesStore()
const router = useRouter()

const isTournament = computed(() => roundsStore.activeRound?.format === 'tournament')

// ── Tournament wagers ───────────────────────────────────────────
const tournMatch = computed(() => {
  const r = roundsStore.activeRound
  if (!r?.id) return null
  return tournamentStore.matchByRoundId?.(r.id) || null
})

// Local edit refs (avoid mutating Pinia state mid-typing).
// Seeded from current DB values via watcher; flushed back via saveTournamentWagers.
const wagerEdits = reactive({ bb: 0, s1: 0, s2: 0 })
watch(
  () => tournMatch.value?.wagers,
  (raw) => {
    const n = normalizeWagers(raw)
    wagerEdits.bb = n.bb
    wagerEdits.s1 = n.s1
    wagerEdits.s2 = n.s2
  },
  { immediate: true, deep: true },
)
// Re-seed when the sheet is re-opened (in case the user discarded edits)
watch(() => props.show, (open) => {
  if (open) {
    const n = normalizeWagers(tournMatch.value?.wagers)
    wagerEdits.bb = n.bb
    wagerEdits.s1 = n.s1
    wagerEdits.s2 = n.s2
  }
})

async function saveTournamentWagers() {
  if (!tournMatch.value?._dbId) return
  const num = v => Math.max(0, Number(v) || 0)
  const next = { bb: num(wagerEdits.bb), s1: num(wagerEdits.s1), s2: num(wagerEdits.s2) }
  wagerEdits.bb = next.bb
  wagerEdits.s1 = next.s1
  wagerEdits.s2 = next.s2
  await tournamentStore.updateMatchWagers(tournMatch.value._dbId, next)
}

// ── Side games / pair bets ───────────────────────────────────────
const allGames = computed(() => roundsStore.activeGames || [])
const sideGames = computed(() => allGames.value.filter(g => g.type !== 'match1v1' && !(isTournament.value && g.type === 'best_ball')))
const pairBets = computed(() => allGames.value.filter(g => g.type === 'match1v1'))
const members = computed(() => roundsStore.activeMembers || [])

function memberLabel(m) {
  return m.short_name || m.nickname || m.full_name || '?'
}

function pairBetLabel(g) {
  const p1 = members.value.find(m => m.id === g.config?.player1)
  const p2 = members.value.find(m => m.id === g.config?.player2)
  return `${memberLabel(p1 || {})} v ${memberLabel(p2 || {})}`
}

function stakesSummary(g) {
  const c = g.config || {}
  if (c.front != null || c.back != null || c.overall != null) {
    return `$${c.front ?? 0}/${c.back ?? 0}/${c.overall ?? 0}`
  }
  if (c.ppt != null) return `$${c.ppt}/pt`
  if (c.ppp != null) return `$${c.ppp}/player`
  return ''
}

// Per-game local edits avoid mutating Pinia state during typing
const pairBetEdits = reactive({})
function onPairBetInput(g, e) {
  pairBetEdits[g.id] = Number(e.target.value) || 0
}
async function savePairBet(g) {
  const draft = pairBetEdits[g.id]
  const v = Math.max(0, Number(draft != null ? draft : g.config?.ppt) || 0)
  delete pairBetEdits[g.id]
  await roundsStore.updateGameConfig(g.id, { ...g.config, ppt: v })
}

// ── Add pair bet form ────────────────────────────────────────────
const newPair = ref({ p1: null, p2: null, ppt: 20 })
const canAddPair = computed(() => newPair.value.p1 && newPair.value.p2 && newPair.value.p1 !== newPair.value.p2 && Number(newPair.value.ppt) > 0)

async function addPairBet() {
  if (!canAddPair.value) return
  const game = {
    type: 'match1v1',
    round_id: roundsStore.activeRound?.id,
    config: {
      player1: newPair.value.p1,
      player2: newPair.value.p2,
      ppt: Number(newPair.value.ppt),
      scoring: 'closeout',
    },
  }
  await roundsStore.saveGameConfig(game)
  newPair.value = { p1: null, p2: null, ppt: 20 }
}

// ── Remove with confirm ──────────────────────────────────────────
const pendingRemove = ref(null)
const confirmRemoveLabel = computed(() => {
  const g = pendingRemove.value
  if (!g) return ''
  if (g.type === 'match1v1') return pairBetLabel(g)
  return props.gameLabel(g.type, g.config)
})

function confirmRemove(g) {
  pendingRemove.value = g
}
async function doRemove() {
  const g = pendingRemove.value
  pendingRemove.value = null
  if (!g) return
  await roundsStore.deleteGameConfig(g.id)
}

// ── Cross-match ──────────────────────────────────────────────────
const crossMatch = computed(() => {
  const r = roundsStore.activeRound
  if (!r?.id) return null
  const matches = linkedStore.linkedMatches || []
  return matches.find(m => (m.status === 'linked' || m.status === 'pending') && (m.round_a_id === r.id || m.round_b_id === r.id)) || null
})

function goCrossMatch(id) {
  emit('update:show', false)
  router.push(`/cross-match/${id}`)
}
function goLink() {
  emit('update:show', false)
  router.push('/cross-match/setup')
}
</script>

<style scoped>
.sb-section {
  margin: 0 0 18px;
}
.sb-section-h {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
  color: var(--gw-text-tertiary, rgba(240,237,224,.55));
  padding: 0 4px 6px;
}
.sb-empty {
  padding: 6px 4px 10px;
  font-size: 12px;
  color: var(--gw-text-tertiary, rgba(240,237,224,.5));
  font-style: italic;
}
.sb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-top: 1px solid var(--gw-border-subtle, rgba(255,255,255,.06));
}
.sb-row:first-of-type { border-top: none; }
.sb-row-tap {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.sb-row-icon { font-size: 16px; flex-shrink: 0; }
.sb-row-lbl { font-weight: 700; flex: 1; color: var(--gw-text-primary, var(--gw-text, #f0ede0)); }
.sb-row-detail { color: var(--gw-text-tertiary, rgba(240,237,224,.55)); font-size: 12px; font-family: var(--gw-font-mono, monospace); }
.sb-row-arrow { color: var(--gw-text-tertiary, rgba(240,237,224,.4)); font-size: 18px; }
.sb-input {
  background: var(--gw-bg-input, rgba(255,255,255,.06));
  border: 1px solid var(--gw-border-default, rgba(255,255,255,.12));
  border-radius: 8px;
  color: var(--gw-text, #f0ede0);
  padding: 7px 10px;
  font-size: 14px;
  font-family: var(--gw-font-body, inherit);
}
.sb-input--money {
  width: 80px;
  text-align: right;
  font-family: var(--gw-font-mono, monospace);
}
.sb-info {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--gw-text-secondary, rgba(240,237,224,.7));
  background: rgba(212,175,55,.06);
  border: 1px solid rgba(212,175,55,.18);
  border-radius: 8px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sb-info strong { color: #d4af37; font-family: var(--gw-font-mono, monospace); }
.sb-add-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  background: rgba(74,222,128,.08);
  border: 1px dashed rgba(74,222,128,.35);
  border-radius: 10px;
  color: #4ade80;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.sb-add-btn:active { background: rgba(74,222,128,.14); }
.sb-add-btn--inline { list-style: none; }
.sb-add-btn--inline::-webkit-details-marker { display: none; }
.sb-add-form { margin-top: 8px; }
.sb-add-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.sb-add-fields .sb-input--money,
.sb-add-fields .sb-add-go { grid-column: span 1; }
.sb-add-go {
  background: var(--gw-accent, #4ade80);
  color: #0c0f0d;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 800;
  cursor: pointer;
}
.sb-add-go:disabled { opacity: .35; cursor: not-allowed; }
.sb-del {
  background: none;
  border: none;
  color: rgba(248,113,113,.7);
  font-size: 14px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 6px;
}
.sb-del:hover { background: rgba(248,113,113,.1); color: #f87171; }

.sb-launch-row { padding: 12px 4px 4px; }
.sb-launch-btn {
  width: 100%;
  padding: 14px;
  background: var(--gw-accent, #4ade80);
  color: #0c0f0d;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
}
.sb-launch-btn:active { transform: translateY(1px); }

.sb-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
}
.sb-confirm {
  background: var(--gw-bg-sheet, #1a1f1b);
  border-radius: 14px;
  padding: 18px;
  max-width: 320px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}
.sb-confirm-title { font-weight: 800; font-size: 16px; margin-bottom: 6px; }
.sb-confirm-msg { color: rgba(240,237,224,.7); font-size: 13px; margin-bottom: 14px; }
.sb-confirm-actions { display: flex; gap: 8px; }
.sb-confirm-cancel,
.sb-confirm-go {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  font-weight: 700;
  cursor: pointer;
}
.sb-confirm-cancel { background: rgba(255,255,255,.06); color: var(--gw-text, #f0ede0); }
.sb-confirm-go { background: #f87171; color: #fff; }
</style>
