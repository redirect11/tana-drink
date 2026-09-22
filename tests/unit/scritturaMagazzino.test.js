// @vitest-environment happy-dom
'use strict'

// IL MAGAZZINO SI SCRIVE DA UNA PORTA SOLA (BUG-029).
//
// In LETTURA il modello vecchio si legge con tolleranza — `articoloNormalizzato`,
// applicato in un punto solo — e a schermo tutto risulta già a pezzi. In
// SCRITTURA no: si rilegge il documento com'è scritto sul database, e sommare
// pezzi a una giacenza ancora in centilitri dà un numero senza senso. Un
// numero storto in magazzino sembra plausibile a chi lo legge: «47» di limoni
// non ha niente di strano, giusto o sbagliato che sia.
//
// Il controllo «prima va aggiornato il magazzino» era stato copiato a mano in
// due casi su sette. Ce l'avevano il carico e la rettifica; non ce l'avevano
// `receiveBottles`, la consegna di un ordine fornitore, l'allineamento della conta e lo
// scarico delle comande — e il buco concreto era Acquisti → «ricevuto», che
// scriveva su un magazzino non ancora aggiornato perché il blocco viveva
// dentro la schermata del magazzino.
//
// Qui si prova ogni strada, una per una. Finché è una riga da ricopiare, ogni
// percorso nuovo nasce senza.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// I documenti come stanno sul database: `vecchio` è ancora in centilitri.
const vecchio = {
  name: 'Gin',
  unit: 'cl',
  stock: 350,
  package_size: 70,
  low_threshold: 0,
  kind: 'scorta',
}
const nuovo = {
  name: 'Gin',
  unit: 'pz',
  stock: 5,
  // Il contenuto si scrive in unità BASE (ml, g): è la regola del magazzino,
  // «4 cl» non deve mai diventare 4 pezzi.
  package_size: 700,
  content_unit: 'ml',
  low_threshold: 0,
  kind: 'scorta',
}

const stato = { articolo: nuovo, scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: (...args) => {
    if (args.length >= 3) return { col: args[1], id: args[2] }
    if (args.length === 2) return { col: args[0]?.__col || 'orders', id: args[1] }
    return { col: args[0]?.__col || 'x', id: 'nuovo' }
  },
  getDoc: vi.fn(async (ref) => {
    if (ref?.col === 'inventory_items') {
      return { exists: () => true, id: ref.id, data: () => stato.articolo }
    }
    if (ref?.col === 'purchase_orders') {
      return {
        exists: () => true,
        id: ref.id,
        data: () => ({
          status: 'inviato',
          lines: [{ item_id: 'art-1', qty_packages: 2 }],
        }),
      }
    }
    if (ref?.col === 'stock_counts') {
      return { exists: () => true, id: ref.id, data: () => ({ status: 'open' }) }
    }
    return { exists: () => false, data: () => ({}) }
  }),
  getDocFromCache: vi.fn(async () => {
    throw new Error('niente cache')
  }),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async (ref, patch) => {
    stato.scritture.push({ col: ref?.col, id: ref?.id, patch })
  }),
  deleteDoc: vi.fn(async () => {}),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => ({ __increment: n }),
  // Il pacchetto registra le sue scritture come le altre: la chiusura
  // dell'inventario scrive le giacenze così (BUG-110), e la domanda qui è la
  // stessa — cosa è finito sul database, non da quale porta.
  writeBatch: () => ({
    update: (ref, patch) => stato.scritture.push({ col: ref?.col, id: ref?.id, patch }),
    set: vi.fn(),
    commit: async () => {},
  }),
  deleteField: () => ({ __delete: true }),
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
const { articoloNormalizzato, magazzinoBloccato, patchNormalizza } = await import(
  '../../src/lib/inventory.js'
)
// Il mock di Firestore, per guardare COME si scrive: il carico deve tornare
// senza aspettare l'ack (BUG-109).
const fs = await import('firebase/firestore')
// `bgWrite` manda la scrittura su un microtask: chi guarda cosa è finito sul
// database deve lasciar girare un giro di eventi.
const giro = () => new Promise((r) => setTimeout(r, 0))

// Le strade che caricano o correggono una giacenza: sono quelle che devono
// fermarsi tutte allo stesso modo.
// L'articolo come lo legge l'app: il carico lo prende in mano invece di
// rileggerlo, quindi il controllo del travaso si fa su QUESTO (BUG-109).
const articolo = (id = 'art-1') => articoloNormalizzato({ id, ...stato.articolo })

const strade = [
  ['carico a mano', async () => api.loadStock(articolo(), 2)],
  ['carico a confezioni', () => api.receiveBottles('art-1', 2)],
  ['rettifica della giacenza', () => api.adjustStock('art-1', 3)],
  // Era `receivePurchaseOrder`, che caricava l'ordine intero al «ricevuto».
  // Da REQ-MAG-029 il carico avviene al passaggio a CONSEGNATO, riga per
  // riga: il gesto ha un altro nome, la regola che deve rispettare è la
  // stessa — con un magazzino ancora da aggiornare non scrive niente.
  ['consegna di righe di un ordine fornitore', () => api.consegnaRigheOrdine('po-1')],
  [
    'allineamento della conta',
    () =>
      api.closeStockCount('sc-1', {
        lines: [{ item_id: 'art-1', rim: 3 }],
        totals: {},
        align: true,
      }),
  ],
]

beforeEach(() => {
  vi.clearAllMocks()
  stato.articolo = nuovo
  stato.scritture = []
})

