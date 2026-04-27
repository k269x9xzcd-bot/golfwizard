<template>
  <div class="view lms-view">

    <!-- Ambient glow background -->
    <div class="lms-ambient" aria-hidden="true">
      <div class="lms-glow lms-glow--a"></div>
      <div class="lms-glow lms-glow--b"></div>
    </div>

    <header class="lms-header">
      <button class="lms-back" @click="handleBack">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        {{ step === 'format' ? 'Home' : 'Back' }}
      </button>
      <div class="lms-title-block">
        <h1 class="lms-title">⚔️ 4v4 Match</h1>
        <span class="lms-step-pill">{{ stepPill }}</span>
      </div>
    </header>

    <!-- Step 1: Format -->
    <div v-if="step === 'format'" class="lms-step">

      <div class="lms-hero">
        <div class="lms-hero-label">Two foursomes. One match.</div>
        <div class="lms-hero-sub">Set the stakes, pick the games, and send the invite link.</div>
      </div>

      <!-- Format -->
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

      <!-- Handicap -->
      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">📊</span>
          <span class="lms-card-title">Handicap Allowance</span>
        </div>
        <div class="lms-hcp-row">
          <input v-model.number="hcpPct" type="range" min="70" max="100" step="5" class="lms-slider" />
          <span class="lms-hcp-value">{{ hcpPct }}%</span>
        </div>
        <div class="lms-stake-hint">USGA stroke play default is 90%. Full course handicap × {{ hcpPct }}%.</div>
      </div>

      <!-- Main stake -->
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

      <!-- Side bets -->
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
          <div class="lms-exposure-hint">Eagle bounty actual amount depends on eagles made</div>
        </div>
      </div>

      <!-- Match name -->
      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">✏️</span>
          <span class="lms-card-title">Match Name</span>
          <span class="lms-optional-badge">optional</span>
        </div>
        <input v-model="matchName" type="text" class="lms-text-input" placeholder="Saturday 4v4" />
      </div>

      <div class="lms-footer">
        <button class="lms-btn-primary" @click="step = 'foursome-b'">Pick opposition →</button>
      </div>
    </div>

    <!-- Step 2: Pick Foursome B -->
    <div v-if="step === 'foursome-b'" class="lms-step">

      <div class="lms-hero lms-hero--sm">
        <div class="lms-hero-label">Who's the opposition?</div>
        <div class="lms-hero-sub">Pick up to 4 players. They open the invite link and score immediately — no wizard needed.</div>
      </div>

      <div class="lms-card">
        <div class="lms-card-header">
          <span class="lms-card-icon">👥</span>
          <span class="lms-card-title">Foursome B</span>
          <span class="lms-card-badge" :class="foursomeBSelected.length === 4 ? 'lms-card-badge--full' : ''">
            {{ foursomeBSelected.length }}/4
          </span>
        </div>

        <div v-if="foursomeBSelected.length" class="lms-selected-chips">
          <span v-for="p in foursomeBSelected" :key="p.id" class="lms-chip" @click="toggleFoursomeB(p)">
            {{ p.short_name || p.name.split(' ')[0] }}<span class="lms-chip-x">×</span>
          </span>
        </div>

        <div class="lms-player-list">
          <button
            v-for="p in sortedRoster"
            :key="p.id"
            class="lms-player-row"
            :class="{
              'lms-player-row--on': foursomeBSelected.some(s => s.id === p.id),
              'lms-player-row--disabled': !foursomeBSelected.some(s => s.id === p.id) && foursomeBSelected.length >= 4
            }"
            @click="toggleFoursomeB(p)"
          >
            <span class="lms-player-check">
              <svg v-if="foursomeBSelected.some(s => s.id === p.id)" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>
            </span>
            <span class="lms-player-name">{{ p.name }}</span>
            <span class="lms-player-hcp" v-if="p.ghin_index != null">{{ p.ghin_index }}</span>
          </button>
        </div>
      </div>

      <div v-if="hasActiveRound" class="lms-active-round-notice">
        <span>⛳</span>
        <div>
          <strong>Using your active round</strong>
          <span> — {{ activeRound.course_name }}</span>
        </div>
      </div>

      <div class="lms-footer">
        <button class="lms-btn-ghost lms-btn-ghost--sm" @click="step = 'format'">← Back</button>
        <button
          class="lms-btn-primary"
          :disabled="foursomeBSelected.length === 0 || creating"
          @click="hasActiveRound ? createMatchFromActiveRound() : step = 'wizard'"
        >
          {{ creating ? 'Creating…' : hasActiveRound ? 'Create match →' : 'Set up your round →' }}
        </button>
      </div>
    </div>

    <!-- Step 3: WizardOverlay -->
    <WizardOverlay
      v-if="step === 'wizard'"
      :skipOpponents="true"
      @close="step = 'foursome-b'"
      @created="onRoundACreated"
    />

    <!-- Step 3b: Attach failed -->
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
        <button class="lms-btn-ghost lms-btn-ghost--sm" @click="step = 'format'">Start over</button>
        <button class="lms-btn-primary" @click="retryAttachMatch">🔁 Retry</button>
      </div>
      <button class="lms-btn-text" @click="$router.push('/scoring')">Skip — just score my round</button>
    </div>

    <!-- Step 4: Share invite -->
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
          <span class="lms-card-title">Other Foursome</span>
        </div>
        <div class="lms-fp-players">
          <span v-for="p in foursomeBSelected" :key="p.id" class="lms-fp-chip">
            <span class="lms-fp-initial">{{ (p.short_name || p.name)[0] }}</span>
            {{ p.short_name || p.name.split(' ')[0] }}
          </span>
        </div>
        <div class="lms-fp-hint">Their pre-built round is ready — open the link and start scoring.</div>
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

