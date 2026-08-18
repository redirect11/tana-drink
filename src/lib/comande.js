// Logica pura del modello Ordine (conto) / Comande (ticket).
//
// L'ORDINE è il conto: resta `aperto` quanto serve (anche giorni), si chiude solo
// con il pagamento (`pagato`) o con l'annullo (`annullato`).
// Ogni invio di articoli è una COMANDA: è la comanda ad avere il ciclo di
// lavorazione (ricevuto → in_preparazione → pronto → ritirato), come i
// kitchen ticket dei POS di ristorazione.
//
// DETTO IN UNA RIGA: gli stati del SERVIZIO riguardano le COMANDE, che fanno
// parte dell'ordine. L'ordine ha i suoi stati; le comande ne hanno dei
// SOTTOSTATI, che sono quelli del servizio. Se un conto è gestito come una
// comanda sola — e DI BASE è così, la comanda esce tutta per l'intero
// ordine — tutti i suoi drink si trovano sempre nello stesso passo. Succede
// il contrario solo quando il bartender divide la comanda per prepararne una
// parte: è la deroga, non la regola, e quasi tutto quello che c'è qui sotto
// esiste per farla tornare senza perdere niente per strada.
//
// E il pagamento non è uno di quei passi: un conto si incassa in qualunque
// stato di servizio. Dalla cassa è chiuso, dal banco magari no — una comanda
// può essere ancora in preparazione — e le due cose vanno dette insieme.

import { ORDER_STATUSES } from './orderStatus.js'

// Stati dell'ORDINE (conto).
export const ORDER_OPEN = 'aperto'

// Flusso di lavorazione della COMANDA.
export const COMANDA_FLOW = [
  ORDER_STATUSES.RICEVUTO,
  ORDER_STATUSES.IN_PREPARAZIONE,
  ORDER_STATUSES.PRONTO,
  ORDER_STATUSES.RITIRATO,
]

export function nextComandaStatus(status) {
  const idx = COMANDA_FLOW.indexOf(status)
  if (idx === -1 || idx === COMANDA_FLOW.length - 1) return null
  return COMANDA_FLOW[idx + 1]
}

// Una comanda è "chiusa" quando servita o annullata.
export function comandaDone(c) {
  return c.status === ORDER_STATUSES.RITIRATO || c.status === ORDER_STATUSES.ANNULLATO
}

// La comanda "attiva": quella AL PASSO PIÙ INDIETRO tra le aperte (a parità
// di passo, la più vecchia), o null. È lei a dare lo stato dell'ordine in
// coda: se su un conto con una comanda già "pronta" arriva un'aggiunta in
// preparazione, l'ordine TORNA "in preparazione" — c'è di nuovo lavoro al
// banco (il concetto richiesto: nuova aggiunta ⇒ si riparte a preparare).
export function activeComanda(order) {
  const aperte = (order?.comande || []).filter((c) => !comandaDone(c))
  if (aperte.length === 0) return null
  return aperte.reduce((best, c) =>
    COMANDA_FLOW.indexOf(c.status) < COMANDA_FLOW.indexOf(best.status) ? c : best
  )
}

// Un conto PAGATO risulta interamente servito: le comande ancora in
// lavorazione passano a 'ritirato' (le annullate restano annullate, le
// già servite non vengono toccate).
export function serveAllComande(comande, nowIso) {
  return (comande || []).map((c) =>
    c.status === ORDER_STATUSES.ANNULLATO || c.status === ORDER_STATUSES.RITIRATO
      ? c
      : {
          ...c,
          status: ORDER_STATUSES.RITIRATO,
          status_times: { ...(c.status_times || {}), [ORDER_STATUSES.RITIRATO]: nowIso },
        }
  )
}

// Riepilogo comande per le card della coda: attive / pronte / servite.
export function comandeSummary(order) {
  const comande = order?.comande || []
  let attive = 0
  let pronte = 0
  let servite = 0
  for (const c of comande) {
    if (c.status === ORDER_STATUSES.ANNULLATO) continue
    if (c.status === ORDER_STATUSES.RITIRATO) servite += 1
    else {
      attive += 1
      if (c.status === ORDER_STATUSES.PRONTO) pronte += 1
    }
  }
  return { attive, pronte, servite, totale: attive + servite }
}

