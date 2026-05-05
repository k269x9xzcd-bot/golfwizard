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
      <template v-else>
        <div v-if="!showLinkForm" class="sb-empty">
          <button class="sb-add-btn" @click="openLinkForm">+ Link to another foursome</button>
        </div>
        <div v-else class="sb-link-form">
          <div class="sb-link-form-h">
            <span>Link 4v4 match</span>
            <button class="sb-link-close" @click="cancelLinkForm" aria-label="Cancel">×</button>
          </div>
          <div class="sb-link-hint">Pick the other foursome from your roster — they'll get an invite code to join.</div>

          <!-- Team B player picker -->
          <div class="sb-link-field">
            <label class="sb-link-lbl">Other foursome (Team B)</label>
            <div v-if="linkTeamB.length" class="sb-link-chips">
              <span v-for="p in linkTeamB" :key="p.id" class="sb-link-chip" @click="toggleLinkPlayer(p)">
                {{ playerLastName(p) }}<span class="sb-link-chip-x">×</span>
              </span>
            </div>
            <div class="sb-link-roster">
              <button
                v-for="p in linkRoster"
                :key="p.id"
                class="sb-link-roster-row"
                :class="{ 'sb-link-roster-row--on': isLinkPlayerOn(p) }"
                :disabled="!isLinkPlayerOn(p) && linkTeamB.length >= 4"
                @click="toggleLinkPlayer(p)"
              >
                <span class="sb-link-roster-name">{{ p.name }}</span>
                <span v-if="p.ghin_index != null" class="sb-link-roster-hcp">{{ Number(p.ghin_index).toFixed(1) }}</span>
              </button>
            </div>
          </div>

          <!-- Format -->
          <div class="sb-link-field sb-link-field--row">
            <label class="sb-link-lbl">Format</label>
            <div class="sb-link-pills">
              <button class="sb-link-pill" :class="{ 'sb-link-pill--on': linkBalls === 1 }" @click="linkBalls = 1">1 BB</button>
              <button class="sb-link-pill" :class="{ 'sb-link-pill--on': linkBalls === 2 }" @click="linkBalls = 2">2 BB</button>
            </div>
          </div>

          <!-- Stake -->
          <div class="sb-link-field sb-link-field--row">
            <label class="sb-link-lbl">Stake $/player</label>
            <input type="number" inputmode="numeric" min="1" v-model.number="linkStake" class="sb-input sb-input--money" />
          </div>

          <!-- HCP % -->
          <div class="sb-link-field sb-link-field--row">
            <label class="sb-link-lbl">HCP {{ linkHcpPct }}%</label>
            <input type="range" min="70" max="100" step="5" v-model.number="linkHcpPct" class="sb-link-slider" />
          </div>

          <!-- Match name -->
          <div class="sb-link-field sb-link-field--row">
            <label class="sb-link-lbl">Name (optional)</label>
            <input type="text" v-model="linkName" placeholder="Saturday 4v4" class="sb-input sb-input--name" />
          </div>

          <div v-if="linkError" class="sb-link-error">{{ linkError }}</div>

          <button
            class="sb-link-go"
            :disabled="!canCreateLink || creatingLink"
            @click="createInlineLink"
          >
            {{ creatingLink ? 'Creating…' : 'Create cross-match' }}
          </button>
        </div>
      </template>
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
import { useRosterStore } from '../stores/roster'
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
const rosterStore = useRosterStore()
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

// ── Inline link form ─────────────────────────────────────────────
// In-place flow so the captain doesn't lose the launch sheet. The standalone
// /cross-match/setup route stays as-is for direct navigation (Home + invite paths).
const showLinkForm = ref(false)
const linkTeamB = ref([])
const linkBalls = ref(2)
const linkStake = ref(20)
const linkHcpPct = ref(100)
const linkName = ref('')
const linkError = ref('')
const creatingLink = ref(false)

const activeMemberIds = computed(() => new Set((roundsStore.activeMembers || []).map(m => m.id)))

function lastNameKey(p) { return (p.name || '').split(/\s+/).pop()?.toLowerCase() || '' }

const linkRoster = computed(() => {
  const all = (rosterStore.players || []).filter(p => !activeMemberIds.value.has(p.id))
  const favs = all.filter(p => p.is_favorite).slice().sort((a, b) => lastNameKey(a).localeCompare(lastNameKey(b)))
  const others = all.filter(p => !p.is_favorite).slice().sort((a, b) => lastNameKey(a).localeCompare(lastNameKey(b)))
  return [...favs, ...others]
})

function playerLastName(p) { return (p.name || '').split(/\s+/).slice(-1)[0] }
function isLinkPlayerOn(p) { return linkTeamB.value.some(x => x.id === p.id) }
function toggleLinkPlayer(p) {
  const i = linkTeamB.value.findIndex(x => x.id === p.id)
  if (i >= 0) linkTeamB.value.splice(i, 1)
  else if (linkTeamB.value.length < 4) linkTeamB.value.push(p)
}

