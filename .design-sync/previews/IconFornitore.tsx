import { IconFornitore } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconFornitore /> Fornitore: Bevande Sud
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconFornitore size="1.2em" /> Nuovo fornitore
    </button>
    <button className="btn ghost small">
      <IconFornitore /> Fornitori
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconFornitore />
    <span style={{ color: 'var(--ok)' }}>
      <IconFornitore />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconFornitore />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconFornitore />
    </span>
  </div>
)
