// @vitest-environment happy-dom
'use strict'

// IL COSTO DI OGNI INGREDIENTE, RIGA PER RIGA (REQ-MENU-034).
// Flavio, 10/11/2026, con la foto del Gold Rush aperto al POS: il riquadro
// diceva «prezzo reale 1,72 €» ma non quanto pesa ciascun ingrediente
// («jim beam 60 ml 1,14 €»). Ogni riga mostra il suo costo, nelle due schede
// che compongono una ricetta, e le righe tornano col totale di sopra.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Jim Beam: bottiglia da 70 cl a 10,90 € + IVA 22% = 13,30 €; 60 ml = 1,14 €.
const JIM_BEAM = { id: 'jb', name: 'Jim Beam', unit: 'pz', package_size: 700, content_unit: 'ml', cost: 10.9, vat: 22 }
// Il ghiaccio senza costo in magazzino: la riga non sa quanto vale.
const GHIACCIO = { id: 'ghiaccio', name: 'Ghiaccio Hoshizaki', unit: 'g' }

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(() => Promise.resolve([JIM_BEAM, GHIACCIO])),
  DEFAULT_SETTINGS: { price_markup: 3, price_round_step: 0.5 },
  settingsIniziali: () => ({ price_markup: 3, price_round_step: 0.5 }),
  subscribeSettings: vi.fn((cb) => {
    cb({ price_markup: 3, price_round_step: 0.5 })
    return () => {}
  }),
}))

import CustomDrinkForm from '../../src/components/CustomDrinkForm.jsx'
import DrinkForm from '../../src/components/DrinkForm.jsx'
import { costoRiga, recipeCost } from '../../src/lib/pricing.js'

const GOLD_RUSH = {
  name: 'Gold Rush',
  price: 8,
  available: true,
  recipe_items: [
    { inventory_item_id: 'jb', name: 'Jim Beam', unit: 'ml', qty: 60 },
    { inventory_item_id: 'ghiaccio', name: 'Ghiaccio Hoshizaki', unit: 'g', qty: 160 },
  ],
}

describe('il costo di una riga', () => {
  it('60 ml di Jim Beam sono 1,14 €, e 6 cl lo stesso', () => {
    expect(costoRiga({ qty: 60, unit: 'ml' }, JIM_BEAM)).toBeCloseTo(1.14, 2)
    expect(costoRiga({ qty: 6, unit: 'cl' }, JIM_BEAM)).toBeCloseTo(1.14, 2)
  })

  it('senza quantità o senza costo in magazzino non è zero: non si sa', () => {
    expect(costoRiga({ qty: '', unit: 'ml' }, JIM_BEAM)).toBeNull()
    expect(costoRiga({ qty: 160, unit: 'g' }, GHIACCIO)).toBeNull()
    expect(costoRiga({ qty: 60, unit: 'ml' }, undefined)).toBeNull()
  })

  it('le righe sommate fanno il prezzo reale', () => {
    const righe = [
      { inventory_item_id: 'jb', qty: 60, unit: 'ml' },
      { inventory_item_id: 'jb', qty: 2, unit: 'cl' },
    ]
    const byId = { jb: JIM_BEAM }
    const somma = righe.reduce((s, r) => s + costoRiga(r, JIM_BEAM), 0)
    expect(recipeCost(righe, byId).cost).toBeCloseTo(somma, 4)
  })
})

describe('il prodotto modificato al POS', () => {
  it('ogni ingrediente mostra il suo costo, e cambia con la quantità', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={GOLD_RUSH} />)
    expect(await screen.findByLabelText('Costo Jim Beam')).toHaveTextContent('1,14 €')
    expect(screen.getByLabelText('Costo Ghiaccio Hoshizaki')).toHaveTextContent('—')

    fireEvent.change(screen.getByLabelText('Quantità Jim Beam'), { target: { value: '30' } })
    expect(screen.getByLabelText('Costo Jim Beam')).toHaveTextContent('0,57 €')
  })

  it('una riga senza quantità non mostra un costo', async () => {
    render(<CustomDrinkForm onCancel={vi.fn()} onAdd={vi.fn()} initial={GOLD_RUSH} />)
    fireEvent.change(await screen.findByLabelText('Quantità Jim Beam'), { target: { value: '' } })
    expect(screen.queryByLabelText('Costo Jim Beam')).toBeNull()
  })
})

describe('la scheda del drink a menù', () => {
  it('le righe della ricetta mostrano lo stesso costo', () => {
    render(
      <DrinkForm
        initial={GOLD_RUSH}
        categories={[]}
        inventory={[JIM_BEAM, GHIACCIO]}
        onCreateCategory={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Costo Jim Beam')).toHaveTextContent('1,14 €')
    expect(screen.getByLabelText('Costo Ghiaccio Hoshizaki')).toHaveTextContent('—')
  })
})
