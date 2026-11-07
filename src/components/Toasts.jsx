import { useEffect, useState } from 'react'
import { subscribeToasts, dismissToast } from '../lib/toast.js'
import { dividiIcona } from '../lib/icone.js'
import Icona from './Icona.jsx'

// Pila di notifiche IN APP: in basso a destra, sopra qualsiasi schermata
// (POS a tutto schermo compreso), tocco per chiudere.
//
// L'icona è del tema «Segnali e messaggi» (REQ-UI-031): quella chiesta,
// se no quella scritta in testa al messaggio (le pagine del cliente le
// scrivono ancora così), se no quella del tipo.
const KIND_ICON = {
  info: 'notifiche',
  sync: null, // spinner
  success: 'fatto',
  error: 'avviso',
}

function iconaETesto(t) {
  if (t.icona) return { nome: t.icona, resto: t.message }
  return dividiIcona(t.message) ?? { nome: KIND_ICON[t.kind] ?? 'notifiche', resto: t.message }
}

export default function Toasts() {
  const [toasts, setToasts] = useState([])
  useEffect(() => subscribeToasts(setToasts), [])
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => {
        const { nome, resto } = iconaETesto(t)
        return (
          <button
            key={t.id}
            type="button"
            className={`toast toast-${t.kind}`}
            onClick={() => dismissToast(t.id)}
          >
            {t.kind === 'sync' ? <span className="toast-spinner" aria-hidden /> : <Icona nome={nome} gruppo="segnali" />}
            <span>{resto}</span>
          </button>
        )
      })}
    </div>
  )
}
