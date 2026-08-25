'use strict'

// ── Pagamento del conto: sconto, pagamenti parziali (split) e residuo ──
// Logica pura, senza Firebase, per la schermata Pagamento in stile POS:
// a sinistra gli articoli selezionabili e pagabili singolarmente, a destra
// sconto (percentuale o in euro) e metodi di pagamento. Il conto si chiude
// quando il residuo arriva a zero.
//
// ── LO SCONTO APPARTIENE ALLA RISCOSSIONE, NON AL CONTO ──────────────
//
// «Lo sconto va applicato solo sui prodotti selezionati. Nel senso che se
// tolgo prodotti dalla schermata pagamento, lo sconto va applicato solo sui
// prodotti che sto riscuotendo. Quindi gli sconti poi si accumulano nello
// scontrino. Se ho applicato uno sconto a 2 prodotti prima e a tre prodotti
// dopo, sono due sconti applicati» (l'utente, 20/08/2026).
//
// Prima ce n'era UNO SOLO per conto, calcolato sul totale e poi ripartito in
// proporzione su chi pagava la sua parte. Al banco quello è un altro gesto:
// chi offre due birre a un amico sconta quelle due birre, non una quota di
// tutto il tavolo.
//
// Modello sul doc ordine:
//   discount:        { type: 'percent'|'euro'|'buono', value } | null
//                    lo sconto PREPARATO per la riscossione che si sta
//                    battendo adesso — non ancora incassato
//   discount_amount: il suo importo in euro, già calcolato
//   discount_items:  le RIGHE su cui cade (null = tutto quello che resta).
//                    Senza, un altro terminale legge un importo e non sa a
//                    che cosa si riferisce.
//   payments:        [{ id, amount, method, items|null, at, by,
//                       sconto: { type, value, amount, items } | undefined }]
//                    lo sconto CONSUMATO da quella riscossione: da lì in poi
//                    è storia e non si tocca più.
//
// Quindi due riscossioni scontate sono DUE sconti, ognuno con le sue righe, e
// il residuo è  totale − sconti consumati − sconto in preparazione − pagato.
//
// I CONTI VECCHI SI LEGGONO COME PRIMA: nessun `sconto` dentro i pagamenti e
// nessun `discount_items` vogliono dire «uno sconto solo, su tutto il conto»,
// che è esattamente il conto di ieri sera.

import { aggregateItems } from './comande.js'

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Tolleranza di confronto in euro (mezzo centesimo).
const EPS = 0.005

// Sconto in euro a partire da una BASE (il lordo su cui cade) e dallo sconto
// impostato. La base è il totale del conto solo quando si riscuote tutto: se
// si stanno riscuotendo alcune righe, è il lordo di quelle righe.
export function discountAmount(total, discount) {
  const t = Number(total) || 0
  if (!discount || !(Number(discount.value) > 0) || t <= 0) return 0
  const v = Number(discount.value)
  const amount = discount.type === 'percent' ? (t * Math.min(v, 100)) / 100 : Math.min(v, t)
  return round2(amount)
}

// ── Cosa fa lo SCONTO quando cambiano le righe del conto ──────────────
// Lo sconto in euro è un importo fisso deciso su un certo conto. Se poi si
// tolgono (o aggiungono) righe, quell'importo non è più detto che abbia
// senso: 5 € di sconto su un conto sceso a 3 € vorrebbe dire incassare −2 €.
// Le tre strategie sono un'impostazione perché rispondono a tre modi diversi
// di intendere lo sconto, e nessuno è sbagliato:
//
//   'tetto'       lo sconto resta quello scelto finché ci sta dentro; se il
//                 conto scende sotto, si accorcia fino al totale (il conto
//                 diventa offerto, mai negativo). È il default.
//   'proporzione' lo sconto vale sempre la stessa quota del conto: tolta una
//                 riga cala insieme al conto, aggiunta una riga cresce.
//   'avviso'      non si tocca niente: se lo sconto supera il totale la UI lo
//                 segnala e blocca l'incasso finché non lo si sistema a mano.
//
// Lo sconto in PERCENTUALE segue sempre il conto, con qualsiasi strategia:
// è la sua definizione, non una scelta.
export const DISCOUNT_POLICIES = ['tetto', 'proporzione', 'avviso']
export const DEFAULT_DISCOUNT_POLICY = 'tetto'

