'use strict'

// Unit test del modello Ordine (conto) / Comande (ticket) — src/lib/comande.js

import { describe, it, expect } from 'vitest'
import {
  ORDER_OPEN,
  nextComandaStatus,
  activeComanda,
  serveAllComande,
  comandeSummary,
  allServed,
  aggregateItems,
  itemsTotal,
  comandeStatuses,
  normalizeOrderDoc,
  orderHasContent,
  initialDetailView,
  orderIsClosed,
  comandaEditable,
  lockedQtyByItem,
  planDecrement,
  comandaDaScaricare,
  contoChiuso,
} from '../../src/lib/comande.js'

const c = (seq, status, items = []) => ({ id: `c${seq}`, seq, status, items })

describe('nextComandaStatus', () => {
  it('flusso ricevuto→in_preparazione→pronto→ritirato→null', () => {
    expect(nextComandaStatus('ricevuto')).toBe('in_preparazione')
    expect(nextComandaStatus('in_preparazione')).toBe('pronto')
    expect(nextComandaStatus('pronto')).toBe('ritirato')
    expect(nextComandaStatus('ritirato')).toBeNull()
    expect(nextComandaStatus('annullato')).toBeNull()
  })
})

describe('activeComanda / comandeSummary / allServed', () => {
  const order = {
    status: ORDER_OPEN,
    comande: [c(1, 'ritirato'), c(2, 'pronto'), c(3, 'ricevuto'), c(4, 'annullato')],
  }
  it('attiva = quella al passo più indietro (dà lo stato dell\'ordine)', () => {
    expect(activeComanda(order).seq).toBe(3)
  })

  it('aggiunta su conto con comanda pronta: l\'ordine TORNA in preparazione', () => {
    // C1 è pronta al servizio; l'aggiunta C2 nasce in preparazione → è lei
    // l'attiva: in coda l'ordine risulta di nuovo "in preparazione".
    const o = { comande: [c(1, 'pronto'), c(2, 'in_preparazione')] }
    expect(activeComanda(o).seq).toBe(2)
    expect(activeComanda(o).status).toBe('in_preparazione')
  })

  it('a parità di passo vince la più vecchia', () => {
    expect(activeComanda({ comande: [c(1, 'in_preparazione'), c(2, 'in_preparazione')] }).seq).toBe(1)
  })

  it('conto pagato: serveAllComande marca tutto servito (annullate escluse)', () => {
    const servite = serveAllComande(
      [c(1, 'ritirato'), c(2, 'in_preparazione'), c(3, 'annullato'), c(4, 'pronto')],
      'T1'
    )
    expect(servite.map((x) => x.status)).toEqual(['ritirato', 'ritirato', 'annullato', 'ritirato'])
    // orario di servizio stampigliato solo su quelle chiuse adesso
    expect(servite[1].status_times.ritirato).toBe('T1')
    expect(servite[3].status_times.ritirato).toBe('T1')
    expect(allServed({ comande: servite })).toBe(true)
  })
  it('summary conta attive/pronte/servite (esclude annullate)', () => {
    expect(comandeSummary(order)).toEqual({ attive: 2, pronte: 1, servite: 1, totale: 3 })
  })
  it('allServed solo quando tutte ritirate (annullate ignorate)', () => {
    expect(allServed(order)).toBe(false)
    expect(allServed({ comande: [c(1, 'ritirato'), c(2, 'annullato')] })).toBe(true)
    expect(allServed({ comande: [c(1, 'annullato')] })).toBe(false)
  })
})

describe('aggregateItems / itemsTotal', () => {
  it('somma lo stesso drink su comande diverse, custom separati, annullate escluse', () => {
    const comande = [
      c(1, 'ritirato', [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 },
        { drink_id: 'custom-1', custom: true, name: 'Special', unit_price: 9, qty: 1 },
      ]),
      c(2, 'ricevuto', [
        { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 },
        { drink_id: 'custom-2', custom: true, name: 'Special', unit_price: 9, qty: 1 },
      ]),
      c(3, 'annullato', [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 5 }]),
    ]
    const agg = aggregateItems(comande)
    expect(agg.find((i) => i.drink_id === 'mojito').qty).toBe(3)
    expect(agg.filter((i) => i.custom)).toHaveLength(2)
    expect(agg.find((i) => i.drink_id === 'gin')).toBeUndefined()
    expect(itemsTotal(agg)).toBe(3 * 7 + 9 + 9)
  })
})

