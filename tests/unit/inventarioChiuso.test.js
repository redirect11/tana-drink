'use strict'

// UN INVENTARIO CHIUSO SI RILEGGE TUTTO (REQ-MAG-052). Flavio, 15/10/2026:
// «la lista degli inventari con la data di apertura e la data di chiusura …
// ci clicco sopra e lo vedo; la casella rimanenze risulta bloccata». Gli
// inventari sono stati scritti da tre versioni diverse dell'app, e lo
// storico deve aprirli tutti: quelli della 1.8 con tutto (rim_adesso, cons,
// valori, totali), quelli di prima con dep · acq · rim · cons e basta.

import { describe, it, expect } from 'vitest'
import { righeInventarioChiuso, rimanenzaChiusa } from '../../src/lib/inventarioChiuso.js'

// Due settimane tonde: il consumo a settimana è la metà.
const DAL = '2026-06-07T00:00:00.000Z'
const AL = '2026-06-21T00:00:00.000Z'

describe('righeInventarioChiuso', () => {
  it('un inventario della 1.8 si legge com’è stato scritto, col consumo a settimana rifatto dai giorni', () => {
    const conta = {
      started_at: DAL,
      closed_at: AL,
      totals: { counted: 1, cons_value: 15, rim_value: 5 },
      lines: [
        {
          item_id: 'a', name: 'Gin Mare', unit: 'ml', package_size: 700, cost: 7, vat: 22,
          dep: 2000, acq: 0, rim: 480, rim_at: '2026-06-20T18:00:00.000Z', atteso: 500,
          rim_adesso: 500, diff: 0, cons: 1500, cons_value: 15, rim_value: 5,
        },
      ],
    }
    const r = righeInventarioChiuso(conta)
    expect(r.giorni).toBe(14)
    expect(r.totals).toEqual({ counted: 1, cons_value: 15, rim_value: 5 })
    const [l] = r.lines
    // La RIM è quella portata all'ora della chiusura, non il contato delle 18.
    expect(l.rim).toBe(500)
    expect(l.contata).toBe(true)
    expect(l.cons).toBe(1500)
    expect(l.cons_week).toBe(750)
    expect(l.cons_value).toBe(15)
  })

  it('un inventario vecchio, senza valori né totali, li ricava dalle righe', () => {
    const conta = {
      started_at: DAL,
      closed_at: AL,
      totals: null,
      lines: [
        // Contato: 1 pz su 3 + 1 → consumo 3 pz a 10 € (IVA 22%: 12,20 €).
        { item_id: 'a', name: 'Cynar', unit: 'pz', cost: 10, vat: 22, dep: 3, acq: 1, rim: 1 },
        // Non contato e senza consumo scritto: niente da inventare.
        { item_id: 'b', name: 'Acqua', unit: 'pz', cost: 1, vat: 22, dep: 5, acq: 0, rim: null },
      ],
    }
    const r = righeInventarioChiuso(conta)
    const [cynar, acqua] = r.lines
    expect(cynar.cons).toBe(3)
    expect(cynar.cons_value).toBe(36.6)
    expect(cynar.rim_value).toBe(12.2)
    expect(acqua.rim).toBeNull()
    expect(acqua.cons).toBeNull()
    expect(acqua.contata).toBe(false)
    expect(r.totals).toMatchObject({ counted: 1, cons_value: 36.6, rim_value: 12.2 })
  })

  it('senza chiusura o con un periodo troppo corto, niente consumo a settimana', () => {
    const r = righeInventarioChiuso({
      started_at: DAL,
      closed_at: '2026-06-07T06:00:00.000Z',
      lines: [{ item_id: 'a', name: 'Cynar', unit: 'pz', dep: 3, acq: 0, rim: 1, cons: 2 }],
    })
    expect(r.giorni).toBeNull()
    expect(r.lines[0].cons_week).toBeNull()
  })
})

describe('rimanenzaChiusa', () => {
  it('preferisce la RIM alla chiusura, poi il contato, poi l’atteso', () => {
    expect(rimanenzaChiusa({ rim_adesso: 5, rim: 4, atteso: 3 })).toBe(5)
    expect(rimanenzaChiusa({ rim: 4, atteso: 3 })).toBe(4)
    expect(rimanenzaChiusa({ atteso: 3 })).toBe(3)
    expect(rimanenzaChiusa({ rim: '' })).toBeNull()
  })
})
