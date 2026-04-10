<template>
  <div class="courses-view">
    <!-- Header -->
    <header class="courses-header">
      <h1 class="courses-title">Courses</h1>
      <button class="add-course-btn" @click="openAddCourse" aria-label="Add course">
        <span class="add-icon">＋</span>
      </button>
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
        <div class="section-label">Favorites</div>
        <div
          v-for="c in favoriteCourses"
          :key="'fav-' + c.name"
          class="course-card"
          :class="{ 'course-card--custom': c.isCustom }"
          @click="selectCourse(c)"
        >
          <div class="course-card-main">
            <div class="course-name">{{ c.name }}</div>
            <div class="course-meta">
              <span v-if="c.isCustom" class="custom-badge">Custom</span>
              <span class="tee-count">{{ teeSummary(c) }}</span>
            </div>
          </div>
          <div class="course-actions">
            <button
              class="fav-btn fav-btn--active"
              @click.stop="coursesStore.toggleFavorite(c.name)"
              aria-label="Remove from favorites"
            >★</button>
            <button
              v-if="c.isCustom"
              class="delete-btn"
              @click.stop="confirmDelete(c)"
              aria-label="Delete course"
            >🗑</button>
          </div>
        </div>
      </template>

      <!-- All / Search results section -->
      <div class="section-label">{{ search ? `Results (${filteredCourses.length})` : 'All Courses' }}</div>

      <div v-if="filteredCourses.length === 0" class="empty-state">
        <div class="empty-icon">⛳</div>
        <div class="empty-text">No courses found</div>
        <button class="btn-primary" @click="openAddCourse">Add "{{ search }}"</button>
      </div>

      <div
        v-for="c in filteredCourses"
        :key="c.name"
        class="course-card"
        :class="{ 'course-card--custom': c.isCustom }"
        @click="selectCourse(c)"
      >
        <div class="course-card-main">
          <div class="course-name">{{ c.name }}</div>
          <div class="course-meta">
            <span v-if="c.isCustom" class="custom-badge">Custom</span>
            <span class="tee-count">{{ teeSummary(c) }}</span>
          </div>
        </div>
        <div class="course-actions">
          <button
            class="fav-btn"
            :class="{ 'fav-btn--active': coursesStore.favoriteNames.has(c.name) }"
            @click.stop="coursesStore.toggleFavorite(c.name)"
            :aria-label="coursesStore.favoriteNames.has(c.name) ? 'Remove from favorites' : 'Add to favorites'"
          >{{ coursesStore.favoriteNames.has(c.name) ? '★' : '☆' }}</button>
          <button
            v-if="c.isCustom"
            class="delete-btn"
            @click.stop="confirmDelete(c)"
            aria-label="Delete course"
          >🗑</button>
        </div>
      </div>
    </div>

    <!-- ── Add Course Overlay ──────────────────────────────── -->
    <Teleport to="body">
      <transition name="sheet">
        <div v-if="showAddOverlay" class="overlay-backdrop" @click.self="closeAddCourse">
          <div class="overlay-sheet" role="dialog" aria-modal="true" aria-label="Add Course">

            <!-- Step indicator -->
            <div class="step-dots">
              <span v-for="s in 3" :key="s" class="step-dot" :class="{ active: addStep === s, done: addStep > s }" />
            </div>

            <!-- ── Step 1: Course name & tee setup ── -->
            <div v-if="addStep === 1" class="overlay-content">
              <button class="close-btn" @click="closeAddCourse">✕</button>
              <h2 class="overlay-title">Add a Course</h2>
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
              </div>

              <!-- Tees -->
              <div class="field-group">
                <label class="field-label">Tee Boxes</label>
                <div class="tees-list">
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
                <button class="add-tee-btn" @click="addTee" :disabled="newCourse.tees.length >= 6">
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
            <div v-if="addStep === 2" class="overlay-content">
              <button class="close-btn" @click="closeAddCourse">✕</button>
              <h2 class="overlay-title">Hole Details</h2>
              <p class="overlay-sub">Enter par, stroke index, and yardage for each hole</p>

              <!-- Tee selector for yardage -->
              <div class="tee-selector">
                <span class="tee-label">Yardage for:</span>
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

                    <!-- SI -->
                    <div class="hole-cell">
                      <input
                        v-model.number="newCourse.holes[hole-1].si"
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
            <div v-if="addStep === 3" class="overlay-content">
              <button class="close-btn" @click="closeAddCourse">✕</button>
              <h2 class="overlay-title">Review & Save</h2>
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
                <div v-for="h in 9" :key="'s'+h" class="preview-cell">{{ newCourse.holes[h-1].si }}</div>
              </div>

              <div class="preview-label">Back 9</div>
              <div class="preview-grid">
                <div class="preview-header">Hole</div>
                <div v-for="h in 9" :key="h" class="preview-cell preview-hole">{{ h + 9 }}</div>
                <div class="preview-header">Par</div>
                <div v-for="h in 9" :key="'p'+h" class="preview-cell">{{ newCourse.holes[h+8].par }}</div>
                <div class="preview-header">SI</div>
                <div v-for="h in 9" :key="'s'+h" class="preview-cell">{{ newCourse.holes[h+8].si }}</div>
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
            <div class="confirm-sub">This course will be removed from your list. Rounds that used it are not affected.</div>
            <div class="confirm-actions">
              <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
              <button class="btn-danger" @click="doDelete">Delete</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCoursesStore } from '../stores/courses'

