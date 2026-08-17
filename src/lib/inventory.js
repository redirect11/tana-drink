// Logica pura dell'inventario (niente Firebase): unità, formattazione,
// stato scorte e calcolo del consumo. Interamente testabile a unità.

// Unità base in cui è salvato lo stock: volumi in ml, pesi in g, conteggi in pz.
export const BASE_UNITS = ['ml', 'g', 'pz']

// Unità selezionabili in fase di inserimento ricetta, per unità base dell'item.
// Sono le unità "piccole" con cui si dosa un drink (mai L/kg in una ricetta):
// liquidi in cl/ml, solidi in g/mg. Devono restare un sottoinsieme di quelle
// gestite da costPerUnit, altrimenti il costo dell'ingrediente andrebbe perso.
export const ENTRY_UNITS = {
  ml: ['cl', 'ml'],
  g: ['g', 'mg'],
  pz: ['pz'],
}

// Unità con cui si dosa QUESTO ingrediente in una ricetta.
//
// La giacenza si conta a bottiglie (si carica la merce a pezzi), ma un
// cocktail si dosa in CL: sono due misure diverse dello stesso prodotto, e
// servono entrambe. Finché le unità dipendevano solo da `unit`, un articolo a
// pezzo offriva soltanto "pz" e per 4 cl di gin bisognava scrivere 0,057
// pezzi — un numero che non vuol dire niente per chi prepara.
//
// Il cl viene per primo: nelle ricette è il caso normale. Il pezzo resta,
// perché una Coca in un drink si mette intera.
export function entryUnits(item) {
  const unit = item?.unit || 'pz'
  if (unit !== 'pz') return ENTRY_UNITS[unit] ?? [unit]
  const c = contentBase(item)
  if (c?.base === 'ml') return ['cl', 'ml', 'pz']
  if (c?.base === 'g') return ['g', 'mg', 'pz']
  return ['pz']
}

// Converte una quantità dall'unità inserita all'unità base dell'item.
//   cl→ml (×10), L→ml (×1000), kg→g (×1000); ml/g/pz invariati.
export function toBaseQty(qty, unit) {
  const n = Number(qty) || 0
  switch ((unit || '').toLowerCase()) {
    case 'cl':
      return n * 10
    case 'l':
      return n * 1000
    case 'kg':
      return n * 1000
    case 'mg':
      return n * 0.001
    default:
      return n
  }
}

// Unità base (in cui è salvato lo stock) a partire dall'unità scelta
// dall'utente: liquidi → ml, pesi → g, pezzi → pz.
export function baseUnit(u) {
  const x = String(u || '').toLowerCase()
  if (['l', 'cl', 'ml'].includes(x)) return 'ml'
  if (['kg', 'g', 'mg'].includes(x)) return 'g'
  return 'pz'
}

// Inverso di toBaseQty: da unità base al numero nell'unità scelta.
export function fromBaseQty(base, unit) {
  const n = Number(base) || 0
  switch (String(unit || '').toLowerCase()) {
    case 'l':
    case 'kg':
      return n / 1000
    case 'cl':
      return n / 10
    case 'mg':
      return n * 1000
    default:
      return n
  }
}

// Formatta una quantità BASE nell'unità ESATTA scelta (niente auto-scaling:
// se l'utente lavora in cl, vede cl). Etichette: L, cl, ml, kg, g, mg, pz.
const UNIT_LABEL = { l: 'L', cl: 'cl', ml: 'ml', kg: 'kg', g: 'g', mg: 'mg', pz: 'pz' }
export function formatIn(base, unit) {
  const n = Math.round(fromBaseQty(base, unit) * 100) / 100
  // `useGrouping: 'always'`: senza, il punto delle migliaia dipende da quanto
  // è aggiornata la tabella delle lingue del dispositivo — le versioni
  // recenti non raggruppano i numeri di quattro cifre in italiano, quelle
  // vecchie sì. Lo stesso magazzino si leggeva "2.000 mg" sul portatile e
  // "2000 mg" sull'iPad. Qui si sceglie una forma sola, uguale ovunque.
  const numero = n.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })
  return `${numero} ${UNIT_LABEL[String(unit || '').toLowerCase()] || unit}`
}

