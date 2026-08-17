import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  loadStock,
  receiveBottles,
  adjustStock,
  fetchStockMovements,
  fetchInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
  fetchMacroCategories,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  subscribeSettings,
  subscribeActiveOrders,
  subscribeDrinks,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { useCashSession } from '../lib/cashSession.js'
import { impegnatoPerArticolo, articoloPrevisto } from '../lib/impegnato.js'
import {
  formatQty,
  fmtItem,
  baseUnit,
  fromBaseQty,
  toBaseQty,
  qtyInStockUnit,
  stockStatus,
  bottleSummary,
  bottleBreakdown,
  pezziInGiacenza,
  formatPezzi,
  copiaProdotto,
  fmtContenuto,
  inventorySummary,
  filterItems,
  formatIn,
  ASSORTIMENTI,
  assortimentoDi,
  costWithVat,
  stockValue,
  smallUnits,
  costPerUnit,
  inventoryTotalValue,
  unitaGenerica,
  UNIT_LABEL,
} from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'
import { parseSupplierList } from '../lib/warehouse.js'
import MacroCategoryManager from './MacroCategoryManager.jsx'
import { toastSuccess, toastError } from '../lib/toast.js'
import StockCountPanel from './StockCountPanel.jsx'
import PurchaseOrdersPanel from './PurchaseOrdersPanel.jsx'
import SupplierInvoicesPanel from './SupplierInvoicesPanel.jsx'
import CategoryRail from './CategoryRail.jsx'
import SectionPanels from './SectionPanels.jsx'
import { IconTag, IconCartelle, IconFornitore } from './Icons.jsx'
import Tendina from './Tendina.jsx'
import { useSottosezioni } from '../lib/sottosezioni.js'
import { usePaginaPiena } from '../lib/paginaPiena.js'

const STATUS_ITEM = [
  { value: 'assortimento', label: 'In assortimento' },
  { value: 'linea', label: '🍾 In linea' },
  { value: 'premium', label: '👑 Premium' },
  { value: 'out', label: '🚫 Fuori assortimento' },
]

const STATUS_LABEL = { ok: '', low: 'in esaurimento', empty: 'esaurito' }

// Come si chiama, a parole, il modo in cui un articolo è gestito: è quello che
// si legge nell'avviso quando lo si cambia in modifica.
const GESTIONE_LABEL = { pz: 'pezzi', g: 'peso', ml: 'liquidi', U: 'unità generiche' }

// Come si legge l'assortimento in lista: OUT accanto al nome (si deve vedere
// subito che non si ricompra) e una coroncina piccola sui premium. Chi è "in
// linea" non porta niente: è la normalità, e un segno su tutto non segna nulla.
// Il chip del filtro porta lo STESSO segno che compare nella riga: è lì che
// si impara cosa vuol dire il bollino, senza una legenda a parte da cercare.
const ASSORTIMENTO_LABEL = {
  assortimento: <>📦 In assortimento</>,
  linea: <>🍾 In linea</>,
  premium: <>👑 Premium</>,
  out: (
    <>
      <span className="badge-empty">OUT</span> Fuori assortimento
    </>
  ),
}
// Gli stessi nomi, in parole: servono al tasto della tendina, che deve dire
// cosa è scelto senza doversi aprire.
const ASSORTIMENTO_NOME = {
  assortimento: 'In assortimento',
  linea: 'In linea',
  premium: 'Premium',
  out: 'Fuori assortimento',
}
const ASSORTIMENTO_TITOLO = {
  assortimento: 'Si tiene, senza niente di speciale',
  linea: 'I primi da controllare prima di una serata',
  premium: 'Bottiglie premium',
  out: 'Fuori assortimento: non si ricompra',
}
function SegnoAssortimento({ item }) {
  const a = assortimentoDi(item)
  if (a === 'out') return <span className="badge-empty">OUT</span>
  if (a === 'premium') return <span className="badge-segno" title="Premium">👑</span>
  // La bottiglia: ora è libera, perché la colonna scorte non la usa più per
  // contare le bottiglie rimaste (scrive "3 bott.").
  if (a === 'linea') return <span className="badge-segno" title="In linea">🍾</span>
  return null
}

// Prezzo unitario dell'item con l'unità di misura selezionabile (cl/ml per i
// liquidi, g/mg per i solidi, pz per i pezzi): costo REALE al dettaglio +
// prezzo CONSIGLIATO a ricarico (×3 di default) e GUADAGNO che ne resta.
// È qui che si legge la marginalità dell'ingrediente, per unità.
function UnitPrice({ item, markup }) {
  const units = smallUnits(item)
  const [unit, setUnit] = useState(units[0])
  const cost = costPerUnit(item, unit)
  if (cost == null) return null
  const m = Number(markup) > 0 ? Number(markup) : 3
  const consigliato = cost * m
  const guadagno = consigliato - cost
  return (
    <div className="inv-info-row">
      <dt>
        Al {unit}
        {units.length > 1 &&
          units.map((u) => (
            <button
              key={u}
              type="button"
              className={`chip ${u === unit ? 'active' : ''}`}
              style={{ padding: '0 6px', fontSize: '0.68rem' }}
              onClick={(e) => {
                e.stopPropagation()
                setUnit(u)
              }}
            >
              {u}
            </button>
          ))}
      </dt>
      <dd className="inv-unitprice">
        <span>costo <strong>{formatPrice(cost)}</strong></span>
        <span>consigliato ×{m} <strong className="price">{formatPrice(consigliato)}</strong></span>
        <span className="muted">guadagno {formatPrice(guadagno)}</span>
      </dd>
    </div>
  )
}

// Sezioni del magazzino: prodotti (giacenze), conta periodica, ordini
// fornitore e scadenzario — la controparte software dei fogli Excel storici.
const INV_VIEWS = [
  ['prodotti', '📦', 'Prodotti'],
  ['conta', '📋', 'Conta'],
  ['ordini', '🛒', 'Ordini'],
  ['scadenzario', '📄', 'Scadenzario'],
  ['categorie', '🏷', 'Categorie'],
  ['macro', '🗂', 'Macro-categorie'],
  ['fornitori', '🏭', 'Fornitori'],
  ['movimenti', '📜', 'Movimenti'],
]

// LE SEZIONI DEL MAGAZZINO STANNO NELLA BARRA IN ALTO. Le ho provate in due
// modi sbagliati: a sinistra costavano una colonna (e dentro c'è già la barra
// delle categorie), in orizzontale una riga. Sono una scelta che si fa ogni
// tanto e non merita spazio fisso: ora è il TITOLO della pagina a diventare
// il comando, e sul telefono si apre il foglio dal basso.
export default function InventoryManager() {
  const [view, setView] = useState('prodotti')
  usePaginaPiena()
  useSottosezioni(
    INV_VIEWS.map(([id, icona, label]) => ({ id, icona, label })),
    view,
    setView
  )
  return (
    <div className="pagina-inventario">
      {view === 'prodotti' && <ProductsPanel />}
      {view === 'conta' && <StockCountPanel />}
      {view === 'ordini' && <PurchaseOrdersPanel />}
      {view === 'scadenzario' && <SupplierInvoicesPanel />}
      {view === 'categorie' && <CategoriePanel />}
      {view === 'macro' && <MacroPanel />}
      {view === 'fornitori' && <FornitoriPanel />}
      {view === 'movimenti' && <MovimentiPanel />}
    </div>
  )
}

// Le tre anagrafiche: si tirano su i dati che servono e basta. Prima
// stavano dentro il pannello dei prodotti, che li aveva già in mano per
// altri motivi — e infatti erano finite lì.
function CategoriePanel() {
  const [categories, setCategories] = useState([])
  const ricarica = async () => setCategories(await fetchInventoryCategories())
  useEffect(() => {
    ricarica()
  }, [])
  return <InvCategoryManager categories={categories} onChange={ricarica} />
}

function MacroPanel() {
  const [macros, setMacros] = useState([])
  const [categories, setCategories] = useState([])
  // Le macro del MENÙ servono qui solo per l'aggancio: su ogni macro di
  // spesa si sceglie a quale macro di vendita corrisponde.
  const [macroMenu, setMacroMenu] = useState([])
  const ricarica = async () => {
    const [macs, cats, menu] = await Promise.all([
      fetchMacroCategories('magazzino'),
      fetchInventoryCategories(),
      fetchMacroCategories('menu').catch(() => []),
    ])
    setMacros(macs)
    setCategories(cats)
    setMacroMenu(menu)
  }
  useEffect(() => {
    ricarica()
  }, [])
  return (
    <MacroCategoryManager
      ambito="magazzino"
      macros={macros}
      categories={categories}
      onChange={ricarica}
      aggiornaCategoria={updateInventoryCategory}
      creaCategoria={createInventoryCategory}
      macroDiVendita={macroMenu}
    />
  )
}

// I MOVIMENTI HANNO UNA SEZIONE LORO. Stavano in fondo alla lista dei
// prodotti dietro un tasto largo quanto lo schermo: fuori contesto (non
// sono un prodotto), e in mezzo ai piedi a chi cercava una bottiglia.
function MovimentiPanel() {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchStockMovements({ limit: 100 })
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="empty">Carico i movimenti…</div>
  if (movements.length === 0) return <div className="empty">Ancora nessun movimento.</div>
  return (
    <div className="card inv-movimenti">
      {movements.map((m) => (
        <div className="row between" key={m.id}>
          <span className="muted small">
            {m.type === 'load' ? '⬆' : '⬇'} {m.item_name} · {m.reason}
          </span>
          <span className="muted small">
            {m.type === 'load' ? '+' : '−'}
            {formatQty(m.qty, m.unit)}
          </span>
        </div>
      ))}
    </div>
  )
}

function FornitoriPanel() {
  const [suppliers, setSuppliers] = useState([])
  const ricarica = async () => setSuppliers(await fetchSuppliers())
  useEffect(() => {
    ricarica()
  }, [])
  return <SupplierManager suppliers={suppliers} onChange={ricarica} />
}

