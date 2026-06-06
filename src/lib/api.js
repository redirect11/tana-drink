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
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebaseClient.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { createSumUpSale, updateSumUpSaleStatus, toSumUpStatus } from './sumupApi.js'

const drinksCol = collection(db, 'drinks')
const ordersCol = collection(db, 'orders')

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
    recipe: d.recipe ?? null,
    price: d.price ?? 0,
    available: d.available ?? true,
    created_at: toIso(d.created_at),
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
  await updateDoc(ref, { status })
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
