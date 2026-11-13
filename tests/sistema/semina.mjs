// =====================================================================
//  IL DATABASE DEI TEST DI SISTEMA, DA ZERO A OGNI TEST.
//
//  Un test di sistema che parte dai dati lasciati dal giro di prima prova
//  i dati, non l'app: si svuotano Auth e Firestore dell'emulatore e si
//  semina come per lo sviluppo (scripts/seed.js: menù, magazzino,
//  impostazioni e un'utenza per ruolo), più la licenza della Tana, senza la
//  quale l'app non parte (REQ-LIC-009).
//
//  Gira sull'emulatore (test di sistema, e2e in locale) oppure, per i test
//  end-to-end, sul progetto di prova indicato da E2E_PROGETTO
//  (scripts/lib-ambiente-e2e.mjs, che rifiuta qualunque altro progetto).
//  Senza nessuno dei due si ferma prima di toccare qualunque cosa.
// =====================================================================
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { scriviSeManca, erroreLicenzaIniziale } from '../../scripts/lib-licenza-iniziale.js'
import { MODULI_PREMIUM } from '../../src/lib/licenza.js'
import { databaseE2e, svuotaE2e, seminaE2e } from '../../scripts/lib-ambiente-e2e.mjs'

// Sull'ambiente e2e, non sull'emulatore: lo dice E2E_PROGETTO, e solo se
// l'emulatore non c'è (in locale i test e2e girano sugli emulatori).
const suE2e = () => !process.env.FIRESTORE_EMULATOR_HOST && !!process.env.E2E_PROGETTO

export const PROGETTO = 'demo-tana-drink'

function host(variabile) {
  const valore = process.env[variabile]
  if (!valore) {
    throw new Error(`[sistema] ${variabile} non c'è: i test di sistema girano solo con gli emulatori (npm run test:sistema).`)
  }
  return valore
}

async function svuota(url) {
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`[sistema] svuotare ${url}: ${res.status}`)
}

export function database() {
  if (suE2e()) return databaseE2e(process.env.E2E_PROGETTO)
  host('FIRESTORE_EMULATOR_HOST')
  if (!getApps().length) initializeApp({ projectId: PROGETTO })
  return getFirestore()
}

export default async function semina() {
  if (suE2e()) {
    await svuotaE2e(process.env.E2E_PROGETTO)
    await seminaE2e(process.env.E2E_PROGETTO)
    return
  }
  const firestore = host('FIRESTORE_EMULATOR_HOST')
  const auth = host('FIREBASE_AUTH_EMULATOR_HOST')
  await Promise.all([
    svuota(`http://${firestore}/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`),
    svuota(`http://${auth}/emulator/v1/projects/${PROGETTO}/accounts`),
  ])

  // Lo stesso seme dello sviluppo, così chi guarda un test che fallisce
  // ritrova in locale gli stessi drink e le stesse utenze.
  execFileSync(process.execPath, ['scripts/seed.js', '--dev'], {
    stdio: 'ignore',
    env: { ...process.env, VITE_FIREBASE_PROJECT_ID: PROGETTO },
  })

  // La licenza passa dallo stesso controllo del deploy
  // (scripts/licenza-iniziale.mjs): un file rotto si ferma qui, non al
  // primo rilascio.
  const licenza = JSON.parse(readFileSync('clienti/tana/licenza-iniziale.json', 'utf8'))
  const errore = erroreLicenzaIniziale(licenza, Object.keys(MODULI_PREMIUM))
  if (errore) throw new Error(`[sistema] clienti/tana/licenza-iniziale.json: ${errore}`)
  await scriviSeManca(database().doc('licenza/attuale'), licenza)
}
