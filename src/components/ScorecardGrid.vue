<template>
  <!-- scorecard-outer matches ScoringView's #gw-capture-target structure exactly -->
  <div class="scorecard-outer" :id="captureId">
    <div class="capture-header">
      <div class="capture-header-left">
        <div class="capture-course">{{ round.course_name }}</div>
        <div class="capture-meta">{{ round.date }} · {{ round.tee }} tees · {{ holesLabel }}</div>
      </div>
      <div class="capture-header-right">⛳ GolfWizard</div>
    </div>
    <div class="scorecard-scroll">
      <table class="scorecard-grid">
        <thead>
          <tr class="row-header">
            <th class="col-sticky col-player-header">Player</th>
            <th v-for="h in frontHoles" :key="h" class="col-hole-num">
              {{ h }}
              <span v-if="pressHoles.has(h)" class="press-badge">P</span>
            </th>
            <th v-if="hasBack9" class="col-subtotal">OUT</th>
            <th v-for="h in backHoles" :key="h" class="col-hole-num">
              {{ h }}
              <span v-if="pressHoles.has(h)" class="press-badge">P</span>
            </th>
            <th v-if="hasBack9" class="col-subtotal">IN</th>
            <th class="col-total">G</th>
            <th class="col-total">N</th>
          </tr>
          <tr class="row-par">
            <td class="col-sticky col-par-label">Par</td>
            <td v-for="h in frontHoles" :key="'p'+h" class="col-par-val">{{ parForHole(h) }}</td>
            <td v-if="hasBack9" class="col-subtotal par-sub">{{ parTotal(frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
            <td v-for="h in backHoles" :key="'p'+h" class="col-par-val">{{ parForHole(h) }}</td>
            <td v-if="hasBack9" class="col-subtotal par-sub">{{ parTotal(backHoles[0], backHoles[backHoles.length-1]) }}</td>
            <td class="col-total par-sub">{{ parTotal(visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
            <td class="col-total"></td>
          </tr>
          <tr class="row-si">
            <td class="col-sticky col-par-label">SI</td>
            <td v-for="h in frontHoles" :key="'si'+h" class="col-si-val">{{ siForHole(h) }}</td>
            <td v-if="hasBack9" class="col-subtotal"></td>
            <td v-for="h in backHoles" :key="'si'+h" class="col-si-val">{{ siForHole(h) }}</td>
            <td v-if="hasBack9" class="col-subtotal"></td>
            <td class="col-total"></td>
            <td class="col-total"></td>
          </tr>
          <tr v-if="hasYardage" class="row-yards">
            <td class="col-sticky col-par-label">Yds</td>
            <td v-for="h in frontHoles" :key="'y'+h" class="col-yards-val">{{ yardsForHole(h) || '' }}</td>
            <td v-if="hasBack9" class="col-subtotal"></td>
            <td v-for="h in backHoles" :key="'y'+h" class="col-yards-val">{{ yardsForHole(h) || '' }}</td>
            <td v-if="hasBack9" class="col-subtotal"></td>
            <td class="col-total"></td>
            <td class="col-total"></td>
          </tr>
        </thead>
        <tbody>
          <template v-for="(group, gi) in sortedPlayerGroups" :key="'grp-'+gi">
            <tr v-if="gi > 0 && group.team !== sortedPlayerGroups[gi-1].team" class="row-team-divider">
              <td :colspan="visibleHoles.length + (hasBack9 ? 6 : 2) + 1" class="team-divider-cell"></td>
            </tr>
            <tr class="row-player" :class="teamRowClass(group.member)">
              <td class="col-sticky col-player-name" :class="teamStickyClass(group.member)">
                <span class="team-color-bar" :class="teamBarClass(group.member)"></span>
                <span class="player-nm" :class="teamTextClass(group.member)">{{ memberGridName(group.member) }}</span>
                <span class="player-hcp">{{ memberHandicapDisplay(group.member) }}<span v-if="lowManStrokes(group.member) !== null" class="hcp-lowman">({{ lowManStrokes(group.member) }})</span></span>
              </td>
              <td
                v-for="h in frontHoles"
                :key="h"
                class="col-score-cell"
                :class="{ 'cell-winner': isNetWinner(group.member.id, h), 'cell-defidget': isFidgetWinner(group.member.id, h) }"
              >
                <span v-if="getScore(group.member.id, h)" :class="scoreNotation(getScore(group.member.id, h), parForHole(h))">{{ getScore(group.member.id, h) }}</span>
                <span v-else class="score-empty-dot">·</span>
                <span v-if="strokeDotsOnHole(group.member, h)" class="stroke-dots">{{ '•'.repeat(strokeDotsOnHole(group.member, h)) }}</span>
              </td>
              <td v-if="hasBack9" class="col-subtotal">{{ memberGrossTotal(group.member.id, frontHoles[0], frontHoles[frontHoles.length-1]) }}</td>
              <td
                v-for="h in backHoles"
                :key="h"
                class="col-score-cell"
                :class="{ 'cell-winner': isNetWinner(group.member.id, h), 'cell-defidget': isFidgetWinner(group.member.id, h) }"
              >
                <span v-if="getScore(group.member.id, h)" :class="scoreNotation(getScore(group.member.id, h), parForHole(h))">{{ getScore(group.member.id, h) }}</span>
                <span v-else class="score-empty-dot">·</span>
                <span v-if="strokeDotsOnHole(group.member, h)" class="stroke-dots">{{ '•'.repeat(strokeDotsOnHole(group.member, h)) }}</span>
              </td>
              <td v-if="hasBack9" class="col-subtotal">{{ memberGrossTotal(group.member.id, backHoles[0], backHoles[backHoles.length-1]) }}</td>
              <td class="col-total col-gross">{{ memberGrossTotal(group.member.id, visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
              <td class="col-total col-net">{{ memberNetTotal(group.member.id, visibleHoles[0], visibleHoles[visibleHoles.length-1]) }}</td>
            </tr>
          </template>
        </tbody>
        <tfoot v-if="gameNotationRows.length > 0">
          <tr v-for="(row, ri) in gameNotationRows" :key="'gn-'+ri" class="row-game-notation" :class="row.cls || ''">
            <td class="col-sticky col-notation-label">
              <span class="notation-icon">{{ row.icon }}</span>
              <span class="notation-name">{{ row.label }}</span>
            </td>
            <td v-for="h in frontHoles" :key="'gn-'+ri+'-'+h" class="col-notation-cell" :class="row.cells[h]?.cls || ''" v-html="row.cells[h]?.text || ''"></td>
            <td v-if="hasBack9" class="col-subtotal col-notation-sub" v-html="row.outSummary || ''"></td>
            <td v-for="h in backHoles" :key="'gn-'+ri+'-'+h" class="col-notation-cell" :class="row.cells[h]?.cls || ''" v-html="row.cells[h]?.text || ''"></td>
            <td v-if="hasBack9" class="col-subtotal col-notation-sub" v-html="row.inSummary || ''"></td>
            <td class="col-total col-notation-total" v-html="row.totalSummary || ''"></td>
            <td class="col-total"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue'
import { useScorecard } from '../composables/useScorecard'

const props = defineProps({
  round: { type: Object, required: true },
  ctx:   { type: Object, required: true },
  captureId: { type: String, default: 'gw-history-capture-target' },
})

const round = toRef(props, 'round')
const ctx   = toRef(props, 'ctx')

const {
  holesLabel, visibleHoles, hasBack9, frontHoles, backHoles, hasYardage,
  pressHoles, sortedPlayerGroups, gameNotationRows,
  parForHole, siForHole, yardsForHole, parTotal,
  getScore, memberHandicapDisplay, lowManStrokes, strokeDotsOnHole,
  isNetWinner, isFidgetWinner, scoreNotation,
  memberGrossTotal, memberNetTotal, memberGridName,
  teamRowClass, teamStickyClass, teamTextClass, teamBarClass,
} = useScorecard(round, ctx)
</script>