// Tutte le comande servite (o annullate)? Un conto "completo" da incassare.
export function allServed(order) {
  const comande = (order?.comande || []).filter((c) => c.status !== ORDER_STATUSES.ANNULLATO)
  return comande.length > 0 && comande.every((c) => c.status === ORDER_STATUSES.RITIRATO)
}

export function orderIsOpen(order) {
  return order?.status === ORDER_OPEN
}

// Il conto ha contenuto? (almeno un item in una comanda non annullata)
export function orderHasContent(order) {
  return (order?.comande || []).some(
    (c) => c.status !== ORDER_STATUSES.ANNULLATO && (c.items || []).length > 0
  )
}

// Vista iniziale del dettaglio POS: se il conto ha già contenuto si apre
// sulle COMANDE (si vede subito cosa contiene); se è vuoto, sul menù.
export function initialDetailView(order) {
  return orderHasContent(order) ? 'comande' : 'menu'
}

export function orderIsClosed(order) {
  return order?.status === ORDER_STATUSES.PAGATO || order?.status === ORDER_STATUSES.ANNULLATO
}

// Aggregato item dell'ordine: somma gli item di tutte le comande non
// annullate (stesso drink su comande diverse → riga unica con qty sommata;
// gli item custom restano righe separate).
export function aggregateItems(comande) {
  const out = []
  const byDrink = new Map()
  for (const c of comande || []) {
    if (c.status === ORDER_STATUSES.ANNULLATO) continue
    for (const i of c.items || []) {
      if (!i.custom && i.drink_id && byDrink.has(i.drink_id)) {
        const ex = byDrink.get(i.drink_id)
        ex.qty += i.qty
      } else {
        const copy = { ...i }
        out.push(copy)
        if (!i.custom && i.drink_id) byDrink.set(i.drink_id, copy)
      }
    }
  }
  return out
}

// Totale drink dell'ordine (senza coperto/servizio/mancia).
export function itemsTotal(items) {
  return (items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price ?? i.price) || 0), 0)
}

// Stati presenti tra le comande (campo derivato `comande_statuses` sul doc,
// usato dalle query array-contains: coda ETA cliente, tabellone pronti).
export function comandeStatuses(comande) {
  return [...new Set((comande || []).map((c) => c.status))]
}

// ── Vista aggregata dell'ordine (UX senza comande in vista) ────────────
// Il bartender lavora sull'ordine aggregato: gli AUMENTI diventano una nuova
// comanda (gestita internamente), le DIMINUZIONI toccano solo le comande
// ancora modificabili. Una comanda pronta o servita non si tocca più.

// Modificabile = non ancora pronta/servita/annullata.
// QUANDO UN CONTO È CHIUSO — cioè non c'è più niente da fare. Con gli stati
// del servizio servono DUE cose: incassato E servito. Un conto pagato in
// anticipo ma non ancora consegnato è lavoro ancora da fare, e sparire
// sarebbe il modo migliore per dimenticarselo. Senza gli stati del servizio
// il pagamento chiude e basta.
// La regola sta qui perché la usano in tre: la coda (chi resta a schermo),
// il riepilogo di testata (quanti aperti e quanti chiusi) e il magazzino
// (quali conti hanno ancora ingredienti in ballo). Quando stava scritta in
// tre posti, il magazzino contava fra gli aperti conti già incassati e
// dava numeri da paura.
export function contoChiuso(o, { workflowOn = false } = {}) {
  if (!o) return false
  if (o.status === ORDER_STATUSES.ANNULLATO || o.workflow_status === ORDER_STATUSES.ANNULLATO)
    return true
  const pagato =
    o.payment_status === 'pagato' ||
    o.status === ORDER_STATUSES.PAGATO ||
    o.workflow_status === ORDER_STATUSES.PAGATO
  const servito = allServed(o) || o.workflow_status === ORDER_STATUSES.RITIRATO
  return workflowOn ? pagato && servito : pagato
}

