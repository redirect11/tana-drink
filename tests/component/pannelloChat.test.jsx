// @vitest-environment happy-dom
'use strict'

// L'ASSISTENTE AI DEL GESTIONALE (REQ-AI-006, PannelloChat.jsx). Si apre
// chiedendo il credito (gratis): con l'AI ferma lo dice e non si scrive.
// Il giro: chi scrive manda un testo; il modello chiede gli strumenti;
// l'app esegue quelli di lettura coi dati che ha e rimanda gli esiti; le
// proposte (una descrizione) si usano o si scartano a schermo, e solo
// allora il giro riparte. La conversazione viaggia intera, coi turni del
// modello rimessi intatti.
//
// La Function è finta (la prova tests/bdd/richiesta-ai.test.js), e così le
// letture e le scritture del database.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({ ...(await originale()), senzaFunctions: () => false }))
vi.mock('../../src/lib/storage.js', () => ({ fotoDiFatturaLeggibile: (f) => Promise.resolve(f) }))
const updateDrink = vi.fn(async () => {})
vi.mock('../../src/lib/api.js', () => ({
  fetchInventoryItems: async () => [{ id: 'i1', name: 'Gin Tanqueray', stock: 1400, unit: 'ml', low_threshold: 700 }],
  fetchDrinks: async () => [{ id: 'd1', name: 'Negroni', category_id: 'c1', price: 8 }],
  fetchCategories: async () => [{ id: 'c1', name: 'Cocktail' }],
  fetchOrdersRange: async () => [],
  fetchSuppliers: async () => [],
  fetchSupplierPrices: async () => [],
  updateDrink: (...a) => updateDrink(...a),
  createSupplierInvoice: vi.fn(),
  aggiungiProdottiAFattura: vi.fn(),
  allegaDocumentoAFattura: vi.fn(),
}))

import PannelloChat from '../../src/components/PannelloChat.jsx'

const CREDITO = { ok: true, tipo: 'credito', credito_eur: 5, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null }
const turnoStrumento = (id, nome, input) => ({
  ok: true,
  tipo: 'chat',
  turno: { role: 'assistant', content: [{ type: 'tool_use', id, name: nome, input }], firma: 'x' },
  testo: null,
  strumenti_richiesti: [{ id, nome, input }],
  costo_eur: 0.001,
  credito_eur: 4.99,
})
const turnoTesto = (testo) => ({
  ok: true,
  tipo: 'chat',
  turno: { role: 'assistant', content: [{ type: 'text', text: testo }] },
  testo,
  strumenti_richiesti: [],
  costo_eur: 0.001,
  credito_eur: 4.99,
})

// La regia finta: il credito, poi i turni della chat in fila.
function regia(turni, altro = {}) {
  const chat = [...turni]
  chiamata.mockImplementation(async (dati) => {
    if (dati.tipo === 'credito') return altro.credito ?? CREDITO
    if (dati.tipo === 'descrizione') return altro.descrizione
    return chat.shift()
  })
}
const chiamateChat = () => chiamata.mock.calls.map((c) => c[0]).filter((d) => d.tipo === 'chat')

beforeEach(() => {
  chiamata.mockReset()
  updateDrink.mockClear()
})

const scrivi = async (user, testo) => {
  const campo = screen.getByLabelText('Messaggio per l’assistente')
  await waitFor(() => expect(campo).not.toBeDisabled())
  await user.type(campo, testo)
  await user.click(screen.getByRole('button', { name: 'Invia' }))
}

describe('l’assistente', () => {
  it('con l’AI ferma lo dice, e non si scrive', async () => {
    regia([], { credito: { ...CREDITO, attivo: false, motivo: 'credito', credito_eur: 0 } })
    render(<PannelloChat ruolo="admin" onChiudi={vi.fn()} />)
    expect(await screen.findByRole('status')).toHaveTextContent(/credito AI del locale è finito/)
    expect(screen.getByLabelText('Messaggio per l’assistente')).toBeDisabled()
  })

  it('uno strumento di lettura: l’app lo esegue, rimanda l’esito e mostra la risposta', async () => {
    const user = userEvent.setup()
    regia([turnoStrumento('t1', 'giacenza', { prodotto: 'gin' }), turnoTesto('Restano 1400 ml di Gin Tanqueray.')])
    render(<PannelloChat ruolo="bartender" onChiudi={vi.fn()} />)
    await scrivi(user, 'Quanto gin mi resta?')
    expect(await screen.findByText('Restano 1400 ml di Gin Tanqueray.')).toBeInTheDocument()
    const [primo, secondo] = chiamateChat()
    // Il bartender non ha la lettura delle fatture, che è dell'admin.
    expect(primo).toEqual({ tipo: 'chat', messaggi: [{ role: 'user', content: 'Quanto gin mi resta?' }], strumenti: ['giacenza', 'vendite', 'cerca_prodotti', 'proponi_descrizione'] })
    // Il turno del modello rientra intatto; l'esito in un turno di chi scrive.
    expect(secondo.messaggi[1]).toEqual(turnoStrumento('t1', 'giacenza', { prodotto: 'gin' }).turno)
    expect(secondo.messaggi[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' })
    expect(JSON.parse(secondo.messaggi[2].content[0].content).trovati[0]).toMatchObject({ nome: 'Gin Tanqueray', giacenza: 1400 })
    expect(screen.getByText(/Costo della conversazione/)).toBeInTheDocument()
  })

  it('una descrizione proposta si usa a schermo, e solo allora il giro riparte', async () => {
    const user = userEvent.setup()
    regia([turnoStrumento('t1', 'proponi_descrizione', { prodotto: 'negroni' }), turnoTesto('Fatto.')], {
      descrizione: { ok: true, tipo: 'descrizione', risultato: { descrizione: 'Amaro e rosso.', da_verificare: [] }, costo_eur: 0.002 },
    })
    render(<PannelloChat ruolo="admin" onChiudi={vi.fn()} />)
    await scrivi(user, 'Scrivi la descrizione del Negroni')
    await user.click(await screen.findByRole('button', { name: 'Usa questa' }))
    expect(updateDrink).toHaveBeenCalledWith('d1', { description: 'Amaro e rosso.' })
    expect(await screen.findByText('Fatto.')).toBeInTheDocument()
    const esito = JSON.parse(chiamateChat()[1].messaggi[2].content[0].content)
    expect(esito).toEqual({ prodotto: 'Negroni', descrizione: 'Amaro e rosso.', stato: 'usata' })
  })

  // Istruzioni e strumenti della regia hanno una versione: se quella della
  // conversazione non c'è più, si riparte da capo e lo si dice.
  it('409 «versione»: si riparte da capo, e lo dice', async () => {
    const user = userEvent.setup()
    regia([{ ok: false, codice: 'versione' }])
    render(<PannelloChat ruolo="admin" onChiudi={vi.fn()} />)
    await scrivi(user, 'Ciao')
    expect(await screen.findByText(/conversazione riparte da capo/)).toBeInTheDocument()
    expect(screen.queryByText('Ciao')).toBeNull()
  })
})
