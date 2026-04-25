<template>
  <div class="pc-view">
    <!-- Sub-tab bar -->
    <div class="pc-tab-bar">
      <button
        class="pc-tab"
        :class="{ active: activeTab === 'players' }"
        @click="activeTab = 'players'"
      >👥 Players</button>
      <button
        class="pc-tab"
        :class="{ active: activeTab === 'courses' }"
        @click="activeTab = 'courses'"
      >⛳ Courses</button>
    </div>

    <!-- Tab content: keep both mounted so state (scroll, open sheets) is preserved -->
    <div :class="{ 'pc-hidden': activeTab !== 'players' }">
      <PlayersView />
    </div>
    <div :class="{ 'pc-hidden': activeTab !== 'courses' }">
      <CoursesView />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PlayersView from './PlayersView.vue'
import CoursesView from './CoursesView.vue'

// Default to Players tab; could read from query param if needed
const activeTab = ref('players')
</script>

<style scoped>
.pc-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.pc-tab-bar {
  display: flex;
  gap: 0;
  background: var(--gw-green-900, #0a2a1c);
  border-bottom: 1px solid var(--gw-green-700, #114a35);
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0 16px;
}

.pc-tab {
  flex: 1;
  padding: 13px 8px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--gw-text-secondary, #a3b8aa);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.pc-tab.active {
  color: var(--gw-gold, #d4af37);
  border-bottom-color: var(--gw-gold, #d4af37);
}

.pc-hidden {
  display: none;
}
</style>
