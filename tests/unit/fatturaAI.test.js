'use strict'

// LA FATTURA LETTA DALL'AI, DA RIVEDERE (REQ-AI-001, src/lib/fatturaAI.js).
// Il cassetto della regia restituisce i dati come sono scritti sul
// documento; qui diventano una proposta nel linguaggio del gestionale: il
// fornitore dell'archivio, i prodotti del magazzino, il costo dopo lo
// sconto. Niente si registra da solo, e dove l'abbinamento non è sicuro si
// lascia scegliere a chi rivede: un fornitore o un prodotto sbagliati sono
// un costo sbagliato.

import { describe, it, expect } from 'vitest'
import {
  fornitoreDellaFattura,
  prodottoDellaRiga,
  costoDellaRiga,
  propostaDaFattura,
  documentoDaProposta,
  righeDaProposta,
  propostaRegistrabile,
} from '../../src/lib/fatturaAI.js'
import { problemaFileFattura } from '../../src/lib/aiApi.js'

const SUPPLIERS = [
  { id: 's1', name: 'Rossi Bevande' },
  { id: 's2', name: 'Caffè Bianchi' },
  { id: 's3', name: 'Distribuzione Sud' },
  { id: 's4', name: 'Distribuzione Nord' },
]
const ITEMS = [
  { id: 'i1', name: 'Gin Tanqueray', unit: 'ml', package_size: 700, vat: 22 },
  { id: 'i2', name: 'Gin', unit: 'ml', package_size: 700, vat: 22 },
  { id: 'i3', name: 'Tonica Fever-Tree', unit: 'pz', package_size: 24, vat: 22 },
  { id: 'i4', name: 'Limoni', unit: 'g', package_size: 1000, vat: 4 },
]
const LISTINI = [{ supplier_id: 's1', item_id: 'i4', code: 'LIM-01', price: 2.5 }]

describe('il fornitore dell’archivio', () => {
  it('le forme sociali e la punteggiatura non contano', () => {
    expect(fornitoreDellaFattura({ ragione_sociale: 'ROSSI BEVANDE S.R.L.' }, SUPPLIERS)?.id).toBe('s1')
    expect(fornitoreDellaFattura({ ragione_sociale: 'Caffe Bianchi spa' }, SUPPLIERS)?.id).toBe('s2')
  })

  it('un nome contenuto nell’altro basta, se è uno solo', () => {
    expect(fornitoreDellaFattura({ ragione_sociale: 'Rossi Bevande e Liquori srl' }, SUPPLIERS)?.id).toBe('s1')
  })

  // «Distribuzione» sta in due fornitori: sceglierne uno sarebbe tirare a
  // indovinare, e la fattura finirebbe sul conto sbagliato.
  it('se due fornitori vanno bene, non sceglie', () => {
    expect(fornitoreDellaFattura({ ragione_sociale: 'Distribuzione' }, SUPPLIERS)).toBeNull()
  })

  it('niente nome sul documento, niente fornitore', () => {
    expect(fornitoreDellaFattura({ ragione_sociale: null }, SUPPLIERS)).toBeNull()
    expect(fornitoreDellaFattura(undefined, SUPPLIERS)).toBeNull()
  })
})

describe('il prodotto del magazzino per una riga', () => {
  it('il codice del listino di quel fornitore vince su tutto', () => {
    const riga = { descrizione: 'AGRUMI SFUSI', codice: 'lim 01' }
    expect(prodottoDellaRiga(riga, { items: ITEMS, listini: LISTINI, supplierId: 's1' })?.id).toBe('i4')
    // Lo stesso codice di un altro fornitore non vale.
    expect(prodottoDellaRiga(riga, { items: ITEMS, listini: LISTINI, supplierId: 's2' })).toBeNull()
  })

  it('per nome: tutte le parole del prodotto nella riga, e vince il più preciso', () => {
    expect(prodottoDellaRiga({ descrizione: 'GIN TANQUERAY LONDON DRY 70CL' }, { items: ITEMS })?.id).toBe('i1')
    expect(prodottoDellaRiga({ descrizione: 'GIN MARE 70CL' }, { items: ITEMS })?.id).toBe('i2')
  })

  // «24x», «20cl», «vap» stanno su metà delle righe di bevande: non sono il
  // nome di niente.
  it('unità e formati non contano', () => {
    expect(prodottoDellaRiga({ descrizione: 'TONICA FEVER TREE 24X20CL VAP' }, { items: ITEMS })?.id).toBe('i3')
  })

  it('a pari merito non sceglie, e senza parole utili nemmeno', () => {
    const doppi = [...ITEMS, { id: 'i5', name: 'Gin Mare' }, { id: 'i6', name: 'Mare Gin' }]
    expect(prodottoDellaRiga({ descrizione: 'GIN MARE 70CL' }, { items: doppi })).toBeNull()
    expect(prodottoDellaRiga({ descrizione: '70CL 6X' }, { items: ITEMS })).toBeNull()
  })
})

