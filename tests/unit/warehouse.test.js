'use strict'

// Unit test della logica pura magazzino (src/lib/warehouse.js):
// conta periodica, ordini fornitore, scadenzario.

import { describe, it, expect } from 'vitest'
import {
  suggestedPackages,
  purchaseOrderText,
  parseSupplierList,
  qtyValue,
  giorniDiConta,
  consumoSettimanale,
  purchaseOrderTotals,
  consumptionDiff,
} from '../../src/lib/warehouse.js'

// Le righe dell'inventario in corso (DEP, ACQ, VENDUTO, ATTESO, DIFFERENZA)
// e i casi che stavano qui — l'esempio del foglio INV, lo smistamento dei
// movimenti di BUG-111 — sono in inventarioInCorso.test.js (REQ-MAG-046).

describe('qtyValue', () => {
  const amaro = { unit: 'ml', package_size: 1000, cost: 12.9, vat: 22 }
  it('valore con IVA di una quantità in ml', () => {
    // 500ml = 0,5 bottiglie × 15,738
    expect(qtyValue(500, amaro)).toBeCloseTo(7.869, 3)
  })
  it('pezzi: quantità × costo unitario', () => {
    expect(qtyValue(6, { unit: 'pz', cost: 1, vat: 22 })).toBeCloseTo(7.32, 2)
  })
  it('quantità nulla o negativa → 0', () => {
    expect(qtyValue(0, amaro)).toBe(0)
    expect(qtyValue(-100, amaro)).toBe(0)
  })
})

// ── IL CONSUMO A SETTIMANA, SULLE SETTIMANE VERE (REQ-MAG-024) ───────
// Nel foglio INV il divisore è una costante battuta a mano — «÷ 3», poi
// «÷ 2», poi «÷ 1,5», poi «÷ 4» — e nel frattempo sbaglia di quanto è
// lontana dalla realtà: «16-02 02-04» sono sei settimane e vengono divise
// per 4, «07-06 01-07» sono tre settimane e mezzo e vengono divise per 4
// anche loro. È il numero su cui si decide quanto ordinare.
describe('i giorni veri di una conta', () => {
  it('sono la distanza fra apertura e chiusura', () => {
    // Le due date dell'esempio del foglio: 25 giorni, non «un mese».
    expect(giorniDiConta('2026-06-07T00:00:00Z', '2026-07-01T00:00:00Z')).toBeCloseTo(24, 3)
  })

  it('la conta ancora aperta arriva fino ad ADESSO', () => {
    const dieciGiorniFa = new Date(Date.now() - 10 * 86400000).toISOString()
    expect(giorniDiConta(dieciGiorniFa)).toBeCloseTo(10, 1)
  })

  // Una conta aperta e chiusa in tre ore darebbe un consumo settimanale di
  // otto volte quello vero, e su quel numero si decide quanto ordinare.
  it('sotto un giorno pieno non si dice niente', () => {
    expect(giorniDiConta('2026-06-07T00:00:00Z', '2026-06-07T03:00:00Z')).toBeNull()
    expect(giorniDiConta('2026-06-07T00:00:00Z', '2026-06-07T00:00:00Z')).toBeNull()
  })

  it('senza date, o con date storte, niente numero', () => {
    expect(giorniDiConta(null, '2026-07-01T00:00:00Z')).toBeNull()
    expect(giorniDiConta('boh', '2026-07-01T00:00:00Z')).toBeNull()
  })
})

describe('il consumo a settimana', () => {
  // SI ARROTONDA: 1500 / 14 × 7 in virgola mobile fa 749,9999999999999, e
  // chi scrive le quantità su quel numero non riconosce più i 75 cl tondi
  // e stampa «750 ml» — lo stesso consumo scritto in due modi diversi.
  it('esce tondo, non con la coda della virgola mobile', () => {
    expect(consumoSettimanale(1500, 14)).toBe(750)
  })

  it('è il consumo diviso i giorni veri, per sette', () => {
    // 1400 ml in 14 giorni = 700 a settimana.
    expect(consumoSettimanale(1400, 14)).toBeCloseTo(700, 3)
    // Sei settimane divise per la costante 4 darebbero il 50% in più.
    expect(consumoSettimanale(4200, 42)).toBeCloseTo(700, 3)
  })

  // UN CONSUMO INVENTATO MANDA A ORDINARE MERCE CHE NON SERVE: dove non si
  // può calcolare, il numero non si mostra.
  it('senza giorni o senza consumo non si inventa niente', () => {
    expect(consumoSettimanale(1400, null)).toBeNull()
    expect(consumoSettimanale(null, 14)).toBeNull()
    expect(consumoSettimanale(1400, 0)).toBeNull()
  })
})

