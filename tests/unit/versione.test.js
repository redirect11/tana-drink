'use strict'

// L'etichetta in fondo al menu: cosa deve leggere chi ha l'app davanti.
// In produzione una cosa sola — il numero di versione. Fuori, anche ramo e
// commit: sullo stesso indirizzo di test passano a turno develop e i
// branch in lavorazione.

import { describe, it, expect } from 'vitest'
import { etichettaVersione, inProduzione } from '../../src/lib/versione.js'

describe('etichetta della versione', () => {
  it('in produzione mostra SOLO la versione', () => {
    expect(etichettaVersione({ branch: 'main', commit: 'abc1234', versione: 'v1.1.0' })).toBe('v1.1.0')
  })

  it('su develop mostra versione, ramo e commit', () => {
    expect(etichettaVersione({ branch: 'develop', commit: 'abc1234', versione: 'v1.1.0' })).toBe(
      'v1.1.0 · develop · abc1234'
    )
  })

  it('su un branch di lavorazione idem, col nome del branch', () => {
    expect(
      etichettaVersione({ branch: 'feature/footer-pos', commit: 'def5678', versione: 'v1.1.0' })
    ).toBe('v1.1.0 · feature/footer-pos · def5678')
  })

  it('la "v" si mette da sé, che il tag ce l’abbia o no', () => {
    expect(etichettaVersione({ branch: 'main', versione: '2.0.1' })).toBe('v2.0.1')
    expect(etichettaVersione({ branch: 'main', versione: 'v2.0.1' })).toBe('v2.0.1')
  })

  it('senza versione (build senza tag) resta quello che c’è', () => {
    expect(etichettaVersione({ branch: 'develop', commit: 'abc1234' })).toBe('develop · abc1234')
    expect(etichettaVersione({ branch: 'main' })).toBe('')
  })

  it('senza niente non inventa un’etichetta', () => {
    expect(etichettaVersione()).toBe('')
    expect(etichettaVersione({})).toBe('')
  })

  it('sa dire se è produzione', () => {
    expect(inProduzione('main')).toBe(true)
    expect(inProduzione('develop')).toBe(false)
    expect(inProduzione('feature/x')).toBe(false)
  })
})

// IL RAMO NON RIPETE LA VERSIONE. Da quando si pubblica taggando, in CI il
// nome del ref è il TAG: dove ci si aspettava il ramo arrivava «v1.4.3», e
// in fondo al menu si leggeva la stessa cosa due volte.
describe('quando il ramo non si sa', () => {
  it('col nome del tag al posto del ramo, lo dice una volta sola', () => {
    expect(etichettaVersione({ branch: 'v1.4.3', commit: '11783f5', versione: '1.4.3' }))
      .toBe('v1.4.3 · 11783f5')
  })

  it('anche senza la v davanti', () => {
    expect(etichettaVersione({ branch: '1.4.3', commit: '11783f5', versione: '1.4.3' }))
      .toBe('v1.4.3 · 11783f5')
  })

  it('un ramo vero invece si legge', () => {
    expect(etichettaVersione({ branch: 'develop', commit: '11783f5', versione: '1.4.3' }))
      .toBe('v1.4.3 · develop · 11783f5')
  })
})
