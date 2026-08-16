'use strict'

// Unit test della logica pura inventario (src/lib/inventory.js).

import { describe, it, expect } from 'vitest'
import { consumptionDiff } from '../../src/lib/warehouse.js'
import {
  toBaseQty,
  formatQty,
  stockStatus,
  computeConsumption,
  bottleBreakdown,
  bottleSummary,
  baseUnit,
  fromBaseQty,
  formatIn,
  fmtItem,
  inventorySummary,
  filterItems,
  qtyInStockUnit,
  entryUnits,
  assortimentoDi,
  ASSORTIMENTI,
  costWithVat,
  unitsInStock,
  stockValue,
  costPerCl,
  smallUnits,
  costPerUnit,
  inventoryTotalValue,
  pezziInGiacenza,
  formatPezzi,
  copiaProdotto,
  fmtContenuto,
} from '../../src/lib/inventory.js'

describe('toBaseQty', () => {
  it('converte cl→ml e L→ml', () => {
    expect(toBaseQty(25, 'cl')).toBe(250)
    expect(toBaseQty(1, 'l')).toBe(1000)
  })
  it('converte kg→g', () => {
    expect(toBaseQty(2, 'kg')).toBe(2000)
  })
  it('lascia invariate le unità base', () => {
    expect(toBaseQty(250, 'ml')).toBe(250)
    expect(toBaseQty(3, 'pz')).toBe(3)
    expect(toBaseQty(500, 'g')).toBe(500)
  })
})

describe('formatQty', () => {
  it('ml: mostra cl quando multiplo di 10, L oltre il litro', () => {
    expect(formatQty(250, 'ml')).toBe('25 cl')
    expect(formatQty(25, 'ml')).toBe('25 ml')
    expect(formatQty(1500, 'ml')).toBe('1,5 L')
  })
  it('pz e g', () => {
    expect(formatQty(3, 'pz')).toBe('3 pz')
    expect(formatQty(500, 'g')).toBe('500 g')
    expect(formatQty(2000, 'g')).toBe('2 kg')
  })
})

describe('stockStatus', () => {
  it('empty quando ≤ 0', () => {
    expect(stockStatus({ stock: 0, low_threshold: 5 })).toBe('empty')
    expect(stockStatus({ stock: -10, low_threshold: 5 })).toBe('empty')
  })
  it('low quando ≤ soglia', () => {
    expect(stockStatus({ stock: 5, low_threshold: 5 })).toBe('low')
    expect(stockStatus({ stock: 3, low_threshold: 5 })).toBe('low')
  })
  it('ok quando sopra soglia', () => {
    expect(stockStatus({ stock: 100, low_threshold: 5 })).toBe('ok')
  })
})

describe('bottleBreakdown', () => {
  it('esempio: bottiglia 1L, 4 totali, stock 2,5L → 2 piene, 0,5L aperta, 1 finita', () => {
    const bd = bottleBreakdown({ unit: 'ml', package_size: 1000, bottles_total: 4, stock: 2500 })
    expect(bd).toEqual({ full: 2, openRemaining: 500, hasOpen: true, finished: 1, total: 4 })
  })
  it('tutte piene: nessuna aperta, nessuna finita', () => {
    const bd = bottleBreakdown({ unit: 'ml', package_size: 1000, bottles_total: 3, stock: 3000 })
    expect(bd).toMatchObject({ full: 3, hasOpen: false, finished: 0 })
  })
  it('stock 0: tutte finite', () => {
    const bd = bottleBreakdown({ unit: 'ml', package_size: 1000, bottles_total: 4, stock: 0 })
    expect(bd).toMatchObject({ full: 0, hasOpen: false, finished: 4 })
  })
  it('null per prodotti a pezzi o senza confezione', () => {
    expect(bottleBreakdown({ unit: 'pz', stock: 10 })).toBeNull()
    expect(bottleBreakdown({ unit: 'ml', package_size: 0, stock: 10 })).toBeNull()
  })
})

