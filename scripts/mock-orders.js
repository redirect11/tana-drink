// =====================================================================
//  Ordini mock per l'ambiente di sviluppo (emulatore Firestore).
//
//    npm run mock:orders
//
//  Crea ~12 ordini di oggi con stati misti, modalità di consegna varie,
//  coperto/servizio/mancia, timestamp di stato coerenti e statistiche
//  tempi (prep_stats/eta_stats) sul documento del servizio.
//  Richiede: emulatore avviato e db seedato (npm run seed:dev).
// =====================================================================
import admin from 'firebase-admin'
import { generateMockOrders } from '../src/dev/mockData.js'
import { businessDayKey } from '../src/lib/businessDay.js'

import { puntaAllEmulatore } from './lib-emulatore.js'

await puntaAllEmulatore('ordini')

admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-tana-drink',
})
const db = admin.firestore()

async function main() {
  console.log(`[mock] Emulatore Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`)

  const drinksSnap = await db.collection('drinks').get()
  const drinks = drinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (drinks.length === 0) {
    console.error('[mock] Nessun drink nel db: esegui prima "npm run seed:dev".')
    process.exit(1)
  }

  // Numero progressivo: continua dal contatore della giornata commerciale.
  const oggi = businessDayKey(new Date())
  const counterRef = db.collection('counters').doc(oggi)
  const counterSnap = await counterRef.get()
  const startNumber = counterSnap.exists ? counterSnap.data().last || 0 : 0

  const { orders, prepStats, etaStats, lastNumber } = generateMockOrders(drinks, startNumber)

  for (const o of orders) {
    await db.collection('orders').add({
      ...o,
      created_at: admin.firestore.Timestamp.fromDate(o.created_at),
    })
    console.log(
      `  + #${o.daily_number} [${o.status}] ${o.service_mode} · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')} · €${o.total.toFixed(2)}`
    )
  }

  await counterRef.set({ last: lastNumber }, { merge: true })
  await db
    .collection('service_stats')
    .doc('global')
    .set({ prep_stats: prepStats, eta_stats: etaStats }, { merge: true })

  console.log(`\n[mock] ✓ ${orders.length} ordini creati nella giornata ${oggi}.`)
  console.log(`[mock]   prep_stats: ${prepStats.count} campioni · eta_stats (tavolo): ${etaStats.count} campioni`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[mock] Errore:', e)
  process.exit(1)
})
