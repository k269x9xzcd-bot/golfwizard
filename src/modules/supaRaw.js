/**
 * supaRaw.js — Bypass the Supabase JS client and use raw fetch()
 * for critical writes. This is iOS 18.7 PWA survival: the Supabase
 * client's internal fetch reuses connections, and when WKWebView's
 * HTTP/2 connection pool has a stuck socket, every subsequent call
 * queues behind the zombie request.
 *
 * Using fetch() directly with:
 *   - cache: 'no-store'         → no cache interference
 *   - keepalive: false          → don't reuse a pooled connection
 *   - AbortController           → actually kill the socket on timeout
 *   - cache-busting query param → unique URL each attempt
 *
 * ...forces WKWebView to open a FRESH connection for this request,
 * sidestepping the stuck pool entirely.
 *
 * This is a fallback path. Normal happy-path still uses the Supabase JS
 * client for its retry logic, auth refresh, etc. We only reach here
 * when the Supabase JS call has timed out.
 */

const SUPABASE_URL = 'https://mhzhdmsiliyfnijzddhu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oemhkbXNpbGl5Zm5panpkZGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQyODcsImV4cCI6MjA5MTQyMDI4N30.dKdXusJw_YqNtd5WEKm_qDyXbdfnKUGkxfDHBhXur3M'

/**
 * Get the current user's access token for RLS.
 *
 * CRITICAL: we must NOT go through the Supabase JS client here
 * (supabase.auth.getSession) because on iOS 18.7 PWA when the HTTP/2
 * connection pool is stuck, even local auth calls queue behind the
 * zombie socket and hang. Instead we read the session directly out
 * of localStorage where supabase-js persists it. This path is pure
 * synchronous and cannot hang.
 *
 * Falls back to the anon key if no session is stored — RLS-protected
 * writes will then fail fast with a clear error rather than hanging.
 */
/**
 * Read the stored session from localStorage synchronously.
 * Returns { accessToken, refreshToken, expiresAt } or null.
 */
function _readStoredSession() {
  try {
    let best = null
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null')
        const accessToken = parsed?.access_token || parsed?.currentSession?.access_token
        const refreshToken = parsed?.refresh_token || parsed?.currentSession?.refresh_token
        const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at || 0
        if (accessToken) {
          if (!best || expiresAt > best.expiresAt) {
            best = { accessToken, refreshToken, expiresAt, _key: key, _parsed: parsed }
          }
        }
      } catch {}
    }
    return best
  } catch {}
  return null
}

/**
 * Check if a JWT is expired (with 30s buffer).
 * expiresAt is a Unix timestamp in seconds.
 */
function _isExpired(expiresAt) {
  if (!expiresAt) return true
  return (expiresAt - 30) < (Date.now() / 1000)
}

/**
 * Use the Supabase auth refresh endpoint directly (raw fetch, no JS client)
 * to get a fresh access token. Updates localStorage so subsequent calls work.
 * Returns new access token or null on failure.
 */
async function _refreshTokenRaw(refreshToken) {
  if (!refreshToken) return null
  try {
    _debugLog('[auth] refreshing expired JWT via raw fetch...')
    // Use AbortController+setTimeout instead of AbortSignal.timeout() —
    // AbortSignal.timeout() is not available on iOS < 15.4 and throws TypeError.
    const refreshCtrl = new AbortController()
    const refreshTimer = setTimeout(() => refreshCtrl.abort(), 8000)
    let res
    try {
      res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          cache: 'no-store',
          keepalive: false,
          signal: refreshCtrl.signal,
        }
      )
    } finally {
      clearTimeout(refreshTimer)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      _debugLog(`[auth] refresh failed HTTP ${res.status}: ${JSON.stringify(body)}`)
      return null
    }
    const data = await res.json()
    if (!data.access_token) return null

    // Write the refreshed session back to localStorage so the SJS client picks it up too
    const session = data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || 'null')
          if (parsed) {
            // Update the stored session fields
            const updated = {
              ...parsed,
              access_token: session.access_token,
              refresh_token: session.refresh_token ?? parsed.refresh_token,
              expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
              expires_in: session.expires_in ?? 3600,
              token_type: session.token_type ?? 'bearer',
            }
            localStorage.setItem(key, JSON.stringify(updated))
          }
        } catch {}
        break
      }
    }
    _debugLog('[auth] JWT refreshed successfully')
    return data.access_token
  } catch (e) {
    _debugLog(`[auth] refresh error: ${e.message}`)
    return null
  }
}

/**
 * Get a valid bearer token. If the stored token is expired, refresh it first.
 * Always uses raw fetch — never the Supabase JS client (which may be stuck).
 */
async function _getBearerAsync() {
  const session = _readStoredSession()
  if (!session) return SUPABASE_ANON_KEY

  // Token is still valid — use it directly
  if (!_isExpired(session.expiresAt)) return session.accessToken

  // Token is expired — try to refresh
  _debugLog('[auth] access token expired, attempting refresh...')
  const fresh = await _refreshTokenRaw(session.refreshToken)
  if (fresh) return fresh

  // Refresh failed — return the expired token anyway; the request will 401
  // but at least we tried and logged it
  _debugLog('[auth] refresh failed, proceeding with expired token (will 401)')
  return session.accessToken
}

