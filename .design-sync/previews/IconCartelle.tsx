import { IconCartelle } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconCartelle /> Sottosezioni di questa pagina
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconCartelle size="1.2em" /> Apri le sezioni
    </button>
    <button className="btn ghost small">
      <IconCartelle /> Sezioni
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconCartelle />
    <span style={{ color: 'var(--ok)' }}>
      <IconCartelle />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconCartelle />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconCartelle />
    </span>
  </div>
)
