// ORDINI APPENA CHIUSI, NASCOSTI SUBITO.
//
// Chiudendo o annullando un conto si torna alla coda, e lì il conto c'era
// ancora: compariva per un attimo e poi spariva da solo. Non è un difetto
// di grafica — è che la scrittura sul database parte in sottofondo e la
// coda, in quell'istante, ha ancora la versione di prima. Ma chi guarda
// non lo sa: vede un conto che doveva essere chiuso, e per un secondo si
// chiede se l'operazione sia andata.
//
// Qui si tiene l'elenco dei conti chiusi da QUESTO dispositivo: la coda li
// toglie all'istante, senza aspettare la conferma. Quando il dato vero
// arriva, l'ordine è chiuso davvero e sparisce per i fatti suoi; la voce
// qui dentro scade da sé, così un conto riaperto (o una scrittura fallita)
// torna visibile invece di restare nascosto per sempre.

const DURATA = 60_000 // un minuto: il tempo che la scrittura arrivi, non di più

const nascosti = new Map() // id -> scadenza (ms)
const ascoltatori = new Set()

const avvisa = () => ascoltatori.forEach((f) => f(elencoNascosti()))

function pulisci(ora = Date.now()) {
  let cambiato = false
  for (const [id, scadenza] of nascosti) {
    if (scadenza <= ora) {
      nascosti.delete(id)
      cambiato = true
    }
  }
  return cambiato
}

// Nasconde un ordine dalla coda, subito.
export function nascondiOrdine(id, durata = DURATA) {
  if (!id) return
  nascosti.set(id, Date.now() + durata)
  avvisa()
  // Alla scadenza si riavvisa: se per qualche motivo l'ordine è ancora
  // aperto deve ricomparire, non restare invisibile.
  setTimeout(() => {
    if (pulisci()) avvisa()
  }, durata + 50)
}

// Lo si è nascosto e ora non serve più (es. l'ordine è tornato aperto).
export function mostraOrdine(id) {
  if (nascosti.delete(id)) avvisa()
}

export function ordineNascosto(id) {
  const scadenza = nascosti.get(id)
  if (!scadenza) return false
  if (scadenza <= Date.now()) {
    nascosti.delete(id)
    return false
  }
  return true
}

export function elencoNascosti() {
  pulisci()
  return [...nascosti.keys()]
}

// Toglie dalla lista i conti appena chiusi qui.
//
// MA NASCONDERE UN CONTO NON VUOL DIRE NASCONDERE IL SUO LAVORO. Incassando
// un conto con dei drink ancora da fare, quello spariva dalla coda e con
// lui le sue comande: al banco i drink appena pagati si volatilizzavano, e
// ricaricando la pagina tornavano — perché questo elenco vive in memoria e
// il ricaricamento lo azzera. Chi chiama passa cosa TENERE comunque
// (`tieni`): la regola è del dominio, non di questo cassetto.
export function senzaNascosti(ordini, tieni = () => false) {
  if (!nascosti.size) return ordini
  return ordini.filter((o) => !ordineNascosto(o.id) || tieni(o))
}

export function subscribeNascosti(cb) {
  ascoltatori.add(cb)
  cb(elencoNascosti())
  return () => ascoltatori.delete(cb)
}
