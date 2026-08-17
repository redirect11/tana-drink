// ── I NUMERI DEGLI ORDINI, SENZA ASPETTARE NESSUNO ───────────────────
//
// Battere un conto non deve aspettare la rete. Prima di scrivere l'ordine
// si facevano TRE letture al server — quale cassa è aperta, il progressivo
// della serata, il progressivo assoluto — e solo dopo l'ordine compariva a
// schermo: da qui il mezzo secondo (o i due secondi, con la linea del
// locale) fra «Conferma» e il conto che appare.
//
// E soprattutto: due creazioni ravvicinate leggevano lo stesso numero,
// perché la scrittura del contatore parte in sottofondo e la lettura
// successiva trovava ancora il valore vecchio. È così che sono nati due
// conti #15 nella stessa serata.
//
// Qui i numeri stanno IN MEMORIA, tenuti aggiornati da tre ascolti che
// partono all'avvio dell'app: quando serve un numero non si chiede niente a
// nessuno, si legge quello che si ha già.
//
// E ci si RICORDA cosa si è assegnato: il prossimo numero è il più grande
// fra quello del server e l'ultimo dato da questo dispositivo, più uno. Due
// conti di fila non possono più prendere lo stesso numero, nemmeno se la
// scrittura del contatore è ancora per strada — che è esattamente il caso
// che è successo al banco.
//
// Resta un caso che questo non copre: due DISPOSITIVI diversi che battono
// nello stesso istante possono ancora leggere lo stesso numero. Per
// escluderlo servirebbe una transazione, cioè aspettare il server a ogni
// ordine — il contrario di quello che serve al banco. Il contatore si
// scrive con un incremento, che non torna mai indietro, e gli ascolti
// allineano i dispositivi in un attimo.

import { doc, onSnapshot, setDoc, increment } from 'firebase/firestore'
import { db } from './firebaseClient.js'
import { businessDayKey, DEFAULT_CUTOFF_HOUR } from './businessDay.js'

const CHIAVE = 'tana:progressivi'

// Quello che dice il server (aggiornato dagli ascolti).
let sessioneCassa = null
const dalServer = new Map() // id contatore -> last

// Quello che ha assegnato QUESTO dispositivo, anche se la scrittura non è
// ancora arrivata. Sopravvive a un ricaricamento: senza, riaprendo l'app si
// ricomincerebbe dal numero del server e si rifarebbero i doppioni.
let assegnati = leggiAssegnati()

function leggiAssegnati() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function salvaAssegnati() {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(assegnati))
  } catch {
    /* niente memoria: si ricade sul valore del server, come prima */
  }
}

// LA REGOLA, in una riga: il più grande fra i due, più uno.
export function prossimo(server, assegnato) {
  return Math.max(Number(server) || 0, Number(assegnato) || 0) + 1
}

let avviato = false

// Si chiama una volta all'avvio: da lì in poi i numeri ci sono già.
export function avviaProgressivi() {
  if (avviato) return
  avviato = true
  ascolta('serial')
  // Il puntatore alla cassa aperta è pubblico: lo leggono anche gli ordini
  // dei clienti, che devono prendere il progressivo della stessa serata.
  onSnapshot(
    doc(db, 'counters', '_active_cash'),
    (snap) => {
      sessioneCassa = snap.exists() ? snap.data().session_id ?? null : null
      if (sessioneCassa) ascolta(`cash-${sessioneCassa}`)
    },
    () => {}
  )
}

const ascoltati = new Set()
function ascolta(id) {
  if (ascoltati.has(id)) return
  ascoltati.add(id)
  onSnapshot(
    doc(db, 'counters', id),
    (snap) => dalServer.set(id, snap.exists() ? snap.data().last || 0 : 0),
    () => {}
  )
}

export function cassaCorrente() {
  return sessioneCassa
}

// Il contatore da usare: quello della serata se la cassa è aperta, quello
// della giornata altrimenti (com'era prima che la cassa esistesse).
export function contatoreCorrente(cutoffHour = DEFAULT_CUTOFF_HOUR) {
  return sessioneCassa ? `cash-${sessioneCassa}` : businessDayKey(new Date(), cutoffHour)
}

// IL NUMERO, SUBITO. Nessuna attesa: si legge quello che si ha, si segna
// che è stato dato, e la scrittura del contatore parte per conto suo.
export function prendiNumero(idContatore) {
  ascolta(idContatore) // se è la prima volta, da qui in poi lo si segue
  const n = prossimo(dalServer.get(idContatore), assegnati[idContatore])
  assegnati[idContatore] = n
  salvaAssegnati()
  // Incremento, non «scrivi n»: due dispositivi che battono insieme non si
  // sovrascrivono il contatore a vicenda, e il numero non torna mai indietro.
  setDoc(doc(db, 'counters', idContatore), { last: increment(1) }, { merge: true }).catch(() => {})
  return n
}

// Solo per i test: azzera lo stato del modulo.
export function _azzeraProgressivi() {
  sessioneCassa = null
  dalServer.clear()
  ascoltati.clear()
  assegnati = {}
  avviato = false
  salvaAssegnati()
}

// Solo per i test: finge quello che direbbero gli ascolti.
export function _fingiServer({ sessione, contatori = {} } = {}) {
  if (sessione !== undefined) sessioneCassa = sessione
  for (const [k, v] of Object.entries(contatori)) dalServer.set(k, v)
}
