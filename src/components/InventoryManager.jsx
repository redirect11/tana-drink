import { useEffect, useMemo, useState } from 'react'
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
import { useChiudiConIndietro } from '../lib/schermate.js'
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
  // Aperta la scheda, «indietro» torna al magazzino invece di uscire dalla
  // pagina: vedi lib/schermate.js.
  useChiudiConIndietro(!!editing, () => setEditing(null))

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
        {/* QUANTO CE N'È, PER PRIMO — è la ragione per cui un prodotto si
            apre. Dove si conta a pezzi lo dice la riga «Pezzi», che è più
            precisa (quante piene, quella aperta, quanto fa una): una riga
            «Giacenza» sopra ripeteva lo stesso numero due volte. */}
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
          <>
            <div className="inv-info-row">
              <dt>Giacenza</dt>
              <dd>
                <strong>{fmtItem(it.stock, it)}</strong>
              </dd>
            </div>
            {Number(it.package_size) > 0 && (
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
            )}
          </>
        )}
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
  // IL COLLO E' UN'ECCEZIONE, NON LA REGOLA. Chi carica due bottiglie prese
  // dal fornitore sotto casa non ha nessun cartone da dichiarare, e si
  // trovava tre campi in piu' da capire. Sta dietro un interruttore: da
  // spento la scheda e' quella di sempre — quanti pezzi, e il prezzo.
  const [aColli, setAColli] = useState(false)

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
      {/* IL COLLO STA SOPRA, perché è da lì che si parte: si guarda il
          cartone, si scrive quanti pezzi ha e quanti ne sono arrivati, e la
          quantità si riempie da sé. Prima i suoi campi stavano in fondo,
          dentro il riquadro del prezzo, e i pezzi andavano scritti a mano
          sperando che il conto tornasse. */}
      <label className="row between" style={{ alignItems: 'center', gap: 8 }}>
        <span>
          Carico a colli
          <span className="muted small"> — un cartone, una cassa</span>
        </span>
        <input
          type="checkbox"
          className="toggle"
          checked={aColli}
          onChange={(e) => {
            setAColli(e.target.checked)
            if (!e.target.checked) setCartoni('')
          }}
        />
      </label>

      {aColli && (
        <div className="card" style={{ marginTop: 8, padding: 10 }}>
          <div className="grid-2">
            <div>
              <label htmlFor="cf-collo">{isPz ? 'Pezzi per collo' : 'Confezioni per collo'}</label>
              <input
                id="cf-collo"
                type="number"
                step="any"
                min="0"
                value={perCollo}
                onChange={(e) => onCollo(e.target.value)}
                placeholder="Es. 24"
              />
            </div>
            <div>
              <label htmlFor="cf-cartoni">Quanti colli arrivano?</label>
              <input
                id="cf-cartoni"
                type="number"
                step="1"
                min="0"
                value={cartoni}
                onChange={(e) => onCartoni(e.target.value)}
                placeholder="Es. 2"
              />
            </div>
          </div>
          <label htmlFor="cf-tot" style={{ marginTop: 6 }}>Totale collo (€, netto)</label>
          <input
            id="cf-tot"
            type="number"
            step="any"
            min="0"
            value={colloTot}
            onChange={(e) => onTot(e.target.value)}
            placeholder="Prezzo del cartone dal fornitore"
          />
          {perN > 0 && num(cartoni) > 0 && (
            <div className="muted small" style={{ marginTop: 4 }}>
              {num(cartoni)} × {perN} = <strong>{num(cartoni) * perN} {isPz ? 'pz' : 'conf.'}</strong>
            </div>
          )}
        </div>
      )}

      {isPz ? (
        <>
          {/* A colli la quantità la fa il conto: si legge, non si scrive.
              Cambiarla a mano vorrebbe dire caricare un numero che non torna
              con quello che è arrivato. */}
          <label htmlFor="cf-pezzi" style={{ marginTop: 8 }}>Quanti pezzi aggiungi?</label>
          <input
            id="cf-pezzi"
            type="number"
            step="1"
            min="0"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            readOnly={aColli}
            aria-readonly={aColli}
            autoFocus={!aColli}
          />
        </>
      ) : (
        <>
          <label htmlFor="cf-pezzi" style={{ marginTop: 8 }}>
            Quante confezioni piene? (1 conf. = {formatQty(size, item.unit)})
          </label>
          <input
            id="cf-pezzi"
            type="number"
            step="1"
            min="0"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            readOnly={aColli}
            aria-readonly={aColli}
            autoFocus={!aColli}
          />
          {/* NON SEMPRE È UNA BOTTIGLIA: qui dentro ci sono sacchi di
              ghiaccio, barattoli, buste. La parola giusta è quella che vale
              per tutti. */}
          <label htmlFor="cf-aperta" style={{ marginTop: 8 }}>
            Confezione aperta — contenuto ({item.unit}) — opzionale
          </label>
          <input
            id="cf-aperta"
            type="number"
            step="any"
            min="0"
            value={open}
            onChange={(e) => setOpen(e.target.value)}
            placeholder="Es. 400 se ne aggiungi una già aperta"
          />
        </>
      )}

      {/* Prezzo: unitario ↔ totale collo (per confrontare col fornitore) */}
      <div className="card" style={{ marginTop: 10, padding: 10 }}>
        <div className="muted small">💶 Prezzo — aggiorna se il fornitore l'ha cambiato</div>
        <label htmlFor="cf-unit" style={{ marginTop: 6 }}>Costo unitario (€, netto)</label>
        <input id="cf-unit" type="number" step="any" min="0" value={unitCost} onChange={(e) => onUnit(e.target.value)} />
        {unitN > 0 && (
          <div className="muted small" style={{ marginTop: 4 }}>
            Unitario +IVA {formatPrice(costWithVat(unitN, item.vat))}
            {aColli && perN > 0 && ` · Totale collo +IVA ${formatPrice(costWithVat(unitN * perN, item.vat))}`}
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

// ── I QUATTRO TIPI DI PRODOTTO ───────────────────────────────────────
//
// La scheda partiva dalle unità di misura — «unità d'acquisto» a famiglie,
// la casella «è una scorta», «lo uso come lo compro» — e chi la compilava
// doveva tradurre il suo prodotto in quel gergo, una domanda alla volta.
// La domanda vera è UNA: che tipo di prodotto è? Dalle quattro risposte
// escono da sole l'unità, la scorta e i campi da mostrare. Il modello dati
// sotto NON cambia (REQ-MAG-016): unit, package_size, content_unit, resa,
// scorta sono gli stessi di prima.
const TIPI_PRODOTTO = [
  ['intero', '🍺', 'Lo vendo intero', 'bottiglie, lattine'],
  ['versato', '🍸', 'Lo verso nei drink', 'gin, vermut, amari'],
  ['sfuso', '🍋', 'Sfuso, a peso o volume', 'limoni, spina, ghiaccio'],
  ['lavoro', '⏱', 'Lavoro o servizio', 'tempo di lavorazione'],
]

// Il tipo di un prodotto già salvato: le schede nuove lo portano scritto
// (`tipo`); quelle vecchie non ce l'hanno e si deduce da com'erano
// configurate, senza nessuna migrazione. La regola ricalca eScorta: una U
// è lavoro finché qualcuno non ha detto che è una scorta (il ghiaccio).
function tipoDerivato(item) {
  if (!item) return null
  if (TIPI_PRODOTTO.some(([t]) => t === item.tipo)) return item.tipo
  if (unitaGenerica(item.unit)) return item.scorta === true ? 'sfuso' : 'lavoro'
  if ((item.unit || 'pz') === 'pz') return Number(item.package_size) > 0 ? 'versato' : 'intero'
  return 'sfuso'
}

// ── COME SI COMPILA UNA SCHEDA PRODOTTO ──────────────────────────────
//
// Una domanda sola — che tipo di prodotto è? — e un esempio per tipo. Il
// testo è asciutto di proposito: chi lo apre sta compilando, non leggendo
// (REQ-MAG-016).
function AiutoProdotto({ onClose }) {
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box"
        role="dialog"
        aria-label="Come si compila questa scheda"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Che tipo di prodotto è?</h3>

        <h4 style={{ margin: '14px 0 2px' }}>🍺 Lo vendo intero</h4>
        <p className="small" style={{ margin: 0 }}>
          Si compra e si serve a pezzi: una Ichnusa costa a bottiglia e si
          vende a bottiglia. Il contenuto (33 cl) è facoltativo: serve solo
          a confrontare il costo al cl con le altre bottiglie.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>🍸 Lo verso nei drink</h4>
        <p className="small" style={{ margin: 0 }}>
          Si compra a bottiglie e si dosa a cl: il gin. «Una bottiglia fa
          70 cl» qui è obbligatorio — da quel numero escono il costo al cl
          e lo scarico di quello che si versa.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>🍋 Sfuso, a peso o volume</h4>
        <p className="small" style={{ margin: 0 }}>
          Si compra a chili o a litri: i limoni al kg, la birra alla spina,
          il ghiaccio a sacchi. Se si usa in un&apos;altra misura — 1 kg di
          limoni fa 50 cl di succo — lo si scrive nella riga apposta.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>⏱ Lavoro o servizio</h4>
        <p className="small" style={{ margin: 0 }}>
          Il tempo di lavorazione: non è merce, niente giacenza, mai
          esaurito, e in carta al cliente non compare. Entra solo nel costo
          del drink.
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

// L'UNITÀ D'USO SI SCEGLIE LIBERAMENTE. I limoni si comprano al chilo e si
// spremono in cl: le famiglie (peso, volume) qui non c'entrano, perché a
// dire quanto rende una cosa nell'altra è chi compra. Le conversioni fra
// unità della stessa famiglia restano automatiche.
const UNITA_USO = [
  ['l', 'L'],
  ['cl', 'cl'],
  ['ml', 'ml'],
  ['kg', 'kg'],
  ['g', 'g'],
  ['mg', 'mg'],
  ['U', 'U'],
]

// Le unità con cui si compra lo SFUSO: chili e litri per la merce vera,
// centilitri e grammi per chi tiene i conti fini, U per quello che si
// conta a sacchi o confezioni (il ghiaccio).
const UNITA_SFUSO = [
  ['kg', 'Chili (kg)'],
  ['l', 'Litri (L)'],
  ['cl', 'Centilitri (cl)'],
  ['g', 'Grammi (g)'],
  ['U', 'Unità (U) — sacchi, confezioni'],
]

// Il contenuto di un pezzo si scrive in quello che c'è dentro: cl (o ml)
// per le bottiglie, g per i barattoli, U per le confezioni di cose contate.
const CONTENUTO_UNITA = ['cl', 'ml', 'g', 'U']

// ── COSA VUOL DIRE IL CONTENUTO DI UN PEZZO ──────────────────────────
//
// La domanda si legge facilmente per un'altra: «quanto ne va in un drink?».
// Sono due cose diverse — quella la decide la ricetta, drink per drink — e
// confonderle vuol dire riempire il campo con la dose di un cocktail e
// scaricare il magazzino con numeri che non tornano.
function AiutoPezzo({ onClose }) {
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box"
        role="dialog"
        aria-label="A quanto corrisponde un pezzo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>A quanto corrisponde un pezzo</h3>
        <p className="small" style={{ marginTop: 0 }}>
          È <strong>quanto contiene</strong> un pezzo: una bottiglia da 100 cl,
          un sacco da 5 kg, una confezione da 10 U. Non è quanto ne va in un
          drink: quello si decide nella ricetta, drink per drink.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>Se lo scrivi</h4>
        <p className="small" style={{ margin: 0 }}>
          Nelle ricette puoi scegliere l&apos;unità: a <strong>pezzi</strong>
          (una lattina intera) o nell&apos;unità del contenuto —{' '}
          <strong>cl</strong>, g, U. Versando 4 cl da una bottiglia da 100 cl
          il magazzino scala 0,04 pezzi, e si sa quanto costa al cl.
        </p>

        <h4 style={{ margin: '14px 0 2px' }}>Se lo lasci vuoto</h4>
        <p className="small" style={{ margin: 0 }}>
          Nelle ricette si dosa <strong>solo a pezzi</strong>: è il caso della
          birra in bottiglia, che si serve intera. Il costo resta quello del
          pezzo, e non c&apos;è nessun costo al cl da calcolare.
        </p>

        <button type="button" className="btn block" style={{ marginTop: 16 }} onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  )
}

function ItemForm({ initial, categories, suppliers, defaultVat = 22, onCancel, onSave }) {
  const isEdit = !!initial
  // Unità con cui si rileggono i numeri di un prodotto salvato: quella di
  // visualizzazione se c'è, altrimenti quella «parlata» della sua base —
  // i liquidi in cl, che è come si dosa al banco.
  const defaultUnit = (base) =>
    base === 'g' ? 'g' : base === 'pz' ? 'pz' : unitaGenerica(base) ? 'U' : 'cl'
  const initUnit = initial?.display_unit ?? defaultUnit(initial?.unit)
  const initialBase = baseUnit(initUnit)
  // LA DOMANDA INIZIALE: che tipo di prodotto è? Un prodotto nuovo parte
  // senza risposta — i campi giusti compaiono dopo, e senza risposta non si
  // salva. Un prodotto già salvato riparte dal suo tipo (vedi tipoDerivato).
  const tipoIniziale = tipoDerivato(initial)
  const [tipo, setTipo] = useState(tipoIniziale)
  // L'unità d'acquisto dello SFUSO: per gli altri tipi la decide il tipo
  // (pezzi, U). Riaprendo uno sfuso si riparte dalla sua; per il resto dal
  // chilo, che è il caso dei limoni.
  const [unitSfuso, setUnitSfuso] = useState(tipoIniziale === 'sfuso' ? initUnit : 'kg')
  const unita = tipo === 'sfuso' ? unitSfuso : tipo === 'lavoro' ? 'U' : 'pz'
  const [aiuto, setAiuto] = useState(false)
  const [aiutoPezzo, setAiutoPezzo] = useState(false)
  // Il salvataggio bloccato si spiega QUI, sopra i tasti, e resta finché
  // non si corregge: un toast passa e chi stava guardando la tastiera non
  // lo vede.
  const [avviso, setAvviso] = useState(null)

  // Il contenuto di un pezzo com'era salvato, nell'unità in cui si legge
  // (una bottiglia è «70 cl», non 700 ml). Si prefigura anche per i
  // prodotti storici gestiti a volume: se uno diventa «versato», quel
  // numero serve e ribatterlo a mano sarebbe un invito a sbagliarlo.
  // NON si prefigura la confezione convenzionale (1 kg, 1 L) degli sfusi
  // nati dopo: non è il contenuto di una bottiglia, è solo l'unità.
  const contFamiglia = (initial?.unit || 'pz') === 'pz' ? initial?.content_unit : initial?.unit
  const contUnita = unitaGenerica(contFamiglia) ? 'U' : contFamiglia === 'g' ? 'g' : 'cl'
  const packIniziale = Number(initial?.package_size) || 0
  const packConvenzionale =
    (initial?.unit || 'pz') !== 'pz' && packIniziale === toBaseQty(1, initUnit)
  const [form, setForm] = useState({
    name: initial?.name ?? '',
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
    content_size:
      packIniziale > 0 && !packConvenzionale ? String(fromBaseQty(packIniziale, contUnita)) : '',
    content_unit: contUnita,
    // LA RESA: quanto rende una unità di quello che si compra, quando si usa
    // in un'altra unità (1 kg di limoni = 50 cl di succo). Si scrive
    // nell'unità in cui la si pensa, non in unità base. Riaprendo si legge
    // sempre riferita a UNA unità: è lo stesso rapporto, scritto nel modo
    // più corto.
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
    resa_da_qty: '1',
    low_threshold: initial?.low_threshold ? String(fromBaseQty(initial.low_threshold, initUnit)) : '',
    bottles: '',
    open_content: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const num = (v) => Number(String(v).replace(',', '.')) || 0
  const costNum = num(form.cost)
  // I due tipi che si contano a pezzi: la bottiglia venduta intera e quella
  // versata. Condividono la domanda sul contenuto; cambia solo se è
  // facoltativa (intero: serve al confronto) o obbligatoria (versato: senza
  // non si scarica).
  const aPezzo = tipo === 'intero' || tipo === 'versato'
  // Il contenuto di un pezzo, in unità base della sua famiglia.
  const contenutoPezzo = toBaseQty(num(form.content_size), form.content_unit)

  // Il costo si scrive per unità d'acquisto ma sotto resta salvato PER
  // CONFEZIONE, che è quello che il resto dell'app legge da sempre. I
  // prodotti storici gestiti a volume hanno una confezione vera (la
  // bottiglia da 700 ml): il suo contenuto, letto nell'unità del prezzo, è
  // il fattore fra i due. Per tutto il resto la confezione È una unità.
  const packInUnit =
    tipo === 'sfuso' && !unitaGenerica(unita) && packIniziale > 0 && baseUnit(unita) === initialBase
      ? fromBaseQty(packIniziale, unita)
      : 0

  const baseChanged = isEdit && !!tipo && baseUnit(unita) !== initialBase
  // Passare a «lavoro» azzera la giacenza anche quando la base non cambia
  // (il ghiaccio in U che diventa servizio): l'avviso serve uguale.
  const diventaLavoro = isEdit && tipo === 'lavoro' && tipoIniziale !== 'lavoro'
  // Conversione possibile solo sapendo quanto contiene un pezzo: verso i
  // pezzi vale il contenuto appena scritto (o quello già salvato), dai
  // pezzi quello salvato — il form non lo chiede più da nessun'altra parte.
  const convertible = (() => {
    if (!baseChanged) return true
    const toPz = baseUnit(unita) === 'pz'
    const fromPz = initialBase === 'pz'
    if (toPz && !fromPz) return contenutoPezzo > 0 || packIniziale > 0
    if (fromPz && !toPz) return packIniziale > 0
    return true // liquidi ↔ solidi: nessuna conversione, il numero resta
  })()
  // Giacenza convertita quando si cambia il modo di gestire l'articolo:
  //   liquido/peso → pezzi  : quante bottiglie sono (stock / contenuto pezzo)
  //   pezzi → liquido/peso  : contenuto totale (pezzi × contenuto pezzo)
  // Fra liquidi e pesi non c'è conversione sensata: il numero resta com'è
  // (è una ri-catalogazione, non un travaso).
  const convertedStock = () => {
    const cur = Number(initial?.stock) || 0
    const toPz = baseUnit(unita) === 'pz'
    const fromPz = initialBase === 'pz'
    if (toPz && !fromPz) {
      const size = contenutoPezzo > 0 ? contenutoPezzo : packIniziale
      return size > 0 ? Math.round((cur / size) * 100) / 100 : cur
    }
    if (fromPz && !toPz) {
      return packIniziale > 0 ? cur * packIniziale : cur
    }
    return cur
  }
  // Quanto contiene un pezzo, scritto com'è leggibile: è il numero su cui
  // si fa la conversione, ed è la prima domanda di chi legge l'avviso.
  const contenutoDiRiferimento = (() => {
    const versoPz = baseUnit(unita) === 'pz'
    const base = versoPz && contenutoPezzo > 0 ? contenutoPezzo : packIniziale
    if (!(base > 0)) return null
    return formatQty(base, versoPz && contenutoPezzo > 0 ? baseUnit(form.content_unit) : initialBase)
  })()

  // Cosa finisce salvato, per tipo (il modello dati è quello di sempre):
  //   intero  → unit 'pz', contenuto facoltativo (solo costo al cl), scorta
  //   versato → unit 'pz', contenuto OBBLIGATORIO, scorta
  //   sfuso   → unit scelta, resa facoltativa, scorta (anche il ghiaccio)
  //   lavoro  → unit 'U', niente giacenza né soglia, NON scorta
  const packBase = (() => {
    if (!tipo || tipo === 'lavoro') return null
    if (aPezzo) return contenutoPezzo > 0 ? contenutoPezzo : null
    if (unitaGenerica(unita)) return null
    // Lo sfuso tiene la confezione che aveva (la bottiglia da 700 ml dei
    // prodotti storici): riscriverla vorrebbe dire cambiare i conti di un
    // articolo che nessuno ha toccato. Per il resto, una confezione È una
    // unità d'acquisto.
    return packIniziale > 0 && baseUnit(unita) === initialBase
      ? packIniziale
      : toBaseQty(1, unita)
  })()

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    // Senza il tipo non si sa nemmeno in che unità salvare: la domanda
    // iniziale non si salta.
    if (!tipo) {
      setAvviso('Scegli prima che tipo di prodotto è: da lì escono i campi giusti.')
      return
    }
    // Un «versato» senza contenuto è una bottiglia di cui non si sa quanto
    // fa: niente costo al cl e niente scarico di quello che si versa.
    // Meglio fermarsi e dirlo che salvare un prodotto che non scala.
    if (tipo === 'versato' && !(contenutoPezzo > 0)) {
      setAvviso(
        'Scrivi quanto fa una bottiglia (es. 70 cl): senza quel numero non si può calcolare il costo al cl né scalare il magazzino quando si versa.'
      )
      return
    }
    setAvviso(null)
    setSaving(true)
    try {
      // LA RESA SI SALVA COME RAPPORTO: quante unità base d'uso rende UNA
      // unità base d'acquisto. Scritta «5 kg fanno 1,5 l» diventa 0,3 ml
      // per grammo, e da lì lo scarico fa la proporzione su qualunque
      // quantità si versi. Vedi resaUso in lib/inventory. Solo per lo
      // sfuso: sul pezzo la stessa cosa la dice già il contenuto.
      const resaBase = (() => {
        if (tipo !== 'sfuso') return null
        const uso = toBaseQty(num(form.resa_qty), form.resa_unit)
        const preso = toBaseQty(num(form.resa_da_qty) || 1, unita)
        if (!(uso > 0) || !(preso > 0)) return null
        return uso / preso
      })()
      const base = {
        name: form.name.trim(),
        // Il tipo si salva sull'item: alla prossima apertura non si deduce
        // più. Le schede vecchie, che non ce l'hanno, passano da
        // tipoDerivato.
        tipo,
        unit: baseUnit(unita), // base in cui è salvato lo stock
        display_unit: unita, // unità scelta per inserimento/visualizzazione
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
        content_unit: aPezzo && packBase ? baseUnit(form.content_unit) : null,
        resa: resaBase,
        resa_unit: resaBase ? baseUnit(form.resa_unit) : null,
        // La scorta la decide il tipo: tutto si scarica — anche il ghiaccio,
        // che si conta a unità ma a mezzanotte è finito — tranne il lavoro,
        // che non sta su nessuno scaffale.
        scorta: tipo !== 'lavoro',
        // La soglia è scritta nell'unità d'acquisto: qtyInStockUnit la porta
        // in quella della giacenza, lo stesso passaggio che fa lo scarico.
        low_threshold: qtyInStockUnit(num(form.low_threshold), unita, {
          unit: baseUnit(unita),
          package_size: packBase,
          content_unit: aPezzo && packBase ? baseUnit(form.content_unit) : null,
          resa: resaBase,
          resa_unit: resaBase ? baseUnit(form.resa_unit) : null,
        }),
      }
      // LAVORO O SERVIZIO: non è una scorta, quindi non c'è nessuna giacenza
      // da salvare né bottiglie da contare — e nessuna conversione da fare,
      // perché non c'è niente da convertire.
      if (tipo === 'lavoro') {
        await onSave({ ...base, stock: 0, bottles_total: 0, low_threshold: 0 })
        return
      }
      // Cambio del modo di gestire l'articolo SENZA sapere quanto contiene
      // un pezzo: la conversione non è calcolabile e si salverebbe una
      // giacenza falsa (24 pezzi → 24 ml). Meglio fermarsi e chiederlo.
      if (baseChanged && !convertible) {
        setAvviso('Scrivi prima quanto fa un pezzo: senza, la giacenza non si può convertire.')
        return
      }
      if (isEdit) {
        // In modifica la giacenza NON si tocca... a meno che si cambi il modo
        // di gestire l'articolo (es. da centilitri a pezzi): allora si
        // converte, altrimenti il numero salvato vorrebbe dire un'altra cosa.
        if (baseChanged) {
          const stock = convertedStock()
          await onSave({
            ...base,
            stock,
            bottles_total:
              baseUnit(unita) === 'pz' ? Math.round(stock) : Math.floor(stock / (packBase || 1)),
          })
        } else {
          await onSave(base)
        }
      } else {
        // In creazione la giacenza è quello che si scrive: i pezzi per chi
        // conta a pezzi — più la frazione della bottiglia già aperta, che
        // non è né zero né uno — la quantità nell'unità d'acquisto per lo
        // sfuso.
        let stock
        if (aPezzo) {
          const pieni = Math.max(0, Math.round(num(form.bottles)))
          const apertaBase =
            tipo === 'versato' ? toBaseQty(num(form.open_content), form.content_unit) : 0
          stock = pieni + (apertaBase > 0 && contenutoPezzo > 0 ? apertaBase / contenutoPezzo : 0)
        } else {
          stock = toBaseQty(num(form.bottles), unita)
        }
        await onSave({ ...base, stock, bottles_total: 0 })
      }
    } finally {
      setSaving(false)
    }
  }

  const etichettaUnita = UNIT_LABEL[String(unita).toLowerCase()] || unita
  // L'unità di uno sfuso storico scritto in ml o mg resta in lista: se
  // sparisse dal select il prodotto sembrerebbe un altro.
  const opzioniSfuso = UNITA_SFUSO.some(([u]) => u === unitSfuso)
    ? UNITA_SFUSO
    : [...UNITA_SFUSO, [unitSfuso, UNIT_LABEL[String(unitSfuso).toLowerCase()] || unitSfuso]]

  return (
    <form className="card inv-scheda" onSubmit={submit}>
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

      {/* ── LA DOMANDA INIZIALE ───────────────────────────────────
          Quattro card, non una tendina: si leggono tutte insieme, con
          l'esempio accanto, e si sceglie con un tocco. Da qui escono
          unità, scorta e campi: il resto della scheda è conseguenza. */}
      <h4 className="inv-domanda">Che tipo di prodotto è?</h4>
      <div className="inv-tipi" role="radiogroup" aria-label="Che tipo di prodotto è?">
        {TIPI_PRODOTTO.map(([t, icona, titolo, esempio]) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            className={`inv-tipo${tipo === t ? ' scelto' : ''}`}
            onClick={() => {
              setTipo(t)
              setAvviso(null)
            }}
          >
            <span className="inv-tipo-icona" aria-hidden>{icona}</span>
            <span className="inv-tipo-testo">
              <strong>{titolo}</strong> <span className="muted small">{esempio}</span>
            </span>
          </button>
        ))}
      </div>

      {tipo === 'lavoro' && (
        <p className="muted small" style={{ margin: '2px 0 8px' }}>
          Non è merce: niente giacenza, mai esaurito, e in carta al cliente
          non compare. Entra nelle ricette col suo costo per unità.
        </p>
      )}

      {tipo === 'sfuso' && (
        <>
          <label htmlFor="iunit">Come lo compri</label>
          <select id="iunit" value={unitSfuso} onChange={(e) => setUnitSfuso(e.target.value)}>
            {opzioniSfuso.map(([u, label]) => (
              <option key={u} value={u}>{label}</option>
            ))}
          </select>
        </>
      )}

      {tipo && (
        <>
          <div className="grid-2">
            <div>
              {/* L'etichetta segue come si compra: €/pz per le bottiglie,
                  €/kg per i limoni, €/U per il tempo di lavorazione. */}
              <label htmlFor="icost">Costo €/{etichettaUnita} (netto)</label>
              <input id="icost" type="number" step="any" min="0" value={form.cost} onChange={set('cost')} placeholder="Es. 12,9" />
            </div>
            <div>
              <label htmlFor="ivat">IVA acquisto %</label>
              <input id="ivat" type="number" step="any" min="0" value={form.vat} onChange={set('vat')} />
            </div>
          </div>
          {costNum > 0 && (
            <div className="muted small">
              +IVA {formatPrice(costWithVat(costNum, form.vat))}/{etichettaUnita}
              {/* Quanto viene la confezione intera: è la cifra che si
                  ritrova sulla fattura del fornitore. */}
              {packInUnit > 0 && packInUnit !== 1 &&
                ` · confezione ${formatPrice(costWithVat(costNum * packInUnit, form.vat))}`}
            </div>
          )}
        </>
      )}

      {/* Passando a «lavoro» la giacenza sparisce del tutto: quella voce
          non è una scorta, e va detto PRIMA di salvare. */}
      {diventaLavoro && (Number(initial?.stock) || 0) > 0 && (
        <div className="banner" style={{ marginTop: 8 }}>
          ⚠️ Il lavoro non è una scorta: la giacenza attuale (
          {fmtItem(initial?.stock, initial)}) non serve più e viene{' '}
          <strong>azzerata</strong>.
        </div>
      )}

      {/* Cambio del modo di gestire l'articolo: si dice CHIARAMENTE come
          finisce la giacenza, prima di salvare. */}
      {baseChanged && tipo !== 'lavoro' && (
        <div className="banner" style={{ marginTop: 8 }}>
          ⚠️ Cambi la gestione da <strong>{GESTIONE_LABEL[initialBase]}</strong>{' '}
          a <strong>{GESTIONE_LABEL[baseUnit(unita)]}</strong>: la giacenza
          attuale ({fmtItem(initial?.stock, initial)}) diventerà{' '}
          <strong>{formatQty(convertedStock(), baseUnit(unita))}</strong>.
          {/* IN BASE A COSA. Il conto è sempre quello: quanto contiene un
              pezzo. Scritto qui perché è la prima domanda di chi legge
              l'avviso, e prima non c'era risposta. */}
          {contenutoDiRiferimento && (
            <span className="muted">
              {' '}
              Il conto si fa sul contenuto di un pezzo ({contenutoDiRiferimento}).
            </span>
          )}
          {!convertible && (
            <div style={{ marginTop: 6 }}>
              ⛔ Scrivi prima <strong>quanto fa un pezzo</strong>: senza, la
              giacenza non si può convertire.
            </div>
          )}
        </div>
      )}

      {aPezzo && (
        <>
          {/* Il contenuto di un pezzo: per chi VERSA è il numero da cui
              escono costo al cl e scarico; per chi vende intero serve solo
              al confronto. La domanda che si fa chi carica la merce — una
              bottiglia fa 70 cl — non «quanto ne va in un drink». */}
          <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 8 }}>
            <label htmlFor="icontent" style={{ margin: 0 }}>
              {tipo === 'versato' ? 'Una bottiglia fa…' : 'Dentro c’è… (facoltativo)'}
            </label>
            <button
              type="button"
              className="inv-aiuto piccolo"
              aria-label="Come funziona il contenuto di un pezzo"
              title="Come funziona"
              onClick={() => setAiutoPezzo(true)}
            >
              ?
            </button>
          </div>
          {aiutoPezzo && <AiutoPezzo onClose={() => setAiutoPezzo(false)} />}
          <div className="row" style={{ gap: 6 }}>
            <input
              id="icontent"
              type="number"
              step="any"
              min="0"
              className="grow"
              value={form.content_size}
              onChange={set('content_size')}
              placeholder={
                tipo === 'versato'
                  ? 'Es. 70 per una bottiglia da 70 cl'
                  : 'Es. 33 per una lattina da 33 cl'
              }
            />
            <select
              value={form.content_unit}
              onChange={set('content_unit')}
              aria-label="Unità del contenuto"
              style={{ width: 90 }}
            >
              {CONTENUTO_UNITA.map((u) => (
                <option key={u} value={u}>{UNIT_LABEL[u.toLowerCase()] || u}</option>
              ))}
            </select>
          </div>
          <p className="muted small" style={{ margin: '2px 0 8px' }}>
            {tipo === 'versato'
              ? 'Da qui escono il costo al cl e lo scarico: 4 cl da una bottiglia da 70 scalano la loro frazione.'
              : 'Solo per confrontare il costo al cl con le altre bottiglie: si vende intero e il magazzino conta pezzi.'}
          </p>
        </>
      )}

      {tipo === 'sfuso' && (
        <>
          {/* ── SI USA IN UN'ALTRA MISURA? ────────────────────────────
              LA QUANTITÀ SI SCRIVE SU TUTTI E DUE I LATI. «Cinque chili di
              limoni fanno un litro e mezzo di succo» è come si dice al
              banco; costringere a scrivere quanto ne fa UN chilo vuol dire
              far fare a mano una divisione, e sbagliarla. Sotto resta un
              rapporto, ed è quello che usa lo scarico: la proporzione vale
              per qualunque quantità. */}
          <label htmlFor="iresa" style={{ marginTop: 8 }}>
            Si usa in un&apos;altra misura? (facoltativo)
          </label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input
              id="iresa-da"
              type="number"
              step="any"
              min="0"
              value={form.resa_da_qty}
              onChange={set('resa_da_qty')}
              aria-label="Quanto ne prendi"
              style={{ width: 80 }}
            />
            <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
              {etichettaUnita} fanno
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
              {UNITA_USO.map(([u, label]) => (
                <option key={u} value={u}>{label}</option>
              ))}
            </select>
          </div>
          <p className="muted small" style={{ margin: '2px 0 8px' }}>
            Es. i limoni: si comprano al chilo, si spremono in cl. Le ricette
            lo dosano nell&apos;unità d&apos;uso; la giacenza resta quella che
            conti sullo scaffale.
          </p>
        </>
      )}

      {!isEdit && aPezzo && (
        <>
          <label htmlFor="ibottles">Quantità iniziale (pezzi)</label>
          <input id="ibottles" type="number" step="1" min="0" value={form.bottles} onChange={set('bottles')} />
          {tipo === 'versato' && (
            <>
              {/* La bottiglia già aperta al momento del censimento: mezzo
                  gin non è né zero né uno, è la sua frazione di pezzo. */}
              <label htmlFor="iopen">
                Confezione aperta — contenuto (
                {UNIT_LABEL[String(form.content_unit).toLowerCase()] || form.content_unit}) —
                opzionale
              </label>
              <input
                id="iopen"
                type="number"
                step="any"
                min="0"
                value={form.open_content}
                onChange={set('open_content')}
                placeholder="Es. 40 se una è aperta a metà"
              />
            </>
          )}
        </>
      )}
      {!isEdit && tipo === 'sfuso' && (
        <>
          {/* SI SCRIVE QUANTO SE NE HA, nell'unità in cui si compra:
              l'inventario si fa contando quello che sta sullo scaffale. */}
          <label htmlFor="ibottles">Quantità iniziale ({etichettaUnita})</label>
          <input id="ibottles" type="number" step="any" min="0" value={form.bottles} onChange={set('bottles')} placeholder="Es. 3" />
        </>
      )}

      {/* Niente soglia per il lavoro: non finisce, quindi non c'è niente
          da avvisare e niente da riordinare al fornitore. */}
      {tipo && tipo !== 'lavoro' && (
        <>
          {/* LA SOGLIA È SEMPRE NELL'UNITÀ D'ACQUISTO: è il prodotto
              comprato che sta finendo, ed è quello che si va a ricomprare. */}
          <label htmlFor="ithr">Soglia di avviso ({etichettaUnita})</label>
          <input
            id="ithr"
            type="number"
            step="any"
            min="0"
            value={form.low_threshold}
            onChange={set('low_threshold')}
            placeholder="Es. 2 se vuoi l’avviso quando ne restano due"
          />
          <p className="muted small" style={{ margin: '2px 0 8px' }}>
            Sotto questo livello l’articolo compare fra quelli in esaurimento.
          </p>
        </>
      )}

      {avviso && (
        <div className="banner" role="alert" style={{ marginTop: 8 }}>
          {avviso}
        </div>
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
