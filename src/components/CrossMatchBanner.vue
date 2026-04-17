<template>
  <!-- Hidden entirely if we don't have a live match, silenced, or if a pending confirm is showing -->
  <div v-if="display && !silenced" class="cmb-wrapper">
    <RouterLink
      :to="`/cross-match/${display.match.id}`"
      class="cmb"
      :class="`cmb--${display.tone}`"
    >
      <span class="cmb-icon">{{ display.icon }}</span>
      <span class="cmb-label">{{ display.label }}</span>
      <span class="cmb-arrow">›</span>
    </RouterLink>
    <!-- Options button for pending matches -->
    <div v-if="display.tone === 'pending' || display.tone === 'waiting'" class="cmb-options">
      <button
        class="cmb-options-btn"
        @click.prevent.stop="showOptions = !showOptions"
        title="Options"
      >⋯</button>
      <div v-if="showOptions" class="cmb-options-menu" @click.stop>
        <button class="cmb-opt" @click="silenceBanner">🔕 Silence — don't show again</button>
        <button class="cmb-opt cmb-opt--danger" @click="confirmCancel">🚫 Cancel cross-match</button>
        <button class="cmb-opt" @click="showOptions = false">Close</button>
      </div>
      <div v-if="showOptions" class="cmb-options-backdrop" @click="showOptions = false"></div>
    </div>
  </div>

  <!-- Cancel confirm -->
  <div v-if="confirmingCancel" class="cmb-cancel-confirm">
    <div class="cmb-cancel-body">
      <strong>Cancel this cross-match?</strong>
      The invite code will stop working. Both foursomes' rounds are kept.
    </div>
    <div class="cmb-cancel-actions">
      <button class="cmb-cancel-btn" @click="confirmingCancel = false">Keep it</button>
      <button class="cmb-cancel-btn cmb-cancel-btn--danger" @click="doCancel">Yes, cancel</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { computeLinkedMatch, summarizeLinkedMatch } from '../modules/linkedMatch'

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const linkedStore = useLinkedMatchesStore()

// Silence — persistent in localStorage per match ID. Hides the banner
// permanently until the match status changes to 'linked' or 'complete'.
const SILENCE_KEY = 'gw_silenced_matches'
const showOptions = ref(false)
const confirmingCancel = ref(false)
const pendingCancelId = ref(null)

function _getSilenced() {
  try { return JSON.parse(localStorage.getItem(SILENCE_KEY) || '[]') } catch { return [] }
}
const silenced = computed(() => {
  const m = relevantMatch.value
  if (!m) return false
  // Auto-unsilence when match goes live or complete
  if (m.status === 'linked' || m.status === 'complete') return false
  return _getSilenced().includes(m.id)
})

function silenceBanner() {
  showOptions.value = false
  const m = relevantMatch.value
  if (!m) return
  const list = _getSilenced()
  if (!list.includes(m.id)) list.push(m.id)
  localStorage.setItem(SILENCE_KEY, JSON.stringify(list))
  // Force reactivity tick
  tick.value++
}

function confirmCancel() {
  showOptions.value = false
  // Cache the match ID now — relevantMatch may go null after status changes
  pendingCancelId.value = relevantMatch.value?.id || null
  confirmingCancel.value = true
}

async function doCancel() {
  const id = pendingCancelId.value
  confirmingCancel.value = false
  pendingCancelId.value = null
  if (!id) return
  try {
    await linkedStore.cancelLinkedMatch(id)
    tick.value++
  } catch (e) {
    console.warn('[cmb] cancel failed:', e)
  }
}

// Internal tick so we can recompute when scores change on either round.
// Realtime subscription bumps this ref; `display` is computed off it.
const tick = ref(0)
// Cached loaded rounds for the match we're tracking (to avoid re-fetching
// on every banner render). Keyed by round_id.
const roundsCache = ref({})
let activeMatchId = null

/**
 * Find the linked match this user should see a banner for.
 * Priority: an active linked match that matches the currently-viewed
 * round (if there is one); otherwise the most recent pending/linked match.
 */
