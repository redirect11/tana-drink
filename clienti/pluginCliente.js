// ── LA BUILD SA PER CHI COMPILA (REQ-VENUE-001) ───────────────────────
//
// `CLIENTE=<slug>` fa leggere a Vite `clienti/<slug>/venue.json` e lo
// inietta nell'app come `__CLIENTE__`; sostituisce titolo e descrizione in
// index.html; genera il manifest della PWA col nome del locale; scrive
// l'informativa privacy e cookie del locale; e copia i file di
// `clienti/<slug>/public/` sopra quelli di `public/` (logo, icone, foto).
// Senza CLIENTE è `tana`: la build della Tana è quella di sempre.
//
// I FILE DI public/ SONO DELLA TANA. Un altro locale che non ha ancora un
// suo file (il logo, un'icona) prende quello NEUTRO (`clienti/demo/public`,
// la fetta di lime, senza nomi), mai quello della Tana. L'utente,
// 06/11/2026, per il logo sul dorso del mazzo di «Carte»: se il tema va a
// un altro gestore «il logo non può essere più quello della Tana», e
// «serve un logo placeholder generico per i deploy di nuovi locali». Prima
// un file dimenticato nella cartella del cliente usciva con quello della
// Tana, in silenzio.
//
// L'INFORMATIVA È DEL LOCALE (REQ-SIC-017). Le pagine stavano in public/ e
// finivano così com'erano in ogni build: sulla demo e sui locali della
// flotta il titolare del trattamento era la Tana. Ora sono modelli in
// `clienti/pagine/`, riempiti coi dati del cliente; un cliente che ha le
// sue (`clienti/<slug>/pagine/`, la demo) usa quelle.
//
// IL SITO UGUALE PER TUTTI (REQ-FLOTTA-034): `PACCHETTO=1` compila senza
// nessun cliente. I segnaposto restano in index.html, nel manifest e
// nell'informativa, il set neutro prende il posto dei file della Tana, e il
// locale lo scrive la regia al deploy (scripts/personalizza.mjs). Nessuna
// `VITE_FIREBASE_*` può entrare: un sito per tutti col backend di un locale
// manderebbe gli ordini di tutti a quel locale.
//
// Le funzioni che scrivono il locale nei file stanno in
// personalizzazione.mjs, condivise con personalizza.mjs; qui c'è solo il
// legame con Vite e coi file del repository.

