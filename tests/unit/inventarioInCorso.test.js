'use strict'

// ── L'INVENTARIO COME LO LEGGE FLAVIO (REQ-MAG-046, BUG-112) ─────────
//
// Flavio, 23/09/2026: «il vero CONSUMO è la variazione del deposito dovuta
// alla vendita, cioè allo scarico dei prodotti nelle ricette degli items di
// menù. L'inventario è solo un allineamento con il consumo reale: più siamo
// precisi con gli scarichi, meno dovremo intervenire sulle rimanenze».
//
// Quindi una riga non dice più un consumo unico (DEP + ACQ − RIM), che
// mescolava il venduto con la merce sparita: dice DEP, ACQ, VENDUTO,
// ATTESO e, contato il prodotto, la DIFFERENZA — che è quello che la
// chiusura corregge.

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

describe('le colonne di una riga', () => {
  // L'esempio della risposta a Flavio: DEP 3,2 · VENDUTO 0,4 · ATTESO 2,8
  // · CONTATO 0,9 · DIFFERENZA −1,9.
  it('DEP, ACQ, VENDUTO, ATTESO e la differenza col contato', () => {
    const l = una([riga({ rim: 0.9 })], {
      // 400 ml venduti in dieci Jager da 40: le ricette scrivono in ml.
      movimenti: [mov('unload', 400, 'ordine', '2026-09-22T21:00:00.000Z', 'ml')],
    })
    expect([l.dep, l.acq, l.vend, l.atteso, l.rim, l.diff]).toEqual([3.2, 0, 0.4, 2.8, 0.9, -1.9])
    // La differenza in €: 1,9 bottiglie a 16,84 € l'una, col segno.
    expect(l.diff_value).toBeCloseTo(-31.99, 2)
  })

  it('senza contato la differenza non c’è, invece di essercene una finta', () => {
    const l = una([riga()], { movimenti: [] })
    expect(l.diff).toBeNull()
    expect(l.cons).toBeNull()
    expect(l.diff_value).toBe(0)
  })

  // Il «consumo» della storia resta quello che è uscito davvero: venduto più
  // quello che manca. Coi conti che tornano è il numero del foglio INV.
  it('il consumo è venduto più quello che manca, come DEP + ACQ − RIM', () => {
    const l = una([riga({ rim: 0.9 })], {
      movimenti: [mov('unload', 400, 'ordine', '2026-09-22T21:00:00.000Z', 'ml')],
    })
    expect(l.cons).toBeCloseTo(3.2 + 0 - 0.9, 6)
  })
})

