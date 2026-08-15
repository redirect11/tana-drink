import { IconPiu } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconPiu /> Aggiungi un prodotto al conto
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconPiu size="1.2em" /> Aggiungi un prodotto
    </button>
    <button className="btn ghost small">
      <IconPiu /> Aggiungi
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconPiu />
    <span style={{ color: 'var(--ok)' }}>
      <IconPiu />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconPiu />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconPiu />
    </span>
  </div>
)
