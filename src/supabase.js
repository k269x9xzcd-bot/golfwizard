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

// On iOS PWA, WKWebView suspends JS execution when backgrounded — Supabase's
// autoRefreshToken timer never fires, so the JWT expires silently. When the
// user foregrounds the app, we proactively call getSession() which triggers
// a token refresh if needed. We do NOT ping Supabase (that backfired on iOS
// 18.7 — see comments below). Just force the auth refresh, which writes the
// new token to localStorage so supaRaw.js picks it up synchronously.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Fire-and-forget — don't await, just kick off the refresh
      supabase.auth.getSession().catch(() => {})
    }
  })
}

// Note: previous versions of this file fired a "warmup ping" on initial
// load + on visibilitychange to try to clear stale WKWebView sockets.
// That approach BACKFIRED on iOS 18.7 — the ping itself got stuck on the
// same zombie connection pool, leaving the app worse off (see
// gw_create_log traces: multiple consecutive timeouts on every call).
// We now fight stale sockets by using a raw fetch() with cache:'no-store'
// + keepalive:false for critical writes — see src/modules/supaRaw.js.

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
