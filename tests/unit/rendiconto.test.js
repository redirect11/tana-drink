'use strict'

// Unit test del rendiconto serata (src/lib/rendiconto.js): ricavi al netto
// degli sconti, costo dalle ricette, guadagno e cumulativo per prodotto.

import { describe, it, expect } from 'vitest'
import {
  orderRecap,
  rendicontoOrdini,
  rendicontoProdotti,
  categorieDi,
  sommaRighe,
  lineCost,
} from '../../src/lib/rendiconto.js'

// Inventario (IVA a 0 per far tornare i conti a mente):
//   gin    → bottiglia da 1 L a 30 € = 0,30 €/cl → 5 cl costano 1,50
//   tonica → 1 pezzo a 0,50 €
const itemsById = {
  gin: { id: 'gin', name: 'Gin', unit: 'ml', package_size: 1000, cost: 30, vat: 0 },
  tonica: { id: 'tonica', name: 'Tonica', unit: 'pz', cost: 0.5, vat: 0 },
}
const drinksById = {
  gt: {
    id: 'gt',
    name: 'Gin Tonic',
    category: 'COCKTAIL',
    recipe_items: [
      { inventory_item_id: 'gin', name: 'Gin', qty: 5, unit: 'cl' }, // 1,50
      { inventory_item_id: 'tonica', name: 'Tonica', qty: 1, unit: 'pz' }, // 0,50
    ],
  },
  birra: { id: 'birra', name: 'Ceres', category: 'BIRRE' }, // senza ricetta
}
const ctx = { drinksById, itemsById }

const conto = (over = {}) => ({
  id: 'o1',
  daily_number: 7,
  status: 'pagato',
  payment_status: 'pagato',
  paid_at: '2026-08-08T22:00:00.000Z',
  payments: [{ method: 'carta', amount: 10, at: '2026-08-08T22:00:00.000Z' }],
  total: 10,
  discount_amount: 0,
  order_items: [
    { drink_id: 'gt', name: 'Gin Tonic', qty: 1, unit_price: 6 },
    { drink_id: 'birra', name: 'Ceres', qty: 1, unit_price: 4 },
  ],
  ...over,
})

describe('costo di una riga', () => {
  it('valorizza la ricetta sull’inventario', () => {
    const c = lineCost({ qty: 2, drink_id: 'gt' }, drinksById.gt, itemsById)
    expect(c.costo).toBe(4) // (1,50 + 0,50) × 2
    expect(c.noto).toBe(true)
  })

  it('senza ricetta il costo non è zero: è ignoto', () => {
    const c = lineCost({ qty: 3, drink_id: 'birra' }, drinksById.birra, itemsById)
    expect(c.costo).toBe(0)
    expect(c.noto).toBe(false) // chi mostra il dato deve poterlo dire
  })
})

describe('rendiconto di un conto', () => {
  it('senza sconto: incassato = listino, guadagno = incassato − costo', () => {
    const r = orderRecap(conto(), ctx)
    expect(r.lordo).toBe(10)
    expect(r.sconto).toBe(0)
    expect(r.netto).toBe(10)
    expect(r.costo).toBe(2) // solo il gin tonic è valorizzato
    expect(r.guadagno).toBe(8)
    expect(r.parziale).toBe(true) // la birra non ha ricetta: va detto
  })

  it('lo sconto si ripartisce in proporzione al prezzo', () => {
    const r = orderRecap(conto({ discount_amount: 1 }), ctx) // −10%
    const gt = r.righe.find((x) => x.name === 'Gin Tonic')
    const ceres = r.righe.find((x) => x.name === 'Ceres')
    expect(gt.netto).toBe(5.4) // 6 − 10%
    expect(ceres.netto).toBe(3.6) // 4 − 10%
    // Le quote di sconto sommano ESATTAMENTE lo sconto del conto.
    expect(gt.sconto + ceres.sconto).toBe(1)
    expect(r.netto).toBe(9)
    expect(r.guadagno).toBe(7) // 9 − 2
  })

  it('il margine è sul venduto, non sul listino', () => {
    const r = orderRecap(conto({ discount_amount: 1 }), ctx)
    expect(r.margine).toBe(77.8) // 7 / 9
  })

  it('il metodo di pagamento arriva dai pagamenti registrati', () => {
    expect(orderRecap(conto(), ctx).metodi).toEqual(['carta'])
  })

  it('legge anche gli ordini a comande', () => {
    const aComande = conto({
      order_items: undefined,
      comande: [
        { id: 'c1', items: [{ drink_id: 'gt', name: 'Gin Tonic', qty: 1, unit_price: 6 }] },
        { id: 'c2', items: [{ drink_id: 'gt', name: 'Gin Tonic', qty: 1, unit_price: 6 }] },
      ],
    })
    const r = orderRecap(aComande, ctx)
    expect(r.pezzi).toBe(2)
    expect(r.lordo).toBe(12)
  })
})

describe('liste e totali', () => {
  const ordini = [
    conto({ id: 'a', paid_at: '2026-08-08T21:00:00.000Z' }),
    conto({ id: 'b', paid_at: '2026-08-08T23:00:00.000Z', discount_amount: 1 }),
    conto({ id: 'c', status: 'annullato' }),
  ]

  it('gli annullati non sono venduto', () => {
    const lista = rendicontoOrdini(ordini, ctx)
    expect(lista).toHaveLength(2)
    expect(lista.map((r) => r.id)).toEqual(['b', 'a']) // dal più recente
  })

  it('il cumulativo somma i pezzi e il venduto reale', () => {
    const p = rendicontoProdotti(ordini, ctx)
    const gt = p.find((x) => x.name === 'Gin Tonic')
    expect(gt.qty).toBe(2)
    expect(gt.netto).toBe(11.4) // 6 pieno + 5,40 scontato
    expect(gt.prezzoMedio).toBe(5.7)
    expect(gt.costo).toBe(4)
    expect(gt.guadagno).toBe(7.4)
  })

  it('il prodotto senza ricetta è segnalato, non dato per gratis', () => {
    const ceres = rendicontoProdotti(ordini, ctx).find((x) => x.name === 'Ceres')
    expect(ceres.costoNoto).toBe(false)
  })

  it('le categorie contano i prodotti diversi, con "Tutte" in testa', () => {
    const cats = categorieDi(rendicontoProdotti(ordini, ctx))
    expect(cats[0].key).toBe('__tutte__')
    expect(cats[0].count).toBe(2)
    expect(cats.map((c) => c.key)).toContain('COCKTAIL')
    expect(cats.map((c) => c.key)).toContain('BIRRE')
  })

  it('i totali di colonna tornano col venduto', () => {
    const tot = sommaRighe(rendicontoOrdini(ordini, ctx))
    expect(tot.conti).toBe(2)
    expect(tot.lordo).toBe(20)
    expect(tot.sconto).toBe(1)
    expect(tot.netto).toBe(19)
    expect(tot.costo).toBe(4)
    expect(tot.guadagno).toBe(15)
  })

  it('i totali di una sola categoria valgono per quella categoria', () => {
    const soloBirre = rendicontoProdotti(ordini, ctx).filter((p) => p.categoria === 'BIRRE')
    const tot = sommaRighe(soloBirre)
    expect(tot.qty).toBe(2)
    expect(tot.netto).toBe(7.6) // 4 pieno + 3,60 scontato
  })
})
