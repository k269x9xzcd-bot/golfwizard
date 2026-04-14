<template>
  <div class="courses-view">
    <!-- Header -->
    <header class="courses-header">
      <h1 class="courses-title">Courses</h1>
      <div class="header-actions">
        <button class="btn-ghost btn-sm sort-btn" @click="toggleCourseSort" :title="courseSortLabel">⇅ {{ courseSortLabel }}</button>
        <button class="add-course-btn" @click="openAddCourse" aria-label="Add course">
          <span class="add-icon">＋</span>
        </button>
      </div>
    </header>

    <!-- Search -->
    <div class="search-wrap">
      <span class="search-icon">⌕</span>
      <input
        v-model="search"
        class="search-input"
        placeholder="Search courses…"
        type="search"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      <button v-if="search" class="search-clear" @click="search = ''">✕</button>
    </div>

    <!-- Course list -->
    <div class="courses-list">
      <!-- Favorites section -->
      <template v-if="!search && favoriteCourses.length">
        <div class="section-label">
          Favorites
          <span class="swipe-hint">← delete &nbsp;·&nbsp; favorite →</span>
        </div>
        <div
          v-for="c in favoriteCourses"
          :key="'fav-' + c.name"
          class="swipe-container"
          :style="swipeContainerStyle(c.name, true)"
        >
          <!-- Reveal labels -->
          <div class="swipe-reveal swipe-reveal-left" :style="{ opacity: swipeRevealOpacity(c.name, 'left') }">🗑 Delete</div>
          <div class="swipe-reveal swipe-reveal-right" :style="{ opacity: swipeRevealOpacity(c.name, 'right') }">☆ Unfav</div>
          <div
            class="course-card course-card--fav"
            :class="{ 'course-card--custom': c.isCustom }"
            :style="{ ...swipeCardStyle(c.name), transition: swiping === c.name ? 'none' : 'transform .25s ease, background .1s ease, border-color .1s ease' }"
            @touchstart="onSwipeStart($event, c.name)"
            @touchmove="onSwipeMove($event, c.name)"
            @touchend="onSwipeEnd($event, c)"
            @click="selectCourse(c)"
          >
            <div class="course-card-main">
              <div class="course-name">{{ c.name }}</div>
              <div class="course-meta">
                <span v-if="c.isCustom" class="custom-badge">Custom</span>
                <span class="tee-count">{{ teeSummary(c) }}</span>
              </div>
            </div>
            <span class="course-fav-star">★</span>
          </div>
        </div>
      </template>

      <!-- All / Search results section -->
      <div class="section-label">
        {{ search ? `Results (${filteredCourses.length})` : 'All Courses' }}
        <span v-if="!search" class="swipe-hint">← delete &nbsp;·&nbsp; favorite →</span>
      </div>

      <div v-if="filteredCourses.length === 0" class="empty-state">
        <div class="empty-icon">⛳</div>
        <div class="empty-text">No courses found</div>
        <button class="btn-primary" @click="openAddCourse">Add "{{ search }}"</button>
      </div>

      <div
        v-for="c in filteredCourses"
        :key="c.name"
        class="swipe-container"
        :style="swipeContainerStyle(c.name, false)"
      >
        <!-- Reveal labels -->
        <div class="swipe-reveal swipe-reveal-left" :style="{ opacity: swipeRevealOpacity(c.name, 'left') }">🗑 Delete</div>
        <div class="swipe-reveal swipe-reveal-right" :style="{ opacity: swipeRevealOpacity(c.name, 'right') }">
          {{ coursesStore.favoriteNames.has(c.name) ? '☆ Unfav' : '★ Fav' }}
        </div>
        <div
          class="course-card"
          :class="{ 'course-card--custom': c.isCustom }"
          :style="{ ...swipeCardStyle(c.name), transition: swiping === c.name ? 'none' : 'transform .25s ease, background .1s ease, border-color .1s ease' }"
          @touchstart="onSwipeStart($event, c.name)"
          @touchmove="onSwipeMove($event, c.name)"
          @touchend="onSwipeEnd($event, c)"
          @click="selectCourse(c)"
        >
          <div class="course-card-main">
            <div class="course-name">{{ c.name }}</div>
            <div class="course-meta">
              <span v-if="c.isCustom" class="custom-badge">Custom</span>
              <span class="tee-count">{{ teeSummary(c) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Swipe toast -->
    <Teleport to="body">
      <transition name="toast">
        <div v-if="toastMsg" class="swipe-toast" :class="toastType">{{ toastMsg }}</div>
      </transition>
    </Teleport>

    <!-- ── Add Course Overlay ──────────────────────────────── -->
    <Teleport to="body">
      <transition name="sheet">
        <div v-if="showAddOverlay" class="overlay-backdrop" @click.self="closeAddCourse">
          <div class="overlay-sheet" role="dialog" aria-modal="true" aria-label="Add Course">

            <!-- Step indicator -->
            <div class="step-dots">
              <span v-for="s in 3" :key="s" class="step-dot" :class="{ active: addStep === s, done: addStep > s }" />
            </div>

            <!-- API loading state -->
            <div v-if="apiLoading" class="overlay-content overlay-loading">
              <div class="api-load-spinner">⟳</div>
              <div class="api-load-text">Fetching course data…</div>
            </div>

            <!-- ── Step 1: Course name & tee setup ── -->
            <div v-if="!apiLoading && addStep === 1" class="overlay-content">
              <button class="close-btn" @click="closeAddCourse">✕</button>
              <h2 class="overlay-title">{{ editingCourse ? 'Edit Course' : 'Add a Course' }}</h2>
              <p class="overlay-sub">Name your course and set up the tee boxes</p>

              <div class="field-group">
                <label class="field-label">Course Name</label>
                <input
                  v-model="newCourse.name"
                  class="field-input"
                  placeholder="e.g. Pebble Beach Golf Links"
                  maxlength="80"
                  @keydown.enter="step1Next"
                />
                <!-- Auto-fetch from API button -->
                <button
                  v-if="newCourse.name.length >= 3"
                  class="btn-fetch-api"
                  :disabled="apiFetching"
                  @click="resetFromApi"
                >
                  {{ apiFetching ? '⟳ Fetching…' : (editingCourse?.isCustom ? '🔄 Reset from API (overwrites edits)' : '🔄 Fetch tees from golf database') }}
                </button>
                <div v-if="apiFetchMsg" class="api-fetch-msg" :class="{ 'api-fetch-err': apiFetchErr }">{{ apiFetchMsg }}</div>
              </div>

              <!-- Tees -->
              <div class="field-group">
                <label class="field-label">Tee Boxes</label>
                <div v-if="apiFetching" class="api-loading-inline">
                  <span class="api-loading-spinner">⟳</span> Fetching tee data…
                </div>
                <div v-else-if="newCourse.tees.length === 0 && !newCourse.name.trim()" class="tees-empty-hint">
                  Enter a course name above — tees will load automatically from the golf database.
                </div>
                <div v-else-if="newCourse.tees.length === 0" class="tees-empty-hint">
                  No tees loaded yet. Type the full course name or tap "Fetch tees" above.
                </div>
                <div v-else class="tees-list">
                  <div v-for="(tee, idx) in newCourse.tees" :key="idx" class="tee-row">
                    <div class="tee-color-swatch" :style="{ background: teeColor(tee.name) }" />
                    <input v-model="tee.name" class="tee-name-input" placeholder="Tee name" maxlength="20" />
                    <div class="tee-rating-wrap">
                      <input v-model.number="tee.rating" class="tee-num-input" placeholder="Rating" type="number" step="0.1" min="55" max="85" />
                      <span class="tee-sep">/</span>
                      <input v-model.number="tee.slope" class="tee-num-input" placeholder="Slope" type="number" min="55" max="155" />
                    </div>
                    <button class="tee-remove" @click="removeTee(idx)" :disabled="newCourse.tees.length <= 1" aria-label="Remove tee">✕</button>
                  </div>
                </div>
                <button class="add-tee-btn" @click="addTee" :disabled="newCourse.tees.length >= 10">
                  + Add Tee Box
                </button>
              </div>

              <div class="step-error" v-if="step1Error">{{ step1Error }}</div>

              <div class="overlay-footer">
                <button class="btn-ghost" @click="closeAddCourse">Cancel</button>
                <button class="btn-primary" @click="step1Next">Continue →</button>
              </div>
            </div>

            <!-- ── Step 2: Hole-by-hole data ── -->
            <div v-if="!apiLoading && addStep === 2" class="overlay-content">
              <button class="close-btn" @click="closeAddCourse">✕</button>
              <h2 class="overlay-title">Hole Details</h2>
              <p class="overlay-sub">Enter par, stroke index, and yardage for each hole</p>

              <!-- Tee selector for yardage & SI -->
              <div class="tee-selector">
                <span class="tee-label">Editing tee:</span>
                <div class="tee-tabs">
                  <button
                    v-for="(tee, idx) in newCourse.tees"
                    :key="idx"
                    class="tee-tab"
                    :class="{ active: selectedTeeIdx === idx }"
                    @click="selectedTeeIdx = idx"
                    :style="{ '--tee-color': teeColor(tee.name) }"
                  >{{ tee.name || `Tee ${idx+1}` }}</button>
                </div>
              </div>

              <!-- Holes grid -->
              <div class="holes-grid-wrap">
                <div class="holes-grid">
                  <!-- Header -->
                  <div class="hole-header hole-col-hole">Hole</div>
                  <div class="hole-header hole-col-par">Par</div>
                  <div class="hole-header hole-col-si">SI</div>
                  <div
                    v-for="(tee, ti) in newCourse.tees"
                    :key="'th-'+ti"
                    class="hole-header hole-col-yds"
                    :class="{ 'col-active': selectedTeeIdx === ti }"
                  >{{ tee.name || `T${ti+1}` }}</div>

                  <!-- 18 holes -->
                  <template v-for="hole in 18" :key="hole">
                    <div class="hole-num" :class="{ 'hole-back': hole > 9 }">{{ hole }}</div>

                    <!-- Par -->
                    <div class="hole-cell">
                      <div class="par-buttons">
                        <button
                          v-for="p in [3,4,5]"
                          :key="p"
                          class="par-btn"
                          :class="{ active: newCourse.holes[hole-1].par === p }"
                          @click="newCourse.holes[hole-1].par = p"
                        >{{ p }}</button>
                      </div>
                    </div>

                    <!-- SI (per selected tee) -->
                    <div class="hole-cell">
                      <input
                        v-model.number="newCourse.holes[hole-1].siByTee[selectedTeeIdx]"
                        class="hole-input"
                        type="number"
                        min="1"
                        max="18"
                        :placeholder="hole"
                      />
                    </div>

                    <!-- Yardage per tee -->
                    <div
                      v-for="(tee, ti) in newCourse.tees"
                      :key="'y-'+ti"
                      class="hole-cell"
                      :class="{ 'col-active': selectedTeeIdx === ti }"
                    >
                      <input
                        v-model.number="newCourse.holes[hole-1].yards[ti]"
                        class="hole-input"
                        type="number"
                        min="50"
                        max="750"
                        placeholder="—"
                      />
                    </div>
                  </template>

                  <!-- Totals row -->
                  <div class="hole-total-label">Total</div>
                  <div class="hole-total">{{ totalPar }}</div>
                  <div class="hole-total">—</div>
                  <div
                    v-for="(tee, ti) in newCourse.tees"
                    :key="'tot-'+ti"
                    class="hole-total"
                    :class="{ 'col-active': selectedTeeIdx === ti }"
                  >{{ totalYards(ti) || '—' }}</div>
                </div>
              </div>

              <div class="step-error" v-if="step2Error">{{ step2Error }}</div>

              <div class="overlay-footer">
                <button class="btn-ghost" @click="addStep = 1">← Back</button>
                <button class="btn-primary" @click="step2Next">Continue →</button>
              </div>
            </div>

            <!-- ── Step 3: Review & save ── -->
            <div v-if="!apiLoading && addStep === 3" class="overlay-content">
              <button class="close-btn" @click="closeAddCourse">✕</button>
              <h2 class="overlay-title">{{ editingCourse ? 'Review Changes' : 'Review & Save' }}</h2>
              <p class="overlay-sub">Make sure everything looks right</p>

              <!-- Summary card -->
              <div class="review-card">
                <div class="review-course-name">{{ newCourse.name }}</div>
                <div class="review-tees">
                  <div v-for="(tee, idx) in newCourse.tees" :key="idx" class="review-tee">
                    <span class="review-tee-swatch" :style="{ background: teeColor(tee.name) }" />
                    <span class="review-tee-name">{{ tee.name }}</span>
                    <span class="review-tee-rating">{{ tee.rating }} / {{ tee.slope }}</span>
                    <span class="review-tee-yds">{{ totalYards(idx) }} yds</span>
                  </div>
                </div>
              </div>

              <!-- Scorecard preview -->
              <div class="preview-label">Front 9</div>
              <div class="preview-grid">
                <div class="preview-header">Hole</div>
                <div v-for="h in 9" :key="h" class="preview-cell preview-hole">{{ h }}</div>
                <div class="preview-header">Par</div>
                <div v-for="h in 9" :key="'p'+h" class="preview-cell">{{ newCourse.holes[h-1].par }}</div>
                <div class="preview-header">SI</div>
                <div v-for="h in 9" :key="'s'+h" class="preview-cell">{{ newCourse.holes[h-1].siByTee[0] }}</div>
              </div>

              <div class="preview-label">Back 9</div>
              <div class="preview-grid">
                <div class="preview-header">Hole</div>
                <div v-for="h in 9" :key="h" class="preview-cell preview-hole">{{ h + 9 }}</div>
                <div class="preview-header">Par</div>
                <div v-for="h in 9" :key="'p'+h" class="preview-cell">{{ newCourse.holes[h+8].par }}</div>
                <div class="preview-header">SI</div>
                <div v-for="h in 9" :key="'s'+h" class="preview-cell">{{ newCourse.holes[h+8].siByTee[0] }}</div>
              </div>

              <div class="overlay-footer">
                <button class="btn-ghost" @click="addStep = 2">← Back</button>
                <button class="btn-primary btn-save" :disabled="saving" @click="saveCourse">
                  <span v-if="saving" class="saving-spinner">⟳</span>
                  <span v-else>Save Course</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="deleteTarget" class="overlay-backdrop" @click.self="deleteTarget = null">
          <div class="confirm-sheet">
            <div class="confirm-icon">⚠️</div>
            <div class="confirm-title">Delete "{{ deleteTarget.name }}"?</div>
            <div class="confirm-sub">This will permanently remove this course and all its data (tees, SI, yardage). Past rounds are not affected.</div>
            <div class="confirm-actions">
              <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
              <button class="btn-danger" @click="doDelete">Delete Permanently</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useCoursesStore } from '../stores/courses'
import { useRoute } from 'vue-router'

const coursesStore = useCoursesStore()
const route = useRoute()

onMounted(async () => {
  await coursesStore.fetchCustomCourses()
  // Auto-open add overlay if ?add=CourseName query param present
  if (route.query.add) {
    const courseName = String(route.query.add)
    const apiId = route.query.apiId ? String(route.query.apiId) : null
    let course = freshCourse()
    course.name = courseName

    if (apiId) {
      // Fetch full course detail from API to pre-populate the editor
      apiLoading.value = true
      showAddOverlay.value = true  // show overlay with loading state
      const detail = await coursesStore.fetchCourseDetail(apiId)
      apiLoading.value = false
      if (detail) {
        const teeNames = Object.keys(detail.teesData || {})
        if (teeNames.length) {
          course.tees = teeNames.map(name => ({
            name,
            rating: detail.teesData[name].rating ?? null,
            slope: detail.teesData[name].slope ?? null,
          }))
          course.holes = Array.from({ length: 18 }, (_, i) => ({
            par: detail.par?.[i] ?? 4,
            siByTee: teeNames.map(name =>
              detail.teesData[name].siByHole?.[i] ?? detail.si?.[i] ?? (i + 1)
            ),
            yards: teeNames.map(name => detail.teesData[name].yardsByHole?.[i] ?? null),
          }))
        }
      }
    }

    newCourse.value = course
    editingCourse.value = null
    addStep.value = 1
    step1Error.value = ''
    step2Error.value = ''
    selectedTeeIdx.value = 0
    showAddOverlay.value = true
  }
})

// ── Search & Sort ───────────────────────────────────────────
const search = ref('')
const courseSortMode = ref('alpha')
const courseSortLabel = computed(() => courseSortMode.value === 'alpha' ? 'A–Z' : 'Added')

function toggleCourseSort() {
  courseSortMode.value = courseSortMode.value === 'alpha' ? 'added' : 'alpha'
}

function sortCourses(arr) {
  if (courseSortMode.value !== 'alpha') return arr
  return [...arr].sort((a, b) => a.name.localeCompare(b.name))
}

const favoriteCourses = computed(() => {
  if (search.value) return []
  return sortCourses(coursesStore.allCourses.filter(c => coursesStore.favoriteNames.has(c.name)))
})

const filteredCourses = computed(() => {
  const q = search.value.toLowerCase().trim()
  const favSet = coursesStore.favoriteNames
  const base = coursesStore.allCourses.filter(c => {
    if (!q && favSet.has(c.name)) return false // shown in favorites
    if (q) return c.name.toLowerCase().includes(q)
    return true
  })
  return sortCourses(base)
})

function teeSummary(course) {
  const t = course.tees
  if (!t) return ''
  if (Array.isArray(t)) return `${t.length} tee${t.length !== 1 ? 's' : ''}`
  const keys = Object.keys(t)
  if (keys.length === 0) return ''
  if (keys.length === 1) return keys[0]
  return `${keys.length} tees`
}

function selectCourse(course) {
  openEditCourse(course)
}

// ── Tee color map ────────────────────────────────────────────
const TEE_COLORS = {
  black: '#1c1c1e', championship: '#1c1c1e', tips: '#1c1c1e',
  blue: '#1d4ed8', white: '#d1d5db', silver: '#9ca3af',
  gold: '#ca8a04', yellow: '#eab308',
  red: '#dc2626', forward: '#dc2626',
  green: '#16a34a', orange: '#ea580c',
  'royal blue': '#1d4ed8',
}
function teeColor(name = '') {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(TEE_COLORS)) {
    if (key.includes(k)) return v
  }
  return 'var(--gw-green-500)'
}

