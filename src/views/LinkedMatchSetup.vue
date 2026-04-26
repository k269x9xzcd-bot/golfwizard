<template>
  <div class="view lms-view">
    <header class="lms-header">
      <button class="lms-back" @click="handleBack">← {{ backLabel }}</button>
      <h1 class="lms-title">4v4 Match</h1>
    </header>

    <!-- ── Step: Course + Tees (only when no active round) ──────── -->
    <div v-if="step === 'course'" class="lms-step">
      <div class="lms-step-label">Step 1 of 3 · Course &amp; Tees</div>

      <div class="lms-card">
        <div class="lms-field-label">Search courses</div>
        <input
          v-model="courseSearch"
          class="lms-text-input"
          placeholder="Course name…"
          @input="onCourseSearchInput"
          autocomplete="off"
        />
        <div v-if="apiSearching" class="lms-hint">Searching…</div>

        <!-- No search: favorites first, then all -->
        <template v-if="!courseSearch">
          <div v-if="favoriteCoursesList.length" class="lms-section-label">Favorites</div>
          <div
            v-for="c in favoriteCoursesList"
            :key="c.name"
            class="lms-course-row"
            :class="{ 'lms-course-row--on': courseName === c.name }"
            @click="selectCourse(c)"
          >
            <span class="lms-course-name">{{ c.name }}</span>
            <span v-if="coursesStore.favoriteNames.has(c.name)" class="lms-fav-star">★</span>
          </div>
          <div v-if="nonFavCoursesList.length" class="lms-section-label">All Courses</div>
          <div
            v-for="c in nonFavCoursesList"
            :key="c.name"
            class="lms-course-row"
            :class="{ 'lms-course-row--on': courseName === c.name }"
            @click="selectCourse(c)"
          >
            <span class="lms-course-name">{{ c.name }}</span>
          </div>
        </template>

        <!-- With search: flat filtered list -->
        <template v-else>
          <div
            v-for="c in filteredCoursesList"
            :key="c.name"
            class="lms-course-row"
            :class="{ 'lms-course-row--on': courseName === c.name }"
            @click="selectCourse(c)"
          >
            <span class="lms-course-name">{{ c.name }}</span>
            <span v-if="coursesStore.favoriteNames.has(c.name)" class="lms-fav-star">★</span>
          </div>
        </template>
      </div>

      <!-- Tee picker (shown after course selected) -->
      <div v-if="courseName && !apiLoadingTees" class="lms-card">
        <div class="lms-field-label">Select tee</div>
        <div v-if="availableTees.length" class="lms-tee-group">
          <button
            v-for="t in availableTees"
            :key="t.name"
            class="lms-tee-btn"
            :class="{ 'lms-tee-btn--on': courseTee === t.name }"
            @click="courseTee = t.name"
          >
            <span class="lms-tee-name">{{ t.name }}</span>
            <span v-if="t.yards" class="lms-tee-yards">{{ t.yards }} yds</span>
          </button>
        </div>
        <div v-else class="lms-hint">No tee data — will use default.</div>
      </div>
      <div v-if="apiLoadingTees" class="lms-hint">Loading tees…</div>

      <div class="lms-footer">
        <button
          class="lms-btn-primary"
          :disabled="!courseName"
          @click="step = 'format'"
        >Match config →</button>
      </div>
    </div>

    <!-- ── Step: Match format + config ──────────────────────────── -->
    <div v-if="step === 'format'" class="lms-step">
      <div class="lms-step-label">{{ hasActiveRound ? 'Step 1 of 2' : 'Step 2 of 3' }} · Match setup</div>

      <div v-if="hasActiveRound" class="lms-active-round-notice">
        <span>⛳</span>
        <span>Using your active round: <strong>{{ activeRound.course_name }}</strong></span>
      </div>

      <div class="lms-card">
        <div class="lms-field-label">Format</div>
        <div class="lms-radio-group">
          <button class="lms-radio" :class="{ 'lms-radio--on': ballsToCount === 1 }" @click="ballsToCount = 1">
            <span class="lms-radio-dot"></span>
            <span class="lms-radio-body">
              <span class="lms-radio-title">1 BB Net</span>
              <span class="lms-radio-desc">Lowest net score per hole per team</span>
            </span>
          </button>
          <button class="lms-radio" :class="{ 'lms-radio--on': ballsToCount === 2 }" @click="ballsToCount = 2">
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
          <input v-model.number="stake" type="number" min="1" class="lms-stake-input" />
          <span class="lms-stake-suffix">/ player</span>
        </div>
        <div class="lms-stake-hint">Winners split losers' total. Tied match = no money changes hands.</div>
      </div>

      <div class="lms-card">
        <div class="lms-field-label">Match name</div>
        <input v-model="matchName" type="text" class="lms-text-input" placeholder="Saturday 4v4" />
      </div>

      <div class="lms-footer">
        <button class="lms-btn-primary" @click="step = 'foursome-b'">Pick other foursome →</button>
      </div>
    </div>

    <!-- ── Step: Pick Foursome B ─────────────────────────────────── -->
    <div v-if="step === 'foursome-b'" class="lms-step">
      <div class="lms-step-label">{{ hasActiveRound ? 'Step 2 of 2' : 'Step 3 of 3' }} · Other foursome</div>
      <p class="lms-intro">
        Pick the other foursome's players. Their round is pre-built — they open the link and start scoring immediately.
      </p>

      <!-- Selected chips -->
      <div v-if="foursomeBSelected.length" class="lms-selected-chips">
        <div
          v-for="p in foursomeBSelected"
          :key="p.id"
          class="lms-selected-chip"
          @click="toggleFoursomeB(p)"
        >
          {{ p.short_name || p.name.split(' ')[0] }} ✕
        </div>
      </div>
      <div v-else class="lms-hint">Select up to 4 players</div>

      <!-- Search -->
      <input
        v-model="playerSearch"
        class="lms-text-input"
        placeholder="Search roster…"
        autocomplete="off"
      />

      <div class="lms-card" style="padding:8px">
        <template v-if="!playerSearch">
          <!-- Favorites -->
          <div v-if="favoritePlayers.length" class="lms-section-label" style="padding: 6px 8px 2px">Favorites</div>
          <button
            v-for="p in favoritePlayers"
            :key="p.id"
            class="lms-player-row"
            :class="{ 'lms-player-row--on': foursomeBSelected.some(s => s.id === p.id) }"
            @click="toggleFoursomeB(p)"
          >
            <span class="lms-player-check">{{ foursomeBSelected.some(s => s.id === p.id) ? '✓' : '' }}</span>
            <span class="lms-player-name">{{ p.name }}</span>
            <span class="lms-player-hcp" v-if="p.ghin_index != null">{{ p.ghin_index }}</span>
          </button>

          <!-- All others -->
          <div v-if="otherPlayers.length" class="lms-section-label" style="padding: 10px 8px 2px">All Players</div>
          <button
            v-for="p in otherPlayers"
            :key="p.id"
            class="lms-player-row"
            :class="{ 'lms-player-row--on': foursomeBSelected.some(s => s.id === p.id) }"
            @click="toggleFoursomeB(p)"
          >
            <span class="lms-player-check">{{ foursomeBSelected.some(s => s.id === p.id) ? '✓' : '' }}</span>
            <span class="lms-player-name">{{ p.name }}</span>
            <span class="lms-player-hcp" v-if="p.ghin_index != null">{{ p.ghin_index }}</span>
          </button>
        </template>

        <!-- Search results -->
        <template v-else>
          <button
            v-for="p in filteredPlayers"
            :key="p.id"
            class="lms-player-row"
            :class="{ 'lms-player-row--on': foursomeBSelected.some(s => s.id === p.id) }"
            @click="toggleFoursomeB(p)"
          >
            <span class="lms-player-check">{{ foursomeBSelected.some(s => s.id === p.id) ? '✓' : '' }}</span>
            <span class="lms-player-name">{{ p.name }}</span>
            <span class="lms-player-hcp" v-if="p.ghin_index != null">{{ p.ghin_index }}</span>
          </button>
          <div v-if="!filteredPlayers.length" class="lms-hint">No players match "{{ playerSearch }}"</div>
        </template>
      </div>

      <div class="lms-footer">
        <button
          class="lms-btn-primary"
          :disabled="foursomeBSelected.length === 0 || creating"
          @click="hasActiveRound ? createMatchFromActiveRound() : step = 'wizard'"
        >
          {{ creating ? 'Creating…' : hasActiveRound ? 'Create match →' : 'Set up your round →' }}
        </button>
      </div>
    </div>

    <!-- ── Step: Captain's wizard (no active round) ──────────────── -->
    <WizardOverlay
      v-if="step === 'wizard'"
      :lockedCourse="courseName || undefined"
      :lockedTee="courseTee || undefined"
      @close="step = 'foursome-b'"
      @created="onRoundACreated"
    />

    <!-- ── Step: Attach failed recovery ─────────────────────────── -->
    <div v-if="step === 'attach-failed'" class="lms-step">
      <div class="lms-invite-card">
        <div class="lms-invite-emoji">⚠️</div>
        <div class="lms-invite-title">Almost there</div>
        <div class="lms-invite-sub">Your round is saved but attaching the cross-match failed.</div>
        <div class="lms-invite-hint" style="padding-top:8px">{{ error }}</div>
        <button class="lms-btn-primary" @click="retryAttachMatch">🔁 Retry</button>
        <button class="lms-btn-ghost" @click="$router.push('/scoring')">Skip — just score my round</button>
      </div>
    </div>

    <!-- ── Step: Share invite ────────────────────────────────────── -->
    <div v-if="step === 'invite'" class="lms-step">
      <div class="lms-step-label">Match ready · share with the other foursome</div>

      <div class="lms-invite-card">
        <div class="lms-invite-emoji">⛳</div>
        <div class="lms-invite-title">{{ created?.match?.name }}</div>
        <div class="lms-invite-sub">{{ ballsToCount === 1 ? '1 BB Net' : '2 BB Net' }} · ${{ stake }}/player</div>

        <div class="lms-foursome-preview">
          <div class="lms-fp-label">Other foursome</div>
          <div class="lms-fp-players">
            <span v-for="p in foursomeBSelected" :key="p.id" class="lms-fp-chip">{{ p.short_name || p.name.split(' ')[0] }}</span>
          </div>
          <div class="lms-fp-hint">They open the link and start scoring — no wizard needed.</div>
        </div>

        <div class="lms-code-box">
          <div class="lms-code-label">Invite code</div>
          <div class="lms-code">{{ created?.match?.invite_code }}</div>
        </div>

        <button class="lms-btn-primary" @click="shareInvite">📤 Share invite link</button>
        <button class="lms-btn-ghost" @click="copyInvite">{{ copied ? '✓ Copied' : '📋 Copy link' }}</button>

        <div class="lms-invite-hint">
          Any player in the other foursome opens this link. Their round is already set up — no wizard needed.
        </div>
      </div>

      <div class="lms-footer">
        <button class="lms-btn-primary" @click="goToScoring">Start scoring →</button>
      </div>
    </div>

    <div v-if="error && step !== 'attach-failed'" class="lms-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLinkedMatchesStore } from '../stores/linkedMatches'
