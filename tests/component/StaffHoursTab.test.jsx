// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE del registro Ore staff. Nasce da un difetto vero: la
// pagina si apriva in bianco perché una variabile veniva usata prima di
// essere definita — cosa che né il lint né la build possono vedere, ma che
// un semplice montaggio smaschera subito.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const rates = [{ id: 'u1', name: 'Sara', rates: [{ from: '2026-01-01', rate: 10 }] }]
vi.mock('../../src/lib/api.js', () => ({
  addStaffHours: vi.fn(() => Promise.resolve('h1')),
  deleteStaffHours: vi.fn(),
  subscribeStaffHoursRange: vi.fn((from, to, cb) => {
    cb([
      { id: 'h1', staff_uid: 'u1', staff_name: 'Sara', date: '2026-07-13', hours: 5, kind: 'effettivo', start: '18:00', end: '23:00' },
    ])
    return () => {}
  }),
  subscribeStaffShiftsRange: vi.fn((from, to, cb) => { cb([]); return () => {} }),
  updateStaffShift: vi.fn(),
  deleteStaffShift: vi.fn(),
  subscribeStaffRates: vi.fn((cb) => { cb(rates); return () => {} }),
  saveStaffRates: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/staffApi.js', () => ({
  listStaff: vi.fn(() =>
    Promise.resolve([
      { uid: 'u1', name: 'Sara', email: 'sara@bar.it', role: 'staff' },
      { uid: 'u2', name: 'Marco', email: 'marco@bar.it', role: 'bartender' },
    ])
  ),
}))

import StaffHoursTab from '../../src/components/StaffHoursTab.jsx'
import { addStaffHours, saveStaffRates } from '../../src/lib/api.js'

beforeEach(() => vi.clearAllMocks())

describe('registro Ore staff', () => {
  it('si apre e valorizza le ore con la paga della persona', async () => {
    render(<StaffHoursTab />)
    expect(screen.getByText('👥 Staff')).toBeInTheDocument()
    // 5 h × 10 €/h = 50 € di costo del personale
    await waitFor(() => expect(screen.getByText('50,00 €')).toBeInTheDocument())
  })

  it('il turno si assegna scegliendo un MEMBRO, non digitando un nome', async () => {
    const user = userEvent.setup()
    render(<StaffHoursTab />)
    // Il form sta nel pannello "Nuovo turno", sotto al titolo.
    await user.click(screen.getByRole('button', { name: /Nuovo turno/ }))
    await waitFor(() => expect(screen.getByLabelText('Chi *')).toBeInTheDocument())
    const chi = screen.getByLabelText('Chi *')
    expect(chi.tagName).toBe('SELECT') // niente campo libero
    await user.selectOptions(chi, 'u1')
    await user.type(screen.getByLabelText('Entrata *'), '18:00')
    await user.type(screen.getByLabelText('Uscita *'), '23:00')
    await user.click(screen.getByRole('button', { name: /Aggiungi/ }))
    expect(addStaffHours).toHaveBeenCalledTimes(1)
    const arg = addStaffHours.mock.calls[0][0]
    expect(arg.staff_uid).toBe('u1') // legato all'account
    expect(arg.staff_name).toBe('Sara')
  })

  it('le paghe si impostano sui membri dello staff, uid compreso', async () => {
    const user = userEvent.setup()
    render(<StaffHoursTab />)
    await user.click(screen.getByRole('button', { name: /Paghe orarie/ }))
    await waitFor(() => expect(screen.getByLabelText('Chi')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Chi'), 'u2')
    await user.type(screen.getByLabelText('€/ora'), '12')
    await user.click(screen.getByRole('button', { name: /Salva tariffa/ }))
    expect(saveStaffRates).toHaveBeenCalledTimes(1)
    const [membro, list] = saveStaffRates.mock.calls[0]
    expect(membro).toMatchObject({ uid: 'u2', name: 'Marco' })
    expect(list[0].rate).toBe(12)
  })
})
