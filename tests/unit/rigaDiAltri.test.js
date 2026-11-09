'use strict'

// IL «+» E IL «−» SOLO SULLE PROPRIE RIGHE (REQ-ORD-024). Flavio,
// 09/11/2026: «se Alex da fuori vuole aggiungere una Tennent's non può
// fare +1, deve caricarla lui», altrimenti accanto alla F ci sarebbero due
// Tennent's e una non l'ha battuta Flavio. Lo stesso per l'admin: dopo,
// dall'iniziale, nessuno saprebbe più chi ha caricato davvero.

import { describe, it, expect } from 'vitest'
import { rigaDiAltri } from '../../src/lib/comande.js'

const FLAVIO = { name: 'Flavio', email: 'flavio@tana.it', role: 'admin' }
const ALEX = { name: 'Alex', email: 'alex@tana.it', role: 'staff' }
const riga = (added_by) => ({ drink_id: 'tennents', name: 'Tennent’s', qty: 1, ...(added_by ? { added_by } : {}) })

describe('di chi è la riga', () => {
  it('la riga di Flavio è di un altro per Alex, e anche per l’admin che non l’ha battuta', () => {
    expect(rigaDiAltri(riga(FLAVIO), ALEX)).toBe(true)
    expect(rigaDiAltri(riga(ALEX), FLAVIO)).toBe(true)
  })

  it('la propria riga resta propria, anche con l’email scritta in un altro modo', () => {
    expect(rigaDiAltri(riga(FLAVIO), FLAVIO)).toBe(false)
    expect(rigaDiAltri(riga(FLAVIO), { ...FLAVIO, email: 'Flavio@Tana.it' })).toBe(false)
  })

  it('l’account conta più del nome: due persone che si chiamano uguale restano due', () => {
    expect(rigaDiAltri(riga(FLAVIO), { ...FLAVIO, email: 'altro.flavio@tana.it' })).toBe(true)
  })

  it('senza email si guarda il nome', () => {
    expect(rigaDiAltri(riga({ name: 'Flavio', email: null }), { name: 'Flavio', email: null })).toBe(false)
    expect(rigaDiAltri(riga({ name: 'Flavio', email: null }), { name: 'Alex', email: null })).toBe(true)
    expect(rigaDiAltri(riga({ name: null, email: null }), { name: 'Alex', email: null })).toBe(true)
  })

  // Le righe del cliente dal menù e quelle battute prima dell'iniziale:
  // di chi siano non si sa, e restano a tutti.
  it('una riga senza iniziale è di tutti', () => {
    expect(rigaDiAltri(riga(null), ALEX)).toBe(false)
    expect(rigaDiAltri(riga(null), null)).toBe(false)
  })

  it('senza sapere chi sta usando il conto, una riga firmata non si tocca', () => {
    expect(rigaDiAltri(riga(FLAVIO), null)).toBe(true)
  })
})
