<template>
  <div class="view lms-view">
    <header class="lms-header">
      <button class="lms-back" @click="$router.push('/')">← Home</button>
      <h1 class="lms-title">Cross-Foursome Match</h1>
    </header>

    <!-- ── Step 1: Match format picker ─────────────────────── -->
    <div v-if="step === 'format'" class="lms-step">
      <div class="lms-step-label">Step 1 of 2 · Match format</div>
      <p class="lms-intro">
        Set the 4v4 best-ball bet between your foursome and the other one. You'll run the normal wizard next to set up your own foursome's round.
      </p>

      <div class="lms-card">
        <div class="lms-field-label">Format</div>
        <div class="lms-radio-group">
          <button
            class="lms-radio"
            :class="{ 'lms-radio--on': ballsToCount === 1 }"
            @click="ballsToCount = 1"
          >
            <span class="lms-radio-dot"></span>
            <span class="lms-radio-body">
              <span class="lms-radio-title">1 BB Net</span>
              <span class="lms-radio-desc">Lowest net score per hole per team</span>
            </span>
          </button>
          <button
            class="lms-radio"
            :class="{ 'lms-radio--on': ballsToCount === 2 }"
            @click="ballsToCount = 2"
          >
            <span class="lms-radio-dot"></span>
            <span class="lms-radio-body">
              <span class="lms-radio-title">2 BB Net</span>
              <span class="lms-radio-desc">Sum of the two lowest net scores per hole per team</span>
            </span>
          </button>
        </div>
      </div>

      <div class="lms-card">
        <div class="lms-field-label">Stake per player</div>
        <div class="lms-stake-row">
          <span class="lms-stake-prefix">$</span>
          <input
            v-model.number="stake"
            type="number"
            min="1"
            class="lms-stake-input"
          />
          <span class="lms-stake-suffix">/ player</span>
        </div>
        <div class="lms-stake-hint">Winners split losers' total. Tied match = no money changes hands.</div>
      </div>

      <div class="lms-card">
        <div class="lms-field-label">Match name</div>
        <input
          v-model="matchName"
          type="text"
          class="lms-text-input"
          placeholder="Saturday 4v4"
        />
      </div>

      <div class="lms-footer">
        <button class="lms-btn-primary" @click="step = 'wizard'">
          Set up your foursome →
        </button>
      </div>
    </div>

    <!-- ── Step 2: Host's wizard ─────────────────────── -->
    <!-- Reuses WizardOverlay; on success we call createLinkedMatch then flip to invite screen -->
    <WizardOverlay
      v-if="step === 'wizard'"
      @close="step = 'format'"
      @created="onRoundACreated"
    />

    <!-- ── Step 3: Share invite ─────────────────────── -->
    <div v-if="step === 'invite'" class="lms-step">
      <div class="lms-step-label">Match created · share with the other foursome</div>
      <div class="lms-invite-card">
        <div class="lms-invite-emoji">⛳</div>
        <div class="lms-invite-title">{{ matchName }}</div>
        <div class="lms-invite-sub">
          {{ ballsToCount === 1 ? '1 BB Net' : '2 BB Net' }} · ${{ stake }}/player
        </div>

        <div class="lms-code-box">
          <div class="lms-code-label">Invite code</div>
          <div class="lms-code">{{ created?.match?.invite_code }}</div>
        </div>

        <button class="lms-btn-primary" @click="shareInvite">
          📤 Share invite link
        </button>
        <button class="lms-btn-ghost" @click="copyInvite">
          {{ copied ? '✓ Copied' : '📋 Copy link' }}
        </button>

        <div class="lms-invite-hint">
          Any player in the other foursome opens this link on their phone, signs in with their email, then runs the wizard for their own foursome. The match auto-links once they finish.
        </div>
      </div>

      <div class="lms-footer">
        <button class="lms-btn-primary" @click="goToScoring">
          Start scoring →
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="lms-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLinkedMatchesStore, buildInviteUrl } from '../stores/linkedMatches'
import WizardOverlay from '../components/WizardOverlay.vue'

const router = useRouter()
const linkedStore = useLinkedMatchesStore()

const step = ref('format') // 'format' | 'wizard' | 'invite'
const ballsToCount = ref(1)
const stake = ref(20)
const matchName = ref('')
const error = ref('')
const copied = ref(false)
const created = ref(null) // { match, inviteUrl }

