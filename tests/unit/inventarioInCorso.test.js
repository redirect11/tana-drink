'use strict'

// ── L'INVENTARIO COME IL FOGLIO INV DI FLAVIO (REQ-MAG-046, BUG-112) ──
//
// DEP · ACQ · CONS · RIM, con CONS = DEP + ACQ − RIM. Lo schema l'ha chiuso
// Flavio il 25/09/2026 sera, dopo aver provato i casi veri: «ordine a
// fornitore consegnato carica il magazzino e va negli acquisti; su prodotti
// il carico è solo positivo e va negli acquisti; il contenuto reale serve
// per le modifiche in positivo e in negativo, e va sulle rimanenze di
// magazzino — quindi mi modifica sia la rimanenza sia il consumato».
//
// Qui si sorvegliano le quattro colonne, dove finisce ogni movimento, e
// l'ora del conteggio: senza, la chiusura cancellerebbe le vendite fatte fra
// il conteggio e la chiusura (BUG-112).

import { describe, it, expect } from 'vitest'
import { righeInventario } from '../../src/lib/inventarioInCorso.js'

// Una bottiglia da 1 litro contata a pezzi, 13,80 € + IVA 22%.
const JAGER = {
  id: 'jager',
  name: 'Jagermeister',
  unit: 'pz',
  package_size: 1000,
  content_unit: 'ml',
  stock: 2.8,
  cost: 13.8,
  vat: 22,
}
const riga = (over = {}) => ({
  item_id: 'jager',
  name: 'Jagermeister',
  unit: 'pz',
  package_size: 1000,
  cost: 13.8,
  vat: 22,
  dep: 3.2,
  rim: null,
  ...over,
})
const mov = (type, qty, reason, created_at, unit = 'pz') => ({
  item_id: 'jager',
  type,
  qty,
  unit,
  reason,
  created_at,
})
const una = (lines, opts) => righeInventario(lines, { items: [JAGER], ...opts }).lines[0]
const ieri = '2026-09-22T20:00:00.000Z'

describe('le quattro colonne', () => {
  // Il Jager all'apertura 3,2; dieci shot da 40 ml venduti; adesso 2,8.
  it('DEP, ACQ, RIM (la giacenza di adesso) e CONS = DEP + ACQ − RIM', () => {
    const l = una([riga()], { movimenti: [mov('unload', 400, 'ordine', ieri, 'ml')] })
    expect([l.dep, l.acq, l.atteso, l.cons]).toEqual([3.2, 0, 2.8, 0.4])
    // Senza contato non c'è niente da correggere alla chiusura.
    expect(l.diff).toBeNull()
  })

  // Scritto il contato, la RIM è quella: il consumo comprende anche quello
  // che manca. Contati 0,9 dove l'app ne aspettava 2,8.
  it('col contato la RIM è quella scritta, e il consumo la segue', () => {
    const l = una([riga({ rim: 0.9 })], { movimenti: [mov('unload', 400, 'ordine', ieri, 'ml')] })
    expect(l.rim_adesso).toBe(0.9)
    expect(l.cons).toBeCloseTo(2.3, 6)
    // La differenza che la chiusura applica alla giacenza.
    expect(l.diff).toBe(-1.9)
    expect(l.diff_value).toBeCloseTo(-31.99, 2)
  })
})

// ── DOVE FINISCE OGNI MOVIMENTO ───────────────────────────────────────
describe('dove finisce ogni movimento', () => {
  it('l’ordine consegnato e il carico da Prodotti vanno in ACQ', () => {
    const l = righeInventario([riga()], {
      items: [{ ...JAGER, stock: 6.2 }],
      movimenti: [mov('load', 1, 'carico', ieri), mov('load', 2, 'ordine fornitore', ieri)],
    }).lines[0]
    expect(l.acq).toBe(3)
    // Merce entrata e rimasta sullo scaffale: niente consumo.
    expect(l.cons).toBe(0)
  })

  // Il caso di Flavio del 24/09: la Schweppes al pompelmo rosa a −8,
  // arrivano 22 bottiglie (il magazzino va a 14), lui ne conta 24 e le
  // scrive come contenuto reale. Il contenuto reale NON tocca DEP e ACQ: va
  // sulla RIM, e di conseguenza sul consumo.
  it('il contenuto reale non tocca né DEP né ACQ: sposta RIM e CONS', () => {
    const l = righeInventario([riga({ dep: -8 })], {
      items: [{ ...JAGER, stock: 24 }],
      movimenti: [
        mov('load', 22, 'ordine fornitore', '2026-09-24T10:00:00.000Z'),
        mov('load', 10, 'rettifica', '2026-09-24T14:00:00.000Z'),
      ],
    }).lines[0]
    expect([l.dep, l.acq, l.atteso]).toEqual([-8, 22, 24])
    // −8 + 22 − 24: dieci bottiglie in più di quelle che risultavano.
    expect(l.cons).toBe(-10)
  })

  // Il 21/09 una chiusura interrotta ha scritto le sue rettifiche DENTRO il
  // periodo: vanno come il contenuto reale, sulla RIM.
  it('una rettifica d’inventario dentro il periodo va sulla RIM', () => {
    const l = righeInventario([riga({ dep: -0.1 })], {
      items: [{ ...JAGER, stock: 0.1 }],
      movimenti: [mov('load', 0.2, 'conta', ieri)],
    }).lines[0]
    expect([l.dep, l.acq, l.atteso]).toEqual([-0.1, 0, 0.1])
  })

  it('le vendite, convertite dai ml delle ricette, abbassano la RIM', () => {
    const l = righeInventario([riga()], {
      items: [{ ...JAGER, stock: 3.16 }],
      movimenti: [mov('unload', 40, 'ordine', ieri, 'ml')],
    }).lines[0]
    expect(l.cons).toBe(0.04)
  })

  // Un prodotto cancellato: senza articolo non si sa in che unità sia
  // quella quantità, e un numero convertito a caso è peggio di niente.
  it('i movimenti di un prodotto che non c’è più non si contano', () => {
    const { lines } = righeInventario([riga()], {
      items: [],
      movimenti: [mov('load', 5, 'carico', ieri)],
    })
    expect(lines[0].acq).toBe(0)
  })
})

