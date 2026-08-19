// Logica pura della CODA ordini (niente Firebase): smistamento per stato e
// riepilogo. Il servizio è perpetuo: non esistono più "serate", i conti
// restano aperti finché non li si chiude a mano. Testabile a unità.

import { ORDER_STATUSES, STATUS_LABELS, ritiratoLabel } from './orderStatus.js'
// Il totale di un conto è quello EFFETTIVO (sconto già tolto): la regola sta
// in pagamento.js e non si riscrive qui, o le corsie direbbero una cifra e
// la card un'altra.
import { orderTotal, round2 } from './pagamento.js'
import { isAwaitingPayment } from './payments.js'
// La sala serve e non prepara: quale passo può segnare lo dice ruoli.js,
// che è l'unico posto dove i ruoli si confrontano.
import { puoSegnare } from './ruoli.js'
// Le comande sono il LAVORO del banco: le corsie del bartender le mostrano
// una per una, e le regole su cosa è servito e quanto vale una riga stanno
// in comande.js — qui non si riscrivono.
import {
  nextComandaStatus,
  aggregateItems,
  allServed,
  itemsTotal,
  MOTIVO_ANNULLO,
  motivoAnnullo,
} from './comande.js'

// Smista gli ordini negli stati di lavorazione della COMANDA ATTIVA
// (workflow_status; esclude gli annullati).
export function bucketByStatus(orders) {
  const buckets = {
    [ORDER_STATUSES.RICEVUTO]: [],
    [ORDER_STATUSES.IN_PREPARAZIONE]: [],
    [ORDER_STATUSES.PRONTO]: [],
    [ORDER_STATUSES.RITIRATO]: [],
    [ORDER_STATUSES.PAGATO]: [],
  }
  for (const o of orders || []) {
    const w = o.workflow_status ?? o.status
    if (w === ORDER_STATUSES.ANNULLATO) continue
    if (buckets[w]) buckets[w].push(o)
  }
  return buckets
}

// Riepilogo: numero ordini e totale (esclude gli annullati).
export function ordersRecap(orders, isClosed = () => false) {
  let count = 0
  let total = 0
  let aperti = 0
  let chiusi = 0
  // GLI ANNULLATI SI CONTANO A PARTE. Non sono incassi e non entrano nel
  // totale — ci mancherebbe — ma sapere quanti conti sono saltati in questa
  // apertura è un dato del banco: tre annullati in una serata sono una
  // domanda da farsi.
  let annullati = 0
  for (const o of orders || []) {
    if (annullato(o) || o.status === ORDER_STATUSES.ANNULLATO) {
      annullati += 1
      continue
    }
    count += 1
    total += Number(o.total) || 0
    if (isClosed(o)) chiusi += 1
    else aperti += 1
  }
  return { count, total, aperti, chiusi, annullati }
}

// Conti ancora aperti (non pagati né annullati).
export function openOrdersCount(orders) {
  return (orders || []).filter(
    (o) => o.status !== ORDER_STATUSES.PAGATO && o.status !== ORDER_STATUSES.ANNULLATO
  ).length
}

// I conti INSERITI DA una persona (placed_by). È il filtro «Miei» della
// coda, che ha preso il posto della pagina «I miei ordini» della sala:
// stessa coda per tutti, e chi vuole ritrovare i propri la filtra.
export function inseritiDa(orders, email) {
  const e = String(email || '').trim().toLowerCase()
  if (!e) return []
  return (orders || []).filter((o) => o.placed_by?.email?.toLowerCase() === e)
}

// "Questo conto risponde a quello che sto cercando?" — numero, cliente,
// tavolo, chi l'ha battuto, drink dentro.
//
// Sta qui, in una riga sola, perché la ricerca della coda ha DUE modi di
// usarla: filtrare la lista, oppure lasciarla intera e accendere il conto
// trovato. Se le due strade rispondessero in modo diverso, cambiando
// impostazione lo stesso testo troverebbe conti diversi.
export function ordineCorrisponde(o, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q || !o) return false
  return (
    String(o.daily_number ?? '').includes(q) ||
    !!o.customer_name?.toLowerCase().includes(q) ||
    !!o.table_label?.toLowerCase().includes(q) ||
    !!o.placed_by?.email?.toLowerCase().includes(q) ||
    !!o.placed_by?.name?.toLowerCase().includes(q) ||
    (o.order_items || []).some((i) => i.name?.toLowerCase().includes(q))
  )
}

// Il PRIMO conto che risponde, nell'ordine in cui sta sullo schermo: è
// quello da accendere e da portare sotto gli occhi. L'ordine lo decide chi
// chiama, passando la lista già come la si vede.
export function primoCorrispondente(orders, query) {
  return (orders || []).find((o) => ordineCorrisponde(o, query)) || null
}