async function onRoundACreated(round) {
  error.value = ''
  try {
    created.value = await linkedStore.createLinkedMatch({
      name: matchName.value || `4v4 · ${round.course_name}`,
      roundAId: round.id,
      ballsToCount: ballsToCount.value,
      stake: stake.value,
    })
    step.value = 'invite'
  } catch (e) {
    console.error('[lms] createLinkedMatch failed:', e)
    error.value = e?.message || 'Could not create the linked match. Your foursome\'s round is still saved, but the cross-match wasn\'t attached.'
    step.value = 'format'
  }
}

async function shareInvite() {
  if (!created.value) return
  const url = created.value.inviteUrl
  const text = `Join my 4v4 best ball match — ${matchName.value || created.value.match.name}\n${created.value.match.match_config?.ballsToCount === 1 ? '1 BB Net' : '2 BB Net'} · $${stake.value}/player\n${url}`
  if (navigator.share) {
    try { await navigator.share({ title: 'GolfWizard 4v4 invite', text, url }) } catch {}
  } else {
    copyInvite()
  }
}

async function copyInvite() {
  if (!created.value) return
  try {
    await navigator.clipboard.writeText(created.value.inviteUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* clipboard unavailable — fall back silently */ }
}

function goToScoring() {
  router.push('/scoring')
}
</script>

<style scoped>
.lms-view {
  min-height: 100%;
  background: var(--gw-neutral-950);
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}
.lms-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 6px;
}
.lms-back {
  background: transparent;
  border: none;
  color: var(--gw-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  -webkit-tap-highlight-color: transparent;
}
.lms-title {
  margin: 0;
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-text);
}

.lms-step {
  padding: 4px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lms-step-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-text-muted);
  padding: 4px 2px 0;
}
.lms-intro {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(240,237,224,.65);
  margin: 0;
  padding: 0 2px;
}

.lms-card {
  background: var(--gw-card-bg);
  border: 1px solid var(--gw-card-border);
  border-radius: var(--gw-radius-lg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lms-field-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-text-muted);
}

.lms-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lms-radio {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.lms-radio:active { transform: scale(.99); }
.lms-radio--on {
  background: rgba(212,175,55,.1);
  border-color: rgba(212,175,55,.5);
}
.lms-radio-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,.25);
  flex-shrink: 0;
  position: relative;
}
.lms-radio--on .lms-radio-dot {
  border-color: var(--gw-gold);
}
.lms-radio--on .lms-radio-dot::after {
  content: '';
  position: absolute;
  inset: 2px;
  background: var(--gw-gold);
  border-radius: 50%;
}
.lms-radio-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.lms-radio-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--gw-text);
}
.lms-radio-desc {
  font-size: 12px;
  color: var(--gw-text-muted);
}

.lms-stake-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 8px 12px;
}
.lms-stake-prefix, .lms-stake-suffix {
  color: var(--gw-text-muted);
  font-size: 14px;
  font-weight: 700;
}
.lms-stake-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--gw-text);
  font-family: var(--gw-font-mono, monospace);
  font-size: 18px;
  font-weight: 700;
  min-width: 0;
  outline: none;
}
.lms-stake-hint {
  font-size: 11px;
  color: rgba(240,237,224,.45);
  line-height: 1.4;
}

.lms-text-input {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 15px;
  color: var(--gw-text);
  font-family: inherit;
  outline: none;
}

.lms-footer {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.lms-btn-primary {
  flex: 1;
  padding: 14px;
  border-radius: 14px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d;
  border: none;
  font-family: var(--gw-font-body);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: .3px;
  box-shadow: 0 2px 10px rgba(212,175,55,.25);
  -webkit-tap-highlight-color: transparent;
}
.lms-btn-primary:active { transform: scale(.98); }

.lms-btn-ghost {
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* ── Invite card ─────────────────────────────── */
.lms-invite-card {
  background: linear-gradient(135deg, rgba(212,175,55,.14) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.4);
  border-radius: 20px;
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.lms-invite-emoji { font-size: 48px; margin-bottom: 2px; }
.lms-invite-title {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-gold);
  line-height: 1.2;
}
.lms-invite-sub {
  font-size: 13px;
  color: rgba(240,237,224,.7);
  margin-bottom: 10px;
}
.lms-code-box {
  width: 100%;
  padding: 14px;
  background: rgba(0,0,0,.3);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.lms-code-label {
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-text-muted);
  font-weight: 700;
}
.lms-code {
  font-family: var(--gw-font-mono, monospace);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: .15em;
  color: var(--gw-text);
}
.lms-invite-hint {
  font-size: 11px;
  line-height: 1.45;
  color: rgba(240,237,224,.5);
  padding: 0 6px;
}

.lms-error {
  margin: 0 16px;
  padding: 10px 12px;
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3);
  color: #f87171;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
}
</style>
