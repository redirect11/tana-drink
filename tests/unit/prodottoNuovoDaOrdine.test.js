// @vitest-environment happy-dom
'use strict'

// ── IL PRODOTTO CHE NASCE DA UN ORDINE, SENZA RETE (REQ-MAG-032) ─────
//
// Il guaio vero, ed è la ragione per cui questa voce esiste: davanti a una
// riga d'ordine il cui articolo non sta in anagrafica non succedeva niente.
// La riga passava a «consegnato», la giacenza non si muoveva, nessun
// movimento veniva scritto e nessuno se ne accorgeva — la consegna a schermo
// sembrava andata a buon fine. Se il fornitore mandava una referenza nuova,
// quella merce spariva. Una merce contata male si vede; una che sparisce in
// silenzio no.
//
// COM'È FATTO QUESTO TEST, sul modello di consegnaOrdine.test.js: si mocka
// SOLO Firestore, non `src/lib/api.js` — se no si proverebbe il mock e non il
// codice. Ogni scrittura resta appesa per sempre e ogni lettura risponde con
// quello che c'era PRIMA, che è quello che fa una cache mentre la scrittura è
// in coda.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  prodottoDaRigaOrdine,
  mancaNellaScheda,
  prodottiDaCompletare,
  schedaCompletata,
  motivoNonMigrabile,
  magazzinoBloccato,
} from '../../src/lib/inventory.js'

const mai = () => new Promise(() => {})
// `articoli` è una mappa per id: qui il punto è proprio che uno dei prodotti
// dell'ordine NON c'è.
const stato = { ordine: null, articoli: {}, scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1' } },
  functions: {},
  storage: {},
}))

const leggi = async (ref) => {
  if (ref?.col === 'purchase_orders') {
    return { exists: () => !!stato.ordine, id: 'po-1', data: () => stato.ordine }
  }
  if (ref?.col === 'inventory_items') {
    const documento = stato.articoli[ref.id]
    return { exists: () => !!documento, id: ref.id, data: () => documento }
  }
  return { exists: () => false, data: () => ({}) }
}

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: (...args) => {
    if (args.length >= 3) return { col: args[1], id: args[2] }
    if (args.length === 2) return { col: args[0]?.__col || 'x', id: args[1] }
    return { col: args[0]?.__col || 'x', id: 'nuovo' }
  },
  getDoc: vi.fn(leggi),
  getDocFromCache: vi.fn(leggi),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn((c, data) => {
    stato.scritture.push({ tipo: 'add', col: c?.__col, data })
    return mai()
  }),
  setDoc: vi.fn((ref, data) => {
    stato.scritture.push({ tipo: 'set', col: ref?.col, id: ref?.id, data })
    return mai()
  }),
  updateDoc: vi.fn((ref, patch) => {
    stato.scritture.push({ tipo: 'update', col: ref?.col, id: ref?.id, patch })
    return mai()
  }),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => ({ __increment: n }),
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: () => mai() }),
  Timestamp: class Timestamp {
    static fromDate(d) { return d }
    static fromMillis(m) { return m }
  },
}))

const api = await import('../../src/lib/api.js')

// Se una chiamata restasse appesa il test fallirebbe per timeout, che è lo
// stesso sintomo del banco: il tasto premuto e niente che succede.
const subito = (p) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('rimasto appeso')), 1000))])

const ordineConUnaReferenzaNuova = () => ({
  created_at: '2026-08-27T09:00:00.000Z',
  status: 'inviato',
  received_at: null,
  total_net: 152,
  total_gross: 185.44,
  lines: [
    { item_id: 'campari', name: 'Campari', qty_packages: 6, unit_cost: 12, vat: 22, supplier_id: 'nova', stato: 'richiesto' },
    // La referenza nuova: il fornitore l'ha messa nell'ordine, in magazzino
    // non c'è.
    { item_id: 'mezcal', name: 'Mezcal Verde', qty_packages: 4, unit_cost: 20, vat: 10, supplier_id: 'nova', stato: 'richiesto' },
  ],
})

beforeEach(() => {
  stato.ordine = ordineConUnaReferenzaNuova()
  stato.articoli = {
    campari: { name: 'Campari', unit: 'pz', stock: 2, package_size: 700, content_unit: 'ml', category_id: 'distillati' },
  }
  stato.scritture = []
})

const scritture = (col, tipo = null) =>
  stato.scritture.filter((s) => s.col === col && (tipo == null || s.tipo === tipo))

describe('la merce di una referenza nuova non sparisce più', () => {
  it('il prodotto nasce, con lo stesso id della riga d’ordine', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [0, 1] }))
    const nati = scritture('inventory_items', 'set')
    expect(nati).toHaveLength(1)
    // LO STESSO id DELLA RIGA: l'ordine continua a puntare a un prodotto
    // vero, e una seconda consegna della stessa referenza ritrova questo
    // invece di farne un doppione.
    expect(nati[0].id).toBe('mezcal')
    expect(nati[0].data.name).toBe('Mezcal Verde')
  })

  it('nasce con la merce già dentro, e col movimento che lo dice', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [1] }))
    const nato = scritture('inventory_items', 'set')[0].data
    // Quattro confezioni sono quattro pezzi: la giacenza è un numero, non un
    // increment — su un documento che non esiste non c'è niente da
    // incrementare.
    expect(nato.stock).toBe(4)
    expect(scritture('stock_movements', 'add')[0].data).toMatchObject({
      item_id: 'mezcal',
      type: 'load',
      qty: 4,
      reason: 'ordine fornitore',
    })
  })

  it('porta il prezzo dell’ordine e scrive la riga di listino del fornitore', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [1] }))
    expect(scritture('inventory_items', 'set')[0].data.cost).toBe(20)
    const listino = scritture('supplier_prices', 'set')
    expect(listino).toHaveLength(1)
    expect(listino[0].id).toBe('nova__mezcal')
    expect(listino[0].data).toMatchObject({ supplier_id: 'nova', item_id: 'mezcal', price: 20 })
  })

  it('e il prezzo corretto alla consegna è quello che finisce sul prodotto', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [1], prezzi: { 1: '18.5' } }))
    expect(scritture('inventory_items', 'set')[0].data.cost).toBe(18.5)
  })

  // Il prodotto che c'è già si comporta come sempre: la giacenza si SOMMA.
  it('il prodotto che c’è già continua a sommarsi, non si riscrive', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [0, 1] }))
    const patch = scritture('inventory_items', 'update')
    expect(patch).toHaveLength(1)
    expect(patch[0].id).toBe('campari')
    expect(patch[0].patch.stock).toEqual({ __increment: 6 })
  })

  it('la riga avanza a «consegnato» e l’esito si vede subito, senza rete', async () => {
    const dopo = await subito(api.consegnaRigheOrdine('po-1', { indici: [1] }))
    expect(dopo.lines[1].stato).toBe('consegnato')
    expect(dopo.lines[1].delivered_at).toBeTruthy()
  })
})

