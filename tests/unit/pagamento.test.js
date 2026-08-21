'use strict'

// Unit test della logica pura del pagamento del conto (split, sconto,
// residuo) — src/lib/pagamento.js

import { describe, it, expect } from 'vitest'
import {
  discountAmount,
  paidAmount,
  orderDue,
  isFullyPaid,
  remainingItems,
  selectionAmount,
  paymentCloses,
  summaryMethod,
  discountAfterChange,
  scontoEccessivo,
  dettaglioIncassi,
  scontiConsumati,
  scontoConsumato,
  scontoTotale,
  lordoResiduo,
  lordoSelezione,
  scontiDelConto,
  etichettaSconto,
  orderTotal,
  unitaDaConteggio,
  conteggioDaUnita,
  toccaUnita,
  selezioneVergine,
  selezioneDopoTocco,
} from '../../src/lib/pagamento.js'

const order = (over = {}) => ({
  total: 22,
  discount_amount: 0,
  payments: [],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'ritirato',
      items: [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 },
      ],
    },
  ],
  ...over,
})

describe('discountAmount', () => {
  it('percentuale e importo fisso, arrotondati ai centesimi', () => {
    expect(discountAmount(22, { type: 'percent', value: 10 })).toBe(2.2)
    expect(discountAmount(22, { type: 'euro', value: 5 })).toBe(5)
    expect(discountAmount(9.99, { type: 'percent', value: 33 })).toBe(3.3)
  })
  it('clamp: mai oltre il totale né oltre il 100%', () => {
    expect(discountAmount(22, { type: 'euro', value: 50 })).toBe(22)
    expect(discountAmount(22, { type: 'percent', value: 150 })).toBe(22)
  })
  it('zero senza sconto o con valori non validi', () => {
    expect(discountAmount(22, null)).toBe(0)
    expect(discountAmount(22, { type: 'percent', value: 0 })).toBe(0)
    expect(discountAmount(0, { type: 'percent', value: 10 })).toBe(0)
  })
})

describe('orderDue / paidAmount / isFullyPaid / paymentCloses', () => {
  it('residuo = totale − sconto − pagato', () => {
    const o = order({
      discount_amount: 2,
      payments: [{ id: 'p1', amount: 10, method: 'banco' }],
    })
    expect(paidAmount(o)).toBe(10)
    expect(orderDue(o)).toBe(10)
    expect(isFullyPaid(o)).toBe(false)
    expect(paymentCloses(o, 10)).toBe(true)
    expect(paymentCloses(o, 9.5)).toBe(false)
  })
  it('mai negativo e tollerante al mezzo centesimo', () => {
    const o = order({ payments: [{ id: 'p1', amount: 22.004, method: 'banco' }] })
    expect(orderDue(o)).toBe(0)
    expect(isFullyPaid(o)).toBe(true)
  })
})

describe('remainingItems: aggregato meno quantità già pagate', () => {
  it('scala le quantità pagate per drink_id', () => {
    const o = order({
      payments: [
        {
          id: 'p1',
          amount: 7,
          method: 'banco',
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
        },
      ],
    })
    const rem = remainingItems(o)
    expect(rem.find((i) => i.drink_id === 'mojito').qty).toBe(1)
    expect(rem.find((i) => i.drink_id === 'gin').qty).toBe(1)
  })
  it('un pagamento senza items non tocca la lista articoli', () => {
    const o = order({ payments: [{ id: 'p1', amount: 5, method: 'banco', items: null }] })
    expect(remainingItems(o).find((i) => i.drink_id === 'mojito').qty).toBe(2)
  })
})