// LA CELLA «A FINE SERATA». Si legge con le stesse regole della giacenza —
// pezzi per le bottiglie, unità per il resto — perché è la stessa cosa
// guardata più avanti nel tempo: due modi di scrivere lo stesso numero
// farebbero sembrare due dati diversi. Senza impegno resta un trattino:
// vuol dire che nessun conto aperto ha chiesto quel prodotto.
function CellaFineSerata({ item, impegnato }) {
  const previsto = articoloPrevisto(item, impegnato)
  if (!previsto) return <span className="inv-cell-num muted">—</span>
  const bs = bottleSummary(previsto)
  const finito = (Number(previsto.stock) || 0) <= 0
  return (
    <span className={`inv-cell-num inv-row-previsto${finito ? ' finito' : ''}`}>
      {bs ? `${formatPezzi(bs.pezzi)} pz` : fmtItem(previsto.stock, previsto)}
    </span>
  )
}

// La stessa previsione nella vista a CARD, dove non ci sono colonne: si
// scrive per esteso sotto la giacenza, e solo se quel prodotto è in ballo.
function PrevisioneCard({ item, impegnato }) {
  const previsto = articoloPrevisto(item, impegnato)
  if (!previsto) return null
  const bs = bottleSummary(previsto)
  const finito = (Number(previsto.stock) || 0) <= 0
  return (
    <span
      className={`small${finito ? ' inv-row-previsto finito' : ' muted'}`}
      style={{ display: 'block' }}
    >
      a fine serata {bs ? `${formatPezzi(bs.pezzi)} pz` : fmtItem(previsto.stock, previsto)}
    </span>
  )
}

