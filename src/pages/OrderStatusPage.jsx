import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  fetchOrder,
  subscribeOrder,
  subscribeSettings,
  subscribeServiceStats,
  subscribeQueue,
  updateOrderItems,
  updateOrderPushToken,
  updateOrderStatus,
  markOrderPaid,
  cancelOrder,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { getPushToken } from '../lib/push.js'
import {
  ORDER_STATUSES,
  STATUS_FLOW,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  nextStatus,
  CANCEL_PHRASES,
  formatPrice,
  placedByName,
} from '../lib/orderStatus.js'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { queueEtaMinutes } from '../lib/eta.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'
import { rememberOrderId } from '../lib/cart.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import PaymentPanel from '../components/PaymentPanel.jsx'
import OrderPosDetail from '../components/OrderPosDetail.jsx'
import QRCode from 'qrcode'

export default function OrderStatusPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [notifOn, setNotifOn] = useState(
    () => 'Notification' in window && Notification.permission === 'granted'
  )
  const [notifMsg, setNotifMsg] = useState(null)
  const [edits, setEdits] = useState(null) // copia editabile degli item (prima della preparazione)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [serviceStats, setServiceStats] = useState({})
  const [queue, setQueue] = useState([])
  const prevStatus = useRef(null)
  // Chi sta guardando la pagina è staff? Il QR per agganciare l'ordine
  // va mostrato solo allo staff, non al cliente che lo ha già scansionato.
  const [viewerIsStaff, setViewerIsStaff] = useState(false)
  const [viewerRole, setViewerRole] = useState(null) // 'bartender' | 'staff' | null
  // Il listener realtime vive fuori dal ciclo di render: gli serve il
  // ruolo aggiornato senza rimontarsi.
  const viewerRoleRef = useRef(null)
  viewerRoleRef.current = viewerRole
  const [viewerChecked, setViewerChecked] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setViewerIsStaff(false)
        setViewerRole(null)
        setViewerChecked(true)
        return
      }
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        setViewerIsStaff(role === 'bartender' || role === 'staff')
        setViewerRole(role === 'bartender' || role === 'staff' ? role : null)
      } catch {
        setViewerIsStaff(false)
        setViewerRole(null)
      }
      setViewerChecked(true)
    })
  }, [])

  // Permesso notifiche già concesso ma ordine senza token (es. QR di un
  // ordine manuale scansionato dal cliente): aggancia il token di questo
  // dispositivo in automatico. Mai per lo staff: la push andrebbe a loro.
  useEffect(() => {
    if (!viewerChecked || viewerIsStaff) return
    if (!order?.id || order.push_token || order.workflow_status !== ORDER_STATUSES.RICEVUTO) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    getPushToken().then(
      (t) => t && updateOrderPushToken(order.id, t).catch(() => {})
    )
  }, [viewerChecked, viewerIsStaff, order?.id, order?.push_token, order?.workflow_status])

  useEffect(() => {
    let active = true
    fetchOrder(id)
      .then((o) => {
        if (!active) return
        setOrder(o)
        prevStatus.current = o.workflow_status
      })
      .catch((e) => active && setError(e.message))

    // Realtime: ascolta gli aggiornamenti di QUESTO ordine.
    const unsubscribe = subscribeOrder(
      id,
      (updated) => {
        if (!active || !updated) return
        // Il listener ritenta da solo: se il fetch iniziale era fallito
        // (primo accesso, App Check non pronto), qui si recupera.
        setError(null)
        setOrder((prev) => ({ ...prev, ...updated }))
        // "Drink pronto": è un avviso PER IL CLIENTE, e solo col RITIRO AL
        // BANCO — al tavolo glielo portano, non deve fare nulla. Non va
        // mostrato a chi sta lavorando: questa pagina la apre anche lo
        // staff (per il bartender rende il dettaglio POS), e l'avviso
        // scattava addosso a chi aveva appena premuto "pronto".
        if (
          !viewerRoleRef.current &&
          updated.service_mode === 'banco' &&
          prevStatus.current !== updated.workflow_status &&
          updated.workflow_status === ORDER_STATUSES.PRONTO
        ) {
          notify(
            '🔔 Il tuo drink è pronto!',
            `Ordine #${updated.daily_number} pronto al ritiro.`
          )
        }
        // Annullamento da parte del bartender con notifica richiesta.
        if (
          prevStatus.current !== updated.workflow_status &&
          updated.workflow_status === ORDER_STATUSES.ANNULLATO &&
          updated.cancelled_by === 'bartender' &&
          updated.cancel_notify
        ) {
          notify(
            '⚠️ Problema con il tuo ordine',
            CANCEL_PHRASES[updated.cancel_phrase] || CANCEL_PHRASES.bancone
          )
        }
        prevStatus.current = updated.workflow_status
      },
      (e) => active && setError(e.message)
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [id])

  // Inizializza la copia editabile quando l'ordine è caricato.
  useEffect(() => {
    if (order && edits === null) {
      setEdits(order.order_items.map((i) => ({ ...i })))
    }
  }, [order, edits])

  // Chi apre questa pagina (es. il cliente che scansiona il QR di un
  // ordine manuale) se la ritrova in «I miei ordini».
  useEffect(() => {
    if (order?.id) rememberOrderId(order.id)
  }, [order?.id])

  // QR dell'ordine: per gli ordini manuali lo staff lo mostra al cliente,
  // che scansionandolo aggancia l'ordine sul proprio telefono.
  const [qr, setQr] = useState(null)
  const [showQr, setShowQr] = useState(false)
  useEffect(() => {
    if (!showQr || qr) return
    QRCode.toDataURL(window.location.href, {
      width: 260,
      margin: 1,
      color: { dark: '#1c1305', light: '#f5f5f7' },
    })
      .then(setQr)
      .catch(() => {})
  }, [showQr, qr])

  // Impostazioni + statistiche servizio (per il tempo stimato personalizzato).
  useEffect(() => subscribeSettings((s) => setSettings(s)), [])
  useEffect(() => subscribeServiceStats(setServiceStats, () => setServiceStats({})), [])

  // Coda attiva: serve per la posizione in coda.
  const orderActive =
    order && (order.workflow_status === ORDER_STATUSES.RICEVUTO || order.workflow_status === ORDER_STATUSES.IN_PREPARAZIONE)
  useEffect(() => {
    if (!settings.eta_enabled || settings.workflow_enabled === false || !orderActive) return
    return subscribeQueue(setQueue)
  }, [settings.eta_enabled, settings.workflow_enabled, orderActive])

  async function enableNotifications() {
    const ok = await ensureNotificationPermission()
    setNotifOn(ok)
    if (!ok) {
      // Permesso negato (ora o in passato): senza un messaggio il tasto
      // sembrerebbe rotto — il browser non rimostra il prompt.
      setNotifMsg(
        '🔕 Le notifiche sono bloccate dal browser: abilitale dalle impostazioni del sito e riprova.'
      )
      return
    }
    setNotifMsg('🔔 Notifiche attive: ti avviseremo quando è pronto.')
    notify('Notifiche attive', 'Ti avviseremo quando il drink è pronto.')
    // Aggancia il token push a QUESTO ordine (se manca): così l'avviso
    // arriva anche con la pagina chiusa. Possibile solo finché l'ordine
    // è "ricevuto"; utile anche dopo la scansione del QR di un ordine
    // manuale (il token dello staff non viene salvato apposta).
    if (!order?.push_token && order?.status === ORDER_STATUSES.RICEVUTO) {
      const token = await getPushToken()
      if (token) await updateOrderPushToken(order.id, token).catch(() => {})
    }
  }

  function changeQty(idx, delta) {
    setEdits((es) =>
      es
        .map((it, i) => (i === idx ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0)
    )
  }

  async function saveEdits() {
    if (!edits || edits.length === 0) return setConfirmCancel(true)
    setSaving(true)
    setError(null)
    try {
      await updateOrderItems(order.id, edits)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelMyOrder() {
    setConfirmCancel(false)
    setSaving(true)
    setError(null)
    try {
      await cancelOrder(order.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (error) return <div className="banner">Errore: {error}</div>
  if (!order) return <div className="empty">Carico l’ordine…</div>

  // Il bartender vede il dettaglio in stile POS (come la cassa SumUp):
  // griglia prodotti per aggiungere alla comanda + gestione completa.
  if (viewerRole === 'bartender') {
    return <OrderPosDetail order={order} />
  }

  const currentIdx = STATUS_FLOW.indexOf(order.workflow_status)
  // Con un pagamento online avviato/completato gli item non si toccano
  // (l'importo del checkout deve restare allineato all'ordine); dopo un
  // pagamento fallito si può di nuovo modificare.
  const paymentLocked =
    order.payment_method === 'online' && order.payment_status !== 'fallito'
  // Modificabile dal cliente solo finché il conto ha la sola prima comanda
  // ancora "ricevuta" (dopo le aggiunte del bartender non si tocca più).
  const singleReceived =
    (order.comande?.length ?? 1) === 1 && order.workflow_status === ORDER_STATUSES.RICEVUTO
  const editable = singleReceived && !paymentLocked
  // Annullabile dal cliente finché ricevuto e non pagato.
  const cancellable = singleReceived && order.payment_status !== 'pagato'
  // Pannello di pagamento online: in attesa o fallito, mai sugli annullati.
  const showPayment =
    order.payment_method === 'online' &&
    ['in_attesa', 'fallito'].includes(order.payment_status) &&
    order.workflow_status !== ORDER_STATUSES.ANNULLATO

  // Tempo stimato personalizzato: tiene conto degli ordini attivi davanti a
  // questo (la coda non viene mostrata, conta solo la posizione).
  const workflowOn = settings.workflow_enabled !== false
  const showEta = settings.eta_enabled && workflowOn && orderActive
  const queueAhead = queue.filter(
    (q) => (q.daily_number || 0) < (order.daily_number || 0)
  ).length
  const myEta = showEta
    ? queueEtaMinutes({
        status: order.workflow_status,
        position: queueAhead,
        prepStats: serviceStats?.prep_stats,
        etaStats: serviceStats?.eta_stats,
        baseMinutes: settings.eta_base_minutes,
        mode: order.service_mode === 'tavolo' ? 'tavolo' : 'banco',
      })
    : null
  const editItems = edits || order.order_items
  const extras =
    Number(order.coperto_amount || 0) +
    Number(order.service_charge_amount || 0) +
    Number(order.tip_amount || 0)
  const editTotal = editItems.reduce((s, i) => s + i.qty * i.unit_price, 0) + extras

  if (order.workflow_status === ORDER_STATUSES.ANNULLATO) {
    const byBartender = order.cancelled_by === 'bartender'
    return (
      <div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="bignum">#{order.daily_number ?? '—'}</div>
          {byBartender ? (
            <div className="banner" style={{ marginTop: 12, textAlign: 'left' }}>
              <strong>⚠️ C’è stato un problema con il tuo ordine.</strong>
              <div style={{ marginTop: 6 }}>
                {CANCEL_PHRASES[order.cancel_phrase] || CANCEL_PHRASES.bancone}
              </div>
              {order.cancel_message && (
                <div style={{ marginTop: 6 }}>
                  <em>Motivazione: {order.cancel_message}</em>
                </div>
              )}
            </div>
          ) : (
            <div className="banner" style={{ marginTop: 12 }}>✖️ Ordine annullato</div>
          )}
        </div>
        <Link className="btn ghost block" to="/menu">
          ← Torna al menù
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="muted">Il tuo numero</div>
        <div className="bignum">#{order.daily_number ?? '—'}</div>
        <div style={{ marginTop: 8 }}>
          <span className={`pill ${order.workflow_status}`}>
            {STATUS_EMOJI[order.workflow_status]}{' '}
            {order.workflow_status === ORDER_STATUSES.RITIRATO
              ? ritiratoLabel(order.service_mode)
              : STATUS_LABELS[order.workflow_status]}
          </span>
        </div>
        {myEta != null && (
          <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9rem' }}>
            ⏱ {order.service_mode === 'tavolo' ? 'Ti serviamo in' : 'Pronto in'} ~{myEta} min
          </p>
        )}
      </div>

      {/* Avanzamento della lavorazione: senza gestione della preparazione
          non c'è nessun percorso da mostrare al cliente. */}
      {workflowOn && (
      <div className="steps">
        {STATUS_FLOW.filter(
          (s) => s !== ORDER_STATUSES.RITIRATO && s !== ORDER_STATUSES.PAGATO
        ).map((s) => {
          const idx = STATUS_FLOW.indexOf(s)
          const cls =
            idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : ''
          return (
            <div className={`step ${cls}`} key={s}>
              {STATUS_EMOJI[s]}
              <br />
              {STATUS_LABELS[s]}
            </div>
          )
        })}
      </div>
      )}

      {workflowOn && 'Notification' in window && !notifOn && (
        <button className="btn secondary block" onClick={enableNotifications}>
          🔔 Avvisami quando è pronto
        </button>
      )}
      {notifMsg && (
        <p className="muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>
          {notifMsg}
        </p>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Riepilogo</h3>
        {(order.customer_name || order.table_label || order.service_mode) && (
          <p className="muted" style={{ marginTop: 0 }}>
            {order.customer_name ? `${order.customer_name}` : ''}
            {order.customer_name && (order.table_label || order.service_mode) ? ' · ' : ''}
            {order.table_label ? `Tavolo ${order.table_label}` : ''}
            {order.table_label && order.service_mode ? ' · ' : ''}
            {order.service_mode === 'banco'
              ? '🚶 Ritiro al banco'
              : order.service_mode === 'tavolo'
                ? '🍸 Servito al tavolo'
                : ''}
          </p>
        )}
        {editable && (
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            Puoi modificare o annullare l’ordine finché non viene preso in preparazione.
          </p>
        )}
        {order.note && (
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            📝 {order.note}
          </p>
        )}
        {editable
          ? editItems.map((i, idx) => (
              <div className="row between order-edit-row" key={i.id}>
                <span>{i.name}</span>
                <span className="qty">
                  <button aria-label="Riduci" onClick={() => changeQty(idx, -1)}>−</button>
                  <strong>{i.qty}</strong>
                  <button aria-label="Aumenta" onClick={() => changeQty(idx, 1)}>+</button>
                </span>
              </div>
            ))
          : (order.order_items || []).map((i) => (
              <div className="row between" key={i.id}>
                <span>
                  {i.qty}× {i.name}
                </span>
                <span className="price">{formatPrice(i.qty * i.unit_price)}</span>
              </div>
            ))}
        <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        {Number(order.coperto_amount) > 0 && (
          <div className="row between">
            <span className="muted">
              Coperto{order.coperto_persons > 0 ? ` (${order.coperto_persons} pers.)` : ''}
            </span>
            <span className="muted">{formatPrice(order.coperto_amount)}</span>
          </div>
        )}
        {Number(order.service_charge_amount) > 0 && (
          <div className="row between">
            <span className="muted">Servizio</span>
            <span className="muted">{formatPrice(order.service_charge_amount)}</span>
          </div>
        )}
        {Number(order.tip_amount) > 0 && (
          <div className="row between">
            <span className="muted">Mancia</span>
            <span className="muted">{formatPrice(order.tip_amount)}</span>
          </div>
        )}
        <div className="row between">
          <strong>Totale</strong>
          <strong className="price">{formatPrice(editable ? editTotal : order.total)}</strong>
        </div>
        {order.payment_status === 'pagato' && (
          <p className="muted small" style={{ margin: '8px 0 0', textAlign: 'right' }}>
            💳 Pagato{order.payment_method === 'online' ? ' online' : ''}
          </p>
        )}
      </div>

      {showPayment && <PaymentPanel order={order} />}

      {editable && (
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={() => setConfirmCancel(true)} disabled={saving}>
            ✖️ Annulla ordine
          </button>
          <button className="btn" onClick={saveEdits} disabled={saving}>
            {saving ? 'Salvo…' : 'Salva modifiche'}
          </button>
        </div>
      )}
      {!editable && cancellable && (
        <button
          className="btn ghost block"
          style={{ marginTop: 8 }}
          onClick={() => setConfirmCancel(true)}
          disabled={saving}
        >
          ✖️ Annulla ordine
        </button>
      )}

      {(() => {
        // Controlli di avanzamento per lo STAFF semplice (il bartender apre
        // il dettaglio POS, vedi OrderPosDetail): le regole gli consentono
        // solo pronto→ritirato e ritirato→pagato (incasso al banco).
        if (!viewerIsStaff || order.workflow_status === ORDER_STATUSES.ANNULLATO) return null
        const ns = nextStatus(order.workflow_status)
        const staffAllowed =
          order.workflow_status === ORDER_STATUSES.PRONTO ||
          order.workflow_status === ORDER_STATUSES.RITIRATO
        const isPay = ns === ORDER_STATUSES.PAGATO
        if (!ns || !staffAllowed || (isPay && order.payment_status === 'pagato')) return null
        return (
          <div className="card">
            <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              🛠 Gestione ordine
            </p>
            {/* Incasso: il METODO si sceglie, non si dà per scontato. Con un
                solo tasto "pagato" ogni conto finiva nei contanti, carta
                compresa, e la cassa a fine serata non tornava. */}
            {isPay ? (
              <div className="grid-2">
                {[
                  ['banco', '💶 Contanti'],
                  ['carta', '💳 Carta'],
                ].map(([metodo, label]) => (
                  <button
                    key={metodo}
                    className="btn"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true)
                      setError(null)
                      try {
                        await markOrderPaid(order.id, metodo)
                      } catch (e) {
                        setError(e.message)
                      } finally {
                        setSaving(false)
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                className="btn block"
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await updateOrderStatus(order.id, ns)
                  } catch (e) {
                    setError(e.message)
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {`Segna come “${ns === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[ns]}”`}
              </button>
            )}
          </div>
        )
      })()}

      {order.placed_by && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            ✍️ Ordine inserito da {placedByName(order.placed_by)}
          </p>
          {viewerIsStaff && (
            <>
              {!showQr ? (
                <button className="btn secondary block" onClick={() => setShowQr(true)}>
                  📲 Mostra QR al cliente
                </button>
              ) : qr ? (
                <>
                  <img src={qr} alt="QR ordine" style={{ borderRadius: 12, maxWidth: 260 }} />
                  <p className="muted" style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
                    Il cliente scansiona e segue l’ordine dal suo telefono.
                  </p>
                </>
              ) : (
                <p className="muted">Genero il QR…</p>
              )}
              <Link className="btn block" style={{ marginTop: 10 }} to="/bar">
                🧾 Torna al gestionale
              </Link>
            </>
          )}
        </div>
      )}

      <Link className="btn ghost block" to="/menu">
        ← Torna al menù
      </Link>

      {confirmCancel && (
        <ConfirmDialog
          title="✖️ Annullare il tuo ordine?"
          message={
            order.payment_status === 'in_attesa'
              ? "L'ordine verrà annullato definitivamente. Un pagamento non completato non viene addebitato."
              : "L'ordine verrà annullato definitivamente."
          }
          confirmLabel="Annulla ordine"
          cancelLabel="Indietro"
          danger
          onCancel={() => setConfirmCancel(false)}
          onConfirm={cancelMyOrder}
        />
      )}
    </div>
  )
}
