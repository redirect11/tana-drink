// @vitest-environment happy-dom
'use strict'

// «COME SI FA IL TANA DETOX?» è la domanda che al banco si fa a voce, e a
// voce si perde: chi entra a dare una mano il sabato non ha in testa le
// dosi. La ricetta c'era già — serve al magazzino per scalare le scorte —
// ma non la vedeva nessuno.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import SchedaDrink from '../../src/components/SchedaDrink.jsx'

const negroni = {
  name: 'Negroni',
  price: 8,
  description: 'Il classico, con la scorza.',
  recipe_items: [
    { name: 'Gin', qty: 30, unit: 'ml' },
    { name: 'Campari', qty: 30, unit: 'ml' },
  ],
  recipe: 'Mescolare nel bicchiere con ghiaccio.\nScorza d’arancia.',
}

describe('la scheda del drink', () => {
  it('dice gli ingredienti con le quantità', () => {
    render(<SchedaDrink drink={negroni} onClose={vi.fn()} />)
    expect(screen.getByText('Gin')).toBeInTheDocument()
    expect(screen.getAllByText(/30/)[0]).toBeInTheDocument()
  })

  it('e come si prepara, che la ricetta strutturata non può dire', () => {
    render(<SchedaDrink drink={negroni} onClose={vi.fn()} />)
    expect(screen.getByText(/Mescolare nel bicchiere/)).toBeInTheDocument()
  })

  it('senza ingredienti collegati lo dice, invece di mostrare il vuoto', () => {
    render(<SchedaDrink drink={{ name: 'Acqua', price: 2 }} onClose={vi.fn()} />)
    expect(screen.getByText(/Nessun ingrediente collegato/)).toBeInTheDocument()
  })

  it('si chiude: si guarda mentre si versa, e basta', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SchedaDrink drink={negroni} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(onClose).toHaveBeenCalled()
  })
})
