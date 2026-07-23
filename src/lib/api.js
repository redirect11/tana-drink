import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  documentId,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebaseClient.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { splitAmounts } from './groups.js'
import { createSumUpSale, updateSumUpSaleStatus, toSumUpStatus } from './sumupApi.js'
import { computeConsumption, formatQty } from './inventory.js'
import { consumptionDiff } from './warehouse.js'
import {
  ORDER_OPEN,
  normalizeOrderDoc,
  activeComanda,
  allServed,
  serveAllComande,
  aggregateItems,
  comandeStatuses,
  itemsTotal as sumItems,
} from './comande.js'
import { discountAmount, orderDue, paymentCloses, summaryMethod } from './pagamento.js'
import { hoursBetweenIso } from './ore.js'
import { businessDayKey, coverageStart, DEFAULT_CUTOFF_HOUR } from './businessDay.js'
import { recentDrinkIds } from './posCatalog.js'
import { DEFAULT_MARKUP, DEFAULT_ROUND_STEP } from './pricing.js'
import { notify } from './notify.js'

const drinksCol = collection(db, 'drinks')
const ordersCol = collection(db, 'orders')
// Progressivo assoluto degli ordini (id interno che non riparte mai).
const serialCounterRef = doc(db, 'counters', 'serial')
const categoriesCol = collection(db, 'categories')
const inventoryCol = collection(db, 'inventory_items')
const inventoryCategoriesCol = collection(db, 'inventory_categories')
const macroCategoriesCol = collection(db, 'macro_categories')
const suppliersCol = collection(db, 'suppliers')
const movementsCol = collection(db, 'stock_movements')
const settingsDoc = doc(db, 'settings', 'bar')
const groupsCol = collection(db, 'groups')
const paymentsCol = collection(db, 'payments')
const cashSessionsCol = collection(db, 'cash_sessions')
const invoicesCol = collection(db, 'invoices')
const vouchersCol = collection(db, 'vouchers')

// --- Helpers ------------------------------------------------------------

// Converte un Timestamp Firestore in stringa ISO (compatibile con created_at).
function toIso(value) {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  return value
}

// Mappa un documento "drink" alla forma usata dalla UI.
function mapDrink(snap) {
  const d = snap.data() || {}
  return {
    id: snap.id,
    name: d.name,
    description: d.description ?? null,
    category: d.category ?? null,
    category_id: d.category_id ?? null,
    recipe: d.recipe ?? null,
    recipe_items: Array.isArray(d.recipe_items) ? d.recipe_items : [],
    price: d.price ?? 0,
    available: d.available ?? true,
    image_url: d.image_url ?? null,
    created_at: toIso(d.created_at),
  }
}

// Mappa una categoria.
function mapCategory(snap) {
  const c = snap.data() || {}
  return {
    id: snap.id,
    name: c.name ?? '',
    sort_order: c.sort_order ?? 0,
    icon: c.icon ?? null, // emoji scelta per la categoria (opzionale)
    color: c.color ?? null, // colore custom (hex); null = colore automatico
    macro_id: c.macro_id ?? null, // macro-categoria di appartenenza (inventario)
    created_at: toIso(c.created_at),
  }
}

// Mappa un item di inventario.
function mapItem(snap) {
  const i = snap.data() || {}
  return {
    id: snap.id,
    name: i.name ?? '',
    unit: i.unit ?? 'pz',
    stock: Number(i.stock) || 0,
    package_size: i.package_size ?? null,
    bottles_total: Number(i.bottles_total) || 0,
    low_threshold: Number(i.low_threshold) || 0,
    category_id: i.category_id ?? null,
    supplier_id: i.supplier_id ?? null,
    cost: i.cost != null ? Number(i.cost) : null,
    vat: i.vat != null ? Number(i.vat) : 22,
    status: i.status ?? 'linea',
    created_at: toIso(i.created_at),
  }
}

function mapMovement(snap) {
  const m = snap.data() || {}
  return {
    id: snap.id,
    item_id: m.item_id ?? null,
    item_name: m.item_name ?? '',
    type: m.type ?? 'unload',
    qty: Number(m.qty) || 0,
    unit: m.unit ?? null,
    reason: m.reason ?? null,
    order_id: m.order_id ?? null,
    created_at: toIso(m.created_at),
  }
}

function mapOrder(snap) {
  const o = snap.data() || {}
  const items = Array.isArray(o.items) ? o.items : []
  // Normalizza al modello conto/comande (i doc legacy ottengono una comanda
  // sintetica). `workflow_status` è lo stato di lavorazione della comanda
  // attiva: è ciò che coda/cliente mostrano e fanno avanzare.
  const norm = normalizeOrderDoc(o)
  const comande = norm.comande.map((c) => ({ ...c, created_at: toIso(c.created_at) }))
  const active = activeComanda({ comande })
  const workflow =
    norm.status === ORDER_STATUSES.PAGATO || norm.status === ORDER_STATUSES.ANNULLATO
      ? norm.status
      : active
        ? active.status
        : comande.length > 0
          ? ORDER_STATUSES.RITIRATO
          : ORDER_STATUSES.RICEVUTO
  return {
    id: snap.id,
    daily_number: o.daily_number ?? null,
    order_date: o.order_date ?? null,
    table_label: o.table_label ?? null,
    note: o.note ?? null,
    status: norm.status,
    workflow_status: workflow,
    comande,
    active_comanda_id: active?.id ?? null,
    total: o.total ?? 0,
    coperto_persons: o.coperto_persons ?? 0,
    coperto_amount: o.coperto_amount ?? 0,
    service_charge_amount: o.service_charge_amount ?? 0,
    tip_amount: o.tip_amount ?? 0,
    service_mode: o.service_mode ?? null,
    placed_by: o.placed_by ?? null,
    customer_name: o.customer_name ?? null,
    customer_uid: o.customer_uid ?? null,
    // Tempi di lavorazione: quelli della comanda attiva (o gli ultimi).
    status_times: (active ?? comande[comande.length - 1])?.status_times ?? o.status_times ?? {},
    cancelled_by: o.cancelled_by ?? null,
    cancel_kind: o.cancel_kind ?? null,
    cancel_phrase: o.cancel_phrase ?? null,
    cancel_message: o.cancel_message ?? null,
    cancel_notify: o.cancel_notify ?? false,
    serial: o.serial ?? null,
    created_at: toIso(o.created_at),
    sumup_sale_id: o.sumup_sale_id ?? null,
    inventory_applied: o.inventory_applied ?? false,
    payment_method: o.payment_method ?? null,
    payment_status: o.payment_status ?? 'non_richiesto',
    // Sconto sul conto e pagamenti parziali (split alla cassa).
    discount: o.discount ?? null,
    discount_amount: o.discount_amount ?? 0,
    payments: (o.payments || []).map((p) => ({ ...p, at: toIso(p.at) })),
    // Lotteria degli scontrini e fattura di cortesia emessa.
    lottery_code: o.lottery_code ?? null,
    invoice_id: o.invoice_id ?? null,
    invoice_number: o.invoice_number ?? null,
    payment_required: o.payment_required ?? false,
    sumup_checkout_id: o.sumup_checkout_id ?? null,
    sumup_checkout_attempts: o.sumup_checkout_attempts ?? 0,
    sumup_client_transaction_id: o.sumup_client_transaction_id ?? null,
    sumup_transaction_id: o.sumup_transaction_id ?? null,
    paid_at: o.paid_at ?? null,
    payment_after_cancel: o.payment_after_cancel ?? false,
    group_id: o.group_id ?? null,
    group_name_snapshot: o.group_name_snapshot ?? null,
    payment_id: o.payment_id ?? null,
    client_temp_id: o.client_temp_id ?? null,
    order_items: items.map((i, idx) => ({
      id: `${snap.id}-${idx}`,
      drink_id: i.drink_id ?? null,
      name: i.name,
      unit_price: i.unit_price ?? 0,
      qty: i.qty ?? 1,
      sumup_product_id: i.sumup_product_id ?? null,
      custom: i.custom ?? false,
      recipe_items: i.recipe_items ?? null,
    })),
  }
}

// --- DRINKS (menù / ricette) ---

export async function fetchDrinks({ onlyAvailable = false } = {}) {
  const constraints = []
  if (onlyAvailable) constraints.push(where('available', '==', true))
  const snap = await getDocs(query(drinksCol, ...constraints))
  const drinks = snap.docs.map(mapDrink)
  // Ordina lato client per categoria poi nome (evita indici compositi).
  drinks.sort((a, b) => {
    const ca = (a.category || '').localeCompare(b.category || '')
    if (ca !== 0) return ca
    return (a.name || '').localeCompare(b.name || '')
  })
  return drinks
}

// Menù in tempo reale: i listener Firestore ritentano da soli con
// backoff — al primo accesso (token App Check non ancora pronto, rete
// lenta, prompt permessi in corso) il menù arriva appena possibile,
// senza dover ricaricare la pagina. E si aggiorna live se il bartender
// modifica il catalogo.
export function subscribeDrinks({ onlyAvailable = false } = {}, onChange, onError) {
  const constraints = []
  if (onlyAvailable) constraints.push(where('available', '==', true))
  return onSnapshot(
    query(drinksCol, ...constraints),
    (snap) => {
      const drinks = snap.docs.map(mapDrink)
      drinks.sort((a, b) => {
        const ca = (a.category || '').localeCompare(b.category || '')
        if (ca !== 0) return ca
        return (a.name || '').localeCompare(b.name || '')
      })
      onChange(drinks)
    },
    onError ?? (() => {})
  )
}

export function subscribeCategories(onChange, onError) {
  return onSnapshot(
    categoriesCol,
    (snap) => {
      const cats = snap.docs.map(mapCategory)
      cats.sort(
        (a, b) => (a.sort_order - b.sort_order) || (a.name || '').localeCompare(b.name || '')
      )
      onChange(cats)
    },
    onError ?? (() => {})
  )
}

export async function createDrink(drink) {
  const ref = await addDoc(drinksCol, {
    ...drink,
    created_at: serverTimestamp(),
  })
  const snap = await getDoc(ref)
  return mapDrink(snap)
}

export async function updateDrink(id, patch) {
  const ref = doc(db, 'drinks', id)
  await updateDoc(ref, patch)
  const snap = await getDoc(ref)
  return mapDrink(snap)
}

export async function deleteDrink(id) {
  await deleteDoc(doc(db, 'drinks', id))
}

// --- CATEGORIES ---

export async function fetchCategories() {
  const snap = await getDocs(categoriesCol)
  const cats = snap.docs.map(mapCategory)
  cats.sort((a, b) => (a.sort_order - b.sort_order) || (a.name || '').localeCompare(b.name || ''))
  return cats
}

export async function createCategory({ name, sort_order = 0, icon = null, color = null }) {
  const ref = await addDoc(categoriesCol, {
    name,
    sort_order,
    icon: icon || null,
    color: color || null,
    created_at: serverTimestamp(),
  })
  return mapCategory(await getDoc(ref))
}

export async function updateCategory(id, patch) {
  const ref = doc(db, 'categories', id)
  await updateDoc(ref, patch)
  return mapCategory(await getDoc(ref))
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, 'categories', id))
}

// --- INVENTORY ---

export async function fetchInventoryItems() {
  const snap = await getDocs(inventoryCol)
  const items = snap.docs.map(mapItem)
  items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return items
}

// Categorie dedicate ai prodotti di magazzino (distinte da quelle del menù).
export async function fetchInventoryCategories() {
  const snap = await getDocs(inventoryCategoriesCol)
  const cats = snap.docs.map(mapCategory)
  cats.sort((a, b) => (a.sort_order - b.sort_order) || (a.name || '').localeCompare(b.name || ''))
  return cats
}

export async function createInventoryCategory({ name, sort_order = 0, macro_id = null }) {
  const ref = await addDoc(inventoryCategoriesCol, { name, sort_order, macro_id, created_at: serverTimestamp() })
  return mapCategory(await getDoc(ref))
}

export async function updateInventoryCategory(id, patch) {
  const ref = doc(db, 'inventory_categories', id)
  await updateDoc(ref, patch)
  return mapCategory(await getDoc(ref))
}

export async function deleteInventoryCategory(id) {
  await deleteDoc(doc(db, 'inventory_categories', id))
}

// --- MACRO-CATEGORIE ---
// Raggruppano le categorie d'inventario (Distillati, Birre+Bibite, Vino…) per
// i conti aggregati di acquisti/fatturato. Il legame vive sulla categoria
// (campo macro_id), così una categoria sta in al più una macro.

function mapMacro(snap) {
  const m = snap.data() || {}
  return {
    id: snap.id,
    name: m.name ?? '',
    sort_order: m.sort_order ?? 0,
    created_at: toIso(m.created_at),
  }
}

export async function fetchMacroCategories() {
  const snap = await getDocs(macroCategoriesCol)
  const list = snap.docs.map(mapMacro)
  list.sort((a, b) => (a.sort_order - b.sort_order) || (a.name || '').localeCompare(b.name || ''))
  return list
}

export async function createMacroCategory({ name, sort_order = 0 }) {
  const ref = await addDoc(macroCategoriesCol, { name, sort_order, created_at: serverTimestamp() })
  return mapMacro(await getDoc(ref))
}

export async function updateMacroCategory(id, patch) {
  const ref = doc(db, 'macro_categories', id)
  await updateDoc(ref, patch)
  return mapMacro(await getDoc(ref))
}

