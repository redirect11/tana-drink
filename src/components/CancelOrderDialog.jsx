import { useState } from 'react'
import { CANCEL_PHRASES } from '../lib/orderStatus.js'
import Icona from './Icona.jsx'
import { tr } from '../lib/lingua.js'

// Dialog di annullamento ordine lato bartender: scelta della frase mostrata
// al cliente, motivazione facoltativa e notifica opzionale.
// kind: 'ordine' | 'preparazione' | 'non_ritirato'
export default function CancelOrderDialog({
  order,
  kind,
  defaultPhrase = 'bancone',
  // «Prego recarsi al bancone» ha senso solo dove il ritiro esiste: in un
  // locale a solo servizio manderebbe il cliente dove nessuno lo aspetta.
  ritiroPossibile = true,
  onConfirm,
  onCancel,
}) {
  const [phrase, setPhrase] = useState(
    CANCEL_PHRASES[defaultPhrase] ? defaultPhrase : 'staff'
  )
  const [message, setMessage] = useState('')
  const [notifyClient, setNotifyClient] = useState(true)

  const titles = {
    ordine: tr("Annullare l'ordine #{n}?", { n: order.daily_number }),
    preparazione: tr('Annullare la preparazione di #{n}?', { n: order.daily_number }),
    non_ritirato:
      order.service_mode === 'tavolo'
        ? tr('Segnare #{n} come non servito?', { n: order.daily_number })
        : tr('Segnare #{n} come non ritirato?', { n: order.daily_number }),
  }

  const hints = {
    ordine: tr('Le eventuali scorte usate verranno ripristinate.'),
    preparazione: tr('Le scorte usate verranno ripristinate.'),
    non_ritirato: tr('Il drink è stato preparato: le scorte restano scalate.'),
  }

  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          <Icona nome={kind === 'non_ritirato' ? 'vietato' : 'annullato'} gruppo="segnali" />{' '}
          {titles[kind] ?? titles.ordine}
        </h3>
        <p className="muted" style={{ marginTop: 0 }}>{hints[kind] ?? ''}</p>

        <p className="muted small" style={{ margin: '12px 0 6px' }}>
          {tr('Messaggio per il cliente:')}
        </p>
        <div className="mode-choice">
          {Object.entries(CANCEL_PHRASES)
            // Dove non si ritira al banco quella frase non si propone
            // affatto: qui c'è il cliente davanti, e sceglierla per sbaglio
            // vuol dire mandarlo a un bancone dove nessuno lo aspetta.
            .filter(([key]) => key !== 'bancone' || ritiroPossibile)
            .map(([key, text]) => (
              <button
                key={key}
                className={`mode-option${phrase === key ? ' active' : ''}`}
                // La frase arriva al cliente così com'è, in italiano: non si
                // traduce per chi lavora, che deve vedere cosa leggerà lui.
                lang="it"
                onClick={() => setPhrase(key)}
              >
                {text}
              </button>
            ))}
        </div>

        <textarea
          rows={2}
          placeholder={tr('Motivazione per il cliente (facoltativa)')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ marginTop: 10 }}
        />

        <div className="toggle-row" style={{ borderBottom: 'none' }}>
          <span><Icona nome="notifiche" gruppo="tasti" /> {tr('Notifica il cliente')}</span>
          <input
            type="checkbox"
            className="toggle"
            checked={notifyClient}
            onChange={(e) => setNotifyClient(e.target.checked)}
          />
        </div>

        <div className="row" style={{ gap: 10, marginTop: 8 }}>
          <button className="btn ghost grow" onClick={onCancel}>
            {tr('Indietro')}
          </button>
          <button
            className="btn danger grow"
            onClick={() =>
              onConfirm({ phrase, message: message.trim() || null, notify: notifyClient })
            }
          >
            {tr('Conferma')}
          </button>
        </div>
      </div>
    </div>
  )
}
