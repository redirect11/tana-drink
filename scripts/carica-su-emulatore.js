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
import { arg, flag } from './lib-firestore.js'
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
  const radice = `projects/${DESTINAZIONE}/databases/(default)/documents`
  // «owner» è la parola che l'emulatore riconosce come «sono l'admin»:
  // senza, le regole di sicurezza fermano anche le scritture di servizio.
  const intestazioni = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

  async function commit(writes) {
    for (let i = 0; i < writes.length; i += 200) {
      const res = await fetch(`http://${dove}/v1/${radice}:commit`, {
        method: 'POST',
        headers: intestazioni,
        body: JSON.stringify({ writes: writes.slice(i, i + 200) }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.error) throw new Error(`${json.error.status}: ${json.error.message}`)
    }
  }

  async function idEsistenti(collezione) {
    const out = []
    let pageToken = ''
    do {
      const res = await fetch(
        `http://${dove}/v1/${radice}/${collezione}?pageSize=300&mask.fieldPaths=__name__${
          pageToken ? `&pageToken=${pageToken}` : ''
        }`,
        { headers: intestazioni }
      )
      const json = await res.json().catch(() => ({}))
      if (json.error) throw new Error(`${json.error.status}: ${json.error.message}`)
      out.push(...(json.documents || []).map((d) => d.name.split('/').pop()))
      pageToken = json.nextPageToken || ''
    } while (pageToken)
    return out
  }

  console.log(`[carica] ${FILE} → ${DESTINAZIONE} su ${dove}`)

  for (const collezione of collezioni) {
    const docs = backup[collezione]
    if (!docs) {
      console.log(`[carica] ${collezione}: non c'è nel file, salto`)
      continue
    }
    if (flag('pulisci')) {
      const vecchi = await idEsistenti(collezione)
      if (vecchi.length) {
        await commit(vecchi.map((id) => ({ delete: `${radice}/${collezione}/${id}` })))
        console.log(`[carica] ${collezione}: tolti ${vecchi.length} documenti di prima`)
      }
    }
    await commit(
      docs.map((d) => ({
        update: { name: `${radice}/${collezione}/${d.id}`, fields: d.fields || {} },
      }))
    )
    console.log(`[carica] ${collezione}: caricati ${docs.length} documenti`)
  }

  console.log('[carica] ✓ fatto.')
}

main().catch((e) => {
  console.error(`[carica] ${e.message}`)
  process.exit(1)
})