describe('comandeStatuses', () => {
  it('stati unici presenti', () => {
    expect(comandeStatuses([c(1, 'ritirato'), c(2, 'ricevuto'), c(3, 'ricevuto')]).sort()).toEqual([
      'ricevuto',
      'ritirato',
    ])
  })
})

describe('dettaglio POS: il contenuto del conto è visibile', () => {
  const withContent = {
    status: ORDER_OPEN,
    comande: [c(1, 'ritirato', [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }])],
  }
  const empty = { status: ORDER_OPEN, comande: [] }
  const onlyCancelled = {
    status: ORDER_OPEN,
    comande: [c(1, 'annullato', [{ drink_id: 'x', name: 'X', unit_price: 1, qty: 1 }])],
  }

  it('orderHasContent: vero con item in comande non annullate', () => {
    expect(orderHasContent(withContent)).toBe(true)
    expect(orderHasContent(empty)).toBe(false)
    expect(orderHasContent(onlyCancelled)).toBe(false)
  })

  it('il dettaglio di un ordine con contenuto si apre sulle Comande', () => {
    expect(initialDetailView(withContent)).toBe('comande')
    expect(initialDetailView(empty)).toBe('menu')
  })

  it('anche un ordine legacy (solo items) mostra il contenuto', () => {
    const legacy = normalizeOrderDoc({
      status: 'in_preparazione',
      items: [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 1 }],
    })
    expect(orderHasContent(legacy)).toBe(true)
    expect(initialDetailView(legacy)).toBe('comande')
  })

  it('flusso aggiunta: dopo una nuova comanda l’aggregato contiene tutto', () => {
    const comande = [
      ...withContent.comande,
      c(2, 'ricevuto', [{ drink_id: 'gin', name: 'Gin', unit_price: 8, qty: 1 }]),
    ]
    const agg = aggregateItems(comande)
    expect(agg.map((i) => i.drink_id).sort()).toEqual(['gin', 'mojito'])
    expect(itemsTotal(agg)).toBe(2 * 7 + 8)
  })

  it('orderIsClosed solo per pagato/annullato', () => {
    expect(orderIsClosed({ status: 'pagato' })).toBe(true)
    expect(orderIsClosed({ status: 'annullato' })).toBe(true)
    expect(orderIsClosed(withContent)).toBe(false)
  })
})

describe('normalizeOrderDoc (retrocompatibilità)', () => {
  it('doc nuovo modello: passa attraverso', () => {
    const n = normalizeOrderDoc({ status: ORDER_OPEN, comande: [c(1, 'pronto')] })
    expect(n.status).toBe(ORDER_OPEN)
    expect(n.comande).toHaveLength(1)
  })
  it('legacy in lavorazione → ordine aperto + comanda sintetica con lo stato', () => {
    const n = normalizeOrderDoc({
      status: 'in_preparazione',
      items: [{ drink_id: 'x', qty: 1 }],
      status_times: { in_preparazione: 't1' },
      inventory_applied: true,
      inventory_consumption: [{ inventory_item_id: 'rum', qty: 40 }],
    })
    expect(n.status).toBe(ORDER_OPEN)
    expect(n.comande[0]).toMatchObject({
      seq: 1,
      status: 'in_preparazione',
      inventory_applied: true,
    })
    expect(n.comande[0].items).toHaveLength(1)
  })
  it('legacy pagato → ordine pagato, comanda ritirata; annullato → annullato', () => {
    expect(normalizeOrderDoc({ status: 'pagato', items: [] }).status).toBe('pagato')
    expect(normalizeOrderDoc({ status: 'pagato', items: [] }).comande[0].status).toBe('ritirato')
    expect(normalizeOrderDoc({ status: 'annullato', items: [] }).comande[0].status).toBe('annullato')
  })
})

