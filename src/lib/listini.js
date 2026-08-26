// ── IL LISTINO FORNITORI: un prodotto, più fornitori ──────────────────
//
// Nasce da Flavio, che ha provato la sezione Ordini (26/08/2026): «quel
// prodotto — ad esempio il Campari — deve essere associato a quel
// fornitore, e io questo non lo posso fare CATEGORICAMENTE: è quasi sicuro
// che il Campari lo prendo anche da fornitori differenti» (REQ-MAG-029).
//
// IL MAGAZZINO NON CAMBIA. Il prodotto Campari resta UNO con UNA giacenza:
// a duplicarsi è la RIGA DELLA TABELLA, una per coppia prodotto-fornitore.
// Senza filtro si vedono i doppioni, distinti dal colore e dal nome del
// fornitore; col filtro si vede il catalogo di quel fornitore.
//
// Qui dentro non c'è Firebase apposta: sono i conti che decidono cosa si
// ordina e da chi, e vanno provati senza database.

import { categoryColor, CATEGORY_PALETTE } from './categoryColors.js'

// ── I TRE LIVELLI DELLA RIGA D'ORDINE ────────────────────────────────
//
// Parole di Flavio: «ci devono stare i livelli di RICHIESTO, CONSEGNATO,
// PAGATO. Io mi creo l'ordine che devo mandare al fornitore e in quel
// momento lui non mi carica ancora i prodotti; una volta che me li ha
// portati io faccio consegnato, e dopo mi fa il carico».
//
// IL CARICO A MAGAZZINO AVVIENE AL PASSAGGIO A CONSEGNATO, non prima: è
// questo che risolve «ordinato ma non ancora ricevuto» senza inventare uno
// stato nuovo sul prodotto («in assortimento», REQ-MAG-007, resta politica
// commerciale e non c'entra).
export const LIVELLI = ['richiesto', 'consegnato', 'pagato']

export const ETICHETTA_LIVELLO = {
  richiesto: 'Richiesto',
  consegnato: 'Consegnato',
  pagato: 'Pagato',
}

// Un livello sconosciuto (o mancante, come sugli ordini scritti prima di
// questa voce) vale «richiesto»: il codice nuovo legge sempre i dati
// vecchi, e un ordine di ieri non è né consegnato né pagato per il fatto
// di non avere il campo.
export const livelloDi = (riga) =>
  LIVELLI.includes(riga?.stato) ? riga.stato : 'richiesto'

// Il livello di un gruppo di righe è il PIÙ INDIETRO che contiene: una
// fetta con nove righe pagate e una ancora da consegnare non è pagata.
export function livelloDelGruppo(righe) {
  const lista = righe || []
  if (lista.length === 0) return 'richiesto'
  return LIVELLI[Math.min(...lista.map((r) => LIVELLI.indexOf(livelloDi(r))))]
}

// ── IL COLORE DEL FORNITORE ──────────────────────────────────────────
//
// Si sceglie alla creazione (a caso, oppure a mano) e si vede come le
// strisce laterali della lista del magazzino (REQ-MAG-027). Chi non ce
// l'ha — tutti quelli creati prima — ne riceve uno STABILE calcolato dal
// suo id: un colore che cambia a ogni ricarica non identifica niente.
export function coloreFornitore(fornitore) {
  if (!fornitore) return null
  return fornitore.color || categoryColor(fornitore.id ?? fornitore.name)
}

// La tavolozza è quella delle categorie: i colori che questa app usa già
// per distinguere le cose a colpo d'occhio, provati su tutti i temi.
export const COLORI_FORNITORE = CATEGORY_PALETTE

// A caso, e non «il prossimo libero»: i fornitori si creano anche dalla
// scheda prodotto, di corsa, e chiedere lì una scelta cromatica sarebbe un
// passo in più mentre si sta inventariando una bottiglia. Chi lo vuole
// diverso lo cambia dall'anagrafica.
export function coloreACaso() {
  return COLORI_FORNITORE[Math.floor(Math.random() * COLORI_FORNITORE.length)]
}

// ── LE RIGHE DI LISTINO ──────────────────────────────────────────────

// L'id di una riga è DETERMINISTICO: così l'unicità della coppia
// prodotto-fornitore è un fatto strutturale del database, non un controllo
// applicativo che qualcuno dimentica di fare da un secondo terminale.
export function idRigaListino(supplierId, itemId) {
  if (!supplierId || !itemId) return null
  return `${supplierId}__${itemId}`
}

