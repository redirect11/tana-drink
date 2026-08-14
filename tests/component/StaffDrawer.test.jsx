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
import { Sottosezioni } from '../../src/lib/sottosezioni.js'

function apri(role = 'admin') {
  const r = render(
    <MemoryRouter initialEntries={['/bar']}>
      <Routes>
        <Route path="/bar" element={<StaffDrawer role={role} />} />
        <Route path="/profilo-staff" element={<div>PAGINA PROFILO</div>} />
        <Route path="/pos" element={<div>PAGINA POS</div>} />
        <Route path="/menu" element={<div>PAGINA MENU</div>} />
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
    // "Vista cliente" era un tasto in barra: la navigazione sta nel menu.
    expect(screen.getByText('Vista cliente')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument()
  })

  it('lo staff di sala non vede il gestionale, ma lavora sulla stessa coda', () => {
    apri('staff')
    expect(screen.queryByText('Utenti e ruoli')).toBeNull()
    // La home della sala è la coda del banco; «I miei ordini» non è più
    // una pagina (è il filtro «Miei» della coda), «Da servire» resta.
    expect(screen.getByText('Coda ordini')).toBeInTheDocument()
    expect(screen.getByText('Da servire')).toBeInTheDocument()
    expect(screen.queryByText('I miei ordini')).toBeNull()
    expect(screen.getByText('Staff')).toBeInTheDocument() // il suo ruolo, in fondo
  })

  it('per la sala «Nuovo ordine» apre il menù, non il POS', async () => {
    // Il POS è lo strumento del banco: la sala ordina dal menù che sta
    // mostrando al tavolo, con la ricerca.
    apri('staff')
    await userEvent.click(screen.getByText('Nuovo ordine dal menù'))
    expect(screen.getByText('PAGINA MENU')).toBeInTheDocument()
  })

  it('per il gestore «Nuovo ordine» apre il POS', async () => {
    apri('admin')
    await userEvent.click(screen.getByText('Nuovo ordine'))
    expect(screen.getByText('PAGINA POS')).toBeInTheDocument()
  })
})

// ── IL MENU AGGANCIATO ALLA PAGINA ───────────────────────────────────
// Dove la pagina ha sezioni sue (Impostazioni, Inventario) il menu resta
// aperto dentro la pagina: si salta da una sezione all'altra venti volte di
// seguito, e un menu che copre vuol dire aprirlo, cercare, scegliere — e
// intanto non vedere piu' dove si era. Chi vuole tutta la larghezza lo
// chiude, e resta chiuso anche domani.
describe('il menu agganciato alla pagina', () => {
  const SEZIONI = [
    { id: 'aspetto', icona: '🎨', label: 'Aspetto' },
    { id: 'stampante', icona: '🖨️', label: 'Stampante' },
  ]

  function conSezioni(voci = SEZIONI) {
    return render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="impostazioni" />
        <Sottosezioni voci={voci} attiva="aspetto" scegli={() => {}} />
      </MemoryRouter>
    )
  }

  it('con le sezioni della pagina il menu e’ gia’ aperto, senza toccare niente', () => {
    conSezioni()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(true)
    expect(document.querySelector('.bar-sidebar.agganciata')).toBeTruthy()
  })

  it('sulle pagine senza sezioni resta a scomparsa: la coda non perde una colonna', () => {
    render(
      <MemoryRouter initialEntries={['/bar']}>
        <StaffDrawer role="admin" active="coda" />
      </MemoryRouter>
    )
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
  })

  it('si chiude per allargare la pagina, e resta chiuso anche la volta dopo', async () => {
    const user = userEvent.setup()
    const primo = conSezioni()
    await user.click(screen.getByRole('button', { name: /Chiudi il menu/ }))
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
    primo.unmount()

    conSezioni()
    expect(document.body.classList.contains('drawer-agganciato')).toBe(false)
    // …e si riaggancia quando lo si richiede.
    await user.click(screen.getByRole('button', { name: /Tieni il menu aperto/ }))
    expect(document.body.classList.contains('drawer-agganciato')).toBe(true)
  })
})