describe('vista aggregata: aumenti/diminuzioni gestite internamente', () => {
  const comande = [
    { id: 'c1', seq: 1, status: 'ritirato', items: [{ drink_id: 'mojito', qty: 2 }] },
    { id: 'c2', seq: 2, status: 'in_preparazione', items: [{ drink_id: 'mojito', qty: 1 }, { drink_id: 'gin', qty: 1 }] },
    { id: 'c3', seq: 3, status: 'pronto', items: [{ drink_id: 'gin', qty: 2 }] },
  ]

  it('comandaEditable: solo ricevuto/in_preparazione', () => {
    expect(comandaEditable({ status: 'ricevuto' })).toBe(true)
    expect(comandaEditable({ status: 'in_preparazione' })).toBe(true)
    expect(comandaEditable({ status: 'pronto' })).toBe(false)
    expect(comandaEditable({ status: 'ritirato' })).toBe(false)
  })

  it('lockedQtyByItem: somma le quantità di pronte/servite', () => {
    expect(lockedQtyByItem(comande)).toEqual({ mojito: 2, gin: 2 })
  })

  it('planDecrement: scala dalla comanda modificabile più recente', () => {
    const plan = planDecrement(comande, 'mojito')
    expect(plan.comandaId).toBe('c2')
    expect(plan.items).toEqual([{ drink_id: 'gin', qty: 1 }]) // mojito rimosso (era 1)
  })

  it('planDecrement: null se l’item vive solo in comande bloccate', () => {
    expect(planDecrement(comande, 'birra')).toBeNull()
    const soloServite = [{ id: 'c1', status: 'ritirato', items: [{ drink_id: 'x', qty: 3 }] }]
    expect(planDecrement(soloServite, 'x')).toBeNull()
  })
})

// IL MAGAZZINO SI SCALA QUANDO LA COMANDA È SERVITA. Prima si scaricava
// alla presa in carico: un drink iniziato e poi non fatto — riga tolta,
// cliente che cambia idea, comanda annullata — aveva già portato via gli
// ingredienti. Fino al servito sono impegnati, non consumati.
describe('quando si scala il magazzino', () => {
  it('quando la comanda risulta servita', () => {
    expect(comandaDaScaricare({ inventory_applied: false }, 'ritirato')).toBe(true)
  })

  it('non quando la si prende in carico', () => {
    expect(comandaDaScaricare({ inventory_applied: false }, 'in_preparazione')).toBe(false)
    expect(comandaDaScaricare({ inventory_applied: false }, 'pronto')).toBe(false)
  })

  it('una volta sola', () => {
    expect(comandaDaScaricare({ inventory_applied: true }, 'ritirato')).toBe(false)
  })
})

// QUANDO UN CONTO È CHIUSO. La regola sta in un posto solo perché la usano
// in tre — coda, riepilogo di testata e magazzino — e quando stava scritta
// in tre posti il magazzino contava fra gli aperti conti già incassati:
// con un tavolo solo segnava mezzo listino in esaurimento.
describe('conto chiuso: non c’è più niente da fare', () => {
  const servito = (over = {}) => ({
    comande: [{ id: 'c1', status: 'ritirato', items: [{ drink_id: 'x', qty: 1 }] }],
    ...over,
  })

  it('con gli stati del servizio servono incasso E consegna', () => {
    expect(contoChiuso(servito({ payment_status: 'pagato' }), { workflowOn: true })).toBe(true)
    // Pagato in anticipo, drink ancora da fare: lavoro da fare, non chiuso.
    const daServire = {
      payment_status: 'pagato',
      comande: [{ id: 'c1', status: 'in_preparazione', items: [{ drink_id: 'x', qty: 1 }] }],
    }
    expect(contoChiuso(daServire, { workflowOn: true })).toBe(false)
  })

  it('senza gli stati del servizio il pagamento chiude e basta', () => {
    const daServire = {
      payment_status: 'pagato',
      comande: [{ id: 'c1', status: 'in_preparazione', items: [{ drink_id: 'x', qty: 1 }] }],
    }
    expect(contoChiuso(daServire, { workflowOn: false })).toBe(true)
  })

  it('l’annullato è chiuso in ogni caso', () => {
    expect(contoChiuso({ status: 'annullato' }, { workflowOn: true })).toBe(true)
    expect(contoChiuso({ workflow_status: 'annullato' }, { workflowOn: false })).toBe(true)
  })

  it('un conto servito ma non incassato resta aperto: mancano i soldi', () => {
    expect(contoChiuso(servito(), { workflowOn: true })).toBe(false)
  })
})

