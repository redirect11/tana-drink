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

// Ritorna [draft, setDraft, clearDraft]. `setDraft` accetta un valore o un
// updater (come useState) e persiste. Cambiando `key` (es. si passa da un
// ordine a un altro) ricarica la bozza di quella chiave.
export function useDraft(key) {
  const [draft, setDraftState] = useState(() => loadDraft(key))
  const keyRef = useRef(key)

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key
      setDraftState(loadDraft(key))
    }
  }, [key])

  const setDraft = useCallback((updater) => {
    setDraftState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveDraft(keyRef.current, next)
      return next
    })
  }, [])

  const clearDraft = useCallback(() => setDraft([]), [setDraft])

  return [draft, setDraft, clearDraft]
}
