// ── I PRODOTTI DI UNA FATTURA FORNITORE ──────────────────────────────
//
// Nasce da Flavio, che ha guardato lo scadenzario (26/08/2026): «sotto mi
// deve apparire un tasto che fa il carico. Dobbiamo usare un'altra dicitura
// sicuramente, tipo AGGIUNGI PRODOTTI magari, e ci mettiamo anche i
// prodotti, in modo tale che li va già a caricare all'interno dei prodotti
// di magazzino» (REQ-MAG-030).
//
// IL DATO CHE VINCOLA TUTTO: una fattura in `supplier_invoices` era SOLO
// UNA TESTATA — fornitore, data, importo, pagato, note. Non aveva righe.
// Quindi il tasto non «elenca i prodotti della fattura»: è lui a metterli,
// ed è esattamente quello che Flavio chiede con «ci mettiamo anche i
// prodotti».
//
// Qui dentro non c'è Firebase apposta: sono i conti che decidono cosa entra
// in magazzino e a che prezzo, e vanno provati senza database.

import { purchaseOrderTotals } from './warehouse.js'
import { righeDiProdotto, livelloDi, fetteFornitore } from './listini.js'

// Le righe di una fattura, sempre un array: una fattura scritta prima di
// questa voce non ha il campo, e non è un errore — è la normalità di tutte
// quelle già in archivio.
export function righeFattura(fattura) {
  return Array.isArray(fattura?.lines) ? fattura.lines : []
}

// I totali di un gruppo di righe. Sono gli stessi dell'ordine fornitore
// (netto, lordo, pezzi) e li fa la stessa funzione: una riga di fattura ha
// la forma di una riga d'ordine apposta, così stampe e conti non hanno
// bisogno di una seconda versione.
export const totaliRigheFattura = (righe) => purchaseOrderTotals(righe)

// ── IL PREZZO CHE STA IN ARCHIVIO ────────────────────────────────────
//
// È quello del listino DI QUEL FORNITORE (REQ-MAG-029); dove il listino non
// c'è si ricade sul costo del prodotto, che è l'ultimo pagato a chiunque.
// Serve a rispondere alla domanda di Flavio — «se voglio aggiornare il
// prezzo oppure lasciarlo invariato» — mostrando vecchio e nuovo affiancati.
export function prezzoInArchivio(item, listini, supplierId) {
  if (!item) return null
  const riga = righeDiProdotto(item, listini).find((r) => r.supplier_id === supplierId)
  if (riga?.price != null) return Number(riga.price)
  return item.cost == null ? null : Number(item.cost)
}

// Due prezzi si considerano uguali fino al centesimo: sotto quella soglia
// non c'è nessuna domanda da fare, e chiederla comunque insegnerebbe a
// rispondere senza leggere.
export function prezzoDiverso(vecchio, nuovo) {
  if (vecchio == null || nuovo == null || nuovo === '') return false
  const a = Number(vecchio)
  const b = Number(nuovo)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) >= 0.005
}

// Una riga di fattura nuova, partendo dal prodotto scelto nel catalogo. Il
// prezzo proposto è quello in archivio: chi compila corregge solo dove il
// documento dice un numero diverso, e solo lì compare la domanda.
export function rigaDaProdotto(item, { listini = [], supplierId = null, qty = 1 } = {}) {
  const prezzo = prezzoInArchivio(item, listini, supplierId)
  return {
    item_id: item.id,
    name: item.name ?? '',
    unit: item.unit ?? 'pz',
    package_size: item.package_size ?? null,
    qty_packages: Number(qty) || 0,
    unit_cost: prezzo == null ? 0 : prezzo,
    vat: item.vat ?? 22,
  }
}

// ── RIPRENDERE LE RIGHE DA UN ORDINE ─────────────────────────────────
//
// Quali ordini si possano riprendere non si decide più qui: sono le fette
// collegabili (REQ-MAG-031), perché riprendere le righe e agganciare la
// fattura sono lo stesso gesto — si ricopia il documento dall'ordine che
// l'ha generato. `ordiniRiprendibili` chiedeva in più che ci fosse già una
// consegna, e quella condizione è caduta: una proforma arriva anche prima
// della merce, e allora quelle righe sono proprio ciò che si vuole copiare.

// Le righe di quel fornitore dentro un ordine. Sugli ordini scritti prima
// di REQ-MAG-029 il fornitore stava sull'ORDINE e non sulla riga: si
// eredita, se no un ordine di ieri non si riprenderebbe mai.
function righeDelFornitore(ordine, supplierId) {
  return (ordine?.lines || []).filter(
    (l) => (l.supplier_id ?? ordine?.supplier_id ?? null) === supplierId
  )
}

// Le righe di un ordine nella forma di righe di fattura. `gia_caricata` dice
// che quella merce è già entrata in magazzino alla consegna: è quello che
// spegne da solo il carico, perché caricare due volte la stessa merce è
// l'errore da impedire.
export function righeDaOrdine(ordine, supplierId) {
  return righeDelFornitore(ordine, supplierId).map((l) => ({
    item_id: l.item_id,
    name: l.name ?? '',
    unit: l.unit ?? 'pz',
    package_size: l.package_size ?? null,
    qty_packages: Number(l.qty_packages) || 0,
    unit_cost: Number(l.unit_cost) || 0,
    vat: l.vat ?? 22,
    gia_caricata: livelloDi(l) !== 'richiesto',
  }))
}

