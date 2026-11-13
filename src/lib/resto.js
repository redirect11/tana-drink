// ── IL RESTO IN CONTANTI (REQ-PAG-015) ────────────────────────────────
//
// L'utente, 26/10/2026: «nella schermata del pagamento del conto deve
// uscire anche, opzionale attivabile nelle impostazioni, la possibilità di
// inserire quanto il cliente dà e deve uscire quanto resto dare».
//
// Il resto c'era già, ma di sbieco: battendo nel tastierino più del dovuto
// la schermata incassava il dovuto e diceva «Resto». Funzionava solo
// incassando TUTTO il conto: con le righe scelte (12 € su 30) e il cliente
// che dà 20, battere 20 voleva dire registrare un acconto da 20, non dare
// 8 di resto — lo stesso campo faceva due mestieri. Qui sono due numeri
// diversi: quanto si incassa, e quanto ha dato il cliente.
//
// Logica pura, interamente testabile.

const centesimi = (n) => Math.round((Number(n) || 0) * 100)
const ceilTo = (v, passo) => Math.ceil(v / passo - 1e-9) * passo

// I contanti che il cliente porge più spesso per un importo: arrotondato ai
// 5 e ai 10 € (una banconota in più per pareggiare), poi le banconote
// singole che bastano da sole. Senza doppioni, al più quattro.
// Per 23,50 €: 25, 30, 50, 100. Per 20 €: 20, 50, 100.
const BANCONOTE = [5, 10, 20, 50, 100, 200]
export function contantiProbabili(importo, quanti = 4) {
  const v = Number(importo) || 0
  if (!(v > 0)) return []
  const tagli = [ceilTo(v, 5), ceilTo(v, 10), ...BANCONOTE.filter((b) => b >= v)]
  return [...new Set(tagli)].filter((x) => x >= v).slice(0, quanti)
}

// Resto o ammanco, in euro coi centesimi giusti.
//   { resto: 3.5, mancano: 0 } — il cliente ha dato abbastanza
//   { resto: 0, mancano: 2 }   — mancano 2 €
export function restoDa(ricevuti, importo) {
  const d = centesimi(ricevuti) - centesimi(importo)
  return { resto: Math.max(0, d) / 100, mancano: Math.max(0, -d) / 100 }
}

// Una cifra scritta a mano: «20», «20,50», «20.5». null se non è un importo.
export function leggiImporto(testo) {
  const t = String(testo ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null
  const n = Number(t)
  return n > 0 ? n : null
}
