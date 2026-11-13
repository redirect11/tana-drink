'use strict'

// CARATTERI E SCRIPT DALLO STESSO INDIRIZZO DELL'APP (REQ-SIC-004).
//
// L'utente, 30/10/2026: «i font per questioni sulla privacy ... devono
// essere sempre dove sta la pagina ... Forse anche gli script». Un carattere
// preso da fonts.googleapis.com manda a Google l'IP di chi apre il menù, e
// l'IP è un dato personale (Landgericht München I, 20/01/2022); uno script
// preso da un server altrui gira con i permessi dell'app. Questo test
// boccia il ritorno di un <link> o di uno <script> verso un altro indirizzo,
// e di un @import o url() esterno nei fogli di stile.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RADICE = join(__dirname, '..', '..')
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8')
const pagine = ['index.html', ...readdirSync(join(RADICE, 'public')).filter((f) => f.endsWith('.html')).map((f) => `public/${f}`)]

// Un indirizzo assoluto verso un altro host, in src o href di link e script.
const ESTERNO = /<(?:link|script)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+["']/gi

describe('niente caratteri, stili e script da altri indirizzi', () => {
  it.each(pagine)('%s', (p) => {
    const html = leggi(p)
    expect(html.match(ESTERNO) || [], p).toEqual([])
    expect(html, p).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })

  it('i fogli di stile non importano niente da fuori', () => {
    const css = leggi('src/index.css')
    expect(css).not.toMatch(/@import\s+(url\()?["']?(https?:)?\/\//)
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//)
  })

  it('i caratteri arrivano dal pacchetto dell’app', () => {
    const main = leggi('src/main.jsx')
    expect(main).toMatch(/@fontsource\/playfair-display\//)
    expect(main).toMatch(/@fontsource\/italiana\//)
    expect(main).toMatch(/@fontsource\/jost\//)
  })
})
