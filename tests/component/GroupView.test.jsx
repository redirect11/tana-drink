// @vitest-environment happy-dom
'use strict'

// ── IL CONTO DI UN GRUPPO E SUMUP (BUG-133) ──────────────────────────────
//
// Nella vista di un gruppo di conti «💳 Online» e «📟 Lettore» c'erano con
// qualsiasi licenza: su un piano senza il modulo SumUp chiamavano le
// Functions lo stesso, e con il modulo spento a mano anche. Ora seguono la
// stessa domanda della cassa (`sumupAttivo`). I contanti e la carta col POS
// esterno sono di base e restano sempre.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { CON_LICENZA, LICENZA_TANA } from '../helpers/licenza.js'

const filo = vi.hoisted(() => ({ impostazioni: {} }))

const GRUPPO = { id: 'g1', name: 'Tavolo 4', status: 'aperto' }
const ORDINE = { id: 'o1', group_id: 'g1', total: 18, status: 'pronto', payment_status: 'da_pagare', items: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: null } }))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  createGroupCheckout: vi.fn(),
  getGroupPaymentStatus: vi.fn(),
  groupReaderCheckout: vi.fn(),
}))
vi.mock('../../src/lib/sumupWidget.js', () => ({ mountCardWidget: vi.fn() }))
vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: {},
  subscribeSettings: vi.fn((cb) => {
    cb(filo.impostazioni)
    return () => {}
  }),
  subscribeOpenGroups: vi.fn((cb) => {
    cb([GRUPPO])
    return () => {}
  }),
  subscribeActiveOrders: vi.fn((cb) => {
    cb([ORDINE])
    return () => {}
  }),
  subscribeRecentGroups: vi.fn((cb) => {
    cb([])
    return () => {}
  }),
  nestGroup: vi.fn(),
  unnestGroup: vi.fn(),
  renameGroup: vi.fn(),
  closeGroups: vi.fn(),
  deleteGroup: vi.fn(),
  payGroupCash: vi.fn(),
  createPendingGroupPayment: vi.fn(),
}))

const { default: GroupView } = await import('../../src/components/GroupView.jsx')

const mostra = () =>
  render(
    <MemoryRouter>
      <GroupView groupId="g1" onClose={() => {}} />
    </MemoryRouter>,
  )

beforeEach(() => {
  filo.impostazioni = { ...CON_LICENZA }
})

describe('i pagamenti SumUp del conto di un gruppo', () => {
  it('con il modulo SumUp ci sono', async () => {
    mostra()
    expect(await screen.findByRole('button', { name: /Online/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lettore/ })).toBeInTheDocument()
  })

  it('senza il modulo no, e contanti e carta restano', async () => {
    filo.impostazioni = { licenza: { ...LICENZA_TANA, moduli: { ...LICENZA_TANA.moduli, sumup: false } } }
    mostra()
    expect(await screen.findByRole('button', { name: /Contanti/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Carta/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Online/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Lettore/ })).toBeNull()
  })

  it('con il modulo spento a mano nemmeno', async () => {
    filo.impostazioni = { ...CON_LICENZA, modulo_sumup_enabled: false }
    mostra()
    expect(await screen.findByRole('button', { name: /Contanti/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lettore/ })).toBeNull()
  })
})
