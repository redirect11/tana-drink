// Service worker minimale per la PWA.
// Fornisce un cache di base e gestisce i click sulle notifiche.
const CACHE = 'tana-drink-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['./', './index.html', './favicon.svg', './manifest.webmanifest'])
    ).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first per le richieste same-origin, con fallback alla cache.
// IMPORTANTE: mai intercettare richieste cross-origin (Firestore/API in
// streaming): metterle in cache corrompe il protocollo realtime.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        }
        return res
      })
      .catch(() =>
        caches.match(request).then((r) => {
          if (r) return r
          if (request.mode === 'navigate') return caches.match('./index.html')
          return Response.error()
        })
      )
  )
})

// Web Push (FCM): mostra la notifica quando l'app è chiusa o in background.
// La salta SOLO se il cliente sta già guardando la pagina di quell'ordine
// (lì ci pensa il listener realtime: evita la notifica doppia). Se sta
// guardando un'altra pagina — ad es. il menù — la notifica arriva comunque.
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {}
      try {
        payload = event.data ? event.data.json() : {}
      } catch { /* payload non JSON */ }
      const orderUrl = payload.data?.url || null

      if (orderUrl) {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const onOrderPage = wins.some((w) => {
          try {
            return w.visibilityState === 'visible' && new URL(w.url).pathname.endsWith(orderUrl)
          } catch {
            return false
          }
        })
        if (onOrderPage) return
      }

      const n = payload.notification || {}
      await self.registration.showNotification(n.title || 'La Tana del Coniglio', {
        body: n.body || '',
        icon: './logo.png',
        badge: './logo.png',
        data: payload.data || {},
      })
    })()
  )
})

// Quando l'utente clicca la notifica, porta in primo piano l'app
// (sulla pagina dell'ordine, se indicata nei dati della notifica).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || './'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if (url !== './' && 'navigate' in client) client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
