/**
 * useCrossMatchSummary — load both rounds for a linked match and compute
 * a compact live summary suitable for the Score tab CROSS-MATCH section.
 *
 * Mirrors the hydration approach used by CrossMatchBanner.vue (SJS query
 * with 5s timeout → raw-fetch fallback for iOS PWA stuck-socket cases).
 * Cached per match id so re-renders don't re-fetch.
 *
 * @param {Ref<Object|null>} linkedMatchRef  Reactive ref to the linked_matches row
 *        (status linked or pending). Returns null summary while either round
 *        is still loading or if the match is null.
 * @returns {{ summary: Ref, loading: Ref<boolean>, error: Ref<string|null> }}
 *
 * Summary shape:
 *   {
 *     match,                     // the linked_matches row
 *     teamA: { name, vsPar, holesFullyScored },
 *     teamB: { name, vsPar, holesFullyScored },
 *     holesBoth,                 // intersection of holes both foursomes have all-4-scored
 *     currentLeader,             // 'A' | 'B' | null
 *     delta,                     // |vsParA - vsParB|
 *     stake,                     // number, $ per player from match_config.stake
 *     allComplete,               // true once both foursomes finish
 *   }
 */
import { ref, watch } from 'vue'
import { computeCrossBestBall } from '../modules/gameEngine'

export function useCrossMatchSummary(linkedMatchRef) {
  const summary = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Cache: matchId → { ra, rb }. Avoid refetch on every render tick.
  const cache = new Map()
  let activeMatchId = null

  async function _fetchRound(roundId) {
    const { supabase } = await import('../supabase')
    const { supaRawSelect } = await import('../modules/supaRaw')
    try {
      const res = await Promise.race([
        supabase.from('rounds').select('*, round_members(*), scores(*)').eq('id', roundId).maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('cross-match hydrate timed out')), 5000)),
      ])
      if (!res.error && res.data) return res.data
    } catch {
      // fall through to raw
    }
    try {
      const rows = await supaRawSelect('rounds', `select=*,round_members(*),scores(*)&id=eq.${roundId}`, 8000)
      return Array.isArray(rows) ? (rows[0] ?? null) : (rows || null)
    } catch (e) {
      return null
    }
  }

  async function _hydrate(match) {
    if (!match?.round_a_id || !match?.round_b_id) {
      summary.value = null
      return
    }
    const cached = cache.get(match.id)
    let ra = cached?.ra
    let rb = cached?.rb
    if (!ra || !rb) {
      loading.value = true
      try {
        const [aData, bData] = await Promise.all([
          _fetchRound(match.round_a_id),
          _fetchRound(match.round_b_id),
        ])
        ra = aData
        rb = bData
        cache.set(match.id, { ra, rb })
      } catch (e) {
        error.value = e?.message || 'load failed'
      } finally {
        loading.value = false
      }
    }
    if (!ra || !rb) {
      summary.value = null
      return
    }
    try {
      const result = computeCrossBestBall(ra, rb, match.match_config || {})
      summary.value = {
        match,
        teamA: {
          name: result.teamA?.name || 'Foursome A',
          vsPar: result.teamA?.vsPar ?? 0,
          holesFullyScored: result.teamA?.holesFullyScored ?? 0,
        },
        teamB: {
          name: result.teamB?.name || 'Foursome B',
          vsPar: result.teamB?.vsPar ?? 0,
          holesFullyScored: result.teamB?.holesFullyScored ?? 0,
        },
        holesBoth: result.holesBoth ?? 0,
        currentLeader: result.currentLeader ?? null,
        delta: Math.abs(result.delta ?? 0),
        stake: Number(match.match_config?.stake) || 0,
        allComplete: !!result.allHolesComplete,
      }
    } catch (e) {
      console.warn('[cross-match summary] compute failed:', e)
      summary.value = null
    }
  }

  watch(
    () => linkedMatchRef.value?.id,
    async (id) => {
      if (id === activeMatchId) return
      activeMatchId = id || null
      if (!id) {
        summary.value = null
        return
      }
      await _hydrate(linkedMatchRef.value)
    },
    { immediate: true }
  )

  // Re-hydrate when the active local round's scores change (Pinia state).
  // Note: we don't subscribe to realtime here — CrossMatchBanner already owns
  // the single-channel subscription. The summary refreshes on next mount.
  return { summary, loading, error, refresh: () => {
    if (activeMatchId) {
      cache.delete(activeMatchId)
      if (linkedMatchRef.value) _hydrate(linkedMatchRef.value)
    }
  } }
}
