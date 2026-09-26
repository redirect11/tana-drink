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
// E DAL 23/09 (BUG-112) la chiusura calcola da sé la differenza di ogni
// prodotto, sull'atteso dell'ora del conteggio, e la SOMMA alla giacenza:
// riportarla al numero contato cancellava le vendite fatte dopo.
//
// Le cose che qui si sorvegliano:
//   1. la chiusura è UN pacchetto — giacenze, movimenti, «chiuso» e il
//      prossimo inventario — e non aspetta la rete per dire com'è andata;
//   2. applica la differenza, e le vendite dopo il conteggio restano;
//   3. le rimanenze vanno sul database mentre si scrivono, con la loro ora.
//
// Come in giroInLocale.test.js la rete non c'è: ogni scrittura resta
// appesa per sempre, e le letture rispondono con quello che c'era prima.
// Si mocka solo Firestore, non api.js.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})
const stato = { articoli: {}, conta: null, movimenti: [], scritture: [], pacchetti: [] }

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

// Le letture di collezione, secondo cosa chiedono: gli articoli (la
// collezione intera), i movimenti o l'inventario aperto (con una query).
const leggiTanti = async (ref) => {
  const nome = ref?.__col || ref?.__q
  if (nome === 'inventory_items') {
    const docs = Object.entries(stato.articoli).map(([id, a]) => ({ id, data: () => a }))
    return { empty: docs.length === 0, docs }
  }
  if (nome === 'stock_movements') {
    const docs = stato.movimenti.map((m, i) => ({ id: `m${i}`, data: () => m }))
    return { empty: docs.length === 0, docs }
  }
  return {
    empty: !stato.conta,
    docs: stato.conta ? [{ id: 'inv-1', data: () => stato.conta }] : [],
  }
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
  getDocs: vi.fn(leggiTanti),
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
  query: (col) => ({ __q: col?.__col }),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => '__ora_del_server__',
  increment: (n) => ({ incremento: n }),
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
const tondo = (n) => Math.round(n * 100) / 100

const articolo = (nome, stock) => ({ name: nome, unit: 'pz', stock, package_size: 700, content_unit: 'ml', low_threshold: 0 })
const riga = (id, nome, dep, rim, rim_at = null) => ({
  item_id: id,
  name: nome,
  unit: 'pz',
  package_size: 700,
  cost: 14,
  vat: 22,
  dep,
  rim,
  rim_at,
})

beforeEach(() => {
  stato.articoli = {
    gin: articolo('400 Conigli Gin', -0.1),
    jager: articolo('Jagermeister', 3.2),
    lete: articolo('Acqua Lete', 66),
  }
  stato.conta = { status: 'open', started_at: '2026-09-21T18:03:40.000Z', lines: [] }
  stato.movimenti = []
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
    await subito(api.closeStockCount('inv-1', { lines: righe() }))
  })

  // IL CUORE DI BUG-110. Nessuna scrittura sciolta: se una giacenza o il
  // segno «chiuso» passassero da updateDoc/addDoc, un'interruzione a metà
  // tornerebbe a lasciare il magazzino mezzo allineato.
  it('scrive tutto in UN pacchetto, e nient’altro fuori', async () => {
    await subito(api.closeStockCount('inv-1', { lines: righe() }))
    await giro()
    expect(stato.scritture).toEqual([])
    expect(stato.pacchetti).toHaveLength(1)
    const [p] = stato.pacchetti
    expect(p.spedito).toBe(true)
    // La differenza fra contato e giacenza, sommata.
    const giacenze = p.scritture.filter((s) => s.col === 'inventory_items')
    expect(giacenze.map((s) => [s.id, tondo(s.patch.stock.incremento)])).toEqual([
      ['gin', 0.2],
      ['jager', -2.3],
      ['lete', -39],
    ])
    // Un movimento di rettifica per ogni giacenza toccata, nello stesso pacchetto.
    expect(p.scritture.filter((s) => s.col === 'stock_movements')).toHaveLength(3)
    const chiusa = p.scritture.find((s) => s.col === 'stock_counts' && s.id === 'inv-1')
    expect(chiusa.patch.status).toBe('closed')
    // Le righe salvate sono quelle calcolate qui, con la loro differenza.
    expect(chiusa.patch.lines.map((l) => tondo(l.diff))).toEqual([0.2, -2.3, -39])
  })

  // Il prossimo inventario nasce nello stesso pacchetto, e parte da quello
  // che si è appena contato. Flavio, il 22/09: «da adesso mi dovrebbe
  // apparire il reale come deposito, 0,1 pz, e 0 come acquisti».
  it('il prossimo nasce nello stesso pacchetto, con DEP = la giacenza allineata', async () => {
    // Uno non contato riparte dalla giacenza che ha.
    stato.articoli.cynar = articolo('Cynar', 0.4)
    const { prossimo } = await subito(api.closeStockCount('inv-1', { lines: righe(), riapri: true }))
    const dep = Object.fromEntries(prossimo.lines.map((l) => [l.item_id, [tondo(l.dep), l.acq]]))
    expect(dep).toEqual({ gin: [0.1, 0], jager: [0.9, 0], lete: [27, 0], cynar: [0.4, 0] })
    expect(prossimo.status).toBe('open')

    await giro()
    const nuovo = stato.pacchetti[0].scritture.find((s) => s.tipo === 'set' && s.col === 'stock_counts')
    expect(Object.fromEntries(nuovo.data.lines.map((l) => [l.item_id, tondo(l.dep)]))).toEqual({
      gin: 0.1,
      jager: 0.9,
      lete: 27,
      cynar: 0.4,
    })
    // Stesso orario dei movimenti di rettifica: la query «dopo l'apertura»
    // non se li ritrova fra quelli del periodo nuovo.
    const mov = stato.pacchetti[0].scritture.find((s) => s.col === 'stock_movements')
    expect(nuovo.data.started_at).toBe(mov.data.created_at)
  })

  it('senza riapertura, il prossimo non nasce', async () => {
    const { prossimo } = await subito(api.closeStockCount('inv-1', { lines: righe() }))
    expect(prossimo).toBeNull()
  })

  // BUG-112: contato 2,5 alle 18, vendute due bottiglie alle 22 (la
  // giacenza scende da 2,8 a 0,8). La differenza è quella delle 18 — 2,5
  // contati contro 2,8 attesi, −0,3 — e la chiusura la SOMMA: riportare la
  // giacenza a 2,5 avrebbe cancellato le due bottiglie vendute.
  it('applica la differenza, e le vendite dopo il conteggio restano', async () => {
    stato.articoli.jager = articolo('Jagermeister', 0.8)
    stato.movimenti = [
      { item_id: 'jager', type: 'unload', qty: 1400, unit: 'ml', reason: 'ordine', created_at: '2026-09-23T20:00:00.000Z' },
    ]
    await subito(
      api.closeStockCount('inv-1', {
        lines: [riga('jager', 'Jagermeister', 3.2, 2.5, '2026-09-23T16:00:00.000Z')],
      })
    )
    await giro()
    const [p] = stato.pacchetti
    const giacenza = p.scritture.find((s) => s.col === 'inventory_items')
    expect(tondo(giacenza.patch.stock.incremento)).toBe(-0.3)
    const m = p.scritture.find((s) => s.col === 'stock_movements')
    expect([m.data.type, tondo(m.data.qty), m.data.reason]).toEqual(['unload', 0.3, 'conta'])
  })

  it('e con differenza zero non tocca la giacenza', async () => {
    await subito(api.closeStockCount('inv-1', { lines: [riga('jager', 'Jagermeister', 3.2, 3.2)] }))
    await giro()
    expect(stato.pacchetti[0].scritture.filter((s) => s.col === 'inventory_items')).toEqual([])
  })

  // Un prodotto ancora da convertire ferma TUTTO prima di scrivere: il
  // contrario di quello che è successo il 21/09, dove ci si fermava a metà.
  it('se un prodotto non si può scrivere, non parte niente', async () => {
    stato.articoli.lete = { name: 'Acqua Lete', unit: 'cl', stock: 3300, package_size: 50 }
    await expect(api.closeStockCount('inv-1', { lines: righe() })).rejects.toThrow(
      /aggiornato il magazzino/
    )
    await giro()
    expect(stato.pacchetti.every((p) => !p.spedito)).toBe(true)
    expect(stato.scritture).toEqual([])
  })
})