// ── L'ORA DEL CONTEGGIO (BUG-112) ────────────────────────────────────
// Si conta a locale aperto. Il Jager contato alle 18 e venduto fino a
// mezzanotte: la differenza va misurata sull'atteso DELLE 18. Prima la
// chiusura portava la giacenza al numero delle 18, e le vendite fatte dopo
// sparivano.
describe('l’ora del conteggio', () => {
  const alle18 = '2026-09-23T16:00:00.000Z'
  const alle22 = '2026-09-23T20:00:00.000Z'

  it('le vendite dopo il conteggio non sono merce sparita', () => {
    // Contato 2,8 alle 18, quando l'app ne aspettava 2,8. Alle 22 si
    // vendono 400 ml: adesso l'atteso è 2,4, ma la differenza resta zero.
    const l = righeInventario([riga({ rim: 2.8, rim_at: alle18 })], {
      items: [{ ...JAGER, stock: 2.4 }],
      movimenti: [mov('unload', 400, 'ordine', alle22, 'ml')],
    }).lines[0]
    expect(l.atteso).toBe(2.4)
    expect(l.diff).toBe(0)
    // E la RIM di adesso è il contato meno quello uscito dopo.
    expect(l.rim_adesso).toBe(2.4)
  })

  it('le vendite prima del conteggio sì, contano', () => {
    const l = righeInventario([riga({ rim: 2.8, rim_at: alle22 })], {
      items: [{ ...JAGER, stock: 2.4 }],
      movimenti: [mov('unload', 400, 'ordine', alle18, 'ml')],
    }).lines[0]
    // Alle 22 l'app ne aspettava 2,4 e ne sono stati contati 2,8.
    expect(l.diff).toBe(0.4)
  })

  // Un drink appena battuto da questo dispositivo non ha ancora l'ora del
  // server: è per forza dopo un conteggio già scritto.
  it('un movimento senza ora è dopo il conteggio', () => {
    const l = righeInventario([riga({ rim: 2.8, rim_at: alle18 })], {
      items: [{ ...JAGER, stock: 2.4 }],
      movimenti: [mov('unload', 400, 'ordine', null, 'ml')],
    }).lines[0]
    expect(l.diff).toBe(0)
  })

  // Le rimanenze scritte con la 1.6.1 (o sistemate a mano il 23/09) non
  // hanno ora: valgono come contate adesso, che era il comportamento di prima.
  it('una rimanenza senza ora vale come contata adesso', () => {
    const l = righeInventario([riga({ rim: 2 })], {
      items: [{ ...JAGER, stock: 2.4 }],
      movimenti: [mov('unload', 400, 'ordine', alle22, 'ml')],
    }).lines[0]
    expect(l.diff).toBe(-0.4)
  })
})

describe('i totali e il consumo a settimana', () => {
  it('sommano consumo, rimanenze e differenza in €, e contano i contati', () => {
    const { totals } = righeInventario(
      [riga({ rim: 0.9 }), riga({ item_id: 'altro', name: 'Altro', dep: 0 })],
      { items: [JAGER], movimenti: [mov('unload', 400, 'ordine', ieri, 'ml')] }
    )
    expect(totals.counted).toBe(1)
    expect(totals.cons_value).toBeCloseTo(38.72, 2) // 2,3 × 16,836
    expect(totals.rim_value).toBeCloseTo(15.15, 2) // 0,9 × 16,836
    expect(totals.diff_value).toBeCloseTo(-31.99, 2)
  })

  // L'esempio del foglio INV, in unità base: 2000 ml + 1000 − 1500 = 1500
  // ml usciti in quattordici giorni, 750 a settimana.
  it('il consumo a settimana si divide per i giorni veri del periodo', () => {
    const { lines, giorni } = righeInventario(
      [{ item_id: 'a', name: 'Gin Mare', unit: 'ml', package_size: 1000, cost: 10, vat: 0, dep: 2000, rim: 1500 }],
      {
        items: [{ id: 'a', unit: 'ml', package_size: 1000, stock: 3000 }],
        movimenti: [{ item_id: 'a', type: 'load', qty: 1000, unit: 'ml', reason: 'carico', created_at: '2026-06-10T10:00:00.000Z' }],
        dal: '2026-06-07T00:00:00Z',
        al: '2026-06-21T00:00:00Z',
      }
    )
    expect(giorni).toBeCloseTo(14, 3)
    expect(lines[0].cons).toBe(1500)
    expect(lines[0].cons_week).toBeCloseTo(750, 3)
  })
})