// ── Add Course state ─────────────────────────────────────────
const showAddOverlay = ref(false)
const addStep = ref(1)
const saving = ref(false)
const step1Error = ref('')
const step2Error = ref('')
const selectedTeeIdx = ref(0)
const apiLoading = ref(false)

function freshCourse(numTees = 0) {
  return {
    name: '',
    tees: numTees > 0
      ? Array.from({ length: numTees }, () => ({ name: '', rating: null, slope: null }))
      : [],
    holes: Array.from({ length: 18 }, (_, i) => ({
      par: 4,
      siByTee: Array(numTees).fill(null).map(() => i + 1),
      yards: Array(numTees).fill(null),
    })),
  }
}

const newCourse = ref(freshCourse())

function openAddCourse() {
  editingCourse.value = null
  newCourse.value = freshCourse()
  if (search.value) newCourse.value.name = search.value
  addStep.value = 1
  step1Error.value = ''
  step2Error.value = ''
  selectedTeeIdx.value = 0
  showAddOverlay.value = true
}

// Track which course we're editing (null = new course)
const editingCourse = ref(null)

async function openEditCourse(c) {
  editingCourse.value = c
  addStep.value = 1
  step1Error.value = ''
  step2Error.value = ''
  apiFetchMsg.value = ''
  apiFetchErr.value = false
  selectedTeeIdx.value = 0
  showAddOverlay.value = true

  // If this is a saved custom course, use saved data — don't re-fetch from API
  // (User may have edited tees, deleted tees, changed SI, etc.)
  const teesData = c.teesData || {}
  const teeNames = Object.keys(teesData)

  if (c.isCustom && teeNames.length > 0) {
    console.log('[GW] openEditCourse: using saved custom course data for', c.name)
    const tees = teeNames.map(name => ({
      name,
      rating: teesData[name].rating ?? null,
      slope: teesData[name].slope ?? null,
    }))
    const par = c.par || Array(18).fill(4)
    const globalSi = c.si || Array.from({ length: 18 }, (_, i) => i + 1)
    const holes = Array.from({ length: 18 }, (_, i) => ({
      par: par[i] || 4,
      siByTee: teeNames.map(name => teesData[name]?.siByHole?.[i] ?? globalSi[i] ?? (i + 1)),
      yards: teeNames.map(name => (teesData[name]?.yardsByHole?.[i]) || null),
    }))
    newCourse.value = { name: c.name, tees, holes }
    apiFetchMsg.value = 'Loaded from saved data. Use "Reset from API" to re-fetch.'
    return
  }

  // Non-custom (built-in) course — try API first, fall back to built-in data
  newCourse.value = { name: c.name, tees: [], holes: [] }
  console.log('[GW] openEditCourse: fetching API data for', c.name)
  await fetchCourseFromApi()

  // If API fetch didn't populate tees, fall back to existing course data
  if (newCourse.value.tees.length === 0) {
    console.log('[GW] API fetch returned no tees, falling back to existing data')
    const tees = teeNames.length
      ? teeNames.map(name => ({
          name,
          rating: teesData[name].rating ?? null,
          slope: teesData[name].slope ?? null,
        }))
      : [{ name: 'White', rating: null, slope: null }]

    const par = c.par || Array(18).fill(4)
    const globalSi = c.si || Array.from({ length: 18 }, (_, i) => i + 1)

    const holes = Array.from({ length: 18 }, (_, i) => ({
      par: par[i] || 4,
      siByTee: teeNames.map(name => teesData[name]?.siByHole?.[i] ?? globalSi[i] ?? (i + 1)),
      yards: teeNames.map(name => (teesData[name]?.yardsByHole?.[i]) || null),
    }))

    newCourse.value = { name: c.name, tees, holes }
  }
}