describe('il costo di un pezzo', () => {
  it('dopo lo sconto di riga', () => {
    expect(costoDellaRiga({ prezzo_unitario: 20, sconto_percentuale: 10 })).toBe(18)
    expect(costoDellaRiga({ prezzo_unitario: 2.5, sconto_percentuale: null })).toBe(2.5)
  })

  it('senza prezzo unitario, l’importo diviso la quantità', () => {
    expect(costoDellaRiga({ prezzo_unitario: null, importo: 30, quantita: 4 })).toBe(7.5)
    expect(costoDellaRiga({ prezzo_unitario: null, importo: null, quantita: 4 })).toBeNull()
  })
})

const LETTA = {
  fornitore: { ragione_sociale: 'Rossi Bevande srl', partita_iva: '01234567890' },
  numero: 'A/123',
  data: '2026-11-10',
  righe: [
    { descrizione: 'GIN TANQUERAY 70CL', codice: null, quantita: 6, unita: 'bt', prezzo_unitario: 20, sconto_percentuale: 10, aliquota_iva: 22, importo: 108 },
    { descrizione: 'TRASPORTO', codice: null, quantita: 1, unita: null, prezzo_unitario: 5, sconto_percentuale: null, aliquota_iva: 22, importo: 5 },
  ],
  imponibile: 113,
  iva: 24.86,
  totale: 137.86,
  da_verificare: ['la data è poco leggibile'],
}

describe('la proposta', () => {
  const proposta = propostaDaFattura(LETTA, { suppliers: SUPPLIERS, items: ITEMS, listini: LISTINI })

  it('testata dal documento, col fornitore dell’archivio', () => {
    expect(proposta).toMatchObject({
      supplier_id: 's1',
      fornitore_letto: 'Rossi Bevande srl',
      number: 'A/123',
      date: '2026-11-10',
      amount: 137.86,
      daVerificare: ['la data è poco leggibile'],
    })
  })

  // Le righe riconosciute partono spuntate; le altre restano in vista, da
  // abbinare o da lasciare fuori.
  it('righe riconosciute incluse, le altre da abbinare', () => {
    expect(proposta.righe[0]).toMatchObject({ item_id: 'i1', quantita: 6, costo: 18, iva: 22, includi: true })
    expect(proposta.righe[1]).toMatchObject({ item_id: '', letta: 'TRASPORTO', includi: false })
  })

  it('una data che non è una data diventa oggi', () => {
    const p = propostaDaFattura({ ...LETTA, data: '2026-13-45' }, { suppliers: SUPPLIERS, oggi: new Date('2026-11-12T10:00:00Z') })
    expect(p.date).toBe('2026-11-12')
  })

  it('un risultato vuoto non rompe niente', () => {
    expect(propostaDaFattura(null, {})).toMatchObject({ supplier_id: '', righe: [], daVerificare: [] })
  })
})

describe('quello che si registra', () => {
  const proposta = propostaDaFattura(LETTA, { suppliers: SUPPLIERS, items: ITEMS, listini: LISTINI })

  it('il documento ha la forma di «Nuovo documento», ed è una Fattura', () => {
    expect(documentoDaProposta(proposta, SUPPLIERS)).toEqual({
      supplier_id: 's1',
      supplier_name: 'Rossi Bevande',
      number: 'A/123',
      doc_type: 'Fattura',
      date: '2026-11-10',
      amount: 137.86,
      notes: null,
      paid: false,
    })
  })

  it('solo le righe spuntate e abbinate, con quantità, costo e IVA del documento', () => {
    expect(righeDaProposta(proposta, { items: ITEMS, listini: LISTINI })).toEqual([
      { item_id: 'i1', name: 'Gin Tanqueray', unit: 'ml', package_size: 700, qty_packages: 6, unit_cost: 18, vat: 22 },
    ])
    const senza = { ...proposta, righe: proposta.righe.map((r) => ({ ...r, includi: false })) }
    expect(righeDaProposta(senza, { items: ITEMS })).toEqual([])
  })

  it('senza fornitore o senza importo non si registra', () => {
    expect(propostaRegistrabile(proposta)).toBe(true)
    expect(propostaRegistrabile({ ...proposta, supplier_id: '' })).toBe(false)
    expect(propostaRegistrabile({ ...proposta, amount: '' })).toBe(false)
  })
})

// I formati e i pesi del cassetto, controllati prima di spedire.
describe('il file da leggere', () => {
  it('foto e PDF sì, il resto no; e non oltre il peso', () => {
    expect(problemaFileFattura({ type: 'application/pdf', size: 1000 })).toBeNull()
    expect(problemaFileFattura({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(problemaFileFattura({ type: 'text/plain', size: 10 })).toMatch(/foto .* o un PDF/)
    expect(problemaFileFattura({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
    expect(problemaFileFattura({ type: 'application/pdf', size: 6 * 1024 * 1024 })).toBeNull()
  })
})
