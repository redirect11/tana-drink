// Stato di SINCRONIZZAZIONE delle scritture in background.
//
// L'app è local-first: le modifiche a ordini/pagamenti/comande entrano subito
// in cache (UI immediata, anche offline) e si sincronizzano col server dopo,
// in sottofondo. Questo modulo tiene traccia di quelle scritture per mostrare
// un indicatore (idle / in corso / sincronizzato / errore) e poter RIPETERE
// la sincronizzazione dell'ultima modifica o di tutte quelle fallite.
//
// Nota Firestore: la Promise di una write si risolve solo dopo l'ACK del
// server; offline resta pendente (stato "in corso") e si completa al ritorno
// della rete. Un rifiuto reale (permessi, dati) arriva come errore.

let pending = 0
let failed = [] // { run, label, error, at }
let phase = 'idle' // 'idle' | 'syncing' | 'synced' | 'error'
let syncedTimer = null
const subs = new Set()

function snapshot() {
  return {
    phase,
    pending,
    failedCount: failed.length,
    lastError: failed.length ? failed[failed.length - 1].error : null,
  }
}
const emit = () => {
  const s = snapshot()
  subs.forEach((f) => f(s))
}

export function subscribeSync(fn) {
  subs.add(fn)
  fn(snapshot())
  return () => subs.delete(fn)
}

export function syncStatus() {
  return snapshot()
}

function settle() {
  if (failed.length) {
    phase = 'error'
    emit()
    return
  }
  if (pending > 0) {
    phase = 'syncing'
    emit()
    return
  }
  // Tutto sincronizzato: mostra "synced" un istante, poi torna idle.
  phase = 'synced'
  emit()
  clearTimeout(syncedTimer)
  syncedTimer = setTimeout(() => {
    if (pending === 0 && failed.length === 0) {
      phase = 'idle'
      emit()
    }
  }, 1500)
}

// Esegue una scrittura in BACKGROUND tracciandone lo stato. `run` è una
// funzione che ritorna la Promise della write Firestore. La cache è già
// aggiornata dal chiamante: qui si segue solo la sincronizzazione.
export function bgWrite(run, label = '') {
  pending += 1
  if (phase !== 'error') {
    phase = 'syncing'
    emit()
  } else {
    emit()
  }
  Promise.resolve()
    .then(run)
    .then(
      () => {
        pending -= 1
        settle()
      },
      (err) => {
        pending -= 1
        failed.push({ run, label, error: err?.message || String(err), at: Date.now() })
        settle()
      }
    )
}

// Ripete tutte le sincronizzazioni fallite.
export function retryAllSync() {
  const items = failed
  failed = []
  if (items.length === 0) {
    settle()
    return
  }
  for (const it of items) bgWrite(it.run, it.label)
}

// Ripete solo l'ultima sincronizzazione fallita.
export function retryLastSync() {
  const it = failed.pop()
  if (it) bgWrite(it.run, it.label)
  else settle()
}
