import { describe, it, expect } from 'vitest'
import { acquistiFatturato } from '../../src/lib/acquistiFatturato.js'
import { colonneDelBilancio, nomeDelPeriodo, spostaGiorno } from '../../src/lib/periodiBilancio.js'
import { UNASSIGNED } from '../../src/lib/macroStats.js'

// BILANCIO → ACQUISTI × FATTURATO (REQ-MAG-022). È il foglio «RAPPORTI
// ACQUISTI» di ANALISI DATI.xlsx: per ogni macro ACQUISTI, FATTURATO,
// UTILE = F − A, RAPPORTO = F ÷ A e INCIDENZA = utile della macro ÷ somma
// degli utili della colonna; sotto i totali, l'incidenza di ogni colonna
// sul fatturato del periodo. Flavio, 01/10/2026, la vuole per anno, mese,
// settimana e giorno.

describe('le colonne di ogni vista', () => {
  it('l’anno ha i dodici mesi, ognuno dal primo all’ultimo giorno', () => {
    const c = colonneDelBilancio('anno', '2026-07-15')
    expect(c.map((x) => x.label)).toEqual(['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'])
    expect(c[1]).toMatchObject({ key: '2026-02', dal: '2026-02-01', al: '2026-02-28' })
  })

  // «Le 4 settimane e la settimana incompleta», come i fogli mensili.
  it('il mese ha le settimane del foglio: blocchi di sette giorni dal primo, più quelli che restano', () => {
    const c = colonneDelBilancio('mese', '2026-07-15')
    expect(c.map((x) => [x.label, x.sotto])).toEqual([
      ['I SETT', '1–7'],
      ['II SETT', '8–14'],
      ['III SETT', '15–21'],
      ['IV SETT', '22–28'],
      ['EXTRA', '29–31'],
    ])
    // Un febbraio di 28 giorni non ha la colonna in più.
    expect(colonneDelBilancio('mese', '2026-02-10')).toHaveLength(4)
  })

  // Da lunedì a domenica, come le chiusure (REQ-CASSA-014).
  it('la settimana va da lunedì a domenica', () => {
    const c = colonneDelBilancio('settimana', '2026-10-01') // un giovedì
    expect(c.map((x) => x.label)).toEqual(['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'])
    expect(c[0].key).toBe('2026-09-28')
    expect(c[6].key).toBe('2026-10-04')
  })

  it('il giorno è una colonna sola', () => {
    expect(colonneDelBilancio('giorno', '2026-10-01')).toEqual([
      { key: '2026-10-01', label: 'GIO', sotto: '1/10', dal: '2026-10-01', al: '2026-10-01' },
    ])
  })

  // Un 31 spostato di un mese non deve cadere due mesi dopo.
  it('avanti e indietro di un periodo intero', () => {
    expect(spostaGiorno('mese', '2026-01-31', 1)).toBe('2026-02-01')
    expect(spostaGiorno('mese', '2026-01-15', -1)).toBe('2025-12-01')
    expect(spostaGiorno('anno', '2026-07-15', 1)).toBe('2027-07-01')
    expect(spostaGiorno('settimana', '2026-10-01', 1)).toBe('2026-10-08')
    expect(spostaGiorno('giorno', '2026-10-01', -1)).toBe('2026-09-30')
  })

  it('il periodo si dice a parole', () => {
    expect(nomeDelPeriodo('anno', '2026-07-15')).toBe('2026')
    // Mese e settimana come nelle chiusure, la settimana con l'anno.
    expect(nomeDelPeriodo('mese', '2026-07-15')).toBe('luglio 2026')
    expect(nomeDelPeriodo('settimana', '2026-10-01')).toBe('28 set – 4 ott 2026')
    expect(nomeDelPeriodo('giorno', '2026-10-01')).toBe('giovedì 1 ottobre 2026')
  })
})

// Due macro, come nel foglio. Il gin è dei distillati; la Schweppes venduta
// da sola è una bibita.
const macros = [
  { id: 'alc', name: 'Distillati', pesi_voci: { gintonic: 100 }, pesi_prodotti: { gin: 100 } },
  { id: 'bib', name: 'Birre e bibite', pesi_voci: { schweppes: 100 }, pesi_prodotti: {} },
]
const items = [{ id: 'gin', unit: 'pz', cost: 5, vat: 22 }]
const drinksById = { gintonic: { id: 'gintonic' }, schweppes: { id: 'schweppes' } }
const conto = (at, drink_id, qty, unit_price) => ({
  status: 'pagato',
  created_at: at,
  order_items: [{ drink_id, qty, unit_price }],
})
// Due gin consegnati il 2 luglio, a 5 € netti l'uno.
const ordineFornitore = {
  status: 'inviato',
  lines: [{ item_id: 'gin', unit_cost: 5, qty_packages: 2, stato: 'consegnato', delivered_at: '2026-07-02T10:00:00.000Z' }],
}
const base = {
  orders: [conto('2026-07-03T20:00:00.000Z', 'gintonic', 2, 10), conto('2026-07-04T21:00:00.000Z', 'schweppes', 1, 4)],
  purchaseOrders: [ordineFornitore],
  items,
  drinksById,
  macros,
  saleVat: 10,
}

