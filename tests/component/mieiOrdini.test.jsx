// @vitest-environment happy-dom
'use strict'

// «I MIEI ORDINI», LA PAGINA DEL CLIENTE. L'utente, 11/11/2026: «gli ordini
// non dovrebbero apparire nel menù. Dovrebbero stare in una sezione a parte
// della vista cliente, tipo i tuoi ordini». Fino alla 1.10.35 gli ordini in
// corso stavano anche in cima al menù, e lì si aggiornavano da soli; tolti
// da lì, questa pagina è l'unico posto dove il cliente li ritrova, e una
// lista letta una volta sola gli direbbe «In preparazione» di un drink già
// pronto. Quindi: gli ordini in corso si ascoltano, quelli chiusi no.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

const ascolti = new Map()
const smessi = []

vi.mock('../../src/lib/api.js', () => ({
  fetchOrdersByIds: vi.fn(async () => [
    { id: 'o-vecchio', daily_number: 3, workflow_status: 'consegnato', total: 8, order_items: [{ qty: 1 }], created_at: '2026-11-10T21:00:00Z' },
    { id: 'o-nuovo', daily_number: 7, workflow_status: 'in_preparazione', total: 16, order_items: [{ qty: 2 }], created_at: '2026-11-11T21:00:00Z' },
  ]),
  fetchOrdersByCustomer: vi.fn(async () => []),
  subscribeOrder: vi.fn((id, cb) => {
    ascolti.set(id, cb)
    return () => smessi.push(id)
  }),
}))
vi.mock('../../src/lib/customerAuth.js', () => ({
  useCustomer: () => ({ user: null, loading: false }),
}))

import MyOrdersPage from '../../src/pages/MyOrdersPage.jsx'

const mostra = () =>
  render(
    <MemoryRouter>
      <MyOrdersPage />
    </MemoryRouter>
  )

beforeEach(() => {
  ascolti.clear()
  smessi.length = 0
  localStorage.clear()
  localStorage.setItem('drink_my_orders_v1', JSON.stringify(['o-nuovo', 'o-vecchio']))
})

describe('i miei ordini', () => {
  it('gli ordini di questo dispositivo, il più recente in cima, ognuno col suo stato', async () => {
    mostra()
    const righe = await screen.findAllByRole('link', { name: /#\d/ })
    expect(righe.map((r) => r.textContent.match(/#\d+/)[0])).toEqual(['#7', '#3'])
    expect(righe[0]).toHaveAttribute('href', '/ordine/o-nuovo')
    expect(righe[0]).toHaveTextContent('In preparazione')
  })

  it('un ordine in corso cambia stato da solo; uno chiuso non si ascolta', async () => {
    const { unmount } = mostra()
    await screen.findAllByRole('link', { name: /#\d/ })
    expect([...ascolti.keys()]).toEqual(['o-nuovo'])

    act(() => ascolti.get('o-nuovo')({ id: 'o-nuovo', daily_number: 7, workflow_status: 'pronto', total: 16, order_items: [{ qty: 2 }] }))
    expect(screen.getByRole('link', { name: /#7/ })).toHaveTextContent('Pronto')
    expect(screen.getByRole('link', { name: /#7/ })).not.toHaveTextContent('In preparazione')

    // Uscendo dalla pagina si smette di ascoltare.
    unmount()
    expect(smessi).toContain('o-nuovo')
  })

  it('senza ordini lo dice, e riporta al menù', async () => {
    localStorage.clear()
    mostra()
    expect(await screen.findByText(/Non hai ancora effettuato ordini/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vai al menù' })).toHaveAttribute('href', '/menu')
  })
})