function closeAddCourse() {
  showAddOverlay.value = false
}

function addTee() {
  if (newCourse.value.tees.length >= 6) return
  newCourse.value.tees.push({ name: '', rating: null, slope: null })
  // Extend yards and siByTee arrays
  newCourse.value.holes.forEach((h, i) => {
    h.yards.push(null)
    h.siByTee.push(i + 1)
  })
}

function removeTee(idx) {
  if (newCourse.value.tees.length <= 1) return
  newCourse.value.tees.splice(idx, 1)
  newCourse.value.holes.forEach(h => {
    h.yards.splice(idx, 1)
    h.siByTee.splice(idx, 1)
  })
  if (selectedTeeIdx.value >= newCourse.value.tees.length) {
    selectedTeeIdx.value = newCourse.value.tees.length - 1
  }
}

// ── Fetch course data from API ─────────────────────────────────
const apiFetching = ref(false)
const apiFetchMsg = ref('')
const apiFetchErr = ref(false)

// Auto-fetch when user types a course name in Add mode (debounced)
let nameSearchTimer = null
watch(() => newCourse.value.name, (name) => {
  clearTimeout(nameSearchTimer)
  if (!showAddOverlay.value || editingCourse.value) return  // only for "Add" mode
  const trimmed = (name || '').trim()
  if (trimmed.length < 5) return  // wait for a meaningful name
  nameSearchTimer = setTimeout(() => {
    fetchCourseFromApi()
  }, 800)
})

