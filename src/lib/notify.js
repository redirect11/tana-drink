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

export function notify(title, body) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: `${import.meta.env.BASE_URL}favicon.svg`,
      badge: `${import.meta.env.BASE_URL}favicon.svg`,
    })
    // Chiudi automaticamente dopo qualche secondo.
    setTimeout(() => n.close(), 8000)
  } catch {
    /* alcuni browser richiedono il service worker: non bloccante */
  }
}
