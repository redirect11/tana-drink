// Service worker minimale per la PWA.
// Fornisce un cache di base e gestisce i click sulle notifiche.
const CACHE = 'tana-drink-v3'

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

      // Chiamata cerca-persone allo staff (messaggio data-only): notifica
      // insistente con vibrazione forte, anche ad app chiusa o in
      // background. Mostrata sempre: la vibrazione è il punto.
      if (payload.data?.kind === 'staff_call') {
        return self.registration.showNotification(
          payload.data.title || '📟 Chiamata dal bancone',
          {
            body: payload.data.body || 'Rispondi sul telefono.',
            icon: './logo.png',
            badge: './logo.png',
            vibrate: [500, 200, 500, 200, 900],
            tag: 'staff-call',
            renotify: true,
            requireInteraction: true,
            data: { url: payload.data.url || '/bar' },
          }
        )
      }

      // Nuovo ordine al bancone (push allo staff): saltata solo se il
      // gestionale è già in primo piano — lì il listener realtime emette il
      // bip e aggiorna la lista, quindi la notifica di sistema sarebbe
      // doppia.
      //
      // ATTENZIONE, È UN PATTO: quel «lì suona da sé» deve essere vero. Ha
      // già morso una volta — il tablet al banco sta sulla coda tutta la
      // sera, quindi cadeva sempre in questo ramo, e dall'altra parte
      // l'avviso in pagina scartava gli ordini battuti dai gestori: due
      // regole diverse, e in mezzo il silenzio. Chi tocca una delle due
      // guardi anche l'altra (BartenderPage, subscribeActiveOrders).
      if (payload.data?.kind === 'new_order') {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const onBar = wins.some((w) => {
          try {
            return (
              (w.focused || w.visibilityState === 'visible') &&
              new URL(w.url).pathname.startsWith('/bar')
            )
          } catch {
            return false
          }
        })
        if (onBar) return
        return self.registration.showNotification(
          payload.data.title || '🆕 Nuovo ordine',
          {
            body: payload.data.body || '',
            icon: './logo.png',
            badge: './logo.png',
            vibrate: [200, 100, 200],
            tag: payload.data.order_id ? `new-order-${payload.data.order_id}` : 'new-order',
            renotify: true,
            // Resta nel centro notifiche finché non viene toccata: in un bar
            // pieno è facile non vedere subito un banner che sparisce.
            requireInteraction: true,
            data: { url: payload.data.url || '/bar' },
          }
        )
      }

      // Ordine pronto da servire (push allo staff di sala): saltata solo
      // se il gestionale è già visibile (lì la lista si aggiorna da sola).
      if (payload.data?.kind === 'staff_serve') {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const onBar = wins.some((w) => {
          try {
            return (
              (w.focused || w.visibilityState === 'visible') &&
              new URL(w.url).pathname.startsWith('/bar')
            )
          } catch {
            return false
          }
        })
        if (onBar) return
        return self.registration.showNotification(
          payload.data.title || '🫱 Drink pronti da servire',
          {
            body: payload.data.body || '',
            icon: './logo.png',
            badge: './logo.png',
            vibrate: [300, 150, 300],
            // Tag per ordine: ogni ordine pronto ha la sua notifica nel
            // pannello (il sistema le raggruppa per app), senza che la
            // nuova sostituisca la precedente.
            tag: payload.data.order_id
              ? `staff-serve-${payload.data.order_id}`
              : 'staff-serve',
            renotify: true,
            data: { url: payload.data.url || '/bar' },
          }
        )
      }

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
