import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'
import { COURSES as BUILTIN_COURSES } from '../modules/courses'
import { supaCallWithRetry } from '../modules/supabaseOps'

export const useCoursesStore = defineStore('courses', () => {
  const customCourses = ref([])  // user's private courses from Supabase
  const favorites = ref([])       // favorited course names
  const loading = ref(false)

  // All courses: built-in + custom
  // Supabase stores tee data in `tees` jsonb column (same shape as teesData)
  // and hole data in `holes` jsonb column. localStorage stores teesData/par/si separately.
  const allCourses = computed(() => {
    const custom = customCourses.value.map(c => {
      // Supabase shape: c.tees = {Blue: {rating, slope, yards, ...}}, c.holes = [{par, ...}]
      // localStorage shape: c.teesData = {...}, c.par = [...], c.si = [...]
      const teesData = c.teesData ?? (typeof c.tees === 'object' && c.tees !== null && !Array.isArray(c.tees) ? c.tees : null)
      const par = c.par ?? (Array.isArray(c.holes) ? c.holes.map(h => h.par ?? 4) : null)
      const si = c.si ?? (Array.isArray(c.holes) ? c.holes.map(h => h.si ?? h.strokeIndex ?? null) : null)
      return {
        name: c.name,
        tees: c.tees,
        teesData,
        par,
        si,
        isCustom: true,
        id: c.id,
      }
    })
    const builtin = Object.entries(BUILTIN_COURSES).map(([name, data]) => ({
      name,
      tees: data.tees,
      teesData: data.teesData,
      par: data.par,
      si: data.si,
      isCustom: false,
    }))
    // Custom courses override builtins with the same name
    const customNames = new Set(custom.map(c => c.name))
    const dedupedBuiltins = builtin.filter(b => !customNames.has(b.name))
    // Final dedup by name (keep first occurrence)
    const seen = new Set()
    return [...custom, ...dedupedBuiltins].filter(c => {
      if (seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
  })

  // Default favorites — set on first load when user hasn't favorited anything yet
  const DEFAULT_FAVORITES = [
    'Bonnie Briar Country Club',
    'Manhattan Woods Golf Club',
    'Kiawah Island Club',
    'Bulls Bay Golf Club',
  ]

  const favoriteNames = computed(() => new Set(favorites.value))

  // Ensure favorites array has no duplicates (can accumulate from localStorage)
  function _dedupFavorites() {
    const seen = new Set()
    const deduped = favorites.value.filter(name => {
      if (seen.has(name)) return false
      seen.add(name)
      return true
    })
    if (deduped.length !== favorites.value.length) {
      favorites.value = deduped
      localStorage.setItem('golf_favorites', JSON.stringify(deduped))
    }
  }

  async function fetchCustomCourses() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
      customCourses.value = Object.entries(local).map(([name, data]) => ({
        id: `local_${name}`,
        name,
        tees: data.defaultTee ?? data.tees ?? data,
        teesData: data.teesData ?? null,
        par: data.par ?? null,
        si: data.si ?? null,
        is_public: false,
      }))
      favorites.value = JSON.parse(localStorage.getItem('golf_favorites') || 'null')
      if (!favorites.value) {
        favorites.value = [...DEFAULT_FAVORITES]
        localStorage.setItem('golf_favorites', JSON.stringify(favorites.value))
      }
      _dedupFavorites()
      return
    }
    loading.value = true
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('owner_id', auth.user.id)
    if (!error) {
      // Dedup by name (keep most recently updated)
      const byName = {}
      for (const c of (data ?? [])) {
        if (!byName[c.name] || (c.updated_at > byName[c.name].updated_at)) byName[c.name] = c
      }
      customCourses.value = Object.values(byName)
    }
    favorites.value = JSON.parse(localStorage.getItem('golf_favorites') || 'null')
    if (!favorites.value) {
      favorites.value = [...DEFAULT_FAVORITES]
      localStorage.setItem('golf_favorites', JSON.stringify(favorites.value))
    }
    _dedupFavorites()
    loading.value = false
  }

  async function addCourse(course) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
      local[course.name] = {
        teesData: course.teesData ?? null,
        par: course.par ?? null,
        si: course.si ?? null,
        defaultTee: course.defaultTee ?? null,
        tees: course.tees,
      }
      localStorage.setItem('golf_custom_courses', JSON.stringify(local))
      customCourses.value.push({ id: `local_${course.name}`, ...course, is_public: false })
      return
    }
    // Map to Supabase schema: tees (jsonb), holes (jsonb)
    const teesData = course.teesData ?? course.tees ?? {}
    const par = course.par ?? Array(18).fill(4)
    const si = course.si ?? Array.from({ length: 18 }, (_, i) => i + 1)
    const holes = par.map((p, i) => ({ par: p, si: si[i] ?? (i + 1) }))
    const row = { name: course.name, tees: teesData, holes, is_public: false, owner_id: auth.user.id }

    // Upsert: if a course with this name already exists for this user, update it
    const existing = customCourses.value.find(c => c.name === course.name)
    if (existing) {
      const { data, error } = await supaCallWithRetry(
        'courses.addCourse.update',
        () => supabase.from('courses').update({ tees: teesData, holes }).eq('id', existing.id).select().single(),
        8000,
      )
      if (error) throw error
      const idx = customCourses.value.findIndex(c => c.id === existing.id)
      if (idx >= 0) customCourses.value[idx] = { ...customCourses.value[idx], ...data }
      return data
    }

    const { data, error } = await supaCallWithRetry(
      'courses.addCourse.insert',
      () => supabase.from('courses').insert(row).select().single(),
      8000,
    )
    if (error) throw error
    customCourses.value.push(data)
    return data
  }

  async function updateCourse(id, updates) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const idx = customCourses.value.findIndex(c => c.id === id)
      if (idx >= 0) {
        customCourses.value[idx] = { ...customCourses.value[idx], ...updates }
        const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
        const name = customCourses.value[idx].name
        local[name] = { tees: updates.teesData, par: updates.par, si: updates.si, defaultTee: updates.defaultTee }
        localStorage.setItem('golf_custom_courses', JSON.stringify(local))
      }
      return
    }
    // Map to Supabase schema
    const teesData = updates.teesData ?? updates.tees ?? null
    const par = updates.par ?? null
    const si = updates.si ?? null
    const supaUpdates = {}
    if (teesData) supaUpdates.tees = teesData
    // Only update holes if we have at least par OR si; use COALESCE-style logic to avoid overwriting with nulls
    if (par !== null || si !== null) {
      const existingCourse = customCourses.value.find(c => c.id === id)
      const existingPar = par ?? (Array.isArray(existingCourse?.par) ? existingCourse.par : null) ?? Array(18).fill(4)
      const existingSi = si ?? (Array.isArray(existingCourse?.si) ? existingCourse.si : null) ?? Array.from({ length: 18 }, (_, i) => i + 1)
      supaUpdates.holes = existingPar.map((p, i) => ({ par: p, si: existingSi[i] ?? (i + 1) }))
    }
    if (updates.name) supaUpdates.name = updates.name
    const { data, error } = await supaCallWithRetry(
      'courses.updateCourse',
      () => supabase.from('courses').update(supaUpdates).eq('id', id).select().single(),
      8000,
    )
    if (error) throw error
    const idx = customCourses.value.findIndex(c => c.id === id)
    if (idx >= 0) customCourses.value[idx] = { ...customCourses.value[idx], ...data }
  }

  // Convenience alias — always upserts via updateCourse
  async function saveCourse(id, updates) {
    return updateCourse(id, updates)
  }

  async function deleteCourse(id) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const course = customCourses.value.find(c => c.id === id)
      if (course) {
        const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
        delete local[course.name]
        localStorage.setItem('golf_custom_courses', JSON.stringify(local))
      }
      customCourses.value = customCourses.value.filter(c => c.id !== id)
      return
    }
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error
    customCourses.value = customCourses.value.filter(c => c.id !== id)
  }

  function toggleFavorite(name) {
    const idx = favorites.value.indexOf(name)
    if (idx >= 0) favorites.value.splice(idx, 1)
    else favorites.value.push(name)
    localStorage.setItem('golf_favorites', JSON.stringify(favorites.value))
  }

  function getCourse(name) {
    return allCourses.value.find(c => c.name === name)
  }

  // ── Live course search via golfcourseapi.com ────────────────
  const GOLF_API_KEY = 'YCTLHK65F52NIXNBEE5CIJ6WNE'
  const apiSearchCache = ref({})

  async function searchCoursesApi(query) {
    if (!query || query.length < 3) return []
    if (apiSearchCache.value[query]) { console.log('[GW-store] searchCoursesApi cache hit for', query); return apiSearchCache.value[query] }
    try {
      console.log('[GW-store] searchCoursesApi fetching:', query)
      const resp = await fetch(
        `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Key ${GOLF_API_KEY}` } }
      )
      console.log('[GW-store] searchCoursesApi response status:', resp.status)
      if (!resp.ok) return []
      const json = await resp.json()
      const results = (json.courses || []).map(c => ({
        name: c.club_name || c.course_name || c.name,
        location: [c.city, c.state].filter(Boolean).join(', '),
        isApiResult: true,
        apiId: c.id,
        tees: null,
        teesData: null,
      }))
      apiSearchCache.value[query] = results
      return results
    } catch (e) {
      console.error('[GW-store] searchCoursesApi error:', e)
      return []
    }
  }

  // ── Fetch full course detail from golfcourseapi.com ────────
  const apiDetailCache = ref({})

  async function fetchCourseDetail(apiId) {
    if (!apiId) return null
    if (apiDetailCache.value[apiId]) return apiDetailCache.value[apiId]
    try {
      const resp = await fetch(
        `https://api.golfcourseapi.com/v1/courses/${apiId}`,
        { headers: { 'Authorization': `Key ${GOLF_API_KEY}` } }
      )
      if (!resp.ok) return null
      const json = await resp.json()
      const course = json.course || json
      // ── Normalize tees ───────────────────────────────────────
      // API returns: { "male": [ {tee_name, course_rating, slope_rating, holes:[...]}, ... ],
      //               "female": [ ... ] }
      // We flatten all gender groups into one tee list.
      // If a tee name appears in both male & female we suffix with (M)/(F).
      const teesRawInput = course.tees || {}
      let teesFlat = []  // [{tee_name, course_rating, slope_rating, holes, _gender}, ...]

      if (Array.isArray(teesRawInput)) {
        // Already a flat array of tee objects
        teesFlat = teesRawInput
      } else if (typeof teesRawInput === 'object' && teesRawInput !== null) {
        // Object keyed by gender or tee name
        for (const [groupKey, groupVal] of Object.entries(teesRawInput)) {
          if (Array.isArray(groupVal)) {
            // gender group: "male" → [{tee_name: "Blue", ...}, ...]
            for (const tee of groupVal) {
              teesFlat.push({ ...tee, _gender: groupKey })
            }
          } else if (typeof groupVal === 'object' && groupVal !== null) {
            // single tee object keyed by name: "Blue" → {courseRating, ...}
            teesFlat.push({ ...groupVal, _keyName: groupKey })
          }
        }
      }

      // Deduplicate names: if same tee_name appears in male & female, suffix with (M)/(F)
      const nameCount = {}
      for (const tee of teesFlat) {
        const base = tee.tee_name || tee.teeName || tee.name || tee._keyName || 'Unknown'
        nameCount[base] = (nameCount[base] || 0) + 1
      }

      console.log('[GW-store] teesFlat:', teesFlat.length, 'tees, names:', teesFlat.map(t => t.tee_name || t._keyName))

      const teesData = {}
      for (const tee of teesFlat) {
        let teeName = tee.tee_name || tee.teeName || tee.name || tee._keyName || 'Unknown'
        // Suffix with gender if name collision
        if (nameCount[teeName] > 1 && tee._gender) {
          const g = tee._gender.charAt(0).toUpperCase()  // M or F
          teeName = `${teeName} (${g})`
        }
        const holes = tee.holes || []
        teesData[teeName] = {
          rating: tee.course_rating ?? tee.courseRating ?? tee.rating ?? null,
          slope: tee.slope_rating ?? tee.slopeRating ?? tee.slope ?? null,
          yards: tee.total_yards ?? tee.totalYards ?? (holes.reduce((s, h) => s + (h.yardage || h.yards || 0), 0) || null),
          yardsByHole: holes.map(h => h.yardage || h.yards || null),
          siByHole: holes.map(h => h.handicap || h.stroke_index || null),
          parByHole: holes.map(h => h.par || null),
        }
      }
      // Global par/si: prefer tee with most complete par data (stable across API call order)
      const firstTeeHoles = teesFlat[0]?.holes || course.holes || []
      let bestParSource = null
      for (const tee of teesFlat) {
        const pars = (tee.holes || []).map(h => h.par || null)
        if (pars.filter(Boolean).length > (bestParSource?.filter(Boolean).length ?? 0)) {
          bestParSource = pars
        }
      }
      const par = (bestParSource ?? firstTeeHoles.map(h => h.par || null)).map(p => p || 4)
      // si: use first tee that has handicap data
      let si = null
      for (const tee of teesFlat) {
        const sis = (tee.holes || []).map(h => h.handicap || h.stroke_index || null)
        if (sis.some(s => s !== null)) { si = sis; break }
      }
      if (!si) si = firstTeeHoles.map((_, i) => i + 1)

      const detail = { teesData, par, si }
      apiDetailCache.value[apiId] = detail
      return detail
    } catch (e) {
      console.warn('fetchCourseDetail error:', e)
      return null
    }
  }

  // ── Migration: localStorage custom courses → Supabase ──────
  async function migrateFromLocalStorage() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return
    if (localStorage.getItem('gw_courses_migrated')) return

    const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
    if (!Object.keys(local).length) return

    const rows = Object.entries(local).map(([name, data]) => ({
      name,
      tees: data.tees ?? data,
      is_public: false,
      owner_id: auth.user.id,
    }))

    const { error } = await supabase.from('courses').insert(rows)
    if (!error) {
      localStorage.setItem('gw_courses_migrated', '1')
      await fetchCustomCourses()
    }
  }

  return {
    customCourses, favorites, allCourses, favoriteNames, loading,
    fetchCustomCourses, addCourse, updateCourse, saveCourse, deleteCourse,
    toggleFavorite, getCourse, migrateFromLocalStorage,
    searchCoursesApi, apiSearchCache,
    fetchCourseDetail, apiDetailCache,
  }
})