describe('inventorySummary', () => {
  const items = [
    { stock: 100, low_threshold: 10 }, // ok
    { stock: 5, low_threshold: 10 }, // low
    { stock: 0, low_threshold: 10 }, // empty
    { stock: 8, low_threshold: 10 }, // low
  ]
  it('conta totale, low e empty', () => {
    expect(inventorySummary(items)).toEqual({ total: 4, low: 2, empty: 1 })
  })
  it('lista vuota', () => {
    expect(inventorySummary([])).toEqual({ total: 0, low: 0, empty: 0 })
  })
})

describe('filterItems', () => {
  const items = [
    { name: 'Rum Zacapa', category_id: 'distillati', stock: 100, low_threshold: 10 },
    { name: 'Rum Bianco', category_id: 'distillati', stock: 5, low_threshold: 10 },
    { name: 'Birra IPA', category_id: 'birre', stock: 0, low_threshold: 6 },
    { name: 'Sciroppo', category_id: null, stock: 50, low_threshold: 5 },
  ]
  it('ricerca per nome (case-insensitive)', () => {
    expect(filterItems(items, { query: 'rum' }).map((i) => i.name)).toEqual(['Rum Bianco', 'Rum Zacapa'])
  })
  it('filtra per categoria', () => {
    expect(filterItems(items, { categoryId: 'birre' }).map((i) => i.name)).toEqual(['Birra IPA'])
  })
  it('filtra i senza categoria', () => {
    expect(filterItems(items, { categoryId: 'none' }).map((i) => i.name)).toEqual(['Sciroppo'])
  })
  it('filtra per stato', () => {
    expect(filterItems(items, { status: 'empty' }).map((i) => i.name)).toEqual(['Birra IPA'])
    expect(filterItems(items, { status: 'low' }).map((i) => i.name)).toEqual(['Rum Bianco'])
  })
  it('combina ricerca + categoria + stato e ordina per nome', () => {
    const res = filterItems(items, { query: 'rum', categoryId: 'distillati', status: 'ok' })
    expect(res.map((i) => i.name)).toEqual(['Rum Zacapa'])
  })
})

describe('costi e valorizzazione', () => {
  // Amaro del Capo: 1L (1000ml), costo 12,9 netto, IVA 22 → +IVA 15,738
  const amaro = { unit: 'ml', package_size: 1000, cost: 12.9, vat: 22, stock: 2500 }
  const birra = { unit: 'pz', cost: 0.68, vat: 22, stock: 24 }

  it('costWithVat', () => {
    expect(costWithVat(12.9, 22)).toBeCloseTo(15.738, 3)
    expect(costWithVat(10, 0)).toBe(10)
  })
  it('unitsInStock: bottiglie equivalenti e pezzi', () => {
    expect(unitsInStock(amaro)).toBe(2.5) // 2500ml / 1000
    expect(unitsInStock(birra)).toBe(24)
  })
  it('stockValue con IVA', () => {
    // 2,5 bottiglie × 15,738 = 39,345
    expect(stockValue(amaro)).toBeCloseTo(39.345, 3)
    // netto: 2,5 × 12,9 = 32,25
    expect(stockValue(amaro, { gross: false })).toBeCloseTo(32.25, 3)
  })
  it('costPerCl (solo volumi)', () => {
    // 15,738 / 100cl = 0,15738
    expect(costPerCl(amaro)).toBeCloseTo(0.15738, 5)
    expect(costPerCl(birra)).toBeNull()
  })
  it('inventoryTotalValue somma i valori', () => {
    const v = inventoryTotalValue([amaro, birra])
    expect(v).toBeCloseTo(39.345 + 24 * 0.8296, 3)
  })

  it('smallUnits: cl/ml per liquidi, g/mg per solidi, pz per pezzi', () => {
    expect(smallUnits({ unit: 'ml' })).toEqual(['cl', 'ml'])
    expect(smallUnits({ unit: 'g' })).toEqual(['g', 'mg'])
    expect(smallUnits({ unit: 'pz' })).toEqual(['pz'])
  })

  it('costPerUnit: prezzo per cl/ml (liquidi) e g/mg (solidi)', () => {
    // amaro: 12,9 €/conf +IVA 22% = 15,738; conf. 1000 ml
    expect(costPerUnit(amaro, 'ml')).toBeCloseTo(0.015738, 6)
    expect(costPerUnit(amaro, 'cl')).toBeCloseTo(0.15738, 5)
    // solido: 10 €/conf +IVA 22% = 12,2; conf. 500 g
    const sale = { unit: 'g', package_size: 500, cost: 10, vat: 22 }
    expect(costPerUnit(sale, 'g')).toBeCloseTo(0.0244, 4)
    expect(costPerUnit(sale, 'mg')).toBeCloseTo(0.0000244, 7)
    // pezzo: costo per pz = costo confezione ivato
    expect(costPerUnit({ unit: 'pz', cost: 2, vat: 10 }, 'pz')).toBeCloseTo(2.2, 3)
  })

  it('costPerUnit: unità di famiglia diversa → null (niente costo sballato)', () => {
    // chiedere il costo al g di un liquido (o al ml di un solido) non ha senso:
    // meglio null (poi segnalato come "manca il costo") che un numero a caso.
    expect(costPerUnit(amaro, 'g')).toBeNull()
    expect(costPerUnit(amaro, 'mg')).toBeNull()
    const sale = { unit: 'g', package_size: 500, cost: 10, vat: 22 }
    expect(costPerUnit(sale, 'ml')).toBeNull()
    expect(costPerUnit(sale, 'cl')).toBeNull()
    // pezzo con unità di volume → null
    expect(costPerUnit({ unit: 'pz', cost: 2, vat: 10 }, 'cl')).toBeNull()
  })

  it('costPerUnit: robusto anche con L/kg (nessun costo perso in silenzio)', () => {
    // amaro conf. 1000 ml = 1 L → costo al litro = costo confezione ivato
    expect(costPerUnit(amaro, 'l')).toBeCloseTo(15.738, 3)
    const sale = { unit: 'g', package_size: 500, cost: 10, vat: 22 }
    expect(costPerUnit(sale, 'kg')).toBeCloseTo(24.4, 3)
  })
})

