import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'
import { COURSES as BUILTIN_COURSES } from '../modules/courses'

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
    return [...custom, ...builtin]
  })

  // Default favorites — set on first load when user hasn't favorited anything yet
  const DEFAULT_FAVORITES = [
    'Bonnie Briar Country Club',
    'Manhattan Woods Golf Club',
    'Kiawah Island Club',
    'Bulls Bay Golf Club',
  ]

  const favoriteNames = computed(() => new Set(favorites.value))

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
      return
    }
    loading.value = true
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('owner_id', auth.user.id)
    if (!error) customCourses.value = data ?? []
    favorites.value = JSON.parse(localStorage.getItem('golf_favorites') || 'null')
    if (!favorites.value) {
      favorites.value = [...DEFAULT_FAVORITES]
      localStorage.setItem('golf_favorites', JSON.stringify(favorites.value))
    }
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
      const { data, error } = await supabase
        .from('courses').update({ tees: teesData, holes }).eq('id', existing.id).select().single()
      if (error) throw error
      const idx = customCourses.value.findIndex(c => c.id === existing.id)
      if (idx >= 0) customCourses.value[idx] = data
      return data
    }

    const { data, error } = await supabase
      .from('courses').insert(row).select().single()
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
    if (par || si) supaUpdates.holes = (par ?? Array(18).fill(4)).map((p, i) => ({ par: p, si: (si ?? [])[i] ?? (i + 1) }))
    if (updates.name) supaUpdates.name = updates.name
    const { data, error } = await supabase
      .from('courses').update(supaUpdates).eq('id', id).select().single()
    if (error) throw error
    const idx = customCourses.value.findIndex(c => c.id === id)
    if (idx >= 0) customCourses.value[idx] = data
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
      // Parse tees — API may return tees as object {"Blue": {...}} or array
      const teesRawInput = course.tees || {}
      let teesRaw = []
      if (Array.isArray(teesRawInput)) {
        teesRaw = teesRawInput
      } else if (typeof teesRawInput === 'object' && teesRawInput !== null) {
        // Object keyed by tee name, e.g. {"Blue": {courseRating, slopeRating, holes: [...]}}
        teesRaw = Object.entries(teesRawInput).map(([name, data]) => ({
          ...data, _keyName: name,
        }))
      }
      console.log('[GW-store] teesRaw normalized:', teesRaw.length, 'tees')
      const teesData = {}
      for (const tee of teesRaw) {
        const teeName = tee._keyName || tee.tee_name || tee.teeName || tee.name || 'Unknown'
        const holes = tee.holes || []
        teesData[teeName] = {
          rating: tee.courseRating ?? tee.course_rating ?? tee.rating ?? null,
          slope: tee.slopeRating ?? tee.slope_rating ?? tee.slope ?? null,
          yards: tee.totalYards ?? tee.total_yards ?? (holes.reduce((s, h) => s + (h.yards || h.yardage || 0), 0) || null),
          yardsByHole: holes.map(h => h.yards || h.yardage || null),
          siByHole: holes.map(h => h.handicap || h.stroke_index || null),
        }
      }
      // Global par/si from first tee or holes on course object
      const firstTeeHoles = teesRaw[0]?.holes || course.holes || []
      const par = firstTeeHoles.map(h => h.par || 4)
      // si: use first tee that has handicap data
      let si = null
      for (const tee of teesRaw) {
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
    fetchCustomCourses, addCourse, updateCourse, deleteCourse,
    toggleFavorite, getCourse, migrateFromLocalStorage,
    searchCoursesApi, apiSearchCache,
    fetchCourseDetail, apiDetailCache,
  }
})
