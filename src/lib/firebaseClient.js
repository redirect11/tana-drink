import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Google Analytics: attivato solo dietro consenso (vedi lib/analytics.js).
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Avvisa chiaramente in console se la configurazione manca, così l'app
// non fallisce in modo silenzioso quando le variabili non sono impostate.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
)

if (!isFirebaseConfigured) {
  console.warn(
    '[Firebase] Variabili VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID mancanti. ' +
      'Copia .env.example in .env e inserisci i valori del tuo progetto.'
  )
}

// Usa valori placeholder così l'inizializzazione non lancia eccezioni quando
// la configurazione manca (le chiamate falliranno comunque, ma in modo gestito).
export const app = initializeApp({
  apiKey: firebaseConfig.apiKey || 'placeholder-api-key',
  authDomain: firebaseConfig.authDomain || 'placeholder.firebaseapp.com',
  projectId: firebaseConfig.projectId || 'placeholder',
  storageBucket: firebaseConfig.storageBucket || 'placeholder.appspot.com',
  messagingSenderId: firebaseConfig.messagingSenderId || '0',
  appId: firebaseConfig.appId || 'placeholder-app-id',
  ...(firebaseConfig.measurementId ? { measurementId: firebaseConfig.measurementId } : {}),
})

// App Check (anti-bot/captcha): reCAPTCHA v3 invisibile. Attivo solo se
// la chiave è configurata; in sviluppo usa il debug token dell'emulatore.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
}
if (recaptchaKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch (e) {
    console.warn('[AppCheck] inizializzazione fallita:', e?.message)
  }
}

export const db = getFirestore(app)
export const functions = getFunctions(app, 'europe-west1')
export const auth = getAuth(app)
export const storage = getStorage(app)

// In sviluppo/testing (es. con Docker) ci si può collegare agli emulatori
// invece che al progetto reale. Attivalo con VITE_USE_FIREBASE_EMULATOR=true.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  // Usa l'hostname da cui è servita la pagina: così l'app funziona anche
  // da altri dispositivi della rete locale (es. http://192.168.1.x:5173),
  // dove "localhost" punterebbe al dispositivo stesso e non agli emulatori.
  const envHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'
  const host = envHost === 'localhost' ? window.location.hostname : envHost
  const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080
  connectFirestoreEmulator(db, host, port)
  connectFunctionsEmulator(functions, host, 5001)
  connectAuthEmulator(auth, `http://${host}:9099`)
  connectStorageEmulator(storage, host, 9199)
  console.info(`[Firebase] Connesso agli emulatori su ${host} (Firestore: ${port}, Auth: 9099, Functions: 5001, Storage: 9199)`)
}
