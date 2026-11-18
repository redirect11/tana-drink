'use strict'

// LA BUILD SA PER CHI COMPILA (REQ-VENUE-001): `CLIENTE=<slug>` sceglie
// `clienti/<slug>/venue.json`, e da lì titolo, descrizione e manifest.
// Senza CLIENTE è la Tana; uno slug sbagliato ferma la build invece di
// compilare un locale a caso.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  leggiCliente,
  valoreCliente,
  htmlPerCliente,
  manifestPerCliente,
  fileDelCliente,
  CLIENTE_PREDEFINITO,
  CLIENTE_DEL_PACCHETTO,
  inModalitaPacchetto,
  variabiliVietateNelPacchetto,
  pluginCliente,
} from '../../clienti/pluginCliente.js'
import { FILE_DEL_SET } from '../../clienti/personalizzazione.mjs'

describe('leggiCliente', () => {
  it('senza CLIENTE è la Tana', () => {
    expect(CLIENTE_PREDEFINITO).toBe('tana')
    const c = leggiCliente(undefined)
    expect(['tana', process.env.CLIENTE]).toContain(c.slug)
    if (c.slug === 'tana') expect(c.venue.venue_name).toBe('La Tana del Coniglio')
  })

  it('il cliente demo è neutro: niente Tana', () => {
    const c = leggiCliente('demo')
    expect(JSON.stringify(c.venue)).not.toMatch(/Tana|Coniglio|EFFEVI/)
    expect(c.venue.venue_socials).toEqual([])
  })

  // Il 22/10/2026 la demo pubblicata aveva ancora il logo della Tana: i file
  // grafici di public/ sono suoi, e un cliente senza i propri li eredita.
  // Il cliente neutro li sostituisce tutti (scripts/immagini-neutre.py).
  it('il cliente demo ha i suoi file grafici, diversi da quelli della Tana', () => {
    const c = leggiCliente('demo')
    for (const f of ['logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.svg', 'cocktail-hero.jpg']) {
      const suo = join(c.pubblica, f)
      expect(existsSync(suo), `manca clienti/demo/public/${f}`).toBe(true)
      expect(readFileSync(suo).equals(readFileSync(join('public', f))), `${f} è ancora quello della Tana`).toBe(false)
    }
  })

  // Daniele, 17/11/2026, sul bicchiere neutro della demo: «c'è già il logo
  // di Lime SmartOrders per questa cosa. Al posto del bicchiere». Il segno
  // della demo è la fetta di lime della regia (public/favicon.svg lì), da
  // cui nascono anche le icone PNG (REQ-FLOTTA-033).
  it('il logo della demo è la fetta di lime di Lime - SmartOrders', () => {
    const svg = readFileSync(join(leggiCliente('demo').pubblica, 'favicon.svg'), 'utf8')
    for (const verde of ['#5aa21f', '#dff0a5', '#8cc63f']) expect(svg, verde).toContain(verde)
    expect(svg).toMatch(/viewBox="0 0 32 32"/)
  })

  it('uno slug sbagliato o una cartella che non c’è fermano la build', () => {
    expect(() => leggiCliente('Tana Due')).toThrow(/non valido/)
    expect(() => leggiCliente('nessuno')).toThrow(/manca/)
  })
})

