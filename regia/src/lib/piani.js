// ── I PIANI E I PREZZI (REQ-FLOTTA-002) ───────────────────────────────
//
// I numeri stanno in regia/piani.json, letto anche dalle Functions
// (abbonamento.js): un posto solo, DA CONFERMARE con l'utente prima di
// pubblicare. Il piano base è la porta d'ingresso; il margine sta nei
// moduli, che sono le stesse funzioni premium della licenza
// (src/lib/licenza.js nell'app): quello che si compra qui è quello che
// l'istanza accende.

import listino from '../../piani.json'

export const MODULI = listino.moduli
export const PIANI = listino.piani
export const TERMINALE_IN_PIU = listino.terminale_in_piu
export const ATTIVAZIONE = listino.attivazione

// Quanto costa al mese una scelta: piano, moduli in più, terminali in più.
//   { piano: 'base'|'completo', moduli: ['magazzino', …], terminali: 1 }
export function prezzoMensile({ piano = 'base', moduli = [], terminali = 1 } = {}) {
  const p = PIANI[piano] || PIANI.base
  const inclusi = new Set(p.include)
  const extra = MODULI.filter((m) => moduli.includes(m.id) && !inclusi.has(m.id))
  const terminaliInclusi = p.terminali || 1
  const terminaliExtra = Math.max(0, (Number(terminali) || 1) - terminaliInclusi)
  return p.prezzo + extra.reduce((s, m) => s + m.prezzo, 0) + terminaliExtra * TERMINALE_IN_PIU
}

// I moduli che un'istanza deve accendere per una scelta: è quello che la
// licenza scrive (REQ-FLOTTA-007).
export function moduliDellaScelta({ piano = 'base', moduli = [] } = {}) {
  const p = PIANI[piano] || PIANI.base
  return [...new Set([...p.include, ...moduli.filter((id) => MODULI.some((m) => m.id === id))])]
}

// Il punto delle migliaia a mano: in CI il Node della macchina non ha i
// dati di lingua italiani e toLocaleString scriveva «1250».
export const euro = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`
