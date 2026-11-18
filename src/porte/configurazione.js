/* global __DEMO__, __CLIENTE__ */
// ── LA PORTA DELLA CONFIGURAZIONE (REQ-FLOTTA-021, REQ-FLOTTA-034) ────
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
//                   "recaptchaSiteKey", "vapidKey" },
//     "venue": { …le chiavi venue_*… }, "profilo": "completo|leggero",
//     "regia": "drink-regia|drink-regia-test" }
//
// Cosa ammette ogni campo sta in configurazioneLocale.mjs, la regola
// condivisa con personalizza.mjs. Vince il file; senza il file vale il
// blocco nella pagina (sotto), e senza nemmeno quello LA BUILD, come prima.
// La Tana non ha né il file né il blocco.
//
// IL SITO UGUALE PER TUTTI I LOCALI (REQ-FLOTTA-034, dal 18/11/2026). La
// regia compila il sito una volta per versione e al deploy scrive la
// configurazione del locale in DUE posti: `configurazione.json` e un blocco
// `<script id="configurazione" type="application/json">` dentro
// index.html. Il blocco arriva CON LA PAGINA: anche dalla cache del service
// worker, anche al primo avvio di un tablet nuovo, anche senza rete. Senza
// il blocco, un tablet che aveva il locale nella build e passava al sito
// uguale per tutti si apriva su un progetto finto, con la coda vuota (R3
// nell'analisi del 18/11/2026). La configurazione porta anche il locale
// (`venue`), il profilo e la regia: quello che prima sapeva solo la build.
// L'ordine: il file ricordato nel dispositivo, il blocco nella pagina, la
// build.
//
// NESSUNO ASPETTA IL FILE. Il client di Firebase nasce al caricamento dei
// moduli, sincrono, e un avvio che aspetta la rete al banco è un'app
// ferma. Quindi all'avvio si usa l'ULTIMA configurazione letta (salvata
// nel dispositivo) o, la prima volta, il blocco o la build; il file si
// chiede in sottofondo. Se dice una cosa diversa da quella in uso:
//   - nei primi secondi dall'apertura, l'app si ricarica una volta e
//     riparte con quella nuova;
//   - più tardi (rete lenta) NON si ricarica sotto le mani di chi lavora:
//     la configurazione nuova vale dall'apertura dopo;
//   - SENZA BACKEND invece si ricarica sempre, e se il file non arriva si
//     riprova (seguiConfigurazione): un sito che non sa ancora di che
//     locale è non ha conti aperti da proteggere.
//
// La DEMO non legge niente: è decisa dalla build (`__DEMO__`), mai dal file.
//
// Logica pura più il minimo di browser (fetch, localStorage). Niente
// Firebase: è proprio quello che questa porta deve poter cambiare.

import { leggiConfigurazione, CAMPI_FIREBASE, PROFILI, PROGETTI_REGIA, ID_BLOCCO } from './configurazioneLocale.mjs'
import { leggi, scrivi } from '../lib/impostazioniLocali.js'

const FILE_CONFIGURAZIONE = 'configurazione.json'
const CHIAVE = 'drink:configurazione'

// Lo slug del locale della build, letto qui e non da lib/venue.js: è
// venue.js che legge la configurazione, e importarlo da qui faceva un giro.
// Nel sito uguale per tutti è vuoto: il locale lo dice la configurazione.
// La demo la decide la build. Letta così perché questo modulo lo carica
// anche Node (i test di sistema importano il seme, che arriva fin qui da
// lib/limiti.js), dove le costanti della build non ci sono.
const inDemo = () => typeof __DEMO__ !== 'undefined' && Boolean(__DEMO__)

const SLUG_DELLA_BUILD = typeof __CLIENTE__ !== 'undefined' ? __CLIENTE__.slug : 'tana'

// Fino a quando ricaricare è ancora «all'apertura»: dopo, qualcuno può
// già avere in mano un conto.
export const RICARICA_ENTRO_MS = 10000

// Le `VITE_*` della build, campo per campo.
const DALLA_BUILD = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  measurementId: 'VITE_FIREBASE_MEASUREMENT_ID',
  recaptchaSiteKey: 'VITE_RECAPTCHA_SITE_KEY',
  vapidKey: 'VITE_FIREBASE_VAPID_KEY',
}

// Quella della build: le `VITE_*`, come sempre. Senza chiave e progetto la
// build non ha backend, ma resta una configurazione.
function configurazioneDallaBuild(env = import.meta.env || {}) {
  const firebase = {}
  for (const k of CAMPI_FIREBASE) firebase[k] = typeof env[DALLA_BUILD[k]] === 'string' ? env[DALLA_BUILD[k]] : ''
  return {
    backend: 'firebase',
    locale: SLUG_DELLA_BUILD,
    firebase,
    venue: null,
    profilo: PROFILI.includes(env.VITE_PROFILO) ? env.VITE_PROFILO : null,
    regia: PROGETTI_REGIA.includes(env.VITE_REGIA_PROGETTO) ? env.VITE_REGIA_PROGETTO : null,
    origine: 'build',
  }
}

// Una configurazione letta (dal file, dal ricordo, dal blocco) completata
// con quello che non dice: lo slug, il profilo e la regia della build. Il
// locale (`venue`) resta null se non c'è: vale quello della build
// (lib/venue.js).
function completa(letta, origine) {
  const build = configurazioneDallaBuild()
  return {
    backend: letta.backend,
    locale: letta.locale || build.locale,
    firebase: letta.firebase,
    venue: letta.venue,
    profilo: letta.profilo || build.profilo,
    regia: letta.regia || build.regia,
    origine,
  }
}

