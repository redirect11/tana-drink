'use strict'

// LA CHAT DEL GESTIONALE (REQ-AI-006): la conversazione e gli strumenti di
// lettura, nella loro logica pura (src/lib/chatAI.js, strumentiChat.js).
// La conversazione la tiene l'app e la rimanda intera: i turni del modello
// ci rientrano intatti, gli esiti degli strumenti in un turno di chi
// scrive. Gli strumenti rispondono con nomi e numeri, e righe contate:
// ogni riga in più si paga a ogni turno.

import { describe, it, expect } from 'vitest'
import { strumentiPerRuolo, conTesto, conTurno, conEsiti, quasiPiena, MAX_MESSAGGI } from '../../src/lib/chatAI.js'
import { giacenza, cercaProdotti, vendite, giornata, LIMITI_RIGHE } from '../../src/lib/strumentiChat.js'

describe('chi usa quali strumenti', () => {
  it('la chat è dello staff di gestione; la fattura solo dell’admin', () => {
    expect(strumentiPerRuolo('admin')).toContain('leggi_fattura')
    expect(strumentiPerRuolo('bartender')).toEqual(['giacenza', 'vendite', 'cerca_prodotti', 'proponi_descrizione', 'proponi_voce_menu'])
    expect(strumentiPerRuolo('staff')).toEqual([])
    expect(strumentiPerRuolo(null)).toEqual([])
  })
})

describe('la conversazione', () => {
  it('testo, turno del modello intatto, esiti in un turno di chi scrive', () => {
    const turno = { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'giacenza', input: { prodotto: 'gin' } }], firma: 'abc' }
    let m = conTesto([], '  Quanto gin mi resta? ')
    m = conTurno(m, turno)
    m = conEsiti(m, [{ id: 't1', esito: { trovati: [] } }, { id: 't2', esito: null, errore: true }])
    expect(m[0]).toEqual({ role: 'user', content: 'Quanto gin mi resta?' })
    expect(m[1]).toBe(turno)
    expect(m[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: '{"trovati":[]}' },
        { type: 'tool_result', tool_use_id: 't2', content: 'null', is_error: true },
      ],
    })
  })

  it('si avvisa prima che diventi troppo lunga', () => {
    expect(quasiPiena(new Array(MAX_MESSAGGI - 7).fill({}))).toBe(false)
    expect(quasiPiena(new Array(MAX_MESSAGGI - 6).fill({}))).toBe(true)
  })
})

const ITEMS = [
  { id: 'i1', name: 'Gin Tanqueray', stock: 1400, unit: 'ml', low_threshold: 700 },
  { id: 'i2', name: 'Gin Mare', stock: 2100, unit: 'ml', low_threshold: 700 },
  { id: 'i3', name: 'Tonica', stock: 30, unit: 'pz', low_threshold: 0 },
]

describe('la giacenza', () => {
  it('i prodotti che si chiamano così, con la scorta minima', () => {
    expect(giacenza({ prodotto: 'gin' }, { items: ITEMS }).trovati).toEqual([
      { id: 'i1', nome: 'Gin Tanqueray', giacenza: 1400, unita: 'ml', scorta_minima: 700, sotto_scorta: false },
      { id: 'i2', nome: 'Gin Mare', giacenza: 2100, unita: 'ml', scorta_minima: 700, sotto_scorta: false },
    ])
    expect(giacenza({ prodotto: 'tanq' }, { items: [{ ...ITEMS[0], stock: 700 }] }).trovati[0].sotto_scorta).toBe(true)
  })

  it('al massimo cinque', () => {
    const tanti = Array.from({ length: 9 }, (_, i) => ({ id: `g${i}`, name: `Gin ${i}`, stock: 1, unit: 'ml' }))
    expect(giacenza({ prodotto: 'gin' }, { items: tanti }).trovati).toHaveLength(LIMITI_RIGHE.giacenza)
  })
})

describe('cercare nel magazzino e nel menù', () => {
  it('dice dove sta, e lo stesso nome nei due è una riga sola', () => {
    const drinks = [{ id: 'd1', name: 'Gin Mare', category_id: 'c1', price: 9 }, { id: 'd2', name: 'Gin Lemon', category_id: 'c2', price: 7 }]
    const r = cercaProdotti({ testo: 'gin' }, { items: ITEMS, drinks, categorie: [{ id: 'c1', name: 'Gin' }, { id: 'c2', name: 'Cocktail' }] })
    expect(r.prodotti).toEqual([
      { id: 'd1', nome: 'Gin Mare', dove: 'entrambi', categoria: 'Gin', prezzo_eur: 9, giacenza: 2100, unita: 'ml' },
      { id: 'd2', nome: 'Gin Lemon', dove: 'menu', categoria: 'Cocktail', prezzo_eur: 7, giacenza: null, unita: null },
      { id: 'i1', nome: 'Gin Tanqueray', dove: 'magazzino', categoria: null, prezzo_eur: null, giacenza: 1400, unita: 'ml' },
    ])
    expect(r.altri).toBe(0)
  })
})

describe('le vendite', () => {
  const conto = (status, total, comande, extra = {}) => ({ status, total, comande, ...extra })
  const ORDINI = [
    conto('pagato', 16, [{ status: 'ritirato', items: [{ drink_id: 'd1', name: 'Gin Mare', qty: 2, unit_price: 8 }] }]),
    conto('pagato', 14, [{ status: 'ritirato', items: [{ drink_id: 'd2', name: 'Spritz', qty: 2, unit_price: 7 }] }], { discount_amount: 4 }),
    conto('aperto', 9, [{ status: 'ricevuto', items: [{ drink_id: 'd1', name: 'Gin Mare', qty: 1, unit_price: 9 }] }]),
  ]

  it('solo i conti incassati, l’incasso al netto degli sconti, i prodotti per pezzi', () => {
    const r = vendite({ dal: '2026-11-10', al: '2026-11-12' }, { ordini: ORDINI })
    expect(r).toMatchObject({ dal: '2026-11-10', al: '2026-11-12', conti: 2, altre: 0 })
    expect(r.righe).toEqual([
      { nome: 'Gin Mare', pezzi: 2, incasso_eur: 16 },
      { nome: 'Spritz', pezzi: 2, incasso_eur: 14 },
    ])
  })

  it('per un prodotto solo', () => {
    expect(vendite({ dal: '2026-11-10', prodotto: 'spritz' }, { ordini: ORDINI }).righe).toEqual([{ nome: 'Spritz', pezzi: 2, incasso_eur: 14 }])
  })

  it('una data che non è una data non vale', () => {
    expect(giornata('2026-11-12')).toBe('2026-11-12')
    expect(giornata('2026-02-30')).toBeNull()
    expect(giornata('ieri')).toBeNull()
  })
})
