import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
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
const movementsCol = collection(db, 'stock_movements')

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
    created_at: toIso(o.created_at),
    sumup_sale_id: o.sumup_sale_id ?? null,
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

// Rettifica: imposta lo stock a un valore assoluto e registra il delta.
export async function adjustStock(itemId, newStock) {
  const ref = doc(db, 'inventory_items', itemId)
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    if (!s.exists()) throw new Error('Prodotto non trovato')
    const cur = s.data()
    const delta = newStock - (Number(cur.stock) || 0)
    tx.update(ref, { stock: newStock })
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

// --- ORDERS ---

// Crea un ordine con i relativi item. Il numero progressivo giornaliero
// ("salumeria") viene assegnato in modo atomico tramite una transazione su un
// documento contatore per data (counters/{YYYY-MM-DD}).
export async function createOrder({ table_label, note, items }) {
  const total = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)
  const orderDate = romeDateKey()
  const counterRef = doc(db, 'counters', orderDate)
  const newOrderRef = doc(ordersCol)

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef)
    const last = counterSnap.exists() ? counterSnap.data().last || 0 : 0
    const dailyNumber = last + 1
    tx.set(counterRef, { last: dailyNumber }, { merge: true })

    tx.set(newOrderRef, {
      daily_number: dailyNumber,
      order_date: orderDate,
      table_label: table_label || null,
      note: note || null,
      status: ORDER_STATUSES.RICEVUTO,
      total,
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
export async function fetchActiveOrders() {
  const snap = await getDocs(
    query(ordersCol, where('status', '!=', ORDER_STATUSES.RITIRATO))
  )
  const orders = snap.docs.map(mapOrder)
  orders.sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
  return orders
}

export async function updateOrderStatus(id, status) {
  const ref = doc(db, 'orders', id)

  if (status === ORDER_STATUSES.IN_PREPARAZIONE) {
    // Allo "sta preparando" scala l'inventario (una sola volta per ordine).
    await applyDepletionAndAdvance(id, status)
  } else {
    await updateDoc(ref, { status })
  }

  const snap = await getDoc(ref)

  // Sync stato verso SumUp POS Pro in background (fire-and-forget).
  const sumupStatus = toSumUpStatus(status)
  if (sumupStatus) {
    const sumupSaleId = snap.data()?.sumup_sale_id ?? null
    updateSumUpSaleStatus(sumupSaleId, sumupStatus)
      .catch((e) => console.error('[SumUp] updateStatus failed:', e))
  }

  return mapOrder(snap)
}

// Avanza lo stato e, se non già fatto, scala l'inventario in base alle ricette
// dei drink dell'ordine. Tutto in una transazione (letture prima delle scritture).
// Dopo il commit notifica gli item scesi sotto soglia.
async function applyDepletionAndAdvance(id, status) {
  const orderRef = doc(db, 'orders', id)
  let lowStock = []

  await runTransaction(db, async (tx) => {
    lowStock = []
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('Ordine non trovato')
    const order = orderSnap.data()

    // Già scalato in precedenza: aggiorna solo lo stato.
    if (order.inventory_applied === true) {
      tx.update(orderRef, { status })
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

    tx.update(orderRef, { status, inventory_applied: true })
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
  const q = query(ordersCol, where('status', '!=', ORDER_STATUSES.RITIRATO))
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
