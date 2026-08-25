'use strict'

// ── GLI SCONTI SI ACCUMULANO ─────────────────────────────────────────
//
// «Lo sconto va applicato solo sui prodotti selezionati. Nel senso che se
// tolgo prodotti dalla schermata pagamento, lo sconto va applicato solo sui
// prodotti che sto riscuotendo. Quindi gli sconti poi si accumulano nello
// scontrino. Se ho applicato uno sconto a 2 prodotti prima e a tre prodotti
// dopo, sono due sconti applicati» (l'utente, 20/08/2026).
//
// Lo sconto non è più un campo del conto: appartiene alla riscossione che se
// l'è portato via e resta scritto dentro quel pagamento. Un conto ne può
// quindi portare tre, e ogni numero che prima leggeva `discount_amount` adesso
// deve sommarli tutti.

import { describe, it, expect } from 'vitest'
import {
  orderDue,
  orderTotal,
  paidAmount,
  isFullyPaid,
  selectionAmount,
  scontoEccessivo,
  dettaglioIncassi,
  scontiConsumati,
  scontoConsumato,
  scontoTotale,
  lordoResiduo,
  lordoSelezione,
  scontiDelConto,
  etichettaSconto,
} from '../../src/lib/pagamento.js'

const order = (over = {}) => ({
  total: 22,
  discount_amount: 0,
  payments: [],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ritirato',
      items: [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 },
      ],
    },
  ],
  ...over,
})

// Conto da 22: prima si riscuote il Gin Tonic scontato di 2 €, poi restano i
// due Mojito con un 10% preparato sopra.
const conDueSconti = () =>
  order({
    payments: [
      {
        id: 'p1',
        amount: 6,
        method: 'banco',
        items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
        sconto: {
          type: 'euro',
          value: 2,
          amount: 2,
          items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
        },
      },
    ],
    discount: { type: 'percent', value: 10 },
    discount_amount: 1.4,
    discount_items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
  })

describe('due riscossioni scontate sono due sconti', () => {
  it('si contano uno per uno, non sommati in un campo solo', () => {
    const o = conDueSconti()
    expect(scontiConsumati(o)).toHaveLength(1)
    expect(scontoConsumato(o)).toBe(2)
    expect(scontoTotale(o)).toBe(3.4) // 2 già incassati + 1,40 in preparazione
  })

  it('il residuo è totale − sconti − incassato, e torna a zero al centesimo', () => {
    const o = conDueSconti()
    // 22 − 2 − 1,40 − 6 = 12,60, che è il lordo dei due Mojito meno il 10%.
    expect(orderDue(o)).toBe(12.6)
    expect(orderTotal(o)).toBe(18.6)
    const saldato = {
      ...o,
      payments: [
        ...o.payments,
        {
          id: 'p2',
          amount: 12.6,
          method: 'banco',
          sconto: { type: 'percent', value: 10, amount: 1.4, items: o.discount_items },
        },
      ],
      discount: null,
      discount_amount: 0,
      discount_items: null,
    }
    expect(orderDue(saldato)).toBe(0)
    expect(scontoTotale(saldato)).toBe(3.4)
    expect(paidAmount(saldato)).toBe(18.6)
    expect(isFullyPaid(saldato)).toBe(true)
  })

  it('il lordo che resta non conta due volte lo sconto già speso', () => {
    // 22 − 6 incassati − 2 di sconto già consumato = 14, il listino dei due
    // Mojito. Senza sottrarre lo sconto consumato la base del prossimo sarebbe
    // 16: si sconterebbe una riga già pagata e andata via col cliente.
    expect(lordoResiduo(conDueSconti())).toBe(14)
  })

  it('la seconda selezione parziale si sconta sul suo lordo, non sul conto', () => {
    const amount = selectionAmount(conDueSconti(), [
      { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 },
    ])
    // Un solo Mojito: 7 € di listino meno l'1,40 preparato su quelle righe.
    expect(amount).toBe(5.6)
  })
})

describe('il lordo su cui cade uno sconto', () => {
  it('senza righe è tutto quello che resta, coperto e servizio compresi', () => {
    // 25 = 22 di articoli + 3 di coperto: lo sconto su «tutto» li prende dentro.
    expect(lordoSelezione(order({ total: 25 }), null)).toBe(25)
  })
  it('una selezione che copre tutto il residuo vale il residuo intero', () => {
    expect(
      lordoSelezione(order({ total: 25 }), [
        { drink_id: 'mojito', unit_price: 7, qty: 2 },
        { drink_id: 'gin', unit_price: 8, qty: 1 },
      ])
    ).toBe(25)
  })
  it('una riga sparita dal conto non si sconta più', () => {
    // Lo sconto era stato preparato su un Amaro che dal conto è stato tolto:
    // la sua base cala a zero, se no si sconterebbe qualcosa che non c'è.
    expect(lordoSelezione(order(), [{ drink_id: 'amaro', unit_price: 5, qty: 1 }])).toBe(0)
  })
  it('e una quantità più alta di quella che resta si accorcia', () => {
    expect(lordoSelezione(order(), [{ drink_id: 'mojito', unit_price: 7, qty: 5 }])).toBe(14)
  })
})