describe('computeConsumption', () => {
  const drinksById = {
    mojito: {
      recipe_items: [
        { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 250 },
        { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 20 },
      ],
    },
    negroni: {
      recipe_items: [{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 30 }],
    },
    birra: {
      recipe_items: [{ inventory_item_id: 'birraX', name: 'Birra X', unit: 'pz', qty: 1 }],
    },
  }

  it('moltiplica per la quantità ordinata', () => {
    const res = computeConsumption([{ drink_id: 'mojito', qty: 2 }], drinksById)
    expect(res).toEqual([
      { inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 500 },
      { inventory_item_id: 'lime', name: 'Lime', unit: 'ml', qty: 40 },
    ])
  })

  it('aggrega lo stesso ingrediente da drink diversi', () => {
    const res = computeConsumption(
      [{ drink_id: 'mojito', qty: 1 }, { drink_id: 'negroni', qty: 1 }],
      drinksById
    )
    const rum = res.find((r) => r.inventory_item_id === 'rum')
    expect(rum.qty).toBe(280) // 250 + 30
  })

  it('birra: scala 1 pezzo per unità ordinata', () => {
    const res = computeConsumption([{ drink_id: 'birra', qty: 3 }], drinksById)
    expect(res).toEqual([{ inventory_item_id: 'birraX', name: 'Birra X', unit: 'pz', qty: 3 }])
  })

  it('ignora drink senza ricetta', () => {
    expect(computeConsumption([{ drink_id: 'sconosciuto', qty: 5 }], drinksById)).toEqual([])
  })

  it('item custom: usa la ricetta incorporata (niente lookup catalogo)', () => {
    const res = computeConsumption(
      [
        {
          drink_id: 'custom-123',
          custom: true,
          qty: 2,
          recipe_items: [{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 40 }],
        },
      ],
      {}
    )
    expect(res).toEqual([{ inventory_item_id: 'rum', name: 'Rum', unit: 'ml', qty: 80 }])
  })

  it('la ricetta incorporata ha precedenza su quella del catalogo', () => {
    const res = computeConsumption(
      [{ drink_id: 'mojito', qty: 1, recipe_items: [{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 50 }] }],
      drinksById
    )
    expect(res).toEqual([{ inventory_item_id: 'gin', name: 'Gin', unit: 'ml', qty: 50 }])
  })
})

