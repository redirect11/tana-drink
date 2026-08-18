import { describe, it, expect } from 'vitest'
import {
  lineByMacro,
  venditeByMacro,
  purchasesByMacro,
  macroMonthlyReport,
  UNASSIGNED,
} from '../../src/lib/macroStats.js'

// LA REGOLA IN PROVA (REQ-MAG-015): una voce di menù conta INTERA sulla
// macro di quella voce — incasso e costo di tutti i suoi ingredienti
// insieme. Non si scompone niente sulle macro dei singoli prodotti.
//
// I due casi qui sotto sono quelli detti a voce, non inventati: la
// SCHWEPPES comprata come bibita e versata in un Gin Tonic, e la RED BULL
// comprata come bibita e versata in uno Jäger Bomb. Tutte e due, in quel
// consumo, contano su «alcolici e distillati» — «l'ho venduta come se fosse
// un distillato in quel momento». Vendute da sole restano bibite.

// ── MAGAZZINO: i prodotti e quanto costano (netti, IVA a parte) ────────
const itemsById = {
  gin: { unit: 'ml', package_size: 700, cost: 21, vat: 0, category_id: 'inv-distillati' },
  jager: { unit: 'ml', package_size: 700, cost: 14, vat: 0, category_id: 'inv-distillati' },
  schweppes: { unit: 'pz', cost: 0.5, vat: 0, category_id: 'inv-bibite' },
  redbull: { unit: 'pz', cost: 1, vat: 0, category_id: 'inv-bibite' },
}
// Categorie di MAGAZZINO → macro di magazzino: servono solo agli ACQUISTI.
const catToMacro = new Map([
  ['inv-distillati', 'mag-alc'],
  ['inv-bibite', 'mag-bib'],
])

// ── MENÙ: le categorie dei drink e le loro macro ───────────────────────
const menuCatToMacro = new Map([
  ['menu-alcolici', 'mm-alc'], // «alcolici e distillati»
  ['menu-bibite', 'mm-bib'], // «birre e bibite»
])
const macros = [
  { id: 'mm-alc', name: 'Alcolici e distillati' },
  { id: 'mm-bib', name: 'Birre e bibite' },
]

// gin 0,03 €/ml → 5 cl = 1,50 · schweppes 0,50 → costo 2,00
const ginTonic = {
  id: 'gintonic',
  category_id: 'menu-alcolici',
  recipe_items: [
    { inventory_item_id: 'gin', unit: 'ml', qty: 50 },
    { inventory_item_id: 'schweppes', unit: 'pz', qty: 1 },
  ],
}
// jager 0,02 €/ml → 4 cl = 0,80 · redbull 1,00 → costo 1,80
const jagerBomb = {
  id: 'jagerbomb',
  category_id: 'menu-alcolici',
  recipe_items: [
    { inventory_item_id: 'jager', unit: 'ml', qty: 40 },
    { inventory_item_id: 'redbull', unit: 'pz', qty: 1 },
  ],
}
// La stessa Schweppes venduta come bibita: costo 0,50
const schweppesSola = {
  id: 'schweppes-sola',
  category_id: 'menu-bibite',
  recipe_items: [{ inventory_item_id: 'schweppes', unit: 'pz', qty: 1 }],
}
const drinksById = {
  gintonic: ginTonic,
  jagerbomb: jagerBomb,
  'schweppes-sola': schweppesSola,
}

const riga = (drink_id, qty, unit_price) => ({ drink_id, qty, unit_price })

