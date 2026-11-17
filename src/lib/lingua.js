// ── I TESTI IN DUE LINGUE (REQ-UI-038) ──────────────────────────────
//
// Daniele, 17/11/2026: «da oggi tutte le funzioni dovranno avere testi in
// italiano ed inglese». Il testo si scrive in ITALIANO, dove serve, e passa
// da `tr`: l'italiano è la lingua di partenza e fa anche da chiave del
// dizionario inglese (lib/testi/en/). Così il codice si legge come prima,
// i test che cercano le parole italiane restano validi, e una traduzione
// che manca non rompe niente: si vede l'italiano.
//
// Perché non una libreria (i18next e simili): servono due lingue, un
// dizionario e i segnaposti, e la regola che conta — nessun testo senza la
// sua traduzione — la fa la prova in tests/unit/lingua.test.js, che legge i
// sorgenti. Le chiavi astratte («order.status.ready») avrebbero obbligato a
// riscrivere ogni testo e ogni test per niente.
//
// LE REGOLE PER CHI SCRIVE:
//   · `tr('testo')` con un testo SCRITTO LÌ, fra apici, e niente altro come
//     primo argomento: la prova li legge dai sorgenti, e un testo calcolato
//     (o attaccato con un +) non lo vedrebbe mai;
//   · i valori variabili sono segnaposti, coi nomi SENZA accenti:
//     `tr('Ordine #{n}', { n })`;
//   · una parola con più significati porta il suo CONTESTO davanti, con una
//     barra: `tr('ordinamento|Ordine')` — in italiano si legge «Ordine», e
//     l'inglese può dire «Sort» invece di «Order»;
//   · i PLURALI si scrivono tutti e due, anche dove l'italiano non cambia,
//     perché l'inglese li forma in un altro modo:
//     `n === 1 ? tr('Un drink') : tr('{n} drink', { n })` — «One drink»,
//     «{n} drinks»;
//   · le TABELLE di etichette (stati, frasi) non chiamano `tr` quando il
//     modulo si carica — fisserebbero la lingua per sempre: segnano il testo
//     con `daTradurre('…')` e lo traducono dove lo mostrano, con `trSegnato`;
//   · ogni testo nuovo porta la sua riga nel dizionario inglese della sua
//     area (lib/testi/en/), nello stesso commit.
//
// La lingua vale per il DISPOSITIVO (si ricorda qui, come le altre scelte
// di chi lavora); chi la sceglie e dove si decide in REQ-UI-039. Le pagine
// dei clienti non la seguono: le traduce il browser (REQ-CLI-010).

import { useSyncExternalStore } from 'react'
import en from './testi/en/index.js'

export const LINGUE = Object.freeze({ it: 'Italiano', en: 'English' })
export const LINGUA_DI_PARTENZA = 'it'

const DIZIONARI = { en }
const CHIAVE = 'drink:lingua'
const ascoltatori = new Set()

function letta() {
  try {
    const v = localStorage.getItem(CHIAVE)
    return v && Object.hasOwn(LINGUE, v) ? v : LINGUA_DI_PARTENZA
  } catch {
    return LINGUA_DI_PARTENZA
  }
}

let attiva = letta()

export const linguaAttiva = () => attiva

// ── LE PAGINE DEI CLIENTI RESTANO IN ITALIANO (REQ-CLI-010) ──────────
//
// La lingua scelta è di chi LAVORA. Le pagine dei clienti — il menù, lo
// stato dell'ordine, «Mostra al cliente» sul tablet girato verso di lui —
// sono scritte in italiano e le traduce il browser di chi le guarda: un
// tablet dello staff in inglese non deve mostrargliele in inglese a pezzi
// («Served» in mezzo all'italiano, con la pagina dichiarata «it»). E i
// componenti sono gli stessi nei due mondi (la barra in alto, i dialoghi,
// le etichette di src/lib): non è il componente a sapere dove si trova.
// Lo sa l'app, che lo dice qui a ogni disegno (App.jsx); su una pagina
// dei clienti `tr` risponde in italiano, qualunque sia la lingua scelta.
let suPaginaCliente = false
export function impostaPaginaCliente(si) {
  suPaginaCliente = !!si
}
// La lingua che si vede adesso: quella scelta, o l'italiano dei clienti.
export const linguaInUso = () => (suPaginaCliente ? LINGUA_DI_PARTENZA : attiva)

// IL FORMATO DI DATE E GIORNI nella lingua in uso («lunedì 17 novembre» /
// «Monday 17 November»), per toLocaleDateString e simili. Inglese
// britannico: il giorno prima del mese, come in Italia. Gli IMPORTI no:
// formatPrice resta «7,00 €», come sugli scontrini (REQ-UI-039).
const FORMATI = { it: 'it-IT', en: 'en-GB' }
export const formatoAttivo = () => FORMATI[linguaInUso()] || FORMATI[LINGUA_DI_PARTENZA]

export function impostaLingua(lingua) {
  if (!Object.hasOwn(LINGUE, lingua) || lingua === attiva) return
  attiva = lingua
  try {
    localStorage.setItem(CHIAVE, lingua)
  } catch {
    /* senza memoria vale finché la pagina resta aperta */
  }
  ascoltatori.forEach((f) => f())
}

// I segnaposti: lettere e cifre senza accenti, come nelle regole qui sopra.
export const SEGNAPOSTO = /\{([A-Za-z0-9_]+)\}/g

// Il testo nella lingua attiva. Senza traduzione resta l'italiano: meglio
// una parola nella lingua sbagliata che un buco a schermo. Si cerca solo fra
// le righe VERE del dizionario: «constructor» o «toString» sono anche nomi
// di ogni oggetto JavaScript, e restituivano una funzione.
export function tr(chiave, valori) {
  return traduci(chiave, valori)
}

function traduci(chiave, valori) {
  const lingua = linguaInUso()
  const dizionario = lingua !== LINGUA_DI_PARTENZA ? DIZIONARI[lingua] : null
  const tradotto = dizionario && Object.hasOwn(dizionario, chiave) ? dizionario[chiave] : italianoDi(chiave)
  if (!valori) return tradotto
  return tradotto.replace(SEGNAPOSTO, (segnaposto, nome) =>
    Object.hasOwn(valori, nome) ? String(valori[nome]) : segnaposto
  )
}

// «contesto|testo»: in italiano si legge il testo, senza il contesto.
function italianoDi(chiave) {
  const barra = chiave.indexOf('|')
  return barra < 0 ? chiave : chiave.slice(barra + 1)
}

// Un testo da tradurre più tardi, dove si mostra: non fa niente, se
// non dire alla prova che quel testo è una chiave del dizionario.
export const daTradurre = (testo) => testo

// Traduce un testo segnato altrove con `daTradurre` (una tabella di etichette).
// È l'unico `tr` che accetta un valore calcolato: la prova controlla le
// chiavi dove nascono, nei `daTradurre`.
export const trSegnato = (chiave, valori) => (chiave == null ? chiave : traduci(chiave, valori))

// Chi deve sapere che la lingua è cambiata (i componenti, via useLingua).
export function ascoltaLingua(f) {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}

// Per i componenti: si ridisegnano quando la lingua cambia.
export function useLingua() {
  return useSyncExternalStore(ascoltaLingua, linguaAttiva, linguaAttiva)
}
