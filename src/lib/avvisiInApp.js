// ── COME SI VEDONO GLI AVVISI DENTRO L'APP ───────────────────────────
//
// Due modi, e li sceglie il locale:
//
//   'toast'   — la strisciolina che compare in alto, su QUALUNQUE
//               schermata. Non si perde, ma interrompe: arriva mentre stai
//               battendo un conto o contando la cassa.
//   'fumetto' — un fumetto che esce dalla campanella, SOLO nella coda
//               ordini. Chi sta alla cassa o in magazzino non viene
//               disturbato; chi guarda la coda — che è dove si aspettano
//               gli ordini — lo vede subito e toccandolo apre gli avvisi.
//
// Perché sta qui e non nelle impostazioni lette da React: gli avvisi
// arrivano da lib/notify.js, che non è un componente e non ha accesso alle
// impostazioni. Si legge la copia locale dell'ultima risposta del server
// (lib/impostazioniLocali.js), che è già lì per non far lampeggiare le
// schermate al primo disegno.

// È UNA PREFERENZA DEL DISPOSITIVO, come tutti gli altri avvisi: il tablet
// del banco e il telefono in sala vogliono cose diverse anche con lo stesso
// accesso. Sta nel PROFILO, accanto a «quali avvisi ricevere», che è dove
// chi lavora li va a cercare — non nelle impostazioni del locale, dove
// nessuno andrebbe a cercare una cosa sua.

const CHIAVE = 'tana:avvisi-stile'
export const STILI_AVVISI = ['toast', 'fumetto']

export function stileAvvisiInApp() {
  try {
    return localStorage.getItem(CHIAVE) === 'fumetto' ? 'fumetto' : 'toast'
  } catch {
    return 'toast'
  }
}

// Chi cambia lo stile lo dice a chi sta guardando (il pannello del
// profilo), così l'anteprima è immediata.
const subs = new Set()

export function scegliStileAvvisi(stile) {
  const valido = STILI_AVVISI.includes(stile) ? stile : 'toast'
  try {
    localStorage.setItem(CHIAVE, valido)
  } catch {
    /* niente memoria: vale per questa sessione */
  }
  subs.forEach((f) => f(valido))
  return valido
}

export function subscribeStileAvvisi(fn) {
  subs.add(fn)
  fn(stileAvvisiInApp())
  return () => subs.delete(fn)
}

// Il fumetto: chi lo disegna sta nella coda (FumettoAvvisi), chi lo
// annuncia è notify.js. In mezzo, un evento — l'unico modo perché una
// libreria senza React possa parlare a una schermata.
const EVENTO = 'tana:avviso-fumetto'

export function annunciaFumetto(avviso) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: avviso }))
}

export function ascoltaFumetto(fn) {
  if (typeof window === 'undefined') return () => {}
  const h = (e) => fn(e.detail)
  window.addEventListener(EVENTO, h)
  return () => window.removeEventListener(EVENTO, h)
}