// ── I FILTRI DELLA CODA ──────────────────────────────────────────────
// «In corso» è quello che c'è da fare; «Chiusi» sono i conti incassati —
// i soldi della serata — e gli ANNULLATI hanno una tab loro: mescolati ai
// chiusi facevano numero senza essere incassi, e per ritrovarne uno da
// riaprire bisognava cercarlo in mezzo a quelli buoni.
export const annullato = (o) =>
  o?.status === ORDER_STATUSES.ANNULLATO || o?.workflow_status === ORDER_STATUSES.ANNULLATO

// UN CONTO CHIUSO RESTA IN CODA SOLO PER QUESTA APERTURA DI CASSA. La coda
// è il lavoro di adesso: un conto incassato o annullato prima dell'ultima
// chiusura non è lavoro, è storia — sta in Cassa, nella lista ordini. Non
// basta guardare la giornata: in una serata la cassa si chiude e si riapre,
// e i conti della tornata precedente sono già stati contati.
//
// CONTA QUANDO È STATO CHIUSO, NON QUANDO È STATO APERTO. Un conto di ieri
// rimasto aperto e annullato stasera è successo STASERA: guardando la
// sessione in cui era nato spariva dalla tab «annullati» nell'istante in cui
// lo si annullava — si agisce su un conto e quello svanisce, senza sapere se
// l'operazione è andata a buon fine.
//
// I conti APERTI restano sempre, cassa chiusa compresa: quelli sono da
// chiudere, e nasconderli vorrebbe dire perderli.
// Senza un orario di chiusura leggibile si ripiega sulla sessione scritta
// sull'ordine, e in mancanza anche di quella sulla giornata: chi la cassa non
// la apre mai non ha altro riferimento.
export function restaInCoda(o, { chiuso, cassa, apertaDa, giornata, oggi } = {}) {
  if (!chiuso) return true
  const quando = chiusuraDelConto(o)
  if (quando && apertaDa) return quando >= apertaDa
  if (o?.cash_session_id) return o.cash_session_id === cassa
  return !giornata || !oggi || giornata === oggi
}

// Quando il conto è stato chiuso: incassato o annullato.
export function chiusuraDelConto(o) {
  return (
    o?.tempi_conto?.[ORDER_STATUSES.ANNULLATO] ||
    o?.status_times?.[ORDER_STATUSES.ANNULLATO] ||
    o?.paid_at ||
    o?.tempi_conto?.[ORDER_STATUSES.PAGATO] ||
    null
  )
}

export function passaFiltroCoda(o, filtro, isChiuso = () => false) {
  if (filtro === 'tutti') return true
  if (filtro === 'annullati') return annullato(o)
  // Un annullato non è un conto chiuso: è un conto che non c'è più.
  if (filtro === 'chiusi') return isChiuso(o) && !annullato(o)
  return !isChiuso(o)
}

// COSA MOSTRA LA CODA, in una funzione sola: quello che resta in coda per
// questa apertura di cassa, filtrato per la tab scelta. Sta qui e non nella
// pagina perché è la cosa da provare — «annullo un conto e lo ritrovo sotto
// Annullati» — e a provarla a pezzi si finisce col dimostrare che le regole
// funzionano mentre a schermo non compare niente.
export function ordiniInCoda(
  orders,
  {
    filtro = 'attivi',
    sottoChiusi = 'tutti',
    isChiuso = () => false,
    cassa = null,
    apertaDa = null,
    giornataDi = () => null,
    oggi = null,
  } = {}
) {
  return (orders || [])
    .filter((o) =>
      restaInCoda(o, {
        chiuso: isChiuso(o) || annullato(o),
        cassa,
        apertaDa,
        giornata: giornataDi(o),
        oggi,
      })
    )
    .filter((o) => passaFiltroCoda(o, filtro, isChiuso))
    .filter((o) => filtro !== 'chiusi' || passaSottofiltroChiusi(o, sottoChiusi))
}

// ── DENTRO I CHIUSI: SERVITI E NON SERVITI ──────────────────────
//
// Un conto chiuso è un conto INCASSATO, e basta: i soldi sono presi. Ma
// incassato non vuol dire uscito — si paga in anticipo tutte le sere — e
// quei drink vanno fatti lo stesso. La domanda «quali dei conti chiusi
// hanno ancora roba da consegnare?» ha un posto suo, qui dentro, invece di
// tenere quei conti in mezzo a quelli aperti.
//
// SI GUARDANO LE COMANDE, non lo stato del conto: è l'ordine a sapere se
// tutte le sue comande sono uscite (allServed). E le comande ANNULLATE non
// contano — quella roba non si fa e non si serve — se no un conto con
// dentro un drink annullato non risulterebbe servito mai più.
export const SOTTOFILTRI_CHIUSI = [
  ['tutti', 'Tutti'],
  ['serviti', '✅ Serviti'],
  ['non-serviti', '⏳ Da servire'],
]

export function passaSottofiltroChiusi(o, sotto = 'tutti') {
  if (sotto !== 'serviti' && sotto !== 'non-serviti') return true
  // Un conto ANNULLATO non è né servito né da servire: non c'è più niente
  // da portare a nessuno. Sta sotto la sua tab, non qui.
  if (annullato(o)) return false
  const tutto = allServed(o) || o?.workflow_status === ORDER_STATUSES.RITIRATO
  return sotto === 'serviti' ? tutto : !tutto
}

