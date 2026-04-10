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
        />
        <div class="course-list">
          <div
            v-for="c in filteredCourses.slice(0, 8)"
            :key="c.name"
            class="course-option"
            :class="{ selected: form.courseName === c.name }"
            @click="selectCourse(c)"
          >
            {{ c.name }}
          </div>
        </div>
        <div v-if="form.courseName" class="tee-row">
          <label>Tee:</label>
          <select v-model="form.tee" class="wiz-select">
            <option v-for="t in teesForCourse" :key="t" :value="t">{{ t }}</option>
          </select>
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
import { ref, computed } from 'vue'
import { useCoursesStore } from '../stores/courses'
import { useRosterStore } from '../stores/roster'
import { useRoundsStore } from '../stores/rounds'
import { GAME_DEFS } from '../modules/courses'

const emit = defineEmits(['close', 'created'])
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

const filteredCourses = computed(() => {
  const q = courseSearch.value.toLowerCase()
  return coursesStore.allCourses.filter(c => c.name.toLowerCase().includes(q))
})

const teesForCourse = computed(() => {
  const c = coursesStore.getCourse(form.value.courseName)
  return c ? Object.keys(c.tees) : []
})

const filteredRoster = computed(() => {
  const q = playerSearch.value.toLowerCase()
  return rosterStore.players.filter(p => p.name.toLowerCase().includes(q))
})

const canNext = computed(() => {
  if (step.value === 1) return !!form.value.courseName
  if (step.value === 2) return form.value.players.length >= 1
  return true
})

const canFinish = computed(() => form.value.players.length >= 1)

function selectCourse(c) {
  form.value.courseName = c.name
  const tees = Object.keys(c.tees)
  form.value.tee = tees[0] ?? ''
}

function filterCourses() {} // computed handles it

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