// QUANDO IL MAGAZZINO SI SCALA DAVVERO. Alla comanda SERVITA, non alla
// presa in carico: un drink iniziato e poi non fatto — riga tolta, cliente
// che cambia idea, comanda annullata — aveva già portato via gli
// ingredienti. Servito vuol dire che quel drink è uscito per certo.
// Una volta sola: se lo scarico è già stato applicato non si ripete.
// Senza gli stati del servizio le comande risultano servite alla
// riscossione, ed è lì che si scala (vedi unappliedEntries in api.js).
export function comandaDaScaricare(comanda, nuovoStato) {
  return nuovoStato === ORDER_STATUSES.RITIRATO && comanda?.inventory_applied !== true
}

export function comandaEditable(c) {
  return c.status === ORDER_STATUSES.RICEVUTO || c.status === ORDER_STATUSES.IN_PREPARAZIONE
}

// Quantità per item bloccate (comande pronte/servite): sotto questa soglia
// l'aggregato non può scendere.
export function lockedQtyByItem(comande) {
  const m = {}
  for (const c of comande || []) {
    if (c.status === ORDER_STATUSES.ANNULLATO || comandaEditable(c)) continue
    for (const i of c.items || []) {
      m[i.drink_id] = (m[i.drink_id] || 0) + (Number(i.qty) || 0)
    }
  }
  return m
}

// Piano per togliere 1 unità di `drinkId` dall'ordine: sceglie la comanda
// modificabile PIÙ RECENTE che contiene l'item e restituisce
// { comandaId, items } con la quantità decrementata (item rimosso a zero).
// null se l'item vive solo in comande non modificabili.
export function planDecrement(comande, drinkId) {
  const editable = (comande || []).filter(comandaEditable)
  for (let k = editable.length - 1; k >= 0; k--) {
    const c = editable[k]
    const idx = (c.items || []).findIndex((i) => i.drink_id === drinkId && (Number(i.qty) || 0) > 0)
    if (idx === -1) continue
    const items = c.items
      .map((i, j) => (j === idx ? { ...i, qty: i.qty - 1 } : i))
      .filter((i) => i.qty > 0)
    return { comandaId: c.id, items }
  }
  return null
}

// ── Retrocompatibilità ─────────────────────────────────────────────────
// Normalizza un doc ordine (raw Firestore) nel nuovo modello. I doc legacy
// (senza `comande`) diventano un ordine con una comanda sintetica che porta
// il vecchio stato di lavorazione.
export function normalizeOrderDoc(o) {
  if (Array.isArray(o.comande)) {
    return {
      status: o.status ?? ORDER_OPEN,
      comande: o.comande,
    }
  }
  const legacy = o.status
  const isPagato = legacy === ORDER_STATUSES.PAGATO
  const isAnnullato = legacy === ORDER_STATUSES.ANNULLATO
  const comanda = {
    id: 'c1',
    seq: 1,
    items: Array.isArray(o.items) ? o.items : [],
    // Un ordine legacy pagato era stato servito; annullato → comanda annullata.
    status: isPagato ? ORDER_STATUSES.RITIRATO : isAnnullato ? ORDER_STATUSES.ANNULLATO : (legacy ?? ORDER_STATUSES.RICEVUTO),
    status_times: o.status_times ?? {},
    inventory_applied: o.inventory_applied ?? false,
    inventory_consumption: o.inventory_consumption ?? null,
    created_at: o.created_at ?? null,
  }
  return {
    status: isPagato || isAnnullato ? legacy : ORDER_OPEN,
    comande: [comanda],
  }
}

