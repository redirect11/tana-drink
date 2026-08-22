'use strict'

// L'ELENCO DELLE SERATE: la lista che si apre nelle statistiche, costruita
// dalle chiusure di cassa e dagli ordini CHE CI SONO GIÀ. È la parte che
// decide cosa si legge in riga — e in riga si confrontano due sabati, quindi
// ordine, etichette e numeri sono la specifica, non un dettaglio.

import { describe, it, expect } from 'vitest'
import {
  elencoSerate,
  etichettaSerata,
  durataSerata,
  giornoDellaSerata,
  serataDelGiorno,
  limitiRicercaSerate,
  raggruppaSerate,
  periodoDellaSerata,
  chiaveSettimana,
  chiaveMese,
  etichettaPeriodo,
} from '../../src/lib/serate.js'

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

// ── CERCARE UNA SERATA PER DATA ──────────────────────────────────────
// «aggiungi un selettore di data per cercare una chiusura cassa»
// (l'utente, 22/08/2026). Il punto delicato è UNO SOLO: il giorno di una
// serata è la sua GIORNATA COMMERCIALE, non la data solare degli orari.
// Una serata aperta il 9 alle 02:20 (quindi la nottata dell'8) o chiusa il
// 9 alle 02:30 è la serata dell'8: chi cerca il 9 non deve trovarla, o
// leggerebbe l'incasso della sera sbagliata.
describe('cercare una serata per data', () => {
  // Apre dopo la mezzanotte: solare il 10, commerciale ancora il 9.
  const dopoMezzanotte = {
    id: 'notturna',
    status: 'closed',
    opened_at: '2026-08-10T00:20:00.000Z', // 02:20 in Italia
    closed_at: '2026-08-10T02:00:00.000Z',
    snapshot: { incassato: 80, nPagati: 1 },
  }

  it('trova la serata del giorno cercato', () => {
    expect(serataDelGiorno([s7, s8, aperta], '2026-08-08')).toBe(s8)
    expect(serataDelGiorno([s7, s8, aperta], '2026-08-07')).toBe(s7)
  })

  it('un giorno senza chiusura non ne inventa una: torna null', () => {
    // Il lunedì di riposo, o una serata saltata: capita spesso, e la
    // risposta giusta è «niente», non la serata più vicina.
    expect(serataDelGiorno([s7, s8, aperta], '2026-08-06')).toBe(null)
  })

  it('la serata è quella della GIORNATA COMMERCIALE, non del giorno solare', () => {
    // s8 chiude alle 02:30 del 9: resta la serata dell'8.
    expect(giornoDellaSerata(s8)).toBe('2026-08-08')
    expect(serataDelGiorno([s8], '2026-08-09')).toBe(null)
    // E una cassa aperta alle 02:20 del 10 è ancora la nottata del 9.
    expect(giornoDellaSerata(dopoMezzanotte)).toBe('2026-08-09')
    expect(serataDelGiorno([dopoMezzanotte], '2026-08-10')).toBe(null)
    expect(serataDelGiorno([dopoMezzanotte], '2026-08-09')).toBe(dopoMezzanotte)
  })

  it('una data futura non trova niente, e i limiti non la lasciano scegliere', () => {
    expect(serataDelGiorno([s7, s8, aperta], '2027-01-01')).toBe(null)
    // I bordi del campo data sono la prima e l'ultima serata in mano: oltre
    // l'ultima non c'è futuro da cercare, prima della prima non c'è storia.
    expect(limitiRicercaSerate([s8, s7, aperta])).toEqual({
      dal: '2026-08-07',
      al: '2026-08-09',
    })
  })

  it('senza data e senza sessioni non cerca e non esplode', () => {
    expect(serataDelGiorno([s7, s8], '')).toBe(null)
    expect(serataDelGiorno([s7, s8], null)).toBe(null)
    expect(serataDelGiorno([], '2026-08-08')).toBe(null)
    expect(serataDelGiorno(undefined, '2026-08-08')).toBe(null)
    expect(limitiRicercaSerate([])).toEqual({ dal: null, al: null })
    expect(limitiRicercaSerate()).toEqual({ dal: null, al: null })
    // Una sessione senza apertura non è una serata e non ha un giorno.
    expect(giornoDellaSerata({ id: 'rotta' })).toBe(null)
  })
})

