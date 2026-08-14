'use strict'

// Unit test della logica pura coda (src/lib/coda.js).

import { describe, it, expect } from 'vitest'
import {
  bucketByStatus,
  ordersRecap,
  openOrdersCount,
  ordineCorrisponde,
  primoCorrispondente,
  inseritiDa,
} from '../../src/lib/coda.js'

const orders = [
  { id: '1', status: 'ricevuto', total: 10 },
  { id: '2', status: 'ricevuto', total: 5 },
  { id: '3', status: 'in_preparazione', total: 8 },
  { id: '4', status: 'pronto', total: 12 },
  { id: '5', status: 'ritirato', total: 20 },
  { id: '6', status: 'annullato', total: 99 },
  { id: '7', status: 'pagato', total: 15 },
]

describe('bucketByStatus', () => {
  it('smista per stato ed esclude gli annullati', () => {
    const b = bucketByStatus(orders)
    expect(b.ricevuto.map((o) => o.id)).toEqual(['1', '2'])
    expect(b.in_preparazione.map((o) => o.id)).toEqual(['3'])
    expect(b.pronto.map((o) => o.id)).toEqual(['4'])
    expect(b.ritirato.map((o) => o.id)).toEqual(['5'])
    expect(b.pagato.map((o) => o.id)).toEqual(['7'])
    // l'annullato non compare in nessun bucket
    expect(Object.values(b).flat().some((o) => o.id === '6')).toBe(false)
  })
})

describe('ordersRecap', () => {
  it('conta e somma i non annullati', () => {
    const r = ordersRecap(orders)
    expect(r.count).toBe(6) // esclude l'annullato, include il pagato
    expect(r.total).toBe(10 + 5 + 8 + 12 + 20 + 15)
  })
  it('separa aperti e chiusi con il predicato', () => {
    const isClosed = (o) => o.payment_status === 'pagato'
    const r = ordersRecap(orders, isClosed)
    expect(r.aperti + r.chiusi).toBe(r.count)
    expect(r.chiusi).toBe(orders.filter((o) => o.status !== 'annullato' && o.payment_status === 'pagato').length)
  })
  it('coda vuota', () => {
    expect(ordersRecap([])).toEqual({ count: 0, total: 0, aperti: 0, chiusi: 0 })
  })
})

describe('openOrdersCount', () => {
  it('conta i CONTI aperti (non pagati né annullati)', () => {
    // Nel modello conto/comande anche un ordine "ritirato" resta un conto
    // aperto finché non viene incassato.
    expect(openOrdersCount(orders)).toBe(5) // 1,2,3,4,5
  })
})

// Il filtro «Miei» della coda: ha preso il posto della pagina «I miei
// ordini» della sala, quindi deve rispondere come rispondeva lei — i conti
// con la propria firma, nient'altro.
describe('inseritiDa', () => {
  const firmati = [
    { id: 'a', placed_by: { email: 'Anna@tana.it' } },
    { id: 'b', placed_by: { email: 'bruno@tana.it' } },
    { id: 'c' }, // ordine del cliente: nessuna firma
  ]
  it('tiene solo i conti con la propria firma, maiuscole ignorate', () => {
    expect(inseritiDa(firmati, 'anna@tana.it').map((o) => o.id)).toEqual(['a'])
    expect(inseritiDa(firmati, 'BRUNO@tana.it').map((o) => o.id)).toEqual(['b'])
  })
  it('senza email non risponde nulla: mai tutta la coda per sbaglio', () => {
    expect(inseritiDa(firmati, '')).toEqual([])
    expect(inseritiDa(firmati, null)).toEqual([])
  })
  it('coda vuota o assente: lista vuota, niente errori', () => {
    expect(inseritiDa([], 'anna@tana.it')).toEqual([])
    expect(inseritiDa(null, 'anna@tana.it')).toEqual([])
  })
})

// ── Chiusura del conto: pagato NON basta ───────────────────────────────
// Regola voluta dal locale: con la preparazione tracciata un conto esce
// dalla coda solo se è stato PAGATO **e** SERVITO. Pagare in anticipo è
// normale; farlo sparire vorrebbe dire dimenticarsi di consegnarlo.
import { allServed } from '../../src/lib/comande.js'