describe('bottleSummary: bottiglie (pz) + contenuto (cl), unità distinte', () => {
  const gin = { unit: 'ml', package_size: 700 } // bottiglia da 70 cl
  it('bottiglie piene: conteggio + contenuto totale, nessuna aperta', () => {
    expect(bottleSummary({ ...gin, stock: 700 })).toMatchObject({ bottles: 1, total: '70 cl', open: null })
    expect(bottleSummary({ ...gin, stock: 2100 })).toMatchObject({ bottles: 3, total: '2,1 L', open: null })
  })
  it('una aperta: la conta come bottiglia e mostra il suo residuo in cl', () => {
    // 2 piene (1400 ml) + 300 ml aperti → 3 bottiglie, 1,7 L totali, 30 cl aperta
    expect(bottleSummary({ ...gin, stock: 1700 })).toMatchObject({ bottles: 3, total: '1,7 L', open: '30 cl' })
  })
  it('meno di una bottiglia: 1 aperta col suo contenuto', () => {
    expect(bottleSummary({ ...gin, stock: 300 })).toMatchObject({ bottles: 1, total: '30 cl', open: '30 cl' })
  })
  it('vuoto → nessuna bottiglia', () => {
    expect(bottleSummary({ ...gin, stock: 0 })).toMatchObject({ bottles: 0, total: '0 ml', open: null })
  })
  it('il contenuto NON si misura in pezzi', () => {
    const s = bottleSummary({ ...gin, stock: 1700 })
    expect(s.total).not.toMatch(/pz/)
    expect(s.open).not.toMatch(/pz/)
  })
  it('articolo a pezzo: nessun conteggio bottiglie', () => {
    expect(bottleSummary({ unit: 'pz', stock: 12 })).toBeNull()
  })
})

describe('unità di misura scelta dall\'utente', () => {
  it('toBaseQty converte alla base (cl/l/kg/mg → ml/g)', () => {
    expect(toBaseQty(5, 'cl')).toBe(50)
    expect(toBaseQty(1, 'l')).toBe(1000)
    expect(toBaseQty(2, 'kg')).toBe(2000)
    expect(toBaseQty(500, 'mg')).toBe(0.5)
  })
  it('baseUnit: liquidi→ml, pesi→g, pezzi→pz', () => {
    expect(baseUnit('cl')).toBe('ml')
    expect(baseUnit('L')).toBe('ml')
    expect(baseUnit('mg')).toBe('g')
    expect(baseUnit('pz')).toBe('pz')
  })
  it('fromBaseQty è l\'inverso di toBaseQty', () => {
    expect(fromBaseQty(50, 'cl')).toBe(5)
    expect(fromBaseQty(1000, 'l')).toBe(1)
    expect(fromBaseQty(0.5, 'mg')).toBe(500)
  })
  it('formatIn mostra l\'unità ESATTA scelta, senza auto-scaling', () => {
    expect(formatIn(700, 'cl')).toBe('70 cl')
    expect(formatIn(700, 'ml')).toBe('700 ml')
    expect(formatIn(1500, 'l')).toBe('1,5 L')
    expect(formatIn(2, 'mg')).toBe('2.000 mg')
  })
  it('fmtItem usa l\'unità scelta se presente, altrimenti auto', () => {
    expect(fmtItem(700, { unit: 'ml', display_unit: 'cl' })).toBe('70 cl')
    expect(fmtItem(700, { unit: 'ml' })).toBe('70 cl') // auto (formatQty)
    expect(fmtItem(300, { unit: 'ml', display_unit: 'ml' })).toBe('300 ml')
  })
})

