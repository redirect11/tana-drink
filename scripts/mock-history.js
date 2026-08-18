// =====================================================================
//  Storico mock di giornate passate per le statistiche (emulatore).
//
//    npm run mock:history            → 12 giornate
//    npm run mock:history -- 20      → 20 giornate
//
//  Richiede emulatore avviato e drink nel db (seed o import CSV).
// =====================================================================
import admin from 'firebase-admin'
import { generateMockHistory } from '../src/dev/mockData.js'
import { puntaAllEmulatore } from './lib-emulatore.js'

await puntaAllEmulatore('storico')

admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-tana-drink',
})
const db = admin.firestore()

const nights = Number(process.argv[2]) || 12

async function main() {
  console.log(`[storico] Emulatore: ${process.env.FIRESTORE_EMULATOR_HOST} · ${nights} giornate`)

  const drinksSnap = await db.collection('drinks').get()
  const drinks = drinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (drinks.length === 0) {
    console.error('[storico] Nessun drink nel db: esegui prima il seed o l\'import CSV.')
    process.exit(1)
  }

  const history = generateMockHistory(drinks, { nights })

  for (const { day, incasso, orders, lastNumber } of history) {
    await db.collection('counters').doc(day).set({ last: lastNumber })
    let batch = db.batch()
    let n = 0
    for (const o of orders) {
      batch.set(db.collection('orders').doc(), {
        ...o,
        created_at: admin.firestore.Timestamp.fromDate(o.created_at),
      })
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch() }
    }
    await batch.commit()
    console.log(`  + ${day} · ${orders.length} ordini · €${incasso.toFixed(2)}`)
  }

  const tot = history.reduce((s, h) => s + h.incasso, 0)
  console.log(`\n[storico] ✓ ${nights} giornate, ${history.reduce((s, h) => s + h.orders.length, 0)} ordini, €${tot.toFixed(2)} totali.`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[storico] Errore:', e)
  process.exit(1)
})
