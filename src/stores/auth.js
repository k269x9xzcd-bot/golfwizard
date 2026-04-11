import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../supabase'

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
      // Add a 5s timeout so a Supabase hiccup never hangs the splash screen
      const sessionPromise = supabase.auth.getSession()
      const timeout = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 5000))
      const { data: { session } } = await Promise.race([sessionPromise, timeout])
      user.value = session?.user ?? null
      if (user.value) await fetchProfile()

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        user.value = session?.user ?? null
        if (user.value) {
          await fetchProfile()
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
    // Use upsert so it creates the profile row if it doesn't exist yet
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.value.id, ...updates }, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw error
    profile.value = data
    return data
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
    init, fetchProfile, updateProfile,
    signInWithGoogle, signInWithApple, signInWithEmail, verifyOtp, signOut,
  }
})
