// ── IL PROGETTO DI PROVA DICE ALLA REGIA QUANDO GIRA (REQ-FLOTTA-032) ──
//
// Daniele, 15/11/2026: nel backoffice della regia `drinkpos-prova-e2e` deve
// risultare «Disattivata» quando gli e2e non girano. La regia ha aperto
// l'interfaccia 15 (contratto, drink-regia docs/contratto-regia-app.md):
// il giro e2e chiama `istanzaDiProva` con { attiva: true } all'inizio e
// { attiva: false } alla fine, anche se le prove falliscono.
//
// IL TOKEN. La regia vuole un ID token qualunque del progetto di prova: ne
// controlla firma, aud, iss e scadenza, non ruoli né documenti, e nemmeno
// che l'utente esista ancora. Le utenze dei casi d'uso non servono: ogni
// test le semina da zero e lo smontaggio le cancella tutte, quindi a inizio
// e a fine giro non ci sono. Si conia un custom token per un utente fisso
// con la chiave del service account del giro e lo si scambia con Identity
// Toolkit, con la chiave web del progetto. Lo smontaggio poi cancella anche
// quell'utente.
// Lo scambio si rifà a ogni chiamata: il token dura un'ora, e su un giro
// lungo quello dell'inizio alla fine prenderebbe 401 (la regia, 15/11).
//
// È solo uno stato della regia: spenta non cambia licenza né presentazione.
// Quindi un errore qui non ferma mai il giro, e finché la regia non ha
// segnato il progetto come istanza di prova la risposta è 403, senza danni.

import { urlFunzioneRegia, postaAllaRegia, erroreDellaRegia } from '../src/lib/funzioniRegia.js'

export const UTENTE_REGIA = 'e2e-regia'

// Gli e2e compilano l'app contro la regia di test (e2e.yml, Build): è lei
// che conosce il progetto di prova.
export const REGIA_DELLE_PROVE = 'drink-regia-test'

// La stessa guardia di e2e.yml e di lib-ambiente-e2e.mjs: solo un progetto
// di prova manda il suo stato alla regia.
const PROGETTO_DI_PROVA = /^drinkpos-prova-[a-z0-9-]+$/

const SCAMBIO = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken'

// Torna { ok, status, attiva?, errore? }; non lancia mai. `creaToken(uid)` è
// createCustomToken di firebase-admin; `prendi` è fetch.
export async function segnalaIstanzaDiProva({ attiva, progetto, chiaveWeb, creaToken, prendi = globalThis.fetch }) {
  if (!PROGETTO_DI_PROVA.test(String(progetto || ''))) {
    return { ok: false, status: 0, errore: `${progetto} non è un progetto di prova` }
  }
  if (typeof attiva !== 'boolean') return { ok: false, status: 0, errore: 'attiva deve essere true o false' }
  if (!chiaveWeb) return { ok: false, status: 0, errore: 'manca la chiave web del progetto di prova' }

  let customToken
  try {
    customToken = await creaToken(UTENTE_REGIA)
  } catch (e) {
    return { ok: false, status: 0, errore: `custom token non creato: ${e?.message || e}` }
  }

  // postaAllaRegia è una POST JSON con l'attesa massima: va bene anche per
  // lo scambio, che non è della regia.
  const scambio = await postaAllaRegia(`${SCAMBIO}?key=${encodeURIComponent(chiaveWeb)}`, {
    corpo: { token: customToken, returnSecureToken: true },
    prendi,
  })
  const idToken = scambio.corpo?.idToken
  if (scambio.status !== 200 || !idToken) {
    return { ok: false, status: scambio.status, errore: `scambio del token non riuscito (${scambio.status})` }
  }

  const r = await postaAllaRegia(urlFunzioneRegia('istanzaDiProva', REGIA_DELLE_PROVE), {
    corpo: { attiva },
    intestazioni: { Authorization: `Bearer ${idToken}` },
    prendi,
  })
  if (r.status === 200 && r.corpo?.ok) return { ok: true, status: 200, attiva: r.corpo.attiva }
  return { ok: false, status: r.status, errore: erroreDellaRegia(r.corpo) || r.errore || null }
}
