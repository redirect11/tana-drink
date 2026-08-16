import { IconCard } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconCard /> Pagato con carta · 18,00 €
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconCard size="1.2em" /> Paga con carta
    </button>
    <button className="btn ghost small">
      <IconCard /> Carta
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconCard />
    <span style={{ color: 'var(--ok)' }}>
      <IconCard />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconCard />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconCard />
    </span>
  </div>
)
