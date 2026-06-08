import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchDrinks, fetchCategories, subscribeOpenSerata } from '../lib/api.js'
import { createOrder } from '../lib/api.js'
import { useCart, rememberOrderId } from '../lib/cart.js'
import { formatPrice } from '../lib/orderStatus.js'
import { formatQty } from '../lib/inventory.js'
import { isFirebaseConfigured } from '../lib/firebaseClient.js'

export default function MenuPage() {
  const [drinks, setDrinks] = useState([])
  const [cats, setCats] = useState([])
  const [serata, setSerata] = useState(undefined) // undefined=caricamento, null=chiuso
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
    Promise.all([
      fetchDrinks({ onlyAvailable: true }),
      fetchCategories().catch(() => []),
    ])
      .then(([d, c]) => {
        if (!active) return
        setDrinks(d)
        setCats(c)
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // Osserva la serata aperta: senza serata gli ordini sono bloccati.
  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsub = subscribeOpenSerata(
      (s) => setSerata(s),
      () => setSerata(null)
    )
    return unsub
  }, [])

  const categories = useMemo(() => {
    const byId = new Map(cats.map((c) => [c.id, c]))
    const groups = new Map() // key -> { name, sort, list }
    for (const d of drinks) {
      const cat = byId.get(d.category_id)
      const name = cat?.name || d.category || 'Altro'
      const sort = cat ? cat.sort_order : 9999
      if (!groups.has(name)) groups.set(name, { name, sort, list: [] })
      groups.get(name).list.push(d)
    }
    return [...groups.values()]
      .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
      .map((g) => [g.name, g.list])
  }, [drinks, cats])

  async function handleSend() {
    if (cart.items.length === 0) return
    if (!serata) {
      setError('Il servizio è chiuso: nessuna serata aperta.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const order = await createOrder({
        table_label: tableLabel,
        items: cart.items,
        serata_id: serata.id,
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

  const closed = serata === null

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

      {closed && (
        <div className="banner">
          🔒 Servizio chiuso: gli ordini non sono disponibili al momento.
        </div>
      )}

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
                    {d.recipe_items && d.recipe_items.length > 0 && (
                      <p className="ingredients">
                        {d.recipe_items
                          .map((r) => `${r.name} ${formatQty(r.qty, r.unit)}`)
                          .join(' · ')}
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
              disabled={sending || closed}
              onClick={handleSend}
            >
              {closed ? 'Chiuso' : sending ? 'Invio…' : 'Invia ordine'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
