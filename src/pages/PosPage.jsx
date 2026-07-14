import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  subscribeOpenSerata,
  openSerata,
  createOrder,
  subscribeOrder,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { ORDER_STATUSES } from '../lib/orderStatus.js'
import { submitPosOrder } from '../lib/pendingOrders.js'
import { useMenu } from '../lib/menuCache.js'
import { useCart } from '../lib/cart.js'
import { formatPrice } from '../lib/orderStatus.js'
import { auth } from '../lib/firebaseClient.js'
import { onAuthStateChanged } from 'firebase/auth'
import PosProductPicker from '../components/PosProductPicker.jsx'
import CustomDrinkForm from '../components/CustomDrinkForm.jsx'
import PaymentScreen from '../components/PaymentScreen.jsx'

// ── POS cassa: creazione ordine in stile SumUp ─────────────────────────────
// Layout identico al dettaglio ordine: categorie a sinistra, griglia prodotti
// al centro e, A DESTRA, i prodotti dell'ordine in composizione (la comanda)
// con nome/tavolo/nota, totale e invio.

export default function PosPage() {
  const navigate = useNavigate()
  const { drinks, cats, loading } = useMenu()
  const cart = useCart()
  const [serata, setSerata] = useState(undefined)
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState(null)
  const [tableLabel, setTableLabel] = useState('')
  const [note, setNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  // Modale nome alla conferma ('save' | 'save-print' | null).
  const [askName, setAskName] = useState(null)
  const [busyPay, setBusyPay] = useState(false)
  // Pagamento diretto: ordine appena creato + suoi aggiornamenti live.
  const [payOrder, setPayOrder] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const payOrderId = payOrder?.id
  useEffect(() => {
    if (!payOrderId) return
    return subscribeOrder(payOrderId, (o) => o && setPayOrder(o), () => {})
  }, [payOrderId])

  // POS a tutto schermo: esce dal contenitore centrato .app (max 760px) così
  // la griglia prodotti riempie tutta la larghezza (utile su tablet).
  useEffect(() => {
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [])

  useEffect(() => subscribeOpenSerata((s) => setSerata(s), () => setSerata(null)), [])

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setStaff(null)
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        if (role === 'bartender' || role === 'staff') {
          setStaff({ email: u.email, name: u.displayName || u.email, role })
        }
      } catch { setStaff(null) }
    })
  }, [])

  const qtyByDrink = useMemo(() => {
    const m = {}
    for (const i of cart.items) if (!i.custom) m[i.drink_id] = (m[i.drink_id] || 0) + i.qty
    return m
  }, [cart.items])

  // La serata NON è più un prerequisito: se manca, si apre da sola al
  // primo ordine (resta la chiusura manuale per il resoconto).
  async function ensureSerataId() {
    if (serata?.id) return serata.id
    const s = await openSerata()
    return s.id
  }

  async function handleSend({ printNow = false, name = customerName } = {}) {
    if (cart.items.length === 0) return
    let serataId
    try {
      serataId = await ensureSerataId()
    } catch (e) {
      setError(`Serata non apribile: ${e.message}`)
      return
    }
    // Invio in background: lo store crea l'ordine (e stampa la comanda) mentre
    // torniamo subito alla griglia, dove l'ordine appare in caricamento.
    submitPosOrder({
      serata_id: serataId,
      table_label: tableLabel || null,
      note: note || null,
      customer_name: (name || '').trim() || null, // vuoto = resta il progressivo #N
      items: cart.items,
      placed_by: staff ? { email: staff.email, name: staff.name, role: staff.role } : undefined,
      printNow,
    })
    cart.clear()
    setTableLabel('')
    setNote('')
    setCustomerName('')
    navigate('/bar')
  }

  // PAGAMENTO DIRETTO: crea il conto e apre subito la schermata Pagamento,
  // senza passare dalla coda. Se viene saldato lì, il conto nasce e muore
  // chiuso (non comparirà tra gli aperti); se si esce senza saldare resta
  // un conto aperto come gli altri.
  async function handlePayNow() {
    if (cart.items.length === 0 || busyPay) return
    setBusyPay(true)
    setError(null)
    try {
      const serataId = await ensureSerataId()
      const created = await createOrder({
        serata_id: serataId,
        table_label: tableLabel || null,
        note: note || null,
        customer_name: customerName.trim() || null,
        items: cart.items,
        placed_by: staff ? { email: staff.email, name: staff.name, role: staff.role } : undefined,
        status: ORDER_STATUSES.IN_PREPARAZIONE,
      })
      setPayOrder(created)
      cart.clear()
      setTableLabel('')
      setNote('')
      setCustomerName('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyPay(false)
    }
  }

  const cartCount = cart.items.reduce((s, i) => s + i.qty, 0)

  // Gli input ereditano lo stile globale (segue il tema); qui solo layout.
  const inputStyle = { width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* ── Barra in alto: indietro + titolo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', flexShrink: 0,
        borderBottom: '1px solid var(--line)' }}>
        <Link className="btn ghost small" to="/bar" aria-label="Torna agli ordini">← Ordini</Link>
        <strong style={{ fontFamily: 'var(--serif)' }}>POS cassa</strong>
      </div>

      {/* ── Banner errori ── */}
      {error && <div className="banner" style={{ margin: '8px 8px 0', flexShrink: 0 }}>{error}</div>}

      {/* ── Corpo a 3 colonne: categorie · griglia · comanda ── */}
      <div className="posd-body">
        <PosProductPicker
          drinks={drinks}
          cats={cats}
          loading={loading}
          qtyByDrink={qtyByDrink}
          onAdd={(d) => cart.add(d)}
          onSetQty={(d, q) => cart.setQty(d.id, q)}
        />

        {/* ── Pannello destro: la comanda in composizione ── */}
        <div className="posd-comanda">
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            <div className="muted small" style={{ letterSpacing: 0.5 }}>ORDINE</div>

            {cart.items.length === 0 && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Tocca i prodotti per aggiungerli all'ordine.
              </p>
            )}
            {cart.items.map((i, idx) => (
              <div className="row between" key={i.drink_id ?? idx} style={{ alignItems: 'center', marginTop: 6 }}>
                <span className="grow" style={{ fontSize: '0.92rem' }}>
                  {i.custom ? '✨ ' : ''}{i.name}
                  <span className="muted small"> · {formatPrice(i.price)}</span>
                </span>
                <span className="qty">
                  <button aria-label="Riduci" onClick={() => cart.setQty(i.drink_id, i.qty - 1)}>−</button>
                  <strong>{i.qty}</strong>
                  <button aria-label="Aumenta" onClick={() => cart.setQty(i.drink_id, i.qty + 1)}>+</button>
                </span>
              </div>
            ))}

            <button
              className="btn ghost small block"
              style={{ marginTop: 10 }}
              onClick={() => setShowCustom(true)}
            >
              🏷 Prodotto libero
            </button>

            {/* Dati conto (nome/tavolo/note), identico al dettaglio ordine */}
            <button
              className="btn ghost small block"
              style={{ marginTop: 10 }}
              onClick={() => setShowInfo((v) => !v)}
            >
              {showInfo ? 'Nascondi dati conto' : '👤 Dati conto (nome, tavolo, note)'}
            </button>
            {showInfo && (
              <div style={{ marginTop: 6 }}>
                <label htmlFor="pos-name">Nome</label>
                <input
                  id="pos-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={inputStyle}
                />
                <div className="grid-2" style={{ marginTop: 6 }}>
                  <div>
                    <label htmlFor="pos-table">Tavolo</label>
                    <input
                      id="pos-table"
                      value={tableLabel}
                      onChange={(e) => setTableLabel(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="pos-note">Note</label>
                    <input
                      id="pos-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer: totale + invio */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 12px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div className="row between">
              <span className="muted small">
                {cartCount > 0 ? `${cartCount} prodott${cartCount === 1 ? 'o' : 'i'}` : 'Comanda vuota'}
              </span>
              {cartCount > 0 && (
                <button className="btn ghost small" onClick={cart.clear}>Svuota</button>
              )}
            </div>
            <div className="row between">
              <strong>Totale</strong>
              <strong className="price">{formatPrice(cart.total)}</strong>
            </div>
            <div className="grid-2">
              {/* Conferma = salva il conto (il nome si chiede nella modale);
                  la stampa della comanda è esplicita nel bottone accanto. */}
              <button
                className="btn secondary small"
                disabled={cartCount === 0}
                onClick={() => setAskName('save')}
              >
                ✅ Conferma
              </button>
              <button
                className="btn small"
                disabled={cartCount === 0}
                onClick={() => setAskName('save-print')}
              >
                🖨 Conferma + stampa comanda
              </button>
            </div>
            {/* Vendita rapida: dritto alla schermata Pagamento, senza
                passare dalla coda (il conto saldato non appare tra gli aperti). */}
            <button
              className="btn block"
              disabled={cartCount === 0 || busyPay}
              onClick={handlePayNow}
            >
              💳 Pagamento{busyPay ? '…' : ` · ${formatPrice(cart.total)}`}
            </button>
          </div>
        </div>
      </div>

      {showCustom && (
        <CustomDrinkForm
          onCancel={() => setShowCustom(false)}
          onAdd={(item) => {
            cart.addCustom(item)
            setShowCustom(false)
          }}
        />
      )}

      {/* ── Modale nome conto alla conferma: vuoto = progressivo #N,
          modificabile poi dai Dati conto nella modifica ordine. ── */}
      {askName && (
        <div className="overlay confirm-overlay" onClick={() => setAskName(null)}>
          <form
            className="confirm-box"
            role="dialog"
            aria-label="Nome del conto"
            style={{ width: 'min(360px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              const mode = askName
              setAskName(null)
              handleSend({ printNow: mode === 'save-print' })
            }}
          >
            <h3 style={{ margin: 0 }}>👤 Nome del conto</h3>
            <p className="muted small" style={{ margin: '8px 0' }}>
              Vuoto = numero progressivo. Si può cambiare dopo, dai Dati conto.
            </p>
            <label htmlFor="pos-askname">Nome</label>
            <input
              id="pos-askname"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Es. Marco, Tavolo 4…"
              autoFocus
            />
            <button className="btn block" type="submit" style={{ marginTop: 10 }}>
              Salva{customerName.trim() ? '' : ' senza nome'}
              {askName === 'save-print' ? ' e stampa' : ''}
            </button>
          </form>
        </div>
      )}

      {/* ── Pagamento diretto sull'ordine appena creato ── */}
      {payOrder && (
        <PaymentScreen
          order={payOrder}
          settings={settings}
          onClose={() => setPayOrder(null)}
          onError={setError}
        />
      )}
    </div>
  )
}
