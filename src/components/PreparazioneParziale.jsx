import { useState } from 'react'
import { dividiComanda } from '../lib/comande.js'

// ── QUANTI NE PREPARI ADESSO ─────────────────────────────────────────
//
// Al banco capita di vedere tre gin tonic in una comanda e due in un'altra
// e prepararli insieme, per farli uscire in una volta sola. Non andrebbe
// fatto — un ticket si lavora intero — ma si fa: l'app non lo impedisce, lo
// REGISTRA, così il conto resta giusto e la coda dice davvero cosa è al
// banco e cosa aspetta ancora.
//
// QUESTO PEZZO STA IN UN FILE SUO perché il gesto si fa da due posti: dal
// conto (→ Comande) e dal dettaglio della comanda, che è dove sta chi
// prepara. Due schermate che dividono una comanda in due modi diversi
// sarebbero due modi diversi di sbagliare il conto: qui si sceglie, e le
// quantità le conta sempre `dividiComanda` (logica pura, provata a unità).
//
// Chi chiama riceve le scelte come ARRAY PARALLELO alle righe della
// comanda — `scelte[i]` è quanto di `comanda.items[i]` si prepara adesso —
// che è la forma che vuole `preparazioneParziale`.

export default function PreparazioneParziale({ comanda, onAnnulla, onConferma }) {
  const righe = comanda?.items || []
  // Quante unità per riga, per indice. Si parte da zero: chi apre questo
  // riquadro sta dicendo «ne preparo una parte», e quale parte lo decide
  // toccando, non correggendo un numero già scritto.
  const [scelte, setScelte] = useState({})
  const quante = (i) => Number(scelte[i]) || 0
  const cambia = (i, delta, massimo) =>
    setScelte((s) => ({
      ...s,
      [i]: Math.min(massimo, Math.max(0, (Number(s[i]) || 0) + delta)),
    }))
  const niente = righe.every((_, i) => quante(i) === 0)

  return (
    <div className="comanda-parziale">
      <div className="muted small" style={{ marginBottom: 4 }}>
        Quanti ne prepari adesso?
      </div>
      {righe.map((i, idx) => (
        <div className="row between comanda-parziale-riga" key={i.line_id ?? `${i.drink_id}-${idx}`}>
          <span className="small">
            {i.custom ? '✨ ' : ''}
            {i.name} <span className="muted">di {i.qty}</span>
          </span>
          <span className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button
              className="btn ghost small"
              aria-label={`Uno in meno di ${i.name}`}
              disabled={quante(idx) === 0}
              onClick={() => cambia(idx, -1, i.qty)}
            >
              −
            </button>
            <strong style={{ minWidth: '1.5em', textAlign: 'center' }}>{quante(idx)}</strong>
            <button
              className="btn ghost small"
              aria-label={`Uno in più di ${i.name}`}
              disabled={quante(idx) >= i.qty}
              onClick={() => cambia(idx, +1, i.qty)}
            >
              +
            </button>
          </span>
        </div>
      ))}
      <div className="grid-2" style={{ marginTop: 8, gap: 6 }}>
        <button className="btn ghost small" onClick={onAnnulla}>
          Lascia stare
        </button>
        <button
          className="btn small"
          disabled={niente}
          onClick={() => {
            const scelto = righe.map((_, i) => quante(i))
            // Il conto delle unità lo fa una funzione sola per tutta l'app:
            // se dice che non c'è niente da prendere, non si manda niente.
            if (!dividiComanda(comanda, scelto)) return
            onConferma?.(scelto)
          }}
        >
          Preparo questi
        </button>
      </div>
    </div>
  )
}
