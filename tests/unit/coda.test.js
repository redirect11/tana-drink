'use strict'

// Unit test della logica pura coda (src/lib/coda.js).

import { describe, it, expect } from 'vitest'
import {
  bucketByStatus,
  ordersRecap,
  voceCassa,
  openOrdersCount,
  ordineCorrisponde,
  primoCorrispondente,
  inseritiDa,
  passaFiltroCoda,
  restaInCoda,
  gruppiInCoda,
} from '../../src/lib/coda.js'

const orders = [
  { id: '1', status: 'ricevuto', total: 10 },
  { id: '2', status: 'ricevuto', total: 5 },
  { id: '3', status: 'in_preparazione', total: 8 },
  { id: '4', status: 'pronto', total: 12 },
  { id: '5', status: 'ritirato', total: 20 },
  { id: '6', status: 'annullato', total: 99 },
  { id: '7', status: 'pagato', total: 15 },
]

describe('bucketByStatus', () => {
  it('smista per stato ed esclude gli annullati', () => {
    const b = bucketByStatus(orders)
    expect(b.ricevuto.map((o) => o.id)).toEqual(['1', '2'])
    expect(b.in_preparazione.map((o) => o.id)).toEqual(['3'])
    expect(b.pronto.map((o) => o.id)).toEqual(['4'])
    expect(b.ritirato.map((o) => o.id)).toEqual(['5'])
    expect(b.pagato.map((o) => o.id)).toEqual(['7'])
    // l'annullato non compare in nessun bucket
    expect(Object.values(b).flat().some((o) => o.id === '6')).toBe(false)
  })
})

describe('ordersRecap', () => {
  it('conta e somma i non annullati', () => {
    const r = ordersRecap(orders)
    expect(r.count).toBe(6) // esclude l'annullato, include il pagato
    expect(r.total).toBe(10 + 5 + 8 + 12 + 20 + 15)
  })
  it('separa aperti e chiusi con il predicato', () => {
    const isClosed = (o) => o.payment_status === 'pagato'
    const r = ordersRecap(orders, isClosed)
    expect(r.aperti + r.chiusi).toBe(r.count)
    expect(r.chiusi).toBe(orders.filter((o) => o.status !== 'annullato' && o.payment_status === 'pagato').length)
  })
  it('coda vuota', () => {
    expect(ordersRecap([])).toEqual({ count: 0, total: 0, aperti: 0, chiusi: 0, annullati: 0 })
  })
})

describe('openOrdersCount', () => {
  it('conta i CONTI aperti (non pagati né annullati)', () => {
    // Nel modello conto/comande anche un ordine "ritirato" resta un conto
    // aperto finché non viene incassato.
    expect(openOrdersCount(orders)).toBe(5) // 1,2,3,4,5
  })
})

// Il filtro «Miei» della coda: ha preso il posto della pagina «I miei
// ordini» della sala, quindi deve rispondere come rispondeva lei — i conti
// con la propria firma, nient'altro.
describe('inseritiDa', () => {
  const firmati = [
    { id: 'a', placed_by: { email: 'Anna@tana.it' } },
    { id: 'b', placed_by: { email: 'bruno@tana.it' } },
    { id: 'c' }, // ordine del cliente: nessuna firma
  ]
  it('tiene solo i conti con la propria firma, maiuscole ignorate', () => {
    expect(inseritiDa(firmati, 'anna@tana.it').map((o) => o.id)).toEqual(['a'])
    expect(inseritiDa(firmati, 'BRUNO@tana.it').map((o) => o.id)).toEqual(['b'])
  })
  it('senza email non risponde nulla: mai tutta la coda per sbaglio', () => {
    expect(inseritiDa(firmati, '')).toEqual([])
    expect(inseritiDa(firmati, null)).toEqual([])
  })
  it('coda vuota o assente: lista vuota, niente errori', () => {
    expect(inseritiDa([], 'anna@tana.it')).toEqual([])
    expect(inseritiDa(null, 'anna@tana.it')).toEqual([])
  })
})

// ── Chiusura del conto: pagato NON basta ───────────────────────────────
// Regola voluta dal locale: con la preparazione tracciata un conto esce
// dalla coda solo se è stato PAGATO **e** SERVITO. Pagare in anticipo è
// normale; farlo sparire vorrebbe dire dimenticarsi di consegnarlo.
import { allServed } from '../../src/lib/comande.js'

