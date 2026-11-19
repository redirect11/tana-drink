// =====================================================================
//  IL PROGETTO DI PROVA DICE ALLA REGIA SE GLI E2E GIRANO (REQ-FLOTTA-032)
//
//    node scripts/istanza-di-prova.mjs --attiva true  --project drinkpos-prova-e2e
//    node scripts/istanza-di-prova.mjs --attiva false --project drinkpos-prova-e2e
//
//  Lo chiama e2e.yml all'inizio e alla fine del giro. Chiama come l'account
//  di deploy del progetto di prova, con la chiave che il giro ha già
//  (GOOGLE_APPLICATION_CREDENTIALS). Esce sempre con 0: lo stato nella
//  regia non deve mai fermare le prove, e un errore diventa un avviso nel
//  log. Il perché in lib-istanza-di-prova.js.
// =====================================================================

import { GoogleAuth } from 'google-auth-library'
import { segnalaIstanzaDiProva } from './lib-istanza-di-prova.js'

const valore = (nome) => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const progetto = valore('--project')
const attiva = { true: true, false: false }[valore('--attiva')]

// Con la chiave di un service account il gettone d'identità porta email ed
// email_verified, che la regia vuole (contratto, §15). Un client nuovo a
// ogni giro dello script: il gettone dell'inizio non arriva alla fine.
const gettone = async (destinatario) => {
  const client = await new GoogleAuth().getIdTokenClient(destinatario)
  return client.idTokenProvider.fetchIdToken(destinatario)
}

let esito
try {
  esito = await segnalaIstanzaDiProva({ attiva, progetto, gettone })
} catch (e) {
  esito = { ok: false, status: 0, errore: e?.message || String(e) }
}

if (esito.ok) console.log(`Regia: ${progetto} ${esito.attiva ? 'attiva' : 'disattivata'}`)
else console.log(`::warning::stato del progetto di prova non mandato alla regia (${esito.status}): ${esito.errore || 'nessun dettaglio'}`)
