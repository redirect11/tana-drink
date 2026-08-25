// =====================================================================
//  UN BACKUP CARICATO NELL'EMULATORE.
//
//    node scripts/carica-su-emulatore.js --file backup/….json
//    node scripts/carica-su-emulatore.js --file … --solo inventory_items
//    node scripts/carica-su-emulatore.js --file … --pulisci
//
//  Serve a provare col vero: un magazzino di 388 articoli veri ha
//  stranezze che nessun dato finto riproduce, e il travaso va provato su
//  quelle. Il file lo fa `backup-db.js` (che con --solo scarica soltanto
//  le collezioni chieste: dalla produzione si prendono magazzino e menù, e
//  nient'altro — di persone non se ne sposta nessuna).
//
//  SCRIVE SOLO SULL'EMULATORE: la destinazione è cablata, e se l'emulatore
//  non risponde lo script si ferma. Nessun progetto vero compare qui.
//
//  I documenti si scrivono nel formato NATIVO, com'erano: un timestamp
//  resta un timestamp e un intero non diventa un decimale.
// =====================================================================
import { readFileSync } from 'node:fs'
import { arg, clientEmulatore, flag, idDi } from './lib-firestore.js'
import { trovaEmulatore } from './lib-emulatore.js'

const FILE = arg('file')
const DESTINAZIONE = 'demo-tana-drink'
const SOLO = (arg('solo', '') || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

if (!FILE) {
  console.error('Uso: node scripts/carica-su-emulatore.js --file <backup.json> [--solo col1,col2] [--pulisci]')
  process.exit(1)
}

async function main() {
  const dove = await trovaEmulatore()
  if (!dove) {
    console.error('[carica] Nessun emulatore Firestore in ascolto: avvialo con "npm run emulators".')
    process.exit(1)
  }

  // Il file di backup-db.js ha le collezioni sotto `collezioni`, con
  // attorno progetto e data. Si accetta anche la forma piatta, che e' quella
  // che verrebbe da fare a mano.
  const file = JSON.parse(readFileSync(FILE, 'utf8'))
  const backup = file.collezioni || file
  if (file.progetto) console.log(`[carica] il file viene da ${file.progetto} (${file.creato_il || 's.d.'})`)
  const collezioni = SOLO.length ? SOLO : Object.keys(backup)
  const emulatore = clientEmulatore(dove, DESTINAZIONE)

  console.log(`[carica] ${FILE} → ${DESTINAZIONE} su ${dove}`)

  for (const collezione of collezioni) {
    const docs = backup[collezione]
    if (!docs) {
      console.log(`[carica] ${collezione}: non c'è nel file, salto`)
      continue
    }
    if (flag('pulisci')) {
      // Dei vecchi servono solo gli id: chiederne i campi vorrebbe dire
      // scaricare il magazzino intero per buttarlo via.
      const vecchi = await emulatore.documenti(collezione, { campi: ['__name__'] })
      if (vecchi.length) {
        await emulatore.commit(vecchi.map((d) => emulatore.cancellaDoc(collezione, idDi(d))))
        console.log(`[carica] ${collezione}: tolti ${vecchi.length} documenti di prima`)
      }
    }
    await emulatore.commit(docs.map((d) => emulatore.scriviDoc(collezione, d.id, d.fields)))
    console.log(`[carica] ${collezione}: caricati ${docs.length} documenti`)
  }

  console.log('[carica] ✓ fatto.')
}

main().catch((e) => {
  console.error(`[carica] ${e.message}`)
  process.exit(1)
})