// ASSORTIMENTO: linea / premium / out. Il filtro deve accettare più valori
// insieme, perché la domanda vera è quasi sempre combinata ("linea e premium,
// senza gli out").
describe('filtro per assortimento', () => {
  const items = [
    { id: '1', name: 'Gin Base', status: 'linea' },
    { id: '2', name: 'Gin Buono', status: 'premium' },
    { id: '3', name: 'Gin Vecchio', status: 'out' },
    { id: '4', name: 'Senza stato' }, // i vecchi doc non hanno il campo
  ]
  const nomi = (opts) => filterItems(items, opts).map((i) => i.name)

  it('chi non ha lo stato è in assortimento: "in linea" è una scelta', () => {
    expect(assortimentoDi({})).toBe('assortimento')
    expect(assortimentoDi({ status: 'boh' })).toBe('assortimento')
    expect(assortimentoDi({ status: 'linea' })).toBe('linea')
    expect(assortimentoDi({ status: 'premium' })).toBe('premium')
  })

  it('un solo assortimento', () => {
    expect(nomi({ assortimenti: ['premium'] })).toEqual(['Gin Buono'])
    expect(nomi({ assortimenti: ['out'] })).toEqual(['Gin Vecchio'])
    expect(nomi({ assortimenti: ['assortimento'] })).toEqual(['Senza stato'])
  })

  it('più assortimenti insieme', () => {
    expect(nomi({ assortimenti: ['linea', 'premium'] })).toEqual(['Gin Base', 'Gin Buono'])
    expect(nomi({ assortimenti: ['assortimento', 'out'] })).toEqual([
      'Gin Vecchio',
      'Senza stato',
    ])
  })

  it('nessuno selezionato = si vede tutto, non niente', () => {
    expect(nomi({ assortimenti: [] })).toHaveLength(4)
    expect(nomi({})).toHaveLength(4)
  })

  it('si combina con la ricerca', () => {
    expect(nomi({ query: 'gin', assortimenti: ['linea'] })).toEqual(['Gin Base'])
  })

  it('gli stati sono quattro, in ordine di attenzione', () => {
    expect(ASSORTIMENTI).toEqual(['assortimento', 'linea', 'premium', 'out'])
  })
})

// Una bottiglia contata a PEZZO ha comunque un contenuto: 33 cl. Senza
// tenerne conto il costo al cl sparisce nel momento in cui si passa a
// contare le bottiglie invece dei millilitri.
describe('contenuto di un pezzo', () => {
  // Ceres 33 cl: cassa da... no, il costo è per BOTTIGLIA (1,30 € + IVA 22%).
  const ceres = {
    name: 'Ceres',
    unit: 'pz',
    package_size: 330,
    content_unit: 'ml',
    cost: 1.3,
    vat: 22,
    stock: 28,
  }
  const senzaContenuto = { ...ceres, package_size: null, content_unit: null }

  it('il pezzo costa quello che costa', () => {
    expect(costPerUnit(ceres, 'pz')).toBeCloseTo(1.586, 3) // 1,30 + 22%
  })

  it('e il costo al cl si ricava dal contenuto', () => {
    expect(costPerUnit(ceres, 'cl')).toBeCloseTo(1.586 / 33, 4)
    expect(costPerUnit(ceres, 'ml')).toBeCloseTo(1.586 / 330, 5)
  })

  it('senza contenuto il costo al cl è ignoto, non zero', () => {
    expect(costPerUnit(senzaContenuto, 'cl')).toBeNull()
    expect(costPerUnit(senzaContenuto, 'pz')).toBeCloseTo(1.586, 3)
  })

  it('non si mescolano volumi e pesi', () => {
    expect(costPerUnit(ceres, 'g')).toBeNull()
    expect(costPerUnit({ ...ceres, content_unit: 'g' }, 'cl')).toBeNull()
  })

  it('la giacenza resta in pezzi', () => {
    expect(unitsInStock(ceres)).toBe(28)
  })

  it('le unità offerte comprendono il contenuto', () => {
    expect(smallUnits(ceres)).toEqual(['pz', 'cl', 'ml'])
    expect(smallUnits(senzaContenuto)).toEqual(['pz'])
  })
})

// A giacenza zero non c'è nessuna bottiglia da chiamare "piena": la riga
// diceva "0 🍾 · piena", che è una contraddizione in due parole.
describe('bottiglie a zero', () => {
  const gin = { unit: 'ml', display_unit: 'cl', package_size: 700, stock: 0 }
  it('nessuna bottiglia, nessun residuo aperto', () => {
    const bs = bottleSummary(gin)
    expect(bs.bottles).toBe(0)
    expect(bs.open).toBeNull()
  })
  it('una bottiglia intera resta una bottiglia piena', () => {
    expect(bottleSummary({ ...gin, stock: 700 }).bottles).toBe(1)
  })
  it('una aperta conta come bottiglia, col suo residuo', () => {
    const bs = bottleSummary({ ...gin, stock: 900 })
    expect(bs.bottles).toBe(2)
    expect(bs.open).toBe('20 cl')
  })
})