describe('lineByMacro: una vendita, una macro sola', () => {
  it('il Gin Tonic porta anche la Schweppes sui distillati, incasso e costo', () => {
    const r = lineByMacro(riga('gintonic', 1, 8), ginTonic, itemsById, menuCatToMacro)
    expect(r.macro).toBe('mm-alc')
    expect(r.incasso).toBeCloseTo(8, 2)
    // Tutto il costo del drink, Schweppes compresa: 1,50 + 0,50.
    expect(r.costo).toBeCloseTo(2, 2)
  })

  it('lo Jäger Bomb porta la Red Bull sui distillati', () => {
    const r = lineByMacro(riga('jagerbomb', 1, 6), jagerBomb, itemsById, menuCatToMacro)
    expect(r.macro).toBe('mm-alc')
    expect(r.costo).toBeCloseTo(1.8, 2)
  })

  it('la stessa Schweppes venduta da sola resta una bibita', () => {
    const r = lineByMacro(riga('schweppes-sola', 1, 3), schweppesSola, itemsById, menuCatToMacro)
    expect(r.macro).toBe('mm-bib')
    expect(r.incasso).toBeCloseTo(3, 2)
    expect(r.costo).toBeCloseTo(0.5, 2)
  })

  it('scorpora l’IVA di rivendita dall’incasso, non dal costo', () => {
    const r = lineByMacro(riga('gintonic', 1, 11), ginTonic, itemsById, menuCatToMacro, {
      saleVat: 10,
    })
    expect(r.incasso).toBeCloseTo(10, 2)
    expect(r.costo).toBeCloseTo(2, 2)
  })

  it('il costo è al netto dell’IVA d’acquisto: si confronta con un incasso netto', () => {
    const conIva = { ...itemsById, schweppes: { ...itemsById.schweppes, vat: 22 } }
    const r = lineByMacro(riga('gintonic', 1, 8), ginTonic, conIva, menuCatToMacro)
    // Col costo lordo la Schweppes peserebbe 0,61 invece di 0,50.
    expect(r.costo).toBeCloseTo(2, 2)
  })

  it('lo sconto abbassa l’incasso e NON il costo: il drink è costato lo stesso', () => {
    const r = lineByMacro(riga('gintonic', 1, 8), ginTonic, itemsById, menuCatToMacro, {
      factor: 0.5,
    })
    expect(r.incasso).toBeCloseTo(4, 2)
    expect(r.costo).toBeCloseTo(2, 2)
  })

  it('quantità multiple: incasso e costo vanno insieme', () => {
    const r = lineByMacro(riga('gintonic', 3, 8), ginTonic, itemsById, menuCatToMacro)
    expect(r.incasso).toBeCloseTo(24, 2)
    expect(r.costo).toBeCloseTo(6, 2)
  })

  it('drink senza categoria di menù → «non attribuito», col suo incasso', () => {
    const r = lineByMacro(riga('boh', 1, 5), { recipe_items: [] }, itemsById, menuCatToMacro)
    expect(r.macro).toBe(UNASSIGNED)
    expect(r.incasso).toBeCloseTo(5, 2)
    // Ricetta assente: il costo non si sa, e resta 0 — non è una perdita.
    expect(r.costo).toBe(0)
  })

  it('riga libera senza drink di catalogo → non attribuita', () => {
    const r = lineByMacro(riga(null, 1, 4), undefined, itemsById, menuCatToMacro)
    expect(r.macro).toBe(UNASSIGNED)
    expect(r.incasso).toBeCloseTo(4, 2)
  })
})

describe('venditeByMacro', () => {
  it('somma incasso e costo su più ordini, ognuno sulla macro del suo drink', () => {
    const orders = [
      { order_items: [riga('gintonic', 1, 8), riga('schweppes-sola', 1, 3)] },
      { order_items: [riga('jagerbomb', 2, 6)] },
    ]
    const acc = venditeByMacro(orders, { drinksById, itemsById, menuCatToMacro })
    // Distillati: 8 + 12 di incasso, 2 + 3,60 di costo.
    expect(acc.get('mm-alc').incasso).toBeCloseTo(20, 2)
    expect(acc.get('mm-alc').costo).toBeCloseTo(5.6, 2)
    // Bibite: solo la Schweppes venduta COME bibita.
    expect(acc.get('mm-bib').incasso).toBeCloseTo(3, 2)
    expect(acc.get('mm-bib').costo).toBeCloseTo(0.5, 2)
  })

  it('legge le righe dalle comande se mancano gli order_items', () => {
    const orders = [{ comande: [{ items: [riga('gintonic', 1, 8)] }] }]
    const acc = venditeByMacro(orders, { drinksById, itemsById, menuCatToMacro })
    expect(acc.get('mm-alc').incasso).toBeCloseTo(8, 2)
  })

  it('salta gli ordini annullati', () => {
    const orders = [{ status: 'annullato', order_items: [riga('gintonic', 1, 8)] }]
    expect(venditeByMacro(orders, { drinksById, itemsById, menuCatToMacro }).size).toBe(0)
  })
})

// GLI ACQUISTI SONO UN'ALTRA DOMANDA e vivono per conto loro, sulle macro
// di MAGAZZINO: «quanto ho speso in bibite» resta una domanda vera, ma è
// delle fatture, non della tabella del venduto.
describe('purchasesByMacro', () => {
  const pos = [
    {
      status: 'ricevuto',
      lines: [
        { item_id: 'gin', unit_cost: 21, qty_packages: 2 }, // 42 → distillati
        { item_id: 'schweppes', unit_cost: 0.5, qty_packages: 24 }, // 12 → bibite
      ],
    },
    { status: 'inviato', lines: [{ item_id: 'gin', unit_cost: 21, qty_packages: 5 }] },
  ]
  it('somma per macro di magazzino solo gli ordini ricevuti', () => {
    const acc = purchasesByMacro(pos, { itemsById, catToMacro })
    expect(acc.get('mag-alc')).toBeCloseTo(42, 2)
    expect(acc.get('mag-bib')).toBeCloseTo(12, 2)
  })

  it('la Schweppes comprata resta una bibita: l’anagrafica non si tocca mai', () => {
    const acc = purchasesByMacro(pos, { itemsById, catToMacro })
    expect(acc.get('mag-bib')).toBeCloseTo(12, 2)
    expect(acc.has('mm-alc')).toBe(false)
  })
})