export function discountAfterChange(
  { discount, prevAmount, prevTotal, newTotal },
  policy = DEFAULT_DISCOUNT_POLICY
) {
  if (!discount || !(Number(discount.value) > 0)) return 0
  if (discount.type === 'percent') return discountAmount(newTotal, discount)

  const prev = round2(Number(prevAmount) || 0)
  const t = Math.max(0, round2(Number(newTotal) || 0))
  if (policy === 'avviso') return prev
  if (policy === 'proporzione') {
    const base = round2(Number(prevTotal) || 0)
    if (!(base > 0)) return Math.min(prev, t)
    return Math.min(round2(t * (prev / base)), t)
  }
  return Math.min(prev, t) // 'tetto'
}

// ── GLI SCONTI DI UN CONTO, CHE SONO PIÙ D'UNO ───────────────────────

// Gli sconti già CONSUMATI: uno per ogni riscossione che se n'è portato via
// uno. Sono storia — l'importo è quello che era al momento dell'incasso e non
// si ricalcola mai più, come il prezzo di un drink già bevuto.
export function scontiConsumati(order) {
  return (order?.payments || [])
    .map((p) => p?.sconto)
    .filter((s) => s && (Number(s.amount) || 0) > 0)
    .map((s) => ({ ...s, amount: round2(s.amount) }))
}

export function scontoConsumato(order) {
  return round2(scontiConsumati(order).reduce((s, x) => s + x.amount, 0))
}

// Lo sconto PREPARATO per la riscossione in corso: è quello sul documento,
// che vale finché non viene incassato (e allora diventa consumato) o tolto.
export const scontoInPreparazione = (order) => round2(Number(order?.discount_amount) || 0)

// TUTTO lo sconto che pesa su questo conto: i consumati più quello in
// preparazione. È il numero da usare ovunque si leggeva `discount_amount`
// come «lo sconto del conto» — cassa, statistiche, rendiconto, scontrino.
// Su un conto vecchio (nessuno consumato) vale esattamente `discount_amount`.
export function scontoTotale(order) {
  return round2(scontoConsumato(order) + scontoInPreparazione(order))
}

// Sconto più grande di quello che sconta: può restare solo con la strategia
// 'avviso'. Chi incassa deve vederlo prima di chiudere, non dopo.
export function scontoEccessivo(order) {
  const base = lordoSelezione(order, order?.discount_items || null)
  return scontoInPreparazione(order) > base + EPS
}

// Somma dei pagamenti già registrati sull'ordine.
export function paidAmount(order) {
  return round2((order?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0))
}

// Totale EFFETTIVO del conto: quello che il cliente paga davvero, cioè il
// totale degli articoli meno TUTTI gli sconti applicati. È il numero da
// mostrare ovunque si dica "totale": mostrare il lordo faceva sembrare che lo
// sconto non fosse stato registrato.
export function orderTotal(order) {
  const total = Number(order?.total) || 0
  return Math.max(0, round2(total - scontoTotale(order)))
}

// Residuo da incassare: totale − sconti (consumati e in preparazione) − già
// pagato (mai negativo).
export function orderDue(order) {
  const total = Number(order?.total) || 0
  return Math.max(0, round2(total - scontoTotale(order) - paidAmount(order)))
}

// Il valore di LISTINO di quello che resta da riscuotere: il totale meno
// quanto le riscossioni precedenti hanno già coperto (l'incassato più lo
// sconto che ognuna si è portata via). Coperto e servizio compresi, perché
// sono nel totale e non sono righe.
export function lordoResiduo(order) {
  return Math.max(0, round2((Number(order?.total) || 0) - paidAmount(order) - scontoConsumato(order)))
}

