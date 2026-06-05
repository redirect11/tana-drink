// =====================================================================
//  Seed dei drink iniziali su Cloud Firestore.
// =====================================================================
//  Uso:
//    1. Configura le variabili VITE_FIREBASE_* in un file `.env`.
//    2. Esegui: `npm run seed`
//  Aggiunge alcuni drink di esempio nella collezione `drinks` solo se la
//  collezione è vuota (idempotente: non duplica i drink).
// =====================================================================
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'

// Carica le variabili da `.env` (semplice parser, nessuna dipendenza extra).
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {
    /* nessun .env: si useranno le variabili d'ambiente già presenti */
  }
}

loadEnv()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    '[seed] Configurazione Firebase mancante. Imposta le variabili VITE_FIREBASE_* in .env.'
  )
  process.exit(1)
}

const SEED_DRINKS = [
  {
    name: 'Mojito',
    description: 'Fresco e dissetante',
    category: 'Cocktail',
    recipe: '5cl rum bianco, lime, menta, zucchero, soda',
    price: 7.0,
    available: true,
  },
  {
    name: 'Negroni',
    description: 'Amaro e deciso',
    category: 'Cocktail',
    recipe: '3cl gin, 3cl bitter, 3cl vermouth rosso',
    price: 8.0,
    available: true,
  },
  {
    name: 'Spritz',
    description: "L'aperitivo classico",
    category: 'Aperitivi',
    recipe: '6cl prosecco, 4cl aperol, soda',
    price: 6.0,
    available: true,
  },
  {
    name: 'Analcolico della casa',
    description: 'Senza alcol, con frutta di stagione',
    category: 'Analcolici',
    recipe: 'Succhi misti, frutta fresca, soda',
    price: 5.0,
    available: true,
  },
  {
    name: 'Birra artigianale',
    description: 'Spina del momento',
    category: 'Birre',
    recipe: 'Birra alla spina 0,4L',
    price: 5.5,
    available: true,
  },
]

async function main() {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const drinksCol = collection(db, 'drinks')

  const existing = await getDocs(drinksCol)
  if (!existing.empty) {
    console.log(
      `[seed] La collezione "drinks" contiene già ${existing.size} elementi: nessun seed eseguito.`
    )
    process.exit(0)
  }

  for (const drink of SEED_DRINKS) {
    await addDoc(drinksCol, { ...drink, created_at: serverTimestamp() })
    console.log(`[seed] Aggiunto: ${drink.name}`)
  }
  console.log('[seed] Completato.')
  process.exit(0)
}

main().catch((e) => {
  console.error('[seed] Errore:', e)
  process.exit(1)
})
