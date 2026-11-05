// =====================================================================
//  RIPRISTINA UN DATABASE da un file di backup-db.js, o del backup
//  dell'app (Impostazioni → Backup).
//
//    node scripts/ripristina-db.js --file backup/tana-drink-2026-08-11.json
//    node scripts/ripristina-db.js --file … --project tana-drink-test --apply
//    node scripts/ripristina-db.js --file … --solo orders,cash_sessions --apply
//
//  Di default RIMETTE LE COSE COM'ERANO: quello che nel frattempo è stato
//  aggiunto viene cancellato, perché nel backup non c'è. È il senso di un
//  ripristino — ma è anche il modo di perdere il lavoro fatto dopo, quindi
//  senza --apply non scrive niente e mostra cosa cambierebbe.
//
//  Con --unisci invece si limita a riscrivere i documenti del backup e
//  lascia stare gli altri: serve per recuperare qualcosa di specifico
//  (--solo orders) senza buttare via il resto.
//
//  Il progetto di destinazione, se non lo si dice, è quello scritto nel
//  file: ripristinare il backup della produzione DENTRO la produzione è il
//  caso normale, ma va detto ad alta voce.
// =====================================================================
import { readFileSync } from 'node:fs'
import { accessToken, client, idDi, arg, flag, documentiDelBackup } from './lib-firestore.js'
import { conLicenzaAttuale, CAMPO_LICENZA, COLLEZIONE_LICENZA } from '../src/lib/licenza.js'

const FILE = arg('file')
const APPLY = flag('apply')
const UNISCI = flag('unisci')
const SOLO = (arg('solo', '') || '').split(',').map((s) => s.trim()).filter(Boolean)

if (!FILE) {
  console.error('Uso: node scripts/ripristina-db.js --file <backup.json> [--project X] [--solo col1,col2] [--unisci] [--apply]')
  process.exit(1)
}

let backup
try {
  backup = JSON.parse(readFileSync(FILE, 'utf8'))
} catch (e) {
  console.error(`File illeggibile: ${e.message}`)
  process.exit(1)
}
if (!backup.collezioni) {
  console.error('Non sembra un backup di backup-db.js: manca "collezioni".')
  process.exit(1)
}

const PROGETTO = arg('project', backup.progetto)
if (!PROGETTO) {
  console.error('Progetto non indicato e non presente nel file: usa --project.')
  process.exit(1)
}

const db = client(PROGETTO, await accessToken())

console.log(`[ripristino] ${FILE}  →  ${PROGETTO}${APPLY ? '' : '   (ANTEPRIMA)'}`)
console.log(`  backup del ${backup.creato_il ?? '?'} · progetto d'origine: ${backup.progetto ?? '?'}`)
if (backup.progetto && backup.progetto !== PROGETTO) {
  console.log(`  ⚠️  Attenzione: lo stai ripristinando su un ALTRO progetto.`)
}
console.log(UNISCI ? '  modalità: unisci (non cancella niente)' : '  modalità: ripristino esatto (cancella ciò che non è nel backup)')
if (SOLO.length) console.log(`  solo: ${SOLO.join(', ')}`)

// LA LICENZA NON SI RIPRISTINA (BUG-126). Questo script scrive con le
// credenziali di servizio, e le regole non lo fermano: rimettere il
// `licenza/attuale` di un backup vecchio toglierebbe una sospensione o
// riporterebbe un piano scaduto, e la licenza è della regia, non del
// locale. Quindi la collezione non si tocca mai (né riscritta né
// cancellata), e `settings/bar` tiene il campo `licenza` che ha adesso.
const collezioni = Object.keys(backup.collezioni)
  .filter((c) => c !== COLLEZIONE_LICENZA)
  .filter((c) => !SOLO.length || SOLO.includes(c))
  .sort()
if (backup.collezioni[COLLEZIONE_LICENZA]) {
  console.log(`  ${COLLEZIONE_LICENZA}: nel file c'è, ma non si ripristina (la scrive la regia)`)
}

let scritti = 0
let cancellati = 0
const piano = []
for (const c of collezioni) {
  const docs = documentiDelBackup(backup.collezioni[c])
  const attuali = await db.documenti(c)
  const idsBackup = new Set(docs.map((d) => d.id))
  // Un documento delle impostazioni che porta la licenza non si cancella
  // nemmeno nel ripristino esatto: con lui se ne andrebbe la licenza.
  const orfani = UNISCI
    ? []
    : attuali.filter((d) => !idsBackup.has(idDi(d)) && !(c === 'settings' && d.fields?.[CAMPO_LICENZA]))
  const campiAttuali = new Map(attuali.map((d) => [idDi(d), d.fields]))
  const daScrivere =
    c === 'settings' ? docs.map((d) => ({ ...d, fields: conLicenzaAttuale(d.fields, campiAttuali.get(d.id)) })) : docs
  piano.push({ c, docs: daScrivere, orfani })
  scritti += docs.length
  cancellati += orfani.length
  console.log(
    `  ${c.padEnd(24)} ${String(docs.length).padStart(5)} da riscrivere` +
      `   [ora: ${attuali.length}]${orfani.length ? `  −${orfani.length} da cancellare` : ''}`
  )
}
console.log(`\n  totale: ${scritti} riscritti, ${cancellati} cancellati`)

if (!APPLY) {
  console.log('\n[ripristino] ANTEPRIMA: niente scritto. Aggiungi --apply per ripristinare.')
  process.exit(0)
}

for (const { c, docs, orfani } of piano) {
  if (orfani.length) await db.commit(orfani.map((d) => db.cancellaDoc(c, idDi(d))))
  if (docs.length) await db.commit(docs.map((d) => db.scriviDoc(c, d.id, d.fields)))
  console.log(`  ✓ ${c.padEnd(24)} ${docs.length} riscritti, ${orfani.length} cancellati`)
}
console.log(`\n[ripristino] Fatto su "${PROGETTO}".`)
