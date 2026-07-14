'use strict'

// Unit test del piano di import storico (src/dev/importExcel.js):
// idempotente — ciò che esiste già viene saltato.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/lib/api.js', () => ({
  fetchSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  fetchSupplierInvoices: vi.fn(),
  createSupplierInvoice: vi.fn(),
  fetchInventoryItems: vi.fn(),
  createInventoryItem: vi.fn(),
  fetchInventoryCategories: vi.fn(),
  createInventoryCategory: vi.fn(),
  fetchAllStaffHours: vi.fn(),
  addStaffHours: vi.fn(),
}))

import { planImport } from '../../src/dev/importExcel.js'

const DATA = {
  suppliers: [{ name: 'NOVA' }, { name: 'ENOFEL' }],
  supplier_invoices: [
    { supplier_name: 'NOVA', number: '897', date: '2023-06-24', amount: 1489.5, paid: true },
    { supplier_name: 'NOVA', number: '900', date: '2023-07-01', amount: 100, paid: false },
  ],
  inventory_items: [
    { name: 'Amaro del Capo', category: 'AMARI', cost: 12.9 },
    { name: 'Cynar', category: 'AMARI', cost: 12.9 },
  ],
  staff_hours: [
    { staff_name: 'Flavio', date: '2023-12-01', hours: 3.5 },
    { staff_name: 'Flavio', date: '2023-12-02', hours: 5 },
  ],
}

const VUOTO = { suppliers: [], categories: [], items: [], invoices: [], hours: [] }

describe('planImport', () => {
  it('su database vuoto importa tutto (categorie dedotte dai prodotti)', () => {
    const plan = planImport(DATA, VUOTO)
    expect(plan.suppliers).toHaveLength(2)
    expect(plan.invoices).toHaveLength(2)
    expect(plan.items).toHaveLength(2)
    expect(plan.categories).toEqual(['AMARI'])
    expect(plan.hours).toHaveLength(2)
  })

  it('è IDEMPOTENTE: ciò che esiste già (per chiave) viene saltato', () => {
    const plan = planImport(DATA, {
      suppliers: [{ name: 'nova' }], // case-insensitive
      categories: [{ name: 'Amari' }],
      items: [{ name: 'AMARO DEL CAPO' }],
      invoices: [{ supplier_name: 'NOVA', number: '897', date: '2023-06-24', amount: 1489.5 }],
      hours: [{ staff_name: 'flavio', date: '2023-12-01', hours: 3.5 }],
    })
    expect(plan.suppliers.map((s) => s.name)).toEqual(['ENOFEL'])
    expect(plan.invoices.map((i) => i.number)).toEqual(['900'])
    expect(plan.items.map((i) => i.name)).toEqual(['Cynar'])
    expect(plan.categories).toEqual([]) // AMARI esiste già
    expect(plan.hours.map((h) => h.date)).toEqual(['2023-12-02'])
    expect(plan.skipped).toEqual({ suppliers: 1, invoices: 1, items: 1, hours: 1 })
  })
})
