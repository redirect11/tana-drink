'use strict'

// Unit test della logica pura SumUp (functions/lib/sumup-core.js).
// Nessuna dipendenza da Firebase o rete: solo trasformazioni deterministiche.

import { describe, it, expect } from 'vitest'
import {
  extractProducts,
  mapProductToDrink,
  buildSalePayload,
  mapWebhookStatus,
  parseWebhookBody,
  buildSumupHeaders,
  buildSumupUrl,
  leggiTokenWebhook,
  tokenCorrisponde,
} from '../../functions/lib/sumup-core.js'

// ── TC-CORE-001: extractProducts ──────────────────────────────────────────────

describe('extractProducts (TC-CORE-001)', () => {
  it('restituisce un array diretto così com\'è', () => {
    const arr = [{ id: '1' }, { id: '2' }]
    expect(extractProducts(arr)).toEqual(arr)
  })

  it('estrae la chiave "products" da un oggetto', () => {
    expect(extractProducts({ products: [{ id: '1' }] })).toEqual([{ id: '1' }])
  })

  it('estrae la chiave "items" se "products" è assente', () => {
    expect(extractProducts({ items: [{ id: '9' }] })).toEqual([{ id: '9' }])
  })

  it.each([null, undefined, {}, 0, ''])('restituisce [] per input non valido: %s', (input) => {
    expect(extractProducts(input)).toEqual([])
  })
})

// ── TC-CORE-002 / TC-CORE-003: mapProductToDrink ──────────────────────────────

describe('mapProductToDrink', () => {
  it('TC-CORE-002: mappa i campi principali con coercizione del prezzo', () => {
    const drink = mapProductToDrink({
      id: '42',
      name: 'Negroni',
      price: '8.5',
      category: 'Cocktail',
      description: 'Bitter',
    })
    expect(drink).toEqual({
      name: 'Negroni',
      price: 8.5,
      category: 'Cocktail',
      description: 'Bitter',
      available: true,
      sumup_product_id: '42',
    })
  })

  it('TC-CORE-002: usa i nomi di campo alternativi (product_id, product_name, unit_price, department_name)', () => {
    const drink = mapProductToDrink({
      product_id: 7,
      product_name: 'Spritz',
      unit_price: 6,
      department_name: 'Aperitivi',
    })
    expect(drink.sumup_product_id).toBe('7')
    expect(drink.name).toBe('Spritz')
    expect(drink.price).toBe(6)
    expect(drink.category).toBe('Aperitivi')
    expect(drink.description).toBeNull()
  })

  it('TC-CORE-003: restituisce null se manca un id utilizzabile', () => {
    expect(mapProductToDrink({ name: 'Senza id' })).toBeNull()
    expect(mapProductToDrink({})).toBeNull()
  })

  it('available è false solo se active===false o available===false', () => {
    expect(mapProductToDrink({ id: '1', active: false }).available).toBe(false)
    expect(mapProductToDrink({ id: '1', available: false }).available).toBe(false)
    expect(mapProductToDrink({ id: '1', active: true }).available).toBe(true)
    expect(mapProductToDrink({ id: '1' }).available).toBe(true)
  })

  it('prezzo mancante o non numerico diventa 0', () => {
    expect(mapProductToDrink({ id: '1' }).price).toBe(0)
  })
})

// ── TC-CORE-004: buildSalePayload ─────────────────────────────────────────────