describe('un conto pagato ma non servito resta da fare', () => {
  const conto = (statoComanda, paymentStatus) => ({
    payment_status: paymentStatus,
    comande: [{ id: 'c1', status: statoComanda }],
  })
  const pagato = (o) => o.payment_status === 'pagato'
  const chiuso = (o, workflowOn) => (workflowOn ? pagato(o) && allServed(o) : pagato(o))

  it('con la preparazione attiva: pagato ma non servito NON è chiuso', () => {
    expect(chiuso(conto('in_preparazione', 'pagato'), true)).toBe(false)
    expect(chiuso(conto('pronto', 'pagato'), true)).toBe(false)
  })

  it('con la preparazione attiva: serve pagato E servito', () => {
    expect(chiuso(conto('ritirato', 'pagato'), true)).toBe(true)
    expect(chiuso(conto('ritirato', 'non_richiesto'), true)).toBe(false) // servito ma da incassare
  })

  it('senza preparazione: il pagamento chiude e basta', () => {
    expect(chiuso(conto('ricevuto', 'pagato'), false)).toBe(true)
  })
})

// ── La ricerca nella coda ──────────────────────────────────────────────
// Stessa funzione per tutti e due i modi (filtra / accendi): se
// rispondessero in modo diverso, cambiando impostazione lo stesso testo
// troverebbe conti diversi e chi sta al banco non capirebbe perché.
describe('ordineCorrisponde', () => {
  const conto = {
    daily_number: 42,
    customer_name: 'Marco Rossi',
    table_label: 'Tavolo 7',
    placed_by: { email: 'anna@tana.it', name: 'Anna' },
    order_items: [{ name: 'Negroni' }, { name: 'Spritz' }],
  }

  it('trova per numero, cliente, tavolo, chi ha battuto e drink', () => {
    expect(ordineCorrisponde(conto, '42')).toBe(true)
    expect(ordineCorrisponde(conto, 'rossi')).toBe(true)
    expect(ordineCorrisponde(conto, 'tavolo 7')).toBe(true)
    expect(ordineCorrisponde(conto, 'anna@')).toBe(true)
    expect(ordineCorrisponde(conto, 'anna')).toBe(true)
    expect(ordineCorrisponde(conto, 'negroni')).toBe(true)
  })

  it('non guarda maiuscole e spazi ai lati', () => {
    // Chi cerca sul tablet scrive di fretta, con la maiuscola automatica.
    expect(ordineCorrisponde(conto, '  NEGRONI ')).toBe(true)
  })

  it('con la ricerca vuota non risponde nessuno', () => {
    // Altrimenti la ricerca vuota "accenderebbe" il primo conto della coda.
    expect(ordineCorrisponde(conto, '')).toBe(false)
    expect(ordineCorrisponde(conto, '   ')).toBe(false)
    expect(ordineCorrisponde(conto, null)).toBe(false)
  })

  it('regge i conti a metà, senza cliente o senza righe', () => {
    expect(ordineCorrisponde({ daily_number: 3 }, 'marco')).toBe(false)
    expect(ordineCorrisponde(null, 'marco')).toBe(false)
  })
})

describe('primoCorrispondente', () => {
  const lista = [
    { id: 'a', daily_number: 1, customer_name: 'Luca' },
    { id: 'b', daily_number: 2, customer_name: 'Marco' },
    { id: 'c', daily_number: 3, customer_name: 'Marcella' },
  ]

  it('accende il PRIMO che risponde, nell ordine in cui sta sullo schermo', () => {
    // "Il primo" vuol dire il primo che si incontra scorrendo la pagina:
    // la lista arriva già ordinata come la si vede.
    expect(primoCorrispondente(lista, 'marc')?.id).toBe('b')
  })

  it('senza nessuna risposta torna niente (e la coda resta intera)', () => {
    expect(primoCorrispondente(lista, 'zzz')).toBe(null)
    expect(primoCorrispondente(lista, '')).toBe(null)
    expect(primoCorrispondente(null, 'marc')).toBe(null)
  })
})

