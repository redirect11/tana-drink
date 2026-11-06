// @vitest-environment happy-dom
'use strict'

// ── GLI STILI A RICETTA (REQ-MENU-031) ────────────────────────────────
//
// L'utente, 02/11/2026: «anche gli stili, non limitarti a quelli che
// abbiamo integrato. Creane di nuovi. In qualche modo dobbiamo poter
// caricare anche gli stili», e «stile a ricetta», con «una scelta ampia di
// caratteri dentro l'app». Una ricetta è una scelta fra valori fissi; il
// motore (le regole di `.stile-ricetta` in index.css) la disegna. Qui: che
// cosa è una ricetta, che i sette stili che la regia ha già pronti si
// leggono, che ogni valore ha la sua regola e ogni carattere è nella build.

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CARATTERI,
  VALORI,
  STILI_DELL_APP,
  leggiRicetta,
  leggiStile,
  leggiStiliDelCatalogo,
  ricordaStili,
  stiliRicordati,
  stiliRicettaDelLocale,
  stiliRicettaProvabili,
  vesteRicetta,
  coloriConRicetta,
} from '../../src/lib/stiliRicetta.js'

const RADICE = join(import.meta.dirname, '..', '..')
const DELLA_REGIA = JSON.parse(readFileSync(join(RADICE, 'tests', 'fixtures', 'stili-della-regia.json'), 'utf8')).stili
const OSTERIA = DELLA_REGIA.find((s) => s.id === 'osteria')

beforeEach(() => {
  localStorage.clear()
})

describe('che cosa è uno stile a ricetta', () => {
  // I sette stili della regia (functions/temi/stili.json di drink-regia,
  // copiati in tests/fixtures): insieme usano quasi tutti i valori.
  it('i sette stili che la regia ha già pronti si leggono tutti, come sono', () => {
    expect(DELLA_REGIA).toHaveLength(7)
    for (const s of DELLA_REGIA) {
      const letto = leggiStile(s)
      expect(letto, s.id).not.toBeNull()
      expect(letto.ricetta).toMatchObject(s.ricetta)
    }
  })

  it('un valore mancante prende quello di partenza', () => {
    const r = leggiRicetta({ versione: 1, caratteri: { titolo: 'inter', voce: 'inter', testo: 'inter' } })
    expect(r).toEqual({
      versione: 1,
      caratteri: { titolo: 'inter', voce: 'inter', testo: 'inter' },
      titoli: { maiuscolo: false, corsivo: false, allineamento: 'sinistra', dimensione: 'normale', spaziatura: 'normale' },
      voce: { forma: 'card', prezzo: 'accanto', separatore: 'nessuno', immagine: 'tonda' },
      intestazione: 'nessuna',
      cornice: 'nessuna',
      angoli: 'morbidi',
      sfondo: 'tinta',
      impaginazione: 'unica',
    })
  })

  // Meglio non mostrarlo che disegnarlo male: un valore arrivato con una
  // regia più nuova dell'app scarta lo stile, non si indovina.
  it('un valore che l’app non conosce lo scarta', () => {
    const con = (ricetta) => leggiStile({ ...OSTERIA, ricetta: { ...OSTERIA.ricetta, ...ricetta } })
    expect(con({ sfondo: 'marmo' })).toBeNull()
    expect(con({ caratteri: { ...OSTERIA.ricetta.caratteri, titolo: 'comic-sans' } })).toBeNull()
    expect(con({ titoli: { ...OSTERIA.ricetta.titoli, maiuscolo: 'sì' } })).toBeNull()
    expect(con({ versione: 2 })).toBeNull()
    expect(con({ impaginazione: 'a-fisarmonica' })).toBeNull()
    expect(con({ impaginazione: 'per-macro-categoria' }).ricetta.impaginazione).toBe('per-macro-categoria')
  })

  it('i colori propri: solo i sette, solo #rrggbb', () => {
    expect(leggiRicetta({ ...OSTERIA.ricetta, colori: { '--bg': '#10201A' } }).colori).toEqual({ '--bg': '#10201a' })
    expect(leggiRicetta({ ...OSTERIA.ricetta, colori: { '--bg': 'verde' } })).toBeNull()
    expect(leggiRicetta({ ...OSTERIA.ricetta, colori: { '--z-index': '#000000' } })).toBeNull()
  })

  it('un id non copre mai uno stile scritto nell’app', () => {
    for (const id of STILI_DELL_APP) expect(leggiStile({ ...OSTERIA, id }), id).toBeNull()
    expect(leggiStile({ ...OSTERIA, id: 'Osteria Bella' })).toBeNull()
    expect(leggiStile({ ...OSTERIA, nome: '' })).toBeNull()
  })
})

