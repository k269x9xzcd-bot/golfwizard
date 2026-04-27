<template>
  <div class="view lms-view">

    <!-- Ambient glow -->
    <div class="lms-ambient" aria-hidden="true">
      <div class="lms-glow lms-glow--a"></div>
      <div class="lms-glow lms-glow--b"></div>
    </div>

    <header class="lms-header">
      <button class="lms-back" @click="handleBack">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        {{ step === 'players' ? 'Home' : 'Back' }}
      </button>
      <div class="lms-title-block">
        <h1 class="lms-title">⚔️ 4v4 Match</h1>
        <span class="lms-step-pill">{{ stepPill }}</span>
      </div>
    </header>

    <!-- ── Step 1: Pick Players ──────────────────────────── -->
    <div v-if="step === 'players'" class="lms-step">

      <div class="lms-hero">
        <div class="lms-hero-label">Pick your players</div>
        <div class="lms-hero-sub">Assign each player to Team A or Team B. Max 4 per side.</div>
      </div>

      <!-- Team counters -->
      <div class="lms-team-row">
        <div class="lms-team-badge lms-team-badge--a" :class="{ 'lms-team-badge--full': teamA.length >= 4 }">
          <span class="lms-team-label">Team A</span>
          <span class="lms-team-count">{{ teamA.length }}/4</span>
        </div>
        <div class="lms-team-vs">vs</div>
        <div class="lms-team-badge lms-team-badge--b" :class="{ 'lms-team-badge--full': teamB.length >= 4 }">
          <span class="lms-team-label">Team B</span>
          <span class="lms-team-count">{{ teamB.length }}/4</span>
        </div>
      </div>

      <!-- Selected players — two rows, A left / B right -->
      <div v-if="teamA.length || teamB.length" class="lms-teams-preview">
        <div class="lms-preview-col">
          <div class="lms-preview-col-label lms-preview-col-label--a">Team A</div>
          <div v-for="p in teamA" :key="p.id" class="lms-preview-chip lms-preview-chip--a" @click="unassign(p)">
            <span class="lms-preview-name">{{ p.name }}</span><span class="lms-chip-x">×</span>
          </div>
        </div>
        <div class="lms-preview-divider"></div>
        <div class="lms-preview-col">
          <div class="lms-preview-col-label lms-preview-col-label--b">Team B</div>
          <div v-for="p in teamB" :key="p.id" class="lms-preview-chip lms-preview-chip--b" @click="unassign(p)">
            <span class="lms-preview-name">{{ p.name }}</span><span class="lms-chip-x">×</span>
          </div>
        </div>
      </div>

      <!-- Search -->
      <input v-model="playerSearch" class="lms-search-input" placeholder="Search roster…" />

      <!-- Roster list -->
      <div class="lms-card lms-card--flush">
        <div
          v-for="p in filteredRoster"
          :key="p.id"
          class="lms-player-row"
          :class="assignmentClass(p)"
        >
          <div class="lms-player-info">
            <span class="lms-player-name">{{ p.name }}</span>
            <span v-if="p.ghin_index != null" class="lms-player-hcp">{{ p.ghin_index }}</span>
          </div>
          <div class="lms-assign-btns">
            <button
              class="lms-assign-btn lms-assign-btn--a"
              :class="{ 'lms-assign-btn--active': isOnTeam(p, 'a') }"
              :disabled="!isOnTeam(p, 'a') && teamA.length >= 4"
              @click="assign(p, 'a')"
            >A</button>
            <button
              class="lms-assign-btn lms-assign-btn--b"
              :class="{ 'lms-assign-btn--active': isOnTeam(p, 'b') }"
              :disabled="!isOnTeam(p, 'b') && teamB.length >= 4"
              @click="assign(p, 'b')"
            >B</button>
          </div>
        </div>

        <!-- Guest add -->
        <div class="lms-guest-row">
          <input v-model="guestName" class="lms-guest-input" placeholder="Add guest…" @keydown.enter="guestHcpRef?.focus()" />
          <input v-model.number="guestHcp" ref="guestHcpRef" class="lms-guest-hcp" placeholder="HCP" type="number" step="0.1" />
          <button class="lms-assign-btn lms-assign-btn--a" :disabled="!guestName.trim() || teamA.length >= 4" @click="addGuest('a')">A</button>
          <button class="lms-assign-btn lms-assign-btn--b" :disabled="!guestName.trim() || teamB.length >= 4" @click="addGuest('b')">B</button>
        </div>
      </div>

      <div class="lms-footer">
        <button
          class="lms-btn-primary"
          :disabled="teamA.length === 0 || teamB.length === 0"
          @click="step = 'format'"
        >Set stakes →</button>
      </div>
    </div>

    <!-- ── Step 2: Format & Bets ─────────────────────────── -->
    <div v-if="step === 'format'" class="lms-step">

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">🏌️</span>
          <span class="lms-card-title">Format</span>
        </div>
        <div class="lms-radio-group">
          <button class="lms-radio" :class="{ 'lms-radio--on': ballsToCount === 1 }" @click="ballsToCount = 1">
            <span class="lms-radio-dot"></span>
            <span class="lms-radio-body">
              <span class="lms-radio-title">1 Best Ball</span>
              <span class="lms-radio-desc">Lowest net score per hole counts</span>
            </span>
            <span v-if="ballsToCount === 1" class="lms-radio-badge">Selected</span>
          </button>
          <button class="lms-radio" :class="{ 'lms-radio--on': ballsToCount === 2 }" @click="ballsToCount = 2">
            <span class="lms-radio-dot"></span>
            <span class="lms-radio-body">
              <span class="lms-radio-title">2 Best Ball</span>
              <span class="lms-radio-desc">Sum of two lowest net scores per hole</span>
            </span>
            <span v-if="ballsToCount === 2" class="lms-radio-badge">Selected</span>
          </button>
        </div>
      </div>

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">📊</span>
          <span class="lms-card-title">Handicap Allowance</span>
        </div>
        <div class="lms-hcp-row">
          <input v-model.number="hcpPct" type="range" min="70" max="100" step="5" class="lms-slider" />
          <span class="lms-hcp-value">{{ hcpPct }}%</span>
        </div>
        <div class="lms-stake-hint">USGA stroke play default is 90%.</div>
      </div>

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">💰</span>
          <span class="lms-card-title">Main Match Stake</span>
        </div>
        <div class="lms-stake-row">
          <span class="lms-stake-prefix">$</span>
          <input v-model.number="stake" type="number" min="1" class="lms-stake-input" inputmode="numeric" />
          <span class="lms-stake-suffix">/ player</span>
        </div>
        <div class="lms-stake-hint">Each losing player pays each winning player this amount.</div>
      </div>

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">🎲</span>
          <span class="lms-card-title">Side Bets</span>
          <span class="lms-card-badge" :class="activeSideBets > 0 ? 'lms-card-badge--active' : ''">{{ activeSideBets }} active</span>
        </div>
        <div class="lms-sidebet-list">
          <div v-for="bet in sideBets" :key="bet.type" class="lms-sidebet-row" :class="{ 'lms-sidebet-row--on': bet.enabled }">
            <button class="lms-sidebet-toggle" @click="bet.enabled = !bet.enabled">
              <span class="lms-sb-check" :class="{ 'lms-sb-check--on': bet.enabled }">
                <svg v-if="bet.enabled" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>
              </span>
              <span class="lms-sb-info">
                <span class="lms-sb-name">{{ bet.label }}</span>
                <span class="lms-sb-desc">{{ bet.description }}</span>
              </span>
            </button>
            <div v-if="bet.enabled" class="lms-sb-stake">
              <span class="lms-sb-stake-prefix">$</span>
              <input v-model.number="bet.stake" type="number" min="1" class="lms-sb-stake-input" inputmode="numeric" @click.stop />
              <span class="lms-sb-stake-suffix">/ player</span>
            </div>
          </div>
        </div>
        <div class="lms-exposure">
          <div class="lms-exposure-label">Estimated max exposure / player</div>
          <div class="lms-exposure-range">
            <span class="lms-exposure-win">+${{ estimatedMax }}</span>
            <span class="lms-exposure-sep">↔</span>
            <span class="lms-exposure-lose">−${{ estimatedMax }}</span>
          </div>
        </div>
      </div>

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">✏️</span>
          <span class="lms-card-title">Match Name</span>
          <span class="lms-optional-badge">optional</span>
        </div>
        <input v-model="matchName" type="text" class="lms-text-input" placeholder="Saturday 4v4" />
      </div>

      <div class="lms-footer">
        <button class="lms-btn-ghost lms-btn-ghost--sm" @click="step = 'players'">← Back</button>
        <button class="lms-btn-primary" :disabled="creating" @click="hasActiveRound ? createMatchFromActiveRound() : step = 'wizard'">
          {{ creating ? 'Creating…' : hasActiveRound ? 'Create match →' : 'Set up your round →' }}
        </button>
      </div>
    </div>

    <!-- ── Step 3: WizardOverlay (Team A round) ──────────── -->
    <WizardOverlay
      v-if="step === 'wizard'"
      :lockedPlayers="teamAAsWizardPlayers"
      @close="step = 'format'"
      @created="onRoundACreated"
    />

    <!-- ── Attach failed ──────────────────────────────────── -->
    <div v-if="step === 'attach-failed'" class="lms-step">
      <div class="lms-error-card">
        <div class="lms-error-emoji">⚠️</div>
        <div class="lms-error-body">
          <div class="lms-error-title">Almost there</div>
          <div class="lms-error-sub">Your round is saved but attaching the match failed.</div>
          <div v-if="error" class="lms-error-detail">{{ error }}</div>
        </div>
      </div>
      <div class="lms-footer">
        <button class="lms-btn-ghost lms-btn-ghost--sm" @click="step = 'players'">Start over</button>
        <button class="lms-btn-primary" @click="retryAttachMatch">🔁 Retry</button>
      </div>
      <button class="lms-btn-text" @click="$router.push('/scoring')">Skip — just score my round</button>
    </div>

    <!-- ── Share invite ────────────────────────────────────── -->
    <div v-if="step === 'invite'" class="lms-step">
      <div class="lms-invite-hero">
        <div class="lms-invite-glow"></div>
        <div class="lms-invite-emoji">⚔️</div>
        <div class="lms-invite-title">{{ created?.match?.name }}</div>
        <div class="lms-invite-badges">
          <span class="lms-badge">{{ ballsToCount === 1 ? '1BB Net' : '2BB Net' }}</span>
          <span class="lms-badge">${{ stake }}/player</span>
          <span class="lms-badge">{{ hcpPct }}% HCP</span>
          <span v-if="activeSideBets > 0" class="lms-badge lms-badge--side">+{{ activeSideBets }} side bet{{ activeSideBets !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">👥</span>
          <span class="lms-card-title">Teams</span>
        </div>
        <div class="lms-teams-summary">
          <div class="lms-teams-col">
            <div class="lms-teams-col-label lms-teams-col-label--a">Team A</div>
            <div v-for="p in teamA" :key="p.id" class="lms-fp-chip lms-fp-chip--a">
              <span class="lms-fp-initial">{{ (p.short_name || p.name || '?')[0] }}</span>
              {{ p.short_name || p.name }}
            </div>
          </div>
          <div class="lms-teams-vs-divider">vs</div>
          <div class="lms-teams-col">
            <div class="lms-teams-col-label lms-teams-col-label--b">Team B</div>
            <div v-for="p in teamB" :key="p.id" class="lms-fp-chip lms-fp-chip--b">
              <span class="lms-fp-initial">{{ (p.short_name || p.name || '?')[0] }}</span>
              {{ p.short_name || p.name }}
            </div>
          </div>
        </div>
        <div class="lms-fp-hint" style="margin-top:8px">Team B opens the invite link to score immediately.</div>
      </div>

      <div class="lms-code-card">
        <div class="lms-code-label">Invite Code</div>
        <div class="lms-code">{{ created?.match?.invite_code }}</div>
        <div class="lms-code-hint">Or share the link below</div>
      </div>

      <div class="lms-footer lms-footer--col">
        <button class="lms-btn-primary" @click="shareInvite">📤 Share invite link</button>
        <button class="lms-btn-ghost" @click="copyInvite">{{ copied ? '✓ Copied!' : '📋 Copy link' }}</button>
      </div>
      <div class="lms-footer">
        <button class="lms-btn-primary lms-btn-primary--green" @click="goToScoring">⛳ Start scoring →</button>
      </div>
    </div>

    <div v-if="error && step !== 'attach-failed'" class="lms-error-banner">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { useRosterStore } from '../stores/roster'
import { useRoundsStore } from '../stores/rounds'
import { DEFAULT_SIDE_BETS } from '../modules/gameEngine'
import WizardOverlay from '../components/WizardOverlay.vue'

const router = useRouter()
const linkedStore = useLinkedMatchesStore()
const rosterStore = useRosterStore()
const roundsStore = useRoundsStore()

if (!rosterStore.players?.length) rosterStore.fetchPlayers?.()

const activeRound = computed(() => roundsStore.activeRound)
const hasActiveRound = computed(() => !!activeRound.value?.id)

const step = ref('players')
const ballsToCount = ref(2)
const stake = ref(20)
const hcpPct = ref(90)
const matchName = ref('')
const error = ref('')
const copied = ref(false)
const created = ref(null)
const pendingRound = ref(null)
const creating = ref(false)

const teamA = ref([])
const teamB = ref([])
const guests = ref([])
const playerSearch = ref('')
const guestName = ref('')
const guestHcp = ref('')
const guestHcpRef = ref(null)

const sideBets = ref(DEFAULT_SIDE_BETS.map(b => ({ ...b, enabled: false })))
const activeSideBets = computed(() => sideBets.value.filter(b => b.enabled).length)
const estimatedMax = computed(() => {
  let total = stake.value
  for (const b of sideBets.value) {
    if (!b.enabled) continue
    total += b.type === 'eagleBounty' ? b.stake * 2 : b.stake
  }
  return total
})

const stepPill = computed(() => {
  if (step.value === 'players') return 'Step 1 · Pick Players'
  if (step.value === 'format') return 'Step 2 · Format & Stakes'
  if (step.value === 'wizard') return 'Step 3 · Your Round'
  if (step.value === 'invite') return 'Done · Share'
  return ''
})

const sortedRoster = computed(() => {
  return [...(rosterStore.players || [])].sort((a, b) => {
    const aL = (a.name || '').split(/\s+/).pop()?.toLowerCase() || ''
    const bL = (b.name || '').split(/\s+/).pop()?.toLowerCase() || ''
    return aL.localeCompare(bL)
  })
})

const filteredRoster = computed(() => {
  const q = playerSearch.value.trim().toLowerCase()
  const all = [...sortedRoster.value, ...guests.value]
  return q ? all.filter(p => p.name?.toLowerCase().includes(q)) : all
})

function isOnTeam(p, team) {
  return (team === 'a' ? teamA : teamB).value.some(x => x.id === p.id)
}

function assignmentClass(p) {
  if (isOnTeam(p, 'a')) return 'lms-player-row--a'
  if (isOnTeam(p, 'b')) return 'lms-player-row--b'
  return ''
}

function assign(p, team) {
  teamA.value = teamA.value.filter(x => x.id !== p.id)
  teamB.value = teamB.value.filter(x => x.id !== p.id)
  if (team === 'a' && teamA.value.length < 4) teamA.value.push(p)
  else if (team === 'b' && teamB.value.length < 4) teamB.value.push(p)
}

function unassign(p) {
  teamA.value = teamA.value.filter(x => x.id !== p.id)
  teamB.value = teamB.value.filter(x => x.id !== p.id)
}

function addGuest(team) {
  if (!guestName.value.trim()) return
  const g = {
    id: `guest_${Date.now()}`,
    name: guestName.value.trim(),
    short_name: guestName.value.trim().split(/\s+/).pop(),
    ghin_index: guestHcp.value !== '' ? Number(guestHcp.value) : null,
    isGuest: true,
  }
  guests.value.push(g)
  assign(g, team)
  guestName.value = ''
  guestHcp.value = ''
}

const teamAAsWizardPlayers = computed(() =>
  teamA.value.map(p => ({
    id: p.id,
    name: p.name,
    shortName: p.short_name || p.name?.split(' ').pop() || p.name,
    ghinIndex: p.ghin_index ?? null,
    ghinNumber: p.ghin_number ?? null,
    nickname: p.nickname ?? null,
    useNickname: p.use_nickname ?? false,
  }))
)

function handleBack() {
  if (step.value === 'players') router.push('/')
  else if (step.value === 'format') step.value = 'players'
  else if (step.value === 'wizard') step.value = 'format'
}

async function onRoundACreated(round) {
  error.value = ''
  pendingRound.value = round
  const foursomeBPayload = teamB.value.map(p => ({
    id: p.id, name: p.name,
    short_name: p.short_name || p.name?.split(' ')[0],
    ghin_index: p.ghin_index ?? null,
    ghin_number: p.ghin_number ?? null,
    nickname: p.nickname ?? null,
    use_nickname: p.use_nickname ?? false,
  }))
  const sideBetsConfig = sideBets.value
    .map(({ type, label, stake, enabled, description }) => ({ type, label, stake, enabled, description }))
  try {
    created.value = await linkedStore.createLinkedMatch({
      name: matchName.value || `4v4 · ${round.course_name}`,
      roundAId: round.id,
      ballsToCount: ballsToCount.value,
      stake: stake.value,
      hcpPct: hcpPct.value / 100,
      sideBets: sideBetsConfig,
      courseName: round.course_name,
      tee: round.tee,
      holesMode: round.holes_mode || '18',
      courseSnapshot: round.course_snapshot || null,
      foursomeBPlayers: foursomeBPayload,
    })
    pendingRound.value = null
    step.value = 'invite'
  } catch (e) {
    console.error('[lms] createLinkedMatch failed:', e)
    error.value = e?.message || 'Round saved but match attach failed.'
    step.value = 'attach-failed'
  }
}

async function createMatchFromActiveRound() {
  const round = activeRound.value
  if (!round?.id) { error.value = 'No active round found.'; return }
  creating.value = true
  error.value = ''
  try { await onRoundACreated(round) } finally { creating.value = false }
}

async function retryAttachMatch() {
  if (!pendingRound.value) { error.value = 'Lost round — start over.'; step.value = 'players'; return }
  await onRoundACreated(pendingRound.value)
}

async function shareInvite() {
  if (!created.value) return
  const url = created.value.inviteUrl
  const text = `${created.value.match.name} — GolfWizard 4v4\n${ballsToCount.value === 1 ? '1 BB Net' : '2 BB Net'} · $${stake.value}/player\n\nOpen your pre-built round:\n${url}`
  if (navigator.share) {
    try { await navigator.share({ title: 'GolfWizard 4v4 invite', text, url }) } catch {}
  } else { copyInvite() }
}

async function copyInvite() {
  if (!created.value) return
  try {
    await navigator.clipboard.writeText(created.value.inviteUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

function goToScoring() { router.push('/scoring') }
</script>

<style scoped>
.lms-view {
  min-height: 100%; background: var(--gw-neutral-950);
  position: relative; overflow: hidden;
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 24px);
}
.lms-ambient { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.lms-glow { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.13; }
.lms-glow--a { width: 340px; height: 340px; background: radial-gradient(circle, #d4af37, transparent); top: -80px; left: -80px; animation: drift-a 12s ease-in-out infinite alternate; }
.lms-glow--b { width: 260px; height: 260px; background: radial-gradient(circle, #60a5fa, transparent); bottom: 25%; right: -60px; animation: drift-b 15s ease-in-out infinite alternate; }
@keyframes drift-a { from { transform: translate(0,0) } to { transform: translate(28px,36px) } }
@keyframes drift-b { from { transform: translate(0,0) } to { transform: translate(-18px,28px) } }

.lms-header { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 16px 16px 8px; }
.lms-back { display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: var(--gw-text-muted); font-size: 13px; font-weight: 600; border-radius: 20px; padding: 6px 12px 6px 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.lms-title-block { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.lms-title { margin: 0; font-family: var(--gw-font-display); font-size: 20px; color: var(--gw-text); line-height: 1; }
.lms-step-pill { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gw-text-muted); }

.lms-step { position: relative; z-index: 2; padding: 4px 16px 24px; display: flex; flex-direction: column; gap: 14px; }

.lms-hero { padding: 6px 4px 0; }
.lms-hero-label { font-family: var(--gw-font-display); font-size: 22px; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, #edd655, #d4af37); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.lms-hero-sub { font-size: 13px; color: rgba(240,237,224,.5); line-height: 1.5; margin-top: 4px; }

/* Team counters */
.lms-team-row { display: flex; align-items: center; gap: 10px; }
.lms-team-badge { flex: 1; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); }
.lms-team-badge--a { border-color: rgba(212,175,55,.3); background: rgba(212,175,55,.07); }
.lms-team-badge--b { border-color: rgba(96,165,250,.3); background: rgba(96,165,250,.07); }
.lms-team-badge--full { border-color: rgba(74,222,128,.4) !important; background: rgba(74,222,128,.08) !important; }
.lms-team-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
.lms-team-badge--a .lms-team-label { color: #d4af37; }
.lms-team-badge--b .lms-team-label { color: #60a5fa; }
.lms-team-count { font-size: 16px; font-weight: 900; color: var(--gw-text); font-family: var(--gw-font-mono, monospace); }
.lms-team-vs { font-size: 12px; font-weight: 700; color: var(--gw-text-muted); flex-shrink: 0; }

/* Teams preview - two columns, full names, wrap */
.lms-teams-preview { display: flex; gap: 10px; align-items: flex-start; }
.lms-preview-col { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.lms-preview-col-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 2px; }
.lms-preview-col-label--a { color: #d4af37; }
.lms-preview-col-label--b { color: #60a5fa; }
.lms-preview-divider { width: 1px; background: rgba(255,255,255,.1); align-self: stretch; flex-shrink: 0; margin-top: 18px; }
.lms-preview-chip { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent; gap: 4px; }
.lms-preview-chip--a { background: rgba(212,175,55,.12); border: 1px solid rgba(212,175,55,.28); color: #d4af37; }
.lms-preview-chip--b { background: rgba(96,165,250,.12); border: 1px solid rgba(96,165,250,.28); color: #60a5fa; }
.lms-preview-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lms-chip-x { font-size: 14px; opacity: .55; flex-shrink: 0; }

/* Search */
.lms-search-input { width: 100%; background: rgba(0,0,0,.2); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 10px 14px; font-size: 14px; color: var(--gw-text); font-family: inherit; outline: none; box-sizing: border-box; }
.lms-search-input:focus { border-color: rgba(212,175,55,.35); }

/* Cards */
.lms-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(12px); }
.lms-card--flush { padding: 0; overflow: hidden; gap: 0; }
.lms-card-header { display: flex; align-items: center; gap: 8px; }
.lms-card-icon { font-size: 16px; }
.lms-card-title { font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--gw-text); flex: 1; }
.lms-card-badge { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); color: var(--gw-text-muted); }
.lms-card-badge--active { background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.3); color: #d4af37; }
.lms-optional-badge { font-size: 10px; font-weight: 600; color: var(--gw-text-muted); padding: 2px 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; }

/* Player rows */
.lms-player-row { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,.06); transition: background .12s; }
.lms-player-row:last-child { border-bottom: none; }
.lms-player-row--a { background: rgba(212,175,55,.07); }
.lms-player-row--b { background: rgba(96,165,250,.07); }
.lms-player-info { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.lms-player-name { font-size: 15px; font-weight: 600; color: var(--gw-text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lms-player-hcp { font-size: 12px; color: var(--gw-text-muted); font-family: var(--gw-font-mono, monospace); flex-shrink: 0; }

/* A/B assign buttons */
.lms-assign-btns { display: flex; gap: 5px; flex-shrink: 0; }
.lms-assign-btn { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(255,255,255,.15); background: transparent; color: var(--gw-text-muted); font-size: 13px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; transition: all .12s; }
.lms-assign-btn:disabled { opacity: .25; pointer-events: none; }
.lms-assign-btn--a.lms-assign-btn--active { background: #d4af37; border-color: #d4af37; color: #0c0f0d; }
.lms-assign-btn--b.lms-assign-btn--active { background: #60a5fa; border-color: #60a5fa; color: #0c0f0d; }

/* Guest row */
.lms-guest-row { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-top: 1px solid rgba(255,255,255,.06); background: rgba(0,0,0,.1); }
.lms-guest-input { flex: 1; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 7px 10px; font-size: 14px; color: var(--gw-text); font-family: inherit; outline: none; min-width: 0; }
.lms-guest-hcp { width: 52px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 7px 8px; font-size: 14px; color: var(--gw-text); font-family: inherit; outline: none; text-align: center; }

/* Format step */
.lms-radio-group { display: flex; flex-direction: column; gap: 8px; }
.lms-radio { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); color: var(--gw-text); cursor: pointer; text-align: left; font-family: inherit; transition: background .15s, border-color .15s; -webkit-tap-highlight-color: transparent; }
.lms-radio--on { background: rgba(212,175,55,.1); border-color: rgba(212,175,55,.45); }
.lms-radio-dot { width: 17px; height: 17px; border-radius: 50%; border: 2px solid rgba(255,255,255,.2); flex-shrink: 0; position: relative; }
.lms-radio--on .lms-radio-dot { border-color: var(--gw-gold); }
.lms-radio--on .lms-radio-dot::after { content: ''; position: absolute; inset: 3px; background: var(--gw-gold); border-radius: 50%; }
.lms-radio-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.lms-radio-title { font-size: 15px; font-weight: 700; }
.lms-radio-desc { font-size: 12px; color: var(--gw-text-muted); }
.lms-radio-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 10px; background: rgba(212,175,55,.2); color: #d4af37; white-space: nowrap; }
.lms-hcp-row { display: flex; align-items: center; gap: 12px; }
.lms-slider { flex: 1; accent-color: #d4af37; cursor: pointer; }
.lms-hcp-value { font-family: var(--gw-font-mono, monospace); font-size: 18px; font-weight: 900; color: #d4af37; min-width: 42px; text-align: right; }
.lms-stake-row { display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 10px 14px; }
.lms-stake-prefix, .lms-stake-suffix { color: var(--gw-text-muted); font-size: 15px; font-weight: 700; }
.lms-stake-input { flex: 1; background: transparent; border: none; color: var(--gw-text); font-family: var(--gw-font-mono, monospace); font-size: 22px; font-weight: 900; min-width: 0; outline: none; }
.lms-stake-hint { font-size: 11px; color: rgba(240,237,224,.4); line-height: 1.4; }
.lms-sidebet-list { display: flex; flex-direction: column; gap: 6px; }
.lms-sidebet-row { border-radius: 13px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.02); overflow: hidden; transition: border-color .15s, background .15s; }
.lms-sidebet-row--on { border-color: rgba(212,175,55,.28); background: rgba(212,175,55,.05); }
.lms-sidebet-toggle { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 11px 12px; background: transparent; border: none; color: var(--gw-text); cursor: pointer; font-family: inherit; text-align: left; -webkit-tap-highlight-color: transparent; }
.lms-sb-check { width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 1px; border: 2px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; transition: background .12s, border-color .12s; }
.lms-sb-check--on { background: #d4af37; border-color: #d4af37; color: #0c0f0d; }
.lms-sb-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.lms-sb-name { font-size: 14px; font-weight: 700; }
.lms-sb-desc { font-size: 11px; color: rgba(240,237,224,.48); line-height: 1.35; }
.lms-sb-stake { display: flex; align-items: center; gap: 5px; padding: 0 12px 10px 40px; }
.lms-sb-stake-prefix, .lms-sb-stake-suffix { font-size: 12px; color: var(--gw-text-muted); font-weight: 700; }
.lms-sb-stake-input { width: 50px; background: rgba(0,0,0,.3); border: 1px solid rgba(212,175,55,.3); border-radius: 8px; padding: 5px 8px; color: #d4af37; font-family: var(--gw-font-mono, monospace); font-size: 15px; font-weight: 800; outline: none; text-align: center; }
.lms-exposure { padding: 10px 12px; background: rgba(0,0,0,.2); border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
.lms-exposure-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: rgba(240,237,224,.38); }
.lms-exposure-range { display: flex; align-items: center; gap: 8px; font-family: var(--gw-font-mono, monospace); font-size: 16px; font-weight: 800; }
.lms-exposure-win { color: #4ade80; }
.lms-exposure-lose { color: #f87171; }
.lms-exposure-sep { font-size: 12px; color: var(--gw-text-muted); }
.lms-text-input { background: rgba(0,0,0,.2); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 11px 14px; font-size: 15px; color: var(--gw-text); font-family: inherit; outline: none; }
.lms-text-input:focus { border-color: rgba(212,175,55,.4); }

/* Invite */
.lms-invite-hero { position: relative; overflow: hidden; background: linear-gradient(135deg, rgba(212,175,55,.14), rgba(212,175,55,.04)); border: 1px solid rgba(212,175,55,.32); border-radius: 22px; padding: 28px 20px 22px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.lms-invite-glow { position: absolute; top: -40px; left: 50%; transform: translateX(-50%); width: 200px; height: 200px; background: radial-gradient(circle, rgba(212,175,55,.28), transparent); filter: blur(40px); pointer-events: none; }
.lms-invite-emoji { font-size: 52px; position: relative; z-index: 1; }
.lms-invite-title { font-family: var(--gw-font-display); font-size: 22px; color: var(--gw-gold); line-height: 1.2; font-weight: 800; position: relative; z-index: 1; }
.lms-invite-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; position: relative; z-index: 1; }
.lms-badge { padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); font-size: 12px; font-weight: 700; color: var(--gw-text); }
.lms-badge--side { background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.28); color: #93c5fd; }
.lms-teams-summary { display: flex; gap: 10px; align-items: flex-start; }
.lms-teams-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.lms-teams-vs-divider { font-size: 11px; font-weight: 700; color: var(--gw-text-muted); padding-top: 24px; flex-shrink: 0; }
.lms-teams-col-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 2px; }
.lms-teams-col-label--a { color: #d4af37; }
.lms-teams-col-label--b { color: #60a5fa; }
.lms-fp-chip { display: flex; align-items: center; gap: 7px; padding: 5px 10px; border-radius: 22px; font-size: 13px; font-weight: 700; }
.lms-fp-chip--a { background: rgba(212,175,55,.12); border: 1px solid rgba(212,175,55,.26); color: #d4af37; }
.lms-fp-chip--b { background: rgba(96,165,250,.12); border: 1px solid rgba(96,165,250,.26); color: #60a5fa; }
.lms-fp-initial { width: 22px; height: 22px; border-radius: 50%; color: #0c0f0d; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lms-fp-chip--a .lms-fp-initial { background: #d4af37; }
.lms-fp-chip--b .lms-fp-initial { background: #60a5fa; }
.lms-fp-hint { font-size: 11px; color: rgba(240,237,224,.38); line-height: 1.4; }
.lms-code-card { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.lms-code-label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--gw-text-muted); font-weight: 700; }
.lms-code { font-family: var(--gw-font-mono, monospace); font-size: 36px; font-weight: 900; letter-spacing: .2em; color: var(--gw-text); }
.lms-code-hint { font-size: 11px; color: rgba(240,237,224,.38); }
.lms-footer { display: flex; gap: 8px; padding-top: 4px; }
.lms-footer--col { flex-direction: column; }
.lms-btn-primary { flex: 1; padding: 15px; border-radius: 16px; background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%); color: #0c0f0d; border: none; font-family: var(--gw-font-body); font-size: 15px; font-weight: 800; cursor: pointer; letter-spacing: .3px; box-shadow: 0 4px 16px rgba(212,175,55,.22); -webkit-tap-highlight-color: transparent; transition: transform .1s; }
.lms-btn-primary:disabled { opacity: .4; }
.lms-btn-primary:active:not(:disabled) { transform: scale(.98); }
.lms-btn-primary--green { background: linear-gradient(145deg, #4ade80, #22c55e, #16a34a); box-shadow: 0 4px 16px rgba(34,197,94,.22); }
.lms-btn-ghost { width: 100%; padding: 13px; border-radius: 14px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); color: var(--gw-text); font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.lms-btn-ghost--sm { flex: 0 0 auto; padding: 13px 18px; width: auto; }
.lms-btn-text { width: 100%; background: none; border: none; color: var(--gw-text-muted); font-family: inherit; font-size: 13px; padding: 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.lms-error-card { display: flex; gap: 14px; padding: 16px; border-radius: 16px; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.28); }
.lms-error-emoji { font-size: 32px; flex-shrink: 0; }
.lms-error-body { display: flex; flex-direction: column; gap: 3px; }
.lms-error-title { font-size: 16px; font-weight: 800; color: var(--gw-text); }
.lms-error-sub { font-size: 13px; color: rgba(240,237,224,.6); }
.lms-error-detail { font-size: 11px; color: #f87171; line-height: 1.4; margin-top: 4px; }
.lms-error-banner { margin: 0 16px; padding: 10px 12px; border-radius: 10px; position: relative; z-index: 2; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: #f87171; font-size: 13px; line-height: 1.4; }
</style>
