import Icona from './Icona.jsx'

// Conferma in-app: sostituisce window.confirm, che in alcuni contesti
// (browser embedded, PWA standalone) viene bloccato silenziosamente.
// `icona`: un nome del vocabolario, davanti al titolo, nel tema dei segnali.
export default function ConfirmDialog({ title, icona, message, confirmLabel = 'Conferma', cancelLabel = 'Annulla', danger, onConfirm, onCancel }) {
  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        {title && (
          <h3 style={{ marginTop: 0 }}>
            {icona && <><Icona nome={icona} gruppo="segnali" />{' '}</>}
            {title}
          </h3>
        )}
        {message && <p className="muted" style={{ whiteSpace: 'pre-line' }}>{message}</p>}
        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn ghost grow" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn grow${danger ? ' danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
