'use strict'

// QUELLO CHE TI RITROVI A FINE SERATA. A metà serata sui tavoli ci sono
// drink già fatti e conti non ancora chiusi: quel gin è promesso anche se
// il magazzino non l'ha ancora scalato. Chi guarda le scorte per decidere
// se mandare qualcuno a prendere una bottiglia deve vedere quello, non la
// giacenza di questo istante.

import { describe, it, expect } from 'vitest'
import {
  contoImpegna,
  consumoImpegnato,
  impegnatoPerArticolo,
  previstoAFineSerata,
  articoloPrevisto,
} from '../../src/lib/impegnato.js'

const drinks = {
  negroni: { recipe_items: [{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 30 }] },
}
// Bottiglia da 70 cl contata a pezzi: 4 bottiglie in giacenza.
const gin = { id: 'gin', unit: 'pz', stock: 4, package_size: 700, content_unit: 'ml' }
const itemsById = { gin }

const conto = (over = {}) => ({
  status: 'aperto',
  payment_status: 'non_richiesto',
  comande: [{ id: 'c1', status: 'ricevuto', items: [{ drink_id: 'negroni', qty: 2 }] }],
  ...over,
})

describe('quali conti impegnano le scorte', () => {
  it('quelli ancora aperti', () => {
    expect(contoImpegna(conto())).toBe(true)
  })

  it('non quelli incassati: lì gli ingredienti li ha già scalati il pagamento', () => {
    expect(contoImpegna(conto({ payment_status: 'pagato' }))).toBe(false)
    expect(contoImpegna(conto({ status: 'pagato' }))).toBe(false)
  })

  it('non quelli annullati', () => {
    expect(contoImpegna(conto({ status: 'annullato' }))).toBe(false)
  })
})

describe('quanto è impegnato', () => {
  it('gli ingredienti dei conti aperti, appena l’item entra nel conto', () => {
    const cons = consumoImpegnato([conto()], drinks)
    expect(cons).toEqual([
      { inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 60 },
    ])
  })

  it('NON quello che il magazzino ha già scalato', () => {
    // La comanda presa in carico ha già fatto scendere la giacenza:
    // contarla di nuovo vorrebbe dire togliere due volte lo stesso drink.
    const scaricata = conto({
      comande: [
        { id: 'c1', status: 'ritirato', inventory_applied: true, items: [{ drink_id: 'negroni', qty: 2 }] },
      ],
    })
    expect(consumoImpegnato([scaricata], drinks)).toEqual([])
  })

  it('niente dalle comande annullate', () => {
    const buttata = conto({
      comande: [{ id: 'c1', status: 'annullato', items: [{ drink_id: 'negroni', qty: 2 }] }],
    })
    expect(consumoImpegnato([buttata], drinks)).toEqual([])
  })

  it('somma i conti aperti fra loro', () => {
    const [c] = consumoImpegnato([conto(), conto()], drinks)
    expect(c.qty).toBe(120)
  })
})

describe('dalla ricetta allo scaffale', () => {
  it('60 ml di gin sono poco meno di un decimo di bottiglia', () => {
    const imp = impegnatoPerArticolo([conto()], drinks, itemsById)
    expect(imp.gin).toBeCloseTo(60 / 700, 5)
  })

  it('la previsione toglie l’impegnato dalla giacenza', () => {
    const imp = impegnatoPerArticolo([conto()], drinks, itemsById)
    expect(previstoAFineSerata(gin, imp.gin)).toBeCloseTo(4 - 60 / 700, 5)
  })

  it('senza conti aperti la colonna resta vuota', () => {
    // Tutti i conti chiusi: non c'è niente di incerto da mostrare, e
    // ripetere la giacenza accanto a se stessa confonde e basta.
    expect(previstoAFineSerata(gin, 0)).toBe(null)
    expect(articoloPrevisto(gin, 0)).toBe(null)
  })

  it('l’articolo previsto si legge con le stesse regole della giacenza', () => {
    const prev = articoloPrevisto(gin, 1)
    expect(prev.stock).toBe(3)
    expect(prev.package_size).toBe(700)
  })

  it('un ingrediente che non è in magazzino non fa saltare il conto', () => {
    expect(impegnatoPerArticolo([conto()], drinks, {})).toEqual({})
  })
})
