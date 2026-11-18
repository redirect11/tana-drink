// ── LE FRASI DELL'ACCESSO CON GOOGLE ──────────────────────────────────
//
// Una volta sola, per il personale al banco (BartenderPage) e per i clienti
// (customerAuth.js, authError). Le liste delle frasi d'accesso sono due, e
// quelle di Google erano finite solo nella prima (REQ-FLOTTA-030): un
// cliente col browser che blocca la finestra leggeva un generico «Errore di
// autenticazione», senza sapere che bastava consentirla.
//
// Segnate da tradurre (REQ-UI-039): il gestionale le mostra con
// trSegnato; le pagine dei clienti così come sono, che lì traduce il
// browser.

import { daTradurre } from './lingua.js'

export const ERRORI_GOOGLE = Object.freeze({
  'auth/operation-not-allowed': daTradurre(
    'L’accesso con Google non è attivo per questo locale: si entra con email e password.'
  ),
  'auth/account-exists-with-different-credential': daTradurre(
    'Questa email entra con un altro metodo: si usano email e password.'
  ),
  'auth/popup-blocked': daTradurre('Il browser ha bloccato la finestra di Google: va consentita, poi si riprova.'),
})
