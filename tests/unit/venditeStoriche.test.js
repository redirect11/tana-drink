import { describe, it, expect } from 'vitest'
import {
  chiaveNome,
  contiDaRighe,
  contoStorico,
  istanteTiller,
  numeroTiller,
  unisciVendite,
  indiceSerate,
  serateDaTiller,
  vendutoPerProdotto,
} from '../../src/lib/venditeStoriche.js'
import { orderNet } from '../../src/lib/eta.js'

// LE VENDITE DI TILLER (REQ-STAT-006). Prima dell'app il locale batteva su
// Tiller, e Flavio vuole le vendite «dal 2024» nelle statistiche e nel
// bilancio. Le righe qui sotto vengono dagli export veri.

const riga = (extra = {}) => ({
  file: 'a.csv',
  'ID ordine': '76DD85AE',
  'Data di apertura': '2026-01-02 23:05:44',
  'Data di chiusura': '2026-01-02 23:06:15',
  Prodotto: 'CERES',
  'Quantità': '2',
  'Codice del buono regalo': '',
  'Prezzo unitario (IVA incl.)': '4,00',
  Sconti: '0,00',
  'Vendite (IVA incl.)': '8,00',
  ...extra,
})

describe('leggere gli export di Tiller', () => {
  it('i numeri sono all’italiana', () => {
    expect(numeroTiller('1.234,50')).toBe(1234.5)
    expect(numeroTiller('')).toBe(0)
  })

  // Le date di Tiller sono in ora italiana: d'inverno un'ora avanti, d'estate due.
  it('l’ora italiana diventa un istante, con l’ora legale', () => {
    expect(istanteTiller('2026-01-02 22:35:23')).toBe('2026-01-02T21:35:23.000Z')
    expect(istanteTiller('2026-07-02 22:35:23')).toBe('2026-07-02T20:35:23.000Z')
  })

  it('le righe di un conto stanno insieme, nel giorno in cui si è aperto', () => {
    const giorni = contiDaRighe([riga(), riga({ Prodotto: 'HENDRIKS', 'Quantità': '1', 'Prezzo unitario (IVA incl.)': '8,00', 'Vendite (IVA incl.)': '8,00' })])
    expect([...giorni.keys()]).toEqual(['2026-01-02'])
    const [conto] = giorni.get('2026-01-02')
    expect(conto.righe.map((r) => r.nome)).toEqual(['CERES', 'HENDRIKS'])
    expect(conto.aperto).toBe('2026-01-02T22:05:44.000Z')
  })

  // Un file finisce il 2 gennaio, il dopo comincia il 1°: lo stesso conto
  // c'è due volte.
  it('un conto che compare in due file si conta una volta', () => {
    const giorni = contiDaRighe([riga({ file: 'a.csv' }), riga({ file: 'b.csv' })])
    expect(giorni.get('2026-01-02')[0].righe).toHaveLength(1)
  })

  // I nomi di Tiller e dell'app non sempre coincidono: l'abbinamento resta
  // sulla riga, e il nome di Tiller anche.
  it('l’abbinamento a una voce dell’app resta sulla riga', () => {
    const giorni = contiDaRighe([riga({ Prodotto: 'GIN TONIC' })], { 'GIN TONIC': 'GIN TONIC (VETRO)' })
    const [r] = giorni.get('2026-01-02')[0].righe
    expect(r).toMatchObject({ nome: 'GIN TONIC', voce: 'GIN TONIC (VETRO)' })
    const c = contoStorico({ id: 'X', aperto: 'a', chiuso: 'b', righe: [r] }, new Map([[chiaveNome('Gin Tonic (vetro)'), { id: 'gtv' }]]))
    expect(c.order_items[0]).toMatchObject({ drink_id: 'gtv', name: 'GIN TONIC' })
  })

  // «Codice del buono regalo» è la variante scelta su un tasto generico.
  it('la variante di un tasto generico resta come nota', () => {
    const giorni = contiDaRighe([riga({ Prodotto: 'SHOT 2,50', 'Codice del buono regalo': 'Sambuca' })])
    expect(giorni.get('2026-01-02')[0].righe[0].nota).toBe('Sambuca')
  })
})

describe('un conto di Tiller come un conto dell’app', () => {
  const perNome = new Map([[chiaveNome("Tennent's Super cl33"), { id: 'tennents' }]])

  it('i nomi si abbinano senza maiuscole e apostrofi diversi', () => {
    const c = contoStorico(
      { id: 'X', aperto: 'a', chiuso: 'b', righe: [{ nome: 'TENNENT’S SUPER CL33', qty: 1, prezzo: 4, sconto: 0, incasso: 4 }] },
      perNome
    )
    expect(c.order_items[0].drink_id).toBe('tennents')
    expect(c.status).toBe('pagato')
  })

  // L'incasso del conto è la somma di quello che è entrato, riga per riga:
  // il listino meno lo sconto non sempre ci arriva.
  it('l’incasso è la somma delle righe, sconto compreso', () => {
    const c = contoStorico(
      {
        id: 'X',
        aperto: 'a',
        chiuso: 'b',
        righe: [
          { nome: 'GIN TONIC', qty: 4, prezzo: 6, sconto: 12, incasso: 12 },
          { nome: 'FOOD 4', qty: 1, prezzo: 4, sconto: 0, incasso: 2.86 },
        ],
      },
      new Map()
    )
    expect(c.total).toBe(28)
    expect(orderNet(c)).toBe(14.86)
    expect(c.order_items[1].drink_id).toBeNull()
  })
})

