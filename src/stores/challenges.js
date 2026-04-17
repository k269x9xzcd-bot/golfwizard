import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'

export const useChallengesStore = defineStore('challenges', () => {
  // Challenges sent TO the current user (pending)
  const inbound = ref([])
  // Challenges sent BY the current user
  const outbound = ref([])

  // ── Fetch ────────────────────────────────────────────────
  async function fetchChallenges() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) { inbound.value = []; outbound.value = []; return }

    const uid = auth.user.id
    const [inRes, outRes] = await Promise.all([
      supabase
        .from('pending_challenges')
        .select('*')
        .eq('challenged_user_id', uid)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('pending_challenges')
        .select('*')
        .eq('challenger_id', uid)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false }),
    ])

    inbound.value = inRes.data ?? []
    outbound.value = outRes.data ?? []
  }

  // ── Send a challenge ─────────────────────────────────────
  // player: { name, email } from roster
  // format: '1bb' | '2bb' | 'tbd'
  // challengerName: display name of sender (for the banner)
  async function sendChallenge(player, format = 'tbd', challengerName = '') {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Sign in required.')

    // Look up the challenged player's user_id by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', player.email.toLowerCase().trim())
      .maybeSingle()

    if (!profile) {
      throw new Error('no_account') // caller handles — shows invite flow
    }

    // Prevent duplicate pending challenges to the same player
    const existing = outbound.value.find(
      c => c.challenged_email === player.email.toLowerCase().trim() && c.status === 'pending'
    )
    if (existing) throw new Error('already_challenged')

    const payload = {
      challenger_id: auth.user.id,
      challenged_email: player.email.toLowerCase().trim(),
      challenged_user_id: profile.id,
      format,
      status: 'pending',
      message: challengerName ? `${challengerName} challenged you to a cross-match!` : null,
    }

    const { data, error } = await supabase
      .from('pending_challenges')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    outbound.value.unshift(data)
    return data
  }

  // ── Accept ───────────────────────────────────────────────
  async function acceptChallenge(challengeId, roundId) {
    const { data, error } = await supabase
      .from('pending_challenges')
      .update({ status: 'accepted', challenged_round_id: roundId })
      .eq('id', challengeId)
      .select()
      .single()

    if (error) throw error
    inbound.value = inbound.value.filter(c => c.id !== challengeId)
    return data
  }

  // ── Decline ──────────────────────────────────────────────
  async function declineChallenge(challengeId) {
    const { error } = await supabase
      .from('pending_challenges')
      .update({ status: 'declined' })
      .eq('id', challengeId)

    if (error) throw error
    inbound.value = inbound.value.filter(c => c.id !== challengeId)
  }

  // ── Cancel (by challenger) ───────────────────────────────
  async function cancelChallenge(challengeId) {
    const { error } = await supabase
      .from('pending_challenges')
      .update({ status: 'cancelled' })
      .eq('id', challengeId)

    if (error) throw error
    outbound.value = outbound.value.filter(c => c.id !== challengeId)
  }

  // ── Attach round IDs and create the linked match ─────────
  async function linkChallengeToMatch(challengeId, linkedMatchId) {
    const { error } = await supabase
      .from('pending_challenges')
      .update({ linked_match_id: linkedMatchId, status: 'accepted' })
      .eq('id', challengeId)
    if (error) throw error
    outbound.value = outbound.value.filter(c => c.id !== challengeId)
  }

  return {
    inbound, outbound,
    fetchChallenges, sendChallenge,
    acceptChallenge, declineChallenge,
    cancelChallenge, linkChallengeToMatch,
  }
})