// Eliminando una macro, le sue categorie tornano "senza macro" (non si
// perdono): si azzera macro_id su quelle che la puntano.
export async function deleteMacroCategory(id) {
  const cats = await getDocs(query(inventoryCategoriesCol, where('macro_id', '==', id)))
  await Promise.all(cats.docs.map((d) => updateDoc(d.ref, { macro_id: null })))
  await deleteDoc(doc(db, 'macro_categories', id))
}

// --- FORNITORI ---

function mapSupplier(snap) {
  const s = snap.data() || {}
  return {
    id: snap.id,
    name: s.name ?? '',
    sort_order: s.sort_order ?? 0,
    notes: s.notes ?? null,
    email: s.email ?? null,
    created_at: toIso(s.created_at),
  }
}

export async function fetchSuppliers() {
  const snap = await getDocs(suppliersCol)
  const list = snap.docs.map(mapSupplier)
  list.sort((a, b) => (a.sort_order - b.sort_order) || (a.name || '').localeCompare(b.name || ''))
  return list
}

export async function createSupplier({ name, sort_order = 0, notes = null }) {
  const ref = await addDoc(suppliersCol, { name, sort_order, notes, created_at: serverTimestamp() })
  return mapSupplier(await getDoc(ref))
}

export async function updateSupplier(id, patch) {
  const ref = doc(db, 'suppliers', id)
  await updateDoc(ref, patch)
  return mapSupplier(await getDoc(ref))
}

export async function deleteSupplier(id) {
  await deleteDoc(doc(db, 'suppliers', id))
}

export async function createInventoryItem(item) {
  const ref = await addDoc(inventoryCol, {
    ...item,
    stock: Number(item.stock) || 0,
    low_threshold: Number(item.low_threshold) || 0,
    created_at: serverTimestamp(),
  })
  return mapItem(await getDoc(ref))
}

export async function updateInventoryItem(id, patch) {
  const ref = doc(db, 'inventory_items', id)
  await updateDoc(ref, patch)
  return mapItem(await getDoc(ref))
}

export async function deleteInventoryItem(id) {
  await deleteDoc(doc(db, 'inventory_items', id))
}

// Carico merce: incrementa lo stock e registra un movimento (atomico).
// `qty` è già in unità base; può essere negativo per uno scarico manuale.
export async function loadStock(itemId, qty, { reason = 'carico' } = {}) {
  const ref = doc(db, 'inventory_items', itemId)
  const s = await getDoc(ref)
  if (!s.exists()) throw new Error('Prodotto non trovato')
  const cur = s.data()
  await updateDoc(ref, { stock: (Number(cur.stock) || 0) + qty })
  await addDoc(movementsCol, {
    item_id: itemId,
    item_name: cur.name,
    type: qty >= 0 ? 'load' : 'unload',
    qty: Math.abs(qty),
    unit: cur.unit ?? null,
    reason,
    created_at: serverTimestamp(),
  })
  return mapItem(await getDoc(ref))
}

// Carico a confezioni: aggiunge `count` bottiglie piene (+ eventuale bottiglia
// aperta con `openQty` di contenuto). Aggiorna giacenza e numero totale di
// bottiglie, scartando le vuote accumulate (al riassortimento si buttano).
export async function receiveBottles(itemId, count, openQty = 0) {
  const ref = doc(db, 'inventory_items', itemId)
  const s = await getDoc(ref)
  if (!s.exists()) throw new Error('Prodotto non trovato')
  const cur = s.data()
  const size = Number(cur.package_size) || 0
  const stock = Number(cur.stock) || 0
  const full = size ? Math.floor(stock / size) : 0
  const hasOpen = size ? stock - full * size > 1e-9 : false
  const withContent = full + (hasOpen ? 1 : 0)

  const addQty = count * size + openQty
  const newStock = stock + addQty
  const newTotal = withContent + count + (openQty > 0 ? 1 : 0)

  await updateDoc(ref, { stock: newStock, bottles_total: newTotal })
  await addDoc(movementsCol, {
    item_id: itemId,
    item_name: cur.name,
    type: 'load',
    qty: addQty,
    unit: cur.unit ?? null,
    reason: 'carico',
    created_at: serverTimestamp(),
  })
  return mapItem(await getDoc(ref))
}

// Rettifica: imposta lo stock a un valore assoluto e registra il delta.
export async function adjustStock(itemId, newStock) {
  const ref = doc(db, 'inventory_items', itemId)
  const s = await getDoc(ref)
  if (!s.exists()) throw new Error('Prodotto non trovato')
  const cur = s.data()
  const delta = newStock - (Number(cur.stock) || 0)
  const size = Number(cur.package_size) || 0
  // Mantieni coerente il numero totale di bottiglie con la nuova giacenza.
  const minTotal = size ? Math.ceil(newStock / size) : 0
  const patch = { stock: newStock }
  if (minTotal > (Number(cur.bottles_total) || 0)) patch.bottles_total = minTotal
  await updateDoc(ref, patch)
  if (delta !== 0) {
    await addDoc(movementsCol, {
      item_id: itemId,
      item_name: cur.name,
      type: delta > 0 ? 'load' : 'unload',
      qty: Math.abs(delta),
      unit: cur.unit ?? null,
      reason: 'rettifica',
      created_at: serverTimestamp(),
    })
  }
  return mapItem(await getDoc(ref))
}

export async function fetchStockMovements({ limit = 50 } = {}) {
  const snap = await getDocs(query(movementsCol, orderBy('created_at', 'desc'), fbLimit(limit)))
  return snap.docs.map(mapMovement)
}

// Carichi registrati dopo una certa data (per la colonna ACQ della conta).
// Filtro per tipo lato client: la query resta su un solo campo (niente
// indici compositi).
export async function fetchLoadMovementsSince(iso) {
  const snap = await getDocs(
    query(movementsCol, where('created_at', '>', Timestamp.fromDate(new Date(iso))))
  )
  return snap.docs.map(mapMovement).filter((m) => m.type === 'load')
}

// --- CONTA DI MAGAZZINO (inventario periodico: DEP → ACQ → RIM → CONS) ---

function mapStockCount(snap) {
  const c = snap.data() || {}
  return {
    id: snap.id,
    status: c.status ?? 'open',
    started_at: toIso(c.started_at),
    closed_at: toIso(c.closed_at),
    lines: Array.isArray(c.lines) ? c.lines : [],
    totals: c.totals ?? null,
  }
}

// La conta aperta (al più una), o null.
export async function getOpenStockCount() {
  const snap = await getDocs(
    query(collection(db, 'stock_counts'), where('status', '==', 'open'), fbLimit(1))
  )
  return snap.empty ? null : mapStockCount(snap.docs[0])
}

// Apre una nuova conta fotografando la giacenza corrente (DEP) di ogni
// prodotto; costi/formnum denormalizzati per calcolare i valori alla chiusura.
export async function startStockCount(items) {
  const existing = await getOpenStockCount()
  if (existing) return existing
  const lines = (items || []).map((it) => ({
    item_id: it.id,
    name: it.name,
    unit: it.unit,
    package_size: it.package_size ?? null,
    cost: it.cost ?? null,
    vat: it.vat ?? 22,
    dep: it.stock,
    acq: 0,
    rim: null,
  }))
  const ref = await addDoc(collection(db, 'stock_counts'), {
    status: 'open',
    started_at: serverTimestamp(),
    lines,
    totals: null,
  })
  return mapStockCount(await getDoc(ref))
}

// Salva le rimanenze inserite (senza chiudere la conta).
export async function updateStockCountLines(id, lines) {
  await updateDoc(doc(db, 'stock_counts', id), { lines })
}

// Chiude la conta salvando righe complete (cons/valori) e totali.
// Se align=true le giacenze dei prodotti vengono allineate alle rimanenze
// contate (con movimento di rettifica per la differenza).
export async function closeStockCount(id, { lines, totals, align = true }) {
  const countRef = doc(db, 'stock_counts', id)
  const countSnap = await getDoc(countRef)
  if (!countSnap.exists()) throw new Error('Conta non trovata')
  if (countSnap.data().status !== 'open') throw new Error('Conta già chiusa')

  const toAlign = align ? lines.filter((l) => l.rim != null && l.rim !== '') : []
  const itemSnaps = await Promise.all(
    toAlign.map((l) => getDoc(doc(db, 'inventory_items', l.item_id)))
  )

  for (let idx = 0; idx < toAlign.length; idx++) {
    const l = toAlign[idx]
    const s = itemSnaps[idx]
    if (!s.exists()) continue
    const cur = s.data()
    const rim = Number(l.rim) || 0
    const delta = rim - (Number(cur.stock) || 0)
    if (delta === 0) continue
    // Rettifica a valore assoluto: la conta è una fotografia autorevole,
    // quindi qui si imposta lo stock (non increment).
    await updateDoc(doc(db, 'inventory_items', l.item_id), { stock: rim })
    await addDoc(movementsCol, {
      item_id: l.item_id,
      item_name: cur.name,
      type: delta > 0 ? 'load' : 'unload',
      qty: Math.abs(delta),
      unit: cur.unit ?? null,
      reason: 'conta',
      created_at: serverTimestamp(),
    })
  }

  await updateDoc(countRef, {
    status: 'closed',
    closed_at: serverTimestamp(),
    lines,
    totals,
  })
}

export async function fetchStockCounts({ limit = 20 } = {}) {
  const snap = await getDocs(
    query(collection(db, 'stock_counts'), orderBy('started_at', 'desc'), fbLimit(limit))
  )
  return snap.docs.map(mapStockCount)
}

// --- ORDINI FORNITORE (generatore ordini + storico) ---

function mapPurchaseOrder(snap) {
  const o = snap.data() || {}
  return {
    id: snap.id,
    supplier_id: o.supplier_id ?? null,
    supplier_name: o.supplier_name ?? '',
    status: o.status ?? 'inviato', // inviato | ricevuto
    created_at: toIso(o.created_at),
    received_at: toIso(o.received_at),
    lines: Array.isArray(o.lines) ? o.lines : [],
    total_net: Number(o.total_net) || 0,
    total_gross: Number(o.total_gross) || 0,
  }
}

export async function createPurchaseOrder({ supplier_id, supplier_name, lines, total_net, total_gross }) {
  const ref = await addDoc(collection(db, 'purchase_orders'), {
    supplier_id,
    supplier_name,
    status: 'inviato',
    created_at: serverTimestamp(),
    received_at: null,
    lines,
    total_net,
    total_gross,
  })
  return mapPurchaseOrder(await getDoc(ref))
}

export async function fetchPurchaseOrders({ limit = 30 } = {}) {
  const snap = await getDocs(
    query(collection(db, 'purchase_orders'), orderBy('created_at', 'desc'), fbLimit(limit))
  )
  return snap.docs.map(mapPurchaseOrder)
}

export async function deletePurchaseOrder(id) {
  await deleteDoc(doc(db, 'purchase_orders', id))
}

// Segna un ordine come ricevuto e carica la merce a magazzino: per ogni riga
// aumenta la giacenza (confezioni × contenuto, o pezzi) e registra il
// movimento; le bottiglie totali vengono aggiornate scartando le vuote,
// come nel carico manuale.
export async function receivePurchaseOrder(id) {
  const orderRef = doc(db, 'purchase_orders', id)
  const orderSnap = await getDoc(orderRef)
  if (!orderSnap.exists()) throw new Error('Ordine non trovato')
  const order = orderSnap.data()
  if (order.status === 'ricevuto') return

  const lines = (order.lines || []).filter((l) => (Number(l.qty_packages) || 0) > 0)
  const itemSnaps = await Promise.all(
    lines.map((l) => getDoc(doc(db, 'inventory_items', l.item_id)))
  )

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx]
    const s = itemSnaps[idx]
    if (!s.exists()) continue
    const cur = s.data()
    const qty = Number(l.qty_packages) || 0
    const size = Number(cur.package_size) || 0
    const stock = Number(cur.stock) || 0

    let addQty
    const patch = {}
    if (cur.unit === 'pz' || !size) {
      addQty = qty
      patch.stock = increment(addQty)
    } else {
      addQty = qty * size
      const full = Math.floor(stock / size)
      const hasOpen = stock - full * size > 1e-9
      patch.stock = increment(addQty)
      patch.bottles_total = full + (hasOpen ? 1 : 0) + qty
    }
    await updateDoc(doc(db, 'inventory_items', l.item_id), patch)
    await addDoc(movementsCol, {
      item_id: l.item_id,
      item_name: cur.name,
      type: 'load',
      qty: addQty,
      unit: cur.unit ?? null,
      reason: 'ordine fornitore',
      created_at: serverTimestamp(),
    })
  }

  await updateDoc(orderRef, { status: 'ricevuto', received_at: serverTimestamp() })
}

// --- SCADENZARIO FORNITORI (documenti / pagamenti) ---

function mapInvoice(snap) {
  const i = snap.data() || {}
  return {
    id: snap.id,
    supplier_id: i.supplier_id ?? null,
    supplier_name: i.supplier_name ?? '',
    number: i.number ?? '',
    doc_type: i.doc_type ?? 'Proforma',
    date: i.date ?? null, // YYYY-MM-DD
    amount: Number(i.amount) || 0,
    paid: !!i.paid,
    notes: i.notes ?? null,
    created_at: toIso(i.created_at),
  }
}

