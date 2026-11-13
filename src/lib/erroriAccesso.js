// ── LE FRASI DELL'ACCESSO CON GOOGLE ──────────────────────────────────
//
// Una volta sola, per il personale al banco (BartenderPage) e per i clienti
// (customerAuth.js, authError). Le liste delle frasi d'accesso sono due, e
// quelle di Google erano finite solo nella prima (REQ-FLOTTA-030): un
// cliente col browser che blocca la finestra leggeva un generico «Errore di
// autenticazione», senza sapere che bastava consentirla.

export const ERRORI_GOOGLE = Object.freeze({
  'auth/operation-not-allowed': 'L’accesso con Google non è attivo per questo locale: si entra con email e password.',
  'auth/account-exists-with-different-credential': 'Questa email entra con un altro metodo: si usano email e password.',
  'auth/popup-blocked': 'Il browser ha bloccato la finestra di Google: va consentita, poi si riprova.',
})
