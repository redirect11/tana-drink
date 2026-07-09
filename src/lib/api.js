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
  runTransaction,
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
import { notify } from './notify.js'

const drinksCol = collection(db, 'drinks')
const ordersCol = collection(db, 'orders')
const categoriesCol = collection(db, 'categories')
const inventoryCol = collection(db, 'inventory_items')
const inventoryCategoriesCol = collection(db, 'inventory_categories')
const suppliersCol = collection(db, 'suppliers')
const movementsCol = collection(db, 'stock_movements')
const settingsDoc = doc(db, 'settings', 'bar')
const serateCol = collection(db, 'serate')
const groupsCol = collection(db, 'groups')
const paymentsCol = collection(db, 'payments')

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
  return {
    id: snap.id,
    daily_number: o.daily_number ?? null,
    order_date: o.order_date ?? null,
    table_label: o.table_label ?? null,
    note: o.note ?? null,
    status: o.status,
    total: o.total ?? 0,
    coperto_persons: o.coperto_persons ?? 0,
    coperto_amount: o.coperto_amount ?? 0,
    service_charge_amount: o.service_charge_amount ?? 0,
    tip_amount: o.tip_amount ?? 0,
    service_mode: o.service_mode ?? null,
    placed_by: o.placed_by ?? null,
    customer_name: o.customer_name ?? null,
    customer_uid: o.customer_uid ?? null,
    status_times: o.status_times ?? {},
    cancelled_by: o.cancelled_by ?? null,
    cancel_kind: o.cancel_kind ?? null,
    cancel_phrase: o.cancel_phrase ?? null,
    cancel_message: o.cancel_message ?? null,
    cancel_notify: o.cancel_notify ?? false,
    created_at: toIso(o.created_at),
    sumup_sale_id: o.sumup_sale_id ?? null,
    serata_id: o.serata_id ?? null,
    payment_method: o.payment_method ?? null,
    payment_status: o.payment_status ?? 'non_richiesto',
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
    order_items: items.map((i, idx) => ({
      id: `${snap.id}-${idx}`,
      drink_id: i.drink_id ?? null,
      name: i.name,
      unit_price: i.unit_price ?? 0,
      qty: i.qty ?? 1,
      sumup_product_id: i.sumup_product_id ?? null,
      custom: i.custom ?? false,
    })),
  }
}

// Data "di Roma" in formato YYYY-MM-DD per la numerazione giornaliera.
function romeDateKey() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
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

export async function createCategory({ name, sort_order = 0 }) {
  const ref = await addDoc(categoriesCol, { name, sort_order, created_at: serverTimestamp() })
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

export async function createInventoryCategory({ name, sort_order = 0 }) {
  const ref = await addDoc(inventoryCategoriesCol, { name, sort_order, created_at: serverTimestamp() })
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

// --- FORNITORI ---

function mapSupplier(snap) {
  const s = snap.data() || {}
  return {
    id: snap.id,
    name: s.name ?? '',
    sort_order: s.sort_order ?? 0,
    notes: s.notes ?? null,
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
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('Prodotto non trovato')
    const cur = s.data()
    tx.update(ref, { stock: (Number(cur.stock) || 0) + qty })
    tx.set(doc(movementsCol), {
      item_id: itemId,
      item_name: cur.name,
      type: qty >= 0 ? 'load' : 'unload',
      qty: Math.abs(qty),
      unit: cur.unit ?? null,
      reason,
      created_at: serverTimestamp(),
    })
  })
  return mapItem(await getDoc(ref))
}

// Carico a confezioni: aggiunge `count` bottiglie piene (+ eventuale bottiglia
// aperta con `openQty` di contenuto). Aggiorna giacenza e numero totale di
// bottiglie, scartando le vuote accumulate (al riassortimento si buttano).
export async function receiveBottles(itemId, count, openQty = 0) {
  const ref = doc(db, 'inventory_items', itemId)
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
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

    tx.update(ref, { stock: newStock, bottles_total: newTotal })
    tx.set(doc(movementsCol), {
      item_id: itemId,
      item_name: cur.name,
      type: 'load',
      qty: addQty,
      unit: cur.unit ?? null,
      reason: 'carico',
      created_at: serverTimestamp(),
    })
  })
  return mapItem(await getDoc(ref))
}