const step = ref('format')
const ballsToCount = ref(1)
const stake = ref(20)
const hcpPct = ref(90)
const matchName = ref('')
const error = ref('')
const copied = ref(false)
const created = ref(null)
const pendingRound = ref(null)
const creating = ref(false)

// Deep-clone DEFAULT_SIDE_BETS so each session is independent
const sideBets = ref(DEFAULT_SIDE_BETS.map(b => ({ ...b, enabled: false })))

const activeSideBets = computed(() => sideBets.value.filter(b => b.enabled).length)

// Rough max exposure: main + sum of active side bets (eagle bounty ~2 eagles typical)
const estimatedMax = computed(() => {
  let total = stake.value
  for (const b of sideBets.value) {
    if (!b.enabled) continue
    if (b.type === 'eagleBounty') total += b.stake * 2
    else total += b.stake
  }
  return total
})

const stepPill = computed(() => {
  if (step.value === 'format') return 'Step 1 · Format & Stakes'
  if (step.value === 'foursome-b') return 'Step 2 · Pick Opposition'
  if (step.value === 'wizard') return 'Step 3 · Your Round'
  if (step.value === 'invite') return 'Done · Share'
  return ''
})

const foursomeBSelected = ref([])

const sortedRoster = computed(() => {
  const ps = [...(rosterStore.players || [])]
  return ps.sort((a, b) => {
    const aLast = (a.name || '').split(/\s+/).pop()?.toLowerCase() || ''
    const bLast = (b.name || '').split(/\s+/).pop()?.toLowerCase() || ''
    return aLast.localeCompare(bLast)
  })
})

function toggleFoursomeB(player) {
  const idx = foursomeBSelected.value.findIndex(p => p.id === player.id)
  if (idx >= 0) foursomeBSelected.value.splice(idx, 1)
  else if (foursomeBSelected.value.length < 4) foursomeBSelected.value.push(player)
}

function handleBack() {
  if (step.value === 'format') router.push('/')
  else if (step.value === 'foursome-b') step.value = 'format'
  else if (step.value === 'wizard') step.value = 'foursome-b'
}

async function onRoundACreated(round) {
  error.value = ''
  pendingRound.value = round

  const foursomeBPayload = foursomeBSelected.value.map(p => ({
    id: p.id, name: p.name,
    short_name: p.short_name || p.name.split(' ')[0],
    ghin_index: p.ghin_index ?? null,
    ghin_number: p.ghin_number ?? null,
    nickname: p.nickname ?? null,
    use_nickname: p.use_nickname ?? false,
  }))

  // Store all bets (enabled and disabled) so roundtrip is lossless;
  // computeCrossBestBall skips bets with enabled:false
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
    error.value = e?.message || 'Round saved but match attach failed. Tap retry.'
    step.value = 'attach-failed'
  }
}

async function createMatchFromActiveRound() {
  const round = activeRound.value
  if (!round?.id) { error.value = 'No active round found.'; return }
  creating.value = true
  error.value = ''
  try { await onRoundACreated(round) }
  finally { creating.value = false }
}

