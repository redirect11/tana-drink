// @vitest-environment happy-dom
'use strict'

// ── L'INVENTARIO SI CHIUDE IN UN PACCHETTO SOLO (BUG-110) ────────────
//
// Il 21/09/2026 Flavio ha contato tutto il magazzino dal telefono e ha
// premuto «Chiudi l'inventario». La chiusura scriveva un prodotto alla
// volta, aspettando il server a ogni giacenza e a ogni movimento, e il
// segno «chiuso» arrivava per ultimo. Dopo 27 secondi si è fermata, a
// «Fever Tree Indian» (riga 154 di 403): 62 prodotti allineati, il resto
// no — Jagermeister compreso, che nelle scorte diceva ancora 3,16 contro
// uno 0,9 contato — l'inventario rimasto aperto, e i numeri scritti
// persi, perché stavano solo sullo schermo.
//
// Le due cose che qui si sorvegliano:
//   1. la chiusura è UN pacchetto — giacenze, movimenti, «chiuso» e il
//      prossimo inventario — e non aspetta la rete per dire com'è andata;
//   2. le rimanenze vanno sul database mentre si scrivono.
//
// Come in giroInLocale.test.js la rete non c'è: ogni scrittura resta
// appesa per sempre, e le letture rispondono con quello che c'era prima.
// Si mocka solo Firestore, non api.js.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})
const stato = { articoli: {}, conta: null, scritture: [], pacchetti: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

const leggi = async (ref) => {
  if (ref?.col === 'inventory_items') {
    const a = stato.articoli[ref.id]
    return { exists: () => !!a, id: ref.id, data: () => a }
  }
  if (ref?.col === 'stock_counts') {
    return { exists: () => !!stato.conta, id: ref.id, data: () => stato.conta }
  }
  return { exists: () => false, data: () => ({}) }
}

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: (...args) => {
    if (args.length >= 3) return { col: args[1], id: args[2] }
    // doc(collezione): un id nuovo, come fa Firestore
    return { col: args[0]?.__col || 'x', id: `nuovo-${args[0]?.__col}` }
  },
  getDoc: vi.fn(leggi),
  getDocFromCache: vi.fn(leggi),
  getDocs: vi.fn(async () => ({
    empty: !stato.conta,
    docs: stato.conta ? [{ id: 'inv-1', data: () => stato.conta }] : [],
  })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((_c, data) => {
    stato.scritture.push({ tipo: 'add', data })
    return mai()
  }),
  setDoc: vi.fn(() => mai()),
  updateDoc: vi.fn((ref, patch) => {
    stato.scritture.push({ tipo: 'update', col: ref?.col, id: ref?.id, patch })
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
  serverTimestamp: () => '__ora_del_server__',
  increment: (n) => n,
  writeBatch: () => {
    const p = { scritture: [], spedito: false }
    stato.pacchetti.push(p)
    return {
      update: (ref, patch) => p.scritture.push({ tipo: 'update', col: ref.col, id: ref.id, patch }),
      set: (ref, data) => p.scritture.push({ tipo: 'set', col: ref.col, id: ref.id, data }),
      commit: () => {
        p.spedito = true
        return mai()
      },
    }
  },
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

const subito = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])
// bgWrite fa partire la scrittura al giro successivo: si aspetta quel giro.
const giro = () => new Promise((r) => setTimeout(r, 0))

const articolo = (nome, stock) => ({ name: nome, unit: 'pz', stock, package_size: 700, content_unit: 'ml', low_threshold: 0 })
const riga = (id, nome, dep, rim) => ({ item_id: id, name: nome, unit: 'pz', package_size: 700, cost: 14, vat: 22, dep, acq: 0, rim })

beforeEach(() => {
  stato.articoli = {
    gin: articolo('400 Conigli Gin', -0.1),
    jager: articolo('Jagermeister', 3.2),
    lete: articolo('Acqua Lete', 66),
  }
  stato.conta = { status: 'open', lines: [] }
  stato.scritture = []
  stato.pacchetti = []
})

describe('la chiusura, senza rete', () => {
  const righe = () => [
    riga('gin', '400 Conigli Gin', -0.1, 0.1),
    riga('jager', 'Jagermeister', 3.2, 0.9),
    riga('lete', 'Acqua Lete', 66, 27),
  ]

  it('torna subito, senza aspettare che il pacchetto arrivi', async () => {
    await subito(api.closeStockCount('inv-1', { lines: righe(), totals: {} }))
  })

  // IL CUORE DI BUG-110. Nessuna scrittura sciolta: se una giacenza o il
  // segno «chiuso» passassero da updateDoc/addDoc, un'interruzione a metà
  // tornerebbe a lasciare il magazzino mezzo allineato.
  it('scrive tutto in UN pacchetto, e nient’altro fuori', async () => {
    await subito(api.closeStockCount('inv-1', { lines: righe(), totals: {} }))
    await giro()
    expect(stato.scritture).toEqual([])
    expect(stato.pacchetti).toHaveLength(1)
    const [p] = stato.pacchetti
    expect(p.spedito).toBe(true)
    const giacenze = p.scritture.filter((s) => s.col === 'inventory_items')
    expect(giacenze.map((s) => [s.id, s.patch.stock])).toEqual([
      ['gin', 0.1],
      ['jager', 0.9],
      ['lete', 27],
    ])
    // Un movimento di rettifica per ogni giacenza toccata, nello stesso pacchetto.
    expect(p.scritture.filter((s) => s.col === 'stock_movements')).toHaveLength(3)
    const chiusa = p.scritture.find((s) => s.col === 'stock_counts' && s.id === 'inv-1')
    expect(chiusa.patch.status).toBe('closed')
  })

  // Il prossimo inventario nasce nello stesso pacchetto, e parte da quello
  // che si è appena contato. Flavio, il 22/09: «da adesso mi dovrebbe
  // apparire il reale come deposito, 0,1 pz, e 0 come acquisti».
  it('il prossimo nasce nello stesso pacchetto, con DEP = la rimanenza contata', async () => {
    const riapri = [
      { id: 'gin', name: '400 Conigli Gin', unit: 'pz', stock: -0.1, cost: 28 },
      { id: 'jager', name: 'Jagermeister', unit: 'pz', stock: 3.2, cost: 13.8 },
      { id: 'lete', name: 'Acqua Lete', unit: 'pz', stock: 66, cost: 0.17 },
      // Uno non contato riparte dalla giacenza che ha.
      { id: 'cynar', name: 'Cynar', unit: 'pz', stock: 0.4, cost: 12.9 },
    ]
    const prossimo = await subito(api.closeStockCount('inv-1', { lines: righe(), totals: {}, riapri }))
    const dep = Object.fromEntries(prossimo.lines.map((l) => [l.item_id, [l.dep, l.acq]]))
    expect(dep).toEqual({ gin: [0.1, 0], jager: [0.9, 0], lete: [27, 0], cynar: [0.4, 0] })
    expect(prossimo.status).toBe('open')

    await giro()
    const nuovo = stato.pacchetti[0].scritture.find((s) => s.tipo === 'set' && s.col === 'stock_counts')
    expect(nuovo.data.lines.map((l) => l.dep)).toEqual([0.1, 0.9, 27, 0.4])
    // Stesso orario dei movimenti di rettifica: la query «dopo l'apertura»
    // non se li ritrova fra quelli del periodo nuovo.
    const mov = stato.pacchetti[0].scritture.find((s) => s.col === 'stock_movements')
    expect(nuovo.data.started_at).toBe(mov.data.created_at)
  })

  // Un prodotto ancora da convertire ferma TUTTO prima di scrivere: il
  // contrario di quello che è successo il 21/09, dove ci si fermava a metà.
  it('se un prodotto non si può scrivere, non parte niente', async () => {
    stato.articoli.lete = { name: 'Acqua Lete', unit: 'cl', stock: 3300, package_size: 50 }
    await expect(api.closeStockCount('inv-1', { lines: righe(), totals: {} })).rejects.toThrow(
      /aggiornato il magazzino/
    )
    await giro()
    expect(stato.pacchetti.every((p) => !p.spedito)).toBe(true)
    expect(stato.scritture).toEqual([])
  })
})

describe('le rimanenze mentre si conta', () => {
  it('si salvano una alla volta, senza aspettare la rete', async () => {
    api.salvaRimanenza('inv-1', 'jager', '0.9')
    await giro()
    expect(stato.scritture).toEqual([
      { tipo: 'update', col: 'stock_counts', id: 'inv-1', patch: { 'rimanenze.jager': 0.9 } },
    ])
  })

  it('un campo svuotato toglie la rimanenza, non scrive zero', async () => {
    api.salvaRimanenza('inv-1', 'jager', '')
    await giro()
    expect(stato.scritture[0].patch).toEqual({ 'rimanenze.jager': '__cancella__' })
  })

  // Riaprendo la schermata — o un altro telefono — i numeri ci sono ancora.
  it('e riaprendo l’inventario si ritrovano', async () => {
    stato.conta = {
      status: 'open',
      lines: [riga('jager', 'Jagermeister', 3.2, null), riga('lete', 'Acqua Lete', 66, null)],
      rimanenze: { jager: 0.9 },
    }
    const aperta = await api.getOpenStockCount()
    expect(aperta.lines.map((l) => l.rim)).toEqual([0.9, null])
  })
})