const coursesStore = useCoursesStore()
onMounted(() => coursesStore.fetchCustomCourses())

// ── Search ──────────────────────────────────────────────────
const search = ref('')

const favoriteCourses = computed(() => {
  if (search.value) return []
  return coursesStore.allCourses.filter(c => coursesStore.favoriteNames.has(c.name))
})

const filteredCourses = computed(() => {
  const q = search.value.toLowerCase().trim()
  const favSet = coursesStore.favoriteNames
  return coursesStore.allCourses.filter(c => {
    if (!q && favSet.has(c.name)) return false // shown in favorites
    if (q) return c.name.toLowerCase().includes(q)
    return true
  })
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
  // noop for now — course detail view could be added later
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

function freshCourse() {
  return {
    name: '',
    tees: [
      { name: 'Black', rating: null, slope: null },
      { name: 'White', rating: null, slope: null },
    ],
    holes: Array.from({ length: 18 }, (_, i) => ({
      par: 4,
      si: i + 1,
      yards: [null, null],  // one per tee
    })),
  }
}

const newCourse = ref(freshCourse())

function openAddCourse() {
  newCourse.value = freshCourse()
  // Pre-fill name from search if present
  if (search.value) newCourse.value.name = search.value
  addStep.value = 1
  step1Error.value = ''
  step2Error.value = ''
  selectedTeeIdx.value = 0
  showAddOverlay.value = true
}

function closeAddCourse() {
  showAddOverlay.value = false
}

function addTee() {
  if (newCourse.value.tees.length >= 6) return
  newCourse.value.tees.push({ name: '', rating: null, slope: null })
  // Extend yards arrays
  newCourse.value.holes.forEach(h => h.yards.push(null))
}

function removeTee(idx) {
  if (newCourse.value.tees.length <= 1) return
  newCourse.value.tees.splice(idx, 1)
  newCourse.value.holes.forEach(h => h.yards.splice(idx, 1))
  if (selectedTeeIdx.value >= newCourse.value.tees.length) {
    selectedTeeIdx.value = newCourse.value.tees.length - 1
  }
}

function step1Next() {
  step1Error.value = ''
  const name = newCourse.value.name.trim()
  if (!name) { step1Error.value = 'Please enter a course name.'; return }
  // Check for duplicate
  const exists = coursesStore.allCourses.find(c => c.name.toLowerCase() === name.toLowerCase())
  if (exists) { step1Error.value = `"${name}" already exists in your course list.`; return }
  const badTee = newCourse.value.tees.find(t => !t.name.trim())
  if (badTee) { step1Error.value = 'All tee boxes need a name.'; return }
  addStep.value = 2
}

function step2Next() {
  step2Error.value = ''
  // Validate SI: each hole 1-18 should be unique
  const sis = newCourse.value.holes.map(h => h.si).filter(s => s >= 1 && s <= 18)
  const uniqueSis = new Set(sis)
  if (uniqueSis.size !== 18) {
    step2Error.value = 'Stroke indexes must be unique values 1-18 for each hole.'
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
    // Build the tees structure matching existing course format
    const teesData = {}
    newCourse.value.tees.forEach((tee, ti) => {
      teesData[tee.name] = {
        rating: tee.rating,
        slope: tee.slope,
        yards: newCourse.value.holes.reduce((sum, h) => sum + (h.yards[ti] || 0), 0),
        yardsByHole: newCourse.value.holes.map(h => h.yards[ti] || 0),
      }
    })

    const coursePayload = {
      name: newCourse.value.name.trim(),
      tees: teesData,
      par: newCourse.value.holes.map(h => h.par),
      si: newCourse.value.holes.map(h => h.si),
      defaultTee: newCourse.value.tees[0].name,
    }

    await coursesStore.addCourse(coursePayload)
    showAddOverlay.value = false
    // scroll to top to see the new course
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
  await coursesStore.deleteCourse(deleteTarget.value.id)
  deleteTarget.value = null
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.courses-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--gw-neutral-50);
  padding-bottom: calc(var(--gw-nav-height) + env(safe-area-inset-bottom) + 16px);
}

.courses-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.courses-title {
  font-family: var(--gw-font-display);
  font-size: 28px;
  color: var(--gw-neutral-900);
  margin: 0;
}

.add-course-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--gw-radius-full);
  background: var(--gw-green-500);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--gw-shadow-md);
  transition: transform .15s, background .15s;
  -webkit-tap-highlight-color: transparent;
}
.add-course-btn:active { transform: scale(.92); background: var(--gw-green-600); }
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
  color: var(--gw-neutral-400);
  pointer-events: none;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 40px 12px 38px;
  font-family: var(--gw-font-body);
  font-size: 16px;
  color: var(--gw-neutral-900);
  background: white;
  border: 1.5px solid var(--gw-neutral-200);
  border-radius: var(--gw-radius-full);
  outline: none;
  box-shadow: var(--gw-shadow-sm);
  transition: border-color .2s;
  -webkit-appearance: none;
  appearance: none;
}
.search-input:focus { border-color: var(--gw-green-400); }
.search-clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--gw-neutral-400);
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  -webkit-tap-highlight-color: transparent;
}

