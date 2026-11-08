// @vitest-environment happy-dom
'use strict'

// ── GLI AIUTI SOTTO I CAMPI, DA ACCENDERE O NO (REQ-UI-032) ─────────────
//
// Richiesta dell'08/11/2026: «rimuovere gli aiuti sopra tutti i campi
// compilabili o almeno permettere di abilitarli/disabilitarli ma
// sicuramente correggere la sintassi». In una scheda lunga la riga d'aiuto
// di un campo finisce sopra l'etichetta del successivo. Di partenza sono
// nascosti; si riaccendono da Impostazioni → Aspetto, per tutto il locale.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import AiutoCampo from '../../src/components/AiutoCampo.jsx'
import ThemeSettings from '../../src/components/ThemeSettings.jsx'
import { AiutiCampi, aiutiCampiAccesi } from '../../src/lib/aiutiCampi.js'

const conAiuti = (valore, nodo) => render(<AiutiCampi.Provider value={valore}>{nodo}</AiutiCampi.Provider>)

describe('la riga d’aiuto di un campo', () => {
  it('accesi: si legge', () => {
    conAiuti(true, <AiutoCampo>Testo mostrato al cliente nel menù.</AiutoCampo>)
    expect(screen.getByText('Testo mostrato al cliente nel menù.')).toHaveClass('aiuto-campo')
  })

  it('spenti: non c’è', () => {
    conAiuti(false, <AiutoCampo>Testo mostrato al cliente nel menù.</AiutoCampo>)
    expect(screen.queryByText('Testo mostrato al cliente nel menù.')).toBeNull()
  })

  it('di partenza, per il locale, sono spenti: si accendono solo per scelta', () => {
    expect(aiutiCampiAccesi({})).toBe(false)
    expect(aiutiCampiAccesi(undefined)).toBe(false)
    expect(aiutiCampiAccesi({ aiuti_campi: true })).toBe(true)
  })
})

describe('in Impostazioni → Aspetto', () => {
  const tasto = (nome) => within(screen.getByRole('group', { name: 'Aiuti sotto i campi' })).getByRole('button', { name: nome })

  it('si sceglie fra «Nascosti» e «Visibili», e la scelta va nelle impostazioni del locale', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ThemeSettings settings={{ theme_staff: { preset: 'tana-scuro' } }} onSave={onSave} />)
    expect(tasto('Nascosti')).toHaveAttribute('aria-pressed', 'true')
    await user.click(tasto('Visibili'))
    expect(onSave).toHaveBeenCalledWith({ aiuti_campi: true })
  })

  it('con gli aiuti accesi è «Visibili» a risultare scelto', () => {
    render(<ThemeSettings settings={{ theme_staff: { preset: 'tana-scuro' }, aiuti_campi: true }} onSave={vi.fn()} />)
    expect(tasto('Visibili')).toHaveAttribute('aria-pressed', 'true')
  })
})

// LA SINTASSI (la seconda metà della richiesta): frasi piane, impersonali,
// senza i giri di prima («Lasciala vuota e vale quella del locale … — una
// bottiglia intera non si rivende come un drink al banco»).
describe('i testi degli aiuti', () => {
  it('le frasi riscritte non tornano indietro', async () => {
    const { readFileSync } = await import('node:fs')
    const drink = readFileSync('src/components/DrinkForm.jsx', 'utf8')
    for (const vecchia of ['Lasciala vuota e vale quella del locale', 'Quello che legge il cliente sul menù', 'Lo legge chi sta al banco']) {
      expect(drink).not.toContain(vecchia)
    }
    const magazzino = readFileSync('src/components/InventoryManager.jsx', 'utf8')
    expect(magazzino).not.toContain('Scorta minima: al di sotto il prodotto')
  })
})