// LA COMPATIBILITÀ STA TUTTA QUI, e non migra niente (REQ-MAG-029). Un
// prodotto senza righe di listino ma col vecchio campo `supplier_id`
// scritto produce una riga VIRTUALE con quel fornitore e quel costo: i
// dieci prodotti agganciati si comportano come prima, senza che nessuno
// lanci uno script contro il database.
export function rigaVirtuale(item) {
  if (!item?.supplier_id) return null
  return {
    id: idRigaListino(item.supplier_id, item.id),
    supplier_id: item.supplier_id,
    item_id: item.id,
    price: item.cost ?? null,
    package_label: null,
    code: null,
    last_price: null,
    last_price_at: null,
    virtuale: true,
  }
}

// Le righe di listino di un prodotto, col ramo di compatibilità già dentro.
export function righeDiProdotto(item, listini) {
  const proprie = (listini || []).filter((r) => r?.item_id === item?.id && r?.supplier_id)
  if (proprie.length > 0) return proprie
  const virtuale = rigaVirtuale(item)
  return virtuale ? [virtuale] : []
}

// ── IL CATALOGO ORDINABILE ───────────────────────────────────────────
//
// Una riga per coppia prodotto-fornitore. Un prodotto che non sta sul
// listino di nessuno resta comunque ORDINABILE, con la casella del
// fornitore vuota: oggi in magazzino ce ne sono 378 su 388 così, e una
// schermata che li nascondesse sarebbe vuota. È anche quello che Flavio ha
// chiesto: «posso mettere il prodotto INDIPENDENTEMENTE da quale fornitore
// resta associato».
export function catalogoOrdinabile({ items = [], listini = [], suppliers = [] } = {}) {
  const perId = new Map((suppliers || []).map((s) => [s.id, s]))
  const righe = []
  for (const it of items || []) {
    const mie = righeDiProdotto(it, listini)
    if (mie.length === 0) {
      righe.push(componiRiga(it, null, null))
      continue
    }
    for (const r of mie) righe.push(componiRiga(it, r, perId.get(r.supplier_id)))
  }
  // Prodotto, poi fornitore: i doppioni finiscono uno sotto l'altro, che è
  // il modo in cui si confrontano due prezzi dello stesso Campari.
  righe.sort(
    (a, b) =>
      (a.item_name || '').localeCompare(b.item_name || '') ||
      (a.supplier_name || '').localeCompare(b.supplier_name || '')
  )
  return righe
}

function componiRiga(item, riga, fornitore) {
  return {
    // La chiave della riga a schermo: prodotto + fornitore, come l'id di
    // listino. Senza fornitore resta il solo prodotto.
    key: riga?.supplier_id ? `${item.id}|${riga.supplier_id}` : `${item.id}|`,
    item_id: item.id,
    item_name: item.name ?? '',
    item,
    supplier_id: riga?.supplier_id ?? null,
    supplier_name: fornitore?.name ?? null,
    colore: coloreFornitore(fornitore),
    // Il prezzo di listino di QUEL fornitore; senza riga si ricade sul
    // costo del prodotto, che è l'ultimo pagato a chiunque.
    price: riga?.price != null ? Number(riga.price) : (item.cost ?? null),
    package_label: riga?.package_label ?? null,
    code: riga?.code ?? null,
    last_price: riga?.last_price ?? null,
    last_price_at: riga?.last_price_at ?? null,
    virtuale: !!riga?.virtuale,
  }
}

// Chi vende cosa: item_id -> [supplier_id]. Serve al magazzino, che filtra
// per fornitore e non può più guardare il campo sul prodotto — da quando il
// legame vive nel listino, un prodotto ha zero, uno o cinque fornitori.
export function fornitoriPerArticolo(items, listini) {
  const mappa = new Map()
  for (const it of items || []) {
    const righe = righeDiProdotto(it, listini)
    mappa.set(
      it.id,
      righe.map((r) => r.supplier_id).filter(Boolean)
    )
  }
  return mappa
}

