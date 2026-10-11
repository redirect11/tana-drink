import { useState } from 'react'
import { grigliaMese, nomeMese, chiaveGiorno } from '../lib/periodo.js'

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

// ── IL CALENDARIO DEI GIORNI DI SERVIZIO (REQ-STAT-007) ───────────────
//
// L'utente, 11/10/2026: nella lista delle serate «una ricerca per data, con
// un calendario, che ti permette di selezionare il giorno e un box per
// modificare a mano la data. Il calendario compatto deve poter scorrere i
// mesi e segnare dei colori su ogni giorno in base a se c'è stato servizio
// oppure no».
//
// La stessa griglia del selettore dello storico (grigliaMese, lunedì per
// primo, sei righe che non ballano fra un mese e l'altro), con un colore per
// giorno: col servizio e senza. I giorni a venire sono spenti. La casella
// accanto è per chi la data la sa già e fa prima a scriverla.
//   servizio: Set delle giornate in cui c'è stato servizio
//   scelto:   la giornata scelta adesso (o '')
//   onScegli(giornata)
export default function CalendarioServizio({ servizio, scelto, oggi, onScegli }) {
  const [aperto, setAperto] = useState(false)
  const [mese, setMese] = useState(() => {
    const [y, m] = (scelto || oggi).split('-')
    return { anno: Number(y), mese: Number(m) - 1 }
  })
  const sposta = (n) => {
    const d = new Date(Date.UTC(mese.anno, mese.mese + n, 1))
    setMese({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() })
  }
  const scegli = (giorno) => {
    onScegli(giorno)
    setAperto(false)
  }

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
        <label className="muted small" htmlFor="cerca-serata-giorno">
          Data
        </label>
        <input
          id="cerca-serata-giorno"
          type="date"
          value={scelto || ''}
          max={oggi}
          onChange={(e) => e.target.value && onScegli(e.target.value)}
        />
      </div>

      {aperto && (
        <div className="periodo-pannello">
          <div className="periodo-testata">
            <button type="button" className="btn ghost small" onClick={() => sposta(-1)} aria-label="Mese precedente">
              ‹
            </button>
            <strong>{nomeMese(mese.anno, mese.mese)}</strong>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => sposta(1)}
              aria-label="Mese successivo"
              disabled={chiaveGiorno(new Date(Date.UTC(mese.anno, mese.mese + 1, 1))) > oggi}
            >
              ›
            </button>
          </div>
          <div className="periodo-griglia">
            {GIORNI.map((g, i) => (
              <span key={i} className="periodo-intestazione">
                {g}
              </span>
            ))}
            {grigliaMese(mese.anno, mese.mese).map((giorno, i) =>
              giorno == null ? (
                <span key={`v${i}`} />
              ) : (
                <button
                  key={giorno}
                  type="button"
                  className={`periodo-giorno${giorno > oggi ? '' : servizio.has(giorno) ? ' servizio' : ' senza'}${
                    giorno === scelto ? ' estremo' : ''
                  }${giorno === oggi ? ' oggi' : ''}`}
                  aria-label={`${giorno}${giorno > oggi ? '' : servizio.has(giorno) ? ', servizio' : ', nessun servizio'}`}
                  disabled={giorno > oggi}
                  onClick={() => scegli(giorno)}
                >
                  {Number(giorno.slice(8))}
                </button>
              )
            )}
          </div>
          <p className="muted small periodo-aiuto">
            <span className="legenda-servizio" /> servizio · <span className="legenda-senza" /> nessun servizio
          </p>
        </div>
      )}
    </div>
  )
}
