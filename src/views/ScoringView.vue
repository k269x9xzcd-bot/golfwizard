<template>
  <div class="view scoring-view" :class="{ 'is-landscape': isLandscape }">
    <!-- Landscape corner hint -->
    <div v-if="isLandscape && roundsStore.activeRound" class="landscape-hint">
      <span class="lh-arrow">↻</span> rotate to exit
    </div>

    <!-- Empty State -->
    <div v-if="!roundsStore.activeRound" class="empty-state">
      <div class="empty-icon">🏌️</div>
      <h2 class="empty-title">No Active Round</h2>
      <p class="empty-message">Start a new round to begin tracking scores</p>
    </div>

    <!-- Active Round -->
    <div v-else class="round-container">
      <!-- Viewer-mode toast (shown when a non-captain taps a score cell) -->
      <transition name="fade">
        <div v-if="viewerToast" class="viewer-toast">{{ viewerToast }}</div>
      </transition>
      <!-- Score sync error banner -->
      <div v-if="roundsStore.scoreSyncError" class="sync-error-banner">
        <span v-if="roundsStore.scoreSyncError === 'rls'">⚠️ Scores not saving — session issue. Please sign out and back in.</span>
        <span v-else>⚠️ Scores not saving to cloud. Check your connection.</span>
      </div>