// ── LA PREPARAZIONE PARZIALE ─────────────────────────────────────────
//
// Al banco capita di vedere tre gin tonic in una comanda e due in un'altra
// e prepararli insieme, per farli uscire in una volta sola. Non andrebbe
// fatto — un ticket si lavora intero — ma si fa: l'app non lo impedisce,
// lo registra, e queste sono le regole con cui lo registra.
//
// IL CONTROLLO CHE CONTA È L'ULTIMO: la somma delle unità prima e dopo la
// divisione deve essere identica. Se una divisione fa sparire un drink, al
// banco non se ne accorge nessuno finché non lo reclama il cliente.
import {
  dividiComanda,
  comandaDivisibile,
  firmaComande,
  annullataPerDivisione,
} from '../../src/lib/comande.js'

describe('dividere una comanda', () => {
  const riga = (name, qty) => ({ drink_id: name, name, qty, unit_price: 8 })
  const comanda = { id: 'c1', seq: 1, status: 'ricevuto', items: [riga('Gin tonic', 5)] }
  const unità = (righe) => (righe || []).reduce((s, i) => s + i.qty, 0)

  it('due di cinque: due partono, tre restano da fare', () => {
    const { tutta, nuova, resta } = dividiComanda(comanda, [2])
    expect(tutta).toBe(false)
    expect(nuova).toEqual([{ ...riga('Gin tonic', 2), unit_price: 8 }])
    expect(resta).toEqual([{ ...riga('Gin tonic', 3), unit_price: 8 }])
  })

  it('righe intere: quella scelta se ne va tutta, le altre restano', () => {
    const c = { ...comanda, items: [riga('Gin tonic', 3), riga('Negroni', 2)] }
    const { nuova, resta } = dividiComanda(c, [3, 0])
    expect(nuova.map((i) => [i.name, i.qty])).toEqual([['Gin tonic', 3]])
    expect(resta.map((i) => [i.name, i.qty])).toEqual([['Negroni', 2]])
  })

  it('prese TUTTE le righe non si divide niente: la comanda avanza e basta', () => {
    // Annullarla per rifarla identica lascerebbe in giro una comanda
    // annullata che non racconta niente a nessuno.
    const c = { ...comanda, items: [riga('Gin tonic', 3), riga('Negroni', 2)] }
    const esito = dividiComanda(c, [3, 2])
    expect(esito.tutta).toBe(true)
    expect(esito.resta).toEqual([])
    expect(unità(esito.nuova)).toBe(5)
  })

  it('non si è scelto niente: non succede niente', () => {
    expect(dividiComanda(comanda, [0])).toBe(null)
    expect(dividiComanda(comanda, [])).toBe(null)
    expect(dividiComanda(comanda, undefined)).toBe(null)
  })

  it('quantità impossibili non fanno danni', () => {
    // Un −1 o un «boh» arrivati da un tocco storto valgono zero; chiederne
    // più di quante ce ne sono vale tutte quelle che ci sono.
    expect(dividiComanda(comanda, [-3])).toBe(null)
    expect(dividiComanda(comanda, ['boh'])).toBe(null)
    const troppe = dividiComanda(comanda, [99])
    expect(troppe.tutta).toBe(true)
    expect(unità(troppe.nuova)).toBe(5)
  })

  it('IL TOTALE DELLE UNITÀ SI CONSERVA SEMPRE', () => {
    const c = {
      ...comanda,
      items: [riga('Gin tonic', 5), riga('Negroni', 2), riga('Spritz', 3)],
    }
    const prima = unità(c.items)
    for (const scelte of [[1, 0, 0], [5, 2, 3], [2, 1, 1], [0, 2, 0], [4, 9, 1]]) {
      const esito = dividiComanda(c, scelte)
      expect(unità(esito.nuova) + unità(esito.resta)).toBe(prima)
    }
  })
})

