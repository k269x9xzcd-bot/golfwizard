import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'
import { supaCallWithRetry, supaCall } from '../modules/supabaseOps'
import { supaRawInsert, supaRawRequest } from '../modules/supaRaw'

export const useLinkedMatchesStore = defineStore('linkedMatches', () => {
  // All linked matches visible to this user (ones they created OR ones where
  // they own round_a or round_b).
  const linkedMatches = ref([])
  // The currently-open linked match detail (when viewing the banner/standings)
  const activeLinkedMatch = ref(null)
  // Cached round bundles for the active match (round_a + round_b with members + scores)
  const activeRoundA = ref(null)
  const activeRoundB = ref(null)

  // Realtime subscription handle
  let subscription = null

  async function fetchUserLinkedMatches() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) { linkedMatches.value = []; return }
    try {
      const { data, error } = await supaCallWithRetry(
        'linked_matches.list',
        () => supabase
          .from('linked_matches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        8000,
      )
      if (error) throw error
      linkedMatches.value = data ?? []
    } catch (e) {
      console.warn('[linkedMatches] list failed:', e?.message || e)
    }
  }

  async function fetchByCode(code) {
    if (!code) return null
    try {
      const { data, error } = await supaCallWithRetry(
        'linked_matches.byCode',
        () => supabase
          .from('linked_matches')
          .select('*')
          .eq('invite_code', code.toUpperCase())
          .maybeSingle(),
        8000,
      )
      if (error) throw error
      return data || null
    } catch (e) {
      console.warn('[linkedMatches] byCode failed:', e?.message || e)
      return null
    }
  }

  /**
   * Host creates the linked match. Called AFTER foursome A's round has been
   * created (because we need round_a_id). Returns { match, inviteUrl }.
   */
  async function createLinkedMatch({ name, roundAId, ballsToCount, stake }) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Sign in required to create a linked match.')

    // Generate invite code via the Postgres function. On iOS PWA with a
    // stuck HTTP/2 pool, SJS RPC calls hang — fall back to client-side
    // random code generation as last resort.
    let inviteCode = null
    try {
      const { data: codeData } = await supaCall(
        'rpc.generate_linked_match_code',
        supabase.rpc('generate_linked_match_code'),
        4000,
      )
      inviteCode = codeData
    } catch {
      // Client-side fallback — 6 chars from unambiguous alphabet.
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    }
    if (!inviteCode) throw new Error('Could not generate invite code.')

    const payload = {
      name: name || '4v4 Best Ball',
      created_by: auth.user.id,
      round_a_id: roundAId,
      round_b_id: null,
      match_config: {
        ballsToCount: ballsToCount ?? 1,
        stake: stake ?? 20,
      },
      invite_code: inviteCode,
      status: 'pending',
    }

    // Try SJS with tight 5s budget, then pivot to raw fetch if stuck.
    let data = null
    try {
      const res = await supaCallWithRetry(
        'linked_matches.insert',
        () => supabase.from('linked_matches').insert(payload).select().single(),
        5000,
      )
      if (res.error) throw res.error
      data = res.data
    } catch (e) {
      console.warn('[linkedMatches] SJS insert failed, trying raw fetch:', e?.message)
      try {
        const rows = await supaRawInsert('linked_matches', payload, 10000)
        data = Array.isArray(rows) ? rows[0] : rows
      } catch (rawErr) {
        console.error('[linkedMatches] raw insert also failed:', rawErr)
        throw new Error('Could not create the linked match. Check your connection and try again, or force-quit the app and reopen.')
      }
    }

    if (!data) throw new Error('Linked match creation returned no data.')

    linkedMatches.value = [data, ...linkedMatches.value]
    return {
      match: data,
      inviteUrl: buildInviteUrl(data.invite_code),
    }
  }

  /**
   * Invitee accepts: bind round_b_id + flip status to 'linked'.
   * Called after the invitee's wizard finishes creating their foursome's round.
   */
  async function acceptLinkedMatch(inviteCode, roundBId) {
    const { data, error } = await supaCallWithRetry(
      'linked_matches.accept',
      () => supabase
        .from('linked_matches')
        .update({
          round_b_id: roundBId,
          status: 'linked',
          linked_at: new Date().toISOString(),
        })
        .eq('invite_code', inviteCode)
        .is('round_b_id', null) // guard: only accept if not already linked
        .select()
        .single(),
      8000,
    )
    if (error) throw error
    // Patch local list
    const idx = linkedMatches.value.findIndex(m => m.id === data.id)
    if (idx >= 0) linkedMatches.value[idx] = data
    else linkedMatches.value = [data, ...linkedMatches.value]
    return data
  }

  async function cancelLinkedMatch(id) {
    const { error } = await supaCallWithRetry(
      'linked_matches.cancel',
      () => supabase.from('linked_matches').update({ status: 'cancelled' }).eq('id', id),
      8000,
    )
    if (error) throw error
    linkedMatches.value = linkedMatches.value.map(m => m.id === id ? { ...m, status: 'cancelled' } : m)
  }

  /**
   * Load the full payload for a linked match: match + round A + round B (if exists),
   * each with members + scores. Used by the standings detail view.
   */
  async function loadLinkedMatchDetail(matchId) {
    // Try SJS first, fall back to raw fetch (iOS connection pool may be stuck)
    let match = null
    try {
      const res = await supaCallWithRetry(
        'linked_matches.byId',
        () => supabase.from('linked_matches').select('*').eq('id', matchId).maybeSingle(),
        5000,
      )
      match = res.data
      if (res.error) throw res.error
    } catch (e) {
      console.warn('[linkedMatches] SJS byId failed, trying raw fetch:', e?.message)
      try {
        const rows = await supaRawRequest('GET', `linked_matches?id=eq.${matchId}&select=*&limit=1`, null, 8000)
        match = Array.isArray(rows) ? rows[0] : rows
      } catch (rawErr) {
        console.error('[linkedMatches] raw byId also failed:', rawErr)
        throw new Error('Could not load match details. Check your connection.')
      }
    }
    if (!match) return null

    const [roundA, roundB] = await Promise.all([
      _loadRoundBundle(match.round_a_id),
      match.round_b_id ? _loadRoundBundle(match.round_b_id) : Promise.resolve(null),
    ])

    activeLinkedMatch.value = match
    activeRoundA.value = roundA
    activeRoundB.value = roundB
    return { match, roundA, roundB }
  }

  async function _loadRoundBundle(roundId) {
    if (!roundId) return null
    try {
      const { data, error } = await supaCallWithRetry(
        `linkedMatch.loadRound(${roundId.slice(0, 8)})`,
        () => supabase
          .from('rounds')
          .select('*, round_members(*), scores(*)')
          .eq('id', roundId)
          .maybeSingle(),
        5000,
      )
      if (error) throw error
      if (data) return data
    } catch (e) {
      console.warn('[linkedMatches] SJS loadRoundBundle failed, trying raw:', e?.message || e)
    }
    // Raw-fetch fallback
    try {
      const [rnd, members, scores] = await Promise.all([
        supaRawRequest('GET', `rounds?id=eq.${roundId}&select=*&limit=1`, null, 8000),
        supaRawRequest('GET', `round_members?round_id=eq.${roundId}&select=*`, null, 8000),
        supaRawRequest('GET', `scores?round_id=eq.${roundId}&select=*`, null, 8000),
      ])
      const round = Array.isArray(rnd) ? rnd[0] : rnd
      if (!round) return null
      round.round_members = Array.isArray(members) ? members : []
      round.scores = Array.isArray(scores) ? scores : []
      return round
    } catch (rawErr) {
      console.warn('[linkedMatches] raw loadRoundBundle also failed:', rawErr)
      return null
    }
  }

  /**
   * Subscribe to realtime updates for a linked match + both rounds' scores.
   * The callback fires whenever any score changes on either round, so the
   * banner / standings can refresh. The store does NOT re-fetch automatically;
   * the caller decides how to refresh (reloadActiveMatchScores() is one way).
   */
  function subscribeLinkedMatch(match, cb) {
    unsubscribeLinkedMatch()
    if (!match) return
    try {
      const roundAFilter = match.round_a_id ? `round_id=eq.${match.round_a_id}` : null
      const roundBFilter = match.round_b_id ? `round_id=eq.${match.round_b_id}` : null

      const channel = supabase.channel(`linked_match:${match.id}`)
      if (roundAFilter) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: roundAFilter }, payload => cb?.('scores-a', payload))
      }
      if (roundBFilter) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: roundBFilter }, payload => cb?.('scores-b', payload))
      }
      channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'linked_matches',
        filter: `id=eq.${match.id}`,
      }, payload => cb?.('linked-match', payload))
      channel.subscribe()
      subscription = channel
    } catch (e) {
      console.warn('[linkedMatches] subscribe failed:', e?.message || e)
    }
  }

  function unsubscribeLinkedMatch() {
    if (subscription) {
      try { supabase.removeChannel(subscription) } catch {}
      subscription = null
    }
  }

  /**
   * Refresh just the scores on both active rounds (cheaper than loadLinkedMatchDetail).
   * Called by the banner / standings in response to realtime events.
   */
  async function reloadActiveMatchScores() {
    const a = activeRoundA.value
    const b = activeRoundB.value
    const ops = []
    if (a?.id) ops.push(_reloadScoresOnly(a))
    if (b?.id) ops.push(_reloadScoresOnly(b))
    await Promise.all(ops)
  }

  async function _reloadScoresOnly(round) {
    try {
      const { data, error } = await supaCallWithRetry(
        `linkedMatch.reloadScores(${round.id.slice(0, 8)})`,
        () => supabase.from('scores').select('*').eq('round_id', round.id),
        6000,
      )
      if (!error && Array.isArray(data)) round.scores = data
    } catch { /* non-fatal */ }
  }

  // ── Derived ──────────────────────────────────────────────────
  // Which linked matches involve a round I currently own?
  const matchesForRound = (roundId) => computed(() =>
    linkedMatches.value.filter(m => m.round_a_id === roundId || m.round_b_id === roundId)
  )

  return {
    linkedMatches, activeLinkedMatch, activeRoundA, activeRoundB,
    fetchUserLinkedMatches, fetchByCode, createLinkedMatch, acceptLinkedMatch,
    cancelLinkedMatch, loadLinkedMatchDetail,
    subscribeLinkedMatch, unsubscribeLinkedMatch, reloadActiveMatchScores,
    matchesForRound,
  }
})

/**
 * Build a share-friendly URL. Hash-history routes through /#/accept/CODE.
 */
export function buildInviteUrl(code) {
  if (typeof window === 'undefined') return `#/accept/${code}`
  const origin = window.location.origin + window.location.pathname.replace(/\/+$/, '')
  return `${origin}#/accept/${code}`
}