// Rettifica: imposta lo stock a un valore assoluto e registra il delta.
export async function adjustStock(itemId, newStock) {
  const ref = doc(db, 'inventory_items', itemId)
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('Prodotto non trovato')
    const cur = s.data()
    const delta = newStock - (Number(cur.stock) || 0)
    const size = Number(cur.package_size) || 0
    // Mantieni coerente il numero totale di bottiglie con la nuova giacenza.
    const minTotal = size ? Math.ceil(newStock / size) : 0
    const patch = { stock: newStock }
    if (minTotal > (Number(cur.bottles_total) || 0)) patch.bottles_total = minTotal
    tx.update(ref, patch)
    if (delta !== 0) {
      tx.set(doc(movementsCol), {
        item_id: itemId,
        item_name: cur.name,
        type: delta > 0 ? 'load' : 'unload',
        qty: Math.abs(delta),
        unit: cur.unit ?? null,
        reason: 'rettifica',
        created_at: serverTimestamp(),
      })
    }
  })
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
  await runTransaction(db, async (tx) => {
    const countRef = doc(db, 'stock_counts', id)
    const countSnap = await tx.get(countRef)
    if (!countSnap.exists()) throw new Error('Conta non trovata')
    if (countSnap.data().status !== 'open') throw new Error('Conta già chiusa')

    // --- LETTURE ---
    const toAlign = align
      ? lines.filter((l) => l.rim != null && l.rim !== '')
      : []
    const itemSnaps = await Promise.all(
      toAlign.map((l) => tx.get(doc(db, 'inventory_items', l.item_id)))
    )

    // --- SCRITTURE ---
    toAlign.forEach((l, idx) => {
      const s = itemSnaps[idx]
      if (!s.exists()) return
      const cur = s.data()
      const rim = Number(l.rim) || 0
      const delta = rim - (Number(cur.stock) || 0)
      if (delta === 0) return
      tx.update(doc(db, 'inventory_items', l.item_id), { stock: rim })
      tx.set(doc(movementsCol), {
        item_id: l.item_id,
        item_name: cur.name,
        type: delta > 0 ? 'load' : 'unload',
        qty: Math.abs(delta),
        unit: cur.unit ?? null,
        reason: 'conta',
        created_at: serverTimestamp(),
      })
    })

    tx.update(countRef, {
      status: 'closed',
      closed_at: serverTimestamp(),
      lines,
      totals,
    })
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
  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, 'purchase_orders', id)
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Ordine non trovato')
    const order = orderSnap.data()
    if (order.status === 'ricevuto') return

    const lines = (order.lines || []).filter((l) => (Number(l.qty_packages) || 0) > 0)

    // --- LETTURE ---
    const itemSnaps = await Promise.all(
      lines.map((l) => tx.get(doc(db, 'inventory_items', l.item_id)))
    )

    // --- SCRITTURE ---
    lines.forEach((l, idx) => {
      const s = itemSnaps[idx]
      if (!s.exists()) return
      const cur = s.data()
      const qty = Number(l.qty_packages) || 0
      const size = Number(cur.package_size) || 0
      const stock = Number(cur.stock) || 0

      let addQty
      const patch = {}
      if (cur.unit === 'pz' || !size) {
        addQty = qty
        patch.stock = stock + addQty
      } else {
        addQty = qty * size
        const full = Math.floor(stock / size)
        const hasOpen = stock - full * size > 1e-9
        patch.stock = stock + addQty
        patch.bottles_total = full + (hasOpen ? 1 : 0) + qty
      }
      tx.update(doc(db, 'inventory_items', l.item_id), patch)
      tx.set(doc(movementsCol), {
        item_id: l.item_id,
        item_name: cur.name,
        type: 'load',
        qty: addQty,
        unit: cur.unit ?? null,
        reason: 'ordine fornitore',
        created_at: serverTimestamp(),
      })
    })

    tx.update(orderRef, { status: 'ricevuto', received_at: serverTimestamp() })
  })
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

// --- SERATE (sessioni / conto) ---

function mapSerata(snap) {
  const s = snap.data() || {}
  return {
    id: snap.id,
    status: s.status ?? 'open',
    opened_at: toIso(s.opened_at),
    closed_at: toIso(s.closed_at),
    orders_count: s.orders_count ?? null,
    total: s.total ?? null,
    // Statistiche tempi: prep_stats (attesa+preparazione, tutti gli ordini),
    // eta_stats (ciclo completo, solo ordini serviti al tavolo).
    prep_stats: s.prep_stats ?? null,
    eta_stats: s.eta_stats ?? null,
    report: s.report ?? null,
  }
}

