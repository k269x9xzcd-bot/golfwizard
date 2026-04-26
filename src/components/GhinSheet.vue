<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ghin-sheet-backdrop" @click.self="$emit('update:modelValue', false)">
      <div class="ghin-sheet-panel">
        <div class="ghin-sheet-handle"></div>

        <div class="ghin-sheet-top">
          <div>
            <div class="ghin-sheet-name">{{ player?.name }}</div>
            <div class="ghin-sheet-meta">
              <span v-if="player?.ghin_number">GHIN #{{ player.ghin_number }}</span>
              <span v-if="player?.club_name"> · {{ player.club_name }}</span>
            </div>
          </div>
          <button class="close-btn" @click="$emit('update:modelValue', false)">✕</button>
        </div>

        <div class="ghin-hero">
          <div class="ghin-hero-hi">
            <span class="ghin-hero-num">{{ liveHI ?? (player?.ghin_index != null ? Number(player.ghin_index).toFixed(1) : '—') }}</span>
            <span v-if="scoresFetched" class="ghin-hero-trend" :class="'trend-' + computedTrend">
              {{ computedTrend === 'improving' ? '↓' : computedTrend === 'declining' ? '↑' : '→' }}
            </span>
          </div>
          <div class="ghin-hero-label">Handicap Index</div>
          <div class="ghin-hero-trend-label" v-if="scoresFetched">
            <span v-if="computedTrend === 'improving'" class="trend-improving">Trending down ↓ (improving)</span>
            <span v-else-if="computedTrend === 'declining'" class="trend-declining">Trending up ↑ (rising)</span>
            <span v-else class="trend-neutral">Stable</span>
          </div>
        </div>

        <div class="ghin-stats-grid">
          <div class="ghin-stat">
            <div class="ghin-stat-label">Low HI</div>
            <div class="ghin-stat-val">{{ liveLowHI ?? (player?.ghin_low_hi != null ? Number(player.ghin_low_hi).toFixed(1) : '—') }}</div>
            <div class="ghin-stat-sub">career low</div>
          </div>
          <div class="ghin-stat">
            <div class="ghin-stat-label">Posted</div>
            <div class="ghin-stat-val">{{ scoresPosted ?? player?.ghin_scores_posted ?? '—' }}</div>
            <div class="ghin-stat-sub">total rounds</div>
          </div>
          <div class="ghin-stat">
            <div class="ghin-stat-label">Avg Score</div>
            <div class="ghin-stat-val">{{ scoreStats?.average != null ? Number(scoreStats.average).toFixed(1) : '—' }}</div>
            <div class="ghin-stat-sub">last 20</div>
          </div>
        </div>

        <div v-if="scoreStats" class="ghin-range-strip">
          <div class="ghin-range-item">
            <span class="ghin-range-label">Low</span>
            <span class="ghin-range-val ghin-range-val--low">{{ scoreStats.lowest_score }}</span>
          </div>
          <div class="ghin-range-divider"></div>
          <div class="ghin-range-item">
            <span class="ghin-range-label">High</span>
            <span class="ghin-range-val ghin-range-val--high">{{ scoreStats.highest_score }}</span>
          </div>
          <div class="ghin-range-divider"></div>
          <div class="ghin-range-item">
            <span class="ghin-range-label">Used for HI</span>
            <span class="ghin-range-val">{{ scores.filter(s => s.used_for_hi).length }} of {{ scores.length }}</span>
          </div>
        </div>

        <div v-if="scoreStats?.avg_birdie_pct != null" class="ghin-agg-grid">
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val" style="color:var(--gw-birdie)">{{ Math.round((scoreStats.avg_birdie_pct ?? 0) * 100) }}%</div>
            <div class="ghin-agg-label">Birdies</div>
          </div>
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val">{{ Math.round((scoreStats.avg_par_pct ?? 0) * 100) }}%</div>
            <div class="ghin-agg-label">Pars</div>
          </div>
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val" style="color:var(--gw-bogey)">{{ Math.round((scoreStats.avg_bogey_pct ?? 0) * 100) }}%</div>
            <div class="ghin-agg-label">Bogeys</div>
          </div>
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val">{{ Math.round((scoreStats.avg_gir_pct ?? 0) * 100) }}%</div>
            <div class="ghin-agg-label">GIR</div>
          </div>
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val">{{ scoreStats.avg_par3 != null ? Number(scoreStats.avg_par3).toFixed(1) : '—' }}</div>
            <div class="ghin-agg-label">Avg Par 3</div>
          </div>
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val">{{ scoreStats.avg_par4 != null ? Number(scoreStats.avg_par4).toFixed(1) : '—' }}</div>
            <div class="ghin-agg-label">Avg Par 4</div>
          </div>
          <div class="ghin-agg-stat">
            <div class="ghin-agg-val">{{ scoreStats.avg_par5 != null ? Number(scoreStats.avg_par5).toFixed(1) : '—' }}</div>
            <div class="ghin-agg-label">Avg Par 5</div>
          </div>
        </div>

        <div v-if="player?.soft_cap === 'true' || player?.hard_cap === 'true'" class="ghin-cap-row">
          <div v-if="player?.hard_cap === 'true'" class="ghin-cap-badge ghin-cap-badge--hard">⚠ Hard Cap Applied</div>
          <div v-else-if="player?.soft_cap === 'true'" class="ghin-cap-badge ghin-cap-badge--soft">Soft Cap Applied</div>
        </div>

        <div class="ghin-history-section">
          <div class="ghin-history-header">
            <span class="ghin-history-title">Score History</span>
            <button class="ghin-refresh-btn" @click="$emit('refresh')" :disabled="loading" title="Refresh">
              <span :class="{ spin: loading }">⟳</span>
            </button>
          </div>

          <div v-if="!hasCredentials" class="ghin-no-creds">
            <div class="ghin-scores-note">GHIN login required</div>
            <div class="ghin-scores-sub">Add your GHIN password in Settings → Profile to load score history.</div>
            <button class="btn-ghost btn-sm" style="margin-top:10px;" @click="$emit('go-settings')">Go to Settings →</button>
          </div>
          <div v-else-if="loading" class="ghin-scores-loading">
            <span class="spin" style="font-size:22px;">⟳</span>
            <span style="margin-left:8px;color:var(--gw-text-muted)">Loading scores…</span>
          </div>
          <div v-else-if="error" class="ghin-scores-error">{{ error }}</div>
          <div v-else-if="scores.length" class="ghin-scores-list">
            <div class="ghin-scores-cols">
              <span>Date</span>
              <span>Course / Tee</span>
              <span class="col-center">Gross</span>
              <span class="col-center">Net</span>
              <span class="col-right">Diff</span>
            </div>
            <div
              v-for="(s, i) in scores"
              :key="i"
              class="ghin-score-row"
              :class="{ 'ghin-score-row--used': s.used_for_hi }"
            >
              <span class="score-date">{{ formatDate(s.date) }}</span>
              <span class="score-course-wrap">
                <span class="score-course" :title="s.course_name">{{ s.course_name }}</span>
                <span class="score-tee" v-if="s.tee_name">{{ s.tee_name }}</span>
              </span>
              <span class="score-ags col-center">{{ s.adjusted_gross_score ?? '—' }}</span>
              <span class="score-net col-center">{{ s.net_score ?? '—' }}</span>
              <span class="score-diff col-right" :class="s.used_for_hi ? 'diff-used' : ''">
                <span v-if="s.used_for_hi" class="hi-star" title="Used for HI">★</span>{{ s.differential != null ? Number(s.differential).toFixed(1) : '—' }}
              </span>
            </div>
            <div class="ghin-scores-legend">
              <span class="hi-star" style="font-size:11px;">★</span>
              Used for HI calculation ({{ scores.filter(s => s.used_for_hi).length }} of {{ scores.length }})
            </div>
          </div>
          <div v-else-if="scoresFetched" class="ghin-scores-empty">No scores found</div>
          <div v-else class="ghin-scores-prompt">
            <button class="btn-primary btn-sm" @click="$emit('refresh')">Load Score History</button>
          </div>
        </div>

        <div style="height:32px;"></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  player: Object,
  hasCredentials: Boolean,
  loading: Boolean,
  error: String,
  scoresFetched: Boolean,
  scores: { type: Array, default: () => [] },
  scoresPosted: { type: Number, default: null },
  scoreStats: { type: Object, default: null },
  liveHI: { type: String, default: null },
  liveLowHI: { type: String, default: null },
  computedTrend: { type: String, default: 'neutral' },
})
defineEmits(['update:modelValue', 'refresh', 'go-settings'])

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
}
</script>