async function fetchCourseFromApi() {
  const name = newCourse.value.name.trim()
  if (!name || name.length < 3) return
  apiFetching.value = true
  apiFetchMsg.value = 'Searching golf database…'
  apiFetchErr.value = false

  try {
    // Step 1: Search for the course
    console.log('[GW] API search for:', name)
    const results = await coursesStore.searchCoursesApi(name)
    console.log('[GW] API search results:', results.length, results.map(r => r.name))
    if (!results.length) {
      apiFetchMsg.value = 'No matches found in the golf database.'
      apiFetchErr.value = true
      apiFetching.value = false
      return
    }

    // Find best match
    const match = results.find(r =>
      r.name.toLowerCase() === name.toLowerCase()
    ) || results.find(r =>
      r.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
    ) || results[0]

    console.log('[GW] Best match:', match?.name, 'apiId:', match?.apiId)

    if (!match?.apiId) {
      apiFetchMsg.value = 'Could not find detailed data for this course.'
      apiFetchErr.value = true
      apiFetching.value = false
      return
    }

    // Step 2: Fetch full detail
    apiFetchMsg.value = `Found "${match.name}" — loading tee data…`
    console.log('[GW] Fetching detail for apiId:', match.apiId)
    const detail = await coursesStore.fetchCourseDetail(match.apiId)
    console.log('[GW] Detail result:', detail ? Object.keys(detail.teesData || {}) : 'null')
    if (!detail || !Object.keys(detail.teesData || {}).length) {
      apiFetchMsg.value = 'Course found but no tee data available.'
      apiFetchErr.value = true
      apiFetching.value = false
      return
    }

    // Step 3: Populate the form with API data
    const teeNames = Object.keys(detail.teesData)
    newCourse.value.name = match.name  // Use the official API name
    newCourse.value.tees = teeNames.map(tn => ({
      name: tn,
      rating: detail.teesData[tn].rating ?? null,
      slope: detail.teesData[tn].slope ?? null,
    }))
    newCourse.value.holes = Array.from({ length: 18 }, (_, i) => ({
      par: detail.par?.[i] ?? 4,
      siByTee: teeNames.map(tn =>
        detail.teesData[tn].siByHole?.[i] ?? detail.si?.[i] ?? (i + 1)
      ),
      yards: teeNames.map(tn => detail.teesData[tn].yardsByHole?.[i] ?? null),
    }))
    selectedTeeIdx.value = 0
    apiFetchMsg.value = `Loaded ${teeNames.length} tees from ${match.name}`
    apiFetchErr.value = false
  } catch (e) {
    apiFetchMsg.value = 'Failed to fetch: ' + (e.message || 'Unknown error')
    apiFetchErr.value = true
  }
  apiFetching.value = false
}

