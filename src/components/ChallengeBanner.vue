<template>
  <!-- Inbound challenges -->
  <div v-for="c in challengesStore.inbound" :key="c.id" class="cb-wrapper">
    <div class="cb-card">
      <div class="cb-icon">⚔️</div>
      <div class="cb-body">
        <div class="cb-title">Cross-match challenge!</div>
        <div class="cb-sub">
          {{ challengerName(c) }} wants to play
          <span v-if="c.format !== 'tbd'" class="cb-format">{{ formatLabel(c.format) }}</span>
          <span v-else class="cb-format">Best Ball</span>
          against your group
        </div>
      </div>
      <div class="cb-actions">
        <button class="cb-btn cb-btn--accept" @click="accept(c)">Accept</button>
        <button class="cb-btn cb-btn--decline" @click="decline(c)">Decline</button>
      </div>
    </div>
  </div>

  <!-- Outbound pending (so you know it's waiting) -->
  <div v-for="c in pendingOutbound" :key="`out-${c.id}`" class="cb-wrapper cb-wrapper--out">
    <div class="cb-card cb-card--out">
      <div class="cb-icon">⏳</div>
      <div class="cb-body">
        <div class="cb-title">Waiting for {{ shortEmail(c.challenged_email) }}</div>
        <div class="cb-sub">Challenge sent · tap to cancel</div>
      </div>
      <button class="cb-btn cb-btn--cancel" @click="cancel(c)">✕</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChallengesStore } from '../stores/challenges'
import { useRoundsStore } from '../stores/rounds'

const challengesStore = useChallengesStore()
const roundsStore = useRoundsStore()

const pendingOutbound = computed(() =>
  challengesStore.outbound.filter(c => c.status === 'pending')
)

function formatLabel(f) {
  if (f === '1bb') return '1-ball best ball'
  if (f === '2bb') return '2-ball best ball'
  return 'best ball'
}

function challengerName(c) {
  // message is "Jason challenged you..." — extract first word as name
  if (c.message) return c.message.split(' ')[0]
  return c.challenged_email?.split('@')[0] || 'Someone'
}

function shortEmail(email) {
  return email?.split('@')[0] || email
}

async function accept(challenge) {
  // If there's an active round, link it. Otherwise just mark accepted —
  // the user will link it when they start their round.
  const roundId = roundsStore.activeRound?.id ?? null
  await challengesStore.acceptChallenge(challenge.id, roundId)
  // TODO: trigger linked match creation if both sides have round IDs
}

async function decline(challenge) {
  await challengesStore.declineChallenge(challenge.id)
}

async function cancel(challenge) {
  await challengesStore.cancelChallenge(challenge.id)
}
</script>

<style scoped>
.cb-wrapper {
  margin: 0 16px 8px;
}
.cb-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(212,175,55,.14) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.45);
  animation: cb-pulse 2.4s ease-in-out infinite;
}
.cb-card--out {
  background: rgba(255,255,255,.04);
  border-color: rgba(255,255,255,.12);
  animation: none;
}
@keyframes cb-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,.15); }
  50%       { box-shadow: 0 0 0 4px rgba(212,175,55,.06); }
}
.cb-icon { font-size: 20px; flex-shrink: 0; }
.cb-body { flex: 1; min-width: 0; }
.cb-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--gw-text);
  margin-bottom: 2px;
}
.cb-sub {
  font-size: 12px;
  color: rgba(240,237,224,.65);
  line-height: 1.35;
}
.cb-format {
  color: #d4af37;
  font-weight: 700;
}
.cb-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
.cb-btn {
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: none;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}
.cb-btn--accept {
  background: linear-gradient(145deg, #edd655, #d4af37);
  color: #0c0f0d;
}
.cb-btn--decline {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.6);
}
.cb-btn--cancel {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.5);
  font-size: 14px;
  padding: 7px 10px;
  flex-shrink: 0;
}
</style>
