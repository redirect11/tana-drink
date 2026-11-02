// =====================================================================
//  COSA HA COMPRATO IL LOCALE: i moduli inclusi nella licenza.
//
//    node scripts/licenza-moduli.js                                   # com'è messo (test)
//    node scripts/licenza-moduli.js --includi conta,scadenzario --apply
//    node scripts/licenza-moduli.js --project tana-drink --includi conta,scadenzario --apply
//
//  Scrive `moduli` nel documento `licenza/attuale` (BUG-125), che è la
//  licenza dell'installazione: quando c'è, comanda LUI (lib/licenza.js,
//  `licenzaEffettiva`). Fino alla 1.10.x lo script scriveva
//  `settings/bar.licenza.moduli`, che ogni bartender può riscrivere dalla
//  console; quel campo l'app non lo legge più. Dall'app il documento non
//  lo scrive nessuno: lo scrivono la regia, con le sue credenziali, e
//  questo script, con la sessione del Firebase CLI. L'interruttore d'uso
//  (`modulo_<id>_enabled` su settings/bar) resta del locale e qui non si
//  tocca.
//
//  ATTENZIONE A DUE COSE.
//  - Un locale della REGIA ha il documento scritto dalla regia, che lo
//    riscrive al prossimo cambio: lì la licenza si cambia dalla regia.
//  - Un'installazione SENZA documento non è attivata, e le regole non le
//    fanno scrivere niente (REQ-LIC-009): è il caso della Tana prima che
//    le si scriva il suo, una volta, con questo script — sul test da sé,
//    sulla produzione col via libera dell'utente.
//
//  SI SCRIVE SEMPRE PER INTERO. `moduli` è la verità completa su cosa il
//  locale ha: un modulo che non nomina non è incluso. Per questo
//  `--includi` elenca TUTTI i moduli da includere, e quelli non nominati
//  si scrivono a false, a vista.
//
//  Nato il 17/09/2026: Flavio voleva fare l'inventario quel pomeriggio e la
//  sezione in produzione non c'era. Daniele: «va riattivata anche in
//  produzione».
//
//  Default: progetto tana-drink-test. La produzione si nomina a mano, e
//  prima si fa il backup (`node scripts/backup-db.js --project tana-drink`).
// =====================================================================
import { accessToken, client, arg, flag } from './lib-firestore.js'
import { MODULI_PREMIUM } from '../src/lib/licenza.js'

const PROJECT = arg('project', 'tana-drink-test')
const APPLY = flag('apply')
const INCLUDI = (arg('includi', '') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const noti = Object.keys(MODULI_PREMIUM)
const sconosciuti = INCLUDI.filter((id) => !noti.includes(id))
if (sconosciuti.length) {
  console.error(`[licenza] moduli sconosciuti: ${sconosciuti.join(', ')}. Quelli che esistono: ${noti.join(', ')}.`)
  process.exit(1)
}

const NOME = `projects/${PROJECT}/databases/(default)/documents/licenza/attuale`
const db = client(PROJECT, await accessToken())
const [licenza] = (await db.documenti('licenza')).filter((d) => d.name.endsWith('/licenza/attuale'))

const adesso = licenza?.fields?.moduli?.mapValue?.fields || null
console.log(`[licenza] ${PROJECT}`)
console.log(`  licenza/attuale: ${licenza ? 'c’è' : 'non c’è: l’installazione non è attivata e le regole non fanno scrivere niente'}`)
if (licenza) {
  for (const id of noti) {
    const m = MODULI_PREMIUM[id]
    const incluso = adesso?.[id]?.booleanValue === true
    console.log(`  ${(incluso ? '✔' : '✖').padEnd(2)} ${id.padEnd(15)} ${m.label.padEnd(30)} ${incluso ? 'incluso' : 'non incluso'}`)
  }
}

if (!INCLUDI.length) {
  console.log('\n[licenza] Solo lettura. Per scrivere: --includi <id,id,...> --apply')
  process.exit(0)
}

const moduli = Object.fromEntries(noti.map((id) => [id, { booleanValue: INCLUDI.includes(id) }]))
console.log(`\n  da scrivere: ${noti.map((id) => `${id}=${INCLUDI.includes(id)}`).join(', ')}`)
if (!licenza) console.log('  ⚠ il documento non c’è: lo si crea, e da quel momento l’installazione è attiva coi moduli scritti.')
if (!APPLY) {
  console.log('\n[licenza] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

// Solo `moduli`, con la maschera: il resto della licenza (piano, limiti,
// stato, aggiornamenti) non si tocca. Senza documento, lo crea.
await db.commit([{ update: { name: NOME, fields: { moduli: { mapValue: { fields: moduli } } } }, updateMask: { fieldPaths: ['moduli'] } }])
console.log(`\n[licenza] ✓ scritta su "${PROJECT}".`)
