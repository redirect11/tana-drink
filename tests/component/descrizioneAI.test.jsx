// @vitest-environment happy-dom
'use strict'

// LA DESCRIZIONE PROPOSTA DALL'AI NELLA SCHEDA DEL PRODOTTO (REQ-AI-003).
// La prima cosa che il gestionale chiede al cassetto AI della regia: la
// regia ha la sua parte pubblicata sul test, e le descrizioni sono la prova
// che il collegamento funziona. Una proposta non si salva da sola: si usa o
// si scarta. Senza credito, o con l'AI spenta, si ferma solo l'AI.
//
// La chiamata alla Function è finta: la logica della Function e del
// contratto con la regia la prova tests/bdd/richiesta-ai.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
// La porta delle funzioni del locale (src/porte/funzioni.js), finta.
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
let leggero = false
let conAI = true
vi.mock('../../src/lib/limiti.js', async (originale) => ({
  ...(await originale()),
  senzaFunctions: () => leggero,
  aiNelPiano: () => conAI,
}))

import DescrizioneAI from '../../src/components/DescrizioneAI.jsx'
import { chiediAI } from '../../src/lib/aiApi.js'
import { _azzeraStatoAI } from '../../src/lib/statoAI.js'

beforeEach(() => {
  chiamata.mockReset()
  leggero = false
  conAI = true
  // Lo stato dell'AI (REQ-AI-007) vive nel modulo: ogni prova riparte da capo.
  _azzeraStatoAI()
})

const mostra = (props = {}) => {
  const onUsa = vi.fn()
  render(<DescrizioneAI nome="Gin Fizz" categoria="Cocktail" attuale="" onUsa={onUsa} {...props} />)
  return onUsa
}
const chiedi = () => userEvent.setup().click(screen.getByRole('button', { name: 'Proponi una descrizione con l’AI' }))

describe('la proposta', () => {
  it('chiede una descrizione col nome e la categoria del prodotto', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'descrizione', risultato: { descrizione: 'Gin, limone e soda.', da_verificare: [] }, costo_eur: 0.01, credito_eur: 4.99 })
    mostra()
    await chiedi()
    expect(chiamata).toHaveBeenCalledWith({ tipo: 'descrizione', nome: 'Gin Fizz', categoria: 'Cocktail' })
    expect(await screen.findByText('Gin, limone e soda.')).toBeInTheDocument()
    expect(screen.getByText(/credito rimasto/)).toBeInTheDocument()
  })

  // Una descrizione costa qualche millesimo: «0,00 €» sarebbe falso.
  it('il costo si legge coi millesimi', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'descrizione', risultato: { descrizione: 'Gin, limone e soda.', da_verificare: [] }, costo_eur: 0.003, credito_eur: 4.997 })
    mostra()
    await chiedi()
    expect(await screen.findByText(/Costo 0,003 € · credito rimasto 4,997 €/)).toBeInTheDocument()
  })

  // Una proposta vuota svuoterebbe il campo con «Usa questa».
  it('una proposta vuota non si propone', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'descrizione', risultato: { descrizione: '  ', da_verificare: 'non è un elenco' } })
    const onUsa = mostra()
    await chiedi()
    expect(await screen.findByRole('status')).toHaveTextContent('non ha dato una risposta utilizzabile')
    expect(screen.queryByRole('button', { name: 'Usa questa' })).toBeNull()
    expect(onUsa).not.toHaveBeenCalled()
  })

  // Il risultato non usabile si paga lo stesso: lo si dice.
  it('quando il risultato non serve, il costo pagato si vede', async () => {
    chiamata.mockResolvedValue({ ok: false, codice: 'non-usabile', costo_eur: 0.02, credito_eur: 3 })
    mostra()
    await chiedi()
    expect(await screen.findByRole('status')).toHaveTextContent('Costo 0,02 €')
  })

  it('con un nome di una lettera non si può chiedere', () => {
    mostra({ nome: 'G' })
    expect(screen.getByRole('button', { name: 'Proponi una descrizione con l’AI' })).toBeDisabled()
  })

  it('«Usa questa» la mette nel campo; niente si salva da solo', async () => {
    chiamata.mockResolvedValue({ ok: true, risultato: { descrizione: 'Gin, limone e soda.', da_verificare: [] } })
    const onUsa = mostra()
    await chiedi()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Usa questa' }))
    expect(onUsa).toHaveBeenCalledWith('Gin, limone e soda.')
  })

  it('«Scarta» la toglie e lascia il campo com’era', async () => {
    chiamata.mockResolvedValue({ ok: true, risultato: { descrizione: 'Gin, limone e soda.', da_verificare: [] } })
    const onUsa = mostra()
    await chiedi()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Scarta' }))
    expect(onUsa).not.toHaveBeenCalled()
    expect(screen.queryByText('Gin, limone e soda.')).toBeNull()
  })

  // In carta un dato sbagliato è un allergene sbagliato: quello che il
  // modello non sa si vede.
  it('quello che il modello non ha potuto sapere si mostra da verificare', async () => {
    chiamata.mockResolvedValue({ ok: true, risultato: { descrizione: 'Con un gin di casa.', da_verificare: ['marca del gin'] } })
    mostra()
    await chiedi()
    expect(await screen.findByText('Da verificare: marca del gin')).toBeInTheDocument()
  })

  it('senza il nome del prodotto non si può chiedere', () => {
    mostra({ nome: '  ' })
    expect(screen.getByRole('button', { name: 'Proponi una descrizione con l’AI' })).toBeDisabled()
  })
})