export const isFullyPaid = (order) => orderDue(order) <= EPS && (Number(order?.total) || 0) > 0

// Articoli ancora da pagare: aggregato dell'ordine meno le quantità già
// coperte dai pagamenti registrati (match per drink_id; i custom hanno
// un drink_id univoco per ordine).
export function remainingItems(order) {
  const items = order?.comande?.length
    ? aggregateItems(order.comande)
    : order?.order_items || []
  const paidQty = {}
  for (const p of order?.payments || [])
    for (const i of p.items || [])
      if (i.drink_id) paidQty[i.drink_id] = (paidQty[i.drink_id] || 0) + (Number(i.qty) || 0)
  return items
    .map((i, idx) => ({
      // OGNI RIGA HA UNA CHIAVE SUA. Lo stesso prodotto può comparire su più
      // righe (una modificata, una no; un prodotto libero uguale a un altro):
      // indicizzando la selezione per prodotto, premere «+» su una alzava
      // anche l'altra — al banco si vedevano due Negroni muoversi insieme, e
      // si incassava una quantità che nessuno aveva scelto.
      key: `${i.drink_id ?? 'libero'}#${idx}`,
      drink_id: i.drink_id ?? null,
      name: i.name,
      unit_price: Number(i.unit_price) || 0,
      qty: (Number(i.qty) || 0) - (paidQty[i.drink_id] || 0),
      custom: i.custom ?? false,
    }))
    .filter((i) => i.qty > 0)
}

// Due righe parlano della stessa cosa? Si guarda la CHIAVE quando c'è: lo
// stesso prodotto può stare su più righe, e confrontando per prodotto una
// rispondeva per tutte.
const stessaRiga = (a, b) => (a?.key && b?.key ? a.key === b.key : a?.drink_id === b?.drink_id)

// «La selezione copre tutto?» si guarda RIGA PER RIGA. Confrontando per
// prodotto, con due righe uguali (Negroni, Coca Cola, Negroni) toglierne una
// non cambiava niente: l'altra rispondeva per tutte e due, il conto risultava
// coperto per intero e si incassava tutto.
function copreTutto(residue, rows) {
  return (
    residue.length > 0 &&
    residue.every((r) => {
      const sel = rows.find((s) => stessaRiga(r, s))
      return sel && (Number(sel.qty) || 0) >= r.qty
    })
  )
}

// IL LORDO SU CUI CADE UNO SCONTO. È la base di tutto il modello nuovo: uno
// sconto non sconta «il conto», sconta delle righe.
//
//   righe vuote o null → tutto quello che resta da riscuotere (che su un
//     conto vecchio, senza incassi né sconti consumati, è `order.total`
//     esatto: è per questo che un conto di ieri si legge come prima)
//   righe che coprono tutto il residuo → di nuovo il residuo intero, così
//     coperto e servizio ci sono dentro e non c'è nessuna deriva di centesimi
//   altrimenti → il lordo di quelle righe, ognuna limitata a quanto ne resta
//     davvero (una riga sparita dal conto nel frattempo vale zero)
export function lordoSelezione(order, righe) {
  const rows = (righe || []).filter((i) => (Number(i.qty) || 0) > 0)
  if (rows.length === 0) return lordoResiduo(order)
  const residue = remainingItems(order)
  if (copreTutto(residue, rows)) return lordoResiduo(order)
  return round2(
    rows.reduce((s, i) => {
      const r = residue.find((x) => stessaRiga(x, i))
      const qty = Math.min(Number(i.qty) || 0, r ? r.qty : 0)
      return s + qty * (Number(i.unit_price) || 0)
    }, 0)
  )
}

