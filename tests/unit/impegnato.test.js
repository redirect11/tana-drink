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

  // A DIRE LA PAROLA FINE È «PRONTO», non «servito»: lì il drink è fatto e
  // il magazzino l'ha già scalato. Un drink pronto sul banco, in attesa che
  // qualcuno lo porti, NON è più un ingrediente promesso.
  it('la comanda pronta e scaricata è già uscita dall’impegnato', () => {
    const pronta = conto({
      comande: [
        {
          id: 'c1',
          status: 'pronto',
          inventory_applied: true,
          items: [{ drink_id: 'negroni', qty: 2 }],
        },
      ],
    })
    expect(consumoImpegnato([pronta], drinks)).toEqual([])
  })

  // E QUELLA RIMESSA INDIETRO RESTA FUORI. Lo scarico è già stato applicato
  // e non si disfa: quegli ingredienti stanno nella giacenza, non fra i
  // promessi. Rimetterceli sarebbe contarli due volte.
  it('e ci resta anche se torna «in preparazione»: il metro è lo scarico, non lo stato', () => {
    const tornataIndietro = conto({
      comande: [
        {
          id: 'c1',
          status: 'in_preparazione',
          inventory_applied: true,
          items: [{ drink_id: 'negroni', qty: 2 }],
        },
      ],
    })
    expect(consumoImpegnato([tornataIndietro], drinks)).toEqual([])
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

// ── IL TOTALE NON DEVE BALLARE ────────────────────────────────────────
//
// Questo è il punto dove un errore si vede come un magazzino che salta.
// Giacenza e impegnato sono due metà della stessa cosa: quello che c'è
// sullo scaffale, meno quello che è già promesso ai tavoli. Passando a
// «pronto» il gin cambia metà — esce dai promessi ed entra nello scalato —
// ma QUELLO CHE TI RITROVI A FINE SERATA dev'essere lo stesso identico
// numero. Se si muove, o quel drink è stato contato due volte o è sparito
// per un istante: ed è la cifra su cui si decide se mandare qualcuno a
// prendere una bottiglia.
describe('giacenza − impegnato: il numero non cambia passando a «pronto»', () => {
  // 2 negroni = 60 ml di gin. La bottiglia è da 700 ml contata a pezzi,
  // quindi 60 ml valgono 60/700 di pezzo.
  const CONSUMO_PZ = 60 / 700
  const comanda = (over) => conto({
    comande: [{ id: 'c1', items: [{ drink_id: 'negroni', qty: 2 }], ...over }],
  })
  // Prima: la comanda è al banco, la giacenza è intera, i 60 ml promessi.
  const daFare = comanda({ status: 'in_preparazione', inventory_applied: false })
  // Un istante dopo: la comanda è pronta e il magazzino ha scalato.
  const pronta = comanda({ status: 'pronto', inventory_applied: true })
  const ginScalato = { ...gin, stock: gin.stock - CONSUMO_PZ }

  // Quello che ti ritrovi a fine serata: la giacenza meno il promesso.
  const aFineSerata = (ordini, articolo, items) =>
    articolo.stock -
    (impegnatoPerArticolo(ordini, drinks, items, { workflowOn: true })[articolo.id] || 0)

  it('prima: giacenza intera, 60 ml promessi', () => {
    expect(impegnatoPerArticolo([daFare], drinks, itemsById, { workflowOn: true }).gin).toBeCloseTo(
      CONSUMO_PZ,
      10
    )
    expect(aFineSerata([daFare], gin, itemsById)).toBeCloseTo(4 - CONSUMO_PZ, 10)
  })

  it('dopo: i 60 ml sono usciti dalla giacenza e non sono più promessi', () => {
    const items = { gin: ginScalato }
    // Niente doppio conto: scaricata, la comanda non impegna più.
    expect(impegnatoPerArticolo([pronta], drinks, items, { workflowOn: true }).gin).toBeUndefined()
    expect(aFineSerata([pronta], ginScalato, items)).toBeCloseTo(4 - CONSUMO_PZ, 10)
  })

  it('e sono lo stesso numero: il passaggio a «pronto» non lo muove', () => {
    expect(aFineSerata([daFare], gin, itemsById)).toBeCloseTo(
      aFineSerata([pronta], ginScalato, { gin: ginScalato }),
      10
    )
  })

  // E il ritorno indietro non lo rimette in ballo: lo scarico è già stato
  // applicato, la comanda resta fuori dall'impegnato.
  it('e nemmeno il ritorno a «in preparazione»', () => {
    const indietro = comanda({ status: 'in_preparazione', inventory_applied: true })
    expect(aFineSerata([indietro], ginScalato, { gin: ginScalato })).toBeCloseTo(
      4 - CONSUMO_PZ,
      10
    )
  })

  it('la colonna «a fine serata» dice la stessa cosa', () => {
    expect(previstoAFineSerata(gin, CONSUMO_PZ)).toBeCloseTo(4 - CONSUMO_PZ, 10)
    expect(articoloPrevisto(gin, CONSUMO_PZ).stock).toBeCloseTo(ginScalato.stock, 10)
    // Scaricata non c'è più niente di promesso, e la colonna si spegne: il
    // numero da leggere è la giacenza, che vale già lo stesso.
    expect(previstoAFineSerata(ginScalato, 0)).toBeNull()
  })
})