describe('uno sconto più grande di quello che sconta', () => {
  it('non fa mai scendere sotto zero l’incasso della selezione', () => {
    const o = order({
      discount: { type: 'euro', value: 30 },
      discount_amount: 30,
      discount_items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
    })
    expect(selectionAmount(o, [{ drink_id: 'gin', unit_price: 8, qty: 1 }])).toBe(0)
    // E chi incassa lo vede prima di chiudere: 30 € su 8 € di Gin Tonic.
    expect(scontoEccessivo(o)).toBe(true)
  })
  it('e su tutto il conto resta il controllo di sempre', () => {
    expect(scontoEccessivo(order({ discount_amount: 30 }))).toBe(true)
    expect(scontoEccessivo(order({ discount_amount: 22 }))).toBe(false)
  })
})

// ── I CONTI DI IERI SERA ─────────────────────────────────────────────
// In produzione ci sono conti aperti con lo sconto vecchio: uno solo, su tutto
// il conto, senza `discount_items` e senza sconti dentro i pagamenti. Non si
// migrano al volo — si devono leggere e chiudere esattamente come prima.
describe('un conto con lo sconto vecchio si legge come prima', () => {
  const vecchio = order({ discount: { type: 'percent', value: 10 }, discount_amount: 2.2 })

  it('totale, residuo e sconto sono quelli di sempre', () => {
    expect(scontoTotale(vecchio)).toBe(2.2)
    expect(orderTotal(vecchio)).toBe(19.8)
    expect(orderDue(vecchio)).toBe(19.8)
  })
  it('pagando tutto il residuo si chiude al centesimo', () => {
    expect(
      selectionAmount(vecchio, [
        { drink_id: 'mojito', unit_price: 7, qty: 2 },
        { drink_id: 'gin', unit_price: 8, qty: 1 },
      ])
    ).toBe(19.8)
  })
  it('e sullo scontrino resta la riga «Sconto», non una lista', () => {
    expect(scontiDelConto(vecchio)).toEqual([
      { etichetta: 'Sconto', importo: 2.2, consumato: false },
    ])
  })
})

describe('come si chiamano gli sconti sullo scontrino', () => {
  it('uno solo su tutto il conto resta «Sconto»', () => {
    expect(
      scontiDelConto(order({ discount: { type: 'euro', value: 3 }, discount_amount: 3 }))
    ).toEqual([{ etichetta: 'Sconto', importo: 3, consumato: false }])
  })
  it('un buono da solo si chiama «Buono»', () => {
    expect(
      scontiDelConto(order({ discount: { type: 'buono', value: 5 }, discount_amount: 5 }))
    ).toEqual([{ etichetta: 'Buono', importo: 5, consumato: false }])
  })
  it('da due in su ognuno dice su che cosa cadeva', () => {
    expect(scontiDelConto(conDueSconti())).toEqual([
      { etichetta: 'Sconto su 1 prodotto', importo: 2, consumato: true },
      { etichetta: 'Sconto 10% su 2 prodotti', importo: 1.4, consumato: false },
    ])
  })
  it('l’etichetta dice tipo e quantità, singolare compreso', () => {
    expect(etichettaSconto({ type: 'percent', value: 10, items: [{ qty: 3 }] })).toBe(
      'Sconto 10% su 3 prodotti'
    )
    expect(etichettaSconto({ type: 'euro', value: 4, items: [{ qty: 1 }] })).toBe(
      'Sconto su 1 prodotto'
    )
    expect(etichettaSconto({ type: 'buono', value: 5, items: [{ qty: 2 }] })).toBe(
      'Buono su 2 prodotti'
    )
    expect(etichettaSconto({ type: 'euro', value: 4, items: null })).toBe('Sconto')
  })
})

// ── UN BUONO SU UNA PARTE DEL CONTO ──────────────────────────────────
// Il buono è uno sconto come gli altri: cade sulle righe che si stanno
// riscuotendo e, quando quelle vengono incassate, se ne va dentro il pagamento
// col suo `voucher_id` — che serve a ridare il credito se il conto viene
// riaperto (vedi lib/ripristino.js).
describe('un buono speso su una parte del conto', () => {
  const conBuono = () =>
    order({
      payments: [
        {
          id: 'p1',
          amount: 3,
          method: 'banco',
          items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
          sconto: {
            type: 'buono',
            value: 5,
            amount: 5,
            voucher_id: 'v1',
            voucher_name: 'Lele',
            items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
          },
        },
      ],
    })

  it('copre solo le sue righe: il resto del conto resta a prezzo pieno', () => {
    const o = conBuono()
    expect(scontoTotale(o)).toBe(5)
    expect(orderDue(o)).toBe(14) // i due Mojito
    expect(lordoResiduo(o)).toBe(14)
  })
  it('e sul conto dice su che cosa è stato speso', () => {
    // Era legato a una riga sola: la dice, se no «Buono −5,00 €» su un conto
    // da 22 lascia credere che quei 5 € valessero per tutto il tavolo.
    expect(scontiDelConto(conBuono())).toEqual([
      { etichetta: 'Buono su 1 prodotto', importo: 5, consumato: true },
    ])
  })
})

describe('che cosa è stato pagato, con gli sconti dentro', () => {
  it('ogni incasso porta accanto lo sconto che si è portato via', () => {
    const d = dettaglioIncassi(conDueSconti())
    expect(d.sconto).toBe(3.4) // il numero unico è la SOMMA di tutti
    expect(d.sconti).toHaveLength(2)
    expect(d.incassi[0].sconto).toEqual({ importo: 2, etichetta: 'Sconto su 1 prodotto' })
  })
  it('un incasso senza sconto non ne inventa uno', () => {
    const d = dettaglioIncassi(order({ payments: [{ amount: 10, method: 'banco' }] }))
    expect(d.incassi[0].sconto).toBeNull()
    expect(d.sconti).toEqual([])
  })
})
