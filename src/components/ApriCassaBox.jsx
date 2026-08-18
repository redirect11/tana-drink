import { useState } from 'react'
import { openCashSession } from '../lib/api.js'
import { toastError } from '../lib/toast.js'

// ── APRIRE LA CASSA, DA DOVE CI SI TROVA ─────────────────────────────
//
// A inizio serata la cassa si apre e basta: mandare chi sta al banco nella
// pagina della cassa per premere un tasto e tornare indietro sono tre
// passaggi per una cosa che ne vale uno. Qui si chiede solo il fondo — ed è
// facoltativo, perché non tutti lo mettono — e si apre.
//
// «Annulla» lascia tutto com'è: cassa chiusa. È il motivo per cui questo è
// un box e non un tasto secco — premere «apri cassa» per sbaglio, e
// ritrovarsi una serata aperta con un fondo sbagliato, si sistema solo
// chiudendo e riaprendo.
export default function ApriCassaBox({ cutoffHour, by, onClose }) {
  const [fondo, setFondo] = useState('')
  const [busy, setBusy] = useState(false)

  const apri = async () => {
    if (busy) return
    setBusy(true)
    try {
      await openCashSession({
        by,
        fondo: Number(String(fondo).replace(',', '.')) || 0,
        cutoffHour,
      })
      onClose()
    } catch (e) {
      toastError(`Cassa non aperta: ${e.message}`)
      setBusy(false)
    }
  }

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>🟢 Apri la cassa</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Da qui in poi gli incassi della serata si contano da soli, fino alla
          chiusura.
        </p>
        <label htmlFor="fondo-cassa">Fondo cassa iniziale (€) — se ce n&apos;è</label>
        <input
          id="fondo-cassa"
          type="number"
          step="0.5"
          min="0"
          value={fondo}
          onChange={(e) => setFondo(e.target.value)}
          placeholder="Es. 50"
          autoFocus
        />
        <div className="grid-2" style={{ marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="btn" onClick={apri} disabled={busy}>
            {busy ? 'Apro…' : 'Apri cassa'}
          </button>
        </div>
      </div>
    </div>
  )
}