// ── GLI ANNULLATI HANNO UNA TAB LORO ─────────────────────────────────
// Stavano fra i «Chiusi»: facevano numero senza essere incassi, e per
// ritrovarne uno da riaprire bisognava cercarlo in mezzo a quelli buoni.
describe('i filtri della coda', () => {
  const chiuso = (o) => o.workflow_status === 'pagato' || o.workflow_status === 'annullato'
  const aperto = { workflow_status: 'in_preparazione' }
  const pagato = { workflow_status: 'pagato' }
  const buttato = { workflow_status: 'annullato' }

  it('«In corso» lascia solo quello che c’è da fare', () => {
    expect(passaFiltroCoda(aperto, 'attivi', chiuso)).toBe(true)
    expect(passaFiltroCoda(pagato, 'attivi', chiuso)).toBe(false)
    expect(passaFiltroCoda(buttato, 'attivi', chiuso)).toBe(false)
  })

  it('«Chiusi» sono i soldi della serata: gli annullati non ci stanno', () => {
    expect(passaFiltroCoda(pagato, 'chiusi', chiuso)).toBe(true)
    expect(passaFiltroCoda(buttato, 'chiusi', chiuso)).toBe(false)
  })

  it('«Annullati» solo quelli', () => {
    expect(passaFiltroCoda(buttato, 'annullati', chiuso)).toBe(true)
    expect(passaFiltroCoda(pagato, 'annullati', chiuso)).toBe(false)
    expect(passaFiltroCoda(aperto, 'annullati', chiuso)).toBe(false)
  })

  it('«Tutti» non toglie niente, annullati compresi', () => {
    for (const o of [aperto, pagato, buttato]) {
      expect(passaFiltroCoda(o, 'tutti', chiuso)).toBe(true)
    }
  })
})

// LA CODA È IL LAVORO DI ADESSO. Comparivano conti incassati serate prima,
// e anche dopo una chiusura di cassa restavano quelli della tornata già
// rendicontata: la coda i conti aperti li tiene d'occhio senza limite di
// data — apposta, si chiudono a mano — e chi era rimasto indietro con gli
// stati continuava a passare da lì.
describe('cosa resta in coda', () => {
  const cassa = 'cassa-2'
  const apertaDa = '2026-08-16T18:00:00.000Z'

  it('un conto annullato ADESSO resta, anche se era aperto da ieri', () => {
    // Era il caso che spariva: si annulla un conto vecchio e quello
    // svanisce nell'istante in cui lo si annulla, senza sapere se
    // l'operazione è andata a buon fine.
    const vecchioAnnullatoOra = {
      cash_session_id: 'cassa-1',
      tempi_conto: { annullato: '2026-08-16T22:10:00.000Z' },
    }
    expect(restaInCoda(vecchioAnnullatoOra, { chiuso: true, cassa, apertaDa })).toBe(true)
  })

  it('quello annullato o incassato PRIMA di questa apertura è storia', () => {
    const primaDiOggi = {
      cash_session_id: 'cassa-1',
      paid_at: '2026-08-15T23:00:00.000Z',
    }
    expect(restaInCoda(primaDiOggi, { chiuso: true, cassa, apertaDa })).toBe(false)
  })

  it('quello incassato in questa apertura resta: sono i soldi di adesso', () => {
    const ora = { cash_session_id: 'cassa-2', paid_at: '2026-08-16T21:00:00.000Z' }
    expect(restaInCoda(ora, { chiuso: true, cassa, apertaDa })).toBe(true)
  })

  it('senza orario di chiusura vale la sessione scritta sull’ordine', () => {
    expect(restaInCoda({ cash_session_id: 'cassa-1' }, { chiuso: true, cassa, apertaDa })).toBe(false)
    expect(restaInCoda({ cash_session_id: 'cassa-2' }, { chiuso: true, cassa, apertaDa })).toBe(true)
  })

  it('a cassa chiusa non resta nessun conto chiuso', () => {
    expect(
      restaInCoda({ cash_session_id: 'cassa-2' }, { chiuso: true, cassa: null, apertaDa: null })
    ).toBe(false)
  })

  it('un conto APERTO resta comunque: quello è da chiudere', () => {
    expect(restaInCoda({ cash_session_id: 'cassa-1' }, { chiuso: false, cassa, apertaDa })).toBe(true)
  })

  it('senza cassa e senza orario si guarda la giornata', () => {
    // Chi la cassa non la apre mai non ha altro riferimento.
    expect(restaInCoda({}, { chiuso: true, giornata: '2026-08-15', oggi: '2026-08-16' })).toBe(false)
    expect(restaInCoda({}, { chiuso: true, giornata: '2026-08-16', oggi: '2026-08-16' })).toBe(true)
    expect(restaInCoda({}, { chiuso: true, giornata: null, oggi: '2026-08-16' })).toBe(true)
  })
})

