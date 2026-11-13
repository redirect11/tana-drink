// ── LA BUILD SA PER CHI COMPILA (REQ-VENUE-001) ───────────────────────
//
// `CLIENTE=<slug>` fa leggere a Vite `clienti/<slug>/venue.json` e lo
// inietta nell'app come `__CLIENTE__`; sostituisce titolo e descrizione in
// index.html; genera il manifest della PWA col nome del locale; e copia i
// file di `clienti/<slug>/public/` sopra quelli di `public/` (logo, icone,
// foto). Senza CLIENTE è `tana`: la build della Tana è quella di sempre.
//
// I FILE DI public/ SONO DELLA TANA. Un altro locale che non ha ancora un
// suo file (il logo, un'icona) prende quello NEUTRO (`clienti/demo/public`,
// un bicchiere su un tondo scuro, senza nomi), mai quello della Tana.
// L'utente, 06/11/2026, per il logo sul dorso del mazzo di «Carte»: se il
// tema va a un altro gestore «il logo non può essere più quello della
// Tana», e «serve un logo placeholder generico per i deploy di nuovi
// locali». Prima un file dimenticato nella cartella del cliente usciva
// con quello della Tana, in silenzio.
//
// Logica pura (leggiCliente, htmlPerCliente, manifestPerCliente) separata
// dal plugin, così si prova senza far partire Vite.

import { existsSync, readFileSync, readdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

const scappa = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

// La descrizione la scrive quasi nessuno: un cliente appena generato ha
// solo il nome, e index.html e manifest devono dire la stessa cosa.
const descrizione = (venue) => venue.venue_description || venue.venue_tagline || venue.venue_name

// index.html porta dei segnaposto %VENUE_*%: qui diventano il locale.
export function htmlPerCliente(html, venue) {
  return html
    .replace(/%VENUE_NAME%/g, scappa(venue.venue_name))
    .replace(/%VENUE_DESCRIPTION%/g, scappa(descrizione(venue)))
    .replace(/%VENUE_THEME_COLOR%/g, scappa(venue.venue_theme_color || '#0e0e15'))
}

// Il manifest della PWA dal modello, col locale dentro. Il nome lo riscrive
// poi l'app a runtime col suffisso del ruolo (lib/nomeApp.js): questo è
// quello che si vede prima che l'app parta, e quello che indicizzano i
// browser.
export function manifestPerCliente(modello, venue) {
  return {
    ...modello,
    name: venue.venue_name,
    short_name: venue.venue_short_name || venue.venue_name,
    description: descrizione(venue),
    background_color: venue.venue_theme_color || modello.background_color,
    theme_color: venue.venue_theme_color || modello.theme_color,
  }
}

// I file che il cliente mette sopra quelli di public/, nome → percorso: i
// suoi, e per un locale che non è la Tana quelli neutri dove non ha i suoi.
export function fileDelCliente(cliente, radice = process.cwd()) {
  const da = (cartella) => (existsSync(cartella) ? readdirSync(cartella).map((nome) => [nome, join(cartella, nome)]) : [])
  const neutri = cliente.slug === CLIENTE_PREDEFINITO ? [] : da(resolve(radice, ...CARTELLA_NEUTRA))
  return new Map([...neutri, ...da(cliente.pubblica)])
}

export function pluginCliente({ slug, radice = process.cwd() } = {}) {
  const cliente = leggiCliente(slug, radice)
  const modello = JSON.parse(readFileSync(resolve(radice, 'clienti', 'manifest.template.json'), 'utf8'))
  const manifest = () => JSON.stringify(manifestPerCliente(modello, cliente.venue), null, 2)
  const sovrascritti = () => fileDelCliente(cliente, radice)
  // La cartella vera della build: con `--outDir` non è dist/, e i file del
  // cliente finivano in un dist/ rimasto da prima.
  let uscita = resolve(radice, 'dist')
  return {
    name: 'cliente',
    configResolved(config) {
      uscita = resolve(config.root, config.build.outDir)
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
    transformIndexHtml: (html) => htmlPerCliente(html, cliente.venue),
    // In sviluppo: il manifest e i file del cliente si servono da qui,
    // prima di quelli di public/.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const percorso = (req.url || '').split('?')[0]
        if (percorso === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.end(manifest())
          return
        }
        const file = sovrascritti().get(percorso.replace(/^\//, ''))
        if (file) {
          res.end(readFileSync(file))
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest() })
    },
    // Dopo che Vite ha copiato public/: i file del cliente vincono.
    closeBundle() {
      if (!existsSync(uscita)) return
      for (const [nome, file] of sovrascritti()) copyFileSync(file, join(uscita, nome))
    },
  }
}