// ── SETTIMANE E MESI ─────────────────────────────────────────────────
//
// «Aggiungi dei filtri alla lista delle chiusure cassa per mostrare quelle
// settimanali o mensili oltre che per data» (l'utente, 22/08/2026). Con la
// lista per serata a «com'è andato agosto?» si risponde sommando a mente
// trenta righe.
//
// I due punti delicati sono il BORDO DELLA SETTIMANA (comincia di lunedì:
// venerdì, sabato e domenica — le tre sere che fanno l'incasso — devono
// cadere insieme) e il BORDO DELLA NOTTE (una cassa aperta alle 02:20 è
// ancora la serata di ieri, quindi la settimana di ieri).
describe('raggruppare le serate per settimana e per mese', () => {
  const perSettimana = (ss) => raggruppaSerate(ss, { raggruppamento: 'settimana' })
  const perMese = (ss) => raggruppaSerate(ss, { raggruppamento: 'mese' })

  // Venerdì 7, sabato 8 e domenica 9 agosto 2026: lo STESSO fine settimana.
  it('la settimana comincia di lunedì, quindi la domenica sta col suo sabato', () => {
    const gruppi = perSettimana([s7, s8, aperta])
    expect(gruppi.length).toBe(1)
    // Col lunedì in testa la chiave è il lunedì 3 agosto. Con la domenica in
    // testa la serata del 9 finirebbe in una riga sua, staccata dal sabato.
    expect(gruppi[0].chiave).toBe('2026-08-03')
    expect(gruppi[0].nSerate).toBe(3)
    expect(gruppi[0].etichetta).toBe('3–9 ago')
  })

  it('e il lunedì apre la settimana dopo, non chiude quella prima', () => {
    const lunedi = {
      id: 'lun',
      status: 'closed',
      opened_at: '2026-08-10T17:00:00.000Z', // lunedì 10, ore 19:00
      closed_at: '2026-08-10T23:00:00.000Z',
      snapshot: { incassato: 200 },
    }
    expect(perSettimana([s8, lunedi]).map((g) => g.chiave)).toEqual([
      '2026-08-10',
      '2026-08-03',
    ])
  })

  // IL BORDO DELLA NOTTE. Una cassa aperta lunedì 10 alle 02:20 è la coda
  // della serata di domenica 9: sta nella settimana di domenica. Se il taglio
  // fosse quello solare, quell'incasso salterebbe nella settimana dopo — e
  // due settimane confrontate sarebbero tutte e due sbagliate.
  it('una serata aperta dopo mezzanotte resta nella settimana della sua nottata', () => {
    const notturna = {
      id: 'notturna',
      status: 'closed',
      opened_at: '2026-08-10T00:20:00.000Z', // 02:20 di lunedì in Italia
      closed_at: '2026-08-10T02:00:00.000Z',
      snapshot: { incassato: 80 },
    }
    const gruppi = perSettimana([s8, notturna])
    expect(gruppi.length).toBe(1)
    expect(gruppi[0].chiave).toBe('2026-08-03')
    expect(periodoDellaSerata(notturna, 'settimana')).toBe('2026-08-03')
    // E lo stesso per il mese: la nottata del 9 è di agosto, non del 10.
    expect(periodoDellaSerata(notturna, 'mese')).toBe('2026-08')
  })

  // I NUMERI DELLA RIGA AGGREGATA: quante serate, quanto in tutto, e quanto a
  // serata. La media è quella che rende confrontabili due settimane di
  // lunghezza diversa — cinque aperture contro tre fanno totali diversi per un
  // motivo che non c'entra con com'è andata la sera.
  it('somma gli incassi, conta le serate e ne fa la media a serata', () => {
    const [g] = perSettimana([s7, s8])
    expect(g.incasso).toBe(1149) // 999 + 150, dai numeri congelati alla chiusura
    expect(g.nSerate).toBe(2)
    expect(g.media).toBe(574.5)
  })

  // La serata di stasera non ha snapshot: nasce alla chiusura. Contarla come
  // zero abbasserebbe la media di tutta la settimana.
  it('la serata ancora aperta non entra nel totale né nella media, e la riga lo dice', () => {
    const [g] = perSettimana([s7, s8, aperta])
    expect(g.nSerate).toBe(3)
    expect(g.incasso).toBe(1149)
    expect(g.serateContate).toBe(2)
    expect(g.media).toBe(574.5)
    expect(g.inCorso).toBe(true)
    // Senza serate aperte la riga non lo dice.
    expect(perSettimana([s7, s8])[0].inCorso).toBe(false)
  })

  // Una settimana può stare a cavallo di due mesi: resta UNA riga, e i suoi
  // giorni finiscono nei mesi giusti quando si guarda per mese.
  it('una settimana a cavallo di due mesi è una riga sola, e i mesi restano distinti', () => {
    const ven31lug = {
      id: 'l31',
      status: 'closed',
      opened_at: '2026-07-31T17:00:00.000Z',
      closed_at: '2026-07-31T23:00:00.000Z',
      snapshot: { incassato: 300 },
    }
    const sab1ago = {
      id: 'a1',
      status: 'closed',
      opened_at: '2026-08-01T17:00:00.000Z',
      closed_at: '2026-08-01T23:00:00.000Z',
      snapshot: { incassato: 500 },
    }
    const [settimana] = perSettimana([ven31lug, sab1ago])
    expect(settimana.chiave).toBe('2026-07-27')
    expect(settimana.nSerate).toBe(2)
    expect(settimana.incasso).toBe(800)
    // L'etichetta scrive tutti e due i mesi: «27–2 ago» sarebbe falso.
    expect(settimana.etichetta).toBe('27 lug – 2 ago')

    const mesi = perMese([ven31lug, sab1ago])
    expect(mesi.map((g) => g.chiave)).toEqual(['2026-08', '2026-07'])
    expect(mesi.map((g) => g.incasso)).toEqual([500, 300])
    expect(mesi[0].etichetta).toBe('agosto 2026')
  })

  // Il locale chiude per ferie, o salta una settimana: quella settimana non è
  // una riga a zero — che si leggerebbe come «è andata male» — semplicemente
  // non c'è.
  it('le settimane e i mesi senza chiusure non compaiono', () => {
    const vecchia = {
      id: 'giugno',
      status: 'closed',
      opened_at: '2026-06-06T17:00:00.000Z',
      closed_at: '2026-06-06T23:00:00.000Z',
      snapshot: { incassato: 100 },
    }
    // Fra giugno e agosto c'è luglio, e non è una riga.
    expect(perMese([s8, vecchia]).map((g) => g.chiave)).toEqual(['2026-08', '2026-06'])
    expect(perSettimana([s8, vecchia]).length).toBe(2)
  })

  it('il periodo più recente sta in cima, e dentro le serate più recenti prima', () => {
    const gruppi = perSettimana([s7, aperta, s8])
    expect(gruppi[0].serate.map((s) => s.id)).toEqual(['s9', 's8', 's7'])
  })

  it('«serata» non raggruppa niente, e i dati storti non fanno esplodere', () => {
    expect(raggruppaSerate([s7, s8], { raggruppamento: 'serata' })).toEqual([])
    expect(raggruppaSerate([s7, s8])).toEqual([])
    expect(raggruppaSerate([s7, s8], { raggruppamento: 'trimestre' })).toEqual([])
    expect(raggruppaSerate([], { raggruppamento: 'mese' })).toEqual([])
    expect(raggruppaSerate(undefined, { raggruppamento: 'mese' })).toEqual([])
    // Una sessione senza apertura non è una serata e non sta in un periodo.
    expect(perMese([{ id: 'rotta' }, s8]).length).toBe(1)
    expect(perMese([{ id: 'rotta' }, s8])[0].nSerate).toBe(1)
    // Una chiusa senza snapshot vale zero, ma la serata c'è stata: conta.
    const senzaNumeri = {
      id: 'muta',
      status: 'closed',
      opened_at: '2026-08-08T17:00:00.000Z',
      closed_at: '2026-08-08T23:00:00.000Z',
    }
    const [g] = perSettimana([s8, senzaNumeri])
    expect(g.nSerate).toBe(2)
    expect(g.incasso).toBe(150)
    expect(g.media).toBe(75)
  })

  it('le chiavi e le etichette reggono il capodanno', () => {
    // La settimana del 31 dicembre 2026 finisce il 3 gennaio 2027: una riga
    // sola, e senza il ballo della «settimana 53».
    expect(chiaveSettimana('2026-12-31')).toBe('2026-12-28')
    expect(chiaveSettimana('2027-01-01')).toBe('2026-12-28')
    expect(etichettaPeriodo('2026-12-28', 'settimana')).toBe('28 dic – 3 gen')
    // Il mese porta l'anno: «gennaio» da solo è la stessa parola ogni anno.
    expect(etichettaPeriodo('2027-01', 'mese')).toBe('gennaio 2027')
    expect(chiaveMese('2026-12-31')).toBe('2026-12')
    expect(chiaveSettimana(null)).toBe(null)
    expect(chiaveSettimana('boh')).toBe(null)
    expect(chiaveMese(null)).toBe(null)
    expect(etichettaPeriodo(null, 'settimana')).toBe('—')
    expect(periodoDellaSerata({ id: 'rotta' }, 'settimana')).toBe(null)
    // Senza raggruppamento il periodo di una serata è il suo giorno.
    expect(periodoDellaSerata(s8, 'serata')).toBe('2026-08-08')
  })
})