// Formatta la giacenza di un ITEM: nell'unità scelta se impostata, altrimenti
// auto (retrocompatibile con gli item senza unità di visualizzazione).
export function fmtItem(base, item) {
  return item?.display_unit ? formatIn(base, item.display_unit) : formatQty(base, item?.unit)
}

// Formatta una quantità (in unità base) in modo leggibile.
export function formatQty(qty, unit) {
  const n = Number(qty) || 0
  if (unit === 'ml') {
    if (n >= 1000) return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })} L`
    if (n >= 100 && n % 10 === 0) return `${n / 10} cl`
    return `${n} ml`
  }
  if (unit === 'g') {
    if (n >= 1000) return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })} kg`
    return `${n} g`
  }
  return `${n} pz`
}

// Scompone la giacenza (in unità base) nelle bottiglie/confezioni:
//   - full:      bottiglie piene sigillate
//   - openRemaining: contenuto della bottiglia attualmente in uso (0 se nessuna)
//   - finished:  bottiglie ormai vuote (di quelle totali caricate)
// Esempio: bottiglia 1 L, 4 totali, stock 2,5 L → full 2, openRemaining 0,5 L, finished 1.
// Ritorna null per i prodotti a pezzi o senza confezione.
export function bottleBreakdown(item) {
  const c = contentBase(item)
  if (!c) return null
  const stock = Math.max(0, Number(item?.stock) || 0)
  const total = Number(item?.bottles_total) || 0
  // Con la giacenza contata a PEZZI, "0,8" è una bottiglia aperta all'80%:
  // la parte intera sono le bottiglie piene, il resto è quanto c'è nella
  // aperta. Con la giacenza a volume vale lo stesso ragionamento diviso
  // per il contenuto. In entrambi i casi il residuo si esprime in ml/g,
  // che è come lo si legge al banco.
  const aPezzo = (item?.unit || 'pz') === 'pz'
  const full = aPezzo ? Math.floor(stock) : Math.floor(stock / c.size)
  const openRemaining = aPezzo ? (stock - full) * c.size : stock - full * c.size
  const hasOpen = openRemaining > 1e-9
  const withContent = full + (hasOpen ? 1 : 0)
  const finished = Math.max(0, total - withContent)
  return { full, openRemaining, hasOpen, finished, total }
}

// QUANTI PEZZI CI SONO, CON LA VIRGOLA.
//
// «3 bott.» diceva quante bottiglie si toccano, non quanto prodotto c'è
// dentro: tre bottiglie di cui una quasi vuota contavano come tre, e per
// sapere se bastavano per la serata bisognava aprire il dettaglio. Il
// pezzo invece è frazionabile: una bottiglia da 100 cl con dentro 50 cl è
// mezzo pezzo. Due piene e una a cui mancano 10 cl su 50 fanno 2,8.
//
// Il numero è comodo anche per il valore di magazzino: pezzi × costo.
export function pezziInGiacenza(item) {
  const bd = bottleBreakdown(item)
  if (!bd) return null
  // Giacenza già contata a pezzi (le bibite in bottiglia): il numero c'è
  // di suo, decimali compresi — «17» sono diciassette bottiglie, «2,8»
  // due e otto decimi di quella aperta.
  if ((item?.unit || 'pz') === 'pz') return Math.max(0, Number(item?.stock) || 0)
  const c = contentBase(item)
  if (!c || !(c.size > 0)) return null
  return bd.full + bd.openRemaining / c.size
}

// Il numero come si scrive: due decimali al massimo, senza zeri inutili in
// coda («3 pz», non «3,00 pz») e con la virgola, che è come si legge qui.
export function formatPezzi(n) {
  const v = Math.max(0, Number(n) || 0)
  const arrotondato = Math.round(v * 100) / 100
  return arrotondato.toLocaleString('it-IT', { maximumFractionDigits: 2 })
}

