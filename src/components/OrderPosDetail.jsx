import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  advanceComanda,
  addComanda,
  bartenderUpdateComanda,
  updateOrderInfo,
  markOrderPaid,
  cancelOrder,
} from '../lib/api.js'
import { useMenu } from '../lib/menuCache.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  formatPrice,
  placedByName,
} from '../lib/orderStatus.js'
import { nextComandaStatus, comandaDone, allServed, orderIsClosed } from '../lib/comande.js'
import { printComanda, printScontrino } from '../lib/printer.js'
import { DrinkTile } from './PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'
import CustomDrinkForm from './CustomDrinkForm.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'

// ── Dettaglio ordine in stile POS (SumUp) — solo bartender ────────────────
// Il CONTO resta aperto: toccando i prodotti si compone una NUOVA COMANDA
// (come "aggiungi un ordine" su SumUp) da inviare al bar; nel tab Comande si
// gestiscono i ticket esistenti (avanzamento stato, quantità, ristampa).
// Il conto si chiude solo con l'incasso (avviso se restano comande aperte)
// o con l'annullo.

export default function OrderPosDetail({ order }) {
  const { drinks, cats, loading } = useMenu()
  const [selectedCat, setSelectedCat] = useState(null)
  const [view, setView] = useState('menu') // 'menu' | 'comande'
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)
  const gridRef = useRef(null)

  // NUOVA comanda in composizione (bozza locale, non ancora inviata).
  const [newItems, setNewItems] = useState([])

  // POS a tutto schermo, come la cassa.
  useEffect(() => {
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [])

  useEffect(() => {
    if (cats.length > 0 && selectedCat === null) setSelectedCat('__all__')
  }, [cats, selectedCat])

  const catKey = (c) => c.id ?? c.name
  const visibleDrinks =
    !selectedCat || selectedCat === '__all__'
      ? drinks.filter((d) => d.available)
      : drinks.filter(
          (d) => d.available && (d.category_id === selectedCat || d.category === selectedCat)
        )

  const closed = orderIsClosed(order)
  const comande = order.comande || []
  const served = allServed(order)

  async function run(fn) {
    setSaving(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Nuova comanda (bozza) ──
  function addDrink(d) {
    if (closed) return
    setNewItems((items) => {
      const idx = items.findIndex((i) => !i.custom && i.drink_id === d.id)
      if (idx >= 0) return items.map((i, j) => (j === idx ? { ...i, qty: i.qty + 1 } : i))
      return [
        ...items,
        {
          drink_id: d.id,
          name: d.name,
          unit_price: d.price,
          qty: 1,
          sumup_product_id: d.sumup_product_id ?? null,
        },
      ]
    })
  }
  function setNewQty(idx, qty) {
    setNewItems((items) =>
      items.map((i, j) => (j === idx ? { ...i, qty } : i)).filter((i) => i.qty > 0)
    )
  }
  const qtyByDrink = useMemo(() => {
    const m = {}
    for (const i of newItems) if (!i.custom) m[i.drink_id] = (m[i.drink_id] || 0) + i.qty
    return m
  }, [newItems])
  const newTotal = newItems.reduce((s, i) => s + i.qty * i.unit_price, 0)

  const sendComanda = () =>
    run(async () => {
      await addComanda(order.id, newItems)
      setNewItems([])
      setView('comande')
    })

  // ── Comande esistenti ──
  function comandaQtyChange(comanda, idx, delta) {
    const items = comanda.items
      .map((i, j) => (j === idx ? { ...i, qty: i.qty + delta } : i))
      .filter((i) => i.qty > 0)
    run(() => bartenderUpdateComanda(order.id, comanda.id, { items }))
  }

  // ── Info conto ──
  const [info, setInfo] = useState({
    customer_name: order.customer_name || '',
    table_label: order.table_label || '',
    note: order.note || '',
  })
  const orderId = order.id
  useEffect(() => {
    setInfo({
      customer_name: order.customer_name || '',
      table_label: order.table_label || '',
      note: order.note || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])
  const infoDirty =
    info.customer_name !== (order.customer_name || '') ||
    info.table_label !== (order.table_label || '') ||
    info.note !== (order.note || '')

  const extras =
    Number(order.coperto_amount || 0) +
    Number(order.service_charge_amount || 0) +
    Number(order.tip_amount || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* ── Barra in alto ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Link className="btn ghost small" to="/bar" aria-label="Torna agli ordini">← Ordini</Link>
        <strong style={{ fontFamily: 'var(--serif)' }}>
          #{order.daily_number ?? '—'}
          {order.customer_name ? ` · ${order.customer_name}` : ''}
        </strong>
        <span className={`pill ${order.status}`}>
          {STATUS_EMOJI[order.status]} {STATUS_LABELS[order.status]}
        </span>
        {order.placed_by && (
          <span className="muted small">✍️ {placedByName(order.placed_by)}</span>
        )}
        {order.payment_status === 'pagato' && order.status !== ORDER_STATUSES.PAGATO && (
          <span className="muted small">💳 pagato</span>
        )}
      </div>

      {error && <div className="banner" style={{ margin: '8px 8px 0', flexShrink: 0 }}>{error}</div>}

      {/* ── Corpo ── */}
      <div className="posd-body">
        {/* Sidebar categorie (solo vista menù) */}
        {view === 'menu' && (
          <aside
            style={{
              width: 104,
              flexShrink: 0,
              overflowY: 'auto',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              padding: '8px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <button onClick={() => setSelectedCat('__all__')} style={catBtnStyle(selectedCat === '__all__')}>
              Tutti
            </button>
            {cats.map((c) => (
              <button
                key={catKey(c)}
                onClick={() => {
                  setSelectedCat(catKey(c))
                  gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                style={catBtnStyle(selectedCat === catKey(c))}
              >
                {c.name}
              </button>
            ))}
          </aside>
        )}

        {/* Centro: griglia prodotti o storico comande */}
        {view === 'menu' ? (
          <div
            ref={gridRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              alignContent: 'start',
              gap: 10,
              opacity: closed ? 0.5 : 1,
              pointerEvents: closed ? 'none' : 'auto',
            }}
          >
            {loading && <div className="empty" style={{ gridColumn: '1/-1' }}>Carico…</div>}
            {!loading && visibleDrinks.length === 0 && (
              <div className="empty" style={{ gridColumn: '1/-1' }}>Nessun prodotto in questa categoria.</div>
            )}
            {visibleDrinks.map((d) => (
              <DrinkTile
                key={d.id}
                drink={d}
                qty={qtyByDrink[d.id] ?? 0}
                onAdd={() => addDrink(d)}
                onSetQty={(q) => {
                  const idx = newItems.findIndex((i) => !i.custom && i.drink_id === d.id)
                  if (idx >= 0) setNewQty(idx, q)
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {comande.map((c) => {
              const ns = nextComandaStatus(c.status)
              const done = comandaDone(c)
              return (
                <div className="card" key={c.id} style={{ margin: '0 0 10px' }}>
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <strong>Comanda {c.seq}</strong>
                    <span className={`pill ${c.status}`}>
                      {STATUS_EMOJI[c.status]}{' '}
                      {c.status === ORDER_STATUSES.RITIRATO
                        ? ritiratoLabel(order.service_mode)
                        : STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  {c.created_at && (
                    <div className="muted small">inviata {String(c.created_at).slice(11, 16)}</div>
                  )}
                  <div style={{ margin: '8px 0' }}>
                    {(c.items || []).map((i, idx) => (
                      <div className="row between" key={idx} style={{ alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: '0.92rem' }}>
                          {i.custom ? '✨ ' : ''}{i.name}
                          <span className="muted small"> · {formatPrice(i.unit_price)}</span>
                        </span>
                        {done || closed ? (
                          <span className="muted">×{i.qty}</span>
                        ) : (
                          <span className="qty">
                            <button aria-label="Riduci" onClick={() => comandaQtyChange(c, idx, -1)} disabled={saving}>−</button>
                            <strong>{i.qty}</strong>
                            <button aria-label="Aumenta" onClick={() => comandaQtyChange(c, idx, 1)} disabled={saving}>+</button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="grid-2">
                    {ns && !closed ? (
                      <button
                        className="btn small"
                        disabled={saving}
                        onClick={() => run(() => advanceComanda(order.id, c.id, ns))}
                      >
                        Segna “{ns === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[ns]}”
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      className="btn ghost small"
                      onClick={() => printComanda(order, c).catch((e) => setError(`Stampa: ${e.message}`))}
                    >
                      🖨 Ristampa
                    </button>
                  </div>
                </div>
              )
            })}
            {comande.length === 0 && <div className="empty">Nessuna comanda.</div>}
          </div>
        )}

        {/* ── Pannello conto ── */}
        <div className="posd-comanda">
          {/* Tab interni */}
          <div className="row" style={{ gap: 6, padding: '8px 10px 0' }}>
            <button className={`chip ${view === 'menu' ? 'active' : ''}`} onClick={() => setView('menu')}>
              🍸 Nuova comanda{newItems.length > 0 ? ` (${newItems.reduce((s, i) => s + i.qty, 0)})` : ''}
            </button>
            <button className={`chip ${view === 'comande' ? 'active' : ''}`} onClick={() => setView('comande')}>
              🧾 Comande ({comande.length})
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {view === 'menu' && (
              <>
                {newItems.length === 0 && (
                  <p className="muted small">Tocca i prodotti per comporre una nuova comanda.</p>
                )}
                {newItems.map((i, idx) => (
                  <div className="row between" key={idx} style={{ alignItems: 'center', marginTop: 8 }}>
                    <span className="grow" style={{ fontSize: '0.92rem' }}>
                      {i.custom ? '✨ ' : ''}{i.name}
                      <span className="muted small"> · {formatPrice(i.unit_price)}</span>
                    </span>
                    <span className="qty">
                      <button aria-label="Riduci" onClick={() => setNewQty(idx, i.qty - 1)}>−</button>
                      <strong>{i.qty}</strong>
                      <button aria-label="Aumenta" onClick={() => setNewQty(idx, i.qty + 1)}>+</button>
                    </span>
                  </div>
                ))}
                {!closed && (
                  <button
                    className="btn ghost small block"
                    style={{ marginTop: 10 }}
                    onClick={() => setShowCustom(true)}
                  >
                    🍹 Drink custom
                  </button>
                )}
                {newItems.length > 0 && (
                  <button className="btn block" style={{ marginTop: 8 }} disabled={saving || closed} onClick={sendComanda}>
                    📤 Invia comanda · {formatPrice(newTotal)}
                  </button>
                )}
              </>
            )}

            {view === 'comande' && (
              <>
                {/* Info conto */}
                <label htmlFor="pd-name">Nome</label>
                <input
                  id="pd-name"
                  value={info.customer_name}
                  disabled={closed}
                  onChange={(e) => setInfo((v) => ({ ...v, customer_name: e.target.value }))}
                />
                <div className="grid-2" style={{ marginTop: 8 }}>
                  <div>
                    <label htmlFor="pd-table">Tavolo</label>
                    <input
                      id="pd-table"
                      value={info.table_label}
                      disabled={closed}
                      onChange={(e) => setInfo((v) => ({ ...v, table_label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="pd-note">Note</label>
                    <input
                      id="pd-note"
                      value={info.note}
                      disabled={closed}
                      onChange={(e) => setInfo((v) => ({ ...v, note: e.target.value }))}
                    />
                  </div>
                </div>
                {infoDirty && (
                  <button
                    className="btn small block"
                    style={{ marginTop: 8 }}
                    disabled={saving}
                    onClick={() => run(() => updateOrderInfo(order.id, info))}
                  >
                    💾 Salva dati conto
                  </button>
                )}
              </>
            )}
          </div>

          {/* Totale + azioni conto */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 12px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {extras > 0 && (
              <div className="row between muted small">
                <span>Coperto/servizio/mancia</span>
                <span>{formatPrice(extras)}</span>
              </div>
            )}
            <div className="row between">
              <strong>Totale conto</strong>
              <strong className="price">{formatPrice(order.total)}</strong>
            </div>

            <div className="grid-2">
              <button
                className="btn ghost small"
                onClick={() => printScontrino(order).catch((e) => setError(`Stampa: ${e.message}`))}
              >
                🧾 Scontrino
              </button>
              {!closed && order.payment_status !== 'pagato' ? (
                <button
                  className="btn small"
                  disabled={saving}
                  onClick={() => (served ? run(() => markOrderPaid(order.id, 'banco')) : setConfirmPay(true))}
                >
                  💶 Incassa e chiudi
                </button>
              ) : (
                <span />
              )}
            </div>

            {!closed && (
              <button
                className="btn ghost small block"
                disabled={saving}
                onClick={() => setConfirmCancel(true)}
              >
                ✖️ Annulla ordine
              </button>
            )}
          </div>
        </div>
      </div>

      {showCustom && (
        <CustomDrinkForm
          onCancel={() => setShowCustom(false)}
          onAdd={({ name, price, recipe_items }) => {
            setNewItems((items) => [
              ...items,
              {
                drink_id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                custom: true,
                name,
                unit_price: price,
                qty: 1,
                sumup_product_id: null,
                recipe_items,
              },
            ])
            setShowCustom(false)
          }}
        />
      )}

      {confirmPay && (
        <ConfirmDialog
          title="💶 Chiudere il conto?"
          message="Ci sono comande non ancora servite: incassando, il conto viene chiuso comunque."
          confirmLabel="Incassa e chiudi"
          onCancel={() => setConfirmPay(false)}
          onConfirm={() => {
            setConfirmPay(false)
            run(() => markOrderPaid(order.id, 'banco'))
          }}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="✖️ Annullare l'ordine?"
          message={`L'ordine #${order.daily_number ?? ''} verrà annullato e le scorte già scalate torneranno a magazzino.`}
          confirmLabel="Annulla ordine"
          cancelLabel="Indietro"
          danger
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() =>
            run(async () => {
              setConfirmCancel(false)
              await cancelOrder(order.id, { by: 'bartender' })
            })
          }
        />
      )}
    </div>
  )
}
