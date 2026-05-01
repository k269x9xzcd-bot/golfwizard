import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'
import { supaCallWithRetry, supaCall } from '../modules/supabaseOps'
import { supaRawInsert, supaRawRequest } from '../modules/supaRaw'
import { computeCrossBestBall } from '../modules/gameEngine'

export const useLinkedMatchesStore = defineStore('linkedMatches', () => {
  const linkedMatches = ref([])
  const activeLinkedMatch = ref(null)
  const activeRoundA = ref(null)
  const activeRoundB = ref(null)

  let subscription = null

  async function fetchUserLinkedMatches() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) { linkedMatches.value = []; return }
    try {
      const { data, error } = await supaCallWithRetry(
        'linked_matches.list',
        () => supabase.from('linked_matches').select('*').order('created_at', { ascending: false }).limit(50),
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
        () => supabase.from('linked_matches').select('*').eq('invite_code', code.toUpperCase()).maybeSingle(),
        8000,
      )
      if (error) throw error
      return data || null
    } catch (e) {
      console.warn('[linkedMatches] byCode failed:', e?.message || e)
      return null
    }
  }

  async function createLinkedMatch({ name, roundAId, ballsToCount, stake, hcpPct, sideBets, courseName, tee, holesMode, courseSnapshot, foursomeBPlayers }) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Sign in required to create a linked match.')

    let inviteCode = null
    try {
      const { data: codeData } = await supaCall('rpc.generate_linked_match_code', supabase.rpc('generate_linked_match_code'), 4000)
      inviteCode = codeData
    } catch {
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
        hcpPct: hcpPct ?? 0.90,
        sideBets: sideBets?.length ? sideBets : null,
        courseName: courseName ?? null,
        tee: tee ?? null,
        holesMode: holesMode ?? '18',
        courseSnapshot: courseSnapshot ?? null,
        foursomeBPlayers: foursomeBPlayers ?? [],
      },
      invite_code: inviteCode,
      status: 'pending',
    }

    let data = null
    try {
      const res = await supaCallWithRetry('linked_matches.insert', () => supabase.from('linked_matches').insert(payload).select().single(), 5000)
      if (res.error) throw res.error
      data = res.data
    } catch (e) {
      console.warn('[linkedMatches] SJS insert failed, trying raw:', e?.message)
      try {
        const rows = await supaRawInsert('linked_matches', payload, 10000)
        data = Array.isArray(rows) ? rows[0] : rows
      } catch (rawErr) {
        throw new Error('Could not create the linked match. Check your connection and try again.')
      }
    }

    if (!data) throw new Error('Linked match creation returned no data.')
    linkedMatches.value = [data, ...linkedMatches.value]
    return { match: data, inviteUrl: buildInviteUrl(data.invite_code) }
  }

  async function acceptLinkedMatch(inviteCode, roundBId) {
    // Pre-check current state — surfaces meaningful error vs. silent .single() fail
    const existing = await fetchByCode(inviteCode)
    if (!existing) {
      throw new Error('Invite code not found. Ask the host to re-share the link.')
    }
    if (existing.status === 'cancelled') {
      throw new Error('This match was cancelled by the host.')
    }
    if (existing.round_b_id && existing.round_b_id !== roundBId) {
      throw new Error('Someone else already accepted this match. Ask the host for a new invite.')
    }
    if (existing.round_b_id === roundBId) {
      return existing  // idempotent — already accepted by this caller
    }

    const { data, error } = await supaCallWithRetry(
      'linked_matches.accept',
      () => supabase
        .from('linked_matches')
        .update({ round_b_id: roundBId, status: 'linked', linked_at: new Date().toISOString() })
        .eq('invite_code', inviteCode)
        .is('round_b_id', null)
        .neq('status', 'cancelled')
        .select()
        .single(),
      8000,
    )
    if (error) {
      if (error.code === 'PGRST116' || (error.message || '').includes('no rows')) {
        throw new Error('Someone else accepted this match in the last second. Ask the host for a new invite.')
      }
      throw error
    }
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

  async function loadLinkedMatchDetail(matchId) {
    let match = null
    try {
      const rows = await supaRawRequest('GET', `linked_matches?id=eq.${matchId}&select=*&limit=1`, null, 5000)
      match = Array.isArray(rows) ? rows[0] : rows
    } catch (e) {
      throw new Error('Could not load match details. Check your connection.')
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

  // Cache: roundId → { data, loadedAt }
  const _bundleCache = new Map()
  const BUNDLE_CACHE_TTL = 30_000

  async function _loadRoundBundle(roundId, { forceRefresh = false } = {}) {
    if (!roundId) return null

    // Return cached bundle if fresh enough
    const cached = _bundleCache.get(roundId)
    if (!forceRefresh && cached && (Date.now() - cached.loadedAt < BUNDLE_CACHE_TTL)) {
      return cached.data
    }

    // Skip SJS embedded join — RLS blocks embedded tables and always returns empty
    // members/scores arrays, so it only wastes 10s before falling through anyway.
    // Go straight to 3 parallel raw fetches.
    try {
      const [rnd, members, scores] = await Promise.all([
        supaRawRequest('GET', `rounds?id=eq.${roundId}&select=*&limit=1`, null, 5000),
        supaRawRequest('GET', `round_members?round_id=eq.${roundId}&select=*`, null, 5000),
        supaRawRequest('GET', `scores?round_id=eq.${roundId}&select=*`, null, 5000),
      ])
      const round = Array.isArray(rnd) ? rnd[0] : rnd
      if (!round) return null
      round.round_members = Array.isArray(members) ? members : []
      round.scores = Array.isArray(scores) ? scores : []
      _bundleCache.set(roundId, { data: round, loadedAt: Date.now() })
      return round
    } catch (rawErr) {
      console.warn('[linkedMatches] _loadRoundBundle failed:', rawErr?.message || rawErr)
      return null
    }
  }

  /**
   * Check if both rounds are complete. If so, compute and persist the settlement.
   * Called when either round's is_complete flips to true via realtime.
   */
  async function _checkAndPersistSettlement(match) {
    if (!match?.round_a_id || !match?.round_b_id) return
    // Note: intentionally allow re-persist for complete matches to overwrite stale settlement_json

    try {
      // Load fresh bundles to get latest is_complete + scores
      const [rA, rB] = await Promise.all([
        _loadRoundBundle(match.round_a_id),
        _loadRoundBundle(match.round_b_id),
      ])
      if (!rA?.is_complete || !rB?.is_complete) return  // not both done yet

      const cfg = match.match_config || {}
      const result = computeCrossBestBall(rA, rB, cfg)
      if (!result.allHolesComplete) return  // shouldn't happen if is_complete is true, but guard anyway

      // Persist settlement as a JSON snapshot on the linked_match row
      const settlementPayload = {
        status: 'complete',
        completed_at: new Date().toISOString(),
        settlement_json: result,
      }

      await supaCallWithRetry(
        'linked_matches.complete',
        () => supabase.from('linked_matches').update(settlementPayload).eq('id', match.id),
        8000,
      )

      // Also write round_settlements rows for each round (captain-to-captain model)
      // round_a gets a record; round_b gets a record — same settlement_json
      const roundSettlements = [
        { round_id: match.round_a_id, settlement_json: result, computed_at: new Date().toISOString() },
        { round_id: match.round_b_id, settlement_json: result, computed_at: new Date().toISOString() },
      ]
      try {
        await supabase.from('round_settlements').upsert(roundSettlements, { onConflict: 'round_id' })
      } catch (e) {
        console.warn('[linkedMatches] round_settlements upsert failed (non-fatal):', e?.message)
      }

      // Patch local state
      if (activeLinkedMatch.value?.id === match.id) {
        activeLinkedMatch.value = { ...activeLinkedMatch.value, ...settlementPayload }
      }
      linkedMatches.value = linkedMatches.value.map(m =>
        m.id === match.id ? { ...m, status: 'complete' } : m
      )

      console.log('[linkedMatches] settlement persisted for match', match.id)
    } catch (e) {
      console.warn('[linkedMatches] _checkAndPersistSettlement failed:', e?.message || e)
    }
  }

  /**
   * Subscribe to realtime updates for a linked match + both rounds' scores
   * AND rounds.is_complete changes (triggers settlement on completion).
   */
  function subscribeLinkedMatch(match, cb) {
    unsubscribeLinkedMatch()
    if (!match) return
    try {
      const channel = supabase.channel(`linked_match:${match.id}`)

      // Scores for both rounds
      if (match.round_a_id) {
        channel.on('postgres_changes', {
          event: '*', schema: 'public', table: 'scores',
          filter: `round_id=eq.${match.round_a_id}`,
        }, payload => cb?.('scores-a', payload))
      }
      if (match.round_b_id) {
        channel.on('postgres_changes', {
          event: '*', schema: 'public', table: 'scores',
          filter: `round_id=eq.${match.round_b_id}`,
        }, payload => cb?.('scores-b', payload))
      }

      // Round completion — triggers settlement when both are done
      if (match.round_a_id) {
        channel.on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rounds',
          filter: `id=eq.${match.round_a_id}`,
        }, payload => {
          if (payload.new?.is_complete) _checkAndPersistSettlement(match)
          cb?.('round-a-complete', payload)
        })
      }
      if (match.round_b_id) {
        channel.on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rounds',
          filter: `id=eq.${match.round_b_id}`,
        }, payload => {
          if (payload.new?.is_complete) _checkAndPersistSettlement(match)
          cb?.('round-b-complete', payload)
        })
      }

      // Linked match row itself (catches status → 'complete' from the other side)
      channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'linked_matches',
        filter: `id=eq.${match.id}`,
      }, payload => {
        if (activeLinkedMatch.value?.id === match.id && payload.new) {
          activeLinkedMatch.value = { ...activeLinkedMatch.value, ...payload.new }
        }
        cb?.('linked-match', payload)
      })

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
      const fresh = await _loadRoundBundle(round.id, { forceRefresh: true })
      if (fresh) {
        round.scores = fresh.scores
        round.round_members = fresh.round_members
      }
    } catch { /* non-fatal */ }
  }

  const pendingInvites = ref([])

  async function fetchPendingInvites() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) { pendingInvites.value = []; return }
    try {
      let rp = null
      try {
        const res = await supaCallWithRetry(
          'roster_players.byUserId',
          () => supabase.from('roster_players').select('id').eq('user_id', auth.user.id).maybeSingle(),
          4000,
        )
        rp = res.data
      } catch { /* no roster entry — that's ok */ }
      if (!rp?.id) { pendingInvites.value = []; return }
      const { data, error } = await supaCallWithRetry(
        'linked_matches.pendingInvites',
        () => supabase.from('linked_matches').select('*').eq('status', 'pending').is('round_b_id', null)
          .filter('match_config', 'cs', JSON.stringify({ foursomeBPlayers: [{ id: rp.id }] })),
        6000,
      )
      if (error) throw error
      pendingInvites.value = data ?? []
    } catch (e) {
      console.warn('[linkedMatches] fetchPendingInvites failed:', e?.message || e)
      pendingInvites.value = []
    }
  }

  const matchesForRound = (roundId) => computed(() =>
    linkedMatches.value.filter(m => m.round_a_id === roundId || m.round_b_id === roundId)
  )

  return {
    linkedMatches, activeLinkedMatch, activeRoundA, activeRoundB, pendingInvites,
    fetchUserLinkedMatches, fetchByCode, createLinkedMatch, acceptLinkedMatch,
    cancelLinkedMatch, loadLinkedMatchDetail,
    subscribeLinkedMatch, unsubscribeLinkedMatch, reloadActiveMatchScores,
    matchesForRound, fetchPendingInvites, _checkAndPersistSettlement,
  }
})

export function buildInviteUrl(code) {
  if (typeof window === 'undefined') return `#/accept/${code}`
  const origin = window.location.origin + window.location.pathname.replace(/\/+$/, '')
  return `${origin}#/accept/${code}`
}