// Il contenuto del file, se è una configurazione che questa app sa
// seguire; null altrimenti.
export function leggiFile(v) {
  const letta = leggiConfigurazione(v)
  return letta ? completa(letta, 'file') : null
}

export const haBackend = (c) => Boolean(c?.firebase?.apiKey && c?.firebase?.projectId)

// Questa apertura è senza backend? La demo no: non ne ha bisogno, i suoi
// dati stanno nel browser (REQ-FLOTTA-019).
export const senzaBackend = () => !inDemo() && !haBackend(configurazione())

// La regia con cui parla questa installazione: quella della configurazione
// del locale; senza, quella della build, riletta a ogni chiamata come prima
// di questa porta (funzioniRegia.js la leggeva lì, e i test la cambiano fra
// una prova e l'altra).
export function regiaInUso() {
  const c = configurazione()
  return c.origine === 'build' ? configurazioneDallaBuild().regia : c.regia
}

// Il blocco in index.html, se c'è ed è buono. Si legge in modo sincrono,
// al caricamento dei moduli: gli script `type="module"` partono a pagina
// già letta, e un blocco `application/json` non si esegue.
export function configurazioneDellaPagina(doc = globalThis.document) {
  try {
    const blocco = doc?.getElementById?.(ID_BLOCCO)
    if (!blocco) return null
    const letta = leggiConfigurazione(JSON.parse(blocco.textContent))
    return letta ? completa(letta, 'pagina') : null
  } catch {
    return null
  }
}

// Quello che vale quando il dispositivo non ricorda niente: il blocco
// della pagina, se no la build.
const diRiserva = () => configurazioneDellaPagina() || configurazioneDallaBuild()

// Due configurazioni dicono la stessa cosa? L'origine non conta: un file
// identico alla build non è un motivo per ricaricare.
const uguali = (a, b) =>
  JSON.stringify({ ...a, origine: null }) === JSON.stringify({ ...b, origine: null })

// Senza memoria nel dispositivo vale la riserva: come prima di questa porta.
const ricordata = () => leggi(CHIAVE, (s) => leggiFile(JSON.parse(s)), null)
const ricorda = (file) => scrivi(CHIAVE, file || null)

const scelta = () => (inDemo() ? configurazioneDallaBuild() : ricordata() || diRiserva())

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
  if (inDemo()) return 'demo'
  const prima = configurazione()
  let file
  try {
    file = await scarica()
  } catch {
    return 'senza-rete'
  }
  const valida = leggiFile(file)
  const riserva = diRiserva()
  if (valida) ricorda(file)
  // UN FILE ROVINATO NON FA DIMENTICARE QUELLO BUONO: si dice in console e
  // si tiene quello che si sa. Dimenticarlo voleva dire passare alla
  // riserva, e con una rete che a turno restituisce un JSON rotto e il
  // file buono l'app si ricaricava a ogni giro.
  else if (file) console.warn(`[configurazione] ${FILE_CONFIGURAZIONE} non valido: si tiene quello che si sa.`)
  // Il file che NON C'È (tolto dalla regia) si dimentica: vale la riserva.
  // Ma una riserva senza backend (l'immagine on premise, il sito uguale per
  // tutti non ancora personalizzato) non dimentica l'ultimo file buono:
  // senza, non partirebbe più.
  else if (haBackend(riserva)) ricorda(null)
  const dopo = ricordata() || riserva
  if (uguali(prima, dopo)) return 'uguale'
  // Il limite dei secondi protegge chi ha un conto in mano: senza backend
  // non ce l'ha nessuno, e aspettare l'apertura dopo voleva dire un tablet
  // fermo finché qualcuno non chiudeva l'app (R1 dell'analisi).
  if (haBackend(prima) && dallApertura() > RICARICA_ENTRO_MS) return 'al-prossimo-avvio'
  ricarica()
  return 'ricaricata'
}

// Le attese fra un tentativo e l'altro, quando l'app non ha backend: poco
// all'inizio (la rete del locale che torna), poi ogni cinque minuti.
export const ATTESE_SENZA_BACKEND_MS = [5000, 15000, 30000, 60000, 120000, 300000]

// La configurazione si rilegge in sottofondo all'avvio. Con un backend in
// uso basta una volta, come sempre. SENZA BACKEND (R2 nell'analisi del
// 18/11/2026: un solo tentativo, e senza rete il tablet restava fermo) si
// riprova: quando il browser dice che la rete è tornata, e comunque a
// intervalli crescenti, finché il file non arriva e l'app si ricarica.
// Restituisce la funzione che smette (per i test).
export function seguiConfigurazione({
  aggiorna = aggiornaConfigurazione,
  finestra = globalThis.window,
  attese = ATTESE_SENZA_BACKEND_MS,
  aspetta = (f, ms) => setTimeout(f, ms),
  smettiDiAspettare = (t) => clearTimeout(t),
} = {}) {
  if (inDemo()) return () => {}
  let fermo = false
  let tentativo = 0
  let timer = null
  let riprova = null
  const pulisci = () => {
    if (riprova) finestra?.removeEventListener?.('online', riprova)
    if (timer !== null) smettiDiAspettare(timer)
    riprova = null
    timer = null
  }
  const giro = () => {
    if (fermo) return
    Promise.resolve()
      .then(() => aggiorna())
      .catch((e) => console.error('[configurazione]', e))
      .then((esito) => {
        if (fermo || esito === 'ricaricata' || haBackend(configurazione())) return
        const ms = attese[Math.min(tentativo++, attese.length - 1)]
        riprova = () => {
          pulisci()
          giro()
        }
        finestra?.addEventListener?.('online', riprova)
        timer = aspetta(riprova, ms)
      })
  }
  giro()
  return () => {
    fermo = true
    pulisci()
  }
}
