import { useEffect, useState } from 'react'
import Changelog from './Changelog.jsx'
import { sezioneChangelog } from '../lib/novita.js'

// ── COSA È CAMBIATO, subito dopo un aggiornamento ────────────────────
// Si tocca «Nuova versione disponibile», la pagina si ricarica e ci si
// ritrova con qualcosa spostato di posto, senza sapere perché. Le note ci
// sono sempre state (Impostazioni → Informazioni) ma nessuno va a
// cercarle: si portano davanti UNA VOLTA, e chi ha fretta le chiude.
export default function NovitaDialog({ versione, onClose }) {
  const [testo, setTesto] = useState(null)
  const [errore, setErrore] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`${import.meta.env.BASE_URL || '/'}changelog.md`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((md) => vivo && setTesto(sezioneChangelog(md, versione)))
      .catch(() => vivo && setErrore(true))
    return () => {
      vivo = false
    }
  }, [versione])

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box"
        role="dialog"
        aria-label="Novità di questa versione"
        style={{ width: 'min(520px, 94vw)', maxHeight: '82vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>🎉 Cosa è cambiato</h3>
          <button className="btn ghost small" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          L&apos;app è stata aggiornata{versione ? ` alla ${versione}` : ''}.
        </p>
        {errore && (
          <p className="muted small" style={{ marginTop: 10 }}>
            Le note di questa versione non sono arrivate. Si trovano in
            Impostazioni → Informazioni.
          </p>
        )}
        {!testo && !errore && <p className="muted small" style={{ marginTop: 10 }}>Carico le note…</p>}
        {testo && <Changelog testo={testo} />}
        <button className="btn block" style={{ marginTop: 12 }} onClick={onClose}>
          Ho capito
        </button>
      </div>
    </div>
  )
}
