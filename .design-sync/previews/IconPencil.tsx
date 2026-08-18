import { IconPencil } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconPencil /> Modifica il prezzo del Negroni
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconPencil size="1.2em" /> Modifica il prodotto
    </button>
    <button className="btn ghost small">
      <IconPencil /> Modifica
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconPencil />
    <span style={{ color: 'var(--ok)' }}>
      <IconPencil />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconPencil />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconPencil />
    </span>
  </div>
)