describe('selectionAmount: lo sconto cade sulle righe che si stanno riscuotendo', () => {
  it('selezione vuota = tutto il residuo', () => {
    expect(selectionAmount(order(), [])).toBe(22)
  })
  it('selezione parziale ai prezzi di listino (senza sconto)', () => {
    const amount = selectionAmount(order(), [
      { drink_id: 'mojito', unit_price: 7, qty: 1 },
    ])
    expect(amount).toBe(7)
  })
  // ERA UNA RIPARTIZIONE, ADESSO NO. Prima lo sconto era uno solo, sul conto
  // intero, e chi pagava la sua parte se ne portava via una quota in
  // proporzione: 2,20 € su 22 diventavano 0,80 € sugli 8 € del Gin Tonic.
  // «Lo sconto va applicato solo sui prodotti che sto riscuotendo» (l'utente,
  // 20/08/2026): quei 2,20 € sono stati decisi su QUESTE righe, quindi cadono
  // per intero su queste righe. Chi offre due birre sconta quelle due birre,
  // non una fetta di tutto il tavolo.
  it('lo sconto preparato cade tutto sulla selezione, non in proporzione', () => {
    const o = order({
      discount: { type: 'euro', value: 2.2 },
      discount_amount: 2.2,
      discount_items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
    })
    const amount = selectionAmount(o, [{ drink_id: 'gin', unit_price: 8, qty: 1 }])
    expect(amount).toBe(5.8) // 8 − 2,20, non 8 − 0,80
  })
  it('selezione che copre tutto il residuo → residuo esatto (niente derive)', () => {
    const o = order({ discount_amount: 2.2 })
    const amount = selectionAmount(o, [
      { drink_id: 'mojito', unit_price: 7, qty: 2 },
      { drink_id: 'gin', unit_price: 8, qty: 1 },
    ])
    expect(amount).toBe(orderDue(o))
  })
  it('include coperto/servizio quando la selezione copre tutti gli articoli', () => {
    // totale 25 = 22 articoli + 3 coperto: pagando tutti gli articoli si
    // incassa il residuo intero, coperto compreso.
    const o = order({ total: 25 })
    const amount = selectionAmount(o, [
      { drink_id: 'mojito', unit_price: 7, qty: 2 },
      { drink_id: 'gin', unit_price: 8, qty: 1 },
    ])
    expect(amount).toBe(25)
  })
})

describe('summaryMethod', () => {
  it('unico metodo → quello; metodi diversi → misto', () => {
    expect(summaryMethod([{ method: 'banco' }])).toBe('banco')
    expect(summaryMethod([{ method: 'banco' }, { method: 'lettore' }])).toBe('misto')
    expect(summaryMethod([])).toBeNull()
  })
})

// Lo sconto in euro è deciso su un certo conto: se poi si tolgono righe,
// quell'importo va riletto. Tre strategie, scelte in Impostazioni, perché
// rispondono a tre modi legittimi di intendere lo sconto.
describe('sconto quando cambiano le righe del conto', () => {
  const euro5 = { type: 'euro', value: 5 }
  const cambio = (newTotal, policy) =>
    discountAfterChange(
      { discount: euro5, prevAmount: 5, prevTotal: 20, newTotal },
      policy
    )

  it('tetto: finché ci sta dentro lo sconto non si tocca', () => {
    expect(cambio(12, 'tetto')).toBe(5)
  })

  it('tetto: se il conto scende sotto, lo sconto si accorcia al totale', () => {
    expect(cambio(2, 'tetto')).toBe(2) // conto offerto, mai negativo
    expect(cambio(0, 'tetto')).toBe(0)
  })

  it('è il default: senza strategia indicata vale il tetto', () => {
    expect(cambio(2)).toBe(2)
  })

  it('proporzione: lo sconto resta la stessa quota del conto', () => {
    expect(cambio(12, 'proporzione')).toBe(3) // 25% di 12
    expect(cambio(40, 'proporzione')).toBe(10) // cresce se il conto cresce
  })

  it('avviso: non si tocca niente, anche se supera il totale', () => {
    expect(cambio(2, 'avviso')).toBe(5)
    expect(scontoEccessivo({ total: 2, discount_amount: 5 })).toBe(true)
    expect(scontoEccessivo({ total: 12, discount_amount: 5 })).toBe(false)
  })

  it('la percentuale segue sempre il conto, con qualsiasi strategia', () => {
    for (const p of ['tetto', 'proporzione', 'avviso']) {
      expect(
        discountAfterChange(
          { discount: { type: 'percent', value: 25 }, prevAmount: 5, prevTotal: 20, newTotal: 12 },
          p
        )
      ).toBe(3)
    }
  })

  it('senza sconto non c’è niente da ricalcolare', () => {
    expect(discountAfterChange({ discount: null, prevAmount: 0, prevTotal: 20, newTotal: 12 })).toBe(0)
  })
})