function resetFromApi() {
  // Force re-fetch from API — clear any cached data
  coursesStore.apiDetailCache = {}
  coursesStore.apiSearchCache = {}
  fetchCourseFromApi()
}

function step1Next() {
  step1Error.value = ''
  const name = newCourse.value.name.trim()
  if (!name) { step1Error.value = 'Please enter a course name.'; return }
  // Check for duplicate only when adding new — allow overriding built-in courses
  if (!editingCourse.value) {
    const exists = coursesStore.allCourses.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (exists && exists.isCustom) { step1Error.value = `"${name}" already exists as a custom course. Edit it instead.`; return }
    // Built-in course with same name is OK — we'll save as a custom override
  }
  if (newCourse.value.tees.length === 0) { step1Error.value = 'No tees loaded. Wait for API fetch or add tees manually.'; return }
  const badTee = newCourse.value.tees.find(t => !t.name.trim())
  if (badTee) { step1Error.value = 'All tee boxes need a name.'; return }
  addStep.value = 2
}

function step2Next() {
  step2Error.value = ''
  // Validate SI for at least the first tee (or selected tee)
  // API data usually has valid SIs; be lenient to allow saving
  const sis = newCourse.value.holes.map(h => h.siByTee[selectedTeeIdx.value]).filter(s => s != null && s >= 1 && s <= 18)
  if (sis.length < 18) {
    const teeName = newCourse.value.tees[selectedTeeIdx.value]?.name || `Tee ${selectedTeeIdx.value + 1}`
    step2Error.value = `Some stroke indexes are missing for "${teeName}". Fill in all 18 holes.`
    return
  }
  const uniqueSis = new Set(sis)
  if (uniqueSis.size !== 18) {
    const teeName = newCourse.value.tees[selectedTeeIdx.value]?.name || `Tee ${selectedTeeIdx.value + 1}`
    step2Error.value = `Stroke indexes for "${teeName}" must be unique values 1–18.`
    return
  }
  addStep.value = 3
}

const totalPar = computed(() =>
  newCourse.value.holes.reduce((sum, h) => sum + (h.par || 0), 0)
)

function totalYards(teeIdx) {
  const sum = newCourse.value.holes.reduce((s, h) => s + (h.yards[teeIdx] || 0), 0)
  return sum || null
}

async function saveCourse() {
  saving.value = true
  try {
    const teesData = {}
    newCourse.value.tees.forEach((tee, ti) => {
      teesData[tee.name] = {
        rating: tee.rating,
        slope: tee.slope,
        yards: newCourse.value.holes.reduce((sum, h) => sum + (h.yards[ti] || 0), 0),
        yardsByHole: newCourse.value.holes.map(h => h.yards[ti] || 0),
        siByHole: newCourse.value.holes.map(h => h.siByTee[ti] || null),
      }
    })

    const coursePayload = {
      name: newCourse.value.name.trim(),
      tees: teesData,
      teesData,
      par: newCourse.value.holes.map(h => h.par),
      // Global SI = first tee's SI for backward compat
      si: newCourse.value.holes.map(h => h.siByTee[0] || null),
      defaultTee: newCourse.value.tees[0].name,
    }

    if (editingCourse.value?.isCustom) {
      // Update existing custom course
      await coursesStore.updateCourse(editingCourse.value.id, coursePayload)
    } else if (editingCourse.value && !editingCourse.value.isCustom) {
      // Built-in course: save as custom copy (with " (Custom)" suffix optional)
      await coursesStore.addCourse(coursePayload)
    } else {
      await coursesStore.addCourse(coursePayload)
    }

    showAddOverlay.value = false
    editingCourse.value = null
    search.value = newCourse.value.name
    setTimeout(() => { search.value = '' }, 2000)
  } catch (err) {
    step2Error.value = err.message || 'Failed to save course.'
    addStep.value = 2
  } finally {
    saving.value = false
  }
}

// ── Delete ───────────────────────────────────────────────────
const deleteTarget = ref(null)
function confirmDelete(course) { deleteTarget.value = course }
async function doDelete() {
  if (!deleteTarget.value) return
  // Remove from favorites
  if (coursesStore.favoriteNames.has(deleteTarget.value.name)) {
    coursesStore.toggleFavorite(deleteTarget.value.name)
  }
  // Delete from database / localStorage
  if (deleteTarget.value.isCustom && deleteTarget.value.id) {
    await coursesStore.deleteCourse(deleteTarget.value.id)
  }
  deleteTarget.value = null
}

