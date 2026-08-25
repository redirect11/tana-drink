// @vitest-environment happy-dom
'use strict'

// LA STAMPA DELLA COMANDA NON È UN AVVISO (BUG-050).
//
// Per anni l'auto-stampa è vissuta dentro il blocco della notifica «nuovo
// ordine», ereditandone i filtri. Due danni, tutti e due visti al banco:
// l'ordine battuto da QUESTO terminale non stampava mai la comanda («non
// avvisare chi l'ha battuto» è giusto per un beep, non per la stampante),
// e la SECONDA comanda di un conto già aperto non stampava — il blocco
// scattava solo sull'ordine nuovo.
//
// Ora la regola è per COMANDA: esce quello che è ancora al banco, nato da
// poco, una volta sola per terminale. Chiunque l'abbia battuto.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { comandaPerLeAggiunte, statoComandaNuova } from '../../src/lib/comande.js'
import { idDispositivo } from '../../src/lib/dispositivo.js'
import {
  comandeDaStampare,
  stampaQuestoTerminale,
  comandaDelTicket,
  comandeStampabili,
  printComande,
  claimComandaPrint,
  releaseComandaPrint,
} from '../../src/lib/printer.js'

const ORA = Date.parse('2026-08-20T21:00:00.000Z')
const nataDa = (ms) => new Date(ORA - ms).toISOString()
const comanda = (over = {}) => ({
  id: 'c1',
  status: 'ricevuto',
  created_at: nataDa(60_000),
  ...over,
})
const conto = (comande, over = {}) => ({ id: 'o1', status: 'aperto', comande, ...over })
// Il terminale che sta guardando questa coda: l'id vero, quello che
// `battutoDaQui` confronta. Chiedendolo qui si prova la regola con la
// stessa strada dell'app, senza finzioni.
const QUI = idDispositivo()
const ALTRO = 'tablet-della-sala'

beforeEach(() => localStorage.clear())

describe('quali comande si stampano', () => {
  it('quella appena arrivata, battuta da questo terminale', () => {
    // IL TEST DI PRIMA DICEVA IL CONTRARIO — «chiunque l'abbia battuta» —
    // ed è cambiata la decisione, non il codice sotto: «solo il terminale
    // che inserisce l'ordine stampa automaticamente la comanda» (l'utente,
    // 20/08). Chi stampa adesso è una domanda con una risposta sola, e sta
    // qui sotto per intero.
    const o = conto([comanda()], { placed_by: { name: 'Io', device: QUI } })
    expect(comandeDaStampare(o)).toHaveLength(1)
  })

  it('anche la seconda comanda di un conto già aperto', () => {
    const o = conto([
      comanda({ id: 'c1', status: 'pronto' }), // la prima è già avanti
      comanda({ id: 'c2', created_at: nataDa(5_000) }), // questa è appena nata
    ])
    const da = comandeDaStampare(o)
    expect(da.map((c) => c.id)).toEqual(['c2'])
  })

  it('una comanda già pronta o uscita non si stampa: è tardi', () => {
    for (const status of ['pronto', 'ritirato']) {
      expect(comandeDaStampare(conto([comanda({ status })]))).toHaveLength(0)
    }
  })

  it('le annullate e i conti annullati non stampano niente', () => {
    expect(comandeDaStampare(conto([comanda({ status: 'annullato' })]))).toHaveLength(0)
    expect(comandeDaStampare(conto([comanda()], { status: 'annullato' }))).toHaveLength(0)
  })

  // IL SEGNO STA SUL DATO: un browser con la memoria vuota vede
  // `auto_print_at` e non ristampa la serata; il secondo tablet con
  // l'auto-stampa accesa vede il segno del primo e non fa la seconda copia.
  it('una comanda già segnata stampata non si ristampa, da nessun terminale', () => {
    const stampata = comanda({ auto_print_at: nataDa(30_000) })
    expect(comandeDaStampare(conto([stampata]))).toHaveLength(0)
  })
})

