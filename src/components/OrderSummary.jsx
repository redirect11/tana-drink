import { useEffect, useMemo, useState } from 'react'
import { ORDER_STATUSES, formatPrice } from '../lib/orderStatus.js'
import { subscribeQueue, createManualGroup } from '../lib/api.js'
import { auth } from '../lib/firebaseClient.js'
import { queueEtaMinutes } from '../lib/eta.js'
import { paymentOptions } from '../lib/payments.js'

// Riepilogo ordine in stile scontrino, mostrato prima della conferma.
// Calcola coperto (per persona), costo di servizio (percentuale) o mancia
// (importo libero) in base alle impostazioni del bar.
export default function OrderSummary({ cart, settings, serata, tableLabel, staff, customerProfile, sending, groupsActive = false, groups = [], initialGroupId = '', serataId = null, onConfirm, onCancel }) {
  const [persons, setPersons] = useState(1)
  const [tip, setTip] = useState('')
  const [note, setNote] = useState('')
  const [tavolo, setTavolo] = useState(tableLabel || '')
  // Gruppo a cui associare l'ordine (solo staff con gruppi attivi).
  // Esclude i contenitori (che non possono avere ordini diretti).
  const selectableGroups = groups.filter((g) => !g.has_child_groups)
  const [groupId, setGroupId] = useState(initialGroupId || '')
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const selectedGroup = selectableGroups.find((g) => g.id === groupId) || null
  // Precompilati dal profilo per i clienti con account, o dal nome gruppo.
  const [nome, setNome] = useState(customerProfile?.nome || '')
  const [cognome, setCognome] = useState(customerProfile?.cognome || '')
  const [mode, setMode] = useState(() =>
    settings.service_mode === 'banco' ? 'banco' : 'tavolo'
  )

  const subtotal = cart.total

  // Pagamento online (solo clienti): obbligatorio, oppure scelta
  // «paga ora» / «paga al bancone (o allo staff)». Se chi non paga
  // deve ritirare al banco, la scelta forza la modalità di consegna.
  const payOpts = paymentOptions(settings)
  const customerPay = !staff && payOpts.enabled
  const [payChoice, setPayChoice] = useState('online')
  const payOnline = customerPay && (payOpts.required || payChoice === 'online')
  const forceBanco = customerPay && !payOnline && payOpts.counterForcesBanco

  // Modalità di consegna: fissata dalle impostazioni oppure scelta dal
  // cliente ('entrambi'). Il ritiro al banco azzera coperto e costo di
  // servizio; la mancia resta sempre facoltativa.
  const modeChoice = settings.service_mode === 'entrambi'
  const effectiveMode = forceBanco
    ? 'banco'
    : modeChoice
      ? mode
      : settings.service_mode === 'banco'
        ? 'banco'
        : 'tavolo'
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

  const nomeValido = nome.trim().length > 0

  // Selezionando un gruppo, prepopola il nome con quello del gruppo.
  useEffect(() => {
    if (groupsActive && selectedGroup) {
      setNome(selectedGroup.name || '')
      setCognome('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  async function createAndSelectGroup() {
    const name = newGroupName.trim()
    if (!name || !serataId) return
    setCreatingGroup(true)
    try {
      const u = auth.currentUser
      const g = await createManualGroup({
        name,
        serata_id: serataId,
        created_by: u ? { uid: u.uid, email: u.email, role: staff?.role } : null,
      })
      setGroupId(g.id)
      setNewGroupName('')
    } catch {
      /* errori non bloccanti: lo staff può procedere senza gruppo */
    } finally {
      setCreatingGroup(false)
    }
  }

  function confirm() {
    if (!nomeValido) return
    onConfirm({
      customer_name: `${nome.trim()} ${cognome.trim()}`.trim(),
      coperto_persons: settings.coperto_enabled && atTable ? persons : 0,
      coperto_amount: copertoAmount,
      service_charge_amount: serviceAmount,
      tip_amount: tipAmount,
      service_mode: effectiveMode,
      note: note.trim() || null,
      pay_online: payOnline,
      payment_required: customerPay && payOpts.required,
      // Ordine manuale dello staff: il tavolo si indica qui.
      ...(staff ? { table_label: tavolo.trim() || null } : {}),
      // Gruppo scelto dallo staff (i clienti hanno il gruppo automatico).
      ...(groupsActive && groupId
        ? { group_id: groupId, group_name_snapshot: selectedGroup?.name || null }
        : {}),
    })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="summary-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="summary-head">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <h2>Riepilogo ordine</h2>
          {!staff && tableLabel && <p className="muted" style={{ margin: 0 }}>Tavolo {tableLabel}</p>}
        </div>

        {staff && (
          <div className="row" style={{ gap: 10, marginTop: 8 }}>
            <label htmlFor="tavolo-staff" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Tavolo
            </label>
            <input
              id="tavolo-staff"
              type="text"
              inputMode="numeric"
              placeholder="es. 5 (vuoto = banco)"
              value={tavolo}
              onChange={(e) => setTavolo(e.target.value)}
            />
          </div>
        )}

        {staff && groupsActive && (
          <div style={{ marginTop: 10 }}>
            <label style={{ margin: '0 0 4px' }}>Gruppo</label>
            <div className="chips-row">
              <button
                type="button"
                className={`chip${!groupId ? ' active' : ''}`}
                onClick={() => setGroupId('')}
              >
                Nessuno
              </button>
              {selectableGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`chip${groupId === g.id ? ' active' : ''}`}
                  onClick={() => setGroupId(g.id)}
                >
                  {g.kind === 'customer' ? '👤 ' : '🏷 '}{g.name}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                type="text"
                placeholder="+ Nuovo gruppo (es. Tavolo 5)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button
                type="button"
                className="btn small"
                style={{ flexShrink: 0 }}
                disabled={creatingGroup || !newGroupName.trim()}
                onClick={createAndSelectGroup}
              >
                {creatingGroup ? '…' : 'Crea'}
              </button>
            </div>
          </div>
        )}

        <div className="grid-2" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="ord-nome" style={{ margin: '0 0 4px' }}>
              Nome/Pseudonimo *
            </label>
            <input
              id="ord-nome"
              type="text"
              required
              placeholder="es. Mario"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ord-cognome" style={{ margin: '0 0 4px' }}>
              Cognome <span className="muted">(opz.)</span>
            </label>
            <input
              id="ord-cognome"
              type="text"
              placeholder="es. Rossi"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
            />
          </div>
        </div>

        {customerPay && !payOpts.required && (
          <>
            <label style={{ margin: '12px 0 4px' }}>Pagamento</label>
            <div className="mode-choice">
              <button
                className={`mode-option${payChoice === 'online' ? ' active' : ''}`}
                onClick={() => setPayChoice('online')}
              >
                💳 Paga ora
              </button>
              <button
                className={`mode-option${payChoice === 'counter' ? ' active' : ''}`}
                onClick={() => setPayChoice('counter')}
              >
                {payOpts.counterLabel}
              </button>
            </div>
          </>
        )}
        {customerPay && payOpts.required && (
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem', textAlign: 'center' }}>
            💳 Per ordinare è richiesto il pagamento online: ti chiederemo
            la carta dopo la conferma.
          </p>
        )}

        {modeChoice && (
          <div className="mode-choice">
            <button
              className={`mode-option${effectiveMode === 'tavolo' ? ' active' : ''}`}
              disabled={forceBanco}
              onClick={() => setMode('tavolo')}
            >
              🍸 Servito al tavolo
            </button>
            <button
              className={`mode-option${effectiveMode === 'banco' ? ' active' : ''}`}
              onClick={() => setMode('banco')}
            >
              🚶 Ritiro al banco
            </button>
          </div>
        )}
        {forceBanco && (
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.82rem', textAlign: 'center' }}>
            Pagando al bancone il ritiro è al banco. Per il servizio al
            tavolo paga online.
          </p>
        )}
        {modeChoice && !forceBanco && effectiveMode === 'banco' && (
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
          <button className="btn grow" onClick={confirm} disabled={sending || !nomeValido}>
            {sending
              ? 'Invio…'
              : !nomeValido
                ? 'Inserisci il nome'
                : payOnline
                  ? 'Conferma e paga 💳'
                  : 'Conferma ordine'}
          </button>
        </div>
      </div>
    </div>
  )
}