import { useRosterStore } from '../stores/roster'
import { useRoundsStore } from '../stores/rounds'
import { useCoursesStore } from '../stores/courses'
import WizardOverlay from '../components/WizardOverlay.vue'

const router = useRouter()
const linkedStore = useLinkedMatchesStore()
const rosterStore = useRosterStore()
const roundsStore = useRoundsStore()
const coursesStore = useCoursesStore()

if (!rosterStore.players?.length) rosterStore.fetchPlayers?.()
if (!coursesStore.allCourses?.length) coursesStore.fetchCourses?.()

// ── Active round detection ───────────────────────────────────────
const activeRound = computed(() => roundsStore.activeRound)
const hasActiveRound = computed(() => !!activeRound.value?.id)

// Initial step: if active round exists, skip course step
const step = ref(null)
onMounted(() => {
  step.value = hasActiveRound.value ? 'format' : 'course'
})

// ── State ────────────────────────────────────────────────────────
const ballsToCount = ref(1)
const stake = ref(20)
const matchName = ref('')
const error = ref('')
const copied = ref(false)
const created = ref(null)
const pendingRound = ref(null)
const creating = ref(false)

// ── Course step ──────────────────────────────────────────────────
const courseSearch = ref('')
const courseName = ref('')
const courseTee = ref('')
const availableTees = ref([])
const apiSearching = ref(false)
const apiLoadingTees = ref(false)
const apiResults = ref([])
const apiEnrichedTees = ref({})

