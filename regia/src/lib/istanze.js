// ── LO STATO DI UN'ISTANZA (REQ-FLOTTA-004, REQ-FLOTTA-006) ───────────
//
// L'istanza di un cliente passa per pochi stati, e la dashboard li dice
// con parole piane. Chi li scrive: il titolare (`in coda`, col tasto
// Attiva), il provisioning (`in corso`, `attiva`, `errore`), l'admin.

import { DOMINIO_ISTANZE, PREFISSO_PROGETTI } from './prodotto.js'

export const STATI = {
  DA_ATTIVARE: 'da attivare',
  IN_CODA: 'in coda',
  IN_CORSO: 'in corso',
  ATTIVA: 'attiva',
  ERRORE: 'errore',
}

const DETTO = {
  [STATI.DA_ATTIVARE]: 'Non ancora attivata',
  [STATI.IN_CODA]: 'In coda: l’attivazione parte a breve',
  [STATI.IN_CORSO]: 'Attivazione in corso (qualche minuto)',
  [STATI.ATTIVA]: 'Attiva',
  [STATI.ERRORE]: 'Attivazione fallita: ci stiamo guardando',
}

export const statoDetto = (stato) => DETTO[stato] || DETTO[STATI.DA_ATTIVARE]

// L'istanza come la vede il titolare, da quello che c'è: niente documento
// → da attivare.
export function statoIstanza(istanza, richiesta) {
  if (istanza?.stato) return istanza.stato
  if (richiesta?.stato) return richiesta.stato
  return STATI.DA_ATTIVARE
}

// Il progetto e l'indirizzo che l'istanza avrà.
export const progettoDi = (slug) => `${PREFISSO_PROGETTI}-${slug}`
export const urlDi = (slug) => `https://${slug}.${DOMINIO_ISTANZE}`

// Si può chiedere l'attivazione? Serve un abbonamento valido (o un piano
// segnato pagato a mano dall'admin, finché Stripe non c'è) e nessuna
// attivazione già in viaggio.
export function puoAttivare(cliente, istanza, richiesta) {
  const stato = statoIstanza(istanza, richiesta)
  if (stato !== STATI.DA_ATTIVARE && stato !== STATI.ERRORE) return { ok: false, perche: statoDetto(stato) }
  if (!cliente?.piano) return { ok: false, perche: 'Serve un piano: scegline uno e completa l’abbonamento.' }
  if (cliente?.abbonamento?.stato && cliente.abbonamento.stato !== 'attivo') {
    return { ok: false, perche: 'L’abbonamento non risulta attivo.' }
  }
  return { ok: true, perche: null }
}

// La richiesta che il titolare scrive in richieste/{slug}.
export function nuovaRichiesta(cliente, adesso = new Date()) {
  return {
    uid: cliente.uid,
    slug: cliente.slug,
    nome_locale: cliente.nome_locale,
    piano: cliente.piano,
    moduli: cliente.moduli || [],
    stato: STATI.IN_CODA,
    chiesta_il: adesso.toISOString(),
  }
}
