'use strict'

// I PIANI E I PREZZI (REQ-FLOTTA-002): in un posto solo, e il conto del
// mese torna. I numeri sono da confermare con l'utente; qui si prova la
// regola, non la cifra.

import { describe, it, expect } from 'vitest'
import { PIANI, MODULI, prezzoMensile, moduliDellaScelta, TERMINALE_IN_PIU, euro } from '../src/lib/piani.js'

describe('prezzoMensile', () => {
  it('il base è il base; i moduli e i terminali in più si sommano', () => {
    expect(prezzoMensile()).toBe(PIANI.base.prezzo)
    const magazzino = MODULI.find((m) => m.id === 'magazzino')
    expect(prezzoMensile({ piano: 'base', moduli: ['magazzino'] })).toBe(PIANI.base.prezzo + magazzino.prezzo)
    expect(prezzoMensile({ piano: 'base', terminali: 2 })).toBe(PIANI.base.prezzo + TERMINALE_IN_PIU)
  })

  it('il completo include tutti i moduli e due terminali: chiederli di nuovo non costa', () => {
    expect(prezzoMensile({ piano: 'completo', moduli: MODULI.map((m) => m.id), terminali: 2 })).toBe(PIANI.completo.prezzo)
    expect(prezzoMensile({ piano: 'completo', terminali: 3 })).toBe(PIANI.completo.prezzo + TERMINALE_IN_PIU)
  })

  it('un piano sconosciuto o un modulo inventato non valgono niente', () => {
    expect(prezzoMensile({ piano: 'oro', moduli: ['teletrasporto'] })).toBe(PIANI.base.prezzo)
  })
})

describe('moduliDellaScelta', () => {
  it('è quello che la licenza dell’istanza accende', () => {
    expect(moduliDellaScelta({ piano: 'base', moduli: ['staff', 'staff', 'niente'] })).toEqual(['staff'])
    expect(moduliDellaScelta({ piano: 'completo' })).toEqual(MODULI.map((m) => m.id))
  })
})

describe('euro', () => {
  it('scrive gli importi all’italiana', () => {
    expect(euro(24)).toBe('24 €')
    expect(euro(1250)).toBe('1.250 €')
  })
})