export async function fetchSupplierInvoices({ limit = 100 } = {}) {
  const snap = await getDocs(
    query(collection(db, 'supplier_invoices'), orderBy('date', 'desc'), fbLimit(limit))
  )
  return snap.docs.map(mapInvoice)
}

export async function createSupplierInvoice(invoice) {
  const ref = await addDoc(collection(db, 'supplier_invoices'), {
    ...invoice,
    amount: Number(invoice.amount) || 0,
    paid: !!invoice.paid,
    created_at: serverTimestamp(),
  })
  return mapInvoice(await getDoc(ref))
}

export async function updateSupplierInvoice(id, patch) {
  await updateDoc(doc(db, 'supplier_invoices', id), patch)
}

export async function deleteSupplierInvoice(id) {
  await deleteDoc(doc(db, 'supplier_invoices', id))
}

// --- SERVIZIO (perpetuo) ---
// Niente più "serate": il locale lavora in continuità. I conti restano
// aperti finché non li si chiude a mano, anche a giorni di distanza. Le
// giornate servono solo a RAGGRUPPARE a posteriori (giornata commerciale
// con ora di taglio, vedi businessDay.js), non a delimitare il lavoro.

// Statistiche tempi del servizio (perpetue, non più per serata):
// prep_stats (attesa+preparazione, tutti gli ordini) e eta_stats (ciclo
// completo, solo ordini serviti al tavolo). Alimentano la stima ETA.
const serviceStatsDoc = doc(db, 'service_stats', 'global')

export function subscribeServiceStats(onChange, onError) {
  return onSnapshot(
    serviceStatsDoc,
    (snap) => onChange(snap.exists() ? snap.data() : {}),
    onError ?? (() => {})
  )
}

// Ordini della CODA: i conti aperti (sempre, per sempre) più quelli già
// chiusi nella giornata commerciale corrente (per ristampe e verifiche).
// Due sottoscrizioni unite: Firestore non fa OR fra campi diversi.
export function subscribeActiveOrders(onChange, onError, { cutoffHour = DEFAULT_CUTOFF_HOUR } = {}) {
  let aperti = []
  let recenti = []
  const emit = () => {
    const byId = new Map()
    for (const o of aperti) byId.set(o.id, o)
    for (const o of recenti) byId.set(o.id, o)
    const list = [...byId.values()]
    list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    onChange(list)
  }
  const fail = onError ?? (() => {})

  // Conti aperti: nessun limite di data, si chiudono solo a mano. Il filtro
  // include anche i vecchi stati di lavorazione (ordini creati prima del
  // modello conto/comande): la query lavora sul campo grezzo, quindi senza
  // questi un conto storico non ancora saldato resterebbe invisibile.
  const unsubAperti = onSnapshot(
    query(
      ordersCol,
      where('status', 'in', [
        ORDER_OPEN,
        ORDER_STATUSES.RICEVUTO,
        ORDER_STATUSES.IN_PREPARAZIONE,
        ORDER_STATUSES.PRONTO,
        ORDER_STATUSES.RITIRATO,
      ])
    ),
    (snap) => {
      aperti = snap.docs.map(mapOrder)
      emit()
    },
    fail
  )

  // Chiusi/annullati della giornata commerciale in corso. La finestra della
  // query è volutamente abbondante; il taglio esatto lo fa businessDayKey.
  const from = Timestamp.fromDate(coverageStart(new Date()))
  const unsubRecenti = onSnapshot(
    query(ordersCol, where('created_at', '>=', from)),
    (snap) => {
      const oggi = businessDayKey(new Date(), cutoffHour)
      recenti = snap.docs
        .map(mapOrder)
        .filter((o) => businessDayKey(o.created_at, cutoffHour) === oggi)
      emit()
    },
    fail
  )

  return () => {
    unsubAperti()
    unsubRecenti()
  }
}

// Riporta a "ricevuto" le comande dei conti ancora APERTI: si usa quando
// si spegne la gestione della preparazione, altrimenti resterebbero in
// stati che non si possono più far avanzare.
// Lo scarico di magazzino NON si tocca: `inventory_applied` resta com'è,
// quindi le scorte già consumate restano consumate (il drink è stato
// fatto davvero) e, se un domani si riaccende la gestione, l'avanzamento
// non le scala una seconda volta.
export async function resetOpenOrdersToReceived() {
  const snap = await getDocs(
    query(
      ordersCol,
      where('status', 'in', [
        ORDER_OPEN,
        ORDER_STATUSES.RICEVUTO,
        ORDER_STATUSES.IN_PREPARAZIONE,
        ORDER_STATUSES.PRONTO,
        ORDER_STATUSES.RITIRATO,
      ])
    )
  )
  let toccati = 0
  for (const d of snap.docs) {
    const data = d.data() || {}
    const comande = Array.isArray(data.comande) ? data.comande : []
    // Le comande annullate restano annullate: non sono lavorazioni in corso.
    const nuove = comande.map((c) =>
      c.status === ORDER_STATUSES.ANNULLATO ? c : { ...c, status: ORDER_STATUSES.RICEVUTO }
    )
    const cambia =
      comande.some((c, i) => c.status !== nuove[i].status) || data.status !== ORDER_OPEN
    if (!cambia) continue
    await updateDoc(d.ref, {
      status: ORDER_OPEN,
      comande: nuove,
      comande_statuses: comandeStatuses(nuove),
    })
    toccati += 1
  }
  return toccati
}

// CHIUDE SUBITO un conto già pagato: serve tutte le comande e porta
// l'ordine a "pagato", senza far avanzare gli stati uno per uno. È la
// scorciatoia per quando si è incassato in anticipo e poi si consegna
// tutto insieme. Le comande mai prese in carico vengono scaricate a
// magazzino adesso (una sola volta, come sempre).
export async function closePaidOrder(id) {
  const ref = doc(db, 'orders', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const data = snap.data()
  if (data.payment_status !== 'pagato') {
    throw new Error('Il conto non è ancora pagato.')
  }
  const nowIso = new Date().toISOString()
  const chiusura = chiusuraPagamento(data, nowIso, { autoServe: true })
  const lowStock = chiusura.comande
    ? await depleteComandeInventory(unappliedEntries(id, chiusura.comande))
    : []
  await updateDoc(ref, chiusura)
  notifyLowStock(lowStock)
}

// PREFERENZE POS condivise (ordine card e preferiti): stanno sul server
// così l'arrangiamento è lo stesso su tutti i dispositivi del locale. Il
// client applica SEMPRE prima in locale (localStorage) e scrive qui in
// background — offline la scrittura si accoda e va al ritorno della rete.
const posPrefsRef = doc(db, 'pos_prefs', 'global')

export function subscribePosPrefs(cb, onError) {
  return onSnapshot(
    posPrefsRef,
    (snap) => cb(snap.exists() ? snap.data() : null),
    onError ?? (() => {})
  )
}
export async function savePosOrder(order) {
  await setDoc(posPrefsRef, { order: order || [], order_updated_at: serverTimestamp() }, { merge: true })
}
export async function savePosFavorites(favorites) {
  await setDoc(posPrefsRef, { favorites: favorites || [], favorites_updated_at: serverTimestamp() }, { merge: true })
}

// Id dei drink usati di RECENTE negli ordini (per la raccolta "Recenti" del
// POS): ultimi item distinti, più recenti prima. Legge un blocco di ordini
// recenti e li riduce lato client.
export async function fetchRecentDrinkIds(limit = 20) {
  const snap = await getDocs(query(ordersCol, orderBy('created_at', 'desc'), fbLimit(60)))
  return recentDrinkIds(snap.docs.map(mapOrder), limit)
}

// Ordini di una giornata commerciale (per statistiche e storico).
export async function fetchOrdersForBusinessDay(dayKey, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  // Prendo una finestra larga attorno al giorno e taglio con businessDayKey.
  const from = new Date(`${dayKey}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 1)
  const to = new Date(`${dayKey}T00:00:00Z`)
  to.setUTCDate(to.getUTCDate() + 2)
  const snap = await getDocs(
    query(
      ordersCol,
      where('created_at', '>=', Timestamp.fromDate(from)),
      where('created_at', '<', Timestamp.fromDate(to))
    )
  )
  return snap.docs
    .map(mapOrder)
    .filter((o) => businessDayKey(o.created_at, cutoffHour) === dayKey)
}

// Ordini in un intervallo di giornate commerciali (estremi inclusi).
export async function fetchOrdersBetween(fromDayKey, toDayKey, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const from = new Date(`${fromDayKey}T00:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 1)
  const to = new Date(`${toDayKey}T00:00:00Z`)
  to.setUTCDate(to.getUTCDate() + 2)
  const snap = await getDocs(
    query(
      ordersCol,
      where('created_at', '>=', Timestamp.fromDate(from)),
      where('created_at', '<', Timestamp.fromDate(to))
    )
  )
  return snap.docs.map(mapOrder).filter((o) => {
    const k = businessDayKey(o.created_at, cutoffHour)
    return k && k >= fromDayKey && k <= toDayKey
  })
}

// --- GROUPS (contenitori di ordini) ---

function mapGroup(snap) {
  const g = snap.data() || {}
  return {
    id: snap.id,
    name: g.name ?? '',
    kind: g.kind ?? 'manual',
    customer_uid: g.customer_uid ?? null,
    parent_group_id: g.parent_group_id ?? null,
    has_child_groups: g.has_child_groups ?? false,
    status: g.status ?? 'aperto',
    split_count: g.split_count ?? null,
    pinned: g.pinned ?? false,
    last_order_at: toIso(g.last_order_at),
    created_at: toIso(g.created_at),
    created_by: g.created_by ?? null,
    closed_at: toIso(g.closed_at),
  }
}

// Gruppo-cliente: id == uid, idempotente. Aggiorna nome e ultimo ordine.
export async function ensureCustomerGroup(uid, name) {
  await setDoc(
    doc(groupsCol, uid),
    {
      kind: 'customer',
      customer_uid: uid,
      name: name || 'Cliente',
      parent_group_id: null,
      has_child_groups: false,
      status: 'aperto',
      last_order_at: serverTimestamp(),
    },
    { merge: true }
  )
}

// Gruppo manuale creato dallo staff (eventualmente annidato in un padre).
export async function createManualGroup({ name, parent_group_id = null, created_by = null }) {
  const ref = await addDoc(groupsCol, {
    kind: 'manual',
    name: name?.trim() || 'Gruppo',
    customer_uid: null,
    parent_group_id: parent_group_id || null,
    has_child_groups: false,
    status: 'aperto',
    split_count: null,
    pinned: true,
    last_order_at: serverTimestamp(),
    created_at: serverTimestamp(),
    created_by: created_by ?? null,
  })
  if (parent_group_id) {
    await updateDoc(doc(groupsCol, parent_group_id), { has_child_groups: true }).catch(() => {})
  }
  return mapGroup(await getDoc(ref))
}

export async function renameGroup(id, name) {
  await updateDoc(doc(groupsCol, id), { name: name.trim() })
}

// Annida `childId` dentro `parentId` (il padre diventa contenitore).
export async function nestGroup(childId, parentId) {
  await updateDoc(doc(groupsCol, childId), { parent_group_id: parentId })
  await updateDoc(doc(groupsCol, parentId), { has_child_groups: true })
}

// Sgancia un gruppo dal padre; se il padre resta senza figli, non è più
// un contenitore (torna a poter ricevere ordini diretti).
export async function unnestGroup(childId) {
  const childSnap = await getDoc(doc(groupsCol, childId))
  const parentId = childSnap.exists() ? childSnap.data().parent_group_id : null
  await updateDoc(doc(groupsCol, childId), { parent_group_id: null })
  if (parentId) {
    const rest = await getDocs(query(groupsCol, where('parent_group_id', '==', parentId)))
    if (rest.empty) {
      await updateDoc(doc(groupsCol, parentId), { has_child_groups: false }).catch(() => {})
    }
  }
}

export async function setGroupPinned(id, pinned) {
  await updateDoc(doc(groupsCol, id), { pinned: !!pinned })
}

// CHIUDE (archivia) uno o più gruppi: escono dalla lista dei gruppi aperti.
// Gli ordini restano dove sono (col loro stato/pagamento). Local-first.
export function closeGroups(ids) {
  for (const id of ids || []) {
    updateDoc(doc(groupsCol, id), { status: 'chiuso', closed_at: serverTimestamp() }).catch(() => {})
  }
}
export const closeGroup = (id) => closeGroups([id])

// ELIMINA un gruppo: gli ordini vengono SGANCIATI (restano, senza etichetta
// gruppo) e gli eventuali sottogruppi tornano indipendenti. Local-first: le
// scritture partono e si sincronizzano in background.
export async function deleteGroup(id) {
  const snap = await getDoc(doc(groupsCol, id))
  const parentId = snap.exists() ? snap.data().parent_group_id : null
  // Ordini del gruppo → senza gruppo.
  const os = await getDocs(query(ordersCol, where('group_id', '==', id)))
  os.docs.forEach((d) => updateDoc(d.ref, { group_id: null, group_name_snapshot: null }).catch(() => {}))
  // Sottogruppi → indipendenti.
  const cs = await getDocs(query(groupsCol, where('parent_group_id', '==', id)))
  cs.docs.forEach((d) => updateDoc(d.ref, { parent_group_id: null }).catch(() => {}))
  deleteDoc(doc(groupsCol, id)).catch(() => {})
  // Se era l'ultimo figlio, il padre non è più contenitore.
  if (parentId) {
    const rest = await getDocs(query(groupsCol, where('parent_group_id', '==', parentId)))
    const others = rest.docs.filter((d) => d.id !== id)
    if (others.length === 0) updateDoc(doc(groupsCol, parentId), { has_child_groups: false }).catch(() => {})
  }
}

export async function fetchGroup(id) {
  const snap = await getDoc(doc(groupsCol, id))
  return snap.exists() ? mapGroup(snap) : null
}

// Gruppi APERTI (perpetui) — per drawer e coda. Si chiudono a mano.
export function subscribeOpenGroups(onChange, onError) {
  const q = query(groupsCol, where('status', '==', 'aperto'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(mapGroup)),
    onError ?? (() => {})
  )
}

// Gruppi-cliente recenti (hanno ordinato): per "richiamare" il cliente.
export function subscribeRecentGroups(onChange, onError, limitN = 20) {
  const q = query(
    groupsCol,
    where('kind', '==', 'customer'),
    orderBy('last_order_at', 'desc'),
    fbLimit(limitN)
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(mapGroup)),
    onError ?? (() => {})
  )
}