const canCreateLink = computed(() => linkTeamB.value.length > 0 && Number(linkStake.value) > 0)

function openLinkForm() {
  if (!rosterStore.players?.length) rosterStore.fetchPlayers?.()
  linkError.value = ''
  showLinkForm.value = true
}
function cancelLinkForm() {
  showLinkForm.value = false
  linkTeamB.value = []
  linkBalls.value = 2
  linkStake.value = 20
  linkHcpPct.value = 100
  linkName.value = ''
  linkError.value = ''
}

async function createInlineLink() {
  if (!canCreateLink.value || creatingLink.value) return
  const round = roundsStore.activeRound
  if (!round?.id) { linkError.value = 'No active round.'; return }
  creatingLink.value = true
  linkError.value = ''
  try {
    const foursomeBPayload = linkTeamB.value.map(p => ({
      id: p.id,
      name: p.name,
      short_name: p.short_name || (p.name || '').split(' ')[0],
      ghin_index: p.ghin_index ?? null,
      ghin_number: p.ghin_number ?? null,
      nickname: p.nickname ?? null,
      use_nickname: p.use_nickname ?? false,
    }))
    await linkedStore.createLinkedMatch({
      name: linkName.value.trim() || `4v4 · ${round.course_name || ''}`.trim(),
      roundAId: round.id,
      ballsToCount: linkBalls.value,
      stake: Number(linkStake.value) || 20,
      hcpPct: linkHcpPct.value / 100,
      sideBets: null,
      courseName: round.course_name,
      tee: round.tee,
      holesMode: round.holes_mode || '18',
      courseSnapshot: round.course_snapshot || null,
      foursomeBPlayers: foursomeBPayload,
    })
    cancelLinkForm()
  } catch (e) {
    linkError.value = e?.message || 'Could not create the cross-match.'
  } finally {
    creatingLink.value = false
  }
}

// Reset the form whenever the sheet re-opens so a previously dismissed draft
// doesn't reappear next time.
watch(() => props.show, (open) => { if (!open) showLinkForm.value = false })
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

/* ── Inline cross-match link form ──────────────────────────── */
.sb-link-form {
  margin-top: 4px;
  padding: 12px;
  background: rgba(99,179,237,.05);
  border: 1px solid rgba(99,179,237,.2);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sb-link-form-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: #93c5fd;
}
.sb-link-close {
  background: none;
  border: none;
  color: var(--gw-text-tertiary, rgba(240,237,224,.5));
  font-size: 18px;
  line-height: 1;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 6px;
}
.sb-link-close:active { background: rgba(255,255,255,.06); }
.sb-link-hint { font-size: 11px; color: rgba(240,237,224,.55); line-height: 1.4; }
.sb-link-field { display: flex; flex-direction: column; gap: 6px; }
.sb-link-field--row { flex-direction: row; align-items: center; gap: 10px; }
.sb-link-field--row .sb-link-lbl { flex: 1; }
.sb-link-lbl {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--gw-text-tertiary, rgba(240,237,224,.55));
}
.sb-link-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.sb-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 14px;
  background: rgba(99,179,237,.15);
  border: 1px solid rgba(99,179,237,.35);
  color: #93c5fd;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.sb-link-chip-x { font-size: 11px; opacity: .65; margin-left: 2px; }
.sb-link-roster {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--gw-border-subtle, rgba(255,255,255,.07));
  border-radius: 8px;
  background: rgba(0,0,0,.18);
  -webkit-overflow-scrolling: touch;
}
.sb-link-roster-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--gw-border-subtle, rgba(255,255,255,.05));
  color: var(--gw-text, #f0ede0);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sb-link-roster-row:last-child { border-bottom: none; }
.sb-link-roster-row:disabled { opacity: .3; cursor: default; }
.sb-link-roster-row--on { background: rgba(99,179,237,.12); }
.sb-link-roster-name { font-size: 13px; font-weight: 600; flex: 1; }
.sb-link-roster-hcp { font-size: 11px; color: var(--gw-text-tertiary, rgba(240,237,224,.5)); font-family: var(--gw-font-mono, monospace); }
.sb-link-pills { display: flex; gap: 6px; }
.sb-link-pill {
  padding: 6px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text-tertiary, rgba(240,237,224,.55));
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sb-link-pill--on {
  background: rgba(99,179,237,.18);
  border-color: rgba(99,179,237,.4);
  color: #93c5fd;
}
.sb-link-slider { flex: 0 0 110px; accent-color: #93c5fd; }
.sb-input--name { width: 140px; }
.sb-link-error {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(248,113,113,.1);
  border: 1px solid rgba(248,113,113,.3);
  color: #f87171;
  font-size: 12px;
}
.sb-link-go {
  margin-top: 4px;
  padding: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #93c5fd, #60a5fa);
  color: #0c0f0d;
  border: none;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sb-link-go:disabled { opacity: .35; cursor: not-allowed; }
.sb-link-go:active:not(:disabled) { transform: scale(.99); }
</style>