// IL MOTORE: ogni valore del vocabolario ha la sua regola. Un valore senza
// regola si disegnerebbe come quello di partenza, senza che nessuno se ne
// accorga.
describe('il motore', () => {
  const css = readFileSync(join(RADICE, 'src', 'index.css'), 'utf8')

  it('ogni valore che non è quello di partenza ha la sua regola', () => {
    for (const [percorso, valori] of Object.entries(VALORI)) {
      if (percorso === 'impaginazione') continue
      const attributo = `data-${percorso.replace('.', '-')}`
      for (const v of valori.slice(1)) expect(css, `${attributo}='${v}'`).toContain(`[${attributo}='${v}']`)
    }
    expect(css).toContain("[data-titoli-maiuscolo='true']")
    expect(css).toContain("[data-titoli-corsivo='true']")
  })

  // Dentro la build (REQ-SIC-004): un carattere che non ci fosse andrebbe
  // chiesto a un servizio esterno. Almeno un peso: «Dancing Script» e
  // «Playfair» ci sono solo pieni, e il browser usa il peso più vicino.
  it('ogni carattere della ricetta è nella build, o è di sistema', () => {
    const main = readFileSync(join(RADICE, 'src', 'main.jsx'), 'utf8')
    for (const id of Object.keys(CARATTERI)) {
      if (id === 'georgia') continue
      expect(main, id).toMatch(new RegExp(`@fontsource/${id}/latin-\\d00\\.css`))
    }
  })

  it('la veste: attributi solo per i valori non di partenza, e le variabili dei caratteri', () => {
    const { attributi, style } = vesteRicetta(leggiStile(OSTERIA).ricetta)
    expect(attributi).toEqual({
      'data-titoli-corsivo': 'true',
      'data-titoli-allineamento': 'centro',
      'data-titoli-dimensione': 'grande',
      'data-intestazione': 'fregio',
      'data-voce-forma': 'riga',
      'data-voce-prezzo': 'puntini',
      'data-voce-immagine': 'nascosta',
      'data-cornice': 'doppia',
      'data-angoli': 'vivi',
      'data-sfondo': 'carta',
    })
    expect(style['--stile-titolo']).toMatch(/^'Libre Baskerville'/)
    expect(style['--stile-testo']).toMatch(/^Georgia/)
    expect(style['--peso-voce']).toBe(700)
  })

  it('un carattere senza il 700 scrive le voci al suo peso', () => {
    const r = leggiRicetta({ versione: 1, caratteri: { titolo: 'pacifico', voce: 'special-elite', testo: 'inter' } })
    expect(vesteRicetta(r).style['--peso-voce']).toBe(400)
  })

  it('i colori propri stanno sopra quelli del tema', () => {
    const ricetta = leggiRicetta({ ...OSTERIA.ricetta, colori: { '--bg': '#111111' } })
    expect(coloriConRicetta({ preset: 'crema', custom: { '--bg': '#ffffff', '--accent': '#ff0000' } }, ricetta)).toEqual({
      preset: 'crema',
      custom: { '--bg': '#111111', '--accent': '#ff0000' },
    })
    expect(coloriConRicetta({ preset: 'crema' }, leggiStile(OSTERIA).ricetta)).toEqual({ preset: 'crema' })
  })
})

describe('da dove arrivano', () => {
  it('dal catalogo della regia, ricordati sul dispositivo', () => {
    const stili = leggiStiliDelCatalogo({ temi: [], stili: [...DELLA_REGIA, { id: 'rotto', nome: 'Rotto' }] })
    expect(stili.map((s) => s.id)).toEqual(DELLA_REGIA.map((s) => s.id))
    ricordaStili(stili)
    expect(stiliRicordati().map((s) => s.id)).toEqual(DELLA_REGIA.map((s) => s.id))
  })

  it('il locale ha quelli installati e quelli dei suoi temi su misura', () => {
    const settings = {
      stili_ricetta: [OSTERIA],
      temi_installati: [
        { id: 'su-misura-bosco', nome: 'Bosco', su_misura: true, ricetta: OSTERIA.ricetta },
        { id: 'riviera', nome: 'Riviera', stile: 'riviera' },
      ],
    }
    expect(stiliRicettaDelLocale(settings).map((s) => s.id)).toEqual(['osteria', 'su-misura-bosco'])
  })

  it('si provano anche quelli della licenza e del catalogo', () => {
    const settings = { licenza: { temi_su_misura: [{ id: 'su-misura-glicine', nome: 'Glicine', ricetta: OSTERIA.ricetta }] } }
    const catalogo = leggiStiliDelCatalogo({ stili: DELLA_REGIA })
    expect(stiliRicettaProvabili(settings, catalogo).map((s) => s.id)).toEqual(['su-misura-glicine', ...DELLA_REGIA.map((s) => s.id)])
  })
})
