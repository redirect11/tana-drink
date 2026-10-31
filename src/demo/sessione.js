// ── LA SESSIONE DELLA DEMO: UNA CACHE PER GIORNATA, E «RICOMINCIA DA CAPO» ──
// (REQ-FLOTTA-019)
//
// Nella demo tutto quello che fa chi prova sta nella cache di Firestore del
// suo browser, e lì resta: ricaricando la pagina ritrova il suo lavoro. Per
// ripartire dai dati di prova la cache va buttata. Svuotarla con
// `clearIndexedDbPersistence` si può solo PRIMA che Firestore parta, e in
// questa app parte appena caricato il modulo: qui invece si cambia cache.
//
// La cache di Firestore ha il nome dell'app Firebase. La demo apre l'app
// con un nome di sessione, `demo-<giornata>-<n>`:
//   - una giornata nuova è una sessione nuova: i dati di prova si generano
//     relativi a oggi, e i conti «aperti» di ieri non restano aperti per
//     sempre;
//   - «Ricomincia da capo» passa al numero dopo e ricarica la pagina: si
//     riparte da una cache vuota, coi dati di prova di oggi.
// Le cache delle sessioni vecchie si cancellano dopo, quando nessuno le usa.
//
// È codice della sola demo: lo usano i rami `if (__DEMO__)`, e nella build
// di un locale vero sparisce.

import { businessDayKey } from '../lib/businessDay.js'

const CHIAVE = 'drink:demo-sessione'

function leggi() {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE) || 'null')
  } catch {
    return null
  }
}

function scrivi(s) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(s))
  } catch {
    /* senza memoria la sessione vive finché la pagina resta aperta */
  }
}

export const giornataDemo = (adesso = new Date()) => businessDayKey(adesso)

// Il nome dell'app Firebase, cioè della cache, per questa visita.
export function nomeSessione(adesso = new Date()) {
  const giornata = giornataDemo(adesso)
  const s = leggi()
  const n = s && s.giornata === giornata && Number.isInteger(s.n) && s.n > 0 ? s.n : 1
  scrivi({ giornata, n })
  return `demo-${giornata}-${n}`
}

// «Ricomincia da capo»: la prossima visita apre una cache nuova.
export function prossimaSessione(adesso = new Date()) {
  const giornata = giornataDemo(adesso)
  const s = leggi()
  const n = s && s.giornata === giornata && Number.isInteger(s.n) ? s.n + 1 : 2
  scrivi({ giornata, n })
  return `demo-${giornata}-${n}`
}

// Le cache delle sessioni passate, da buttare: tutti i database di
// Firestore con un nome di sessione demo diverso da quello in uso.
export function cacheDaButtare(nomiDatabase, sessioneInUso) {
  return nomiDatabase.filter((nome) => /^firestore\/demo-\d{4}-\d{2}-\d{2}-\d+\//.test(nome) && !nome.startsWith(`firestore/${sessioneInUso}/`))
}

export async function butta(sessioneInUso) {
  try {
    if (!indexedDB?.databases) return
    const nomi = (await indexedDB.databases()).map((d) => d.name).filter(Boolean)
    for (const nome of cacheDaButtare(nomi, sessioneInUso)) indexedDB.deleteDatabase(nome)
  } catch {
    /* non riuscire a pulire non toglie niente a chi prova */
  }
}
