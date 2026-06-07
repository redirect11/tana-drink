'use strict'

// BDD — syncSumUpProducts (functions/lib/sumup-service.js → syncProducts)
// Feature: sincronizzazione del catalogo SumUp POS Pro nella collezione drinks.

import { describe, it, expect, vi } from 'vitest'
import { syncProducts } from '../../functions/lib/sumup-service.js'
import { createFakeFirestore, fakeServerTimestamp, SERVER_TIMESTAMP } from '../helpers/fakeFirestore.js'

function makeDeps({ configured = true, products = [], seed = {} } = {}) {
  const { db, store, calls } = createFakeFirestore(seed)
  const sumupFetch = vi.fn(async () => products)
  const deps = {
    db,
    sumupFetch,
    isConfigured: () => configured,
    serverTimestamp: fakeServerTimestamp,
  }
  return { deps, db, store, calls, sumupFetch }
}

describe('Feature: sincronizzazione catalogo SumUp', () => {
  it('TC-SYNC-001: Dato SumUp non configurato, Quando sincronizzo, Allora è no-op', async () => {
    const { deps, sumupFetch, calls } = makeDeps({ configured: false })

    const res = await syncProducts(deps)

    expect(res).toEqual({ skipped: true, message: expect.any(String) })
    expect(sumupFetch).not.toHaveBeenCalled() // nessuna chiamata di rete
    expect(calls.adds).toHaveLength(0) // nessuna scrittura
    expect(calls.updates).toHaveLength(0)
  })

  it('TC-SYNC-002: Dati prodotti nuovi, Quando sincronizzo, Allora vengono creati con created_at', async () => {
    const { deps, store, calls } = makeDeps({
      products: [
        { id: 'p1', name: 'Negroni', price: 8.5 },
        { id: 'p2', name: 'Spritz', price: 6 },
      ],
    })

    const res = await syncProducts(deps)

    expect(res).toEqual({ synced: 2, total: 2 })
    expect(calls.adds).toHaveLength(2)
    expect(calls.updates).toHaveLength(0)
    // created_at impostato con il serverTimestamp iniettato
    const created = Object.values(store.drinks)
    expect(created.every((d) => d.created_at === SERVER_TIMESTAMP)).toBe(true)
    expect(created.map((d) => d.sumup_product_id).sort()).toEqual(['p1', 'p2'])
  })

  it('TC-SYNC-003: Dato un prodotto già presente, Quando sincronizzo, Allora viene aggiornato (no duplicati)', async () => {
    const { deps, store, calls } = makeDeps({
      products: [{ id: 'p1', name: 'Negroni Sbagliato', price: 9 }],
      seed: {
        drinks: {
          existing: { name: 'Negroni', price: 8.5, sumup_product_id: 'p1', created_at: 'old' },
        },
      },
    })

    const res = await syncProducts(deps)

    expect(res).toEqual({ synced: 1, total: 1 })
    expect(calls.adds).toHaveLength(0) // nessun nuovo documento
    expect(calls.updates).toHaveLength(1)
    expect(store.drinks.existing.name).toBe('Negroni Sbagliato')
    expect(store.drinks.existing.price).toBe(9)
    expect(store.drinks.existing.created_at).toBe('old') // l'update non tocca created_at
  })

  it('TC-SYNC-004: Dati prodotti senza id, Quando sincronizzo, Allora vengono saltati', async () => {
    const { deps, calls } = makeDeps({
      products: [{ name: 'Senza id' }, { id: 'p3', name: 'Valido' }],
    })

    const res = await syncProducts(deps)

    expect(res).toEqual({ synced: 1, total: 2 })
    expect(calls.adds).toHaveLength(1)
  })
})
