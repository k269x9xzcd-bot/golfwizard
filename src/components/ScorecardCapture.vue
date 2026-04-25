<!--
  ScorecardCapture.vue — Print-optimized scorecard for share/recap screenshots.

  Accepts all data as props. No sticky, no overflow, no interaction, no scroll
  containers. Fixed 960px width. Renders the full table in one shot so
  html2canvas needs zero DOM surgery.

  Props:
    round        — { course_name, date, tee, holesMode }
    members      — array of { id, short_name, ghin_index, ... }
    scores       — { [memberId]: { [hole]: score } }
    course       — course object (par[], teesData, SI sources)
    games        — array of game_config objects
    settlement   — computeAllSettlements() result: { summary, playerTotals, ledger }
    gameRows     — [{ icon, label, winnerLine, detail }]  ← plain objects, NOT HTML
    notationRows — [{ icon, label, cells, outSummary, inSummary, totalSummary, cls }]
-->
<template>
  <div class="sc-wrap">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="sc-header">
      <div class="sc-header-left">
        <div class="sc-course">{{ round.course_name }}</div>
        <div class="sc-meta">{{ round.date }} · {{ round.tee }} tees · {{ holesLabel }}</div>
      </div>
      <div class="sc-header-right">⛳ GolfWizard</div>
    </div>

    <!-- ── Scorecard Table ──────────────────────────────────────── -->
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead>
          <!-- Hole number row -->
          <tr class="sc-row-header">
            <th class="sc-th sc-col-player">Player</th>
            <th v-if="hasSettlement" class="sc-th sc-col-settle">$</th>
            <th v-for="h in frontHoles" :key="'fh-'+h" class="sc-th sc-col-hole">{{ h }}</th>
            <th v-if="hasBack9" class="sc-th sc-col-sub">OUT</th>
            <th v-for="h in backHoles" :key="'bh-'+h" class="sc-th sc-col-hole">{{ h }}</th>
            <th v-if="hasBack9" class="sc-th sc-col-sub">IN</th>
            <th class="sc-th sc-col-total">G</th>
            <th class="sc-th sc-col-total">N</th>
          </tr>
          <!-- Par row -->
          <tr class="sc-row-par">
            <td class="sc-td sc-col-player sc-row-label">Par</td>
            <td v-if="hasSettlement" class="sc-td sc-col-settle"></td>
            <td v-for="h in frontHoles" :key="'fp-'+h" class="sc-td sc-col-hole">{{ parForHole(h) }}</td>
            <td v-if="hasBack9" class="sc-td sc-col-sub sc-sub-muted">{{ parRangeTotal(frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
            <td v-for="h in backHoles" :key="'bp-'+h" class="sc-td sc-col-hole">{{ parForHole(h) }}</td>
            <td v-if="hasBack9" class="sc-td sc-col-sub sc-sub-muted">{{ parRangeTotal(backHoles[0], backHoles[backHoles.length-1]) }}</td>
            <td class="sc-td sc-col-total sc-sub-muted">{{ parRangeTotal(allHoles[0], allHoles[allHoles.length-1]) }}</td>
            <td class="sc-td sc-col-total"></td>
          </tr>
          <!-- SI row -->
          <tr class="sc-row-si">
            <td class="sc-td sc-col-player sc-row-label">SI</td>
            <td v-if="hasSettlement" class="sc-td sc-col-settle"></td>
            <td v-for="h in frontHoles" :key="'fsi-'+h" class="sc-td sc-col-hole sc-si-val">{{ siForHole(h) }}</td>
            <td v-if="hasBack9" class="sc-td sc-col-sub"></td>
            <td v-for="h in backHoles" :key="'bsi-'+h" class="sc-td sc-col-hole sc-si-val">{{ siForHole(h) }}</td>
            <td v-if="hasBack9" class="sc-td sc-col-sub"></td>
            <td class="sc-td sc-col-total"></td>
            <td class="sc-td sc-col-total"></td>
          </tr>
        </thead>

        <tbody>
          <tr v-for="member in members" :key="member.id" class="sc-row-player">
            <!-- Player name + hcp -->
            <td class="sc-td sc-col-player sc-player-cell">
              <span class="sc-name">{{ member.short_name }}</span>
              <span v-if="hcpDisplay(member)" class="sc-hcp">{{ hcpDisplay(member) }}</span>
            </td>
            <!-- Settle amount column -->
            <td v-if="hasSettlement" class="sc-td sc-col-settle sc-settle-inline">
              <template v-if="settleTotalFor(member.id) !== null">
                <span :class="settleTotalFor(member.id) > 0 ? 'sc-settle-pos' : settleTotalFor(member.id) < 0 ? 'sc-settle-neg' : 'sc-settle-even'">
                  {{ settleTotalFor(member.id) > 0 ? '+' : '' }}${{ Math.abs(settleTotalFor(member.id)) }}
                </span>
              </template>
            </td>
            <!-- Front 9 -->
            <td
              v-for="h in frontHoles"
              :key="'fs-'+member.id+'-'+h"
              class="sc-td sc-col-hole sc-score-td"
              :class="sixesCellClass(member.id, h)"
            >
              <template v-if="getScore(member.id, h) != null">
                <span :class="scoreClass(getScore(member.id, h), parForHole(h))">{{ getScore(member.id, h) }}</span><span v-if="strokeDotsFor(member.id, h)" class="sc-stroke-dot">{{ '•'.repeat(strokeDotsFor(member.id, h)) }}</span>
              </template>
              <span v-else class="sc-dot">·</span>
            </td>
            <td v-if="hasBack9" class="sc-td sc-col-sub sc-sub-val">
              {{ grossRange(member.id, frontHoles[0], frontHoles[frontHoles.length-1]) }}
            </td>
            <!-- Back 9 -->
            <td
              v-for="h in backHoles"
              :key="'bs-'+member.id+'-'+h"
              class="sc-td sc-col-hole sc-score-td"
              :class="sixesCellClass(member.id, h)"
            >
              <template v-if="getScore(member.id, h) != null">
                <span :class="scoreClass(getScore(member.id, h), parForHole(h))">{{ getScore(member.id, h) }}</span><span v-if="strokeDotsFor(member.id, h)" class="sc-stroke-dot">{{ '•'.repeat(strokeDotsFor(member.id, h)) }}</span>
              </template>
              <span v-else class="sc-dot">·</span>
            </td>
            <td v-if="hasBack9" class="sc-td sc-col-sub sc-sub-val">
              {{ grossRange(member.id, backHoles[0], backHoles[backHoles.length-1]) }}
            </td>
            <!-- Totals -->
            <td class="sc-td sc-col-total sc-gross-val">
              {{ grossRange(member.id, allHoles[0], allHoles[allHoles.length-1]) }}
            </td>
            <td class="sc-td sc-col-total sc-net-val">
              {{ netRange(member.id, allHoles[0], allHoles[allHoles.length-1]) }}
            </td>
          </tr>
        </tbody>

        <!-- ── Game notation rows (Nassau match play, skins, etc.) ── -->
        <tfoot v-if="notationRows && notationRows.length">
          <tr
            v-for="(row, ri) in notationRows"
            :key="'nr-'+ri"
            class="sc-row-notation"
            :class="row.cls || ''"
          >
            <td class="sc-td sc-col-player sc-nota-label">
              <span class="sc-nota-icon">{{ row.icon }}</span>
              <span v-if="!row.labelHtml" class="sc-nota-name">{{ row.label }}</span>
              <span v-else class="sc-nota-name" v-html="row.labelHtml"></span>
            </td>
            <td v-if="hasSettlement" class="sc-td sc-col-settle"></td>
            <td v-for="h in frontHoles" :key="'fn-'+ri+'-'+h" class="sc-td sc-col-hole sc-nota-cell" :class="row.cells?.[h]?.cls || ''" v-html="row.cells?.[h]?.text || ''"></td>
            <td v-if="hasBack9" class="sc-td sc-col-sub sc-nota-sub" v-html="row.outSummary || ''"></td>
            <td v-for="h in backHoles" :key="'bn-'+ri+'-'+h" class="sc-td sc-col-hole sc-nota-cell" :class="row.cells?.[h]?.cls || ''" v-html="row.cells?.[h]?.text || ''"></td>
            <td v-if="hasBack9" class="sc-td sc-col-sub sc-nota-sub" v-html="row.inSummary || ''"></td>
            <td class="sc-td sc-col-total sc-nota-total" v-html="row.totalSummary || ''"></td>
            <td class="sc-td sc-col-total"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- ── Game Results Section ─────────────────────────────────── -->
    <div v-if="gameRows && gameRows.length" class="sc-section sc-games-section">
      <div class="sc-section-title">🎲 Games</div>
      <div class="sc-games-grid">
        <div v-for="(g, gi) in gameRows" :key="'gr-'+gi" class="sc-game-card">
          <div class="sc-game-header">
            <span class="sc-game-icon">{{ g.icon }}</span>
            <span class="sc-game-name">{{ g.label }}</span>
            <span v-if="g.winnerLine" class="sc-game-winner">⭐ {{ g.winnerLine }}</span>
          </div>
          <div v-if="g.detail" class="sc-game-detail">{{ g.detail }}</div>
        </div>
      </div>
    </div>

    <!-- ── Settlement Section ───────────────────────────────────── -->
    <div v-if="hasSettlement" class="sc-section sc-settle-section">
      <div class="sc-section-title">💵 Settle Up</div>

      <!-- Per-player net totals -->
      <div class="sc-settle-row">
        <div
          v-for="(pt, id) in settlement.playerTotals"
          :key="'pt-'+id"
          class="sc-settle-card"
          :class="pt.total > 0 ? 'sc-win' : pt.total < 0 ? 'sc-lose' : 'sc-even'"
        >
          <div class="sc-settle-name">{{ pt.name }}</div>
          <div class="sc-settle-amount">{{ pt.total > 0 ? '+' : '' }}${{ Math.abs(pt.total).toFixed(0) }}</div>
        </div>
      </div>

      <!-- Pairwise transfers -->
      <div v-if="settlement.ledger && settlement.ledger.length" class="sc-ledger">
        <div v-for="(e, ei) in settlement.ledger" :key="'le-'+ei" class="sc-ledger-row">
          <span class="sc-ledger-from">{{ e.from_name }}</span>
          <span class="sc-ledger-arrow"> → </span>
          <span class="sc-ledger-to">{{ e.to_name }}</span>
          <span class="sc-ledger-amount">${{ e.amount.toFixed(0) }}</span>
        </div>
      </div>
      <div v-else class="sc-even-msg">All square 🤝</div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { strokesOnHole, holeSI, memberHandicap } from '../modules/gameEngine'

const props = defineProps({
  round:        { type: Object, required: true },
  members:      { type: Array,  required: true },
  scores:       { type: Object, required: true },
  course:       { type: Object, default: null },
  games:        { type: Array,  default: () => [] },
  settlement:   { type: Object, default: null },
  gameRows:     { type: Array,  default: () => [] },
  notationRows:     { type: Array,  default: () => [] },
  sixesHoleTeamMap: { type: Object, default: () => ({}) },
})

// ── Holes ──────────────────────────────────────────────────────
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

// ── Course ─────────────────────────────────────────────────────
function parForHole(hole) {
  return props.course?.par?.[hole - 1] ?? 4
}
function siForHole(hole) {
  return holeSI(props.course, hole, props.round?.tee)
}
function parRangeTotal(startHole, endHole) {
  if (startHole == null || endHole == null) return ''
  let total = 0
  for (let h = startHole; h <= endHole; h++) total += parForHole(h)
  return total
}

// ── Scores ─────────────────────────────────────────────────────
function getScore(memberId, hole) {
  return props.scores?.[memberId]?.[hole] ?? null
}
function hcpDisplay(member) {
  const h = memberHandicap(member, props.course, props.round?.tee)
  return h != null ? Math.round(h) : ''
}
function grossRange(memberId, startHole, endHole) {
  if (startHole == null || endHole == null) return '—'
  let total = 0, count = 0
  for (let h = startHole; h <= endHole; h++) {
    const s = getScore(memberId, h)
    if (s != null) { total += s; count++ }
  }
  return count > 0 ? total : '—'
}
function netRange(memberId, startHole, endHole) {
  if (startHole == null || endHole == null) return '—'
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
  if (score == null) return ''
  const d = score - par
  if (d <= -3) return 'sn sn-alb'
  if (d === -2) return 'sn sn-eagle'
  if (d === -1) return 'sn sn-birdie'
  if (d === 0)  return 'sn sn-par'
  if (d === 1)  return 'sn sn-bogey'
  if (d === 2)  return 'sn sn-dbl'
  return 'sn sn-trip'
}

// ── Sixes team coloring per player per hole ────────────────────
function sixesCellClass(memberId, hole) {
  const seg = props.sixesHoleTeamMap?.[hole]
  if (!seg) return ''
  if (seg.aIds?.includes(memberId)) return 'six-score-a'
  if (seg.bIds?.includes(memberId)) return 'six-score-b'
  return ''
}

// ── Settlement ─────────────────────────────────────────────────
const hasSettlement = computed(() => {
  if (!props.settlement) return false
  const totals = Object.values(props.settlement.playerTotals || {})
  return totals.some(t => t.total !== 0) || (props.settlement.ledger?.length > 0)
})

// ── Per-member settle total ────────────────────────────────────
function settleTotalFor(memberId) {
  const pt = props.settlement?.playerTotals?.[memberId]
  if (pt == null) return null
  return pt.total ?? 0
}

// ── Stroke dots per member per hole (off low-man) ─────────────
function strokeDotsFor(memberId, hole) {
  const member = props.members.find(m => m.id === memberId)
  if (!member) return 0
  const hcp = memberHandicap(member, props.course, props.round?.tee)
  if (hcp == null) return 0
  const si = siForHole(hole)
  return strokesOnHole(hcp, si)
}
</script>

<style scoped>
/* ── Root wrapper ───────────────────────────────────────────── */
.sc-wrap {
  width: 960px;
  min-width: 960px;
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
  align-items: center;
  padding: 16px 20px 12px;
  background: #faf7f0;
  border-bottom: 2px solid #c8a96e;
}
.sc-course {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 24px;
  font-weight: 700;
  color: #7a5c14;
  line-height: 1.2;
}
.sc-meta {
  font-size: 12px;
  color: #6b7280;
  margin-top: 3px;
  font-family: 'DM Sans', system-ui, sans-serif;
}
.sc-header-right {
  font-size: 14px;
  font-weight: 700;
  color: #166534;
  font-family: 'DM Sans', system-ui, sans-serif;
  white-space: nowrap;
}

/* ── Table wrapper ──────────────────────────────────────────── */
.sc-table-wrap {
  width: 100%;
  overflow: hidden;
}

/* ── Table base ─────────────────────────────────────────────── */
.sc-table {
  border-collapse: collapse;
  border-spacing: 0;
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
  background: #faf7f0;
}
.sc-th, .sc-td {
  border: 1px solid #ddd8cc;
  text-align: center;
  vertical-align: middle;
  padding: 0;
  overflow: hidden;
}
.sc-th {
  font-size: 11px;
  font-weight: 700;
  padding: 5px 2px;
  background: #ede8d8;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: .3px;
}

/* Column widths — fixed layout, must sum to ~960px */
.sc-col-player { width: 80px; text-align: left; }
.sc-col-settle { width: 44px; background: #edf5ee; border-left: 2px solid #bbdfc0 !important; }
.sc-col-hole   { width: 36px; }
.sc-col-sub    { width: 38px; background: #e4dfc8; font-weight: 700; }
.sc-col-total  { width: 38px; background: #e4dfc8; font-weight: 700; }

/* Inline settle cell */
.sc-settle-inline { text-align: center; padding: 2px 1px; }
.sc-settle-pos { font-size: 10px; font-weight: 800; color: #166534; display: block; line-height: 1.2; }
.sc-settle-neg { font-size: 10px; font-weight: 800; color: #dc2626; display: block; line-height: 1.2; }
.sc-settle-even { font-size: 10px; font-weight: 600; color: #9ca3af; display: block; }

/* Stroke dots */
.sc-stroke-dot { font-size: 7px; color: #f59e0b; vertical-align: super; line-height: 0; margin-left: 1px; }

/* Par row */
.sc-row-par .sc-td {
  font-size: 11px;
  color: #6b7280;
  padding: 3px 2px;
  background: #f5f0e4;
}
.sc-row-label {
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: .3px;
  padding-left: 6px !important;
  text-align: left !important;
}
.sc-sub-muted { color: #6b7280; font-weight: 600; font-size: 11px; }

/* SI row */
.sc-row-si .sc-td {
  font-size: 10px;
  color: #b0b8b4;
  padding: 2px 1px;
  background: #f8f5ec;
}
.sc-si-val { color: #9ca3af; }

/* ── Player rows ─────────────────────────────────────────────── */
.sc-row-player { background: #faf7f0; }
.sc-row-player:nth-child(even) { background: #f5f1e8; }

.sc-player-cell {
  padding: 6px 4px 6px 8px;
  text-align: left;
}
.sc-name {
  display: block;
  font-size: 13px;
  font-weight: 800;
  color: #1a1f1b;
  line-height: 1.2;
}
.sc-hcp {
  display: block;
  font-size: 10px;
  color: #9ca3af;
  line-height: 1;
}

/* Score cells */
.sc-score-td {
  padding: 4px 2px;
  height: 36px;
  line-height: 36px;
}
.sc-dot { color: #d1d5db; font-size: 10px; }

/* Score notation circles */
.sn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}
.sn-alb    { background: #f59e0b; color: #fff; border-radius: 4px; }
.sn-eagle  { background: #f59e0b; color: #fff; }
.sn-birdie { background: #16a34a; color: #fff; }
.sn-par    { color: #1a1f1b; background: transparent; }
.sn-bogey  { border: 2px solid #ef4444; color: #ef4444; background: transparent; }
.sn-dbl    { border: 3px double #dc2626; color: #dc2626; background: transparent; }
.sn-trip   { background: #991b1b; color: #fff; }

/* Subtotals + totals */
.sc-sub-val   { font-size: 13px; font-weight: 800; color: #374151; }
.sc-gross-val { font-size: 14px; font-weight: 900; color: #1a1f1b; }
.sc-net-val   { font-size: 14px; font-weight: 900; color: #166534; }

/* ── Notation rows ───────────────────────────────────────────── */
.sc-row-notation { background: #ede8d8; }
.sc-nota-label {
  padding: 3px 4px 3px 8px;
  text-align: left;
}
.sc-nota-icon { font-size: 11px; margin-right: 2px; }
.sc-nota-name { font-size: 10px; font-weight: 700; color: #374151; letter-spacing: .2px; }
.sc-nota-cell { font-size: 10px; font-weight: 700; padding: 3px 1px; }
.sc-nota-sub  { font-size: 10px; font-weight: 700; padding: 3px 3px; }
.sc-nota-total { font-size: 10px; font-weight: 700; padding: 3px 3px; }

/* Reuse notation color classes from main app */
:deep(.nota-t1)     { color: #166534; }
:deep(.nota-t2)     { color: #dc2626; }
:deep(.nota-halved) { color: #6b7280; }
:deep(.nota-dormie) { font-style: italic; }
:deep(.nota-skin)   { color: #16a34a; font-weight: 800; }
:deep(.skins-win)   { color: #16a34a; font-weight: 800; }

/* ── Section dividers ────────────────────────────────────────── */
.sc-section {
  border-top: 2px solid #c8a96e;
  padding: 14px 18px;
  background: #faf7f0;
  font-family: 'DM Sans', system-ui, sans-serif;
}
.sc-section-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: #9ca3af;
  margin-bottom: 10px;
}

/* ── Games section ───────────────────────────────────────────── */
.sc-games-section { background: #f5f1e8; }
.sc-games-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sc-game-card {
  background: #faf7f0;
  border: 1px solid #ddd8cc;
  border-radius: 8px;
  padding: 8px 12px;
}
.sc-game-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 1.3;
}
.sc-game-icon  { font-size: 15px; flex-shrink: 0; }
.sc-game-name  { font-weight: 800; color: #374151; }
.sc-game-winner { color: #166534; font-weight: 700; margin-left: 4px; }
.sc-game-detail {
  font-size: 12px;
  color: #6b7280;
  margin-top: 3px;
  padding-left: 22px;
  line-height: 1.4;
}

/* ── Settlement section ──────────────────────────────────────── */
.sc-settle-section { background: #f5f1e8; }
.sc-settle-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sc-settle-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: 1px solid #ddd8cc;
  border-radius: 8px;
  padding: 8px 14px;
  min-width: 72px;
}
.sc-settle-name   { font-size: 11px; color: #6b7280; font-weight: 600; font-family: 'DM Mono', monospace; }
.sc-settle-amount { font-size: 20px; font-weight: 900; font-family: 'DM Mono', monospace; line-height: 1.2; }
.sc-win  .sc-settle-amount { color: #166534; }
.sc-lose .sc-settle-amount { color: #dc2626; }
.sc-even .sc-settle-amount { color: #9ca3af; }

.sc-ledger { display: flex; flex-direction: column; gap: 5px; }
.sc-ledger-row {
  display: flex;
  align-items: center;
  font-size: 15px;
  padding: 3px 0;
  border-bottom: 1px solid #ede8d8;
  gap: 6px;
}
.sc-ledger-row:last-child { border-bottom: none; }
.sc-ledger-from   { font-weight: 800; color: #dc2626; min-width: 70px; }
.sc-ledger-arrow  { color: #9ca3af; }
.sc-ledger-to     { font-weight: 800; color: #166534; flex: 1; }
.sc-ledger-amount { font-weight: 900; font-family: 'DM Mono', monospace; font-size: 16px; color: #1a1f1b; }
.sc-even-msg      { font-size: 14px; color: #166534; font-weight: 600; text-align: center; padding: 6px 0; }
</style>
