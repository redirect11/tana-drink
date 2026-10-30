// ── LA BUILD SA PER CHI COMPILA (REQ-VENUE-001) ───────────────────────
//
// `CLIENTE=<slug>` fa leggere a Vite `clienti/<slug>/venue.json` e lo
// inietta nell'app come `__CLIENTE__`; sostituisce titolo e descrizione in
// index.html; genera il manifest della PWA col nome del locale; e copia i
// file di `clienti/<slug>/public/` sopra quelli di `public/` (logo, icone,
// foto). Senza CLIENTE è `tana`: la build della Tana è quella di sempre.
//
// Logica pura (leggiCliente, htmlPerCliente, manifestPerCliente) separata
// dal plugin, così si prova senza far partire Vite.

import { existsSync, readFileSync, readdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const CLIENTE_PREDEFINITO = 'tana'

const SLUG_VALIDO = /^[a-z][a-z0-9-]{1,29}$/

export function leggiCliente(slug = process.env.CLIENTE || CLIENTE_PREDEFINITO, radice = process.cwd()) {
  if (!SLUG_VALIDO.test(slug)) throw new Error(`CLIENTE «${slug}» non valido: minuscole, cifre e trattini, da 2 a 30 caratteri.`)
  const cartella = resolve(radice, 'clienti', slug)
  const file = join(cartella, 'venue.json')
  if (!existsSync(file)) throw new Error(`Cliente «${slug}»: manca ${file}. Vedi clienti/README.md.`)
  const venue = JSON.parse(readFileSync(file, 'utf8'))
  return { slug, venue, cartella, pubblica: join(cartella, 'public') }
}

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

export function pluginCliente({ slug, radice = process.cwd() } = {}) {
  const cliente = leggiCliente(slug, radice)
  const modello = JSON.parse(readFileSync(resolve(radice, 'clienti', 'manifest.template.json'), 'utf8'))
  const manifest = () => JSON.stringify(manifestPerCliente(modello, cliente.venue), null, 2)
  const sovrascritti = () => (existsSync(cliente.pubblica) ? readdirSync(cliente.pubblica) : [])
  return {
    name: 'cliente',
    config: () => ({
      define: { __CLIENTE__: JSON.stringify({ slug: cliente.slug, venue: cliente.venue }) },
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
        const nome = percorso.replace(/^\//, '')
        if (nome && sovrascritti().includes(nome)) {
          res.end(readFileSync(join(cliente.pubblica, nome)))
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
      const dist = resolve(radice, 'dist')
      if (!existsSync(dist)) return
      for (const nome of sovrascritti()) copyFileSync(join(cliente.pubblica, nome), join(dist, nome))
    },
  }
}
