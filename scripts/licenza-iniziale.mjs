// =====================================================================
//  LA LICENZA INIZIALE, SCRITTA DAL DEPLOY (REQ-LIC-009)
//
//    node scripts/licenza-iniziale.mjs --project tana-drink-test --cliente tana
//
//  Lo lancia il deploy da GitHub (.github/workflows/deploy.yml), PRIMA di
//  pubblicare le regole: se `licenza/attuale` manca lo crea da
//  `clienti/<cliente>/licenza-iniziale.json`; se c'è non lo tocca. Senza il
//  file non fa niente (i locali della regia la licenza la ricevono dalla
//  regia). Se non riesce esce con errore, e il deploy si ferma prima delle
//  regole: le regole nuove senza licenza fermerebbero il locale.
//
//  Le credenziali sono quelle del deploy (GOOGLE_APPLICATION_CREDENTIALS).
//  Il service account deve poter scrivere documenti: roles/datastore.user.
//  Il perché, per intero, in scripts/lib-licenza-iniziale.js.
// =====================================================================
import { readFileSync, existsSync } from 'node:fs'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { arg } from './lib-firestore.js'
import { erroreLicenzaIniziale, scriviSeManca } from './lib-licenza-iniziale.js'
import { MODULI_PREMIUM } from '../src/lib/licenza.js'

const progetto = arg('project')
const cliente = arg('cliente')
if (!progetto || !cliente) {
  console.error('[licenza iniziale] servono --project e --cliente')
  process.exit(2)
}

const file = `clienti/${cliente}/licenza-iniziale.json`
if (!existsSync(file)) {
  console.log(`[licenza iniziale] ${file} non c’è: niente da scrivere.`)
  process.exit(0)
}

const licenza = JSON.parse(readFileSync(file, 'utf8'))
const errore = erroreLicenzaIniziale(licenza, Object.keys(MODULI_PREMIUM))
if (errore) {
  console.error(`[licenza iniziale] ${file}: ${errore}`)
  process.exit(1)
}

try {
  const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: progetto }))
  const esito = await scriviSeManca(db.doc('licenza/attuale'), licenza)
  console.log(
    esito === 'creata'
      ? `[licenza iniziale] ${progetto}: licenza/attuale creata da ${file}.`
      : `[licenza iniziale] ${progetto}: licenza/attuale c’era già, non si tocca.`
  )
} catch (e) {
  console.error(`[licenza iniziale] ${progetto}: non riuscita — ${e?.message || e}`)
  console.error('[licenza iniziale] Il service account del deploy deve avere roles/datastore.user.')
  process.exit(1)
}
