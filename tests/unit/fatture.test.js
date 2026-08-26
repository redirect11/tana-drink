'use strict'

// ── I PRODOTTI DI UNA FATTURA FORNITORE (REQ-MAG-030) ────────────────
//
// Flavio, guardando lo scadenzario il 26/08/2026: «sotto mi deve apparire un
// tasto che fa il carico. Dobbiamo usare un'altra dicitura sicuramente, tipo
// AGGIUNGI PRODOTTI magari, e ci mettiamo anche i prodotti [...] Sempre che
// poi dopo mi fa la domanda se voglio aggiornare il prezzo — nel caso lo
// vado a modificare — oppure lasciarlo invariato, così, senza carico, perché
// magari me li sono caricati già prima in altro modo».
//
// Qui si prova la parte che decide: quale prezzo sta in archivio, quando c'è
// davvero una domanda da fare, e cosa si può riprendere da un ordine.

import { describe, it, expect } from 'vitest'
import {
  righeFattura,
  totaliRigheFattura,
  prezzoInArchivio,
  prezzoDiverso,
  rigaDaProdotto,
  ordiniRiprendibili,
  righeDaOrdine,
} from '../../src/lib/fatture.js'

const CAMPARI = { id: 'campari', name: 'Campari', unit: 'pz', package_size: 700, cost: 12, vat: 22 }
const LISTINI = [
  { id: 'nova__campari', supplier_id: 'nova', item_id: 'campari', price: 12.5 },
  { id: 'enofel__campari', supplier_id: 'enofel', item_id: 'campari', price: 11.9 },
]

describe('le righe di una fattura', () => {
  // Nessuna fattura in archivio ha righe: prima di questa voce il documento
  // era solo una testata. Non è un errore, è la normalità di partenza.
  it('una fattura senza righe ne ha zero, non esplode', () => {
    expect(righeFattura({ id: 'inv1', amount: 100 })).toEqual([])
    expect(righeFattura(null)).toEqual([])
  })

  it('il netto è quello delle righe, confezioni per prezzo', () => {
    const totali = totaliRigheFattura([
      { qty_packages: 6, unit_cost: 12, vat: 22 },
      { qty_packages: 2, unit_cost: 20, vat: 22 },
    ])
    expect(totali.net).toBeCloseTo(112, 2)
    expect(totali.pieces).toBe(8)
  })
})

describe('il prezzo che sta in archivio', () => {
  // È quello del listino DI QUEL FORNITORE (REQ-MAG-029): lo stesso Campari
  // costa 12,50 da Nova e 11,90 da Enofel, e la domanda va fatta sul numero
  // giusto.
  it('è quello del listino di quel fornitore', () => {
    expect(prezzoInArchivio(CAMPARI, LISTINI, 'nova')).toBe(12.5)
    expect(prezzoInArchivio(CAMPARI, LISTINI, 'enofel')).toBe(11.9)
  })

  // Sono 378 prodotti su 388 a non stare sul listino di nessuno: senza riga
  // si ricade sul costo del prodotto, che è l'ultimo pagato a chiunque.
  it('senza riga di listino si ricade sul costo del prodotto', () => {
    expect(prezzoInArchivio(CAMPARI, [], 'nova')).toBe(12)
    expect(prezzoInArchivio({ id: 'x', name: 'X' }, [], 'nova')).toBe(null)
  })
})

describe('la domanda sul prezzo si fa solo dove serve', () => {
  it('un prezzo uguale non fa nessuna domanda', () => {
    expect(prezzoDiverso(12.5, 12.5)).toBe(false)
    // Sotto il centesimo non c'è niente da chiedere: chiederlo comunque
    // insegnerebbe a rispondere senza leggere.
    expect(prezzoDiverso(12.5, 12.502)).toBe(false)
  })

  it('un prezzo cambiato la fa, in su come in giù', () => {
    expect(prezzoDiverso(12.5, 13.5)).toBe(true)
    expect(prezzoDiverso(12.5, 11)).toBe(true)
  })

  it('senza un prezzo in archivio non c’è niente da confrontare', () => {
    expect(prezzoDiverso(null, 13.5)).toBe(false)
    expect(prezzoDiverso(12.5, '')).toBe(false)
  })
})