async function retryAttachMatch() {
  if (!pendingRound.value) { error.value = 'Lost round — start over.'; step.value = 'format'; return }
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
  min-height: 100%;
  background: var(--gw-neutral-950);
  position: relative; overflow: hidden;
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 24px);
}
.lms-ambient {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
.lms-glow {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.13;
}
.lms-glow--a {
  width: 340px; height: 340px;
  background: radial-gradient(circle, #d4af37, transparent);
  top: -80px; left: -80px;
  animation: drift-a 12s ease-in-out infinite alternate;
}
.lms-glow--b {
  width: 260px; height: 260px;
  background: radial-gradient(circle, #60a5fa, transparent);
  bottom: 25%; right: -60px;
  animation: drift-b 15s ease-in-out infinite alternate;
}
@keyframes drift-a { from { transform: translate(0,0) } to { transform: translate(28px,36px) } }
@keyframes drift-b { from { transform: translate(0,0) } to { transform: translate(-18px,28px) } }

.lms-header {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 10px;
  padding: 16px 16px 8px;
}
.lms-back {
  display: flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text-muted); font-size: 13px; font-weight: 600;
  border-radius: 20px; padding: 6px 12px 6px 8px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.lms-title-block { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.lms-title {
  margin: 0; font-family: var(--gw-font-display);
  font-size: 20px; color: var(--gw-text); line-height: 1;
}
.lms-step-pill {
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--gw-text-muted);
}

.lms-step {
  position: relative; z-index: 2;
  padding: 4px 16px 24px;
  display: flex; flex-direction: column; gap: 14px;
}

.lms-hero { padding: 6px 4px 0; }
.lms-hero--sm { padding: 4px 4px 0; }
.lms-hero-label {
  font-family: var(--gw-font-display); font-size: 22px; font-weight: 800; line-height: 1.1;
  background: linear-gradient(135deg, #edd655, #d4af37);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.lms-hero-sub {
  font-size: 13px; color: rgba(240,237,224,.5); line-height: 1.5; margin-top: 4px;
}

.lms-card {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09);
  border-radius: 18px; padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
  backdrop-filter: blur(12px);
}
.lms-card-header { display: flex; align-items: center; gap: 8px; }
.lms-card-icon { font-size: 16px; }
.lms-card-title {
  font-size: 13px; font-weight: 800; letter-spacing: .04em;
  text-transform: uppercase; color: var(--gw-text); flex: 1;
}
.lms-card-badge {
  font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px;
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
  color: var(--gw-text-muted);
}
.lms-card-badge--active { background: rgba(212,175,55,.15); border-color: rgba(212,175,55,.3); color: #d4af37; }
.lms-card-badge--full { background: rgba(34,197,94,.15); border-color: rgba(34,197,94,.3); color: #4ade80; }
.lms-optional-badge {
  font-size: 10px; font-weight: 600; color: var(--gw-text-muted);
  padding: 2px 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px;
}

.lms-radio-group { display: flex; flex-direction: column; gap: 8px; }
.lms-radio {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-radius: 14px; background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08); color: var(--gw-text);
  cursor: pointer; text-align: left; font-family: inherit;
  transition: background .15s, border-color .15s; -webkit-tap-highlight-color: transparent;
}
.lms-radio--on { background: rgba(212,175,55,.1); border-color: rgba(212,175,55,.45); }
.lms-radio-dot {
  width: 17px; height: 17px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.2); flex-shrink: 0; position: relative;
}
.lms-radio--on .lms-radio-dot { border-color: var(--gw-gold); }
.lms-radio--on .lms-radio-dot::after {
  content: ''; position: absolute; inset: 3px; background: var(--gw-gold); border-radius: 50%;
}
.lms-radio-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.lms-radio-title { font-size: 15px; font-weight: 700; }
.lms-radio-desc { font-size: 12px; color: var(--gw-text-muted); }
.lms-radio-badge {
  font-size: 10px; font-weight: 700; padding: 3px 8px;
  border-radius: 10px; background: rgba(212,175,55,.2); color: #d4af37; white-space: nowrap;
}

.lms-hcp-row { display: flex; align-items: center; gap: 12px; }
.lms-slider { flex: 1; accent-color: #d4af37; cursor: pointer; }
.lms-hcp-value {
  font-family: var(--gw-font-mono, monospace);
  font-size: 18px; font-weight: 900; color: #d4af37; min-width: 42px; text-align: right;
}

.lms-stake-row {
  display: flex; align-items: center; gap: 6px;
  background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px; padding: 10px 14px;
}
.lms-stake-prefix, .lms-stake-suffix { color: var(--gw-text-muted); font-size: 15px; font-weight: 700; }
.lms-stake-input {
  flex: 1; background: transparent; border: none; color: var(--gw-text);
  font-family: var(--gw-font-mono, monospace); font-size: 22px; font-weight: 900; min-width: 0; outline: none;
}
.lms-stake-hint { font-size: 11px; color: rgba(240,237,224,.4); line-height: 1.4; }

.lms-sidebet-list { display: flex; flex-direction: column; gap: 6px; }
.lms-sidebet-row {
  border-radius: 13px; border: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.02); overflow: hidden;
  transition: border-color .15s, background .15s;
}
.lms-sidebet-row--on { border-color: rgba(212,175,55,.28); background: rgba(212,175,55,.05); }
.lms-sidebet-toggle {
  display: flex; align-items: flex-start; gap: 10px;
  width: 100%; padding: 11px 12px;
  background: transparent; border: none; color: var(--gw-text);
  cursor: pointer; font-family: inherit; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.lms-sb-check {
  width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 1px;
  border: 2px solid rgba(255,255,255,.2);
  display: flex; align-items: center; justify-content: center;
  transition: background .12s, border-color .12s;
}
.lms-sb-check--on { background: #d4af37; border-color: #d4af37; color: #0c0f0d; }
.lms-sb-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.lms-sb-name { font-size: 14px; font-weight: 700; }
.lms-sb-desc { font-size: 11px; color: rgba(240,237,224,.48); line-height: 1.35; }
.lms-sb-stake {
  display: flex; align-items: center; gap: 5px;
  padding: 0 12px 10px 40px;
}
.lms-sb-stake-prefix, .lms-sb-stake-suffix { font-size: 12px; color: var(--gw-text-muted); font-weight: 700; }
.lms-sb-stake-input {
  width: 50px; background: rgba(0,0,0,.3); border: 1px solid rgba(212,175,55,.3);
  border-radius: 8px; padding: 5px 8px; color: #d4af37;
  font-family: var(--gw-font-mono, monospace); font-size: 15px; font-weight: 800;
  outline: none; text-align: center;
}

.lms-exposure {
  padding: 10px 12px; background: rgba(0,0,0,.2); border-radius: 10px;
  display: flex; flex-direction: column; gap: 4px;
}
.lms-exposure-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: rgba(240,237,224,.38);
}
.lms-exposure-range {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--gw-font-mono, monospace); font-size: 16px; font-weight: 800;
}
.lms-exposure-win { color: #4ade80; }
.lms-exposure-lose { color: #f87171; }
.lms-exposure-sep { font-size: 12px; color: var(--gw-text-muted); }
.lms-exposure-hint { font-size: 10px; color: rgba(240,237,224,.32); }

.lms-text-input {
  background: rgba(0,0,0,.2); border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px; padding: 11px 14px; font-size: 15px;
  color: var(--gw-text); font-family: inherit; outline: none;
}
.lms-text-input:focus { border-color: rgba(212,175,55,.4); }

.lms-selected-chips { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 2px; }
.lms-chip {
  display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 20px;
  background: rgba(212,175,55,.14); border: 1px solid rgba(212,175,55,.32);
  color: #d4af37; font-size: 13px; font-weight: 700; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.lms-chip-x { font-size: 15px; line-height: 1; opacity: .65; }

.lms-player-list { display: flex; flex-direction: column; gap: 4px; }
.lms-player-row {
  display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 12px;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
  color: var(--gw-text); font-family: inherit; cursor: pointer; text-align: left;
  -webkit-tap-highlight-color: transparent; transition: background .12s, border-color .12s;
}
.lms-player-row--on { background: rgba(212,175,55,.1); border-color: rgba(212,175,55,.4); }
.lms-player-row--disabled { opacity: .32; pointer-events: none; }
.lms-player-check {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,.18);
  display: flex; align-items: center; justify-content: center; color: #0c0f0d;
  transition: background .12s, border-color .12s;
}
.lms-player-row--on .lms-player-check { background: #d4af37; border-color: #d4af37; }
.lms-player-name { flex: 1; font-size: 15px; font-weight: 600; }
.lms-player-hcp { font-size: 12px; color: var(--gw-text-muted); font-family: var(--gw-font-mono, monospace); }

.lms-active-round-notice {
  display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 12px;
  background: rgba(212,175,55,.08); border: 1px solid rgba(212,175,55,.22);
  font-size: 13px; color: rgba(240,237,224,.7);
}
.lms-active-round-notice strong { color: var(--gw-text); font-weight: 700; }

.lms-footer { display: flex; gap: 8px; padding-top: 4px; }
.lms-footer--col { flex-direction: column; }

.lms-btn-primary {
  flex: 1; padding: 15px; border-radius: 16px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d; border: none; font-family: var(--gw-font-body);
  font-size: 15px; font-weight: 800; cursor: pointer; letter-spacing: .3px;
  box-shadow: 0 4px 16px rgba(212,175,55,.22); -webkit-tap-highlight-color: transparent;
  transition: transform .1s;
}
.lms-btn-primary:disabled { opacity: .4; }
.lms-btn-primary:active:not(:disabled) { transform: scale(.98); }
.lms-btn-primary--green {
  background: linear-gradient(145deg, #4ade80, #22c55e, #16a34a);
  box-shadow: 0 4px 16px rgba(34,197,94,.22);
}
.lms-btn-ghost {
  width: 100%; padding: 13px; border-radius: 14px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text); font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.lms-btn-ghost--sm { flex: 0 0 auto; padding: 13px 18px; width: auto; }
.lms-btn-text {
  width: 100%; background: none; border: none; color: var(--gw-text-muted);
  font-family: inherit; font-size: 13px; padding: 8px; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.lms-invite-hero {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, rgba(212,175,55,.14), rgba(212,175,55,.04));
  border: 1px solid rgba(212,175,55,.32); border-radius: 22px;
  padding: 28px 20px 22px;
  display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
}
.lms-invite-glow {
  position: absolute; top: -40px; left: 50%; transform: translateX(-50%);
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(212,175,55,.28), transparent);
  filter: blur(40px); pointer-events: none;
}
.lms-invite-emoji { font-size: 52px; position: relative; z-index: 1; }
.lms-invite-title {
  font-family: var(--gw-font-display); font-size: 22px; color: var(--gw-gold);
  line-height: 1.2; font-weight: 800; position: relative; z-index: 1;
}
.lms-invite-badges {
  display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; position: relative; z-index: 1;
}
.lms-badge {
  padding: 4px 10px; border-radius: 20px;
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14);
  font-size: 12px; font-weight: 700; color: var(--gw-text);
}
.lms-badge--side { background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.28); color: #93c5fd; }

.lms-fp-players { display: flex; flex-wrap: wrap; gap: 8px; }
.lms-fp-chip {
  display: flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 22px;
  background: rgba(212,175,55,.12); border: 1px solid rgba(212,175,55,.26);
  font-size: 13px; font-weight: 700; color: #d4af37;
}
.lms-fp-initial {
  width: 22px; height: 22px; border-radius: 50%; background: #d4af37;
  color: #0c0f0d; font-size: 11px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
}
.lms-fp-hint { font-size: 11px; color: rgba(240,237,224,.38); line-height: 1.4; }

.lms-code-card {
  background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px; padding: 18px;
  display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
}
.lms-code-label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--gw-text-muted); font-weight: 700; }
.lms-code { font-family: var(--gw-font-mono, monospace); font-size: 36px; font-weight: 900; letter-spacing: .2em; color: var(--gw-text); }
.lms-code-hint { font-size: 11px; color: rgba(240,237,224,.38); }

.lms-error-card {
  display: flex; gap: 14px; padding: 16px; border-radius: 16px;
  background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.28);
}
.lms-error-emoji { font-size: 32px; flex-shrink: 0; }
.lms-error-body { display: flex; flex-direction: column; gap: 3px; }
.lms-error-title { font-size: 16px; font-weight: 800; color: var(--gw-text); }
.lms-error-sub { font-size: 13px; color: rgba(240,237,224,.6); }
.lms-error-detail { font-size: 11px; color: #f87171; line-height: 1.4; margin-top: 4px; }

.lms-error-banner {
  margin: 0 16px; padding: 10px 12px; border-radius: 10px; position: relative; z-index: 2;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
  color: #f87171; font-size: 13px; line-height: 1.4;
}
</style>
