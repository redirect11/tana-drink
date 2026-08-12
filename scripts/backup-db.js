// =====================================================================
//  BACKUP COMPLETO DEL DATABASE in un file JSON.
//
//    node scripts/backup-db.js                          # test
//    node scripts/backup-db.js --project tana-drink     # produzione
//    node scripts/backup-db.js --project tana-drink --out backup/prima.json
//
//  Salva TUTTE le collezioni (anche quelle che nessuno script conosce:
//  l'elenco lo chiede a Firestore) nel formato nativo, quindi il ripristino
//  restituisce gli stessi identici tipi. Di default il file finisce in
//  backup/<progetto>-<data>.json, e la cartella è ignorata da git: dentro
//  ci sono i dati veri del locale, non vanno su GitHub.
//
//  Le UTENZE non ci sono: vivono in Firebase Auth, non in Firestore, e le
//  password non sono leggibili nemmeno da qui. I ruoli si rivedono con
//  "node scripts/set-role.js --elenco".
//
//  Ripristino: node scripts/ripristina-db.js --file <file>
// =====================================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { accessToken, client, idDi, arg, flag } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink-test')
const PROFONDO = flag('profondo') // cerca sottocollezioni documento per documento

const oggi = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const OUT = arg('out', `backup/${PROGETTO}-${oggi}.json`)

const db = client(PROGETTO, await accessToken())

console.log(`[backup] ${PROGETTO} → ${OUT}`)
const collezioni = await db.collezioni()
console.log(`  collezioni: ${collezioni.length}`)

const dati = {}
let totale = 0
for (const c of collezioni) {
  const docs = await db.documenti(c)
  dati[c] = docs.map((d) => ({ id: idDi(d), fields: d.fields || {} }))
  totale += docs.length
  console.log(`   ${c.padEnd(24)} ${String(docs.length).padStart(5)}`)
}

// SOTTOCOLLEZIONI. Questa app non ne usa, ma un backup che si dimentica
// pezzi è peggio di nessun backup: di default si controlla un documento per
// collezione (costa poco) e si avvisa; con --profondo si guardano tutti.
const conSotto = []
for (const c of collezioni) {
  const docs = dati[c]
  if (!docs.length) continue
  const daGuardare = PROFONDO ? docs : [docs[0]]
  for (const d of daGuardare) {
    const sotto = await db.collezioni(`${db.radice}/${c}/${d.id}`)
    if (sotto.length) conSotto.push(`${c}/${d.id} → ${sotto.join(', ')}`)
  }
}
if (conSotto.length) {
  console.log('\n  ⚠️  SOTTOCOLLEZIONI trovate (NON sono nel backup):')
  for (const s of conSotto.slice(0, 20)) console.log(`     ${s}`)
  console.log('     Vanno gestite a mano prima di fidarsi di questo file.')
} else if (!PROFONDO) {
  console.log('\n  nessuna sottocollezione nel campione (--profondo per controllarli tutti)')
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      progetto: PROGETTO,
      creato_il: new Date().toISOString(),
      documenti: totale,
      collezioni: dati,
    },
    null,
    2
  )
)
console.log(`\n[backup] ✓ ${totale} documenti in ${collezioni.length} collezioni → ${OUT}`)