let searchTimer = null
function onCourseSearchInput() {
  apiResults.value = []
  clearTimeout(searchTimer)
  const q = courseSearch.value
  if (q.length < 3) return
  searchTimer = setTimeout(async () => {
    apiSearching.value = true
    apiResults.value = await coursesStore.searchCoursesApi(q)
    apiSearching.value = false
  }, 400)
}

const favoriteCoursesList = computed(() => {
  const fav = coursesStore.favoriteNames
  return coursesStore.allCourses.filter(c => fav.has(c.name))
})
const nonFavCoursesList = computed(() => {
  const fav = coursesStore.favoriteNames
  return coursesStore.allCourses.filter(c => !fav.has(c.name))
})
const filteredCoursesList = computed(() => {
  const q = courseSearch.value.toLowerCase()
  const local = coursesStore.allCourses.filter(c => c.name.toLowerCase().includes(q))
  const localNames = new Set(local.map(c => c.name.toLowerCase()))
  const extras = apiResults.value.filter(c => !localNames.has(c.name.toLowerCase()))
  return [...local, ...extras]
})

async function selectCourse(c) {
  courseName.value = c.name
  courseTee.value = ''
  availableTees.value = []
  courseSearch.value = ''

  if (apiEnrichedTees.value[c.name]) {
    availableTees.value = Object.entries(apiEnrichedTees.value[c.name]).map(([name, data]) => ({
      name, yards: data.yards, rating: data.rating, slope: data.slope,
    }))
    if (availableTees.value.length) courseTee.value = availableTees.value[0].name
    return
  }

  const stored = coursesStore.getCourse(c.name)
  if (stored?.teesData && Object.keys(stored.teesData).length) {
    availableTees.value = Object.entries(stored.teesData).map(([name, data]) => ({
      name, yards: data.yards, rating: data.rating, slope: data.slope,
    }))
    apiEnrichedTees.value[c.name] = stored.teesData
    if (availableTees.value.length) courseTee.value = availableTees.value[0].name
    return
  }

  if (c.apiId || stored?.apiId) {
    apiLoadingTees.value = true
    try {
      const detail = await coursesStore.fetchCourseDetail(c.apiId || stored.apiId)
      if (detail?.teesData && Object.keys(detail.teesData).length) {
        apiEnrichedTees.value[c.name] = detail.teesData
        availableTees.value = Object.entries(detail.teesData).map(([name, data]) => ({
          name, yards: data.yards, rating: data.rating, slope: data.slope,
        }))
        if (availableTees.value.length) courseTee.value = availableTees.value[0].name
      }
    } catch {}
    apiLoadingTees.value = false
    return
  }

  apiLoadingTees.value = true
  try {
    const results = await coursesStore.searchCoursesApi(c.name)
    const match = results.find(r =>
      r.name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]) ||
      c.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
    )
    if (match?.apiId) {
      const detail = await coursesStore.fetchCourseDetail(match.apiId)
      if (detail?.teesData && Object.keys(detail.teesData).length) {
        apiEnrichedTees.value[c.name] = detail.teesData
        availableTees.value = Object.entries(detail.teesData).map(([name, data]) => ({
          name, yards: data.yards, rating: data.rating, slope: data.slope,
        }))
        if (availableTees.value.length) courseTee.value = availableTees.value[0].name
      }
    }
  } catch {}
  apiLoadingTees.value = false
}