// Importo di una selezione di articoli: il loro lordo meno lo sconto in
// preparazione, che cade proprio su quelle righe. Se la selezione copre TUTTO
// il residuo si incassa il residuo esatto (niente derive di arrotondamento).
export function selectionAmount(order, selection) {
  const lordo = lordoSelezione(order, selection)
  // Lo sconto in preparazione è stato deciso su certe righe, e la schermata
  // lo tiene allineato alla selezione. Se nel frattempo è cambiato sotto i
  // piedi (un altro terminale ha tolto una riga) non può comunque valere più
  // del lordo che ha davanti: un incasso negativo non esiste.
  const sconto = Math.min(scontoInPreparazione(order), lordo)
  return Math.max(0, Math.min(round2(lordo - sconto), orderDue(order)))
}

// Un pagamento copre il residuo? (chiude il conto)
export function paymentCloses(order, amount) {
  return orderDue(order) - (Number(amount) || 0) <= EPS
}

// ── IL CONTO COM'È RIMASTO, UN ISTANTE PRIMA CHE IL SERVER LO SAPPIA ──
//
// La riscossione parte in sottofondo (niente aspetta la rete), quindi nel
// momento in cui si stampa una carta l'ordine che si ha in mano è ancora
// quello di PRIMA: senza l'incasso appena battuto, e con lo sconto ancora
// «in preparazione» sul documento. Chi stampa ha bisogno del dopo.
//
// DUE COSE INSIEME, e la seconda è quella che si sbaglia: il pagamento si
// aggiunge in coda, e lo sconto che quel pagamento si è portato via VIENE
// TOLTO dal documento. Lasciandolo in tutti e due i posti `scontoTotale`
// lo conterebbe due volte, e il residuo stampato sarebbe più basso del
// vero — cioè un cliente che al saldo paga meno di quello che deve.
// È la stessa cosa che fa `registerPayment` sul server: qui si anticipa,
// non si inventa.
export function contoDopoIncasso(order, incasso) {
  const sconto = incasso?.sconto && (Number(incasso.sconto.amount) || 0) > 0 ? incasso.sconto : null
  return {
    ...order,
    payments: [
      ...(order?.payments || []),
      {
        amount: round2(incasso?.amount),
        method: incasso?.method ?? null,
        items: incasso?.items ?? null,
        at: incasso?.at || new Date().toISOString(),
        ...(sconto ? { sconto } : {}),
      },
    ],
    ...(sconto ? { discount: null, discount_amount: 0, discount_items: null } : {}),
  }
}

// Metodo "riassuntivo" del conto dopo l'ultimo pagamento: se i metodi
// usati sono diversi il conto risulta pagato "misto".
export function summaryMethod(payments) {
  const methods = [...new Set((payments || []).map((p) => p.method).filter(Boolean))]
  if (methods.length === 0) return null
  return methods.length === 1 ? methods[0] : 'misto'
}

// ── CHE COSA È STATO PAGATO ──────────────────────────────────────────
//
// In fondo al conto c'era una riga sola: «Sconto e acconti già incassati
// −15,00 €». Quindici euro di che? Uno sconto, un acconto, tutti e due? Chi
// li ha presi e con che metodo? Al banco, davanti al cliente che chiede,
// quella riga non risponde a niente — e per saperlo bisognava aprire la
// storia del conto.
//
// Qui la si spacchetta: lo sconto per conto suo, e ogni incasso con il suo
// metodo, la sua ora e — se era un conto diviso — quello che copriva.
// Quante unità di prodotto copre uno sconto (null = tutto il conto).
const pezziScontati = (items) =>
  Array.isArray(items) ? items.reduce((s, i) => s + (Number(i.qty) || 0), 0) : 0

// ── COME SI CHIAMA UNO SCONTO, quando ce n'è più di uno ──────────────
// Con un solo sconto su tutto il conto la riga resta quella di sempre:
// «Sconto». Appena gli sconti sono più d'uno, ognuno deve dire su che cosa
// cadeva — se no lo scontrino elenca tre cifre e nessuno sa perché.
export function etichettaSconto(sconto) {
  const tipo =
    sconto?.type === 'percent'
      ? `Sconto ${round2(sconto.value)}%`
      : sconto?.type === 'buono'
        ? 'Buono'
        : 'Sconto'
  const n = pezziScontati(sconto?.items)
  if (!(n > 0)) return tipo
  return `${tipo} su ${n} prodott${n === 1 ? 'o' : 'i'}`
}

