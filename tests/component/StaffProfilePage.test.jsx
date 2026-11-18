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
let ruolo = 'bartender'
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({
      uid: utente,
      email: `${utente}@tana.local`,
      displayName: utente,
      getIdTokenResult: async () => ({ claims: { role: ruolo } }),
    })
    return () => {}
  },
}))
vi.mock('../../src/lib/logout.js', () => ({ logoutStaff: vi.fn(async () => {}) }))
vi.mock('../../src/lib/customerAuth.js', () => ({ updateDisplayName: vi.fn(async () => {}) }))
vi.mock('../../src/components/PasswordChanger.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/AvvisiPanel.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/StoricoNotifiche.jsx', () => ({ default: () => null }))
const salvate = vi.hoisted(() => [])
vi.mock('../../src/lib/api.js', () => ({
  salvaLinguaDelProfilo: (uid, lingua) => salvate.push([uid, lingua]),
}))

import StaffProfilePage from '../../src/pages/StaffProfilePage.jsx'
import { contoVuotoSiChiude } from '../../src/lib/impostazioniLocali.js'
import { impostaLingua, linguaAttiva } from '../../src/lib/lingua.js'

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
  ruolo = 'bartender'
  salvate.length = 0
  impostaLingua('it')
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

// LA LINGUA DEL GESTIONALE (REQ-UI-039). Daniele, 17/11/2026: «chiunque
// può scegliere la lingua nel gestionale, qualsiasi ruolo. La lingua è
// legata al profilo». Il profilo ce l'ha ogni ruolo, e la scelta va
// sull'account (salvaLinguaDelProfilo), non solo su questo dispositivo.
describe('la lingua nel profilo', () => {
  it('si sceglie fra Italiano ed English, coi nomi nella loro lingua', async () => {
    monta()
    expect(await screen.findByRole('button', { name: 'Italiano' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en')
  })

  it('scelto l’inglese, la pagina parla inglese e la scelta va sull’account', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(await screen.findByRole('button', { name: 'English' }))
    expect(linguaAttiva()).toBe('en')
    expect(salvate).toEqual([['vittorio', 'en']])
    expect(await screen.findByRole('heading', { name: /My profile/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('anche chi è in sala la sceglie', async () => {
    utente = 'sala'
    ruolo = 'staff'
    monta()
    expect(await screen.findByRole('button', { name: 'English' })).toBeInTheDocument()
  })
})