// ── LA VOCE DELLA CASSA NEL MENU DELLA CODA ──────────────────────────
//
// Aprire e chiudere la cassa sono le due cose che si fanno a inizio e fine
// serata, e si fanno dalla schermata in cui si sta già. Ma sono del BANCO:
// chi serve ai tavoli non ci mette mano, e un tasto che risponde «non puoi»
// è peggio di un tasto che non c'è.
//
// Chiudere, poi, non si può con dei conti ancora aperti: un conto aperto è
// un incasso che manca, e far quadrare una serata con dentro un buco non si
// può. La voce resta, spenta, con scritto perché — sparire mentre si cerca
// è il modo migliore per far pensare che l'app sia rotta.
// QUANTI DRINK SONO ANCORA DA FARE. Non si conta guardando i conti: un
// conto può essere già incassato e avere ancora comande al banco — si paga
// in anticipo tutte le sere — e sono proprio quelle che non devono restare
// indietro. Si contano i TICKET: quelli non ancora serviti e non annullati,
// dei conti che esistono ancora. Chi chiama passa la lista che ha in coda
// per questa apertura di cassa.
// QUESTO CONTO HA ANCORA QUALCOSA DA FARE? Non guarda i soldi: un conto
// può essere già incassato e avere comande al banco — si paga in anticipo
// tutte le sere — e sono proprio quelle che non devono sparire da nessuna
// parte. Un conto annullato non ha lavoro: quella roba non si fa.
export function haLavoroDaFare(o) {
  if (annullato(o)) return false
  return (o?.comande || []).some(
    (c) => c.status !== ORDER_STATUSES.RITIRATO && c.status !== ORDER_STATUSES.ANNULLATO
  )
}

// ── NON SI PREPARA QUELLO CHE NON È STATO PAGATO ──────────────
//
// Dove il pagamento è obbligatorio (l'ordine del cliente dal telefono), il
// lavoro non comincia finché i soldi non ci sono. Il blocco vale finché la
// comanda NON È ANCORA STATA PRESA IN CARICO: da lì in poi qualcuno ci ha
// già messo le mani, e togliergli il drink di sotto sarebbe peggio.
//
// «Ancora da prendere in carico» è il passo IN CUI IL LAVORO NASCE, che il
// locale sceglie (statoComandaNuova) — non la costante «ricevuto». Era
// scritta a mano, e in un locale che fa nascere le comande già «in
// preparazione» quel confronto non era mai vero: il blocco non scattava, e
// si preparava un ordine con pagamento obbligatorio non pagato (BUG-027).
export function attesaPagamento(o, passoDiNascita = ORDER_STATUSES.RICEVUTO) {
  return isAwaitingPayment(o) && o?.workflow_status === passoDiNascita
}

export function comandeDaServire(ordini) {
  let quante = 0
  for (const o of ordini || []) {
    if (annullato(o)) continue
    for (const c of o.comande || []) {
      if (c.status === ORDER_STATUSES.RITIRATO || c.status === ORDER_STATUSES.ANNULLATO) continue
      quante += 1
    }
  }
  return quante
}

const quantiConti = (n) => `${n} cont${n === 1 ? 'o' : 'i'}`
const quanteComande = (n) => `${n} comand${n === 1 ? 'a' : 'e'}`

export function voceCassa({
  gestore = false,
  cassaAperta = false,
  contiAperti = 0,
  daServire = 0,
} = {}) {
  if (!gestore) return null
  if (!cassaAperta) {
    return {
      id: 'apri-cassa',
      icon: '🟢',
      label: 'Apri cassa',
      hint: 'Senza cassa aperta non si battono ordini.',
      disabled: false,
    }
  }
  // DUE MOTIVI PER NON CHIUDERE, non più uno.
  //
  // Il primo è di sempre: un conto aperto è un incasso che manca, e far
  // quadrare una serata con dentro un buco non si può.
  //
  // Il secondo è arrivato con gli stati del servizio: un conto può essere
  // incassato e avere ancora drink da fare, quindi «zero conti aperti» non
  // vuol più dire «non c'è più niente in ballo». Chiudere la cassa con tre
  // comande al banco vuol dire mandare a casa la serata con tre drink
  // pagati e mai usciti.
  //
  // LA FRASE RESTA UNA RIGA. Sta sotto il tasto, in cima alla coda, dove lo
  // spazio è quello che avanza: due frasi incolonnate non si leggono in
  // un'occhiata, e quello che serve capire è «non si chiude, e perché».
  const manca = []
  if (contiAperti > 0) manca.push(`chiudi ${quantiConti(contiAperti)}`)
  if (daServire > 0) manca.push(`servi ${quanteComande(daServire)}`)
  return {
    id: 'chiudi-cassa',
    icon: '🔒',
    label: 'Chiudi cassa',
    disabled: manca.length > 0,
    hint: manca.length > 0 ? `Prima ${manca.join(' e ')}` : 'Conta il contante e chiudi la serata.',
  }
}