// --- PAGAMENTI DI GRUPPO (contanti) + ledger ---

// Incassa in contanti un insieme di ordini (un (sotto)gruppo o una sua
// quota). In un'unica transazione: marca pagati gli ordini non ancora
// saldati e scrive nel ledger `payments` (1 documento, o N se diviso per
// N). `split` = { count } per il conto diviso. Restituisce settlement_id.
// Il pagamento CHIUDE il conto solo se non resta nulla da consegnare.
// Con la gestione della preparazione attiva, incassare non significa aver
// servito: pagare in anticipo è normale, e marcare tutto "servito" farebbe
// sparire dalla coda un ordine ancora da preparare. Senza quella gestione
// non esistono stati di consegna, quindi il pagamento chiude e basta.
function chiusuraPagamento(rawOrder, nowIso, { autoServe = true } = {}) {
  const norm = normalizeOrderDoc(rawOrder)
  if (!autoServe && !allServed(norm)) {
    // Resta APERTO: pagato, ma ancora da consegnare.
    return { payment_status: 'pagato', paid_at: nowIso }
  }
  const comande = serveAllComande(norm.comande, nowIso)
  return {
    status: ORDER_STATUSES.PAGATO,
    [`status_times.${ORDER_STATUSES.PAGATO}`]: nowIso,
    payment_status: 'pagato',
    paid_at: nowIso,
    comande,
    comande_statuses: comandeStatuses(comande),
  }
}

export async function payGroupCash({
  orderIds,
  by = null,
  group_id = null,
  group_ids = [],
  split = null,
}) {
  if (!orderIds || orderIds.length === 0) return null
  const nowIso = new Date().toISOString()
  const settlementId = doc(paymentsCol).id

  const refs = orderIds.map((id) => doc(ordersCol, id))
  const snaps = await Promise.all(refs.map((r) => getDoc(r)))
  let total = 0
  const covered = []
  const items = []
  snaps.forEach((s, i) => {
    if (!s.exists()) return
    const o = s.data()
    if (o.status === ORDER_STATUSES.ANNULLATO || o.payment_status === 'pagato') return
    total += Number(o.total) || 0
    covered.push({ ref: refs[i], raw: o })
    for (const it of o.items || []) {
      items.push({ order_id: refs[i].id, name: it.name, qty: it.qty, unit_price: it.unit_price })
    }
  })
  if (covered.length === 0) return null

  // Il pagamento chiude i conti: tutte le comande risultano SERVITE e quelle
  // mai prese in carico si scaricano a magazzino ora.
  const served = covered.map(({ ref, raw }) => ({
    ref,
    comande: serveAllComande(normalizeOrderDoc(raw).comande, nowIso),
  }))
  const lowStock = await depleteComandeInventory(
    served.flatMap(({ ref, comande }) => unappliedEntries(ref.id, comande))
  )
  for (const { ref, comande } of served) {
    await updateDoc(ref, {
      payment_status: 'pagato',
      payment_method: 'banco',
      paid_at: nowIso,
      payment_id: settlementId,
      status: ORDER_STATUSES.PAGATO,
      [`status_times.${ORDER_STATUSES.PAGATO}`]: nowIso,
      comande,
      comande_statuses: comandeStatuses(comande),
    })
  }

  const orderIdsCovered = covered.map((c) => c.ref.id)
  const baseDoc = {
    created_at: serverTimestamp(),
    by,
    direction: 'incasso',
    method: 'banco',
    status: 'pagato',
    group_id: group_id || null,
    group_ids: group_ids || [],
    order_ids: orderIdsCovered,
    items,
    settlement_id: settlementId,
    paid_at: nowIso,
  }
  if (split && split.count > 1) {
    const amounts = splitAmounts(total, split.count)
    for (let idx = 0; idx < amounts.length; idx++) {
      await addDoc(paymentsCol, {
        ...baseDoc,
        amount: amounts[idx],
        split_count: split.count,
        split_index: idx + 1,
      })
    }
  } else {
    await addDoc(paymentsCol, { ...baseDoc, amount: Math.round(total * 100) / 100, split_count: null, split_index: null })
  }
  notifyLowStock(lowStock)
  return settlementId
}

// Crea un pagamento "in attesa" per un gruppo (usato dai pagamenti SumUp:
// il documento porta importo e order_ids; il checkout SumUp lo salda via
// Cloud Function/webhook). Restituisce il paymentId.
export async function createPendingGroupPayment({
  orderIds,
  amount,
  method, // 'online' | 'lettore'
  group_id = null,
  group_ids = [],
  items = [],
  by = null,
}) {
  const ref = await addDoc(paymentsCol, {
    created_at: serverTimestamp(),
    by,
    direction: 'incasso',
    method,
    status: 'in_attesa',
    amount: Math.round((Number(amount) || 0) * 100) / 100,
    group_id: group_id || null,
    group_ids: group_ids || [],
    order_ids: orderIds || [],
    items,
    split_count: null,
    split_index: null,
    settlement_id: null,
    sumup_checkout_id: null,
    sumup_client_transaction_id: null,
    sumup_transaction_id: null,
    paid_at: null,
  })
  return ref.id
}

function mapPayment(snap) {
  const p = snap.data() || {}
  return {
    id: snap.id,
    created_at: toIso(p.created_at),
    by: p.by ?? null,
    method: p.method ?? 'banco',
    status: p.status ?? 'pagato',
    amount: p.amount ?? 0,
    group_id: p.group_id ?? null,
    group_ids: p.group_ids ?? [],
    order_ids: p.order_ids ?? [],
    items: p.items ?? [],
    split_count: p.split_count ?? null,
    split_index: p.split_index ?? null,
    settlement_id: p.settlement_id ?? null,
    paid_at: toIso(p.paid_at),
  }
}

// Pagamenti della giornata commerciale corrente (realtime, più recenti prima).
export function subscribePayments(onChange, onError, { cutoffHour = DEFAULT_CUTOFF_HOUR } = {}) {
  const from = Timestamp.fromDate(coverageStart(new Date()))
  const q = query(paymentsCol, where('created_at', '>=', from))
  return onSnapshot(
    q,
    (snap) => {
      const oggi = businessDayKey(new Date(), cutoffHour)
      const list = snap.docs
        .map(mapPayment)
        .filter((x) => businessDayKey(x.created_at, cutoffHour) === oggi)
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      onChange(list)
    },
    onError ?? (() => {})
  )
}

// --- CASSA (apertura/chiusura serata) ---
// Una sessione di cassa marca la finestra della "serata": si apre a inizio
// servizio (con un fondo cassa opzionale) e si chiude a fine, salvando il
// riepilogo. Il flusso cassa è calcolato dagli ordini nella finestra.

function mapCashSession(snap) {
  const s = snap.data() || {}
  return {
    id: snap.id,
    status: s.status ?? 'open',
    opened_at: toIso(s.opened_at),
    closed_at: toIso(s.closed_at),
    opened_by: s.opened_by ?? null,
    closed_by: s.closed_by ?? null,
    fondo_cassa: Number(s.fondo_cassa) || 0,
    business_day: s.business_day ?? null,
    snapshot: s.snapshot ?? null,
    counted_cash: s.counted_cash != null ? Number(s.counted_cash) : null,
    difference: s.difference != null ? Number(s.difference) : null,
    note: s.note ?? null,
  }
}

// Sessione di cassa attualmente aperta (una sola alla volta), in realtime.
// Niente orderBy nella query (eviterebbe un indice composito e, soprattutto,
// escluderebbe il doc appena creato offline finché opened_at è nullo): si
// ordina lato client.
export function subscribeOpenCashSession(onChange, onError) {
  const q = query(cashSessionsCol, where('status', '==', 'open'))
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(mapCashSession)
      list.sort((a, b) => String(b.opened_at || '').localeCompare(String(a.opened_at || '')))
      onChange(list[0] || null)
    },
    onError ?? (() => {})
  )
}

// Apre la cassa. LOCAL-FIRST: id generato dal client e opened_at come ISO del
// client (così il doc compare subito nella subscription anche offline); la
// scrittura va in background senza attendere il server — altrimenti offline la
// promise non si risolverebbe mai e il tasto sembrerebbe non fare nulla. Il
// "una sola cassa aperta" è garantito dalla UI (il bottone c'è solo se non ce
// n'è una aperta).
export function openCashSession({ by = null, fondo = 0, cutoffHour = DEFAULT_CUTOFF_HOUR } = {}) {
  const ref = doc(cashSessionsCol)
  setDoc(ref, {
    status: 'open',
    opened_at: new Date().toISOString(),
    opened_by: by,
    fondo_cassa: Number(fondo) || 0,
    business_day: businessDayKey(new Date(), cutoffHour),
    created_at: serverTimestamp(),
  }).catch(() => {})
  return ref.id
}

// Chiude la cassa: salva il riepilogo (snapshot) ed eventuale contante contato.
// Anche qui local-first: scrittura in background, closed_at come ISO client.
export function closeCashSession(id, { by = null, snapshot = null, countedCash = null, note = null } = {}) {
  const patch = {
    status: 'closed',
    closed_at: new Date().toISOString(),
    closed_by: by,
    snapshot: snapshot || null,
    note: note || null,
  }
  if (countedCash != null && countedCash !== '') {
    const counted = Number(countedCash) || 0
    patch.counted_cash = counted
    const atteso = Number(snapshot?.contanteAtteso) || 0
    patch.difference = Math.round((counted - atteso) * 100) / 100
  }
  updateDoc(doc(db, 'cash_sessions', id), patch).catch(() => {})
}

// Storico delle sessioni di cassa chiuse, più recenti prima.
export async function fetchCashSessions({ limit = 30 } = {}) {
  const snap = await getDocs(query(cashSessionsCol, orderBy('opened_at', 'desc'), fbLimit(limit)))
  return snap.docs.map(mapCashSession)
}

// --- ORDERS ---

