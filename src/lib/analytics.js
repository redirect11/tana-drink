// Google Analytics (Firebase) attivato SOLO dietro consenso esplicito
// dell'utente (categoria "analytics" del banner cookie). Senza consenso
// non viene inizializzato e non vengono impostati cookie di statistica.
import { getAnalytics, setAnalyticsCollectionEnabled, isSupported } from 'firebase/analytics'
import { app } from './firebaseClient.js'

const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
let instance = null

// Attiva la raccolta (chiamata quando l'utente accetta la categoria
// statistiche). No-op se manca il measurementId o il browser non supporta
// Analytics (es. ambienti senza IndexedDB).
export async function enableAnalytics() {
  if (!measurementId) return
  try {
    if (!(await isSupported())) return
    if (!instance) instance = getAnalytics(app)
    setAnalyticsCollectionEnabled(instance, true)
  } catch {
    /* Analytics non disponibile: non bloccante */
  }
}

// Disattiva la raccolta (consenso negato o revocato).
export function disableAnalytics() {
  try {
    if (instance) setAnalyticsCollectionEnabled(instance, false)
  } catch {
    /* niente */
  }
}