// ── Player picker ────────────────────────────────────────────────
const foursomeBSelected = ref([])
const playerSearch = ref('')

function lastNameKey(p) {
  const parts = (p.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '~~~'
  return parts[parts.length - 1].toLowerCase() + '|' + (parts[0] || '').toLowerCase()
}
function byLastName(a, b) { return lastNameKey(a).localeCompare(lastNameKey(b)) }

const favoritePlayers = computed(() =>
  (rosterStore.players || []).filter(p => p.is_favorite).slice().sort(byLastName)
)
const otherPlayers = computed(() =>
  (rosterStore.players || []).filter(p => !p.is_favorite).slice().sort(byLastName)
)
const filteredPlayers = computed(() => {
  const q = playerSearch.value.toLowerCase()
  return (rosterStore.players || [])
    .filter(p => p.name.toLowerCase().includes(q))
    .slice().sort(byLastName)
})

function toggleFoursomeB(player) {
  const idx = foursomeBSelected.value.findIndex(p => p.id === player.id)
  if (idx >= 0) {
    foursomeBSelected.value.splice(idx, 1)
  } else if (foursomeBSelected.value.length < 4) {
    foursomeBSelected.value.push(player)
  }
}

// ── Navigation ───────────────────────────────────────────────────
const backLabel = computed(() => {
  if (step.value === 'course' || (step.value === 'format' && hasActiveRound.value)) return 'Home'
  return 'Back'
})

function handleBack() {
  if (step.value === 'course') { router.push('/'); return }
  if (step.value === 'format') {
    if (hasActiveRound.value) { router.push('/'); return }
    step.value = 'course'
    return
  }
  if (step.value === 'foursome-b') { step.value = 'format'; return }
  if (step.value === 'wizard') { step.value = 'foursome-b'; return }
}

// ── Match creation ───────────────────────────────────────────────
async function onRoundACreated(round) {
  error.value = ''
  pendingRound.value = round

  const foursomeBPayload = foursomeBSelected.value.map(p => ({
    id: p.id,
    name: p.name,
    short_name: p.short_name || p.name.split(' ')[0],
    ghin_index: p.ghin_index ?? null,
    ghin_number: p.ghin_number ?? null,
    nickname: p.nickname ?? null,
    use_nickname: p.use_nickname ?? false,
  }))

  try {
    created.value = await linkedStore.createLinkedMatch({
      name: matchName.value || `4v4 · ${round.course_name}`,
      roundAId: round.id,
      ballsToCount: ballsToCount.value,
      stake: stake.value,
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
    error.value = e?.message || 'Your round is saved but attaching the match failed. Tap retry.'
    step.value = 'attach-failed'
  }
}

async function createMatchFromActiveRound() {
  const round = activeRound.value
  if (!round?.id) { error.value = 'No active round found.'; return }
  creating.value = true
  error.value = ''
  try {
    await onRoundACreated(round)
  } finally {
    creating.value = false
  }
}

async function retryAttachMatch() {
  if (!pendingRound.value) { error.value = 'Lost round — start over.'; step.value = 'format'; return }
  await onRoundACreated(pendingRound.value)
}

// ── Invite ───────────────────────────────────────────────────────
async function shareInvite() {
  if (!created.value) return
  const url = created.value.inviteUrl
  const text = `${created.value.match.name} — GolfWizard 4v4\n${ballsToCount.value === 1 ? '1 BB Net' : '2 BB Net'} · $${stake.value}/player\n\nTap to open your pre-built round:\n${url}`
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
  } catch {}
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
  display: flex; align-items: center; gap: 10px; padding: 18px 16px 6px;
}
.lms-back {
  background: transparent; border: none;
  color: var(--gw-text-muted); font-size: 14px; cursor: pointer; padding: 4px 6px;
  -webkit-tap-highlight-color: transparent;
}
.lms-title { margin: 0; font-family: var(--gw-font-display); font-size: 22px; color: var(--gw-text); }

.lms-step { padding: 4px 16px 24px; display: flex; flex-direction: column; gap: 14px; }
.lms-step-label {
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--gw-text-muted); padding: 4px 2px 0;
}
.lms-intro { font-size: 13px; line-height: 1.5; color: rgba(240,237,224,.65); margin: 0; padding: 0 2px; }

.lms-card {
  background: var(--gw-card-bg); border: 1px solid var(--gw-card-border);
  border-radius: var(--gw-radius-lg); padding: 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.lms-field-label {
  font-size: 11px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: var(--gw-text-muted);
}
.lms-section-label {
  font-size: 10px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(240,237,224,.4);
  padding: 4px 2px 0;
}
.lms-hint { font-size: 12px; color: rgba(240,237,224,.4); }

.lms-course-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 10px; cursor: pointer;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
  color: var(--gw-text); font-size: 14px; font-weight: 600;
  -webkit-tap-highlight-color: transparent; transition: background .12s, border-color .12s;
}
.lms-course-row--on { background: rgba(212,175,55,.12); border-color: rgba(212,175,55,.4); }
.lms-course-name { flex: 1; }
.lms-fav-star { color: var(--gw-gold); font-size: 14px; }

.lms-tee-group { display: flex; flex-wrap: wrap; gap: 8px; }
.lms-tee-btn {
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 14px; border-radius: 10px; cursor: pointer;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text); font-family: inherit;
  transition: background .12s, border-color .12s; -webkit-tap-highlight-color: transparent;
}
.lms-tee-btn--on { background: rgba(212,175,55,.12); border-color: rgba(212,175,55,.4); }
.lms-tee-name { font-size: 14px; font-weight: 700; }
.lms-tee-yards { font-size: 11px; color: var(--gw-text-muted); margin-top: 1px; }

