// @vitest-environment happy-dom
'use strict'

// ── LE IMPOSTAZIONI DI STAMPA AUTOMATICA STANNO IN CASSA (REQ-UI-025) ─
//
// «Questo setting è in cassa e giornata mentre le altre impostazioni di
// stampa automatica sono in stampante. Perché hai scelto di metterla lì?
// Le impostazioni di stampa automatica riguardano la cassa, quindi anche
// le impostazioni di stampa automatiche spostale in cassa» (l'utente,
// 22/08/2026).
//
// Due cose da dimostrare, e la seconda vale quanto la prima: che gli
// interruttori ci SIANO nel posto nuovo, e che NON siano rimasti anche in
// quello vecchio — un doppione qui vorrebbe dire due interruttori per la
// stessa cosa, e chi ne spegne uno crede di aver spento la stampa.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const savePrinterConfig = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/api.js', () => ({ savePrinterConfig }))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: null }, db: {} }))

import StampaAutomatica from '../../src/components/StampaAutomatica.jsx'
import PrinterSetup from '../../src/components/PrinterSetup.jsx'
import { loadPrinterSettings } from '../../src/lib/printer.js'

beforeEach(() => {
  localStorage.clear()
  savePrinterConfig.mockClear()
})

const AUTOMATICHE = [
  'Stampa la comanda all’arrivo dell’ordine',
  'Stampa lo scontrino alla riscossione del conto',
]

describe('il riquadro «Stampa automatica»', () => {
  it('tiene insieme le due famiglie, e dice a schermo quale è quale', () => {
    render(<StampaAutomatica settings={{}} save={vi.fn()} />)
    for (const t of AUTOMATICHE) expect(screen.getByText(t)).toBeInTheDocument()
    expect(screen.getByText('Lo scontrino d’acconto a ogni riscossione')).toBeInTheDocument()
    expect(screen.getByText('Un tasto per l’acconto con lo scontrino')).toBeInTheDocument()
    // LE DUE NATURE SI LEGGONO: quelle della stampante valgono per questo
    // tablet, quelle del bar per tutti. Senza dirlo, si accende una cosa al
    // banco e ci si stupisce che in sala non sia cambiato niente.
    expect(screen.getByText('Su questo terminale')).toBeInTheDocument()
    expect(screen.getByText('Per tutto il locale')).toBeInTheDocument()
  })

  // LOCAL-FIRST: l'interruttore scrive subito nella memoria del terminale —
  // che è chi la legge al momento di stampare — e manda la copia al server
  // in sottofondo. Niente attese: al banco la stampa non aspetta la rete.
  it('accendere la comanda automatica si scrive subito, senza aspettare la rete', async () => {
    const user = userEvent.setup()
    render(<StampaAutomatica settings={{}} save={vi.fn()} />)
    expect(loadPrinterSettings().autoPrintComanda).toBe(false)

    await user.click(screen.getByText(AUTOMATICHE[0]).closest('.toggle-row').querySelector('input'))

    expect(loadPrinterSettings().autoPrintComanda).toBe(true)
    expect(savePrinterConfig).toHaveBeenCalledWith({ autoPrintComanda: true })
  })

  it('le due del locale passano dalle impostazioni del bar, non dalla stampante', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    render(<StampaAutomatica settings={{}} save={save} />)

    await user.click(
      screen
        .getByText('Lo scontrino d’acconto a ogni riscossione')
        .closest('.toggle-row')
        .querySelector('input')
    )

    expect(save).toHaveBeenCalledWith({ scontrino_acconto_sempre: true })
    expect(loadPrinterSettings().scontrino_acconto_sempre).toBeUndefined()
  })

  // «La stampa il banco» con la stampa automatica spenta vuol dire: non
  // stampa nessuno. L'avviso è venuto qui insieme all'interruttore che
  // guarda — separarli lasciava un avviso che parla di un tasto altrove.
  it('«la stampa il banco» con l’automatica spenta lo dice, e l’interruttore è lì', async () => {
    const user = userEvent.setup()
    render(<StampaAutomatica settings={{}} save={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /La stampa il banco/ }))

    expect(loadPrinterSettings().stampaSala).toBe('rimbalzo')
    expect(screen.getByText(/non le stampa nessuno/)).toBeInTheDocument()

    await user.click(screen.getByText(AUTOMATICHE[0]).closest('.toggle-row').querySelector('input'))
    expect(screen.queryByText(/non le stampa nessuno/)).toBeNull()
  })
})

describe('nel pannello «Stampante» resta la macchina', () => {
  it('gli interruttori della stampa automatica non ci sono più', () => {
    render(<PrinterSetup />)
    for (const t of AUTOMATICHE) expect(screen.queryByText(t)).toBeNull()
    expect(screen.queryByRole('button', { name: /La stampa il banco/ })).toBeNull()
    // …e chi li cerca qui trova scritto dove sono andati.
    expect(screen.getByText(/Cassa e giornata → Stampa automatica/)).toBeInTheDocument()
  })

  it('ci sono ancora indirizzo, porta e i dati che finiscono sulla carta', () => {
    render(<PrinterSetup />)
    expect(screen.getByLabelText('IP stampante')).toBeInTheDocument()
    expect(screen.getByLabelText('Porta')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome locale')).toBeInTheDocument()
  })

  // SALVARE L'INDIRIZZO NON DEVE SPEGNERE LA STAMPA AUTOMATICA. Il `form`
  // di questo pannello è una fotografia scattata all'apertura: mandandolo
  // intero, un interruttore acceso altrove nel frattempo tornava al valore
  // di mezz'ora fa.
  it('salvare l’IP non tocca la stampa automatica accesa nel frattempo', async () => {
    const user = userEvent.setup()
    render(<PrinterSetup />)

    // Il banco accende la stampa automatica mentre questo pannello è aperto.
    const { savePrinterSettings } = await import('../../src/lib/printer.js')
    savePrinterSettings({ autoPrintComanda: true })

    await user.type(screen.getByLabelText('IP stampante'), '192.168.1.50')
    await user.click(screen.getByRole('button', { name: 'Salva' }))

    expect(loadPrinterSettings().ip).toBe('192.168.1.50')
    expect(loadPrinterSettings().autoPrintComanda).toBe(true)
    expect(savePrinterConfig).toHaveBeenCalled()
    for (const [patch] of savePrinterConfig.mock.calls) {
      expect(patch).not.toHaveProperty('autoPrintComanda')
    }
  })
})
