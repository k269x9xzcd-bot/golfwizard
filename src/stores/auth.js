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
      if (user.value) await fetchProfile()

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const wasGuest = !user.value
        user.value = session?.user ?? null
        if (user.value) {
          // Just signed in — clean up any preset-injected guest data so it
          // doesn't interfere with the authenticated user's real Supabase data.
          if (wasGuest) clearPresetForAuthUser()
          await fetchProfile()
          linkUserToRosterPlayer() // fire-and-forget; non-blocking
        } else {
          profile.value = null
        }
      })
    } catch (e) {
      console.warn('Auth init error:', e)
    } finally {
      // Always clear loading — no matter what — so the app never stays blank
      loading.value = false
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
  async function upsertRosterEntry({ name, nickname, useNickname }) {
    if (!user.value?.email) return
    const email = user.value.email.toLowerCase().trim()
    // Build short_name from last word of name
    const parts = name.trim().split(/\s+/)
    const short_name = parts.length >= 2 ? parts[parts.length - 1].slice(0, 8) : name.slice(0, 8)
    const { error } = await supabase
      .from('roster_players')
      .upsert({
        name: name.trim(),
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
    // No emailRedirectTo — this forces Supabase to send a 6-digit OTP code
    // instead of a magic link. The code is verified in-app via verifyOtp().
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
    if (user.value) await fetchProfile()
    return result.data
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return {
    user, profile, loading, isGuest, isAuthenticated,
    init, fetchProfile, updateProfile, upsertRosterEntry, linkUserToRosterPlayer,
    signInWithGoogle, signInWithApple, signInWithEmail, verifyOtp, signOut,
  }
})
