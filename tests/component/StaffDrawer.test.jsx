// @vitest-environment happy-dom
'use strict'

// Il MENU laterale del gestionale: quello che si tocca cinquanta volte a
// sera. I gruppi occupavano mezzo menu e spingevano fuori le ultime voci,
// e non c'era modo di vedere a nome di chi si stava battendo.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'a1', email: 'capo@bar.it', displayName: 'Capo Bar' } },
}))
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn() }))
vi.mock('../../src/dev/devActions.js', () => ({ devToolsEnabled: false }))
vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: { groups_enabled: false, groups_in_drawer: false },
  subscribeSettings: vi.fn((cb) => {
    cb({ groups_enabled: true, groups_in_drawer: true })
    return () => {}
  }),
  subscribeOpenGroups: vi.fn((cb) => {
    cb([{ id: 'g1', name: 'SumUp Test', kind: 'manual' }])
    return () => {}
  }),
  createManualGroup: vi.fn(),
}))

import StaffDrawer from '../../src/components/StaffDrawer.jsx'

function apri(role = 'admin') {
  const r = render(
    <MemoryRouter initialEntries={['/bar']}>
      <Routes>
        <Route path="/bar" element={<StaffDrawer role={role} />} />
        <Route path="/profilo-staff" element={<div>PAGINA PROFILO</div>} />
      </Routes>
    </MemoryRouter>
  )
  return r
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('menu laterale', () => {
  it('i gruppi partono chiusi e si aprono a richiesta', async () => {
    apri()
    expect(screen.getByRole('button', { name: /Gruppi/ })).toBeInTheDocument()
    expect(screen.queryByTitle('SumUp Test')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Gruppi/ }))
    expect(screen.getByTitle('SumUp Test')).toBeInTheDocument()
  })

  it('riaperto il menu, i gruppi restano come li avevi lasciati', async () => {
    const primo = apri()
    await userEvent.click(screen.getByRole('button', { name: /Gruppi/ }))
    primo.unmount()
    apri()
    expect(screen.getByTitle('SumUp Test')).toBeInTheDocument()
  })

  it('in fondo c’è chi è collegato, col suo ruolo, e apre il profilo', async () => {
    apri('admin')
    expect(screen.getByText('Capo Bar')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Capo Bar'))
    expect(screen.getByText('PAGINA PROFILO')).toBeInTheDocument()
  })

  it('la stampante non è più una voce di menu, gli utenti sì', () => {
    apri()
    expect(screen.queryByText('Stampante')).toBeNull()
    expect(screen.getByText('Utenti e ruoli')).toBeInTheDocument()
    expect(screen.getByText('Staff: turni e ore')).toBeInTheDocument()
  })

  it('lo staff di sala non vede il gestionale', () => {
    apri('staff')
    expect(screen.queryByText('Utenti e ruoli')).toBeNull()
    expect(screen.getByText('Da servire')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument() // il suo ruolo, in fondo
  })
})
