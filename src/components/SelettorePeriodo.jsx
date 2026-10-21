import { useState } from 'react'
import { tocca, dentroIlPeriodo, etichettaPeriodo, periodiRapidi } from '../lib/periodo.js'
import GrigliaMese from './GrigliaMese.jsx'

// ── IL CALENDARIO DEL PERIODO ────────────────────────────────────────
//
// Come sui siti degli alberghi: si tocca il giorno d'inizio, poi quello di
// fine, e in mezzo si accende tutto. Un tocco solo su un giorno vuol dire
// quel giorno e basta, che è il caso più frequente («la serata di sabato»).
//
// Sopra ci sono le scorciatoie — oggi, ieri, ultimi 7 giorni — perché quasi
// sempre si cerca lì e aprire un calendario per «oggi» è lavoro inutile.
// La griglia è quella di tutta l'app (GrigliaMese, REQ-STAT-007): i giorni
// di servizio colorati, i futuri spenti — gli ordini di domani non esistono.
export default function SelettorePeriodo({ periodo, onChange, oggi, servizio }) {
  const [aperto, setAperto] = useState(false)
  const inizio = periodo?.da || oggi
  const scegli = (giorno) => {
    const next = tocca(periodo, giorno)
    onChange(next)
    // Alla seconda toccata il periodo è completo: si chiude da sé, che è
    // quello che uno si aspetta dopo aver detto «da qui a qui».
    if (next.completo) setAperto(false)
  }

  return (
    <div className="periodo">
      <button
        type="button"
        className={`chip periodo-apri${periodo?.da ? ' active' : ''}`}
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
      >
        📅 {etichettaPeriodo(periodo, oggi)}
      </button>
      {periodo?.da && (
        <button
          type="button"
          className="chip periodo-pulisci"
          onClick={() => onChange({ da: null, a: null, completo: true })}
          aria-label="Togli il filtro sulle date"
        >
          ✕
        </button>
      )}

      {aperto && (
        <div className="periodo-pannello">
          <div className="chips-row periodo-rapidi">
            {periodiRapidi(oggi).map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip small"
                onClick={() => {
                  onChange(p.periodo)
                  setAperto(false)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <GrigliaMese
            iniziale={inizio}
            oggi={oggi}
            servizio={servizio}
            classeDi={(giorno) =>
              `${dentroIlPeriodo(giorno, periodo) && periodo?.da ? ' dentro' : ''}${
                giorno === periodo?.da || giorno === periodo?.a ? ' estremo' : ''
              }`
            }
            onScegli={scegli}
            aiuto="tocca un giorno, poi un altro per arrivare fin lì"
          />
        </div>
      )}
    </div>
  )
}
