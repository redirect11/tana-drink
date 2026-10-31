/* global __DEMO__ */
// ── LA PORTA DELLA CONFIGURAZIONE (REQ-FLOTTA-021) ────────────────────
//
// Con che backend parla l'app, e a che indirizzi. Fino al 31/10/2026 lo
// diceva solo la build, con le `VITE_FIREBASE_*` fissate in ogni locale.
// L'installazione on premise (docs/porte-e-adattatori.md) ha invece
// UN'IMMAGINE SOLA PER TUTTI I LOCALI, e i dati del locale li scrive la
// regia al momento dell'installazione, in un file servito accanto all'app:
//
//   /configurazione.json
//   { "backend": "firebase", "locale": "<slug>",
//     "firebase": { "apiKey", "authDomain", "projectId", "storageBucket",
//                   "messagingSenderId", "appId", "measurementId",
//                   "recaptchaSiteKey", "vapidKey" } }
//
// Vince il file; SENZA IL FILE VALE LA BUILD, come prima. La Tana e le
// istanze della regia non cambiano finché la regia non lo pubblica.
//
// NESSUNO ASPETTA IL FILE. Il client di Firebase nasce al caricamento dei
// moduli, sincrono, e un avvio che aspetta la rete al banco è un'app
// ferma. Quindi all'avvio si usa l'ULTIMA configurazione letta (salvata
// nel dispositivo) o, la prima volta, quella della build; il file si
// chiede in sottofondo. Se dice una cosa diversa da quella in uso:
//   - nei primi secondi dall'apertura, l'app si ricarica una volta e
//     riparte con quella nuova. È il caso della prima accensione di un
//     dispositivo nell'on premise, dove la build non ha nessun backend;
//   - più tardi (rete lenta) NON si ricarica sotto le mani di chi lavora:
//     la configurazione nuova vale dall'apertura dopo.
//
// La DEMO non legge niente: è decisa dalla build (`__DEMO__`), mai dal file.
//
// Logica pura più il minimo di browser (fetch, localStorage). Niente
// Firebase: è proprio quello che questa porta deve poter cambiare.

import { CLIENTE } from '../lib/venue.js'

export const FILE_CONFIGURAZIONE = 'configurazione.json'
const CHIAVE = 'drink:configurazione'

// Gli adattatori che questa app ha. Un file che chiede un backend diverso
// non si può seguire: si ignora, e lo si dice in console.
const BACKEND = ['firebase']

const CAMPI_FIREBASE = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
  'measurementId',
  'recaptchaSiteKey',
  'vapidKey',
]

// Fino a quando ricaricare è ancora «all'apertura»: dopo, qualcuno può
// già avere in mano un conto.
export const RICARICA_ENTRO_MS = 10000

const stringaPiena = (v) => typeof v === 'string' && v.trim() !== ''

function normalizza({ backend, locale, firebase = {} }, origine) {
  const f = {}
  for (const k of CAMPI_FIREBASE) f[k] = typeof firebase[k] === 'string' ? firebase[k] : ''
  return { backend, locale: stringaPiena(locale) ? locale : CLIENTE, firebase: f, origine }
}

// Quella della build: le `VITE_*`, come sempre.
export function configurazioneDallaBuild(env = import.meta.env) {
  return normalizza(
    {
      backend: 'firebase',
      locale: CLIENTE,
      firebase: {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
        measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
        recaptchaSiteKey: env.VITE_RECAPTCHA_SITE_KEY,
        vapidKey: env.VITE_FIREBASE_VAPID_KEY,
      },
    },
    'build'
  )
}

// Il contenuto del file, se è una configurazione che questa app sa
// seguire; null altrimenti.
export function leggiFile(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  if (!BACKEND.includes(v.backend)) return null
  const f = v.firebase
  if (!f || typeof f !== 'object' || !stringaPiena(f.apiKey) || !stringaPiena(f.projectId)) return null
  return normalizza(v, 'file')
}

export const haBackend = (c) => Boolean(c?.firebase?.apiKey && c?.firebase?.projectId)

// Due configurazioni dicono la stessa cosa? L'origine non conta: un file
// identico alla build non è un motivo per ricaricare.
const uguali = (a, b) =>
  JSON.stringify({ ...a, origine: null }) === JSON.stringify({ ...b, origine: null })

function ricordata() {
  try {
    const s = localStorage.getItem(CHIAVE)
    return s ? leggiFile(JSON.parse(s)) : null
  } catch {
    return null
  }
}

function ricorda(file) {
  try {
    if (file) localStorage.setItem(CHIAVE, JSON.stringify(file))
    else localStorage.removeItem(CHIAVE)
  } catch {
    /* senza memoria nel dispositivo vale la build: come prima di questa porta */
  }
}

const scelta = () => (__DEMO__ ? configurazioneDallaBuild() : ricordata() || configurazioneDallaBuild())

let inUso = null

// La configurazione con cui questa apertura dell'app lavora. Sincrona, e
// la stessa fino alla prossima apertura.
export function configurazione() {
  return (inUso ||= scelta())
}

// Il file, così com'è; null se non c'è. Una risposta che non è JSON vuol
// dire «non c'è»: l'hosting, per un indirizzo che non esiste, risponde con
// la pagina dell'app. Un errore del server, invece, non dice niente — e
// allora si tiene quello che si sa.
export async function scaricaFile(fetchFn = globalThis.fetch) {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${FILE_CONFIGURAZIONE}`, { cache: 'no-store' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`configurazione: risposta ${r.status}`)
  if (!(r.headers.get('content-type') || '').includes('json')) return null
  return r.json().catch(() => ({}))
}

// Chiede il file in sottofondo e ricorda quello che dice. Restituisce
// cosa è successo, per i test e per la console:
//   'demo' | 'senza-rete' | 'uguale' | 'ricaricata' | 'al-prossimo-avvio'
export async function aggiornaConfigurazione({
  scarica = scaricaFile,
  ricarica = () => window.location.reload(),
  dallApertura = () => performance.now(),
} = {}) {
  if (__DEMO__) return 'demo'
  const prima = configurazione()
  let file
  try {
    file = await scarica()
  } catch {
    return 'senza-rete'
  }
  const valida = leggiFile(file)
  if (file && !valida) console.warn(`[configurazione] ${FILE_CONFIGURAZIONE} non valido: vale la build.`)
  const build = configurazioneDallaBuild()
  if (valida) ricorda(file)
  // Una build senza backend (l'immagine on premise) non dimentica l'ultimo
  // file buono per una risposta storta: senza, non partirebbe più.
  else if (haBackend(build)) ricorda(null)
  const dopo = ricordata() || build
  if (uguali(prima, dopo)) return 'uguale'
  if (dallApertura() > RICARICA_ENTRO_MS) return 'al-prossimo-avvio'
  ricarica()
  return 'ricaricata'
}
