// ── LA TABELLA DEL NUOVO ORDINE (REQ-MAG-036) ────────────────────────
//
// La schermata di prima l'utente l'ha bocciata il 27/08/2026: «non mi piace
// LA DOPPIA LISTA e quei box sono POSTICCI. Serve una UX e UI più moderna e
// semplice. Deve esserci UNA SOLA TABELLA dove su ogni riga vedrò il nome
// del prodotto e i vari campi per compilare l'ordine».
//
// Qui stanno i conti che governano quella tabella — ordinamento,
// preselezione, finestra di righe, righe scelte e loro raggruppamento per
// fornitore — e ci stanno SENZA Firebase: con 388 prodotti e 367 righe di
// listino sono conti che vanno provati coi numeri veri, non con un database
// acceso.
//
// La riga della tabella è quella del catalogo (`catalogoOrdinabile` in
// listini.js): una per COPPIA prodotto-fornitore, col suo prezzo di listino.

import { assortimentoDi, stockStatus } from './inventory.js'
import { inAssortimentoAMano } from './statoAssortimento.js'
import { purchaseOrderTotals, suggestedPackages } from './warehouse.js'
import { righeDiProdotto, fornitoreProposto, coloreFornitore } from './listini.js'

// Quante righe si aggiungono a ogni caricata dello scorrimento continuo.
// Quaranta è una schermata abbondante: chi scorre non arriva mai al fondo
// vuoto, e chi apre la pagina non paga il disegno di settecento righe.
export const PASSO_RIGHE = 40

// Le quattro colonne che ordinano, chieste una per una: «per NOME, per
// DISPONIBILITÀ IN INVENTARIO, per PREZZO DI LISTINO e per FORNITORE».
export const COLONNE_ORDINABILI = ['nome', 'scorta', 'prezzo', 'fornitore']

// L'ordine delle tre disponibilità è quello dell'URGENZA, non l'alfabetico:
// chi ordina per disponibilità vuole vedere per primo quello che è finito.
// I tre stati sono quelli di `stockStatus` — non se ne calcolano altri.
const URGENZA = { empty: 0, low: 1, ok: 2 }

const testo = (v) => String(v ?? '')

// Un confronto che manda in fondo quello che NON HA il dato, in tutti e due
// i versi: una riga senza prezzo di listino non è «la più economica», e una
// senza fornitore non è «il primo fornitore in ordine alfabetico».
function conVuotiInFondo(a, b, dir) {
  const vuotoA = a == null
  const vuotoB = b == null
  if (vuotoA && vuotoB) return 0
  if (vuotoA) return 1
  if (vuotoB) return -1
  const segno = a < b ? -1 : a > b ? 1 : 0
  return dir === 'desc' ? -segno : segno
}

// Ordina le righe del catalogo. A parità si ricade sempre su nome +
// fornitore: senza, due righe uguali ballerebbero di posto a ogni disegno e
// la spunta appena data sembrerebbe essersi spostata da sola.
export function ordinaCatalogo(righe, { col = 'nome', dir = 'asc' } = {}) {
  const lista = [...(righe || [])]
  const verso = dir === 'desc' ? -1 : 1
  const finale = (a, b) =>
    testo(a.item_name).localeCompare(testo(b.item_name)) ||
    testo(a.supplier_name).localeCompare(testo(b.supplier_name))
  lista.sort((a, b) => {
    let primo = 0
    if (col === 'scorta') {
      primo = verso * (URGENZA[stockStatus(a.item)] - URGENZA[stockStatus(b.item)])
    } else if (col === 'prezzo') {
      primo = conVuotiInFondo(
        a.price != null ? Number(a.price) : null,
        b.price != null ? Number(b.price) : null,
        dir
      )
    } else if (col === 'fornitore') {
      primo = conVuotiInFondo(
        a.supplier_name ? a.supplier_name.toLowerCase() : null,
        b.supplier_name ? b.supplier_name.toLowerCase() : null,
        dir
      )
    } else {
      primo = verso * testo(a.item_name).localeCompare(testo(b.item_name))
    }
    return primo || finale(a, b)
  })
  return lista
}