// ── CHI STAMPA: SOLO IL TERMINALE CHE HA BATTUTO L'ORDINE ────────────
//
// «Solo il terminale che inserisce l'ordine stampa automaticamente la
// comanda» (l'utente, 20/08). È l'INVERSO di BUG-050 — lì il proprio
// terminale era l'unico che NON stampava — e per questo la regola sta in
// una funzione sola, provata nei due versi: sbagliarne il segno vuol dire
// o nessuna carta o la carta sul tablet sbagliato.
describe('quale terminale stampa la comanda', () => {
  const daStaff = (device) => conto([comanda()], { placed_by: { name: 'Marta', device } })

  it('quello che ha battuto l’ordine: la carta esce qui', () => {
    expect(stampaQuestoTerminale(daStaff(QUI))).toBe(true)
    expect(comandeDaStampare(daStaff(QUI))).toHaveLength(1)
  })

  it('gli altri tacciono, anche con l’interruttore acceso', () => {
    // L'interruttore non entra in questa funzione apposta: dice SE questo
    // terminale stampa in automatico, non QUALI ordini gli appartengono.
    expect(stampaQuestoTerminale(daStaff(ALTRO))).toBe(false)
    expect(comandeDaStampare(daStaff(ALTRO))).toEqual([])
  })

  // L'ASSUNZIONE, scritta come tale (REQ-STAMPA-013): un ordine battuto
  // dal cliente col telefono non ha un terminale che l'ha inserito, e
  // qualcuno la carta la deve far uscire. La fa uscire chi ha
  // l'interruttore — il banco — come si è sempre fatto.
  it('l’ordine del cliente non ha un terminale suo: lo stampa chi ha l’interruttore', () => {
    expect(comandeDaStampare(conto([comanda()]))).toHaveLength(1)
    expect(comandeDaStampare(conto([comanda()], { placed_by: { name: 'Cliente' } }))).toHaveLength(1)
  })

  // COL RIMBALZO la regola si ferma: il locale ha scelto che le comande
  // della sala escono al banco, e il telefono che prende l'ordine non
  // stampa affatto (REQ-STAMPA-008). Restringere anche qui vorrebbe dire
  // che non stampa nessuno.
  it('col rimbalzo il banco stampa anche gli ordini degli altri', () => {
    const impostazioni = { stampaSala: 'rimbalzo' }
    expect(stampaQuestoTerminale(daStaff(ALTRO), { impostazioni })).toBe(true)
    expect(comandeDaStampare(daStaff(ALTRO), { impostazioni })).toHaveLength(1)
  })

  // IL GIRO VERO AL BANCO (BUG-057): si batte il conto, e mentre si
  // compone la sessione di creazione tiene ferma la stampante. Si esce, la
  // coda vede la comanda — e la carta esce QUI, non sul tablet accanto.
  it('batto, esco, e la carta esce da questo terminale e non dagli altri', () => {
    const inCreazione = {
      ...conto([comanda()], { placed_by: { name: 'Io', device: QUI } }),
      in_creazione: true,
    }
    expect(comandeDaStampare(inCreazione)).toEqual([]) // finché compongo
    const uscito = { ...inCreazione, in_creazione: false }
    expect(comandeDaStampare(uscito)).toHaveLength(1)
    // Lo stesso conto, guardato dal tablet accanto: niente.
    expect(comandeDaStampare(uscito, { daQui: () => false })).toEqual([])
  })

  // LA RISTAMPA DELLE AGGIUNTE segue la stessa strada: una comanda ancora
  // «da fare» che accoglie righe nuove si azzera `auto_print_at` (api.js) e
  // torna fra quelle da stampare — dal terminale che l'ha battuta.
  it('la comanda che accoglie aggiunte ristampa dov’è stata battuta', () => {
    const conAggiunte = conto([comanda({ auto_print_at: null })], {
      placed_by: { name: 'Marta', device: ALTRO },
    })
    expect(comandeDaStampare(conAggiunte)).toEqual([])
    expect(comandeDaStampare({ ...conAggiunte, placed_by: { device: QUI } })).toHaveLength(1)
  })
})

describe('una copia per comanda, per terminale', () => {
  it('la pretesa passa una volta e poi mai più: tornare agli ordini non ristampa', () => {
    expect(claimComandaPrint('o1', 'c1')).toBe(true)
    // È il giro che prima «funzionava per sbaglio»: si tornava alla coda,
    // tutto risultava nuovo, e si ristampava. Ora la memoria è del
    // terminale, non della schermata.
    expect(claimComandaPrint('o1', 'c1')).toBe(false)
  })

  it('comande diverse dello stesso conto sono pretese diverse', () => {
    expect(claimComandaPrint('o1', 'c1')).toBe(true)
    expect(claimComandaPrint('o1', 'c2')).toBe(true)
  })

  it('la stampa fallita restituisce la pretesa: al prossimo giro si riprova', () => {
    claimComandaPrint('o1', 'c1')
    releaseComandaPrint('o1', 'c1') // carta finita, stampante spenta
    expect(claimComandaPrint('o1', 'c1')).toBe(true)
  })
})

