// Vite substitutes the exact public build files and a content-derived cache name.
const files = ['/index.html', '/favicon.svg', '/placeholder.svg', '/manifest.webmanifest', .../* BUNDLE_FILES */[]]
const cacheName = 'pawntrack-static-BUILD_HASH'
const routes = new Set(['/','/login','/signup','/dashboard','/customers','/loans','/payments','/assets','/reports','/notifications'])

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    for (const file of files) {
      const request = new Request(file, { credentials: 'omit', cache: 'reload', redirect: 'error' })
      const response = await fetch(request)
      if (!response.ok || /private|no-store/i.test(response.headers.get('cache-control') || '') ||
          /cookie|authorization|\*/i.test(response.headers.get('vary') || '')) throw Error('Public asset unavailable')
      await cache.put(file, response)
    }
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name === 'pawntrack-cache-v1' || (name.startsWith('pawntrack-static-') && name !== cacheName)) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return
  // A navigation may contain private query parameters. Only return the fixed shell on network failure.
  if (request.mode === 'navigate' && routes.has(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match('/index.html')))
  } else if (!url.search && files.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(url.pathname)) || fetch(request)))
  }
})
