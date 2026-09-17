// =====================================================================
//  COSA HA COMPRATO IL LOCALE: i moduli inclusi nella licenza.
//
//    node scripts/licenza-moduli.js                                   # com'è messo (test)
//    node scripts/licenza-moduli.js --includi conta,scadenzario --apply
//    node scripts/licenza-moduli.js --project tana-drink --includi conta,scadenzario --apply
//
//  Scrive `licenza.moduli` su settings/bar, che è il punto di innesto
//  della licenza vera (lib/licenza.js, `moduloIncluso`): quando quel campo
//  c'è, comanda LUI e la colonna `incluso` scritta nel codice non si guarda
//  più. L'interruttore d'uso (`modulo_<id>_enabled`) resta del locale e qui
//  non si tocca.
//
//  SI SCRIVE SEMPRE PER INTERO. `licenza.moduli` è la verità completa su
//  cosa il locale ha: una mappa scritta a metà direbbe che tutto il resto
//  non è incluso, e spegnerebbe lo scadenzario per accendere l'inventario.
//  Per questo `--includi` elenca TUTTI i moduli da includere, e quelli non
//  nominati si scrivono a false, a vista.
//
//  Nato il 17/09/2026: Flavio voleva fare l'inventario quel pomeriggio e la
//  sezione in produzione non c'era, perché `incluso: false` nel codice e
//  nessuna licenza scritta. Daniele: «va riattivata anche in produzione».
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

const db = client(PROJECT, await accessToken())
const [bar] = await db.documenti('settings', { campi: ['licenza', ...noti.map((id) => MODULI_PREMIUM[id].chiave)] }).then(
  (docs) => docs.filter((d) => d.name.endsWith('/settings/bar'))
)
if (!bar) {
  console.error(`[licenza] settings/bar non c'è su "${PROJECT}".`)
  process.exit(1)
}

const adesso = bar.fields?.licenza?.mapValue?.fields?.moduli?.mapValue?.fields || null
console.log(`[licenza] ${PROJECT}`)
console.log(`  licenza scritta: ${adesso ? 'sì' : 'no (vale la tabella nel codice)'}`)
for (const id of noti) {
  const m = MODULI_PREMIUM[id]
  const incluso = adesso ? adesso[id]?.booleanValue === true : m.incluso
  const acceso = bar.fields?.[m.chiave]?.booleanValue !== false
  console.log(`  ${(incluso ? '✔' : '✖').padEnd(2)} ${id.padEnd(12)} ${m.label.padEnd(26)} ${incluso ? (acceso ? 'attivo' : 'incluso ma spento') : 'non incluso'}`)
}

if (!INCLUDI.length) {
  console.log('\n[licenza] Solo lettura. Per scrivere: --includi <id,id,...> --apply')
  process.exit(0)
}

const moduli = Object.fromEntries(noti.map((id) => [id, { booleanValue: INCLUDI.includes(id) }]))
console.log(`\n  da scrivere: ${noti.map((id) => `${id}=${INCLUDI.includes(id)}`).join(', ')}`)
if (!APPLY) {
  console.log('\n[licenza] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

// Solo il campo `licenza`, con la maschera: il resto di settings/bar non si
// tocca. Dentro `licenza` si tiene quello che c'era e si cambia `moduli`.
const licenzaPrima = bar.fields?.licenza?.mapValue?.fields || {}
await db.commit([
  {
    update: {
      name: bar.name,
      fields: { licenza: { mapValue: { fields: { ...licenzaPrima, moduli: { mapValue: { fields: moduli } } } } } },
    },
    updateMask: { fieldPaths: ['licenza'] },
  },
])
console.log(`\n[licenza] ✓ scritta su "${PROJECT}".`)