/* ── Course list ─────────────────────────────────────────── */
.courses-list { padding: 0 16px; }

.section-label {
  font-family: var(--gw-font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--gw-neutral-400);
  padding: 12px 4px 6px;
}

.course-card {
  display: flex;
  align-items: center;
  background: white;
  border-radius: var(--gw-radius-lg);
  padding: 14px 12px 14px 16px;
  margin-bottom: 8px;
  box-shadow: var(--gw-shadow-card);
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: transform .12s, box-shadow .12s;
  -webkit-tap-highlight-color: transparent;
  animation: card-in 250ms ease-out both;
}
.course-card:active { transform: scale(.98); box-shadow: var(--gw-shadow-sm); }
.course-card--custom { border-left-color: var(--gw-green-400); }

.course-card-main { flex: 1; min-width: 0; }
.course-name {
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 500;
  color: var(--gw-neutral-900);
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
  color: var(--gw-green-500);
  background: var(--gw-green-50);
  padding: 2px 6px;
  border-radius: var(--gw-radius-full);
  border: 1px solid var(--gw-green-200);
}
.tee-count {
  font-family: var(--gw-font-body);
  font-size: 13px;
  color: var(--gw-neutral-400);
}

.course-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.fav-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  font-size: 20px;
  color: var(--gw-neutral-300);
  cursor: pointer;
  border-radius: var(--gw-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  transition: color .15s, transform .15s;
}
.fav-btn:active { transform: scale(.85); }
.fav-btn--active { color: #f59e0b; }

.delete-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  font-size: 16px;
  cursor: pointer;
  border-radius: var(--gw-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  opacity: .6;
  transition: opacity .15s;
}
.delete-btn:active { opacity: 1; }

/* ── Empty state ─────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 40px 20px;
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.empty-text {
  font-family: var(--gw-font-body);
  color: var(--gw-neutral-400);
  margin-bottom: 20px;
}

/* ── Overlay ─────────────────────────────────────────────── */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10,34,24,.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(2px);
}
.overlay-sheet {
  width: 100%;
  max-width: 600px;
  background: white;
  border-radius: var(--gw-radius-xl) var(--gw-radius-xl) 0 0;
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
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
  color: var(--gw-neutral-400);
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
  background: var(--gw-neutral-200);
  transition: background .2s, transform .2s;
}
.step-dot.active {
  background: var(--gw-green-500);
  transform: scale(1.25);
}
.step-dot.done { background: var(--gw-green-300); }