// ── IL LEGAME CON LA FETTA DI FORNITORE (REQ-MAG-031) ────────────────
//
// L'utente, 20/08: «la vista degli ordini contiene più fornitori, ma la
// fattura è collegata all'ordine PER IL FORNITORE, perché è il fornitore che
// rilascia la fattura». Quindi il legame non è fattura-ORDINE ma
// fattura-FETTA: la parte di quel fornitore dentro l'ordine, la stessa che
// il filtro mostra. Un ordine con tre fornitori ha fino a tre fatture.
//
// DOVE VIVE IL DATO: `order_id` sulla FATTURA, e basta quello. Il fornitore
// la fattura ce l'ha già (`supplier_id`), e la coppia dei due È la fetta —
// la stessa chiave con cui `fetteFornitore` la ritaglia. Così «una fattura
// sta su al massimo una fetta» è vero per costruzione: non c'è nessun posto
// dove scriverne una seconda. Il verso opposto — «una fetta ha al massimo
// una fattura» — nessun campo lo garantisce da solo, e lo tiene
// `aggancioAmmesso`: è la stessa guardia che filtra gli elenchi delle
// candidate, così le due cose non possono divergere.
//
// NON SI SCRIVE NIENTE SULL'ORDINE, ed è deliberato: l'ordine lo scrivono
// la consegna e il pagamento, gesti che partono dal banco. Un secondo
// scrittore su quel documento vorrebbe dire due terminali che si
// sovrascrivono le righe per aggiungere un riferimento che sta comodo
// dall'altra parte.

// La fattura agganciata a una fetta, se c'è.
export function fatturaDellaFetta(fatture, fetta) {
  if (!fetta?.order_id || !fetta?.supplier_id) return null
  return (
    (fatture || []).find(
      (f) => f?.order_id === fetta.order_id && f?.supplier_id === fetta.supplier_id
    ) ?? null
  )
}

// La fetta a cui una fattura è agganciata. Gli ordini in mano sono gli
// ultimi venticinque: di uno più vecchio si sa che il legame c'è, non quali
// righe contenga — e dirlo è meglio che far sparire il legame.
export function fettaDellaFattura(fattura, ordini, { suppliers = [] } = {}) {
  if (!fattura?.order_id) return null
  const ordine = (ordini || []).find((o) => o?.id === fattura.order_id)
  if (!ordine) return null
  return (
    fetteFornitore(ordine, { suppliers }).find((f) => f.supplier_id === fattura.supplier_id) ?? null
  )
}

// IL FORNITORE FA DA GUARDIA. Agganciare la fattura di Nova alla fetta di
// Enofel non è un errore di battitura: è merce pagata a chi non l'ha
// venduta, e a fine mese è un conto che non torna.
//
// Torna il motivo del rifiuto — una frase da mostrare — oppure `null`
// quando l'aggancio si può fare. Le due parti dell'app la chiamano tutte e
// due: quella che propone le candidate e quella che scrive.
export function aggancioAmmesso(fattura, fetta, { fatture = [] } = {}) {
  if (!fattura?.id || !fetta?.order_id) return 'Manca il documento o la parte di ordine.'
  if (!fetta.supplier_id || fetta.supplier_id !== fattura.supplier_id) {
    return `Questa parte dell’ordine è di ${fetta.supplier_name || 'un altro fornitore'}: il documento è di ${fattura.supplier_name || '—'}.`
  }
  const altra = fatturaDellaFetta(fatture, fetta)
  if (altra && altra.id !== fattura.id) return 'Quella parte dell’ordine ha già un documento collegato.'
  // Uno-a-uno anche dall'altro verso: si stacca prima, e staccare è un gesto
  // che si vede. Lasciar riscrivere il campo staccherebbe in silenzio la
  // fetta di prima, che tornerebbe scoperta senza che nessuno l'abbia
  // deciso.
  if (fattura.order_id && fattura.order_id !== fetta.order_id) {
    return 'Questo documento è già collegato a un altro ordine.'
  }
  return null
}

// Le fette a cui QUESTA fattura si può agganciare: quelle del suo fornitore
// e ancora libere. Non si chiede che siano già consegnate — una proforma
// arriva anche prima della merce — e l'ordine più recente viene per primo,
// perché è quello con cui il documento in mano ha a che fare.
export function fetteCollegabili(fattura, ordini, { suppliers = [], fatture = [] } = {}) {
  if (!fattura?.supplier_id) return []
  return (ordini || [])
    .flatMap((o) => fetteFornitore(o, { suppliers }))
    .filter((f) => aggancioAmmesso(fattura, f, { fatture }) === null)
}

// L'elenco speculare, per chi guarda l'ordine: i documenti di quel fornitore
// che si possono agganciare a questa fetta.
export function fattureCollegabili(fatture, fetta) {
  if (!fetta?.supplier_id) return []
  return (fatture || []).filter((f) => aggancioAmmesso(f, fetta, { fatture }) === null)
}

// ── I DUE BUCHI ──────────────────────────────────────────────────────
//
// «Sono le due cose che a fine mese fanno tornare o non tornare i conti con
// il commercialista» (l'utente). Non sono errori dell'app: sono lavoro che
// manca, e vanno visti prima che il mese finisca.

// La merce è arrivata, il documento no. Una fetta ancora «richiesta» non
// conta: lì non è arrivato niente, e segnalarla insegnerebbe a ignorare il
// segnale.
export function fetteSenzaFattura(ordini, fatture, { suppliers = [] } = {}) {
  return (ordini || [])
    .flatMap((o) => fetteFornitore(o, { suppliers }))
    .filter((f) => f.supplier_id && f.stato !== 'richiesto' && !fatturaDellaFetta(fatture, f))
}

// Il documento c'è, l'ordine no: o l'ordine non è mai stato scritto nell'app
// (si è telefonato al fornitore), o il legame non l'ha ancora messo nessuno.
export function fattureSenzaFetta(fatture) {
  return (fatture || []).filter((f) => !f?.order_id)
}
