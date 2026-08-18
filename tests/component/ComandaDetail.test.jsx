// @vitest-environment happy-dom
'use strict'

// IL DETTAGLIO DI UNA COMANDA.
//
// Il dettaglio del CONTO risponde alla domanda della cassa: quanto fa, chi
// paga, cosa aggiungo. Questa risponde a quella del banco: cosa devo fare
// adesso, per chi, e da quanto sta lì. Le cose che si provano qui sono
// quelle che al banco costano un drink:
//   · si vedono le righe di QUESTA comanda, con le note che dicono come si
//     prepara, e il totale è il suo — non quello del conto;
//   · i passi portano l'ora: al banco quei minuti sono la differenza fra
//     «siamo indietro» e «questo ticket è stato dimenticato»;
//   · il tasto grande fa avanzare QUELLA comanda e si vede subito, senza
//     aspettare il server;
//   · al CONTO si risale sempre, perché è lì che si incassa e si aggiunge.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const vera = await orig()
  return { ...vera, useNavigate: () => navigateSpy }
})

// Chi guarda: il ruolo decide se questa pagina è sua.
let ruolo = 'bartender'
vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'u1', email: 'marta@bar.it' } },
  db: {},
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({ uid: 'u1', getIdTokenResult: async () => ({ claims: { role: ruolo } }) })
    return () => {}
  },
}))