// I DUE ANNULLAMENTI. Uno è un fatto della serata (il conto è saltato),
// l'altro è contabilità interna (la comanda è stata divisa). Nel dato sono
// tutti e due «annullato»: a distinguerli è il motivo scritto sulla comanda,
// ed è su quello che si filtra — non sullo stato.
describe('annullata davvero o annullata perché divisa', () => {
  it('solo la divisione porta il suo motivo', () => {
    expect(annullataPerDivisione({ status: 'annullato', annullata_per: 'divisione' })).toBe(true)
    expect(annullataPerDivisione({ status: 'annullato' })).toBe(false)
    expect(annullataPerDivisione({ status: 'ricevuto', annullata_per: 'divisione' })).toBe(false)
    expect(annullataPerDivisione(null)).toBe(false)
  })
})

describe('su quali comande si propone la preparazione parziale', () => {
  const riga = (qty) => ({ drink_id: 'gin', name: 'Gin tonic', qty, unit_price: 8 })

  it('solo su una comanda ancora DA FARE', () => {
    // Quello che è già al banco non si divide: il lavoro è cominciato.
    expect(comandaDivisibile({ status: 'ricevuto', items: [riga(2)] })).toBe(true)
    for (const st of ['in_preparazione', 'pronto', 'ritirato', 'annullato']) {
      expect(comandaDivisibile({ status: st, items: [riga(2)] })).toBe(false)
    }
    expect(comandaDivisibile(null)).toBe(false)
  })

  it('e solo se c’è più di un drink: su uno solo la scelta è tutto o niente', () => {
    expect(comandaDivisibile({ status: 'ricevuto', items: [riga(1)] })).toBe(false)
    expect(comandaDivisibile({ status: 'ricevuto', items: [] })).toBe(false)
    expect(comandaDivisibile({ status: 'ricevuto', items: [riga(1), riga(1)] })).toBe(true)
  })
})

// La firma dice se il server ha ormai recepito il gesto fatto qui: serve a
// buttare via la copia locale senza far «rimbalzare» la card allo stato di
// prima.
describe('la firma delle comande', () => {
  const c = (id, status, qty) => ({ id, status, items: [{ drink_id: 'x', qty }] })

  it('cambia quando cambia il passo o quante unità ci sono', () => {
    expect(firmaComande([c('c1', 'ricevuto', 2)])).not.toBe(
      firmaComande([c('c1', 'in_preparazione', 2)])
    )
    expect(firmaComande([c('c1', 'ricevuto', 2)])).not.toBe(firmaComande([c('c1', 'ricevuto', 3)]))
  })

  it('non cambia per i campi che non si vedono', () => {
    // Dal server le comande tornano con orari e snapshot del magazzino in
    // più: confrontando gli oggetti interi la copia locale non se ne
    // andrebbe mai.
    const dalServer = {
      ...c('c1', 'ricevuto', 2),
      status_times: { ricevuto: '2026-08-16T21:00:00.000Z' },
      inventory_consumption: [{ id: 'gin', qty: 40 }],
    }
    expect(firmaComande([dalServer])).toBe(firmaComande([c('c1', 'ricevuto', 2)]))
  })
})


// ── I GRUPPI DELLE RIGHE DENTRO IL CONTO ───────────────────────
//
// Gli stati del servizio stanno sulle COMANDE, non sul conto: con una
// comanda sola tutti i drink sono nello stesso passo e non c'è niente da
// intestare. Appena il banco ne divide una, aprendo il conto si deve
// vedere cosa è al banco e cosa è già uscito.
import { gruppoDiRiga, gruppiDelConto, titoloGruppo } from '../../src/lib/comande.js'

