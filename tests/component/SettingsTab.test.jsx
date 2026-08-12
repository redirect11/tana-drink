// @vitest-environment happy-dom
'use strict'

// IMPOSTAZIONI A SCHEDE. Erano venti riquadri uno sotto l'altro: per
// cambiare l'orario di chiusura si scorreva oltre pagamenti, gruppi,
// sconti e coperto. Ora ogni riquadro è una voce a sinistra — e si apre
// UNA sola alla volta, altrimenti non si è risolto niente.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/api.js', () => {
  // Dichiarate QUI dentro: vi.mock viene issato in cima al file e non
  // vedrebbe una costante definita fuori.
  const impostazioni = {
    menu_only: false,
    workflow_enabled: true,
    groups_enabled: false,
    customer_accounts_enabled: true,
    queue_view: 'tabs',
    service_mode: 'banco',
    cancel_phrase_default: 'bancone',
  }
  return {
    subscribeSettings: (cb) => {
      cb(impostazioni)
      return () => {}
    },
    updateSettings: vi.fn(() => Promise.resolve()),
    resetOpenOrdersToReceived: vi.fn(() => Promise.resolve(0)),
    replaceCatalog: vi.fn(() => Promise.resolve()),
    DEFAULT_SETTINGS: impostazioni,
  }
})
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: null }, db: {} }))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  pairSumUpReader: vi.fn(),
  unpairSumUpReader: vi.fn(),
}))
vi.mock('../../src/components/PrinterSetup.jsx', () => ({
  default: () => <div>PANNELLO STAMPANTE</div>,
}))
vi.mock('../../src/components/BackupPanel.jsx', () => ({
  default: () => <div>PANNELLO BACKUP</div>,
}))
vi.mock('../../src/components/InfoTab.jsx', () => ({
  default: () => <div>PANNELLO INFORMAZIONI</div>,
}))
vi.mock('../../src/components/ThemeSettings.jsx', () => ({
  default: () => <div>PANNELLO ASPETTO</div>,
}))

import SettingsTab from '../../src/components/SettingsTab.jsx'

beforeEach(() => localStorage.clear())

describe('impostazioni a schede', () => {
  it('si apre una sezione sola, non la pagina intera', async () => {
    render(<SettingsTab role="admin" />)
    expect(screen.getByText('PANNELLO ASPETTO')).toBeInTheDocument()
    // I riquadri delle altre sezioni NON sono in pagina.
    expect(screen.queryByRole('heading', { name: 'Pagamenti' })).toBeNull()
    expect(screen.queryByText('PANNELLO STAMPANTE')).toBeNull()
  })

  it('scegliendo una voce si apre il suo riquadro e si chiude il precedente', async () => {
    const user = userEvent.setup()
    render(<SettingsTab role="admin" />)
    await user.click(screen.getByRole('button', { name: /Pagamenti/ }))
    expect(screen.getByRole('heading', { name: 'Pagamenti' })).toBeInTheDocument()
    expect(screen.queryByText('PANNELLO ASPETTO')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Stampante/ }))
    expect(screen.getByText('PANNELLO STAMPANTE')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pagamenti' })).toBeNull()
  })

  it('la sezione aperta si ricorda: a impostazioni si torna per lo stesso motivo', async () => {
    const user = userEvent.setup()
    const primo = render(<SettingsTab role="admin" />)
    await user.click(screen.getByRole('button', { name: /Coperto/ }))
    expect(screen.getByRole('heading', { name: 'Coperto' })).toBeInTheDocument()
    primo.unmount()

    render(<SettingsTab role="admin" />)
    expect(screen.getByRole('heading', { name: 'Coperto' })).toBeInTheDocument()
  })

  it('ci sono tutte le sezioni, nessun riquadro perso per strada', () => {
    render(<SettingsTab role="admin" />)
    for (const voce of [
      'Aspetto',
      'Modalità menù',
      'Vista ordine',
      'Consegna ordine',
      'Pagamenti',
      'Gruppi di ordini',
      'Gestione preparazione',
      'Giornata di lavoro',
      'Prezzo consigliato',
      'Tempi di servizio',
      'Sconto e righe del conto',
      'Coperto',
      'Servizio e mancia',
      'Menù',
      'Coda ordini',
      'Catalogo prodotti',
      'Account clienti',
      'Posizione locale',
      'Stampante',
      'Backup e ripristino',
      'Informazioni',
      'Annullamenti',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(voce) })).toBeInTheDocument()
    }
  })
})

// ── Come si comporta la ricerca nella coda ────────────────────────────
// Chi lavora al banco ha due abitudini diverse: c'è chi vuole la coda
// ripulita e chi vuole vederla tutta e sapere solo DOVE sta il conto.
// Non si sceglie per lui: l'interruttore sta qui, nelle impostazioni.
describe('la ricerca della coda: filtra o accende', () => {
  it('di suo filtra, come è sempre stato', async () => {
    const user = userEvent.setup()
    render(<SettingsTab role="admin" />)
    await user.click(screen.getByRole('button', { name: /Coda ordini/ }))
    expect(screen.getByRole('button', { name: /Filtra la coda/ })).toHaveClass('active')
    expect(screen.getByRole('button', { name: /Accendi il conto e portami lì/ })).not.toHaveClass('active')
  })

  it('si può passare ad accendere il conto trovato', async () => {
    const user = userEvent.setup()
    const { updateSettings } = await import('../../src/lib/api.js')
    render(<SettingsTab role="admin" />)
    await user.click(screen.getByRole('button', { name: /Coda ordini/ }))
    await user.click(screen.getByRole('button', { name: /Accendi il conto e portami lì/ }))
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ queue_search: 'evidenzia' }))
  })
})