.overlay-title {
  font-family: var(--gw-font-display);
  font-size: 24px;
  color: var(--gw-neutral-900);
  margin: 0 0 4px;
  padding-right: 40px;
}
.overlay-sub {
  font-size: 14px;
  color: var(--gw-neutral-500);
  margin: 0 0 24px;
}

/* ── Form fields ─────────────────────────────────────────── */
.field-group { margin-bottom: 20px; }
.field-label {
  display: block;
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-neutral-600);
  margin-bottom: 8px;
}
.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  font-family: var(--gw-font-body);
  font-size: 16px;
  color: var(--gw-neutral-900);
  background: var(--gw-neutral-50);
  border: 1.5px solid var(--gw-neutral-200);
  border-radius: var(--gw-radius-md);
  outline: none;
  transition: border-color .2s;
  -webkit-appearance: none;
}
.field-input:focus { border-color: var(--gw-green-400); }

/* ── Tees ────────────────────────────────────────────────── */
.tees-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.tee-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--gw-neutral-50);
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
  color: var(--gw-neutral-900);
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
  color: var(--gw-neutral-700);
  background: white;
  border: 1.5px solid var(--gw-neutral-200);
  border-radius: var(--gw-radius-sm);
  padding: 6px 4px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}
.tee-num-input:focus { border-color: var(--gw-green-400); }
.tee-sep { font-size: 14px; color: var(--gw-neutral-400); }
.tee-remove {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--gw-neutral-400);
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
  border: 1.5px dashed var(--gw-neutral-300);
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 14px;
  color: var(--gw-neutral-500);
  cursor: pointer;
  transition: border-color .2s, color .2s;
  -webkit-tap-highlight-color: transparent;
}
.add-tee-btn:hover, .add-tee-btn:active { border-color: var(--gw-green-400); color: var(--gw-green-500); }
.add-tee-btn:disabled { opacity: .4; cursor: default; }

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
  color: var(--gw-neutral-400);
  text-transform: uppercase;
  letter-spacing: .05em;
  white-space: nowrap;
}
.tee-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tee-tab {
  padding: 6px 12px;
  border-radius: var(--gw-radius-full);
  border: 1.5px solid var(--gw-neutral-200);
  background: white;
  font-family: var(--gw-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--gw-neutral-600);
  cursor: pointer;
  transition: all .15s;
  -webkit-tap-highlight-color: transparent;
}
.tee-tab.active {
  background: var(--tee-color, var(--gw-green-500));
  border-color: transparent;
  color: white;
}

/* ── Holes grid ──────────────────────────────────────────── */
.holes-grid-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -20px;
  padding: 0 20px;
  margin-bottom: 8px;
}
.holes-grid {
  display: grid;
  /* hole# | par | SI | tees... */
  grid-template-columns: 32px 80px 56px repeat(var(--tee-cols, 2), 64px);
  gap: 2px;
  min-width: fit-content;
}
.holes-grid { --tee-cols: v-bind('newCourse.tees.length'); }

