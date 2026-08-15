import { IconGrafico } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconGrafico /> Incasso di ieri: 1.240 €
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconGrafico size="1.2em" /> Vedi le statistiche
    </button>
    <button className="btn ghost small">
      <IconGrafico /> Statistiche
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconGrafico />
    <span style={{ color: 'var(--ok)' }}>
      <IconGrafico />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconGrafico />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconGrafico />
    </span>
  </div>
)
