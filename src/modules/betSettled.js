/**
 * betSettled — pure helpers for "is this bet's $ outcome mathematically certain?"
 *
 * Rule (Jason, 2026-05-08): never display $ until the bet is mathematically decided.
 * "Decided" = segment fully played OR leader is up by more than holes remaining
 * (closed out / dormie+1). Status text like "AS thru 9", "U2 thru 14", "DORMIE"
 * is fine — dollar figures must be settled.
 */

/**
 * Generic match/segment settlement check.
 *
 * @param {number} holesPlayed  number of holes scored within the segment
 * @param {number} totalHoles   length of the segment (e.g., 9 for nassau front, 18 for full match)
 * @param {number} finalUp      current lead, signed (positive = team1/p1 leading)
 * @returns {boolean}           true when the $ outcome is mathematically certain
 */
export function isSettled(holesPlayed, totalHoles, finalUp) {
  if (holesPlayed >= totalHoles) return true
  const remaining = totalHoles - holesPlayed
  return Math.abs(finalUp || 0) > remaining
}

/**
 * Per-bet settlement for a Nassau segment bet (main or press).
 * holeResults: nassau-engine segment.holeResults array. start: hole the bet starts on.
 */
export function nassauBetSettled(holeResults, start, score) {
  if (!Array.isArray(holeResults)) return false
  const inBet = holeResults.filter(hr => hr.hole >= start)
  const total = inBet.length
  const played = inBet.filter(hr => hr.n1 != null && hr.n2 != null).length
  return isSettled(played, total, score)
}

/**
 * Skins: a hole's $ is locked when there's no possibility of carry forward
 * affecting that hole's payout. A hole with a clear winner where no later
 * carry can claw the pot back IS locked the moment the hole resolves.
 * A halved hole's pot rolls to the next hole; that pot stays in flight until
 * either (a) some later hole locks the carry as a winner, or (b) the round
 * ends with the carry unclaimed (carry dies — already final).
 *
 * For a given hole-result entry { winner, hole } from computeSkins:
 *   - winner != null → that hole's $ is settled the instant the engine returns it.
 *     (computeSkins already includes the carry-forward in `pot`.)
 *   - winner == null with carry → not yet settled until either the carry is
 *     claimed downstream or the round ends.
 */
export function skinsHoleSettled(hr, allHoleResults, totalHoles) {
  if (!hr || hr.winner == null) return false
  // Winner hole is settled — the pot reflects all prior carries that resolved here.
  return true
}

/**
 * Skins carry-pot settlement: an unclaimed carry at the end of the round
 * is "settled" (carry dies; no $ awarded). Mid-round it is not settled.
 */
export function skinsCarrySettled(allHoleResults, totalHoles) {
  if (!Array.isArray(allHoleResults)) return false
  const playedCount = allHoleResults.filter(hr => hr.n1 != null && hr.n2 != null
    || hr.winner !== undefined).length  // computeSkins emits incomplete with reason
  return playedCount >= totalHoles
}

/**
 * 14 Holes settlement: $ settled only when all 18 holes are scored for all
 * players (isComplete from computeFourteen). No early-clinch possible.
 */
export function fourteenSettled(result) {
  return result?.isComplete === true
}
