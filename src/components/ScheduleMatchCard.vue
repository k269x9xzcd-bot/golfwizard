<template>
  <div
    class="smc"
    :class="['smc--' + state, completeness === 'partial' ? 'smc--scoring' : '']"
    @click="onTap"
  >
    <!-- Header row: teams + date/status -->
    <div class="smc-head">
      <div class="smc-teams">
        <span class="smc-team" :style="{ color: t1.color }">{{ t1.short || t1.name }}</span>
        <span class="smc-vs">vs</span>
        <span class="smc-team" :style="{ color: t2.color }">{{ t2.short || t2.name }}</span>
      </div>
      <div class="smc-meta">
        <span v-if="state === 'final'" class="smc-meta-badge smc-meta-badge--final">Final</span>
        <span v-else-if="state === 'in-progress'" class="smc-meta-thru">Thru {{ live?.thru ?? 0 }}</span>
        <span class="smc-meta-date">{{ dateAndDays(round.deadline) }}</span>
      </div>
    </div>

    <!-- ─── FINAL STATE ──────────────────────────────────────── -->
    <template v-if="state === 'final'">
      <div class="smc-headline">
        <span class="smc-headline-winner" :style="{ color: winnerColor || undefined }">
          {{ headlineFinal }}
        </span>
        <span v-if="settlement" class="smc-headline-money">· ${{ settlement.total }} to {{ getTeam(settlement.winnerTeamId)?.short || '' }}</span>
      </div>
      <div class="smc-detail-line">
        {{ bbCellLabel(match) }}
        <span class="smc-sep">·</span>
        {{ singlesCellLabel(match, 0) }}
        <span class="smc-sep">·</span>
        {{ singlesCellLabel(match, 1) }}
      </div>
      <div v-for="g in sideGames" :key="g.id" class="smc-side-line">
        <span class="smc-side-icon">{{ g.icon }}</span>{{ g.label }}
      </div>
      <div v-if="crossMatch" class="smc-side-line smc-cross">
        <span class="smc-side-icon">🔗</span>Cross-match · {{ crossMatch.status === 'linked' ? 'linked' : 'awaiting other team' }}
      </div>
    </template>

    <!-- ─── IN PROGRESS STATE ────────────────────────────────── -->
    <template v-else-if="state === 'in-progress'">
      <div v-if="live" class="smc-headline">
        <span class="smc-pulse-dot"></span>
        <span :style="{ color: leadColor || undefined }" class="smc-headline-winner">
          {{ leadingHeadline }}
        </span>
      </div>
      <div v-if="live" class="smc-detail-line">
        <span class="smc-sub-label">BB</span>
        <span :style="{ color: live.bb.leadColor || undefined }">{{ live.bb.label }}</span>
        <template v-for="(s, si) in live.singles" :key="si">
          <span class="smc-sep">·</span>
          <span class="smc-sub-label">1v1</span>
          <span :style="{ color: s.leadColor || undefined }">{{ short1v1Label(s) }}</span>
        </template>
      </div>
      <div v-else class="smc-loading">Loading…</div>
      <div v-if="sideGames.length || crossMatch" class="smc-side-line">
        <span class="smc-side-pre">+</span>
        <template v-for="(g, i) in sideGames" :key="g.id">
          <span v-if="i > 0" class="smc-sep">·</span>{{ g.label }}
        </template>
        <template v-if="crossMatch">
          <span v-if="sideGames.length" class="smc-sep">·</span>Cross-match
        </template>
      </div>
    </template>

    <!-- ─── NOT YET PLAYED STATE ─────────────────────────────── -->
    <template v-else>
      <div class="smc-cta-row">
        <button class="smc-cta-btn" @click.stop="onTap">{{ deadlinePast ? 'Set up round' : 'Schedule' }}</button>
        <button v-if="deadlinePast" class="smc-manual-btn" @click.stop="$emit('manual-entry')">
          Enter results without scoring
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  round:  { type: Object, required: true },
  match:  { type: Object, required: true },
  liveData: { type: Object, default: null },
  liveStatusFn: { type: Function, required: true },
  getTeam: { type: Function, required: true },
  matchPoints: { type: Function, required: true },
  dateAndDays: { type: Function, required: true },
  wagersSettlementFn: { type: Function, required: true },
  bbCellLabel: { type: Function, required: true },
  singlesCellLabel: { type: Function, required: true },
  livePartialPoints: { type: Function, required: true },
  inlineSideGameLabels: { type: Function, required: true },
  inlineCrossMatch: { type: Function, required: true },
  roundCompleteness: { type: Function, required: true },
})
const emit = defineEmits(['open', 'manual-entry'])

const t1 = computed(() => props.getTeam(props.match.team1) || {})
const t2 = computed(() => props.getTeam(props.match.team2) || {})
const completeness = computed(() => props.roundCompleteness(props.match.roundId))

// State drives the entire render: 'final' | 'in-progress' | 'not-yet'
const state = computed(() => {
  if (props.match.result) return 'final'
  if (props.match.roundId && completeness.value !== 'none') return 'in-progress'
  return 'not-yet'
})

const live = computed(() => props.match.roundId ? props.liveStatusFn(props.match.roundId, props.match) : null)
const settlement = computed(() => props.wagersSettlementFn(props.match))
const sideGames = computed(() => props.inlineSideGameLabels(props.match.roundId, props.match))
const crossMatch = computed(() => props.inlineCrossMatch(props.match.roundId))

