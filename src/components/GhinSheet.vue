<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ghin-sheet-backdrop" @click.self="$emit('update:modelValue', false)">
      <div class="ghin-sheet-panel">
        <div class="ghin-sheet-handle"></div>

        <!-- ── Hero header (green gradient) ── -->
        <div class="ghin-hero-header">
          <button class="ghin-close-btn" @click="$emit('update:modelValue', false)">✕</button>

          <div class="ghin-header-identity">
            <!-- Club logo -->
            <div class="ghin-club-logo-wrap">
              <img v-if="isBonnieBriar" :src="bbLogo" class="ghin-club-logo" alt="BB" />
              <span v-else class="ghin-club-icon">⛳</span>
            </div>

            <!-- Name + GHIN -->
            <div class="ghin-header-name-block">
              <div class="ghin-header-name">{{ player?.name }}</div>
              <div class="ghin-header-sub">
                <span v-if="player?.ghin_number">GHIN #{{ player.ghin_number }}</span>
                <span v-if="player?.club_name" class="ghin-header-club"> · {{ player.club_name }}</span>
              </div>
            </div>

            <!-- HI badge top-right -->
            <div class="ghin-hi-badge">
              <div class="ghin-hi-num">{{ liveHI ?? (player?.ghin_index != null ? Number(player.ghin_index).toFixed(1) : '—') }}</div>
              <div class="ghin-hi-label">
                HI
                <span v-if="scoresFetched" class="ghin-hi-trend" :class="'trend-' + computedTrend">
                  {{ computedTrend === 'improving' ? '↓' : computedTrend === 'declining' ? '↑' : '→' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Sparkline (last 10 score differentials) -->
          <div v-if="sparkBars.length" class="ghin-spark-row">
            <div class="ghin-spark-label">Last {{ sparkBars.length }} rounds · differential</div>
            <div class="ghin-spark-bars">
              <div
                v-for="(bar, i) in sparkBars"
                :key="i"
                class="ghin-spark-bar"
                :class="{ 'ghin-spark-bar--latest': bar.isLatest }"
                :style="{ height: bar.pct + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- ── Stats pills (4-up) ── -->
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
          <div class="ghin-stat">
            <div class="ghin-stat-label">Used / Total</div>
            <div class="ghin-stat-val" style="font-size:15px;">
              {{ scores.filter(s => s.used_for_hi).length }}<span style="font-size:11px;color:var(--gw-text-muted)">/{{ scores.length || (player?.ghin_scores_posted ?? '—') }}</span>
            </div>
            <div class="ghin-stat-sub">HI rounds</div>
          </div>
        </div>

        <!-- ── Glossy scoring bar (birdie/par/bogey) ── -->
        <div v-if="aggStats?.avg_birdies_pct != null" class="ghin-scoring-section">
          <div class="ghin-scoring-labels">
            <span class="ghin-scoring-lbl" style="color:var(--gw-birdie)">{{ Math.round((aggStats.avg_birdies_pct ?? 0) * 100) }}% Birdie</span>
            <span class="ghin-scoring-lbl">{{ Math.round((aggStats.avg_pars_pct ?? 0) * 100) }}% Par</span>
            <span class="ghin-scoring-lbl" style="color:#f87171">{{ Math.round(((aggStats.avg_bogeys_pct ?? 0) + (aggStats.avg_doubles_pct ?? 0) + (aggStats.avg_worse_pct ?? 0)) * 100) }}% Bogey+</span>
            <span class="ghin-scoring-lbl" style="color:var(--gw-text-muted)">{{ Math.round((aggStats.avg_gir_pct ?? 0) * 100) }}% GIR</span>
          </div>
          <div class="ghin-scoring-bar-wrap">
            <div class="ghin-scoring-bar">
              <div class="ghin-bar-seg ghin-bar-seg--birdie" :style="{ width: Math.round((aggStats.avg_birdies_pct ?? 0) * 100) + '%' }">
                <div class="ghin-bar-gloss"></div>
              </div>
              <div class="ghin-bar-seg ghin-bar-seg--par" :style="{ width: Math.round((aggStats.avg_pars_pct ?? 0) * 100) + '%' }">
                <div class="ghin-bar-gloss"></div>
              </div>
              <div class="ghin-bar-seg ghin-bar-seg--bogey" :style="{ width: Math.round((aggStats.avg_bogeys_pct ?? 0) * 100) + '%' }">
                <div class="ghin-bar-gloss"></div>
              </div>
              <div class="ghin-bar-seg ghin-bar-seg--double" :style="{ width: Math.round(((aggStats.avg_doubles_pct ?? 0) + (aggStats.avg_worse_pct ?? 0)) * 100) + '%' }">
                <div class="ghin-bar-gloss"></div>
              </div>
              <div class="ghin-bar-overlay"></div>
            </div>
          </div>

          <!-- Par 3/4/5 averages -->
          <div class="ghin-par-grid">
            <div class="ghin-par-cell">
              <div class="ghin-par-val">{{ aggStats.avg_par3 != null ? Number(aggStats.avg_par3).toFixed(2) : '—' }}</div>
              <div class="ghin-par-label">Par 3</div>
            </div>
            <div class="ghin-par-divider"></div>
            <div class="ghin-par-cell">
              <div class="ghin-par-val">{{ aggStats.avg_par4 != null ? Number(aggStats.avg_par4).toFixed(2) : '—' }}</div>
              <div class="ghin-par-label">Par 4</div>
            </div>
            <div class="ghin-par-divider"></div>
            <div class="ghin-par-cell">
              <div class="ghin-par-val">{{ aggStats.avg_par5 != null ? Number(aggStats.avg_par5).toFixed(2) : '—' }}</div>
              <div class="ghin-par-label">Par 5</div>
            </div>
          </div>
        </div>

        <!-- ── Score range strip ── -->
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
            <span class="ghin-range-label">Trend</span>
            <span class="ghin-range-val" :class="'trend-' + computedTrend">
              {{ computedTrend === 'improving' ? '↓ Impr' : computedTrend === 'declining' ? '↑ Rising' : '→ Stable' }}
            </span>
          </div>
        </div>

        <!-- ── Cap badges ── -->
        <div v-if="player?.soft_cap === 'true' || player?.hard_cap === 'true'" class="ghin-cap-row">
          <div v-if="player?.hard_cap === 'true'" class="ghin-cap-badge ghin-cap-badge--hard">⚠ Hard Cap Applied</div>
          <div v-else-if="player?.soft_cap === 'true'" class="ghin-cap-badge ghin-cap-badge--soft">Soft Cap Applied</div>
        </div>

        <!-- ── Score history ── -->
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
import { computed } from 'vue'
import bbLogo from '../assets/bonnie-briar-logo.png'

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
  aggStats:   { type: Object, default: null },
  liveHI: { type: String, default: null },
  liveLowHI: { type: String, default: null },
  computedTrend: { type: String, default: 'neutral' },
})
defineEmits(['update:modelValue', 'refresh', 'go-settings'])

