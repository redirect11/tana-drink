// @vitest-environment happy-dom
'use strict'

// ── SENZA IL MODULO DEL MAGAZZINO NON SI SCALA (REQ-LIC-008) ─────────
//
// Lo scarico di una vendita parte da solo, al «pronto» e alla chiusura,
// appena una ricetta punta a un articolo di magazzino: anche in un locale
// che il modulo non ce l'ha più (una prova scaduta, un piano più piccolo).
// Da quando le regole rifiutano le scritture sul magazzino senza il
// modulo, ogni vendita lì sarebbe diventata un errore di sincronizzazione
// al banco. Quindi: senza il modulo non si scrive niente; col modulo, e
// quando la licenza non si sa ancora, si scala come sempre.
//
// Come magazzinoSottoZero.test.js: SOLO Firestore finto, scritture appese
// per sempre, `api.js` vero.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ORDER_STATUSES } from '../../src/lib/orderStatus.js'

const mai = () => new Promise(() => {})
const st = vi.hoisted(() => ({ ordine: null, articoli: {}, scritture: [], build: { licenza: null } }))

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1', email: 'banco@tana.it', displayName: 'Banco' } },
  functions: {},
  storage: {},
}))

// La build di questa prova: senza licenza propria, come un locale della regia.
vi.mock('../../src/lib/venue.js', async (originale) => {
  const vero = await originale()
  return {
    ...vero,
    get LICENZA_DELLA_BUILD() {
      return st.build.licenza
    },
    licenzaDi: (stato) => stato?.licenza ?? st.build.licenza,
  }
})

const leggi = async (ref) => {
  if (ref?.col === 'inventory_items') {
    const a = st.articoli[ref.id]
    return { exists: () => !!a, id: ref.id, data: () => a }
  }
  if (ref?.col === 'orders') return { exists: () => !!st.ordine, id: ref.id, data: () => st.ordine }
  if (ref?.col === 'drinks') {
    return { exists: () => true, id: ref.id, data: () => ({ recipe_items: [{ inventory_item_id: 'gin', qty: 250, unit: 'ml' }] }) }
  }
  return { exists: () => false, data: () => ({}) }
}

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ col: nome }),
  doc: (_db, col, id) => ({ col: col || 'orders', id: id || 'ord-1' }),
  getDoc: vi.fn(leggi),
  getDocFromCache: vi.fn(leggi),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((c, data) => {
    st.scritture.push({ tipo: 'add', col: c?.col, data })
    return mai()
  }),
  setDoc: vi.fn((ref, data) => {
    st.scritture.push({ tipo: 'set', col: ref?.col, id: ref?.id, data })
    return mai()
  }),
  updateDoc: vi.fn((ref, patch) => {
    st.scritture.push({ tipo: 'update', col: ref?.col, id: ref?.id, patch })
    return mai()
  }),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => ({ inc: n }),
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
const { _azzeraMutazioni } = await import('../../src/lib/mutazioniOrdine.js')
const { ricordaImpostazioni } = await import('../../src/lib/impostazioniLocali.js')

const gin = { name: 'Gin', unit: 'pz', stock: 3, package_size: 1000, content_unit: 'ml', low_threshold: 0 }
const conto = () => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  daily_number: 7,
  total: 8,
  discount_amount: 0,
  payments: [],
  items: [],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: ORDER_STATUSES.IN_PREPARAZIONE,
      inventory_applied: false,
      items: [
        { drink_id: 'negroni', name: 'Negroni', qty: 1, unit_price: 8, recipe_items: [{ inventory_item_id: 'gin', qty: 250, unit: 'ml' }] },
      ],
    },
  ],
  created_at: '2026-11-01T20:00:00.000Z',
})

const sulMagazzino = () => st.scritture.filter((s) => s.col === 'inventory_items' || s.col === 'stock_movements')
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms))
async function scritturaSulGin(entro = 2000) {
  const fine = Date.now() + entro
  while (Date.now() < fine) {
    if (sulMagazzino().length) return
    await aspetta(5)
  }
  throw new Error('nessuno ha scritto sul magazzino')
}

beforeEach(() => {
  _azzeraMutazioni?.()
  localStorage.clear()
  st.ordine = conto()
  st.articoli = { gin }
  st.scritture = []
  st.build.licenza = null
})

describe('lo scarico di una vendita segue la licenza', () => {
  it('senza il magazzino nella licenza il «pronto» non scrive sul magazzino', async () => {
    ricordaImpostazioni({ licenza: { piano: 'free', moduli: { magazzino: false } } })
    await api.advanceComanda('ord-1', 'c1', ORDER_STATUSES.PRONTO)
    // Il «pronto» c'è: è la vendita.
    expect(st.scritture.some((s) => s.col === 'orders')).toBe(true)
    await aspetta(150)
    expect(sulMagazzino()).toEqual([])
  })

  it('col magazzino nella licenza si scala come sempre', async () => {
    ricordaImpostazioni({ licenza: { piano: 'pro', moduli: { magazzino: true } } })
    await api.advanceComanda('ord-1', 'c1', ORDER_STATUSES.PRONTO)
    await scritturaSulGin()
  })

  it('se la licenza non si sa ancora si scala: perdere uno scarico vero è peggio', async () => {
    await api.advanceComanda('ord-1', 'c1', ORDER_STATUSES.PRONTO)
    await scritturaSulGin()
  })

  it('la Tana, con la licenza della sua build, scala', async () => {
    st.build.licenza = { moduli: { magazzino: true } }
    await api.advanceComanda('ord-1', 'c1', ORDER_STATUSES.PRONTO)
    await scritturaSulGin()
  })
})
