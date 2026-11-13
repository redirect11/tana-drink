// @vitest-environment happy-dom
'use strict'

// GLI INGREDIENTI A ETICHETTE NELL'EDITOR DEL MENÙ DEI CLIENTI
// (REQ-MENU-040, IngredientiVoce.jsx). Si scrive e si sceglie fra i
// suggerimenti; Invio prende il primo, o un'etichetta libera. Le etichette
// della ricetta stanno sotto come proposte, da aggiungere a mano. Una voce
// senza etichette parte dal testo di prima e lo riscrive solo se la si
// tocca. Ogni cambio si salva subito.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const aggiornaVoceCarta = vi.fn()
vi.mock('../../src/lib/api.js', () => ({ aggiornaVoceCarta: (...a) => aggiornaVoceCarta(...a) }))

import IngredientiVoce from '../../src/components/IngredientiVoce.jsx'

const ITEMS = [
  { id: 'gin', name: 'Gin Tanqueray', category_id: 'cgin' },
  { id: 'tonica', name: 'Tonica Fever-Tree', category_id: 'cbib' },
]
const DRINK = {
  id: 'd1',
  name: 'Gin Tonic',
  ingredienti: 'Gin, tonica',
  recipe_items: [
    { inventory_item_id: 'gin', name: 'Gin Tanqueray', qty: 40, unit: 'ml' },
    { inventory_item_id: 'tonica', name: 'Tonica Fever-Tree', qty: 1, unit: 'pz' },
  ],
}
const mostra = (voce = { id: 'v1' }) =>
  render(
    <IngredientiVoce
      voce={voce}
      drink={DRINK}
      items={ITEMS}
      categorieMagazzino={[{ id: 'cgin', name: 'Gin' }]}
      categorieCassa={[]}
    />
  )
const salvate = () => aggiornaVoceCarta.mock.calls.at(-1)[1]

beforeEach(() => aggiornaVoceCarta.mockClear())

describe('le etichette di una voce', () => {
  it('senza etichette parte dal testo di prima, e non scrive niente finché non la si tocca', () => {
    mostra()
    expect(screen.getByText('Gin')).toBeInTheDocument()
    expect(screen.getByText('tonica')).toBeInTheDocument()
    expect(screen.getByText('dalla scheda prodotto')).toBeInTheDocument()
    expect(aggiornaVoceCarta).not.toHaveBeenCalled()
  })

  it('scrivendo compaiono i suggerimenti, prima quelli della ricetta; Invio prende il primo', async () => {
    const user = userEvent.setup()
    mostra({ id: 'v1', etichette: [] })
    await user.type(screen.getByLabelText('Aggiungi un ingrediente'), 'gin')
    const lista = screen.getByRole('listbox', { name: 'Suggerimenti' })
    expect(lista).toHaveTextContent('Gin Tanqueray dalla ricetta')
    expect(lista).toHaveTextContent('Gin categoria della ricetta')
    await user.keyboard('{Enter}')
    expect(aggiornaVoceCarta).toHaveBeenCalledWith('v1', { etichette: [{ tipo: 'prodotto', id: 'gin', nome: 'Gin Tanqueray' }] })
  })

  it('quello che non c’è diventa un’etichetta libera', async () => {
    const user = userEvent.setup()
    mostra({ id: 'v1', etichette: [] })
    await user.type(screen.getByLabelText('Aggiungi un ingrediente'), 'scorza di limone')
    await user.click(screen.getByRole('button', { name: /«scorza di limone» testo libero/ }))
    expect(salvate()).toEqual({ etichette: [{ tipo: 'testo', id: null, nome: 'scorza di limone' }] })
  })

  // La ricetta propone, non decide: le sue etichette si aggiungono a mano.
  it('le proposte della ricetta si aggiungono con un tocco, e «come la ricetta» le mette tutte', async () => {
    const user = userEvent.setup()
    mostra({ id: 'v1', etichette: [{ tipo: 'prodotto', id: 'gin', nome: 'Gin Tanqueray' }] })
    expect(screen.queryByRole('button', { name: '+ Gin Tanqueray' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '+ Tonica Fever-Tree' }))
    expect(salvate()).toEqual({
      etichette: [
        { tipo: 'prodotto', id: 'gin', nome: 'Gin Tanqueray' },
        { tipo: 'prodotto', id: 'tonica', nome: 'Tonica Fever-Tree' },
      ],
    })
    await user.click(screen.getByRole('button', { name: '↺ come la ricetta' }))
    expect(salvate().etichette.map((e) => e.nome)).toEqual(['Gin Tanqueray', 'Tonica Fever-Tree'])
  })

  it('un’etichetta si toglie; gli ingredienti si nascondono al cliente', async () => {
    const user = userEvent.setup()
    mostra({ id: 'v1', etichette: [{ tipo: 'testo', nome: 'lime' }, { tipo: 'testo', nome: 'menta' }] })
    await user.click(screen.getByRole('button', { name: 'Togli lime' }))
    expect(salvate()).toEqual({ etichette: [{ tipo: 'testo', id: null, nome: 'menta' }] })
    await user.click(screen.getByRole('checkbox', { name: 'Nascondi gli ingredienti al cliente' }))
    expect(salvate()).toEqual({ ingredienti_nascosti: true })
  })
})

