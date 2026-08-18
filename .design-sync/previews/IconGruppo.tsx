import { IconGruppo } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconGruppo /> Tavolata di 6 — tre conti insieme
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconGruppo size="1.2em" /> Metti in un gruppo
    </button>
    <button className="btn ghost small">
      <IconGruppo /> Gruppo
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconGruppo />
    <span style={{ color: 'var(--ok)' }}>
      <IconGruppo />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconGruppo />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconGruppo />
    </span>
  </div>
)
