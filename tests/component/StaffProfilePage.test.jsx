// @vitest-environment happy-dom
'use strict'

// IL CONTO SVUOTATO, NEL PROFILO (REQ-ORD-025). Daniele, 15/11/2026: «a
// Flavio piace a Vittorio no. Quindi mettiamolo configurabile per chi sta
// usando il terminale». La scelta sta nel profilo, come gli avvisi, e si
// scrive sotto l'account di chi è collegato: chi prende il tablet dopo di
// lui ritrova la sua, non quella di Vittorio.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'

let utente = 'vittorio'
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({
      uid: utente,
      email: `${utente}@tana.local`,
      displayName: utente,
      getIdTokenResult: async () => ({ claims: { role: 'bartender' } }),
    })
    return () => {}
  },
}))
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn(async () => {}) }))
vi.mock('../../src/lib/customerAuth.js', () => ({ updateDisplayName: vi.fn(async () => {}) }))
vi.mock('../../src/components/PasswordChanger.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/AvvisiPanel.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/StoricoNotifiche.jsx', () => ({ default: () => null }))

import StaffProfilePage from '../../src/pages/StaffProfilePage.jsx'
import { contoVuotoSiChiude } from '../../src/lib/impostazioniLocali.js'

const NOME = 'Conto svuotato: si annulla e si torna alla coda'

const monta = () =>
  render(
    <MemoryRouter>
      <StaffProfilePage />
    </MemoryRouter>
  )

beforeEach(() => {
  localStorage.clear()
  utente = 'vittorio'
})

describe('il conto svuotato nel profilo', () => {
  it('di partenza è acceso: si chiude da solo, come finora', async () => {
    monta()
    expect(await screen.findByRole('checkbox', { name: NOME })).toBeChecked()
  })

  it('spento da Vittorio, vale per Vittorio e non per Flavio', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(await screen.findByRole('checkbox', { name: NOME }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: NOME })).not.toBeChecked())
    expect(contoVuotoSiChiude('vittorio')).toBe(false)
    expect(contoVuotoSiChiude('flavio')).toBe(true)
  })

  it('chi entra dopo sullo stesso dispositivo ritrova la sua scelta', async () => {
    localStorage.setItem('drink:conto:vuoto-si-chiude:vittorio', '0')
    utente = 'flavio'
    monta()
    expect(await screen.findByRole('checkbox', { name: NOME })).toBeChecked()
  })
})
