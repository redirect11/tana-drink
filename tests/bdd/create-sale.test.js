'use strict'

// BDD — createSumUpSale (functions/lib/sumup-service.js → createSale)
// Feature: invio di un ordine a SumUp POS Pro come External Sale.

import { describe, it, expect, vi } from 'vitest'
import { createSale } from '../../functions/lib/sumup-service.js'
import { createFakeFirestore } from '../helpers/fakeFirestore.js'

// CHI CHIAMA. Il ruolo vive nel custom claim del token, come in produzione.
const BANCO = { token: { role: 'bartender' } }
const SALA = { token: { role: 'staff' } }
const CLIENTE = { token: {} } // registrato ma senza ruolo
const NESSUNO = null // nemmeno il login

function makeDeps({ configured = true, saleResponse = { id: 'sale-1' }, seed = {} } = {}) {
  const { db, store, calls } = createFakeFirestore(seed)
  const sumupFetch = vi.fn(async () => saleResponse)
  const deps = { db, sumupFetch, isConfigured: () => configured }
  return { deps, db, store, calls, sumupFetch }
}

const orderData = {
  orderId: 'order-1',
  tableLabel: '5',
  note: 'poco ghiaccio',
  items: [{ sumup_product_id: 'p1', name: 'Negroni', qty: 2, unit_price: 8.5 }],
}

// L'ordine COM'È SUL SERVER: è questa la copia di cui ci si fida, e da qui
// escono i prezzi che finiscono nella vendita SumUp.
const ordineSulServer = {
  orders: {
    'order-1': {
      status: 'ricevuto',
      table_label: '5',
      note: 'poco ghiaccio',
      items: [{ sumup_product_id: 'p1', name: 'Negroni', qty: 2, unit_price: 8.5 }],
    },
  },
}

describe('Feature: invio ordine a SumUp', () => {
  it('TC-SALE-001: Dato SumUp non configurato, Quando invio la vendita, Allora è no-op', async () => {
    const { deps, sumupFetch } = makeDeps({ configured: false })

    const res = await createSale(deps, BANCO, orderData)

    expect(res).toEqual({ skipped: true })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-SALE-002: Dato un ordine, Quando invio, Allora POST /external_sales con il payload corretto', async () => {
    const { deps, sumupFetch } = makeDeps({ seed: ordineSulServer })

    const res = await createSale(deps, BANCO, orderData)

    expect(res).toEqual({ saleId: 'sale-1' })
    expect(sumupFetch).toHaveBeenCalledTimes(1)
    const [path, options] = sumupFetch.mock.calls[0]
    expect(path).toBe('/external_sales')
    expect(options.method).toBe('POST')
    const payload = JSON.parse(options.body)
    expect(payload.customer_name).toBe('Tavolo 5')
    expect(payload.sale_items[0].total_price).toBe(17)
  })

  it('TC-SALE-003: Data una vendita con id, Quando invio, Allora persisto sumup_sale_id sull\'ordine', async () => {
    const { deps, store } = makeDeps({ seed: ordineSulServer })

    await createSale(deps, BANCO, orderData)

    expect(store.orders['order-1'].sumup_sale_id).toBe('sale-1')
  })

  it('Data una vendita senza id, Quando invio, Allora non scrivo sumup_sale_id', async () => {
    const { deps, store, calls } = makeDeps({
      saleResponse: {},
      seed: ordineSulServer,
    })

    const res = await createSale(deps, BANCO, orderData)

    expect(res).toEqual({ saleId: null })
    expect(calls.updates).toHaveLength(0)
    expect(store.orders['order-1'].sumup_sale_id).toBeUndefined()
  })
  // ── CHI PUÒ CHIAMARLA (BUG-094) ───────────────────────────────────────────
  //
  // Prima: nessuno controllava. Un `onCall` v2 non chiede autenticazione di
  // suo, e qui non c'era né requireRole né App Check. Con SumUp acceso,
  // chiunque conoscesse l'id del progetto — sta nel bundle — poteva attaccare
  // una vendita all'ordine di un altro tavolo, coi prezzi che voleva.
  it('TC-SALE-004: Dato un cliente, Quando invia una vendita, Allora è respinto', async () => {
    const { deps, sumupFetch } = makeDeps({ seed: ordineSulServer })

    await expect(createSale(deps, CLIENTE, orderData)).rejects.toMatchObject({
      code: 'permission-denied',
    })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-SALE-005: Dato nessun login, Quando invia una vendita, Allora è respinto', async () => {
    const { deps, sumupFetch } = makeDeps({ seed: ordineSulServer })

    await expect(createSale(deps, NESSUNO, orderData)).rejects.toMatchObject({
      code: 'permission-denied',
    })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  // La sala prende gli ordini al tavolo: deve poterli mandare al POS.
  it('TC-SALE-006: Data la sala, Quando invia una vendita, Allora passa', async () => {
    const { deps, sumupFetch } = makeDeps({ seed: ordineSulServer })

    await expect(createSale(deps, SALA, orderData)).resolves.toEqual({ saleId: 'sale-1' })
    expect(sumupFetch).toHaveBeenCalledTimes(1)
  })

  // SPENTO VIENE PRIMA DI TUTTO, ed è voluto: con SumUp spento questa
  // funzione non fa niente, e deve restare un no-op silenzioso anche per chi
  // non ha titolo — altrimenti il telefono del cliente, che la chiama a ogni
  // ordine, comincerebbe a prendere errori per una cosa che non succede.
  it('TC-SALE-007: Dato SumUp spento, Quando chiama un cliente, Allora tace invece di protestare', async () => {
    const { deps, sumupFetch } = makeDeps({ configured: false })

    await expect(createSale(deps, CLIENTE, orderData)).resolves.toEqual({ skipped: true })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  // ── I PREZZI LI METTE IL SERVER (BUG-094) ─────────────────────────────────
  //
  // Prima `unit_price` e `qty` arrivavano dal client e finivano tali e quali
  // nella vendita: due Negroni a un centesimo, e il POS li registrava così.
  it('TC-SALE-008: Dati prezzi falsi dal client, Quando invio, Allora vale quello che dice l’ordine', async () => {
    const { deps, sumupFetch } = makeDeps({ seed: ordineSulServer })

    await createSale(deps, BANCO, {
      ...orderData,
      items: [{ sumup_product_id: 'p1', name: 'Negroni', qty: 2, unit_price: 0.01 }],
    })

    const payload = JSON.parse(sumupFetch.mock.calls[0][1].body)
    expect(payload.sale_items[0].unit_price).toBe(8.5)
    expect(payload.sale_items[0].total_price).toBe(17)
  })

  // IL CONTO È LOCAL-FIRST: creaOrdine scrive senza aspettare e chiama subito
  // questa, quindi il documento può essere ancora per strada. Pretenderlo
  // vorrebbe dire perdere la vendita di ogni conto battuto con la linea lenta.
  it('TC-SALE-009: Dato un ordine non ancora sul server, Quando invio, Allora la vendita parte lo stesso', async () => {
    const { deps, sumupFetch } = makeDeps()

    await createSale(deps, BANCO, orderData)

    expect(sumupFetch).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(sumupFetch.mock.calls[0][1].body)
    expect(payload.sale_items[0].total_price).toBe(17)
  })
})