// ── UN TICKET È UNA COMANDA SOLA (BUG-051) ──────────────────────────
//
// «Ho trovato una finestra facsimile con una comanda ma in realtà ne aveva
// due» (l'utente, 20/08, sull'emulatore). Non era la stampante finta che
// accorpava: era printComanda che, senza una comanda da stampare, ripiegava
// sull'AGGREGATO del conto — tutte le comande fuse in un ticket, con le
// quantità sommate. Ci si arrivava dal tasto «Comanda» della coda, che cerca
// la comanda ATTIVA: su un conto senza più comande aperte (tutto servito, o
// pagato) non ne trova nessuna e finiva a stampare l'intero conto.
describe('quale comanda finisce sul ticket', () => {
  const c = (id, over = {}) => ({ id, status: 'ricevuto', items: [], ...over })

  it('quella che il chiamante indica, sempre', () => {
    const o = conto([c('c1'), c('c2')])
    expect(comandaDelTicket(o, o.comande[0]).id).toBe('c1')
  })

  it('senza indicazione NON si fondono due comande: si stampa l’ultima', () => {
    // Il difetto in una riga: qui si tornava `null` e printComanda ripiegava
    // su order_items, cioè le due comande insieme.
    const o = conto([c('c1'), c('c2', { status: 'ritirato' })])
    expect(comandaDelTicket(o, null).id).toBe('c2')
  })

  it('un’annullata non è mai «l’ultima»: è lavoro buttato', () => {
    const o = conto([c('c1'), c('c2', { status: 'annullato' })])
    expect(comandaDelTicket(o, null).id).toBe('c1')
  })

  it('un conto senza comande non ne inventa una: l’aggregato resta il ripiego', () => {
    // I doc vecchi e i conti appena nati in locale: lì l'aggregato È la
    // comanda, non la somma di due.
    expect(comandaDelTicket(conto([]), null)).toBe(null)
    expect(comandaDelTicket(undefined, null)).toBe(null)
  })
})

// ── L'INCASTRO CON LA REGOLA DELLE AGGIUNTE (REQ-ORD-016 + BUG-050) ──
//
// Da «in preparazione» in poi un'aggiunta non entra più nella comanda
// vecchia: ne nasce una. E quella nuova deve uscire dalla stampante DA
// SOLA, o il banco si ritrova righe sul conto e niente sulla carta. Le due
// regole vivono in due file diversi (comande.js e printer.js) e nessuno
// garantisce che combacino: questo test le mette in fila.
describe('la comanda nata da un’aggiunta esce da sola', () => {
  const nataAdesso = (id, status) => ({
    id,
    status,
    items: [],
    created_at: nataDa(1_000),
  })

  for (const impostazione of [false, true]) {
    it(`col passo di nascita ${statoComandaNuova({ comande_in_preparazione: impostazione })}`, () => {
      // Il conto ha una comanda presa in carico e già stampata: niente da
      // accogliere, quindi le righe nuove fanno una comanda a parte.
      const alBanco = {
        ...nataAdesso('c1', 'in_preparazione'),
        // PRESA IN MANO DA QUALCUNO, non solo «in preparazione»: dal 20/08
        // il discrimine e' il gesto, non il passo (una comanda nata in
        // preparazione per impostazione del locale accoglie eccome).
        presa_in_carico: true,
        auto_print_at: nataDa(30_000),
      }
      expect(comandaPerLeAggiunte([alBanco])).toBe(null)

      const nuova = nataAdesso('c2', statoComandaNuova({ comande_in_preparazione: impostazione }))
      const o = conto([alBanco, nuova])
      // Solo la nuova: la vecchia porta già il segno.
      expect(comandeDaStampare(o).map((c) => c.id)).toEqual(['c2'])
    })
  }
})


