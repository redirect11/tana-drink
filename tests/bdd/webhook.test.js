'use strict'

// BDD — sumupWebhook (functions/lib/sumup-service.js → handleWebhook)
// Feature: webhook in entrata da SumUp POS Pro che aggiorna lo stato dell'ordine.
//
// IL PAYLOAD NON SI CREDE MAI (BUG-095). Prima `sale_id` E `status` si
// prendevano dal corpo e finivano dritti sull'ordine: chi conosceva o
// indovinava un `sumup_sale_id` mandava `{sale_id, status: 'COMPLETED'}`
// all'endpoint pubblico e faceva avanzare di stato l'ordine di un altro
// tavolo. Adesso il messaggio è solo una sveglia: chi bussa lo dice il
// gettone `Verification-Token`, e cosa è successo lo si rilegge dall'API.

import { describe, it, expect, vi } from 'vitest'
import { handleWebhook } from '../../functions/lib/sumup-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

const GETTONE = 'gettone-del-back-office'

function makeDeps({ seed = {}, configured = true, vendita = { current_status: 'ACCEPTED' } } = {}) {
  const { db, store, calls } = createFakeFirestore(seed)
  const sumupFetch = vi.fn(async () => vendita)
  const deps = {
    db,
    sumupFetch,
    isConfigured: () => configured,
    webhookToken: () => GETTONE,
  }
  return { deps, db, store, calls, sumupFetch }
}

const seededOrder = {
  orders: {
    'order-1': { status: 'ricevuto', sumup_sale_id: 'sale-1' },
  },
}

// Una richiesta come la manda SumUp: col gettone nell'header.
const richiesta = (body, headers = { 'verification-token': GETTONE }) => ({
  method: 'POST',
  body,
  headers,
})

