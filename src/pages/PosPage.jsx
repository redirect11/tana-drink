import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { subscribeOpenSerata } from '../lib/api.js'
import { submitPosOrder } from '../lib/pendingOrders.js'
import { useMenu } from '../lib/menuCache.js'
import { useCart } from '../lib/cart.js'
import { formatPrice } from '../lib/orderStatus.js'
import { auth } from '../lib/firebaseClient.js'
import { onAuthStateChanged } from 'firebase/auth'
import { DrinkTile } from '../components/PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'

// ── POS: griglia prodotti + categorie laterali ─────────────────────────────
// Interfaccia per il bartender/staff che batte ordini direttamente al banco.
// Design: categorie come colonna sinistra, prodotti come griglia 2-3 colonne.

export default function PosPage() {
  const navigate = useNavigate()
  const { drinks, cats, loading } = useMenu()
  const cart = useCart()
  const [selectedCat, setSelectedCat] = useState(null)
  const [serata, setSerata] = useState(undefined)
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState(null)
  const [tableLabel, setTableLabel] = useState('')
  const [note, setNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const gridRef = useRef(null)

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

  // Seleziona la prima categoria al caricamento
  useEffect(() => {
    if (cats.length > 0 && selectedCat === null) setSelectedCat(cats[0].id ?? cats[0].name)
  }, [cats, selectedCat])

  // Cambia categoria e scrolla in cima alla griglia
  function selectCat(catKey) {
    setSelectedCat(catKey)
    gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const catKey = (c) => c.id ?? c.name

  // Prodotti della categoria selezionata
  const visibleDrinks = !selectedCat || selectedCat === '__all__'
    ? drinks.filter((d) => d.available)
    : drinks.filter((d) => d.available && (d.category_id === selectedCat || d.category === selectedCat))

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* ── Barra in alto: indietro + titolo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
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

      {/* ── Layout principale: sidebar + griglia ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>

        {/* ── Sidebar categorie ── */}
        <aside style={{
          width: 120,
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {/* "Tutto" shortcut */}
          <button
            onClick={() => selectCat('__all__')}
            style={catBtnStyle(selectedCat === '__all__')}
          >
            Tutti
          </button>

          {cats.map((c) => (
            <button
              key={catKey(c)}
              onClick={() => selectCat(catKey(c))}
              style={catBtnStyle(selectedCat === catKey(c))}
            >
              {c.name}
            </button>
          ))}
        </aside>

        {/* ── Griglia prodotti ── */}
        <div
          ref={gridRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 8px 140px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            alignContent: 'start',
            gap: 10,
          }}
        >
          {loading && <div className="empty" style={{ gridColumn: '1/-1' }}>Carico…</div>}

          {!loading && visibleDrinks.length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              Nessun prodotto in questa categoria.
            </div>
          )}

          {visibleDrinks.map((d) => {
            const inCart = cart.items.find((i) => i.drink_id === d.id)
            return (
              <DrinkTile
                key={d.id}
                drink={d}
                qty={inCart?.qty ?? 0}
                onAdd={() => cart.add(d)}
                onSetQty={(q) => cart.setQty(d.id, q)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Barra carrello fissa in basso ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--surface, #1a1a2e)',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 100,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}>

        {/* Riga nome + tavolo + nota (come SumUp: l'ordine porta il nome del cliente) */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Nome (opz.)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ flex: 1, minWidth: 90, padding: '6px 10px', borderRadius: 8, fontSize: '0.9rem',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit' }}
          />
          <input
            type="text"
            placeholder="Tavolo (opz.)"
            value={tableLabel}
            onChange={(e) => setTableLabel(e.target.value)}
            style={{ width: 100, padding: '6px 10px', borderRadius: 8, fontSize: '0.9rem',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit' }}
          />
          <input
            type="text"
            placeholder="Nota (opz.)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: '0.9rem',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit' }}
          />
        </div>

        {/* Riga totale + azioni */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Riepilogo carrello */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {cartCount > 0 ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {formatPrice(cart.total)}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {cartCount} prodott{cartCount === 1 ? 'o' : 'i'}
                  {cart.items.slice(0, 2).map((i) => ` · ${i.qty}× ${i.name}`).join('')}
                  {cart.items.length > 2 ? ` +${cart.items.length - 2}` : ''}
                </div>
              </>
            ) : (
              <div className="muted" style={{ fontSize: '0.9rem' }}>Carrello vuoto</div>
            )}
          </div>

          {/* Svuota */}
          {cartCount > 0 && (
            <button
              className="btn ghost small"
              onClick={cart.clear}
              style={{ flexShrink: 0 }}
            >
              Svuota
            </button>
          )}

          {/* Invia + stampa comanda */}
          <button
            className="btn small"
            disabled={cartCount === 0 || !serata}
            onClick={() => handleSend({ printNow: true })}
            style={{ flexShrink: 0 }}
          >
            🖨 Invia + comanda
          </button>

          {/* Invia senza stampa */}
          <button
            className="btn secondary small"
            disabled={cartCount === 0 || !serata}
            onClick={() => handleSend({ printNow: false })}
            style={{ flexShrink: 0 }}
          >
            Invia
          </button>
        </div>
      </div>
    </div>
  )
}