describe('a che punto sta ogni riga del conto', () => {
  const daComanda = (status) => ({ source: 'comanda', status })
  const bozza = { source: 'draft' }

  it('una riga sta nel passo della sua comanda; quella pagata sta fra i pagati', () => {
    expect(gruppoDiRiga(daComanda('in_preparazione'))).toBe('in_preparazione')
    expect(gruppoDiRiga({ ...daComanda('pronto'), paid: true })).toBe('pagati')
    // le righe della bozza non sono ancora lavoro di nessuno
    expect(gruppoDiRiga(bozza)).toBe(null)
  })

  it('con una comanda sola c’è UN gruppo: niente titoli', () => {
    // Di base la comanda esce tutta per l'intero ordine, e un titolo per
    // dire una cosa sola è rumore.
    const righe = [daComanda('ricevuto'), daComanda('ricevuto'), bozza]
    expect(gruppiDelConto(righe)).toEqual(['ricevuto'])
  })

  it('divisa la comanda i gruppi sono in ordine di lavorazione, coi pagati in fondo', () => {
    const righe = [
      { ...daComanda('pronto'), paid: true },
      daComanda('pronto'),
      daComanda('ricevuto'),
      daComanda('in_preparazione'),
    ]
    expect(gruppiDelConto(righe)).toEqual([
      'ricevuto',
      'in_preparazione',
      'pronto',
      'pagati',
    ])
  })

  it('PAGATO IN CASSA E IN PREPARAZIONE AL BANCO: due titoli, nessuna contraddizione', () => {
    // Un conto si incassa in qualunque stato di servizio. Se il gruppo
    // «Pagati» scacciasse quello del servizio, aprendo il conto si
    // leggerebbe che è tutto sistemato mentre un drink è ancora da fare.
    const righe = [daComanda('in_preparazione'), { ...daComanda('ritirato'), paid: true }]
    expect(gruppiDelConto(righe)).toEqual(['in_preparazione', 'pagati'])
    expect(titoloGruppo('in_preparazione')).toBe('🍹 In preparazione')
    expect(titoloGruppo('pagati')).toBe('💳 Pagati')
  })

  it('un gruppo che non esiste non ha titolo', () => {
    expect(titoloGruppo(null)).toBe(null)
    expect(titoloGruppo('boh')).toBe(null)
  })
})


// ── I PASSI DI UNA COMANDA, CON L'ORA ────────────────────────
//
// Sulla card basta «da quanto sta lì»; aperta la comanda le domande
// diventano altre — quando è entrata, quando qualcuno l'ha presa in
// carico, quanto è rimasta pronta prima di partire. Al banco quei minuti
// sono la differenza fra «siamo indietro» e «questo ticket è stato
// dimenticato».
import { tappeComanda } from '../../src/lib/comande.js'

describe('i passi di una comanda', () => {
  const ORA = '2026-08-18T21:00:00.000Z'
  const POI = '2026-08-18T21:04:00.000Z'

  it('quelli già toccati portano l’ora, quelli davanti no', () => {
    const tappe = tappeComanda({
      status: 'in_preparazione',
      status_times: { ricevuto: ORA, in_preparazione: POI },
    })
    expect(tappe.map((t) => [t.stato, t.fatta, t.adesso, t.quando])).toEqual([
      ['ricevuto', true, false, ORA],
      ['in_preparazione', true, true, POI],
      ['pronto', false, false, null],
      ['ritirato', false, false, null],
    ])
  })

  it('appena entrata: un passo solo alle spalle', () => {
    const tappe = tappeComanda({ status: 'ricevuto', status_times: { ricevuto: ORA } })
    expect(tappe.filter((t) => t.fatta).map((t) => t.stato)).toEqual(['ricevuto'])
    expect(tappe.find((t) => t.adesso).stato).toBe('ricevuto')
  })

  it('servita: sono tutti fatti, e nessuno resta davanti', () => {
    const tappe = tappeComanda({ status: 'ritirato', status_times: { ritirato: POI } })
    expect(tappe.every((t) => t.fatta)).toBe(true)
    expect(tappe.at(-1).adesso).toBe(true)
  })

  it('ANNULLATA: tiene gli orari che aveva e si porta in fondo il passo che l’ha chiusa', () => {
    // Fuori dal flusso l'unica prova di essere passati di lì è l'orario
    // segnato: contando i passi, una comanda che al banco c'era stata
    // davvero risulterebbe «mai arrivata».
    const tappe = tappeComanda({
      status: 'annullato',
      status_times: { ricevuto: ORA, in_preparazione: POI, annullato: POI },
    })
    expect(tappe.map((t) => t.stato)).toEqual([
      'ricevuto',
      'in_preparazione',
      'pronto',
      'ritirato',
      'annullato',
    ])
    expect(tappe.filter((t) => t.fatta).map((t) => t.stato)).toEqual([
      'ricevuto',
      'in_preparazione',
      'annullato',
    ])
    expect(tappe.at(-1).adesso).toBe(true)
  })

  it('senza orari non si inventa niente', () => {
    const tappe = tappeComanda({ status: 'ricevuto' })
    expect(tappe.every((t) => t.quando === null)).toBe(true)
    expect(tappeComanda(null).length).toBe(4)
  })
})