// I FILE DI public/ SONO DELLA TANA. Un locale nuovo che non ha ancora il
// suo logo (o un'icona) prende quello neutro, mai quello della Tana:
// l'utente, 06/11/2026, «il logo non può essere più quello della Tana»,
// «serve un logo placeholder generico per i deploy di nuovi locali». Il
// logo è anche sul dorso del mazzo di «Carte».
describe('i file grafici di un locale che non ha i suoi', () => {
  function radiceDiProva({ suoi = [] } = {}) {
    const radice = mkdtempSync(join(tmpdir(), 'cliente-'))
    mkdirSync(join(radice, 'clienti', 'demo', 'public'), { recursive: true })
    for (const f of ['logo.png', 'favicon.svg']) writeFileSync(join(radice, 'clienti', 'demo', 'public', f), `neutro ${f}`)
    for (const slug of ['tana', 'bar-mario']) {
      mkdirSync(join(radice, 'clienti', slug), { recursive: true })
      writeFileSync(join(radice, 'clienti', slug, 'venue.json'), JSON.stringify({ venue_name: slug }))
    }
    if (suoi.length) mkdirSync(join(radice, 'clienti', 'bar-mario', 'public'), { recursive: true })
    for (const f of suoi) writeFileSync(join(radice, 'clienti', 'bar-mario', 'public', f), `suo ${f}`)
    return radice
  }
  const contenuti = (mappa) => Object.fromEntries([...mappa].map(([nome, file]) => [nome, readFileSync(file, 'utf8')]))

  it('senza nessun file suo, prende tutti quelli neutri', () => {
    const radice = radiceDiProva()
    expect(contenuti(fileDelCliente(leggiCliente('bar-mario', radice), radice))).toEqual({
      'logo.png': 'neutro logo.png',
      'favicon.svg': 'neutro favicon.svg',
    })
  })

  it('col suo logo, tiene il suo, e prende il neutro dove non ha il suo', () => {
    const radice = radiceDiProva({ suoi: ['logo.png'] })
    expect(contenuti(fileDelCliente(leggiCliente('bar-mario', radice), radice))).toEqual({
      'logo.png': 'suo logo.png',
      'favicon.svg': 'neutro favicon.svg',
    })
  })

  it('la Tana non prende niente di neutro: i suoi sono quelli di public/', () => {
    const radice = radiceDiProva()
    expect(fileDelCliente(leggiCliente('tana', radice), radice).size).toBe(0)
  })

  it('il set neutro vero ha il logo, e non è quello della Tana', () => {
    const neutro = join('clienti', 'demo', 'public', 'logo.png')
    expect(readFileSync(neutro).equals(readFileSync(join('public', 'logo.png')))).toBe(false)
  })
})

// LA BUILD NON PORTA PIÙ UNA LICENZA (REQ-LIC-009). Con BUG-125 la Tana
// aveva la sua in `clienti/tana/licenza.json`; dal 02/11/2026 ogni
// installazione ha il suo `licenza/attuale`, e senza le regole non fanno
// scrivere niente: una licenza nella build farebbe lavorare un'app le cui
// scritture il server rifiuta. Un file rimasto in una cartella non si
// legge, e qui si controlla che non ce ne sia nessuno che lo faccia
// credere.
describe('la build non porta una licenza', () => {
  it('né la Tana né la demo: l’app riceve slug e locale, e basta', () => {
    for (const slug of ['tana', 'demo']) {
      const cliente = leggiCliente(slug)
      expect(cliente.licenza).toBeUndefined()
      expect(Object.keys(JSON.parse(valoreCliente(cliente))).sort()).toEqual(['slug', 'venue'])
    }
  })

  it('nessuna cartella dei clienti ha un licenza.json', () => {
    for (const voce of readdirSync('clienti', { withFileTypes: true })) {
      if (voce.isDirectory()) expect(existsSync(join('clienti', voce.name, 'licenza.json')), voce.name).toBe(false)
    }
  })
})

describe('index.html e manifest per il cliente', () => {
  const demo = leggiCliente('demo').venue
  const modello = JSON.parse(readFileSync('clienti/manifest.template.json', 'utf8'))

  it('index.html porta i segnaposto e la build li riempie', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toMatch(/<title>%VENUE_NAME%<\/title>/)
    const pieno = htmlPerCliente(html, demo)
    expect(pieno).toMatch(/<title>Bancone 21<\/title>/)
    expect(pieno).not.toMatch(/%VENUE_/)
    // Il testo non rompe l'HTML.
    expect(htmlPerCliente('<title>%VENUE_NAME%</title>', { venue_name: 'A & "B"' })).toBe('<title>A &amp; &quot;B&quot;</title>')
  })

  it('il manifest prende nome, nome corto, descrizione e colori', () => {
    const m = manifestPerCliente(modello, demo)
    expect(m.name).toBe('Bancone 21')
    expect(m.short_name).toBe('Bancone 21')
    expect(m.description).toBe('Ordina i tuoi drink al Bancone 21')
    expect(m.icons).toEqual(modello.icons)
    expect(JSON.stringify(m)).not.toMatch(/%VENUE_/)
  })
})

