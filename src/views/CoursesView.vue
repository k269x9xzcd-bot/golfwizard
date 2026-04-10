<template>
  <div class="view courses-view">
    <header class="view-header"><h2>Courses</h2></header>
    <input v-model="search" class="wiz-input" placeholder="Search courses…" />
    <div v-for="c in filtered" :key="c.name" class="course-card card">
      <div class="course-name">{{ c.name }}</div>
      <div class="course-tees">{{ Object.keys(c.tees).join(', ') }}</div>
      <button class="fav-btn" @click="coursesStore.toggleFavorite(c.name)">
        {{ coursesStore.favoriteNames.has(c.name) ? '★' : '☆' }}
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useCoursesStore } from '../stores/courses'
const coursesStore = useCoursesStore()
const search = ref('')
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return coursesStore.allCourses.filter(c => c.name.toLowerCase().includes(q))
})
</script>