describe('il prodotto nato da un ordine è marcato DA COMPLETARE', () => {
  it('porta il segno, e non ha categoria né soglia', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [1] }))
    const nato = scritture('inventory_items', 'set')[0].data
    expect(nato.scheda_da_completare).toBe(true)
    expect(nato.category_id).toBeNull()
    expect(nato.low_threshold).toBe(0)
  })

  // L'IVA D'ACQUISTO EREDITA quella della riga d'ordine, e il default (22%)
  // dove la riga non la dice: l'ordine porta il prezzo, non l'aliquota.
  it('l’IVA è quella della riga, e dove non c’è vale il 22%', () => {
    expect(prodottoDaRigaOrdine({ name: 'X', unit_cost: 5, vat: 10 }).vat).toBe(10)
    expect(prodottoDaRigaOrdine({ name: 'X', unit_cost: 5 }).vat).toBe(22)
  })

  // LA TRAPPOLA DA NON CALPESTARE. La riga d'ordine porta un `package_size`
  // ma non dice di che misura sia quel contenuto: scriverlo così farebbe
  // rispondere `motivoNonMigrabile` e manderebbe IL MAGAZZINO INTERO in sola
  // lettura per colpa di un prodotto appena nato — col locale aperto.
  it('nasce contato a pezzi, e non blocca il magazzino', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [1] }))
    const nato = scritture('inventory_items', 'set')[0].data
    expect(nato.unit).toBe('pz')
    expect(nato.package_size).toBeNull()
    expect(motivoNonMigrabile(nato)).toBeNull()
    expect(magazzinoBloccato([nato])).toBe(false)
  })

  // Il fornitore NON si scrive sul prodotto: da REQ-MAG-029 quel legame vive
  // nel listino, perché un prodotto può averne più d'uno.
  it('il fornitore non finisce sul prodotto: sta nel listino', () => {
    const nato = prodottoDaRigaOrdine({ name: 'X', unit_cost: 5, supplier_id: 'nova' })
    expect(nato.supplier_id).toBeUndefined()
  })

  it('dice cosa manca, e la categoria viene per prima', () => {
    const nato = prodottoDaRigaOrdine({ name: 'X', unit_cost: 5 })
    expect(mancaNellaScheda(nato)).toEqual([
      'la categoria',
      'quanto contiene un pezzo',
      'la soglia di riordino',
    ])
    expect(prodottiDaCompletare([nato, { name: 'Y' }])).toEqual([nato])
  })

  // LA SCHEDA SI CHIUDE CON LA CATEGORIA: bastasse aprirla, il segno
  // sparirebbe dal prodotto guardato per un secondo e la spesa continuerebbe
  // a non comparire nei conti senza più niente che lo dica.
  it('si chiude quando qualcuno le dà una categoria, non prima', () => {
    const nato = prodottoDaRigaOrdine({ name: 'X', unit_cost: 5 })
    expect(schedaCompletata(nato, { low_threshold: 3 })).toBe(false)
    expect(schedaCompletata(nato, { category_id: null })).toBe(false)
    expect(schedaCompletata(nato, { category_id: 'distillati' })).toBe(true)
    // Un prodotto che non è nato da un ordine non ha niente da chiudere.
    expect(schedaCompletata({ category_id: null }, { category_id: 'x' })).toBe(false)
  })
})

describe('l’assortimento pre-impostato si applica col carico, non prima', () => {
  it('il cambio deciso all’ordine arriva sul prodotto quando la merce arriva', async () => {
    stato.articoli.campari.status = 'premium'
    stato.ordine.lines[0].status_target = 'assortimento'
    await subito(api.consegnaRigheOrdine('po-1', { indici: [0] }))
    expect(scritture('inventory_items', 'update')[0].patch.status).toBe('assortimento')
  })

  it('senza il pre-impostato lo stato commerciale non si tocca', async () => {
    await subito(api.consegnaRigheOrdine('po-1', { indici: [0] }))
    expect(scritture('inventory_items', 'update')[0].patch.status).toBeUndefined()
  })

  // La riga che resta «richiesta» non applica niente: è tutto il senso del
  // pre-impostato — il cambio scatta quando la merce esiste, non mentre
  // viaggia.
  it('la riga non consegnata non muove nessuno stato', async () => {
    stato.ordine.lines[1].status_target = 'assortimento'
    await subito(api.consegnaRigheOrdine('po-1', { indici: [0] }))
    expect(scritture('inventory_items', 'set')).toEqual([])
  })
})
