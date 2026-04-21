/**
 * useScorecardHelpers — course data, hole helpers, score helpers, team styling,
 * initials/display logic, and sorted player groups.
 *
 * Extracted from ScoringView.vue (ADR-003, Phase 3a).
 */
import { computed } from 'vue'
import { useRoundsStore } from '../stores/rounds'
import { useCoursesStore } from '../stores/courses'
import { COURSES } from '../modules/courses'
import {
  memberHandicap as _memberHandicap,
  holeSI, strokesOnHole,
} from '../modules/gameEngine'

export function useScorecardHelpers({ showFullHcp }) {
  const roundsStore = useRoundsStore()
  const coursesStore = useCoursesStore()

  // ── Course data ─────────────────────────────────────────────────
  const courseData = computed(() => {
    if (!roundsStore.activeRound) return null
    const name = roundsStore.activeRound.course_name
    const snap = roundsStore.activeRound.course_snapshot
    if (snap && Array.isArray(snap.par) && snap.par.length) {
      return {
        name: snap.name || name,
        par: snap.par,
        si: snap.si,
        teesData: snap.teesData,
        tees: snap.teesData,
        defaultTee: snap.defaultTee,
        _fromSnapshot: true,
      }
    }
    const fromStore = coursesStore.allCourses?.find(c => c.name === name)
    if (fromStore) return fromStore
    return COURSES[name] || null
  })

  const holesLabel = computed(() => {
    const mode = roundsStore.activeRound?.holes_mode || '18'
    if (mode === 'front9') return 'Front 9'
    if (mode === 'back9') return 'Back 9'
    return '18 Holes'
  })

  const visibleHoles = computed(() => {
    const mode = roundsStore.activeRound?.holes_mode || '18'
    if (mode === 'front9') return Array.from({ length: 9 }, (_, i) => i + 1)
    if (mode === 'back9') return Array.from({ length: 9 }, (_, i) => i + 10)
    return Array.from({ length: 18 }, (_, i) => i + 1)
  })

  const hasBack9 = computed(() => visibleHoles.value.length > 9)
  const frontHoles = computed(() => visibleHoles.value.filter(h => h <= 9))
  const backHoles = computed(() => visibleHoles.value.filter(h => h > 9))

  const hasYardage = computed(() => {
    if (!courseData.value) return false
    const tee = roundsStore.activeRound?.tee
    return !!(courseData.value.teesData?.[tee]?.yardsByHole)
  })

  // ── Hole helpers ────────────────────────────────────────────────
  function parForHole(hole) {
    return courseData.value?.par?.[hole - 1] ?? 4
  }

  function siForHole(hole) {
    return holeSI(courseData.value, hole, roundsStore.activeRound?.tee)
  }

  function yardsForHole(hole) {
    const tee = roundsStore.activeRound?.tee
    return courseData.value?.teesData?.[tee]?.yardsByHole?.[hole - 1] ?? null
  }

  function holeHasData(hole) {
    return roundsStore.activeMembers.some(m => getScore(m.id, hole) !== null)
  }

  // ── Score helpers ───────────────────────────────────────────────
  function getScore(memberId, hole) {
    return roundsStore.activeScores[memberId]?.[hole] ?? null
  }

  function memberHandicapValue(member) {
    return _memberHandicap(member, courseData.value, roundsStore.activeRound?.tee)
  }

  function playerTotal(memberId) {
    let sum = 0; let any = false
    for (const h of visibleHoles.value) {
      const s = getScore(memberId, h)
      if (s != null) { sum += s; any = true }
    }
    return any ? sum : null
  }

  function playerNetTotal(memberId) {
    const member = roundsStore.activeMembers.find(m => m.id === memberId)
    if (!member) return null
    const hcp = memberHandicapValue(member)
    let sum = 0; let any = false
    for (const h of visibleHoles.value) {
      const s = getScore(memberId, h)
      if (s != null) {
        sum += s - strokesOnHole(hcp, holeSI(courseData.value, h, roundsStore.activeRound?.tee))
        any = true
      }
    }
    return any ? sum : null
  }

  function memberHandicapDisplay(member) {
    const h = memberHandicapValue(member)
    if (h == null) return ''
    return Math.round(h)
  }

  function lowManStrokes(member) {
    const members = roundsStore.activeMembers
    if (members.length < 2) return null
    const hcps = members.map(m => memberHandicapValue(m)).filter(h => h != null)
    if (hcps.length < 2) return null
    const lowest = Math.min(...hcps)
    const myHcp = memberHandicapValue(member)
    if (myHcp == null) return null
    return myHcp - lowest
  }

  function memberEffectiveHcp(member) {
    if (showFullHcp.value) return memberHandicapValue(member)
    const lm = lowManStrokes(member)
    return lm != null ? lm : memberHandicapValue(member)
  }

  function netScore(gross, hcp, si) {
    if (gross == null) return null
    return gross - strokesOnHole(hcp, si)
  }

  function strokeDotsOnHole(member, hole) {
    const si = siForHole(hole)
    if (showFullHcp.value) {
      return strokesOnHole(memberHandicapValue(member), si)
    }
    const lm = lowManStrokes(member)
    return lm != null ? strokesOnHole(lm, si) : strokesOnHole(memberHandicapValue(member), si)
  }

  function isNetWinner(memberId, hole) {
    const scores = roundsStore.activeMembers.map(m => {
      const g = getScore(m.id, hole)
      if (g == null) return null
      return { id: m.id, net: netScore(g, memberHandicapValue(m), siForHole(hole)) }
    }).filter(s => s !== null)
    if (scores.length < 2) return false
    const minNet = Math.min(...scores.map(s => s.net))
    const winners = scores.filter(s => s.net === minNet)
    return winners.length === 1 && winners[0].id === memberId
  }

  function scoreNotation(score, par) {
    if (score == null) return 'sn-empty'
    const diff = score - par
    if (diff <= -3) return 'sn-alb'
    if (diff === -2) return 'sn-eagle'
    if (diff === -1) return 'sn-birdie'
    if (diff === 0) return 'sn-par'
    if (diff === 1) return 'sn-bogey'
    if (diff === 2) return 'sn-dbl'
    return 'sn-trip'
  }

  function memberGrossTotal(memberId, startHole, endHole) {
    let total = 0, count = 0
    for (let h = startHole; h <= endHole; h++) {
      const s = getScore(memberId, h)
      if (s !== null) { total += s; count++ }
    }
    return count > 0 ? total : '—'
  }

  function memberNetTotal(memberId, startHole, endHole) {
    let total = 0, count = 0
    const member = roundsStore.activeMembers.find(m => m.id === memberId)
    if (!member) return '—'
    const hcp = memberEffectiveHcp(member)
    for (let h = startHole; h <= endHole; h++) {
      const s = getScore(memberId, h)
      if (s !== null) {
        total += s - strokesOnHole(hcp, siForHole(h))
        count++
      }
    }
    return count > 0 ? total : '—'
  }

  function memberGrossToPar(memberId, startHole, endHole) {
    let total = 0, count = 0
    for (let h = startHole; h <= endHole; h++) {
      const s = getScore(memberId, h)
      if (s !== null) { total += s - parForHole(h); count++ }
    }
    if (count === 0) return 'E'
    if (total === 0) return 'E'
    return total > 0 ? `+${total}` : `${total}`
  }

  function parTotal(startHole, endHole) {
    let t = 0
    for (let h = startHole; h <= endHole; h++) t += parForHole(h)
    return t
  }

  // ── Team styling ────────────────────────────────────────────────
  function teamRowClass(m) { return m.team === 1 ? 'team1-row' : m.team === 2 ? 'team2-row' : '' }
  function teamStickyClass(m) { return m.team === 1 ? 'sticky-t1' : m.team === 2 ? 'sticky-t2' : 'sticky-default' }
  function teamTextClass(m) { return m.team === 1 ? 't1' : m.team === 2 ? 't2' : '' }
  function teamCardClass(m) { return m.team === 1 ? 'card-t1' : m.team === 2 ? 'card-t2' : '' }
  function teamBadgeClass(m) { return m.team === 1 ? 'badge-t1' : m.team === 2 ? 'badge-t2' : 'badge-default' }
  function teamBarClass(m) { return m.team === 1 ? 'bar-t1' : m.team === 2 ? 'bar-t2' : '' }

  // ── Sorted players ───────────────────────────────────────────────
  const sortedPlayerGroups = computed(() => {
    const members = roundsStore.activeMembers
    const t1 = members.filter(m => m.team === 1).map(m => ({ member: m, team: 1 }))
    const t2 = members.filter(m => m.team === 2).map(m => ({ member: m, team: 2 }))
    const noTeam = members.filter(m => !m.team || (m.team !== 1 && m.team !== 2)).map(m => ({ member: m, team: 0 }))
    return [...t1, ...t2, ...noTeam]
  })

  // ── Display / initials ───────────────────────────────────────────
  function nameToInitials(name) {
    if (!name || name === '?') return '??'
    const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    if (parts[0]?.length >= 2) return (parts[0][0] + parts[0][1]).toUpperCase()
    return (parts[0]?.[0] ?? '?').toUpperCase() + '?'
  }

  function memberDisplay(m) {
    if (!m) return '?'
    if (m.use_nickname && m.nickname) return m.nickname
    return m.guest_name || m.name || m.short_name || '?'
  }

  function _baseInitials(m) {
    if (!m) return '??'
    const src = m.guest_name || m.name || m.short_name || ''
    return nameToInitials(src)
  }

  let _initialsCache = { key: null, map: null }
  function _buildInitialsMap() {
    const members = roundsStore.activeMembers || []
    const key = members.map(m => m.id).join('|')
    if (_initialsCache.key === key && _initialsCache.map) return _initialsCache.map
    const map = new Map()
    const base = new Map()
    for (const m of members) base.set(m.id, _baseInitials(m))
    const counts = new Map()
    for (const v of base.values()) counts.set(v, (counts.get(v) || 0) + 1)
    for (const m of members) {
      const b = base.get(m.id)
      if ((counts.get(b) || 0) <= 1) { map.set(m.id, b); continue }
      const full = (m.guest_name || m.name || m.short_name || '').trim()
      const parts = full.replace(/\./g, '').split(/\s+/).filter(Boolean)
      let ext = b
      const word = parts.length >= 2 ? parts[parts.length - 1] : (parts[0] || '')
      for (let extra = 1; extra <= 3 && ext.length < 5; extra++) {
        const candidate = b + (word[extra] || '').toLowerCase()
        const stillCollides = members.some(o => o.id !== m.id && _baseInitials(o) === b && (() => {
          const oFull = (o.guest_name || o.name || o.short_name || '').trim()
          const oParts = oFull.replace(/\./g, '').split(/\s+/).filter(Boolean)
          const oWord = oParts.length >= 2 ? oParts[oParts.length - 1] : (oParts[0] || '')
          const oCandidate = b + (oWord[extra] || '').toLowerCase()
          return oCandidate === candidate
        })())
        ext = candidate
        if (!stillCollides) break
      }
      map.set(m.id, ext)
    }
    _initialsCache = { key, map }
    return map
  }

  function memberGridName(member) {
    if (!member) return '?'
    const map = _buildInitialsMap()
    return map.get(member.id) || _baseInitials(member)
  }

  function memberInitials(m) {
    if (!m) return '??'
    const map = _buildInitialsMap()
    return map.get(m.id) || _baseInitials(m)
  }

  function teamInitialsStr(teamIds) {
    return teamIds.map(id => {
      const m = roundsStore.activeMembers.find(m => m.id === id)
      return memberInitials(m)
    }).join('+')
  }

  function pInit(memberId) {
    const m = roundsStore.activeMembers.find(m => m.id === memberId)
    return memberInitials(m)
  }

  function playerInitials(member) {
    return memberInitials(member)
  }

  return {
    courseData, holesLabel, visibleHoles, hasBack9, frontHoles, backHoles, hasYardage,
    parForHole, siForHole, yardsForHole, holeHasData,
    getScore, memberHandicapValue, playerTotal, playerNetTotal, memberHandicapDisplay,
    lowManStrokes, memberEffectiveHcp, netScore, strokeDotsOnHole,
    isNetWinner, scoreNotation,
    memberGrossTotal, memberNetTotal, memberGrossToPar, parTotal,
    teamRowClass, teamStickyClass, teamTextClass, teamCardClass, teamBadgeClass, teamBarClass,
    sortedPlayerGroups,
    nameToInitials, memberDisplay, memberGridName, memberInitials,
    teamInitialsStr, pInit, playerInitials,
  }
}