describe('app e Tiller insieme, un sistema per giornata', () => {
  const giornata = (giorno, aperto) => ({
    giorno,
    conti: [{ id: giorno, aperto, chiuso: aperto, righe: [{ nome: 'CERES', qty: 1, prezzo: 4, sconto: 0, incasso: 4 }] }],
  })

  it('dove l’app non ha conti valgono quelli di Tiller', () => {
    const tutti = unisciVendite([], [giornata('2026-08-01', '2026-08-01T21:00:00.000Z')])
    expect(tutti).toHaveLength(1)
    expect(tutti[0].origine).toBe('tiller')
  })

  // Dal 26 al 28 agosto 2026 i conti di Tiller risultano ribattuti
  // nell'app a fine serata: sommarli li conterebbe due volte.
  it('in una giornata con conti dell’app, quelli di Tiller non contano', () => {
    const app = [{ id: 'a1', status: 'pagato', created_at: '2026-08-27T00:33:00.000Z', total: 5 }]
    // 26/08 alle 23:00 italiane e il conto dell'app alle 02:33 del 27: la stessa serata.
    const tutti = unisciVendite(app, [giornata('2026-08-26', '2026-08-26T21:00:00.000Z')])
    expect(tutti.map((o) => o.id)).toEqual(['a1'])
  })

  it('si tagliano le giornate fuori dal periodo chiesto', () => {
    const tutti = unisciVendite(
      [],
      [giornata('2026-07-31', '2026-07-31T21:00:00.000Z'), giornata('2026-08-01', '2026-08-01T21:00:00.000Z')],
      { dal: '2026-08-01', al: '2026-08-31' }
    )
    expect(tutti.map((o) => o.created_at)).toEqual(['2026-08-01T21:00:00.000Z'])
  })
})

// I due riassunti che l'import scrive accanto alle giornate: le schermate
// leggono quelli, non le quasi mille giornate.
describe('i riassunti dell’import', () => {
  const conto = (id, aperto, chiuso, righe) => ({ id, aperto, chiuso, righe })
  const giorni = new Map([
    [
      '2024-06-01',
      [
        conto('A', '2024-06-01T19:00:00.000Z', '2024-06-01T19:30:00.000Z', [{ nome: 'CERES', qty: 2, prezzo: 4, sconto: 0, incasso: 8 }]),
        conto('B', '2024-06-01T22:00:00.000Z', '2024-06-01T23:10:00.000Z', [{ nome: 'GIN TONIC', voce: 'GIN TONIC (VETRO)', qty: 1, prezzo: 6, sconto: 0, incasso: 6 }]),
      ],
    ],
    // L'una di notte del 2 giugno, ora italiana: è ancora la serata del 1°.
    ['2024-06-02', [conto('C', '2024-06-01T23:00:00.000Z', '2024-06-01T23:20:00.000Z', [{ nome: 'CERES', qty: 1, prezzo: 4, sconto: 0, incasso: 4 }])]],
  ])

  it('una serata per giornata commerciale, dal primo conto all’ultimo', () => {
    expect(indiceSerate(giorni)).toEqual([
      { giorno: '2024-06-01', aperto: '2024-06-01T19:00:00.000Z', chiuso: '2024-06-01T23:20:00.000Z', incassato: 18, conti: 3 },
    ])
  })

  // Un giorno con una chiusura vera dell'app la tiene lei.
  it('le serate di Tiller diventano chiusure, tranne dove c’è già quella dell’app', () => {
    const serate = indiceSerate(giorni)
    const [s] = serateDaTiller(serate, [])
    expect(s).toMatchObject({ id: 'tiller:2024-06-01', origine: 'tiller', snapshot: { incassato: 18, nPagati: 3 } })
    expect(serateDaTiller(serate, [{ opened_at: '2024-06-01T17:00:00.000Z' }])).toEqual([])
  })

  // Dalle voci vendute agli ingredienti con le ricette, nell'unità della
  // giacenza: 3 Ceres a bottiglia e 5 cl di gin da una bottiglia da 70.
  it('il venduto per prodotto di magazzino, giorno per giorno', () => {
    const drinks = [
      { id: 'ceres', name: 'CERES', recipe_items: [{ inventory_item_id: 'b-ceres', unit: 'pz', qty: 1 }] },
      { id: 'gtv', name: 'GIN TONIC (VETRO)', recipe_items: [{ inventory_item_id: 'gin', unit: 'ml', qty: 50 }] },
    ]
    const items = [
      { id: 'b-ceres', unit: 'pz' },
      { id: 'gin', unit: 'pz', package_size: 700, content_unit: 'ml' },
    ]
    const v = vendutoPerProdotto(giorni, { drinks, items })
    expect(v.get('b-ceres')).toEqual({ '2024-06-01': 3 })
    expect(v.get('gin')).toEqual({ '2024-06-01': 0.0714 })
  })
})
