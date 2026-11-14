// @vitest-environment happy-dom
'use strict'

// LO SWITCH PRODOTTO A SCHERMO (REQ-MENU-043) e IN QUANTE RICETTE
// (REQ-MAG-056). Flavio, 14/11/2026: il Carpano Dry diventa Noilly Prat in
// tutte le ricette, «lasciando invariata la quantità». Prima di scrivere si
// vede cosa cambia; la ricetta che li ha tutti e due si segnala; un prodotto
// che non si dosa allo stesso modo non si può scegliere come sostituto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  switchProdotto: vi.fn(async ({ ricette, voci }) => ({ ricette: ricette.length, voci: voci.length })),
}))

import SwitchProdotto from '../../src/components/SwitchProdotto.jsx'
import RicetteDelProdotto from '../../src/components/RicetteDelProdotto.jsx'
import { switchProdotto } from '../../src/lib/api.js'

const CARPANO = { id: 'carpano', name: 'Carpano Dry', unit: 'pz', package_size: 1000, content_unit: 'ml' }
const NOILLY = { id: 'noilly', name: 'Noilly Prat', unit: 'pz', package_size: 750, content_unit: 'ml' }
const LIME = { id: 'lime', name: 'Lime', unit: 'pz' }
const riga = (item, qty) => ({ inventory_item_id: item.id, name: item.name, unit: 'ml', qty })
const DRINKS = [
  { id: 'dry', name: 'Dry Martini', recipe_items: [riga(CARPANO, 10)] },
  { id: 'perfect', name: 'Perfect Martini', recipe_items: [riga(CARPANO, 15), riga(NOILLY, 15)] },
  { id: 'chambery', name: 'Chambéry', recipe_items: [riga(NOILLY, 40)] },
]
const VOCI = [{ id: 'v1', drink_id: 'dry', nome: '', etichette: [{ tipo: 'prodotto', id: 'carpano', nome: 'Carpano Dry' }] }]

beforeEach(() => vi.clearAllMocks())

async function apriEScegli(user, uscita, ingresso) {
  await user.click(screen.getByRole('button', { name: /Switch prodotto/ }))
  await user.selectOptions(screen.getByLabelText('Prodotto in uscita'), uscita)
  await user.selectOptions(screen.getByLabelText('Prodotto in ingresso'), ingresso)
}

describe('lo switch prodotto in Modifica menù', () => {
  it('mostra cosa cambia, segnala la ricetta con tutti e due, e scrive solo dopo il tocco', async () => {
    const user = userEvent.setup()
    const onFatto = vi.fn()
    render(<SwitchProdotto drinks={DRINKS} inventory={[CARPANO, NOILLY, LIME]} voci={VOCI} onFatto={onFatto} />)
    await apriEScegli(user, 'carpano', 'noilly')
    const ricette = screen.getByRole('list', { name: 'Ricette che cambiano' })
    expect(within(ricette).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Dry Martini',
      'Perfect Martini · contiene già Noilly Prat: avrà due righe di Noilly Prat',
    ])
    // Il Chambéry ha solo il Noilly: non è nell'elenco.
    expect(screen.queryByText('Chambéry')).toBeNull()
    expect(screen.getByRole('list', { name: 'Voci del menù dei clienti che cambiano' })).toHaveTextContent('Dry Martini')
    expect(switchProdotto).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sostituisci in 2 ricette' }))
    const piano = switchProdotto.mock.calls[0][0]
    expect(piano.ricette.find((r) => r.id === 'dry').recipe_items).toEqual([riga(NOILLY, 10)])
    expect(piano.voci[0].etichette).toEqual([{ tipo: 'prodotto', id: 'noilly', nome: 'Noilly Prat' }])
    expect(await screen.findByText(/Carpano Dry sostituito da Noilly Prat: 2 ricette, 1 voci/)).toBeInTheDocument()
    expect(onFatto).toHaveBeenCalled()
  })

  it('un prodotto che non si dosa allo stesso modo non si può usare: lo dice, e il tasto resta spento', async () => {
    const user = userEvent.setup()
    render(<SwitchProdotto drinks={DRINKS} inventory={[CARPANO, NOILLY, LIME]} voci={[]} />)
    await apriEScegli(user, 'carpano', 'lime')
    expect(screen.getByText(/Lime non si dosa in ml come Carpano Dry/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sostituisci in 2 ricette' })).toBeDisabled()
  })

  it('accanto al prodotto in uscita, in quante ricette sta', async () => {
    const user = userEvent.setup()
    render(<SwitchProdotto drinks={DRINKS} inventory={[CARPANO, NOILLY, LIME]} voci={[]} />)
    await user.click(screen.getByRole('button', { name: /Switch prodotto/ }))
    const opzioni = [...screen.getByLabelText('Prodotto in uscita').options].map((o) => o.textContent)
    expect(opzioni).toEqual(['— Scegli —', 'Carpano Dry (2)', 'Lime', 'Noilly Prat (2)'])
  })
})

describe('in quante ricette, nel dettaglio del prodotto', () => {
  it('il numero sul tasto, e toccandolo l’elenco dei drink', async () => {
    const user = userEvent.setup()
    render(<RicetteDelProdotto drinks={DRINKS} itemId="carpano" />)
    await user.click(screen.getByRole('button', { name: 'In 2 ricette del menù' }))
    expect(screen.getByRole('list', { name: 'Ricette che usano il prodotto' })).toHaveTextContent('Dry MartiniPerfect Martini')
  })

  it('un prodotto in nessuna ricetta lo dice, e non apre niente', () => {
    render(<RicetteDelProdotto drinks={DRINKS} itemId="lime" />)
    expect(screen.getByRole('button', { name: 'In nessuna ricetta del menù' })).toBeDisabled()
  })
})
