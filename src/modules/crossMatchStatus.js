/**
 * crossMatchStatus — derive cross-match completion + display status from
 * a linked_matches row plus the is_complete flags of its two linked rounds.
 *
 * Backstop for cases where the realtime persistence in linkedMatches.store
 * (`_checkAndPersistSettlement`) didn't fire — both rounds might be
 * is_complete=true while linked_matches.status is still 'linked'. The UI
 * should still surface "Final / complete" based on the actual round state.
 */

export function isCrossMatchComplete(match) {
  if (!match) return false
  if (match.status === 'complete') return true
  return match._bothRoundsComplete === true
}

export function crossMatchDisplayStatus(match) {
  if (!match) return ''
  if (match.status === 'cancelled') return 'cancelled'
  return isCrossMatchComplete(match) ? 'complete' : 'linked'
}
