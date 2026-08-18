import { IconPrinter } from 'karaoke-drink'

// Alla misura di default segue il testo attorno.
export const NelTesto = () => (
  <p style={{ fontSize: '1.05rem', margin: 0 }}>
    <IconPrinter /> Comanda mandata alla stampante del banco
  </p>
)

// Dentro un tasto: `size` è in em, quindi cresce col tasto senza toccarla.
export const NelTasto = () => (
  <div className="row" style={{ gap: 10 }}>
    <button className="btn">
      <IconPrinter size="1.2em" /> Stampa la comanda
    </button>
    <button className="btn ghost small">
      <IconPrinter /> Stampa
    </button>
  </div>
)

// Segue `currentColor`: nessuna icona porta un colore suo.
export const SegueIlColore = () => (
  <div className="row" style={{ gap: 18, alignItems: 'center', fontSize: '2rem' }}>
    <IconPrinter />
    <span style={{ color: 'var(--ok)' }}>
      <IconPrinter />
    </span>
    <span style={{ color: 'var(--accent-2)' }}>
      <IconPrinter />
    </span>
    <span style={{ color: 'var(--muted)' }}>
      <IconPrinter />
    </span>
  </div>
)
