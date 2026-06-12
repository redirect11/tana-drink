import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../lib/firebaseClient.js'
import {
  subscribeOpenSerata,
  subscribeSerataOrders,
  subscribeSettings,
  subscribeMyCalls,
  ackStaffCall,
  saveStaffToken,
  updateOrderStatus,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { getPushToken } from '../lib/push.js'
import { ORDER_STATUSES, formatPrice, placedByName } from '../lib/orderStatus.js'
import { notify, ensureNotificationPermission } from '../lib/notify.js'

// Vista cameriera: SOLO gli ordini pronti da servire ai tavoli, con il
// tasto per segnarli come serviti. Nessun'altra funzione del gestionale.
export default function ServiceQueue() {
  const [serata, setSerata] = useState(undefined)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    return subscribeOpenSerata(
      (s) => setSerata(s),
      () => setSerata(null)
    )
  }, [])

  const serataId = serata?.id
  useEffect(() => {
    if (!serataId) {
      setOrders([])
      return
    }
    return subscribeSerataOrders(serataId, setOrders, (e) => setError(e.message))
  }, [serataId])

  // Impostazioni (per il numero di membri dello staff → divisione mance).
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings), [])

  // ── Cerca-persone: chiamate in arrivo dal bancone ───────────────────
  const [calls, setCalls] = useState([])
  const vibrateTimer = useRef(null)
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    return subscribeMyCalls(uid, setCalls)
  }, [])

  // Cintura di sicurezza lato pagina: se il gestionale è sotto gli
  // occhi, le notifiche «da servire» sono rumore — chiudile appena la
  // lista si aggiorna o si torna sull'app (il service worker prova già
  // a non mostrarle, ma il controllo di visibilità non è infallibile).
  useEffect(() => {
    function closeServeNotifications() {
      if (document.visibilityState !== 'visible') return
      navigator.serviceWorker
        ?.getRegistration?.()
        .then((reg) => reg?.getNotifications?.())
        .then((ns) =>
          ns
            ?.filter((n) => (n.tag || '').startsWith('staff-serve'))
            .forEach((n) => n.close())
        )
        .catch(() => {})
    }
    closeServeNotifications()
    document.addEventListener('visibilitychange', closeServeNotifications)
    window.addEventListener('focus', closeServeNotifications)
    return () => {
      document.removeEventListener('visibilitychange', closeServeNotifications)
      window.removeEventListener('focus', closeServeNotifications)
    }
  }, [orders])

  // Registra il token push del dispositivo: così la chiamata arriva
  // come notifica di sistema anche con l'app in background o chiusa.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    ensureNotificationPermission().then(async (ok) => {
      if (!ok) return
      const token = await getPushToken()
      if (token) saveStaffToken(uid, token).catch(() => {})
    })
  }, [])

  const incoming = calls[0] ?? null
  useEffect(() => {
    if (!incoming) {
      if (vibrateTimer.current) {
        clearInterval(vibrateTimer.current)
        vibrateTimer.current = null
        navigator.vibrate?.(0) // ferma la vibrazione in corso
      }
      // Chiudi anche la notifica di sistema della chiamata, se presente.
      navigator.serviceWorker
        ?.getRegistration?.()
        .then((reg) => reg?.getNotifications?.({ tag: 'staff-call' }))
        .then((ns) => ns?.forEach((n) => n.close()))
        .catch(() => {})
      return
    }
    // Notifica + vibrazione forte e continua finché non si risponde.
    // Stesso tag della push FCM: se arrivano entrambe, una sola notifica.
    notify('📟 Chiamata dal bancone', incoming.message || 'Rispondi sul telefono.', {
      vibrate: [500, 200, 500, 200, 900],
      tag: 'staff-call',
      renotify: true,
      requireInteraction: true,
    })
    const pattern = [500, 200, 500, 200, 900]
    navigator.vibrate?.(pattern)
    vibrateTimer.current = setInterval(() => navigator.vibrate?.(pattern), 2600)
    return () => {
      clearInterval(vibrateTimer.current)
      vibrateTimer.current = null
      navigator.vibrate?.(0)
    }
  }, [incoming?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function rispondi() {
    try {
      await ackStaffCall(incoming.id)
    } catch (e) {
      setError(e.message)
    }
  }

  async function servito(o) {
    setBusyId(o.id)
    setError(null)
    try {
      await updateOrderStatus(o.id, ORDER_STATUSES.RITIRATO)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  // Da servire: pronti, al tavolo (il ritiro al banco lo gestisce il bancone).
  const daServire = orders
    .filter((o) => o.status === ORDER_STATUSES.PRONTO && o.service_mode !== 'banco')
    .sort((a, b) => (a.daily_number || 0) - (b.daily_number || 0))

  // Mance della serata, divise equamente tra i membri dello staff.
  const mance = orders
    .filter((o) => o.status !== ORDER_STATUSES.ANNULLATO)
    .reduce((s, o) => s + (Number(o.tip_amount) || 0), 0)
  const membri = Math.max(1, Number(settings.staff_count) || 1)

  return (
    <div>
      <div className="card">
        <strong>🫱 Servizio ai tavoli</strong>
        <div className="muted">
          {serata === undefined
            ? 'Carico…'
            : serata
              ? `${daServire.length} da servire`
              : 'Nessuna serata aperta'}
        </div>
        <Link className="btn block" style={{ marginTop: 12 }} to="/">
          ✍️ Nuovo ordine dal menù
        </Link>
      </div>

      {error && <div className="banner">Errore: {error}</div>}

      {serata && mance > 0 && (
        <div className="card row between" style={{ alignItems: 'center' }}>
          <span className="muted">💶 Mance serata</span>
          <span>
            <strong className="price">{formatPrice(mance)}</strong>{' '}
            <span className="muted small">
              · {formatPrice(mance / membri)} a testa ({membri} membri)
            </span>
          </span>
        </div>
      )}

      {serata && daServire.length === 0 && (
        <div className="empty">Nessun drink pronto da servire. 🎉</div>
      )}

      {daServire.map((o) => (
        <div className="card order-card pronto" key={o.id}>
          <div className="row between">
            <div>
              <span className="bignum" style={{ fontSize: '2rem' }}>
                #{o.daily_number ?? '—'}
              </span>{' '}
              {o.customer_name && <strong>{o.customer_name}</strong>}{' '}
              {o.table_label && <span className="muted">· Tavolo {o.table_label}</span>}
            </div>
            <span className="price">{formatPrice(o.total)}</span>
          </div>
          <div style={{ margin: '8px 0' }}>
            {(o.order_items || []).map((i) => (
              <div className="row between" key={i.id}>
                <span>{i.qty}× {i.name}</span>
              </div>
            ))}
          </div>
          {o.placed_by && (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              ✍️ Inserito da {placedByName(o.placed_by)}
            </p>
          )}
          {o.note && <div className="order-note">📝 {o.note}</div>}
          <button
            className="btn block"
            disabled={busyId === o.id}
            onClick={() => servito(o)}
          >
            {busyId === o.id ? 'Segno…' : '✓ Servito'}
          </button>
        </div>
      ))}

      {incoming && (
        <div className="overlay confirm-overlay">
          <div className="confirm-box pager-call">
            <div className="pager-icon">📟</div>
            <h3 style={{ margin: '8px 0' }}>Chiamata dal bancone</h3>
            {incoming.from_name && (
              <p className="muted" style={{ margin: 0 }}>da {incoming.from_name}</p>
            )}
            {incoming.message && (
              <p style={{ fontSize: '1.05rem', margin: '12px 0 0' }}>
                «{incoming.message}»
              </p>
            )}
            <button className="btn block" style={{ marginTop: 18 }} onClick={rispondi}>
              ✓ Rispondo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
