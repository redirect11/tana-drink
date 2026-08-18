import { IconPersona } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconPersona /> Conto intestato a Marta
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconPersona size="1.2em" /> Intesta a un cliente
    </button>
    <button className="btn ghost small">
      <IconPersona /> Cliente
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconPersona />
    <span style={{ color: 'var(--ok)' }}>
      <IconPersona />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconPersona />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconPersona />
    </span>
  </div>
)
