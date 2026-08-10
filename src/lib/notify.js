// Notifiche di sistema (best-effort). Su iOS richiede PWA installata.
// Restituisce true se la notifica è stata mostrata.
export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const res = await Notification.requestPermission()
    return res === 'granted'
  } catch {
    return false
  }
}

import { showToast } from './toast.js'
import { recordNotif } from './notifyStore.js'

export async function notify(title, body, extra = {}) {
  // SEMPRE anche in app (toast): le notifiche di sistema dipendono dai
  // permessi/piattaforma, ma chi sta guardando l'app deve vedere comunque
  // nuovi ordini, aggiunte e avvisi.
  showToast(body ? `${title} — ${body}` : title, { kind: 'info' })
  recordNotif(title, body) // storico, per la campanella

  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  // `extra`: opzioni Notification aggiuntive (vibrate, tag, renotify,
  // requireInteraction…) — usate ad es. dalla chiamata cerca-persone.
  const opts = {
    body,
    icon: `${import.meta.env.BASE_URL}logo.png`,
    badge: `${import.meta.env.BASE_URL}logo.png`,
    ...extra,
  }

  // Via service worker quando disponibile: su Android Chrome il
  // costruttore `new Notification` è vietato (lancia eccezione).
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) {
      await reg.showNotification(title, opts)
      return
    }
  } catch {
    /* tenta il fallback sotto */
  }

  try {
    const n = new Notification(title, opts)
    // Chiudi automaticamente dopo qualche secondo.
    setTimeout(() => n.close(), 8000)
  } catch {
    /* né SW né costruttore disponibili: non bloccante */
  }
}
