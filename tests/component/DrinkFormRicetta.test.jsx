// @vitest-environment happy-dom
'use strict'

// CAMBIARE INGREDIENTE IN UNA RIGA DI RICETTA NON TOCCA QUANTITÀ E UNITÀ
// (BUG-124). Flavio, 30/10/2026: «se cambio un ingrediente con un altro mi
// cambia l'unità di misura da ml a cl senza cambiare la quantità, quindi mi
// costringe a ricambiare l'unità». «40 ml» di un gin diventava «40 cl»
// dell'altro: dieci volte tanto, in silenzio.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DrinkForm from '../../src/components/DrinkForm.jsx'
import { unitaDopoCambioIngrediente } from '../../src/lib/inventory.js'

const GIN = { id: 'gin', name: 'Gin', unit: 'ml', package_size: 700 }
const VODKA = { id: 'vodka', name: 'Vodka', unit: 'ml', package_size: 700 }
const LIME = { id: 'lime', name: 'Lime', unit: 'pz' }
const ZUCCHERO = { id: 'zucchero', name: 'Zucchero', unit: 'g', package_size: 1000 }

describe('l’unità quando si cambia ingrediente', () => {
  it('resta quella della riga se vale anche per il nuovo articolo', () => {
    expect(unitaDopoCambioIngrediente(VODKA, 'ml')).toBe('ml')
    expect(unitaDopoCambioIngrediente(VODKA, 'cl')).toBe('cl')
  })
  it('cambia solo quando non ha senso, e allora parte da quella di inserimento', () => {
    expect(unitaDopoCambioIngrediente(LIME, 'ml')).toBe('pz')
    expect(unitaDopoCambioIngrediente(ZUCCHERO, 'cl')).toBe('g')
    expect(unitaDopoCambioIngrediente(GIN, '')).toBe('cl')
  })
  it('senza articolo, nessuna unità', () => {
    expect(unitaDopoCambioIngrediente(undefined, 'ml')).toBe('')
  })
})

function mostra(riga) {
  render(
    <DrinkForm
      initial={{ name: 'Martini', price: 8, available: true, recipe_items: [riga] }}
      categories={[]}
      inventory={[GIN, VODKA, LIME, ZUCCHERO]}
      onCreateCategory={vi.fn()}
      onCancel={vi.fn()}
      onSave={vi.fn()}
    />
  )
  const tendine = screen.getAllByRole('combobox')
  const ingrediente = tendine.find((s) => s.value === riga.inventory_item_id)
  const unita = tendine[tendine.indexOf(ingrediente) + 1]
  const quantita = screen.getByPlaceholderText('Qta')
  return { ingrediente, unita, quantita }
}

describe('nella scheda del drink', () => {
  it('da Gin a Vodka: «40 ml» resta «40 ml»', () => {
    const { ingrediente, unita, quantita } = mostra({ inventory_item_id: 'gin', name: 'Gin', qty: 40, unit: 'ml' })
    expect(unita).toHaveValue('ml')
    fireEvent.change(ingrediente, { target: { value: 'vodka' } })
    expect(ingrediente).toHaveValue('vodka')
    expect(unita).toHaveValue('ml')
    expect(quantita).toHaveValue(40)
  })

  it('anche in cl: «4 cl» resta «4 cl»', () => {
    const { ingrediente, unita, quantita } = mostra({ inventory_item_id: 'gin', name: 'Gin', qty: 4, unit: 'cl' })
    fireEvent.change(ingrediente, { target: { value: 'vodka' } })
    expect(unita).toHaveValue('cl')
    expect(quantita).toHaveValue(4)
  })

  it('da un liquido a un articolo a pezzi l’unità diventa pz, e la quantità resta da decidere a chi scrive', () => {
    const { ingrediente, unita, quantita } = mostra({ inventory_item_id: 'gin', name: 'Gin', qty: 40, unit: 'ml' })
    fireEvent.change(ingrediente, { target: { value: 'lime' } })
    expect(unita).toHaveValue('pz')
    expect(quantita).toHaveValue(40)
  })
})
