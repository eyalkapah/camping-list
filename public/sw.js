/*
 * Offline is read-only (ADR-0003): the shell and the last-seen data are served
 * from cache, and writes are simply not attempted. We never queue a Claim to
 * replay later — a promise that silently lands an hour after someone else made
 * the same promise is worse than an error message.
 */
const CACHE = 'camping-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add('./')))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // Network first, so a connected phone always sees the real list.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        void caches.open(CACHE).then((c) => c.put(request, copy))
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./'))),
  )
})