// DUE RIGHE DELLO STESSO PRODOTTO. Difetto visto in produzione: nella
// schermata di pagamento, con «Negroni, Coca Cola, Negroni», premere «+» sul
// primo Negroni alzava anche il secondo — la selezione era indicizzata per
// PRODOTTO, e due righe dello stesso prodotto condividevano il contatore. Si
// incassava una quantità che nessuno aveva scelto.
describe('righe uguali ma distinte', () => {
  const conto = {
    id: 'o1',
    total: 22,
    payments: [],
    order_items: [
      { drink_id: 'negroni', name: 'Negroni', unit_price: 8, qty: 1 },
      { drink_id: 'coca', name: 'Coca Cola', unit_price: 3, qty: 1 },
      { drink_id: 'negroni', name: 'Negroni', unit_price: 8, qty: 1, custom: true },
    ],
  }

  it('ogni riga ha una chiave sua, anche se il prodotto è lo stesso', () => {
    const righe = remainingItems(conto)
    expect(righe).toHaveLength(3)
    const chiavi = righe.map((r) => r.key)
    expect(new Set(chiavi).size).toBe(3)
  })

  it('le chiavi restano stabili fra due letture dello stesso conto', () => {
    // Se cambiassero, la selezione fatta a mano si azzererebbe da sola
    // mentre si sta scegliendo cosa incassare.
    expect(remainingItems(conto).map((r) => r.key)).toEqual(
      remainingItems(conto).map((r) => r.key)
    )
  })

  it('la riga porta con sé il prodotto: l’incasso registrato non cambia', () => {
    const righe = remainingItems(conto)
    expect(righe[0]).toMatchObject({ drink_id: 'negroni', name: 'Negroni', qty: 1 })
    expect(righe[2]).toMatchObject({ drink_id: 'negroni', custom: true })
  })
})

// CHE COSA È STATO PAGATO. In fondo al conto c'era una riga sola — «Sconto
// e acconti già incassati −15,00 €» — e quindici euro di che non lo diceva
// nessuno. Al banco, davanti al cliente che chiede, quella riga non
// risponde a niente.
//
// E la distinzione che conta: un importo battuto a mano (30 €) NON copre
// nessuna riga — sono soldi lasciati sul conto — mentre un pagamento fatto
// scegliendo le righe copre esattamente quelle. Dire il contrario sarebbe
// inventarselo.
describe('che cosa è stato pagato', () => {
  it('sconto e incassi si leggono separati, non sommati in una riga sola', () => {
    const d = dettaglioIncassi({
      discount_amount: 5,
      payments: [{ amount: 10, method: 'banco', at: '2026-08-17T21:08:00.000Z' }],
    })
    expect(d.sconto).toBe(5)
    expect(d.totaleIncassato).toBe(10)
    expect(d.incassi[0]).toMatchObject({ importo: 10, metodo: 'banco' })
  })

  it('un importo a mano non copre nessuna riga: è un acconto', () => {
    const d = dettaglioIncassi({ payments: [{ amount: 30, method: 'banco' }] })
    expect(d.incassi[0].cosa).toBe(null)
  })

  it('scegliendo le righe, invece, si sa esattamente cosa copre', () => {
    const d = dettaglioIncassi({
      payments: [
        {
          amount: 21,
          method: 'carta',
          items: [
            { name: 'Daiquiri', qty: 2 },
            { name: 'Birra in Bottiglia', qty: 1 },
          ],
        },
      ],
    })
    expect(d.incassi[0].cosa).toEqual(['2× Daiquiri', '1× Birra in Bottiglia'])
  })

  it('senza sconti né incassi non c’è niente da mostrare', () => {
    const d = dettaglioIncassi({})
    expect(d.sconto).toBe(0)
    expect(d.incassi).toEqual([])
  })
})

