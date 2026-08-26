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
import { righeDiProdotto, livelloDi } from './listini.js'

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
// È una COMODITÀ DI COMPILAZIONE, non una relazione salvata: sulla fattura
// non si scrive nessun id d'ordine. Il legame fattura-ordine è un'altra
// voce (REQ-MAG-025, ancora da decidere), e inventarlo qui vorrebbe dire
// creare un dato che poi qualcun altro dovrebbe reggere.
//
// Si pescano solo gli ordini di QUEL fornitore che hanno almeno una riga
// già consegnata: è il caso normale — la merce arriva, e la fattura arriva
// dopo.
export function ordiniRiprendibili(ordini, supplierId) {
  if (!supplierId) return []
  return (ordini || []).filter((o) =>
    righeDelFornitore(o, supplierId).some((l) => livelloDi(l) !== 'richiesto')
  )
}

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
