// @vitest-environment happy-dom
'use strict'

// «TORNA AL MENÙ», O ALLA PAGINA INIZIALE (REQ-LIC-002). Daniele,
// 14/11/2026: col menù dei clienti spento «non ci si può arrivare in alcun
// modo». Le pagine dei clienti avevano un «Torna al menù» fisso: col menù
// spento porta alla pagina iniziale.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

const stato = { impostazioni: {} }
vi.mock('../../src/lib/api.js', () => ({
  settingsIniziali: () => stato.impostazioni,
  subscribeSettings: (cb) => {
    cb(stato.impostazioni)
    return () => {}
  },
}))

import TornaAlMenu from '../../src/components/TornaAlMenu.jsx'

const mostra = () =>
  render(
    <MemoryRouter>
      <TornaAlMenu />
    </MemoryRouter>
  )

beforeEach(() => {
  stato.impostazioni = {}
})

describe('«Torna al menù» nelle pagine dei clienti', () => {
  it('col menù attivo porta al menù', () => {
    stato.impostazioni = { licenza: { moduli: { menu_tavoli: true } } }
    mostra()
    expect(screen.getByRole('link', { name: '← Torna al menù' })).toHaveAttribute('href', '/menu')
  })

  it('col menù nascosto ai clienti porta alla pagina iniziale', () => {
    stato.impostazioni = { licenza: { moduli: { menu_tavoli: true } }, menu_clienti_visibile: false }
    mostra()
    expect(screen.queryByRole('link', { name: /menù/ })).toBeNull()
    expect(screen.getByRole('link', { name: '← Torna alla pagina iniziale' })).toHaveAttribute('href', '/')
  })
})