const isBonnieBriar = computed(() =>
  props.player?.club_name?.toLowerCase().includes('bonnie briar') ?? false
)

// Sparkline: last 10 differentials, oldest→newest, normalized to 20–95% height
const sparkBars = computed(() => {
  const s = props.scores.slice(0, 10).reverse()
  if (s.length < 2) return []
  const diffs = s.map(r => r.differential ?? 0)
  const mn = Math.min(...diffs)
  const mx = Math.max(...diffs)
  const range = mx - mn || 1
  return diffs.map((d, i) => ({
    pct: 20 + ((d - mn) / range) * 75,
    isLatest: i === diffs.length - 1
  }))
})

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
}
</script>

<style scoped>
/* Backdrop + panel */
.ghin-sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: flex-end; z-index: 200;
}
.ghin-sheet-panel {
  background: var(--gw-neutral-900);
  border-radius: 24px 24px 0 0;
  width: 100%; max-height: 92vh; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  border-top: 1px solid var(--gw-card-border);
  padding-bottom: env(safe-area-inset-bottom);
}
.ghin-sheet-handle {
  width: 36px; height: 4px;
  background: rgba(255,255,255,.15);
  border-radius: 2px; margin: 12px auto 0;
  position: relative; z-index: 1;
}

/* ── Hero header ── */
.ghin-hero-header {
  background: linear-gradient(150deg, #0f3d28 0%, #0c1810 60%, #0a0d0b 100%);
  padding: 0 16px 16px;
  position: relative;
  border-radius: 24px 24px 0 0;
  margin-top: -16px;
  padding-top: 0;
}
.ghin-close-btn {
  position: absolute; top: 14px; right: 16px;
  background: rgba(255,255,255,.1); border: none;
  color: rgba(255,255,255,.6); font-size: 14px;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; -webkit-tap-highlight-color: transparent; z-index: 2;
}
.ghin-header-identity {
  display: flex; align-items: center; gap: 12px;
  padding-top: 52px;
}
.ghin-club-logo-wrap {
  flex-shrink: 0;
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ghin-club-logo { width: 100%; height: 100%; object-fit: cover; }
.ghin-club-icon { font-size: 22px; line-height: 1; }
.ghin-header-name-block { flex: 1; min-width: 0; }
.ghin-header-name {
  font-size: 18px; font-weight: 700; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ghin-header-sub { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 2px; }
.ghin-header-club { color: rgba(255,255,255,.35); }

/* HI badge */
.ghin-hi-badge {
  flex-shrink: 0; text-align: center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 12px; padding: 6px 12px;
  min-width: 62px;
}
.ghin-hi-num {
  font-size: 30px; font-weight: 700; line-height: 1;
  font-family: var(--gw-font-mono); color: #fff;
  letter-spacing: -1px;
  text-shadow: 0 1px 0 rgba(255,255,255,.07), 0 2px 0 rgba(0,0,0,.5), 0 4px 8px rgba(0,0,0,.4);
}
.ghin-hi-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .06em; color: rgba(255,255,255,.45); margin-top: 2px;
}
.ghin-hi-trend { font-size: 11px; margin-left: 3px; }
.trend-improving { color: var(--gw-green-400); font-weight: 600; }
.trend-declining  { color: #f87171; font-weight: 600; }
.trend-neutral    { color: var(--gw-text-muted); }

/* Sparkline */
.ghin-spark-row { margin-top: 14px; }
.ghin-spark-label {
  font-size: 9px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: rgba(255,255,255,.3); margin-bottom: 6px;
}
.ghin-spark-bars {
  display: flex; align-items: flex-end; gap: 3px; height: 32px;
}
.ghin-spark-bar {
  flex: 1; border-radius: 3px 3px 0 0;
  background: rgba(255,255,255,.2);
  min-height: 4px; position: relative;
}
.ghin-spark-bar::after {
  content: ''; position: absolute; inset: 0 0 50% 0;
  background: rgba(255,255,255,.12); border-radius: 3px 3px 0 0;
}
.ghin-spark-bar--latest {
  background: #34c77e;
  box-shadow: 0 0 8px rgba(52,199,126,.5);
}
.ghin-spark-bar--latest::after { background: rgba(255,255,255,.2); }

/* Stats pills 4-up */
.ghin-stats-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 6px; padding: 10px 16px 0;
}
.ghin-stat {
  background: var(--gw-neutral-800); border-radius: 10px;
  border: 1px solid var(--gw-card-border); padding: 9px 8px; text-align: center;
}
.ghin-stat-label {
  font-size: 9px; color: var(--gw-text-muted); font-weight: 600;
  letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 4px;
}
.ghin-stat-val { font-size: 18px; font-weight: 700; color: var(--gw-text); font-family: var(--gw-font-mono); }
.ghin-stat-sub { font-size: 9px; color: var(--gw-text-muted); margin-top: 2px; }

/* Scoring section */
.ghin-scoring-section { margin: 10px 16px 0; }
.ghin-scoring-labels { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.ghin-scoring-lbl { font-size: 10px; font-weight: 600; }

/* Glossy stacked bar */
.ghin-scoring-bar-wrap { position: relative; }
.ghin-scoring-bar {
  display: flex; height: 14px; border-radius: 7px; overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.04);
  background: var(--gw-neutral-800); position: relative;
}
.ghin-bar-seg { position: relative; overflow: hidden; }
.ghin-bar-seg--birdie { background: #22a06b; }
.ghin-bar-seg--par    { background: #4a9eff; }
.ghin-bar-seg--bogey  { background: #f59e0b; }
.ghin-bar-seg--double { background: #ef4444; }
.ghin-bar-gloss {
  position: absolute; top: 0; left: 0; right: 0; height: 5px;
  background: rgba(255,255,255,.22);
}
.ghin-bar-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,.06) 0%, rgba(0,0,0,.12) 100%);
  border-radius: 7px; pointer-events: none;
}

/* Par 3/4/5 grid */
.ghin-par-grid {
  display: flex; align-items: center; justify-content: space-around;
  background: var(--gw-neutral-800); border-radius: 10px;
  border: 1px solid var(--gw-card-border); padding: 8px 16px; margin-top: 8px;
}
.ghin-par-cell { text-align: center; }
.ghin-par-val { font-size: 16px; font-weight: 700; font-family: var(--gw-font-mono); color: var(--gw-text); }
.ghin-par-label { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--gw-text-muted); margin-top: 2px; font-weight: 600; }
.ghin-par-divider { width: 1px; height: 24px; background: var(--gw-card-border); }

/* Score range strip */
.ghin-range-strip {
  display: flex; align-items: center; justify-content: space-around;
  margin: 8px 16px 0; padding: 10px 16px;
  background: var(--gw-neutral-800); border-radius: 10px;
  border: 1px solid var(--gw-card-border);
}
.ghin-range-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ghin-range-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--gw-text-muted); font-weight: 600; }
.ghin-range-val { font-size: 16px; font-weight: 700; font-family: var(--gw-font-mono); color: var(--gw-text); }
.ghin-range-val--low  { color: var(--gw-green-400); }
.ghin-range-val--high { color: #f87171; }
.ghin-range-divider { width: 1px; height: 28px; background: var(--gw-card-border); }

/* Cap badges */
.ghin-cap-row { display: flex; gap: 8px; padding: 8px 16px 0; }
.ghin-cap-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
.ghin-cap-badge--hard { background: rgba(239,68,68,.15); color: #fca5a5; border: 1px solid rgba(239,68,68,.3); }
.ghin-cap-badge--soft { background: rgba(251,191,36,.12); color: #fcd34d; border: 1px solid rgba(251,191,36,.25); }

/* Score history */
.ghin-history-section { margin: 10px 16px 0; }
.ghin-history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ghin-history-title { font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gw-text-muted); }
.ghin-refresh-btn { background: none; border: none; cursor: pointer; color: var(--gw-green-400); font-size: 18px; padding: 4px 6px; border-radius: 6px; -webkit-tap-highlight-color: transparent; }
.ghin-refresh-btn:disabled { opacity: 0.4; }

.ghin-no-creds, .ghin-scores-empty, .ghin-scores-prompt {
  background: var(--gw-neutral-800); border-radius: 12px;
  border: 1px solid var(--gw-card-border); padding: 14px 16px; text-align: center;
}
.ghin-scores-note { font-size: 15px; font-weight: 600; color: var(--gw-text); margin-bottom: 6px; }
.ghin-scores-sub { font-size: 13px; color: var(--gw-text-muted); line-height: 1.5; }
.ghin-scores-loading { display: flex; align-items: center; justify-content: center; padding: 24px 0; }
.ghin-scores-error {
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
  border-radius: 10px; padding: 10px 14px; color: #fca5a5; font-size: 13px;
}

.ghin-scores-list { border-radius: 12px; overflow: hidden; border: 1px solid var(--gw-card-border); }
.ghin-scores-cols {
  display: grid; grid-template-columns: 58px 1fr 36px 36px 52px;
  gap: 4px; padding: 7px 10px;
  background: var(--gw-neutral-800); border-bottom: 1px solid var(--gw-card-border);
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--gw-text-muted);
}
.ghin-score-row {
  display: grid; grid-template-columns: 58px 1fr 36px 36px 52px;
  gap: 4px; align-items: center; padding: 8px 10px;
  border-top: 1px solid var(--gw-card-border); font-size: 13px; color: var(--gw-text);
}
.ghin-score-row--used { background: rgba(34,160,107,0.07); }
.score-date { font-size: 11px; color: var(--gw-text-muted); white-space: nowrap; }
.score-course-wrap { display: flex; flex-direction: column; min-width: 0; }
.score-course { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score-tee { font-size: 10px; color: var(--gw-text-muted); }
.score-ags { font-weight: 700; font-family: var(--gw-font-mono); }
.score-net { font-family: var(--gw-font-mono); font-size: 12px; color: var(--gw-text-muted); }
.score-diff { font-family: var(--gw-font-mono); font-size: 12px; color: var(--gw-text-muted); display: flex; align-items: center; gap: 3px; }
.col-center { text-align: center; }
.col-right  { text-align: right; justify-content: flex-end; }
.diff-used { color: var(--gw-green-400); font-weight: 700; }
.hi-star { color: var(--gw-birdie); font-size: 11px; }
.ghin-scores-legend {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; font-size: 11px; color: var(--gw-text-muted);
  background: var(--gw-neutral-800); border-top: 1px solid var(--gw-card-border);
}

.spin { display: inline-block; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.btn-ghost { background: none; border: 1px solid var(--gw-card-border); color: var(--gw-text-muted); padding: 8px 16px; border-radius: 10px; font-size: 14px; cursor: pointer; }
.btn-primary { background: var(--gw-green-500); color: #fff; border: none; padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-sm { font-size: 13px; padding: 6px 14px; }
</style>
