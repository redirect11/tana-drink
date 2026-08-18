// @vitest-environment happy-dom
'use strict'

// Pagina UTENTI: da qui l'admin nomina i ruoli. Le due cose che devono
// reggere sono che i clienti registrati si vedano (altrimenti non si può
// promuovere nessuno) e che il bartender non abbia i tasti per farlo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const UTENTI = [
  { uid: 'a1', name: 'Capo', email: 'capo@bar.it', role: 'admin' },
  { uid: 'b1', name: 'Marco', email: 'marco@bar.it', role: 'bartender' },
  { uid: 's1', name: 'Sara', email: 'sara@bar.it', role: 'staff' },
  { uid: 'c1', name: 'Luigi Rossi', email: 'luigi@gmail.com', role: 'cliente' },
]

vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'a1', email: 'capo@bar.it', displayName: 'Capo' } },
}))
vi.mock('../../src/lib/api.js', () => ({
  createStaffCall: vi.fn(() => Promise.resolve()),
  subscribePendingCalls: vi.fn((cb) => {
    cb([])
    return () => {}
  }),
  updateSettings: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/staffApi.js', () => ({
  listUtenti: vi.fn(() => Promise.resolve(UTENTI)),
  listStaff: vi.fn(() => Promise.resolve(UTENTI.filter((u) => u.role !== 'cliente'))),
  createStaff: vi.fn(() => Promise.resolve()),
  setStaffRole: vi.fn(() => Promise.resolve()),
  setStaffDisabled: vi.fn(() => Promise.resolve()),
  removeStaff: vi.fn(() => Promise.resolve()),
}))

import UtentiTab from '../../src/components/UtentiTab.jsx'
import { setStaffRole, listStaff, listUtenti } from '../../src/lib/staffApi.js'

beforeEach(() => vi.clearAllMocks())

describe('pagina utenti — admin', () => {
  it('separa il personale dai clienti registrati', async () => {
    render(<UtentiTab role="admin" />)
    await waitFor(() => expect(screen.getByText('Personale (3)')).toBeInTheDocument())
    expect(screen.getByText('Clienti registrati (1)')).toBeInTheDocument()
    expect(screen.getByText('Luigi Rossi')).toBeInTheDocument()
  })

  it('promuove un cliente registrato a staff', async () => {
    render(<UtentiTab role="admin" />)
    await screen.findByText('Luigi Rossi')
    const rigaCliente = screen.getByText('Luigi Rossi').closest('.toggle-row')
    await userEvent.click(rigaCliente.querySelector('button[title="Cambia ruolo"]'))
    await userEvent.click(await screen.findByRole('button', { name: /🫱 Staff/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Assegna' }))
    await waitFor(() => expect(setStaffRole).toHaveBeenCalledWith('c1', 'staff'))
  })

  it('nominare un admin chiede conferma (dà accesso a tutto)', async () => {
    render(<UtentiTab role="admin" />)
    await screen.findByText('Sara')
    const riga = screen.getByText('Sara').closest('.toggle-row')
    await userEvent.click(riga.querySelector('button[title="Cambia ruolo"]'))
    await userEvent.click(await screen.findByRole('button', { name: /👑 Admin/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Assegna' }))
    expect(setStaffRole).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(setStaffRole).toHaveBeenCalledWith('s1', 'admin'))
  })

  it('su di sé non compaiono i tasti: niente autodeclassamenti', async () => {
    render(<UtentiTab role="admin" />)
    await screen.findByText('Capo')
    const mia = screen.getByText('Capo').closest('.toggle-row')
    expect(mia.querySelector('button[title="Cambia ruolo"]')).toBeNull()
  })
})

describe('pagina utenti — bartender', () => {
  it('vede la rubrica ma non i ruoli, e non chiede l’elenco completo', async () => {
    render(<UtentiTab role="bartender" />)
    await waitFor(() => expect(screen.getByText('Personale (3)')).toBeInTheDocument())
    expect(listStaff).toHaveBeenCalled()
    expect(listUtenti).not.toHaveBeenCalled()
    expect(screen.queryByText('Clienti registrati (1)')).toBeNull()
    expect(document.querySelector('button[title="Cambia ruolo"]')).toBeNull()
    expect(screen.getByText(/I ruoli li assegna/)).toBeInTheDocument()
  })
})

// TRE SEZIONI, come nelle altre pagine: l'elenco delle utenze è quella che
// si apre — è il motivo per cui si viene qui — mentre «Nuovo account» e
// «Buoni VIP» erano pannelli a scomparsa in cima, e aprirli spingeva giù
// l'elenco. Chi non è amministratore ha solo l'elenco: le altre due non
// sono cose sue.
describe('le sezioni di Utenti e ruoli', () => {
  it('si apre sull’elenco delle utenze', async () => {
    render(<UtentiTab role="admin" />)
    expect(await screen.findByText(/Personale \(/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Crea account/ })).toBeNull()
  })

  it('«Nuovo account» è una sezione a sé', async () => {
    render(<UtentiTab role="admin" sezioneIniziale="nuovo" />)
    expect(await screen.findByRole('button', { name: /Crea account/ })).toBeInTheDocument()
    expect(screen.queryByText(/Personale \(/)).toBeNull()
  })
})