// ── I GRUPPI IN CODA: PANNELLO, CARTELLO O NIENTE ────────────────────
//
// Tre situazioni, e vanno tenute distinte perché a schermo lo spazio è
// quello che serve agli ordini:
//
//   'pannello'   — i gruppi sono accesi e si mostrano qui: si vedono.
//   'cartello'   — accesi, ma il locale ha scelto di non mostrarli in
//                  coda. Chi apre i «Pannelli» dal ⋯ e non trova niente
//                  penserebbe a un tasto rotto: una riga dice dove si
//                  cambia idea.
//   null         — GRUPPI SPENTI: niente. Chi non usa i gruppi si
//                  ritrovava in coda un riquadro che parlava di una cosa
//                  che non ha, e non è un'informazione che serve mentre si
//                  battono ordini: sta in Impostazioni, dove si accendono.
export function gruppiInCoda({ accesi = false, inCoda = false, pannelli = false } = {}) {
  if (!accesi) return null
  if (inCoda) return 'pannello'
  return pannelli ? 'cartello' : null
}

// ── LE SCHEDE DELLA VISTA «SCHEDE PER STATO» ─────────────────────────
//
// Con gli stati di servizio ACCESI le schede sono i cinque passi del
// lavoro (ricevuto → in preparazione → pronto → ritirato → pagato). Ma con
// gli stati SPENTI quei passi non esistono: si mostravano lo stesso, quasi
// tutti vuoti, e i conti stavano tutti sotto «Ordine ricevuto» — cinque
// linguette per dirne una. Spenti gli stati, un conto è solo in corso,
// chiuso o annullato: le stesse tre voci della griglia, con le stesse
// regole (passaFiltroCoda), così le due viste non litigano mai.
export function schedeCoda(workflowOn) {
  if (workflowOn) return null // ci pensano gli stati di servizio
  return [
    ['attivi', 'In corso'],
    ['chiusi', '💶 Chiusi'],
    ['annullati', '✖️ Annullati'],
  ]
}


// ── LE CORSIE DI STATO ───────────────────────────────────────────────
//
// La quarta vista della coda: una colonna per passo del lavoro, e su ogni
// card UN tasto solo, quello che porta l'ordine al passo dopo. Al banco si
// preme col pollice, di corsa: la domanda a cui risponde è «cosa c'è da
// fare adesso?», non «com'è messo questo conto».
//
// Le corsie NON sono un elenco di stati scritto qui dentro: sono gli stessi
// che usa il resto dell'app (ORDER_STATUSES), riempiti con le stesse regole
// della griglia. Chi chiama passa la lista già ripulita da ordiniInCoda —
// cioè quello che resta in coda per QUESTA apertura di cassa — e qui si
// smista soltanto.
// I NOMI DELLE CORSIE SONO GLI STATI, non delle perifrasi. «Al banco» e
// «Al ritiro» raccontavano DOVE sta il drink; lo stato del servizio dice a
// che punto è, ed è quello che si cerca quando si guarda la colonna e
// quando si legge la storia del conto. Gli id restano quelli di prima: se
// li cambiassimo, chi ha nascosto una colonna se la ritroverebbe accesa.
const CORSIE_LAVORO = [
  { id: 'da-fare', titolo: 'Da fare', stato: ORDER_STATUSES.RICEVUTO },
  { id: 'al-banco', titolo: 'In preparazione', stato: ORDER_STATUSES.IN_PREPARAZIONE },
  { id: 'al-ritiro', titolo: 'Ritiro/Servizio', stato: ORDER_STATUSES.PRONTO },
  { id: 'da-incassare', titolo: 'Da incassare', stato: ORDER_STATUSES.RITIRATO },
]

// Il conto è già saldato? (il pagamento sta sul CONTO, non sulla comanda:
// un ordine può essere pagato in anticipo e non essere ancora uscito)
const contoSaldato = (o) =>
  o?.payment_status === 'pagato' || o?.workflow_status === ORDER_STATUSES.PAGATO


// Totale di una corsia: il totale EFFETTIVO dei conti (sconto già tolto),
// perché è la cifra che si incassa davvero.
const totaleCorsia = (ordini) =>
  round2(ordini.reduce((s, o) => s + orderTotal(o), 0))