// ── Swipe gestures ──────────────────────────────────────────────
const swipeX = reactive({})
const swiping = ref(null)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const SWIPE_THRESHOLD = 80

// Container just clips the sliding card
function swipeContainerStyle(key) {
  return {}
}

// Dynamic background/border on the card itself
function swipeCardStyle(key) {
  const dx = swipeX[key] || 0
  if (dx < -10) {
    const t = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD)
    return {
      transform: `translateX(${dx}px)`,
      background: `rgba(185,28,28,${0.08 + t * 0.55})`,
      borderColor: `rgba(248,113,113,${t * 0.6})`,
    }
  } else if (dx > 10) {
    const t = Math.min(1, dx / SWIPE_THRESHOLD)
    return {
      transform: `translateX(${dx}px)`,
      background: `rgba(161,98,7,${0.08 + t * 0.55})`,
      borderColor: `rgba(212,175,55,${t * 0.6})`,
    }
  }
  return { transform: `translateX(${dx}px)` }
}

// Opacity of action label text (fade in as you drag past 20px)
function swipeRevealOpacity(key, side) {
  const dx = swipeX[key] || 0
  if (side === 'left' && dx < -20) return Math.min(1, (Math.abs(dx) - 20) / 40)
  if (side === 'right' && dx > 20) return Math.min(1, (dx - 20) / 40)
  return 0
}

function onSwipeStart(e, key) {
  swipeStartX.value = e.touches[0].clientX
  swipeStartY.value = e.touches[0].clientY
  swiping.value = key
}

function onSwipeMove(e, key) {
  if (swiping.value !== key) return
  const dx = e.touches[0].clientX - swipeStartX.value
  const dy = e.touches[0].clientY - swipeStartY.value
  if (Math.abs(dy) > Math.abs(dx) * 0.8) return
  swipeX[key] = Math.max(-120, Math.min(120, dx))
}

async function onSwipeEnd(e, course) {
  const key = course.name
  const dx = swipeX[key] || 0
  swiping.value = null

  if (dx < -SWIPE_THRESHOLD) {
    swipeX[key] = 0
    confirmDelete(course)
  } else if (dx > SWIPE_THRESHOLD) {
    const wasFav = coursesStore.favoriteNames.has(course.name)
    swipeX[key] = 0
    await coursesStore.toggleFavorite(course.name)
    showToast(wasFav ? 'Removed from favorites' : '★ Added to favorites!', wasFav ? 'neutral' : 'gold')
  } else {
    swipeX[key] = 0
  }
}

// ── Toast ────────────────────────────────────────────────────────
const toastMsg = ref('')
const toastType = ref('')
let toastTimer = null

function showToast(msg, type = 'neutral') {
  toastMsg.value = msg
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 1800)
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.courses-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--gw-neutral-950);
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}

.courses-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}
.header-actions { display: flex; gap: 8px; align-items: center; }
.sort-btn { font-size: 11px; padding: 5px 9px; opacity: .75; }

.courses-title {
  font-family: var(--gw-font-display);
  font-size: 28px;
  color: var(--gw-text);
  margin: 0;
}

.add-course-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--gw-radius-full);
  background: var(--gw-gold);
  color: #000;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--gw-shadow-md);
  transition: transform .15s, background .15s;
  -webkit-tap-highlight-color: transparent;
}
.add-course-btn:active { transform: scale(.92); background: #e5c158; }
.add-icon { font-size: 22px; line-height: 1; }

/* ── Search ─────────────────────────────────────────────── */
.search-wrap {
  position: relative;
  margin: 16px 20px 8px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--gw-text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 40px 12px 38px;
  font-family: var(--gw-font-body);
  font-size: 16px;
  color: var(--gw-text);
  background: var(--gw-card-bg);
  border: 1.5px solid var(--gw-card-border);
  border-radius: var(--gw-radius-full);
  outline: none;
  box-shadow: var(--gw-shadow-sm);
  transition: border-color .2s;
  -webkit-appearance: none;
  appearance: none;
}
.search-input:focus { border-color: var(--gw-gold); }
.search-clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--gw-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  -webkit-tap-highlight-color: transparent;
}

/* ── Course list ─────────────────────────────────────────── */
.courses-list { padding: 0 16px; }

.section-label {
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--gw-font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-text-muted);
  padding: 12px 4px 6px;
}
.swipe-hint {
  font-size: 10px; font-weight: 500; letter-spacing: 0;
  color: rgba(240,237,224,.25); text-transform: none;
}

.course-card {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,.04);
  border-radius: var(--gw-radius-lg);
  padding: 10px 14px;
  margin-bottom: 0;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,.07);
  transition: transform .12s;
  -webkit-tap-highlight-color: transparent;
  position: relative; z-index: 1;
  will-change: transform;
}
.course-card:active { transform: scale(.98); }
.course-card--custom { border-left: 2px solid var(--gw-gold); }
.course-card--fav {
  border-color: rgba(212,175,55,.2);
  background: rgba(255,255,255,.04);
}
.course-fav-star {
  font-size: 14px; color: #d4af37; flex-shrink: 0; margin-left: auto;
  line-height: 1;
}

/* ── Swipe container ────────────────────────────────── */
.swipe-container {
  position: relative;
  overflow: hidden;
  border-radius: var(--gw-radius-lg);
  margin-bottom: 8px;
  background: rgba(255,255,255,.04);
  transition: background 0.05s linear;
}
.swipe-container .course-card { margin-bottom: 0; }

/* Reveal text labels (shown behind card as it slides) */
.swipe-reveal {
  position: absolute;
  top: 0; bottom: 0;
  display: flex;
  align-items: center;
  font-size: 13px; font-weight: 700; letter-spacing: .04em;
  color: white;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.1s;
}
.swipe-reveal-left {
  left: 0; padding-left: 20px;
}
.swipe-reveal-right {
  right: 0; padding-right: 20px;
}

/* legacy, no longer used */

