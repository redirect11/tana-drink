// =====================================================================
//  SCRIVE LA LICENZA E L'IDENTITÀ DI UN'ISTANZA appena creata.
//
//    node scripts/licenza-istanza.mjs --project drinkpos-bar-mario \
//         --slug bar-mario --nome "Bar Mario" --piano base --moduli staff,magazzino
//
//  Lo lancia il workflow provisiona-istanza.yml (REQ-FLOTTA-006) dopo il
//  deploy, con GOOGLE_APPLICATION_CREDENTIALS del service account di
//  provisioning. Scrive:
//    settings/licenza  { piano, moduli: { conta: true, … }, scritta_il }
//    settings/bar      { venue_name, venue_short_name }   (solo se vuoti)
//  La mappa piano→moduli dell'app sta in regia/src/lib/piani.js; qui i
//  moduli arrivano già scelti (id della regia) e si traducono nei moduli
//  di lib/licenza.js dell'app.
// =====================================================================
import { createRequire } from 'node:module'
import { arg } from './lib-firestore.js'

const require = createRequire(import.meta.url)
// firebase-admin sta nelle dipendenze delle Functions: si prende da lì.
const { initializeApp } = require('../functions/node_modules/firebase-admin/lib/app/index.js')
const { getFirestore } = require('../functions/node_modules/firebase-admin/lib/firestore/index.js')

const PROGETTO = arg('project')
const SLUG = arg('slug')
const NOME = arg('nome', SLUG)
const PIANO = arg('piano', 'base')
const MODULI = (arg('moduli', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
if (!PROGETTO || !SLUG) {
  console.error('Uso: node scripts/licenza-istanza.mjs --project <id> --slug <slug> [--nome …] [--piano …] [--moduli a,b]')
  process.exit(1)
}

// Dai moduli della regia a quelli dell'app (src/lib/licenza.js: conta,
// fatture, scadenzario). Il piano completo accende tutto.
const MAPPA = { magazzino: ['conta'], staff: [], statistiche: [], menu_tavoli: [], pagamenti: [] }
const TUTTI = ['conta', 'fatture', 'scadenzario']
const moduliApp = PIANO === 'completo' ? TUTTI : [...new Set(MODULI.flatMap((m) => MAPPA[m] || []))]

initializeApp({ projectId: PROGETTO })
const db = getFirestore()
const adesso = new Date().toISOString()
await db.doc('settings/licenza').set(
  { piano: PIANO, moduli: Object.fromEntries(TUTTI.map((m) => [m, moduliApp.includes(m)])), slug: SLUG, scritta_il: adesso },
  { merge: true }
)
const bar = await db.doc('settings/bar').get()
const attuale = bar.exists ? bar.data() : {}
const patch = {}
if (!attuale.venue_name) patch.venue_name = NOME
if (!attuale.venue_short_name) patch.venue_short_name = NOME.length > 12 ? NOME.split(/\s+/)[0] : NOME
if (Object.keys(patch).length) await db.doc('settings/bar').set(patch, { merge: true })
console.log(`[licenza] ✓ ${PROGETTO}: piano ${PIANO}, moduli app ${moduliApp.join(', ') || 'nessuno'}`)
