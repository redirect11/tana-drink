import { useEffect } from 'react'

// MENU DELLE AZIONI, dal basso. Su uno schermo da telefono i tasti
// secondari — unisci, gruppi, dati del conto, annulla — occupavano più
// spazio delle righe ordinate, che sono l'unica cosa che si guarda mentre
// si batte. Adesso stanno qui dietro, a un tocco, con bersagli grossi:
// il pollice arriva in basso, non in cima allo schermo.
//
// Le voci disabilitate restano visibili e spente: sparire e ricomparire
// sposta tutte le altre proprio mentre stai per premerle.
export default function ActionSheet({ open, onClose, titolo = 'Azioni', voci = [] }) {
  // Il tasto "indietro" del telefono chiude il menu invece di uscire dalla
  // schermata: è quello che uno si aspetta con un pannello aperto.
  useEffect(() => {
    if (!open) return undefined
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])

  if (!open) return null
  const utili = voci.filter(Boolean)

  return (
    <div className="overlay action-sheet-overlay" onClick={onClose}>
      <div
        className="action-sheet"
        role="dialog"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="action-sheet-maniglia" />
        <div className="action-sheet-titolo">
          <strong>{titolo}</strong>
          <button className="btn ghost small" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="action-sheet-voci">
          {utili.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`action-sheet-voce${v.danger ? ' danger' : ''}`}
              disabled={v.disabled}
              onClick={() => {
                // Prima si chiude: quasi tutte le voci aprono un'altra
                // schermata, e due pannelli sovrapposti confondono.
                if (!v.tieniAperto) onClose()
                v.onClick?.()
              }}
            >
              <span className="action-sheet-ic">{v.icon}</span>
              <span className="action-sheet-testo">
                <span>{v.label}</span>
                {v.hint && <span className="muted small">{v.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
