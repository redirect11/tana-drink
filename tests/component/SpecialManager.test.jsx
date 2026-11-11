// @vitest-environment happy-dom
'use strict'

// IL MENÙ SPECIAL SI ACCENDE E SI SPEGNE (REQ-MENU-018). L'utente,
// 06/11/2026: il menù Special, col carosello in cima e la pagina sua, «come
// per gli altri menù è attivabile o meno»; spento, gli special restano nelle
// loro sezioni. Acceso di partenza, perché era così per tutti. Quello che
// il menù dei clienti fa con l'interruttore lo prova MenuPage.test.jsx.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const st = vi.hoisted(() => ({ impostazioni: {}, scritte: [] }))

vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: {},
  subscribeSettings: (cb) => {
    cb(st.impostazioni)
    return () => {}
  },
  updateSettings: vi.fn((patch) => {
    st.scritte.push(patch)
    return Promise.resolve()
  }),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,') } }))

import SpecialManager from '../../src/components/SpecialManager.jsx'

beforeEach(() => {
  st.impostazioni = {}
  st.scritte = []
})

const interruttore = () => screen.getByRole('checkbox', { name: 'Menù Special attivo' })
const nelMenu = () => screen.queryByRole('checkbox', { name: 'Special anche fra le sezioni del menù' })
// Il QR si fa dopo il primo disegno: si aspetta che ci sia.
async function mostra() {
  render(<SpecialManager drinks={[]} onEdit={() => {}} />)
  await screen.findByAltText('QR del menù Special')
}

describe('l’interruttore del menù Special', () => {
  it('di partenza è acceso', async () => {
    await mostra()
    expect(screen.getByText('Menù Special attivo')).toBeInTheDocument()
    expect(interruttore()).toBeChecked()
  })

  it('spento, lo scrive nelle impostazioni del locale', async () => {
    await mostra()
    await userEvent.setup().click(interruttore())
    expect(st.scritte).toContainEqual({ special_attivo: false })
  })

  it('spento nelle impostazioni, si legge spento', async () => {
    st.impostazioni = { special_attivo: false }
    await mostra()
    expect(interruttore()).not.toBeChecked()
  })
})

// GLI SPECIAL FUORI DAL MENÙ (REQ-MENU-037). L'utente, 11/11/2026: «metti
// anche una opzione per togliere la carta degli special dal mazzo di carte
// e aprirla solo da carosello e QR code», e «di default metti che il menù
// signature/special si vede solo se clicchi sul carosello o con il QR code».
describe('gli Special anche fra le sezioni del menù', () => {
  it('di partenza è spento: i Signature si aprono dal carosello e dal QR', async () => {
    await mostra()
    expect(nelMenu()).not.toBeChecked()
  })

  it('acceso, lo scrive nelle impostazioni del locale', async () => {
    await mostra()
    await userEvent.setup().click(nelMenu())
    expect(st.scritte).toContainEqual({ special_nel_menu: true })
  })

  // Senza carosello non ci sarebbe strada per arrivare agli Special: col
  // menù Special spento restano nel menù, e la scelta non si offre.
  it('col menù Special spento la scelta non c’è', async () => {
    st.impostazioni = { special_attivo: false }
    await mostra()
    expect(nelMenu()).toBeNull()
  })
})
