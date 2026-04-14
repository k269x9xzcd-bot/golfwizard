// GolfWizard Service Worker
// Strategy: Network-first for all app assets so new deploys are picked up immediately.
// Cache is only used as a fallback when offline.

const CACHE_NAME = 'golfwizard-v__BUILD_VERSION__'
const BASE = '/golfwizard'

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Delete all old caches (different CACHE_NAME = old version)
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests under our base path
  if (!url.pathname.startsWith(BASE) && url.origin !== self.location.origin) return
  // Don't intercept Supabase API calls
  if (url.hostname.includes('supabase')) return

  // Navigation requests (HTML) — always go to network, never serve stale cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(BASE + '/index.html'))
    )
    return
  }

  // All other assets: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Listen for SKIP_WAITING message from the app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
