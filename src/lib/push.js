// Notifiche push FCM (Web Push). Il token del dispositivo viene salvato
// sull'ordine: una Cloud Function lo usa per notificare il cliente quando
// il drink è pronto o se l'ordine viene annullato dal bartender.
//
// Richiede la chiave VAPID (Firebase Console → Cloud Messaging → Web Push
// certificates) in VITE_FIREBASE_VAPID_KEY. Solo in produzione: in sviluppo
// non c'è emulatore FCM e il service worker non è registrato.
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app } from './firebaseClient.js'

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Token push del dispositivo, o null se non disponibile (permessi negati,
// browser non supportato, ambiente di sviluppo, chiave mancante).
export async function getPushToken() {
  try {
    if (!import.meta.env.PROD || !vapidKey) return null
    if (!('Notification' in window) || Notification.permission !== 'granted') return null
    if (!(await isSupported())) return null
    const registration = await navigator.serviceWorker.ready
    return await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
  } catch {
    return null
  }
}