// Crea un ordine con i relativi item. Il numero progressivo riparte ad ogni
// giornata commerciale: è assegnato da un contatore per giornata
// (counters/{YYYY-MM-DD}), che riparte a ogni nuova giornata.
export async function createOrder({
  table_label,
  note,
  items,
  coperto_persons = 0,
  coperto_amount = 0,
  service_charge_amount = 0,
  tip_amount = 0,
  service_mode = null, // 'tavolo' | 'banco' | null (scelta non attiva)
  push_token = null, // token FCM del dispositivo (per le notifiche push)
  placed_by = null, // { email, role } se inserito manualmente dallo staff
  customer_name = null, // nome/pseudonimo (+ cognome) del cliente
  customer_uid = null, // uid dell'account cliente (null per anonimi)
  payment_method = null, // 'online' se il cliente sceglie di pagare subito
  payment_status = 'non_richiesto', // 'in_attesa' per i pagamenti online
  payment_required = false, // fotografa l'impostazione alla creazione
  group_id = null, // gruppo a cui associare l'ordine (null = nessuno)
  group_name_snapshot = null, // nome gruppo al momento dell'ordine (storico)
  status = ORDER_STATUSES.RICEVUTO, // stato iniziale (il POS lo crea già in preparazione)
  client_temp_id = null, // id del placeholder POS: la griglia scambia SENZA doppioni
  cutoff_hour = DEFAULT_CUTOFF_HOUR, // ora di taglio della giornata commerciale
}) {
  // Cliente registrato senza gruppo esplicito → gruppo-cliente automatico
  // (id == uid). Il documento è idempotente (merge).
  if (!group_id && customer_uid) {
    group_id = customer_uid
    if (!group_name_snapshot) group_name_snapshot = customer_name || null
    await ensureCustomerGroup(customer_uid, customer_name || 'Cliente').catch(
      (e) => console.error('[groups] ensureCustomerGroup:', e?.message || e)
    )
  }
  // Un gruppo-contenitore (con sottogruppi) non può avere ordini diretti.
  if (group_id) {
    const gSnap = await getDoc(doc(groupsCol, group_id))
    if (gSnap.exists() && gSnap.data().has_child_groups) {
      throw new Error('Questo gruppo contiene altri gruppi: aggiungi l’ordine a un sottogruppo.')
    }
  }
  const itemsTotal = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)
  const total = itemsTotal + coperto_amount + service_charge_amount + tip_amount
  // Giornata commerciale: raggruppa e fa ripartire il progressivo #N. La
  // nottata oltre la mezzanotte resta nella giornata in cui è cominciata.
  const orderDate = businessDayKey(new Date(), cutoff_hour)
  const counterRef = doc(db, 'counters', orderDate)
  const newOrderRef = doc(ordersCol)

  // Numero giornaliero: letto dalla cache (offline compreso) e incrementato.
  // Su un singolo dispositivo resta univoco anche offline (la cache riflette
  // subito le scritture in coda); su più dispositivi offline in contemporanea
  // può collidere, si riconcilia al sync.
  const counterSnap = await getDoc(counterRef)
  const last = counterSnap.exists() ? counterSnap.data().last || 0 : 0
  const dailyNumber = last + 1
  // LOCAL-FIRST: la scrittura è già applicata alla cache in modo sincrono, non
  // si attende l'ack del server (offline `await setDoc` non si risolverebbe mai
  // e bloccherebbe la creazione dell'ordine). Il sync va in background.
  setDoc(counterRef, { last: dailyNumber }, { merge: true }).catch(() => {})

  // Progressivo ASSOLUTO del sistema: non riparte mai, identifica l'ordine
  // per sempre (id interno mostrato in piccolo nel dettaglio). Stessa
  // lettura da cache del progressivo giornaliero.
  const serialSnap = await getDoc(serialCounterRef)
  const serial = (serialSnap.exists() ? serialSnap.data().last || 0 : 0) + 1
  setDoc(serialCounterRef, { last: serial }, { merge: true }).catch(() => {})

  const nowIso = new Date().toISOString()
  const mappedItems = items.map((i) => ({
    drink_id: i.drink_id,
    name: i.name,
    unit_price: i.price,
    qty: i.qty,
    sumup_product_id: i.sumup_product_id ?? null,
    ...(i.custom ? { custom: true, recipe_items: i.recipe_items ?? [] } : {}),
  }))
  // Modello conto/comande: l'ordine nasce `aperto` con la COMANDA 1, che
  // porta lo stato di lavorazione (il POS la crea già in preparazione).
  const comanda1 = {
    id: 'c1',
    seq: 1,
    items: mappedItems,
    status,
    status_times: { [status]: nowIso },
    inventory_applied: false,
    inventory_consumption: null,
    created_at: nowIso,
  }
  // Anche l'ordine è local-first: la scrittura entra subito in cache (la
  // sottoscrizione lo mostra all'istante, online e offline), il server la
  // riceve appena c'è rete. Niente await: offline non si sbloccherebbe.
  setDoc(newOrderRef, {
    daily_number: dailyNumber, // progressivo del giorno (riparte ogni giornata)
    serial, // progressivo assoluto di sistema (non riparte mai)
    order_date: orderDate, // giornata commerciale (YYYY-MM-DD)
    table_label: table_label || null,
    note: note || null,
    status: ORDER_OPEN,
    comande: [comanda1],
    comande_statuses: [status],
    total,
    coperto_persons,
    coperto_amount,
    service_charge_amount,
    tip_amount,
    service_mode,
    push_token,
    placed_by,
    customer_name,
    customer_uid,
    payment_method,
    payment_status,
    payment_required,
    group_id: group_id || null,
    group_name_snapshot: group_name_snapshot || null,
    payment_id: null,
    client_temp_id,
    created_at: serverTimestamp(),
    // Aggregato di tutte le comande (qui solo la prima): usato per totale,
    // scontrino e compatibilità con le viste esistenti.
    items: mappedItems,
  }).catch(() => {})

  // getDoc legge la scrittura locale appena applicata (risolve anche offline):
  // niente attesa del server.
  const snap = await getDoc(newOrderRef)
  const order = mapOrder(snap)

  // Invia l'ordine a SumUp POS Pro in background (non blocca il flusso cliente).
  createSumUpSale({
    orderId: order.id,
    tableLabel: table_label,
    note,
    items: order.order_items.map((i) => ({
      sumup_product_id: i.sumup_product_id,
      name: i.name,
      qty: i.qty,
      unit_price: i.unit_price,
    })),
  }).catch((e) => console.error('[SumUp] createSale failed:', e))

  return order
}

export async function fetchOrder(id) {
  const snap = await getDoc(doc(db, 'orders', id))
  if (!snap.exists()) throw new Error('Ordine non trovato')
  return mapOrder(snap)
}

// Ordini dell'account cliente (su qualunque dispositivo).
export async function fetchOrdersByCustomer(uid, limitN = 30) {
  const snap = await getDocs(
    query(ordersCol, where('customer_uid', '==', uid), fbLimit(limitN))
  )
  const orders = snap.docs.map(mapOrder)
  orders.sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
  return orders
}

export async function fetchOrdersByIds(ids) {
  if (!ids || ids.length === 0) return []
  // Firestore: massimo 30 valori per clausola "in"; suddividi in blocchi.
  const chunks = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
  const results = []
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(ordersCol, where(documentId(), 'in', chunk))
    )
    results.push(...snap.docs.map(mapOrder))
  }
  results.sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
  return results
}

// Coda del bartender: ordini attivi (non ancora ritirati/pagati).
// Ordini attivi = conti aperti (il flusso di lavorazione vive sulle comande).

export async function fetchActiveOrders() {
  const snap = await getDocs(
    query(ordersCol, where('status', '==', ORDER_OPEN))
  )
  const orders = snap.docs.map(mapOrder)
  orders.sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
  return orders
}

// Codice della "lotteria degli scontrini" comunicato dal cliente al
// pagamento: si salva sul conto e finisce stampato sullo scontrino.
export async function setOrderLotteryCode(id, code) {
  await updateDoc(doc(db, 'orders', id), {
    lottery_code: String(code || '').trim().toUpperCase() || null,
  })
}

// ── FATTURE DI CORTESIA ────────────────────────────────────────────────
// Non è fatturazione elettronica (SDI): è il documento di cortesia con i
// dati del cliente, numerato per anno, da inviare via email o stampare.
// La numerazione usa un contatore transazionale per anno.
export async function createInvoice({ order, customer, ivaRate = 10 }) {
  const year = new Date().getFullYear()
  const counterRef = doc(db, 'counters', `fatture-${year}`)
  const invoiceRef = doc(invoicesCol)
  const orderRef = doc(db, 'orders', order.id)
  const nowIso = new Date().toISOString()

  const counterSnap = await getDoc(counterRef)
  const seq = ((counterSnap.exists() ? counterSnap.data().seq : 0) || 0) + 1
  const number = `${seq}/${year}`
  await setDoc(counterRef, { seq }, { merge: true })
  await setDoc(invoiceRef, {
    number,
    seq,
    year,
    order_id: order.id,
    order_daily_number: order.daily_number ?? null,
    customer: {
      denominazione: customer.denominazione || '',
      piva: customer.piva || null,
      cf: customer.cf || null,
      sdi: customer.sdi || null,
      indirizzo: customer.indirizzo || null,
      email: customer.email || null,
    },
    items: (order.order_items || []).map((i) => ({
      name: i.name,
      qty: i.qty,
      unit_price: i.unit_price,
    })),
    total: order.total ?? 0,
    discount_amount: order.discount_amount ?? 0,
    iva_rate: Number(ivaRate) || 0,
    status: 'emessa',
    sent_to: null,
    sent_at: null,
    created_at: nowIso,
  })
  await updateDoc(orderRef, { invoice_id: invoiceRef.id, invoice_number: number })
  const snap = await getDoc(invoiceRef)
  return { id: invoiceRef.id, ...snap.data() }
}

// Segna la fattura come inviata (dopo l'apertura del client email).
export async function markInvoiceSent(invoiceId, email) {
  await updateDoc(doc(invoicesCol, invoiceId), {
    sent_to: email || null,
    sent_at: new Date().toISOString(),
  })
}

// Elenco fatture (gestionale), più recenti in alto.
export function subscribeInvoices(cb, onError) {
  const q = query(invoicesCol, orderBy('created_at', 'desc'), fbLimit(200))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  )
}

// ── BUONI VIP (credito ricaricabile) ──────────────────────────────────
// Un buono ha un saldo in € associato a una persona: si ricarica e si
// scala al pagamento (metodo 'buono'). Tutte le variazioni sono in una
// transazione e lasciano una traccia in `movements`.

export function subscribeVouchers(cb, onError) {
  const q = query(vouchersCol, orderBy('holder_name'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), created_at: toIso(d.data().created_at) }))),
    onError
  )
}

export async function createVoucher({
  holder_name,
  amount = 0,
  note = null,
  expiry_type = 'none', // 'none' | 'daily' | 'monthly' | 'yearly' | 'date'
  expires_at = null, // ISO date per expiry_type 'date'
  auto_renew = false,
}) {
  const nowIso = new Date().toISOString()
  const initial = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100)
  const ref = await addDoc(vouchersCol, {
    holder_name: String(holder_name || '').trim(),
    balance: initial,
    initial,
    note: note || null,
    expiry_type,
    expires_at: expiry_type === 'date' ? expires_at || null : null,
    auto_renew: !!auto_renew,
    movements: initial > 0 ? [{ type: 'carica', amount: initial, at: nowIso }] : [],
    created_at: serverTimestamp(),
  })
  return { id: ref.id, ...(await getDoc(ref)).data() }
}

// Aggiorna la scadenza di un buono esistente.
export async function updateVoucherExpiry(id, { expiry_type, expires_at = null, auto_renew = false }) {
  await updateDoc(doc(vouchersCol, id), {
    expiry_type,
    expires_at: expiry_type === 'date' ? expires_at || null : null,
    auto_renew: !!auto_renew,
  })
}

// Ricarica un buono (aggiunge al saldo).
export async function topUpVoucher(id, amount) {
  const ref = doc(vouchersCol, id)
  const add = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100)
  if (!(add > 0)) throw new Error('Importo di ricarica non valido')
  const nowIso = new Date().toISOString()
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Buono non trovato')
  const v = snap.data()
  await updateDoc(ref, {
    balance: increment(add),
    movements: [...(v.movements || []), { type: 'carica', amount: add, at: nowIso }],
  })
}

// Elimina un buono (solo a saldo zero, dal gestionale).
export async function deleteVoucher(id) {
  await deleteDoc(doc(vouchersCol, id))
}

// Scala un buono per pagare un ordine: registra il pagamento sull'ordine
// (metodo 'buono') e decrementa il saldo, in un'unica transazione.
// Ritorna { redeemed, closed }.
export async function payWithVoucher(orderId, voucherId, requestedAmount, { autoServe = true } = {}) {
  const orderRef = doc(db, 'orders', orderId)
  const voucherRef = doc(vouchersCol, voucherId)
  const nowIso = new Date().toISOString()
  const [oSnap, vSnap] = await Promise.all([getDoc(orderRef), getDoc(voucherRef)])
  if (!oSnap.exists()) throw new Error('Ordine non trovato')
  if (!vSnap.exists()) throw new Error('Buono non trovato')
  const o = oSnap.data()
  const v = vSnap.data()
  if (o.status === ORDER_STATUSES.ANNULLATO) throw new Error('Ordine annullato')
  if (o.payment_status === 'pagato') throw new Error('Ordine già pagato')
  const due = orderDue(o)
  const balance = Math.max(0, Number(v.balance) || 0)
  const redeemed = Math.round(Math.min(due, balance, Math.max(0, Number(requestedAmount) || 0)) * 100) / 100
  if (!(redeemed > 0)) throw new Error('Saldo del buono insufficiente')

  const payments = [
    ...(o.payments || []),
    { id: `pay-${Date.now()}`, amount: redeemed, method: 'buono', voucher_id: voucherId, voucher_name: v.holder_name, at: nowIso },
  ]
  const closed = paymentCloses(o, redeemed)
  const chiusura = closed ? chiusuraPagamento(o, nowIso, { autoServe }) : null
  // Due scritture accodabili (ordine + buono): offline si accodano entrambe.
  // Il saldo scala con increment (commutativo).
  await updateDoc(orderRef, {
    payments,
    ...(closed
      ? { ...chiusura, payment_method: summaryMethod(payments) }
      : { payment_status: 'parziale' }),
  })
  await updateDoc(voucherRef, {
    balance: increment(-redeemed),
    movements: [...(v.movements || []), { type: 'uso', amount: -redeemed, order_id: orderId, at: nowIso }],
  })
  return { redeemed, closed }
}