describe('purchaseOrderTotals', () => {
  it('somma netto, lordo e confezioni', () => {
    const t = purchaseOrderTotals([
      { qty_packages: 2, unit_cost: 10, vat: 22 }, // 20 netto, 24.4 lordo
      { qty_packages: 3, unit_cost: 1, vat: 0 }, // 3 netto, 3 lordo
    ])
    expect(t.net).toBeCloseTo(23, 3)
    expect(t.gross).toBeCloseTo(27.4, 3)
    expect(t.pieces).toBe(5)
  })
  it('ordine vuoto', () => {
    expect(purchaseOrderTotals([])).toEqual({ net: 0, gross: 0, pieces: 0 })
  })
})

describe('consumptionDiff (modifica ordine con scorte già scalate)', () => {
  const oldCons = [
    { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 500 },
    { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 40 },
  ]
  it('quantità aumentata → delta positivo (da scalare)', () => {
    const d = consumptionDiff(oldCons, [
      { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 750 },
      { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 40 },
    ])
    expect(d).toEqual([{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', delta: 250 }])
  })
  it('ingrediente rimosso → delta negativo (torna a magazzino)', () => {
    const d = consumptionDiff(oldCons, [
      { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 500 },
    ])
    expect(d).toEqual([{ inventory_item_id: 'lime', name: 'Lime', unit: 'ml', delta: -40 }])
  })
  it('ingrediente nuovo → delta positivo pieno', () => {
    const d = consumptionDiff([], [{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 50 }])
    expect(d).toEqual([{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', delta: 50 }])
  })
  it('consumi identici → nessun delta', () => {
    expect(consumptionDiff(oldCons, oldCons)).toEqual([])
  })
})

// `invoiceTotals` non sta piu' qui: e' passato in src/lib/fatture.js con
// BUG-100, perche' da quando una nota di credito sottrae i totali devono
// conoscere i tipi di documento. Le sue prove stanno in
// tests/unit/fatture.test.js, insieme al segno.

describe('suggestedPackages (riordino GENERATORE ORDINI)', () => {
  it('sotto soglia: riporta a 2x la soglia in confezioni (minimo 1)', () => {
    // soglia 140 cl, in casa 60, conf. 70 cl -> servono 220 cl -> 4 conf.
    expect(
      suggestedPackages({ stock: 60, low_threshold: 140, package_size: 70, unit: 'cl' })
    ).toBe(4)
    // appena sotto soglia: almeno una confezione
    expect(
      suggestedPackages({ stock: 139, low_threshold: 140, package_size: 700, unit: 'cl' })
    ).toBe(1)
    // a pezzi: 1 conf. = 1 pz
    expect(suggestedPackages({ stock: 1, low_threshold: 4, unit: 'pz' })).toBe(7)
  })

  it('niente suggerimento sopra soglia o senza soglia/confezione', () => {
    expect(suggestedPackages({ stock: 500, low_threshold: 140, package_size: 70 })).toBe(0)
    expect(suggestedPackages({ stock: 10, low_threshold: 0, package_size: 70 })).toBe(0)
    expect(suggestedPackages({ stock: 10, low_threshold: 40, package_size: 0, unit: 'cl' })).toBe(0)
  })
})

describe('purchaseOrderText', () => {
  it('testo pronto per email/copia con righe e totali', () => {
    const txt = purchaseOrderText({
      supplier_name: 'NOVA',
      created_at: '2026-07-13T10:00:00.000Z',
      lines: [
        { qty_packages: 4, name: 'Rum bianco' },
        { qty_packages: 2, name: 'Tonica' },
      ],
      total_net: 100,
      total_gross: 122,
    })
    expect(txt).toContain('Fornitore: NOVA')
    expect(txt).toContain('- 4× Rum bianco')
    expect(txt).toContain('- 2× Tonica')
    expect(txt).toContain('Totale ivato: 122.00')
  })
})

describe('parseSupplierList (import elenco fornitori)', () => {
  it('un nome per riga, ";email" opzionale, duplicati e vuoti saltati', () => {
    const text = ['NOVA', 'ENOFEL;ordini@enofel.it', '', 'nova', '  FONT  '].join(String.fromCharCode(10))
    expect(parseSupplierList(text)).toEqual([
      { name: 'NOVA', email: null },
      { name: 'ENOFEL', email: 'ordini@enofel.it' },
      { name: 'FONT', email: null },
    ])
  })
})
