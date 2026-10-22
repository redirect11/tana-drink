// =====================================================================
//  SCRIVE LA LICENZA E L'IDENTITÀ DI UN'ISTANZA appena creata o aggiornata.
//
//    node scripts/licenza-istanza.mjs --project drinkpos-bar-mario \
//         --slug bar-mario --nome "Bar Mario" --piano base --moduli staff,magazzino
//
//  Lo lancia il workflow provisiona-istanza.yml (REQ-FLOTTA-006) dopo il
//  deploy, con GOOGLE_APPLICATION_CREDENTIALS del service account di
//  provisioning. Scrive in settings/bar — è il documento che l'app legge
//  (lib/licenza.js), non un documento a parte:
//    licenza           { piano, moduli: { conta: true, … }, stato, slug,
//                        regia_url, scritta_il }
//    venue_name, venue_short_name                          (solo se vuoti)
//  Lo stato (attiva, sospesa, chiusa: REQ-FLOTTA-008) non si tocca se la
//  regia l'ha già scritto: una riattivazione passa da lì, non da un deploy.
//  La mappa piano→moduli della regia (piani.json) si traduce nei moduli di
//  lib/licenza.js dell'app; la stessa mappa sta nelle Functions della regia
//  (functions/lib/licenza.js), che la riscrive quando il piano cambia.
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
const REGIA_URL = arg('regia', process.env.REGIA_URL || 'https://drink-regia.web.app')
if (!PROGETTO || !SLUG) {
  console.error('Uso: node scripts/licenza-istanza.mjs --project <id> --slug <slug> [--nome …] [--piano …] [--moduli a,b] [--regia url]')
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
const bar = await db.doc('settings/bar').get()
const attuale = bar.exists ? bar.data() : {}
const patch = {
  licenza: {
    ...(attuale.licenza || {}),
    piano: PIANO,
    moduli: Object.fromEntries(TUTTI.map((m) => [m, moduliApp.includes(m)])),
    stato: attuale.licenza?.stato || 'attiva',
    slug: SLUG,
    regia_url: REGIA_URL,
    scritta_il: adesso,
  },
}
if (!attuale.venue_name) patch.venue_name = NOME
if (!attuale.venue_short_name) patch.venue_short_name = NOME.length > 12 ? NOME.split(/\s+/)[0] : NOME
await db.doc('settings/bar').set(patch, { merge: true })
console.log(`[licenza] ✓ ${PROGETTO}: piano ${PIANO}, moduli app ${moduliApp.join(', ') || 'nessuno'}, stato ${patch.licenza.stato}`)