// Giacenza di un item da DRINK (bottiglie/confezioni frazionabili), coi
// tre dati che servono al banco, ognuno nella SUA unità:
//   - pezzi:   quanto prodotto c'è, in pezzi frazionati (2,8)
//   - bottles: quante bottiglie si toccano (piene + quella aperta)
//   - total:   contenuto totale nell'unità dell'item (cl/ml/g)
//   - open:    residuo della bottiglia aperta, stessa unità (null se nessuna)
// Il conteggio bottiglie è un numero di pezzi; il CONTENUTO non si misura
// mai in pezzi. Null per gli articoli a pezzo, che non si frazionano.
export function bottleSummary(item) {
  const bd = bottleBreakdown(item)
  if (!bd) return null
  // Il residuo della bottiglia aperta si legge SEMPRE in cl (o in g): anche
  // quando la giacenza è contata a pezzi, "aperta 0,8 pz" non dice niente a
  // chi sta versando.
  const unitaContenuto = item?.unit === 'pz' ? (item?.content_unit === 'g' ? 'g' : 'cl') : null
  return {
    pezzi: pezziInGiacenza(item),
    bottles: bd.full + (bd.hasOpen ? 1 : 0),
    total: fmtItem(Math.max(0, Number(item?.stock) || 0), item),
    open: bd.hasOpen
      ? unitaContenuto
        ? formatIn(Math.round(bd.openRemaining), unitaContenuto)
        : fmtItem(Math.round(bd.openRemaining), item)
      : null,
  }
}

// Stato scorta di un item: 'empty' (≤0), 'low' (≤ soglia), 'ok'.
export function stockStatus(item) {
  const stock = Number(item?.stock) || 0
  if (stock <= 0) return 'empty'
  if (stock <= (Number(item?.low_threshold) || 0)) return 'low'
  return 'ok'
}

// Conteggi per i chip di riepilogo: totale prodotti, in esaurimento, esauriti.
export function inventorySummary(items) {
  let total = 0
  let low = 0
  let empty = 0
  for (const it of items || []) {
    total += 1
    const st = stockStatus(it)
    if (st === 'low') low += 1
    else if (st === 'empty') empty += 1
  }
  return { total, low, empty }
}

// Filtra/ordina la lista inventario per ricerca (nome), categoria, fornitore e stato.
//   filters: { query?, categoryId? ('all'|id|'none'), supplierId? ('all'|id|'none'),
//              status? ('all'|'ok'|'low'|'empty') }
// ASSORTIMENTO. Quattro stati, in ordine di attenzione richiesta:
//
//   'assortimento' → si tiene, senza niente di speciale. È il DEFAULT: un
//                    prodotto nuovo nasce così, e la stragrande maggioranza
//                    resta così.
//   'linea'        → i cavalli di battaglia: non devono mancare mai, sono i
//                    primi da controllare prima di una serata.
//   'premium'      → le bottiglie buone.
//   'out'          → fuori assortimento: non si ricompra.
//
// Il filtro accetta PIÙ valori insieme, perché la domanda vera è quasi sempre
// combinata: "linea e premium, senza gli out" oppure "linea e out, per
// decidere cosa far rientrare".
export const ASSORTIMENTI = ['assortimento', 'linea', 'premium', 'out']
export const assortimentoDi = (item) =>
  ASSORTIMENTI.includes(item?.status) ? item.status : 'assortimento'

