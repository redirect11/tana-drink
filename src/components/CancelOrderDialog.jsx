import { useState } from 'react'
import { CANCEL_PHRASES } from '../lib/orderStatus.js'

// Dialog di annullamento ordine lato bartender: scelta della frase mostrata
// al cliente, motivazione facoltativa e notifica opzionale.
// kind: 'ordine' | 'preparazione' | 'non_ritirato'
export default function CancelOrderDialog({ order, kind, defaultPhrase = 'bancone', onConfirm, onCancel }) {
  const [phrase, setPhrase] = useState(
    CANCEL_PHRASES[defaultPhrase] ? defaultPhrase : 'bancone'
  )
  const [message, setMessage] = useState('')
  const [notifyClient, setNotifyClient] = useState(true)

  const titles = {
    ordine: `✖️ Annullare l'ordine #${order.daily_number}?`,
    preparazione: `✖️ Annullare la preparazione di #${order.daily_number}?`,
    non_ritirato:
      order.service_mode === 'tavolo'
        ? `🚫 Segnare #${order.daily_number} come non servito?`
        : `🚫 Segnare #${order.daily_number} come non ritirato?`,
  }

  const hints = {
    ordine: 'Le eventuali scorte usate verranno ripristinate.',
    preparazione: 'Le scorte usate verranno ripristinate.',
    non_ritirato: 'Il drink è stato preparato: le scorte restano scalate.',
  }

  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{titles[kind] ?? titles.ordine}</h3>
        <p className="muted" style={{ marginTop: 0 }}>{hints[kind] ?? ''}</p>

        <p className="muted small" style={{ margin: '12px 0 6px' }}>
          Messaggio per il cliente:
        </p>
        <div className="mode-choice">
          {Object.entries(CANCEL_PHRASES).map(([key, text]) => (
            <button
              key={key}
              className={`mode-option${phrase === key ? ' active' : ''}`}
              onClick={() => setPhrase(key)}
            >
              {text}
            </button>
          ))}
        </div>

        <textarea
          rows={2}
          placeholder="Motivazione per il cliente (facoltativa)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ marginTop: 10 }}
        />

        <div className="toggle-row" style={{ borderBottom: 'none' }}>
          <span>🔔 Notifica il cliente</span>
          <input
            type="checkbox"
            className="toggle"
            checked={notifyClient}
            onChange={(e) => setNotifyClient(e.target.checked)}
          />
        </div>

        <div className="row" style={{ gap: 10, marginTop: 8 }}>
          <button className="btn ghost grow" onClick={onCancel}>
            Indietro
          </button>
          <button
            className="btn danger grow"
            onClick={() =>
              onConfirm({ phrase, message: message.trim() || null, notify: notifyClient })
            }
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}