// Le RICETTE si scrivono come si versa (40 ml di gin), la GIACENZA può essere
// contata in un'altra unità (bottiglie). Lo scarico deve convertire: senza,
// un cocktail toglierebbe 40 bottiglie invece di 40 ml.
describe('dalla ricetta alla giacenza', () => {
  const ginAPezzo = { unit: 'pz', package_size: 700, content_unit: 'ml' }
  const ginAVolume = { unit: 'ml', package_size: 700 }
  const coca = { unit: 'pz' }

  it('40 ml da una bottiglia da 700 sono 0,057 pezzi', () => {
    expect(qtyInStockUnit(40, 'ml', ginAPezzo)).toBeCloseTo(40 / 700, 6)
    expect(qtyInStockUnit(4, 'cl', ginAPezzo)).toBeCloseTo(40 / 700, 6)
  })

  it('con la giacenza a volume restano millilitri', () => {
    expect(qtyInStockUnit(40, 'ml', ginAVolume)).toBe(40)
    expect(qtyInStockUnit(4, 'cl', ginAVolume)).toBe(40)
  })

  it('un pezzo di un articolo a pezzo resta un pezzo', () => {
    expect(qtyInStockUnit(1, 'pz', coca)).toBe(1)
  })

  it('un pezzo di un articolo a volume è una confezione intera', () => {
    expect(qtyInStockUnit(1, 'pz', ginAVolume)).toBe(700)
  })

  it('senza contenuto non si inventa una conversione', () => {
    expect(qtyInStockUnit(40, 'ml', { unit: 'pz' })).toBe(40)
    expect(qtyInStockUnit(40, 'ml', { unit: 'g', package_size: 500 })).toBe(40)
  })
})

// Una bottiglia aperta resta leggibile anche con la giacenza in pezzi:
// "0,8 pz" al banco non dice niente, "1 bott. · aperta 56 cl" sì.
describe('bottiglia aperta contata a pezzi', () => {
  const gin = { unit: 'pz', package_size: 700, content_unit: 'ml', stock: 2.8 }
  it('parte intera piene, resto nella aperta', () => {
    const bd = bottleBreakdown(gin)
    expect(bd.full).toBe(2)
    expect(bd.openRemaining).toBeCloseTo(560, 6)
    const bs = bottleSummary(gin)
    expect(bs.bottles).toBe(3)
    expect(bs.open).toBe('56 cl')
  })
  it('giacenza intera: nessuna aperta', () => {
    expect(bottleSummary({ ...gin, stock: 3 }).open).toBeNull()
  })
})

// UNITÀ DELLA RICETTA. La giacenza si conta a bottiglie, ma un cocktail si
// dosa in CL: sono due misure dello stesso prodotto e servono entrambe.
// Segnalato dal locale: "me lo porta in pezzi, ho dovuto scrivere 0,03 pezzi,
// a me qui servono i cl".
describe('unità con cui si dosa un ingrediente', () => {
  const gin = { unit: 'pz', package_size: 700, content_unit: 'ml' }
  const lime = { unit: 'pz' } // a pezzo e basta: un lime non si dosa in cl
  const sciroppo = { unit: 'ml', package_size: 700 }
  const sale = { unit: 'pz', package_size: 500, content_unit: 'g' }

  it('bottiglia contata a pezzi: si dosa in cl, e il cl viene per primo', () => {
    expect(entryUnits(gin)).toEqual(['cl', 'ml', 'pz'])
  })

  it('il pezzo resta: una Coca in un drink si mette intera', () => {
    expect(entryUnits(gin)).toContain('pz')
  })

  it('senza contenuto dichiarato resta solo il pezzo', () => {
    expect(entryUnits(lime)).toEqual(['pz'])
  })

  it('articolo a volume: come prima', () => {
    expect(entryUnits(sciroppo)).toEqual(['cl', 'ml'])
  })

  it('e i solidi in grammi', () => {
    expect(entryUnits(sale)).toEqual(['g', 'mg', 'pz'])
  })
})

