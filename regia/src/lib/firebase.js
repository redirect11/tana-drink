// ── FIREBASE DELLA REGIA (drink-regia) ────────────────────────────────
// Config da variabili VITE_*: nessun progetto cablato. Senza config l'app
// parte lo stesso in modalità «vetrina»: si vedono i prezzi, non ci si
// registra.

import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const configurata = Boolean(config.apiKey && config.projectId)

export const app = configurata ? (getApps()[0] || initializeApp(config)) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
