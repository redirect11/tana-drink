'use strict'

// Unit test della logica pura coda (src/lib/coda.js).

import { describe, it, expect } from 'vitest'
import {
  bucketByStatus,
  ordersRecap,
  voceCassa,
  comandeDaServire,
  openOrdersCount,
  ordineCorrisponde,
  primoCorrispondente,
  inseritiDa,
  passaFiltroCoda,
  restaInCoda,
  gruppiInCoda,
  schedeCoda,
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
    // far quadrare una serata con dentro un buco. La frase sta accanto al
    // tasto spento, quindi è corta: in cima alla coda lo spazio è quello
    // che avanza.
    const v = voceCassa({ gestore: true, cassaAperta: true, contiAperti: 3 })
    expect(v.disabled).toBe(true)
    expect(v.hint).toBe('Prima chiudi 3 conti')
  })

  it('un conto solo si dice al singolare', () => {
    expect(voceCassa({ gestore: true, cassaAperta: true, contiAperti: 1 }).hint).toBe(
      'Prima chiudi 1 conto'
    )
  })

  // DUE MOTIVI PER NON CHIUDERE. Il secondo è arrivato con gli stati del
  // servizio: un conto può essere già incassato e avere ancora drink da
  // fare, quindi «zero conti aperti» non vuol più dire «niente in ballo».
  // Chiudere con tre comande al banco vuol dire mandare a casa la serata
  // con tre drink pagati e mai usciti.
  it('con comande ancora da servire la cassa non si chiude', () => {
    const v = voceCassa({ gestore: true, cassaAperta: true, contiAperti: 0, daServire: 3 })
    expect(v.disabled).toBe(true)
    expect(v.hint).toBe('Prima servi 3 comande')
  })

  it('una comanda sola si dice al singolare', () => {
    expect(
      voceCassa({ gestore: true, cassaAperta: true, contiAperti: 0, daServire: 1 }).hint
    ).toBe('Prima servi 1 comanda')
  })

  it('tutti e due i motivi stanno in UNA riga', () => {
    // Sotto il tasto, in cima alla coda: due frasi incolonnate non si
    // leggono in un'occhiata, e quello che serve capire è «non si chiude,
    // e perché».
    expect(
      voceCassa({ gestore: true, cassaAperta: true, contiAperti: 2, daServire: 3 }).hint
    ).toBe('Prima chiudi 2 conti e servi 3 comande')
  })

  it('niente in ballo: si chiude, e lo dice', () => {
    const v = voceCassa({ gestore: true, cassaAperta: true, contiAperti: 0, daServire: 0 })
    expect(v.disabled).toBe(false)
    expect(v.hint).toBe('Conta il contante e chiudi la serata.')
  })
})

