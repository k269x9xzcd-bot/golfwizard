/**
 * linkedMatch.js — Adapter over computeCrossBestBall for linked-match views.
 *
 * computeLinkedMatch: thin wrapper kept for backward compat with LinkedMatchDetail.vue
 * summarizeLinkedMatch: status label for banners + detail view
 */
import { computeCrossBestBall } from './gameEngine.js'

export function computeLinkedMatch(roundA, roundB, config) {
  return computeCrossBestBall(roundA, roundB, config)
}

/**
 * Format the cross-match status for the banner / detail header.
 * States: 'pending' | 'waiting' | 'live' | 'final' | 'cancelled'
 *
 * @param {object} linkedMatch  - DB row from linked_matches
 * @param {object} roundA       - full round bundle (with round_members, scores)
 * @param {object} roundB       - full round bundle or null
 * @param {object} result       - output of computeLinkedMatch (or null)
 * @param {string} myRoundId    - the round this viewer owns (to say "Your team")
 */
export function summarizeLinkedMatch(linkedMatch, roundA, roundB, result, myRoundId) {
  if (!linkedMatch) return { state: 'pending', label: 'No linked match' }
  if (linkedMatch.status === 'cancelled') return { state: 'cancelled', label: 'Match cancelled' }

  if (!roundB || linkedMatch.status === 'pending') {
    return {
      state: 'pending',
      label: `⛳ Waiting for Foursome B · code ${linkedMatch.invite_code}`,
    }
  }

  if (!result || result.holesBoth === 0) {
    return { state: 'waiting', label: '⛳ 4v4 linked · waiting for both foursomes to tee off' }
  }

  // Determine perspective
  const myTeam = myRoundId
    ? (linkedMatch.round_a_id === myRoundId ? 'A'
      : linkedMatch.round_b_id === myRoundId ? 'B' : null)
    : null

  function teamLabel(team) {
    if (!myTeam) return team === 'A' ? (result.teamA?.name || 'Foursome A') : (result.teamB?.name || 'Foursome B')
    return team === myTeam ? 'Your team' : 'Opponents'
  }

  if (result.allHolesComplete && result.settlement) {
    const s = result.settlement
    if (!s.winner) {
      return { state: 'final', label: '🏆 4v4 final · All square · No payout', tone: 'tie' }
    }
    // Compact label — full description (with "Foursome A/B" prefix) is shown on the detail page
    const totalPot = s.totalPot ? ` · $${s.totalPot} total` : ''
    return {
      state: 'final',
      label: `🏆 4v4 final · ${teamLabel(s.winner)} win${totalPot}`,
      tone: 'win',
    }
  }

  // Live
  const deltaStrokes = Math.abs(result.delta)
  if (result.currentLeader) {
    return {
      state: 'live',
      label: `🎮 4v4 · ${teamLabel(result.currentLeader)} up ${deltaStrokes} thru ${result.holesBoth}`,
      tone: 'live',
    }
  }
  return {
    state: 'live',
    label: `🎮 4v4 · All square thru ${result.holesBoth}`,
    tone: 'live',
  }
}