// IL SITO UGUALE PER TUTTI (REQ-FLOTTA-034): `PACCHETTO=1` compila senza
// nessun cliente, e il locale lo scrive la regia al deploy.
describe('la build del sito uguale per tutti', () => {
  it('si accende solo con PACCHETTO=1', () => {
    expect(inModalitaPacchetto({ PACCHETTO: '1' })).toBe(true)
    for (const v of [undefined, '', '0', 'true', 'si']) expect(inModalitaPacchetto({ PACCHETTO: v }), String(v)).toBe(false)
  })

  it('non porta il backend, il profilo, la regia né gli emulatori di nessun locale', () => {
    expect(
      variabiliVietateNelPacchetto({
        VITE_FIREBASE_API_KEY: 'k',
        VITE_FIREBASE_PROJECT_ID: 'tana-drink',
        VITE_RECAPTCHA_SITE_KEY: 'r',
        VITE_PROFILO: 'leggero',
        VITE_REGIA_PROGETTO: 'drink-regia',
        VITE_USE_FIREBASE_EMULATOR: 'true',
        VITE_FIREBASE_VAPID_KEY: '',
        VITE_APP_ENV: 'production',
        BASE_URL: '/',
      }).sort()
    ).toEqual(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_PROFILO', 'VITE_RECAPTCHA_SITE_KEY', 'VITE_REGIA_PROGETTO', 'VITE_USE_FIREBASE_EMULATOR'])
  })

  it('la build si ferma se trova un backend, prima di compilare', () => {
    const plugin = pluginCliente({ pacchetto: true })
    expect(() => plugin.configResolved({ root: '.', build: { outDir: 'dist' }, env: { VITE_FIREBASE_PROJECT_ID: 'tana-drink' } })).toThrow(/VITE_FIREBASE_PROJECT_ID/)
    expect(() => plugin.configResolved({ root: '.', build: { outDir: 'dist' }, env: { VITE_APP_ENV: 'production' } })).not.toThrow()
  })

  it('e non accende gli strumenti di prova: l’ambiente è produzione o niente', () => {
    expect(variabiliVietateNelPacchetto({ VITE_APP_ENV: 'test' })).toEqual(['VITE_APP_ENV'])
    expect(variabiliVietateNelPacchetto({ VITE_APP_ENV: 'locale' })).toEqual(['VITE_APP_ENV'])
    expect(variabiliVietateNelPacchetto({ VITE_APP_ENV: '' })).toEqual([])
  })

  it('non ha un cliente: slug vuoto, niente demo, i segnaposto restano', () => {
    const plugin = pluginCliente({ pacchetto: true })
    const { define } = plugin.config()
    expect(JSON.parse(define.__CLIENTE__)).toEqual({ slug: '', venue: {} })
    expect(define.__DEMO__).toBe('false')
    expect(plugin.transformIndexHtml('<title>%VENUE_NAME%</title>')).toBe('<title>%VENUE_NAME%</title>')
  })

  it('il manifest e l’informativa escono coi segnaposto, da riempire al deploy', () => {
    const emessi = new Map()
    pluginCliente({ pacchetto: true }).generateBundle.call({ emitFile: ({ fileName, source }) => emessi.set(fileName, source) })
    expect(JSON.parse(emessi.get('manifest.webmanifest')).name).toBe('%VENUE_NAME%')
    for (const f of ['privacy-policy.html', 'cookie-policy.html']) {
      expect(emessi.get(f), f).toMatch(/%VENUE_TITOLARE%/)
      expect(emessi.get(f), f).not.toMatch(/EFFEVI|latanadelconiglio/)
    }
  })

  it('i file grafici sono tutti quelli neutri: nessun logo della Tana', () => {
    const file = fileDelCliente(CLIENTE_DEL_PACCHETTO)
    for (const f of FILE_DEL_SET) {
      expect(file.has(f), f).toBe(true)
      expect(readFileSync(file.get(f)).equals(readFileSync(join('public', f))), `${f} è quello della Tana`).toBe(false)
    }
  })

  it('PACCHETTO e CLIENTE insieme non si compilano', () => {
    const prima = process.env.CLIENTE
    process.env.CLIENTE = 'demo'
    try {
      expect(() => pluginCliente({ pacchetto: true })).toThrow(/non ha un cliente/)
    } finally {
      if (prima === undefined) delete process.env.CLIENTE
      else process.env.CLIENTE = prima
    }
  })
})
