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
import { generateMockOrders } from './mockData.js'

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

// Reset completo: svuota tutto e ripopola con seed + serata mock.
export async function resetWithMockData(onProgress = () => {}) {
  onProgress('Svuoto il database…')
  await clearDatabase()
  await seedDatabase(onProgress)
  const n = await createMockSerata(onProgress)
  onProgress(`Fatto: serata aperta con ${n} ordini mock.`)
}