// Quanti ticket sono ancora al banco. Non si conta guardando i CONTI: uno
// già incassato può avere ancora comande da fare, e sono proprio quelle che
// non devono restare indietro.
describe('quante comande sono ancora da servire', () => {
  const conto = (comande, patch = {}) => ({ status: 'aperto', comande, ...patch })

  it('conta i ticket non serviti, non i conti', () => {
    const lista = [
      conto([
        { id: 'c1', status: 'ricevuto' },
        { id: 'c2', status: 'in_preparazione' },
      ]),
      conto([{ id: 'c1', status: 'pronto' }]),
    ]
    expect(comandeDaServire(lista)).toBe(3)
  })

  it('le servite e le annullate non contano', () => {
    const lista = [
      conto([
        { id: 'c1', status: 'ritirato' },
        { id: 'c2', status: 'annullato' },
        { id: 'c3', status: 'ricevuto' },
      ]),
    ]
    expect(comandeDaServire(lista)).toBe(1)
  })

  it('UN CONTO INCASSATO PUÒ AVERE ANCORA DA FARE, e conta', () => {
    // È il caso per cui esiste questa regola: si paga in anticipo, il
    // conto è chiuso, e il drink è ancora al banco.
    const pagato = conto([{ id: 'c1', status: 'in_preparazione' }], {
      status: 'pagato',
      payment_status: 'pagato',
    })
    expect(comandeDaServire([pagato])).toBe(1)
  })

  it('un conto annullato non ha niente da servire', () => {
    const morto = conto([{ id: 'c1', status: 'ricevuto' }], { status: 'annullato' })
    expect(comandeDaServire([morto])).toBe(0)
    expect(comandeDaServire([])).toBe(0)
    expect(comandeDaServire()).toBe(0)
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

// ── LE SCHEDE DELLA VISTA A SCHEDE ───────────────────────────────────
// Con gli stati di servizio spenti i cinque passi del lavoro non esistono:
// si mostravano lo stesso, quasi tutti vuoti, e i conti stavano tutti sotto
// «Ordine ricevuto».
describe('schede per stato: cosa si mostra', () => {
  it('con gli stati accesi decide il flusso di lavoro', () => {
    expect(schedeCoda(true)).toBe(null)
  })

  it('con gli stati spenti restano in corso, chiusi e annullati', () => {
    // Le stesse tre voci della griglia, con le stesse chiavi di
    // passaFiltroCoda: le due viste devono raccontare la stessa storia.
    expect(schedeCoda(false).map(([k]) => k)).toEqual(['attivi', 'chiusi', 'annullati'])
  })
})

// ── LE CORSIE DI STATO ─────────────────────────────────────────────────
//
// La quarta vista della coda: una colonna per passo del lavoro. Le corsie
// non sono un elenco a parte — si riempiono con le stesse regole della
// griglia — e i due casi che al banco fanno la differenza sono questi: il
// conto pagato in anticipo che NON deve sparire prima di essere
// consegnato, e il conto di una cassa già chiusa che in coda non ci deve
// tornare.
import { azioneCorsia, corsieDiStato, daQuanto, ordiniInCoda } from '../../src/lib/coda.js'
import { ORDER_OPEN } from '../../src/lib/comande.js'
import { contoChiuso } from '../../src/lib/comande.js'

describe('le corsie dei conti', () => {
  // TRE COLONNE, non quattro. C'era anche un ramo con i quattro passi del
  // servizio (da fare → in preparazione → pronto → da incassare) e non lo
  // chiamava più nessuno: l'unico chiamante passava `workflowOn: false`.
  // A tenerlo in vita erano soltanto i test qui sotto — e i test sono la
  // specifica: chi leggeva ««Da incassare» sono i consegnati non saldati»
  // credeva che quella colonna esistesse davvero. I passi del servizio si
  // guardano dalla vista del BANCO, che ragiona per comande.
  const senzaStati = (o) => contoChiuso(o, { workflowOn: false })
  const conto = (patch) => ({
    payment_status: 'non_richiesto',
    total: 10,
    comande: [{ id: 'c1', status: patch.workflow_status ?? 'ricevuto' }],
    ...patch,
  })
  const coda = [
    conto({ id: 'a', workflow_status: 'ricevuto', total: 12 }),
    conto({ id: 'b', workflow_status: 'ricevuto', total: 8 }),
    conto({ id: 'c', workflow_status: 'in_preparazione', total: 20 }),
    conto({ id: 'd', workflow_status: 'pronto', total: 15 }),
    conto({ id: 'e', workflow_status: 'ritirato', total: 30 }),
    conto({ id: 'f', workflow_status: 'annullato', total: 99 }),
    // pagato E consegnato: il conto è chiuso
    conto({ id: 'g', workflow_status: 'ritirato', payment_status: 'pagato', total: 40 }),
  ]
  const corsie = () => corsieDiStato(coda, { isChiuso: senzaStati })
  const trova = (id) => corsie().find((c) => c.id === id)

  it('sono le tre cose che un conto può essere, con le voci della griglia', () => {
    expect(corsie().map((c) => [c.id, c.titolo])).toEqual([
      ['attivi', 'In corso'],
      ['chiusi', '💶 Chiusi'],
      ['annullati', '✖️ Annullati'],
    ])
    // Le stesse etichette delle schede: due viste non devono raccontare
    // due storie diverse sugli stessi conti.
    expect(corsie().map((c) => c.titolo)).toEqual(schedeCoda(false).map(([, t]) => t))
  })

  it('ogni conto nella sua colonna', () => {
    expect(trova('attivi').ordini.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(trova('chiusi').ordini.map((o) => o.id)).toEqual(['g'])
    expect(trova('annullati').ordini.map((o) => o.id)).toEqual(['f'])
  })

  it('conteggi e totali sono quelli dei conti che si vedono', () => {
    expect(corsie().map((c) => c.ordini.length)).toEqual([5, 1, 1])
    // 12 + 8 + 20 + 15 + 30
    expect(trova('attivi').totale).toBe(85)
    expect(trova('chiusi').totale).toBe(40)
  })

  it('lo sconto è già tolto dal totale della corsia: è quello che si incassa', () => {
    const [attivi] = corsieDiStato(
      [conto({ id: 'x', workflow_status: 'ricevuto', total: 30, discount_amount: 5 })],
      { isChiuso: senzaStati }
    )
    expect(attivi.totale).toBe(25)
  })

  it('un conto di una cassa già chiusa in corsia non ci torna', () => {
    // La regola è quella di sempre (ordiniInCoda): le corsie si riempiono
    // con la lista che la coda mostra, non con tutto quello che c'è.
    const vecchioIncassato = conto({
      id: 'vecchio',
      workflow_status: 'ritirato',
      payment_status: 'pagato',
      cash_session_id: 'cassa-1',
      paid_at: '2026-08-15T23:00:00.000Z',
      total: 50,
    })
    const inCoda = ordiniInCoda([...coda, vecchioIncassato], {
      filtro: 'tutti',
      isChiuso: senzaStati,
      cassa: 'cassa-2',
      apertaDa: '2026-08-16T18:00:00.000Z',
    })
    const dopo = corsieDiStato(inCoda, { isChiuso: senzaStati })
    expect(dopo.flatMap((c) => c.ordini).some((o) => o.id === 'vecchio')).toBe(false)
  })

  it('coda vuota: le corsie ci sono lo stesso, a zero', () => {
    // Tre colonne vuote dicono «non c'è niente»; nessuna colonna dice
    // «qualcosa non ha funzionato».
    const vuote = corsieDiStato([])
    expect(vuote.length).toBe(3)
    expect(vuote.every((c) => c.ordini.length === 0 && c.totale === 0)).toBe(true)
  })
})

// IL TASTO DELLA CARD SEGUE LO STATO, NON L'ID DELLA COLONNA.
// Prima era una mappa per id di corsia, ed è esattamente da lì che è nato
// BUG-026 nella vista delle comande: dividendo una colonna nascevano id
// nuovi che nella mappa non c'erano, e la card restava senza tasto. Una
// funzione che spariva a seconda di come uno guardava la coda.
describe('cosa fa il tasto di una card di conto', () => {
  it('su un conto in corso si incassa, come sulla griglia', () => {
    expect(azioneCorsia(ORDER_OPEN)).toEqual({ etichetta: 'Incassa', tipo: 'incassa' })
  })

  it('su uno chiuso o annullato non c’è più niente da chiedere', () => {
    expect(azioneCorsia('pagato')).toBe(null)
    expect(azioneCorsia('annullato')).toBe(null)
  })

  it('e una colonna che cambia nome non si porta via il tasto', () => {
    // È la lezione di BUG-026: il tasto sta sullo stato, e rinominare o
    // dividere una colonna non lo fa sparire.
    const [attivi] = corsieDiStato([], { isChiuso: () => false })
    expect(azioneCorsia(attivi.stato)).toEqual({ etichetta: 'Incassa', tipo: 'incassa' })
  })
})

// DA QUANTO STA LÌ. Sulla card conta l'ordine di grandezza: un conto
// «appena ora» e uno da «38 min» si trattano in modo diverso, i secondi
// esatti non li guarda nessuno.
describe('da quanto è lì', () => {
  const adesso = Date.parse('2026-08-16T21:00:00.000Z')
  const fa = (ms) => new Date(adesso - ms).toISOString()

  it('i primi secondi sono «appena ora»', () => {
    expect(daQuanto(fa(3000), adesso)).toBe('appena ora')
  })

  it('poi i secondi, poi i minuti, poi le ore', () => {
    expect(daQuanto(fa(40000), adesso)).toBe('40 s')
    expect(daQuanto(fa(60000), adesso)).toBe('1 min')
    expect(daQuanto(fa(38 * 60000), adesso)).toBe('38 min')
    expect(daQuanto(fa(2 * 3600000), adesso)).toBe('2 h')
  })

  it('senza data non si inventa niente', () => {
    expect(daQuanto(null, adesso)).toBe('')
    expect(daQuanto('boh', adesso)).toBe('')
  })
})

// ── DENTRO I CHIUSI: SERVITI E DA SERVIRE ─────────────────────
//
// Un conto chiuso è un conto INCASSATO: i soldi sono presi. Ma incassato
// non vuol dire uscito — si paga in anticipo tutte le sere — e prima quei
// conti restavano in mezzo a quelli in corso, con un tasto «nascondi
// pagati» per toglierseli dagli occhi. Adesso stanno fra i chiusi, e
// «quali hanno ancora roba da portare» si chiede qui dentro.
import { passaSottofiltroChiusi, SOTTOFILTRI_CHIUSI } from '../../src/lib/coda.js'

describe('dentro i conti chiusi: serviti e da servire', () => {
  const con = (comande, patch = {}) => ({ status: 'pagato', payment_status: 'pagato', comande, ...patch })
  const servito = con([{ id: 'c1', status: 'ritirato' }])
  const daServire = con([
    { id: 'c1', status: 'ritirato' },
    { id: 'c2', status: 'in_preparazione' },
  ])

  it('le tre voci sono quelle, in quest’ordine', () => {
    expect(SOTTOFILTRI_CHIUSI.map(([k]) => k)).toEqual(['tutti', 'serviti', 'non-serviti'])
  })

  it('«tutti» non toglie niente', () => {
    for (const o of [servito, daServire]) {
      expect(passaSottofiltroChiusi(o, 'tutti')).toBe(true)
      expect(passaSottofiltroChiusi(o)).toBe(true)
    }
  })

  it('serviti: solo quelli usciti per intero', () => {
    expect(passaSottofiltroChiusi(servito, 'serviti')).toBe(true)
    expect(passaSottofiltroChiusi(daServire, 'serviti')).toBe(false)
  })

  it('da servire: quelli con ancora qualcosa da portare', () => {
    expect(passaSottofiltroChiusi(daServire, 'non-serviti')).toBe(true)
    expect(passaSottofiltroChiusi(servito, 'non-serviti')).toBe(false)
  })

  it('LE COMANDE ANNULLATE NON CONTANO', () => {
    // Se contassero, un conto con dentro un drink annullato non
    // risulterebbe servito mai più — e resterebbe per sempre nella lista
    // di quelli «da portare», mandando qualcuno a cercare un drink che
    // nessuno ha ordinato.
    const conAnnullata = con([
      { id: 'c1', status: 'ritirato' },
      { id: 'c2', status: 'annullato' },
    ])
    expect(passaSottofiltroChiusi(conAnnullata, 'serviti')).toBe(true)
    expect(passaSottofiltroChiusi(conAnnullata, 'non-serviti')).toBe(false)
  })

  it('un conto ANNULLATO non è né servito né da servire', () => {
    // Non c'è più niente da portare a nessuno: sta sotto la sua tab.
    const morto = con([{ id: 'c1', status: 'annullato' }], { status: 'annullato' })
    expect(passaSottofiltroChiusi(morto, 'serviti')).toBe(false)
    expect(passaSottofiltroChiusi(morto, 'non-serviti')).toBe(false)
  })

  it('il sottofiltro vale SOLO dentro i chiusi', () => {
    // Fuori di lì non vuol dire niente: un conto in corso non è né servito
    // né da servire, è da fare.
    const inCorso = { status: 'aperto', comande: [{ id: 'c1', status: 'ricevuto' }] }
    const incassato = (o) => contoChiuso(o, { workflowOn: false })
    const lista = [inCorso, daServire, servito]
    const soloServiti = ordiniInCoda(lista, {
      filtro: 'attivi',
      sottoChiusi: 'serviti',
      isChiuso: incassato,
    })
    expect(soloServiti).toEqual([inCorso])
    expect(
      ordiniInCoda(lista, { filtro: 'chiusi', sottoChiusi: 'serviti', isChiuso: incassato })
    ).toEqual([servito])
  })
})

// ── LE CORSIE DEL BANCO: UNA CARD PER COMANDA ────────────────────────
//
// Chi sta allo shaker non prepara un conto, prepara un ticket per volta:
// un conto con tre comande in tre passi diversi, mostrato come una card
// sola, dice una cosa sbagliata comunque la si metta. Qui si prova che
// ogni comanda finisce dove sta davvero, che quelle annullate restano
// fuori (quella roba non si fa) e che i totali di colonna sono la somma
// delle righe che ci stanno dentro — non del conto intero, o al banco si
// leggerebbero i soldi di un tavolo nella colonna del lavoro.
import {
  corsieComande,
  corsieVisibili,
  corsieDaMostrare,
  corsieSceglibili,
  CORSIE_SPENTE_ALL_INIZIO,
} from '../../src/lib/coda.js'

describe('le corsie delle comande', () => {
  const chiusoConStati = (o) => contoChiuso(o, { workflowOn: true })
  const riga = (name, qty, prezzo) => ({ drink_id: name, name, qty, unit_price: prezzo })
  const contoC = (id, numero, comande, patch = {}) => ({
    id,
    daily_number: numero,
    status: 'aperto',
    payment_status: 'non_richiesto',
    comande,
    ...patch,
  })

  // Due conti diversi con comande in passi diversi: è la situazione
  // normale di un sabato, non un caso limite.
  const coda = [
    contoC('o41', 41, [
      { id: 'c1', seq: 1, status: 'pronto', items: [riga('Negroni', 2, 9)] },
      { id: 'c2', seq: 2, status: 'ricevuto', items: [riga('Gin tonic', 1, 6)] },
    ]),
    contoC('o42', 42, [
      { id: 'c1', seq: 1, status: 'in_preparazione', items: [riga('Spritz', 3, 7)] },
      { id: 'c2', seq: 2, status: 'annullato', items: [riga('Mojito', 5, 8)] },
    ]),
  ]

  it('smista le comande di conti diversi, ognuna nel suo passo', () => {
    const corsie = corsieComande(coda, { isChiuso: chiusoConStati })
    // Le quattro del lavoro, più le due dello sguardo all'indietro: gli
    // stati del servizio sono SOTTOSTATI dell'ordine, e chiusi e annullati
    // sono stati dell'ordine — le comande ci finiscono dentro anche qui.
    expect(corsie.map((c) => [c.id, c.titolo])).toEqual([
      ['da-fare', 'Da fare'],
      ['al-banco', 'In preparazione'],
      ['al-ritiro', 'Ritiro/Servizio'],
      // Il lavoro finito ha una colonna sua, che nella vista dei conti non
      // c'è: lì un conto servito è solo roba da incassare. E qui NON c'è
      // una colonna «Da incassare»: conteneva gli stessi drink di questa,
      // solo raggruppati per conto invece che per ticket.
      ['ritirati', 'Ritirato/Servito'],
      // Al femminile: qui dentro non ci sono conti, ci sono comande.
      ['chiusi', '💶 Chiuse'],
      ['annullati', '✖️ Annullate'],
    ])
    const dove = Object.fromEntries(corsie.map((c) => [c.id, c.schede.map((s) => s.id)]))
    expect(dove['da-fare']).toEqual(['o41:c2'])
    expect(dove['al-banco']).toEqual(['o42:c1'])
    expect(dove['al-ritiro']).toEqual(['o41:c1'])
    expect(dove.ritirati).toEqual([])
  })

  it('ogni card porta il numero del conto E quello della comanda', () => {
    // «#41 · comanda 2»: due comande dello stesso tavolo sono due card, e
    // senza il secondo numero sembrerebbero lo stesso ordine due volte.
    const [daFare] = corsieComande(coda, { isChiuso: chiusoConStati })
    expect(daFare.schede[0].numero).toBe(41)
    expect(daFare.schede[0].seq).toBe(2)
    expect(daFare.schede[0].comanda.id).toBe('c2')
    expect(daFare.schede[0].ordine.id).toBe('o41')
  })

  it('le comande annullate non sono lavoro: fuori dalle corsie del banco', () => {
    const corsie = corsieComande(coda, { isChiuso: chiusoConStati })
    const lavoro = corsie
      .filter((c) => c.id !== 'annullati')
      .flatMap((c) => c.schede)
    expect(lavoro.some((s) => s.id === 'o42:c2')).toBe(false)
    // e le sue righe non gonfiano nessun totale del lavoro
    expect(
      corsie.filter((c) => c.id !== 'annullati').reduce((s, c) => s + c.totale, 0)
    ).toBe(2 * 9 + 1 * 6 + 3 * 7)
  })

  it('ma si ritrovano fra le ANNULLATE, anche su un conto vivo', () => {
    // Prima non comparivano da nessuna parte: si toglieva una comanda e
    // quella si volatilizzava. È la domanda a cui quella colonna serve a
    // rispondere — «questa comanda che fine ha fatto?» — e una comanda che
    // non si trova manda a cercare un guasto che non c'è.
    const annullate = corsieComande(coda, { isChiuso: chiusoConStati }).find(
      (c) => c.id === 'annullati'
    )
    expect(annullate.schede.map((s) => s.id)).toEqual(['o42:c2'])
    // e c'è scritto PERCHÉ: questa è stata tolta a mano, non divisa né
    // caduta con un conto annullato
    expect(annullate.schede[0].motivo).toBe('mano')
  })

  it('il totale di una corsia è quello delle righe che ci stanno dentro', () => {
    const corsie = corsieComande(coda, { isChiuso: chiusoConStati })
    const totali = Object.fromEntries(corsie.map((c) => [c.id, c.totale]))
    expect(totali['da-fare']).toBe(6)
    expect(totali['al-banco']).toBe(21)
    expect(totali['al-ritiro']).toBe(18)
    expect(totali.ritirati).toBe(0)
  })

  it('servito e non ancora saldato: le comande restano ticket, una card ognuna', () => {
    // C'era una colonna «Da incassare» con dentro il CONTO, una card sola:
    // la paura era che tre comande servite dello stesso tavolo diventassero
    // tre tasti che chiedono tre volte gli stessi soldi. Ma quella colonna
    // conteneva esattamente questi drink, solo raggruppati per conto: due
    // colonne per la stessa cosa. La card resta il ticket e non chiede
    // soldi — dice che quei drink sono usciti.
    const servito = contoC(
      'o50',
      50,
      [
        { id: 'c1', seq: 1, status: 'ritirato', items: [riga('Negroni', 1, 9)] },
        { id: 'c2', seq: 2, status: 'ritirato', items: [riga('Spritz', 1, 7)] },
      ],
      { total: 16 }
    )
    const corsie = corsieComande([servito], { isChiuso: chiusoConStati })
    const ritirati = corsie.find((c) => c.id === 'ritirati')
    expect(ritirati.schede.map((s) => s.id)).toEqual(['o50:c1', 'o50:c2'])
    expect(ritirati.schede.every((s) => s.comanda)).toBe(true)
    expect(ritirati.totale).toBe(16)
    expect(corsie.some((c) => c.id === 'da-incassare')).toBe(false)
  })

  it('un conto senza comande non compare da nessuna parte', () => {
    // Un conto vuoto non è «tutto servito»: non ha niente da preparare e
    // non ha niente da chiedere a nessuno.
    const corsie = corsieComande([contoC('o60', 60, [])], { isChiuso: chiusoConStati })
    expect(corsie.flatMap((c) => c.schede)).toEqual([])
    expect(corsie.length).toBe(6)
  })

  it('con UNA comanda sola il numero del ticket non si scrive', () => {
    // Di base la comanda è una e esce tutta per l'intero ordine: dividerla
    // è la deroga. «#41 · comanda 1» sarebbe un numero da leggere per non
    // sapere niente, e questa vista dev'essere indistinguibile da quella
    // dei conti finché il banco non divide qualcosa.
    const solo = contoC('o90', 90, [
      { id: 'c1', seq: 1, status: 'ricevuto', items: [riga('Negroni', 1, 9)] },
    ])
    const [daFare] = corsieComande([solo], { isChiuso: chiusoConStati })
    expect(daFare.schede[0].seq).toBe(null)
    expect(daFare.schede[0].numero).toBe(90)
  })

  it('un conto annullato porta le sue comande solo fra gli annullati', () => {
    // Quella roba non si fa e non si paga: non è lavoro e non è un incasso,
    // resta solo la colonna che serve a ritrovarla.
    const morto = contoC(
      'ox',
      70,
      [{ id: 'c1', seq: 1, status: 'ricevuto', items: [riga('Rum', 1, 5)] }],
      { status: 'annullato' }
    )
    const corsie = corsieComande([morto], { isChiuso: chiusoConStati })
    const dove = Object.fromEntries(corsie.map((c) => [c.id, c.schede.length]))
    expect(dove.annullati).toBe(1)
    expect(dove['da-fare']).toBe(0)
    expect(dove.chiusi).toBe(0)
  })

  // ABBIAMO CAMBIATO IDEA, e vale la pena dire perché. All'inizio la
  // comanda annullata da una divisione stava FUORI da questa colonna: il
  // ragionamento era che quei drink non sono spariti — si stanno facendo,
  // in due ticket — e mostrarla sembrava raccontare un guaio che non c'era.
  // Al banco è andata al contrario: si separano due comande, quella di
  // partenza si volatilizza, e chi la cerca per capire che fine abbia fatto
  // non ha un posto dove guardare. Quella colonna serve ESATTAMENTE a
  // rispondere a quella domanda, quindi ci vanno TUTTE le comande
  // annullate — a mano, per divisione, o con tutto il conto — e a non far
  // pensare a un guaio ci pensa la parola scritta sulla card.
  it('dividere riempie gli annullati: la comanda di partenza si ritrova, e dice che è stata divisa', () => {
    const dopo = contoC('o93', 93, [
      {
        id: 'c1',
        seq: 1,
        status: 'annullato',
        annullata_per: 'divisione',
        items: [riga('Gin tonic', 5, 8)],
      },
      { id: 'c2', seq: 2, status: 'in_preparazione', items: [riga('Gin tonic', 2, 8)] },
      { id: 'c3', seq: 3, status: 'ricevuto', items: [riga('Gin tonic', 3, 8)] },
    ])
    const corsie = corsieComande([dopo], { isChiuso: chiusoConStati })
    const annullate = corsie.find((c) => c.id === 'annullati')
    expect(annullate.schede.map((s) => s.id)).toEqual(['o93:c1'])
    expect(annullate.schede[0].motivo).toBe('divisione')

    // I due pezzi nati dalla divisione sono LAVORO, e stanno nelle loro
    // colonne: la comanda annullata non li sostituisce e non li duplica.
    const dove = Object.fromEntries(corsie.map((c) => [c.id, c.schede.map((x) => x.id)]))
    expect(dove['al-banco']).toEqual(['o93:c2'])
    expect(dove['da-fare']).toEqual(['o93:c3'])

    // MA NON È UN INCASSO PERSO: quei 40 € si stanno facendo, in due
    // ticket. Contarli nel totale delle annullate direbbe «sono saltati
    // 40 €» mentre sono ancora tutti lì.
    expect(annullate.totale).toBe(0)
  })

  it('le tre cose che possono essere successe si distinguono', () => {
    // A mano, per divisione, o caduta col conto: sono tre fatti diversi, e
    // chi guarda la colonna deve capire a colpo d'occhio quale.
    const aMano = contoC('o94', 94, [
      { id: 'c1', seq: 1, status: 'annullato', items: [riga('Rum', 1, 5)] },
      { id: 'c2', seq: 2, status: 'ricevuto', items: [riga('Rum', 1, 5)] },
    ])
    const divisa = contoC('o95', 95, [
      {
        id: 'c1',
        seq: 1,
        status: 'annullato',
        annullata_per: 'divisione',
        items: [riga('Rum', 2, 5)],
      },
      { id: 'c2', seq: 2, status: 'in_preparazione', items: [riga('Rum', 2, 5)] },
    ])
    const colConto = contoC(
      'o96',
      96,
      [{ id: 'c1', seq: 1, status: 'annullato', items: [riga('Rum', 1, 5)] }],
      { status: 'annullato' }
    )
    const annullate = corsieComande([aMano, divisa, colConto], {
      isChiuso: chiusoConStati,
    }).find((c) => c.id === 'annullati')
    expect(annullate.schede.map((s) => [s.id, s.motivo])).toEqual([
      ['o94:c1', 'mano'],
      ['o95:c1', 'divisione'],
      ['o96:c1', 'conto'],
    ])
  })

  it('un conto incassato sta fra i chiusi, e non chiede più niente in cassa', () => {
    const pagato = contoC(
      'oy',
      71,
      [{ id: 'c1', seq: 1, status: 'ritirato', items: [riga('Rum', 1, 5)] }],
      { payment_status: 'pagato', status: 'pagato', total: 5 }
    )
    const corsie = corsieComande([pagato], { isChiuso: chiusoConStati })
    const dove = Object.fromEntries(corsie.map((c) => [c.id, c.schede.length]))
    expect(dove.chiusi).toBe(1)
    expect(dove.ritirati).toBe(0)
  })

  it('PAGATO MA NON ANCORA SERVITO: resta al banco col bollo, e non è chiuso', () => {
    // Una comanda diventa chiusa dopo essere stata SERVITA, non quando
    // arrivano i soldi: il drink va fatto lo stesso. Farla comparire anche
    // fra i chiusi vorrebbe dire contarla due volte — e al banco leggere
    // che una cosa è finita mentre è ancora da fare.
    const anticipo = contoC(
      'oz',
      72,
      [{ id: 'c1', seq: 1, status: 'ricevuto', items: [riga('Rum', 1, 5)] }],
      { payment_status: 'pagato', total: 5 }
    )
    const corsie = corsieComande([anticipo], { isChiuso: chiusoConStati })
    const dove = Object.fromEntries(corsie.map((c) => [c.id, c.schede.length]))
    expect(dove['da-fare']).toBe(1)
    expect(corsie[0].schede[0].pagatoDaServire).toBe(true)
    expect(dove.chiusi).toBe(0)
    expect(dove.ritirati).toBe(0)
  })

  it('servita e pagata: chiusa. Servita e non pagata: il conto va in cassa', () => {
    const servitoEPagato = contoC(
      'o91',
      91,
      [{ id: 'c1', seq: 1, status: 'ritirato', items: [riga('Rum', 1, 5)] }],
      { payment_status: 'pagato', total: 5 }
    )
    const servitoDaPagare = contoC(
      'o92',
      92,
      [{ id: 'c1', seq: 1, status: 'ritirato', items: [riga('Rum', 2, 5)] }],
      { total: 10 }
    )
    const corsie = corsieComande([servitoEPagato, servitoDaPagare], { isChiuso: chiusoConStati })
    const dove = Object.fromEntries(corsie.map((c) => [c.id, c.schede.map((x) => x.id)]))
    expect(dove.chiusi).toEqual(['o91:c1'])
    // servita e non pagata: resta un ticket, in «Ritirato/Servito» — il
    // lavoro è finito, i soldi no, e a dirlo è il bollo sulla card
    expect(dove.ritirati).toEqual(['o92:c1'])
    expect(corsie.find((c) => c.id === 'ritirati').totale).toBe(10)
    // IL LAVORO FINITO SI VEDE FINITO: la comanda servita e non ancora
    // pagata sta in «Ritirato/Servito». Chi ha appena servito deve sapere
    // dov'e' andato quello che ha fatto — i soldi sono un'altra domanda, e
    // se la fa la colonna accanto, sul conto intero.
    expect(dove.ritirati).toEqual(['o92:c1'])
  })

  it('pagato ma non ancora uscito: la comanda resta dov’è, col bollo', () => {
    // Sparire sarebbe il modo migliore per dimenticarsi di servirlo.
    const anticipo = contoC(
      'o80',
      80,
      [{ id: 'c1', seq: 1, status: 'in_preparazione', items: [riga('Negroni', 1, 9)] }],
      { payment_status: 'pagato' }
    )
    const alBanco = corsieComande([anticipo], { isChiuso: chiusoConStati }).find(
      (c) => c.id === 'al-banco'
    )
    expect(alBanco.schede.length).toBe(1)
    expect(alBanco.schede[0].pagatoDaServire).toBe(true)
  })
})

// Le colonne spente su questo terminale: chi sta al banco guarda «Da fare»
// e «Al banco», chi sta alla cassa «Da incassare».
// ── LA COLONNA CHE IL LOCALE NON USA ────────────────────────
//
// Col salto acceso «Da fare» non si riempie: sparisce dall'elenco delle
// colonne da accendere — un tasto che non fa niente è peggio di nessun
// tasto — ma non è vietata. Se una comanda ci finisce lo stesso la colonna
// compare da sé: il lavoro non si nasconde mai.
describe('la colonna che il locale non usa', () => {
  const corsie = (quanteDaFare) => [
    { id: 'da-fare', schede: Array(quanteDaFare).fill({}) },
    { id: 'al-banco', schede: [{}] },
    { id: 'al-ritiro', schede: [] },
  ]

  it('senza salto si sceglie tutto, come sempre', () => {
    expect(
      corsieSceglibili(corsie(0), { passoDiNascita: 'ricevuto' }).map((c) => c.id)
    ).toEqual(['da-fare', 'al-banco', 'al-ritiro'])
  })

  it('col salto «Da fare» non si sceglie più', () => {
    expect(
      corsieSceglibili(corsie(0), { passoDiNascita: 'in_preparazione' }).map((c) => c.id)
    ).toEqual(['al-banco', 'al-ritiro'])
  })

  it('e se è vuota non si vede', () => {
    expect(
      corsieDaMostrare(corsie(0), [], { passoDiNascita: 'in_preparazione' }).map((c) => c.id)
    ).toEqual(['al-banco', 'al-ritiro'])
  })

  it('MA CON UNA COMANDA DENTRO SI VEDE ECCOME', () => {
    // Riportata indietro prima che il salto fosse acceso, o un conto di
    // ieri: quel drink va fatto, e non può restare invisibile.
    expect(
      corsieDaMostrare(corsie(1), [], { passoDiNascita: 'in_preparazione' }).map((c) => c.id)
    ).toEqual(['da-fare', 'al-banco', 'al-ritiro'])
  })

  it('e vince anche su chi l’aveva spenta a mano', () => {
    // La scelta di prima resta scritta, ma il lavoro viene prima.
    expect(
      corsieDaMostrare(corsie(1), ['da-fare'], { passoDiNascita: 'in_preparazione' }).map(
        (c) => c.id
      )
    ).toContain('da-fare')
  })

  it('senza salto, spegnerla a mano continua a funzionare', () => {
    expect(
      corsieDaMostrare(corsie(1), ['da-fare'], { passoDiNascita: 'ricevuto' }).map((c) => c.id)
    ).toEqual(['al-banco', 'al-ritiro'])
  })
})

describe('quali corsie si vedono', () => {
  const corsie = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('le spente si tolgono, le altre restano nell’ordine di sempre', () => {
    expect(corsieVisibili(corsie, ['b']).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('spegnerle tutte non si può: una schermata vuota sembra un’app rotta', () => {
    expect(corsieVisibili(corsie, ['a', 'b', 'c']).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('senza scelte si vede tutto', () => {
    expect(corsieVisibili(corsie).length).toBe(3)
    expect(corsieVisibili(corsie, []).length).toBe(3)
  })

  it('all’inizio chiusi e annullati stanno spenti', () => {
    // Al banco lo schermo serve al lavoro di adesso: sei colonne su un
    // tablet vogliono dire sei colonne strette. Chi vuole guardare indietro
    // le accende.
    expect(CORSIE_SPENTE_ALL_INIZIO).toEqual(['chiusi', 'annullati'])
  })
})

// ── IL TASTO DI UNA CARD DI COMANDA (BUG-026) ────────────────────────
//
// Dividendo la colonna del pronto in «Da servire» e «Da ritirare» nascono
// due corsie con id nuovi. L'azione si pescava da una mappa PER ID, e
// quelli lì dentro non c'erano: la card «Da ritirare» restava senza il
// tasto per far avanzare la comanda. Una funzione che spariva a seconda di
// come uno guardava la coda — e chi la subiva pensava che l'app si fosse
// impuntata.
import { azioneComanda } from '../../src/lib/coda.js'

describe('il tasto di una card di comanda', () => {
  const conto = (patch = {}) => ({ id: 'o1', status: 'aperto', payment_status: 'non_richiesto', ...patch })
  const com = (status) => ({ id: 'c1', seq: 1, status, items: [] })

  it('dice il passo dopo, qualunque colonna la ospiti', () => {
    expect(azioneComanda(com('ricevuto'), conto())).toMatchObject({ tipo: 'avanza' })
    expect(azioneComanda(com('in_preparazione'), conto())).toMatchObject({ tipo: 'avanza' })
    // È il caso del difetto: comanda pronta di un conto DA RITIRARE, che
    // con le colonne divise finisce in «Da ritirare».
    const daRitirare = azioneComanda(com('pronto'), conto({ service_mode: 'banco' }))
    expect(daRitirare).toMatchObject({ tipo: 'avanza' })
    expect(daRitirare.etichetta).toMatch(/ritirat/i)
    // Lo stesso passo su un conto servito al tavolo si chiama con l'altra
    // parola: il gesto è lo stesso, il mestiere no.
    expect(azioneComanda(com('pronto'), conto({ service_mode: 'tavolo' })).etichetta).toMatch(
      /servit/i
    )
  })

  it('chi non ha più niente da fare resta senza tasto', () => {
    // Annullata: quei drink non si fanno e non si pagano.
    expect(azioneComanda(com('annullato'), conto())).toBeNull()
    // Servita e già pagata: niente da preparare, niente da chiedere.
    expect(azioneComanda(com('ritirato'), conto({ payment_status: 'pagato' }))).toBeNull()
    // Servita ma non pagata: chi l'ha appena portata al tavolo è spesso
    // quello che incassa, e il tasto gli evita di cercare il conto.
    expect(azioneComanda(com('ritirato'), conto())).toMatchObject({ tipo: 'incassa' })
  })

  it('la card del CONTO chiede soldi, non lavoro', () => {
    // Nella colonna dei soldi la card è il conto intero: lì non c'è un
    // ticket da far avanzare.
    expect(azioneComanda(null, conto())).toMatchObject({ tipo: 'incassa' })
  })

  // LA SALA SERVE, NON PREPARA. Guarda le corsie per sapere cosa portare,
  // ma non prende in carico e non segna pronto: quei tasti non le compaiono
  // nemmeno. Le resta l'ultimo passo — «servito» — che è il suo mestiere.
  it('alla sala il tasto compare solo sull’ultimo passo', () => {
    const sala = { ruolo: 'staff' }
    expect(azioneComanda(com('ricevuto'), conto(), sala)).toBeNull()
    expect(azioneComanda(com('in_preparazione'), conto(), sala)).toBeNull()
    expect(azioneComanda(com('pronto'), conto({ service_mode: 'tavolo' }), sala)).toMatchObject({
      tipo: 'avanza',
    })
    // E il conto che ha appena servito lo incassa: quello non è lavoro del
    // banco, sono soldi.
    expect(azioneComanda(com('ritirato'), conto(), sala)).toMatchObject({ tipo: 'incassa' })
  })

  it('al banco non cambia niente', () => {
    for (const ruolo of ['admin', 'bartender']) {
      expect(azioneComanda(com('ricevuto'), conto(), { ruolo })).toMatchObject({ tipo: 'avanza' })
    }
  })
})

// ── NON SI PREPARA QUELLO CHE NON È STATO PAGATO (BUG-027) ───────────
//
// Il blocco valeva finché il conto stava a «ricevuto», scritto a mano. In un
// locale che fa nascere le comande già «in preparazione» quel confronto non
// era mai vero: il blocco non scattava e si preparava un ordine con
// pagamento obbligatorio non pagato. Nessun test lo vedeva, perché giravano
// tutti col passo di nascita di default.
import { attesaPagamento } from '../../src/lib/coda.js'

describe('il blocco del pagamento obbligatorio', () => {
  const conto = (patch = {}) => ({
    payment_required: true,
    payment_status: 'in_attesa',
    workflow_status: 'ricevuto',
    ...patch,
  })

  it('blocca finché la comanda non è stata presa in carico', () => {
    expect(attesaPagamento(conto())).toBe(true)
    // preso in carico: il drink lo sta già facendo qualcuno, e toglierglielo
    // di sotto sarebbe peggio che aspettare i soldi.
    expect(attesaPagamento(conto({ workflow_status: 'in_preparazione' }))).toBe(false)
  })

  it('col salto acceso il passo di nascita è un altro, e il blocco scatta lì', () => {
    // È il difetto: qui il conto NASCE in preparazione, e prima il blocco
    // non scattava mai.
    expect(attesaPagamento(conto({ workflow_status: 'in_preparazione' }), 'in_preparazione')).toBe(
      true
    )
    expect(attesaPagamento(conto({ workflow_status: 'pronto' }), 'in_preparazione')).toBe(false)
  })

  it('senza pagamento obbligatorio non blocca niente', () => {
    expect(attesaPagamento(conto({ payment_required: false }))).toBe(false)
    expect(attesaPagamento(conto({ payment_status: 'pagato' }))).toBe(false)
  })
})
