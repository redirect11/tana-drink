// @vitest-environment happy-dom
'use strict'

// I CONTI APERTI DEL PIANO FREE (REQ-LIC-003, `limiti.conti_aperti_max`).
// Oltre quel numero di conti aperti insieme non se ne apre un altro: la
// cassa lo dice all'ingresso, con la strada per cambiare piano, e non apre
// la schermata del conto. Si decide all'ingresso e una volta sola: dentro,
// il conto nasce alla prima riga e la bozza non si perde mai.
//
// SENZA LIMITI NELLA LICENZA — la Tana — la cassa si apre come sempre e la
// coda non si ascolta nemmeno: una regola che non la riguarda non le costa
// un ascolto in più.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

const filo = vi.hoisted(() => ({ impostazioni: {}, conti: [], consegna: null, ascolti: 0 }))

vi.mock('../../src/lib/api.js', () => ({
  settingsIniziali: () => filo.impostazioni,
  subscribeSettings: (cb) => {
    cb(filo.impostazioni)
    return () => {}
  },
  subscribeActiveOrders: (cb) => {
    filo.ascolti += 1
    filo.consegna = cb
    cb(filo.conti)
    return () => {}
  },
}))
vi.mock('../../src/lib/cashSession.js', () => ({ useCashSession: () => ({ open: true, loading: false }) }))
vi.mock('../../src/components/OrderPosDetail.jsx', () => ({ default: () => <div>SCHERMATA DEL CONTO</div> }))

import PosPage from '../../src/pages/PosPage.jsx'

const aperto = (id) => ({ id, status: 'aperto', payment_status: 'non_richiesto', comande: [] })
const chiuso = (id) => ({ id, status: 'pagato', payment_status: 'pagato', comande: [] })
const FREE = {
  workflow_enabled: false,
  licenza: { piano: 'free', limiti: { conti_aperti_max: 5 }, regia_url: 'https://regia.example/piani' },
}

const mostra = () =>
  render(
    <MemoryRouter>
      <PosPage />
    </MemoryRouter>
  )

beforeEach(() => {
  filo.impostazioni = {}
  filo.conti = []
  filo.consegna = null
  filo.ascolti = 0
})

describe('il limite dei conti aperti', () => {
  it('con cinque conti aperti il sesto non si apre, e lo si legge', () => {
    filo.impostazioni = FREE
    filo.conti = [1, 2, 3, 4, 5].map((n) => aperto(`a${n}`))
    mostra()
    expect(screen.getByText('Nel piano Free puoi avere al massimo 5 conti aperti insieme.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vedi i piani' })).toHaveAttribute('href', 'https://regia.example/piani')
    expect(screen.getByRole('link', { name: /Torna agli ordini/ })).toBeInTheDocument()
    expect(screen.queryByText('SCHERMATA DEL CONTO')).toBeNull()
  })

  it('i conti chiusi non contano', () => {
    filo.impostazioni = FREE
    filo.conti = [...[1, 2, 3, 4].map((n) => aperto(`a${n}`)), ...[1, 2, 3].map((n) => chiuso(`c${n}`))]
    mostra()
    expect(screen.getByText('SCHERMATA DEL CONTO')).toBeInTheDocument()
  })

  it('aperta la schermata, il conto che nasce non la chiude da sotto le dita', () => {
    filo.impostazioni = FREE
    filo.conti = [1, 2, 3, 4].map((n) => aperto(`a${n}`))
    mostra()
    expect(screen.getByText('SCHERMATA DEL CONTO')).toBeInTheDocument()
    // Il conto appena battuto arriva in coda: sono cinque, ma chi lo sta
    // battendo resta dov'è.
    act(() => filo.consegna([...filo.conti, aperto('nuovo')]))
    expect(screen.getByText('SCHERMATA DEL CONTO')).toBeInTheDocument()
  })

  it('senza limiti nella licenza la cassa si apre sempre, e la coda non si ascolta', () => {
    filo.conti = Array.from({ length: 40 }, (_, i) => aperto(`a${i}`))
    mostra()
    expect(screen.getByText('SCHERMATA DEL CONTO')).toBeInTheDocument()
    expect(filo.ascolti).toBe(0)
  })
})