// SEPARANDO LE RIGHE UGUALI, OGNI UNITÀ HA LA SUA QUANTITÀ. Fuori di lì la
// selezione è un conteggio — «di questi tre, due li paga lui» — e va
// benissimo; ma con le voci separate spegnere la prima deve spegnere la
// PRIMA, non le ultime come fa un contatore che scende.
describe('le unità delle righe separate', () => {
  it('da un conteggio: le prime N accese', () => {
    expect(unitaDaConteggio(3, 2)).toEqual([true, true, false])
    expect(unitaDaConteggio(3, 0)).toEqual([false, false, false])
    expect(unitaDaConteggio(3, 9)).toEqual([true, true, true])
  })

  it('e viceversa: il conteggio è quante ne sono accese', () => {
    expect(conteggioDaUnita([true, false, true])).toBe(2)
    expect(conteggioDaUnita([])).toBe(0)
    expect(conteggioDaUnita(undefined)).toBe(0)
  })

  it('spegnendo la PRIMA di tre, le altre due restano accese', () => {
    expect(toccaUnita([true, true, true], 3, 0, false)).toEqual([false, true, true])
  })

  it('e si riaccende proprio quella', () => {
    expect(toccaUnita([false, true, true], 3, 0, true)).toEqual([true, true, true])
  })

  it('senza stato si parte da tutte accese', () => {
    expect(toccaUnita(undefined, 2, 1, false)).toEqual([true, false])
  })

  it('un indice fuori misura non rompe niente', () => {
    expect(toccaUnita([true, true], 2, 5, false)).toEqual([true, true])
  })
})

// ── IL PRIMO TOCCO RESTRINGE, I SUCCESSIVI AGGIUNGONO ────────────────
//
// «Quando apro sono tutte selezionate, ma se premo o la label o il più le
// altre voci passano a 0 [...] e quando le premo le aggiungo al conto che
// voglio riscuotere» (l'utente, 20/08/2026). Prima per incassare una riga
// di dieci se ne spegnevano nove.
describe('la selezione riparte da zero al primo tocco', () => {
  const righe = [
    { key: 'a', qty: 1 },
    { key: 'b', qty: 3 },
    { key: 'c', qty: 1 },
  ]
  const piena = { a: 1, b: 3, c: 1 }
  const stato = (sel, selUnita = {}) => ({ sel, selUnita })

  it('vergine è la selezione che tiene dentro TUTTO', () => {
    expect(selezioneVergine(righe, piena)).toBe(true)
    expect(selezioneVergine(righe, { a: 1, b: 2, c: 1 })).toBe(false)
    // Una riga che nessuno ha ancora toccato non è nella selezione: è il
    // caso della riga che arriva mentre la schermata è aperta.
    expect(selezioneVergine(righe, { a: 1, b: 3 })).toBe(false)
    // Senza righe non c'è niente da riscuotere, e niente da restringere.
    expect(selezioneVergine([], {})).toBe(false)
  })

  it('primo tocco sull’etichetta: resta solo quella riga, intera', () => {
    const dopo = selezioneDopoTocco(stato(piena), righe, { riga: righe[1], gesto: 'etichetta' })
    expect(dopo.sel).toEqual({ a: 0, b: 3, c: 0 })
    expect(dopo.selUnita.b).toEqual([true, true, true])
  })

  it('primo tocco sul «+»: stessa cosa — la riga toccata non si accorcia', () => {
    // Il «+» su una riga già intera vorrebbe dire «più di così non si può»:
    // qui vuol dire «di tutto il conto, questo lo paga lui».
    const dopo = selezioneDopoTocco(stato(piena), righe, { riga: righe[1], gesto: 'piu' })
    expect(dopo.sel).toEqual({ a: 0, b: 3, c: 0 })
  })

  it('dal secondo tocco in poi si AGGIUNGE, non si azzera più niente', () => {
    const uno = selezioneDopoTocco(stato(piena), righe, { riga: righe[0], gesto: 'etichetta' })
    const due = selezioneDopoTocco(uno, righe, { riga: righe[2], gesto: 'etichetta' })
    expect(due.sel).toEqual({ a: 1, b: 0, c: 1 })
    // E il «+» continua ad aggiungere una unità per volta.
    const tre = selezioneDopoTocco(due, righe, { riga: righe[1], gesto: 'piu' })
    expect(tre.sel).toEqual({ a: 1, b: 1, c: 1 })
  })

  it('l’etichetta di una riga già dentro per intero la toglie', () => {
    const uno = selezioneDopoTocco(stato(piena), righe, { riga: righe[0], gesto: 'etichetta' })
    const due = selezioneDopoTocco(uno, righe, { riga: righe[0], gesto: 'etichetta' })
    expect(due.sel).toEqual({ a: 0, b: 0, c: 0 })
    // Ma sul VERGINE no: con tutto acceso un tocco che spegne lascerebbe la
    // schermata a zero, e chi voleva incassare quella riga sarebbe da capo.
    expect(selezioneDopoTocco(stato(piena), righe, { riga: righe[0], gesto: 'etichetta' }).sel.a).toBe(1)
  })

  it('l’etichetta di una riga a metà la rimette dentro intera', () => {
    const meta = stato({ a: 0, b: 2, c: 0 })
    const dopo = selezioneDopoTocco(meta, righe, { riga: righe[1], gesto: 'etichetta' })
    expect(dopo.sel.b).toBe(3)
  })

  it('il «−» toglie come ha sempre fatto, anche sul vergine', () => {
    // È il vecchio modo di dividere il conto — spegnere quello che non
    // serve — e continua a funzionare identico: guai a cambiarlo sotto le
    // mani di chi lo usa da mesi.
    const dopo = selezioneDopoTocco(stato(piena), righe, { riga: righe[1], gesto: 'meno' })
    expect(dopo.sel).toEqual({ a: 1, b: 2, c: 1 })
    expect(dopo.selUnita.b).toEqual([true, true, false])
  })

  it('sotto zero non si scende, e sopra la quantità nemmeno', () => {
    const vuoto = stato({ a: 0, b: 0, c: 0 })
    expect(selezioneDopoTocco(vuoto, righe, { riga: righe[0], gesto: 'meno' }).sel.a).toBe(0)
    const quasi = stato({ a: 1, b: 3, c: 0 })
    expect(selezioneDopoTocco(quasi, righe, { riga: righe[1], gesto: 'piu' }).sel.b).toBe(3)
  })

  it('rimettendo tutto in pagamento si torna vergine, e il tocco dopo restringe di nuovo', () => {
    const uno = selezioneDopoTocco(stato(piena), righe, { riga: righe[0], gesto: 'etichetta' })
    expect(selezioneVergine(righe, uno.sel)).toBe(false)
    // «Rimetti tutto in pagamento» riscrive la selezione piena: da lì la
    // regola riparte da sé, senza flag da azzerare.
    const dopo = selezioneDopoTocco(stato(piena), righe, { riga: righe[2], gesto: 'etichetta' })
    expect(dopo.sel).toEqual({ a: 0, b: 0, c: 1 })
  })

  it('un tocco senza riga non cambia niente', () => {
    expect(selezioneDopoTocco(stato(piena), righe, {}).sel).toEqual(piena)
  })
})

