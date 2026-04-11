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
    } catch (e) {
      console.warn('Auth init error:', e)
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
      } else {
        profile.value = null
      }
    })
    loading.value = false
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
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.value.id)
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
    // Always redirect to the production GitHub Pages URL after sign-in
    const isProd = window.location.hostname !== 'localhost'
    const redirectTo = isProd
      ? 'https://k269x9xzcd-bot.github.io/golfwizard/'
      : 'http://localhost:5173/'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) throw error
  }

  async function verifyOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (error) throw error
    user.value = data.session?.user ?? null
    if (user.value) await fetchProfile()
    return data
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