export function corsieDiStato(
  ordini,
  { isChiuso = () => false, workflowOn = true, sottoChiusi = 'tutti' } = {}
) {
  const lista = ordini || []

  // STATI DI SERVIZIO SPENTI: i quattro passi non esistono proprio, e
  // quattro colonne vuote non sono una vista — sono un malinteso. Restano
  // le tre cose che un conto può essere, con le etichette e le regole già
  // usate dalla griglia e dalle schede (schedeCoda + passaFiltroCoda), così
  // le viste non raccontano mai due storie diverse.
  if (!workflowOn) {
    return schedeCoda(false).map(([id, titolo]) => {
      const dentro = lista.filter(
        (o) =>
          passaFiltroCoda(o, id, isChiuso) &&
          // Il sottofiltro vale solo dentro i chiusi: è una domanda su
          // quelli, e sugli altri non vuol dire niente.
          (id !== 'chiusi' || passaSottofiltroChiusi(o, sottoChiusi))
      )
      return { id, titolo, stato: null, ordini: dentro, totale: totaleCorsia(dentro) }
    })
  }

  const secchi = bucketByStatus(lista) // gli annullati restano fuori da sé
  return CORSIE_LAVORO.map(({ id, titolo, stato }) => {
    const dentro = (secchi[stato] || [])
      // «Da incassare» sono i conti CONSEGNATI e non ancora saldati: quello
      // già pagato non ha più niente da chiedere e lascia la coda.
      .filter((o) => !isChiuso(o) && !(stato === ORDER_STATUSES.RITIRATO && contoSaldato(o)))
      // PAGATO MA NON ANCORA CONSEGNATO: resta dov'è, con un bollo. Sono i
      // conti saldati in anticipo — il drink è pagato ma non è ancora
      // uscito — e sparire sarebbe il modo migliore per dimenticarseli.
      .map((o) => (contoSaldato(o) ? { ...o, pagatoDaServire: true } : o))
    return { id, titolo, stato, ordini: dentro, totale: totaleCorsia(dentro) }
  })
}

// Cosa fa il tasto, corsia per corsia. Le corsie senza voce qui — «Chiusi»
// e «Annullati», che compaiono solo a stati di servizio spenti — non hanno
// tasto: su un conto già chiuso non c'è niente da far avanzare.
export const AZIONI_CORSIA = {
  // Il tasto dice DOVE VA il conto, non chi lo prende in carico: «Lo
  // preparo io» era una promessa, e la colonna accanto si chiama con lo
  // stato in cui il conto finisce. Stessa parola sul tasto e sulla
  // colonna: si vede dove va a finire prima di premere.
  'da-fare': { etichetta: 'In preparazione', tipo: 'avanza' },
  'al-banco': { etichetta: 'È pronto', tipo: 'avanza' },
  'al-ritiro': { etichetta: 'Ritirato/Servito', tipo: 'avanza' },
  'da-incassare': { etichetta: 'Incassa', tipo: 'incassa' },
  // Stati di servizio spenti: l'unica cosa che resta da fare a un conto in
  // corso è incassarlo, come sulla griglia.
  attivi: { etichetta: 'Incassa', tipo: 'incassa' },
}

// Dove va il drink e per chi: «Tavolo 4», «Bancone · Giulia». È la riga che
// serve a riconoscere il conto quando si urla un numero da dietro il banco.
export function destinazioneConto(o) {
  const dove = o.table_label
    ? `Tavolo ${o.table_label}`
    : o.service_mode === 'banco'
      ? 'Bancone'
      : ''
  return [dove, o.customer_name].filter(Boolean).join(' · ')
}

// ── LE CORSIE DEL BANCO: UNA CARD PER COMANDA ─────────────────
//
// IL MODELLO. Gli stati del servizio riguardano le COMANDE, che fanno
// parte dell'ordine: l'ordine ha i suoi stati (aperto, pagato, annullato),
// le comande ne hanno dei SOTTOSTATI, che sono i passi del lavoro. DI BASE
// la comanda è UNA e esce tutta per l'intero ordine — e allora questa
// vista è indistinguibile da quella dei conti, ed è giusto così. Dividere
// una comanda è la deroga, non la regola: succede quando il banco decide
// di preparare solo una parte, e da quel momento «a che punto sta questo
// conto» non ha più una risposta sola. È per quel caso che le card sono i
// ticket e non i conti.
//
// Ogni card porta il numero del conto, e quello della comanda SOLO se il
// conto ne ha più di una: «#41 · comanda 2» su un conto con un ticket solo
// sarebbe un numero da leggere per non sapere niente.
//
// LE CORSIE SONO SEI — quattro passi del lavoro e due sguardi all'indietro,
// che si guardano di rado e stanno spenti finché non si chiedono (vedi
// CORSIE_SPENTE_ALL_INIZIO). DENTRO CI SONO COMANDE, in tutte:
//
//   Da fare · In preparazione ·       i passi del lavoro, una card per
//   Ritiro/Servizio ·                 comanda
//   Ritirato/Servito
//   Chiuse                            le comande SERVITE di conti PAGATI:
//                                     non c'è più niente da fare né da
//                                     chiedere. Serve a guardare indietro.
//   Annullate                         OGNI comanda in stato annullato:
//                                     tolta a mano dal banco, sparita
//                                     dividendone una in due, o caduta con
//                                     un conto annullato per intero. Sulla
//                                     card c'è scritto quale delle tre è
//                                     stata (motivoAnnullo).
//                                     Nessuna delle due ha tasti di lavoro.
//
// C'ERA UNA COLONNA «DA INCASSARE», E NON C'È PIÙ. Conteneva i CONTI con
// roba servita e non ancora saldata, una card per conto: la paura era che
// tre comande servite dello stesso tavolo diventassero tre tasti che
// chiedono tre volte gli stessi soldi. Ma con la regola «servita ⇒ o da
// incassare o chiusa» quella colonna conteneva esattamente gli stessi drink
// di «Ritirato/Servito», solo raggruppati per conto invece che per ticket:
// due colonne per la stessa cosa. Adesso la card resta la comanda e non
// chiede soldi — dice che quei drink sono usciti — e chi deve ancora
// prenderli lo legge dal bollo, che c'è già e dice se il conto è pagato, in
// parte o per niente.
//
// QUANDO UNA COMANDA È CHIUSA: dopo essere stata SERVITA, non prima. Da lì,
// se il conto è pagato va fra le chiuse; se no resta in «Ritirato/Servito»,
// che il lavoro è finito ma i soldi no.
// PAGATA MA NON ANCORA SERVITA NON È CHIUSA: il drink va fatto lo stesso,
// e quella comanda resta nella corsia del suo passo — col bollo «Pagato»,
// perché è il caso strano (i soldi presi, il drink ancora da fare) ed è
// quello che non deve sfuggire. Lì e basta: mostrarla anche fra le chiuse
// vorrebbe dire farla contare due volte.
//
// I nomi delle ultime due sono al femminile — chiuse, annullate — perché
// qui dentro non ci sono conti: ci sono comande.
const CORSIE_COMANDE = [
  ...CORSIE_LAVORO.filter((c) => c.id !== 'da-incassare'),
  { id: 'ritirati', titolo: 'Ritirato/Servito', stato: ORDER_STATUSES.RITIRATO },
  { id: 'chiusi', titolo: '💶 Chiuse', stato: null },
  { id: 'annullati', titolo: '✖️ Annullate', stato: null },
]