// REQ-MENU-042: su un'etichetta di categoria il cliente può scegliere. Accesa,
// offre le alternative col supplemento predefinito; poi si ritocca.
describe('la scelta del cliente', () => {
  const GIN_SCELTI = [
    // Il gin della ricetta: sta nella categoria, ma non si offre al cliente.
    { id: 'gin', name: 'Gin Tanqueray', category_id: 'cgin' },
    { id: 'tanq', name: 'Tanqueray', category_id: 'cgin', scelta_cliente: true },
    { id: 'hend', name: 'Hendrick’s', category_id: 'cgin', scelta_cliente: true },
  ]
  const mostraConScelta = (etichetta) =>
    render(
      <IngredientiVoce
        voce={{ id: 'v1', etichette: [etichetta] }}
        drink={DRINK}
        items={GIN_SCELTI}
        categorieMagazzino={[{ id: 'cgin', name: 'Gin' }]}
        supplementoPredefinito={1}
      />
    )

  it('accesa offre tutte le alternative col supplemento predefinito', async () => {
    const user = userEvent.setup()
    mostraConScelta({ tipo: 'categoria', id: 'cgin', nome: 'Gin' })
    await user.click(screen.getByRole('button', { name: 'Il cliente sceglie: Gin' }))
    expect(salvate()).toEqual({
      etichette: [
        {
          tipo: 'categoria',
          id: 'cgin',
          nome: 'Gin',
          // E la riga della ricetta che la scelta prende il posto: al
          // telefono il magazzino non arriva, quindi lo dice l'editor.
          scelta: {
            offerti: [{ id: 'hend', nome: 'Hendrick’s', supplemento: 1 }, { id: 'tanq', nome: 'Tanqueray', supplemento: 1 }],
            sostituisce: ['gin'],
          },
        },
      ],
    })
    expect(screen.queryByText(/Nessuna riga della ricetta/)).toBeNull()
  })

  // Un prodotto che la ricetta non ha: la scelta arriva lo stesso al banco,
  // ma il magazzino non ha niente da scambiare. Lo si dice a chi la accende.
  it('avvisa quando nessuna riga della ricetta corrisponde', () => {
    mostraConScelta({ tipo: 'prodotto', id: 'hend', nome: 'Hendrick’s', scelta: { offerti: [{ id: 'tanq', nome: 'Tanqueray', supplemento: 0 }] } })
    expect(screen.getByText(/Nessuna riga della ricetta del prodotto collegato corrisponde/)).toBeInTheDocument()
  })

  it('un’alternativa si toglie, e il supplemento si cambia', async () => {
    const user = userEvent.setup()
    mostraConScelta({ tipo: 'categoria', id: 'cgin', nome: 'Gin', scelta: { offerti: [{ id: 'tanq', nome: 'Tanqueray', supplemento: 0 }, { id: 'hend', nome: 'Hendrick’s', supplemento: 1 }] } })
    const gruppo = screen.getByRole('group', { name: 'Il cliente sceglie: Gin' })
    expect(gruppo).toHaveTextContent('chi non sceglie ha il prodotto della ricetta')
    await user.clear(screen.getByLabelText('Supplemento per Hendrick’s'))
    await user.type(screen.getByLabelText('Supplemento per Hendrick’s'), '2')
    await user.tab()
    expect(salvate().etichette[0].scelta.offerti).toEqual([{ id: 'tanq', nome: 'Tanqueray', supplemento: 0 }, { id: 'hend', nome: 'Hendrick’s', supplemento: 2 }])
    await user.click(screen.getByRole('checkbox', { name: 'Tanqueray' }))
    expect(salvate().etichette[0].scelta.offerti).toEqual([{ id: 'hend', nome: 'Hendrick’s', supplemento: 1 }])
  })
})
