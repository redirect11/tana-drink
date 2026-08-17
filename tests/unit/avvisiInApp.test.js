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
  scegliStileAvvisi,
  subscribeStileAvvisi,
  annunciaFumetto,
  ascoltaFumetto,
} from '../../src/lib/avvisiInApp.js'

beforeEach(() => localStorage.clear())

describe('lo stile degli avvisi in app', () => {
  it('di suo è la strisciolina: è come ha sempre funzionato', () => {
    expect(stileAvvisiInApp()).toBe('toast')
  })

  it('si sceglie il fumetto, e resta scelto su questo dispositivo', () => {
    expect(scegliStileAvvisi('fumetto')).toBe('fumetto')
    expect(stileAvvisiInApp()).toBe('fumetto')
  })

  it('un valore che non conosciamo non spegne gli avvisi', () => {
    // Meglio la strisciolina di un avviso che non compare da nessuna parte.
    expect(scegliStileAvvisi('boh')).toBe('toast')
    expect(stileAvvisiInApp()).toBe('toast')
  })

  it('chi guarda il pannello vede il cambio all’istante', () => {
    const visto = vi.fn()
    const stop = subscribeStileAvvisi(visto)
    expect(visto).toHaveBeenCalledWith('toast')
    scegliStileAvvisi('fumetto')
    expect(visto).toHaveBeenCalledWith('fumetto')
    stop()
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