// Imposta (o rimuove, con null) lo sconto sul conto: percentuale o euro.
// L'importo in euro viene calcolato e persistito, così residuo e webhook
// dei pagamenti ragionano sempre sullo stesso numero.
export async function setOrderDiscount(id, discount) {
  const ref = doc(db, 'orders', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const o = snap.data()
  if (o.payment_status === 'pagato') throw new Error('Ordine già pagato')
  const clean =
    discount && Number(discount.value) > 0
      ? { type: discount.type === 'percent' ? 'percent' : 'euro', value: Number(discount.value) }
      : null
  await updateDoc(ref, {
    discount: clean,
    discount_amount: discountAmount(o.total ?? 0, clean),
  })
}

// Registra un incasso (anche PARZIALE, per lo split del conto): appende il
// pagamento e, se il residuo va a zero, chiude il conto come "pagato" —
// anche con comande non servite (l'avviso sta nella UI, come concordato).
// `items` è la selezione pagata (null = importo sul residuo, senza dettaglio).
export async function registerPayment(id, { amount, method = 'banco', items = null, autoServe = true } = {}) {
  const ref = doc(db, 'orders', id)
  const nowIso = new Date().toISOString()
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const o = snap.data()
  if (o.status === ORDER_STATUSES.ANNULLATO) throw new Error('Ordine annullato')
  if (o.payment_status === 'pagato') throw new Error('Ordine già pagato')
  const due = orderDue(o)
  const paid = Math.min(Number(amount) || 0, due)
  if (!(paid > 0)) throw new Error('Importo non valido')
  const payments = [
    ...(o.payments || []),
    {
      id: `pay-${Date.now()}-${(o.payments || []).length + 1}`,
      amount: paid,
      method,
      items: items?.length ? items : null,
      at: nowIso,
    },
  ]
  const closed = paymentCloses(o, paid)
  let lowStock = []
  const chiusura = closed ? chiusuraPagamento(o, nowIso, { autoServe }) : null
  if (chiusura?.comande) {
    // Conto saldato E servito ⇒ le comande mai prese in carico vengono
    // scaricate a magazzino adesso.
    lowStock = await depleteComandeInventory(unappliedEntries(id, chiusura.comande))
  }
  await updateDoc(ref, {
    payments,
    ...(closed
      ? { ...chiusura, payment_method: summaryMethod(payments) }
      : { payment_status: 'parziale' }),
  })
  notifyLowStock(lowStock)
  return { closed }
}

// Chiude definitivamente l'ordine come pagato, registrando il metodo
// d'incasso ('banco' per contanti/POS esterno, 'lettore', 'online').
// Conto pagato. Con `autoServe` le comande risultano anche SERVITE (e
// quelle mai prese in carico vengono scaricate a magazzino); seguendo la
// preparazione invece il conto resta aperto finché non si consegna.
export async function markOrderPaid(id, method, { autoServe = true } = {}) {
  const ref = doc(db, 'orders', id)
  const nowIso = new Date().toISOString()
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const chiusura = chiusuraPagamento(snap.data(), nowIso, { autoServe })
  const lowStock = chiusura.comande
    ? await depleteComandeInventory(unappliedEntries(id, chiusura.comande))
    : []
  await updateDoc(ref, { ...chiusura, payment_method: method })
  notifyLowStock(lowStock)
}

// Avanza lo stato di UNA COMANDA (il ticket di lavorazione). È qui che vive
// il flusso ricevuto→in_preparazione→pronto→ritirato: l'ordine (conto) resta
// `aperto` e si chiude solo con pagamento/annullo. Allo "in preparazione"
// scala l'inventario sugli item della comanda (snapshot per-comanda usato
// per storni e riallineamenti). I doc legacy vengono convertiti al volo.
// Scarico inventario di PIÙ COMANDE — OFFLINE-FRIENDLY. Legge ricette e
// giacenze dalla cache (getDoc funziona offline con la persistenza) e
// aggiorna le giacenze con increment(-qty): commutativo, si accoda offline
// e non richiede una transazione. Muta le comande (inventory_applied/
// snapshot) e ritorna le scorte basse stimate dallo stock in cache.
// `entries` = [{ orderId, comanda }].
async function depleteComandeInventory(entries) {
  if (!entries.length) return []
  const plans = []
  for (const { orderId, comanda } of entries) {
    const items = Array.isArray(comanda.items) ? comanda.items : []
    const drinkIds = [...new Set(items.filter((i) => !i.custom).map((i) => i.drink_id).filter(Boolean))]
    const drinkSnaps = await Promise.all(drinkIds.map((d) => getDoc(doc(db, 'drinks', d))))
    const drinksById = {}
    drinkSnaps.forEach((sn, idx) => {
      drinksById[drinkIds[idx]] = sn.exists() ? sn.data() : null
    })
    plans.push({ orderId, comanda, consumption: computeConsumption(items, drinksById) })
  }
  const itemIds = [...new Set(plans.flatMap((p) => p.consumption.map((c) => c.inventory_item_id)))]
  const itemSnaps = await Promise.all(itemIds.map((id) => getDoc(doc(db, 'inventory_items', id))))
  const itemsById = {}
  itemSnaps.forEach((sn, idx) => {
    if (sn.exists()) itemsById[itemIds[idx]] = sn.data()
  })
  // Un movimento per comanda/ingrediente; la giacenza cala una volta per
  // ingrediente con il delta cumulato (increment: sicuro anche offline).
  const delta = {}
  for (const p of plans) {
    for (const c of p.consumption) {
      const cur = itemsById[c.inventory_item_id]
      if (!cur) continue
      delta[c.inventory_item_id] = (delta[c.inventory_item_id] || 0) + c.qty
      await addDoc(movementsCol, {
        item_id: c.inventory_item_id,
        item_name: cur.name,
        type: 'unload',
        qty: c.qty,
        unit: cur.unit ?? null,
        reason: 'ordine',
        order_id: p.orderId,
        created_at: serverTimestamp(),
      })
    }
    p.comanda.inventory_applied = true
    p.comanda.inventory_consumption = p.consumption
  }
  const lowStock = []
  for (const [id, qty] of Object.entries(delta)) {
    const cur = itemsById[id]
    const newStock = (Number(cur.stock) || 0) - qty
    await updateDoc(doc(db, 'inventory_items', id), { stock: increment(-qty) })
    if (newStock <= (Number(cur.low_threshold) || 0)) {
      lowStock.push({ name: cur.name, stock: newStock, unit: cur.unit })
    }
  }
  return lowStock
}

// Comande di un conto pagato ancora da scaricare a magazzino.
const unappliedEntries = (orderId, comande) =>
  comande
    .filter((c) => c.status === ORDER_STATUSES.RITIRATO && c.inventory_applied !== true)
    .map((comanda) => ({ orderId, comanda }))

// Notifica scorte basse/finite (da chiamare fuori dalla transazione).
function notifyLowStock(lowStock) {
  for (const it of lowStock) {
    const stato = it.stock <= 0 ? 'esaurito' : 'in esaurimento'
    notify(`⚠️ Scorta ${stato}`, `${it.name}: rimasti ${formatQty(it.stock, it.unit)}`)
  }
}

export async function advanceComanda(orderId, comandaId, newStatus) {
  const orderRef = doc(db, 'orders', orderId)
  const nowIso = new Date().toISOString()
  let lowStock = []
  let statComanda = null

  const orderSnap = await getDoc(orderRef)
  if (!orderSnap.exists()) throw new Error('Ordine non trovato')
  const raw = orderSnap.data()
  const norm = normalizeOrderDoc(raw)
  const comande = norm.comande.map((c) => ({ ...c }))
  const comanda = comandaId
    ? comande.find((c) => c.id === comandaId)
    : activeComanda({ comande })
  if (!comanda) throw new Error('Comanda non trovata')

  // Scarico inventario alla presa in carico della comanda (una volta sola).
  if (newStatus === ORDER_STATUSES.IN_PREPARAZIONE && comanda.inventory_applied !== true) {
    lowStock = await depleteComandeInventory([{ orderId, comanda }])
  }

  comanda.status = newStatus
  comanda.status_times = { ...(comanda.status_times || {}), [newStatus]: nowIso }
  statComanda = { ...comanda, order: raw }

  const patch = {
    status: norm.status,
    comande,
    comande_statuses: comandeStatuses(comande),
  }
  // Conto già pagato (online/lettore) e tutte le comande servite: il conto
  // si chiude da solo (c'è anche la cintura lato server).
  if (
    newStatus === ORDER_STATUSES.RITIRATO &&
    raw.payment_status === 'pagato' &&
    allServed({ comande })
  ) {
    patch.status = ORDER_STATUSES.PAGATO
    patch[`status_times.${ORDER_STATUSES.PAGATO}`] = nowIso
  }
  await updateDoc(orderRef, patch)

  notifyLowStock(lowStock)

  // Statistiche tempi del servizio (per ETA cliente), per comanda.
  if (statComanda) {
    updateServiceTimeStats(statComanda.order, statComanda, newStatus).catch((e) =>
      console.error('[eta] aggiornamento statistiche fallito:', e)
    )
  }

  // Sync stato verso SumUp POS Pro in background (fire-and-forget).
  const sumupStatus = toSumUpStatus(newStatus)
  if (sumupStatus && statComanda?.order?.sumup_sale_id) {
    updateSumUpSaleStatus(statComanda.order.sumup_sale_id, sumupStatus)
      .catch((e) => console.error('[SumUp] updateStatus failed:', e))
  }

  return mapOrder(await getDoc(orderRef))
}

// Retrocompatibilità: avanza la comanda ATTIVA dell'ordine (le viste che
// ragionano per workflow_status continuano a funzionare).
export async function updateOrderStatus(id, status) {
  return advanceComanda(id, null, status)
}

// Incrementa le statistiche tempi del SERVIZIO (perpetue) quando una COMANDA raggiunge
// "pronto" (attesa+preparazione) o "ritirato" (ciclo completo, solo tavolo).
async function updateServiceTimeStats(orderRaw, comanda, status) {
  const ms = (v) => {
    if (!v) return null
    if (typeof v?.toMillis === 'function') return v.toMillis()
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : null
  }
  const t0 = ms(comanda.created_at) ?? ms(orderRaw.created_at)
  const t1 = ms(comanda.status_times?.[ORDER_STATUSES.IN_PREPARAZIONE])
  const t2 = ms(comanda.status_times?.[ORDER_STATUSES.PRONTO])
  const t3 = ms(comanda.status_times?.[ORDER_STATUSES.RITIRATO])

  // setDoc+merge: il documento perpetuo può non esistere ancora.
  if (status === ORDER_STATUSES.PRONTO && t0 && t1 && t2 && t2 >= t1 && t1 >= t0) {
    await setDoc(
      serviceStatsDoc,
      {
        prep_stats: {
          count: increment(1),
          attesa_ms: increment(t1 - t0),
          prep_ms: increment(t2 - t1),
          total_ms: increment(t2 - t0),
        },
      },
      { merge: true }
    )
  }

  if (
    status === ORDER_STATUSES.RITIRATO &&
    orderRaw.service_mode === 'tavolo' &&
    t0 && t1 && t2 && t3 && t3 >= t2 && t2 >= t1 && t1 >= t0
  ) {
    await setDoc(
      serviceStatsDoc,
      {
        eta_stats: {
          count: increment(1),
          attesa_ms: increment(t1 - t0),
          prep_ms: increment(t2 - t1),
          ritiro_ms: increment(t3 - t2),
          total_ms: increment(t3 - t0),
        },
      },
      { merge: true }
    )
  }
}

// Modifica gli item di un ordine (solo finché è 'ricevuto', prima della
// preparazione). Ricalcola il totale. Usato dal cliente dalla pagina ordine.
// Aggancia (o aggiorna) il token push del dispositivo a un ordine già
// creato: utile quando il cliente attiva le notifiche dalla pagina
// dell'ordine, o dopo la scansione del QR di un ordine manuale.
// Consentito dalle regole solo finché l'ordine è in stato "ricevuto".
export async function updateOrderPushToken(id, token) {
  await updateDoc(doc(db, 'orders', id), { push_token: token })
}

// Modifica del CLIENTE: consentita solo finché il conto ha la sola prima
// comanda ancora "ricevuta" (prima della preparazione). Aggiorna la comanda
// e l'aggregato dell'ordine, ricalcolando il totale.
export async function updateOrderItems(id, items) {
  const ref = doc(db, 'orders', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const cur = snap.data()
  const norm = normalizeOrderDoc(cur)
  const comande = norm.comande.map((c) => ({ ...c }))
  if (
    norm.status !== ORDER_OPEN ||
    comande.length !== 1 ||
    comande[0].status !== ORDER_STATUSES.RICEVUTO
  ) {
    throw new Error('Ordine già in preparazione: non più modificabile')
  }
  const mapped = items.map((i) => ({
    drink_id: i.drink_id,
    name: i.name,
    unit_price: i.unit_price ?? i.price ?? 0,
    qty: i.qty,
    sumup_product_id: i.sumup_product_id ?? null,
    ...(i.custom ? { custom: true, recipe_items: i.recipe_items ?? [] } : {}),
  }))
  comande[0] = { ...comande[0], items: mapped }
  const extras =
    Number(cur.coperto_amount || 0) +
    Number(cur.service_charge_amount || 0) +
    Number(cur.tip_amount || 0)
  await updateDoc(ref, {
    status: ORDER_OPEN,
    comande,
    comande_statuses: comandeStatuses(comande),
    items: mapped,
    total: sumItems(mapped) + extras,
  })
  return mapOrder(await getDoc(ref))
}

// Campi "anagrafici" del conto (nome, tavolo, note): modificabili dal
// bartender finché l'ordine non è chiuso.
export async function updateOrderInfo(id, { table_label, note, customer_name }) {
  const patch = {}
  if (table_label !== undefined) patch.table_label = table_label || null
  if (note !== undefined) patch.note = note || null
  if (customer_name !== undefined) patch.customer_name = customer_name || null
  if (Object.keys(patch).length) await updateDoc(doc(db, 'orders', id), patch)
  return mapOrder(await getDoc(doc(db, 'orders', id)))
}

// AGGIUNTA a un conto aperto: crea una NUOVA COMANDA con i soli item
// aggiunti (come "aggiungi un ordine" nei POS) e aggiorna aggregato+totale.
// La comanda nasce già IN PREPARAZIONE (l'aggiunta la fa il banco, che la
// prepara subito): lo stato dell'ordine in coda TORNA "in preparazione"
// anche se le comande precedenti erano pronte/servite, e le scorte si
// scalano subito (snapshot per-comanda, come in advanceComanda).
export async function addComanda(orderId, items, { note = null } = {}) {
  const ref = doc(db, 'orders', orderId)
  const nowIso = new Date().toISOString()
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const cur = snap.data()
  const norm = normalizeOrderDoc(cur)
  if (norm.status !== ORDER_OPEN) throw new Error('Conto chiuso: non più modificabile')
  const comande = norm.comande.map((c) => ({ ...c }))
  const seq = comande.reduce((m, c) => Math.max(m, c.seq || 0), 0) + 1
  const nuova = {
    id: `c${seq}`,
    seq,
    items: items.map((i) => ({
      drink_id: i.drink_id,
      name: i.name,
      unit_price: i.unit_price ?? i.price ?? 0,
      qty: i.qty,
      sumup_product_id: i.sumup_product_id ?? null,
      ...(i.custom ? { custom: true, recipe_items: i.recipe_items ?? [] } : {}),
    })),
    status: ORDER_STATUSES.IN_PREPARAZIONE,
    status_times: {
      [ORDER_STATUSES.RICEVUTO]: nowIso,
      [ORDER_STATUSES.IN_PREPARAZIONE]: nowIso,
    },
    note: note || null,
    inventory_applied: false,
    inventory_consumption: null,
    created_at: nowIso,
  }
  const lowStock = await depleteComandeInventory([{ orderId, comanda: nuova }])
  comande.push(nuova)
  const agg = aggregateItems(comande)
  const extras =
    Number(cur.coperto_amount || 0) +
    Number(cur.service_charge_amount || 0) +
    Number(cur.tip_amount || 0)
  await updateDoc(ref, {
    status: ORDER_OPEN,
    comande,
    comande_statuses: comandeStatuses(comande),
    items: agg,
    total: sumItems(agg) + extras,
  })
  notifyLowStock(lowStock)
  return mapOrder(await getDoc(ref))
}

// Modifica di UNA COMANDA da parte del bartender (quantità, rimozioni,
// aggiunte, custom) finché non è servita. Se lo scarico era già stato
// applicato, l'inventario viene riallineato con la DIFFERENZA tra il
// vecchio snapshot della comanda e il nuovo consumo.
export async function bartenderUpdateComanda(orderId, comandaId, { items }) {
  const ref = doc(db, 'orders', orderId)
  const newItems = items.map((i) => ({
    drink_id: i.drink_id,
    name: i.name,
    unit_price: i.unit_price ?? i.price ?? 0,
    qty: i.qty,
    sumup_product_id: i.sumup_product_id ?? null,
    ...(i.custom ? { custom: true, recipe_items: i.recipe_items ?? [] } : {}),
  }))

  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const cur = snap.data()
  const norm = normalizeOrderDoc(cur)
  if (norm.status !== ORDER_OPEN) throw new Error('Conto chiuso: non più modificabile')
  const comande = norm.comande.map((c) => ({ ...c }))
  const comanda = comande.find((c) => c.id === comandaId)
  if (!comanda) throw new Error('Comanda non trovata')
  if (comanda.status === ORDER_STATUSES.RITIRATO || comanda.status === ORDER_STATUSES.ANNULLATO) {
    throw new Error('Comanda già servita: non più modificabile')
  }

  // Scarico già applicato: riallinea le scorte con la DIFFERENZA
  // (increment sul delta: commutativo, si accoda offline).
  if (comanda.inventory_applied === true) {
    const drinkIds = [...new Set(newItems.filter((i) => !i.custom).map((i) => i.drink_id).filter(Boolean))]
    const drinkSnaps = await Promise.all(drinkIds.map((d) => getDoc(doc(db, 'drinks', d))))
    const drinksById = {}
    drinkSnaps.forEach((sn, idx) => {
      drinksById[drinkIds[idx]] = sn.exists() ? sn.data() : null
    })
    const oldCons = Array.isArray(comanda.inventory_consumption) ? comanda.inventory_consumption : []
    const newCons = computeConsumption(newItems, drinksById)
    const diffs = consumptionDiff(oldCons, newCons)
    const invSnaps = await Promise.all(
      diffs.map((d) => getDoc(doc(db, 'inventory_items', d.inventory_item_id)))
    )
    for (let idx = 0; idx < diffs.length; idx++) {
      const d = diffs[idx]
      const sn = invSnaps[idx]
      if (!sn.exists()) continue
      const curItem = sn.data()
      await updateDoc(doc(db, 'inventory_items', d.inventory_item_id), {
        stock: increment(-d.delta),
      })
      await addDoc(movementsCol, {
        item_id: d.inventory_item_id,
        item_name: curItem.name,
        type: d.delta > 0 ? 'unload' : 'load',
        qty: Math.abs(d.delta),
        unit: curItem.unit ?? null,
        reason: 'modifica ordine',
        order_id: orderId,
        created_at: serverTimestamp(),
      })
    }
    comanda.inventory_consumption = newCons
  }

  comanda.items = newItems
  const agg = aggregateItems(comande)
  const extras =
    Number(cur.coperto_amount || 0) +
    Number(cur.service_charge_amount || 0) +
    Number(cur.tip_amount || 0)
  await updateDoc(ref, {
    status: ORDER_OPEN,
    comande,
    comande_statuses: comandeStatuses(comande),
    items: agg,
    total: sumItems(agg) + extras,
  })
  return mapOrder(await getDoc(ref))
}

// Annulla un ordine. Se lo stock era già stato scalato lo ripristina dallo
// snapshot del consumo — TRANNE per kind 'non_ritirato': il drink è stato
// preparato (e sprecato), quindi le scorte restano consumate.
// opts: { by: 'cliente'|'bartender', kind, phrase, message, notify }
export async function cancelOrder(id, opts = {}) {
  const {
    by = 'cliente',
    kind = null,
    phrase = null,
    message = null,
    notify: notifyClient = false,
  } = opts
  const orderRef = doc(db, 'orders', id)
  const snap = await getDoc(orderRef)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const order = snap.data()
  if (order.status === ORDER_STATUSES.ANNULLATO) return mapOrder(snap)

  // Somma gli snapshot di consumo di TUTTE le comande già scalate (i doc
  // legacy hanno lo snapshot a livello ordine, gestito da normalize).
  const norm = normalizeOrderDoc(order)
  const comande = norm.comande.map((c) => ({ ...c }))
  const consumption = comande
    .filter((c) => c.inventory_applied === true && Array.isArray(c.inventory_consumption))
    .flatMap((c) => c.inventory_consumption)
  const restoreStock = kind !== 'non_ritirato'
  if (restoreStock && consumption.length > 0) {
    const itemSnaps = await Promise.all(
      consumption.map((c) => getDoc(doc(db, 'inventory_items', c.inventory_item_id)))
    )
    // Ripristino stock con increment(+qty): commutativo, si accoda offline.
    for (let idx = 0; idx < consumption.length; idx++) {
      const c = consumption[idx]
      const s = itemSnaps[idx]
      if (!s.exists()) continue
      const cur = s.data()
      await updateDoc(doc(db, 'inventory_items', c.inventory_item_id), {
        stock: increment(c.qty),
      })
      await addDoc(movementsCol, {
        item_id: c.inventory_item_id,
        item_name: cur.name,
        type: 'load',
        qty: c.qty,
        unit: cur.unit ?? null,
        reason: 'storno',
        order_id: id,
        created_at: serverTimestamp(),
      })
    }
  }

  // Le comande non servite diventano annullate (le servite restano a storico).
  const nowIso = new Date().toISOString()
  for (const c of comande) {
    if (c.status !== ORDER_STATUSES.RITIRATO && c.status !== ORDER_STATUSES.ANNULLATO) {
      c.status = ORDER_STATUSES.ANNULLATO
      c.status_times = { ...(c.status_times || {}), [ORDER_STATUSES.ANNULLATO]: nowIso }
    }
    if (restoreStock) c.inventory_applied = false
  }
  await updateDoc(orderRef, {
    status: ORDER_STATUSES.ANNULLATO,
    comande,
    comande_statuses: comandeStatuses(comande),
    [`status_times.${ORDER_STATUSES.ANNULLATO}`]: nowIso,
    cancelled_by: by,
    cancel_kind: kind,
    cancel_phrase: phrase,
    cancel_message: message || null,
    cancel_notify: !!notifyClient,
  })
  return mapOrder(await getDoc(orderRef))
}

// --- REALTIME ---

// Ascolta in tempo reale un singolo ordine. Restituisce una funzione di
// disiscrizione. `onChange` riceve l'ordine mappato (o null se eliminato).
export function subscribeOrder(id, onChange, onError) {
  return onSnapshot(
    doc(db, 'orders', id),
    (snap) => onChange(snap.exists() ? mapOrder(snap) : null),
    onError
  )
}


// Coda attiva (solo ricevuto/in_preparazione): usata per la
// stima personalizzata dei tempi. `onChange` riceve [{daily_number, status}]
// — dati minimi, gli altri ordini non vengono mostrati al cliente.
export function subscribeQueue(onChange, onError) {
  const q = query(
    ordersCol,
    where('comande_statuses', 'array-contains-any', [
      ORDER_STATUSES.RICEVUTO,
      ORDER_STATUSES.IN_PREPARAZIONE,
    ])
  )
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs
          .map((d) => ({
            daily_number: d.data().daily_number ?? 0,
            // Stato di lavorazione più avanzato tra le comande in coda.
            status: (d.data().comande_statuses || []).includes(ORDER_STATUSES.IN_PREPARAZIONE)
              ? ORDER_STATUSES.IN_PREPARAZIONE
              : ORDER_STATUSES.RICEVUTO,
            payment_required: d.data().payment_required ?? false,
            payment_status: d.data().payment_status ?? 'non_richiesto',
          }))
          // In attesa di pagamento obbligatorio: non è in coda di lavorazione.
          .filter((o) => !(o.payment_required && o.payment_status !== 'pagato'))
      )
    },
    onError ?? (() => {})
  )
}

