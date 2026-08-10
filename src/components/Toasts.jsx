import { useEffect, useState } from 'react'
import { subscribeToasts, dismissToast } from '../lib/toast.js'

// Pila di notifiche IN APP: in basso a destra, sopra qualsiasi schermata
// (POS a tutto schermo compreso), tocco per chiudere.
const KIND_ICON = {
  info: '🔔',
  sync: null, // spinner
  success: '✅',
  error: '⚠️',
}

export default function Toasts() {
  const [toasts, setToasts] = useState([])
  useEffect(() => subscribeToasts(setToasts), [])
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast-${t.kind}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.kind === 'sync' ? (
            <span className="toast-spinner" aria-hidden />
          ) : (
            <span aria-hidden>{KIND_ICON[t.kind] ?? '🔔'}</span>
          )}
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  )
}
