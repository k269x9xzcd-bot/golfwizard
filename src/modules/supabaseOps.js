// ── Shared Supabase-call helpers ──────────────────────────────
// iOS PWA (WKWebView) can hold onto dead HTTP/2 sockets after backgrounding.
// This wrapper races every Supabase call against a timeout so a stuck call
// fails fast with a clear error instead of hanging the UI forever.
//
// Usage:
//   const { data, error } = await supaCall('courses.update', supabase.from('courses').update(...), 8000)
//
// A global log is written to localStorage['gw_create_log'] so the diagnostic
// panel (in the wizard error overlay) can replay the trace.

export function debugLog(msg) {
  try {
    const log = JSON.parse(localStorage.getItem('gw_create_log') || '[]')
    log.push({ t: new Date().toISOString(), msg })
    localStorage.setItem('gw_create_log', JSON.stringify(log.slice(-100)))
  } catch {}
  if (typeof console !== 'undefined') console.log('[supa]', msg)
}

/**
 * Race a Supabase thenable against a timeout.
 * @param {string} label  — short identifier for logs (e.g. 'courses.update')
 * @param {Promise<any>} promise  — Supabase query builder (already invoked)
 * @param {number} ms  — timeout in milliseconds (default 8000)
 * @returns the resolved value, or throws if timeout.
 */
export async function supaCall(label, promise, ms = 8000) {
  debugLog(`→ ${label}`)
  const t0 = Date.now()
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  )
  try {
    const result = await Promise.race([promise, timeoutPromise])
    debugLog(`✓ ${label} (${Date.now() - t0}ms)`)
    return result
  } catch (e) {
    debugLog(`✗ ${label} (${Date.now() - t0}ms): ${e.message}`)
    throw e
  }
}

/**
 * Run a Supabase call with one automatic retry on timeout.
 * Useful for idempotent operations (upserts, updates by id) where the call
 * may have succeeded server-side but the response stream stalled.
 *
 * @param {string} label
 * @param {() => Promise<any>} buildPromise  — factory that returns a fresh Supabase call
 * @param {number} ms  — per-attempt timeout
 */
export async function supaCallWithRetry(label, buildPromise, ms = 8000) {
  try {
    return await supaCall(label, buildPromise(), ms)
  } catch (e) {
    debugLog(`[retry] ${label} — first attempt failed, retrying`)
    await new Promise(r => setTimeout(r, 400))
    return await supaCall(`${label}.retry`, buildPromise(), ms)
  }
}