const headlineFinal = computed(() => {
  const r = props.match.result
  if (!r) return ''
  const { t1pts, t2pts } = props.matchPoints(r)
  if (t1pts > t2pts) return `${t1.value.short || t1.value.name} won ${t1pts}-${t2pts} pts`
  if (t2pts > t1pts) return `${t2.value.short || t2.value.name} won ${t2pts}-${t1pts} pts`
  return `Halved ${t1pts}-${t2pts} pts`
})
const winnerColor = computed(() => {
  const r = props.match.result
  if (!r) return null
  const { t1pts, t2pts } = props.matchPoints(r)
  if (t1pts > t2pts) return t1.value.color
  if (t2pts > t1pts) return t2.value.color
  return null
})

const leadingPts = computed(() => props.livePartialPoints(props.match.roundId, props.match))
const leadingHeadline = computed(() => {
  const lp = leadingPts.value
  if (!lp) return 'Tied — no points yet'
  if (lp.t1 > lp.t2) return `${t1.value.short || t1.value.name} leading ${lp.t1}-${lp.t2} pts`
  if (lp.t2 > lp.t1) return `${t2.value.short || t2.value.name} leading ${lp.t2}-${lp.t1} pts`
  return `Tied ${lp.t1}-${lp.t2} pts`
})
const leadColor = computed(() => {
  const lp = leadingPts.value
  if (!lp) return null
  if (lp.t1 > lp.t2) return t1.value.color
  if (lp.t2 > lp.t1) return t2.value.color
  return null
})

function short1v1Label(s) {
  // s.label looks like "Brian 2 up" / "AS" / "—"
  // Compress to just the trailing state if it's a name+digit, keep as-is otherwise.
  return s.label || '—'
}

const deadlinePast = computed(() => {
  if (!props.round?.deadline) return false
  const today = new Date().toISOString().slice(0, 10)
  return props.round.deadline < today
})

function onTap() { emit('open') }
</script>

<style scoped>
.smc {
  background: var(--gw-bg-card, #1e2b22);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color .15s, transform .12s;
  display: flex; flex-direction: column; gap: 6px;
}
.smc:active { transform: scale(.99); }
.smc--final { border-color: rgba(34,160,107,.22); }
.smc--in-progress { border-color: rgba(251,191,36,.28); }
.smc--not-yet { border-color: rgba(255,255,255,.08); }

.smc-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
}
.smc-teams {
  display: flex; align-items: baseline; gap: 8px;
  font-weight: 800; font-size: 14px;
  font-family: var(--gw-font-mono, ui-monospace, monospace);
  letter-spacing: .02em;
}
.smc-team { white-space: nowrap; }
.smc-vs {
  font-size: 11px; font-weight: 700;
  color: rgba(240,237,224,.4);
  text-transform: lowercase;
}
.smc-meta {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; color: rgba(240,237,224,.5);
  white-space: nowrap;
}
.smc-meta-thru {
  font-weight: 800; color: rgba(251,191,36,.85);
  font-family: var(--gw-font-mono, monospace);
  letter-spacing: .04em;
}
.smc-meta-badge {
  font-size: 9px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase;
  padding: 2px 7px; border-radius: 99px;
}
.smc-meta-badge--final {
  background: rgba(34,160,107,.18);
  color: #4ade80;
}
.smc-meta-date { color: rgba(240,237,224,.4); }

/* Headline (winner / leading) */
.smc-headline {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700;
  color: rgba(240,237,224,.85);
}
.smc-headline-winner { font-weight: 800; }
.smc-headline-money {
  font-family: var(--gw-font-mono, monospace);
  color: rgba(240,237,224,.7);
  font-weight: 700;
}

/* Pulse dot for in-progress */
.smc-pulse-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #fbbf24;
  flex-shrink: 0;
  animation: smc-pulse 1.6s ease-in-out infinite;
}
@keyframes smc-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(251,191,36,.6); }
  60%  { box-shadow: 0 0 0 5px rgba(251,191,36,0); }
  100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
}

/* Detail line: BB · 1v1 · 1v1 */
.smc-detail-line {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  padding-left: 12px;
  font-size: 12px; color: rgba(240,237,224,.7);
  font-family: var(--gw-font-mono, monospace);
}
.smc-sub-label {
  font-size: 9px; font-weight: 800; letter-spacing: .06em;
  color: rgba(251,191,36,.7);
  background: rgba(251,191,36,.08);
  padding: 1px 4px; border-radius: 3px;
}
.smc-sep { color: rgba(240,237,224,.25); }

/* Side game / cross-match lines */
.smc-side-line {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  padding-left: 12px;
  font-size: 11px; color: rgba(240,237,224,.55);
}
.smc-side-pre {
  color: rgba(240,237,224,.4);
  font-weight: 800;
  margin-right: 2px;
}
.smc-side-icon { font-size: 11px; }

/* Loading state */
.smc-loading {
  font-size: 11px; color: rgba(240,237,224,.35);
  font-style: italic;
  padding-left: 12px;
}

/* Not-yet CTAs */
.smc-cta-row {
  display: flex; gap: 8px; margin-top: 4px;
  align-items: center;
}
.smc-cta-btn {
  background: var(--gw-accent-soft, rgba(74,222,128,.12));
  border: 1px solid rgba(74,222,128,.3);
  color: #4ade80;
  font-weight: 800;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  font-family: inherit;
}
.smc-cta-btn:active { transform: translateY(1px); }
.smc-manual-btn {
  background: none;
  border: none;
  color: rgba(240,237,224,.45);
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
  font-family: inherit;
  padding: 4px 6px;
}
.smc-cross { color: rgba(99,179,237,.7); }
</style>
