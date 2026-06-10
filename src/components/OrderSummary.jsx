import { useEffect, useMemo, useState } from 'react'
import { ORDER_STATUSES, formatPrice } from '../lib/orderStatus.js'
import { subscribeQueue } from '../lib/api.js'
import { queueEtaMinutes } from '../lib/eta.js'

// Riepilogo ordine in stile scontrino, mostrato prima della conferma.
// Calcola coperto (per persona), costo di servizio (percentuale) o mancia
// (importo libero) in base alle impostazioni del bar.
export default function OrderSummary({ cart, settings, serata, tableLabel, sending, onConfirm, onCancel }) {
  const [persons, setPersons] = useState(1)
  const [tip, setTip] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState(() =>
    settings.service_mode === 'banco' ? 'banco' : 'tavolo'
  )

  const subtotal = cart.total

  // Modalità di consegna: fissata dalle impostazioni oppure scelta dal
  // cliente ('entrambi'). Il ritiro al banco azzera coperto e costo di
  // servizio; la mancia resta sempre facoltativa.
  const modeChoice = settings.service_mode === 'entrambi'
  const effectiveMode = modeChoice ? mode : settings.service_mode === 'banco' ? 'banco' : 'tavolo'
  const atTable = effectiveMode === 'tavolo'

  // Coda attiva: il nuovo ordine andrà dopo tutti gli ordini in corso, quindi
  // la stima personale tiene conto di quanti ce ne sono davanti.
  const [queueLen, setQueueLen] = useState(0)
  useEffect(() => {
    if (!settings.eta_enabled || !serata?.id) return
    return subscribeQueue(serata.id, (q) => setQueueLen(q.length))
  }, [settings.eta_enabled, serata?.id])

  const etaMinutes = settings.eta_enabled
    ? queueEtaMinutes({
        status: ORDER_STATUSES.RICEVUTO,
        position: queueLen,
        prepStats: serata?.prep_stats,
        etaStats: serata?.eta_stats,
        baseMinutes: settings.eta_base_minutes,
        mode: effectiveMode,
      })
    : null

  const copertoAmount = settings.coperto_enabled && atTable
    ? persons * Number(settings.coperto_amount || 0)
    : 0

  const serviceAmount = settings.service_charge_enabled && atTable
    ? Math.round((subtotal + copertoAmount) * Number(settings.service_charge_percent || 0)) / 100
    : 0

  const tipAmount = settings.tip_enabled ? Math.max(0, Number(tip) || 0) : 0

  const total = useMemo(
    () => subtotal + copertoAmount + serviceAmount + tipAmount,
    [subtotal, copertoAmount, serviceAmount, tipAmount]
  )

  function confirm() {
    onConfirm({
      coperto_persons: settings.coperto_enabled && atTable ? persons : 0,
      coperto_amount: copertoAmount,
      service_charge_amount: serviceAmount,
      tip_amount: tipAmount,
      service_mode: effectiveMode,
      note: note.trim() || null,
    })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="summary-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="summary-head">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <h2>Riepilogo ordine</h2>
          {tableLabel && <p className="muted" style={{ margin: 0 }}>Tavolo {tableLabel}</p>}
        </div>

        {modeChoice && (
          <div className="mode-choice">
            <button
              className={`mode-option${mode === 'tavolo' ? ' active' : ''}`}
              onClick={() => setMode('tavolo')}
            >
              🍸 Servito al tavolo
            </button>
            <button
              className={`mode-option${mode === 'banco' ? ' active' : ''}`}
              onClick={() => setMode('banco')}
            >
              🚶 Ritiro al banco
            </button>
          </div>
        )}
        {modeChoice && mode === 'banco' && (
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.82rem', textAlign: 'center' }}>
            Ritirando al banco non paghi coperto né costo di servizio.
          </p>
        )}

        {etaMinutes != null && (
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem', textAlign: 'center' }}>
            ⏱ {atTable ? 'Tempo di servizio stimato' : 'Pronto per il ritiro in'} ~{etaMinutes} min
          </p>
        )}

        <div className="summary-rows">
          {cart.items.map((i) => (
            <div className="summary-row" key={i.drink_id}>
              <span>
                {i.name} <span className="qty-x">× {i.qty}</span>
              </span>
              <span>{formatPrice(i.qty * i.price)}</span>
            </div>
          ))}

          <div className="summary-row">
            <span className="muted">Subtotale</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {settings.coperto_enabled && atTable && (
            <div className="summary-row">
              <span>
                Coperto ({formatPrice(settings.coperto_amount)} a persona)
                <div className="persons-counter" style={{ marginTop: 6 }}>
                  <button
                    aria-label="Meno persone"
                    onClick={() => setPersons((p) => Math.max(1, p - 1))}
                  >
                    −
                  </button>
                  <strong>{persons}</strong>
                  <button
                    aria-label="Più persone"
                    onClick={() => setPersons((p) => p + 1)}
                  >
                    +
                  </button>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {persons === 1 ? 'persona' : 'persone'}
                  </span>
                </div>
              </span>
              <span>{formatPrice(copertoAmount)}</span>
            </div>
          )}

          {settings.service_charge_enabled && atTable && (
            <div className="summary-row">
              <span>Servizio ({settings.service_charge_percent}%)</span>
              <span>{formatPrice(serviceAmount)}</span>
            </div>
          )}

          {settings.tip_enabled && (
            <div className="summary-row">
              <span>
                Mancia <span className="muted" style={{ fontSize: '0.82rem' }}>(facoltativa)</span>
              </span>
              <input
                className="tip-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                placeholder="0,00"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
              />
            </div>
          )}

          <div className="summary-row summary-total">
            <span>TOTALE</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        <textarea
          rows={2}
          placeholder="Note per il bancone (facoltative): allergie, ghiaccio, varianti…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="row" style={{ gap: 10 }}>
          <button className="btn ghost grow" onClick={onCancel} disabled={sending}>
            Modifica
          </button>
          <button className="btn grow" onClick={confirm} disabled={sending}>
            {sending ? 'Invio…' : 'Conferma ordine'}
          </button>
        </div>
      </div>
    </div>
  )
}