// ── DOVE VA OGNI MOVIMENTO (BUG-111, e REQ-MAG-046) ──────────────────
// Flavio, 22/09/2026: «ACQ aumenterà quando carico prodotti da ordine a
// fornitore consegnato e carico diretto; se invece modifico il contenuto
// reale mi modifica il valore del deposito». E 23/09: «utilizzando gli
// items del menù il valore si inizierà a modificare, ma dovrà essere
// registrato come consumato».
describe('dove va ogni movimento', () => {
  const ieri = '2026-09-22T20:00:00.000Z'

  it('ACQ conta carico diretto, ordine consegnato e fattura, col segno', () => {
    const l = una([riga()], {
      movimenti: [
        mov('load', 1, 'carico', ieri),
        mov('load', 2, 'ordine fornitore', ieri),
        mov('unload', 1, 'carico', ieri),
      ],
    })
    expect(l.acq).toBe(2)
  })

  // ── IL CONTENUTO REALE FA RIPARTIRE IL PRODOTTO (REQ-MAG-049) ──
  // Flavio, 24/09/2026: la Schweppes al pompelmo rosa era a −8; arrivano
  // 22 bottiglie dal fornitore e il magazzino va a 14; lui ne conta 24 e le
  // scrive come contenuto reale. «Mi deve azzerare gli acquisti, perché
  // altrimenti se mi segna 24 che tengo e 24 che ho acquistato, nel
  // prossimo inventario me ne porta a 48». Prima la riga diceva DEP 2 ·
  // ACQ 22: il conto tornava, ma si leggeva come due cose sommate.
  const SCHWEPPES = { ...JAGER, id: 'jager', stock: 24 }
  const consegna = mov('load', 22, 'ordine fornitore', '2026-09-24T10:00:00.000Z')
  const reale = mov('load', 10, 'rettifica', '2026-09-24T14:00:00.000Z')

  it('il contenuto reale diventa il DEP, e gli acquisti di prima spariscono', () => {
    const l = righeInventario([riga({ dep: -8 })], { items: [SCHWEPPES], movimenti: [consegna, reale] }).lines[0]
    expect([l.dep, l.acq, l.vend, l.atteso]).toEqual([24, 0, 0, 24])
    // E la riga sa da quando: il DEP a schermo lo dice.
    expect(l.dep_da).toBe('2026-09-24T14:00:00.000Z')
  })

  // Riparte anche il venduto: DEP + ACQ − VENDUTO deve dare lo scaffale, e
  // il DEP nuovo ha già dentro le vendite di prima.
  it('da lì ACQ e VENDUTO ripartono, e contano solo quello che viene dopo', () => {
    const l = righeInventario([riga({ dep: -8 })], {
      items: [{ ...SCHWEPPES, stock: 28 }],
      movimenti: [
        mov('unload', 1, 'ordine', '2026-09-23T22:00:00.000Z'), // prima: già dentro il 24
        consegna,
        reale,
        mov('load', 6, 'carico', '2026-09-24T16:00:00.000Z'),
        mov('unload', 2, 'ordine', '2026-09-24T22:00:00.000Z'),
      ],
    }).lines[0]
    expect([l.dep, l.acq, l.vend, l.atteso]).toEqual([24, 6, 2, 28])
  })

  it('senza correzioni il DEP resta quello dell’apertura', () => {
    const l = una([riga()], { movimenti: [mov('load', 1, 'carico', ieri)] })
    expect(l.dep).toBe(3.2)
    expect(l.dep_da).toBeNull()
  })

  // Il caso del 21/09: una chiusura interrotta a metà ha scritto le sue
  // rettifiche DENTRO il periodo di questo inventario. Valgono come una
  // correzione del contenuto reale, ed è quello che Flavio chiedeva per il
  // 400 Conigli: «da adesso mi dovrebbe apparire il reale come deposito,
  // 0,1 pz, e 0 come acquisti».
  it('anche una rettifica d’inventario dentro il periodo fa ripartire il prodotto', () => {
    const l = righeInventario([riga({ dep: -0.1 })], {
      items: [{ ...JAGER, stock: 0.1 }],
      movimenti: [mov('load', 0.2, 'conta', ieri)],
    }).lines[0]
    expect(l.dep).toBe(0.1)
    expect(l.acq).toBe(0)
  })

  it('le vendite vanno nel VENDUTO, convertite dai ml delle ricette', () => {
    const l = una([riga()], { movimenti: [mov('unload', 40, 'ordine', ieri, 'ml')] })
    expect(l.vend).toBe(0.04)
    expect(l.dep).toBe(3.2)
  })

  // Uno storno è merce che torna sullo scaffale: il venduto scende.
  it('uno storno abbassa il venduto', () => {
    const l = una([riga()], {
      movimenti: [mov('unload', 80, 'ordine', ieri, 'ml'), mov('load', 40, 'storno', ieri, 'ml')],
    })
    expect(l.vend).toBe(0.04)
  })

  // Un prodotto cancellato: senza articolo non si sa in che unità sia
  // quella quantità, e un numero convertito a caso è peggio di niente.
  it('i movimenti di un prodotto che non c’è più non si contano', () => {
    const { lines } = righeInventario([riga()], {
      items: [],
      movimenti: [mov('unload', 400, 'ordine', ieri, 'ml')],
    })
    expect(lines[0].vend).toBe(0)
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
  it('sommano venduto, differenza e rimanenze in €, e contano i contati', () => {
    const { totals } = righeInventario(
      [riga({ rim: 0.9 }), riga({ item_id: 'altro', name: 'Altro', rim: null })],
      { items: [JAGER], movimenti: [mov('unload', 400, 'ordine', '2026-09-22T21:00:00.000Z', 'ml')] }
    )
    expect(totals.counted).toBe(1)
    expect(totals.vend_value).toBeCloseTo(6.73, 2) // 0,4 × 16,836
    expect(totals.diff_value).toBeCloseTo(-31.99, 2)
    expect(totals.rim_value).toBeCloseTo(15.15, 2)
  })

  // L'esempio del foglio INV, in unità base: 2000 ml + 1000 − 1500 = 1500
  // ml usciti in quattordici giorni, 750 a settimana.
  it('il consumo a settimana si divide per i giorni veri del periodo', () => {
    const { lines, giorni } = righeInventario(
      [{ item_id: 'a', name: 'Gin Mare', unit: 'ml', package_size: 1000, cost: 10, vat: 0, dep: 2000, acq: 0, rim: 1500 }],
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
