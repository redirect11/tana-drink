// @vitest-environment happy-dom
'use strict'

// DOVE COMPAIONO GLI AVVISI AD APP APERTA. La strisciolina in alto non si
// perde, ma interrompe chiunque — anche chi sta contando la cassa o
// caricando il magazzino. Il fumetto invece esce dalla campanella e sta
// solo nella coda: lì un avviso non interrompe niente, è il motivo per cui
// si sta guardando quella schermata. Lo sceglie il locale.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  stileAvvisiInApp,
  annunciaFumetto,
  ascoltaFumetto,
} from '../../src/lib/avvisiInApp.js'

beforeEach(() => localStorage.clear())

describe('lo stile degli avvisi in app', () => {
  it('di suo è la strisciolina: è come ha sempre funzionato', () => {
    expect(stileAvvisiInApp({})).toBe('toast')
    expect(stileAvvisiInApp()).toBe('toast')
  })

  it('il locale può scegliere il fumetto', () => {
    expect(stileAvvisiInApp({ avvisi_in_app: 'fumetto' })).toBe('fumetto')
  })

  it('un valore che non conosciamo non spegne gli avvisi', () => {
    // Meglio la strisciolina di un avviso che non compare da nessuna parte.
    expect(stileAvvisiInApp({ avvisi_in_app: 'boh' })).toBe('toast')
  })

  it('si legge dalle impostazioni ricordate, senza chiedere al server', () => {
    localStorage.setItem('tana:impostazioni', JSON.stringify({ avvisi_in_app: 'fumetto' }))
    expect(stileAvvisiInApp()).toBe('fumetto')
  })

  it('l’annuncio arriva a chi disegna il fumetto', () => {
    const visto = vi.fn()
    const stop = ascoltaFumetto(visto)
    annunciaFumetto({ title: 'Nuovo ordine #7', body: '2 prodotti' })
    expect(visto).toHaveBeenCalledWith({ title: 'Nuovo ordine #7', body: '2 prodotti' })
    stop()
    annunciaFumetto({ title: 'un altro' })
    expect(visto).toHaveBeenCalledTimes(1)
  })
})