describe('la tabella', () => {
  it('per ogni macro acquisti, fatturato, utile, rapporto e incidenza, come il foglio', () => {
    const r = acquistiFatturato({ ...base, colonne: colonneDelBilancio('anno', '2026-07-15') })
    const alc = r.rows.find((x) => x.id === 'alc').perColonna.get('2026-07')
    const bib = r.rows.find((x) => x.id === 'bib').perColonna.get('2026-07')
    // Al lordo: 2 gin a 5 € + IVA 22% = 12,20; fatturato 20.
    expect(alc.costo).toBeCloseTo(12.2, 2)
    expect(alc.incasso).toBe(20)
    expect(alc.margine).toBeCloseTo(7.8, 2)
    expect(alc.rapporto).toBeCloseTo(1.64, 2)
    // Le bibite non hanno acquisti: il rapporto non c'è, l'utile sì.
    expect(bib.rapporto).toBeNull()
    expect(bib.margine).toBe(4)
    // Incidenza: 7,8 e 4 su 11,8 di utili.
    expect(alc.incidenza).toBeCloseTo(66.1, 1)
    expect(bib.incidenza).toBeCloseTo(33.9, 1)
    // Sotto i totali: luglio è tutto il fatturato dell'anno.
    expect(r.totPerColonna.get('2026-07').incidenzaPeriodo).toBe(100)
    expect(r.grand.incasso).toBe(24)
  })

  // Al netto: l'incassato scorporato con l'IVA di vendita, gli acquisti al
  // costo del documento.
  it('al netto l’incassato è scorporato e gli acquisti sono senza IVA', () => {
    const r = acquistiFatturato({ ...base, colonne: colonneDelBilancio('anno', '2026-07-15'), lordo: false })
    const alc = r.rows.find((x) => x.id === 'alc').perColonna.get('2026-07')
    expect(alc.costo).toBe(10)
    expect(alc.incasso).toBeCloseTo(18.18, 2)
  })

  // La nottata resta della sera prima: un conto delle 02:30 dell'8 luglio
  // (ora di Roma) è del 7, quindi della prima settimana.
  it('ogni colonna è fatta di giornate commerciali', () => {
    const r = acquistiFatturato({
      ...base,
      orders: [conto('2026-07-08T00:30:00.000Z', 'gintonic', 1, 10)],
      purchaseOrders: [],
      colonne: colonneDelBilancio('mese', '2026-07-15'),
    })
    const alc = r.rows.find((x) => x.id === 'alc').perColonna
    expect(alc.get('2026-07-01').incasso).toBe(10)
    expect(alc.get('2026-07-08').incasso).toBe(0)
  })

  it('i carichi diretti sono acquisti, le consegne d’ordine non si contano due volte', () => {
    const r = acquistiFatturato({
      ...base,
      orders: [],
      purchaseOrders: [],
      movimenti: [
        { item_id: 'gin', type: 'load', qty: 3, unit: 'pz', reason: 'carico', created_at: '2026-07-10T10:00:00.000Z' },
        { item_id: 'gin', type: 'load', qty: 9, unit: 'pz', reason: 'ordine fornitore', created_at: '2026-07-10T10:00:00.000Z' },
      ],
      colonne: colonneDelBilancio('anno', '2026-07-15'),
      lordo: false,
    })
    expect(r.rows.find((x) => x.id === 'alc').perColonna.get('2026-07').costo).toBe(15)
  })

  // Senza data una consegna non si colloca: non deve finire nel giorno di
  // oggi, che è quello che farebbe una giornata calcolata su «adesso».
  it('una consegna senza data non entra in nessuna colonna', () => {
    const senzaData = { status: 'inviato', lines: [{ item_id: 'gin', unit_cost: 5, qty_packages: 1, stato: 'consegnato' }] }
    const oggi = new Date().toISOString().slice(0, 10)
    const r = acquistiFatturato({ ...base, orders: [], purchaseOrders: [senzaData], colonne: colonneDelBilancio('giorno', oggi) })
    expect(r.grand.costo).toBe(0)
  })

  it('quello che nessuna macro reclama sta in «Non attribuito», non sparisce', () => {
    const r = acquistiFatturato({
      ...base,
      orders: [conto('2026-07-03T20:00:00.000Z', 'libero', 1, 7)],
      purchaseOrders: [],
      colonne: colonneDelBilancio('anno', '2026-07-15'),
    })
    expect(r.rows.find((x) => x.id === UNASSIGNED).tot.incasso).toBe(7)
  })

  it('i conti annullati e quelli fuori periodo non contano', () => {
    const r = acquistiFatturato({
      ...base,
      orders: [{ ...conto('2026-07-03T20:00:00.000Z', 'gintonic', 1, 10), status: 'annullato' }, conto('2025-07-03T20:00:00.000Z', 'gintonic', 1, 10)],
      purchaseOrders: [],
      colonne: colonneDelBilancio('anno', '2026-07-15'),
    })
    expect(r.grand.incasso).toBe(0)
  })
})
