import { createClient } from '@supabase/supabase-js'

// Hardcoded — these are public anon keys, safe to commit.
// Eliminates .env dependency that kept getting lost during branch switches.
const SUPABASE_URL = 'https://mhzhdmsiliyfnijzddhu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oemhkbXNpbGl5Zm5panpkZGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQyODcsImV4cCI6MjA5MTQyMDI4N30.dKdXusJw_YqNtd5WEKm_qDyXbdfnKUGkxfDHBhXur3M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // We handle this manually below (hash router conflict)
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

// Manually handle magic link / OAuth tokens in the URL.
// Supabase puts tokens in the URL hash: #access_token=...&refresh_token=...
// Vue Router also uses the hash, so we extract tokens before the router sees the URL.
;(async () => {
  const hash = window.location.hash
  if (hash && hash.includes('access_token=')) {
    // Parse the fragment as query params
    const params = new URLSearchParams(hash.replace(/^#\/?/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      // Clean up the URL so the router doesn't get confused
      window.history.replaceState(null, '', window.location.pathname + '#/')
    }
  }
})()

// ── Connection warmup on app resume ─────────────────────────────
// iOS PWA (WKWebView) can hold dead HTTP/2 sockets across backgrounding.
// Whenever the page becomes visible again, fire a cheap query to detect
// and clear a stale connection before the user tries to do something real.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const pingConnection = () => {
    // Only ping if authenticated — no point otherwise
    if (!supabase.auth.getSession) return
    // Use a super-cheap query with a timeout so a stale socket fails fast
    const ping = supabase.from('rounds').select('id').eq('id', '00000000-0000-0000-0000-000000000000').limit(1)
    Promise.race([
      ping,
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 3000)),
    ]).catch(() => {
      // Ignore — just the act of making the call will reset the fetch layer
      console.log('[supabase] warmup ping reset stale connection')
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pingConnection()
  })
  // Also ping on initial load after a short delay (lets auth init first)
  setTimeout(pingConnection, 2000)
}

/**
 * Generate a 6-char room code via Supabase function
 */
export async function generateRoomCode() {
  const { data, error } = await supabase.rpc('generate_room_code')
  if (error) throw error
  return data
}

/**
 * Get a round by room code (for joining another group)
 */
export async function getRoundByRoomCode(code) {
  const { data, error } = await supabase
    .from('rounds')
    .select('*, round_members(*), game_configs(*)')
    .eq('room_code', code.toUpperCase())
    .single()
  if (error) throw error
  return data
}
