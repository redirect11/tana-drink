// ── LE FUNCTIONS DELLA REGIA, VISTE DALL'APP ──────────────────────────
// Presentazione, catalogo dei temi, listino e acquisto dei moduli: ognuna è
// una Function della regia scritta nella build (VITE_REGIA_PROGETTO). Solo i
// due progetti della regia, per intero (il perché è in aggiornamenti.js,
// PROGETTI_REGIA): un progetto qualunque nella build non diventa un
// indirizzo a cui l'app manda il token del titolare.

import { PROGETTI_REGIA } from './aggiornamenti.js'

// La regione delle Functions della regia (il contratto).
const REGIONE = 'europe-west1'

export function urlFunzioneRegia(nome, progetto = import.meta.env?.VITE_REGIA_PROGETTO) {
  return PROGETTI_REGIA.includes(progetto) ? `https://${REGIONE}-${progetto}.cloudfunctions.net/${nome}` : null
}

// Una lettura pubblica (cataloghi, listini): il corpo JSON, o null senza
// indirizzo, senza rete, con una risposta che non è 200. Venti secondi al
// massimo: un `fetch` senza rete può restare appeso molto più a lungo.
const ATTESA_MS = 20000
export async function leggiDallaRegia(url, prendi = globalThis.fetch) {
  if (!url || typeof prendi !== 'function') return null
  const ferma = new AbortController()
  const timer = setTimeout(() => ferma.abort(), ATTESA_MS)
  try {
    const r = await prendi(url, { signal: ferma.signal })
    return r.ok ? await r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
