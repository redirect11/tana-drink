/* global __DEMO__ */
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  disableNetwork,
} from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
// Solo per la demo (REQ-FLOTTA-019): nella build di un locale vero
// `__DEMO__` vale false, i rami qui sotto spariscono e questi due moduli con
// loro. Un controllo della CI lo verifica sul pacchetto della Tana.
import { nomeSessione } from '../demo/sessione.js'
import { creaAuthDemo } from '../demo/accesso.js'
import { configurazione } from '../porte/configurazione.js'

// LA DEMO NON PARLA CON NESSUN SERVER (REQ-FLOTTA-019, docs/modalita-demo.md):
// niente emulatori, niente App Check, rete del database spenta, accesso
// finto. Lo decide la build (`clienti/demo`), mai qualcosa a runtime.
const suEmulatore = !__DEMO__ && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'

// Il progetto lo dice la porta della configurazione (REQ-FLOTTA-021): il
// file `configurazione.json` scritto dalla regia, o le `VITE_*` della build.
// Il `measurementId` serve a Google Analytics, attivato solo dietro
// consenso (vedi lib/analytics.js).
const firebaseConfig = configurazione().firebase

// Avvisa chiaramente in console se la configurazione manca, così l'app
// non fallisce in modo silenzioso quando le variabili non sono impostate.
// La demo non ha bisogno di nessuna configurazione: non parla con nessun
// progetto, e i dati se li porta da sé (REQ-FLOTTA-019).
export const isFirebaseConfigured =
  Boolean(__DEMO__) || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

if (!isFirebaseConfigured) {
  console.warn(
    '[Firebase] Variabili VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID mancanti, e nessun configurazione.json. ' +
      'Copia .env.example in .env e inserisci i valori del tuo progetto.'
  )
}

// Usa valori placeholder così l'inizializzazione non lancia eccezioni quando
// la configurazione manca (le chiamate falliranno comunque, ma in modo gestito).
//
// NELLA DEMO l'app ha il nome della sessione (demo/sessione.js): la cache di
// Firestore prende quel nome, e «Ricomincia da capo» o una giornata nuova
// ripartono da una cache vuota invece di doverla svuotare.
const nomeApp = __DEMO__ ? nomeSessione() : undefined
export const app = initializeApp({
  apiKey: firebaseConfig.apiKey || 'placeholder-api-key',
  authDomain: firebaseConfig.authDomain || 'placeholder.firebaseapp.com',
  projectId: firebaseConfig.projectId || 'placeholder',
  storageBucket: firebaseConfig.storageBucket || 'placeholder.appspot.com',
  messagingSenderId: firebaseConfig.messagingSenderId || '0',
  appId: firebaseConfig.appId || 'placeholder-app-id',
  ...(firebaseConfig.measurementId ? { measurementId: firebaseConfig.measurementId } : {}),
}, nomeApp)

// App Check (anti-bot/captcha): reCAPTCHA v3 invisibile. Attivo solo se
// la chiave è configurata; in sviluppo usa il debug token dell'emulatore.
const recaptchaKey = firebaseConfig.recaptchaSiteKey
if (suEmulatore) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
}
if (recaptchaKey && !__DEMO__) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch (e) {
    console.warn('[AppCheck] inizializzazione fallita:', e?.message)
  }
}

