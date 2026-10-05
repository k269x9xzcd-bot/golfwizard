/**
 * scoreQueue — pure helpers for the offline score-sync queue.
 *
 * Queue entries are upsert payloads keyed by (round_id, member_id, hole).
 * They get retried on `online` events and on score-edit retries. Two failure
 * modes can stick forever without intervention:
 *
 *   1. Orphan member_id — entry was queued before round_members existed, so
 *      member_id is a client-generated UUID that doesn't match any server
 *      row. Every retry returns a 409 / FK-violation. Reconcile against the
 *      loaded round's actual member ids and drop these on round load.
 *
 *   2. Repeated transient failures — keep a per-entry attempt counter for
 *      logging only. Transient (network) failures are NEVER dropped: a dropped
 *      entry is a lost score (Bonnie Briar 2026-10-04, Shpiz hole 5). Only
 *      unrecoverable errors (FK/409 member_id) are dropped.
 *
 * Pure / no I/O — caller owns localStorage + console.warn.
 */

export const MAX_ATTEMPTS = 3

/**
 * True when this error means the entry will never succeed and should be
 * dropped from the queue immediately. Covers Postgres FK violations
 * (code 23503), HTTP 409 conflicts whose body references member_id, and
 * 400s with member_id in the message.
 */
export function isUnrecoverableError(err) {
  if (!err) return false
  const code = err.code || err.detail?.code
  if (code === '23503') return true  // foreign_key_violation
  const status = err.status
  const msg = (err.message || err.detail?.message || '').toLowerCase()
  if (status === 409 && msg.includes('member_id')) return true
  if (status === 400 && msg.includes('member_id')) return true
  if (msg.includes('foreign key') && msg.includes('member')) return true
  return false
}

/** Returns entry with incremented _attempts counter (immutable). */
export function markAttempt(entry) {
  return { ...entry, _attempts: (entry?._attempts || 0) + 1 }
}

/** True when the entry has hit the retry cap and should be dropped. */
export function shouldDropForRetries(entry) {
  return (entry?._attempts || 0) >= MAX_ATTEMPTS
}

/**
 * Drop queue items for `roundId` whose member_id isn't in the round's
 * current member roster. Items for OTHER rounds pass through untouched —
 * we only know the valid member set for the round being loaded.
 *
 * @param {Array} queue
 * @param {Array<string>} validMemberIds  ids from roundsStore.activeMembers
 * @param {string} roundId
 * @returns {{ kept: Array, dropped: Array }}
 */
export function reconcileQueueAgainstMembers(queue, validMemberIds, roundId) {
  if (!Array.isArray(queue)) return { kept: [], dropped: [] }
  if (!roundId) return { kept: queue, dropped: [] }
  const validSet = new Set(validMemberIds || [])
  const kept = []
  const dropped = []
  for (const entry of queue) {
    if (entry?.round_id === roundId && entry?.member_id && !validSet.has(entry.member_id)) {
      dropped.push(entry)
    } else {
      kept.push(entry)
    }
  }
  return { kept, dropped }
}

/**
 * Local scores the server doesn't have (or has an older value for).
 * Used by completeRound so a score that silently failed to sync — but is
 * still on this device — gets pushed before the round is settled.
 *
 * Only pushes when the server row is MISSING, or when this device's own
 * entry is newer than the server's (so we never clobber a later edit made
 * from another phone).
 *
 * @param {Object} localScores  { [memberId]: { [hole]: score } }
 * @param {Object} localMeta    { [memberId]: { [hole]: { entered_by, entered_at } } }
 * @param {Array}  serverRows   [{ member_id, hole, score, entered_at }]
 * @param {Array<string>} validMemberIds
 * @returns {Array} payload entries { member_id, hole, score, entered_by, entered_at }
 */
export function findUnsyncedScores(localScores, localMeta, serverRows, validMemberIds) {
  const out = []
  if (!localScores) return out
  const valid = new Set(validMemberIds || Object.keys(localScores))
  const server = new Map()
  for (const r of (serverRows || [])) server.set(`${r.member_id}|${Number(r.hole)}`, r)
  for (const [memberId, holes] of Object.entries(localScores)) {
    if (!valid.has(memberId) || !holes) continue
    for (const [h, score] of Object.entries(holes)) {
      if (score == null || score === '' || Number.isNaN(Number(score))) continue
      const hole = Number(h)
      const meta = localMeta?.[memberId]?.[hole] || localMeta?.[memberId]?.[h] || {}
      const srv = server.get(`${memberId}|${hole}`)
      const localAt = meta.entered_at ? Date.parse(meta.entered_at) : NaN
      const srvAt = srv?.entered_at ? Date.parse(srv.entered_at) : NaN
      const missing = !srv
      const newerLocal = srv && Number(srv.score) !== Number(score) && !Number.isNaN(localAt) && (Number.isNaN(srvAt) || localAt > srvAt)
      if (missing || newerLocal) {
        out.push({
          member_id: memberId,
          hole,
          score: Number(score),
          entered_by: meta.entered_by ?? null,
          entered_at: meta.entered_at ?? new Date().toISOString(),
        })
      }
    }
  }
  return out
}
