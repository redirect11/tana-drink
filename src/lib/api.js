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
import { createSumUpSale, updateSumUpSaleStatus, toSumUpStatus } from './sumupApi.js'
import { computeConsumption, formatQty } from './inventory.js'
import { notify } from './notify.js'

const drinksCol = collection(db, 'drinks')
const ordersCol = collection(db, 'orders')
const categoriesCol = collection(db, 'categories')
const inventoryCol = collection(db, 'inventory_items')
const inventoryCategoriesCol = collection(db, 'inventory_categories')
const movementsCol = collection(db, 'stock_movements')
const settingsDoc = doc(db, 'settings', 'bar')
const serateCol = collection(db, 'serate')

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
    order_items: items.map((i, idx) => ({
      id: `${snap.id}-${idx}`,
      drink_id: i.drink_id ?? null,
      name: i.name,
      unit_price: i.unit_price ?? 0,
      qty: i.qty ?? 1,
      sumup_product_id: i.sumup_product_id ?? null,
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
}) {
  if (!serata_id) throw new Error('Nessuna serata aperta: ordini non disponibili.')
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
      status: ORDER_STATUSES.RICEVUTO,
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
      created_at: serverTimestamp(),
      items: items.map((i) => ({
        drink_id: i.drink_id,
        name: i.name,
        unit_price: i.price,
        qty: i.qty,
        sumup_product_id: i.sumup_product_id ?? null,
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

// Coda del bartender: ordini attivi (non ancora ritirati).
const INACTIVE_STATUSES = [ORDER_STATUSES.RITIRATO, ORDER_STATUSES.ANNULLATO]

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

export async function updateOrderStatus(id, status) {
  const ref = doc(db, 'orders', id)
  const nowIso = new Date().toISOString()

  if (status === ORDER_STATUSES.IN_PREPARAZIONE) {
    // Allo "sta preparando" scala l'inventario (una sola volta per ordine).
    await applyDepletionAndAdvance(id, status)
  } else {
    await updateDoc(ref, { status, [`status_times.${status}`]: nowIso })
  }

  const snap = await getDoc(ref)

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
    const drinkIds = [...new Set(items.map((i) => i.drink_id).filter(Boolean))]
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
        snap.docs.map((d) => ({
          daily_number: d.data().daily_number ?? 0,
          status: d.data().status,
        }))
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

// Il bartender chiama un membro dello staff (con messaggio opzionale).
export async function createStaffCall({ to_uid, to_email, message, from_email }) {
  const ref = await addDoc(staffCallsCol, {
    to_uid,
    to_email,
    from_email: from_email ?? null,
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
  queue_view: 'tabs',
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
