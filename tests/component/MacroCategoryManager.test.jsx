// @vitest-environment happy-dom
'use strict'

// DUE ELENCHI DI MACRO, NON UNO. Sono due mestieri diversi: si compra
// «Distillati» e si vende «Cocktail classici». Tenerli separati serve a
// incrociarli — quanto è uscito su una macro di spesa contro quanto è
// entrato su quella di vendita — e l'aggancio si sceglie a mano, perché non
// c'è una regola che lo indovini: dagli stessi distillati escono il Negroni
// e il gin tonic, che in vendita stanno in due macro diverse.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  createMacroCategory: vi.fn(() => Promise.resolve({ id: 'nuova' })),
  updateMacroCategory: vi.fn(() => Promise.resolve()),
  deleteMacroCategory: vi.fn(() => Promise.resolve()),
}))

import MacroCategoryManager from '../../src/components/MacroCategoryManager.jsx'
import {
  createMacroCategory,
  updateMacroCategory,
  deleteMacroCategory,
} from '../../src/lib/api.js'

const MACRO_MAG = [{ id: 'mag1', name: 'Distillati', sort_order: 0, macro_menu_id: null }]
const MACRO_MENU = [{ id: 'men1', name: 'Cocktail classici', sort_order: 0 }]
const CATEGORIE = [
  { id: 'c1', name: 'Gin', sort_order: 0, macro_id: 'mag1' },
  { id: 'c2', name: 'Rum', sort_order: 1, macro_id: null },
]

const aggiorna = vi.fn(() => Promise.resolve())
const crea = vi.fn(() => Promise.resolve())
const onChange = vi.fn(() => Promise.resolve())

beforeEach(() => vi.clearAllMocks())

const monta = (props = {}) =>
  render(
    <MacroCategoryManager
      macros={MACRO_MAG}
      categories={CATEGORIE}
      onChange={onChange}
      aggiornaCategoria={aggiorna}
      creaCategoria={crea}
      {...props}
    />
  )

describe('le macro del magazzino', () => {
  it('si agganciano a una macro di vendita, e l’aggancio si salva', async () => {
    const user = userEvent.setup()
    monta({ ambito: 'magazzino', macroDiVendita: MACRO_MENU })
    const scelta = screen.getByRole('combobox', { name: /Macro di vendita per Distillati/ })
    await user.selectOptions(scelta, 'men1')
    await waitFor(() =>
      expect(updateMacroCategory).toHaveBeenCalledWith('mag1', { macro_menu_id: 'men1' })
    )
  })

  it('una macro nuova nasce nel suo elenco', async () => {
    const user = userEvent.setup()
    monta({ ambito: 'magazzino', macroDiVendita: MACRO_MENU })
    await user.type(screen.getByPlaceholderText(/es\. Distillati/), 'Birre')
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }))
    await waitFor(() =>
      expect(createMacroCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Birre', ambito: 'magazzino' })
      )
    )
  })
})

describe('le macro del menù', () => {
  it('non chiedono l’aggancio: quello si sceglie dal lato della spesa', () => {
    monta({ ambito: 'menu', macros: MACRO_MENU })
    expect(screen.queryByRole('combobox', { name: /Macro di vendita/ })).toBeNull()
    expect(screen.getByText(/incassato/)).toBeInTheDocument()
  })

  it('agganciano le categorie DEI DRINK, non quelle del magazzino', async () => {
    const user = userEvent.setup()
    monta({ ambito: 'menu', macros: MACRO_MENU, categories: [{ id: 'd1', name: 'Aperitivi' }] })
    await user.selectOptions(screen.getByRole('combobox'), 'd1')
    await user.click(screen.getByRole('button', { name: /Collega/ }))
    // La funzione arriva da fuori: qui si scrive sulle categorie del menù.
    await waitFor(() => expect(aggiorna).toHaveBeenCalledWith('d1', { macro_id: 'men1' }))
  })

  it('cancellandone una, si dice a chi appartiene: le categorie non si perdono', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    monta({ ambito: 'menu', macros: MACRO_MENU })
    await user.click(screen.getByRole('button', { name: '🗑' }))
    await waitFor(() => expect(deleteMacroCategory).toHaveBeenCalledWith('men1', 'menu'))
  })
})
