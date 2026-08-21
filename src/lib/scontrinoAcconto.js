'use strict'

// ── QUANDO ESCE LO SCONTRINO D'ACCONTO ───────────────────────────────
//
// «Lo scontrino esce ad ogni riscossione ma è configurabile. Va fatto
// così: una impostazione che attiva un terzo bottone, "riscuoti acconto
// con scontrino", e una ulteriore opzione che invece ad ogni riscossione
// stampa lo scontrino d'acconto. […] Quando la riscossione dello
// scontrino di acconto è attiva, disabilita l'opzione del terzo bottone»
// (l'utente, 21/08/2026).
//
// DA DOVE NASCE. La stampa era appesa alla CHIUSURA del conto, e un
// acconto non chiude: chi versava una parte se ne andava senza niente in
// mano. Era una scelta presa quando l'acconto era un caso di margine —
// da quando si sconta sulla selezione (REQ-PAG-013) e si parte da
// «Deseleziona tutti» (REQ-PAG-009), riscuotere una parte è il modo
// normale di dividere un conto.
//
// Qui c'è solo la REGOLA, pura: due impostazioni del locale e una
// domanda sola («per questa riscossione la carta esce?»). Che cosa ci
// finisce sopra sta in printer.js, i campi in campiStampa.js.

// Le due impostazioni vivono in settings/bar accanto a «senza stampa» e
// «riscuoti e servi»: sono la stessa famiglia di scelte — quali tasti
// compaiono quando si incassa — e chi le cerca apre «💳 Pagamenti»
// (BUG-070: uno di questi interruttori stava altrove e non si trovava).
export const CHIAVE_TASTO_ACCONTO = 'scontrino_acconto_tasto'
export const CHIAVE_ACCONTO_SEMPRE = 'scontrino_acconto_sempre'

// A ogni riscossione parziale la carta esce da sé, senza premere niente
// di speciale.
export const accontoSempre = (settings) => settings?.[CHIAVE_ACCONTO_SEMPRE] === true

// IL TERZO TASTO C'È? La mutua esclusione sta QUI e non nel pannello:
// con l'automatico acceso il tasto non avrebbe più niente da fare — la
// carta esce comunque — e due strade per lo stesso foglio sono solo un
// modo per stamparne due. Il pannello mostra l'interruttore spento e
// non toccabile col suo perché; la schermata di pagamento chiede questa
// funzione e basta, così non esiste il caso in cui le due parti la
// pensano diversamente.
export const tastoAcconto = (settings) =>
  !accontoSempre(settings) && settings?.[CHIAVE_TASTO_ACCONTO] === true

// ── LA DOMANDA, UNA SOLA ─────────────────────────────────────────────
//
//   chiude       questa riscossione salda il conto? Allora l'acconto non
//                c'entra: quello che esce è lo scontrino finale
//                (REQ-STAMPA-001), e stamparli tutti e due vorrebbe dire
//                dare al cliente due carte per lo stesso incasso.
//   senzaStampa  «Riscuoti (senza stampa)»: il gesto dice che carta non
//                se ne vuole. Vale per QUALUNQUE carta.
//   colTasto     si è premuto il terzo tasto: è un gesto esplicito, e
//                stampa anche dove la stampa automatica di questo
//                terminale è spenta — come fa «Preconto».
//   autoStampa   la stampa automatica DI QUESTO TERMINALE
//                (`autoPrintScontrino`, impostazione del dispositivo).
//                L'opzione «a ogni riscossione» la rispetta: è carta che
//                esce da sola, e il telefono della sala che non stampa
//                gli scontrini non deve cominciare a stampare acconti.
export function accontoDaStampare({
  settings,
  chiude,
  senzaStampa = false,
  colTasto = false,
  autoStampa = false,
} = {}) {
  if (chiude || senzaStampa) return false
  if (colTasto) return tastoAcconto(settings)
  return accontoSempre(settings) && !!autoStampa
}
