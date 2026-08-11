// =====================================================================
//  SPECCHIA UN DATABASE INTERO su un altro. COPIA PERFETTA.
//
//    node scripts/specchia-db.js --da tana-drink-test --a tana-drink
//    node scripts/specchia-db.js --da tana-drink-test --a tana-drink --apply
//
//  A cose fatte la destinazione è IDENTICA all'origine: stessi documenti,
//  stessi identificativi, stessi tipi. Quello che nella destinazione c'era
//  in più — ordini, sessioni di cassa, qualunque cosa — VIENE CANCELLATO.
//
//  Non è la migrazione del catalogo (scripts/migra-in-produzione.js), che
//  invece rispetta lo storico di chi la riceve. Questo è un travaso totale:
//  serve quando si vuole portare di peso una situazione da un ambiente
//  all'altro, e va usato sapendo che dall'altra parte non resta niente.
//
//  Prima di scrivere fa SEMPRE un backup della destinazione in backup/ —
//  è l'unico modo per tornare indietro (poi: ripristina-db.js).
//
//  Le utenze non si toccano: stanno in Firebase Auth, non qui.
// =====================================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { accessToken, client, idDi, arg, flag } from './lib-firestore.js'

const DA = arg('da', 'tana-drink-test')
const A = arg('a', null)
const APPLY = flag('apply')
const TRANNE = (arg('tranne', '') || '').split(',').map((s) => s.trim()).filter(Boolean)

if (!A) {
  console.error('Uso: node scripts/specchia-db.js --da <progetto> --a <progetto> [--apply] [--tranne col1,col2]')
  process.exit(1)
}
if (DA === A) {
  console.error('Origine e destinazione coincidono.')
  process.exit(1)
}

const token = await accessToken()
const origine = client(DA, token)
const destinazione = client(A, token)

console.log(`[specchio] ${DA}  →  ${A}${APPLY ? '' : '   (ANTEPRIMA)'}`)
if (TRANNE.length) console.log(`  escluse: ${TRANNE.join(', ')}`)

const colOrigine = (await origine.collezioni()).filter((c) => !TRANNE.includes(c))
const colDest = (await destinazione.collezioni()).filter((c) => !TRANNE.includes(c))
const tutte = [...new Set([...colOrigine, ...colDest])].sort()

const piano = []
let daScrivere = 0
let daCancellare = 0

for (const c of tutte) {
  const [srcDocs, dstDocs] = await Promise.all([
    colOrigine.includes(c) ? origine.documenti(c) : Promise.resolve([]),
    colDest.includes(c) ? destinazione.documenti(c) : Promise.resolve([]),
  ])
  const srcIds = new Set(srcDocs.map(idDi))
  const orfani = dstDocs.filter((d) => !srcIds.has(idDi(d)))
  piano.push({ c, srcDocs, orfani, prima: dstDocs.length })
  daScrivere += srcDocs.length
  daCancellare += orfani.length
  const segno = orfani.length ? `  −${orfani.length} da cancellare` : ''
  console.log(
    `  ${c.padEnd(24)} ${String(srcDocs.length).padStart(5)} da copiare` +
      `   [ora in ${A}: ${dstDocs.length}]${segno}`
  )
}

console.log(`\n  totale: ${daScrivere} documenti copiati, ${daCancellare} cancellati`)

if (!APPLY) {
  console.log('\n[specchio] ANTEPRIMA: niente scritto. Aggiungi --apply per travasare.')
  process.exit(0)
}

// BACKUP DELLA DESTINAZIONE, sempre: quello che sta per essere sovrascritto
// deve restare da qualche parte prima di sparire.
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const fileBackup = `backup/${A}-prima-dello-specchio-${stamp}.json`
const backup = {}
for (const c of colDest) backup[c] = (await destinazione.documenti(c)).map((d) => ({ id: idDi(d), fields: d.fields || {} }))
mkdirSync(dirname(fileBackup), { recursive: true })
writeFileSync(
  fileBackup,
  JSON.stringify({ progetto: A, creato_il: new Date().toISOString(), collezioni: backup }, null, 2)
)
console.log(`\n[specchio] backup della destinazione → ${fileBackup}`)

for (const { c, srcDocs, orfani } of piano) {
  if (orfani.length) await destinazione.commit(orfani.map((d) => destinazione.cancellaDoc(c, idDi(d))))
  if (srcDocs.length) {
    await destinazione.commit(srcDocs.map((d) => destinazione.scriviDoc(c, idDi(d), d.fields)))
  }
  console.log(`  ✓ ${c.padEnd(24)} ${srcDocs.length} scritti, ${orfani.length} cancellati`)
}

console.log(`\n[specchio] Fatto: "${A}" è ora una copia di "${DA}". Utenze e ruoli invariati.`)
