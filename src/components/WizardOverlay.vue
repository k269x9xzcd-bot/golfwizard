<template>
  <div class="modal-overlay wizard-overlay">
    <div class="modal wizard-modal">
      <div class="wizard-header">
        <button class="modal-close" @click="$emit('close')">✕</button>
        <div class="wizard-title">New Round</div>
        <div class="wizard-step-indicator">{{ step }}/{{ totalSteps }}</div>
      </div>

      <!-- Step 1: Course & Date -->
      <div v-if="step === 1" class="wizard-step">
        <h3>Where are you playing?</h3>
        <input
          v-model="courseSearch"
          class="wiz-input"
          placeholder="Search courses…"
          @input="filterCourses"
          @focus="scrollInputIntoView"
        />
        <div class="course-list">
          <div v-if="apiSearching" class="course-searching">Searching…</div>
          <div
            v-for="c in filteredCourses.slice(0, 10)"
            :key="c.name"
            class="course-option"
            :class="{ selected: form.courseName === c.name, 'course-option--api': c.isApiResult }"
            @click="selectCourse(c)"
          >
            <span class="course-option-name">{{ c.name }}</span>
            <span v-if="c.location" class="course-option-loc">{{ c.location }}</span>
          </div>
        </div>
        <!-- Tee selector — only shown when course has tee data -->
        <div v-if="form.courseName && teesForCourse.length" class="tee-row">
          <label>Tee:</label>
          <select v-model="form.tee" class="wiz-select">
            <option v-for="t in teesForCourse" :key="t.name" :value="t.name">
              {{ t.name }}{{ t.yards ? ' — ' + t.yards.toLocaleString() + ' yds' : '' }}{{ t.rating ? ' (' + t.rating + '/' + t.slope + ')' : '' }}
            </option>
          </select>
        </div>

        <!-- API course with no tee data: prompt to set up -->
        <div v-if="form.courseName && !teesForCourse.length" class="api-course-notice">
          <div class="api-notice-text">
            📋 <strong>{{ form.courseName }}</strong> found — add tee/SI data to use it.
          </div>
          <button class="btn-primary btn-sm" @click="openCourseSetup">Set up course →</button>
        </div>
        <input v-model="form.date" type="date" class="wiz-input" />
        <div class="holes-row">
          <button
            v-for="h in ['18', 'front9', 'back9']"
            :key="h"
            class="holes-btn"
            :class="{ active: form.holesMode === h }"
            @click="form.holesMode = h"
          >{{ h }}</button>
        </div>
      </div>

      <!-- Step 2: Players -->
      <div v-if="step === 2" class="wizard-step">
        <h3>Who's playing?</h3>
        <input
          v-model="playerSearch"
          class="wiz-input"
          placeholder="Search roster…"
          @input="filterPlayers"
          @focus="scrollInputIntoView"
        />
        <div class="roster-list">
          <div
            v-for="p in filteredRoster"
            :key="p.id"
            class="roster-option"
            :class="{ selected: isPlayerAdded(p) }"
            @click="togglePlayer(p)"
          >
            <span class="roster-name">{{ p.name }}</span>
            <span class="roster-hcp">{{ p.ghin_index ?? '—' }}</span>
            <span class="roster-check">{{ isPlayerAdded(p) ? '✓' : '+' }}</span>
          </div>
        </div>
        <!-- Quick add by name -->
        <div class="quick-add-row">
          <input v-model="newName" class="wiz-input" placeholder="Quick add name…" />
          <input v-model="newHcp" class="wiz-input wiz-input-sm" placeholder="HCP" type="number" />
          <button class="btn-ghost btn-sm" @click="quickAddPlayer">Add</button>
        </div>
        <!-- Added players -->
        <div class="added-players">
          <div v-for="(p, i) in form.players" :key="p.id" class="added-player">
            <span>{{ p.name }}</span>
            <span class="added-hcp">{{ p.ghinIndex ?? '—' }}</span>
            <button class="remove-btn" @click="form.players.splice(i, 1)">×</button>
          </div>
        </div>
      </div>

      <!-- Step 3: Games -->
      <div v-if="step === 3" class="wizard-step">
        <h3>Pick your games</h3>
        <div class="games-grid">
          <div
            v-for="g in GAME_DEFS.filter(g => !g.hidden)"
            :key="g.key"
            class="game-chip"
            :class="{ selected: isGameSelected(g.key) }"
            @click="toggleGame(g.key)"
          >
            <span class="game-icon">{{ g.icon }}</span>
            <span class="game-name">{{ g.label }}</span>
          </div>
        </div>
        <!-- Room code option -->
        <div class="room-code-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="form.withRoomCode" />
            Share with another foursome (room code)
          </label>
        </div>
      </div>

      <!-- Nav -->
      <div class="wizard-nav">
        <button v-if="step > 1" class="btn-ghost" @click="step--">Back</button>
        <button v-if="step < totalSteps" class="btn-primary" :disabled="!canNext" @click="step++">Next</button>
        <button v-else class="btn-primary" :disabled="!canFinish || creating" @click="create">
          {{ creating ? 'Creating…' : 'Start Round' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore } from '../stores/roster'
import { useRoundsStore } from '../stores/rounds'
import { GAME_DEFS } from '../modules/courses'

const emit = defineEmits(['close', 'created', 'setup-course'])
const coursesStore = useCoursesStore()
const rosterStore = useRosterStore()
const roundsStore = useRoundsStore()

const step = ref(1)
const totalSteps = 3
const creating = ref(false)

const form = ref({
  courseName: '',
  tee: '',
  date: new Date().toISOString().slice(0, 10),
  holesMode: '18',
  players: [],
  games: [],
  withRoomCode: false,
})

const courseSearch = ref('')
const playerSearch = ref('')
const newName = ref('')
const newHcp = ref('')
const apiResults = ref([])
const apiSearching = ref(false)

const filteredCourses = computed(() => {
  const q = courseSearch.value.toLowerCase()
  const local = coursesStore.allCourses.filter(c => c.name.toLowerCase().includes(q))
  if (!q) return local
  // Merge in API results that aren't already in local list
  const localNames = new Set(local.map(c => c.name.toLowerCase()))
  const extras = apiResults.value.filter(c => !localNames.has(c.name.toLowerCase()))
  return [...local, ...extras]
})

let searchTimer = null
watch(courseSearch, async (q) => {
  apiResults.value = []
  clearTimeout(searchTimer)
  if (q.length < 3) return
  searchTimer = setTimeout(async () => {
    apiSearching.value = true
    apiResults.value = await coursesStore.searchCoursesApi(q)
    apiSearching.value = false
  }, 400)
})

const teesForCourse = computed(() => {
  const c = coursesStore.getCourse(form.value.courseName)
  if (!c) return []
  // Use teesData if available (has yardage), fallback to tees string
  if (c.teesData) {
    return Object.entries(c.teesData).map(([name, data]) => ({
      name,
      yards: data.yards,
      rating: data.rating,
      slope: data.slope,
    }))
  }
  // Fallback: tees is a string (default tee name) or object
  if (typeof c.tees === 'string') return [{ name: c.tees, yards: null, rating: null, slope: null }]
  return Object.keys(c.tees).map(name => ({ name, yards: null, rating: null, slope: null }))
})

const filteredRoster = computed(() => {
  const q = playerSearch.value.toLowerCase()
  return rosterStore.players.filter(p => p.name.toLowerCase().includes(q))
})

const canNext = computed(() => {
  if (step.value === 1) return !!form.value.courseName && teesForCourse.value.length > 0
  if (step.value === 2) return form.value.players.length >= 1
  return true
})

function openCourseSetup() {
  // Find the apiId if this came from an API search result
  const apiResult = apiResults.value.find(c => c.name === form.value.courseName)
  emit('setup-course', form.value.courseName, apiResult?.apiId ?? null)
}

const canFinish = computed(() => form.value.players.length >= 1)

function selectCourse(c) {
  form.value.courseName = c.name
  // Use the course's default tee if set, otherwise first tee from teesData
  if (c.teesData) {
    const defaultTee = c.tees && typeof c.tees === 'string' ? c.tees : Object.keys(c.teesData)[0]
    form.value.tee = defaultTee ?? ''
  } else if (typeof c.tees === 'string') {
    form.value.tee = c.tees
  } else {
    form.value.tee = Object.keys(c.tees ?? {})[0] ?? ''
  }
}

function filterCourses() {} // computed handles it

function scrollInputIntoView(e) {
  // iOS: scroll the focused input into view after keyboard opens
  setTimeout(() => {
    e.target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 350)
}

function isPlayerAdded(p) {
  return form.value.players.some(fp => fp.id === p.id)
}

function togglePlayer(p) {
  if (isPlayerAdded(p)) {
    form.value.players = form.value.players.filter(fp => fp.id !== p.id)
  } else {
    form.value.players.push({
      id: p.id,
      name: p.name,
      shortName: p.short_name,
      ghinIndex: p.ghin_index,
      profileId: p.owner_id === undefined ? null : null, // guest players have no profileId
    })
  }
}

function quickAddPlayer() {
  if (!newName.value.trim()) return
  form.value.players.push({
    id: `temp_${Date.now()}`,
    name: newName.value.trim(),
    shortName: newName.value.trim().slice(0, 6),
    ghinIndex: newHcp.value ? parseFloat(newHcp.value) : null,
    profileId: null,
  })
  newName.value = ''
  newHcp.value = ''
}

function isGameSelected(key) {
  return form.value.games.some(g => g.type === key)
}

function toggleGame(key) {
  if (isGameSelected(key)) {
    form.value.games = form.value.games.filter(g => g.type !== key)
  } else {
    form.value.games.push({ type: key, config: {} })
  }
}

function filterPlayers() {} // computed handles it

async function create() {
  creating.value = true
  try {
    const round = await roundsStore.createRound({
      courseName: form.value.courseName,
      tee: form.value.tee,
      date: form.value.date,
      holesMode: form.value.holesMode,
      withRoomCode: form.value.withRoomCode,
      players: form.value.players,
      games: form.value.games,
    })
    emit('created', round)
  } catch (e) {
    console.error('Failed to create round:', e)
  } finally {
    creating.value = false
  }
}
</script>
