import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db } from './firebaseClient.js'

// ── BACKUP E RIPRISTINO DEL DATABASE, dal gestionale ──────────────────
//
// Un locale che lavora qui dentro ha la contabilità della serata, il
// magazzino e le ore del personale in un database che nessuno vede: se
// qualcuno cancella la cosa sbagliata, senza una copia non si torna
// indietro. Da qui si scarica TUTTO in un file, e da un file si rimette.
//
// L'export è integrale; l'import è ADDITIVO: riscrive i documenti del file
// e lascia stare quello che nel file non c'è. Un ripristino "esatto" —
// che cancella anche il resto — resta agli script (ripristina-db.js): le
// regole di sicurezza non permettono all'app di cancellare incassi e
// sessioni di cassa, ed è giusto così.
//
// Le UTENZE non sono qui dentro: vivono in Firebase Auth. I ruoli si
// rivedono dalla pagina Utenti.

// L'elenco è esplicito perché il client non può chiedere a Firestore quali
// collezioni esistono (lo può solo l'Admin SDK, cioè gli script). Se un
// giorno se ne aggiunge una, va aggiunta anche qui: un backup che si
// dimentica un pezzo è peggio di nessun backup.
export const COLLEZIONI = [
  'cash_sessions',
  'categories',
  'counters',
  'customers',
  'drinks',
  'groups',
  'inventory_categories',
  'inventory_items',
  'invoices',
  'macro_categories',
  'orders',
  'payments',
  'pos_prefs',
  'purchase_orders',
  'serate',
  'service_stats',
  'settings',
  'staff_calls',
  'staff_hours',
  'staff_rates',
  'staff_shifts',
  'staff_tokens',
  'stock_counts',
  'stock_movements',
  'supplier_invoices',
  'suppliers',
  'vouchers',
]

export const FORMATO = 1

// Scarica tutto. `onProgress(collezione, quanti)` per la barra di avanzamento.
export async function esportaDatabase(onProgress = () => {}) {
  const collezioni = {}
  let documenti = 0
  for (const nome of COLLEZIONI) {
    let docs = []
    try {
      const snap = await getDocs(collection(db, nome))
      docs = snap.docs.map((d) => ({ id: d.id, dati: d.data() }))
    } catch (e) {
      // Una collezione che non si può leggere non deve far fallire tutto il
      // backup: si annota e si va avanti.
      collezioni[nome] = { errore: e.message, righe: [] }
      onProgress(nome, 0)
      continue
    }
    collezioni[nome] = { righe: docs }
    documenti += docs.length
    onProgress(nome, docs.length)
  }
  return {
    formato: FORMATO,
    creato_il: new Date().toISOString(),
    progetto: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? null,
    documenti,
    collezioni,
  }
}

// Quante righe per collezione (per l'anteprima, prima di importare).
export function riassunto(backup) {
  if (!backup?.collezioni) return []
  return Object.entries(backup.collezioni)
    .map(([nome, c]) => ({ nome, righe: (c?.righe || []).length }))
    .filter((r) => r.righe > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export function totaleRighe(backup) {
  return riassunto(backup).reduce((s, r) => s + r.righe, 0)
}

// Un file va bene? Meglio dirlo prima di scrivere sul database.
export function validaBackup(backup) {
  if (!backup || typeof backup !== 'object') return 'Il file non contiene un backup.'
  if (!backup.collezioni || typeof backup.collezioni !== 'object') {
    return 'Manca l’elenco delle collezioni: non è un backup di questa app.'
  }
  if (backup.formato && backup.formato > FORMATO) {
    return `Il file è in formato ${backup.formato}, questa versione arriva a ${FORMATO}: aggiorna l’app.`
  }
  if (!totaleRighe(backup)) return 'Il backup è vuoto.'
  return null
}

// Rimette i documenti del file. Additivo: non cancella niente.
// `onProgress(collezione, fatti, totale)`.
export async function importaDatabase(backup, onProgress = () => {}) {
  const errore = validaBackup(backup)
  if (errore) throw new Error(errore)

  let scritti = 0
  const saltate = []
  for (const [nome, c] of Object.entries(backup.collezioni)) {
    const righe = c?.righe || []
    if (!righe.length) continue
    if (!COLLEZIONI.includes(nome)) {
      // Roba di una versione più nuova: non la si inventa.
      saltate.push(nome)
      continue
    }
    // A blocchi: writeBatch si ferma a 500 operazioni.
    for (let i = 0; i < righe.length; i += 400) {
      const lotto = writeBatch(db)
      for (const r of righe.slice(i, i + 400)) {
        lotto.set(doc(db, nome, r.id), r.dati ?? {})
      }
      await lotto.commit()
      scritti += Math.min(400, righe.length - i)
      onProgress(nome, Math.min(i + 400, righe.length), righe.length)
    }
  }
  return { scritti, saltate }
}

// Nome del file: progetto e data, così tre backup non si chiamano uguale.
export function nomeFile(backup) {
  const quando = (backup?.creato_il || new Date().toISOString()).slice(0, 16).replace(/[:T]/g, '-')
  return `${backup?.progetto || 'tana-drink'}-${quando}.json`
}

// Scarica l'oggetto come file JSON (nel browser).
export function scarica(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile(backup)
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Il tempo di far partire il salvataggio, poi si libera la memoria.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