// ── LA PREPARAZIONE PARZIALE ─────────────────────────────────────────
//
// Succede tutte le sere: nella comanda del tavolo 4 ci sono tre gin tonic,
// in quella del banco altri due, e chi sta allo shaker li prepara insieme
// per farli uscire in una volta sola. Non andrebbe fatto — una comanda è
// un ticket, e un ticket si lavora intero — ma si fa, e l'app non lo
// impedisce: lo REGISTRA, così il conto resta giusto e chi guarda la coda
// vede davvero cosa c'è al banco e cosa aspetta ancora.
//
// La divisione non tocca la comanda di partenza: quella si ANNULLA (resta
// come storia — la copia già stampata ha ancora un riscontro, e niente
// sparisce dal conto) e al suo posto nascono le righe scelte, che vanno in
// preparazione, e il resto, che torna in «Da fare».
//
// Qui c'è solo il conto delle unità, che è la parte che si può sbagliare
// in silenzio: se una divisione fa sparire un drink al banco non se ne
// accorge nessuno finché non lo reclama il cliente. Chi chiama passa le
// quantità scelte riga per riga — `righeScelte[i]` è quanto di
// `comanda.items[i]` si prepara adesso — e riceve le DUE liste di righe.
//
//   null                              → non si è scelto niente
//   { tutta: true,  nuova, resta: [] } → si prende tutto: non c'è niente
//                                        da dividere, la comanda avanza
//   { tutta: false, nuova, resta }     → si divide
//
// Le quantità fuori misura non fanno danni: sotto zero, non numeriche o
// più grandi di quello che c'è valgono rispettivamente zero e il massimo
// disponibile. La somma delle unità di `nuova` e `resta` è sempre uguale a
// quella di partenza.
export function dividiComanda(comanda, righeScelte) {
  const righe = comanda?.items || []
  const nuova = []
  const resta = []
  let prese = 0
  righe.forEach((riga, i) => {
    const avevo = Math.max(0, Number(riga.qty) || 0)
    const chiesto = Number(righeScelte?.[i])
    const presa = Math.min(avevo, Number.isFinite(chiesto) ? Math.max(0, Math.trunc(chiesto)) : 0)
    prese += presa
    if (presa > 0) nuova.push({ ...riga, qty: presa })
    if (avevo - presa > 0) resta.push({ ...riga, qty: avevo - presa })
  })
  if (prese === 0) return null
  return { tutta: resta.length === 0, nuova, resta }
}

// DUE ANNULLAMENTI CHE NON SONO LA STESSA COSA. Dividere una comanda la
// annulla — resta come storia, e la copia già stampata ha un riscontro —
// ma quello è CONTABILITÀ INTERNA, non un fatto della serata: quei drink
// non sono spariti, sono diventati le due comande lì accanto. Mostrarla in
// un elenco di annullati vorrebbe dire far vedere due volte la stessa roba
// e far sembrare che qualcosa sia andato storto. Si distingue col motivo
// scritto sulla comanda, non guardando lo stato: «annullata» lo sono tutte
// e due.
export const ANNULLATA_PER_DIVISIONE = 'divisione'

export function annullataPerDivisione(c) {
  return c?.status === ORDER_STATUSES.ANNULLATO && c?.annullata_per === ANNULLATA_PER_DIVISIONE
}

// Su quali comande ha senso proporre la preparazione parziale: solo quelle
// ANCORA DA FARE e con più di una unità dentro. Su una comanda già presa in
// carico dividere non vuol dire niente (il lavoro è già cominciato), e su
// una riga singola la scelta sarebbe fra «tutto» e «niente».
export function comandaDivisibile(c) {
  if (!c || c.status !== ORDER_STATUSES.RICEVUTO) return false
  return (c.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0) > 1
}

// LA FIRMA DELLE COMANDE DI UN CONTO: id, passo e quante unità, in una
// riga. Serve a capire se il server ha ormai recepito il gesto fatto qui —
// un avanzamento, una divisione — per poter buttare via la copia locale
// senza far «rimbalzare» la card allo stato di prima. Confrontare gli
// oggetti interi non va: dal server tornano con campi in più (orari,
// snapshot del magazzino) che non cambiano quello che si vede.
export function firmaComande(comande) {
  return (comande || [])
    .map(
      (c) =>
        `${c.id}:${c.status}:${(c.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)}`
    )
    .join('|')
}