/* ── Toast ──────────────────────────────────────────── */
.swipe-toast {
  position: fixed; bottom: calc(var(--gw-nav-height, 60px) + env(safe-area-inset-bottom) + 16px);
  left: 50%; transform: translateX(-50%);
  padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 600;
  z-index: 400; pointer-events: none;
  background: rgba(30,40,30,.92); color: #f0ede0;
  border: 1px solid rgba(255,255,255,.1);
  backdrop-filter: blur(8px);
}
.swipe-toast.gold { color: #d4af37; border-color: rgba(212,175,55,.3); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

.course-card-main { flex: 1; min-width: 0; }
.course-name {
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 500;
  color: var(--gw-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.course-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.custom-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  color: var(--gw-gold);
  background: rgba(212, 175, 55, 0.15);
  padding: 2px 6px;
  border-radius: var(--gw-radius-full);
  border: 1px solid rgba(212, 175, 55, 0.3);
}
.tee-count {
  font-family: var(--gw-font-body);
  font-size: 13px;
  color: var(--gw-text-muted);
}

.tap-edit-hint {
  font-size: 10px;
  color: rgba(240,237,224,.3);
  display: block;
  margin-top: 2px;
}

/* old button actions removed — using swipe gestures now */

/* ── Empty state ─────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 40px 20px;
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text {
  font-family: var(--gw-font-body);
  color: var(--gw-text-muted);
  margin-bottom: 20px;
}

/* ── Overlay ─────────────────────────────────────────────── */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(2px);
}
.overlay-sheet {
  width: 100%;
  max-width: 600px;
  background: var(--gw-card-bg);
  border-radius: var(--gw-radius-xl) var(--gw-radius-xl) 0 0;
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
  border: 1px solid var(--gw-card-border);
}
.overlay-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 24px 20px;
  position: relative;
}
.close-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  font-size: 16px;
  color: var(--gw-text-muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.step-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 12px;
  flex-shrink: 0;
}
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--gw-radius-full);
  background: rgba(255, 255, 255, 0.15);
  transition: background .2s, transform .2s;
}
.step-dot.active {
  background: var(--gw-gold);
  transform: scale(1.25);
}
.step-dot.done { background: #a89968; }

.overlay-title {
  font-family: var(--gw-font-display);
  font-size: 24px;
  color: var(--gw-text);
  margin: 0 0 4px;
  padding-right: 40px;
}
.overlay-sub {
  font-size: 14px;
  color: var(--gw-text-muted);
  margin: 0 0 24px;
}

/* ── Form fields ─────────────────────────────────────────── */
.field-group { margin-bottom: 20px; }
.field-label {
  display: block;
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-text-muted);
  margin-bottom: 8px;
}
.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  font-family: var(--gw-font-body);
  font-size: 16px;
  color: var(--gw-text);
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid var(--gw-card-border);
  border-radius: var(--gw-radius-md);
  outline: none;
  transition: border-color .2s;
  -webkit-appearance: none;
}
.field-input:focus { border-color: var(--gw-gold); }

/* ── Tees ────────────────────────────────────────────────── */
.tees-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.tee-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--gw-radius-md);
  padding: 10px 12px;
}
.tee-color-swatch {
  width: 14px;
  height: 14px;
  border-radius: var(--gw-radius-full);
  flex-shrink: 0;
  border: 1.5px solid rgba(255,255,255,.3);
}
.tee-name-input {
  flex: 1;
  min-width: 0;
  font-family: var(--gw-font-body);
  font-size: 15px;
  font-weight: 500;
  color: var(--gw-text);
  border: none;
  background: transparent;
  outline: none;
  padding: 4px 0;
}
.tee-rating-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}
.tee-num-input {
  width: 56px;
  font-family: var(--gw-font-mono);
  font-size: 14px;
  text-align: center;
  color: var(--gw-text);
  background: rgba(255, 255, 255, 0.08);
  border: 1.5px solid var(--gw-card-border);
  border-radius: var(--gw-radius-sm);
  padding: 6px 4px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}
.tee-num-input:focus { border-color: var(--gw-gold); }
.tee-sep { font-size: 14px; color: var(--gw-text-muted); }
.tee-remove {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--gw-text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  border-radius: var(--gw-radius-full);
  -webkit-tap-highlight-color: transparent;
}
.tee-remove:disabled { opacity: .3; cursor: default; }

.add-tee-btn {
  width: 100%;
  padding: 12px;
  background: none;
  border: 1.5px dashed rgba(240, 237, 224, 0.2);
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 14px;
  color: var(--gw-text-muted);
  cursor: pointer;
  transition: border-color .2s, color .2s;
  -webkit-tap-highlight-color: transparent;
}
.add-tee-btn:hover, .add-tee-btn:active { border-color: var(--gw-gold); color: var(--gw-gold); }
.add-tee-btn:disabled { opacity: .4; cursor: default; }

/* ── Fetch from API button ───────────────────────────────── */
.btn-fetch-api {
  width: 100%;
  margin-top: 8px;
  padding: 10px 14px;
  background: rgba(212, 175, 55, 0.15);
  border: 1.5px solid rgba(212, 175, 55, 0.3);
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-gold);
  cursor: pointer;
  transition: background .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.btn-fetch-api:active:not(:disabled) {
  background: rgba(212, 175, 55, 0.25);
}
.btn-fetch-api:disabled {
  opacity: .6;
  cursor: default;
}
.api-fetch-msg {
  font-size: 13px;
  color: var(--gw-gold);
  margin-top: 6px;
  padding: 4px 0;
}
.api-fetch-msg.api-fetch-err {
  color: #ff6b6b;
}
.tees-empty-hint {
  font-size: 14px;
  color: var(--gw-text-muted);
  padding: 16px 0;
  text-align: center;
  line-height: 1.4;
}
.api-loading-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--gw-gold);
  padding: 16px 0;
  justify-content: center;
}
.api-loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Tee selector (step 2) ───────────────────────────────── */
.tee-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tee-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gw-text-muted);
  text-transform: uppercase;
  letter-spacing: .05em;
  white-space: nowrap;
}
.tee-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tee-tab {
  padding: 6px 12px;
  border-radius: var(--gw-radius-full);
  border: 1.5px solid var(--gw-card-border);
  background: rgba(255, 255, 255, 0.08);
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--gw-text-muted);
  cursor: pointer;
  transition: all .15s;
  -webkit-tap-highlight-color: transparent;
}
.tee-tab.active {
  background: var(--tee-color, var(--gw-gold));
  border-color: transparent;
  color: #000;
}