// «SEPARA UGUALI»: stesso meccanismo, sulle unità. Non due implementazioni
// che prima o poi si comportano in modo diverso.
describe('il primo tocco su una unità separata', () => {
  const righe = [
    { key: 'a', qty: 2 },
    { key: 'b', qty: 1 },
  ]
  const piena = { sel: { a: 2, b: 1 }, selUnita: {} }

  it('azzera tutte le altre unità di tutte le righe, e lascia quella', () => {
    const dopo = selezioneDopoTocco(piena, righe, { riga: righe[0], gesto: 'etichetta', indice: 1 })
    expect(dopo.sel).toEqual({ a: 1, b: 0 })
    expect(dopo.selUnita.a).toEqual([false, true])
  })

  it('e il «+» di una unità fa lo stesso, che è il gesto chiesto', () => {
    const dopo = selezioneDopoTocco(piena, righe, { riga: righe[0], gesto: 'piu', indice: 0 })
    expect(dopo.selUnita.a).toEqual([true, false])
    expect(dopo.sel.b).toBe(0)
  })

  it('poi si aggiungono le unità una per una', () => {
    const uno = selezioneDopoTocco(piena, righe, { riga: righe[0], gesto: 'piu', indice: 0 })
    const due = selezioneDopoTocco(uno, righe, { riga: righe[0], gesto: 'piu', indice: 1 })
    expect(due.selUnita.a).toEqual([true, true])
    const tre = selezioneDopoTocco(due, righe, { riga: righe[1], gesto: 'etichetta', indice: 0 })
    expect(tre.sel).toEqual({ a: 2, b: 1 })
  })

  it('spegnendo la PRIMA di due si spegne la prima, non l’ultima', () => {
    const dopo = selezioneDopoTocco(piena, righe, { riga: righe[0], gesto: 'meno', indice: 0 })
    expect(dopo.selUnita.a).toEqual([false, true])
    expect(dopo.sel.a).toBe(1)
  })
})