export function filterItems(
  items,
  { query = '', categoryId = 'all', supplierId = 'all', status = 'all', assortimenti = null } = {}
) {
  const q = query.trim().toLowerCase()
  const out = (items || []).filter((it) => {
    if (q && !(it.name || '').toLowerCase().includes(q)) return false
    if (categoryId === 'none') {
      if (it.category_id) return false
    } else if (categoryId !== 'all') {
      if (it.category_id !== categoryId) return false
    }
    if (supplierId === 'none') {
      if (it.supplier_id) return false
    } else if (supplierId !== 'all') {
      if (it.supplier_id !== supplierId) return false
    }
    if (status !== 'all' && stockStatus(it) !== status) return false
    // null o lista vuota = nessun filtro: si vede tutto (non "niente", che
    // farebbe sparire l'inventario a chi deseleziona per sbaglio).
    if (Array.isArray(assortimenti) && assortimenti.length > 0) {
      if (!assortimenti.includes(assortimentoDi(it))) return false
    }
    return true
  })
  out.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return out
}

// ── Costi e valorizzazione ─────────────────────────────────────────────

// Prezzo con IVA a partire dal netto e dall'aliquota (%).
export function costWithVat(cost, vat = 22) {
  return (Number(cost) || 0) * (1 + (Number(vat) || 0) / 100)
}

// Numero di confezioni/bottiglie equivalenti in giacenza.
// La giacenza si legge SEMPRE da zero in su: con un −0,04 pz rimasto in
// magazzino si leggeva «valore −0,67 €», cioè un magazzino che vale meno di
// niente. Quello che manca è un errore da correggere, non un credito.
export function unitsInStock(item) {
  const stock = giacenzaPerCarico(item?.stock)
  if (item?.unit === 'pz') return stock
  const size = Number(item?.package_size) || 0
  return size > 0 ? stock / size : 0
}

// Valore della giacenza di un item (default con IVA).
export function stockValue(item, { gross = true } = {}) {
  const unit = gross ? costWithVat(item?.cost, item?.vat) : (Number(item?.cost) || 0)
  return unitsInStock(item) * unit
}

// Costo per cl (volumi): costo confezione / cl per confezione. null se non applicabile.
export function costPerCl(item, { gross = true } = {}) {
  if (item?.unit !== 'ml') return null
  const size = Number(item?.package_size) || 0
  if (size <= 0) return null
  const unit = gross ? costWithVat(item?.cost, item?.vat) : (Number(item?.cost) || 0)
  return unit / (size / 10)
}

// CONTENUTO DI UNA CONFEZIONE, con la famiglia a cui appartiene.
// Per gli articoli a volume o a peso il contenuto è già nell'unità base
// dell'articolo. Per quelli contati a PEZZO (una Ceres o una Coca: o c'è o
// non c'è) la giacenza è in pezzi, ma la bottiglia un contenuto ce l'ha
// lo stesso — 33 cl — e senza saperlo non si può dire quanto costa al cl.
// `content_unit` dice di che famiglia è quel numero.
export function contentBase(item) {
  const size = Number(item?.package_size) || 0
  if (!(size > 0)) return null
  const base = (item?.unit || 'pz') === 'pz' ? item?.content_unit || null : item.unit
  if (base !== 'ml' && base !== 'g') return null
  return { size, base }
}

// Unità di misura "piccole" adatte a mostrare il prezzo unitario:
// liquidi (base ml) → cl o ml; solidi (base g) → g o mg; pezzi → pz.
// Un articolo a pezzo di cui si conosce il contenuto le offre entrambe: si
// vende a bottiglia, ma sapere quanto costa al cl serve lo stesso.
export function smallUnits(item) {
  if (item?.unit === 'ml') return ['cl', 'ml']
  if (item?.unit === 'g') return ['g', 'mg']
  const c = contentBase(item)
  if (c?.base === 'ml') return ['pz', 'cl', 'ml']
  if (c?.base === 'g') return ['pz', 'g', 'mg']
  return ['pz']
}

// Quante unità base (ml/g) vale 1 unità di misura. Copre TUTTE le unità
// gestite (comprese L/kg), non solo le "piccole": così un costo non va mai
// perso in silenzio per un'unità non prevista. Deve restare coerente con
// toBaseQty (stessi fattori di conversione).
const BASE_PER_UNIT = { l: 1000, cl: 10, ml: 1, kg: 1000, g: 1, mg: 0.001, pz: 1 }

