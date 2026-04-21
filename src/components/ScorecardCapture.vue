<!--
  ScorecardCapture.vue — Print-optimized scorecard for share/recap screenshots.

  Accepts all data as props. No sticky, no overflow, no interaction, no scroll
  containers. Fixed 940px width. Renders the full table in one shot so
  html2canvas needs zero DOM surgery — just captureTarget.scrollHeight.

  Props shape mirrors what scorecardShare.js will pass:
    round       — round object (course_name, date, tee, holesMode)
    members     — array of member objects with id, short_name, ghin_index
    scores      — { [memberId]: { [hole]: score } }
    course      — course object (par[], teesData, SI sources)
    games       — array of game_config objects
    settlement  — computeAllSettlements() result: { summary, playerTotals, ledger }
    gameRows    — buildGameLines() result: [{ icon, label, winnerLine, detail }]
    notationRows — gameNotationRows computed: [{ icon, label, cells, outSummary, inSummary, totalSummary, cls }]
-->
<template>
  <div class="sc-wrap">
    <!-- ── Capture Header ───────────────────────────────────────── -->
    <div class="sc-header">
      <div class="sc-header-left">
        <div class="sc-course">{{ round.course_name }}</div>
        <div class="sc-meta">{{ round.date }} · {{ round.tee }} tees · {{ holesLabel }}</div>
      </div>
      <div class="sc-header-right">⛳ GolfWizard</div>
    </div>

    <!-- ── Scorecard Table ──────────────────────────────────────── -->
    <table class="sc-table">
      <thead>
        <tr class="sc-row-header">
          <th class="sc-th sc-col-player">Player</th>
          <th v-for="h in frontHoles" :key="'h'+h" class="sc-th sc-col-hole">{{ h }}</th>
          <th v-if="hasBack9" class="sc-th sc-col-sub">OUT</th>
          <th v-for="h in backHoles" :key="'h'+h" class="sc-th sc-col-hole">{{ h }}</th>
          <th v-if="hasBack9" class="sc-th sc-col-sub">IN</th>
          <th class="sc-th sc-col-total">G</th>
          <th class="sc-th sc-col-total">N</th>
        </tr>
        <tr class="sc-row-par">
          <td class="sc-td sc-col-player sc-label">Par</td>
          <td v-for="h in frontHoles" :key="'p'+h" class="sc-td sc-col-hole sc-par">{{ parForHole(h) }}</td>
          <td v-if="hasBack9" class="sc-td sc-col-sub sc-par">{{ rangeTotal('par', frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
          <td v-for="h in backHoles" :key="'p'+h" class="sc-td sc-col-hole sc-par">{{ parForHole(h) }}</td>
          <td v-if="hasBack9" class="sc-td sc-col-sub sc-par">{{ rangeTotal('par', backHoles[0], backHoles[backHoles.length-1]) }}</td>
          <td class="sc-td sc-col-total sc-par">{{ rangeTotal('par', allHoles[0], allHoles[allHoles.length-1]) }}</td>
          <td class="sc-td sc-col-total"></td>
        </tr>
        <tr class="sc-row-si">
          <td class="sc-td sc-col-player sc-label">SI</td>
          <td v-for="h in frontHoles" :key="'si'+h" class="sc-td sc-col-hole sc-si">{{ siForHole(h) }}</td>
          <td v-if="hasBack9" class="sc-td sc-col-sub"></td>
          <td v-for="h in backHoles" :key="'si'+h" class="sc-td sc-col-hole sc-si">{{ siForHole(h) }}</td>
          <td v-if="hasBack9" class="sc-td sc-col-sub"></td>
          <td class="sc-td sc-col-total"></td>
          <td class="sc-td sc-col-total"></td>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.id" class="sc-row-player">
          <td class="sc-td sc-col-player sc-player-name">
            <span class="sc-name">{{ member.short_name }}</span>
            <span class="sc-hcp">{{ hcpDisplay(member) }}</span>
          </td>
          <!-- Front 9 -->
          <td v-for="h in frontHoles" :key="'s'+h" class="sc-td sc-col-hole sc-score-cell">
            <span v-if="getScore(member.id, h)" :class="scoreClass(getScore(member.id, h), parForHole(h))">
              {{ getScore(member.id, h) }}
            </span>
            <span v-else class="sc-empty">·</span>
          </td>
          <td v-if="hasBack9" class="sc-td sc-col-sub sc-sub-val">{{ grossRange(member.id, frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
          <!-- Back 9 -->
          <td v-for="h in backHoles" :key="'s'+h" class="sc-td sc-col-hole sc-score-cell">
            <span v-if="getScore(member.id, h)" :class="scoreClass(getScore(member.id, h), parForHole(h))">
              {{ getScore(member.id, h) }}
            </span>
            <span v-else class="sc-empty">·</span>
          </td>
          <td v-if="hasBack9" class="sc-td sc-col-sub sc-sub-val">{{ grossRange(member.id, backHoles[0], backHoles[backHoles.length-1]) }}</td>
          <!-- Totals -->
          <td class="sc-td sc-col-total sc-gross">{{ grossRange(member.id, allHoles[0], allHoles[allHoles.length-1]) }}</td>
          <td class="sc-td sc-col-total sc-net">{{ netRange(member.id, allHoles[0], allHoles[allHoles.length-1]) }}</td>
        </tr>
      </tbody>

      <!-- ── Game notation rows ─────────────────────────────────── -->
      <tfoot v-if="notationRows && notationRows.length > 0">
        <tr v-for="(row, ri) in notationRows" :key="'nr'+ri" class="sc-row-notation" :class="row.cls || ''">
          <td class="sc-td sc-col-player sc-nota-label">
            <span class="sc-nota-icon">{{ row.icon }}</span>
            <span v-if="!row.labelHtml" class="sc-nota-name">{{ row.label }}</span>
            <span v-else class="sc-nota-name" v-html="row.labelHtml"></span>
          </td>
          <td v-for="h in frontHoles" :key="'nr'+ri+h" class="sc-td sc-col-hole sc-nota-cell" :class="row.cells?.[h]?.cls || ''" v-html="row.cells?.[h]?.text || ''"></td>
          <td v-if="hasBack9" class="sc-td sc-col-sub sc-nota-sub" v-html="row.outSummary || ''"></td>
          <td v-for="h in backHoles" :key="'nr'+ri+h" class="sc-td sc-col-hole sc-nota-cell" :class="row.cells?.[h]?.cls || ''" v-html="row.cells?.[h]?.text || ''"></td>
          <td v-if="hasBack9" class="sc-td sc-col-sub sc-nota-sub" v-html="row.inSummary || ''"></td>
          <td class="sc-td sc-col-total sc-nota-total" v-html="row.totalSummary || ''"></td>
          <td class="sc-td sc-col-total"></td>
        </tr>
      </tfoot>
    </table>

    <!-- ── Game Summary ─────────────────────────────────────────── -->
    <div v-if="gameRows && gameRows.length" class="sc-games">
      <div class="sc-games-label">🎲 Games</div>
      <div v-for="(g, gi) in gameRows" :key="'gr'+gi" class="sc-game-row">
        <span class="sc-game-icon">{{ g.icon }}</span>
        <span class="sc-game-label">{{ g.label }}</span>
        <span v-if="g.winnerLine" class="sc-game-winner">⭐ {{ g.winnerLine }}</span>
        <span v-else-if="g.detail" class="sc-game-detail">{{ g.detail }}</span>
      </div>
    </div>

    <!-- ── Settlement Box ───────────────────────────────────────── -->
    <div v-if="settlement && hasSettlement" class="sc-settle">
      <div class="sc-settle-label">💵 Settle Up</div>
      <div class="sc-settle-totals">
        <div
          v-for="(pt, id) in settlement.playerTotals"
          :key="'pt'+id"
          class="sc-settle-player"
          :class="pt.total > 0 ? 'sc-up' : pt.total < 0 ? 'sc-down' : 'sc-even'"
        >
          <span class="sc-settle-name">{{ pt.name }}</span>
          <span class="sc-settle-amount">{{ pt.total > 0 ? '+' : '' }}${{ Math.abs(pt.total).toFixed(0) }}</span>
        </div>
      </div>
      <div v-if="settlement.ledger && settlement.ledger.length" class="sc-ledger">
        <div v-for="(e, ei) in settlement.ledger" :key="'le'+ei" class="sc-ledger-entry">
          <span class="sc-from">{{ e.from_name }}</span>
          <span class="sc-arrow">→</span>
          <span class="sc-to">{{ e.to_name }}</span>
          <span class="sc-pay">${{ e.amount.toFixed(0) }}</span>
        </div>
      </div>
      <div v-else class="sc-settle-even">All square 🤝</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { strokesOnHole, holeSI, memberHandicap } from '../modules/gameEngine'

const props = defineProps({
  round:        { type: Object, required: true },
  members:      { type: Array,  required: true },
  scores:       { type: Object, required: true },   // { memberId: { hole: score } }
  course:       { type: Object, default: null },
  games:        { type: Array,  default: () => [] },
  settlement:   { type: Object, default: null },
  gameRows:     { type: Array,  default: () => [] },
  notationRows: { type: Array,  default: () => [] },
})

// ── Hole ranges ────────────────────────────────────────────────
const holesMode = computed(() => props.round?.holesMode || '18')
const allHoles = computed(() => {
  if (holesMode.value === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1)
  if (holesMode.value === 'back9')  return Array.from({ length: 9 }, (_, i) => i + 10)
  return Array.from({ length: 18 }, (_, i) => i + 1)
})
const frontHoles = computed(() => allHoles.value.filter(h => h <= 9))
const backHoles  = computed(() => allHoles.value.filter(h => h > 9))
const hasBack9   = computed(() => backHoles.value.length > 0 && frontHoles.value.length > 0)
const holesLabel = computed(() => {
  if (holesMode.value === 'front9') return 'Front 9'
  if (holesMode.value === 'back9')  return 'Back 9'
  return '18 holes'
})

// ── Course data helpers ────────────────────────────────────────
function parForHole(hole) {
  return props.course?.par?.[hole - 1] ?? 4
}

function siForHole(hole) {
  return holeSI(props.course, hole, props.round?.tee)
}

function rangeTotal(type, startHole, endHole) {
  let total = 0
  for (let h = startHole; h <= endHole; h++) {
    total += type === 'par' ? parForHole(h) : 0
  }
  return total
}

// ── Score helpers ──────────────────────────────────────────────
function getScore(memberId, hole) {
  return props.scores?.[memberId]?.[hole] ?? null
}

function hcpDisplay(member) {
  const h = memberHandicap(member, props.course, props.round?.tee)
  if (h == null) return ''
  return Math.round(h)
}

function grossRange(memberId, startHole, endHole) {
  let total = 0, count = 0
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s != null) { total += s; count++ }
  }
  return count > 0 ? total : '—'
}

function netRange(memberId, startHole, endHole) {
  const member = props.members.find(m => m.id === memberId)
  if (!member) return '—'
  const hcp = memberHandicap(member, props.course, props.round?.tee)
  let total = 0, count = 0
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s != null) {
      total += s - strokesOnHole(hcp, siForHole(h))
      count++
    }
  }
  return count > 0 ? total : '—'
}

function scoreClass(score, par) {
  if (score == null) return 'sn-empty'
  const diff = score - par
  if (diff <= -3) return 'sn-score sn-alb'
  if (diff === -2) return 'sn-score sn-eagle'
  if (diff === -1) return 'sn-score sn-birdie'
  if (diff === 0)  return 'sn-score sn-par'
  if (diff === 1)  return 'sn-score sn-bogey'
  if (diff === 2)  return 'sn-score sn-dbl'
  return 'sn-score sn-trip'
}

// ── Settlement presence check ──────────────────────────────────
const hasSettlement = computed(() => {
  if (!props.settlement) return false
  const totals = Object.values(props.settlement.playerTotals || {})
  return totals.some(t => t.total !== 0) || (props.settlement.ledger?.length > 0)
})
</script>

<style scoped>
/* ── Wrapper — fixed 940px, white paper background ─────────── */
.sc-wrap {
  width: 940px;
  background: #faf7f0;
  font-family: 'DM Mono', 'Courier New', monospace;
  color: #1a1f1b;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,.25);
}

/* ── Header ─────────────────────────────────────────────────── */
.sc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px 12px;
  background: #faf7f0;
  border-bottom: 2px solid #d4b896;
}
.sc-course {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 22px;
  font-weight: 700;
  color: #9a7a1e;
  line-height: 1.2;
}
.sc-meta {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
  font-family: 'DM Sans', system-ui, sans-serif;
}
.sc-header-right {
  font-size: 14px;
  font-weight: 700;
  color: #166534;
  font-family: 'DM Sans', system-ui, sans-serif;
}

/* ── Table ──────────────────────────────────────────────────── */
.sc-table {
  border-collapse: collapse;
  border-spacing: 0;
  width: 100%;
  font-size: 13px;
  background: #faf7f0;
}
.sc-th, .sc-td {
  border: 1px solid #e2ddd4;
  text-align: center;
  vertical-align: middle;
}
.sc-th {
  font-size: 12px;
  font-weight: 700;
  padding: 6px 4px;
  background: #f0ede0;
  color: #374151;
}

/* Column widths */
.sc-col-player { text-align: left; padding-left: 10px; width: 88px; min-width: 88px; }
.sc-col-hole   { width: 32px; min-width: 28px; }
.sc-col-sub    { width: 36px; background: #e8e4d8; font-weight: 700; }
.sc-col-total  { width: 36px; background: #e8e4d8; font-weight: 700; }

/* Par / SI rows */
.sc-row-par .sc-par { color: #6b7280; font-size: 11px; padding: 3px 2px; }
.sc-row-si .sc-si   { color: #9ca3af; font-size: 10px; padding: 2px; }
.sc-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }

/* Player rows */
.sc-row-player { background: #faf7f0; }
.sc-row-player:nth-child(even) { background: #f5f1e8; }
.sc-player-name { padding: 7px 6px 7px 10px; }
.sc-name { font-size: 13px; font-weight: 700; color: #1a1f1b; display: block; line-height: 1.2; }
.sc-hcp  { font-size: 10px; color: #9ca3af; }

/* Score cells */
.sc-score-cell { padding: 5px 2px; font-size: 14px; font-weight: 700; }
.sc-empty      { color: #d1d5db; font-size: 10px; }
.sc-sub-val    { font-size: 14px; font-weight: 700; background: #eceae0; }
.sc-gross      { font-size: 14px; font-weight: 800; }
.sc-net        { font-size: 14px; font-weight: 800; color: #166534; }

/* Score notation circles — mirrors ScoringView */
.sn-score {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%; font-size: 13px; font-weight: 800;
}
.sn-alb    { background: #f59e0b; color: #fff; border-radius: 4px; }
.sn-eagle  { background: #f59e0b; color: #fff; }
.sn-birdie { background: #22c55e; color: #fff; }
.sn-par    { color: #1a1f1b; }
.sn-bogey  { border: 2px solid #ef4444; color: #ef4444; }
.sn-dbl    { border: 3px double #dc2626; color: #dc2626; }
.sn-trip   { background: #991b1b; color: #fff; }

/* ── Notation rows ──────────────────────────────────────────── */
.sc-row-notation { background: #f0ede0; }
.sc-nota-label   { padding: 4px 6px 4px 10px; text-align: left; }
.sc-nota-icon    { font-size: 11px; margin-right: 3px; }
.sc-nota-name    { font-size: 10px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .3px; }
.sc-nota-cell    { font-size: 11px; font-weight: 700; padding: 3px 2px; }
.sc-nota-sub     { font-size: 11px; font-weight: 700; padding: 3px 4px; }
.sc-nota-total   { font-size: 11px; font-weight: 700; padding: 3px 4px; }

/* Reuse notation color classes from main scorecard */
:deep(.nota-t1)     { color: #166534; }
:deep(.nota-t2)     { color: #dc2626; }
:deep(.nota-halved) { color: #6b7280; }
:deep(.nota-dormie) { font-style: italic; }
:deep(.skins-win)   { color: #22c55e; font-weight: 800; }
:deep(.wolf-pts)    { color: #d97706; }
:deep(.nota-skin)   { color: #22c55e; font-weight: 800; }

/* ── Game summary ───────────────────────────────────────────── */
.sc-games {
  border-top: 2px solid #d4b896;
  padding: 12px 16px;
  background: #faf7f0;
  font-family: 'DM Sans', system-ui, sans-serif;
}
.sc-games-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: #6b7280;
  margin-bottom: 6px;
}
.sc-game-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 0;
  font-size: 13px;
  color: #1a1f1b;
  border-bottom: 1px solid #e8e4d8;
}
.sc-game-row:last-child { border-bottom: none; }
.sc-game-icon   { font-size: 14px; flex-shrink: 0; }
.sc-game-label  { font-weight: 700; color: #374151; flex-shrink: 0; }
.sc-game-winner { color: #166534; font-weight: 600; }
.sc-game-detail { color: #6b7280; font-size: 12px; }

/* ── Settlement ─────────────────────────────────────────────── */
.sc-settle {
  border-top: 2px solid #d4b896;
  padding: 12px 16px 14px;
  background: #f5f1e8;
  font-family: 'DM Sans', system-ui, sans-serif;
}
.sc-settle-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: #6b7280;
  margin-bottom: 8px;
}
.sc-settle-totals {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.sc-settle-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  min-width: 70px;
  border: 1px solid #e2ddd4;
}
.sc-settle-name   { font-size: 11px; color: #6b7280; font-weight: 600; }
.sc-settle-amount { font-size: 16px; font-weight: 800; font-family: 'DM Mono', monospace; }
.sc-up   .sc-settle-amount { color: #166534; }
.sc-down .sc-settle-amount { color: #dc2626; }
.sc-even .sc-settle-amount { color: #6b7280; }

.sc-ledger { display: flex; flex-direction: column; gap: 4px; }
.sc-ledger-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  padding: 4px 0;
}
.sc-from  { font-weight: 700; color: #dc2626; }
.sc-arrow { color: #9ca3af; }
.sc-to    { font-weight: 700; color: #166534; }
.sc-pay   { font-weight: 800; font-family: 'DM Mono', monospace; color: #1a1f1b; margin-left: auto; }
.sc-settle-even { font-size: 14px; color: #166534; font-weight: 600; text-align: center; padding: 6px 0; }
</style>