// ── IL CONTO CHE SI STA ANCORA BATTENDO NON STAMPA ───────────────────
//
// Il facsimile col LIMONCELLO da solo (l'utente, 20/08): la carta era
// uscita a meta' composizione, mentre chi stava al POS aveva ancora il
// vassoio da riempire. Finche' la sessione di creazione e' aperta il
// ticket non esce; esce quando si torna agli ordini, e allora e' completo.
// Le due regole stanno in due file diversi — dove finiscono le righe
// (comande.js) e cosa va stampato (printer.js) — e questo test le mette in
// fila, che e' l'unico modo di sapere che combaciano.
describe('finche\' si batte il conto, niente carta', () => {
  const riga = (nome) => ({ drink_id: nome.toLowerCase(), name: nome, qty: 1, unit_price: 5 })

  it('tre aggiunte in creazione: una comanda sola, e nessun ticket', () => {
    // Il locale fa nascere le comande gia' in preparazione: e' il caso che
    // faceva un ticket per riga.
    const passo = statoComandaNuova({ comande_in_preparazione: true })
    let comande = [
      { id: 'c1', seq: 1, status: passo, presa_in_carico: false, items: [riga('Limoncello')] },
    ]
    for (const nome of ['Jefferson', 'Americano', 'Montenegro']) {
      const target = comandaPerLeAggiunte(comande, { inCreazione: true })
      expect(target).not.toBe(null) // se qui e' null, nasce il secondo ticket
      comande = comande.map((c) =>
        c.id === target.id ? { ...c, items: [...c.items, riga(nome)] } : c
      )
    }
    expect(comande).toHaveLength(1)
    expect(comande[0].items).toHaveLength(4)

    const inCorso = { status: 'aperto', in_creazione: true, comande }
    // Mentre si batte: la stampante tace.
    expect(comandeDaStampare(inCorso)).toEqual([])
    // Usciti dalla creazione: esce UN ticket, con tutte e quattro le righe.
    const finito = { ...inCorso, in_creazione: false }
    expect(comandeDaStampare(finito).map((c) => c.id)).toEqual(['c1'])
    expect(comandeDaStampare(finito)[0].items).toHaveLength(4)
  })
})

// ── PIÙ COMANDE DELLO STESSO CONTO, IN UN COLPO (REQ-STAMPA-012) ─────
//
// «Se ho più di una comanda (dello stesso ordine!) devo poterle stampare
// insieme» (l'utente, 20/08). Insieme come GESTO, non come ticket: ognuna
// resta la sua, o sarebbe BUG-051 rifatto apposta.
describe('quali comande si ristampano tutte insieme', () => {
  const c = (id, status = 'ricevuto') => ({ id, status, items: [] })

  it('tutte quelle del conto, in che passo siano', () => {
    // Anche le servite: si ristampa per ricostruire il giro, non per
    // rimandare al banco solo quello che manca.
    const o = conto([c('c1', 'ritirato'), c('c2', 'in_preparazione'), c('c3')])
    expect(comandeStampabili(o).map((x) => x.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('tranne le annullate: è lavoro buttato', () => {
    const o = conto([c('c1'), c('c2', 'annullato')])
    expect(comandeStampabili(o).map((x) => x.id)).toEqual(['c1'])
  })

  it('un conto senza comande non ne stampa nessuna', () => {
    expect(comandeStampabili(conto([]))).toEqual([])
    expect(comandeStampabili(undefined)).toEqual([])
  })
})

// ── E CHE ESCANO DAVVERO SEPARATE ────────────────────────────────────
//
// Qui non si guarda una lista: si guarda LA CARTA. In locale la stampante
// è finta (stampanteFinta.js) e ogni lavoro apre la sua finestra col
// facsimile: contarle e leggerle è l'unico modo di dire che tre comande
// hanno fatto tre ticket e non uno con dentro tutto — che è esattamente il
// difetto da cui è partito tutto (BUG-051).
describe('le comande stampate insieme restano ticket separati', () => {
  let finestre
  let apriOriginale

  beforeEach(() => {
    finestre = []
    apriOriginale = window.open
    window.open = vi.fn(() => {
      const scritto = []
      finestre.push(scritto)
      return {
        document: { write: (html) => scritto.push(html), close: () => {} },
        focus: () => {},
      }
    })
  })
  afterEach(() => {
    window.open = apriOriginale
  })

  it('tre comande, tre ticket, ognuno con le SUE righe', async () => {
    const order = {
      daily_number: 7,
      comande: [
        { id: 'c1', status: 'ritirato', items: [{ qty: 1, name: 'Mojito' }] },
        { id: 'c2', status: 'annullato', items: [{ qty: 9, name: 'Negroni' }] },
        { id: 'c3', status: 'ricevuto', items: [{ qty: 2, name: 'Gin Tonic' }] },
      ],
    }
    // L'annullata resta fuori: due ticket, non tre.
    expect(await printComande(order)).toBe(2)
    expect(finestre).toHaveLength(2)

    const carta = finestre.map((f) => f.join(''))
    expect(carta[0]).toContain('MOJITO')
    expect(carta[0]).not.toContain('GIN TONIC') // il difetto sarebbe qui
    expect(carta[1]).toContain('GIN TONIC')
    expect(carta[1]).not.toContain('MOJITO')
    // E il lavoro buttato non torna al banco.
    for (const c of carta) expect(c).not.toContain('NEGRONI')
  })
})