function ProductsPanel() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null) // null | 'new' | item

  // Filtri
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  // Assortimento: si possono tenere accesi PIÙ valori insieme (linea +
  // premium, linea + out…). Vuoto = si vede tutto.
  const [assortimenti, setAssortimenti] = useState([])
  const toggleAssortimento = (k) =>
    setAssortimenti((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  // Riga espansa + carico in corso
  const [invView, setInvView] = useState('lista') // 'lista' | 'card' — default LISTA
  // Ordinamento della tabella: click sull'intestazione, ri-click inverte.
  const [sort, setSort] = useState({ col: 'name', dir: 'asc' })
  const toggleSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  const [expandedId, setExpandedId] = useState(null)
  const [caricoFor, setCaricoFor] = useState(null)
  const [rettificaFor, setRettificaFor] = useState(null)

  // QUELLO CHE TI RITROVI A FINE SERATA. I conti ancora aperti hanno già
  // promesso degli ingredienti: si guardano gli ordini e il listino e si
  // toglie dalla giacenza quello che il magazzino non ha ancora scalato.
  // A cassa chiusa la colonna non c'è: non c'è una serata in corso di cui
  // dire come finirà.
  const { open: cassaAperta } = useCashSession()
  // Con gli stati del servizio un conto pagato ma non servito è ancora
  // aperto, e i suoi ingredienti sono ancora in ballo; senza, il pagamento
  // chiude e il magazzino è già stato scalato.
  const [workflowOn, setWorkflowOn] = useState(DEFAULT_SETTINGS.workflow_enabled !== false)
  const [ordiniVivi, setOrdiniVivi] = useState([])
  const [drinksById, setDrinksById] = useState({})
  useEffect(() => subscribeActiveOrders(setOrdiniVivi, () => {}), [])
  useEffect(
    () =>
      subscribeDrinks(
        {},
        (ds) => setDrinksById(Object.fromEntries(ds.map((d) => [d.id, d]))),
        () => {}
      ),
    []
  )
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])
  const impegnato = useMemo(
    () =>
      cassaAperta
        ? impegnatoPerArticolo(ordiniVivi, drinksById, itemsById, { workflowOn })
        : {},
    [cassaAperta, ordiniVivi, drinksById, itemsById, workflowOn]
  )
  // La colonna compare solo se c'è davvero qualcosa in ballo: a serata
  // ferma sarebbe una colonna di trattini.
  const mostraPrevisione = Object.keys(impegnato).length > 0

  // Ricarico (×N) per il prezzo consigliato mostrato accanto al costo.
  const [markup, setMarkup] = useState(DEFAULT_SETTINGS.price_markup)
  // IVA di ACQUISTO (fatture fornitore, 22%): è il default dei prodotti qui.
  const [purchaseVat, setPurchaseVat] = useState(DEFAULT_SETTINGS.purchase_vat)
  useEffect(
    () =>
      subscribeSettings((s) => {
        setWorkflowOn(s.workflow_enabled !== false)
        setMarkup(s.price_markup)
        setPurchaseVat(s.purchase_vat ?? DEFAULT_SETTINGS.purchase_vat)
      }, () => {}),
    []
  )

  const catName = (id) => categories.find((c) => c.id === id)?.name
  const supName = (id) => suppliers.find((s) => s.id === id)?.name

  async function load() {
    setLoading(true)
    try {
      const [its, cats, sups] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryCategories().catch(() => []),
        fetchSuppliers().catch(() => []),
      ])
      setItems(its)
      setCategories(cats)
      setSuppliers(sups)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const summary = useMemo(() => inventorySummary(items), [items])
  const totalValue = useMemo(() => inventoryTotalValue(items), [items])
  // Blocco azioni espanse di un item, condiviso dalla vista a CARD e dalla
  // vista a LISTA: carico, rettifica, costi e modifica/elimina.
  const itemActions = (it, bd) => (
    <div className="grid-card-actions">
      <dl className="inv-info">
        {impegnato[it.id] > 0 && (
          <div className="inv-info-row">
            <dt>A fine serata</dt>
            <dd>
              {/* Il numero da solo non basta: chi legge vuole sapere
                  QUANTO è promesso, per capire se vale la pena aprire
                  un'altra bottiglia adesso o aspettare. */}
              <strong>
                {(() => {
                  const p = articoloPrevisto(it, impegnato[it.id])
                  const bs = bottleSummary(p)
                  return bs ? `${formatPezzi(bs.pezzi)} pz` : fmtItem(p.stock, p)
                })()}
              </strong>
              <span className="muted">
                {' · '}
                {fmtItem(impegnato[it.id], it)} sui conti ancora aperti
              </span>
            </dd>
          </div>
        )}
        {bd ? (
          <div className="inv-info-row">
            <dt>Pezzi</dt>
            <dd>
              <strong>{formatPezzi(pezziInGiacenza(it))} pz</strong>
              {' · '}
              {bd.full} piene
              {bd.hasOpen && ` · 1 aperta (${fmtContenuto(bd.openRemaining, it)})`}
              {bd.finished > 0 && ` · ${bd.finished} finite`}
              {/* Il contenuto in cl (o g): un pezzo è la bottiglia, dentro
                  non ci sono pezzi. */}
              <span className="muted"> · 1 pz = {fmtContenuto(it.package_size, it)}</span>
            </dd>
          </div>
        ) : (
          Number(it.package_size) > 0 && (
            <div className="inv-info-row">
              <dt>Confezione</dt>
              <dd>
                {it.unit === 'pz' ? (
                  <>1 pz = {formatIn(it.package_size, it.content_unit === 'g' ? 'g' : 'cl')}</>
                ) : (
                  <>1 conf. = {fmtItem(it.package_size, it)}</>
                )}
              </dd>
            </div>
          )
        )}
        {Number(it.low_threshold) > 0 && (
          <div className="inv-info-row">
            <dt>Soglia avviso</dt>
            <dd>{fmtItem(it.low_threshold, it)}</dd>
          </div>
        )}
        {it.cost != null && (
          <>
            <div className="inv-info-row">
              <dt>💶 Costo</dt>
              <dd>
                {formatPrice(it.cost)}/conf. <span className="muted">(+IVA {formatPrice(costWithVat(it.cost, it.vat))})</span>
                {' · valore '}<strong>{formatPrice(stockValue(it))}</strong>
              </dd>
            </div>
            <UnitPrice item={it} markup={markup} />
          </>
        )}
      </dl>

      {caricoFor === it.id ? (
        <CaricoForm item={it} onCancel={() => setCaricoFor(null)} onConfirm={(p) => doCarico(it, p)} />
      ) : rettificaFor === it.id ? (
        <RettificaForm
          item={it}
          onCancel={() => setRettificaFor(null)}
          onConfirm={(baseQty) => rettifica(it, baseQty)}
        />
      ) : (
        <>
          <button className="btn small block" style={{ marginTop: 8 }} onClick={() => setCaricoFor(it.id)}>
            ⬆ Carico
          </button>
          <button
            className="btn secondary small block"
            style={{ marginTop: 6 }}
            onClick={() => {
              setCaricoFor(null)
              setRettificaFor(it.id)
            }}
          >
            Contenuto reale
          </button>
          {/* Tre azioni sulla stessa riga: si modifica, si duplica, si
              elimina. DUPLICA sta in mezzo perché è la via di mezzo — un
              prodotto quasi uguale a questo — e a fianco dell'elimina si
              ragiona due volte prima di premere. */}
          <div className="inv-azioni" style={{ marginTop: 6 }}>
            <button className="btn ghost small" onClick={() => setEditing(it)}>✏️ Modifica</button>
            <button className="btn ghost small" onClick={() => duplica(it)}>⧉ Duplica</button>
            <button className="btn ghost small" onClick={() => remove(it)}>🗑 Elimina</button>
          </div>
        </>
      )}
    </div>
  )

  const visible = useMemo(
    () =>
      filterItems(items, {
        query,
        categoryId: categoryFilter,
        supplierId: supplierFilter,
        status: statusFilter,
        assortimenti,
      }),
    [items, query, categoryFilter, supplierFilter, statusFilter, assortimenti]
  )

  // Righe ordinate per la TABELLA: testo in ordine alfabetico, numeri per
  // valore. I valori mancanti finiscono sempre in fondo, in entrambi i versi.
  const sortedVisible = useMemo(() => {
    const val = (it) => {
      switch (sort.col) {
        case 'cat': return catName(it.category_id) || ''
        case 'net': return it.cost != null ? Number(it.cost) : null
        case 'gross': return it.cost != null ? costWithVat(it.cost, it.vat) : null
        case 'percl': return costPerUnit(it, 'cl')
        case 'stock': return Number(it.stock) || 0
        case 'previsto': return (Number(it.stock) || 0) - (impegnato[it.id] || 0)
        default: return it.name || ''
      }
    }
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...visible].sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const xMissing = x == null || x === ''
      const yMissing = y == null || y === ''
      if (xMissing && yMissing) return 0
      if (xMissing) return 1 // i vuoti restano in fondo
      if (yMissing) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * mul
      return String(x).localeCompare(String(y), 'it') * mul
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort, categories, impegnato])

  // Conteggi per categoria (su tutto l'inventario) per la barra a sinistra.
  const catItems = useMemo(() => {
    let none = 0
    const per = {}
    for (const it of items) {
      if (it.category_id) per[it.category_id] = (per[it.category_id] || 0) + 1
      else none += 1
    }
    return [
      { key: 'all', label: 'Tutte', count: items.length },
      ...categories.map((c) => ({ key: c.id, label: c.name, count: per[c.id] || 0 })),
      ...(none ? [{ key: 'none', label: 'Senza categoria', count: none }] : []),
    ]
  }, [items, categories])

  async function handleSave(payload) {
    setError(null)
    try {
      if (editing && editing !== 'new') {
        await updateInventoryItem(editing.id, payload)
      } else {
        await createInventoryItem(payload)
      }
      setEditing(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function doCarico(item, { count, open, newCost }) {
    setError(null)
    try {
      if (count > 0 || open > 0) {
        if (item.unit === 'pz') await loadStock(item.id, count)
        else await receiveBottles(item.id, count, open)
      }
      // Prezzo aggiornato al carico (il fornitore ha cambiato tariffa).
      if (newCost != null) await updateInventoryItem(item.id, { cost: newCost })
      setCaricoFor(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // Contenuto reale: la quantità arriva GIÀ convertita in unità base dal form
  // (che lavora in cl per i liquidi, come il bartender conta le bottiglie).
  async function rettifica(item, baseQty) {
    setError(null)
    try {
      await adjustStock(item.id, baseQty)
      setRettificaFor(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // DUPLICA: lo stesso prodotto con un altro nome, da correggere. Al banco
  // il magazzino è pieno di quasi-uguali — stessa bottiglia in due formati,
  // lo stesso amaro di un altro fornitore — e rifarli da zero vuol dire
  // ribattere costo, confezione, categoria, soglia e IVA.
  //
  // La copia nasce con la GIACENZA A ZERO e senza storia di carichi: è un
  // prodotto nuovo che non è mai entrato in magazzino. Copiare anche le
  // scorte vorrebbe dire inventarsi bottiglie che non ci sono.
  async function duplica(item) {
    try {
      const copia = await createInventoryItem(copiaProdotto(item))
      setItems((prev) => [...prev, copia])
      // Si apre subito la scheda: il nome «(copia)» va cambiato, ed è il
      // motivo per cui si sta duplicando.
      setEditing(copia)
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(item) {
    if (!confirm(`Eliminare "${item.name}" dal magazzino?`)) return
    try {
      await deleteInventoryItem(item.id)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (editing) {
    return (
      <ItemForm
        initial={editing === 'new' ? null : editing}
        categories={categories}
        suppliers={suppliers}
        defaultVat={purchaseVat}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    )
  }

  // Cosa dice il tasto della tendina: una tendina che non dice cosa è
  // scelto costringe ad aprirla per ricordarselo.
  const nomiStato = { all: null, low: 'In esaurimento', empty: 'Esauriti' }
  const sceltiOra = [nomiStato[statusFilter], ...assortimenti.map((k) => ASSORTIMENTO_NOME[k])]
    .filter(Boolean)
  const riassuntoFiltri =
    sceltiOra.length === 0
      ? '⚗️ Filtra'
      : sceltiOra.length === 1
        ? `⚗️ ${sceltiOra[0]}`
        : `⚗️ ${sceltiOra.length} filtri`

  return (
    <div className="inv-panel">
      {/* LA TESTATA: ricerca, e sotto le scelte che stanno ferme quasi
          sempre. I filtri erano sette pastiglie sempre aperte — una riga di
          schermo occupata tutto il giorno per una scelta che si cambia due
          volte a sera — più una riga per i fornitori, una per il tasto
          nuovo prodotto e una per card/lista: quattro righe prima di vedere
          un prodotto. Ora stanno in due tendine e due icone, su una riga, e
          il tasto dice cosa è scelto senza doverlo aprire. */}
      <input
        className="inv-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Cerca prodotto…"
      />

      <div className="inv-testa">
        <Tendina
          etichetta="Filtra i prodotti"
          attivo={statusFilter !== 'all' || assortimenti.length > 0}
          riassunto={riassuntoFiltri}
        >
          <div className="tendina-titolo">Come stanno a scorta</div>
          {[
            ['all', 'Tutti', summary.total],
            ['low', 'In esaurimento', summary.low],
            ['empty', 'Esauriti', summary.empty],
          ].map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              className={`tendina-voce${statusFilter === k ? ' scelta' : ''}`}
              onClick={() => setStatusFilter(k)}
            >
              <span>{label}</span>
              <strong>{n}</strong>
            </button>
          ))}
          <div className="tendina-titolo">Assortimento</div>
          {ASSORTIMENTI.map((k) => {
            const quanti = items.filter((it) => assortimentoDi(it) === k).length
            return (
              <button
                key={k}
                type="button"
                className={`tendina-voce${assortimenti.includes(k) ? ' scelta' : ''}`}
                onClick={() => toggleAssortimento(k)}
                title={ASSORTIMENTO_TITOLO[k]}
              >
                <span>{ASSORTIMENTO_LABEL[k]}</span>
                <strong>{quanti}</strong>
              </button>
            )
          })}
          {(assortimenti.length > 0 || statusFilter !== 'all') && (
            <button
              type="button"
              className="btn ghost small block"
              style={{ marginTop: 6 }}
              onClick={() => {
                setAssortimenti([])
                setStatusFilter('all')
              }}
            >
              ✕ Togli i filtri
            </button>
          )}
        </Tendina>

        {suppliers.length > 0 && (
          <Tendina
            etichetta="Fornitore"
            attivo={supplierFilter !== 'all'}
            riassunto={
              supplierFilter === 'all'
                ? '🏭 Fornitore'
                : `🏭 ${suppliers.find((x) => x.id === supplierFilter)?.name || 'Fornitore'}`
            }
          >
            {(chiudi) => (
              <>
                <button
                  type="button"
                  className={`tendina-voce${supplierFilter === 'all' ? ' scelta' : ''}`}
                  onClick={() => {
                    setSupplierFilter('all')
                    chiudi()
                  }}
                >
                  <span>Tutti i fornitori</span>
                </button>
                {suppliers.map((sup) => (
                  <button
                    key={sup.id}
                    type="button"
                    className={`tendina-voce${supplierFilter === sup.id ? ' scelta' : ''}`}
                    onClick={() => {
                      setSupplierFilter(sup.id)
                      chiudi()
                    }}
                  >
                    <span>{sup.name}</span>
                  </button>
                ))}
              </>
            )}
          </Tendina>
        )}

        {/* Un numero senza nome non vuol dire niente: si legge «6.823,82 €»
            e ci si chiede di cosa. */}
        <span className="inv-valore" title="Somma del costo di tutto quello che c'è in magazzino">
          💶 <span className="inv-valore-eti">Valore magazzino</span>{' '}
          <strong>{formatPrice(totalValue)}</strong>
        </span>

        <span className="inv-testa-spinta" />

        {/* Card o lista: due icone, non due tasti con su scritto cosa fanno.
            È una scelta che si fa una volta e resta. */}
        <div className="inv-vista" role="group" aria-label="Come mostrare i prodotti">
          {[
            ['card', '▦', 'A card'],
            ['lista', '☰', 'A lista'],
          ].map(([k, icona, titolo]) => (
            <button
              key={k}
              type="button"
              className={`chip${invView === k ? ' active' : ''}`}
              onClick={() => setInvView(k)}
              title={titolo}
              aria-label={titolo}
              aria-pressed={invView === k}
            >
              {icona}
            </button>
          ))}
        </div>

        <button className="btn small" onClick={() => setEditing('new')}>
          + Nuovo prodotto
        </button>
      </div>

      {/* Categorie a SINISTRA (come il POS), il resto a destra. Si prende
          quello che resta dell'altezza: a scorrere è la lista dei prodotti,
          non la pagina — prima, per tornare alla ricerca dopo aver guardato
          in fondo, si risaliva da capo. */}
      <CategoryRail
        items={catItems}
        selected={categoryFilter}
        onSelect={setCategoryFilter}
        pieno
        chiave="inv-categorie"
      >

      {error && <div className="banner" style={{ marginTop: 8 }}>Errore: {error}</div>}
      {loading && <div className="empty">Carico l’inventario…</div>}

      {/* TABELLA: colonne allineate (stato · prodotto · categoria · netto ·
          +IVA · scorte), riga cliccabile per aprire le azioni. */}
      {invView === 'lista' && (
        <div className={`inv-list inv-table${mostraPrevisione ? ' con-previsione' : ''}`}>
          <div className="inv-thead">
            <span aria-hidden />
            <SortTh label="Prodotto" col="name" sort={sort} onSort={toggleSort} />
            <SortTh label="Categoria" col="cat" sort={sort} onSort={toggleSort} />
            <SortTh label="IVA esclusa" col="net" sort={sort} onSort={toggleSort} num />
            <SortTh label="IVA inclusa" col="gross" sort={sort} onSort={toggleSort} num />
            <SortTh label="€/cl" col="percl" sort={sort} onSort={toggleSort} num />
            <SortTh label="Scorte" col="stock" sort={sort} onSort={toggleSort} num />
            {mostraPrevisione && (
              <SortTh label="A fine serata" col="previsto" sort={sort} onSort={toggleSort} num />
            )}
          </div>
          {sortedVisible.map((it) => {
            const st = stockStatus(it)
            const expanded = expandedId === it.id
            const bs = bottleSummary(it)
            const perCl = costPerUnit(it, 'cl') // già IVA inclusa
            return (
              /* DUE SEGNI, DUE COSE. Il PALLINO dice quanta roba c'è
                 (verde/arancione/rosso), la STRISCIA che assortimento è —
                 in linea, premium, in assortimento, fuori. Prima dicevano
                 tutti e due la stessa cosa, e l'assortimento si leggeva
                 solo dai bollini accanto al nome. */
              <div
                className={`inv-row ass-${assortimentoDi(it)}${expanded ? ' open' : ''}`}
                key={it.id}
              >
                <button
                  type="button"
                  className="inv-row-main"
                  onClick={() => {
                    setExpandedId(expanded ? null : it.id)
                    setCaricoFor(null)
                  }}
                >
                  <span className={`dot dot-${st}`} />
                  <span className="inv-row-name">
                    {it.name}
                    <SegnoAssortimento item={it} />
                  </span>
                  <span className="muted small inv-row-cat">{catName(it.category_id) || '—'}</span>
                  <span className="inv-cell-num">{it.cost != null ? formatPrice(it.cost) : '—'}</span>
                  <span className="inv-cell-num muted">{it.cost != null ? formatPrice(costWithVat(it.cost, it.vat)) : '—'}</span>
                  <span className="inv-cell-num muted">{perCl != null ? formatPrice(perCl) : '—'}</span>
                  <span className="inv-cell-num inv-row-stock">
                    {bs ? (
                      <>
                        {/* SOLO IL NUMERO. «piena / aperta 46 cl /
                            esaurito» raccontava lo stato della bottiglia,
                            che col conteggio a pezzi è già nel numero:
                            «0,5 pz» dice da sé che è mezza, «0 pz» che è
                            finita. Il dettaglio delle bottiglie resta
                            aperto sotto, per chi va a contarle. */}
                        {formatPezzi(bs.pezzi)} pz
                      </>
                    ) : (
                      fmtItem(it.stock, it)
                    )}
                  </span>
                  {mostraPrevisione && <CellaFineSerata item={it} impegnato={impegnato[it.id]} />}
                </button>
                {expanded && itemActions(it, bottleBreakdown(it))}
              </div>
            )
          })}
        </div>
      )}

      {/* Card compatte in griglia (stessa UX delle card ordini): striscia
          colorata per lo stato scorte, dettagli e azioni a scomparsa. */}
      {invView === 'card' && (
      <div className="admin-grid">
        {visible.map((it) => {
          const st = stockStatus(it)
          const expanded = expandedId === it.id
          return (
            <div className={`card grid-card admin-card ass-${assortimentoDi(it)}`} key={it.id}>
              <div
                className="grid-card-main"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setExpandedId(expanded ? null : it.id)
                  setCaricoFor(null)
                }}
              >
                <div className="row between" style={{ alignItems: 'flex-start', gap: 6 }}>
                  <strong style={{ fontSize: '0.92rem', lineHeight: 1.25 }}>
                    {it.name} <SegnoAssortimento item={it} />
                  </strong>
                  <span className={`dot dot-${st}`} title={STATUS_LABEL[st] || 'ok'} />
                </div>
                <div className="row between" style={{ alignItems: 'baseline' }}>
                  <span className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {catName(it.category_id) || 'Senza categoria'}
                    {supName(it.supplier_id) ? ` · ${supName(it.supplier_id)}` : ''}
                  </span>
                  {(() => {
                    // Item da drink: bottiglie (pezzi) come numero grande, il
                    // CONTENUTO in cl/ml sotto — totale e residuo dell'aperta.
                    const bs = bottleSummary(it)
                    return (
                      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span className="grid-card-tot" style={{ fontSize: '1.05rem' }}>
                          {bs ? `${formatPezzi(bs.pezzi)} pz` : fmtItem(it.stock, it)}
                        </span>
                        {bs && (
                          <span className="muted small" style={{ display: 'block' }}>
                            {bs.total}
                          </span>
                        )}
                        <PrevisioneCard item={it} impegnato={impegnato[it.id]} />
                      </span>
                    )
                  })()}
                </div>
              </div>
              <button
                type="button"
                className="grid-card-toggle"
                onClick={() => {
                  setExpandedId(expanded ? null : it.id)
                  setCaricoFor(null)
                }}
                aria-expanded={expanded}
              >
                {expanded ? '▴ Chiudi' : '⋯ Azioni'}
              </button>
              {expanded && itemActions(it, bottleBreakdown(it))}
            </div>
          )
        })}
      </div>
      )}

      {!loading && items.length === 0 && (
        <div className="empty">Nessun prodotto in inventario. Aggiungine uno!</div>
      )}
      {!loading && items.length > 0 && visible.length === 0 && (
        <div className="empty">Nessun prodotto corrisponde ai filtri.</div>
      )}

      </CategoryRail>

    </div>
  )
}

// --- Gestione categorie inventario --------------------------------------

function InvCategoryManager({ categories, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createInventoryCategory({ name: name.trim(), sort_order: categories.length })
      setName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }
  async function rename(c) {
    const n = prompt('Nuovo nome categoria:', c.name)
    if (n == null || !n.trim()) return
    await updateInventoryCategory(c.id, { name: n.trim() })
    await onChange()
  }
  async function remove(c) {
    if (!confirm(`Eliminare la categoria “${c.name}”? I prodotti resteranno, senza categoria.`)) return
    await deleteInventoryCategory(c.id)
    await onChange()
  }
  async function move(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= categories.length) return
    const a = categories[idx]
    const b = categories[j]
    await Promise.all([
      updateInventoryCategory(a.id, { sort_order: b.sort_order }),
      updateInventoryCategory(b.id, { sort_order: a.sort_order }),
    ])
    await onChange()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuova categoria (es. Distillati)" />
        <button className="btn small" onClick={add} disabled={busy}>Aggiungi</button>
      </div>
      {categories.length === 0 && (
        <div className="muted small" style={{ marginTop: 8 }}>Nessuna categoria.</div>
      )}
      {categories.map((c, idx) => (
        <div className="row between" key={c.id} style={{ marginTop: 8 }}>
          <span>{c.name}</span>
          <span className="row" style={{ gap: 4 }}>
            <button className="btn ghost small" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
            <button className="btn ghost small" onClick={() => move(idx, 1)} disabled={idx === categories.length - 1}>↓</button>
            <button className="btn ghost small" onClick={() => rename(c)}>✏️</button>
            <button className="btn ghost small" onClick={() => remove(c)}>🗑</button>
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Gestione fornitori --------------------------------------------------

function SupplierManager({ suppliers, onChange }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  // Import in blocco (es. dall'Excel): un fornitore per riga, ";email"
  // opzionale. I nomi già presenti vengono saltati.
  async function importList() {
    const rows = parseSupplierList(importText)
    if (rows.length === 0) return
    setBusy(true)
    try {
      const existing = new Set(suppliers.map((s) => s.name.toLowerCase()))
      let added = 0
      for (const r of rows) {
        if (existing.has(r.name.toLowerCase())) continue
        await createSupplier({
          name: r.name,
          sort_order: suppliers.length + added,
          ...(r.email ? { email: r.email } : {}),
        })
        added += 1
      }
      toastSuccess(`Importati ${added} fornitori${rows.length - added > 0 ? ` (${rows.length - added} già presenti)` : ''}`)
      setImportText('')
      setShowImport(false)
      await onChange()
    } catch (e) {
      toastError(`Import fornitori: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createSupplier({ name: name.trim(), sort_order: suppliers.length })
      setName('')
      await onChange()
    } finally {
      setBusy(false)
    }
  }
  async function rename(s) {
    const n = prompt('Nuovo nome fornitore:', s.name)
    if (n == null || !n.trim()) return
    await updateSupplier(s.id, { name: n.trim() })
    await onChange()
  }
  // Email per l'invio degli ordini d'acquisto (bottone 📧 negli Ordini).
  async function setEmail(s) {
    const e = prompt(`Email di ${s.name} (per inviare gli ordini):`, s.email || '')
    if (e == null) return
    await updateSupplier(s.id, { email: e.trim() || null })
    await onChange()
  }
  async function remove(s) {
    if (!confirm(`Eliminare il fornitore “${s.name}”? I prodotti resteranno, senza fornitore.`)) return
    await deleteSupplier(s.id)
    await onChange()
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuovo fornitore (es. NOVA)" />
        <button className="btn small" onClick={add} disabled={busy}>Aggiungi</button>
      </div>
      <button
        className="btn ghost small block"
        style={{ marginTop: 8 }}
        onClick={() => setShowImport((v) => !v)}
      >
        📥 Importa elenco (incolla, uno per riga)
      </button>
      {showImport && (
        <div style={{ marginTop: 6 }}>
          <textarea
            rows={5}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'NOVA' + String.fromCharCode(10) + 'ENOFEL;ordini@enofel.it' + String.fromCharCode(10) + 'FONT'}
            style={{ width: '100%' }}
          />
          <button className="btn small block" style={{ marginTop: 6 }} disabled={busy} onClick={importList}>
            Importa
          </button>
        </div>
      )}
      {suppliers.length === 0 && (
        <div className="muted small" style={{ marginTop: 8 }}>Nessun fornitore.</div>
      )}
      {suppliers.map((s) => (
        <div className="row between" key={s.id} style={{ marginTop: 8 }}>
          <span>
            {s.name}
            {s.email && <span className="muted small"> · {s.email}</span>}
          </span>
          <span className="row" style={{ gap: 4 }}>
            <button className="btn ghost small" title="Email per gli ordini" onClick={() => setEmail(s)}>📧</button>
            <button className="btn ghost small" onClick={() => rename(s)}>✏️</button>
            <button className="btn ghost small" onClick={() => remove(s)}>🗑</button>
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Contenuto reale (rettifica giacenza) -------------------------------
// Si lavora nell'unità con cui si conta davvero: CL per i liquidi (non ml),
// g per i solidi, pz per i pezzi. Il valore si converte in unità base solo
// al salvataggio.
function RettificaForm({ item, onCancel, onConfirm }) {
  const units = smallUnits(item)
  const [unit, setUnit] = useState(units[0])
  const [val, setVal] = useState(() => String(fromBaseQty(Number(item.stock) || 0, units[0])))

  function changeUnit(u) {
    // Mantiene la quantità reale, cambiando solo come la si esprime.
    const base = toBaseQty(Number(String(val).replace(',', '.')) || 0, unit)
    setUnit(u)
    setVal(String(fromBaseQty(base, u)))
  }
  function confirm() {
    const n = Number(String(val).replace(',', '.'))
    if (Number.isNaN(n) || n < 0) return
    onConfirm(toBaseQty(n, unit))
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor={`rt-${item.id}`}>Contenuto effettivo di “{item.name}”</label>
      <div className="row" style={{ gap: 6 }}>
        <input
          id={`rt-${item.id}`}
          type="number"
          step="any"
          min="0"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          style={{ flex: 1 }}
        />
        {units.length > 1 ? (
          <select value={unit} onChange={(e) => changeUnit(e.target.value)} style={{ width: 80 }}>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        ) : (
          <span className="chip" style={{ cursor: 'default' }}>{unit}</span>
        )}
      </div>
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        Quantità totale in giacenza dopo la conta (sostituisce quella attuale).
      </p>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="btn ghost small" onClick={onCancel}>Annulla</button>
        <button className="btn small" onClick={confirm}>Salva contenuto</button>
      </div>
    </div>
  )
}

// --- Form di carico -----------------------------------------------------

function CaricoForm({ item, onCancel, onConfirm }) {
  const [count, setCount] = useState('')
  const [open, setOpen] = useState('')
  const isPz = item.unit === 'pz'
  const size = Number(item.package_size) || 0

  // Costo al carico (bidirezionale): il fornitore spesso scarica il prezzo del
  // COLLO/CARTONE. Si inserisce l'unitario OPPURE il totale del collo (sapendo
  // quanti pezzi ci sono) e l'altro si ricalcola. Il "pezzi per collo" è solo
  // per il calcolo, non viene salvato.
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
  const num = (v) => Number(String(v).replace(',', '.')) || 0
  const [unitCost, setUnitCost] = useState(item.cost != null ? String(item.cost) : '')
  const [perCollo, setPerCollo] = useState('')
  const [colloTot, setColloTot] = useState('')
  // Quanti cartoni si stanno caricando: i pezzi li riempie lui.
  const [cartoni, setCartoni] = useState('')

  const onUnit = (v) => {
    setUnitCost(v)
    const p = num(perCollo)
    if (p > 0) setColloTot(num(v) > 0 ? String(r2(num(v) * p)) : '')
  }
  const onCartoni = (v) => {
    setCartoni(v)
    const p = num(perCollo)
    if (p > 0) setCount(num(v) > 0 ? String(num(v) * p) : '')
  }
  const onCollo = (v) => {
    setPerCollo(v)
    const p = num(v)
    // Cambiando quanti pezzi ha il cartone, i pezzi si rifanno: se no
    // resterebbe il conto vecchio, e si caricherebbe la quantità sbagliata.
    if (p > 0 && num(cartoni) > 0) setCount(String(num(cartoni) * p))
    if (p <= 0) return
    if (num(unitCost) > 0) setColloTot(String(r2(num(unitCost) * p)))
    else if (num(colloTot) > 0) setUnitCost(String(r2(num(colloTot) / p)))
  }
  const onTot = (v) => {
    setColloTot(v)
    const p = num(perCollo)
    if (p > 0) setUnitCost(num(v) > 0 ? String(r2(num(v) / p)) : '')
  }

  const unitN = num(unitCost)
  const perN = num(perCollo)

  function confirm() {
    const n = num(count)
    const openQty = num(open)
    const hasQty = isPz ? n > 0 : n > 0 || openQty > 0
    const newCost = unitCost !== '' && unitN >= 0 && r2(unitN) !== Number(item.cost) ? r2(unitN) : null
    if (!hasQty && newCost == null) return
    onConfirm({ count: n, open: isPz ? 0 : openQty, newCost })
  }

  return (
    <div style={{ marginTop: 8 }}>
      {isPz ? (
        <>
          {/* CARTONI → PEZZI. Il fornitore consegna cartoni, il magazzino
              conta bottiglie: dicendo quanti pezzi ha un cartone, i pezzi
              si riempiono da sé. Chi carica bottiglie sfuse lascia il
              cartone vuoto e scrive i pezzi, come sempre. */}
          {perN > 0 && (
            <>
              <label htmlFor="cf-cartoni">Quanti cartoni? (1 cartone = {perN} pz)</label>
              <input
                id="cf-cartoni"
                type="number"
                step="1"
                min="0"
                value={cartoni}
                onChange={(e) => onCartoni(e.target.value)}
                placeholder="Es. 2"
              />
            </>
          )}
          <label style={perN > 0 ? { marginTop: 8 } : undefined}>Quanti pezzi aggiungi?</label>
          <input type="number" step="1" min="0" value={count} onChange={(e) => setCount(e.target.value)} autoFocus />
          {perN > 0 && num(cartoni) > 0 && (
            <div className="muted small" style={{ marginTop: 4 }}>
              {num(cartoni)} × {perN} = <strong>{num(cartoni) * perN} pz</strong>
            </div>
          )}
        </>
      ) : (
        <>
          <label>Quante confezioni piene? (1 conf. = {formatQty(size, item.unit)})</label>
          <input type="number" step="1" min="0" value={count} onChange={(e) => setCount(e.target.value)} autoFocus />
          <label style={{ marginTop: 8 }}>Bottiglia aperta — contenuto ({item.unit}) — opzionale</label>
          <input type="number" step="any" min="0" value={open} onChange={(e) => setOpen(e.target.value)} placeholder="Es. 400 se ne aggiungi una già aperta" />
        </>
      )}

      {/* Prezzo: unitario ↔ totale collo (per confrontare col fornitore) */}
      <div className="card" style={{ marginTop: 10, padding: 10 }}>
        <div className="muted small">💶 Prezzo — aggiorna se il fornitore l'ha cambiato</div>
        <div className="grid-2" style={{ marginTop: 6 }}>
          <div>
            <label htmlFor="cf-unit">Costo unitario (€, netto)</label>
            <input id="cf-unit" type="number" step="any" min="0" value={unitCost} onChange={(e) => onUnit(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cf-collo">Pezzi per collo/cartone</label>
            <input id="cf-collo" type="number" step="any" min="0" value={perCollo} onChange={(e) => onCollo(e.target.value)} placeholder="Es. 24" />
          </div>
        </div>
        <label htmlFor="cf-tot" style={{ marginTop: 6 }}>Totale collo (€, netto)</label>
        <input id="cf-tot" type="number" step="any" min="0" value={colloTot} onChange={(e) => onTot(e.target.value)} placeholder="Prezzo del cartone dal fornitore" />
        {unitN > 0 && (
          <div className="muted small" style={{ marginTop: 4 }}>
            Unitario +IVA {formatPrice(costWithVat(unitN, item.vat))}
            {perN > 0 && ` · Totale collo +IVA ${formatPrice(costWithVat(unitN * perN, item.vat))}`}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="btn ghost small" onClick={onCancel}>Annulla</button>
        <button className="btn small" onClick={confirm}>Conferma carico</button>
      </div>
    </div>
  )
}

// --- Form prodotto (creazione + modifica) -------------------------------

// ── COME SI COMPILA UNA SCHEDA PRODOTTO ──────────────────────────────
//
// Tre domande, sempre le stesse (REQ-MAG-016). Il testo è asciutto di
// proposito: chi lo apre sta compilando, non leggendo — deve trovare la
// definizione e l'esempio, e chiudere.
function AiutoProdotto({ onClose }) {
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box"
        role="dialog"
        aria-label="Come si compila questa scheda"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Come si compila</h3>

        <h4 style={{ margin: '14px 0 2px' }}>1 · Come lo compri</h4>
        <p className="small" style={{ margin: 0 }}>
          L&apos;unità in cui conti la giacenza e in cui è espresso il prezzo:
          bottiglia, chilo, litro, sacco.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>2 · Come lo usi in ricetta</h4>
        <p className="small" style={{ margin: 0 }}>
          L&apos;unità con cui lo dosi in un drink: cl, grammi, pezzi, unità.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>3 · Quanto rende</h4>
        <p className="small" style={{ margin: 0 }}>
          Compare solo se le prime due sono diverse. Dice quanto rende una
          unità di quello che compri:
        </p>
        <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          <li>1 bottiglia = 70 cl</li>
          <li>1 kg di limoni = 50 cl di succo</li>
          <li>1 confezione = 10 U</li>
        </ul>
        <p className="small" style={{ margin: '4px 0 0' }}>
          Da questo numero escono lo scarico dal magazzino e il costo di
          quello che si versa. Senza, il costo resta ignoto e la giacenza non
          si scala.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>Unità generiche (U)</h4>
        <p className="small" style={{ margin: 0 }}>
          Per quello che non si versa e non si pesa. In carta non compare.
          Se è una scorta — il ghiaccio — va segnata la casella: si scarica
          come gli altri prodotti. Il tempo di lavorazione no: entra solo nel
          costo del drink.
        </p>

        <button type="button" className="btn block" style={{ marginTop: 16 }} onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  )
}

// Quanto contiene una confezione, letto nell'unità con cui si sta
// compilando: serve a passare dal prezzo della confezione a quello
// dell'unità e viceversa. Zero (o niente) = la confezione è l'unità.
function contenutoInUnita(item, unita) {
  if ((item?.unit || 'pz') === 'pz' || unitaGenerica(item?.unit)) return 0
  const base = Number(item?.package_size) || 0
  return base > 0 ? fromBaseQty(base, unita) : 0
}

// I prezzi si tengono ai centesimi: dividere e rimoltiplicare per il
// contenuto lasciava code di decimali che a schermo si vedevano.
const arrotonda = (n) => Math.round((Number(n) || 0) * 10000) / 10000

function ItemForm({ initial, categories, suppliers, defaultVat = 22, onCancel, onSave }) {
  const isEdit = !!initial
  // Unità scelta dall'utente (L/cl/ml, g/mg, pz). Lo stock è salvato in
  // base (ml/g/pz); i campi si inseriscono e si mostrano nell'unità scelta.
  // Default dei LIQUIDI in cl (non ml): al banco le bottiglie si dosano in cl,
  // quindi contenuto e soglia si inseriscono in cl. Vale anche per gli item
  // vecchi salvati in ml senza unità di visualizzazione.
  const defaultUnit = (base) => (base === 'g' ? 'g' : base === 'pz' ? 'pz' : 'cl')
  const initUnit = initial?.display_unit ?? defaultUnit(initial?.unit)
  const [aiuto, setAiuto] = useState(false)
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    unit: initUnit,
    category_id: initial?.category_id ?? '',
    supplier_id: initial?.supplier_id ?? '',
    // IL COSTO SI SCRIVE NELL'UNITÀ IN CUI SI COMPRA: «2 € al chilo», come
    // lo dice chi ordina. Sotto resta salvato il costo della CONFEZIONE —
    // è quello che usano il costo al cl e gli ordini al fornitore — e la
    // conversione la fa la scheda, non chi la compila. Vedi REQ-MAG-016.
    cost: (() => {
      const c = Number(initial?.cost)
      if (!(c > 0)) return initial?.cost ?? ''
      const contenuto = contenutoInUnita(initial, initUnit)
      return String(contenuto > 0 ? arrotonda(c / contenuto) : c)
    })(),
    vat: initial?.vat ?? defaultVat,
    status: initial?.status ?? 'assortimento',
    package_size:
      initial?.package_size != null && initial?.package_size !== ''
        ? String(fromBaseQty(initial.package_size, initUnit))
        : '',
    // Contenuto di UN pezzo, per gli articoli contati a pezzo: la bottiglia
    // si conta a bottiglie, ma 33 cl li contiene lo stesso — e senza quel
    // numero non esiste un costo al cl.
    content_size:
      initial?.unit === 'pz' && Number(initial?.package_size) > 0
        ? String(fromBaseQty(initial.package_size, initial?.content_unit === 'g' ? 'g' : 'cl'))
        : '',
    content_unit: unitaGenerica(initial?.content_unit)
      ? 'U'
      : initial?.content_unit === 'g'
        ? 'g'
        : 'cl',
    // LA RESA: quanto rende una unità di quello che si compra, quando si usa
    // in un'altra unità (1 kg di limoni = 50 cl di succo). Si scrive
    // nell'unità in cui la si pensa, non in unità base.
    resa_qty:
      Number(initial?.resa) > 0 && initial?.resa_unit
        ? String(
            fromBaseQty(
              Number(initial.resa) * toBaseQty(1, initUnit),
              baseUnit(initial.resa_unit) === 'g' ? 'g' : 'cl'
            )
          )
        : '',
    resa_unit: baseUnit(initial?.resa_unit) === 'g' ? 'g' : 'cl',
    usa_altra_unita: Number(initial?.resa) > 0 && !!initial?.resa_unit,
    // SI SCARICA DAL MAGAZZINO? Lo decide il prodotto: la manodopera no, il
    // ghiaccio — contato a unità come lei — sì. Di suo vale la regola di
    // sempre, così i prodotti già caricati non cambiano comportamento.
    scorta: typeof initial?.scorta === 'boolean' ? initial.scorta : !unitaGenerica(initial?.unit),
    low_threshold: initial?.low_threshold ? String(fromBaseQty(initial.low_threshold, initUnit)) : '',
    // CON CHE UNITÀ SI SCRIVONO QUESTI DUE NUMERI. La soglia di avviso di
    // un liquido si pensa in bottiglie («avvisami quando ne resta una»),
    // non in 700 ml; e il contenuto di una bottiglia si scrive «0,7 l»
    // com'è stampato sull'etichetta, non 700 se l'articolo è in ml.
    // Il valore salvato non cambia: cambia solo come lo si digita.
    low_threshold_unit: initUnit,
    package_size_unit: initUnit,
    bottles: '',
    open_content: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const num = (v) => Number(String(v).replace(',', '.')) || 0
  const isPz = baseUnit(form.unit) === 'pz'
  // ARTICOLO IN UNITÀ GENERICHE (il «Tempo di Lavorazione»): non ha contenuto,
  // non ha confezione e non è una scorta. Di suo serve solo il COSTO PER
  // UNITÀ — è il motivo per cui la voce esiste, mettere il lavoro nel costo
  // del drink. Chiedere confezione, giacenza iniziale e soglia di avviso
  // vorrebbe dire far riempire campi che non vogliono dire niente.
  const isGenerico = unitaGenerica(baseUnit(form.unit))
  // LA DOMANDA SEGUE L'UNITÀ. Cambiando «come lo compri» il valore di
  // partenza si aggiorna: fuori dalle generiche è sempre una scorta, dentro
  // no finché non lo si dice. Senza questo, un prodotto nuovo passato a «U»
  // restava segnato come scorta perché lo era la scheda vuota.
  const scorteRif = useRef(form.scorta)
  scorteRif.current = form.scorta
  useEffect(() => {
    const atteso = !unitaGenerica(baseUnit(form.unit))
    const dichiarata = typeof initial?.scorta === 'boolean' ? initial.scorta : null
    const nuovo = atteso ? true : (dichiarata ?? false)
    if (scorteRif.current !== nuovo) setForm((f) => ({ ...f, scorta: nuovo }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.unit])
  const costNum = num(form.cost)
  // Contenuto per confezione nell'unità scelta (per il costo unitario).
  // Quanto contiene la confezione, letto NELL'UNITÀ DEL PREZZO: i due campi
  // possono essere scritti in unità diverse (la confezione in litri, il
  // prezzo al cl), e moltiplicarli così com'erano dava un costo sballato.
  const packInUnit =
    !isPz && !isGenerico
      ? fromBaseQty(toBaseQty(num(form.package_size), form.package_size_unit), form.unit)
      : 0
  const initialBase = baseUnit(initUnit)
  const baseChanged = isEdit && baseUnit(form.unit) !== initialBase
  // Conversione possibile solo con il contenuto per confezione: verso i pezzi
  // serve quello salvato, dai pezzi quello appena inserito nel form.
  const convertible = (() => {
    if (!baseChanged) return true
    const toPz = baseUnit(form.unit) === 'pz'
    const fromPz = initialBase === 'pz'
    if (toPz && !fromPz) return Number(initial?.package_size) > 0
    if (fromPz && !toPz) return num(form.package_size) > 0
    return true // liquidi ↔ solidi: nessuna conversione, il numero resta
  })()
  // Giacenza convertita quando si cambia il modo di gestire l'articolo:
  //   liquido/peso → pezzi  : quante confezioni sono (stock / contenuto conf.)
  //   pezzi → liquido/peso  : contenuto totale (pezzi × contenuto conf.)
  // Fra liquidi e pesi non c'è conversione sensata: il numero resta com'è
  // (è una ri-catalogazione, non un travaso).
  // Quanto contiene una confezione, scritto com'è leggibile: è il numero su
  // cui si fa la conversione della giacenza quando si cambia gestione.
  const contenutoDiRiferimento = (() => {
    const versoPz = baseUnit(form.unit) === 'pz'
    const base = versoPz ? Number(initial?.package_size) || 0 : toBaseQty(num(form.package_size), form.package_size_unit)
    if (!(base > 0)) return null
    return formatQty(base, versoPz ? initialBase : baseUnit(form.unit))
  })()

  const convertedStock = () => {
    const cur = Number(initial?.stock) || 0
    const toPz = baseUnit(form.unit) === 'pz'
    const fromPz = initialBase === 'pz'
    if (toPz && !fromPz) {
      const size = Number(initial?.package_size) || 0
      return size > 0 ? Math.round((cur / size) * 100) / 100 : cur
    }
    if (fromPz && !toPz) {
      const size = toBaseQty(num(form.package_size), form.unit) || 0
      return size > 0 ? cur * size : cur
    }
    return cur
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      // A pezzo il contenuto arriva dal suo campo (33 cl), altrimenti dal
      // contenuto per confezione nell'unità scelta per QUEL campo. In unità
      // generiche non c'è nessun contenuto: dentro una unità di lavoro non
      // c'è niente.
      const packBase = isGenerico
        ? null
        : isPz
          ? toBaseQty(num(form.content_size), form.content_unit) || null
          : toBaseQty(num(form.package_size), form.package_size_unit) || null
      // La resa vale per chi NON si conta a pezzi: sul pezzo la stessa cosa
      // la dice già «a quanto corrisponde un pezzo».
      const resaBase = (() => {
        if (isPz || isGenerico || !form.usa_altra_unita) return null
        const uso = toBaseQty(num(form.resa_qty), form.resa_unit)
        if (!(uso > 0)) return null
        const perAcquisto = toBaseQty(1, form.unit) || 1
        return uso / perAcquisto
      })()
      const base = {
        name: form.name.trim(),
        unit: baseUnit(form.unit), // base in cui è salvato lo stock
        display_unit: form.unit, // unità scelta per inserimento/visualizzazione
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        // Si risale al costo della confezione: quello che il resto dell'app
        // sa leggere da sempre (costPerUnit, valore di magazzino, ordini).
        cost: form.cost === '' ? null : arrotonda(costNum * (packInUnit > 0 ? packInUnit : 1)),
        vat: Number(form.vat) || 0,
        status: form.status || 'assortimento',
        package_size: packBase,
        // Serve solo a pezzo: dice se quel contenuto è un volume, un peso o
        // delle unità.
        content_unit: isPz && packBase ? baseUnit(form.content_unit) : null,
        // LA RESA, per chi compra in un modo e usa in un altro. Sta in unità
        // base d'uso per UNA unità base d'acquisto: 1 kg di limoni = 50 cl
        // di succo diventa 0,5 ml per grammo. Vedi resaUso in lib/inventory.
        resa: resaBase,
        resa_unit: resaBase ? baseUnit(form.resa_unit) : null,
        // Fuori dalle unità generiche è sempre una scorta: la domanda si fa
        // solo dove ha senso, e la risposta non si inventa.
        scorta: isGenerico ? !!form.scorta : true,
        // La soglia scritta in pezzi diventa contenuto (2 bottiglie da 70 cl
        // = 1400 ml) e viceversa: è lo stesso passaggio che fa lo scarico
        // dalla ricetta alla giacenza, quindi i due numeri non litigano.
        low_threshold: qtyInStockUnit(num(form.low_threshold), form.low_threshold_unit, {
          unit: baseUnit(form.unit),
          package_size: packBase,
          content_unit: isPz && packBase ? baseUnit(form.content_unit) : null,
          resa: resaBase,
          resa_unit: resaBase ? baseUnit(form.resa_unit) : null,
        }),
      }
      // ARTICOLO IN UNITÀ GENERICHE: non è una scorta, quindi non c'è nessuna
      // giacenza da salvare né bottiglie da contare — e nessuna conversione da
      // fare passando da un'altra unità, perché non c'è niente da convertire.
      if (isGenerico) {
        await onSave({ ...base, stock: 0, bottles_total: 0 })
        return
      }
      // Cambio del modo di gestire l'articolo SENZA il contenuto per confezione:
      // la conversione non è calcolabile e si salverebbe una giacenza falsa
      // (24 pezzi → 24 ml). Meglio fermarsi e chiederlo.
      if (baseChanged && !convertible) {
        setSaving(false)
        toastError('Indica il contenuto per confezione: senza, la giacenza non si può convertire.')
        return
      }
      if (isEdit) {
        // In modifica la giacenza NON si tocca... a meno che si cambi il modo di
        // gestire l'articolo (es. da centilitri a pezzi): allora si converte,
        // altrimenti il numero salvato vorrebbe dire un'altra cosa.
        if (baseChanged) {
          const stock = convertedStock()
          await onSave({
            ...base,
            stock,
            bottles_total: baseUnit(form.unit) === 'pz' ? Math.round(stock) : Math.floor(stock / (packBase || 1)),
          })
        } else {
          await onSave(base)
        }
      } else {
        const n = Number(form.bottles) || 0
        let stock
        let bottles_total = 0
        if (isPz) {
          stock = n
        } else {
          const size = packBase || 0
          const open = toBaseQty(num(form.open_content), form.unit)
          stock = n * size + open
          bottles_total = n + (open > 0 ? 1 : 0)
        }
        await onSave({ ...base, stock, bottles_total })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>{isEdit ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>
        {/* IL PUNTO INTERROGATIVO. Questa scheda decide come si scala il
            magazzino e quanto costa un drink: chi la compila la prima volta
            non deve indovinare cosa vogliono dire le domande. La spiegazione
            sta dietro un tasto, non in pagina: a chi la sa già non serve. */}
        <button
          type="button"
          className="inv-aiuto"
          aria-label="Come si compila questa scheda"
          title="Come si compila questa scheda"
          onClick={() => setAiuto(true)}
        >
          ?
        </button>
      </div>
      {aiuto && <AiutoProdotto onClose={() => setAiuto(false)} />}

      <label htmlFor="iname">Nome *</label>
      <input id="iname" value={form.name} onChange={set('name')} placeholder="Es. Rum Zacapa" required />

      <label htmlFor="icat">Categoria</label>
      <select id="icat" value={form.category_id || ''} onChange={set('category_id')}>
        <option value="">— Nessuna —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label htmlFor="isup">Fornitore</label>
      <select id="isup" value={form.supplier_id || ''} onChange={set('supplier_id')}>
        <option value="">— Nessuno —</option>
        {(suppliers || []).map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <label htmlFor="istatus">Stato</label>
      <select id="istatus" value={form.status} onChange={set('status')}>
        {STATUS_ITEM.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* ── LE TRE DOMANDE ────────────────────────────────────────
          Un prodotto si compra in un modo e si usa in un altro, e in
          magazzino ci finiscono cose lontanissime fra loro: il gin a
          bottiglia, i limoni al chilo, il ghiaccio a sacchi, il tempo di
          lavoro. Prima ogni tipo chiedeva la sua configurazione; adesso
          sono sempre le stesse domande, e la terza compare solo quando
          serve davvero. Vedi REQ-MAG-016. */}
      <h4 className="inv-domanda">Come lo compri</h4>
      <p className="muted small" style={{ margin: '0 0 6px' }}>
        L&apos;unità in cui conti la giacenza sullo scaffale, e in cui c&apos;è
        il prezzo.
      </p>

      <label htmlFor="iunit">Unità d&apos;acquisto</label>
      <select id="iunit" value={form.unit} onChange={set('unit')}>
        {[
          ['Liquidi', [['l', 'Litri (L)'], ['cl', 'Centilitri (cl)'], ['ml', 'Millilitri (ml)']]],
          ['Solidi', [['g', 'Grammi (g)'], ['mg', 'Milligrammi (mg)']]],
          ['Pezzi', [['pz', 'Pezzi / unità (bottiglie, lattine, confezioni…)']]],
          // GENERICO: quello che non si versa, non si pesa e non è una
          // bottiglia — il tempo di lavorazione messo a listino. Senza,
          // l'unica scelta possibile era il grammo, e nella ricetta si
          // leggeva «Tempo di Lavorazione 1 g».
          ['Generico', [['U', 'Unità generiche (U) — es. tempo di lavorazione']]],
        ].map(([grp, units]) => (
          <optgroup key={grp} label={grp}>
            {units.map(([u, label]) => (
              // Ogni articolo può essere gestito come si vuole (litri, peso o
              // pezzi): cambiando base in modifica la giacenza viene CONVERTITA
              // (vedi l'avviso qui sotto), non reinterpretata a caso.
              <option key={u} value={u}>
                {label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="grid-2">
        <div>
          {/* L'etichetta segue «come lo compri»: €/kg per i limoni, €/pz
              per le bottiglie, €/U per il tempo di lavorazione. Diceva
              sempre «€/pz» anche quando il prodotto si comprava a chili, e
              chi scriveva il prezzo non sapeva a cosa si riferiva. */}
          <label htmlFor="icost">
            Costo €/{UNIT_LABEL[String(form.unit).toLowerCase()] || form.unit} (netto)
          </label>
          <input id="icost" type="number" step="any" min="0" value={form.cost} onChange={set('cost')} placeholder="Es. 12,9" />
        </div>
        <div>
          <label htmlFor="ivat">IVA acquisto %</label>
          <input id="ivat" type="number" step="any" min="0" value={form.vat} onChange={set('vat')} />
        </div>
      </div>
      {costNum > 0 && (
        <div className="muted small">
          +IVA {formatPrice(costWithVat(costNum, form.vat))}/
          {UNIT_LABEL[String(form.unit).toLowerCase()] || form.unit}
          {/* Quanto viene la confezione intera: è la cifra che si ritrova
              sulla fattura del fornitore. */}
          {packInUnit > 0 &&
            ` · confezione ${formatPrice(costWithVat(costNum * packInUnit, form.vat))}`}
        </div>
      )}

      {/* Cambio del modo di gestire l'articolo: si dice CHIARAMENTE come
          finisce la giacenza, prima di salvare. Passando alle unità generiche
          la giacenza sparisce del tutto: quella voce non è una scorta. */}
      {baseChanged && (
        <div className="banner" style={{ marginTop: 8 }}>
          ⚠️ Cambi la gestione da <strong>{GESTIONE_LABEL[initialBase]}</strong>{' '}
          a <strong>{GESTIONE_LABEL[baseUnit(form.unit)]}</strong>:{' '}
          {isGenerico ? (
            <>
              la giacenza attuale ({fmtItem(initial?.stock, initial)}) non serve più e
              viene <strong>azzerata</strong> — le unità generiche non sono una scorta.
            </>
          ) : (
            <>
              la giacenza attuale ({fmtItem(initial?.stock, initial)}) diventerà{' '}
              <strong>{formatQty(convertedStock(), baseUnit(form.unit))}</strong>.
              {/* IN BASE A COSA. Il conto è sempre quello: quanto contiene
                  una confezione. Scritto qui perché è la prima domanda di
                  chi legge l'avviso, e prima non c'era risposta. */}
              {contenutoDiRiferimento && (
                <span className="muted">
                  {' '}
                  Il conto si fa sul contenuto di una confezione (
                  {contenutoDiRiferimento}).
                </span>
              )}
              {/* Passando ai pezzi la resa non serve più: la stessa cosa la
                  dice «A quanto corrisponde un pezzo?». Meglio dirlo che
                  farla sparire in silenzio. */}
              {baseUnit(form.unit) === 'pz' && Number(initial?.resa) > 0 && (
                <div style={{ marginTop: 6 }}>
                  La resa che avevi scritto non vale più: contando a pezzi la
                  stessa cosa si dice in <strong>«A quanto corrisponde un
                  pezzo?»</strong>.
                </div>
              )}
            </>
          )}
          {!convertible && !isGenerico && (
            <div style={{ marginTop: 6 }}>
              ⛔ Indica prima il <strong>contenuto per confezione</strong>: senza,
              la giacenza non si può convertire.
            </div>
          )}
        </div>
      )}

      {!isGenerico && (
        <>
          <h4 className="inv-domanda">Come lo usi in ricetta</h4>
          <p className="muted small" style={{ margin: '0 0 6px' }}>
            {isPz
              ? 'Un pezzo, nelle ricette, quanto vale: da qui esce il costo al cl (o al grammo, o all’unità).'
              : 'Quasi sempre come lo compri — e allora qui non c’è niente da scrivere.'}
          </p>
        </>
      )}

      {isGenerico ? (
        <>
          <p className="muted small" style={{ margin: '2px 0 8px' }}>
            Si conta a unità, senza contenuto e senza conversioni: serve per quello
            che non si versa e non si pesa. Nella ricetta di un drink entra col suo{' '}
            <strong>costo per unità</strong>, e in carta al cliente non compare.
          </p>
          {/* NON TUTTO QUELLO CHE SI CONTA A UNITÀ È MANODOPERA. Il tempo di
              lavoro non sta su nessuno scaffale e non finisce mai; il
              GHIACCIO si conta a unità uguale, ma sta nel freezer e a
              mezzanotte è finito — e chi lo usa vuole vederlo scendere. La
              differenza non la può indovinare l'app: la sa chi carica il
              prodotto. */}
          <label className="row" style={{ gap: 8, alignItems: 'center', margin: '2px 0 8px' }}>
            <input
              type="checkbox"
              checked={!!form.scorta}
              onChange={(e) => setForm((f) => ({ ...f, scorta: e.target.checked }))}
              style={{ width: 'auto' }}
            />
            <span>
              È una scorta: si scarica quando si usa
              <span className="muted small"> — es. il ghiaccio. Il tempo di lavorazione no.</span>
            </span>
          </label>
        </>
      ) : !isPz ? (
        <>
          {/* LA DOMANDA PARLA DELLA CONFEZIONE CHE SI COMPRA, non della
              giacenza. Scritta «contenuto per confezione» si leggeva come
              «in quante parti divido il centilitro», e mettendo «100 cl»
              sembrava che moltiplicasse per cento ogni cl (Flavio, 17/08).
              La giacenza resta quella che è: questo serve al costo al cl e
              agli ordini al fornitore. */}
          <label htmlFor="ipkg">Quanto contiene una confezione che compri?</label>
          <div className="row" style={{ gap: 6 }}>
            <input
              id="ipkg"
              type="number"
              step="any"
              min="0"
              className="grow"
              value={form.package_size}
              onChange={set('package_size')}
              placeholder="Es. 0,7 se compri bottiglie da 70 cl"
            />
            <ScegliUnita
              valore={form.package_size_unit}
              unita={form.unit}
              onChange={set('package_size_unit')}
              etichetta="Unità del contenuto per confezione"
            />
          </div>
          <p className="muted small" style={{ margin: '2px 0 8px' }}>
            Non tocca la giacenza: serve a sapere quanto costa quello che
            c&apos;è dentro e a ordinare al fornitore.
          </p>

          {/* ── COME LO USI, SE NON È COME LO COMPRI ──────────────────
              I limoni si comprano al chilo e si spremono in cl: peso e
              volume non si convertono l'uno nell'altro, e infatti questa
              non è una conversione — è la RESA, e la sa chi li spreme.
              Facoltativa: quasi tutti i prodotti si usano come si comprano,
              e a quelli questa riga non serve. */}
          {/* UN INTERRUTTORE, NON UN CAMPO SEMPRE APERTO. Quasi tutti i
              prodotti si usano come si comprano: lasciare la riga a vista
              faceva leggere cose senza senso — «1 cl rende … cl» — e
              chiedeva una risposta a chi non aveva la domanda. */}
          <label className="row between" style={{ alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span>
              Si usa in un&apos;altra unità
              <span className="muted small"> — es. i limoni: si comprano al chilo, si spremono in cl</span>
            </span>
            <input
              type="checkbox"
              className="toggle"
              checked={!!form.usa_altra_unita}
              onChange={(e) => setForm((f) => ({ ...f, usa_altra_unita: e.target.checked }))}
            />
          </label>

          {form.usa_altra_unita && (
            <>
              <label htmlFor="iresa">Quanto rende</label>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  1 {UNIT_LABEL[String(form.unit).toLowerCase()] || form.unit} rende
                </span>
                <input
                  id="iresa"
                  type="number"
                  step="any"
                  min="0"
                  className="grow"
                  value={form.resa_qty}
                  onChange={set('resa_qty')}
                  placeholder="Es. 50"
                />
                <select
                  value={form.resa_unit}
                  onChange={set('resa_unit')}
                  aria-label="Unità d'uso"
                  style={{ width: 80 }}
                >
                  <option value="cl">cl</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                </select>
              </div>
              <p className="muted small" style={{ margin: '2px 0 8px' }}>
                Le ricette lo dosano nell&apos;unità d&apos;uso; la giacenza
                resta quella che conti sullo scaffale.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          {/* «A quanto corrisponde un pezzo»: è la domanda che si fa chi
              carica la merce — una bottiglia fa 100 cl, una confezione fa
              10 U. Da qui esce il costo al cl (o all'unità). */}
          <label htmlFor="icontent">A quanto corrisponde un pezzo?</label>
          <div className="row" style={{ gap: 6 }}>
            <input
              id="icontent"
              type="number"
              step="any"
              min="0"
              className="grow"
              value={form.content_size}
              onChange={set('content_size')}
              placeholder="Es. 33 per una bottiglia da 33 cl"
            />
            <select
              value={form.content_unit}
              onChange={set('content_unit')}
              aria-label="Unità del contenuto"
              style={{ width: 90 }}
            >
              <option value="cl">cl</option>
              <option value="ml">ml</option>
              <option value="g">g</option>
              {/* UN PEZZO PUÒ CONTENERE UNITÀ: «il tempo di lavoro in pezzi
                  e dopo unità» (Flavio, 17/08). Le unità non si scaricano dal
                  magazzino — servono al costo — ma in ricetta si dosano. */}
              <option value="U">U</option>
            </select>
          </div>
          <p className="muted small" style={{ margin: '2px 0 8px' }}>
            La giacenza si conta a pezzi. Questo serve a sapere quanto costa al cl
            (o al grammo, o all&apos;unità) quello che c&apos;è dentro
            {form.content_unit === 'U'
              ? '. Le unità non si scaricano dal magazzino: servono al costo.'
              : '.'}
          </p>
        </>
      )}

      {!isEdit && !isGenerico && (
        isPz ? (
          <>
            <label htmlFor="ibottles">Quantità iniziale (pezzi)</label>
            <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} />
          </>
        ) : (
          <>
            <label htmlFor="ibottles">Numero di confezioni piene</label>
            <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} placeholder="Es. 3" />
            <label htmlFor="iopen">Bottiglia aperta — contenuto ({form.unit}) — opzionale</label>
            <input id="iopen" type="number" step="any" min="0" value={form.open_content} onChange={set('open_content')} placeholder={`Es. ${form.unit === 'l' ? '0,35' : form.unit === 'ml' ? '350' : '35'} se ne hai una già aperta`} />
          </>
        )
      )}

      {/* Niente soglia in unità generiche: non finisce, quindi non c'è niente
          da avvisare e niente da riordinare al fornitore. */}
      {!isGenerico && (
        <>
        <label htmlFor="ithr">Soglia di avviso</label>
        <div className="row" style={{ gap: 6 }}>
          <input
            id="ithr"
            type="number"
            step="any"
            min="0"
            className="grow"
            value={form.low_threshold}
            onChange={set('low_threshold')}
            placeholder="Es. 2 se vuoi l’avviso quando ne restano due"
          />
          <ScegliUnita
            valore={form.low_threshold_unit}
            unita={form.unit}
            conPezzi
            onChange={set('low_threshold_unit')}
            etichetta="Unità della soglia di avviso"
          />
        </div>
        <p className="muted small" style={{ margin: '2px 0 8px' }}>
          {form.low_threshold_unit === 'pz' && baseUnit(form.unit) !== 'pz'
            ? 'In pezzi: l’avviso scatta quando resta questo numero di confezioni intere.'
            : 'Sotto questo livello l’articolo compare fra quelli in esaurimento.'}
        </p>
        </>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>Annulla</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button>
      </div>
    </form>
  )
}

// LA SCELTA DELL'UNITÀ accanto a un campo. Le opzioni sono quelle
// compatibili con come si conta l'articolo (litri, cl, ml per un liquido;
// kg e grammi per un peso) più i PEZZI dove ha senso: la soglia di avviso
// di un liquido si pensa in bottiglie — «avvisami quando ne resta una» —
// e nessuno la vuole scrivere in 700 ml.
const UNITA_COMPATIBILI = {
  ml: ['l', 'cl', 'ml'],
  g: ['kg', 'g'],
  pz: ['pz'],
}

function ScegliUnita({ valore, unita, onChange, etichetta, conPezzi = false }) {
  const base = baseUnit(unita)
  const opzioni = [...(UNITA_COMPATIBILI[base] || [unita])]
  // Per un articolo contato a pezzi il «pezzo» c'è già; per un liquido lo si
  // aggiunge solo dove la conversione ha senso.
  if (conPezzi && base !== 'pz') opzioni.push('pz')
  return (
    <select value={valore} onChange={onChange} aria-label={etichetta} style={{ width: 90 }}>
      {opzioni.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  )
}

// Intestazione di colonna ORDINABILE della tabella inventario: un click ordina,
// il ri-click inverte; la freccia indica il verso attivo.
function SortTh({ label, col, sort, onSort, num = false }) {
  const active = sort.col === col
  return (
    <button
      type="button"
      className={`inv-th${num ? ' inv-cell-num' : ''}${active ? ' active' : ''}`}
      onClick={() => onSort(col)}
      title={`Ordina per ${label}`}
    >
      {label}
      <span aria-hidden className="inv-th-arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  )
}
