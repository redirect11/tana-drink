'use strict'

// Unit test del modello Ordine (conto) / Comande (ticket) — src/lib/comande.js

import { describe, it, expect } from 'vitest'
import {
  ORDER_OPEN,
  nextComandaStatus,
  activeComanda,
  serveAllComande,
  comandeSummary,
  allServed,
  aggregateItems,
  itemsTotal,
  comandeStatuses,
  normalizeOrderDoc,
  orderHasContent,
  initialDetailView,
  orderIsClosed,
  comandaEditable,
  lockedQtyByItem,
  planDecrement,
  comandaDaScaricare,
  contoChiuso,
} from '../../src/lib/comande.js'

const c = (seq, status, items = []) => ({ id: `c${seq}`, seq, status, items })

describe('nextComandaStatus', () => {
  it('flusso ricevuto→in_preparazione→pronto→ritirato→null', () => {
    expect(nextComandaStatus('ricevuto')).toBe('in_preparazione')
    expect(nextComandaStatus('in_preparazione')).toBe('pronto')
    expect(nextComandaStatus('pronto')).toBe('ritirato')
    expect(nextComandaStatus('ritirato')).toBeNull()
    expect(nextComandaStatus('annullato')).toBeNull()
  })
})

describe('activeComanda / comandeSummary / allServed', () => {
  const order = {
    status: ORDER_OPEN,
    comande: [c(1, 'ritirato'), c(2, 'pronto'), c(3, 'ricevuto'), c(4, 'annullato')],
  }
  it('attiva = quella al passo più indietro (dà lo stato dell\'ordine)', () => {
    expect(activeComanda(order).seq).toBe(3)
  })

  it('aggiunta su conto con comanda pronta: l\'ordine TORNA in preparazione', () => {
    // C1 è pronta al servizio; l'aggiunta C2 nasce in preparazione → è lei
    // l'attiva: in coda l'ordine risulta di nuovo "in preparazione".
    const o = { comande: [c(1, 'pronto'), c(2, 'in_preparazione')] }
    expect(activeComanda(o).seq).toBe(2)
    expect(activeComanda(o).status).toBe('in_preparazione')
  })

  it('a parità di passo vince la più vecchia', () => {
    expect(activeComanda({ comande: [c(1, 'in_preparazione'), c(2, 'in_preparazione')] }).seq).toBe(1)
  })

  it('conto pagato: serveAllComande marca tutto servito (annullate escluse)', () => {
    const servite = serveAllComande(
      [c(1, 'ritirato'), c(2, 'in_preparazione'), c(3, 'annullato'), c(4, 'pronto')],
      'T1'
    )
    expect(servite.map((x) => x.status)).toEqual(['ritirato', 'ritirato', 'annullato', 'ritirato'])
    // orario di servizio stampigliato solo su quelle chiuse adesso
    expect(servite[1].status_times.ritirato).toBe('T1')
    expect(servite[3].status_times.ritirato).toBe('T1')
    expect(allServed({ comande: servite })).toBe(true)
  })
  it('summary conta attive/pronte/servite (esclude annullate)', () => {
    expect(comandeSummary(order)).toEqual({ attive: 2, pronte: 1, servite: 1, totale: 3 })
  })
  it('allServed solo quando tutte ritirate (annullate ignorate)', () => {
    expect(allServed(order)).toBe(false)
    expect(allServed({ comande: [c(1, 'ritirato'), c(2, 'annullato')] })).toBe(true)
    expect(allServed({ comande: [c(1, 'annullato')] })).toBe(false)
  })
})

describe('aggregateItems / itemsTotal', () => {
  it('somma lo stesso drink su comande diverse, custom separati, annullate escluse', () => {
    const comande = [
      c(1, 'ritirato', [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'custom-1', custom: true, name: 'Special', unit_price: 9, qty: 1 },
      ]),
      c(2, 'ricevuto', [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 },
        { drink_id: 'custom-2', custom: true, name: 'Special', unit_price: 9, qty: 1 },
      ]),
      c(3, 'annullato', [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 5 }]),
    ]
    const agg = aggregateItems(comande)
    expect(agg.find((i) => i.drink_id === 'mojito').qty).toBe(3)
    expect(agg.filter((i) => i.custom)).toHaveLength(2)
    expect(agg.find((i) => i.drink_id === 'gin')).toBeUndefined()
    expect(itemsTotal(agg)).toBe(3 * 7 + 9 + 9)
  })
})

