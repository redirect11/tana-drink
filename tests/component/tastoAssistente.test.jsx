// @vitest-environment happy-dom
'use strict'

// L'AI NELL'APP HA TRE STATI (REQ-AI-007, src/lib/statoAI.js,
// TastoAssistente.jsx). Daniele, 13/11/2026: con l'AI disattivata dalla
// regia «è come se non ci fosse»; senza credito il tasto dell'assistente è
// grigio con l'avviso, e toccandolo ricorda di ricaricare; attiva apre il
// pannello. Lo stato viene dal credito, chiesto all'avvio, e si aggiorna da
// ogni risposta dell'AI.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
let conAI = true
vi.mock('../../src/lib/limiti.js', async (originale) => ({
  ...(await originale()),
  senzaFunctions: () => false,
  aiNelPiano: () => conAI,
}))
const showToast = vi.fn()
vi.mock('../../src/lib/toast.js', () => ({ showToast: (...a) => showToast(...a), toastError: vi.fn(), toastSuccess: vi.fn() }))

import TastoAssistente from '../../src/components/TastoAssistente.jsx'
import { statoDaCredito, statoDaRisposta, statoAI, STATI_AI, _azzeraStatoAI } from '../../src/lib/statoAI.js'
import { chiediAI } from '../../src/lib/aiApi.js'

const CREDITO = { ok: true, tipo: 'credito', credito_eur: 5, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null }

beforeEach(() => {
  chiamata.mockReset()
  showToast.mockReset()
  conAI = true
  _azzeraStatoAI()
})

describe('lo stato dell’AI', () => {
  it('dal credito: attiva, senza credito, assente', () => {
    expect(statoDaCredito(CREDITO)).toEqual({ stato: STATI_AI.ATTIVA })
    expect(statoDaCredito({ ...CREDITO, attivo: false, motivo: 'tetto' })).toEqual({ stato: STATI_AI.SENZA_CREDITO, motivo: 'tetto' })
    for (const codice of ['senza-cassetto', 'spento', 'piano']) expect(statoDaCredito({ ok: false, codice })).toEqual({ stato: STATI_AI.ASSENTE })
    // La rete che non risponde non nasconde niente.
    expect(statoDaCredito({ ok: false, codice: 'riprova' })).toEqual({ stato: STATI_AI.IGNOTO })
  })

  it('una risposta qualunque lo aggiorna solo quando è chiara', () => {
    expect(statoDaRisposta({ ok: true, tipo: 'descrizione' })).toEqual({ stato: STATI_AI.ATTIVA })
    expect(statoDaRisposta({ ok: false, codice: 'credito' })).toEqual({ stato: STATI_AI.SENZA_CREDITO, motivo: 'credito' })
    expect(statoDaRisposta({ ok: false, codice: 'riprova' })).toBeNull()
  })

  // Chi esaurisce il credito con l'ultima richiesta vede il tasto spegnersi
  // subito, senza aspettare il prossimo controllo.
  it('un 402 «credito» su una richiesta lo porta a senza credito', async () => {
    chiamata.mockResolvedValue({ ok: false, codice: 'credito', credito_eur: 0 })
    await chiediAI({ tipo: 'descrizione', nome: 'Negroni' })
    expect(statoAI()).toEqual({ stato: STATI_AI.SENZA_CREDITO, motivo: 'credito' })
  })
})

describe('il tasto dell’assistente', () => {
  it('attiva: apre il pannello', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue(CREDITO)
    const onAlterna = vi.fn()
    render(<TastoAssistente aperto={false} onAlterna={onAlterna} />)
    await user.click(await screen.findByRole('button', { name: 'Assistente AI' }))
    expect(onAlterna).toHaveBeenCalled()
  })

  it('senza credito: grigio con l’avviso, e toccandolo ricorda di ricaricare', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue({ ...CREDITO, attivo: false, motivo: 'credito', credito_eur: 0 })
    const onAlterna = vi.fn()
    render(<TastoAssistente aperto={false} onAlterna={onAlterna} />)
    const tasto = await screen.findByRole('button', { name: 'Assistente AI: credito da ricaricare' })
    expect(tasto).toHaveClass('senza-credito')
    await user.click(tasto)
    expect(onAlterna).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/credito AI del locale è finito/), { kind: 'error' })
  })

  it('l’AI disattivata dalla regia: il tasto non c’è', async () => {
    chiamata.mockResolvedValue({ ok: false, codice: 'spento' })
    render(<TastoAssistente aperto={false} onAlterna={vi.fn()} />)
    await act(async () => {})
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('senza l’AI nella licenza non si chiede nemmeno il credito', async () => {
    conAI = false
    render(<TastoAssistente aperto={false} onAlterna={vi.fn()} />)
    await act(async () => {})
    expect(chiamata).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
