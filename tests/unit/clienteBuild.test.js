'use strict'

// LA BUILD SA PER CHI COMPILA (REQ-VENUE-001): `CLIENTE=<slug>` sceglie
// `clienti/<slug>/venue.json`, e da lì titolo, descrizione e manifest.
// Senza CLIENTE è la Tana; uno slug sbagliato ferma la build invece di
// compilare un locale a caso.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { leggiCliente, htmlPerCliente, manifestPerCliente, CLIENTE_PREDEFINITO } from '../../clienti/pluginCliente.js'

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
