'use strict'

// LA DEMO LA DECIDE LA BUILD, E IL SUO CODICE NON ENTRA NEI LOCALI VERI
// (REQ-FLOTTA-019, docs/modalita-demo.md). Tre garanzie:
//   1. `__DEMO__` è vera solo per `clienti/demo`, e un cliente nuovo non la
//      eredita dalla demo da cui copia i file neutri;
//   2. il codice di src/demo/ si raggiunge solo dai punti previsti, dietro
//      la costante: niente interruttori, impostazioni o parametri;
//   3. lo script della CI riconosce un pacchetto che contiene la demo.

import { describe, it, expect, afterAll } from 'vitest'
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { pluginCliente, eDemo, leggiCliente } from '../../clienti/pluginCliente.js'
import { cercaSegni, SEGNI_DELLA_DEMO } from '../../scripts/controlla-build-senza-demo.mjs'

const RADICE = join(__dirname, '..', '..')
const SRC = join(RADICE, 'src')

describe('la costante della demo', () => {
  it('è vera solo per la demo, e solo con un true vero', () => {
    expect(eDemo({ demo: true })).toBe(true)
    for (const v of [undefined, false, 'true', 1, null]) expect(eDemo({ demo: v })).toBe(false)
    expect(leggiCliente('demo').venue.demo).toBe(true)
    expect(leggiCliente('tana').venue.demo).toBeUndefined()
  })

  it('il plugin la scrive come letterale: false per la Tana, true per la demo', () => {
    const define = (slug) => pluginCliente({ slug, radice: RADICE }).config().define.__DEMO__
    expect(define('tana')).toBe('false')
    expect(define('demo')).toBe('true')
  })

  it('un cliente nuovo non nasce demo: genera-cliente copia dalla demo solo le immagini', () => {
    const testo = readFileSync(join(RADICE, 'scripts', 'genera-cliente.mjs'), 'utf8')
    expect(testo).not.toMatch(/['"]demo['"]\s*:/)
    expect(testo).toMatch(/clienti', 'demo', 'public'/)
  })
})

describe('il codice della demo si raggiunge solo dai punti previsti', () => {
  const file = []
  const giro = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) giro(p)
      else if (/\.(js|jsx)$/.test(f)) file.push(p)
    }
  }
  giro(SRC)
  const fuori = file.filter((p) => !relative(SRC, p).replace(/\\/g, '/').startsWith('demo/'))
  const chiImporta = fuori
    .map((p) => ({ rel: relative(SRC, p).replace(/\\/g, '/'), testo: readFileSync(p, 'utf8') }))
    .filter((x) => /['"](?:\.\.?\/)+demo\//.test(x.testo))

  it('solo firebaseClient (accesso e sessione) e, con import(), main.jsx e App.jsx', () => {
    expect(chiImporta.map((x) => x.rel).sort()).toEqual(['App.jsx', 'lib/firebaseClient.js', 'main.jsx'])
  })

  it('main.jsx e App.jsx la caricano con import() dentro `__DEMO__`', () => {
    for (const x of chiImporta.filter((y) => y.rel !== 'lib/firebaseClient.js')) {
      expect(x.testo, x.rel).not.toMatch(/^import [^\n]*['"]\.\/demo\//m)
      expect(x.testo, x.rel).toMatch(/__DEMO__[\s\S]{0,80}import\(['"]\.\/demo\//)
    }
  })

  it('firebaseClient usa accesso e sessione solo dietro `__DEMO__`', () => {
    const t = chiImporta.find((x) => x.rel === 'lib/firebaseClient.js').testo
    expect(t).toMatch(/__DEMO__ \? nomeSessione\(\)/)
    expect(t).toMatch(/__DEMO__ \? creaAuthDemo\(\)/)
    expect(t.match(/nomeSessione\(/g)).toHaveLength(1)
    expect(t.match(/creaAuthDemo\(/g)).toHaveLength(1)
  })

  it('nessun interruttore a runtime: la demo non si legge da URL, impostazioni o memoria del browser', () => {
    for (const p of fuori) {
      const t = readFileSync(p, 'utf8')
      expect(t, relative(SRC, p)).not.toMatch(/(searchParams|settings|localStorage|location)[^\n]{0,40}\bdemo\b['"]?\s*\)?\s*(===|==|\?)/i)
    }
  })
})

describe('lo script della CI riconosce un pacchetto con la demo', () => {
  const finta = mkdtempSync(join(tmpdir(), 'dist-finta-'))
  afterAll(() => rmSync(finta, { recursive: true, force: true }))

  it('un pacchetto pulito passa; uno con la demo no', () => {
    mkdirSync(join(finta, 'assets'))
    writeFileSync(join(finta, 'assets', 'index.js'), 'console.log("La Tana")')
    expect(cercaSegni(finta)).toEqual([])
    writeFileSync(join(finta, 'assets', 'porta.js'), 'const t = "Ricomincia da capo"')
    expect(cercaSegni(finta)).toEqual([{ file: join('assets', 'porta.js'), segno: 'Ricomincia da capo' }])
  })

  it('ogni segno cercato sta davvero nel codice della demo', () => {
    const demo = readdirSync(join(SRC, 'demo'))
      .map((f) => readFileSync(join(SRC, 'demo', f), 'utf8'))
      .join('\n')
    const lib = readFileSync(join(SRC, 'lib', 'firebaseClient.js'), 'utf8')
    for (const s of SEGNI_DELLA_DEMO) expect(demo.includes(s) || lib.includes(s), s).toBe(true)
  })
})