describe('col magazzino ancora da aggiornare nessuna strada scrive', () => {
  for (const [nome, esegui] of strade) {
    it(`${nome}: si ferma, e dice cosa fare`, async () => {
      stato.articolo = vecchio
      await expect(esegui()).rejects.toThrow(/aggiornato il magazzino/i)
      // La cosa che conta non è il messaggio: è che non sia stato scritto
      // niente su quella giacenza.
      expect(stato.scritture.filter((s) => s.col === 'inventory_items')).toEqual([])
    })
  }
})

describe('a magazzino aggiornato le stesse strade scrivono', () => {
  for (const [nome, esegui] of strade) {
    it(`${nome}: la giacenza si muove`, async () => {
      await esegui()
      expect(stato.scritture.some((s) => s.col === 'inventory_items')).toBe(true)
    })
  }
})

// ── IL CARICO SI SOMMA ANCHE SOTTO ZERO ──────────────────────────────
// Flavio, 12/09/2026: «se ho tre pezzi, ne consumo quattro, va a meno uno, e
// compro cinque pezzi: non me ne mette quattro, me ne mette cinque». Il meno
// è quasi sempre merce già bevuta e non ancora caricata, e il carico che
// arriva è quello: deve chiudere il buco. Dal 17/08 al 12/09 il carico
// ripartiva da zero (BUG-007), ed è la regola che qui si rovescia.
describe('il carico parte dalla giacenza com’è, anche sotto zero', () => {
  const sottoZero = { ...nuovo, stock: -1 }

  it('a mano: −1 più cinque fa quattro', async () => {
    stato.articolo = sottoZero
    // Quello che si vede subito…
    expect(api.loadStock(articolo(), 5).stock).toBe(4)
    await giro()
    // …e quello che arriva al database: un incremento, che si accoda
    // offline e non litiga con chi scrive dallo stesso prodotto altrove.
    const s = stato.scritture.find((w) => w.col === 'inventory_items')
    expect(s.patch.stock).toEqual({ __increment: 5 })
  })

  // Lo scarico a mano invece non scava sotto lo zero: lì c'è una persona che
  // dichiara quanto ha tolto dallo scaffale, e da uno scaffale vuoto non si
  // toglie niente.
  it('lo scarico a mano si ferma a zero', async () => {
    stato.articolo = { ...nuovo, stock: 2 }
    expect(api.loadStock(articolo(), -5).stock).toBe(0)
    await giro()
    const s = stato.scritture.find((w) => w.col === 'inventory_items')
    expect(s.patch.stock).toEqual({ __increment: -2 })
  })
})

// ── IL CARICO NON ASPETTA LA RETE (BUG-109) ──────────────────────────
//
// Daniele, 18/09/2026: «in Magazzino se inserisco un carico non viene
// visualizzato subito, anzi sembra che non ho premuto il tasto; poi ricarico
// la pagina e mi trovo i carichi per ogni volta che ho cliccato».
//
// PERCHÉ SUCCEDEVA: il carico aspettava quattro giri di rete prima di far
// vedere qualcosa — una lettura, due scritture e una rilettura. Le due
// scritture si risolvono solo con l'ack del server, quindi con la linea del
// locale che «risulta collegata ma non passa» non tornavano mai: niente a
// schermo, si ripremeva, e ogni pressione accodava un carico.
describe('il carico si vede subito, anche se le scritture restano appese', () => {
  it('torna la giacenza nuova senza aspettare niente', () => {
    stato.articolo = { ...nuovo, stock: 5 }
    // Le scritture non si risolveranno mai, come al banco quando la rete
    // non passa: il gesto deve valere lo stesso.
    fs.updateDoc.mockImplementationOnce(() => new Promise(() => {}))
    fs.addDoc.mockImplementationOnce(() => new Promise(() => {}))
    const dopo = api.loadStock(articolo(), 3)
    expect(dopo.stock).toBe(8)
    expect(dopo.id).toBe('art-1')
  })

  // E il movimento parte lo stesso: si accoda, e arriverà quando la rete
  // torna. Quello che non deve succedere è che lo aspetti qualcuno.
  it('e il movimento parte in sottofondo', async () => {
    stato.articolo = { ...nuovo, stock: 5 }
    api.loadStock(articolo(), 3)
    await giro()
    expect(fs.addDoc).toHaveBeenCalledTimes(1)
    expect(fs.addDoc.mock.calls[0][1]).toMatchObject({ item_id: 'art-1', type: 'load', qty: 3, reason: 'carico' })
  })
})

describe('la regola del «in sola lettura» è una sola', () => {
  // `magazzinoBloccato` guarda gli articoli COME LI LEGGE L'APP, cioè già
  // passati da `articoloNormalizzato`: è quello che hanno in mano le due
  // schermate.
  const comeLiVede = (grezzo) => articoloNormalizzato({ id: 'art-1', ...grezzo })

  it('un articolo nella forma vecchia blocca il magazzino', () => {
    // È la stessa condizione che ferma le scritture: la schermata del
    // magazzino e quella degli Acquisti la CHIEDONO, non la riscrivono —
    // finché era una riga da ricopiare, Acquisti ne era rimasta fuori.
    expect(patchNormalizza(vecchio)).toBeTruthy()
    expect(magazzinoBloccato([comeLiVede(vecchio)])).toBe(true)
  })

  it('a travaso fatto non blocca niente', () => {
    expect(patchNormalizza(nuovo)).toBe(null)
    expect(magazzinoBloccato([comeLiVede(nuovo)])).toBe(false)
  })

  it('magazzino vuoto: non c’è niente da aggiornare, e niente da bloccare', () => {
    expect(magazzinoBloccato([])).toBe(false)
  })
})