// LO SCARICO SEGUE L'UNITÀ SCRITTA NELLA RICETTA.
//   in pezzi → esce quel numero di bottiglie (una intera è una intera)
//   in cl/ml → esce esattamente quel volume, cioè una frazione di bottiglia
// e le due cose non si sommano fra loro.
describe('scarico secondo l’unità della ricetta', () => {
  const gin = { unit: 'pz', package_size: 700, content_unit: 'ml' } // bottiglia da 70 cl
  const drinks = {
    cocktail: { recipe_items: [{ inventory_item_id: 'gin', name: 'Gin', qty: 40, unit: 'ml' }] },
    bottiglia: { recipe_items: [{ inventory_item_id: 'gin', name: 'Gin', qty: 1, unit: 'pz' }] },
  }

  it('in cl esce esattamente quel volume', () => {
    const [c] = computeConsumption([{ drink_id: 'cocktail', qty: 1 }], drinks)
    expect(c).toMatchObject({ qty: 40, unit: 'ml' })
    expect(qtyInStockUnit(c.qty, c.unit, gin)).toBeCloseTo(40 / 700, 6)
  })

  it('in pezzi esce la bottiglia intera', () => {
    const [c] = computeConsumption([{ drink_id: 'bottiglia', qty: 2 }], drinks)
    expect(c).toMatchObject({ qty: 2, unit: 'pz' })
    expect(qtyInStockUnit(c.qty, c.unit, gin)).toBe(2)
  })

  it('due unità diverse sullo stesso prodotto restano separate', () => {
    const cons = computeConsumption(
      [
        { drink_id: 'cocktail', qty: 3 }, // 120 ml
        { drink_id: 'bottiglia', qty: 1 }, // 1 pz
      ],
      drinks
    )
    expect(cons).toHaveLength(2)
    const inMl = cons.find((c) => c.unit === 'ml')
    const inPz = cons.find((c) => c.unit === 'pz')
    expect(inMl.qty).toBe(120)
    expect(inPz.qty).toBe(1)
    // In bottiglie: 120/700 + 1 — mai "121" di qualcosa.
    const totale = cons.reduce((s, c) => s + qtyInStockUnit(c.qty, c.unit, gin), 0)
    expect(totale).toBeCloseTo(120 / 700 + 1, 6)
  })

  it('e il riallineo dopo una modifica non le mescola', () => {
    const prima = computeConsumption([{ drink_id: 'cocktail', qty: 2 }], drinks)
    const dopo = computeConsumption(
      [{ drink_id: 'cocktail', qty: 1 }, { drink_id: 'bottiglia', qty: 1 }],
      drinks
    )
    const diff = consumptionDiff(prima, dopo)
    expect(diff.find((d) => d.unit === 'ml').delta).toBe(-40) // un cocktail in meno
    expect(diff.find((d) => d.unit === 'pz').delta).toBe(1) // una bottiglia in più
  })
})

