import { IconRefresh } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconRefresh /> Tre modifiche non ancora sincronizzate
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconRefresh size="1.2em" /> Riprova tutte
    </button>
    <button className="btn ghost small">
      <IconRefresh /> Riprova
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconRefresh />
    <span style={{ color: 'var(--ok)' }}>
      <IconRefresh />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconRefresh />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconRefresh />
    </span>
  </div>
)
