'use strict'

// L'ELENCO DELLE SERATE: la lista che si apre nelle statistiche, costruita
// dalle chiusure di cassa e dagli ordini CHE CI SONO GIÀ. È la parte che
// decide cosa si legge in riga — e in riga si confrontano due sabati, quindi
// ordine, etichette e numeri sono la specifica, non un dettaglio.

import { describe, it, expect } from 'vitest'
import { elencoSerate, etichettaSerata, durataSerata } from '../../src/lib/serate.js'

const conto = (id, at, total, extra = {}) => ({
  id,
  status: 'pagato',
  payment_status: 'pagato',
  created_at: at,
  paid_at: at,
  total,
  discount_amount: 0,
  order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, unit_price: total }],
  payments: [{ method: 'banco', amount: total, at }],
  ...extra,
})

// Serata dell'8: apre alle 19 (ora italiana), chiude alle 2:30 del giorno
// dopo. La mezzanotte in mezzo non la spezza.
const s8 = {
  id: 's8',
  status: 'closed',
  opened_at: '2026-08-08T17:00:00.000Z',
  closed_at: '2026-08-09T00:30:00.000Z',
  snapshot: { incassato: 150, nPagati: 2 },
}
const s7 = {
  id: 's7',
  status: 'closed',
  opened_at: '2026-08-07T17:00:00.000Z',
  closed_at: '2026-08-07T22:00:00.000Z',
  snapshot: { incassato: 999, nPagati: 1 },
}
const aperta = {
  id: 's9',
  status: 'open',
  opened_at: '2026-08-09T17:00:00.000Z',
  closed_at: null,
  snapshot: {},
}

const ordini = [
  conto('a', '2026-08-08T19:00:00.000Z', 100),
  // Dopo la mezzanotte, ma sempre della serata dell'8.
  conto('b', '2026-08-08T23:30:00.000Z', 50),
  conto('c', '2026-08-07T20:00:00.000Z', 999),
  conto('d', '2026-08-09T20:00:00.000Z', 40),
]

const ADESSO = '2026-08-09T22:00:00.000Z'

describe('elencoSerate', () => {
  it('mette la serata più recente in cima, comunque arrivino le sessioni', () => {
    const righe = elencoSerate([s7, aperta, s8], ordini, { adesso: ADESSO })
    expect(righe.map((r) => r.id)).toEqual(['s9', 's8', 's7'])
  })

  // I TRE NUMERI DELLA RIGA. Incasso è la domanda, conti e scontrino medio
  // sono il perché: la stessa cifra fatta da venti conti da 15 € o da cinque
  // da 60 sono due serate diverse.
  it('dà incasso, conti e scontrino medio della finestra della cassa', () => {
    const [riga] = elencoSerate([s8], ordini, { adesso: ADESSO })
    // 100 + 50 dell'8; i 999 della sera prima e i 40 di quella dopo fuori.
    expect(riga.incasso).toBe(150)
    expect(riga.conti).toBe(2)
    expect(riga.scontrinoMedio).toBe(75)
  })

  // LA CASSA ANCORA APERTA C'È, ed è la prima riga: mentre si lavora è la
  // serata che interessa di più. I numeri sono quelli di adesso.
  it('tiene in lista la cassa ancora aperta, marcata «in corso»', () => {
    const [riga] = elencoSerate([s8, aperta], ordini, { adesso: ADESSO })
    expect(riga.id).toBe('s9')
    expect(riga.inCorso).toBe(true)
    expect(riga.orario).toMatch(/in corso$/)
    expect(riga.incasso).toBe(40)
  })

  it('scrive giorno, orari e durata della serata', () => {
    const [riga] = elencoSerate([s8], ordini, { adesso: ADESSO })
    expect(riga.giorno).toMatch(/08\/08/)
    // Fuso del locale (Europe/Rome): 19:00 → 02:30.
    expect(riga.orario).toBe('19:00 → 02:30')
    expect(riga.durata).toBe('7h 30m')
  })

  // SERATE VECCHIE: gli ordini scaricati coprono una finestra, oltre quella
  // non c'è niente da ricalcolare. Invece di una riga a zero — che si
  // leggerebbe come «quella sera non ha incassato» — si usano i numeri
  // congelati alla chiusura, che stanno già sulla sessione: nessuna lettura
  // in più, nessuna attesa.
  it('per una serata fuori dagli ordini in mano usa i numeri della chiusura', () => {
    const righe = elencoSerate([s7], [], { adesso: ADESSO })
    expect(righe[0].daSnapshot).toBe(true)
    expect(righe[0].incasso).toBe(999)
    expect(righe[0].conti).toBe(1)
    expect(righe[0].scontrinoMedio).toBe(999)
  })

  it('ma una serata davvero a zero resta a zero, senza inventarsi numeri', () => {
    const vuota = { id: 'v', opened_at: '2026-08-06T17:00:00.000Z', closed_at: '2026-08-06T20:00:00.000Z' }
    const [riga] = elencoSerate([vuota], [], { adesso: ADESSO })
    expect(riga.incasso).toBe(0)
    expect(riga.conti).toBe(0)
    expect(riga.daSnapshot).toBe(false)
  })

  it('scarta le sessioni senza apertura, che non sono una serata', () => {
    expect(elencoSerate([{ id: 'x' }, s8], ordini, { adesso: ADESSO }).map((r) => r.id)).toEqual(['s8'])
  })

  it('senza sessioni non c’è lista, e non esplode', () => {
    expect(elencoSerate()).toEqual([])
    expect(elencoSerate([], [])).toEqual([])
  })
})

describe('etichettaSerata e durataSerata', () => {
  it('l’etichetta dice giorno e orari, «in corso» se la cassa è aperta', () => {
    expect(etichettaSerata(s8)).toMatch(/08\/08 · 19:00→02:30/)
    expect(etichettaSerata(aperta)).toMatch(/in corso$/)
    expect(etichettaSerata(null)).toBe('—')
  })

  it('la durata scende sotto l’ora senza scrivere «0h»', () => {
    expect(durataSerata('2026-08-08T17:00:00.000Z', '2026-08-08T17:45:00.000Z')).toBe('45m')
    // Date storte: meglio niente che «NaN».
    expect(durataSerata('boh', '2026-08-08T17:45:00.000Z')).toBe('')
  })
})
