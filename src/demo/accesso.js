// ── L'ACCESSO FINTO DELLA DEMO (REQ-FLOTTA-019) ──────────────────────────
//
// Nella demo non c'è Firebase Auth: chi prova sceglie con che ruolo entrare
// — titolare, bartender, sala, cliente — e l'utente è finto, ricordato in
// questo browser. Le regole del database non c'entrano: il database della
// demo non si usa.
//
// L'app chiede l'utente in un modo solo: `auth.currentUser`, e
// `onAuthStateChanged(auth, …)` / `signOut(auth)` di Firebase, che passano
// la domanda all'oggetto `auth` che ricevono (verificato nel codice di
// @firebase/auth il 30/10/2026). Qui c'è un oggetto con gli stessi metodi:
// le venticinque schermate che leggono `auth.currentUser` non cambiano.
//
// Il ruolo sta nei «claim», come nel token vero: `admin`, `bartender`,
// `staff`. Il cliente è anonimo, come chi apre il menù dal QR.

const CHIAVE = 'drink:demo-ruolo'

export const RUOLI_DEMO = [
  { id: 'admin', nome: 'Titolare', desc: 'Gestisce tutto: cassa, magazzino, menù, statistiche e impostazioni.' },
  { id: 'bartender', nome: 'Bartender', desc: 'Prepara le comande, batte i conti e incassa.' },
  { id: 'staff', nome: 'Sala', desc: 'Prende gli ordini ai tavoli e porta i drink.' },
  { id: 'cliente', nome: 'Cliente', desc: 'Sfoglia il menù e ordina dal telefono, come dal QR al tavolo.' },
]

const NOMI = { admin: 'Titolare (demo)', bartender: 'Bartender (demo)', staff: 'Sala (demo)' }

export function utenteDemo(ruolo) {
  if (!ruolo || ruolo === 'cliente' || !NOMI[ruolo]) return null
  const claims = { role: ruolo }
  return {
    uid: `demo-${ruolo}`,
    email: `${ruolo}@demo.invalid`,
    displayName: NOMI[ruolo],
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    getIdToken: async () => 'demo',
    getIdTokenResult: async () => ({ claims, token: 'demo' }),
    reload: async () => {},
  }
}

function leggiRuolo() {
  try {
    return localStorage.getItem(CHIAVE)
  } catch {
    return null
  }
}

export function creaAuthDemo() {
  let ruolo = leggiRuolo()
  let utente = utenteDemo(ruolo)
  const ascolti = new Set()
  const avvisa = () => ascolti.forEach((cb) => cb(utente))
  const ascolta = (prossimo) => {
    const cb = typeof prossimo === 'function' ? prossimo : (u) => prossimo?.next?.(u)
    ascolti.add(cb)
    // Come Firebase: la prima risposta arriva dopo, mai durante l'iscrizione.
    queueMicrotask(() => ascolti.has(cb) && cb(utente))
    return () => ascolti.delete(cb)
  }
  return {
    get currentUser() {
      return utente
    },
    onAuthStateChanged: ascolta,
    onIdTokenChanged: ascolta,
    authStateReady: async () => {},
    signOut: async () => {
      // Uscire riporta alla scelta del ruolo.
      ruolo = null
      utente = null
      try {
        localStorage.removeItem(CHIAVE)
      } catch {
        /* niente memoria: si esce lo stesso */
      }
      avvisa()
    },
    // Solo della demo: chi ha scelto con che ruolo entrare.
    ruoloScelto: () => ruolo,
    scegliRuolo: (nuovo) => {
      ruolo = nuovo
      utente = utenteDemo(nuovo)
      try {
        localStorage.setItem(CHIAVE, nuovo)
      } catch {
        /* niente memoria: vale per questa visita */
      }
      avvisa()
    },
  }
}
