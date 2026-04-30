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
  background: #0a2a1c;
  border-bottom: 1px solid #114a35;
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0 16px;
}
[data-theme="light"] .pc-tab-bar {
  background: #ffffff;
  border-bottom: 1px solid rgba(13,95,60,.18);
}

.pc-tab {
  flex: 1;
  padding: 13px 8px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(240,237,224,.55);
  font-family: var(--gw-font-body);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
[data-theme="light"] .pc-tab { color: #5d6e62; }

.pc-tab.active {
  color: var(--gw-accent);
  border-bottom-color: var(--gw-accent);
}
[data-theme="light"] .pc-tab.active { color: #9a7a1e; border-bottom-color: #9a7a1e; }

.pc-hidden {
  display: none;
}
</style>