// La serata attualmente aperta (o null).
export async function getOpenSerata() {
  const snap = await getDocs(query(serateCol, where('status', '==', 'open'), fbLimit(1)))
  return snap.empty ? null : mapSerata(snap.docs[0])
}

// Apre una nuova serata (errore se ce n'è già una aperta).
export async function openSerata() {
  const existing = await getOpenSerata()
  if (existing) return existing
  const ref = await addDoc(serateCol, { status: 'open', opened_at: serverTimestamp() })
  return mapSerata(await getDoc(ref))
}

// Chiude la serata salvando il riepilogo (n. ordini e totale dei non annullati).
export async function closeSerata(id, report = null) {
  const snap = await getDocs(query(ordersCol, where('serata_id', '==', id)))
  const orders = snap.docs.map(mapOrder).filter((o) => o.status !== ORDER_STATUSES.ANNULLATO)
  const total = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const ref = doc(db, 'serate', id)
  await updateDoc(ref, {
    status: 'closed',
    closed_at: serverTimestamp(),
    orders_count: orders.length,
    total,
    ...(report ? { report } : {}),
  })
  return mapSerata(await getDoc(ref))
}

// Realtime sulla serata aperta (per il menù cliente e l'header bartender).
export function subscribeOpenSerata(onChange, onError) {
  const q = query(serateCol, where('status', '==', 'open'), fbLimit(1))
  return onSnapshot(
    q,
    (snap) => onChange(snap.empty ? null : mapSerata(snap.docs[0])),
    onError
  )
}

// Realtime su tutti gli ordini di una serata (tutti gli stati).
export function subscribeSerataOrders(serataId, onChange, onError) {
  const q = query(ordersCol, where('serata_id', '==', serataId))
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map(mapOrder)
      orders.sort((a, b) =>
        String(a.created_at || '').localeCompare(String(b.created_at || ''))
      )
      onChange(orders)
    },
    onError
  )
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
    serata_id: g.serata_id ?? null,
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
export async function ensureCustomerGroup(uid, name, serata_id = null) {
  await setDoc(
    doc(groupsCol, uid),
    {
      kind: 'customer',
      customer_uid: uid,
      name: name || 'Cliente',
      parent_group_id: null,
      has_child_groups: false,
      serata_id: serata_id ?? null,
      status: 'aperto',
      last_order_at: serverTimestamp(),
    },
    { merge: true }
  )
}

