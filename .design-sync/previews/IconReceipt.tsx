import { IconReceipt } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconReceipt /> Conto #12 — 34,50 €
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconReceipt size="1.2em" /> Stampa il conto
    </button>
    <button className="btn ghost small">
      <IconReceipt /> Conto
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconReceipt />
    <span style={{ color: 'var(--ok)' }}>
      <IconReceipt />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconReceipt />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconReceipt />
    </span>
  </div>
)