const relevantMatch = computed(() => {
  if (!authStore.isAuthenticated) return null
  const myMatches = linkedStore.linkedMatches.filter(m => m.status === 'pending' || m.status === 'linked')
  if (!myMatches.length) return null

  const activeRound = roundsStore.activeRound
  if (activeRound?.id) {
    const forActive = myMatches.find(m => m.round_a_id === activeRound.id || m.round_b_id === activeRound.id)
    if (forActive) return forActive
  }

  // Otherwise the most recent (list is already ordered newest-first from store)
  return myMatches[0] || null
})

/**
 * Compute the visible banner state. Returns null when we should render nothing.
 */
const display = computed(() => {
  // Depend on tick so realtime updates re-run this computed.
  // eslint-disable-next-line no-unused-expressions
  tick.value
  const m = relevantMatch.value
  if (!m) return null

  // Pending — no round B yet. Show simple waiting chip.
  if (m.status === 'pending' || !m.round_b_id) {
    return {
      match: m,
      icon: '⛳',
      label: `Waiting for Foursome B · code ${m.invite_code}`,
      tone: 'pending',
    }
  }

  // Linked — try to compute live state from cached rounds
  const ra = roundsCache.value[m.round_a_id]
  const rb = roundsCache.value[m.round_b_id]
  if (!ra || !rb) {
    return { match: m, icon: '⛳', label: '4v4 linked · loading…', tone: 'pending' }
  }

  try {
    const result = computeLinkedMatch(ra, rb, m.match_config || {})
    const s = summarizeLinkedMatch(m, ra, rb, result)
    const iconByTone = { pending: '⛳', waiting: '⏳', live: '🎮', final: '🏆', tie: '🤝', cancelled: '🚫' }
    return {
      match: m,
      icon: iconByTone[s.tone || s.state] || '⛳',
      // Strip the leading emoji from label since we render our own
      label: s.label.replace(/^[^\s]+\s/, ''),
      tone: s.tone || s.state,
    }
  } catch (e) {
    console.warn('[cmb] compute failed:', e)
    return { match: m, icon: '⛳', label: '4v4 linked · live', tone: 'live' }
  }
})

/**
 * Load both round bundles for the given match and cache them.
 * Called on mount and when the relevant match changes.
 */
async function hydrate(match) {
  if (!match) return
  try {
    const { supabase } = await import('../supabase')
    const ids = [match.round_a_id, match.round_b_id].filter(Boolean)
    for (const rid of ids) {
      if (roundsCache.value[rid]) continue
      const { data } = await supabase
        .from('rounds')
        .select('*, round_members(*), scores(*)')
        .eq('id', rid)
        .maybeSingle()
      if (data) roundsCache.value = { ...roundsCache.value, [rid]: data }
    }
    tick.value++
  } catch (e) {
    console.warn('[cmb] hydrate failed:', e)
  }
}

/**
 * Refresh just the scores on a specific round (realtime-callback cheap path).
 */
async function refreshScoresFor(roundId) {
  if (!roundId || !roundsCache.value[roundId]) return
  try {
    const { supabase } = await import('../supabase')
    const { data } = await supabase.from('scores').select('*').eq('round_id', roundId)
    if (Array.isArray(data)) {
      const cached = { ...roundsCache.value[roundId], scores: data }
      roundsCache.value = { ...roundsCache.value, [roundId]: cached }
      tick.value++
    }
  } catch { /* non-fatal */ }
}

/**
 * When the relevant match changes, (re)subscribe and hydrate.
 */
watch(relevantMatch, (m, prev) => {
  if (m?.id === activeMatchId) return
  if (activeMatchId) linkedStore.unsubscribeLinkedMatch()
  activeMatchId = m?.id || null
  if (m) {
    hydrate(m)
    linkedStore.subscribeLinkedMatch(m, (kind /*, payload */) => {
      if (kind === 'scores-a') refreshScoresFor(m.round_a_id)
      else if (kind === 'scores-b') refreshScoresFor(m.round_b_id)
      else if (kind === 'linked-match') {
        // Match status changed — refresh the store list and re-hydrate
        linkedStore.fetchUserLinkedMatches().then(() => hydrate(relevantMatch.value))
      }
    })
  }
}, { immediate: true })

onMounted(async () => {
  if (authStore.isAuthenticated && !linkedStore.linkedMatches.length) {
    await linkedStore.fetchUserLinkedMatches()
  }
})

