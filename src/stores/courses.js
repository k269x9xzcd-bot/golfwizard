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
  const allCourses = computed(() => {
    const custom = customCourses.value.map(c => ({
      name: c.name,
      tees: c.tees,
      isCustom: true,
      id: c.id,
    }))
    const builtin = Object.entries(BUILTIN_COURSES).map(([name, data]) => ({
      name,
      tees: data,
      isCustom: false,
    }))
    return [...custom, ...builtin]
  })

  const favoriteNames = computed(() => new Set(favorites.value))

  async function fetchCustomCourses() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
      customCourses.value = Object.entries(local).map(([name, data]) => ({
        id: `local_${name}`,
        name,
        tees: data.tees ?? data,
        is_public: false,
      }))
      favorites.value = JSON.parse(localStorage.getItem('golf_favorites') || '[]')
      return
    }
    loading.value = true
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('owner_id', auth.user.id)
    if (!error) customCourses.value = data ?? []
    favorites.value = JSON.parse(localStorage.getItem('golf_favorites') || '[]')
    loading.value = false
  }

  async function addCourse(course) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      const local = JSON.parse(localStorage.getItem('golf_custom_courses') || '{}')
      local[course.name] = { tees: course.tees }
      localStorage.setItem('golf_custom_courses', JSON.stringify(local))
      customCourses.value.push({ id: `local_${course.name}`, ...course, is_public: false })
      return
    }
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...course, owner_id: auth.user.id })
      .select().single()
    if (error) throw error
    customCourses.value.push(data)
    return data
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
    fetchCustomCourses, addCourse, deleteCourse,
    toggleFavorite, getCourse, migrateFromLocalStorage,
  }
})
