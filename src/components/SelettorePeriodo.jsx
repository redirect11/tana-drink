import { useState } from 'react'
import {
  grigliaMese,
  nomeMese,
  tocca,
  dentroIlPeriodo,
  etichettaPeriodo,
  periodiRapidi,
  chiaveGiorno,
} from '../lib/periodo.js'

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

// ── IL CALENDARIO DEL PERIODO ────────────────────────────────────────
//
// Come sui siti degli alberghi: si tocca il giorno d'inizio, poi quello di
// fine, e in mezzo si accende tutto. Un tocco solo su un giorno vuol dire
// quel giorno e basta, che è il caso più frequente («la serata di sabato»).
//
// Sopra ci sono le scorciatoie — oggi, ieri, ultimi 7 giorni — perché quasi
// sempre si cerca lì e aprire un calendario per «oggi» è lavoro inutile.
// I giorni futuri sono spenti: gli ordini di domani non esistono.
export default function SelettorePeriodo({ periodo, onChange, oggi }) {
  const [aperto, setAperto] = useState(false)
  const inizio = periodo?.da || oggi
  const [mese, setMese] = useState(() => {
    const [y, m] = inizio.split('-')
    return { anno: Number(y), mese: Number(m) - 1 }
  })

  const celle = grigliaMese(mese.anno, mese.mese)
  const sposta = (n) => {
    const d = new Date(Date.UTC(mese.anno, mese.mese + n, 1))
    setMese({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() })
  }
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
            {celle.map((giorno, i) =>
              giorno == null ? (
                <span key={`v${i}`} />
              ) : (
                <button
                  key={giorno}
                  type="button"
                  className={`periodo-giorno${
                    dentroIlPeriodo(giorno, periodo) && periodo?.da ? ' dentro' : ''
                  }${giorno === periodo?.da || giorno === periodo?.a ? ' estremo' : ''}${
                    giorno === oggi ? ' oggi' : ''
                  }`}
                  disabled={giorno > oggi}
                  onClick={() => scegli(giorno)}
                >
                  {Number(giorno.slice(8))}
                </button>
              )
            )}
          </div>
          <p className="muted small periodo-aiuto">
            Tocca un giorno per vedere quella serata; toccane un altro per arrivare fin lì.
          </p>
        </div>
      )}
    </div>
  )
}
