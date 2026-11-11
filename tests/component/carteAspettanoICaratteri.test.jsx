// @vitest-environment happy-dom
'use strict'

// IL VENTAGLIO DEL MAZZO PARTE COI CARATTERI GIUSTI (BUG-141). L'utente,
// 11/11/2026: «le carte sfarfallano un po' quando si aprono a ventaglio
// quando si carica la pagina». Registrato il caricamento del menù a carte
// del test: le carte comparivano e partivano, e il loro carattere a
// macchina arrivava 100-400 ms dopo, a metà volo; la scritta cambiava
// larghezza e il titolo, cambiando carattere, spostava il mazzo. Ora il
// tavolo aspetta i caratteri dei testi animati (le animazioni restano ferme
// al loro inizio, a carte invisibili), ma non oltre un tetto.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from '../helpers/router.jsx'
import { caratteriDi, attendiCaratteri } from '../../src/lib/caratteriPronti.js'
import MenuCarte, { TestataCarte } from '../../src/components/MenuCarte.jsx'

const stile = (fontFamily, fontWeight = '400', fontStyle = 'normal') => ({ fontFamily, fontWeight, fontStyle })

describe('i caratteri da aspettare', () => {
  it('uno per famiglia, stile e peso, senza doppioni', () => {
    const els = ['a', 'b', 'c', 'd']
    const stili = {
      a: stile('"IM Fell English", Georgia'),
      b: stile('"IM Fell English", Georgia'),
      c: stile('"IM Fell English", Georgia', '400', 'italic'),
      d: stile('"Playfair Display"', '700'),
    }
    expect(caratteriDi(els, (el) => stili[el])).toEqual([
      'normal 400 16px "IM Fell English", Georgia',
      'italic 400 16px "IM Fell English", Georgia',
      'normal 700 16px "Playfair Display"',
    ])
  })

  it('senza elementi, o senza stile, niente', () => {
    expect(caratteriDi(null)).toEqual([])
    expect(caratteriDi(['x'], () => ({}))).toEqual([])
  })
})

describe('l’attesa', () => {
  afterEach(() => vi.useRealTimers())

  it('finisce quando i caratteri sono arrivati', async () => {
    let arriva
    const fonts = { check: () => false, load: vi.fn(() => new Promise((r) => (arriva = r))) }
    let finita = false
    const attesa = attendiCaratteri(fonts, ['normal 400 16px X'], 5000).then(() => (finita = true))
    await Promise.resolve()
    expect(finita).toBe(false)
    arriva()
    await attesa
    expect(finita).toBe(true)
  })

  it('caratteri già pronti: non si aspetta e non si chiede niente', async () => {
    const fonts = { check: () => true, load: vi.fn() }
    await attendiCaratteri(fonts, ['normal 400 16px X'])
    expect(fonts.load).not.toHaveBeenCalled()
  })

  // Con la rete lenta, o un carattere che non arriva mai, il mazzo parte
  // col carattere di riserva: meglio che non vederlo.
  it('non oltre il tetto, e un carattere che fallisce non ferma niente', async () => {
    vi.useFakeTimers()
    const maiPronto = { check: () => false, load: vi.fn(() => new Promise(() => {})) }
    const attesa = attendiCaratteri(maiPronto, ['normal 400 16px X'], 1500)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(attesa).resolves.toBeUndefined()
    vi.useRealTimers()

    const rotto = { check: () => { throw new Error('descrizione strana') }, load: vi.fn(() => Promise.reject(new Error('404'))) }
    await expect(attendiCaratteri(rotto, ['x'])).resolves.toBeUndefined()
    await expect(attendiCaratteri(null, ['x'])).resolves.toBeUndefined()
  })
})

describe('il mazzo nella pagina', () => {
  const SEZIONI = [
    { id: 's1', nome: 'Grandi classici', vista: 'piena', voci: [{ id: 'negroni', name: 'Negroni', price: 8 }] },
    { id: 's2', nome: 'Analcolici', vista: 'snella', voci: [{ id: 'acqua', name: 'Acqua', price: 1.5 }] },
  ]
  const monta = () =>
    render(
      <MemoryRouter>
        <TestataCarte venue={{ venue_name: 'Bar di prova' }} />
        <MenuCarte sezioni={SEZIONI} speciali={[]} immagine={() => null} apri={vi.fn()} tastiOrdine={() => null} />
      </MemoryRouter>
    )

  afterEach(() => {
    delete document.fonts
  })

  it('resta in attesa finché i caratteri non sono arrivati, poi parte', async () => {
    let arriva
    const load = vi.fn(() => new Promise((r) => (arriva = r)))
    Object.defineProperty(document, 'fonts', { value: { check: () => false, load }, configurable: true })
    const { container } = monta()
    const tavolo = container.querySelector('.k-tavolo')
    expect(tavolo).toHaveClass('k-aspetta')
    // Ha chiesto i caratteri dei testi che si muovono: il titolo e le carte.
    expect(load).toHaveBeenCalled()
    await act(async () => arriva())
    expect(tavolo).not.toHaveClass('k-aspetta')
  })

  it('senza `document.fonts` non si aspetta niente', () => {
    const { container } = monta()
    expect(container.querySelector('.k-tavolo')).not.toHaveClass('k-aspetta')
  })
})