describe('una riga nuova parte dal prezzo in archivio', () => {
  // Chi compila corregge solo dove il documento dice un numero diverso: è lì
  // che compare la domanda, e solo lì.
  it('propone il prezzo del listino di quel fornitore', () => {
    const riga = rigaDaProdotto(CAMPARI, { listini: LISTINI, supplierId: 'enofel', qty: 6 })
    expect(riga).toMatchObject({ item_id: 'campari', qty_packages: 6, unit_cost: 11.9, vat: 22 })
    // La confezione se la porta dietro: le quantità in magazzino sono in
    // unità base, e senza il contenuto del pezzo il carico non saprebbe
    // quanti millilitri sono sei bottiglie.
    expect(riga.package_size).toBe(700)
  })
})

describe('riprendere le righe da un ordine è una comodità, non un legame', () => {
  const ordine = {
    id: 'po-1',
    created_at: '2026-08-20T09:00:00.000Z',
    lines: [
      { item_id: 'campari', name: 'Campari', qty_packages: 6, unit_cost: 12.5, vat: 22, supplier_id: 'nova', stato: 'consegnato' },
      { item_id: 'gin', name: 'Gin Mare', qty_packages: 1, unit_cost: 30, vat: 22, supplier_id: 'enofel', stato: 'consegnato' },
    ],
  }

  it('si pescano solo gli ordini di quel fornitore', () => {
    expect(ordiniRiprendibili([ordine], 'nova').map((o) => o.id)).toEqual(['po-1'])
    expect(ordiniRiprendibili([ordine], 'altro')).toEqual([])
    expect(ordiniRiprendibili([ordine], null)).toEqual([])
  })

  // La fattura arriva dopo la merce: un ordine ancora tutto «richiesto» non
  // ha niente da fatturare.
  it('e solo quelli che hanno già consegnato qualcosa', () => {
    const soloRichiesto = { ...ordine, lines: ordine.lines.map((l) => ({ ...l, stato: 'richiesto' })) }
    expect(ordiniRiprendibili([soloRichiesto], 'nova')).toEqual([])
  })

  it('le righe copiate sono solo quelle di quel fornitore', () => {
    const righe = righeDaOrdine(ordine, 'nova')
    expect(righe).toHaveLength(1)
    expect(righe[0]).toMatchObject({ item_id: 'campari', qty_packages: 6, unit_cost: 12.5 })
  })

  // È il segno che spegne il carico da solo: quella merce è già entrata in
  // magazzino alla consegna, e caricarla due volte è l'errore da impedire.
  it('e dicono se quella merce è già stata caricata', () => {
    expect(righeDaOrdine(ordine, 'nova')[0].gia_caricata).toBe(true)
    const richiesto = { ...ordine, lines: [{ ...ordine.lines[0], stato: 'richiesto' }] }
    expect(righeDaOrdine(richiesto, 'nova')[0].gia_caricata).toBe(false)
  })

  // Sugli ordini scritti prima di REQ-MAG-029 il fornitore stava
  // sull'ORDINE e non sulla riga: senza questo, un ordine di ieri non si
  // riprenderebbe mai.
  it('un ordine vecchio, col fornitore in testa, si riprende lo stesso', () => {
    const vecchio = {
      id: 'po-0',
      supplier_id: 'nova',
      created_at: '2026-08-01T09:00:00.000Z',
      lines: [{ item_id: 'campari', name: 'Campari', qty_packages: 2, unit_cost: 12, stato: 'consegnato' }],
    }
    expect(ordiniRiprendibili([vecchio], 'nova')).toHaveLength(1)
    expect(righeDaOrdine(vecchio, 'nova')).toHaveLength(1)
  })
})
