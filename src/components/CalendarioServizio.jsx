import { useState } from 'react'
import GrigliaMese from './GrigliaMese.jsx'

// ── LA RICERCA PER DATA (REQ-STAT-007) ─────────────────────────────────
//
// L'utente, 11/10/2026: «una ricerca per data, con un calendario, che ti
// permette di selezionare il giorno e un box per modificare a mano la
// data». Un tasto che apre la griglia del mese (GrigliaMese, la stessa di
// tutta l'app, coi giorni di servizio colorati) e la casella accanto per
// chi la data la sa già e fa prima a scriverla.
//   servizio: Set delle giornate con servizio
//   scelto:   la giornata scelta adesso (o '')
//   onScegli(giornata)
//   etichetta: quella della casella (da chi usa il componente)
export default function CalendarioServizio({ servizio, scelto, oggi, onScegli, etichetta = 'Data', id = 'cerca-serata-giorno', min, max }) {
  const [aperto, setAperto] = useState(false)
  return (
    <div className="calendario-servizio">
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          className={`chip${aperto ? ' active' : ''}`}
          aria-expanded={aperto}
          onClick={() => setAperto((v) => !v)}
        >
          📅 Calendario
        </button>
        <label className="muted small" htmlFor={id}>
          {etichetta}
        </label>
        <input
          id={id}
          type="date"
          value={scelto || ''}
          min={min || undefined}
          max={max || oggi}
          onChange={(e) => e.target.value && onScegli(e.target.value)}
        />
      </div>
      {aperto && (
        <GrigliaMese
          iniziale={scelto || oggi}
          oggi={oggi}
          servizio={servizio}
          classeDi={(g) => (g === scelto ? ' estremo' : '')}
          onScegli={(g) => {
            onScegli(g)
            setAperto(false)
          }}
        />
      )}
    </div>
  )
}
