import { defineConfig } from 'vitest/config'

// I TEST DELLE REGOLE FIRESTORE STANNO PER CONTO LORO.
//
// Girano contro l'emulatore Firestore con le regole vere del progetto: senza
// emulatore acceso non partono, e nel giro di `npm test` renderebbero rossa
// la CI per un motivo che non è un difetto del codice. Da qui il file di
// configurazione separato e lo script dedicato:
//
//   npx firebase emulators:start --project demo-tana-drink \
//     --only auth,firestore,storage --config firebase.collaudo.json
//   npm run test:regole
//
// Non contano per la copertura: quello che misurano non è codice nostro, è
// firestore.rules.
//
// Qui girano anche i TEST DI CONTRATTO delle porte (REQ-FLOTTA-021): la
// serie scritta sulla porta dei dati (tests/contratto/dati.js) e la tabella
// dei permessi per ruolo (tests/contratto/permessi.js), fatte girare
// sull'adattatore Firebase. Anche loro vogliono l'emulatore.
export default defineConfig({
  // L'adattatore dei dati ha un ramo per la demo: qui si prova quello dei
  // locali veri.
  define: { __DEMO__: 'false' },
  test: {
    environment: 'node',
    globals: true,
    env: { TZ: 'Europe/Rome' },
    include: ['tests/regole/**/*.test.js'],
    // Un emulatore solo, e i test si azzerano il database a vicenda: in
    // fila indiana, non in parallelo.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
