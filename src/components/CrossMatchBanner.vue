<template>
  <!-- Hidden entirely if we don't have a live match, silenced, or if a pending confirm is showing -->
  <div v-if="display && !silenced" class="cmb-wrapper">

    <!-- Live match: two-button layout -->
    <div v-if="display.tone === 'live' || display.tone === 'waiting'" class="cmb cmb--live-row" :class="`cmb--${display.tone}`">
      <span class="cmb-icon">{{ display.icon }}</span>
      <span class="cmb-label">{{ display.label }}</span>
      <div class="cmb-live-actions">
        <button class="cmb-score-btn" @click="goScore">
          🏌️ Score
        </button>
        <RouterLink :to="`/cross-match/${display.match.id}`" class="cmb-standings-btn">
          Standings ›
        </RouterLink>
      </div>
    </div>

    <!-- Pending / other states: tap to view -->
    <template v-else>
      <RouterLink
        :to="`/cross-match/${display.match.id}`"
        class="cmb"
        :class="`cmb--${display.tone}`"
      >
        <span class="cmb-icon">{{ display.icon }}</span>
        <span class="cmb-label">{{ display.label }}</span>
        <span class="cmb-arrow">›</span>
      </RouterLink>
    </template>

    <!-- Options button for pending matches -->
    <div v-if="display.tone === 'pending'" class="cmb-options">
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
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoundsStore } from '../stores/rounds'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { computeLinkedMatch, summarizeLinkedMatch } from '../modules/linkedMatch'