describe('buildSalePayload (TC-CORE-004)', () => {
  const items = [
    { sumup_product_id: 'p1', name: 'Negroni', qty: 2, unit_price: 8.5 },
    { name: 'Acqua', qty: 1, unit_price: 1.337 },
  ]

  it('deriva customer_name dal tavolo quando presente', () => {
    const payload = buildSalePayload({ tableLabel: '7', note: 'no ghiaccio', items })
    expect(payload.customer_name).toBe('Tavolo 7')
    expect(payload.notes).toBe('no ghiaccio')
  })

  it('usa "Cliente" e notes null senza tavolo/nota', () => {
    const payload = buildSalePayload({ items })
    expect(payload.customer_name).toBe('Cliente')
    expect(payload.notes).toBeNull()
  })

  it('mappa le righe con total_price arrotondato a 2 decimali', () => {
    const payload = buildSalePayload({ items })
    expect(payload.sale_items[0]).toEqual({
      product_id: 'p1',
      product_name: 'Negroni',
      quantity: 2,
      unit_price: 8.5,
      total_price: 17,
    })
    // 1 * 1.337 = 1.337 → 1.34
    expect(payload.sale_items[1].total_price).toBe(1.34)
    expect(payload.sale_items[1].product_id).toBeNull()
  })

  it('gestisce items mancante come lista vuota', () => {
    expect(buildSalePayload({}).sale_items).toEqual([])
  })
})

// ── TC: webhook helpers ───────────────────────────────────────────────────────

describe('mapWebhookStatus', () => {
  it('mappa gli stati noti', () => {
    expect(mapWebhookStatus('ACCEPTED')).toBe('in_preparazione')
    expect(mapWebhookStatus('COMPLETED')).toBe('ritirato')
    expect(mapWebhookStatus('CANCELLED')).toBe('ritirato')
  })

  it('restituisce undefined per stati non mappati', () => {
    expect(mapWebhookStatus('CREATED')).toBeUndefined()
    expect(mapWebhookStatus('')).toBeUndefined()
  })
})

describe('parseWebhookBody', () => {
  it('estrae sale_id e status', () => {
    expect(parseWebhookBody({ sale_id: '123', status: 'ACCEPTED' })).toEqual({ saleId: '123', status: 'ACCEPTED' })
  })

  it('usa "id" come fallback di sale_id', () => {
    expect(parseWebhookBody({ id: 99 }).saleId).toBe('99')
  })

  it('restituisce stringhe vuote per corpo assente', () => {
    expect(parseWebhookBody(null)).toEqual({ saleId: '', status: '' })
    expect(parseWebhookBody(undefined)).toEqual({ saleId: '', status: '' })
  })
})

// ── TC: helpers HTTP ──────────────────────────────────────────────────────────

describe('helpers HTTP', () => {
  it('buildSumupHeaders include Vendor-Id e Outlet-Id', () => {
    expect(buildSumupHeaders('V1', 'O1')).toEqual({
      'Content-Type': 'application/json',
      'Vendor-Id': 'V1',
      'Outlet-Id': 'O1',
    })
  })

  it('buildSumupUrl concatena base e path', () => {
    expect(buildSumupUrl('https://api.example/api', '/products')).toBe('https://api.example/api/products')
  })
})

// ── IL GETTONE DEL WEBHOOK (BUG-095) ────────────────────────────────────────
// SumUp POS Pro non firma i webhook: niente HMAC, niente timestamp firmato.
// L'unica difesa che offre è un segreto condiviso statico nell'header
// `Verification-Token`.
describe('Il gettone del webhook POS Pro', () => {
  it('si legge dall’header, comunque sia scritto', () => {
    expect(leggiTokenWebhook({ 'verification-token': 'abc' })).toBe('abc')
    expect(leggiTokenWebhook({ 'Verification-Token': 'abc' })).toBe('abc')
    expect(leggiTokenWebhook({})).toBe('')
    expect(leggiTokenWebhook(null)).toBe('')
  })

  it('corrisponde solo se è identico', () => {
    expect(tokenCorrisponde('segreto', 'segreto')).toBe(true)
    expect(tokenCorrisponde('segreto', 'segretx')).toBe(false)
    expect(tokenCorrisponde('segreto', 'segret')).toBe(false)
    expect(tokenCorrisponde('segreto', 'segretoo')).toBe(false)
  })

  // Se il gettone non è configurato NON passa niente: un controllo che si
  // spegne da solo quando manca la configurazione non è un controllo.
  it('e senza gettone configurato non corrisponde mai', () => {
    expect(tokenCorrisponde('', '')).toBe(false)
    expect(tokenCorrisponde(null, 'qualsiasi')).toBe(false)
    expect(tokenCorrisponde(undefined, undefined)).toBe(false)
  })
})
