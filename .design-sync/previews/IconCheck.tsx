import { IconCheck } from 'karaoke-drink'

// Alla misura di default segue il testo attorno: qui la riga è un po' più
// grande del corpo, come nelle intestazioni della coda.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconCheck /> Comanda consegnata al tavolo 4
  </p>
)

// Dentro un tasto: `size` in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconCheck size="1.2em" /> Segna fatto
    </button>
    <button className="btn ghost small">
      <IconCheck /> Fatto
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconCheck />
    <span style={{ color: 'var(--ok)' }}>
      <IconCheck />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconCheck />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconCheck />
    </span>
  </div>
)
