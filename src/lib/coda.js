// Logica pura della CODA ordini (niente Firebase): smistamento per stato e
// riepilogo. Il servizio è perpetuo: non esistono più "serate", i conti
// restano aperti finché non li si chiude a mano. Testabile a unità.

import {
  ORDER_STATUSES,
  STATUS_LABELS,
  statoAlBanco,
  placedByLetter,
  placedByName,
} from './orderStatus.js'
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
  ORDER_OPEN,
} from './comande.js'
// La giornata commerciale di un conto: la regola del taglio delle 5 sta
// tutta lì dentro, qui si sceglie solo QUALE data guardare.
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'

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

// ── CHI HA APERTO IL CONTO: IL FILTRO DEGLI AUTORI ───────────────────
//
// ERA UNA PASTIGLIA «✍️ Miei», accesa o spenta: o tutti o solo i propri.
// «Il filtro miei dovrebbe diventare un menu a tendina dove di default
// sono selezionati tutti gli utenti che hanno aperto almeno un ordine per
// vedere tutti gli ordini. Poi posso scegliere di deselezionare e vedere
// solo gli ordini di qualcuno (i miei ad esempio)» (l'utente, 20/08/2026).
//
// La chiave di un autore è la sua EMAIL, non la lettera della legenda: due
// persone con la stessa iniziale sulle card si distinguono a fatica, ma nel
// filtro sarebbero proprio lo stesso autore.
export const AUTORE_CLIENTE = '__cliente__'

// Chi ha aperto questo conto. Gli ordini arrivati dall'app del cliente non
// hanno uno staff dietro: stanno tutti sotto una voce sola, come nella
// legenda sopra la coda (placedByLetter torna null proprio per loro).
export function autoreDi(o) {
  const p = o?.placed_by
  if (!placedByLetter(p)) return AUTORE_CLIENTE
  return String(p.email || placedByName(p)).trim().toLowerCase()
}

// GLI AUTORI CHE LA TENDINA MOSTRA: chi ha aperto almeno un conto fra
// quelli caricati. Non l'elenco del personale — un filtro con dentro gente
// che stasera non ha battuto niente è una lista da leggere per niente — e
// non le presenze, che rispondono a un'altra domanda (chi c'è adesso).
//
// In ordine alfabetico, i clienti in fondo: sono una voce sola e non un
// nome, e in mezzo ai nomi si cercherebbero alla lettera «C».
export function autoriDeiConti(orders) {
  const visti = new Map()
  for (const o of orders || []) {
    const chiave = autoreDi(o)
    if (visti.has(chiave)) continue
    visti.set(chiave, {
      chiave,
      nome: chiave === AUTORE_CLIENTE ? 'Clienti' : placedByName(o.placed_by) || chiave,
    })
  }
  const voci = [...visti.values()]
  return [
    ...voci.filter((v) => v.chiave !== AUTORE_CLIENTE).sort((a, b) => a.nome.localeCompare(b.nome)),
    ...voci.filter((v) => v.chiave === AUTORE_CLIENTE),
  ]
}

// QUALI AUTORI STANNO FILTRANDO ADESSO. `null` vuol dire TUTTI, e non è
// la stessa cosa di «l'elenco di tutti quelli di adesso»: la coda vive
// mentre si lavora, e chi apre il suo primo conto alle undici deve entrare
// da solo in una tendina lasciata al default — con l'elenco materializzato
// resterebbe fuori senza che nessuno l'abbia deciso.
//
// Una scelta che non esiste più (chi aveva conti e adesso non ne ha) si
// ignora, e se non ne resta nessuna si torna a tutti: MAI ZERO AUTORI,
// stessa regola degli stati (una coda vuota per forza è un'app rotta).
export function autoriAttivi(scelti, elenco = []) {
  const chiavi = elenco.map((v) => v.chiave)
  if (scelti == null) return chiavi
  const vivi = chiavi.filter((k) => scelti.includes(k))
  return vivi.length > 0 ? vivi : chiavi
}

// Accendi o spegni un autore. Torna `null` quando la scelta ricopre tutti
// quelli in elenco: «tutti» è uno stato a sé, non una lista che per caso
// li contiene tutti — solo così un autore nuovo entra da solo.
//
// MAI ZERO: deselezionare l'ultimo rimasto riseleziona tutti. È la stessa
// risposta della regola sugli stati (l'utente non l'ha chiesto per gli
// autori, ma è la stessa domanda: una coda vuota non si può mostrare) e
// nella tendina si legge da sé — tutte le voci tornano accese.
export function cambiaAutoreScelto(scelti, tocco, elenco = []) {
  const chiavi = elenco.map((v) => v.chiave)
  if (!chiavi.includes(tocco)) return scelti
  const attivi = new Set(autoriAttivi(scelti, elenco))
  if (attivi.has(tocco)) attivi.delete(tocco)
  else attivi.add(tocco)
  if (attivi.size === 0 || attivi.size === chiavi.length) return null
  return chiavi.filter((k) => attivi.has(k))
}

