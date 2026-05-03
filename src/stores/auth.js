// Derive a display name from a profile object.
// Priority: first+last > display_name > nickname > email prefix
export function getDisplayName(profile, userEmail = '') {
  if (!profile) return userEmail?.split('@')[0] || '?'
  const first = profile.first_name?.trim() || ''
  const last  = profile.last_name?.trim()  || ''
  if (first || last) return [first, last].filter(Boolean).join(' ')
  if (profile.display_name?.trim()) return profile.display_name.trim()
  if (profile.nickname?.trim()) return profile.nickname.trim()
  return userEmail?.split('@')[0] || '?'
}

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { clearPresetForAuthUser } from '../modules/preset'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)
  const isGuest = computed(() => !user.value)
  const isAuthenticated = computed(() => !!user.value)

  // Initialize — called once on app start
  async function init() {
    loading.value = true
    try {
      // Attempt a token refresh first so we start with a valid JWT.
      // On iOS PWA, the stored session may have an expired access_token —
      // refreshSession() exchanges the refresh_token for a new one before
      // any data fetches run, preventing 403s on the first requests.
      let session = null
      try {
        const refreshTimeout = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 4000))
        const { data: refreshData } = await Promise.race([supabase.auth.refreshSession(), refreshTimeout])
        session = refreshData?.session ?? null
      } catch {}

      // Fall back to getSession() if refresh didn't work (e.g. no stored session)
      if (!session) {
        const sessionPromise = supabase.auth.getSession()
        const timeout = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 5000))
        const { data: { session: s } } = await Promise.race([sessionPromise, timeout])
        session = s ?? null
      }

      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
        if (!profile.value) await bootstrapProfileFromRoster(session)
      }

      // Listen for auth state changes.
      // Also clears loading on the INITIAL_SESSION event so we never show a
      // signed-out flash while Supabase is still restoring a valid session.
      supabase.auth.onAuthStateChange(async (event, session) => {
        // On app startup Supabase fires INITIAL_SESSION — use it as the
        // authoritative source of truth and clear loading here instead of
        // in the finally block, so the UI never renders signed-out while
        // a valid session is still being restored from localStorage.
        if (event === 'INITIAL_SESSION') {
          user.value = session?.user ?? null
          if (user.value) {
            await fetchProfile()
            if (!profile.value) await bootstrapProfileFromRoster(session)
          } else {
            profile.value = null
          }
          loading.value = false
          return
        }

        const wasGuest = !user.value
        user.value = session?.user ?? null
        if (user.value) {
          // Just signed in — clean up any preset-injected guest data so it
          // doesn't interfere with the authenticated user's real Supabase data.
          if (wasGuest) clearPresetForAuthUser()
          await fetchProfile()
          if (!profile.value) await bootstrapProfileFromRoster(session)
          linkUserToRosterPlayer()     // fire-and-forget; non-blocking
          backfillRoundMembership()    // fire-and-forget; backfill profile_id on old round_members rows
          syncRoundMembersToRoster()   // fire-and-forget; auto-add round co-players to this user's roster
          // Claim any roster shares addressed to this email, then load pending banner
          import('./roster').then(m => m.useRosterStore().claimRosterShares()).catch(() => {})
          linkTournamentMembership()   // fire-and-forget; links user_id on first sign-in
        } else {
          profile.value = null
        }
      })
    } catch (e) {
      console.warn('Auth init error:', e)
    } finally {
      // Safety net — clears loading if INITIAL_SESSION never fires (e.g. no
      // stored session at all). The 3s delay gives onAuthStateChange time to
      // fire first so we don't race against it on slow connections.
      setTimeout(() => { loading.value = false }, 3000)
    }
  }

  // After sign-in, write user_id onto the roster_player row that matches by email.
  // This enables the pending-match banner on HomeView.
  async function linkUserToRosterPlayer() {
    if (!user.value?.email) return
    const email = user.value.email.toLowerCase().trim()
    try {
      await supabase
        .from('roster_players')
        .update({ user_id: user.value.id })
        .eq('email', email)
        .is('user_id', null) // only set once; don't overwrite if already linked
    } catch (e) {
      console.warn('[auth] linkUserToRosterPlayer failed:', e?.message)
    }
  }

  // After sign-in, link this user's auth uid to their tournament_members row.
  // Runs fire-and-forget so new members (e.g. Marty Durkin) get access the
  // first time they sign in without any manual DB intervention needed.
  async function linkTournamentMembership() {
    if (!user.value?.email) return
    const email = user.value.email.toLowerCase().trim()
    try {
      await supabase
        .from('tournament_members')
        .update({ user_id: user.value.id })
        .eq('email', email)
        .is('user_id', null)
    } catch (e) {
      console.warn('[auth] linkTournamentMembership failed:', e?.message)
    }
  }

  async function fetchProfile() {
    if (!user.value) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .maybeSingle()  // returns null instead of throwing if no row found
      profile.value = data
    } catch (e) {
      console.warn('fetchProfile error:', e)
      profile.value = null
    }
  }


  // On first login (or when profile is incomplete), look for this user's email in any
  // roster_players row across all owners. If found, populate the profile so the "You"
  // card appears immediately — no manual Settings visit required.
  // Also captures Apple/Google OAuth full_name as a fallback.
  async function bootstrapProfileFromRoster(session) {
    if (!user.value) return
    // Run if no profile, OR if profile exists but is missing name data (e.g. empty row
    // auto-created by Supabase on first magic-link sign-in before we populated it)
    const profileIsComplete = profile.value?.first_name || profile.value?.display_name
    if (profileIsComplete) return
    const email = user.value.email?.toLowerCase().trim()
    if (!email) return

    try {
      // Cross-owner lookup enabled by roster_select_by_email RLS policy
      const { data: rosterMatch } = await supabase
        .from('roster_players')
        .select('name, first_name, last_name, short_name, ghin_index, ghin_number, nickname, use_nickname')
        .eq('email', email)
        .not('name', 'is', null)
        .order('ghin_index', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      // Fallback: OAuth metadata (Apple/Google send full_name on FIRST login only)
      const oauthName = session?.user?.user_metadata?.full_name
        || session?.user?.user_metadata?.name
        || null

      const displayName = rosterMatch?.name || oauthName
      if (!displayName) return  // truly unknown user — they fill Settings manually

      // Derive first/last from roster or by splitting the display name
      const nameParts = displayName.trim().split(/\s+/)
      const firstName = rosterMatch?.first_name?.trim() || nameParts[0] || null
      const lastName  = rosterMatch?.last_name?.trim()  || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null)

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.value.id,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          ghin_number: rosterMatch?.ghin_number ?? null,
          ghin_index: rosterMatch?.ghin_index ?? null,
          nickname: rosterMatch?.nickname ?? null,
          use_nickname: rosterMatch?.use_nickname ?? false,
        }, { onConflict: 'id', ignoreDuplicates: false })  // update incomplete profiles

      if (!error) {
        await fetchProfile()
        console.log('[auth] bootstrapProfileFromRoster: profile created from roster match')
      }
    } catch (e) {
      console.warn('[auth] bootstrapProfileFromRoster failed:', e?.message)
    }
  }

  async function updateProfile(updates) {
    if (!user.value) return
    // Upsert profile row — use maybeSingle to avoid hang if RLS blocks the select
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.value.id, ...updates }, { onConflict: 'id' })
    if (error) throw error
    // Refresh profile from DB (don't rely on upsert returning the row)
    await fetchProfile()
    return profile.value
  }

  // Upsert the user into roster_players (called after profile setup)
  async function upsertRosterEntry({ name, firstName, lastName, nickname, useNickname }) {
    if (!user.value?.email) return
    const email = user.value.email.toLowerCase().trim()
    // Derive full name from parts if provided separately
    const fullName = (firstName || lastName)
      ? [firstName, lastName].filter(Boolean).join(' ').trim()
      : (name || '').trim()
    const parts = fullName.split(/\s+/)
    const short_name = parts.length >= 2 ? parts[parts.length - 1].slice(0, 8) : fullName.slice(0, 8)
    const { error } = await supabase
      .from('roster_players')
      .upsert({
        name: fullName,
        short_name,
        email,
        nickname: nickname || null,
        use_nickname: useNickname || false,
        // Don't overwrite ghin_index or is_favorite — only set if new row
      }, { onConflict: 'email', ignoreDuplicates: false })
    if (error) console.warn('upsertRosterEntry error:', error)
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signInWithApple() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signInWithEmail(email) {
    // No emailRedirectTo — OTP code is the only sign-in path for iOS PWA.
    // Magic link opens in Safari (separate localStorage from PWA) so we
    // remove it from the email template in Supabase dashboard entirely.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (error) throw error
  }

  async function verifyOtp(email, token) {
    // Try 'email' type first (OTP codes sent without emailRedirectTo)
    let result = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    // Fallback to 'magiclink' type if email fails
    if (result.error) {
      result = await supabase.auth.verifyOtp({ email, token, type: 'magiclink' })
    }
    if (result.error) throw result.error
    user.value = result.data.session?.user ?? null
    if (user.value) {
      await fetchProfile()
      if (!profile.value) await bootstrapProfileFromRoster(result.data.session)
    }
    return result.data
  }

  // Backfill profile_id on round_members rows that belong to this user
  // but were created before they had an account.
  // Fire-and-forget — called after login, non-blocking.
  async function backfillRoundMembership() {
    if (!user.value) return
    const email = user.value.email?.toLowerCase().trim()
    const fullName = profile.value?.display_name?.trim() || null
    try {
      // Match on email first
      if (email) {
        const { error } = await supabase
          .from('round_members')
          .update({ profile_id: user.value.id })
          .is('profile_id', null)
          .ilike('email', email)
        if (error) console.warn('[auth] backfillRoundMembership (email) error:', error.message)
      }
      // Also match by guest_name where email is null — catches entries added without email
      if (fullName) {
        const { error } = await supabase
          .from('round_members')
          .update({ profile_id: user.value.id })
          .is('profile_id', null)
          .is('email', null)
          .ilike('guest_name', fullName)
        if (error) console.warn('[auth] backfillRoundMembership (name) error:', error.message)
      }
    } catch (e) {
      console.warn('[auth] backfillRoundMembership exception:', e?.message)
    }
  }

  // On sign-in, add any players from the user's rounds that aren't already in their roster.
  // Only adds players with a real name. Sets is_favorite = false so user can promote manually.
  // Fire-and-forget — non-blocking.
  async function syncRoundMembersToRoster() {
    if (!user.value) return
    // Delay so preset seed (applyPreset + backfill_roster_ghin_for_user) always runs first
    // and owns is_favorite. This function only fills gaps.
    await new Promise(r => setTimeout(r, 2000))
    try {
      // Get all round_members from rounds this user is part of
      const { data: myMembers, error: mErr } = await supabase
        .from('round_members')
        .select('round_id')
        .eq('profile_id', user.value.id)
      if (mErr || !myMembers?.length) return

      const roundIds = [...new Set(myMembers.map(m => m.round_id))]

      // Get all members from those rounds
      const { data: allMembers, error: aErr } = await supabase
        .from('round_members')
        .select('guest_name, short_name, ghin_index, ghin_number, email, profile_id, nickname, use_nickname')
        .in('round_id', roundIds)
      if (aErr || !allMembers?.length) return

      // Get existing roster to avoid duplicates
      const { data: roster } = await supabase
        .from('roster_players')
        .select('name, ghin_number, email')
        .eq('owner_id', user.value.id)

      const rosterGhins = new Set((roster || []).map(r => String(r.ghin_number)).filter(Boolean))
      const rosterEmails = new Set((roster || []).map(r => r.email?.toLowerCase()).filter(Boolean))
      const rosterNames = new Set((roster || []).map(r => r.name?.toLowerCase()).filter(Boolean))

      // Deduplicate round members and filter to only those not in roster
      const seen = new Set()
      const toInsert = []
      for (const m of allMembers) {
        // Skip self
        if (m.profile_id === user.value.id) continue

        const name = (m.guest_name || '').trim()
        if (!name) continue

        const email = m.email?.toLowerCase().trim() || null
        const key = email || name.toLowerCase()

        if (seen.has(key)) continue
        seen.add(key)

        // Already in roster?
        if (email && rosterEmails.has(email)) continue
        if (rosterNames.has(name.toLowerCase())) continue

        const nameParts = name.split(/\s+/)
        toInsert.push({
          owner_id: user.value.id,
          name,
          first_name: nameParts[0] || null,
          last_name: nameParts.slice(1).join(' ') || null,
          short_name: m.short_name || nameParts[nameParts.length - 1].slice(0, 8),
          ghin_number: m.ghin_number ?? null,
          ghin_index: m.ghin_index ?? null,
          email,
          nickname: m.nickname || null,
          use_nickname: m.use_nickname || false,
          is_favorite: false,
        })
      }

      if (!toInsert.length) return

      const { error: iErr } = await supabase.from('roster_players').insert(toInsert)
      if (iErr) console.warn('[auth] syncRoundMembersToRoster insert error:', iErr.message)
      else console.log(`[auth] syncRoundMembersToRoster: added ${toInsert.length} player(s)`)
    } catch (e) {
      console.warn('[auth] syncRoundMembersToRoster exception:', e?.message)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null

    // Clear all GolfWizard localStorage keys to prevent ghost rounds and
    // stale guest data from leaking across sign-out/sign-in cycles.
    const GW_PREFIXES = [
      'gw_guest_round_',
      'gw_known_rounds',
      'gw_guest_rounds_index',
      'gw_score_queue',
      'gw_create_log',
      'gw_roster',
      'golf_favorites',
      'golf_custom_courses',
      'golf_pending_courses',
      'gw_courses_migrated',
      'golf_active_round',
      'golf_players',
    ]
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && GW_PREFIXES.some(p => key.startsWith(p) || key === p)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  }

  return {
    user, profile, loading, isGuest, isAuthenticated,
    init, fetchProfile, updateProfile, upsertRosterEntry, linkUserToRosterPlayer,
    bootstrapProfileFromRoster, linkTournamentMembership,
    backfillRoundMembership, syncRoundMembersToRoster,
    signInWithGoogle, signInWithApple, signInWithEmail, verifyOtp, signOut,
  }
})