/* ── Holes grid ──────────────────────────────────────────── */
.holes-grid-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -20px;
  padding: 0 20px 4px;
  margin-bottom: 8px;
}
.holes-grid {
  display: grid;
  /* hole# | par (3/4/5 buttons) | SI | yardage per tee... */
  grid-template-columns: 30px 88px 48px repeat(var(--tee-cols, 1), 58px);
  gap: 3px 2px;
  min-width: max-content;
  --tee-cols: v-bind('newCourse.tees.length');
}

.hole-header {
  font-family: var(--gw-font-body);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--gw-text-muted);
  background: rgba(255, 255, 255, 0.08);
  padding: 8px 4px;
  text-align: center;
  border-radius: 4px 4px 0 0;
}
.col-active { background: rgba(212, 175, 55, 0.15) !important; }

.hole-num {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  height: 44px;
}
.hole-num.hole-back { background: rgba(255, 255, 255, 0.12); }

.hole-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  min-width: 0;
}
.par-buttons {
  display: flex;
  gap: 1px;
  width: 100%;
  padding: 0 2px;
}
.par-btn {
  flex: 1;
  min-width: 0;
  height: 34px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-text-muted);
  cursor: pointer;
  transition: all .12s;
  -webkit-tap-highlight-color: transparent;
}
.par-btn.active {
  background: var(--gw-gold);
  color: #000;
}

.hole-input {
  width: 100%;
  height: 100%;
  text-align: center;
  font-family: var(--gw-font-mono);
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-text);
  border: none;
  background: transparent;
  outline: none;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
}
/* Hide number spinners */
.hole-input::-webkit-outer-spin-button,
.hole-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.hole-input[type=number] { -moz-appearance: textfield; }

.hole-total-label {
  font-family: var(--gw-font-body);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--gw-text-muted);
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  height: 36px;
}
.hole-total {
  font-family: var(--gw-font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--gw-text);
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  height: 36px;
}

/* ── Review card ─────────────────────────────────────────── */
.review-card {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.08) 100%);
  border-radius: var(--gw-radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(212, 175, 55, 0.2);
}
.review-course-name {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: var(--gw-text);
  margin-bottom: 12px;
}
.review-tees { display: flex; flex-direction: column; gap: 8px; }
.review-tee {
  display: flex;
  align-items: center;
  gap: 10px;
}
.review-tee-swatch {
  width: 12px;
  height: 12px;
  border-radius: var(--gw-radius-full);
  flex-shrink: 0;
}
.review-tee-name {
  font-family: var(--gw-font-body);
  font-size: 14px;
  color: var(--gw-text);
  flex: 1;
}
.review-tee-rating {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  color: var(--gw-text-muted);
}
.review-tee-yds {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  color: var(--gw-gold);
}

/* ── Scorecard preview ───────────────────────────────────── */
.preview-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--gw-text-muted);
  margin-bottom: 6px;
}
.preview-grid {
  display: grid;
  grid-template-columns: 44px repeat(9, 1fr);
  gap: 2px;
  margin-bottom: 16px;
  overflow-x: auto;
}
.preview-header {
  font-family: var(--gw-font-body);
  font-size: 10px;
  font-weight: 700;
  color: var(--gw-text-muted);
  background: rgba(255, 255, 255, 0.08);
  padding: 6px 2px;
  text-align: center;
  border-radius: 4px;
}
.preview-cell {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-text);
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 4px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.preview-hole {
  color: var(--gw-gold);
  background: rgba(212, 175, 55, 0.15);
  font-weight: 700;
}

/* ── Footer ──────────────────────────────────────────────── */
.overlay-footer {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  flex-shrink: 0;
}
.btn-primary {
  flex: 1;
  padding: 16px;
  background: var(--gw-gold);
  color: #000;
  border: none;
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, transform .12s;
  -webkit-tap-highlight-color: transparent;
}
.btn-primary:active { background: #e5c158; transform: scale(.97); }
.btn-primary:disabled { opacity: .6; cursor: default; }
.btn-ghost {
  padding: 16px 20px;
  background: none;
  color: var(--gw-text-muted);
  border: 1.5px solid var(--gw-card-border);
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.btn-save { display: flex; align-items: center; justify-content: center; gap: 8px; }
.saving-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

.overlay-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}
.api-load-spinner {
  font-size: 36px;
  animation: spin 1s linear infinite;
}
.api-load-text {
  font-size: 15px;
  color: var(--gw-text-muted);
}

.step-error {
  font-size: 13px;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: var(--gw-radius-sm);
  padding: 10px 12px;
  margin-top: 12px;
}

/* ── Confirm sheet ───────────────────────────────────────── */
.confirm-sheet {
  background: var(--gw-card-bg);
  border-radius: var(--gw-radius-xl) var(--gw-radius-xl) 0 0;
  padding: 32px 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  width: 100%;
  max-width: 480px;
  text-align: center;
  border: 1px solid var(--gw-card-border);
}
.confirm-icon { font-size: 36px; margin-bottom: 12px; }
.confirm-title {
  font-family: var(--gw-font-body);
  font-size: 18px;
  font-weight: 600;
  color: var(--gw-text);
  margin-bottom: 8px;
}
.confirm-sub {
  font-size: 14px;
  color: var(--gw-text-muted);
  margin-bottom: 24px;
  line-height: 1.5;
}
.confirm-actions {
  display: flex;
  gap: 12px;
}
.btn-danger {
  flex: 1;
  padding: 16px;
  background: #ff6b6b;
  color: #fff;
  border: none;
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* ── Animations ──────────────────────────────────────────── */
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.sheet-enter-active, .sheet-leave-active { transition: opacity .25s, transform .25s; }
.sheet-enter-from { opacity: 0; transform: translateY(100%); }
.sheet-leave-to   { opacity: 0; transform: translateY(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
