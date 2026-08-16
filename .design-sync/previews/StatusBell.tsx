import { useLayoutEffect } from 'react'
import { StatusBell } from 'karaoke-drink'

// Il posto della campanella è la barra in alto, di fianco al logo. Il pannello
// con lo stato della sincronizzazione e lo storico si apre toccandola.
export const NellaBarra = () => (
  <div
    className="row between"
    style={{
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: 'var(--card)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 'var(--radius)',
    }}
  >
    <strong style={{ fontFamily: 'var(--serif)', fontSize: '1.15rem' }}>La Tana del Coniglio</strong>
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      <span className="chip">Coda</span>
      <StatusBell />
    </div>
  </div>
)

// `floating`: lo stesso tasto tondo, per la coda a tutto schermo — dove la
// barra non c'è e gli avvisi non devono sparire proprio lì.
export const Flottante = () => {
  // Il tasto tondo si accende solo a tutto schermo: nel CSS è
  // `body.fullbleed .status-bell-float { display: flex }`. Senza la classe
  // l'anteprima resterebbe vuota — e non perché il componente è rotto.
  useLayoutEffect(() => {
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [])
  return (
    <div style={{ minHeight: 200 }}>
      <p className="muted small" style={{ margin: 0 }}>
        Coda a tutto schermo: niente barra in alto, la campanella galleggia.
      </p>
      <StatusBell floating />
    </div>
  )
}