// GLI ANNULLATI SI CONTANO A PARTE. Non sono soldi — fuori dal totale — ma
// tre conti saltati in una serata sono una domanda da farsi, e chi sta al
// banco deve poterli vedere senza cambiare tab.
describe('gli annullati nel riepilogo', () => {
  const ordini = [
    { id: 'a', status: 'aperto', total: 20 },
    { id: 'b', status: 'pagato', total: 30 },
    { id: 'c', status: 'annullato', total: 50 },
    { id: 'd', workflow_status: 'annullato', total: 10 },
  ]
  const chiuso = (o) => o.status === 'pagato'

  it('si contano, ma non fanno numero fra aperti e chiusi', () => {
    const r = ordersRecap(ordini, chiuso)
    expect(r.annullati).toBe(2)
    expect(r.aperti).toBe(1)
    expect(r.chiusi).toBe(1)
  })

  it('e non entrano nel totale: quelli sono i soldi veri', () => {
    expect(ordersRecap(ordini, chiuso).total).toBe(50)
  })
})

// LA CASSA È DEL BANCO. Aprirla e chiuderla si fa dalla schermata in cui si
// sta già, ma chi serve ai tavoli non ci mette mano: un tasto che risponde
// «non puoi» è peggio di un tasto che non c'è.
describe('la voce della cassa nel menu della coda', () => {
  it('alla sala non compare affatto', () => {
    expect(voceCassa({ gestore: false, cassaAperta: false })).toBe(null)
    expect(voceCassa({ gestore: false, cassaAperta: true })).toBe(null)
  })

  it('cassa chiusa: al banco compare «Apri cassa»', () => {
    expect(voceCassa({ gestore: true, cassaAperta: false })).toMatchObject({
      id: 'apri-cassa',
      disabled: false,
    })
  })

  it('cassa aperta e conti tutti incassati: si può chiudere', () => {
    expect(voceCassa({ gestore: true, cassaAperta: true, contiAperti: 0 })).toMatchObject({
      id: 'chiudi-cassa',
      disabled: false,
    })
  })

  it('con conti aperti la chiusura è spenta, e dice quanti sono', () => {
    // Un conto aperto è un incasso che manca: chiudere così vorrebbe dire
    // far quadrare una serata con dentro un buco.
    const v = voceCassa({ gestore: true, cassaAperta: true, contiAperti: 3 })
    expect(v.disabled).toBe(true)
    expect(v.hint).toContain('3')
  })
})

// ── I GRUPPI IN CODA ─────────────────────────────────────────────────
// Chi non usa i gruppi si ritrovava in coda un riquadro che diceva «i
// gruppi sono spenti»: un cartello su una cosa che non ha, nello spazio
// che serve agli ordini.
describe('gruppi: pannello, cartello o niente', () => {
  it('spenti: niente, nemmeno coi pannelli aperti', () => {
    expect(gruppiInCoda({ accesi: false, inCoda: false, pannelli: true })).toBe(null)
    expect(gruppiInCoda({ accesi: false, inCoda: true, pannelli: true })).toBe(null)
  })

  it('accesi e da mostrare in coda: il pannello', () => {
    expect(gruppiInCoda({ accesi: true, inCoda: true, pannelli: false })).toBe('pannello')
  })

  it('accesi ma tenuti fuori dalla coda: il cartello, e solo a pannelli aperti', () => {
    // Chi apre i «Pannelli» dal ⋯ e non trova niente pensa a un tasto
    // rotto: la riga dice dove si cambia idea.
    expect(gruppiInCoda({ accesi: true, inCoda: false, pannelli: true })).toBe('cartello')
    expect(gruppiInCoda({ accesi: true, inCoda: false, pannelli: false })).toBe(null)
  })
})