.hole-header {
  font-family: var(--gw-font-body);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--gw-neutral-400);
  background: var(--gw-neutral-50);
  padding: 8px 4px;
  text-align: center;
  border-radius: 4px 4px 0 0;
}
.col-active { background: var(--gw-green-50) !important; }

.hole-num {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-neutral-700);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gw-neutral-100);
  border-radius: 4px;
  height: 44px;
}
.hole-num.hole-back { background: var(--gw-neutral-200); }

.hole-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid var(--gw-neutral-100);
  height: 44px;
  border-radius: 4px;
}
.par-buttons {
  display: flex;
  gap: 2px;
}
.par-btn {
  width: 24px;
  height: 32px;
  border: none;
  background: var(--gw-neutral-100);
  border-radius: 4px;
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-neutral-600);
  cursor: pointer;
  transition: all .12s;
  -webkit-tap-highlight-color: transparent;
}
.par-btn.active {
  background: var(--gw-green-500);
  color: white;
}

.hole-input {
  width: 100%;
  height: 100%;
  text-align: center;
  font-family: var(--gw-font-mono);
  font-size: 14px;
  font-weight: 500;
  color: var(--gw-neutral-800);
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
  color: var(--gw-neutral-500);
  background: var(--gw-neutral-100);
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
  color: var(--gw-neutral-800);
  background: var(--gw-neutral-100);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  height: 36px;
}

/* ── Review card ─────────────────────────────────────────── */
.review-card {
  background: var(--gw-green-900);
  border-radius: var(--gw-radius-lg);
  padding: 20px;
  margin-bottom: 20px;
}
.review-course-name {
  font-family: var(--gw-font-display);
  font-size: 22px;
  color: white;
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
  color: white;
  flex: 1;
}
.review-tee-rating {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  color: var(--gw-neutral-300);
}
.review-tee-yds {
  font-family: var(--gw-font-mono);
  font-size: 12px;
  color: var(--gw-green-300);
}

/* ── Scorecard preview ───────────────────────────────────── */
.preview-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--gw-neutral-400);
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
  color: var(--gw-neutral-500);
  background: var(--gw-neutral-100);
  padding: 6px 2px;
  text-align: center;
  border-radius: 4px;
}
.preview-cell {
  font-family: var(--gw-font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--gw-neutral-700);
  background: white;
  padding: 8px 4px;
  text-align: center;
  border: 1px solid var(--gw-neutral-100);
  border-radius: 4px;
}
.preview-hole {
  color: var(--gw-green-600);
  background: var(--gw-green-50);
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
  background: var(--gw-green-500);
  color: white;
  border: none;
  border-radius: var(--gw-radius-md);
  font-family: var(--gw-font-body);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, transform .12s;
  -webkit-tap-highlight-color: transparent;
}
.btn-primary:active { background: var(--gw-green-600); transform: scale(.97); }
.btn-primary:disabled { opacity: .6; cursor: default; }
.btn-ghost {
  padding: 16px 20px;
  background: none;
  color: var(--gw-neutral-500);
  border: 1.5px solid var(--gw-neutral-200);
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

.step-error {
  font-size: 13px;
  color: var(--gw-bogey);
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--gw-radius-sm);
  padding: 10px 12px;
  margin-top: 12px;
}

/* ── Confirm sheet ───────────────────────────────────────── */
.confirm-sheet {
  background: white;
  border-radius: var(--gw-radius-xl) var(--gw-radius-xl) 0 0;
  padding: 32px 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  width: 100%;
  max-width: 480px;
  text-align: center;
}
.confirm-icon { font-size: 36px; margin-bottom: 12px; }
.confirm-title {
  font-family: var(--gw-font-body);
  font-size: 18px;
  font-weight: 600;
  color: var(--gw-neutral-900);
  margin-bottom: 8px;
}
.confirm-sub {
  font-size: 14px;
  color: var(--gw-neutral-500);
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
  background: #dc2626;
  color: white;
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
