// Notifiche push FCM (Web Push). Il token del dispositivo viene salvato
// sull'ordine: una Cloud Function lo usa per notificare il cliente quando
// il drink è pronto o se l'ordine viene annullato dal bartender.
//
// Richiede la chiave VAPID (Firebase Console → Cloud Messaging → Web Push
// certificates) in VITE_FIREBASE_VAPID_KEY. Solo in produzione: in sviluppo
// non c'è emulatore FCM e il service worker non è registrato.
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging'
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

// ── QUESTO DISPOSITIVO PUÒ RICEVERE GLI AVVISI? ──────────────────────
// Al banco è la prima domanda quando «non arrivano le notifiche», e finora
// non c'era modo di rispondere se non provando a mandarsi un ordine. Qui si
// guarda tutta la catena, e si dice DOVE si è fermata:
//
//   'ok'            — c'è il token: gli avvisi arrivano
//   'da-permettere' — manca il consenso del browser (si può chiedere)
//   'negato'        — consenso negato: si rimette dalle impostazioni del
//                     sistema, l'app non può più chiederlo
//   'non-supportato'— il browser non fa push. Su iPhone e iPad succede
//                     finché l'app non è installata sulla schermata Home:
//                     è l'unico modo in cui iOS le consente.
//   'non-attivo'    — sviluppo o chiave VAPID mancante: qui non si prova
export async function statoPush() {
  if (!import.meta.env.PROD || !vapidKey) return 'non-attivo'
  if (!('Notification' in window)) return 'non-supportato'
  try {
    if (!(await isSupported())) return 'non-supportato'
  } catch {
    return 'non-supportato'
  }
  if (Notification.permission === 'denied') return 'negato'
  if (Notification.permission !== 'granted') return 'da-permettere'
  return (await getPushToken()) ? 'ok' : 'non-supportato'
}

// ── SPEGNERE GLI AVVISI SU QUESTO BROWSER ────────────────────────────
//
// Togliere la riga da `staff_tokens` non basta: quella è solo la RUBRICA
// dello staff. Il token è del browser e resta valido, e chi lo conosce può
// ancora suonare qui — le Functions che avvisano il cliente («il tuo drink
// è pronto», «ordine annullato») lo tengono scritto sull'ORDINE, non nella
// rubrica. Chi si era scollegato continuava a sentire suonare il telefono.
//
// Cancellando il token non resta nessun indirizzo a cui bussare, chiunque
// sia il mittente. Al prossimo accesso se ne fa uno nuovo e il dispositivo
// si registra da sé: non si perde niente.
export async function spegniPush() {
  try {
    if (!import.meta.env.PROD || !vapidKey) return false
    if (!('Notification' in window)) return false
    if (!(await isSupported())) return false
    return await deleteToken(getMessaging(app))
  } catch {
    // Nessun token da spegnere, o il browser non collabora: si esce lo
    // stesso. Restare dentro per un avviso è peggio.
    return false
  }
}
