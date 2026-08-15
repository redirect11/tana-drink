import { IconBuono } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconBuono /> Buono da 10 € applicato al conto
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconBuono size="1.2em" /> Applica un buono
    </button>
    <button className="btn ghost small">
      <IconBuono /> Buono
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconBuono />
    <span style={{ color: 'var(--ok)' }}>
      <IconBuono />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconBuono />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconBuono />
    </span>
  </div>
)
