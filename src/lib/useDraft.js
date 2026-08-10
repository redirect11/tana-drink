import { useCallback, useEffect, useRef, useState } from 'react'

// BOZZA PERSISTENTE del POS: le righe non ancora confermate ("DA
// AGGIUNGERE") non si perdono uscendo dalla schermata — rientrando si
// riprende dov'era. Persistita in localStorage con una chiave per
// contesto: 'new' in creazione, l'id dell'ordine in modifica. Confermare
// (o annullare) svuota la bozza di quella chiave.

const storageKey = (k) => `tana:draft:${k}`

export function loadDraft(k) {
  try {
    const raw = localStorage.getItem(storageKey(k))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveDraft(k, arr) {
  try {
    if (!arr || arr.length === 0) localStorage.removeItem(storageKey(k))
    else localStorage.setItem(storageKey(k), JSON.stringify(arr))
  } catch {
    /* quota piena / modalità privata: la bozza resta comunque in memoria */
  }
}

// ORDINE VISIVO della lista unica (item confermati + bozza), riordinabile a
// mano: persistito per contesto così il riordino di TUTTI gli item non si
// perde uscendo dalla schermata. Array di chiavi riga.
const layoutKey = (k) => `tana:layout:${k}`

export function loadLayout(k) {
  try {
    const raw = localStorage.getItem(layoutKey(k))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveLayout(k, arr) {
  try {
    if (!arr || arr.length === 0) localStorage.removeItem(layoutKey(k))
    else localStorage.setItem(layoutKey(k), JSON.stringify(arr))
  } catch {
    /* best-effort */
  }
}

// Ritorna [draft, setDraft, clearDraft]. `setDraft` accetta un valore o un
// updater (come useState) e persiste. Cambiando `key` (es. si passa da un
// ordine a un altro) ricarica la bozza di quella chiave.
export function useDraft(key) {
  const [draft, setDraftState] = useState(() => loadDraft(key))
  const keyRef = useRef(key)
  // Valore corrente sempre aggiornato: serve a calcolare il prossimo stato
  // SENZA affidarsi all'updater di React (vedi sotto).
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key
      const loaded = loadDraft(key)
      draftRef.current = loaded
      setDraftState(loaded)
    }
  }, [key])

  // Il salvataggio avviene SUBITO, non dentro l'updater di stato: chi
  // conferma un ordine svuota la bozza e naviga via nello stesso giro, e
  // React scarterebbe l'aggiornamento del componente ormai smontato —
  // lasciando gli item in localStorage per la volta dopo.
  const setDraft = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(draftRef.current) : updater
    draftRef.current = next
    saveDraft(keyRef.current, next)
    setDraftState(next)
  }, [])

  const clearDraft = useCallback(() => setDraft([]), [setDraft])

  return [draft, setDraft, clearDraft]
}
