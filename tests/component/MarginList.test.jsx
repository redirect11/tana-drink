// @vitest-environment happy-dom
'use strict'

// LA MARGINALITÀ DEL LISTINO IN TABELLA, PER CATEGORIE (REQ-MENU-002).
// Flavio, 22/10/2026: «bisognerebbe mettere sempre la divisione in
// categorie … poter vedere questo confronto, o vederlo così tutto
// mischiato … anche la possibilità di metterlo in ordine»; e il prezzo, che
// stava «scritto piccolo e sotto il nome», «tutto in colonna sulla destra
// come se fosse una tabella».

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: { price_markup: 3 },
  subscribeSettings: (cb) => {
    cb({ price_markup: 3 })
    return () => {}
  },
}))

import MarginList from '../../src/components/MarginList.jsx'

// Un pezzo a 1 € (IVA esclusa, 0% per fare i conti tondi): il costo di
// ogni voce è quanti pezzi usa.
const pezzo = { id: 'p', name: 'Pezzo', unit: 'pz', cost: 1, vat: 0 }
const voce = (id, name, category_id, prezzo, pezzi) => ({
  id,
  name,
  category_id,
  price: prezzo,
  recipe_items: [{ inventory_item_id: 'p', unit: 'pz', qty: pezzi }],
})
const DRINKS = [
  voce('spritz', 'Spritz', 'aperitivi', 6, 1), // ×6
  voce('bjorne', 'Bjorne', 'birre', 4, 2), // ×2, da rivedere
  voce('americano', 'Americano', 'aperitivi', 6, 2), // ×3
  voce('ceres', 'Ceres', 'birre', 4, 1), // ×4
]
const CATEGORIE = [
  { id: 'birre', name: 'Birre', sort_order: 2 },
  { id: 'aperitivi', name: 'Aperitivi', sort_order: 1 },
]
const mostra = () =>
  render(<MarginList drinks={DRINKS} inventory={[pezzo]} categories={CATEGORIE} onEdit={vi.fn()} />)
const nomi = () => [...document.querySelectorAll('.margin-nome')].map((b) => b.textContent)

describe('la marginalità del listino', () => {
  // Le parole e l'ordine di Flavio, 29/10/2026: «COSTO, VENDITA,
  // CONSIGLIATO, MOLTIPLICATORE e UTILE incolonnate come una tabella».
  it('è una tabella con costo, vendita, consigliato, moltiplicatore e utile in colonna', () => {
    mostra()
    const testa = screen.getByRole('table').querySelector('thead')
    expect([...testa.querySelectorAll('th')].map((t) => t.textContent.replace(/[▲▼]/g, ''))).toEqual([
      'Voce',
      'Costo',
      'Vendita',
      'Consigliato',
      'Moltiplicatore',
      'Utile',
    ])
    const riga = screen.getByRole('button', { name: 'Modifica Bjorne' }).closest('tr')
    // Bjorne costa 2 e si vende a 4: col ×3 il consigliato è 6.
    expect(within(riga).getAllByRole('cell').map((c) => c.textContent.replace(/\s/g, ' '))).toEqual([
      '2,00 €',
      '4,00 €',
      '6,00 €',
      '×2',
      '2,00 €',
    ])
  })

  it('di partenza è divisa per categorie del menù, nel loro ordine, con le medie', () => {
    mostra()
    const intestazioni = [...document.querySelectorAll('.margin-cat th')].map((t) => t.textContent)
    expect(intestazioni[0]).toMatch(/^Aperitivi/)
    expect(intestazioni[1]).toMatch(/^Birre/)
    // Dentro ogni categoria, il ricarico più basso in cima.
    expect(nomi()).toEqual(['Americano', 'Spritz', 'Bjorne', 'Ceres'])
    // Il ricarico medio delle birre: (2 + 4) / 2.
    const birre = [...document.querySelectorAll('.margin-cat')][1]
    expect(birre.textContent).toMatch(/×3/)
  })

  it('«Tutto insieme» toglie le categorie e mette in fila tutto il listino', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: 'Tutto insieme' }))
    expect(document.querySelectorAll('.margin-cat')).toHaveLength(0)
    expect(nomi()).toEqual(['Bjorne', 'Americano', 'Ceres', 'Spritz'])
  })

  it('toccando un’intestazione si ordina su quella colonna, e ritoccandola si gira', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: 'Tutto insieme' }))
    await user.click(screen.getByRole('button', { name: 'Utile' }))
    expect(nomi()).toEqual(['Bjorne', 'Ceres', 'Americano', 'Spritz'])
    await user.click(screen.getByRole('button', { name: 'Utile' }))
    expect(nomi()).toEqual(['Spritz', 'Americano', 'Ceres', 'Bjorne'])
    expect(screen.getByRole('button', { name: 'Utile' }).closest('th')).toHaveAttribute('aria-sort', 'descending')
  })

  it('i filtri restano, e il consigliato della voce da rivedere è in evidenza', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: /Da rivedere/ }))
    expect(nomi()).toEqual(['Bjorne'])
    expect(document.querySelector('.margin-consigliato')).toHaveTextContent('6,00')
  })

  it('si ordina anche sul consigliato', async () => {
    const user = userEvent.setup()
    mostra()
    await user.click(screen.getByRole('button', { name: 'Tutto insieme' }))
    await user.click(screen.getByRole('button', { name: 'Consigliato' }))
    // Consigliato = costo × 3: Ceres e Spritz 3, Americano e Bjorne 6.
    expect(nomi()).toEqual(['Ceres', 'Spritz', 'Americano', 'Bjorne'])
  })
})