describe('comandeStatuses', () => {
  it('stati unici presenti', () => {
    expect(comandeStatuses([c(1, 'ritirato'), c(2, 'ricevuto'), c(3, 'ricevuto')]).sort()).toEqual([
      'ricevuto',
      'ritirato',
    ])
  })
})

describe('dettaglio POS: il contenuto del conto è visibile', () => {
  const withContent = {
    status: ORDER_OPEN,
    comande: [c(1, 'ritirato', [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }])],
  }
  const empty = { status: ORDER_OPEN, comande: [] }
  const onlyCancelled = {
    status: ORDER_OPEN,
    comande: [c(1, 'annullato', [{ drink_id: 'x', name: 'X', unit_price: 1, qty: 1 }])],
  }

  it('orderHasContent: vero con item in comande non annullate', () => {
    expect(orderHasContent(withContent)).toBe(true)
    expect(orderHasContent(empty)).toBe(false)
    expect(orderHasContent(onlyCancelled)).toBe(false)
  })

  it('il dettaglio di un ordine con contenuto si apre sulle Comande', () => {
    expect(initialDetailView(withContent)).toBe('comande')
    expect(initialDetailView(empty)).toBe('menu')
  })

  it('anche un ordine legacy (solo items) mostra il contenuto', () => {
    const legacy = normalizeOrderDoc({
      status: 'in_preparazione',
      items: [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 1 }],
    })
    expect(orderHasContent(legacy)).toBe(true)
    expect(initialDetailView(legacy)).toBe('comande')
  })

  it('flusso aggiunta: dopo una nuova comanda l’aggregato contiene tutto', () => {
    const comande = [
      ...withContent.comande,
      c(2, 'ricevuto', [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 1 }]),
    ]
    const agg = aggregateItems(comande)
    expect(agg.map((i) => i.drink_id).sort()).toEqual(['gin', 'mojito'])
    expect(itemsTotal(agg)).toBe(2 * 7 + 8)
  })

  it('orderIsClosed solo per pagato/annullato', () => {
    expect(orderIsClosed({ status: 'pagato' })).toBe(true)
    expect(orderIsClosed({ status: 'annullato' })).toBe(true)
    expect(orderIsClosed(withContent)).toBe(false)
  })
})

describe('normalizeOrderDoc (retrocompatibilità)', () => {
  it('doc nuovo modello: passa attraverso', () => {
    const n = normalizeOrderDoc({ status: ORDER_OPEN, comande: [c(1, 'pronto')] })
    expect(n.status).toBe(ORDER_OPEN)
    expect(n.comande).toHaveLength(1)
  })
  it('legacy in lavorazione → ordine aperto + comanda sintetica con lo stato', () => {
    const n = normalizeOrderDoc({
      status: 'in_preparazione',
      items: [{ drink_id: 'x', qty: 1 }],
      status_times: { in_preparazione: 't1' },
      inventory_applied: true,
      inventory_consumption: [{ inventory_item_id: 'rum', qty: 40 }],
    })
    expect(n.status).toBe(ORDER_OPEN)
    expect(n.comande[0]).toMatchObject({
      seq: 1,
      status: 'in_preparazione',
      inventory_applied: true,
    })
    expect(n.comande[0].items).toHaveLength(1)
  })
  it('legacy pagato → ordine pagato, comanda ritirata; annullato → annullato', () => {
    expect(normalizeOrderDoc({ status: 'pagato', items: [] }).status).toBe('pagato')
    expect(normalizeOrderDoc({ status: 'pagato', items: [] }).comande[0].status).toBe('ritirato')
    expect(normalizeOrderDoc({ status: 'annullato', items: [] }).comande[0].status).toBe('annullato')
  })
})