// Costo di una singola unità (L/cl/ml/kg/g/mg/pz) partendo dal costo per
// confezione: cost / (package_size / base-per-unità). Null se non calcolabile.
// L'unità richiesta deve appartenere alla stessa famiglia dell'item
// (liquido↔ml, solido↔g): chiedere il costo al ml di un solido non ha senso.
export function costPerUnit(item, unit, { gross = true } = {}) {
  const packCost = gross ? costWithVat(item?.cost, item?.vat) : Number(item?.cost) || 0
  if (!(packCost > 0)) return null
  const per = BASE_PER_UNIT[String(unit || '').toLowerCase()]
  if ((item?.unit || 'pz') === 'pz') {
    // Il pezzo costa quello che costa. Il costo al cl si ricava solo se si
    // sa quanto contiene la bottiglia: altrimenti null, che vuol dire "non
    // lo so" e non "zero".
    if (unit === 'pz') return packCost
    const c = contentBase(item)
    if (!c || !per || baseUnit(unit) !== c.base) return null
    return packCost / (c.size / per)
  }
  if (!per || baseUnit(unit) !== item.unit) return null
  const size = Number(item?.package_size) || 0
  if (size <= 0) return null
  return packCost / (size / per)
}

// Valore totale del magazzino.
export function inventoryTotalValue(items, opts) {
  return (items || []).reduce((s, it) => s + stockValue(it, opts), 0)
}

// ── SOTTO ZERO NON SI SCENDE ──────────────────────────────────────────
// Il 17 agosto il Jagermeister era a −0,04 pz, con «valore −0,67 €» e la
// conta che si apriva già in rosso: si continua a battere un prodotto finito
// e lo scarico toglie comunque, perché `increment(-qty)` non guarda quanto
// c'è. L'increment resta — è commutativo e si accoda offline, e al banco
// niente aspetta la rete: quello che si decide prima di chiederlo è QUANTO
// togliere.

// Quanto si può DAVVERO scaricare: mai più di quello che risulta in
// giacenza, e da una giacenza già a zero (o negativa) niente. La vendita
// passa comunque — il conto è già scritto — e il magazzino si ferma a zero.
export function scaricoPossibile(stock, qty) {
  const richiesta = Number(qty) || 0
  if (!(richiesta > 0)) return 0
  const giacenza = Number(stock) || 0
  if (!(giacenza > 0)) return 0
  return Math.min(richiesta, giacenza)
}

// La giacenza da cui parte un CARICO, che non è mai negativa: comprando una
// bottiglia e caricandola su −0,04 se ne deve contare UNA. Partendo dal
// negativo il carico ne conta meno di una, sullo scaffale però c'è tutta, e
// da quel momento il magazzino mente su quanto prodotto c'è davvero.
export function giacenzaPerCarico(stock) {
  return Math.max(0, Number(stock) || 0)
}

// QUANTO TOGLIERE DALLA GIACENZA per una riga di ricetta.
//
// Le ricette si scrivono come si versa — 40 ml di gin, 1 pz di Coca — mentre
// la giacenza può essere contata in un'altra unità. Un articolo a PEZZO con
// il contenuto noto consuma FRAZIONI di bottiglia: 40 ml da una da 700 sono
// 0,057 pezzi. Senza questa conversione lo scarico sottrae il numero della
// ricetta così com'è, cioè 40 BOTTIGLIE per un cocktail da 40 ml.
//
// Se la conversione non è possibile (unità di famiglie diverse, contenuto
// ignoto) si restituisce la quantità com'è: meglio un consumo impreciso che
// un numero inventato con una moltiplicazione a caso.
export function qtyInStockUnit(qty, unit, item) {
  const q = Number(qty) || 0
  if (!(q > 0)) return 0
  const u = String(unit || 'pz').toLowerCase()
  const stockUnit = item?.unit || 'pz'
  if (u === stockUnit) return q
  // "1 pz" di un articolo contato a volume = una confezione intera.
  if (u === 'pz') {
    const size = Number(item?.package_size) || 0
    return size > 0 ? q * size : q
  }
  const base = toBaseQty(q, u)
  if (stockUnit === 'pz') {
    const c = contentBase(item)
    if (!c || baseUnit(u) !== c.base || !(c.size > 0)) return q
    return base / c.size
  }
  if (baseUnit(u) !== stockUnit) return q
  return base
}

