'use strict'

// BDD — updateSumUpSaleStatus (functions/lib/sumup-service.js → updateSaleStatus)
// Feature: aggiornamento dello stato di una vendita su SumUp POS Pro.

import { describe, it, expect, vi } from 'vitest'
import { updateSaleStatus } from '../../functions/lib/sumup-service.js'

function makeDeps({ configured = true } = {}) {
  const sumupFetch = vi.fn(async () => null)
  const deps = { sumupFetch, isConfigured: () => configured }
  return { deps, sumupFetch }
}

describe('Feature: aggiornamento stato vendita SumUp', () => {
  it('TC-STATUS-001: Dato SumUp non configurato, Quando aggiorno, Allora è no-op', async () => {
    const { deps, sumupFetch } = makeDeps({ configured: false })

    const res = await updateSaleStatus(deps, { saleId: 'sale-1', status: 'ACCEPTED' })

    expect(res).toEqual({ skipped: true })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-STATUS-002: Dato nessun saleId, Quando aggiorno, Allora salto senza chiamare SumUp', async () => {
    const { deps, sumupFetch } = makeDeps()

    const res = await updateSaleStatus(deps, { saleId: '', status: 'ACCEPTED' })

    expect(res).toEqual({ skipped: true, reason: 'nessun sumup_sale_id' })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-STATUS-003: Dato un saleId, Quando aggiorno, Allora PUT /external_sales/{id}/status', async () => {
    const { deps, sumupFetch } = makeDeps()

    const res = await updateSaleStatus(deps, { saleId: 'sale-9', status: 'COMPLETED' })

    expect(res).toEqual({ updated: true })
    const [path, options] = sumupFetch.mock.calls[0]
    expect(path).toBe('/external_sales/sale-9/status')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ status: 'COMPLETED' })
  })
})
