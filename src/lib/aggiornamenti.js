/* global __DEMO__ */
// ── GLI AGGIORNAMENTI DECISI DALLA REGIA (REQ-FLOTTA-020) ─────────────
//
// La regia scrive `settings/bar.licenza.aggiornamenti` (il contratto intero
// è in docs/aggiornamenti-dalla-regia.md):
//
//   { modalita: 'obbligatori' | 'a_scelta', inclusi, motivo,
//     proposta: { tag, note, proposta_il, saltata_il }, avviso: { id, testo, dal } }
//
// LA REGOLA CHE CONTA, come per i limiti (limiti.js): SENZA LA VOCE NON
// CAMBIA NIENTE. La Tana non ce l'ha, le istanze di prima nemmeno, e in
// modalità «obbligatori» l'app fa quello che ha sempre fatto: la regia
// pubblica, esce «Nuova versione disponibile», poi le novità. Ogni domanda
// qui sotto, senza la voce, risponde «niente da mostrare».
//
// La scelta del titolare non passa da settings/ (che scrive ogni
// bartender) ma da `aggiornamenti/scelta`, che legge e scrive solo lui: la
// regia la va a leggere con le sue credenziali. Così non serve né una
// Function (il profilo leggero non le ha) né una chiave della regia nel
// browser.
//
// Logica pura: le impostazioni si passano, già in mano a chi chiama.

import { isAdmin } from './ruoli.js'

export const MODALITA = Object.freeze({ OBBLIGATORI: 'obbligatori', A_SCELTA: 'a_scelta' })
export const SCELTE = Object.freeze({ AGGIORNA: 'aggiorna', SALTA: 'salta' })

// La forma del tag che la regia propone e che le regole accettano nella
// scelta (`^v\d+\.\d+\.\d+$`): una versione di rilascio, mai una beta.
export const FORMA_TAG = /^v\d+\.\d+\.\d+$/

// La voce della licenza, o null. La demo la ignora (REQ-FLOTTA-019): non ha
// una regia dietro, e un box che chiede di aggiornare lì non porterebbe da
// nessuna parte.
export function aggiornamentiDi(stato) {
  if (__DEMO__) return null
  const a = stato?.licenza?.aggiornamenti
  return a && typeof a === 'object' && !Array.isArray(a) ? a : null
}

export const modalitaAggiornamenti = (stato) =>
  aggiornamentiDi(stato)?.modalita === MODALITA.A_SCELTA ? MODALITA.A_SCELTA : MODALITA.OBBLIGATORI

// Gli aggiornamenti sono compresi nel piano? Solo un `false` scritto dice di
// no: una voce mancante non toglie gli aggiornamenti a nessuno.
export const aggiornamentiInclusi = (stato) => aggiornamentiDi(stato)?.inclusi !== false

// ── LE VERSIONI ───────────────────────────────────────────────────────
// `1.11.0-beta` → [1, 11, 0, false]; null se non si legge.
function leggiVersione(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(String(v || '').trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Boolean(m[4])] : null
}

// La versione proposta è più nuova di quella installata? Il documento dice
// «un tag diverso»; qui si chiede di più, PIÙ NUOVO: una proposta rimasta
// indietro (la regia non l'ha ancora tolta, e intanto il locale è stato
// aggiornato a una versione dopo) offrirebbe un ritorno all'indietro. Una
// beta viene prima della sua versione: chi ha la 1.11.0-beta si vede
// proporre la 1.11.0. Se l'installata non si legge resta la regola del
// documento, «diversa».
export function piuNuova(tag, installata) {
  const a = leggiVersione(tag)
  const b = leggiVersione(installata)
  if (!a) return false
  if (!b) return String(tag).replace(/^v/, '') !== String(installata || '').replace(/^v/, '')
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return !a[3] && b[3]
}

// La proposta valida in modalità «a scelta», con aggiornamenti inclusi e
// più nuova dell'installata — saltata o no. Null altrimenti.
export function propostaAperta(stato, { versione } = {}) {
  const a = aggiornamentiDi(stato)
  if (!a || modalitaAggiornamenti(stato) !== MODALITA.A_SCELTA || !aggiornamentiInclusi(stato)) return null
  const p = a.proposta
  if (!p || typeof p !== 'object' || !FORMA_TAG.test(String(p.tag || ''))) return null
  return piuNuova(p.tag, versione) ? p : null
}

