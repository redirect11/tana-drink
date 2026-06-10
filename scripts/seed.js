// =====================================================================
//  Seed del database: menù drink + inventario ingredienti.
// =====================================================================
//  Uso:
//    npm run seed:dev            → emulatore locale (Docker)
//    npm run seed                → progetto Firebase reale (da .env)
//    npm run seed:dev -- --force → cancella e ripopola da zero
// =====================================================================
import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch { /* nessun .env */ }
}

loadEnv()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const useEmulator = process.env.VITE_USE_FIREBASE_EMULATOR === 'true'
const force = process.argv.includes('--force')

const projectId = firebaseConfig.projectId
if (!projectId || (!useEmulator && !firebaseConfig.apiKey)) {
  console.error('[seed] Configurazione Firebase mancante.')
  process.exit(1)
}

import { INV_CATS, INV_ITEMS, DRINK_CATS, DRINKS, DRINK_IMAGES, SEED_SETTINGS } from '../src/dev/seedData.js'


async function clearCollection(db, name) {
  const snap = await db.collection(name).get()
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  console.log(`[seed] Svuotata "${name}" (${snap.size} documenti)`)
}

async function main() {
  if (useEmulator) {
    const host = process.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'
    const port = Number(process.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`
    console.log(`[seed] Emulatore Firestore: ${host}:${port}`)
  }

  // Admin SDK bypassa le security rules — perfetto per seed e migrazioni.
  admin.initializeApp({ projectId })
  const db = admin.firestore()
  const now = admin.firestore.FieldValue.serverTimestamp()

  // Controlla se già popolato
  const existing = await db.collection('drinks').get()
  if (!existing.empty && !force) {
    console.log(`[seed] "drinks" contiene già ${existing.size} voci. Usa --force per resettare.`)
    process.exit(0)
  }

  if (force) {
    await clearCollection(db, 'drinks')
    await clearCollection(db, 'categories')
    await clearCollection(db, 'inventory_categories')
    await clearCollection(db, 'inventory_items')
  }

  // 1. Categorie inventario
  console.log('\n[seed] Categorie inventario…')
  const invCatIds = {}
  for (const c of INV_CATS) {
    const ref = await db.collection('inventory_categories').add({ name: c.name, sort_order: c.sort_order, created_at: now })
    invCatIds[c.key] = ref.id
    console.log(`  + ${c.name}`)
  }

  // 2. Ingredienti inventario
  console.log('\n[seed] Ingredienti…')
  const invItemIds = {}
  for (const item of INV_ITEMS) {
    const ref = await db.collection('inventory_items').add({
      name: item.name,
      unit: item.unit,
      package_size: item.package_size ?? null,
      stock: item.stock,
      bottles_total: item.package_size ? Math.ceil(item.stock / item.package_size) : 0,
      low_threshold: item.low_threshold,
      category_id: invCatIds[item.cat],
      created_at: now,
    })
    invItemIds[item.name] = ref.id
    console.log(`  + ${item.name}`)
  }

  // 3. Categorie drink
  console.log('\n[seed] Categorie drink…')
  const drinkCatIds = {}
  for (const c of DRINK_CATS) {
    const ref = await db.collection('categories').add({ name: c.name, sort_order: c.sort_order, created_at: now })
    drinkCatIds[c.key] = ref.id
    console.log(`  + ${c.name}`)
  }

  // 4. Drink con ricette collegate
  console.log('\n[seed] Drink…')
  for (const d of DRINKS) {
    const recipe_items = (d.recipe_items || [])
      .filter(r => invItemIds[r.item])
      .map(r => ({
        inventory_item_id: invItemIds[r.item],
        name: r.item,
        unit: INV_ITEMS.find(i => i.name === r.item)?.unit ?? 'ml',
        qty: r.qty,
      }))

    await db.collection('drinks').add({
      name: d.name,
      description: d.description ?? null,
      category: DRINK_CATS.find(c => c.key === d.cat)?.name ?? null,
      category_id: drinkCatIds[d.cat] ?? null,
      recipe: d.recipe ?? null,
      recipe_items,
      price: d.price,
      available: true,
      image_url: DRINK_IMAGES[d.name] ?? null,
      created_at: now,
    })
    console.log(`  + ${d.name}`)
  }

  // 5. Impostazioni del bar (default: ordinazione attiva, extra disattivati)
  console.log('\n[seed] Impostazioni…')
  await db.collection('settings').doc('bar').set({
    ...SEED_SETTINGS,
    updated_at: now,
  }, { merge: true })
  console.log('  + settings/bar')

  console.log(`\n[seed] ✓ Completato: ${INV_CATS.length} cat. inventario, ${INV_ITEMS.length} ingredienti, ${DRINK_CATS.length} cat. drink, ${DRINKS.length} drink.`)
  process.exit(0)
}

main().catch(e => {
  console.error('[seed] Errore:', e)
  process.exit(1)
})