// Gruppo manuale creato dallo staff (eventualmente annidato in un padre).
export async function createManualGroup({ name, serata_id, parent_group_id = null, created_by = null }) {
  const ref = await addDoc(groupsCol, {
    kind: 'manual',
    name: name?.trim() || 'Gruppo',
    customer_uid: null,
    parent_group_id: parent_group_id || null,
    has_child_groups: false,
    serata_id: serata_id ?? null,
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

export async function fetchGroup(id) {
  const snap = await getDoc(doc(groupsCol, id))
  return snap.exists() ? mapGroup(snap) : null
}

// Gruppi della serata (manuali) — per drawer e coda.
export function subscribeSerataGroups(serataId, onChange, onError) {
  const q = query(groupsCol, where('serata_id', '==', serataId))
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
export async function payGroupCash({
  serataId,
  orderIds,
  by = null,
  group_id = null,
  group_ids = [],
  split = null,
}) {
  if (!orderIds || orderIds.length === 0) return null
  const nowIso = new Date().toISOString()
  const settlementId = doc(paymentsCol).id

  await runTransaction(db, async (tx) => {
    const refs = orderIds.map((id) => doc(ordersCol, id))
    const snaps = await Promise.all(refs.map((r) => tx.get(r)))
    let total = 0
    const covered = []
    const items = []
    snaps.forEach((s, i) => {
      if (!s.exists()) return
      const o = s.data()
      if (o.status === ORDER_STATUSES.ANNULLATO || o.payment_status === 'pagato') return
      total += Number(o.total) || 0
      covered.push({ ref: refs[i], status: o.status })
      for (const it of o.items || []) {
        items.push({ order_id: refs[i].id, name: it.name, qty: it.qty, unit_price: it.unit_price })
      }
    })
    if (covered.length === 0) return

    for (const { ref, status } of covered) {
      const patch = {
        payment_status: 'pagato',
        payment_method: 'banco',
        paid_at: nowIso,
        payment_id: settlementId,
      }
      // Chiude l'ordine come "pagato" solo se è già stato ritirato/servito;
      // altrimenti resta nel suo stato di preparazione (l'auto-avanzamento
      // lo chiuderà al ritiro).
      if (status === ORDER_STATUSES.RITIRATO) {
        patch.status = ORDER_STATUSES.PAGATO
        patch[`status_times.${ORDER_STATUSES.PAGATO}`] = nowIso
      }
      tx.update(ref, patch)
    }

    const orderIdsCovered = covered.map((c) => c.ref.id)
    const baseDoc = {
      serata_id: serataId,
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
      amounts.forEach((amt, idx) => {
        tx.set(doc(paymentsCol), {
          ...baseDoc,
          amount: amt,
          split_count: split.count,
          split_index: idx + 1,
        })
      })
    } else {
      tx.set(doc(paymentsCol), { ...baseDoc, amount: Math.round(total * 100) / 100, split_count: null, split_index: null })
    }
  })
  return settlementId
}

// Crea un pagamento "in attesa" per un gruppo (usato dai pagamenti SumUp:
// il documento porta importo e order_ids; il checkout SumUp lo salda via
// Cloud Function/webhook). Restituisce il paymentId.
export async function createPendingGroupPayment({
  serataId,
  orderIds,
  amount,
  method, // 'online' | 'lettore'
  group_id = null,
  group_ids = [],
  items = [],
  by = null,
}) {
  const ref = await addDoc(paymentsCol, {
    serata_id: serataId,
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
    serata_id: p.serata_id ?? null,
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

// Storico pagamenti della serata (realtime, più recenti prima).
export function subscribePayments(serataId, onChange, onError) {
  const q = query(paymentsCol, where('serata_id', '==', serataId))
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(mapPayment)
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      onChange(list)
    },
    onError ?? (() => {})
  )
}

// --- ORDERS ---

// Crea un ordine con i relativi item. Il numero progressivo riparte ad ogni
// serata: è assegnato in modo atomico da un contatore per serata
// (counters/{serataId}). Richiede una serata aperta.
export async function createOrder({
  table_label,
  note,
  items,
  serata_id,
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
}) {
  if (!serata_id) throw new Error('Nessuna serata aperta: ordini non disponibili.')
  // Cliente registrato senza gruppo esplicito → gruppo-cliente automatico
  // (id == uid). Il documento è idempotente (merge).
  if (!group_id && customer_uid) {
    group_id = customer_uid
    if (!group_name_snapshot) group_name_snapshot = customer_name || null
    await ensureCustomerGroup(customer_uid, customer_name || 'Cliente', serata_id).catch(
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
  const orderDate = romeDateKey()
  const counterRef = doc(db, 'counters', serata_id)
  const newOrderRef = doc(ordersCol)

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef)
    const last = counterSnap.exists() ? counterSnap.data().last || 0 : 0
    const dailyNumber = last + 1
    tx.set(counterRef, { last: dailyNumber }, { merge: true })

    tx.set(newOrderRef, {
      daily_number: dailyNumber,
      order_date: orderDate,
      serata_id,
      table_label: table_label || null,
      note: note || null,
      status,
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
      created_at: serverTimestamp(),
      items: items.map((i) => ({
        drink_id: i.drink_id,
        name: i.name,
        unit_price: i.price,
        qty: i.qty,
        sumup_product_id: i.sumup_product_id ?? null,
        // Drink custom composti al volo dal bartender: la ricetta viaggia
        // incorporata nell'item (non esiste un doc in `drinks`) e viene
        // usata per lo scarico inventario alla preparazione.
        ...(i.custom ? { custom: true, recipe_items: i.recipe_items ?? [] } : {}),
      })),
    })
  })

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
const INACTIVE_STATUSES = [
  ORDER_STATUSES.RITIRATO,
  ORDER_STATUSES.PAGATO,
  ORDER_STATUSES.ANNULLATO,
]

export async function fetchActiveOrders() {
  const snap = await getDocs(
    query(ordersCol, where('status', 'not-in', INACTIVE_STATUSES))
  )
  const orders = snap.docs.map(mapOrder)
  orders.sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
  return orders
}

// Chiude definitivamente l'ordine come pagato, registrando il metodo
// d'incasso ('banco' per contanti/POS esterno, 'lettore', 'online').
export async function markOrderPaid(id, method) {
  const nowIso = new Date().toISOString()
  await updateDoc(doc(db, 'orders', id), {
    status: ORDER_STATUSES.PAGATO,
    [`status_times.${ORDER_STATUSES.PAGATO}`]: nowIso,
    payment_method: method,
    payment_status: 'pagato',
    paid_at: nowIso,
  })
}

export async function updateOrderStatus(id, status) {
  const ref = doc(db, 'orders', id)
  const nowIso = new Date().toISOString()

  if (status === ORDER_STATUSES.IN_PREPARAZIONE) {
    // Allo "sta preparando" scala l'inventario (una sola volta per ordine).
    await applyDepletionAndAdvance(id, status)
  } else {
    await updateDoc(ref, { status, [`status_times.${status}`]: nowIso })
  }

  let snap = await getDoc(ref)

  // Ordine già pagato (online o lettore) che viene ritirato/servito:
  // si chiude da solo come "pagato" (c'è anche la cintura lato server).
  if (
    status === ORDER_STATUSES.RITIRATO &&
    snap.data()?.payment_status === 'pagato'
  ) {
    await updateDoc(ref, {
      status: ORDER_STATUSES.PAGATO,
      [`status_times.${ORDER_STATUSES.PAGATO}`]: new Date().toISOString(),
    })
    snap = await getDoc(ref)
  }

  // Statistiche tempi sulla serata (per ETA cliente e resoconto).
  // - al "pronto": attesa+preparazione, su tutti gli ordini
  // - al "ritirato": ciclo completo, solo per ordini serviti al tavolo
  updateSerataTimeStats(snap, status).catch((e) =>
    console.error('[eta] aggiornamento statistiche fallito:', e)
  )

  // Sync stato verso SumUp POS Pro in background (fire-and-forget).
  const sumupStatus = toSumUpStatus(status)
  if (sumupStatus) {
    const sumupSaleId = snap.data()?.sumup_sale_id ?? null
    updateSumUpSaleStatus(sumupSaleId, sumupStatus)
      .catch((e) => console.error('[SumUp] updateStatus failed:', e))
  }

  return mapOrder(snap)
}

// Incrementa le statistiche tempi della serata quando un ordine raggiunge
// "pronto" (attesa+preparazione, tutti gli ordini) o "ritirato" (ciclo
// completo, solo servizio al tavolo: il ritiro al banco dipende dal cliente).
async function updateSerataTimeStats(orderSnap, status) {
  const o = orderSnap.data()
  if (!o?.serata_id) return
  const ms = (v) => {
    if (!v) return null
    if (typeof v?.toMillis === 'function') return v.toMillis()
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : null
  }
  const t0 = ms(o.created_at)
  const t1 = ms(o.status_times?.[ORDER_STATUSES.IN_PREPARAZIONE])
  const t2 = ms(o.status_times?.[ORDER_STATUSES.PRONTO])
  const t3 = ms(o.status_times?.[ORDER_STATUSES.RITIRATO])
  const serataRef = doc(db, 'serate', o.serata_id)

  if (status === ORDER_STATUSES.PRONTO && t0 && t1 && t2 && t2 >= t1 && t1 >= t0) {
    await updateDoc(serataRef, {
      'prep_stats.count': increment(1),
      'prep_stats.attesa_ms': increment(t1 - t0),
      'prep_stats.prep_ms': increment(t2 - t1),
      'prep_stats.total_ms': increment(t2 - t0),
    })
  }

  if (
    status === ORDER_STATUSES.RITIRATO &&
    o.service_mode === 'tavolo' &&
    t0 && t1 && t2 && t3 && t3 >= t2 && t2 >= t1 && t1 >= t0
  ) {
    await updateDoc(serataRef, {
      'eta_stats.count': increment(1),
      'eta_stats.attesa_ms': increment(t1 - t0),
      'eta_stats.prep_ms': increment(t2 - t1),
      'eta_stats.ritiro_ms': increment(t3 - t2),
      'eta_stats.total_ms': increment(t3 - t0),
    })
  }
}

// Avanza lo stato e, se non già fatto, scala l'inventario in base alle ricette
// dei drink dell'ordine. Tutto in una transazione (letture prima delle scritture).
// Dopo il commit notifica gli item scesi sotto soglia.
async function applyDepletionAndAdvance(id, status) {
  const orderRef = doc(db, 'orders', id)
  const nowIso = new Date().toISOString()
  let lowStock = []

  await runTransaction(db, async (tx) => {
    lowStock = []
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Ordine non trovato')
    const order = orderSnap.data()

    // Già scalato in precedenza: aggiorna solo lo stato.
    if (order.inventory_applied === true) {
      tx.update(orderRef, { status, [`status_times.${status}`]: nowIso })
      return
    }

    const items = Array.isArray(order.items) ? order.items : []

    // --- LETTURE ---
    // Gli item custom hanno la ricetta incorporata: niente lookup su `drinks`.
    const drinkIds = [...new Set(items.filter((i) => !i.custom).map((i) => i.drink_id).filter(Boolean))]
    const drinkSnaps = await Promise.all(drinkIds.map((d) => tx.get(doc(db, 'drinks', d))))
    const drinksById = {}
    drinkSnaps.forEach((s, idx) => {
      drinksById[drinkIds[idx]] = s.exists() ? s.data() : null
    })

    const consumption = computeConsumption(items, drinksById)
    const itemSnaps = await Promise.all(
      consumption.map((c) => tx.get(doc(db, 'inventory_items', c.inventory_item_id)))
    )

    // --- SCRITTURE ---
    consumption.forEach((c, idx) => {
      const s = itemSnaps[idx]
      if (!s.exists()) return
      const cur = s.data()
      const newStock = (Number(cur.stock) || 0) - c.qty
      tx.update(doc(db, 'inventory_items', c.inventory_item_id), { stock: newStock })
      tx.set(doc(movementsCol), {
        item_id: c.inventory_item_id,
        item_name: cur.name,
        type: 'unload',
        qty: c.qty,
        unit: cur.unit ?? null,
        reason: 'ordine',
        order_id: id,
        created_at: serverTimestamp(),
      })
      if (newStock <= (Number(cur.low_threshold) || 0)) {
        lowStock.push({ name: cur.name, stock: newStock, unit: cur.unit })
      }
    })

    // Salva lo snapshot del consumo: serve a ripristinare lo stock se l'ordine
    // viene annullato (ripristino esatto, indipendente da modifiche alle ricette).
    tx.update(orderRef, {
      status,
      [`status_times.${status}`]: nowIso,
      inventory_applied: true,
      inventory_consumption: consumption,
    })
  })

  // Notifica scorte basse/finite (fuori dalla transazione).
  for (const it of lowStock) {
    const stato = it.stock <= 0 ? 'esaurito' : 'in esaurimento'
    notify(
      `⚠️ Scorta ${stato}`,
      `${it.name}: rimasti ${formatQty(it.stock, it.unit)}`
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

export async function updateOrderItems(id, items) {
  const ref = doc(db, 'orders', id)
  const itemsTotal = items.reduce((s, i) => s + i.qty * Number(i.unit_price ?? i.price ?? 0), 0)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Ordine non trovato')
    const cur = snap.data()
    if (cur.status !== ORDER_STATUSES.RICEVUTO) {
      throw new Error('Ordine già in preparazione: non più modificabile')
    }
    // Il totale conserva coperto/servizio/mancia già applicati alla creazione.
    const extras =
      Number(cur.coperto_amount || 0) +
      Number(cur.service_charge_amount || 0) +
      Number(cur.tip_amount || 0)
    const total = itemsTotal + extras
    tx.update(ref, {
      items: items.map((i) => ({
        drink_id: i.drink_id,
        name: i.name,
        unit_price: i.unit_price ?? i.price ?? 0,
        qty: i.qty,
        sumup_product_id: i.sumup_product_id ?? null,
      })),
      total,
    })
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
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef)
    if (!snap.exists()) throw new Error('Ordine non trovato')
    const order = snap.data()
    if (order.status === ORDER_STATUSES.ANNULLATO) return

    const consumption = Array.isArray(order.inventory_consumption) ? order.inventory_consumption : []
    const restoreStock = kind !== 'non_ritirato'
    if (restoreStock && order.inventory_applied === true && consumption.length > 0) {
      // --- letture ---
      const itemSnaps = await Promise.all(
        consumption.map((c) => tx.get(doc(db, 'inventory_items', c.inventory_item_id)))
      )
      // --- scritture: ripristino stock ---
      consumption.forEach((c, idx) => {
        const s = itemSnaps[idx]
        if (!s.exists()) return
        const cur = s.data()
        tx.update(doc(db, 'inventory_items', c.inventory_item_id), {
          stock: (Number(cur.stock) || 0) + c.qty,
        })
        tx.set(doc(movementsCol), {
          item_id: c.inventory_item_id,
          item_name: cur.name,
          type: 'load',
          qty: c.qty,
          unit: cur.unit ?? null,
          reason: 'storno',
          order_id: id,
          created_at: serverTimestamp(),
        })
      })
    }

    tx.update(orderRef, {
      status: ORDER_STATUSES.ANNULLATO,
      inventory_applied: restoreStock ? false : order.inventory_applied === true,
      [`status_times.${ORDER_STATUSES.ANNULLATO}`]: new Date().toISOString(),
      cancelled_by: by,
      cancel_kind: kind,
      cancel_phrase: phrase,
      cancel_message: message || null,
      cancel_notify: !!notifyClient,
    })
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

// Ascolta in tempo reale gli ordini attivi (coda bartender). Restituisce una
// funzione di disiscrizione. `onChange` riceve la lista ordinata di ordini.
export function subscribeActiveOrders(onChange, onError) {
  const q = query(ordersCol, where('status', 'not-in', INACTIVE_STATUSES))
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map(mapOrder)
      orders.sort((a, b) =>
        String(a.created_at || '').localeCompare(String(b.created_at || ''))
      )
      onChange(orders)
    },
    onError
  )
}

// Serate chiuse più recenti (per le statistiche).
export async function fetchClosedSerate(limitN = 30) {
  const snap = await getDocs(
    query(serateCol, where('status', '==', 'closed'), orderBy('closed_at', 'desc'), fbLimit(limitN))
  )
  return snap.docs.map(mapSerata)
}

// Tutti gli ordini di un insieme di serate (per le statistiche).
// Firestore: massimo 30 valori per clausola "in" → suddivisione in blocchi.
export async function fetchOrdersForSerate(serataIds) {
  if (!serataIds || serataIds.length === 0) return []
  const chunks = []
  for (let i = 0; i < serataIds.length; i += 30) chunks.push(serataIds.slice(i, i + 30))
  const results = []
  for (const chunk of chunks) {
    const snap = await getDocs(query(ordersCol, where('serata_id', 'in', chunk)))
    results.push(...snap.docs.map(mapOrder))
  }
  return results
}

// Coda attiva di una serata (solo ricevuto/in_preparazione): usata per la
// stima personalizzata dei tempi. `onChange` riceve [{daily_number, status}]
// — dati minimi, gli altri ordini non vengono mostrati al cliente.
export function subscribeQueue(serataId, onChange, onError) {
  const q = query(
    ordersCol,
    where('serata_id', '==', serataId),
    where('status', 'in', [ORDER_STATUSES.RICEVUTO, ORDER_STATUSES.IN_PREPARAZIONE])
  )
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs
          .map((d) => ({
            daily_number: d.data().daily_number ?? 0,
            status: d.data().status,
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

// Ordini "pronti" della serata, in tempo reale: alimenta il tabellone
// "stiamo servendo / pronti al ritiro" nel menù cliente. Espone solo
// numero e modalità di consegna.
export function subscribeReadyOrders(serataId, onChange, onError) {
  const q = query(
    ordersCol,
    where('serata_id', '==', serataId),
    where('status', '==', ORDER_STATUSES.PRONTO)
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

// Token push del dispositivo di un membro dello staff: la Cloud Function
// lo usa per recapitare la chiamata cerca-persone anche quando l'app è
// in background o chiusa.
export async function saveStaffToken(uid, token) {
  await setDoc(
    doc(db, 'staff_tokens', uid),
    { token, updated_at: serverTimestamp() },
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
  // raffina con i tempi reali della serata.
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