// ── LA PRESELEZIONE ──────────────────────────────────────────────────
//
// È il motivo per cui questa schermata esiste: «sono spuntati di partenza i
// prodotti FINITI o SOTTO LA SOGLIA di riordino». Chi apre la schermata
// trova già fatto il lavoro di girare il magazzino.
//
// CHI È FUORI LINEA NON SI PRECOMPILA: «se è fuori linea non viene
// considerato nella precompilazione dell'ordine» (utente, 27/08). Un `out`
// resta in tabella e si può sempre aggiungere a mano — è così che rientra —
// ma non si propone da solo.
//
// UNA RIGA SOLA PER PRODOTTO, ed è la ragione per cui questa funzione non è
// un `filter`: lo stesso Campari sta sul listino di due fornitori e ha due
// righe. Spuntarle tutte e due vorrebbe dire comprarlo due volte. Si sceglie
// il fornitore dell'ULTIMO ACQUISTO (`fornitoreProposto`), che è la stessa
// regola con cui si propone un fornitore ovunque.
export function preselezioneIniziale(righe) {
  const perProdotto = new Map()
  for (const r of righe || []) {
    if (!perProdotto.has(r.item_id)) perProdotto.set(r.item_id, [])
    perProdotto.get(r.item_id).push(r)
  }
  const scelte = new Map()
  for (const gruppo of perProdotto.values()) {
    const item = gruppo[0]?.item
    if (!item) continue
    if (assortimentoDi(item) === 'out') continue
    const stato = stockStatus(item)
    // IN ASSORTIMENTO SENZA ORDINE SI PROPONE LO STESSO (REQ-MAG-037):
    // «anche in quel caso verrà preso in considerazione come un prodotto
    // sotto soglia o esaurito nella precompilazione dell'ordine». È lo stato
    // che Flavio mette a mano quando quel prodotto gli serve, e l'ordine è
    // esattamente la cosa che gli manca.
    if (stato !== 'empty' && stato !== 'low' && !inAssortimentoAMano(item)) continue
    const proposto = fornitoreProposto(gruppo)
    const riga = (proposto && gruppo.find((r) => r.supplier_id === proposto.supplier_id)) || gruppo[0]
    // Almeno un pezzo: `suggestedPackages` risponde 0 quando il prodotto non
    // ha soglia o non si conta a confezioni, e una riga proposta con zero
    // pezzi sarebbe una spunta che non ordina niente.
    scelte.set(riga.key, Math.max(1, suggestedPackages(item)))
  }
  return scelte
}

// ── I PREZZI ─────────────────────────────────────────────────────────

// Il prezzo unitario è quello del LISTINO DI QUEL FORNITORE (REQ-MAG-035);
// senza riga di listino si ricade sul costo del prodotto, che è l'ultimo
// pagato a chiunque.
export function prezzoDiListino(item, listini, supplierId) {
  const riga = supplierId
    ? righeDiProdotto(item, listini).find((r) => r.supplier_id === supplierId)
    : null
  if (riga?.price != null) return Number(riga.price)
  return item?.cost != null ? Number(item.cost) : null
}

export const totaleRiga = (qty, prezzo) => (Number(qty) || 0) * (Number(prezzo) || 0)

// IL TOTALE SI CORREGGE SULLA RIGA, e da lì torna indietro al prezzo del
// pezzo: «prezzo totale rispetto ai pezzi voluti, modificabile sulla riga
// stessa» (utente, 27/08). Il listino dice quanto ci si aspetta di pagare;
// se il fornitore ha fatto un altro prezzo per quel lotto, quello che conta
// è la cifra dell'ordine — e il €/pz della colonna resta il listino, che è
// l'altro dato e non deve mettersi a ballare mentre si scrive.
export const prezzoDaTotale = (totale, qty) =>
  (Number(qty) || 0) > 0 ? (Number(totale) || 0) / Number(qty) : 0

// ── LE RIGHE SCELTE ──────────────────────────────────────────────────
//
// `selezioni` è { chiave della riga → { qty, supplier_id, totale? } }: la
// chiave è quella della coppia prodotto-fornitore, il fornitore dentro è
// quello scelto dalla tendina — che può essere un ALTRO, perché 378 prodotti
// su 388 non stanno sul listino di nessuno e il fornitore si dà qui.
export function righeScelte(selezioni, { perChiave, listini = [], suppliers = [] } = {}) {
  const supsById = new Map((suppliers || []).map((s) => [s.id, s]))
  const scelte = []
  for (const [key, sel] of Object.entries(selezioni || {})) {
    const riga = perChiave?.get(key)
    if (!riga) continue
    const supplier_id = sel?.supplier_id ?? riga.supplier_id ?? null
    const sup = supplier_id ? supsById.get(supplier_id) : null
    const qty = Number(sel?.qty) || 0
    const prezzo = prezzoDiListino(riga.item, listini, supplier_id) ?? 0
    const corretto = sel?.totale !== undefined && sel?.totale !== null && sel?.totale !== ''
    const totale = corretto ? Number(sel.totale) || 0 : totaleRiga(qty, prezzo)
    scelte.push({
      key,
      item: riga.item,
      item_id: riga.item_id,
      item_name: riga.item_name,
      supplier_id,
      supplier_name: sup?.name ?? riga.supplier_name ?? null,
      colore: sup ? coloreFornitore(sup) : riga.colore,
      qty,
      prezzo,
      totale,
      // Il prezzo che finisce sull'ordine: se il totale è stato corretto a
      // mano, è quello a comandare.
      unit_cost: corretto ? prezzoDaTotale(totale, qty) : prezzo,
    })
  }
  return scelte
}

