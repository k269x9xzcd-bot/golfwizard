<template>
  <Teleport to="body">
    <div v-if="player" class="ghin-sheet-backdrop" @click.self="$emit('close')">
      <div class="ghin-sheet-panel">
        <div class="ghin-sheet-handle"></div>
        <div class="ghin-sheet-top">
          <div>
            <div class="ghin-sheet-name">{{ player.name }}</div>
            <div class="ghin-sheet-meta">
              <span v-if="player.ghin_number">GHIN #{{ player.ghin_number }}</span>
              <span v-if="player.club_name"> · {{ player.club_name }}</span>
            </div>
          </div>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="ghin-stats-grid">
          <div class="ghin-stat">
            <div class="ghin-stat-label">Index</div>
            <div class="ghin-stat-val">{{ player.ghin_index != null ? Number(player.ghin_index).toFixed(1) : '—' }}</div>
            <div class="ghin-stat-sub">current</div>
          </div>
          <div class="ghin-stat">
            <div class="ghin-stat-label">Low HI</div>
            <div class="ghin-stat-val">{{ player.low_hi != null ? Number(player.low_hi).toFixed(1) : '—' }}</div>
            <div class="ghin-stat-sub">season low</div>
          </div>
          <div class="ghin-stat">
            <div class="ghin-stat-label">Cap</div>
            <div class="ghin-stat-val ghin-stat-val--sm">
              <span v-if="player.hard_cap === 'true' || player.hard_cap === true" class="cap-badge cap-hard">Hard</span>
              <span v-else-if="player.soft_cap === 'true' || player.soft_cap === true" class="cap-badge cap-soft">Soft</span>
              <span v-else class="cap-badge cap-none">None</span>
            </div>
            <div class="ghin-stat-sub">cap status</div>
          </div>
        </div>

        <div class="player-sheet-note">
          <div class="sync-row">
            <span class="sync-dot" :class="syncClass"></span>
            Synced {{ syncLabel }}
          </div>
          <div class="public-note">Score history is only available for your own account via GHIN credentials.</div>
        </div>

        <div style="height:40px;"></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  player: { type: Object, default: null },
})
defineEmits(['close'])

const syncClass = computed(() => {
  if (!props.player?.ghin_synced_at) return 'dot-none'
  const h = (Date.now() - new Date(props.player.ghin_synced_at).getTime()) / (1000 * 60 * 60)
  return h < 26 ? 'dot-blue' : h < 72 ? 'dot-yellow' : 'dot-red'
})

const syncLabel = computed(() => {
  if (!props.player?.ghin_synced_at) return 'never'
  const d = new Date(props.player.ghin_synced_at)
  const days = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})
</script>


<style scoped>
.ghin-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: flex-end; z-index: 200;
}
.ghin-sheet-panel {
  background: var(--gw-neutral-900); border-radius: 24px 24px 0 0;
  width: 100%; max-height: 85vh; overflow-y: auto;
  border-top: 1px solid var(--gw-card-border);
}
.ghin-sheet-handle { width: 36px; height: 4px; background: var(--gw-neutral-700); border-radius: 2px; margin: 12px auto 0; }
.ghin-sheet-top { padding: 14px 20px 0; display: flex; align-items: flex-start; justify-content: space-between; }
.ghin-sheet-name { font-size: 20px; font-weight: 700; color: var(--gw-text); }
.ghin-sheet-meta { font-size: 12px; color: var(--gw-text-muted); margin-top: 3px; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: rgba(240,237,224,.5); }
.ghin-stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; padding: 14px 16px 0; }
.ghin-stat { background: var(--gw-neutral-800); border-radius: 10px; border: 1px solid var(--gw-card-border); padding: 10px 12px; }
.ghin-stat-label { font-size: 10px; color: var(--gw-text-muted); font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 4px; }
.ghin-stat-val { font-size: 22px; font-weight: 700; color: var(--gw-text); font-family: var(--gw-font-mono); }
.ghin-stat-val--sm { font-size: 16px; }
.ghin-stat-sub { font-size: 10px; color: var(--gw-text-muted); margin-top: 2px; }
.cap-badge { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 8px; }
.cap-hard { background: rgba(239,68,68,.15); color: #f87171; }
.cap-soft { background: rgba(234,179,8,.12); color: #fbbf24; }
.cap-none { background: var(--gw-neutral-700); color: var(--gw-text-muted); }
.player-sheet-note { margin: 12px 16px 0; background: var(--gw-neutral-800); border-radius: 10px; border: 1px solid var(--gw-card-border); padding: 12px 14px; }
.sync-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--gw-text-muted); margin-bottom: 6px; }
.sync-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-blue   { background: #60a5fa; }
.dot-yellow { background: #fbbf24; }
.dot-red    { background: #f87171; }
.dot-none   { background: var(--gw-neutral-600); }
.public-note { font-size: 11px; color: var(--gw-text-muted); line-height: 1.5; font-style: italic; }
</style>