// LA RICERCA VIENE PRIMA DEL FORNITORE, ed è il cuore della richiesta: la
// schermata di oggi parte dal fornitore ed è proprio ciò di cui Flavio si
// lamenta. Il filtro fornitore resta, ma è una VISTA sul catalogo, non la
// porta d'ingresso.
export function filtraCatalogo(righe, { query = '', supplierId = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase()
  return (righe || []).filter((r) => {
    if (q && !(r.item_name || '').toLowerCase().includes(q)) return false
    if (supplierId === 'none') return !r.supplier_id
    if (supplierId !== 'all' && r.supplier_id !== supplierId) return false
    return true
  })
}

// ── CHI PROPORRE, E CHI MOSTRARE ACCANTO ─────────────────────────────

// IL FORNITORE PROPOSTO È QUELLO DELL'ULTIMO ACQUISTO, non il più
// economico. Il prezzo più basso in archivio è quasi sempre il più
// vecchio, perché nessuno aggiorna al rialzo il listino di un fornitore da
// cui non compra più: proporlo vorrebbe dire mandare l'ordine a chi quel
// prezzo non lo fa più da due anni.
export function fornitoreProposto(righe, { esclusi = [] } = {}) {
  const fuori = new Set(esclusi || [])
  const candidate = (righe || []).filter((r) => r.supplier_id && !fuori.has(r.supplier_id))
  if (candidate.length === 0) return null
  return candidate.reduce((migliore, r) =>
    String(r.last_price_at || '') > String(migliore.last_price_at || '') ? r : migliore
  )
}

// IL PIÙ ECONOMICO SI MOSTRA, NON SI SCEGLIE: serve a confrontare prima di
// ordinare, ed è chi ordina a decidere se quel prezzo è ancora vero.
export function piuEconomica(righe, { esclusi = [] } = {}) {
  const fuori = new Set(esclusi || [])
  const candidate = (righe || []).filter(
    (r) => r.supplier_id && !fuori.has(r.supplier_id) && Number(r.price) > 0
  )
  if (candidate.length === 0) return null
  return candidate.reduce((min, r) => (Number(r.price) < Number(min.price) ? r : min))
}

// I fornitori da cui QUEL prodotto è già stato messo in QUESTO ordine.
// «Va anche bene che è disabilitato il fornitore in quanto già l'ho
// ordinato a quel fornitore» (Flavio): due righe dello stesso prodotto
// allo stesso fornitore nello stesso ordine sono un doppione, non una
// scelta.
export function fornitoriGiaUsati(righeOrdine, itemId) {
  return new Set(
    (righeOrdine || [])
      .filter((l) => l.item_id === itemId && l.supplier_id)
      .map((l) => l.supplier_id)
  )
}

// ── LE FETTE DI FORNITORE ────────────────────────────────────────────
//
// L'ORDINE RESTA UNO, coi fornitori dentro, e il per-fornitore è una VISTA
// (decisione del 20/08, REQ-MAG-025). Ma email, stampa e gancio con la
// fattura vanno per FETTA: mandare a Nova anche le righe di Enofel è un
// errore verso il fornitore, non un dettaglio grafico.
//
// La fetta esce con la stessa FORMA di un ordine (supplier_name,
// created_at, lines, totali): così stampa, testo e copia negli appunti la
// trattano come sempre, senza una seconda versione di quelle funzioni.
export function fetteFornitore(order, { suppliers = [] } = {}) {
  const perId = new Map((suppliers || []).map((s) => [s.id, s]))
  const fette = new Map()
  const righe = order?.lines || []
  for (let i = 0; i < righe.length; i++) {
    const l = righe[i]
    // Sugli ordini scritti prima di questa voce il fornitore stava
    // sull'ORDINE e non sulla riga: si eredita, se no un ordine di ieri
    // finirebbe tutto nella fetta «senza fornitore».
    const supplierId = l.supplier_id ?? order?.supplier_id ?? null
    const chiave = supplierId || ''
    if (!fette.has(chiave)) {
      const sup = supplierId ? perId.get(supplierId) : null
      fette.set(chiave, {
        supplier_id: supplierId,
        supplier_name:
          sup?.name ?? l.supplier_name ?? (supplierId ? order?.supplier_name ?? '' : null),
        email: sup?.email ?? null,
        colore: coloreFornitore(sup),
        created_at: order?.created_at ?? null,
        order_id: order?.id ?? null,
        indici: [],
        lines: [],
      })
    }
    const fetta = fette.get(chiave)
    fetta.indici.push(i)
    fetta.lines.push(l)
  }
  return [...fette.values()]
    .map((f) => ({ ...f, stato: livelloDelGruppo(f.lines), ...totaliRighe(f.lines) }))
    .sort((a, b) => (a.supplier_name || '￿').localeCompare(b.supplier_name || '￿'))
}

// Totali di un gruppo di righe, con i nomi che l'ordine usa già
// (total_net / total_gross): la fetta si stampa come un ordine.
function totaliRighe(righe) {
  let net = 0
  let gross = 0
  for (const l of righe || []) {
    const qty = Number(l.qty_packages) || 0
    const costo = Number(l.unit_cost) || 0
    net += qty * costo
    gross += qty * costo * (1 + (Number(l.vat) || 0) / 100)
  }
  return { total_net: net, total_gross: gross }
}

// Lo stato dell'ORDINE INTERO, nel vocabolario che il resto dell'app usa
// già («inviato» / «ricevuto»): un ordine è ricevuto quando non gli resta
// niente da consegnare. Serve a non rinominare un campo che sta scritto su
// documenti veri.
export function statoOrdine(order) {
  const livello = livelloDelGruppo(order?.lines || [])
  return livello === 'richiesto' ? 'inviato' : 'ricevuto'
}