// Calcola il consumo totale per ingrediente da una lista di order_items.
//   orderItems: [{ drink_id, qty, recipe_items? }]
//   drinksById: { [drinkId]: { recipe_items: [{ inventory_item_id, name, unit, qty }] } }
// Gli item "custom" (drink composti al volo dal bartender) portano la ricetta
// incorporata in `recipe_items`: ha la precedenza sulla ricetta del catalogo.
// Ritorna: [{ inventory_item_id, name, unit, qty }] con qty in unità base.
export function computeConsumption(orderItems, drinksById) {
  const acc = new Map()
  for (const oi of orderItems || []) {
    const recipe = Array.isArray(oi.recipe_items)
      ? oi.recipe_items
      : drinksById?.[oi.drink_id]?.recipe_items
    if (!Array.isArray(recipe)) continue
    const mult = Number(oi.qty) || 0
    for (const ri of recipe) {
      if (!ri.inventory_item_id) continue
      const add = (Number(ri.qty) || 0) * mult
      if (add <= 0) continue
      // Si somma per ARTICOLO **E UNITÀ**: la stessa bottiglia può comparire
      // in una ricetta a cl (40 ml di gin in un cocktail) e in un'altra a
      // pezzo (una Coca servita intera). Sommandole insieme si otterrebbe
      // "41" senza sapere di cosa, e lo scarico toglierebbe un numero senza
      // senso. Restano due voci, ognuna con la sua unità.
      const unit = ri.unit ?? 'pz'
      const chiave = `${ri.inventory_item_id}|${unit}`
      const ex = acc.get(chiave)
      if (ex) ex.qty += add
      else acc.set(chiave, {
        inventory_item_id: ri.inventory_item_id,
        name: ri.name ?? null,
        unit,
        qty: add,
      })
    }
  }
  return [...acc.values()]
}

// IL CONTENUTO NON SI MISURA MAI IN PEZZI.
//
// Un pezzo è la bottiglia; dentro ci sono cl (o grammi). Sugli articoli
// contati a pezzo la giacenza è in pezzi ma il contenuto — quello della
// bottiglia aperta, la capienza della confezione — resta in unità di
// volume o di peso: si leggeva «1 aperta (40 pz) · 1 conf. = 200 pz», che
// non vuol dire niente per chi sta versando.
export function fmtContenuto(qty, item) {
  const c = contentBase(item)
  if (!c) return fmtItem(qty, item)
  if ((item?.unit || 'pz') !== 'pz') return fmtItem(qty, item)
  return formatIn(qty, c.base === 'g' ? 'g' : 'cl')
}

// ── DUPLICARE UN PRODOTTO ────────────────────────────────────────────
// Cosa si porta dietro la copia, e cosa no. Sta qui e non nella
// schermata perché è una regola sui dati: la giacenza NON si copia — la
// copia è un prodotto che in magazzino non è mai entrato, e portarsi
// dietro le bottiglie vorrebbe dire inventarsele. Nemmeno l'identità
// (id, data di creazione) e nemmeno il conteggio delle bottiglie
// caricate, che appartiene alla storia dell'originale.
export function copiaProdotto(item) {
  if (!item) return null
  const { id, created_at, stock, bottles_total, ...resto } = item // eslint-disable-line no-unused-vars
  return {
    ...resto,
    name: `${item.name || 'Prodotto'} (copia)`,
    stock: 0,
    bottles_total: 0,
  }
}
