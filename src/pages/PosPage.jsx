import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { subscribeOpenSerata } from '../lib/api.js'
import { submitPosOrder } from '../lib/pendingOrders.js'
import { useMenu } from '../lib/menuCache.js'
import { useCart } from '../lib/cart.js'
import { formatPrice } from '../lib/orderStatus.js'
import { auth } from '../lib/firebaseClient.js'
import { onAuthStateChanged } from 'firebase/auth'
import PosProductPicker from '../components/PosProductPicker.jsx'
import CustomDrinkForm from '../components/CustomDrinkForm.jsx'

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

  function handleSend({ printNow = false } = {}) {
    if (cart.items.length === 0) return
    if (!serata?.id) {
      setError('Nessuna serata aperta: apri la serata dal gestionale.')
      return
    }
    // Invio in background: lo store crea l'ordine (e stampa la comanda) mentre
    // torniamo subito alla griglia, dove l'ordine appare in caricamento.
    submitPosOrder({
      serata_id: serata.id,
      table_label: tableLabel || null,
      note: note || null,
      customer_name: customerName.trim() || null,
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
      {serata === null && (
        <div className="banner" style={{ margin: '8px 8px 0', flexShrink: 0 }}>
          Nessuna serata aperta. Apri la serata dal gestionale prima di prendere ordini.
        </div>
      )}

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
              🍹 Drink custom
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
              {/* Conferma = crea l'ordine SENZA stampare; la stampa della
                  comanda è esplicita nel bottone accanto. */}
              <button
                className="btn secondary small"
                disabled={cartCount === 0 || !serata}
                onClick={() => handleSend({ printNow: false })}
              >
                ✅ Conferma
              </button>
              <button
                className="btn small"
                disabled={cartCount === 0 || !serata}
                onClick={() => handleSend({ printNow: true })}
              >
                🖨 Conferma + stampa comanda
              </button>
            </div>
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
    </div>
  )
}
