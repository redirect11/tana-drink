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
const CHIAVE_CASSA = 'tana:cassa-aperta'

// Quello che dice il server (aggiornato dagli ascolti).
//
// E FINCHÉ NON L'HA DETTO? Qui c'era `null`, e `null` non vuol dire «la
// cassa è chiusa»: vuol dire «non lo so ancora». Ma il conto lo prendeva
// per una risposta e si numerava sul contatore della GIORNATA invece che su
// quello della serata — due contatori indipendenti, che nella stessa sera
// danno benissimo lo stesso #5. È così che al banco sono comparsi due
// ordini #5 (BUG-074), col secondo per giunta fuori dalla serata di cassa
// (`cash_session_id: null`), quindi invisibile alla chiusura.
//
// La finestra si apre a ogni ricaricamento della pagina: gli ascolti
// ripartono da capo e per qualche istante non hanno ancora risposto.
// Aspettarli sarebbe il contrario di tutto questo file, quindi ci si
// RICORDA l'ultima cassa che si sapeva aperta — come già si fa coi numeri
// assegnati. Vale solo per la giornata commerciale in cui è stata scritta:
// una memoria di ieri non è una risposta, è un'altra serata.
let sessioneCassa = leggiCassa()
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

// La cassa si ricorda insieme alla giornata in cui la si è vista aperta:
// è il modo esatto di dire «questa memoria vale per stasera». Il taglio è
// quello di sempre (le impostazioni del locale non si sanno da qui: al
// massimo la memoria scade qualche ora prima o dopo, e allora si ricade sul
// comportamento di prima).
function leggiCassa() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_CASSA) || 'null')
    if (!v || v.giorno !== businessDayKey(new Date(), DEFAULT_CUTOFF_HOUR)) return null
    return v.id ?? null
  } catch {
    return null
  }
}

function salvaCassa(id) {
  try {
    if (id) {
      localStorage.setItem(
        CHIAVE_CASSA,
        JSON.stringify({ id, giorno: businessDayKey(new Date(), DEFAULT_CUTOFF_HOUR) })
      )
    } else {
      // Il server dice che non c'è nessuna cassa aperta: è una risposta, e
      // cancella la memoria. Altrimenti un conto battuto a cassa chiusa
      // finirebbe nella serata di prima.
      localStorage.removeItem(CHIAVE_CASSA)
    }
  } catch {
    /* niente memoria: si torna a scoprire la cassa a ogni ricarico */
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
  // Se ci si ricorda la cassa di stasera si comincia subito a seguire il suo
  // contatore: il numero dev'esserci già quando arriva il primo conto.
  if (sessioneCassa) ascolta(`cash-${sessioneCassa}`)
  // Il puntatore alla cassa aperta è pubblico: lo leggono anche gli ordini
  // dei clienti, che devono prendere il progressivo della stessa serata.
  onSnapshot(
    doc(db, 'counters', '_active_cash'),
    (snap) => {
      sessioneCassa = snap.exists() ? snap.data().session_id ?? null : null
      salvaCassa(sessioneCassa)
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

// CHE NUMERO AVRÀ il prossimo conto, senza prenderlo: serve al POS per
// scrivere «#21» in cima appena si apre, prima ancora del primo prodotto.
export function numeroPrevisto(idContatore) {
  ascolta(idContatore)
  return prossimo(dalServer.get(idContatore), assegnati[idContatore])
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
  salvaCassa(null)
  dalServer.clear()
  ascoltati.clear()
  assegnati = {}
  avviato = false
  salvaAssegnati()
}

// Solo per i test: rifà l'avvio del modulo, come un ricaricamento della
// pagina — la memoria locale resta, gli ascolti no.
export function _ricaricaProgressivi() {
  dalServer.clear()
  ascoltati.clear()
  avviato = false
  assegnati = leggiAssegnati()
  sessioneCassa = leggiCassa()
}

// Solo per i test: finge quello che direbbero gli ascolti.
export function _fingiServer({ sessione, contatori = {} } = {}) {
  if (sessione !== undefined) {
    sessioneCassa = sessione
    salvaCassa(sessione)
  }
  for (const [k, v] of Object.entries(contatori)) dalServer.set(k, v)
}