describe('un conto pagato ma non servito resta da fare', () => {
  const conto = (statoComanda, paymentStatus) => ({
    payment_status: paymentStatus,
    comande: [{ id: 'c1', status: statoComanda }],
  })
  const pagato = (o) => o.payment_status === 'pagato'
  const chiuso = (o, workflowOn) => (workflowOn ? pagato(o) && allServed(o) : pagato(o))

  it('con la preparazione attiva: pagato ma non servito NON è chiuso', () => {
    expect(chiuso(conto('in_preparazione', 'pagato'), true)).toBe(false)
    expect(chiuso(conto('pronto', 'pagato'), true)).toBe(false)
  })

  it('con la preparazione attiva: serve pagato E servito', () => {
    expect(chiuso(conto('ritirato', 'pagato'), true)).toBe(true)
    expect(chiuso(conto('ritirato', 'non_richiesto'), true)).toBe(false) // servito ma da incassare
  })

  it('senza preparazione: il pagamento chiude e basta', () => {
    expect(chiuso(conto('ricevuto', 'pagato'), false)).toBe(true)
  })
})

// ── La ricerca nella coda ──────────────────────────────────────────────
// Stessa funzione per tutti e due i modi (filtra / accendi): se
// rispondessero in modo diverso, cambiando impostazione lo stesso testo
// troverebbe conti diversi e chi sta al banco non capirebbe perché.
describe('ordineCorrisponde', () => {
  const conto = {
    daily_number: 42,
    customer_name: 'Marco Rossi',
    table_label: 'Tavolo 7',
    placed_by: { email: 'anna@tana.it', name: 'Anna' },
    order_items: [{ name: 'Negroni' }, { name: 'Spritz' }],
  }

  it('trova per numero, cliente, tavolo, chi ha battuto e drink', () => {
    expect(ordineCorrisponde(conto, '42')).toBe(true)
    expect(ordineCorrisponde(conto, 'rossi')).toBe(true)
    expect(ordineCorrisponde(conto, 'tavolo 7')).toBe(true)
    expect(ordineCorrisponde(conto, 'anna@')).toBe(true)
    expect(ordineCorrisponde(conto, 'anna')).toBe(true)
    expect(ordineCorrisponde(conto, 'negroni')).toBe(true)
  })

  it('non guarda maiuscole e spazi ai lati', () => {
    // Chi cerca sul tablet scrive di fretta, con la maiuscola automatica.
    expect(ordineCorrisponde(conto, '  NEGRONI ')).toBe(true)
  })

  it('con la ricerca vuota non risponde nessuno', () => {
    // Altrimenti la ricerca vuota "accenderebbe" il primo conto della coda.
    expect(ordineCorrisponde(conto, '')).toBe(false)
    expect(ordineCorrisponde(conto, '   ')).toBe(false)
    expect(ordineCorrisponde(conto, null)).toBe(false)
  })

  it('regge i conti a metà, senza cliente o senza righe', () => {
    expect(ordineCorrisponde({ daily_number: 3 }, 'marco')).toBe(false)
    expect(ordineCorrisponde(null, 'marco')).toBe(false)
  })
})

describe('primoCorrispondente', () => {
  const lista = [
    { id: 'a', daily_number: 1, customer_name: 'Luca' },
    { id: 'b', daily_number: 2, customer_name: 'Marco' },
    { id: 'c', daily_number: 3, customer_name: 'Marcella' },
  ]

  it('accende il PRIMO che risponde, nell ordine in cui sta sullo schermo', () => {
    // "Il primo" vuol dire il primo che si incontra scorrendo la pagina:
    // la lista arriva già ordinata come la si vede.
    expect(primoCorrispondente(lista, 'marc')?.id).toBe('b')
  })

  it('senza nessuna risposta torna niente (e la coda resta intera)', () => {
    expect(primoCorrispondente(lista, 'zzz')).toBe(null)
    expect(primoCorrispondente(lista, '')).toBe(null)
    expect(primoCorrispondente(null, 'marc')).toBe(null)
  })
})
