// GolfWizard Service Worker
// Strategy: Network-first for all app assets so new deploys are picked up immediately.
// Cache is only used as a fallback when offline.

const CACHE_NAME = 'golfwizard-v3.2.0-1776129763569'
const BASE = '/golfwizard'

// Assets to pre-cache on install (the main shell)
const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
]

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  )
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

  // Network-first: try network, cache on success, fall back to cache if offline
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