// TUTTI gli sconti del conto, in ordine: prima i consumati (nell'ordine in cui
// sono stati incassati), poi quello ancora in preparazione. È la lista che va
// sullo scontrino e nel riepilogo del conto.
//
// UNO SOLO SU TUTTO IL CONTO RESTA «Sconto», la riga di sempre — che è come si
// stampa un conto di ieri sera, e come si stampa il caso normale di stasera.
// Le parole in più servono solo quando gli sconti sono più d'uno o cadevano su
// una parte del conto: lì «Sconto −4,00 €» tre volte non spiegherebbe niente.
export function scontiDelConto(order) {
  const grezzi = scontiConsumati(order).map((s) => ({ sconto: s, consumato: true }))
  const preparato = scontoInPreparazione(order)
  if (preparato > 0) {
    grezzi.push({
      sconto: {
        type: order?.discount?.type,
        value: order?.discount?.value,
        amount: preparato,
        items: order?.discount_items || null,
      },
      consumato: false,
    })
  }
  const unicoSuTutto = grezzi.length === 1 && !pezziScontati(grezzi[0].sconto.items)
  return grezzi.map(({ sconto, consumato }) => ({
    etichetta: unicoSuTutto
      ? sconto.type === 'buono'
        ? 'Buono'
        : 'Sconto'
      : etichettaSconto(sconto),
    importo: round2(sconto.amount),
    consumato,
  }))
}

export function dettaglioIncassi(order) {
  // `sconto` resta il numero unico — è quello che il riepilogo mostra in una
  // riga sola — ma adesso è la SOMMA di tutti; il dettaglio sta in `sconti`.
  const sconto = scontoTotale(order)
  const sconti = scontiDelConto(order)
  const incassi = (order?.payments || [])
    .filter((p) => (Number(p.amount) || 0) !== 0)
    .map((p) => ({
      importo: round2(p.amount),
      metodo: p.method || null,
      quando: p.at || null,
      // Lo sconto che questa riscossione si è portata via, se ne aveva uno:
      // «−4,00 € su 2 prodotti» scritto accanto all'incasso a cui appartiene.
      sconto: p.sconto && (Number(p.sconto.amount) || 0) > 0
        ? { importo: round2(p.sconto.amount), etichetta: etichettaSconto(p.sconto) }
        : null,
      // Le righe coperte da quell'incasso, quando il conto è stato diviso:
      // «2 Daiquiri, 1 Birra» dice cosa ha già pagato quello che se n'è
      // andato — che è la domanda vera quando restano gli altri al tavolo.
      cosa: Array.isArray(p.items) && p.items.length
        ? p.items
            .filter((i) => (Number(i.qty) || 0) > 0)
            .map((i) => `${Number(i.qty) || 1}× ${i.name || 'riga'}`)
        : null,
    }))
  return {
    sconto,
    sconti,
    incassi,
    totaleIncassato: round2(incassi.reduce((s, i) => s + i.importo, 0)),
  }
}

// ── LE UNITÀ, QUANDO SI SEPARANO LE RIGHE UGUALI ─────────────────────
//
// Fuori da «separa uguali» la selezione è un CONTEGGIO per riga: «di questi
// tre Spritz, due li paga lui». Separandole, ogni unità è una voce a sé e
// deve avere la SUA quantità: spegnendo la prima si deve spegnere la
// prima — non le ultime, come fa un contatore che scende.
//
// Le due forme dicono la stessa cosa e si convertono l'una nell'altra: il
// conteggio è quante unità sono accese, le unità sono le prime N accese
// quando si arriva da un conteggio.
export function unitaDaConteggio(qty, conteggio) {
  const n = Math.max(0, Math.min(Number(conteggio) || 0, Number(qty) || 0))
  return Array.from({ length: Number(qty) || 0 }, (_, i) => i < n)
}

