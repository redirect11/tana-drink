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

import { impostazioniRicordate } from './impostazioniLocali.js'

export const STILI_AVVISI = ['toast', 'fumetto']

export function stileAvvisiInApp(impostazioni) {
  const s = impostazioni || impostazioniRicordate({})
  return s?.avvisi_in_app === 'fumetto' ? 'fumetto' : 'toast'
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
