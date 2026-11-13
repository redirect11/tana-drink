// @vitest-environment happy-dom
'use strict'

// IL CREDITO AI IN IMPOSTAZIONI (REQ-AI-003, CreditoAI.jsx). Si legge dalla
// regia all'apertura, gratis: disponibile, speso nel mese e tetto. Quando
// l'AI è ferma si dice perché; quando il cassetto non c'è, lo si dice con
// le parole di sempre. La chiamata alla Function è finta: il contratto lo
// prova tests/bdd/richiesta-ai.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({ ...(await originale()), senzaFunctions: () => false }))

import CreditoAI from '../../src/components/CreditoAI.jsx'

beforeEach(() => chiamata.mockReset())

describe('il credito AI', () => {
  it('chiede il credito e mostra disponibile, speso e tetto', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'credito', credito_eur: 4.5, tetto_mensile_eur: 20, speso_mese_eur: 1.234, attivo: true, motivo: null })
    render(<CreditoAI />)
    expect(chiamata).toHaveBeenCalledWith({ tipo: 'credito' })
    expect(await screen.findByText('4,50 €')).toBeInTheDocument()
    expect(screen.getByText('Speso nel mese 1,234 € su un tetto di 20,00 €')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ferma per il tetto del mese, lo dice', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'credito', credito_eur: 3, tetto_mensile_eur: 10, speso_mese_eur: 10, attivo: false, motivo: 'tetto' })
    render(<CreditoAI />)
    expect(await screen.findByRole('status')).toHaveTextContent('Tetto di spesa del mese raggiunto')
  })

  it('senza cassetto lo dice con le parole di sempre', async () => {
    chiamata.mockResolvedValue({ ok: false, codice: 'senza-cassetto' })
    render(<CreditoAI />)
    expect(await screen.findByRole('status')).toHaveTextContent("L'AI non è attiva per questo locale.")
  })
})