export function conteggioDaUnita(unita) {
  return (unita || []).filter(Boolean).length
}

// Accende o spegne UNA unità, e restituisce l'array nuovo. Se lo stato
// delle unità non c'è ancora (si è appena entrati in «separa»), si parte
// dal conteggio.
export function toccaUnita(unita, qty, indice, acceso) {
  const base = Array.isArray(unita) && unita.length === qty ? [...unita] : unitaDaConteggio(qty, qty)
  if (indice < 0 || indice >= base.length) return base
  base[indice] = !!acceso
  return base
}

// ── DENTRO TUTTE, O FUORI TUTTE ──────────────────────────────────────
//
// «Immagina un conto con venti prodotti sopra: ne deve pagare uno solo, io
// devo togliere la spunta a venti voci all'interno dell'ordine. Invece
// facendo così premo un solo tasto, si deselezionano tutti, e seleziono poi
// io» (Flavio, 21/08/2026, registrazione vocale).
//
// Porta la selezione a uno dei due estremi in un gesto solo. Da lì in poi
// non cambia niente: il tocco riga per riga resta quello di sempre
// (`selezioneDopoTocco`) — con tutto dentro il primo tocco restringe, con
// tutto fuori ogni tocco aggiunge, che è esattamente il «man mano mi metto
// il più uno, più due» che serve al banco.
//
// Si scrivono TUTTE E DUE le forme, conteggio e unità: la vista «separa
// uguali» legge le unità, e lasciandole indietro le caselle di una riga
// portata a zero restavano accese.
export function selezioneTotale(righe, accesa) {
  const sel = {}
  const selUnita = {}
  for (const r of righe || []) {
    const qty = Number(r.qty) || 0
    const unita = unitaDaConteggio(qty, accesa ? qty : 0)
    selUnita[r.key] = unita
    sel[r.key] = conteggioDaUnita(unita)
  }
  return { sel, selUnita }
}

// ── IL PRIMO TOCCO RESTRINGE, I SUCCESSIVI AGGIUNGONO ────────────────
//
// «Quando apro la schermata del pagamento, quando clicco su una voce, anche
// solo sulla label, si devono azzerare le altre voci; e se voglio aggiungere
// alla riscossione le devo premere, la label, o premo il +. Quindi quando
// apro sono tutte selezionate, ma se premo o la label o il più le altre voci
// passano a 0, E DIVENTANO GRIGE O DI UN COLORE PIÙ SMORTO, e quando le premo
// le aggiungo al conto che voglio riscuotere» (l'utente, 20/08/2026).
//
// Il gesto vero al banco è «di tutto questo conto, adesso mi paghi QUESTI».
// Prima per arrivarci si spegneva una riga per volta tutto quello che NON
// serviva: su un conto da dieci righe, nove tocchi per incassarne una.
//
// LA REGOLA, in una riga: quando è selezionato TUTTO, toccare una voce vuol
// dire «solo questa»; da lì in poi toccare vuol dire «anche questa».
//
// «Vergine» non è un flag da tenere in vita: è lo STATO che si vede a
// schermo — tutte le righe dentro per intero. Così non c'è niente da
// azzerare quando il conto cambia sotto, quando si rientra o quando si è
// appena incassata una parte: la regola risponde sempre a quello che il
// cassiere ha davanti. E «Rimetti tutto in pagamento» riporta da sé al
// primo tocco, senza saperlo.
//
// Due conseguenze volute:
// · si RIENTRA sulle righe di uno sconto già preparato (`discount_items`):
//   quella non è una selezione piena, quindi NON è vergine e un tocco
//   aggiunge invece di buttare via le righe su cui lo sconto era stato
//   deciso (REQ-PAG-013);
// · se arriva una riga nuova mentre la schermata è aperta, la selezione non
//   è più piena e quindi non è più vergine. Giusto così: la schermata non
//   sta più dicendo «pago tutto», e quella riga non deve entrare da sola in
//   un importo che il cassiere ha già detto ad alta voce.
export function selezioneVergine(righe, sel) {
  const rs = righe || []
  return rs.length > 0 && rs.every((r) => (Number(sel?.[r.key]) || 0) >= r.qty)
}