// ── IL PRONTO, UNITO O DIVISO ───────────────────────────────
//
// Dove ritiro e servizio convivono, la colonna del PRONTO tiene due lavori
// diversi: quello che qualcuno deve portare a un tavolo e quello che
// aspetta che il cliente venga a prenderselo. Chi è in sala guarda solo i
// primi, chi sta al bancone solo i secondi.
//
// UNITE DI SUO, col badge sulla card che dice quale delle due è: una
// colonna in più costa larghezza a tutte le altre, e in un locale dove il
// ritiro è l'eccezione sarebbe una colonna quasi sempre vuota. Chi ha le
// due cose a metà e metà le divide, ed è una scelta del TERMINALE (sta nel
// filtro «▦ Colonne»): il tablet della sala e quello del banco non
// guardano lo stesso lavoro.
//
// «RITIRATO/SERVITO» NON SI DIVIDE, ed è voluto: lì il drink è già uscito
// e come sia uscito non cambia più niente da fare. È il traguardo, non una
// destinazione.
export const CORSIE_PRONTO_DIVISO = [
  { id: 'al-ritiro', titolo: 'Da servire', modo: 'tavolo' },
  { id: 'al-ritiro-banco', titolo: 'Da ritirare', modo: 'banco' },
]

// Le corsie del banco come vanno disegnate: la colonna del pronto resta
// una, oppure diventa due. Dividere ha senso solo dove il ritiro esiste —
// col solo servizio non c'è niente da separare.
export function corsieDelPronto({ divise = false, ritiroEsiste = true } = {}) {
  if (!divise || !ritiroEsiste) return null
  return CORSIE_PRONTO_DIVISO
}

// Le due corsie dello sguardo all'indietro partono spente: al banco lo
// schermo serve al lavoro di adesso, e sei colonne su un tablet vogliono
// dire sei colonne strette. Chi le vuole le accende dal filtro, e da lì in
// poi è una scelta di questo terminale.
export const CORSIE_SPENTE_ALL_INIZIO = ['chiusi', 'annullati']