// I conti di chi è selezionato. Con tutti selezionati non si tocca niente:
// non si paga una passata sulla lista per una domanda a cui la risposta è
// «tutto».
export function conAutori(orders, scelti, elenco = []) {
  if (scelti == null) return orders || []
  const dentro = new Set(autoriAttivi(scelti, elenco))
  if (dentro.size === elenco.length) return orders || []
  return (orders || []).filter((o) => dentro.has(autoreDi(o)))
}

// COSA DICE LA PASTIGLIA DA CHIUSA. Una tendina che non dice cosa è scelto
// costringe ad aprirla per ricordarselo (docs/navigazione.md): col nome se
// l'autore è uno solo — è il caso che si usa, «vedo i miei» — col
// conteggio se sono di più, che tre nomi in fila non ci stanno.
export function riassuntoAutori(scelti, elenco = []) {
  const attivi = autoriAttivi(scelti, elenco)
  if (attivi.length === 0 || attivi.length === elenco.length) return '✍️ Autori'
  if (attivi.length === 1) {
    return `✍️ ${elenco.find((v) => v.chiave === attivi[0])?.nome || 'Autori'}`
  }
  return `✍️ ${attivi.length} autori`
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

// L'UNIONE DEGLI STATI ACCESI, sottofiltro dei chiusi compreso.
//
// Il sottofiltro («Serviti» / «Da servire») è una domanda sui CHIUSI e
// vale solo dentro di loro: con «Aperti» e «Chiusi» accesi insieme deve
// stringere i chiusi e lasciare stare gli aperti, che serviti o no sono
// comunque da chiudere. Per questo si prova stato per stato invece di
// filtrare l'unione dopo: un conto entra se c'è ALMENO UN filtro acceso
// che lo prende, sottofiltro incluso.
export function passaStatiCoda(o, filtro, isChiuso = () => false, sottoChiusi = 'tutti') {
  return statiDaFiltro(filtro).some(
    (id) =>
      passaFiltroCoda(o, id, isChiuso) &&
      (id !== 'chiusi' || passaSottofiltroChiusi(o, sottoChiusi))
  )
}

// COSA MOSTRA LA CODA, in una funzione sola: quello che resta in coda per
// questa apertura di cassa, filtrato per la tab scelta. Sta qui e non nella
// pagina perché è la cosa da provare — «annullo un conto e lo ritrovo sotto
// Annullati» — e a provarla a pezzi si finisce col dimostrare che le regole
// funzionano mentre a schermo non compare niente.
export function ordiniInCoda(
  orders,
  {
    // Uno stato solo, l'elenco di quelli accesi o 'tutti': ci pensa
    // `statiDaFiltro`. La coda passa l'elenco (i filtri si combinano), le
    // altre chiamate un id secco.
    filtro = STATI_DEFAULT,
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
    .filter((o) => passaStatiCoda(o, filtro, isChiuso, sottoChiusi))
}

// ── LE TRE SCHEDE IN UNA PASSATA SOLA ────────────────────
//
// Le schede della coda sono una DIVISIONE della stessa lista: ogni conto sta
// in una e una sola — in corso, chiuso, annullato. Chiederle una per una
// vuol dire ripassare la lista da capo ogni volta, e la coda lo faceva sei
// volte per disegno (tre per i conteggi delle linguette, due identiche a due
// righe di distanza, una per le corsie) su una lista che con 120 conti è
// già lunga.
//
// Qui si passa una volta e si smista. Le regole sono le stesse di
// `ordiniInCoda` — sono proprio le sue, chiamate qui — perché due modi di
// decidere dove sta un conto sono un modo di farli divergere.
export function contiPerScheda(orders, opzioni = {}) {
  const { isChiuso = () => false, sottoChiusi = 'tutti' } = opzioni
  const dentro = ordiniInCoda(orders, { ...opzioni, filtro: 'tutti' })
  const per = { tutti: dentro, attivi: [], chiusi: [], annullati: [] }
  for (const o of dentro) {
    for (const id of ['attivi', 'chiusi', 'annullati']) {
      if (
        passaFiltroCoda(o, id, isChiuso) &&
        (id !== 'chiusi' || passaSottofiltroChiusi(o, sottoChiusi))
      ) {
        per[id].push(o)
      }
    }
  }
  return per
}

// Le stesse schede quando non c'è niente da smistare: la vista che non è in
// pagina non paga la passata, ma non deve nemmeno accorgersene.
export const SCHEDE_VUOTE = { tutti: [], attivi: [], chiusi: [], annullati: [] }

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
// DUE CHIP E UN NEUTRO CHE NON SI DISEGNA. C'era anche ['tutti', 'Tutti']:
// acceso quasi sempre, diceva «nessun filtro» sembrando un filtro. Adesso
// il neutro è nessuno dei due acceso, che è come si legge una fila di chip
// — acceso vuol dire «sto guardando quello» — e i due sono esclusivi fra
// loro: serviti E da servire insieme sono tutti i chiusi, cioè il neutro.
export const SOTTOFILTRI_CHIUSI = [
  ['serviti', '✅ Serviti'],
  ['non-serviti', '⏳ Da servire'],
]

// Toccare quello acceso lo spegne e torna al neutro; toccare l'altro
// cambia domanda. Vale la stessa regola dei filtri di stato: quello che si
// vede acceso è quello che si sta guardando.
export function cambiaSottoChiusi(sotto, tocco) {
  return sotto === tocco ? 'tutti' : tocco
}

export function passaSottofiltroChiusi(o, sotto = 'tutti') {
  if (sotto !== 'serviti' && sotto !== 'non-serviti') return true
  // Un conto ANNULLATO non è né servito né da servire: non c'è più niente
  // da portare a nessuno. Sta sotto la sua tab, non qui.
  if (annullato(o)) return false
  const tutto = allServed(o) || o?.workflow_status === ORDER_STATUSES.RITIRATO
  return sotto === 'serviti' ? tutto : !tutto
}

// ── I FILTRI DI STATO DELLA CODA: TRE, E SI COMBINANO ────────────────
//
// ERANO QUATTRO SCHEDE che si escludevano a vicenda — In corso, Chiusi,
// Annullati, Tutti — e non erano filtri: erano quattro code diverse, e per
// vedere gli aperti insieme ai chiusi bisognava chiedere «Tutti», cioè
// anche gli annullati.
//
// «Il conteggio dei filtri accesi è inutile sulla schermata degli ordini.
// Non esistono veri e propri filtri. A meno che non diventino davvero dei
// filtri, così togliamo TUTTI. Se diventano dei filtri io posso vedere
// quelli aperti, chiusi se seleziono chiuso e annullati se seleziono
// annullati. Posso anche disabilitare In Corso che deve diventare Aperti,
// non In corso» (l'utente, 20/08/2026).
//
// Adesso sono tre interruttori indipendenti e la coda mostra l'UNIONE di
// quelli accesi. «Tutti» non serve più: è tutti e tre accesi, e si vede.
//
// «APERTI» E NON «IN CORSO»: è la parola con cui la riga dei conteggi
// sopra la coda li chiama già («12 aperti · 40 chiusi»), ed è la parola
// che l'utente ha chiesto. Cambia SOLO qui, dove è il nome del filtro: le
// colonne delle corsie e le linguette della vista a schede (schedeCoda)
// restano «In corso», che lì è il titolo di una colonna, non un filtro.
export const FILTRI_STATO = [
  ['attivi', 'Aperti'],
  ['chiusi', '💶 Chiusi'],
  // Gli annullati hanno un filtro loro: fra i chiusi facevano numero senza
  // essere incassi, e per ritrovarne uno da riaprire si cercava in mezzo a
  // quelli buoni.
  ['annullati', '✖️ Annullati'],
]

export const ID_FILTRI_STATO = FILTRI_STATO.map(([id]) => id)

// Come si apre la coda: quello che c'è da fare, e basta.
export const STATI_DEFAULT = ['attivi']

// Come si chiamano nel `title` del tastino quando la fila è chiusa: corti
// e senza emoji, che lì si legge di corsa.
export const NOME_FILTRO_STATO = { attivi: 'Aperti', chiusi: 'Chiusi', annullati: 'Annullati' }
export const NOME_SOTTOFILTRO = { serviti: 'Serviti', 'non-serviti': 'Da servire' }

// QUALI STATI SONO ACCESI, comunque me li passino. La coda li tiene in un
// array, ma `ordiniInCoda` e `contiPerScheda` sono chiamate anche con la
// vecchia forma a stringa singola ('chiusi', 'tutti'): normalizzare qui
// vuol dire non avere due modi di leggere la stessa domanda.
//
// SENZA NESSUNO SI RIPIEGA SUL DEFAULT. Non dovrebbe succedere —
// `cambiaFiltroStato` non lascia mai il vuoto — ma una coda che non mostra
// NIENTE è indistinguibile da un'app rotta, e vale la riga di prudenza.
export function statiDaFiltro(filtro) {
  if (filtro === 'tutti' || filtro == null) return [...ID_FILTRI_STATO]
  const dati = Array.isArray(filtro) ? filtro : [filtro]
  const dentro = ID_FILTRI_STATO.filter((id) => dati.includes(id))
  return dentro.length > 0 ? dentro : [...STATI_DEFAULT]
}

// ACCENDI E SPEGNI UN FILTRO DI STATO — e la regola del MAI ZERO.
//
// «Il filtro Aperti lo posso deselezionare solo se chiusi, annullati o
// tutti e due sono attivi. Se disattivo il filtro su chiusi e annullati,
// si riattiva il filtro aperti» (l'utente, 20/08/2026).
//
// Le due frasi sono la STESSA regola guardata da due lati: la coda non
// resta mai senza stati, e quando si svuoterebbe torna «Aperti» — che è
// il lavoro da fare, la risposta giusta quando non se n'è chiesta
// nessun'altra. Da lì scendono tutti e due i comportamenti:
//   · spegnere «Aperti» quando è l'unico acceso non fa niente (l'insieme
//     si svuoterebbe e «Aperti» torna dentro): un RIFIUTO SILENZIOSO, che
//     il tocco non lascia traccia e il chip resta acceso dov'era. Niente
//     avviso: al banco un messaggio per un tasto che non doveva partire è
//     rumore, e la coda sotto non è cambiata di una riga;
//   · spegnere l'ultimo fra «Chiusi» e «Annullati» con «Aperti» spento
//     riaccende «Aperti» da solo.
//
// Torna sempre in ordine canonico (aperti, chiusi, annullati): l'insieme è
// un insieme, e due liste con lo stesso contenuto in ordine diverso
// farebbero ridisegnare la coda per niente.
export function cambiaFiltroStato(attivi = [], tocco) {
  const dentro = new Set(statiDaFiltro(attivi))
  if (!ID_FILTRI_STATO.includes(tocco)) return [...dentro].sort(perOrdineDiStato)
  if (dentro.has(tocco)) dentro.delete(tocco)
  else dentro.add(tocco)
  if (dentro.size === 0) dentro.add('attivi')
  return ID_FILTRI_STATO.filter((id) => dentro.has(id))
}

const perOrdineDiStato = (a, b) => ID_FILTRI_STATO.indexOf(a) - ID_FILTRI_STATO.indexOf(b)

// La coda è come si apre? Serve al badge del tastino, che conta le
// DEVIAZIONI dal default: con solo «Aperti» acceso non c'è niente da
// contare, e un tastino che segna sempre almeno un filtro non distingue
// più la coda filtrata da quella intera.
export function statiAlDefault(attivi = []) {
  const dentro = statiDaFiltro(attivi)
  return dentro.length === STATI_DEFAULT.length && STATI_DEFAULT.every((id) => dentro.includes(id))
}

// ── IL TASTO CHE APRE E CHIUDE LA FILA DEI FILTRI ────────────────────
//
// «I filtri e tutti i bottoni li voglio a scomparsa, con un tasto che non
// occupi troppo spazio, sia per ordini sia per comande» (l'utente, 20/08).
//
// ED ERA DIVENTATO UN TASTO IN PIÙ. Prima stava nella riga dei chip e
// portava scritto il filtro acceso — «⚗️ Chiusi», «⚗️ Miei +2» — cioè una
// pastiglia larga in una riga che, da chiusa, esisteva solo per lei.
// «Quando dicevo di nascondere i tasti intendevo tutti e non aggiungere un
// nuovo tasto. Lo spazio da risparmiare è in altezza non in larghezza»
// (l'utente, 20/08). Adesso è un tastino solo icona nella testata, con gli
// altri, e la riga dei chip da chiusa non c'è proprio.
//
// LO STATO NON SPARISCE LO STESSO: sul tastino ci sta un numero — quanti
// filtri sono accesi — perché un filtro acceso e invisibile è una coda che
// sembra sbagliata (dodici conti dove ce ne sono quaranta, e niente a
// schermo che lo dica). QUALI siano lo dice il title (`spiegaFiltri`), che
// larghezza non ne costa: in 44px non ci sta un nome, ci sta una cifra.
export function contaFiltri(attivi = []) {
  return (attivi || []).filter(Boolean).length
}

// IL NOME DEL TASTO È QUELLO CHE IL TASTO FA. «"Filtra la coda" non va bene,
// deve essere "mostra filtri"» (l'utente, 20/08). Il tasto non filtra: apre
// e chiude la fila dei filtri, e si chiama con quel gesto — a filtrare sono
// le pastiglie che compaiono, una per una.
//
// L'ELENCO DI COSA È ACCESO resta accodato al nome, da chiuso: chiusa la
// fila è l'unica cosa che dice QUALI filtri stanno lavorando. Sul tastino ci
// sta solo il numero (`contaFiltri`, 44px); qui i nomi, che nel title
// larghezza non ne costano.
export function spiegaFiltri(attivi = [], aperti = false) {
  const accesi = (attivi || []).filter(Boolean)
  if (aperti) return 'Nascondi filtri'
  if (accesi.length === 0) return 'Mostra filtri'
  return `Mostra filtri — accesi: ${accesi.join(', ')}`
}

// ── IL VERSO DELLA CODA, IN UNA FRECCIA E TRE PAROLE ─────────────────
//
// «Questo testo è completamente insensato. Cioè basta scrivere Prima i più
// recenti/vecchi in base all'ordinamento attuale. E cambia anche l'icona
// (freccia giù freccia sopra)» (l'utente, 20/08). Diceva «Adesso: prima gli
// ultimi — tocca per partire dai primi»: due frasi in una — com'è messa la
// coda e cosa succede a premere — e al banco non se ne legge nessuna.
//
// QUI IL TASTO DICE DOVE SEI, NON DOVE PORTA, ed è una scelta esplicita.
// La regola opposta (docs/navigazione.md) vale per il cambio vista, dove
// «Comande» acceso e «Comande» spento si distinguono solo guardando la
// lista sotto. Un ordinamento invece si legge dalla coda stessa: quello che
// manca è il nome di com'è messa adesso, e quello ci si scrive.
//
// LA FRECCIA SEGUE IL VERSO IN CUI SI SCORRE LA CODA: giù si parte dai più
// recenti e si scende verso i vecchi, su si parte dai più vecchi e si sale
// verso gli ultimi arrivati. Il «↕» di prima era identico nei due stati —
// diceva «qui si ordina», non come.
export function spiegaOrdine(desc = true) {
  return desc
    ? { nome: 'Prima i più recenti', icona: '↓' }
    : { nome: 'Prima i più vecchi', icona: '↑' }
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
  // LA FRASE RESTA UNA RIGA, E CORTA. Sta sotto il tasto, in cima alla
  // coda, dove lo spazio è quello che avanza: due frasi incolonnate non si
  // leggono in un'occhiata, e quello che serve capire è «non si chiude, e
  // perché».
  //
  // «È scomparsa la label sotto al tasto. Diventa "chiudi X conti e X
  // comande"» (l'utente, 20/08). Era «Prima chiudi 3 conti e servi 2
  // comande»: il verbo di mezzo era la parte che la faceva lunga, e la
  // riga sotto un tasto la si legge di sguincio mentre si versa — due
  // numeri e due nomi bastano. Se una delle due quantità è zero si nomina
  // solo l'altra: «Chiudi 2 comande» è l'unica cosa che manca, e scrivere
  // «0 conti» sarebbe una bugia in più da leggere.
  const manca = []
  if (contiAperti > 0) manca.push(quantiConti(contiAperti))
  if (daServire > 0) manca.push(quanteComande(daServire))
  return {
    id: 'chiudi-cassa',
    icon: '🔒',
    label: 'Chiudi cassa',
    disabled: manca.length > 0,
    hint: manca.length > 0 ? `Chiudi ${manca.join(' e ')}` : 'Conta il contante e chiudi la serata.',
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


// ── LE CORSIE DEI CONTI ───────────────────────────────────────────────
//
// La quarta vista della coda, per i CONTI: tre colonne — in corso, chiusi,
// annullati — che sono le tre cose che un conto può essere. Le stesse voci
// della griglia e delle schede, con le stesse regole (schedeCoda +
// passaFiltroCoda), così le viste non raccontano mai due storie diverse.
// Chi chiama passa la lista già ripulita da ordiniInCoda — cioè quello che
// resta in coda per QUESTA apertura di cassa — e qui si smista soltanto.
//
// I PASSI DEL LAVORO NON STANNO QUI. C'era anche un ramo con le quattro
// colonne del servizio (da fare → in preparazione → pronto → da incassare),
// e non lo chiamava più nessuno: l'unico chiamante passava
// `workflowOn: false`, e a tenerlo in vita erano soltanto i suoi test — che
// raccontavano una colonna «Da incassare» che al banco non ha mai visto
// nessuno. Costava più dello spazio: i test sono la specifica, e leggere
// «Da incassare sono i consegnati non saldati» faceva credere che quella
// colonna ci fosse davvero.
//
// I passi del servizio si guardano dalla vista del BANCO, che ragiona per
// COMANDE (corsieComande, qui sotto): un conto con tre comande in tre passi
// diversi non sta in una colonna sola, ed è il motivo per cui quella vista
// è nata.
// I NOMI DELLE CORSIE SONO GLI STATI, non delle perifrasi. «Al banco» e
// «Al ritiro» raccontavano DOVE sta il drink; lo stato del servizio dice a
// che punto è, ed è quello che si cerca quando si guarda la colonna e
// quando si legge la storia del conto. Gli id restano quelli di prima: se
// li cambiassimo, chi ha nascosto una colonna se la ritroverebbe accesa.
const CORSIE_LAVORO = [
  { id: 'da-fare', titolo: 'Da fare', stato: ORDER_STATUSES.RICEVUTO },
  { id: 'al-banco', titolo: 'In preparazione', stato: ORDER_STATUSES.IN_PREPARAZIONE },
  // La stessa parola del tasto e dell'etichetta di stato: vedi statoAlBanco.
  { id: 'al-ritiro', titolo: 'Pronto', stato: ORDER_STATUSES.PRONTO },
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

// LO STATO CHE OGNI COLONNA RAPPRESENTA. Serve al tasto della card: cosa si
// può fare su un conto dipende da com'è messo, non da come si chiama la
// colonna in cui sta (vedi azioneCorsia).
const STATO_CORSIA_CONTI = {
  attivi: ORDER_OPEN,
  chiusi: ORDER_STATUSES.PAGATO,
  annullati: ORDER_STATUSES.ANNULLATO,
}

export function corsieDiStato(ordini, { isChiuso = () => false, sottoChiusi = 'tutti' } = {}) {
  const lista = ordini || []
  return schedeCoda(false).map(([id, titolo]) => {
    const dentro = lista.filter(
      (o) =>
        passaFiltroCoda(o, id, isChiuso) &&
        // Il sottofiltro vale solo dentro i chiusi: è una domanda su
        // quelli, e sugli altri non vuol dire niente.
        (id !== 'chiusi' || passaSottofiltroChiusi(o, sottoChiusi))
    )
    return {
      id,
      titolo,
      stato: STATO_CORSIA_CONTI[id],
      ordini: dentro,
      totale: totaleCorsia(dentro),
    }
  })
}

// ── COSA FA IL TASTO DI UNA CARD DI CONTO ────────────────────
//
// DIPENDE DALLO STATO, NON DALL'ID DELLA COLONNA. Prima era una mappa per id
// (`AZIONI_CORSIA`), ed è esattamente da lì che è nato BUG-026 nella vista
// delle comande: dividendo la colonna del pronto nascevano id nuovi, che in
// quella mappa non c'erano — niente voce, niente tasto, e una funzione
// spariva a seconda di come uno guardava la coda. Lì si è già passati allo
// stato (azioneComanda); qui si fa lo stesso.
//
// Su un conto in corso l'unica cosa da fare è incassarlo, come sulla
// griglia. Su uno chiuso o annullato non c'è più niente da chiedere.
export function azioneCorsia(stato) {
  return stato === ORDER_OPEN ? { etichetta: 'Incassa', tipo: 'incassa' } : null
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

// ── QUANDO IL TASTO «COLONNE» SI ACCENDE ─────────────────────────────
//
// L'acceso deve dire «questo terminale ha cambiato qualcosa rispetto al
// normale», non «esiste uno stato normale». Il primo giro (BUG-058)
// contava le corsie spente: ma due nascono spente DI SERIE, quindi il
// tasto partiva arancione su ogni terminale nuovo e non si spegneva mai
// — «continua ad essere sempre attivo» (l'utente, 20/08, seconda volta).
// Si conta la DIFFERENZA dal normale, nei due versi: nascosta una corsia
// che di serie è accesa, o riaccesa una che di serie è spenta. Contano
// solo le corsie oggi sceglibili: una memoria su una corsia che non è in
// elenco non deve accendere niente.
export function corsieDiverseDalNormale(sceglibili, nascoste = [], normale = CORSIE_SPENTE_ALL_INIZIO) {
  const via = new Set(nascoste || [])
  const base = new Set(normale || [])
  return (sceglibili || []).filter((c) => via.has(c.id) !== base.has(c.id))
}

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

// ── LASCIANDO CADERE UNA COMANDA IN UN'ALTRA COLONNA ──────────────────
//
// «Le comande nella vista a lane possono essere trascinate da una colonna
// all'altra per cambiare stato [...] posso spostarla in QUALSIASI lane,
// quindi gli stati della comanda cambiano di conseguenza» (l'utente,
// 20/08). E la precisazione che dice cos'è: «non è che DEVONO — come modo
// ALTERNATIVO per cambiare stato, le posso trascinare». I tasti restano
// quelli di prima, questa è una seconda strada per lo stesso gesto.
//
// QUI SI DECIDE SOLO DOVE FINISCE. Chi ci scrive è la strada di sempre
// (avanzaComanda → advanceComanda), la stessa dei tasti: le regole del
// magazzino — lo scarico che si applica una volta a «pronto» e non si disfa
// tornando indietro — vivono lì e non si rifanno qui. Un trascinamento che
// scrivesse lo stato per conto suo sarebbe una seconda verità.
//
// VALE IN TUTTE LE DIREZIONI, avanti e indietro: si segna «pronto» il
// ticket sbagliato e lo si riporta a «da fare» col dito, invece di aprire
// il ⋯ e cercare la voce. Restituisce lo stato in cui la comanda finisce,
// oppure null se lì non si può lasciare — e allora la colonna lo dice
// prima, mentre la card è ancora in mano.
//
// LE DUE COLONNE DELLO SGUARDO ALL'INDIETRO NON ACCETTANO NIENTE:
//   «Chiuse» non è un passo del lavoro ma il risultato di due cose insieme
//   (servita + conto pagato), e trascinarci una comanda vorrebbe dire
//   incassare un conto per sbaglio con un dito;
//   «Annullate» sarebbe un annullo, ed è la cosa giusta — ma la strada per
//   annullare UNA comanda con quello che ne consegue sui soldi non c'è
//   ancora (REQ-ORD-021): finché non c'è, quella colonna rifiuta il
//   rilascio invece di far sparire un ticket senza dire dove sono finiti i
//   suoi drink.
export function statoDelRilascio(scheda, corsia, { ruolo = null } = {}) {
  const c = scheda?.comanda
  // Senza uno stato la colonna non è un passo: è uno sguardo all'indietro.
  if (!c || !corsia?.stato) return null
  // Una comanda annullata è lavoro buttato: rianimarla col dito nasconderebbe
  // il motivo per cui è finita lì.
  if (c.status === ORDER_STATUSES.ANNULLATO) return null
  // Rilasciata dov'era già: niente da scrivere, e nessun errore da mostrare.
  if (c.status === corsia.stato) return null
  // LA SALA SERVE, NON PREPARA: lo stesso metro del tasto (azioneComanda),
  // o il trascinamento sarebbe una scorciatoia per aggirare i ruoli.
  if (ruolo && !puoSegnare(ruolo, corsia.stato)) return null
  return corsia.stato
}

// La parola sul tasto è quella dello STATO IN CUI IL DRINK FINISCE: si vede
// dove va a finire prima di premere — ed è la STESSA che intitola la colonna
// in cui finirà, e la stessa dell'etichetta di stato. Per questo passa da
// `statoAlBanco`: le parole del banco stanno in un posto solo, e prima
// «pronto» ne aveva quattro («Pronto», «Pronto al servizio»,
// «Ritiro/Servizio», «È pronto»).
const etichettaAvanzamento = (stato, serviceMode) => statoAlBanco(stato, serviceMode)

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

// ── DI CHE GIORNATA È QUESTO CONTO ───────────────────────────────────
//
// La data di un conto ESISTE SEMPRE, e la scrive il client: `order_date` è
// la giornata commerciale calcolata dall'orologio di chi batte, messa sul
// documento nell'istante in cui il conto nasce (api.js, creaOrdine). Non è
// mai `null`, non aspetta il server, e vale anche offline.
//
// Ma un documento può arrivare monco — importato da un sistema vecchio,
// nato da una strada che non passava di qui, o semplicemente rimasto
// indietro di qualche versione — e allora si ripiega su TUTTE le altre
// date locali che quel conto si porta dietro, in ordine di attendibilità:
//
//   1. `order_date`, la giornata scritta alla nascita;
//   2. `created_at`, l'orario del server (null finché la scrittura è per
//      strada, quindi non può essere il primo);
//   3. l'APERTURA scritta dal client (`status_times.aperto` sul conto, che
//      mapOrder porta in `tempi_conto`): è un ISO dell'orologio di qui,
//      c'è dal primo istante;
//   4. la nascita della prima comanda, anch'essa scritta dal client.
//
// Così anche un conto monco finisce sotto IL SUO giorno, non in un limbo.
export function giornataDelConto(o, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  if (!o) return null
  // `?? null` NON È DECORAZIONE: businessDayKey ha un valore di riserva —
  // `new Date()` — e passandogli `undefined` risponderebbe OGGI. Un campo
  // che manca diventerebbe «oggi» invece di «non lo so», e il ripiego dopo
  // non verrebbe nemmeno provato.
  const giorno = (quando) => businessDayKey(quando ?? null, cutoffHour)
  return (
    o.order_date ||
    giorno(o.created_at) ||
    giorno(o.tempi_conto?.[ORDER_OPEN]) ||
    giorno(o.status_times?.[ORDER_OPEN]) ||
    giorno((o.comande || [])[0]?.created_at) ||
    null
  )
}

// Raggruppa i conti per giornata: oggi in cima, poi i giorni scorsi dal più
// recente. Serve a separare con una riga i conti rimasti indietro.
//
// IL SEGNAPOSTO «—» NON ESISTE PIÙ. I conti senza data finivano in un
// gruppo con quel trattino per chiave, e la chiave del gruppo è la stessa
// cosa che poi va al formattatore delle date: `new Date('—T00:00:00')` non
// è una data, e in cima al gruppo si leggeva «Invalid Date». Se dopo tutti
// i ripieghi la data proprio non c'è — documento monco, caso patologico —
// il conto va sotto OGGI: lì chi lavora lo vede, e non gli si racconta
// niente che non sia vero.
export function raggruppaPerGiornata(lista, { giornataDi, oggi }) {
  const map = new Map()
  for (const o of lista || []) {
    const k = giornataDi(o) || oggi
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(o)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === oggi ? -1 : b[0] === oggi ? 1 : b[0].localeCompare(a[0])))
    .map(([day, orders]) => ({ day, orders }))
}

// ── L'INTESTAZIONE DI UNA GIORNATA IN CODA ───────────────────────────
//
// La coda separa i conti per giornata: oggi in cima, poi i giorni scorsi
// con una riga sopra ciascuno. Quella riga diceva «⏳ Da chiudere · ieri»
// SEMPRE, qualunque scheda fosse aperta — ed è giusta solo dentro «In
// corso», dove un conto di ieri è davvero roba rimasta da chiudere. Fra i
// CHIUSI diceva una bugia: quelli sono pagati e chiusi, non c'è più niente
// da fare. Nella scheda «Tutti», dove i conti sono mescolati, non si può
// dire niente di più della data — e allora si dice solo quella.
//
// La data arriva già scritta da chi chiama (businessDayLabel): qui c'è la
// regola di cosa dire, non come si formatta un giorno.
//
// CON PIÙ FILTRI ACCESI si dice solo la data. Da quando gli stati si
// combinano, «Aperti + Chiusi» mette sotto la stessa riga conti di due
// nature: qualunque etichetta si scegliesse sarebbe giusta per metà.
export function intestazioneGiornata(filtro, data) {
  const stati = statiDaFiltro(filtro)
  if (stati.length > 1) return `📅 ${data}`
  if (stati[0] === 'chiusi') return `💶 Chiusi · ${data}`
  if (stati[0] === 'annullati') return `✖️ Annullati · ${data}`
  return `⏳ Da chiudere · ${data}`
}

// ── LA CODA VUOTA, DETTA COME È FILTRATA ─────────────────────────────
//
// «Nessun ordine in corso» era esatto finché la coda era una scheda sola.
// Con gli stati combinati la frase deve reggere anche «Aperti + Chiusi»,
// dove nessun aggettivo è vero per tutti: lì si dice solo che non c'è
// niente, ed è la verità intera.
const AGGETTIVO_STATO = { attivi: 'aperto', chiusi: 'chiuso', annullati: 'annullato' }

export function frasePerCodaVuota(filtro, soloOggi = false) {
  const stati = statiDaFiltro(filtro)
  const che = stati.length === 1 ? ` ${AGGETTIVO_STATO[stati[0]]}` : ''
  return `Nessun ordine${che}${soloOggi ? ' oggi' : ''}.`
}

// ── LE COLONNE CHE QUESTO TERMINALE HA SPENTO A MANO ─────────────────
//
// Il chip «▦ Colonne» si accende quando qualcuna è spenta. Nasceva acceso e
// restava acceso per sempre, per due motivi che si sommavano: le due corsie
// dello sguardo all'indietro partono spente di suo (CORSIE_SPENTE_ALL_INIZIO),
// quindi l'arancione c'era dal primo avvio e non distingueva niente; e la
// memoria del terminale poteva tenersi id di colonne che non esistono più —
// le corsie sono state rimaneggiate più volte — con l'aggravante che
// nell'elenco non c'era niente da riaccendere per spegnerlo.
//
// Qui le due risposte. QUANTE SONO SPENTE si conta solo fra le colonne che
// in questo momento si possono scegliere: una nascosta che non è nemmeno in
// elenco non è una scelta, è un residuo.
export function corsieSpente(sceglibili, nascoste = []) {
  const via = new Set(nascoste || [])
  return (sceglibili || []).filter((c) => via.has(c.id))
}

// Tutti gli id di corsia che l'app conosce, in qualunque assetto: le
// colonne del banco, quelle dei conti, e le due del pronto diviso — che
// esistono solo dove il ritiro c'è, ma spegnerne una e poi riunire il
// pronto è una scelta che va ricordata, non buttata.
const ID_CORSIE = new Set([
  ...CORSIE_LAVORO.map((c) => c.id),
  ...CORSIE_COMANDE.map((c) => c.id),
  ...CORSIE_PRONTO_DIVISO.map((c) => c.id),
  ...schedeCoda(false).map(([id]) => id),
])

// La memoria del terminale, ripulita dagli id morti. Si chiama all'apertura
// della coda: un id che nessun assetto disegna più non si riaccende da
// nessuna parte, e restando lì terrebbe acceso il chip per sempre.
export function soloCorsieVive(nascoste) {
  return (nascoste || []).filter((id) => ID_CORSIE.has(id))
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
