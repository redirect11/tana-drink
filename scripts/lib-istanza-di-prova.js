// ── IL PROGETTO DI PROVA DICE ALLA REGIA QUANDO GIRA (REQ-FLOTTA-032) ──
//
// Daniele, 15/11/2026: nel backoffice della regia `drinkpos-prova-e2e` deve
// risultare «Disattivata» quando gli e2e non girano. La regia ha aperto
// l'interfaccia 15 (contratto, drink-regia docs/contratto-regia-app.md):
// il giro e2e chiama `istanzaDiProva` con { attiva: true } all'inizio e
// { attiva: false } alla fine, anche se le prove falliscono.
//
// CHI CHIAMA. Non un utente del locale: Daniele ha deciso che nessun utente
// di un locale può cambiare qualcosa nella regia (contratto, «La sicurezza
// delle interfacce», regia REQ-FLOTTA-115). Una prima stesura coniava un
// utente `e2e-regia` col suo ID token, ed è stata scartata lo stesso giorno.
// Chiama l'ACCOUNT DI DEPLOY del progetto di prova, quello della chiave che
// il giro ha già (E2E_SERVICE_ACCOUNT), con un gettone d'identità di Google:
// destinatario `regia-prova:<progetto della regia>`, con email ed
// email_verified, che la regia controlla.
// Il gettone si chiede di nuovo a ogni chiamata: dura un'ora, e su un giro
// lungo quello dell'inizio alla fine prenderebbe 401 (la regia, 15/11).
//
// È solo uno stato della regia: spenta non cambia licenza né presentazione.
// Quindi un errore qui non ferma mai il giro, e finché la regia non ha
// segnato il progetto come istanza di prova la risposta è 403, senza danni.

import { urlFunzioneRegia, postaAllaRegia, erroreDellaRegia } from '../src/lib/funzioniRegia.js'

// Gli e2e compilano l'app contro la regia di test (e2e.yml, Build): è lei
// che conosce il progetto di prova.
export const REGIA_DELLE_PROVE = 'drink-regia-test'

// Il destinatario del gettone, come lo vuole la regia (contratto, §15).
export const destinatarioDelGettone = (regia = REGIA_DELLE_PROVE) => `regia-prova:${regia}`

// La stessa guardia di e2e.yml e di lib-ambiente-e2e.mjs: solo un progetto
// di prova manda il suo stato alla regia.
const PROGETTO_DI_PROVA = /^drinkpos-prova-[a-z0-9-]+$/

// Torna { ok, status, attiva?, errore? }; non lancia mai. `gettone(aud)` dà
// il gettone d'identità dell'account di deploy per quel destinatario
// (google-auth-library, nello script); `prendi` è fetch.
export async function segnalaIstanzaDiProva({ attiva, progetto, gettone, prendi = globalThis.fetch }) {
  if (!PROGETTO_DI_PROVA.test(String(progetto || ''))) {
    return { ok: false, status: 0, errore: `${progetto} non è un progetto di prova` }
  }
  if (typeof attiva !== 'boolean') return { ok: false, status: 0, errore: 'attiva deve essere true o false' }

  let token
  try {
    token = await gettone(destinatarioDelGettone())
  } catch (e) {
    return { ok: false, status: 0, errore: `gettone non ottenuto: ${e?.message || e}` }
  }
  if (typeof token !== 'string' || !token) return { ok: false, status: 0, errore: 'gettone vuoto' }

  const r = await postaAllaRegia(urlFunzioneRegia('istanzaDiProva', REGIA_DELLE_PROVE), {
    corpo: { attiva },
    intestazioni: { Authorization: `Bearer ${token}` },
    prendi,
  })
  if (r.status === 200 && r.corpo?.ok) return { ok: true, status: 200, attiva: r.corpo.attiva }
  return { ok: false, status: r.status, errore: erroreDellaRegia(r.corpo) || r.errore || null }
}