describe('le rimanenze mentre si conta', () => {
  // Con la sua ora (BUG-112): la differenza si misura sull'atteso di quel
  // momento, non su quello della chiusura.
  it('si salvano una alla volta, con l’ora, senza aspettare la rete', async () => {
    api.salvaRimanenza('inv-1', 'jager', '0.9', '2026-09-23T16:00:00.000Z')
    await giro()
    expect(stato.scritture).toEqual([
      {
        tipo: 'update',
        col: 'stock_counts',
        id: 'inv-1',
        patch: { 'rimanenze.jager': 0.9, 'rimanenze_ora.jager': '2026-09-23T16:00:00.000Z' },
      },
    ])
  })

  it('un campo svuotato toglie la rimanenza e la sua ora, non scrive zero', async () => {
    api.salvaRimanenza('inv-1', 'jager', '')
    await giro()
    expect(stato.scritture[0].patch).toEqual({
      'rimanenze.jager': '__cancella__',
      'rimanenze_ora.jager': '__cancella__',
    })
  })

  // Riaprendo la schermata — o un altro telefono — i numeri ci sono ancora.
  it('e riaprendo l’inventario si ritrovano', async () => {
    stato.conta = {
      status: 'open',
      lines: [riga('jager', 'Jagermeister', 3.2, null), riga('lete', 'Acqua Lete', 66, null)],
      rimanenze: { jager: 0.9 },
      rimanenze_ora: { jager: '2026-09-23T16:00:00.000Z' },
    }
    const aperta = await api.getOpenStockCount()
    expect(aperta.lines.map((l) => l.rim)).toEqual([0.9, null])
    expect(aperta.lines[0].rim_at).toBe('2026-09-23T16:00:00.000Z')
  })
})
