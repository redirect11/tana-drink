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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
// La porta delle funzioni del locale (src/porte/funzioni.js), finta.
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
let leggero = false
vi.mock('../../src/lib/limiti.js', () => ({ senzaFunctions: () => leggero }))

import DescrizioneAI from '../../src/components/DescrizioneAI.jsx'
import { chiediAI } from '../../src/lib/aiApi.js'

beforeEach(() => {
  chiamata.mockReset()
  leggero = false
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
  it('senza credito lo dice, e la scheda resta com’è', async () => {
    chiamata.mockResolvedValue({ ok: false, codice: 'credito' })
    const onUsa = mostra()
    await chiedi()
    expect(await screen.findByRole('status')).toHaveTextContent('Il credito AI del locale è finito')
    expect(onUsa).not.toHaveBeenCalled()
  })

  it('la rete che non risponde diventa «si può riprovare»', async () => {
    chiamata.mockRejectedValue(Object.assign(new Error('rete'), { code: 'functions/unavailable' }))
    mostra()
    await chiedi()
    expect(await screen.findByRole('status')).toHaveTextContent('Si può riprovare')
  })

  // Sul piano Free le Functions non ci sono: il tasto non compare, invece di
  // promettere una cosa che non arriva.
  it('sul profilo leggero il tasto non c’è', () => {
    leggero = true
    mostra()
    expect(screen.queryByRole('button', { name: 'Proponi una descrizione con l’AI' })).toBeNull()
  })

  it('il permesso negato diventa «non attiva», senza chiamare a vuoto sul leggero', async () => {
    chiamata.mockRejectedValue({ code: 'functions/permission-denied' })
    expect(await chiediAI({ tipo: 'descrizione', nome: 'X' })).toEqual({ ok: false, codice: 'spento' })
    leggero = true
    chiamata.mockClear()
    expect(await chiediAI({ tipo: 'descrizione', nome: 'X' })).toEqual({ ok: false, codice: 'spento' })
    expect(chiamata).not.toHaveBeenCalled()
  })
})
