// @vitest-environment happy-dom
'use strict'

// IL PALLINO NELLA CODA ORDINI. Sta lì e non nelle impostazioni perché la
// domanda («stamperà?») viene in mente mentre si prende un ordine — e in
// sala le impostazioni non ci sono nemmeno. Deve dire tre cose diverse:
// risponde, non risponde (e perché), non c'è nessuna stampante qui.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

let impostazioni = { ip: '192.168.1.50', port: 8043, stampaSala: 'ip' }
let esito = { ok: true }

vi.mock('../../src/lib/printer.js', () => ({
  loadPrinterSettings: () => impostazioni,
  preparaStampante: () => Promise.resolve(esito),
  salaStampaDaSe: (s) => s.stampaSala !== 'rimbalzo',
}))

const { default: PallinoStampante } = await import('../../src/components/PallinoStampante.jsx')

beforeEach(() => {
  impostazioni = { ip: '192.168.1.50', port: 8043, stampaSala: 'ip' }
  esito = { ok: true }
})

describe('il pallino della stampante', () => {
  it('verde quando risponde: la comanda uscirà', async () => {
    render(<PallinoStampante gestore />)
    expect(await screen.findByLabelText(/Stampante: risponde/)).toBeInTheDocument()
  })

  it('rosso quando non risponde, e toccandolo si legge perché', async () => {
    esito = { ok: false, motivo: 'Connessione fallita (SSL_CONNECT_FAILED).' }
    const user = userEvent.setup()
    render(<PallinoStampante gestore />)
    const tasto = await screen.findByLabelText(/SSL_CONNECT_FAILED/)
    await user.click(tasto)
    expect(screen.getByText(/non uscirebbe/)).toBeInTheDocument()
    // Il guasto più frequente non è la stampante spenta: è l'eccezione del
    // certificato scaduta. La strada per rimetterla a posto sta lì dentro.
    expect(screen.getByRole('link', { name: /192\.168\.1\.50:8043/ })).toBeInTheDocument()
  })

  it('a chi è in sala non dice di andare nelle impostazioni: non ce le ha', async () => {
    impostazioni = { ip: '', port: 8043, stampaSala: 'ip' }
    const user = userEvent.setup()
    render(<PallinoStampante gestore={false} />)
    await user.click(await screen.findByRole('button', { name: /Stampante/ }))
    expect(screen.getByText(/Dillo a chi sta al banco/)).toBeInTheDocument()
    expect(screen.queryByText(/Impostazioni → Stampante/)).toBeNull()
  })

  it('col rimbalzo il pallino di questo telefono non vuol dire niente, e lo dice', async () => {
    // A stampare è il banco: un rosso qui sarebbe un allarme che chi è in
    // sala non può spegnere in nessun modo.
    impostazioni = { ip: '', port: 8043, stampaSala: 'rimbalzo' }
    render(<PallinoStampante gestore={false} />)
    expect(await screen.findByText(/Stampa il banco/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