// Ordini "pronti", in tempo reale: alimenta il tabellone
// "stiamo servendo / pronti al ritiro" nel menù cliente. Espone solo
// numero e modalità di consegna.
export function subscribeReadyOrders(onChange, onError) {
  const q = query(
    ordersCol,
    where('comande_statuses', 'array-contains', ORDER_STATUSES.PRONTO)
  )
  return onSnapshot(
    q,
    (snap) => {
      const ready = snap.docs
        .map((d) => ({
          daily_number: d.data().daily_number ?? 0,
          service_mode: d.data().service_mode ?? null,
        }))
        .sort((a, b) => a.daily_number - b.daily_number)
      onChange(ready)
    },
    onError ?? (() => {})
  )
}

// Sostituisce l'intero catalogo (drinks + categories) con i prodotti
// importati da un CSV. Usato dal pannello admin; richiede bartender
// autenticato (rules). `onProgress(msg)` per il feedback in UI.
export async function replaceCatalog({ categories, products }, onProgress = () => {}) {
  const now = new Date().toISOString()

  // 1. Svuota il catalogo esistente (a blocchi: writeBatch max 500 op).
  for (const [col, ref] of [['drinks', drinksCol], ['categories', categoriesCol]]) {
    const snap = await getDocs(ref)
    const docs = snap.docs
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db)
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    if (docs.length) onProgress(`Svuotata "${col}" (${docs.length})`)
  }

  // 2. Categorie (id pre-generati per collegare i drink nello stesso giro).
  const catIds = {}
  {
    const batch = writeBatch(db)
    categories.forEach((name, i) => {
      const ref = doc(categoriesCol)
      catIds[name] = ref.id
      batch.set(ref, { name, sort_order: i, created_at: now })
    })
    await batch.commit()
    onProgress(`Create ${categories.length} categorie`)
  }

  // 3. Prodotti.
  for (let i = 0; i < products.length; i += 400) {
    const batch = writeBatch(db)
    for (const p of products.slice(i, i + 400)) {
      batch.set(doc(drinksCol), {
        name: p.name,
        description: p.description ?? null,
        category: p.category,
        category_id: catIds[p.category] ?? null,
        recipe: null,
        recipe_items: [],
        price: p.price,
        available: true,
        image_url: null,
        sumup_product_id: p.sumup_product_id ?? null,
        created_at: now,
      })
    }
    await batch.commit()
    onProgress(`Importati ${Math.min(i + 400, products.length)}/${products.length} prodotti`)
  }
}

// --- STAFF CALLS (cerca-persone) ---

const staffCallsCol = collection(db, 'staff_calls')
const staffHoursCol = collection(db, 'staff_hours')

// ── RAPP ORE: registro ore dello staff (per mese) ─────────────────────

