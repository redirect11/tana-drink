// ── IL CONTRATTO DELLA PORTA DEI DATI, SULL'ADATTATORE FIREBASE ───────
// (REQ-FLOTTA-021)
//
// La serie di tests/contratto/dati.js, fatta girare sull'adattatore
// Firebase contro l'emulatore. Le regole qui non sono quelle del locale ma
// le più semplici possibili — legge chiunque, scrive chi ha fatto
// l'accesso —: quello che si prova è la porta, non i permessi (quelli
// stanno in permessi.test.js). Chi non ha fatto l'accesso serve a vedere
// una scrittura rifiutata.

import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import * as adattatoreFirebase from '../../src/adattatori/firebase/dati.js'
import { contrattoDati } from '../contratto/dati.js'

const HOST = process.env.FIRESTORE_EMULATOR_HOST_ONLY || '127.0.0.1'
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081)

const REGOLE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{documento=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`

// Il progetto ha un nome a parte, come i file delle regole: i dati di
// queste prove non si mescolano con nessun altro.
contrattoDati('adattatore Firebase', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'contratto-dati',
    firestore: { host: HOST, port: PORT, rules: REGOLE },
  })
  await env.clearFirestore()
  return {
    porta: adattatoreFirebase,
    db: env.authenticatedContext('chi-scrive').firestore(),
    dbSenzaPermessi: env.unauthenticatedContext().firestore(),
    chiudi: () => env.cleanup(),
  }
})
