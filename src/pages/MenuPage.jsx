import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchDrinks } from '../lib/api.js'
import { createOrder } from '../lib/api.js'
import { useCart, rememberOrderId } from '../lib/cart.js'
import { formatPrice } from '../lib/orderStatus.js'
import { isFirebaseConfigured } from '../lib/firebaseClient.js'

export default function MenuPage() {
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cart = useCart()

  // Il QR può contenere ?tavolo=12 per identificare il tavolo.
  const tableLabel = params.get('tavolo') || params.get('table') || ''

  useEffect(() => {
    let active = true
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    fetchDrinks({ onlyAvailable: true })
      .then((d) => active && setDrinks(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const categories = useMemo(() => {
    const map = new Map()
    for (const d of drinks) {
      const cat = d.category || 'Altro'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(d)
    }
    return [...map.entries()]
  }, [drinks])

  async function handleSend() {
    if (cart.items.length === 0) return
    setSending(true)
    setError(null)
    try {
      const order = await createOrder({
        table_label: tableLabel,
        items: cart.items,
      })
      rememberOrderId(order.id)
      cart.clear()
      navigate(`/ordine/${order.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="empty">Carico il menù…</div>

  return (
    <div>
      <div className="card">
        <h2 style={{ margin: '4px 0' }}>🍸 Menù drink</h2>
        <p className="muted" style={{ margin: 0 }}>
          {tableLabel
            ? `Stai ordinando dal tavolo ${tableLabel}.`
            : 'Scegli i tuoi drink e invia l’ordine al bancone.'}
        </p>
      </div>

      {error && <div className="banner">Errore: {error}</div>}

      {drinks.length === 0 && !error && (
        <div className="empty">
          Nessun drink disponibile al momento.
        </div>
      )}

      {categories.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="muted" style={{ margin: '18px 4px 4px' }}>{cat}</h3>
          {list.map((d) => {
            const inCart = cart.items.find((i) => i.drink_id === d.id)
            return (
              <div className="card menu-item" key={d.id}>
                <div className="row between">
                  {d.image_url && (
                    <img className="drink-thumb" src={d.image_url} alt={d.name} />
                  )}
                  <div className="grow">
                    <h3>{d.name}</h3>
                    {d.description && (
                      <p className="muted" style={{ margin: '0 0 6px' }}>
                        {d.description}
                      </p>
                    )}
                    <span className="price">{formatPrice(d.price)}</span>
                  </div>
                  {inCart ? (
                    <div className="qty">
                      <button
                        aria-label="Riduci"
                        onClick={() => cart.setQty(d.id, inCart.qty - 1)}
                      >
                        −
                      </button>
                      <strong>{inCart.qty}</strong>
                      <button
                        aria-label="Aumenta"
                        onClick={() => cart.setQty(d.id, inCart.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button className="btn small" onClick={() => cart.add(d)}>
                      Aggiungi
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      {cart.count > 0 && (
        <div className="cartbar">
          <div className="inner row between">
            <div>
              <div>
                <strong>{cart.count}</strong> drink ·{' '}
                <span className="price">{formatPrice(cart.total)}</span>
              </div>
              <button
                className="btn ghost small"
                style={{ marginTop: 6 }}
                onClick={cart.clear}
              >
                Svuota
              </button>
            </div>
            <button
              className="btn"
              disabled={sending}
              onClick={handleSend}
            >
              {sending ? 'Invio…' : 'Invia ordine'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
