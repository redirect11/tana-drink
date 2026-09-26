// @vitest-environment happy-dom
'use strict'

// ── IL CONTROLLO DEL MAGAZZINO, LA SCHERMATA (REQ-MAG-050) ────────────
// La pagina di prova accanto all'Inventario: si conta un prodotto alla
// volta, per scaffale, e il conteggio si vede subito; il rapporto mette in
// cima dove si perde di più. La logica (conteggio senza rete, differenza in
// euro, giorni di scorta) sta in tests/unit/controlloMagazzino.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const adesso = new Date()
const ieri = new Date(adesso.getTime() - 86400000).toISOString()
const stato = { articoli: [], categorie: [], movimenti: [] }

vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: vi.fn(async () => stato.articoli),
  fetchInventoryCategories: vi.fn(async () => stato.categorie),
  fetchStockMovementsSince: vi.fn(async () => stato.movimenti),
  settingsIniziali: () => ({ business_day_cutoff_hour: 5 }),
  // Come la vera: la giacenza diventa il contato, composta in memoria, col
  // movimento scritto.
  registraConteggio: vi.fn((item, v) => ({
    item: { ...item, stock: Number(v) },
    diff: Number(v) - item.stock,
    movimento: { item_id: item.id, type: 'unload', qty: 0, reason: 'conta', created_at: new Date().toISOString() },
  })),
}))

import ControlloMagazzino from '../../src/components/ControlloMagazzino.jsx'

const JAGER = { id: 'jager', name: 'Jagermeister', unit: 'pz', package_size: 1000, content_unit: 'ml', stock: 2.8, cost: 13.8, vat: 22, category_id: 'amari' }
const LETE = { id: 'lete', name: 'Acqua Lete', unit: 'pz', package_size: 500, stock: 27, cost: 0.17, vat: 22, category_id: 'bibite' }

beforeEach(() => {
  vi.clearAllMocks()
  stato.categorie = [
    { id: 'amari', name: 'AMARI' },
    { id: 'bibite', name: 'BIBITE' },
  ]
  stato.articoli = [JAGER, LETE]
  stato.movimenti = []
})

describe('conta', () => {
  it('in fila per scaffale, con quanto risulta e da quando non si conta', async () => {
    stato.movimenti = [{ item_id: 'lete', type: 'unload', qty: 0, unit: 'pz', reason: 'conta', created_at: ieri }]
    render(<ControlloMagazzino />)
    await screen.findByText('Jagermeister')
    const nomi = [...document.querySelectorAll('.inv-name')].map((n) => n.textContent)
    expect(nomi).toEqual(['Jagermeister', 'Acqua Lete'])
    const riga = (nome) => screen.getByText(nome).closest('.inv-row').textContent
    expect(riga('Jagermeister')).toMatch(/Risulta 2,8 pz · non contato negli ultimi 90 giorni/)
    expect(riga('Acqua Lete')).toMatch(/contato il \d\d\/\d\d\/\d{4}/)
  })

  // Niente inventario da aprire e chiudere: il conteggio corregge subito,
  // e la riga lo mostra nell'istante del tocco.
  it('un conteggio corregge subito quel prodotto', async () => {
    const api = await import('../../src/lib/api.js')
    render(<ControlloMagazzino />)
    await screen.findByText('Jagermeister')
    await userEvent.type(screen.getByLabelText("Quanto c'è di Jagermeister"), '0.9')
    await userEvent.click(screen.getByRole('button', { name: 'Conta Jagermeister' }))
    expect(api.registraConteggio).toHaveBeenCalledWith(expect.objectContaining({ id: 'jager' }), '0.9')
    const riga = screen.getByText('Jagermeister').closest('.inv-row').textContent
    expect(riga).toMatch(/Risulta 0,9 pz · contato il/)
  })
})

describe('rapporto', () => {
  // IN CIMA DOVE SI PERDE DI PIÙ: la domanda è dove sparisce la merce.
  it('mette in cima dove la differenza costa di più', async () => {
    stato.movimenti = [
      { item_id: 'lete', type: 'unload', qty: 2, unit: 'pz', reason: 'conta', created_at: ieri },
      { item_id: 'jager', type: 'unload', qty: 1.9, unit: 'pz', reason: 'conta', created_at: ieri },
    ]
    render(<ControlloMagazzino />)
    await screen.findByText('Jagermeister')
    await userEvent.click(screen.getByRole('button', { name: 'Rapporto' }))
    const nomi = [...document.querySelectorAll('.inv-name')].map((n) => n.textContent)
    expect(nomi).toEqual(['Jagermeister', 'Acqua Lete'])
    expect(document.body.textContent).toMatch(/Differenza fra contato e risultante/)
  })
})