// L'ordine come lo manda il server: la sottoscrizione lo consegna subito.
let ordine = null
vi.mock('../../src/lib/api.js', () => ({
  subscribeOrder: (_id, cb) => {
    cb(ordine)
    return () => {}
  },
  advanceComanda: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/printer.js', () => ({ printComanda: vi.fn(async () => {}) }))
vi.mock('../../src/lib/toast.js', () => ({ showToast: vi.fn() }))

import ComandaPage from '../../src/pages/ComandaPage.jsx'
import { advanceComanda } from '../../src/lib/api.js'
import { printComanda } from '../../src/lib/printer.js'

const ORA = '2026-08-18T21:00:00.000Z'
const POI = '2026-08-18T21:06:00.000Z'

const conto = (over = {}) => ({
  id: 'o41',
  daily_number: 41,
  status: 'aperto',
  payment_status: 'non_richiesto',
  table_label: '4',
  customer_name: 'Ciro',
  created_at: ORA,
  note: 'Allergia alle noci',
  service_mode: 'tavolo',
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ricevuto',
      created_at: ORA,
      status_times: { ricevuto: ORA },
      items: [{ drink_id: 'gin', name: 'Gin Tonic', qty: 2, unit_price: 8 }],
    },
    {
      id: 'c2',
      seq: 2,
      status: 'in_preparazione',
      created_at: ORA,
      status_times: { ricevuto: ORA, in_preparazione: POI },
      items: [
        { drink_id: 'negroni', name: 'Negroni', qty: 3, unit_price: 9, note: 'senza ghiaccio' },
      ],
    },
  ],
  ...over,
})

function monta(comandaId = 'c2') {
  return render(
    <MemoryRouter initialEntries={[`/ordine/o41/comanda/${comandaId}`]}>
      <Routes>
        <Route path="/ordine/:id/comanda/:comandaId" element={<ComandaPage />} />
        <Route path="/ordine/:id" element={<div>schermata del conto</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  ruolo = 'bartender'
  ordine = conto()
})

describe('il dettaglio di una comanda', () => {
  it('dice che comanda è, dove va e cosa c’è da fare', async () => {
    monta()
    await screen.findByText(/Cosa c’è da fare/)

    // il numero del conto e quello del ticket, che è come si chiama al banco
    expect(screen.getByText('· comanda 2')).toBeInTheDocument()
    expect(screen.getByText('Tavolo 4 · Ciro')).toBeInTheDocument()

    // le righe di QUESTA comanda, con la nota che dice come si prepara
    const righe = document.querySelector('.comanda-det-righe')
    expect(within(righe).getByText(/Negroni/)).toBeInTheDocument()
    expect(within(righe).getByText(/senza ghiaccio/)).toBeInTheDocument()
    expect(within(righe).queryByText(/Gin Tonic/)).not.toBeInTheDocument()

    // e il totale è il SUO — tre negroni — non quello del conto intero,
    // che ha dentro anche i due gin tonic dell'altra comanda
    const totale = within(righe.querySelector('.comanda-det-totale'))
    expect(totale.getByText('27,00 €')).toBeInTheDocument()

    // la nota del conto vale anche per il pezzo che si sta preparando
    expect(within(righe).getByText(/Allergia alle noci/)).toBeInTheDocument()
  })

  it('i passi portano l’ora di quando sono stati toccati', async () => {
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    const passi = [...document.querySelectorAll('.comanda-det-passi .step')]
    expect(passi.length).toBe(4)
    // «in preparazione» è quello di adesso, e i due toccati hanno l'ora
    expect(passi[0]).toHaveClass('done')
    expect(passi[1]).toHaveClass('active')
    expect(passi[2]).not.toHaveClass('done')
    expect(passi[0].textContent).toMatch(/\d{2}:\d{2}/)
    expect(passi[2].textContent).toMatch(/—/)
  })

  it('il tasto grande fa avanzare QUELLA comanda, e si vede subito', async () => {
    const utente = userEvent.setup()
    monta()
    await screen.findByText(/Cosa c’è da fare/)

    await utente.click(screen.getByRole('button', { name: 'Pronto al servizio' }))
    expect(advanceComanda).toHaveBeenCalledWith('o41', 'c2', 'pronto')

    // senza aspettare il server la schermata è già al passo dopo: al banco
    // un gesto che non si vede subito è un gesto che si ripete
    await waitFor(() => expect(screen.getByRole('button', { name: 'Servito' })).toBeInTheDocument())
  })

  it('si può riportare indietro, anche di più di un passo', async () => {
    const utente = userEvent.setup()
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    await utente.click(screen.getByRole('button', { name: /Ordine ricevuto/ }))
    expect(advanceComanda).toHaveBeenCalledWith('o41', 'c2', 'ricevuto')
  })

  it('DA QUI SI RISALE AL CONTO: è lì che si incassa e si aggiunge', async () => {
    const utente = userEvent.setup()
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    await utente.click(screen.getByRole('button', { name: /Apri il conto #41/ }))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o41')
  })

  it('e si torna alla coda da dove si era arrivati', async () => {
    const utente = userEvent.setup()
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    await utente.click(screen.getByRole('button', { name: /Torna alla coda/ }))
    expect(navigateSpy).toHaveBeenCalledWith('/bar')
  })

  it('la comanda si ristampa: la copia al banco si perde, si strappa, si bagna', async () => {
    const utente = userEvent.setup()
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    await utente.click(screen.getByRole('button', { name: /Ristampa/ }))
    expect(printComanda).toHaveBeenCalledTimes(1)
    expect(printComanda.mock.calls[0][1].id).toBe('c2')
  })

  it('un conto già pagato non ha tasti: non c’è più niente da fare', async () => {
    ordine = conto({ status: 'pagato', payment_status: 'pagato' })
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    expect(screen.queryByRole('button', { name: 'Pronto al servizio' })).not.toBeInTheDocument()
    expect(screen.getByText('💶 Pagato')).toBeInTheDocument()
  })

  it('l’acconto si vede anche da qui', async () => {
    // Chi finisce la comanda spesso è quello che poi porta il conto al
    // tavolo: senza dirlo qui, chiede l'intero — ed è successo.
    ordine = conto({ payment_status: 'parziale', payments: [{ amount: 10 }] })
    monta()
    await screen.findByText(/Cosa c’è da fare/)
    expect(screen.getByText('💳 Acconto')).toBeInTheDocument()
  })

  it('chi non gestisce finisce sul conto, non davanti a un «non puoi»', async () => {
    ruolo = 'staff'
    monta()
    expect(await screen.findByText('schermata del conto')).toBeInTheDocument()
  })

  it('comanda sparita (divisa, conto rifatto): si va dove la risposta c’è', async () => {
    monta('c9')
    expect(await screen.findByText(/Questa comanda non c’è più/)).toBeInTheDocument()
  })
})
