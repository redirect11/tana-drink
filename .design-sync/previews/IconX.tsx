import { IconX } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconX /> Riga tolta dal conto
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconX size="1.2em" /> Togli la riga
    </button>
    <button className="btn ghost small">
      <IconX /> Togli
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconX />
    <span style={{ color: 'var(--ok)' }}>
      <IconX />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconX />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconX />
    </span>
  </div>
)
