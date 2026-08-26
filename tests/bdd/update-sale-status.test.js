'use strict'

// BDD — updateSumUpSaleStatus (functions/lib/sumup-service.js → updateSaleStatus)
// Feature: aggiornamento dello stato di una vendita su SumUp POS Pro.

import { describe, it, expect, vi } from 'vitest'
import { updateSaleStatus } from '../../functions/lib/sumup-service.js'

// CHI CHIAMA. Il ruolo vive nel custom claim del token, come in produzione.
const BANCO = { token: { role: 'bartender' } }
const SALA = { token: { role: 'staff' } }
const CLIENTE = { token: {} } // registrato ma senza ruolo
const NESSUNO = null // nemmeno il login

function makeDeps({ configured = true } = {}) {
  const sumupFetch = vi.fn(async () => null)
  const deps = { sumupFetch, isConfigured: () => configured }
  return { deps, sumupFetch }
}

describe('Feature: aggiornamento stato vendita SumUp', () => {
  it('TC-STATUS-001: Dato SumUp non configurato, Quando aggiorno, Allora è no-op', async () => {
    const { deps, sumupFetch } = makeDeps({ configured: false })

    const res = await updateSaleStatus(deps, BANCO, { saleId: 'sale-1', status: 'ACCEPTED' })

    expect(res).toEqual({ skipped: true })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-STATUS-002: Dato nessun saleId, Quando aggiorno, Allora salto senza chiamare SumUp', async () => {
    const { deps, sumupFetch } = makeDeps()

    const res = await updateSaleStatus(deps, BANCO, { saleId: '', status: 'ACCEPTED' })

    expect(res).toEqual({ skipped: true, reason: 'nessun sumup_sale_id' })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-STATUS-003: Dato un saleId, Quando aggiorno, Allora PUT /external_sales/{id}/status', async () => {
    const { deps, sumupFetch } = makeDeps()

    const res = await updateSaleStatus(deps, BANCO, { saleId: 'sale-9', status: 'COMPLETED' })

    expect(res).toEqual({ updated: true })
    const [path, options] = sumupFetch.mock.calls[0]
    expect(path).toBe('/external_sales/sale-9/status')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ status: 'COMPLETED' })
  })
  // ── CHI PUÒ CHIAMARLA (BUG-094) ───────────────────────────────────────────
  //
  // Prima nessun controllo: chi indovinava un sumup_sale_id poteva far
  // avanzare di stato la vendita di un altro tavolo.
  it('TC-STATUS-004: Dato un cliente, Quando cambia stato, Allora è respinto', async () => {
    const { deps, sumupFetch } = makeDeps()

    await expect(
      updateSaleStatus(deps, CLIENTE, { saleId: 'sale-1', status: 'COMPLETED' })
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  it('TC-STATUS-005: Dato nessun login, Quando cambia stato, Allora è respinto', async () => {
    const { deps, sumupFetch } = makeDeps()

    await expect(
      updateSaleStatus(deps, NESSUNO, { saleId: 'sale-1', status: 'COMPLETED' })
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(sumupFetch).not.toHaveBeenCalled()
  })

  // La sala segna «servito» al tavolo: deve poter far avanzare la vendita.
  it('TC-STATUS-006: Data la sala, Quando cambia stato, Allora passa', async () => {
    const { deps, sumupFetch } = makeDeps()

    await expect(
      updateSaleStatus(deps, SALA, { saleId: 'sale-1', status: 'COMPLETED' })
    ).resolves.toEqual({ updated: true })
    expect(sumupFetch).toHaveBeenCalledTimes(1)
  })

  it('TC-STATUS-007: Dato SumUp spento, Quando chiama un cliente, Allora tace invece di protestare', async () => {
    const { deps } = makeDeps({ configured: false })

    await expect(
      updateSaleStatus(deps, CLIENTE, { saleId: 'sale-1', status: 'COMPLETED' })
    ).resolves.toEqual({ skipped: true })
  })
})