.lms-radio-group { display: flex; flex-direction: column; gap: 8px; }
.lms-radio {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-radius: 12px; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1); color: var(--gw-text);
  cursor: pointer; text-align: left; font-family: inherit;
  transition: background .15s, border-color .15s; -webkit-tap-highlight-color: transparent;
}
.lms-radio--on { background: rgba(212,175,55,.1); border-color: rgba(212,175,55,.5); }
.lms-radio-dot {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.25); flex-shrink: 0; position: relative;
}
.lms-radio--on .lms-radio-dot { border-color: var(--gw-gold); }
.lms-radio--on .lms-radio-dot::after {
  content: ''; position: absolute; inset: 2px; background: var(--gw-gold); border-radius: 50%;
}
.lms-radio-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.lms-radio-title { font-size: 15px; font-weight: 700; color: var(--gw-text); }
.lms-radio-desc { font-size: 12px; color: var(--gw-text-muted); }

.lms-stake-row {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px; padding: 8px 12px;
}
.lms-stake-prefix, .lms-stake-suffix { color: var(--gw-text-muted); font-size: 14px; font-weight: 700; }
.lms-stake-input {
  flex: 1; background: transparent; border: none; color: var(--gw-text);
  font-family: var(--gw-font-mono, monospace); font-size: 18px; font-weight: 700; min-width: 0; outline: none;
}
.lms-stake-hint { font-size: 11px; color: rgba(240,237,224,.45); line-height: 1.4; }

