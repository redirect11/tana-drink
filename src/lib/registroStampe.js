// ── IL REGISTRO DELLE STAMPE (REQ-STAMPA-017, BUG-098) ───────────────
//
// Flavio, 28/08/2026: «quando fanno la chiusura cassa, la stampante non
// stampa lo scontrino di chiusura molto spesso». Fin qui una stampa
// fallita non lasciava NIENTE: l'avviso viveva otto secondi in una
// striscia che compare insieme a quella verde «Cassa chiusa» — e con i
// toast che si accavallano (BUG-078) passa inosservata — mentre la
// risposta della stampante finiva in una riga di console che nessuno
// legge. Con una cassa che si chiude UNA VOLTA A NOTTE, così si va per
// tentativi per settimane.
//
// Qui c'è la traccia: cosa si è provato a stampare, quando, com'è andata
// e il motivo quando è andata male. Più lo stato della CODA — cosa è in
// corso e cosa aspetta — perché la seconda domanda che ci si fa davanti a
// una stampante muta è «si è impiantata?».
//
// TRE VINCOLI, e sono il motivo per cui questo file è fatto così:
//
// 1. NON CRESCE ALL'INFINITO. Sta in localStorage, che su iPadOS è
//    memoria che il browser può svuotare quando vuole: le ultime 50 voci
//    e basta. Cinquanta perché la voce che conta — la chiusura di cassa —
//    è l'ULTIMA stampa della serata, quindi non viene mai spinta fuori
//    dalle comande della sera dopo; e cinquanta righe stanno in pochi KB.
// 2. NIENTE DATI PERSONALI. La voce dice «Scontrino conto #42», mai il
//    nome del cliente né la mail di chi ha battuto. Un registro di
//    diagnostica non è il posto dove tenere i clienti del locale, e chi
//    ripara la stampante non ha motivo di leggerli.
// 3. NON RALLENTA LA STAMPA. Si scrive DI LATO: la voce entra in memoria
//    subito, il salvataggio in localStorage parte su un microtask. Il
//    percorso critico è la carta che esce, e un `JSON.stringify` non ci
//    si mette in mezzo.

const CHIAVE = 'tana:registro-stampe'

// Il tetto: vedi il punto 1 qui sopra.
export const TETTO_VOCI = 50

// Gli esiti, e cosa vogliono dire. `sconosciuta` NON è un fallimento: è
// il caso della stampante che stampa ma non conferma — vedi il commento
// sulla conferma in `printer.js`.
export const ESITO = {
  riuscita: 'riuscita',
  fallita: 'fallita',
  sconosciuta: 'sconosciuta',
}

export const ETICHETTA_ESITO = {
  riuscita: 'Stampata',
  fallita: 'Non stampata',
  sconosciuta: 'Esito non confermato',
}

let _voci = null
// La coda vive SOLO in memoria: «in corso» scritto su disco, dopo un
// ricaricamento, sarebbe una bugia — quel lavoro è morto con la pagina.
let _coda = []
let _prossimoId = 0
let _istantanea = null
const _ascoltatori = new Set()

function leggiDaMemoria() {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    const lette = grezzo ? JSON.parse(grezzo) : []
    return Array.isArray(lette) ? lette.filter((v) => v && typeof v === 'object') : []
  } catch {
    /* memoria negata o illeggibile: si riparte da un registro vuoto */
    return []
  }
}

function voci() {
  if (_voci === null) _voci = leggiDaMemoria()
  return _voci
}

// ── SI SCRIVE DI LATO ────────────────────────────────────────────────
// Un solo salvataggio per giro di eventi, su un microtask: chi ha chiesto
// la stampa non aspetta nemmeno la serializzazione.
let _salvataggioInVolo = false
function salvaDiLato() {
  if (_salvataggioInVolo) return
  _salvataggioInVolo = true
  Promise.resolve().then(() => {
    _salvataggioInVolo = false
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(_voci ?? []))
    } catch {
      /* memoria piena o negata: il registro vale per questa sessione */
    }
  })
}

function cambiato() {
  // L'istantanea si ricostruisce solo quando qualcosa è cambiato: chi
  // legge (useSyncExternalStore) confronta i riferimenti, e ricrearla a
  // ogni lettura sarebbe un ridisegno all'infinito.
  _istantanea = null
  for (const cb of _ascoltatori) {
    try {
      cb()
    } catch {
      /* un ascoltatore rotto non ferma gli altri */
    }
  }
}

// Quello che serve a chi disegna: la coda di adesso e le voci passate,
// dalla più recente.
export function statoRegistro() {
  if (!_istantanea) {
    _istantanea = {
      inCorso: _coda.find((l) => l.stato === 'in corso') || null,
      inAttesa: _coda.filter((l) => l.stato === 'in attesa'),
      voci: [...voci()].reverse(),
    }
  }
  return _istantanea
}

export function iscrivitiAlRegistro(cb) {
  _ascoltatori.add(cb)
  return () => _ascoltatori.delete(cb)
}

// ── LA VITA DI UN LAVORO ─────────────────────────────────────────────
// Tre momenti, chiamati da `lavoroDiStampa` in printer.js: entra in coda,
// parte, finisce. `che` è l'etichetta — senza dati personali dentro.

export function lavoroInCoda(che) {
  const id = `stampa-${++_prossimoId}`
  _coda = [..._coda, { id, che: String(che || 'Stampa'), stato: 'in attesa' }]
  cambiato()
  return id
}

export function lavoroPartito(id) {
  _coda = _coda.map((l) => (l.id === id ? { ...l, stato: 'in corso' } : l))
  cambiato()
}

// `tentativi` vale 2 quando si è ridato il foglio alla stampante dopo una
// risposta storta: è il numero che dice se il ritentativo è servito.
export function lavoroFinito(id, esito, motivo = '', tentativi = 1) {
  const lavoro = _coda.find((l) => l.id === id)
  _coda = _coda.filter((l) => l.id !== id)
  const elenco = voci()
  elenco.push({
    id,
    che: lavoro?.che || 'Stampa',
    quando: new Date().toISOString(),
    esito: ESITO[esito] || ESITO.sconosciuta,
    // Il motivo si taglia: è una frase, non un registro di sistema, e una
    // stringa lunga in localStorage la paga chi legge il pannello.
    motivo: String(motivo || '').slice(0, 200),
    tentativi,
  })
  // Il tetto si applica QUI e non alla lettura: quello che non entra non
  // deve nemmeno restare in memoria.
  if (elenco.length > TETTO_VOCI) elenco.splice(0, elenco.length - TETTO_VOCI)
  salvaDiLato()
  cambiato()
}

export function svuotaRegistro() {
  _voci = []
  salvaDiLato()
  cambiato()
}

// Solo per i test: la coda vive in un modulo, e ogni prova deve ripartire
// da un banco pulito anche senza `vi.resetModules()`.
export function dimenticaTuttoIlRegistro() {
  _voci = []
  _coda = []
  _prossimoId = 0
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    /* niente memoria: non c'era niente da togliere */
  }
  cambiato()
}