// ── QUANTI PEZZI CI SONO, CON LA VIRGOLA ─────────────────────────────
// «3 bott.» diceva quante bottiglie si toccano, non quanto prodotto c'è
// dentro: tre bottiglie di cui una quasi vuota contavano come tre, e per
// sapere se bastavano per la serata bisognava aprire il dettaglio.
describe('pezzi in giacenza', () => {
  it('una bottiglia da 100 cl con dentro 50 cl è mezzo pezzo', () => {
    const tanqueray = { unit: 'ml', package_size: 1000, stock: 500, bottles_total: 1 }
    expect(pezziInGiacenza(tanqueray)).toBeCloseTo(0.5, 3)
    expect(formatPezzi(pezziInGiacenza(tanqueray))).toBe('0,5')
  })

  it('due piene da 50 cl e una a cui mancano 10 cl fanno 2,8', () => {
    const tre = { unit: 'ml', package_size: 500, stock: 2 * 500 + 400, bottles_total: 3 }
    expect(formatPezzi(pezziInGiacenza(tre))).toBe('2,8')
  })

  it('le bibite contate a pezzo dicono il loro numero', () => {
    const bibite = { unit: 'pz', package_size: 200, content_unit: 'ml', stock: 17 }
    expect(formatPezzi(pezziInGiacenza(bibite))).toBe('17')
  })

  it('esaurito è zero, non «0 bott. piena»', () => {
    const finito = { unit: 'ml', package_size: 700, stock: 0, bottles_total: 2 }
    expect(formatPezzi(pezziInGiacenza(finito))).toBe('0')
  })

  it('gli interi non si scrivono con gli zeri in coda', () => {
    expect(formatPezzi(3)).toBe('3')
    expect(formatPezzi(2.5)).toBe('2,5')
    // Due decimali bastano: al banco nessuno versa il millesimo di bottiglia.
    expect(formatPezzi(2.456)).toBe('2,46')
  })

  it('senza confezione non c’è un pezzo da contare', () => {
    expect(pezziInGiacenza({ unit: 'ml', stock: 900 })).toBeNull()
  })
})

// ── DUPLICARE UN PRODOTTO ────────────────────────────────────────────
// Il magazzino è pieno di quasi-uguali: stessa bottiglia in due formati,
// lo stesso amaro di un altro fornitore. Rifarli da zero vuol dire
// ribattere costo, confezione, categoria, soglia e IVA.
describe('copia di un prodotto', () => {
  const gin = {
    id: 'inv1',
    created_at: '2026-01-01T00:00:00.000Z',
    name: 'Tanqueray',
    unit: 'ml',
    package_size: 1000,
    cost: 18,
    vat: 22,
    category_id: 'gin',
    supplier_id: 'metro',
    low_threshold: 500,
    stock: 2500,
    bottles_total: 4,
  }

  it('porta con sé quello che costa tempo ribattere', () => {
    const copia = copiaProdotto(gin)
    expect(copia).toMatchObject({
      unit: 'ml',
      package_size: 1000,
      cost: 18,
      vat: 22,
      category_id: 'gin',
      supplier_id: 'metro',
      low_threshold: 500,
    })
  })

  it('nasce VUOTA: la giacenza non si copia', () => {
    // Portarsi dietro le bottiglie vorrebbe dire inventarsele: la copia in
    // magazzino non è mai entrata.
    const copia = copiaProdotto(gin)
    expect(copia.stock).toBe(0)
    expect(copia.bottles_total).toBe(0)
  })

  it('non porta l’identità dell’originale', () => {
    const copia = copiaProdotto(gin)
    expect(copia.id).toBeUndefined()
    expect(copia.created_at).toBeUndefined()
  })

  it('il nome dice che è una copia, così si vede quale correggere', () => {
    expect(copiaProdotto(gin).name).toBe('Tanqueray (copia)')
    expect(copiaProdotto({ name: '' }).name).toBe('Prodotto (copia)')
  })
})

// ── IL CONTENUTO NON SI MISURA IN PEZZI ──────────────────────────────
// Un pezzo è la bottiglia; dentro ci sono cl (o grammi). Si leggeva «1
// aperta (40 pz) · 1 conf. = 200 pz», che a chi sta versando non dice
// niente.
describe('unità del contenuto', () => {
  const bibita = { unit: 'pz', package_size: 200, content_unit: 'ml' }
  const solido = { unit: 'pz', package_size: 1000, content_unit: 'g' }
  const gin = { unit: 'ml', package_size: 700 }

  it('la capienza di una bottiglia contata a pezzo si legge in cl', () => {
    expect(fmtContenuto(200, bibita)).toBe('20 cl')
  })

  it('e quello che resta nell’aperta pure', () => {
    expect(fmtContenuto(40, bibita)).toBe('4 cl')
  })

  it('i solidi in grammi, non in pezzi', () => {
    expect(fmtContenuto(1000, solido)).toMatch(/g$/)
  })

  it('gli articoli già a volume restano come sono', () => {
    expect(fmtContenuto(700, gin)).toBe('70 cl')
    expect(fmtContenuto(300, gin)).toBe('30 cl')
  })
})