export function corsieComande(ordini, { isChiuso = () => false, prontoDiviso = null } = {}) {
  // La colonna del pronto può diventare due: al suo posto, nello stesso
  // punto della fila, così le altre non si spostano sotto gli occhi.
  const corsie = prontoDiviso
    ? CORSIE_COMANDE.flatMap((c) =>
        c.id === 'al-ritiro'
          ? prontoDiviso.map((d) => ({ ...d, stato: ORDER_STATUSES.PRONTO }))
          : [c]
      )
    : CORSIE_COMANDE
  const secchi = Object.fromEntries(corsie.map((c) => [c.id, []]))
  // Dove va una comanda, per il passo in cui sta. Col pronto diviso il
  // passo da solo non basta: serve anche come si consegna quel conto, e a
  // dirlo è la corsia che porta il `modo`.
  const perStato = Object.fromEntries(
    corsie.filter((c) => c.stato && !c.modo).map((c) => [c.stato, c.id])
  )
  const corsiaDelPronto = (o) => {
    if (!prontoDiviso) return perStato[ORDER_STATUSES.PRONTO]
    // Un conto senza modo scelto è lavoro da portare finché non si dice
    // altro: sparire da tutte e due le colonne sarebbe il modo migliore
    // per dimenticarselo.
    const modo = o?.service_mode === 'banco' ? 'banco' : 'tavolo'
    return prontoDiviso.find((c) => c.modo === modo)?.id
  }

  for (const o of ordini || []) {
    const comande = o.comande || []
    // Il numero del ticket si scrive solo quando i ticket sono più d'uno.
    const numerate = comande.length > 1
    const scheda = (c, extra = {}) => {
      const righe = c ? c.items || [] : aggregateItems(comande)
      return {
        id: c ? `${o.id}:${c.id}` : o.id,
        ordine: o,
        comanda: c,
        numero: o.daily_number ?? null,
        seq: c && numerate ? (c.seq ?? null) : null,
        items: righe,
        totale: round2(c ? itemsTotal(righe) : orderTotal(o)),
        pagatoDaServire: false,
        // Perché è finita fra le annullate: lo porta solo chi ci sta.
        motivo: null,
        ...extra,
      }
    }

    // CONTO ANNULLATO: quella roba non si fa e non si paga. Le sue comande
    // non sono lavoro e non sono soldi — stanno solo nella colonna che
    // serve a ritrovarle. TUTTE, comprese quelle già servite prima che il
    // conto cadesse: anche loro sono «finite lì».
    if (annullato(o)) {
      for (const c of comande) secchi.annullati.push(scheda(c, { motivo: motivoAnnullo(c, o) }))
      continue
    }

    const saldato = contoSaldato(o) || o.status === ORDER_STATUSES.PAGATO || isChiuso(o)
    for (const c of comande) {
      // ANNULLATA SU UN CONTO VIVO — tolta a mano dal banco, o sparita
      // dividendola in due. Prima non compariva da nessuna parte: si
      // separava una comanda e quella di partenza si volatilizzava, e chi
      // la cercava per capire che fine avesse fatto non aveva un posto dove
      // guardare. È esattamente la domanda a cui questa colonna serve a
      // rispondere, e la card dice quale delle tre cose è successa.
      if (c.status === ORDER_STATUSES.ANNULLATO) {
        secchi.annullati.push(scheda(c, { motivo: motivoAnnullo(c, o) }))
        continue
      }
      if (c.status === ORDER_STATUSES.RITIRATO) {
        // SERVITA. Col conto pagato non resta più niente da fare né da
        // chiedere: chiusa. Se no il lavoro è finito ma i soldi no, e
        // restano due cose diverse da guardare — la comanda in
        // «Ritirato/Servito», che dice che è uscita, e il CONTO fra quelli
        // da incassare, che è quello che si porta al tavolo.
        secchi[saldato ? 'chiusi' : 'ritirati'].push(scheda(c))
        continue
      }
      const corsia =
        c.status === ORDER_STATUSES.PRONTO ? corsiaDelPronto(o) : perStato[c.status]
      if (!corsia) continue
      // Pagata ma non servita: resta qui, col bollo. Non è chiusa — il
      // drink va fatto lo stesso.
      secchi[corsia].push(scheda(c, { pagatoDaServire: saldato }))
    }

  }

  return corsie.map(({ id, titolo, stato }) => ({
    id,
    titolo,
    stato,
    schede: secchi[id],
    // UNA COMANDA DIVISA NON È UN INCASSO PERSO: quei drink si stanno
    // facendo, in due ticket che stanno nelle colonne del lavoro. Contarla
    // nel totale delle annullate direbbe «sono saltati 27 €» mentre quei
    // 27 € sono ancora tutti lì.
    totale: round2(
      secchi[id].reduce(
        (s, x) => s + (x.motivo === MOTIVO_ANNULLO.DIVISIONE ? 0 : x.totale),
        0
      )
    ),
  }))
}