describe('Feature: webhook SumUp', () => {
  it('TC-HOOK-001: Dato un metodo non POST, Allora risponde 405', async () => {
    const { deps, calls } = makeDeps()

    const res = await handleWebhook(deps, { method: 'GET', body: {}, headers: {} })

    expect(res).toEqual({ status: 405, body: 'Method Not Allowed' })
    expect(calls.updates).toHaveLength(0)
  })

  it('TC-HOOK-002: Dato un POST senza sale_id, Allora risponde 400', async () => {
    const { deps } = makeDeps()

    const res = await handleWebhook(deps, richiesta({ status: 'ACCEPTED' }))

    expect(res).toEqual({ status: 400, body: 'Missing sale_id' })
  })

  it('TC-HOOK-003: Dato uno stato non mappato, Allora 200 OK senza modifiche', async () => {
    const { deps, store, calls } = makeDeps({
      seed: seededOrder,
      vendita: { current_status: 'CREATED' },
    })

    const res = await handleWebhook(deps, richiesta({ sale_id: 'sale-1' }))

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(calls.updates).toHaveLength(0)
    expect(store.orders['order-1'].status).toBe('ricevuto')
  })

  it('TC-HOOK-004: Dato uno stato mappato e ordine corrispondente, Allora aggiorna lo status', async () => {
    const { deps, store } = makeDeps({ seed: seededOrder })

    const res = await handleWebhook(deps, richiesta({ sale_id: 'sale-1' }))

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(store.orders['order-1'].status).toBe('in_preparazione')
  })

  it('TC-HOOK-004b: COMPLETED e CANCELLED mappano entrambi su "ritirato"', async () => {
    const a = makeDeps({ seed: seededOrder, vendita: { current_status: 'COMPLETED' } })
    await handleWebhook(a.deps, richiesta({ sale_id: 'sale-1' }))
    expect(a.store.orders['order-1'].status).toBe('ritirato')

    const b = makeDeps({ seed: seededOrder, vendita: { current_status: 'CANCELLED' } })
    await handleWebhook(b.deps, richiesta({ sale_id: 'sale-1' }))
    expect(b.store.orders['order-1'].status).toBe('ritirato')
  })

  it('TC-HOOK-005: Dato nessun ordine corrispondente, Allora 200 OK senza errori', async () => {
    const { deps, calls, sumupFetch } = makeDeps({ seed: seededOrder })

    const res = await handleWebhook(deps, richiesta({ sale_id: 'sale-ignota' }))

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(calls.updates).toHaveLength(0)
    // E nemmeno si va a chiedere a SumUp di una vendita che non è nostra.
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  // ── LO STATO NON SI PRENDE DAL PAYLOAD (BUG-095) ──────────────────────────
  it('TC-HOOK-006: Dato uno status falso nel corpo, Allora vale quello che dice SumUp', async () => {
    const { deps, store, sumupFetch } = makeDeps({
      seed: seededOrder,
      vendita: { current_status: 'ACCEPTED' },
    })

    // Il corpo grida «COMPLETED», l'API dice «ACCEPTED». Vince l'API.
    await handleWebhook(deps, richiesta({ sale_id: 'sale-1', status: 'COMPLETED' }))

    expect(sumupFetch).toHaveBeenCalledWith('/external_sales/sale-1')
    expect(store.orders['order-1'].status).toBe('in_preparazione')
  })

  // ── CHI BUSSA (BUG-095) ───────────────────────────────────────────────────
  // SumUp POS Pro non firma i webhook: l'unica difesa che offre è il gettone
  // condiviso dell'header. È un bearer, non una firma — per questo autentica
  // la chiamata ma non basta, e lo stato si rilegge comunque dall'API.
  it('TC-HOOK-007: Dato un gettone sbagliato, Allora 401 e non si tocca niente', async () => {
    const { deps, store, calls, sumupFetch } = makeDeps({ seed: seededOrder })

    const res = await handleWebhook(
      deps,
      richiesta({ sale_id: 'sale-1', status: 'COMPLETED' }, { 'verification-token': 'indovinato' })
    )

    expect(res).toEqual({ status: 401, body: 'Unauthorized' })
    expect(calls.updates).toHaveLength(0)
    expect(sumupFetch).not.toHaveBeenCalled()
    expect(store.orders['order-1'].status).toBe('ricevuto')
  })

  it('TC-HOOK-008: Dato nessun gettone, Allora 401', async () => {
    const { deps, calls } = makeDeps({ seed: seededOrder })

    const res = await handleWebhook(deps, richiesta({ sale_id: 'sale-1' }, {}))

    expect(res).toEqual({ status: 401, body: 'Unauthorized' })
    expect(calls.updates).toHaveLength(0)
  })

  // Un controllo che si spegne da solo quando manca la configurazione non è
  // un controllo: è la stessa trappola di App Check, che il token lo produce
  // e nessuno lo pretende.
  it('TC-HOOK-009: Dato il gettone non configurato, Allora rifiuta invece di lasciar correre', async () => {
    const { deps, calls } = makeDeps({ seed: seededOrder })
    deps.webhookToken = () => ''

    const res = await handleWebhook(deps, richiesta({ sale_id: 'sale-1' }, {}))

    expect(res).toEqual({ status: 401, body: 'Unauthorized' })
    expect(calls.updates).toHaveLength(0)
  })

  // ── LA GUARDIA CHE MANCAVA (BUG-095) ──────────────────────────────────────
  it('TC-HOOK-010: Dato SumUp spento, Allora 200 senza toccare niente', async () => {
    const { deps, calls, sumupFetch } = makeDeps({ seed: seededOrder, configured: false })

    const res = await handleWebhook(deps, richiesta({ sale_id: 'sale-1', status: 'COMPLETED' }))

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(calls.updates).toHaveLength(0)
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  // ── LA FORMA VERA DEL MESSAGGIO (BUG-095) ─────────────────────────────────
  // SumUp POS Pro annida la vendita: { data: { sale: { id, url } } }. Il
  // parser leggeva solo `sale_id`/`id` in cima, e di quel messaggio non
  // avrebbe trovato niente.
  it('TC-HOOK-011: Dato il messaggio annidato di SumUp, Allora l’ordine si trova lo stesso', async () => {
    const { deps, store } = makeDeps({ seed: seededOrder })

    const res = await handleWebhook(
      deps,
      richiesta({
        event_type: 'sale.completed',
        data: { sale: { id: 'sale-1', url: 'https://api.thegoodtill.com/api/sales/sale-1' } },
      })
    )

    expect(res).toEqual({ status: 200, body: 'OK' })
    expect(store.orders['order-1'].status).toBe('in_preparazione')
  })
})