describe('macroMonthlyReport', () => {
  const orders = [
    {
      status: 'aperto',
      created_at: '2026-07-15T20:00:00Z',
      order_items: [riga('gintonic', 1, 8), riga('schweppes-sola', 1, 3)],
    },
    {
      status: 'pagato',
      created_at: '2026-06-10T20:00:00Z',
      order_items: [riga('jagerbomb', 1, 6)],
    },
  ]
  const rep = macroMonthlyReport({
    orders,
    drinksById,
    itemsById,
    menuCatToMacro,
    macros,
    months: ['2026-06', '2026-07'],
  })

  it('mette incasso e costo nel mese giusto, sulla macro del drink', () => {
    const alc = rep.rows.find((r) => r.id === 'mm-alc')
    expect(alc.byMonth.get('2026-07').incasso).toBeCloseTo(8, 2)
    expect(alc.byMonth.get('2026-07').costo).toBeCloseTo(2, 2)
    expect(alc.byMonth.get('2026-06').incasso).toBeCloseTo(6, 2)
    expect(alc.byMonth.get('2026-06').costo).toBeCloseTo(1.8, 2)
  })

  it('in «birre e bibite» resta solo quello venduto COME bibita', () => {
    const bib = rep.rows.find((r) => r.id === 'mm-bib')
    // La Schweppes del Gin Tonic non compare qui, né come incasso né come
    // costo: è finita sui distillati insieme al drink che l'ha bevuta.
    expect(bib.byMonth.get('2026-07').incasso).toBeCloseTo(3, 2)
    expect(bib.byMonth.get('2026-07').costo).toBeCloseTo(0.5, 2)
    expect(bib.byMonth.get('2026-06').incasso).toBe(0)
  })

  it('calcola margine e rapporto per cella', () => {
    const alc = rep.rows.find((r) => r.id === 'mm-alc')
    const lug = alc.byMonth.get('2026-07')
    expect(lug.margine).toBeCloseTo(6, 2)
    expect(lug.rapporto).toBeCloseTo(4, 2) // 8 / 2
    // Mese senza niente venduto → rapporto null, non una divisione per zero.
    expect(rep.rows.find((r) => r.id === 'mm-bib').byMonth.get('2026-06').rapporto).toBeNull()
  })

  it('totali per macro (anno) e generale', () => {
    const alc = rep.rows.find((r) => r.id === 'mm-alc')
    expect(alc.tot.incasso).toBeCloseTo(14, 2)
    expect(alc.tot.costo).toBeCloseTo(3.8, 2)
    expect(rep.grand.incasso).toBeCloseTo(17, 2)
    expect(rep.grand.costo).toBeCloseTo(4.3, 2)
  })

  it('la somma degli incassi delle macro è l’incasso della serata', () => {
    const somma = rep.rows.reduce((s, r) => s + r.tot.incasso, 0)
    expect(somma).toBeCloseTo(17, 2) // 8 + 3 + 6: nessun euro perso né inventato
  })

  it('«Non attribuito» compare solo se ha davvero qualcosa dentro', () => {
    expect(rep.rows.some((r) => r.id === UNASSIGNED)).toBe(false)
    const conOrfano = macroMonthlyReport({
      orders: [
        {
          created_at: '2026-07-15T20:00:00Z',
          order_items: [{ drink_id: null, qty: 1, unit_price: 5 }],
        },
      ],
      drinksById,
      itemsById,
      menuCatToMacro,
      macros,
      months: ['2026-07'],
    })
    expect(conOrfano.rows.find((r) => r.id === UNASSIGNED).tot.incasso).toBeCloseTo(5, 2)
  })

  it('scorpora l’IVA di rivendita dall’incasso di tutte le macro', () => {
    const conIva = macroMonthlyReport({
      orders,
      drinksById,
      itemsById,
      menuCatToMacro,
      macros,
      months: ['2026-06', '2026-07'],
      saleVat: 10,
    })
    // 8/1,10 = 7,27 e 6/1,10 = 5,45: lo scorporo si arrotonda al centesimo
    // riga per riga, come i soldi veri, non alla fine.
    expect(conIva.rows.find((r) => r.id === 'mm-alc').tot.incasso).toBeCloseTo(12.72, 2)
    // Il costo non si scorpora una seconda volta: è già netto.
    expect(conIva.rows.find((r) => r.id === 'mm-alc').tot.costo).toBeCloseTo(3.8, 2)
  })
})
