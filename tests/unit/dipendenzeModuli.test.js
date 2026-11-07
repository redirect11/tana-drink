'use strict'

// ── I MODULI CHE NE RICHIEDONO UN ALTRO (REQ-LIC-015) ────────────────────
//
// Trovato dalla matrice dei moduli (REQ-DEV-017), 07/11/2026: tre moduli,
// presi da soli, non servivano a niente, e il Marketplace li vendeva da
// soli. Decisione dell'utente dello stesso giorno: l'inventario richiede il
// magazzino, gli ordini dal telefono richiedono il menù digitale («senza
// menù il cliente non ha dove ordinare»), le fatture ai fornitori stanno in
// piedi da sole.

import { describe, it, expect } from 'vitest'
import {
  moduloAttivo,
  moduloIncluso,
  basiMancanti,
  dipendentiDi,
  fraseRichiede,
  richiesteDi,
  voceVisibile,
} from '../../src/lib/licenza.js'
import { schedeModuli } from '../../src/lib/marketplaceModuli.js'

const con = (moduli, altro = {}) => ({ licenza: { moduli }, ...altro })

describe('chi richiede chi', () => {
  it('l’inventario richiede il magazzino, gli ordini dal telefono il menù digitale', () => {
    expect(richiesteDi('conta')).toEqual(['magazzino'])
    expect(richiesteDi('ordini_cliente')).toEqual(['menu_tavoli'])
  })

  it('le fatture ai fornitori non richiedono niente', () => {
    expect(richiesteDi('scadenzario')).toEqual([])
  })

  it('chi si spegne con una base', () => {
    expect(dipendentiDi('magazzino')).toEqual(['conta'])
    expect(dipendentiDi('menu_tavoli')).toEqual(['ordini_cliente'])
    expect(dipendentiDi('scadenzario')).toEqual([])
  })
})

describe('un modulo senza la sua base', () => {
  it('è incluso, ma non lavora', () => {
    const stato = con({ conta: true })
    expect(moduloIncluso(stato, 'conta')).toBe(true)
    expect(moduloAttivo(stato, 'conta')).toBe(false)
    expect(basiMancanti(stato, 'conta')).toEqual(['magazzino'])
  })

  it('la base inclusa ma spenta dalle impostazioni vale come assente', () => {
    const stato = con({ magazzino: true, conta: true }, { modulo_magazzino_enabled: false })
    expect(moduloAttivo(stato, 'conta')).toBe(false)
    expect(basiMancanti(stato, 'conta')).toEqual(['magazzino'])
  })

  it('con la base lavora', () => {
    const stato = con({ magazzino: true, conta: true })
    expect(moduloAttivo(stato, 'conta')).toBe(true)
    expect(basiMancanti(stato, 'conta')).toEqual([])
  })

  it('gli ordini dal telefono senza il menù digitale non lavorano', () => {
    expect(moduloAttivo(con({ ordini_cliente: true }), 'ordini_cliente')).toBe(false)
    expect(moduloAttivo(con({ menu_tavoli: true, ordini_cliente: true }), 'ordini_cliente')).toBe(true)
  })

  it('la frase dice quale manca, col nome che si legge a schermo', () => {
    expect(fraseRichiede(['magazzino'])).toBe('Richiede «Magazzino e fornitori».')
    expect(fraseRichiede([])).toBe('')
  })
})

describe('le fatture ai fornitori da sole', () => {
  it('aprono la sezione Fornitori anche senza il magazzino', () => {
    expect(voceVisibile(con({ scadenzario: true }), 'fornitori')).toBe(true)
    expect(voceVisibile(con({ scadenzario: true }), 'scadenzario')).toBe(true)
  })

  it('e lì non c’è niente del magazzino', () => {
    for (const voce of ['nuovo-ordine', 'lista-ordini', 'spese', 'listino']) {
      expect(voceVisibile(con({ scadenzario: true }), voce), voce).toBe(false)
    }
  })
})

describe('il Marketplace', () => {
  const scheda = (stato, id) => schedeModuli(stato).find((m) => m.id === id)

  it('un modulo senza la sua base dice quale serve', () => {
    expect(scheda(con({}), 'conta').richiede).toEqual(['magazzino'])
    expect(scheda(con({}), 'ordini_cliente').richiede).toEqual(['menu_tavoli'])
  })

  it('con la base inclusa non chiede niente', () => {
    expect(scheda(con({ magazzino: true }), 'conta').richiede).toEqual([])
    expect(scheda(con({}), 'scadenzario').richiede).toEqual([])
  })

  it('una base dice cosa si spegne con lei, solo se è incluso', () => {
    expect(scheda(con({ magazzino: true, conta: true }), 'magazzino').con_lui).toEqual(['conta'])
    expect(scheda(con({ magazzino: true }), 'magazzino').con_lui).toEqual([])
  })
})
