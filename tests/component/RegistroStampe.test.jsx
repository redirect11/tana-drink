// @vitest-environment happy-dom
'use strict'

// ── IL REGISTRO DELLE STAMPE, A SCHERMO (REQ-STAMPA-017, BUG-098) ────
//
// «Quando fanno la chiusura cassa, la stampante non stampa lo scontrino di
// chiusura molto spesso» — e «quando non stampa non compare nessun
// avviso» (Flavio, 28/08/2026). L'unico avviso viveva otto secondi in una
// striscia che compare insieme a quella verde «Cassa chiusa», e la
// risposta della stampante finiva in una console che nessuno legge.
//
// Il registro sta nel pannello della stampante — «qui c'è la MACCHINA:
// indirizzo, prova di stampa, i dati» — perché è il posto dove si va
// quando la stampante fa i capricci. Questi test guardano quello che
// LEGGE chi ci va: cosa si è provato a stampare, com'è andata e perché.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// La MACCHINA si finge: qui si prova il pannello, non la stampante. Il
// REGISTRO invece è quello vero — è lui il soggetto della prova.
vi.mock('../../src/lib/printer.js', () => ({
  DEFAULT_PRINTER_SETTINGS: { ip: '', port: 8043, https: true },
  loadPrinterSettings: () => ({
    ip: '10.0.0.9',
    port: 8043,
    https: true,
    businessName: 'La Tana del Coniglio',
    businessAddress: '',
    businessCity: '',
    businessFooter: '',
  }),
  savePrinterSettings: vi.fn(),
  disconnectPrinter: vi.fn(),
  printTest: vi.fn(async () => {}),
}))
vi.mock('../../src/lib/api.js', () => ({ savePrinterConfig: vi.fn() }))

const { default: PrinterSetup } = await import('../../src/components/PrinterSetup.jsx')
const R = await import('../../src/lib/registroStampe.js')

beforeEach(() => {
  vi.clearAllMocks()
  R.dimenticaTuttoIlRegistro()
})

describe('quello che si legge nel registro delle stampe', () => {
  it('senza niente da dire lo dice, invece di lasciare un riquadro muto', async () => {
    render(<PrinterSetup />)
    expect(await screen.findByText(/Nessuna stampa registrata/i)).toBeInTheDocument()
    expect(screen.getByText(/Nessuna stampa in corso/i)).toBeInTheDocument()
  })

  it('una chiusura non uscita: cosa era, com’è andata e PERCHÉ', async () => {
    // È la riga che il giorno dopo risponde alla domanda «ieri sera la
    // chiusura è uscita?» — quella che oggi non ha risposta.
    R.lavoroFinito(R.lavoroInCoda('Chiusura cassa'), 'fallita', 'la carta è finita')
    render(<PrinterSetup />)

    expect(await screen.findByText(/Chiusura cassa/)).toBeInTheDocument()
    expect(screen.getByText(/Non stampata/)).toBeInTheDocument()
    expect(screen.getByText(/la carta è finita/)).toBeInTheDocument()
  })

  it('l’esito non confermato si legge per quello che è, non come un guasto', async () => {
    // Ci sono stampanti che stampano e non rispondono: dire «non
    // stampata» sarebbe una bugia, e manderebbe a cercare un guasto che
    // non c'è.
    R.lavoroFinito(
      R.lavoroInCoda('Chiusura cassa'),
      'sconosciuta',
      'la stampante non ha confermato la stampa'
    )
    render(<PrinterSetup />)
    expect(await screen.findByText(/Esito non confermato/)).toBeInTheDocument()
    expect(screen.queryByText(/Non stampata/)).not.toBeInTheDocument()
  })

  it('e quando è servito un secondo giro, si vede', async () => {
    // Serve a distinguere «è uscita» da «è uscita alla seconda»: la
    // seconda volta è una stampante che sta per piantarsi.
    R.lavoroFinito(R.lavoroInCoda('Scontrino conto #42'), 'riuscita', '', 2)
    render(<PrinterSetup />)
    expect(await screen.findByText(/ritentata una volta/)).toBeInTheDocument()
  })

  it('le stampe si leggono dalla più recente', async () => {
    R.lavoroFinito(R.lavoroInCoda('Comanda conto #1'), 'riuscita')
    R.lavoroFinito(R.lavoroInCoda('Comanda conto #2'), 'riuscita')
    R.lavoroFinito(R.lavoroInCoda('Chiusura cassa'), 'fallita', 'la carta è finita')
    const { container } = render(<PrinterSetup />)

    await screen.findByText(/Chiusura cassa/)
    // Solo le righe DEL REGISTRO: nel pannello c'è anche l'elenco delle
    // istruzioni di collegamento, che di `li` ne ha cinque.
    const righe = [...container.querySelectorAll('ul li')].map((l) => l.textContent)
    expect(righe[0]).toMatch(/Chiusura cassa/)
    expect(righe[2]).toMatch(/Comanda conto #1/)
  })

  it('si svuota, quando serve ripartire puliti', async () => {
    R.lavoroFinito(R.lavoroInCoda('Chiusura cassa'), 'riuscita')
    const user = userEvent.setup()
    render(<PrinterSetup />)
    await user.click(await screen.findByRole('button', { name: /Svuota il registro/i }))
    expect(await screen.findByText(/Nessuna stampa registrata/i)).toBeInTheDocument()
  })
})

// ── LA CODA, MENTRE LA CARTA ESCE ────────────────────────────────────
//
// La seconda domanda davanti a una stampante ferma è «si è impiantata?».
describe('la coda delle stampe si vede muoversi', () => {
  it('dice cosa è in corso e quanto c’è dietro, e si aggiorna da sola', async () => {
    render(<PrinterSetup />)
    await screen.findByText(/Nessuna stampa in corso/i)

    // La coda si muove FUORI da React — è la stampante che va avanti per
    // conto suo — e il pannello la segue: `act` è solo il modo di dire a
    // React che il ridisegno che ne segue è previsto.
    let uno
    act(() => {
      uno = R.lavoroInCoda('Chiusura cassa')
      R.lavoroInCoda('Comanda conto #7')
      R.lavoroPartito(uno)
    })

    // Il pannello non si ricarica: è iscritto al registro e segue la coda
    // mentre la serata va avanti.
    expect(await screen.findByText(/In stampa: Chiusura cassa/)).toBeInTheDocument()
    expect(screen.getByText(/1 in attesa/)).toBeInTheDocument()

    act(() => R.lavoroFinito(uno, 'riuscita'))
    await waitFor(() => expect(screen.getByText(/Nessuna stampa in corso/i)).toBeInTheDocument())
    expect(screen.getByText(/1 in attesa/)).toBeInTheDocument()
  })
})
