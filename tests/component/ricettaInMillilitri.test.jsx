// @vitest-environment happy-dom
'use strict'

// UN INGREDIENTE NUOVO IN RICETTA PARTE IN MILLILITRI (REQ-MAG-054).
// Flavio, 09/11/2026: aprendo il Negroni gin, Campari e vermut sono in
// millilitri, ma un ingrediente aggiunto usciva in cl; «nella velocità» si
// scrive il numero pensando in ml, e la riga diventa dieci volte tanto.
// Per i liquidi si parte dal ml; il cl resta fra le scelte, e un articolo
// che si dosa solo a pezzi resta a pezzi.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DrinkForm from '../../src/components/DrinkForm.jsx'
import { entryUnits, unitaDopoCambioIngrediente } from '../../src/lib/inventory.js'

const GIN = { id: 'gin', name: 'Gin', unit: 'pz', package_size: 700, content_unit: 'ml' }
const SCIROPPO = { id: 'sciroppo', name: 'Sciroppo', unit: 'ml', package_size: 700 }
const LIME = { id: 'lime', name: 'Lime', unit: 'pz' }
const ZUCCHERO = { id: 'zucchero', name: 'Zucchero', unit: 'g', package_size: 1000 }

describe('l’unità con cui parte un ingrediente', () => {
  it('per i liquidi è il ml, col cl subito dopo', () => {
    expect(entryUnits(GIN)[0]).toBe('ml')
    expect(entryUnits(SCIROPPO)).toEqual(['ml', 'cl'])
    expect(unitaDopoCambioIngrediente(GIN, '')).toBe('ml')
  })

  it('i solidi in grammi e quel che si conta a pezzi restano come prima', () => {
    expect(unitaDopoCambioIngrediente(ZUCCHERO, '')).toBe('g')
    expect(unitaDopoCambioIngrediente(LIME, '')).toBe('pz')
  })

  it('una riga già scritta in cl resta in cl', () => {
    expect(unitaDopoCambioIngrediente(SCIROPPO, 'cl')).toBe('cl')
  })
})

describe('nella scheda del drink', () => {
  it('«+ Ingrediente», scelto il gin: la riga è in ml', () => {
    render(
      <DrinkForm
        initial={{ name: 'Negroni', price: 8, available: true, recipe_items: [] }}
        categories={[]}
        inventory={[GIN, SCIROPPO, LIME, ZUCCHERO]}
        onCreateCategory={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Ingrediente/ }))
    const tendine = screen.getAllByRole('combobox')
    const ingrediente = tendine.find((s) => [...s.options].some((o) => o.value === 'gin'))
    fireEvent.change(ingrediente, { target: { value: 'gin' } })
    const unita = screen.getAllByRole('combobox')[screen.getAllByRole('combobox').indexOf(ingrediente) + 1]
    expect(unita).toHaveValue('ml')
    expect([...unita.options].map((o) => o.value)).toEqual(['ml', 'cl', 'pz'])
  })
})
