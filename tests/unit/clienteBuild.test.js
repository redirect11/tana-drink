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
} from '../../clienti/pluginCliente.js'

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
    expect(pieno).toMatch(/<title>Bar Demo<\/title>/)
    expect(pieno).not.toMatch(/%VENUE_/)
    // Il testo non rompe l'HTML.
    expect(htmlPerCliente('<title>%VENUE_NAME%</title>', { venue_name: 'A & "B"' })).toBe('<title>A &amp; &quot;B&quot;</title>')
  })

  it('il manifest prende nome, nome corto, descrizione e colori', () => {
    const m = manifestPerCliente(modello, demo)
    expect(m.name).toBe('Bar Demo')
    expect(m.short_name).toBe('Demo')
    expect(m.description).toBe('Ordina i tuoi drink al Bar Demo')
    expect(m.icons).toEqual(modello.icons)
    expect(JSON.stringify(m)).not.toMatch(/%VENUE_/)
  })
})