onUnmounted(() => {
  linkedStore.unsubscribeLinkedMatch()
})
</script>

<style scoped>
.cmb-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.cmb-wrapper .cmb {
  flex: 1;
  margin-right: 0;
}
/* Options button + dropdown */
.cmb-options { position: relative; flex-shrink: 0; }
.cmb-options-btn {
  width: 34px; height: 34px;
  margin: 10px 16px 10px 4px;
  border-radius: 50%;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.7);
  font-size: 16px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  -webkit-tap-highlight-color: transparent;
  font-weight: 900;
  letter-spacing: 1px;
}
.cmb-options-btn:active { background: rgba(255,255,255,.12); }
.cmb-options-backdrop {
  position: fixed; inset: 0; z-index: 59; background: transparent;
}
.cmb-options-menu {
  position: absolute;
  top: 36px; right: 0;
  z-index: 60;
  background: var(--gw-neutral-800, #1e2720);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  min-width: 220px;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
  overflow: hidden;
}
.cmb-opt {
  display: block; width: 100%;
  padding: 13px 16px;
  text-align: left; background: none; border: none;
  font-size: 13px; font-weight: 600; color: var(--gw-text);
  cursor: pointer; font-family: inherit;
  border-bottom: 1px solid rgba(255,255,255,.06);
  -webkit-tap-highlight-color: transparent;
}
.cmb-opt:last-child { border-bottom: none; }
.cmb-opt:active { background: rgba(255,255,255,.06); }
.cmb-opt--danger { color: #f87171; }

/* Cancel confirm inline card */
.cmb-cancel-confirm {
  margin: 0 16px 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.4);
  display: flex; flex-direction: column; gap: 10px;
}
.cmb-cancel-body {
  font-size: 12px; color: rgba(240,237,224,.8); line-height: 1.45;
}
.cmb-cancel-body strong { color: var(--gw-text); }
.cmb-cancel-actions { display: flex; gap: 8px; }
.cmb-cancel-btn {
  flex: 1; padding: 9px 12px; border-radius: 9px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  font-family: inherit; border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.06); color: var(--gw-text);
  -webkit-tap-highlight-color: transparent;
}
.cmb-cancel-btn--danger {
  background: rgba(239,68,68,.2); border-color: rgba(239,68,68,.5);
  color: #f87171;
}

.cmb-dismiss {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: 10px 16px 10px 4px;
  border-radius: 50%;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(240,237,224,.55);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.cmb-dismiss:active { background: rgba(255,255,255,.12); }

.cmb {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 16px;
  padding: 10px 14px;
  border-radius: 14px;
  text-decoration: none;
  color: var(--gw-text);
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  transition: transform .12s, border-color .12s;
  -webkit-tap-highlight-color: transparent;
}
.cmb:active { transform: scale(.98); }

.cmb--pending {
  background: rgba(255,255,255,.04);
  border-color: rgba(255,255,255,.1);
}
.cmb--waiting {
  background: rgba(255,255,255,.04);
  border-color: rgba(212,175,55,.25);
}
.cmb--live {
  background: linear-gradient(135deg, rgba(212,175,55,.16) 0%, rgba(212,175,55,.04) 100%);
  border-color: rgba(212,175,55,.5);
  animation: cmb-pulse 2.4s ease-in-out infinite;
}
.cmb--final,
.cmb--win {
  background: linear-gradient(135deg, rgba(34,197,94,.18) 0%, rgba(34,197,94,.04) 100%);
  border-color: rgba(34,197,94,.45);
}
.cmb--tie {
  background: rgba(255,255,255,.05);
  border-color: rgba(147,197,253,.35);
}
.cmb--cancelled {
  background: rgba(239,68,68,.08);
  border-color: rgba(239,68,68,.3);
  opacity: .75;
}

@keyframes cmb-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,.2); }
  50%      { box-shadow: 0 0 0 4px rgba(212,175,55,.08); }
}

.cmb-icon { font-size: 18px; flex-shrink: 0; }
.cmb-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .01em;
  color: var(--gw-text, #f0ede0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cmb-arrow {
  font-size: 20px;
  font-weight: 300;
  color: rgba(240,237,224,.45);
  flex-shrink: 0;
}
</style>
