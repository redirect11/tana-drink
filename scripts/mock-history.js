// =====================================================================
//  Storico mock di serate passate per le statistiche (emulatore).
//
//    npm run mock:history            → 12 serate chiuse
//    npm run mock:history -- 20      → 20 serate
//
//  Richiede emulatore avviato e drink nel db (seed o import CSV).
// =====================================================================
import admin from 'firebase-admin'
import { generateMockHistory } from '../src/dev/mockData.js'

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ||
  `${process.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost'}:${process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080'}`

admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-tana-drink',
})
const db = admin.firestore()

const nights = Number(process.argv[2]) || 12

async function main() {
  console.log(`[storico] Emulatore: ${process.env.FIRESTORE_EMULATOR_HOST} · ${nights} serate`)

  const drinksSnap = await db.collection('drinks').get()
  const drinks = drinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (drinks.length === 0) {
    console.error('[storico] Nessun drink nel db: esegui prima il seed o l\'import CSV.')
    process.exit(1)
  }

  const history = generateMockHistory(drinks, { nights })

  for (const { serata, orders, lastNumber } of history) {
    const { id, ...serataData } = serata
    // closed_at come Timestamp: stesso tipo usato da closeSerata reale
    // (tipi misti romperebbero l'ordinamento per closed_at).
    serataData.closed_at = admin.firestore.Timestamp.fromDate(new Date(serata.closed_at))
    await db.collection('serate').doc(id).set(serataData)
    await db.collection('counters').doc(id).set({ last: lastNumber })
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
    console.log(
      `  + ${serata.opened_at.slice(0, 10)} · ${orders.length} ordini · €${serata.total.toFixed(2)}`
    )
  }

  const tot = history.reduce((s, h) => s + h.serata.total, 0)
  console.log(`\n[storico] ✓ ${nights} serate, ${history.reduce((s, h) => s + h.orders.length, 0)} ordini, €${tot.toFixed(2)} totali.`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[storico] Errore:', e)
  process.exit(1)
})