describe('vista aggregata: aumenti/diminuzioni gestite internamente', () => {
  const comande = [
    { id: 'c1', seq: 1, status: 'ritirato', items: [{ drink_id: 'mojito', qty: 2 }] },
    { id: 'c2', seq: 2, status: 'in_preparazione', items: [{ drink_id: 'mojito', qty: 1 }, { drink_id: 'gin', qty: 1 }] },
    { id: 'c3', seq: 3, status: 'pronto', items: [{ drink_id: 'gin', qty: 2 }] },
  ]

  it('comandaEditable: solo ricevuto/in_preparazione', () => {
    expect(comandaEditable({ status: 'ricevuto' })).toBe(true)
    expect(comandaEditable({ status: 'in_preparazione' })).toBe(true)
    expect(comandaEditable({ status: 'pronto' })).toBe(false)
    expect(comandaEditable({ status: 'ritirato' })).toBe(false)
  })

  it('lockedQtyByItem: somma le quantità di pronte/servite', () => {
    expect(lockedQtyByItem(comande)).toEqual({ mojito: 2, gin: 2 })
  })

  it('planDecrement: scala dalla comanda modificabile più recente', () => {
    const plan = planDecrement(comande, 'mojito')
    expect(plan.comandaId).toBe('c2')
    expect(plan.items).toEqual([{ drink_id: 'gin', qty: 1 }]) // mojito rimosso (era 1)
  })

  it('planDecrement: null se l’item vive solo in comande bloccate', () => {
    expect(planDecrement(comande, 'birra')).toBeNull()
    const soloServite = [{ id: 'c1', status: 'ritirato', items: [{ drink_id: 'x', qty: 3 }] }]
    expect(planDecrement(soloServite, 'x')).toBeNull()
  })
})

// IL MAGAZZINO SI SCALA QUANDO LA COMANDA È SERVITA. Prima si scaricava
// alla presa in carico: un drink iniziato e poi non fatto — riga tolta,
// cliente che cambia idea, comanda annullata — aveva già portato via gli
// ingredienti. Fino al servito sono impegnati, non consumati.
describe('quando si scala il magazzino', () => {
  it('quando la comanda risulta servita', () => {
    expect(comandaDaScaricare({ inventory_applied: false }, 'ritirato')).toBe(true)
  })

  it('non quando la si prende in carico', () => {
    expect(comandaDaScaricare({ inventory_applied: false }, 'in_preparazione')).toBe(false)
    expect(comandaDaScaricare({ inventory_applied: false }, 'pronto')).toBe(false)
  })

  it('una volta sola', () => {
    expect(comandaDaScaricare({ inventory_applied: true }, 'ritirato')).toBe(false)
  })
})

// QUANDO UN CONTO È CHIUSO. La regola sta in un posto solo perché la usano
// in tre — coda, riepilogo di testata e magazzino — e quando stava scritta
// in tre posti il magazzino contava fra gli aperti conti già incassati:
// con un tavolo solo segnava mezzo listino in esaurimento.
describe('conto chiuso: non c’è più niente da fare', () => {
  const servito = (over = {}) => ({
    comande: [{ id: 'c1', status: 'ritirato', items: [{ drink_id: 'x', qty: 1 }] }],
    ...over,
  })

  it('con gli stati del servizio servono incasso E consegna', () => {
    expect(contoChiuso(servito({ payment_status: 'pagato' }), { workflowOn: true })).toBe(true)
    // Pagato in anticipo, drink ancora da fare: lavoro da fare, non chiuso.
    const daServire = {
      payment_status: 'pagato',
      comande: [{ id: 'c1', status: 'in_preparazione', items: [{ drink_id: 'x', qty: 1 }] }],
    }
    expect(contoChiuso(daServire, { workflowOn: true })).toBe(false)
  })

  it('senza gli stati del servizio il pagamento chiude e basta', () => {
    const daServire = {
      payment_status: 'pagato',
      comande: [{ id: 'c1', status: 'in_preparazione', items: [{ drink_id: 'x', qty: 1 }] }],
    }
    expect(contoChiuso(daServire, { workflowOn: false })).toBe(true)
  })

  it('l’annullato è chiuso in ogni caso', () => {
    expect(contoChiuso({ status: 'annullato' }, { workflowOn: true })).toBe(true)
    expect(contoChiuso({ workflow_status: 'annullato' }, { workflowOn: false })).toBe(true)
  })

  it('un conto servito ma non incassato resta aperto: mancano i soldi', () => {
    expect(contoChiuso(servito(), { workflowOn: true })).toBe(false)
  })
})
