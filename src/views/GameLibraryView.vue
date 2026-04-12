<template>
  <div class="library-page">
    <div class="library-header">
      <h1 class="library-title">Game Library</h1>
      <p class="library-subtitle">How to play every game in GolfWizard</p>
    </div>

    <!-- Filter tabs -->
    <div class="library-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="library-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </div>

    <!-- Game cards -->
    <div class="library-cards">
      <div
        v-for="game in filteredGames"
        :key="game.key"
        class="library-card"
        :class="{ expanded: expandedGame === game.key }"
        @click="toggleExpand(game.key)"
      >
        <div class="library-card-header">
          <div class="library-card-left">
            <span class="library-card-icon">{{ game.icon }}</span>
            <div class="library-card-title-block">
              <span class="library-card-name">{{ game.name }}</span>
              <span class="library-card-role" :class="game.role">{{ game.role === 'main' ? 'Main Game' : 'Side Game' }}</span>
            </div>
          </div>
          <span class="library-card-chevron">{{ expandedGame === game.key ? '▲' : '▼' }}</span>
        </div>

        <p class="library-card-desc">{{ game.desc }}</p>

        <div v-if="expandedGame === game.key" class="library-card-detail">
          <div class="detail-section">
            <div class="detail-label">Players</div>
            <div class="detail-text">{{ game.players }}</div>
          </div>

          <div class="detail-section">
            <div class="detail-label">How to Play</div>
            <div class="detail-text">{{ game.rules }}</div>
          </div>

          <div class="detail-section">
            <div class="detail-label">Wagering</div>
            <div class="detail-text">{{ game.wagering }}</div>
          </div>

          <div v-if="game.example" class="detail-section detail-example">
            <div class="detail-label">Example</div>
            <div class="detail-text">{{ game.example }}</div>
          </div>

          <div class="detail-section detail-hcp">
            <div class="detail-label">Handicap Method</div>
            <div class="detail-text">{{ game.hcpNote }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { GAME_DEFS } from '../modules/courses'

const tabs = [
  { key: 'all', label: 'All Games' },
  { key: 'main', label: 'Main' },
  { key: 'side', label: 'Side' },
]

const activeTab = ref('all')
const expandedGame = ref(null)

const allGames = computed(() => {
  return Object.entries(GAME_DEFS).map(([key, def]) => ({ key, ...def }))
})

const filteredGames = computed(() => {
  if (activeTab.value === 'all') return allGames.value
  return allGames.value.filter(g => g.role === activeTab.value)
})

function toggleExpand(key) {
  expandedGame.value = expandedGame.value === key ? null : key
}
</script>

<style scoped>
.library-page {
  padding: 16px 16px 100px;
  max-width: 600px;
  margin: 0 auto;
}

.library-header {
  text-align: center;
  padding: 12px 0 20px;
}
.library-title {
  font-family: var(--gw-font-display, Georgia, serif);
  font-size: 28px;
  font-weight: 700;
  color: var(--gw-gold, #d4af37);
  margin: 0;
}
.library-subtitle {
  font-size: 13px;
  color: var(--gw-text-secondary, #a3b8aa);
  margin: 6px 0 0;
}

/* Tabs */
.library-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
  background: var(--gw-green-900, #0a2218);
  border-radius: 12px;
  padding: 4px;
}
.library-tab {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--gw-text-secondary, #a3b8aa);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.library-tab.active {
  background: var(--gw-green-700, #114a35);
  color: var(--gw-text-primary, #f0ede0);
}
.library-tab:active {
  opacity: 0.8;
}

/* Cards */
.library-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.library-card {
  background: var(--gw-green-800, #0d3325);
  border: 1px solid var(--gw-green-700, #114a35);
  border-radius: 14px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.library-card:active {
  border-color: var(--gw-green-500, #1a7a55);
}
.library-card.expanded {
  border-color: var(--gw-gold, #d4af37);
  box-shadow: 0 2px 12px rgba(212,175,55,0.08);
}

.library-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.library-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.library-card-icon {
  font-size: 26px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gw-green-900, #0a2218);
  border-radius: 10px;
}
.library-card-title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.library-card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--gw-text-primary, #f0ede0);
}
.library-card-role {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
.library-card-role.main {
  color: var(--gw-gold, #d4af37);
}
.library-card-role.side {
  color: var(--gw-green-400, #22a06b);
}

.library-card-chevron {
  font-size: 10px;
  color: var(--gw-text-muted, #7d9283);
}

.library-card-desc {
  font-size: 13px;
  color: var(--gw-text-secondary, #a3b8aa);
  line-height: 1.5;
  margin: 10px 0 0;
}

/* Expanded detail */
.library-card-detail {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--gw-green-700, #114a35);
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: card-in 0.2s ease-out;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--gw-gold, #d4af37);
}
.detail-text {
  font-size: 13px;
  color: var(--gw-text-primary, #f0ede0);
  line-height: 1.55;
}

.detail-example {
  background: rgba(255,255,255,0.03);
  padding: 10px 12px;
  border-radius: 10px;
  border-left: 3px solid var(--gw-green-500, #1a7a55);
}

.detail-hcp {
  background: rgba(212,175,55,0.06);
  padding: 10px 12px;
  border-radius: 10px;
  border-left: 3px solid var(--gw-gold, #d4af37);
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
