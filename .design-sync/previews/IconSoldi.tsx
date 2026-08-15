import { IconSoldi } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconSoldi /> Contanti in cassa: 320 €
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconSoldi size="1.2em" /> Registra l'incasso
    </button>
    <button className="btn ghost small">
      <IconSoldi /> Incasso
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconSoldi />
    <span style={{ color: 'var(--ok)' }}>
      <IconSoldi />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconSoldi />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconSoldi />
    </span>
  </div>
)
