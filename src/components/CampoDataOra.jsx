import { useState } from 'react'
import GrigliaMese from './GrigliaMese.jsx'

// ── DATA E ORA, COL CALENDARIO DELL'APP (REQ-STAT-007) ─────────────────
//
// «Inizio» e «Fine» del periodo personalizzato erano una casella
// `datetime-local` e basta: il browser ci apriva il SUO selettore, che non
// somiglia a nessun altro calendario dell'app e non sa niente dei giorni di
// servizio («qua vedo ancora il calendario vecchio», l'utente,
// 11/10/2026). Qui la casella resta — chi la data la sa, la scrive — e
// accanto c'è il tasto che apre la griglia di tutta l'app: toccato un
// giorno, resta l'ora che c'era.
//   valore: 'YYYY-MM-DDTHH:MM' (ora locale, come la casella)
export default function CampoDataOra({ id, label, valore, oggi, servizio, min, max, onChange }) {
  const [aperto, setAperto] = useState(false)
  const giorno = String(valore || '').slice(0, 10)
  const ora = String(valore || '').slice(11, 16) || '00:00'
  return (
    <span className="campo-data-ora">
      <label htmlFor={id} className="muted small">
        {label}
      </label>
      <span className="row" style={{ gap: 4, alignItems: 'center' }}>
        <input
          id={id}
          type="datetime-local"
          value={valore}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className={`chip small${aperto ? ' active' : ''}`}
          aria-label={`Calendario per ${label.toLowerCase()}`}
          aria-expanded={aperto}
          onClick={() => setAperto((v) => !v)}
        >
          📅
        </button>
      </span>
      {aperto && (
        <GrigliaMese
          iniziale={giorno || oggi}
          oggi={oggi}
          servizio={servizio}
          classeDi={(g) => (g === giorno ? ' estremo' : '')}
          onScegli={(g) => {
            onChange(`${g}T${ora}`)
            setAperto(false)
          }}
          aiuto={`l’ora resta ${ora}`}
        />
      )}
    </span>
  )
}
