// =====================================================================
//  IL PROGETTO DI PROVA DICE ALLA REGIA SE GLI E2E GIRANO (REQ-FLOTTA-032)
//
//    node scripts/istanza-di-prova.mjs --attiva true  --project drinkpos-prova-e2e
//    node scripts/istanza-di-prova.mjs --attiva false --project drinkpos-prova-e2e
//
//  Lo chiama e2e.yml all'inizio e alla fine del giro. Vuole la chiave del
//  service account del progetto di prova (GOOGLE_APPLICATION_CREDENTIALS) e
//  la sua chiave web (VITE_FIREBASE_API_KEY), che il giro ha già. Esce
//  sempre con 0: lo stato nella regia non deve mai fermare le prove, e un
//  errore diventa un avviso nel log. Il perché in lib-istanza-di-prova.js.
// =====================================================================

import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { segnalaIstanzaDiProva } from './lib-istanza-di-prova.js'

const valore = (nome) => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const progetto = valore('--project')
const attiva = { true: true, false: false }[valore('--attiva')]

let esito
try {
  const app = initializeApp({ credential: applicationDefault(), projectId: progetto }, 'istanza-di-prova')
  esito = await segnalaIstanzaDiProva({
    attiva,
    progetto,
    chiaveWeb: process.env.VITE_FIREBASE_API_KEY,
    creaToken: (uid) => getAuth(app).createCustomToken(uid),
  })
} catch (e) {
  esito = { ok: false, status: 0, errore: e?.message || String(e) }
}

if (esito.ok) console.log(`Regia: ${progetto} ${esito.attiva ? 'attiva' : 'disattivata'}`)
else console.log(`::warning::stato del progetto di prova non mandato alla regia (${esito.status}): ${esito.errore || 'nessun dettaglio'}`)