describe('quando l’AI si ferma', () => {
  // Il credito che finisce PROPRIO con questa richiesta: lo si dice lì.
  it('senza credito lo dice, e la scheda resta com’è', async () => {
    chiamata.mockImplementation(async (dati) =>
      dati.tipo === 'credito'
        ? { ok: true, tipo: 'credito', credito_eur: 0.001, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null }
        : { ok: false, codice: 'credito' }
    )
    const onUsa = mostra()
    await chiedi()
    expect(await screen.findByRole('status')).toHaveTextContent('Il credito AI del locale è finito')
    expect(onUsa).not.toHaveBeenCalled()
  })

  // REQ-AI-007: già finito all'apertura, il tasto è grigio con l'avviso e
  // non parte nessuna richiesta (ricorda di ricaricare).
  it('col credito già finito il tasto è grigio, e non chiede niente', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'credito', credito_eur: 0, tetto_mensile_eur: 20, speso_mese_eur: 20, attivo: false, motivo: 'credito' })
    mostra()
    const tasto = await screen.findByRole('button', { name: /Proponi una descrizione con l’AI/ })
    await waitFor(() => expect(tasto).toHaveClass('senza-credito'))
    await userEvent.setup().click(tasto)
    expect(chiamata.mock.calls.map((c) => c[0].tipo)).toEqual(['credito'])
  })

  it('la rete che non risponde diventa «si può riprovare»', async () => {
    chiamata.mockRejectedValue(Object.assign(new Error('rete'), { code: 'functions/unavailable' }))
    mostra()
    await chiedi()
    expect(await screen.findByRole('status')).toHaveTextContent('Si può riprovare')
  })

  // REQ-LIC-017: il Free non ha l'AI (`ai: false` nella licenza). Il blocco
  // vero è nella regia; qui il tasto non c'è.
  it('nel piano senza AI il tasto non c’è', () => {
    conAI = false
    mostra()
    expect(screen.queryByRole('button', { name: 'Proponi una descrizione con l’AI' })).toBeNull()
  })

  // Sul piano Free le Functions non ci sono: il tasto non compare, invece di
  // promettere una cosa che non arriva.
  it('sul profilo leggero il tasto non c’è', () => {
    leggero = true
    mostra()
    expect(screen.queryByRole('button', { name: 'Proponi una descrizione con l’AI' })).toBeNull()
  })

  // A chi non ha il ruolo non si dice che l'AI è spenta: si dice chi la usa.
  it('il permesso negato dice chi usa l’AI, e sul leggero non si chiama a vuoto', async () => {
    chiamata.mockRejectedValue({ code: 'functions/permission-denied' })
    expect(await chiediAI({ tipo: 'descrizione', nome: 'X' })).toEqual({ ok: false, codice: 'permesso' })
    leggero = true
    chiamata.mockClear()
    expect(await chiediAI({ tipo: 'descrizione', nome: 'X' })).toEqual({ ok: false, codice: 'spento' })
    expect(chiamata).not.toHaveBeenCalled()
  })
})

describe('senza rete', () => {
  it('non si chiama la Function: si dice che serve la rete', async () => {
    const vero = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      expect(await chiediAI({ tipo: 'descrizione', nome: 'Negroni' })).toEqual({ ok: false, codice: 'senza-rete' })
      expect(chiamata).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: vero, configurable: true })
    }
  })
})