.lms-text-input {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px; padding: 10px 12px; font-size: 15px;
  color: var(--gw-text); font-family: inherit; outline: none; width: 100%; box-sizing: border-box;
}

.lms-selected-chips {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0;
}
.lms-selected-chip {
  padding: 5px 10px; border-radius: 20px;
  background: rgba(212,175,55,.15); border: 1px solid rgba(212,175,55,.35);
  font-size: 13px; font-weight: 700; color: var(--gw-gold); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.lms-player-row {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 8px; border-radius: 10px;
  background: transparent; border: 1px solid transparent;
  color: var(--gw-text); font-family: inherit; cursor: pointer;
  text-align: left; -webkit-tap-highlight-color: transparent;
  transition: background .12s, border-color .12s; width: 100%;
}
.lms-player-row--on { background: rgba(212,175,55,.1); border-color: rgba(212,175,55,.3); }
.lms-player-check {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.2); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: var(--gw-gold);
}
.lms-player-row--on .lms-player-check { border-color: var(--gw-gold); background: rgba(212,175,55,.2); }
.lms-player-name { flex: 1; font-size: 15px; font-weight: 600; }
.lms-player-hcp { font-size: 12px; color: var(--gw-text-muted); font-family: var(--gw-font-mono, monospace); }

.lms-active-round-notice {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: rgba(212,175,55,.08); border: 1px solid rgba(212,175,55,.25);
  border-radius: 12px; font-size: 13px; color: rgba(240,237,224,.75);
}
.lms-active-round-notice strong { color: var(--gw-text); }

