// =====================================================================
//  Azioni sviluppatore: SOLO ambiente emulatore (Docker locale / test).
//  Permettono di svuotare il database o resettarlo con i dati mock,
//  direttamente dal pannello "Dev" del gestionale.
// =====================================================================
import { collection, doc, addDoc, setDoc, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebaseClient.js'
import {
  INV_CATS,
  INV_ITEMS,
  DRINK_CATS,
  DRINKS,
  DRINK_IMAGES,
  SEED_SETTINGS,
} from './seedData.js'
import { generateMockOrders, generateMockHistory } from './mockData.js'

export const isDevEnvironment =
  String(import.meta.env.VITE_USE_FIREBASE_EMULATOR) === 'true'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
// Come in firebaseClient: dalla rete locale "localhost" non punterebbe
// agli emulatori ma al dispositivo stesso.
const envEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'
const emulatorHost =
  envEmulatorHost === 'localhost' ? window.location.hostname : envEmulatorHost
const emulatorPort = import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || '8080'

// Svuota TUTTO il database dell'emulatore (endpoint dedicato, non esiste
// in produzione: ulteriore garanzia che funzioni solo in test).
export async function clearDatabase() {
  const url = `http://${emulatorHost}:${emulatorPort}/emulator/v1/projects/${projectId}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Svuotamento fallito (HTTP ${res.status})`)
}

// Ripopola il database con i dati di seed (menù, inventario, impostazioni).
export async function seedDatabase(onProgress = () => {}) {
  const now = new Date().toISOString()

  onProgress('Categorie inventario…')
  const invCatIds = {}
  for (const c of INV_CATS) {
    const ref = await addDoc(collection(db, 'inventory_categories'), {
      name: c.name,
      sort_order: c.sort_order,
      created_at: now,
    })
    invCatIds[c.key] = ref.id
  }

  onProgress(`Ingredienti (${INV_ITEMS.length})…`)
  const invItemIds = {}
  for (const item of INV_ITEMS) {
    const ref = await addDoc(collection(db, 'inventory_items'), {
      name: item.name,
      unit: item.unit,
      package_size: item.package_size,
      stock: item.stock,
      low_threshold: item.low_threshold,
      category_id: invCatIds[item.cat],
      created_at: now,
    })
    invItemIds[item.name] = ref.id
  }

  onProgress('Categorie drink…')
  const drinkCatIds = {}
  for (const c of DRINK_CATS) {
    const ref = await addDoc(collection(db, 'categories'), {
      name: c.name,
      sort_order: c.sort_order,
      created_at: now,
    })
    drinkCatIds[c.key] = ref.id
  }

  onProgress(`Drink (${DRINKS.length})…`)
  for (const d of DRINKS) {
    const recipe_items = (d.recipe_items || [])
      .filter((r) => invItemIds[r.item])
      .map((r) => ({
        inventory_item_id: invItemIds[r.item],
        name: r.item,
        unit: INV_ITEMS.find((i) => i.name === r.item)?.unit ?? 'ml',
        qty: r.qty,
      }))
    await addDoc(collection(db, 'drinks'), {
      name: d.name,
      description: d.description ?? null,
      category: DRINK_CATS.find((c) => c.key === d.cat)?.name ?? null,
      category_id: drinkCatIds[d.cat] ?? null,
      recipe: d.recipe ?? null,
      recipe_items,
      price: d.price,
      available: true,
      image_url: DRINK_IMAGES[d.name] ?? null,
      created_at: now,
    })
  }

  onProgress('Impostazioni…')
  await setDoc(doc(db, 'settings', 'bar'), { ...SEED_SETTINGS, updated_at: now }, { merge: true })
}

// Apre una serata e la popola con gli ordini mock (stati misti, tempi,
// statistiche). Riusa lo stesso generatore dello script npm run mock:orders.
export async function createMockSerata(onProgress = () => {}) {
  onProgress('Apro la serata…')
  const serataRef = await addDoc(collection(db, 'serate'), {
    status: 'open',
    opened_at: new Date().toISOString(),
    closed_at: null,
  })

  const drinksSnap = await getDocs(collection(db, 'drinks'))
  const drinks = drinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (drinks.length === 0) throw new Error('Nessun drink nel database: esegui prima il seed.')

  onProgress('Ordini mock…')
  const { orders, prepStats, etaStats, lastNumber } = generateMockOrders(drinks, serataRef.id, 0)
  for (const o of orders) {
    await addDoc(collection(db, 'orders'), o)
  }

  await setDoc(doc(db, 'counters', serataRef.id), { last: lastNumber }, { merge: true })
  await setDoc(serataRef, { prep_stats: prepStats, eta_stats: etaStats }, { merge: true })
  return orders.length
}

// Genera lo storico di serate passate chiuse (per le statistiche).
export async function createMockHistory(onProgress = () => {}, nights = 12) {
  const drinksSnap = await getDocs(collection(db, 'drinks'))
  const drinks = drinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (drinks.length === 0) throw new Error('Nessun drink nel database: esegui prima il seed o l\'import.')

  const history = generateMockHistory(drinks, { nights })
  let done = 0
  for (const { serata, orders, lastNumber } of history) {
    const { id, ...serataData } = serata
    // closed_at come Date → Timestamp (stesso tipo di closeSerata reale).
    serataData.closed_at = new Date(serata.closed_at)
    await setDoc(doc(db, 'serate', id), serataData)
    await setDoc(doc(db, 'counters', id), { last: lastNumber })
    for (const o of orders) {
      await addDoc(collection(db, 'orders'), o)
    }
    done++
    onProgress(`Serata ${done}/${history.length} (${serata.opened_at.slice(0, 10)}, ${orders.length} ordini)…`)
  }
  return history.length
}

// Reset completo: svuota tutto e ripopola con seed + serata mock.
export async function resetWithMockData(onProgress = () => {}) {
  onProgress('Svuoto il database…')
  await clearDatabase()
  await seedDatabase(onProgress)
  const n = await createMockSerata(onProgress)
  onProgress(`Fatto: serata aperta con ${n} ordini mock.`)
}

// Simula l'esito di un pagamento (online o lettore) su un ordine: in dev
// non ci sono Cloud Functions, quindi il webhook lo "recitiamo" noi
// scrivendo da bartender. Replica anche l'auto-chiusura ritirato→pagato.
export async function simulatePaymentResult(orderId, ok) {
  const { getDoc, updateDoc } = await import('firebase/firestore')
  const ref = doc(db, 'orders', orderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Ordine non trovato')
  const o = snap.data()
  const nowIso = new Date().toISOString()
  if (!ok) {
    await updateDoc(ref, { payment_status: 'fallito' })
    return
  }
  const patch = {
    payment_status: 'pagato',
    paid_at: nowIso,
    sumup_transaction_id: 'dev-sim',
  }
  if (o.status === 'annullato') {
    patch.payment_after_cancel = true
  } else if (o.status === 'ritirato') {
    patch.status = 'pagato'
    patch['status_times.pagato'] = nowIso
  }
  await updateDoc(ref, patch)
}

// Simula l'intero incasso sul lettore (senza pairing né Cloud API):
// marca l'ordine come "in corso sul lettore" e poi applica l'esito.
export async function simulateReaderPayment(orderId, ok) {
  const { updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, 'orders', orderId), {
    payment_method: 'lettore',
    payment_status: 'in_attesa',
    sumup_client_transaction_id: 'dev-sim-reader',
  })
  await simulatePaymentResult(orderId, ok)
}