// L'ORDINE IN COMPOSIZIONE STA DI FIANCO, GIÀ DIVISO PER FORNITORE.
// «È SCOMODISSIMO l'ordine in basso. Dobbiamo metterlo affianco, e già lì
// separare i prodotti di un fornitore rispetto a un altro» (utente, 27/08).
// Chi non ha fornitore va in fondo: è la parte da sistemare prima di
// mandare, non una famiglia come le altre.
export function raggruppaPerFornitore(scelte) {
  const gruppi = new Map()
  for (const s of scelte || []) {
    const chiave = s.supplier_id || ''
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        supplier_id: s.supplier_id || null,
        supplier_name: s.supplier_name || null,
        colore: s.colore || null,
        righe: [],
        pezzi: 0,
        totale: 0,
      })
    }
    const g = gruppi.get(chiave)
    g.righe.push(s)
    g.pezzi += s.qty
    g.totale += s.totale
  }
  return [...gruppi.values()]
    .map((g) => ({ ...g, righe: [...g.righe].sort((a, b) => testo(a.item_name).localeCompare(testo(b.item_name))) }))
    .sort((a, b) => testo(a.supplier_name || '￿').localeCompare(testo(b.supplier_name || '￿')))
}

// Le righe come vengono salvate. Le quantità a zero non ci vanno: una riga
// spuntata e lasciata vuota è un ripensamento, non un ordine di niente.
export function righeOrdine(scelte, { listini = [] } = {}) {
  return (scelte || [])
    .filter((s) => s.qty > 0 && s.item)
    .map((s) => {
      const riga = s.supplier_id
        ? righeDiProdotto(s.item, listini).find((r) => r.supplier_id === s.supplier_id)
        : null
      return {
        item_id: s.item_id,
        name: s.item_name,
        unit: s.item.unit,
        package_size: s.item.package_size ?? null,
        unit_cost: s.unit_cost,
        vat: s.item.vat ?? 22,
        qty_packages: s.qty,
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        code: riga?.code ?? null,
        stato: 'richiesto',
      }
    })
}

// ── I FORNITORI DEL RIEPILOGO, UNO PER ORDINE (REQ-MAG-037) ──────────
//
// UN ORDINE PER FORNITORE: alla conferma nascono N ordini distinti, uno per
// fornitore, ognuno col suo stato e la sua fattura. Il «giro» torna a essere
// la SESSIONE di composizione — questa schermata — e non un documento.
// Sostituisce il modello a fette del 20/08, di cui una fetta resta il caso
// degenere (un ordine con un fornitore solo): è il motivo per cui lo storico
// già scritto continua a leggersi senza rifarlo.
//
// Ogni voce porta DUE forme della stessa cosa: le `righe` scelte, che sono
// quelle da rivedere a schermo (hanno la chiave, il nome, i pezzi), e le
// `lines`, che sono quelle da salvare sull'ordine. Tenerle insieme evita che
// il riepilogo mostri una riga e ne salvi un'altra.
//
// Chi non ha fornitore resta in fondo e si può mandare lo stesso: 378
// prodotti su 388 non stanno sul listino di nessuno, e rifiutare quel gruppo
// vorrebbe dire perdere per strada quello che si è appena scelto.
export function ordiniDaCreare(scelte, { listini = [] } = {}) {
  const fette = []
  for (const g of raggruppaPerFornitore(scelte)) {
    const lines = righeOrdine(g.righe, { listini })
    // Un fornitore le cui righe sono tutte a zero pezzi non è un ordine da
    // mandare a nessuno: è un ripensamento.
    if (lines.length === 0) continue
    const dentro = new Set(lines.map((l) => l.item_id))
    fette.push({
      ...g,
      chiave: g.supplier_id || 'senza',
      righe: g.righe.filter((r) => dentro.has(r.item_id) && r.qty > 0),
      lines,
      totali: purchaseOrderTotals(lines),
    })
  }
  return fette
}

// ── LO SCORRIMENTO CONTINUO ──────────────────────────────────────────
//
// «Dobbiamo paginare […] oppure implementiamo un endless scroll che carica i
// successivi dopo un tot», e delle due l'utente preferisce la seconda: si
// compone un ordine SCORRENDO, e una paginazione costringerebbe a ricordarsi
// cosa si è spuntato a pagina 2 mentre si guarda la 3.
//
// La finestra cresce, non si sposta: le righe già viste restano dove sono,
// con le loro spunte e le loro quantità.
export const prossimaFinestra = (mostrate, totale, passo = PASSO_RIGHE) =>
  Math.min(Number(totale) || 0, (Number(mostrate) || 0) + passo)

// Si carica PRIMA di toccare il fondo: arrivare a un elenco che finisce e
// aspettare che si allunghi è la stessa attesa che il local-first vieta
// altrove. La soglia è poco più di due righe.
export const vicinoAlFondo = ({ scrollTop = 0, clientHeight = 0, scrollHeight = 0 } = {}, soglia = 120) =>
  scrollTop + clientHeight >= scrollHeight - soglia