const authStore = useAuthStore()
const roundsStore = useRoundsStore()
const linkedStore = useLinkedMatchesStore()
const router = useRouter()

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
  // undefined = not yet fetched (still loading); false/null = tried but failed
  if (ra === undefined || rb === undefined) {
    return { match: m, icon: '⛳', label: '4v4 linked · loading…', tone: 'pending' }
  }
  if (!ra || !rb) {
    // Hydration attempted but failed — show match name without live score data
    return { match: m, icon: '⛳', label: m.name || '4v4 linked', tone: 'pending' }
  }

  try {
    const result = computeLinkedMatch(ra, rb, m.match_config || {})
    const myRoundId = roundsStore.currentRound?.id ?? null
    const s = summarizeLinkedMatch(m, ra, rb, result, myRoundId)
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
    const { supaRawSelect } = await import('../modules/supaRaw')
    const ids = [match.round_a_id, match.round_b_id].filter(Boolean)
    for (const rid of ids) {
      if (roundsCache.value[rid] !== undefined) continue  // already fetched (or failed)
      let data = null
      try {
        const res = await Promise.race([
          supabase.from('rounds').select('*, round_members(*), scores(*)').eq('id', rid).maybeSingle(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('hydrate timed out')), 5000)),
        ])
        if (!res.error) data = res.data
      } catch (e) {
        if (e.message?.includes('timed out')) {
          try {
            const rows = await supaRawSelect('rounds', `select=*,round_members(*),scores(*)&id=eq.${rid}`, 8000)
            data = Array.isArray(rows) ? (rows[0] ?? false) : (rows || false)
          } catch { data = false }
        }
      }
      // Store result: object on success, false on failure.
      // undefined means "never tried" — used by display to distinguish loading from failed.
      roundsCache.value = { ...roundsCache.value, [rid]: data ?? false }
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
    const { supaRawSelect } = await import('../modules/supaRaw')
    let scores = null
    try {
      const res = await Promise.race([
        supabase.from('scores').select('*').eq('round_id', roundId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('refreshScores timed out')), 5000)),
      ])
      if (Array.isArray(res.data)) scores = res.data
    } catch (e) {
      if (e.message?.includes('timed out')) {
        try {
          const rows = await supaRawSelect('scores', `select=*&round_id=eq.${roundId}`, 8000)
          if (Array.isArray(rows)) scores = rows
        } catch {}
      }
    }
    if (Array.isArray(scores)) {
      roundsCache.value = { ...roundsCache.value, [roundId]: { ...roundsCache.value[roundId], scores } }
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

/**
 * Load the current user's round for this match and navigate to scoring.
 * Checks which round (A or B) they own by comparing owner_id in the cache.
 */
async function goScore() {
  const m = relevantMatch.value
  if (!m) return
  try {
    const uid = authStore.user?.id
    let roundId = null

    // 1. Check current round first (fastest, works even if RLS blocks cross-read)
    const cur = roundsStore.currentRound?.id
    if (cur && (cur === m.round_a_id || cur === m.round_b_id)) {
      roundId = cur
    }

    // 2. Check cache owner_id
    if (!roundId) {
      const ra = roundsCache.value[m.round_a_id]
      const rb = roundsCache.value[m.round_b_id]
      if (ra?.owner_id === uid) roundId = m.round_a_id
      else if (rb?.owner_id === uid) roundId = m.round_b_id
    }

    // 3. DB fallback — query only the rounds the user can see
    if (!roundId) {
      const { supabase } = await import('../supabase')
      const ids = [m.round_a_id, m.round_b_id].filter(Boolean)
      for (const id of ids) {
        const { data } = await supabase.from('rounds').select('id,owner_id').eq('id', id).maybeSingle()
        if (data?.owner_id === uid) { roundId = id; break }
      }
    }

    if (!roundId) { router.push(`/cross-match/${m.id}`); return }
    await roundsStore.loadRound(roundId)
    router.push('/scoring')
  } catch (e) {
    console.warn('[cmb] goScore failed:', e)
    router.push(`/cross-match/${m.id}`)
  }
}

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
/* Live match: two-button row */
.cmb--live-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 16px;
  padding: 10px 12px 10px 14px;
  border-radius: 14px;
  border: 1px solid rgba(212,175,55,.5);
  background: linear-gradient(135deg, rgba(212,175,55,.16) 0%, rgba(212,175,55,.04) 100%);
  animation: cmb-pulse 2.4s ease-in-out infinite;
}
.cmb-live-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.cmb-score-btn {
  padding: 7px 12px;
  border-radius: 9px;
  background: linear-gradient(145deg, #edd655, #d4af37);
  color: #0c0f0d;
  font-size: 12px;
  font-weight: 800;
  border: none;
  cursor: pointer;
  font-family: var(--gw-font-body);
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}
.cmb-score-btn:active { transform: scale(.95); }
.cmb-standings-btn {
  padding: 7px 10px;
  border-radius: 9px;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  color: rgba(240,237,224,.6);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}
.cmb-standings-btn:active { background: rgba(255,255,255,.12); }

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
  line-height: 1.3;
  letter-spacing: .01em;
  color: var(--gw-text, #f0ede0);
  white-space: normal;
  overflow-wrap: anywhere;
}
.cmb-arrow {
  font-size: 20px;
  font-weight: 300;
  color: rgba(240,237,224,.45);
  flex-shrink: 0;
}
</style>

<style>
/* ── CrossMatchBanner light theme (non-scoped) ── */
[data-theme="light"] .cmb {
  background: #ffffff !important;
  border-color: rgba(13,95,60,.2) !important;
  color: #0d1f12 !important;
}
[data-theme="light"] .cmb--pending,
[data-theme="light"] .cmb--waiting { background: #f4f7f5 !important; }
[data-theme="light"] .cmb--live-row {
  background: linear-gradient(135deg, rgba(154,122,30,.12) 0%, rgba(154,122,30,.04) 100%) !important;
  border-color: rgba(154,122,30,.5) !important;
}
[data-theme="light"] .cmb--live {
  background: linear-gradient(135deg, rgba(154,122,30,.12) 0%, rgba(154,122,30,.04) 100%) !important;
  border-color: rgba(154,122,30,.5) !important;
}
[data-theme="light"] .cmb--final,
[data-theme="light"] .cmb--win {
  background: linear-gradient(135deg, rgba(22,101,52,.12) 0%, rgba(22,101,52,.04) 100%) !important;
  border-color: rgba(22,101,52,.35) !important;
}
[data-theme="light"] .cmb--tie  { background: #f4f7f5 !important; border-color: rgba(59,130,246,.3) !important; }
[data-theme="light"] .cmb--cancelled { background: rgba(239,68,68,.06) !important; }
[data-theme="light"] .cmb-label { color: #0d1f12 !important; }
[data-theme="light"] .cmb-arrow { color: rgba(13,31,18,.35) !important; }
[data-theme="light"] .cmb-icon  { color: #0d1f12; }
[data-theme="light"] .cmb-standings-btn {
  background: rgba(13,95,60,.08) !important;
  border-color: rgba(13,95,60,.2) !important;
  color: #0d3325 !important;
}
[data-theme="light"] .cmb-options-btn,
[data-theme="light"] .cmb-dismiss {
  background: rgba(13,95,60,.07) !important;
  border-color: rgba(13,95,60,.15) !important;
  color: rgba(13,31,18,.6) !important;
}
[data-theme="light"] .cmb-options-menu {
  background: #ffffff !important;
  border-color: rgba(13,95,60,.15) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,.15) !important;
}
[data-theme="light"] .cmb-opt { color: #0d1f12 !important; border-bottom-color: rgba(13,95,60,.08) !important; }
[data-theme="light"] .cmb-opt--danger { color: #dc2626 !important; }
[data-theme="light"] .cmb-cancel-body { color: rgba(13,31,18,.8) !important; }
[data-theme="light"] .cmb-cancel-btn {
  background: rgba(13,95,60,.06) !important;
  border-color: rgba(13,95,60,.15) !important;
  color: #0d1f12 !important;
}
</style>
