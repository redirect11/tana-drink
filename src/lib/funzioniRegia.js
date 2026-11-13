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

// Venti secondi al massimo, per ogni chiamata alla regia: un `fetch` senza
// rete può restare appeso molto più a lungo.
export const ATTESA_REGIA_MS = 20000

// Una lettura pubblica (cataloghi, listini): il corpo JSON, o null senza
// indirizzo, senza rete, con una risposta che non è 200.
export async function leggiDallaRegia(url, prendi = globalThis.fetch) {
  if (!url || typeof prendi !== 'function') return null
  const ferma = new AbortController()
  const timer = setTimeout(() => ferma.abort(), ATTESA_REGIA_MS)
  try {
    const r = await prendi(url, { signal: ferma.signal })
    return r.ok ? await r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// UNA POST ALLA REGIA con l'attesa massima: { status, corpo }, con status 0
// senza rete o dopo l'attesa (e in `errore` il perché, per la console). Una sola, per tutte le chiamate che mandano
// qualcosa alla regia (il passaggio, REQ-FLOTTA-030; quelle col token del
// titolare, api.js): erano tre copie dello stesso giro, e una correzione
// all'attesa o alla lettura del corpo non arrivava alle altre.
export async function postaAllaRegia(url, { corpo, intestazioni = {}, prendi = globalThis.fetch } = {}) {
  const ferma = new AbortController()
  const timer = setTimeout(() => ferma.abort(), ATTESA_REGIA_MS)
  try {
    const r = await prendi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...intestazioni },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: ferma.signal,
    })
    return { status: r.status, corpo: await r.json().catch(() => null) }
  } catch (e) {
    return { status: 0, corpo: null, errore: e?.message || String(e) }
  } finally {
    clearTimeout(timer)
  }
}

// Un catalogo della regia letto adesso e ricordato sul dispositivo: le voci
// già interpretate, o null se non si è letto (allora chi chiama mostra
// l'ultimo ricordato). Lo schema dei temi e del listino dei moduli.
export async function scaricaERicorda(url, interpreta, ricorda, prendi) {
  const corpo = await leggiDallaRegia(url, prendi)
  if (corpo === null) return null
  const voci = interpreta(corpo)
  ricorda(voci)
  return voci
}

// Il testo di un rifiuto, come lo scrive la regia (italiano, da mostrare
// com'è), o null se non c'è: allora chi chiama dice una frase sua.
export const erroreDellaRegia = (corpo) =>
  typeof corpo?.errore === 'string' && corpo.errore.trim() ? corpo.errore.trim() : null