// Firestore con PERSISTENZA OFFLINE (IndexedDB, multi-tab): letture e
// liste restano disponibili senza rete e le scritture non transazionali
// (addDoc/setDoc/updateDoc/deleteDoc) si accodano e si sincronizzano da
// sole al ritorno online. Le transazioni e le Cloud Functions richiedono
// comunque connessione. Se IndexedDB non è disponibile (es. navigazione
// privata su alcuni browser) si degrada alla cache in memoria.
//
// SUGLI EMULATORI, DA UN ALTRO DISPOSITIVO, SI PARLA IN LONG-POLLING.
// Il canale veloce di Firestore (WebChannel) con l'emulatore raggiunto da
// un'altra macchina della rete a volte si apre e non consegna mai niente:
// la pagina si carica, le connessioni ci sono — si vedono aperte — ma i
// dati non arrivano e l'SDK ritenta in silenzio. Al banco si legge «il wifi
// risulta collegato ma non sta passando niente», che è esattamente quello
// che succede. Col long-polling la stessa cosa funziona.
// Solo in locale: in produzione il canale veloce va benissimo, ed è più
// leggero.
function makeDb() {
  const opzioni = suEmulatore ? { experimentalForceLongPolling: true } : {}
  try {
    return initializeFirestore(app, {
      ...opzioni,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (e) {
    console.warn('[Firestore] persistenza offline non disponibile:', e?.message)
    try {
      return initializeFirestore(app, opzioni)
    } catch {
      return getFirestore(app)
    }
  }
}

export const db = makeDb()

// LA RETE DEL DATABASE SI SPEGNE QUI, NELLA DEMO, PRIMA DI TUTTO. È la
// prima operazione su Firestore: le letture e le scritture che verranno —
// anche quelle di un modulo caricato subito dopo — passano dalla coda di
// Firestore dopo di lei, e trovano la rete già spenta. Da lì l'app lavora
// sulla sua copia: le query leggono la cache, le scritture restano nel
// browser e non partono mai (la regia chiude comunque il database della
// demo a tutti). La rete non si riaccende in nessun punto dell'app.
if (__DEMO__) {
  disableNetwork(db).catch((e) => console.error('[demo] rete del database non spenta:', e?.message || e))
}

export const functions = getFunctions(app, 'europe-west1')
// Nella demo l'accesso è finto: si sceglie il ruolo (demo/accesso.js).
export const auth = __DEMO__ ? creaAuthDemo() : getAuth(app)
export const storage = getStorage(app)

// Dove stanno gli emulatori, se ci si collega a loro: serve anche al client
// diretto qui sotto, che si apre dopo.
let emulatore = null

// In sviluppo/testing (es. con Docker) ci si può collegare agli emulatori
// invece che al progetto reale. Attivalo con VITE_USE_FIREBASE_EMULATOR=true.
// Non nella demo, che non si collega a niente.
if (suEmulatore) {
  // Usa l'hostname da cui è servita la pagina: così l'app funziona anche
  // da altri dispositivi della rete locale (es. http://192.168.1.x:5173),
  // dove "localhost" punterebbe al dispositivo stesso e non agli emulatori.
  const envHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'
  const host = envHost === 'localhost' ? window.location.hostname : envHost
  const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080
  connectFirestoreEmulator(db, host, port)
  emulatore = { host, port }
  connectFunctionsEmulator(functions, host, 5001)
  connectAuthEmulator(auth, `http://${host}:9099`)
  connectStorageEmulator(storage, host, 9199)
  console.info(`[Firebase] Connesso agli emulatori su ${host} (Firestore: ${port}, Auth: 9099, Functions: 5001, Storage: 9199)`)
}

// IL CLIENT DIRETTO, PER LE LETTURE DI CONSULTAZIONE (BUG-117). Il Firestore
// qui sopra ha la cache su disco, ed è quello che tiene in piedi il banco
// senza rete. Ma a ogni domanda nuova, PRIMA di andare in rete, scorre in
// IndexedDB tutti i documenti della collezione che ha in cache: inventario,
// controllo e bilancio leggono decine di migliaia di movimenti, e aprire i
// «Movimenti» di un prodotto con tre righe costava secondi sul tablet
// («non si apre o si apre con ritardo», 23/10/2026). Misurato con 25.000
// movimenti in cache e la CPU rallentata quattro volte: 1,7-2,9 secondi con
// la cache, 0,2-0,3 col client diretto, per qualunque prodotto.
// Il client «lite» va dritto al server, senza cache: stessa app, quindi
// stesso accesso e stesso App Check. Si carica la prima volta che serve,
// per non pesare sull'avvio.
let lite = null
export function firestoreLite() {
  // Il client diretto va dritto al server: nella demo non c'è, e chi lo usa
  // ripiega sulla cache (vedi fetchMovimentiProdotto).
  if (__DEMO__) return Promise.reject(new Error('Nella demo il database non si raggiunge.'))
  if (!lite) {
    lite = import('firebase/firestore/lite').then((sdk) => {
      const diretto = sdk.getFirestore(app)
      if (emulatore) sdk.connectFirestoreEmulator(diretto, emulatore.host, emulatore.port)
      return { db: diretto, sdk }
    })
    // Senza rete il pezzo di codice può non arrivare: non si tiene in mano
    // un caricamento fallito, la volta dopo si riprova.
    lite.catch(() => {
      lite = null
    })
  }
  return lite
}