function _getBearerSync() {
  const session = _readStoredSession()
  return session?.accessToken ?? SUPABASE_ANON_KEY
}

function _debugLog(msg) {
  try {
    const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
    log.push({ t: new Date().toISOString(), msg })
    localStorage.setItem('gw_create_log', JSON.stringify(log.slice(-100)))
  } catch {}
}

/**
 * Raw POST / PATCH / etc. against PostgREST.
 * @param {string} method         HTTP method
 * @param {string} pathAndQuery   e.g. "rounds?select=*" (no leading slash)
 * @param {any}    body           JS object to JSON-stringify (or null)
 * @param {number} timeoutMs      abort after this many ms
 * @param {object} extraHeaders   optional header overrides (e.g. { Prefer: 'return=representation' })
 */
export async function supaRawRequest(method, pathAndQuery, body, timeoutMs = 10000, extraHeaders = {}) {
  // Get a valid bearer token — refreshes if expired, using raw fetch (not SJS client).
  const bearer = await _getBearerAsync()
  // Cache-busting goes in a header, NOT a query param. PostgREST tries to parse
  // every query param as a filter and throws "failed to parse filter" on unknown keys.
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`
  _debugLog(`→ raw ${method} ${pathAndQuery.split('?')[0]} (auth=${bearer === SUPABASE_ANON_KEY ? 'anon' : 'user'})`)
  const t0 = Date.now()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        // Cache-buster as header — PostgREST ignores unknown headers,
        // unlike query params which it tries to parse as filters.
        'x-gw-ts': String(Date.now()),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : null,
      cache: 'no-store',
      keepalive: false,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      let errBody = null
      try { errBody = await res.json() } catch {}
      const detail = errBody ? JSON.stringify(errBody) : '(no body)'
      _debugLog(`✗ raw ${method} ${pathAndQuery.split('?')[0]} HTTP ${res.status} body=${detail} (${Date.now() - t0}ms)`)
      const err = new Error(errBody?.message || `Request failed (${res.status})`)
      err.code = errBody?.code
      err.status = res.status
      err.detail = errBody
      throw err
    }

    const data = await res.json()
    _debugLog(`✓ raw ${method} ${pathAndQuery.split('?')[0]} (${Date.now() - t0}ms)`)
    return data
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') {
      _debugLog(`✗ raw ${method} ${pathAndQuery.split('?')[0]} aborted after ${timeoutMs}ms`)
      throw new Error(`${method} ${pathAndQuery.split('?')[0]} timed out after ${timeoutMs}ms`)
    }
    _debugLog(`✗ raw ${method} ${pathAndQuery.split('?')[0]} (${Date.now() - t0}ms): ${e.message}`)
    throw e
  }
}

/** Raw INSERT — returns the inserted rows with `.select()`-equivalent representation. */
export function supaRawInsert(table, row, timeoutMs = 10000) {
  return supaRawRequest('POST', `${table}?select=*`, row, timeoutMs)
}

/** Raw UPDATE. Pass filter as a PostgREST query string (e.g. "id=eq.abc"). */
export function supaRawUpdate(table, filter, patch, timeoutMs = 10000) {
  return supaRawRequest('PATCH', `${table}?${filter}&select=*`, patch, timeoutMs)
}

/** Raw DELETE. */
export function supaRawDelete(table, filter, timeoutMs = 8000) {
  return supaRawRequest('DELETE', `${table}?${filter}`, null, timeoutMs)
}

/** Raw SELECT. */
export function supaRawSelect(table, query = 'select=*', timeoutMs = 8000) {
  return supaRawRequest('GET', `${table}?${query}`, null, timeoutMs)
}

/**
 * Pre-flight connectivity ping — fast check that Supabase is reachable
 * AND the WKWebView HTTP/2 connection pool isn't stuck. Returns true/false
 * so a caller can warn the user BEFORE they fill out a wizard they'd lose.
 *
 * Uses the same raw-fetch path as real writes, so if this returns true,
 * writes will succeed; if false, writes are effectively guaranteed to fail.
 */
export async function supaPreflightOk(timeoutMs = 3500) {
  try {
    await supaRawSelect('rounds', 'select=id&limit=1', timeoutMs)
    return true
  } catch (e) {
    _debugLog(`[preflight] FAILED: ${e.message}`)
    return false
  }
}

/**
 * How many times in the last minute has any Supabase call timed out completely?
 * Used to decide when to surface a "reload the app" prompt.
 */
export function countRecentTimeouts() {
  try {
    const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
    const now = Date.now()
    return log.filter(e => {
      const age = now - new Date(e.t).getTime()
      return age < 60_000 && /timed out after \d+ms/.test(e.msg || '')
    }).length
  } catch { return 0 }
}
