// Il database passa dalla porta dei dati (REQ-FLOTTA-021).
import { db, collection, getDocs, doc, writeBatch } from '../porte/dati.js'
import { configurazione } from '../porte/configurazione.js'
import { scritturaConsentita, conLicenzaAttuale, COLLEZIONE_LICENZA } from './licenza.js'
import { licenzaRicordata } from './impostazioniLocali.js'

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

// Gli elenchi sono espliciti perché il client non può chiedere a Firestore
// quali collezioni esistono (lo può solo l'Admin SDK, cioè gli script). Un
// backup che si dimentica un pezzo è peggio di nessun backup, e succedeva
// (BUG-129): undici collezioni nate dopo l'elenco — il menù dei clienti, i
// listini e lo storico dei prezzi dei fornitori, i modelli d'ordine, le
// spese extra, i minimi, lo storico delle vendite — non finivano nel file,
// senza che nessuno lo sapesse; e c'era `serate`, che non è una collezione
// ma il nome di una schermata delle statistiche. Ora ogni collezione delle
// regole (firestore.rules) sta in uno dei tre elenchi qui sotto, e un test
// (tests/unit/backup.test.js) boccia quella che non ci sta.

// Si salvano e si rimettono.
export const COLLEZIONI = [
  'altre_spese',
  'carta_sezioni',
  'carta_voci',
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
  'minimi_extra',
  'orders',
  'payments',
  'pos_prefs',
  'purchase_order_templates',
  'purchase_orders',
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
  'supplier_price_history',
  'supplier_prices',
  'suppliers',
  'vouchers',
]

// SOLO NELLA COPIA: lo storico caricato dagli script (le vendite di Tiller,
// i fogli mensili). Si salva, perché senza una copia non si rifà; ma dalle
// regole nessuno lo scrive dall'app (`write: if false`), e un documento
// rifiutato fa fallire il suo blocco e ferma il ripristino a metà. Si
// rimette con lo script, che legge anche il file dell'app:
// `node scripts/ripristina-db.js --file <backup> --solo vendite_storiche,… --unisci`.
export const SOLO_COPIA = ['mesi_storici', 'vendite_storiche', 'vendite_storiche_prodotti']

// FUORI DAL BACKUP, apposta. Il ripristino salta quello che non è negli
// elenchi qui sopra, quindi queste non si rimettono nemmeno se un file le
// porta: nessuno le aggiunga «per completezza».
export const FUORI_DAL_BACKUP = Object.freeze([
  // La scrive solo la regia, e rimetterla vorrebbe dire tornare a un piano
  // vecchio (BUG-126).
  COLLEZIONE_LICENZA,
  // Chi è collegato adesso: ognuno scrive solo la sua riga, ogni tre
  // minuti. Una copia di ieri non dice niente, e il titolare non potrebbe
  // rimettere quella degli altri.
  'presenze',
  // Il registro tecnico della stampante, per capire un guasto: non sono
  // dati del locale.
  'diagnostica_stampante',
  // Le alternative che il cliente vede disponibili (REQ-MENU-042): le
  // ricalcolano le Functions dal magazzino, e il client non le può scrivere.
  'alternative_cliente',
])

export const FORMATO = 1

// Scarica tutto. `onProgress(collezione, quanti)` per la barra di avanzamento.
// A gruppi di sei collezioni insieme: una dopo l'altra, trentasei letture
// si sommavano tempo per tempo davanti alla barra. Il file le tiene
// nell'ordine degli elenchi.
const INSIEME = 6
export async function esportaDatabase(onProgress = () => {}) {
  const nomi = [...COLLEZIONI, ...SOLO_COPIA]
  const lette = {}
  for (let i = 0; i < nomi.length; i += INSIEME) {
    await Promise.all(
      nomi.slice(i, i + INSIEME).map(async (nome) => {
        lette[nome] = await leggiCollezione(nome)
        onProgress(nome, lette[nome].righe.length)
      })
    )
  }
  const collezioni = Object.fromEntries(nomi.map((n) => [n, lette[n]]))
  const documenti = nomi.reduce((s, n) => s + lette[n].righe.length, 0)
  return {
    formato: FORMATO,
    creato_il: new Date().toISOString(),
    progetto: configurazione().firebase.projectId || null,
    documenti,
    collezioni,
  }
}

async function leggiCollezione(nome) {
  try {
    const snap = await getDocs(collection(db, nome))
    return { righe: snap.docs.map((d) => ({ id: d.id, dati: d.data() })) }
  } catch (e) {
    // Una collezione che non si può leggere non deve far fallire tutto il
    // backup: si annota e si va avanti.
    return { errore: e.message, righe: [] }
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
  const soloScript = []
  // LE COLLEZIONI DI UN MODULO CHE LA LICENZA NON INCLUDE non si rimettono
  // (REQ-LIC-008): le regole le rifiuterebbero, e un documento rifiutato fa
  // fallire il suo blocco di 400 e ferma tutto il ripristino a metà. Restano
  // nel file: con il modulo, un ripristino successivo le riporta. La licenza
  // è l'ultima nota su questo dispositivo, come per il resto dell'app.
  const stato = { licenza: licenzaRicordata() }
  const fuoriLicenza = []
  for (const [nome, c] of Object.entries(backup.collezioni)) {
    const righe = c?.righe || []
    if (!righe.length) continue
    if (SOLO_COPIA.includes(nome)) {
      soloScript.push(nome)
      continue
    }
    // Fuori dagli elenchi (FUORI_DAL_BACKUP, o roba di una versione più
    // nuova): non si rimette.
    if (!COLLEZIONI.includes(nome)) {
      // Roba di una versione più nuova: non la si inventa.
      saltate.push(nome)
      continue
    }
    if (!scritturaConsentita(stato, nome)) {
      fuoriLicenza.push(nome)
      continue
    }
    // LA LICENZA NON SI RIPRISTINA (BUG-126): quella del file è di quando è
    // stato fatto, e rimetterla vorrebbe dire tornare a un piano vecchio.
    // Le impostazioni prendono la licenza che c'è adesso nel database, letta
    // qui al momento (e non quella che le schermate hanno in mano, che è di
    // `licenza/attuale`): un valore diverso, anche di un soffio, le regole lo
    // leggono come un cambio e rifiutano il lotto.
    const attuali = nome === 'settings' ? await documentiAttuali(nome) : null
    const dati = (r) => (attuali ? conLicenzaAttuale(r.dati, attuali.get(r.id)) : r.dati ?? {})
    // A blocchi: writeBatch si ferma a 500 operazioni.
    for (let i = 0; i < righe.length; i += 400) {
      const lotto = writeBatch(db)
      for (const r of righe.slice(i, i + 400)) {
        lotto.set(doc(db, nome, r.id), dati(r))
      }
      await lotto.commit()
      scritti += Math.min(400, righe.length - i)
      onProgress(nome, Math.min(i + 400, righe.length), righe.length)
    }
  }
  return { scritti, saltate, fuoriLicenza, soloScript }
}

// I documenti che ci sono adesso, per id. Il ripristino è fuori dal giro
// di una serata: si aspetta la lettura, come si aspettano i lotti.
async function documentiAttuali(nome) {
  const snap = await getDocs(collection(db, nome))
  return new Map(snap.docs.map((d) => [d.id, d.data()]))
}

// Nome del file: progetto e data, così tre backup non si chiamano uguale.
export function nomeFile(backup) {
  const quando = (backup?.creato_il || new Date().toISOString()).slice(0, 16).replace(/[:T]/g, '-')
  return `${backup?.progetto || 'backup'}-${quando}.json`
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