<style scoped>
.ghin-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: flex-end; z-index: 200;
}
.ghin-sheet-panel {
  background: var(--gw-neutral-900);
  border-radius: 24px 24px 0 0;
  width: 100%; max-height: 88vh; overflow-y: auto;
  border-top: 1px solid var(--gw-card-border);
}
.ghin-sheet-handle {
  width: 36px; height: 4px;
  background: var(--gw-neutral-700);
  border-radius: 2px; margin: 12px auto 0;
}
.ghin-sheet-top {
  padding: 14px 20px 0;
  display: flex; align-items: flex-start; justify-content: space-between;
}
.ghin-sheet-name { font-size: 20px; font-weight: 700; color: var(--gw-text); }
.ghin-sheet-meta { font-size: 12px; color: var(--gw-text-muted); margin-top: 3px; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: rgba(240,237,224,.5); }

.ghin-hero { padding: 16px 20px 4px; }
.ghin-hero-hi { display: flex; align-items: baseline; gap: 10px; }
.ghin-hero-num { font-size: 52px; font-weight: 800; color: var(--gw-text); font-family: var(--gw-font-mono); line-height: 1; }
.ghin-hero-trend { font-size: 28px; font-weight: 800; }
.ghin-hero-label { font-size: 11px; color: var(--gw-text-muted); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
.ghin-hero-trend-label { font-size: 12px; margin-top: 4px; }
.trend-improving { color: var(--gw-green-400); font-weight: 600; }
.trend-declining  { color: #f87171; font-weight: 600; }
.trend-neutral    { color: var(--gw-text-muted); }

.ghin-stats-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 8px; padding: 14px 16px 0;
}
.ghin-stat {
  background: var(--gw-neutral-800); border-radius: 10px;
  border: 1px solid var(--gw-card-border); padding: 10px 12px;
}
.ghin-stat-label { font-size: 10px; color: var(--gw-text-muted); font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 4px; }
.ghin-stat-val { font-size: 22px; font-weight: 700; color: var(--gw-text); font-family: var(--gw-font-mono); }
.ghin-stat-sub { font-size: 10px; color: var(--gw-text-muted); margin-top: 2px; }

.ghin-range-strip {
  display: flex; align-items: center; justify-content: space-around;
  margin: 12px 16px 0; padding: 12px 16px;
  background: var(--gw-neutral-800); border-radius: 12px;
  border: 1px solid var(--gw-card-border);
}
.ghin-range-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ghin-range-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--gw-text-muted); font-weight: 600; }
.ghin-range-val { font-size: 18px; font-weight: 700; font-family: var(--gw-font-mono); color: var(--gw-text); }
.ghin-range-val--low  { color: var(--gw-green-400); }
.ghin-range-val--high { color: #f87171; }
.ghin-range-divider { width: 1px; height: 28px; background: var(--gw-card-border); }

.ghin-agg-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 6px; padding: 10px 16px 0;
}
.ghin-agg-stat {
  background: var(--gw-neutral-800); border-radius: 8px;
  border: 1px solid var(--gw-card-border); padding: 8px 4px; text-align: center;
}
.ghin-agg-val { font-size: 14px; font-weight: 700; color: var(--gw-text); font-family: var(--gw-font-mono); }
.ghin-agg-label { font-size: 9px; color: var(--gw-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

.ghin-cap-row { display: flex; gap: 8px; padding: 10px 16px 0; }
.ghin-cap-badge { font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 20px; }
.ghin-cap-badge--hard { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3); }
.ghin-cap-badge--soft { background: rgba(234,179,8,.12); color: #fbbf24; border: 1px solid rgba(234,179,8,.3); }

.ghin-history-section { margin: 12px 16px 0; }
.ghin-history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ghin-history-title { font-size: 13px; font-weight: 700; color: var(--gw-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.ghin-refresh-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--gw-text-muted); padding: 4px 6px; border-radius: 6px; }
.ghin-refresh-btn:disabled { opacity: 0.4; }

.ghin-no-creds, .ghin-scores-empty, .ghin-scores-prompt {
  background: var(--gw-neutral-800); border-radius: 12px;
  border: 1px solid var(--gw-card-border); padding: 14px 16px; text-align: center;
}
.ghin-scores-note { font-size: 15px; font-weight: 600; color: var(--gw-text); margin-bottom: 6px; }
.ghin-scores-sub { font-size: 13px; color: var(--gw-text-muted); line-height: 1.5; }
.ghin-scores-loading { display: flex; align-items: center; padding: 20px 4px; }
.ghin-scores-error { font-size: 13px; color: #fca5a5; padding: 12px 4px; }
.ghin-scores-list { border-radius: 10px; overflow: hidden; border: 1px solid var(--gw-card-border); }
.ghin-scores-cols {
  display: grid; grid-template-columns: 58px 1fr 36px 36px 52px;
  gap: 4px; padding: 6px 10px;
  font-size: 10px; font-weight: 600; color: var(--gw-text-muted);
  text-transform: uppercase; letter-spacing: 0.3px;
  background: var(--gw-neutral-800); border-bottom: 1px solid var(--gw-card-border);
}
.ghin-score-row {
  display: grid; grid-template-columns: 58px 1fr 36px 36px 52px;
  gap: 4px; align-items: center; padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px;
}
.ghin-score-row:last-of-type { border-bottom: none; }
.ghin-score-row--used { background: rgba(34,160,107,0.07); }
.score-date { font-size: 11px; color: var(--gw-text-muted); white-space: nowrap; }
.score-course-wrap { display: flex; flex-direction: column; min-width: 0; }
.score-course { color: var(--gw-text); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score-tee { font-size: 10px; color: var(--gw-text-muted); }
.score-ags, .score-net { font-family: var(--gw-font-mono); color: var(--gw-text); text-align: center; }
.col-center { text-align: center; }
.col-right { text-align: right; }
.score-diff { font-family: var(--gw-font-mono); color: var(--gw-text-muted); text-align: right; }
.diff-used { color: var(--gw-green-400); font-weight: 700; }
.hi-star { color: var(--gw-birdie); font-size: 11px; margin-right: 2px; }
.ghin-scores-legend {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 10px; font-size: 11px; color: var(--gw-text-muted);
  background: var(--gw-neutral-800); border-top: 1px solid var(--gw-card-border);
}
.spin { display: inline-block; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.btn-ghost { background: none; border: 1px solid var(--gw-card-border); color: var(--gw-text-muted); padding: 8px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; }
.btn-primary { background: var(--gw-green-500); color: #fff; border: none; padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-sm { font-size: 13px; padding: 6px 14px; }
</style>
