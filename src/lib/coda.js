// Logica pura della CODA ordini (niente Firebase): smistamento per stato e
// riepilogo. Il servizio è perpetuo: non esistono più "serate", i conti
// restano aperti finché non li si chiude a mano. Testabile a unità.

import { ORDER_STATUSES } from './orderStatus.js'
// Il totale di un conto è quello EFFETTIVO (sconto già tolto): la regola sta
// in pagamento.js e non si riscrive qui, o le corsie direbbero una cifra e
// la card un'altra.
import { orderTotal } from './pagamento.js'
// Le comande sono il LAVORO del banco: le corsie del bartender le mostrano
// una per una, e le regole su cosa è servito e quanto vale una riga stanno
// in comande.js — qui non si riscrivono.
import { aggregateItems, annullataPerDivisione, itemsTotal } from './comande.js'

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
  { filtro = 'attivi', isChiuso = () => false, cassa = null, apertaDa = null, giornataDi = () => null, oggi = null } = {}
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
export function voceCassa({ gestore = false, cassaAperta = false, contiAperti = 0 } = {}) {
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
  return {
    id: 'chiudi-cassa',
    icon: '🔒',
    label: 'Chiudi cassa',
    disabled: contiAperti > 0,
    hint:
      contiAperti > 0
        ? // CORTA. In cima alla coda lo spazio è quello che avanza al tasto,
          // e una frase lunga andava a capo o finiva altrove: qui basta
          // dire quanti conti restano.
          `Prima chiudi ${contiAperti} cont${contiAperti === 1 ? 'o' : 'i'}`
        : 'Conta il contante e chiudi la serata.',
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
const CORSIE_LAVORO = [
  { id: 'da-fare', titolo: 'Da fare', stato: ORDER_STATUSES.RICEVUTO },
  { id: 'al-banco', titolo: 'Al banco', stato: ORDER_STATUSES.IN_PREPARAZIONE },
  { id: 'al-ritiro', titolo: 'Al ritiro', stato: ORDER_STATUSES.PRONTO },
  { id: 'da-incassare', titolo: 'Da incassare', stato: ORDER_STATUSES.RITIRATO },
]

// Il conto è già saldato? (il pagamento sta sul CONTO, non sulla comanda:
// un ordine può essere pagato in anticipo e non essere ancora uscito)
const contoSaldato = (o) =>
  o?.payment_status === 'pagato' || o?.workflow_status === ORDER_STATUSES.PAGATO

const arrotonda = (n) => Math.round(n * 100) / 100

// Totale di una corsia: il totale EFFETTIVO dei conti (sconto già tolto),
// perché è la cifra che si incassa davvero.
const totaleCorsia = (ordini) =>
  arrotonda(ordini.reduce((s, o) => s + orderTotal(o), 0))

export function corsieDiStato(ordini, { isChiuso = () => false, workflowOn = true } = {}) {
  const lista = ordini || []

  // STATI DI SERVIZIO SPENTI: i quattro passi non esistono proprio, e
  // quattro colonne vuote non sono una vista — sono un malinteso. Restano
  // le tre cose che un conto può essere, con le etichette e le regole già
  // usate dalla griglia e dalle schede (schedeCoda + passaFiltroCoda), così
  // le viste non raccontano mai due storie diverse.
  if (!workflowOn) {
    return schedeCoda(false).map(([id, titolo]) => {
      const dentro = lista.filter((o) => passaFiltroCoda(o, id, isChiuso))
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
  'da-fare': { etichetta: 'Lo preparo io', tipo: 'avanza' },
  'al-banco': { etichetta: 'È pronto', tipo: 'avanza' },
  'al-ritiro': { etichetta: 'Consegnato', tipo: 'avanza' },
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
// LE CORSIE SONO SEI, ma le ultime due si guardano di rado e stanno spente
// finché non si chiedono (vedi CORSIE_SPENTE_ALL_INIZIO):
//
//   Da fare · Al banco · Al ritiro   i passi del lavoro, una card per comanda
//   Da incassare                      i CONTI con roba già servita e non
//                                     ancora saldati. Si incassa un conto,
//                                     non un ticket: tre comande servite
//                                     dello stesso tavolo diventerebbero
//                                     tre card che chiedono tre volte gli
//                                     stessi soldi, quindi qui la card
//                                     torna a essere il conto. Si nasconde
//                                     come tutte le altre — chi sta allo
//                                     shaker non incassa, e quella colonna
//                                     gli ruba spazio.
//   Chiusi                            le comande SERVITE di conti PAGATI:
//                                     non c'è più niente da fare né da
//                                     chiedere. Serve a guardare indietro.
//   Annullati                         le comande dei conti annullati.
//                                     Nessuna delle due ha tasti.
//
// QUANDO UNA COMANDA È CHIUSA: dopo essere stata SERVITA, non prima. Da lì,
// se il conto è pagato va fra i chiusi, se no il conto compare in cassa.
// PAGATA MA NON ANCORA SERVITA NON È CHIUSA: il drink va fatto lo stesso,
// e quella comanda resta nella corsia del suo passo — col bollo «Pagato»,
// perché è il caso strano (i soldi presi, il drink ancora da fare) ed è
// quello che non deve sfuggire. Lì e basta: mostrarla anche fra i chiusi
// vorrebbe dire farla contare due volte.
const CORSIE_COMANDE = [
  ...CORSIE_LAVORO,
  { id: 'chiusi', titolo: '💶 Chiusi', stato: null },
  { id: 'annullati', titolo: '✖️ Annullati', stato: null },
]

// Le due corsie dello sguardo all'indietro partono spente: al banco lo
// schermo serve al lavoro di adesso, e sei colonne su un tablet vogliono
// dire sei colonne strette. Chi le vuole le accende dal filtro, e da lì in
// poi è una scelta di questo terminale.
export const CORSIE_SPENTE_ALL_INIZIO = ['chiusi', 'annullati']

export function corsieComande(ordini, { isChiuso = () => false } = {}) {
  const secchi = Object.fromEntries(CORSIE_COMANDE.map((c) => [c.id, []]))
  // Dove va una comanda, per il passo in cui sta. L'ULTIMA CORSIA DI LAVORO
  // NON C'È: «Da incassare» è dei conti, non delle comande, e una comanda
  // servita non ha una colonna sua — il lavoro è finito, resta solo da
  // farsi pagare, e lo dice la card del conto.
  const perStato = Object.fromEntries(
    CORSIE_LAVORO.filter((c) => c.id !== 'da-incassare').map((c) => [c.stato, c.id])
  )

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
        totale: arrotonda(c ? itemsTotal(righe) : orderTotal(o)),
        pagatoDaServire: false,
        ...extra,
      }
    }

    // CONTO ANNULLATO: quella roba non si fa e non si paga. Le sue comande
    // non sono lavoro e non sono soldi — stanno solo nella colonna che
    // serve a ritrovarle.
    //
    // TRANNE QUELLE ANNULLATE DA UNA DIVISIONE. Quella corsia risponde a
    // «questa comanda che fine ha fatto», e una comanda divisa non è finita
    // da nessuna parte: è diventata le due che stanno lì accanto. Farla
    // vedere vorrebbe dire mostrare due volte gli stessi drink e far
    // sembrare che sia andato storto qualcosa.
    if (annullato(o)) {
      for (const c of comande) if (!annullataPerDivisione(c)) secchi.annullati.push(scheda(c))
      continue
    }

    const saldato = contoSaldato(o) || o.status === ORDER_STATUSES.PAGATO || isChiuso(o)
    let servite = 0

    for (const c of comande) {
      if (c.status === ORDER_STATUSES.RITIRATO) {
        servite += 1
        // SERVITA. Se il conto è pagato non resta più niente: chiusa. Se no
        // i soldi sono ancora da prendere, e a chiederli è il conto — sotto.
        if (saldato) secchi.chiusi.push(scheda(c))
        continue
      }
      const corsia = perStato[c.status]
      // Le comande ANNULLATE di un conto vivo stanno fuori dal lavoro: sono
      // righe tolte, e ritrovarle è mestiere della storia del conto.
      if (!corsia) continue
      // Pagata ma non servita: resta qui, col bollo. Non è chiusa — il
      // drink va fatto lo stesso.
      secchi[corsia].push(scheda(c, { pagatoDaServire: saldato }))
    }

    // C'è roba già servita e il conto non è saldato: c'è da incassare. La
    // card è il CONTO, una sola, con la cifra del conto intero: è quella
    // che si chiede al cliente, comande ancora al banco comprese.
    if (!saldato && servite > 0) secchi['da-incassare'].push(scheda(null))
  }

  return CORSIE_COMANDE.map(({ id, titolo, stato }) => ({
    id,
    titolo,
    stato,
    schede: secchi[id],
    totale: arrotonda(secchi[id].reduce((s, x) => s + x.totale, 0)),
  }))
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
