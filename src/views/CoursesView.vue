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
    FULL_FILE_TOO_LARGE
  </div>
</template>