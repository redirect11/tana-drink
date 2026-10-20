import { useState } from 'react'
import { grigliaMese, nomeMese, chiaveGiorno } from '../lib/periodo.js'

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

// ── LA GRIGLIA DEL MESE, UNA PER TUTTA L'APP (REQ-STAT-007) ────────────
//
// L'utente, 11/10/2026: «uniformare anche gli altri calendari dell'app a
// quello appena creato … e anche con la info sul servizio». Tre schermate
// aprono un calendario — le serate delle statistiche, la ricerca per data
// delle chiusure, il periodo dello storico — e prima ognuna disegnava il
// suo. Qui c'è la griglia sola: lunedì per primo, sei righe che non ballano
// fra un mese e l'altro, le frecce, e UN COLORE PER GIORNO: verde dove c'è
// stato servizio, grigio dove no, i giorni a venire spenti. Cosa succede
// toccando un giorno lo decide chi la usa (`classeDi`, `onScegli`).
//   servizio: Set delle giornate con servizio (lib/giorniDiServizio.js)
//   classeDi(giorno): classi in più per lo stato della schermata
//     ('estremo', 'dentro'…), o ''
export default function GrigliaMese({ iniziale, oggi, servizio, classeDi = () => '', onScegli, aiuto = null }) {
  const [mese, setMese] = useState(() => {
    const [y, m] = (iniziale || oggi).split('-')
    return { anno: Number(y), mese: Number(m) - 1 }
  })
  const sposta = (n) => {
    const d = new Date(Date.UTC(mese.anno, mese.mese + n, 1))
    setMese({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() })
  }
  const stato = (giorno) => (giorno > oggi ? '' : servizio?.has(giorno) ? ' servizio' : ' senza')
  const detto = (giorno) => (giorno > oggi ? '' : servizio?.has(giorno) ? ', servizio' : ', nessun servizio')

  return (
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
              className={`periodo-giorno${stato(giorno)}${classeDi(giorno)}${giorno === oggi ? ' oggi' : ''}`}
              aria-label={`${giorno}${detto(giorno)}`}
              disabled={giorno > oggi}
              onClick={() => onScegli(giorno)}
            >
              {Number(giorno.slice(8))}
            </button>
          )
        )}
      </div>
      <p className="muted small periodo-aiuto">
        <span className="legenda-servizio" /> servizio · <span className="legenda-senza" /> nessun servizio
        {aiuto ? ` · ${aiuto}` : ''}
      </p>
    </div>
  )
}
