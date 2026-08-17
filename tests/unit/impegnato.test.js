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

  it('NON quelli chiusi: il loro scarico l’ha già fatto la riscossione', () => {
    // Era il numero che non tornava: con un conto solo sul tavolo il
    // magazzino segnava mezzo listino in esaurimento, perché contava anche
    // i conti incassati e serviti della serata.
    const chiuso = conto({
      payment_status: 'pagato',
      comande: [{ id: 'c1', status: 'ritirato', items: [{ drink_id: 'negroni', qty: 2 }] }],
    })
    expect(contoImpegna(chiuso, { workflowOn: true })).toBe(false)
    expect(consumoImpegnato([chiuso], drinks, { workflowOn: true })).toEqual([])
  })

  it('senza stati del servizio, incassato vuol dire chiuso', () => {
    expect(contoImpegna(conto({ payment_status: 'pagato' }), { workflowOn: false })).toBe(false)
  })

  it('anche quelli già incassati, se il servizio non è finito', () => {
    // Con gli stati del servizio si paga anche in anticipo: un conto
    // pagato può avere ancora tre drink da fare, e quegli ingredienti sono
    // in ballo esattamente come prima. A dire la parola fine è la comanda
    // servita — che è anche il momento in cui il magazzino scala davvero,
    // e da lì la comanda smette da sola di contare.
    const pagatoDaServire = conto({ payment_status: 'pagato' })
    expect(contoImpegna(pagatoDaServire, { workflowOn: true })).toBe(true)
    expect(consumoImpegnato([pagatoDaServire], drinks, { workflowOn: true })).toHaveLength(1)
  })

  it('il conto servito e scaricato non impegna più niente', () => {
    const servito = conto({
      payment_status: 'pagato',
      comande: [
        { id: 'c1', status: 'ritirato', inventory_applied: true, items: [{ drink_id: 'negroni', qty: 2 }] },
      ],
    })
    expect(consumoImpegnato([servito], drinks)).toEqual([])
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