// Applica UN tocco alla selezione e restituisce lo stato nuovo
// (`{ sel, selUnita }`, le due forme che vivono insieme nella schermata).
//
// `tocco`:
//   riga    la riga toccata (serve `key` e `qty`)
//   gesto   'etichetta' | 'piu' | 'meno'
//   indice  in «separa uguali», QUALE unità della riga; null nella vista
//           unita, dove il gesto vale per la riga intera
//
// Tre gesti per due viste, un meccanismo solo:
// · 'etichetta' ACCENDE quello che è spento e SPEGNE quello che è già dentro
//   per intero — è il tasto che rimette in riscossione una riga smorta;
// · 'piu' e 'meno' restano quelli di sempre, una unità per volta, per chi di
//   tre birre ne paga due;
// · sulla selezione VERGINE qualunque gesto che accende azzera tutte le
//   altre righe (e in «separa uguali» anche le altre unità della stessa
//   riga). Il «meno» no: quello ha sempre voluto dire «questa non me la
//   paga», ed è il vecchio modo di dividere il conto, che continua a
//   funzionare.
//
// Sul VERGINE l'etichetta non spegne mai: con tutto acceso un tocco che
// spegne lascerebbe la schermata a zero — e chi voleva incassare solo quella
// riga si ritroverebbe senza niente selezionato.
// Sempre sul vergine, il «+» di una riga già intera la lascia intera: «di
// tutto il conto, questo prodotto lo paga lui». Chi ne vuole una parte scende
// col «−», o le separa (che è come la schermata si apre).
export function selezioneDopoTocco(stato, righe, tocco) {
  const rs = righe || []
  const sel = { ...(stato?.sel || {}) }
  const selUnita = { ...(stato?.selUnita || {}) }
  const { riga, gesto, indice = null } = tocco || {}
  if (!riga) return { sel, selUnita }

  const qty = Number(riga.qty) || 0
  // Le due forme restano allineate: si scrivono le unità, e il conteggio è
  // quante ne sono accese. Mai una senza l'altra.
  const scrivi = (key, unita) => {
    selUnita[key] = unita
    sel[key] = conteggioDaUnita(unita)
  }

  const memoria = selUnita[riga.key]
  const unita =
    Array.isArray(memoria) && memoria.length === qty
      ? memoria
      : unitaDaConteggio(qty, sel[riga.key] ?? 0)
  const dentro = indice == null ? (Number(sel[riga.key]) || 0) >= qty : !!unita[indice]
  const vergine = selezioneVergine(rs, sel)
  const spegne = gesto === 'meno' || (gesto === 'etichetta' && dentro && !vergine)

  if (vergine && !spegne) {
    for (const r of rs) scrivi(r.key, unitaDaConteggio(Number(r.qty) || 0, 0))
    scrivi(
      riga.key,
      indice == null
        ? unitaDaConteggio(qty, qty)
        : unitaDaConteggio(qty, 0).map((_, i) => i === indice)
    )
    return { sel, selUnita }
  }

  if (indice == null) {
    const ora = Math.min(Number(sel[riga.key]) || 0, qty)
    const next =
      gesto === 'etichetta'
        ? spegne
          ? 0
          : qty
        : Math.max(0, Math.min(ora + (gesto === 'piu' ? 1 : -1), qty))
    scrivi(riga.key, unitaDaConteggio(qty, next))
    return { sel, selUnita }
  }

  scrivi(riga.key, toccaUnita(unita, qty, indice, gesto === 'etichetta' ? !dentro : !spegne))
  return { sel, selUnita }
}