// ── IL TASTO DI UNA CARD DI COMANDA ───────────────────────────
//
// DIPENDE DALLO STATO DELLA COMANDA, NON DALLA COLONNA. La colonna è solo
// un modo di raggruppare: la stessa comanda pronta ha lo stesso tasto sia
// che le colonne siano unite sia che siano divise.
//
// Prima l'azione si pescava da AZIONI_CORSIA, una mappa per ID DI CORSIA.
// Dividendo la colonna del pronto nascono due corsie con id nuovi
// (`al-ritiro-banco`), che in quella mappa non c'erano: niente voce,
// niente tasto — e nella colonna «Da ritirare» la card restava senza il
// tasto che porta la comanda a «Ritirato/Servito» (BUG-026). Una funzione
// che spariva a seconda di come uno guarda la coda. Legandola allo stato
// non si ripresenta al prossimo modo di dividere le colonne.
//
// Chi non ha niente da fare resta senza tasto: le annullate, e le servite
// di un conto già saldato — niente da preparare, niente da chiedere.
export function azioneComanda(comanda, order, { ruolo = null } = {}) {
  // Card del CONTO (la colonna dei soldi): lì non c'è un ticket da far
  // avanzare, c'è un conto da incassare.
  if (!comanda) return { etichetta: 'Incassa', tipo: 'incassa' }
  if (comanda.status === ORDER_STATUSES.ANNULLATO) return null
  if (comanda.status === ORDER_STATUSES.RITIRATO) {
    // SERVITA: quei drink sono usciti. Se il conto è ancora aperto chi li
    // ha appena portati al tavolo è spesso quello che incassa, e il tasto
    // porta in cassa senza far cercare il conto.
    const saldato = contoSaldato(order) || order?.status === ORDER_STATUSES.PAGATO
    return saldato ? null : { etichetta: 'Incassa', tipo: 'incassa' }
  }
  const dopo = nextComandaStatus(comanda.status)
  if (!dopo) return null
  // LA SALA SERVE, NON PREPARA. Portare avanti una comanda è di chi versa;
  // alla sala resta l'ultimo passo — «servito» — perché è lei che porta il
  // drink al tavolo. Senza un ruolo dichiarato non si toglie niente: qui si
  // disegna una coda, il permesso vero sta in `ruoli.js` e nelle regole del
  // database.
  if (ruolo && !puoSegnare(ruolo, dopo)) return null
  return { etichetta: etichettaAvanzamento(dopo, order?.service_mode), tipo: 'avanza' }
}

// La parola sul tasto è quella dello STATO IN CUI IL DRINK FINISCE: si vede
// dove va a finire prima di premere. Sull'ultimo passo dipende da come si
// consegna — «Ritirato» al banco, «Servito» al tavolo — perché è la parola
// che si usa davvero: nessuno dice «ritirato» di un drink portato al tavolo.
function etichettaAvanzamento(stato, serviceMode) {
  if (stato === ORDER_STATUSES.RITIRATO) return ritiratoLabel(serviceMode)
  if (stato === ORDER_STATUSES.PRONTO) return 'È pronto'
  return STATUS_LABELS[stato]
}

// ── QUALI CORSIE SI VEDONO ──────────────────────────────────
//
// Chi sta al banco a metà serata guarda «Da fare» e «Al banco» e basta:
// le altre due colonne gli mangiano metà schermo per roba che in quel
// momento non lo riguarda. Si spengono e si riaccendono da un tasto, e la
// scelta è di QUESTO terminale (chi è al banco vuole altro da chi è alla
// cassa), non del locale.
//
// SPEGNERLE TUTTE NON SI PUÒ: una schermata vuota non si distingue da
// un'app rotta, e chi ci arriva non ha modo di capire che è stato lui a
// nasconderle. Se non resta niente si torna a mostrarle tutte.
export function corsieVisibili(corsie, nascoste = []) {
  const via = new Set(nascoste || [])
  const restano = (corsie || []).filter((c) => !via.has(c.id))
  return restano.length > 0 ? restano : corsie || []
}

// ── LA COLONNA CHE IL LOCALE NON USA ──────────────────────────
//
// Col locale che fa nascere le comande già in preparazione, «Da fare» non
// si riempie: nessuna comanda ci nasce. Sparisce dall'elenco delle colonne
// che si accendono e spengono a mano — poter accendere una colonna che
// resterà sempre vuota è un tasto che non fa niente — ma NON è vietata:
// se una comanda ci finisce lo stesso (riportata indietro prima che il
// salto fosse acceso, un conto di ieri, una comanda che qualcuno ha
// rimandato a mano) la colonna compare da sé. IL LAVORO NON SI NASCONDE
// MAI, e a mostrarlo è l'app — non una voce di menu che l'utente deve
// trovare.
export function corsieSceglibili(corsie, { passoDiNascita = null } = {}) {
  if (passoDiNascita !== ORDER_STATUSES.IN_PREPARAZIONE) return corsie || []
  return (corsie || []).filter((c) => c.id !== 'da-fare')
}

export function corsieDaMostrare(corsie, nascoste = [], { passoDiNascita = null } = {}) {
  const via = new Set(nascoste || [])
  if (passoDiNascita === ORDER_STATUSES.IN_PREPARAZIONE) {
    const daFare = (corsie || []).find((c) => c.id === 'da-fare')
    if (daFare && (daFare.schede || []).length === 0) via.add('da-fare')
    else via.delete('da-fare')
  }
  return corsieVisibili(corsie, [...via])
}

// DA QUANTO STA LÌ. Sulla card conta l'ordine di grandezza, non l'orologio:
// «appena ora» per i secondi appena passati, i secondi finché sono pochi,
// poi i minuti — e dopo un'ora le ore, perché a quel punto la domanda non è
// più «quanto manca» ma «questo perché è ancora qui?».
export function daQuanto(quando, adesso = Date.now()) {
  const t = Date.parse(quando || '')
  if (!Number.isFinite(t)) return ''
  const sec = Math.max(0, Math.round((adesso - t) / 1000))
  if (sec < 10) return 'appena ora'
  if (sec < 60) return `${sec} s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h`
}