// ── COSA È IN PREPARAZIONE E COSA È GIÀ USCITO, DENTRO IL CONTO ──────
//
// IL MODELLO, detto una volta per tutte: gli stati del SERVIZIO riguardano
// le COMANDE, che fanno parte dell'ordine. L'ordine ha i suoi stati
// (aperto, pagato, annullato); le comande ne hanno dei SOTTOSTATI, che sono
// i passi del servizio. Se un conto è gestito come una comanda sola, tutti
// i suoi drink stanno sempre nello stesso passo — a meno che il bartender
// non divida la comanda per prepararne una parte.
//
// Da lì in poi «a che punto è questo conto» non ha più una risposta sola, e
// aprendolo si deve vedere cosa è al banco e cosa è già uscito. Si fa come
// si fa già con le righe pagate: un titolo, e sotto le sue.
//
// E le due cose non si contraddicono: un conto si può incassare in
// qualunque passo del servizio — dalla cassa è chiuso, dal banco magari no,
// perché una comanda è ancora in preparazione. Il gruppo «Pagati» dice la
// prima cosa, i gruppi del servizio la seconda.
export const SERVIZIO_ETICHETTA = {
  [ORDER_STATUSES.RICEVUTO]: '🧾 Da fare',
  [ORDER_STATUSES.IN_PREPARAZIONE]: '🍹 In preparazione',
  [ORDER_STATUSES.PRONTO]: '🔔 Pronto',
  [ORDER_STATUSES.RITIRATO]: '✅ Servito',
  [ORDER_STATUSES.ANNULLATO]: '✖️ Annullato',
}

// A quale gruppo appartiene una riga del conto. Le righe della BOZZA — non
// ancora inviate al banco — non ne hanno uno: non sono ancora lavoro di
// nessuno, e intestarle direbbe una cosa che non è.
export function gruppoDiRiga(riga) {
  if (riga?.paid) return 'pagati'
  if (riga?.source !== 'comanda') return null
  return riga.status || null
}

// I gruppi presenti nella lista, in ordine di lavorazione e coi pagati in
// fondo. Serve a decidere se intestarli: con UN gruppo solo non si mette un
// titolo per dire una cosa sola.
export function gruppiDelConto(righe) {
  const visti = new Set((righe || []).map(gruppoDiRiga).filter(Boolean))
  return [...COMANDA_FLOW, ORDER_STATUSES.ANNULLATO, 'pagati'].filter((g) => visti.has(g))
}

export function titoloGruppo(gruppo) {
  if (gruppo === 'pagati') return '💳 Pagati'
  return SERVIZIO_ETICHETTA[gruppo] || null
}

// ── I PASSI DI UNA COMANDA, CON L'ORA ────────────────────────────────
//
// «Da quanto sta lì» sulla card risponde a una domanda sola; aperta la
// comanda le domande diventano altre: quando è entrata, quando qualcuno
// l'ha presa in carico, quanto è rimasta pronta prima che partisse.
// Al banco quei minuti sono la differenza fra «siamo indietro» e «questo
// ticket è stato dimenticato», e senza gli orari accanto ai passi non c'è
// modo di dirlo — restava solo il totale.
//
// I passi sono quelli di sempre (COMANDA_FLOW): qui si dice solo quali
// sono già stati toccati, quando, e a quale si è fermi adesso. Una comanda
// ANNULLATA non torna indietro nel flusso: tiene gli orari che aveva e si
// porta in fondo il passo che l'ha chiusa.
export function tappeComanda(comanda) {
  const tempi = comanda?.status_times || {}
  const stato = comanda?.status
  const arrivata = COMANDA_FLOW.indexOf(stato)
  const tappe = COMANDA_FLOW.map((s, i) => ({
    stato: s,
    quando: tempi[s] || null,
    // Fuori dal flusso (annullata) l'unica prova di essere passati di lì è
    // l'orario segnato: contare i passi darebbe «mai arrivata» a una
    // comanda che al banco c'era stata davvero.
    fatta: arrivata >= 0 ? i <= arrivata : !!tempi[s],
    adesso: s === stato,
  }))
  if (stato === ORDER_STATUSES.ANNULLATO) {
    tappe.push({
      stato: ORDER_STATUSES.ANNULLATO,
      quando: tempi[ORDER_STATUSES.ANNULLATO] || null,
      fatta: true,
      adesso: true,
    })
  }
  return tappe
}