export async function addStaffHours({ staff_uid = null, staff_name, date, start, end, break_minutes = 0, hours, note = null, kind = 'effettivo' }) {
  const ref = await addDoc(staffHoursCol, {
    // Il turno è di un MEMBRO dello staff: l'uid è il riferimento stabile,
    // il nome resta come etichetta leggibile nei registri.
    staff_uid,
    staff_name: String(staff_name || '').trim(),
    date, // YYYY-MM-DD
    month: String(date || '').slice(0, 7), // per la query mensile
    start,
    end,
    break_minutes: Number(break_minutes) || 0,
    hours: Number(hours) || 0,
    note: note || null,
    // 'programmato' = turno pianificato, 'effettivo' = ore realmente
    // lavorate (correzione manuale o storico Excel). I doc legacy senza
    // campo sono ore effettive (era il registro RAPP ORE).
    kind: kind === 'programmato' ? 'programmato' : 'effettivo',
    created_at: serverTimestamp(),
  })
  return ref.id
}

export function subscribeStaffHours(month, cb, onError) {
  const q = query(staffHoursCol, where('month', '==', month))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start).localeCompare(String(b.start)))
      cb(rows)
    },
    onError
  )
}

export async function deleteStaffHours(id) {
  await deleteDoc(doc(staffHoursCol, id))
}

// Turni in un intervallo di date (per le viste calendario giorno/
// settimana/mese, anche a cavallo di due mesi).
export function subscribeStaffHoursRange(from, to, cb, onError) {
  const q = query(staffHoursCol, where('date', '>=', from), where('date', '<=', to))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      rows.sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.start || '').localeCompare(String(b.start || ''))
      )
      cb(rows)
    },
    onError
  )
}

// Tutto il registro ore (per il dedup dell'import storico).
export async function fetchAllStaffHours() {
  const snap = await getDocs(staffHoursCol)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ── PAGHE: tariffa oraria per persona, storicizzata ───────────────────
// Un documento per persona (id = nome normalizzato, come sono registrate
// le ore) con l'elenco delle tariffe e la data da cui valgono. Dato
// sensibile: le regole lo riservano al bartender.

const staffRatesCol = collection(db, 'staff_rates')

// Le paghe sono legate al MEMBRO DELLO STAFF (uid dell'account), non a un
// nome scritto a mano: due persone possono chiamarsi uguale e un nome si
// può correggere, l'account no. Il nome si salva comunque come etichetta
// leggibile per i registri storici.

export function subscribeStaffRates(cb, onError) {
  return onSnapshot(
    staffRatesCol,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError ?? (() => {})
  )
}

// Salva l'elenco tariffe di un membro dello staff (già ordinato da paghe.js).
export async function saveStaffRates({ uid, name }, rates) {
  if (!uid) throw new Error('Serve il membro dello staff.')
  await setDoc(
    doc(staffRatesCol, uid),
    { uid, name: String(name || '').trim(), rates: rates || [], updated_at: serverTimestamp() },
    { merge: true }
  )
}

export async function deleteStaffRates(uid) {
  await deleteDoc(doc(staffRatesCol, uid))
}

// ── BADGE VIRTUALE: timbrature entrata/uscita dello staff ─────────────
// Al login lo staff "timbra" l'entrata, al logout l'uscita. Ogni sessione
// è un doc con clock_in/clock_out; finché `open` è vero il turno è in
// corso. Le ore effettive del calendario sommano queste sessioni chiuse
// (kind 'effettivo' come le voci manuali).

const staffShiftsCol = collection(db, 'staff_shifts')

// Timbra ENTRATA: apre una sessione, ma solo se non ce n'è già una aperta
// per questo uid (idempotente: un refresh a sessione aperta non duplica).
// Offline la query legge dalla cache; se la cache è fredda può creare un
// doppione, che il bartender corregge dal backoffice.
export async function clockIn({ uid, name }) {
  if (!uid) return null
  const openQ = query(staffShiftsCol, where('staff_uid', '==', uid), where('open', '==', true))
  const existing = await getDocs(openQ)
  if (!existing.empty) return existing.docs[0].id
  const now = new Date().toISOString()
  const ref = await addDoc(staffShiftsCol, {
    staff_uid: uid,
    staff_name: String(name || '').trim(),
    clock_in: now,
    clock_out: null,
    open: true,
    date: now.slice(0, 10),
    month: now.slice(0, 7),
    hours: 0,
    created_at: serverTimestamp(),
  })
  return ref.id
}

// Timbra USCITA: chiude la/e sessione/i aperta/e dell'uid calcolando le ore.
export async function clockOut({ uid }) {
  if (!uid) return
  const openQ = query(staffShiftsCol, where('staff_uid', '==', uid), where('open', '==', true))
  const snap = await getDocs(openQ)
  const now = new Date().toISOString()
  for (const d of snap.docs) {
    const inIso = d.data().clock_in
    await updateDoc(d.ref, {
      clock_out: now,
      open: false,
      hours: hoursBetweenIso(inIso, now) || 0,
    })
  }
}

// Timbrature in un intervallo di date (per le viste calendario). Marcate
// kind 'effettivo' per il confronto con le ore programmate.
export function subscribeStaffShiftsRange(from, to, cb, onError) {
  const q = query(staffShiftsCol, where('date', '>=', from), where('date', '<=', to))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data(), kind: 'effettivo' }))
      rows.sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.clock_in || '').localeCompare(String(b.clock_in || ''))
      )
      cb(rows)
    },
    onError
  )
}

// Correzione manuale di una timbratura (bartender): se imposta entrambi
// gli orari ricalcola le ore e chiude la sessione.
export async function updateStaffShift(id, patch) {
  const p = { ...patch }
  if (p.clock_in) {
    p.date = String(p.clock_in).slice(0, 10)
    p.month = String(p.clock_in).slice(0, 7)
  }
  if (p.clock_in && p.clock_out) {
    p.hours = hoursBetweenIso(p.clock_in, p.clock_out) || 0
    p.open = false
  }
  await updateDoc(doc(staffShiftsCol, id), p)
}

export async function deleteStaffShift(id) {
  await deleteDoc(doc(staffShiftsCol, id))
}

// Token push del dispositivo di un membro dello staff: la Cloud Function
// lo usa per recapitare la chiamata cerca-persone anche quando l'app è
// in background o chiusa.
export async function saveStaffToken(uid, token, role = null) {
  await setDoc(
    doc(db, 'staff_tokens', uid),
    { token, role, updated_at: serverTimestamp() },
    { merge: true }
  )
}

// Il bartender chiama un membro dello staff (con messaggio opzionale).
export async function createStaffCall({ to_uid, to_email, message, from_email, from_name }) {
  const ref = await addDoc(staffCallsCol, {
    to_uid,
    to_email,
    from_email: from_email ?? null,
    from_name: from_name ?? null,
    message: message || null,
    status: 'pending',
    created_at: serverTimestamp(),
    acked_at: null,
  })
  return ref.id
}

// Chiamate in attesa per un membro dello staff (realtime).
export function subscribeMyCalls(uid, onChange, onError) {
  const q = query(
    staffCallsCol,
    where('to_uid', '==', uid),
    where('status', '==', 'pending')
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError ?? (() => {})
  )
}

// Tutte le chiamate in attesa (per il feedback del bartender).
export function subscribePendingCalls(onChange, onError) {
  const q = query(staffCallsCol, where('status', '==', 'pending'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError ?? (() => {})
  )
}

// Lo staff risponde alla chiamata.
export async function ackStaffCall(id) {
  await updateDoc(doc(db, 'staff_calls', id), {
    status: 'acked',
    acked_at: serverTimestamp(),
  })
}

// --- SETTINGS ---

export const DEFAULT_SETTINGS = {
  menu_only: false,
  // GIORNATA COMMERCIALE: ora a cui "gira" la giornata. Il locale lavora
  // oltre la mezzanotte, quindi la nottata resta contata nella giornata in
  // cui è cominciata. Raggruppa statistiche e fa ripartire il progressivo
  // #N. Non chiude nulla: i conti restano aperti finché non li si chiude.
  business_day_cutoff_hour: DEFAULT_CUTOFF_HOUR,
  // PREZZO CONSIGLIATO: ricarico sul costo degli ingredienti (di norma
  // ×3, ma dipende dal drink) e passo di arrotondamento del listino.
  // È solo un suggerimento: il prezzo resta sempre modificabile a mano.
  // GESTIONE PREPARAZIONE: se spenta il locale tiene traccia solo degli
  // ordini (ricevuto → pagato), senza il ciclo di lavorazione. Sparisce
  // tutto ciò che ne dipende: avanzamenti di stato, tempi di servizio,
  // stima ETA e notifiche di "pronto". Disattivata di default: la si accende
  // solo se si vuole tracciare la preparazione.
  workflow_enabled: false,
  price_markup: DEFAULT_MARKUP,
  price_round_step: DEFAULT_ROUND_STEP,
  // IVA di vendita (somministrazione bar = 10%): serve a scorporare l'IVA dal
  // fatturato per confrontarlo al netto con gli acquisti (Dashboard mensile).
  sale_vat: 10,
  coperto_enabled: false,
  coperto_amount: 2,
  service_charge_enabled: false,
  service_charge_percent: 10,
  tip_enabled: false,
  show_ingredient_quantities: true,
  // Modalità di consegna: 'tavolo' (servizio), 'banco' (ritiro) o 'entrambi'
  // (sceglie il cliente all'ordine). Il ritiro al banco azzera coperto e
  // costo di servizio.
  service_mode: 'tavolo',
  // Tempo stimato di servizio mostrato ai clienti: parte dal tempo base e si
  // raffina con i tempi reali del servizio.
  eta_enabled: false,
  eta_base_minutes: 10,
  // Frase di default mostrata al cliente quando il bartender annulla un
  // ordine: 'bancone' o 'staff' (vedi CANCEL_PHRASES).
  cancel_phrase_default: 'bancone',
  // Tabellone "stiamo servendo / pronti al ritiro" nel menù cliente.
  show_serving_board: true,
  // Account clienti: se disattivato, login/registrazione clienti nascosti
  // (lo staff continua ad accedere da /bar).
  customer_accounts_enabled: true,
  // Geolocalizzazione obbligatoria per ordinare (verifica di prossimità).
  geofence_enabled: false,
  venue_address: '',
  venue_lat: null,
  venue_lng: null,
  venue_radius_m: 150,
  // Coda ordini bartender: 'tabs' (schede per stato) o 'lista' (lista unica
  // con stato indicato da colore/etichetta sulla card).
  queue_view: 'griglia',
  // Vista ordine: raggruppamento di default degli item aggiunti —
  // 'separati' (ogni tocco una riga a sé) o 'uniti' (item uguali sommati).
  // Si può comunque unire/separare al volo dal riepilogo ordine.
  order_group_default: 'separati',
  // Dove finisce l'item appena aggiunto nella lista ordine: in fondo (default,
  // e la lista scorre a mostrarlo) o in cima (subito visibile senza scorrere).
  pos_add_top: false,
  // Come mostrare le categorie nel POS: 'dot' (pallino + testo, come ora),
  // 'icon_text' (icona + testo) o 'icon' (solo icona).
  category_display: 'dot',
  // Pagamenti: online (SumUp Checkout) e lettore Solo (Cloud API).
  payments_online_enabled: false,
  payments_online_required: false,
  payments_reader_enabled: false,
  sumup_reader_id: null,
  sumup_reader_name: null,
  // Chi non paga online deve ritirare al banco (dove c'è un banco).
  banco_required_if_unpaid: false,
  // Gruppi di ordini (contenitori associabili ai clienti).
  groups_enabled: false,
  groups_in_drawer: true,
  groups_in_queue: true,
  // Temi: preset + eventuali override colore, separati per gestionale
  // (staff/bartender) e vista cliente. Vedi src/lib/themes.js.
  theme_staff: { preset: 'tana-scuro', custom: null },
  theme_client: { preset: 'tana-scuro', custom: null },
}

export function subscribeSettings(onChange, onError) {
  return onSnapshot(
    settingsDoc,
    (snap) => {
      if (!snap.exists()) return onChange({ ...DEFAULT_SETTINGS })
      const data = snap.data()
      const merged = { ...DEFAULT_SETTINGS, ...data }
      // Retrocompatibilità col vecchio flag booleano della scelta consegna.
      if (!data.service_mode && data.service_mode_choice_enabled) {
        merged.service_mode = 'entrambi'
      }
      onChange(merged)
    },
    onError ?? (() => {})
  )
}

export async function updateSettings(data) {
  await setDoc(settingsDoc, { ...data, updated_at: serverTimestamp() }, { merge: true })
}

// --- CONFIG STAMPANTE (persistita anche su server) ---
// L'IP e le preferenze stampante stavano solo in localStorage, che su iPad/
// Safari (PWA) viene svuotato dopo giorni di inattività (ITP): l'IP si perdeva.
// Le mirror-iamo su Firestore (doc condiviso del locale) e reidratiamo il
// localStorage all'avvio, così l'IP sopravvive alla pulizia della cache.
const printerConfigDoc = doc(db, 'settings', 'printer')

export function subscribePrinterConfig(onChange, onError) {
  return onSnapshot(
    printerConfigDoc,
    (snap) => onChange(snap.exists() ? snap.data() : null),
    onError ?? (() => {})
  )
}

// Salvataggio local-first: scrittura in background, non blocca offline.
export function savePrinterConfig(patch) {
  setDoc(printerConfigDoc, { ...patch, updated_at: serverTimestamp() }, { merge: true }).catch(() => {})
}