.lms-footer { display: flex; gap: 8px; padding-top: 4px; }

.lms-btn-primary {
  flex: 1; padding: 14px; border-radius: 14px;
  background: linear-gradient(145deg, #edd655 0%, #d4af37 50%, #b8961e 100%);
  color: #0c0f0d; border: none; font-family: var(--gw-font-body);
  font-size: 15px; font-weight: 800; cursor: pointer; letter-spacing: .3px;
  box-shadow: 0 2px 10px rgba(212,175,55,.25); -webkit-tap-highlight-color: transparent;
}
.lms-btn-primary:disabled { opacity: .45; }
.lms-btn-primary:active:not(:disabled) { transform: scale(.98); }
.lms-btn-ghost {
  width: 100%; padding: 12px; border-radius: 14px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  color: var(--gw-text); font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}

.lms-invite-card {
  background: linear-gradient(135deg, rgba(212,175,55,.14) 0%, rgba(212,175,55,.04) 100%);
  border: 1px solid rgba(212,175,55,.4); border-radius: 20px; padding: 24px 18px;
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
}
.lms-invite-emoji { font-size: 48px; margin-bottom: 2px; }
.lms-invite-title { font-family: var(--gw-font-display); font-size: 22px; color: var(--gw-gold); line-height: 1.2; }
.lms-invite-sub { font-size: 13px; color: rgba(240,237,224,.7); }
.lms-code-box {
  width: 100%; padding: 14px; background: rgba(0,0,0,.3); border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 4px 0;
}
.lms-code-label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--gw-text-muted); font-weight: 700; }
.lms-code { font-family: var(--gw-font-mono, monospace); font-size: 28px; font-weight: 900; letter-spacing: .15em; color: var(--gw-text); }
.lms-invite-hint { font-size: 11px; line-height: 1.45; color: rgba(240,237,224,.5); padding: 0 6px; }

.lms-foursome-preview {
  width: 100%; background: rgba(0,0,0,.2); border-radius: 12px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; text-align: left;
}
.lms-fp-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: rgba(240,237,224,.5); }
.lms-fp-players { display: flex; flex-wrap: wrap; gap: 6px; }
.lms-fp-chip {
  padding: 4px 10px; border-radius: 20px;
  background: rgba(212,175,55,.15); border: 1px solid rgba(212,175,55,.3);
  font-size: 13px; font-weight: 700; color: #d4af37;
}
.lms-fp-hint { font-size: 11px; color: rgba(240,237,224,.45); line-height: 1.4; }

.lms-error {
  margin: 0 16px; padding: 10px 12px; background: rgba(239,68,68,.1);
  border: 1px solid rgba(239,68,68,.3); color: #f87171; border-radius: 10px;
  font-size: 13px; line-height: 1.4;
}
</style>
