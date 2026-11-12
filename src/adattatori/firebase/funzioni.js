// ── LE FUNCTIONS DEL LOCALE, DIETRO UNA PORTA (REQ-FLOTTA-021) ────────────
//
// L'adattatore Firebase della porta delle funzioni (src/porte/funzioni.js):
// una Function del locale si chiama per nome e risponde coi suoi dati. Fuori
// dagli adattatori nessuno importa Firebase (tests/unit/confineFirebase.test.js);
// un'installazione on premise avrà il suo adattatore, con lo stesso
// contratto.
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../lib/firebaseClient.js'

// Torna i dati della risposta; se la Function rifiuta, la promessa fallisce
// con l'errore com'è (`code`: 'functions/permission-denied', …).
export const chiamaFunzione = (nome, dati) => httpsCallable(functions, nome)(dati).then((r) => r.data)