// LA SCELTA C'È GIÀ? Vale la prima risposta che arriva: quella data da un
// altro terminale, o dall'area clienti della regia, non si richiede.
const giaScelta = (proposta, scelta) => Boolean(proposta && scelta && scelta.tag === proposta.tag)

// IL BOX DELLA PROPOSTA: al titolare, una proposta aperta, non saltata,
// senza una scelta già fatta, e non rimandata con «Più tardi» in questa
// apertura dell'app.
export function propostaDaMostrare(stato, { ruolo, versione, scelta = null, rimandata = null } = {}) {
  if (!isAdmin(ruolo)) return null
  const p = propostaAperta(stato, { versione })
  if (!p || p.saltata_il || giaScelta(p, scelta) || rimandata === p.tag) return null
  return p
}

// Cosa dicono le Informazioni della proposta:
//   'da_scegliere' → «Disponibile la versione X», le note e «Aggiorna»
//   'chiesto'      → il titolare ha detto «Aggiorna»: si aspetta la regia
//   'del_titolare' → chi non è titolare: la decide lui
//   null           → niente da dire
export function statoProposta(stato, { ruolo, versione, scelta = null } = {}) {
  const p = propostaAperta(stato, { versione })
  if (!p) return null
  if (!isAdmin(ruolo)) return 'del_titolare'
  return giaScelta(p, scelta) && scelta.scelta === SCELTE.AGGIORNA ? 'chiesto' : 'da_scegliere'
}

// ── GLI AGGIORNAMENTI NON INCLUSI ─────────────────────────────────────
// Null se sono inclusi; altrimenti il perché da dire in Informazioni.
export function nonInclusi(stato) {
  const a = aggiornamentiDi(stato)
  if (!a || aggiornamentiInclusi(stato)) return null
  return a.motivo === 'non_pagato' ? 'non_pagato' : a.motivo === 'free' ? 'free' : 'piano'
}

export const MESSAGGI_AGGIORNAMENTI = {
  piano:
    'Il piano di questo locale non comprende gli aggiornamenti: arrivano solo le correzioni di sicurezza e di compatibilità.',
  free:
    'Il piano Free non comprende gli aggiornamenti: arrivano solo le correzioni di sicurezza e di compatibilità.',
  non_pagato:
    'L’abbonamento non risulta pagato: il locale lavora con il piano Free e riceve solo le correzioni di sicurezza e di compatibilità.',
  chiesto: 'Aggiornamento chiesto: arriva entro una ventina di minuti.',
  del_titolare: 'È disponibile una versione nuova: l’aggiornamento lo decide il titolare.',
}

// ── L'AVVISO DELLE CONDIZIONI ─────────────────────────────────────────
// Il testo è contrattuale e lo scrive la regia: qui si mostra com'è. Al
// titolare, una volta per `id`, ricordata su questo dispositivo come le
// novità (novita.js).
const CHIAVE_AVVISO = 'drink:aggiornamenti:avviso'

export function avvisoVisto() {
  try {
    return localStorage.getItem(CHIAVE_AVVISO)
  } catch {
    return null
  }
}

export function segnaAvvisoVisto(id) {
  try {
    localStorage.setItem(CHIAVE_AVVISO, String(id))
  } catch {
    /* senza memoria locale l'avviso torna alla prossima apertura: meglio due volte che mai */
  }
}

// L'avviso valido (id e testo), o null.
export function avvisoCondizioni(stato) {
  const v = aggiornamentiDi(stato)?.avviso
  if (!v || typeof v !== 'object' || !v.id || !String(v.testo || '').trim()) return null
  return v
}

export function avvisoDaMostrare(stato, { ruolo, visto = null } = {}) {
  if (!isAdmin(ruolo)) return null
  const v = avvisoCondizioni(stato)
  return v && String(v.id) !== String(visto) ? v : null
}

// «dal 1 dicembre 2026», o '' se la data non si legge.
export function dataAvviso(dal) {
  if (!dal) return ''
  const d = new Date(dal)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

// La versione senza la «v», per i titoli: «Versione 1.11.0».
export const numeroVersione = (tag) => String(tag || '').replace(/^v/, '')
