// @vitest-environment happy-dom
'use strict'

// ── IL CONTROLLO DEL MAGAZZINO, PAGINA DI PROVA (REQ-MAG-050) ─────────
//
// Daniele, 26/09/2026: «fai una nuova pagina inventario come la faresti tu,
// attivabile solo per test». Qui si sorvegliano le tre cose che la rendono
// diversa dall'inventario, e la porta che la tiene fuori dalla produzione:
//   1. si accende solo fuori dalla produzione, e solo con l'interruttore;
//   2. un conteggio corregge SUBITO la giacenza, della differenza, e lascia
//      la sua traccia anche quando torna — senza rete, come ogni gesto;
//   3. il rapporto dà la differenza in euro e i giorni di scorta.
//
// Il conteggio si prova senza rete, come in giroInLocale.test.js: le
// scritture restano appese per sempre, e si mocka solo Firestore.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})
const stato = { scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: (...args) => (args.length >= 3 ? { col: args[1], id: args[2] } : { col: args[0]?.__col, id: 'nuovo' }),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocFromCache: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((col, data) => {
    stato.scritture.push({ tipo: 'add', col: col.__col, data })
    return mai()
  }),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn((ref, patch) => {
    stato.scritture.push({ tipo: 'update', col: ref.col, id: ref.id, patch })
    return mai()
  }),
  deleteDoc: vi.fn(() => mai()),
  deleteField: () => '__cancella__',
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => '__ora__',
  increment: (n) => ({ incremento: n }),
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: () => mai() }),
  Timestamp: class Timestamp {
    static fromDate(d) {
      return d
    }
    static fromMillis(m) {
      return m
    }
  },
}))

const api = await import('../../src/lib/api.js')
const { controlloMagazzinoVisibile, inProduzione } = await import('../../src/lib/prova.js')
const { magazzinoNelPeriodo, giorniDiScorta } = await import('../../src/lib/magazzinoPeriodo.js')

const giro = () => new Promise((r) => setTimeout(r, 0))
const JAGER = { id: 'jager', name: 'Jagermeister', unit: 'pz', package_size: 1000, content_unit: 'ml', stock: 2.8, cost: 13.8, vat: 22 }

beforeEach(() => {
  stato.scritture = []
})

describe('dove si vede', () => {
  // In produzione ci sono i numeri veri del locale: la pagina non c'è,
  // qualunque cosa ci sia scritto nelle impostazioni.
  it('in produzione mai, nemmeno con l’interruttore acceso', () => {
    expect(inProduzione('tana-drink')).toBe(true)
    expect(controlloMagazzinoVisibile({ controllo_magazzino_prova: true }, 'tana-drink')).toBe(false)
  })

  it('sul test solo con l’interruttore acceso', () => {
    expect(controlloMagazzinoVisibile({ controllo_magazzino_prova: true }, 'tana-drink-test')).toBe(true)
    expect(controlloMagazzinoVisibile({ controllo_magazzino_prova: false }, 'tana-drink-test')).toBe(false)
    expect(controlloMagazzinoVisibile({}, 'tana-drink-test')).toBe(false)
  })
})

describe('un conteggio, senza rete', () => {
  it('corregge subito la giacenza della differenza, e lo dice senza aspettare', async () => {
    const { item, diff } = api.registraConteggio(JAGER, '0.9')
    // Composto in memoria: la schermata lo mostra nell'istante del tocco.
    expect(item.stock).toBe(0.9)
    expect(diff).toBeCloseTo(-1.9, 6)
    await giro()
    const giacenza = stato.scritture.find((s) => s.col === 'inventory_items')
    // Col segno, con increment: una vendita battuta nello stesso istante da
    // un altro terminale non si perde.
    expect(giacenza.patch.stock.incremento).toBeCloseTo(-1.9, 6)
    const mov = stato.scritture.find((s) => s.col === 'stock_movements')
    expect([mov.data.type, mov.data.reason]).toEqual(['unload', 'conta'])
  })

  // Anche quando torna: è la traccia che dice «contato il …». Senza, un
  // prodotto giusto sembrerebbe mai controllato.
  it('a differenza zero non tocca la giacenza, ma lascia la traccia', async () => {
    api.registraConteggio(JAGER, '2.8')
    await giro()
    expect(stato.scritture.filter((s) => s.col === 'inventory_items')).toEqual([])
    const mov = stato.scritture.find((s) => s.col === 'stock_movements')
    expect([mov.data.qty, mov.data.reason]).toEqual([0, 'conta'])
  })

  it('un numero negativo o vuoto non è un conteggio', () => {
    expect(() => api.registraConteggio(JAGER, '-1')).toThrow(/da zero in su/)
    expect(() => api.registraConteggio(JAGER, 'x')).toThrow(/da zero in su/)
  })
})

describe('il rapporto', () => {
  const mov = (type, qty, reason, created_at, unit = 'pz') => ({ item_id: 'jager', type, qty, unit, reason, created_at })

  // La differenza in euro, col segno: è il numero che la pagina mette in
  // cima, «quanto si perde».
  it('dà la differenza fra contato e risultante in euro, col segno', () => {
    const { righe, totali } = magazzinoNelPeriodo(
      [mov('unload', 400, 'ordine', '2026-09-20T20:00:00.000Z', 'ml'), mov('unload', 1.9, 'conta', '2026-09-21T10:00:00.000Z')],
      [{ ...JAGER, stock: 0.9 }],
      { dal: '2026-09-15', al: '2026-09-25' }
    )
    expect(righe[0].rett).toBe(-1.9)
    expect(righe[0].rett_valore).toBeCloseTo(-31.99, 2)
    expect(totali.rett_valore).toBeCloseTo(-31.99, 2)
  })

  // Quanto dura la scorta al ritmo del periodo: quello che è uscito davvero
  // (venduto più quello che manca), giorno per giorno.
  it('dice quanti giorni dura la scorta al ritmo del periodo', () => {
    // Inizio 10, entrati 20, fine 15 in 30 giorni: 15 usciti, mezzo al
    // giorno; 15 sullo scaffale fanno 30 giorni.
    expect(giorniDiScorta({ dep: 10, acq: 20, fine: 15 }, 30)).toBe(30)
    // Niente uscito, o niente sullo scaffale: non si dice un numero finto.
    expect(giorniDiScorta({ dep: 5, acq: 0, fine: 5 }, 30)).toBeNull()
    expect(giorniDiScorta({ dep: 5, acq: 0, fine: 0 }, 30)).toBeNull()
  })
})