import { existsSync, readFileSync, readdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { htmlPerCliente, manifestPerCliente, informativaPerCliente, PAGINE_INFORMATIVA } from './personalizzazione.mjs'

export { htmlPerCliente, manifestPerCliente, informativaPerCliente }

export const CLIENTE_PREDEFINITO = 'tana'

// Il set neutro: è quello che genera-cliente.mjs copia in un cliente nuovo.
export const CARTELLA_NEUTRA = ['clienti', 'demo', 'public']

const SLUG_VALIDO = /^[a-z][a-z0-9-]{1,29}$/

export function leggiCliente(slug = process.env.CLIENTE || CLIENTE_PREDEFINITO, radice = process.cwd()) {
  if (!SLUG_VALIDO.test(slug)) throw new Error(`CLIENTE «${slug}» non valido: minuscole, cifre e trattini, da 2 a 30 caratteri.`)
  const cartella = resolve(radice, 'clienti', slug)
  const file = join(cartella, 'venue.json')
  if (!existsSync(file)) throw new Error(`Cliente «${slug}»: manca ${file}. Vedi clienti/README.md.`)
  const venue = JSON.parse(readFileSync(file, 'utf8'))
  return { slug, venue, cartella, pubblica: join(cartella, 'public') }
}

// Il «cliente» del sito uguale per tutti: nessuno. Lo slug vuoto vuol dire
// «lo dirà la configurazione» (porte/configurazione.js).
export const CLIENTE_DEL_PACCHETTO = Object.freeze({ slug: '', venue: {}, cartella: null, pubblica: null })

// Si compila il sito uguale per tutti? Solo `PACCHETTO=1`: una stringa
// qualunque non cambia il tipo di build.
export const inModalitaPacchetto = (env = process.env) => env.PACCHETTO === '1'

// Le variabili che il sito uguale per tutti non può avere: il backend, il
// profilo e la regia di un locale, o gli emulatori. Tutto questo arriva con
// la configurazione del locale.
const VIETATE_NEL_PACCHETTO = /^VITE_(FIREBASE_|RECAPTCHA_SITE_KEY$|PROFILO$|REGIA_PROGETTO$|USE_FIREBASE_EMULATOR$|FIRESTORE_EMULATOR)/

// E l'ambiente: un sito per tutti compilato con `VITE_APP_ENV=test`
// accenderebbe il nastro e gli strumenti di prova (src/dev/) in ogni locale.
const AMBIENTI_DEL_PACCHETTO = ['', 'production']

export function variabiliVietateNelPacchetto(env) {
  const piene = (k) => String(env[k] ?? '').trim() !== ''
  return Object.keys(env || {}).filter(
    (k) => (VIETATE_NEL_PACCHETTO.test(k) && piene(k)) || (k === 'VITE_APP_ENV' && !AMBIENTI_DEL_PACCHETTO.includes(String(env[k] ?? '').trim()))
  )
}

// Quello che l'app riceve come `__CLIENTE__`. Una funzione sola per la
// build e per i test: una voce aggiunta in un posto e dimenticata
// nell'altro farebbe girare i test su un'app diversa da quella vera.
// LA LICENZA NON C'È PIÙ (REQ-LIC-009): dal 02/11/2026 ogni installazione
// ha il suo `licenza/attuale`, la Tana compresa, e senza le regole non
// fanno scrivere niente. Il `licenza.json` nella cartella del cliente,
// nato con BUG-125 per la Tana, non si legge più.
export const valoreCliente = (cliente) => JSON.stringify({ slug: cliente.slug, venue: cliente.venue })

// Il cliente è la demo pubblica? Solo un `true` vero lo dice: una stringa,
// un 1 o una chiave scritta male non accendono niente.
export const eDemo = (venue) => venue?.demo === true

// I file che il cliente mette sopra quelli di public/, nome → percorso: i
// suoi, e per un locale che non è la Tana quelli neutri dove non ha i suoi.
// Il sito uguale per tutti ha solo quelli neutri.
export function fileDelCliente(cliente, radice = process.cwd()) {
  const da = (cartella) => (cartella && existsSync(cartella) ? readdirSync(cartella).map((nome) => [nome, join(cartella, nome)]) : [])
  const neutri = cliente.slug === CLIENTE_PREDEFINITO ? [] : da(resolve(radice, ...CARTELLA_NEUTRA))
  return new Map([...neutri, ...da(cliente.pubblica)])
}

// Il modello di una pagina dell'informativa per questo cliente: il suo, se
// ne ha uno (la demo), altrimenti quello comune.
export function modelloInformativa(cliente, nome, radice = process.cwd()) {
  const suo = cliente.cartella ? join(cliente.cartella, 'pagine', nome) : null
  return readFileSync(suo && existsSync(suo) ? suo : resolve(radice, 'clienti', 'pagine', nome), 'utf8')
}

// Le pagine dell'informativa come escono dalla build: riempite per un
// cliente, coi segnaposto per il sito uguale per tutti.
export function pagineInformativa(cliente, radice = process.cwd(), { pacchetto = false } = {}) {
  return new Map(
    PAGINE_INFORMATIVA.map((nome) => {
      const modello = modelloInformativa(cliente, nome, radice)
      return [nome, pacchetto ? modello : informativaPerCliente(modello, cliente.venue)]
    })
  )
}

export function pluginCliente({ slug, radice = process.cwd(), pacchetto = inModalitaPacchetto() } = {}) {
  if (pacchetto && process.env.CLIENTE) throw new Error('PACCHETTO=1 e CLIENTE insieme: il sito uguale per tutti non ha un cliente.')
  const cliente = pacchetto ? CLIENTE_DEL_PACCHETTO : leggiCliente(slug, radice)
  const modello = JSON.parse(readFileSync(resolve(radice, 'clienti', 'manifest.template.json'), 'utf8'))
  // Nel pacchetto il manifest resta il modello: lo riempie personalizza.mjs.
  const manifest = () => JSON.stringify(pacchetto ? modello : manifestPerCliente(modello, cliente.venue), null, 2)
  const sovrascritti = () => fileDelCliente(cliente, radice)
  const pagine = () => pagineInformativa(cliente, radice, { pacchetto })
  // La cartella vera della build: con `--outDir` non è dist/, e i file del
  // cliente finivano in un dist/ rimasto da prima.
  let uscita = resolve(radice, 'dist')
  return {
    name: 'cliente',
    configResolved(config) {
      uscita = resolve(config.root, config.build.outDir)
      if (pacchetto) {
        const vietate = variabiliVietateNelPacchetto(config.env)
        if (vietate.length) {
          throw new Error(
            `Il sito uguale per tutti non porta il backend di nessun locale, ma la build ha ${vietate.join(', ')}. ` +
              'Compilare senza .env (o con quelle variabili vuote): il locale arriva con la configurazione scritta al deploy.'
          )
        }
      }
    },
    config: () => ({
      define: {
        __CLIENTE__: valoreCliente(cliente),
        // LA DEMO LA DECIDE LA BUILD (REQ-FLOTTA-019): `"demo": true` in
        // venue.json, e nient'altro — non un'impostazione, non un ruolo, non
        // l'indirizzo. È un letterale: nella build di un locale vero vale
        // `false`, e il codice dietro `if (__DEMO__)` sparisce dal pacchetto.
        __DEMO__: JSON.stringify(eDemo(cliente.venue)),
      },
    }),
    transformIndexHtml: (html) => (pacchetto ? html : htmlPerCliente(html, cliente.venue)),
    // In sviluppo: il manifest, l'informativa e i file del cliente si
    // servono da qui, prima di quelli di public/.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const percorso = (req.url || '').split('?')[0]
        if (percorso === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.end(manifest())
          return
        }
        const nome = percorso.replace(/^\//, '')
        const pagina = pagine().get(nome)
        if (pagina) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(pagina)
          return
        }
        const file = sovrascritti().get(nome)
        if (file) {
          res.end(readFileSync(file))
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() })
      for (const [nome, sorgente] of pagine()) this.emitFile({ type: 'asset', fileName: nome, source: sorgente })
    },
    // Dopo che Vite ha copiato public/: i file del cliente vincono.
    closeBundle() {
      if (!existsSync(uscita)) return
      for (const [nome, file] of sovrascritti()) copyFileSync(file, join(uscita, nome))
    },
  }
}
