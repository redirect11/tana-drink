import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import PosProductPicker from './PosProductPicker.jsx'
import CustomDrinkForm from './CustomDrinkForm.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'

// ── Dettaglio ordine in stile POS SumUp — solo bartender ──────────────────
// Layout identico alla cassa: categorie a sinistra, griglia prodotti al
// centro e, A DESTRA, i prodotti dell'ordine: le comande già inviate (con
// stato e quantità) e la NUOVA comanda che si compone toccando la griglia.
// Il conto si chiude solo con l'incasso o con l'annullo.

export default function OrderPosDetail({ order }) {
  const { drinks, cats, loading } = useMenu()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)

  // NUOVA comanda in composizione (bozza locale, non ancora inviata).
  const [newItems, setNewItems] = useState([])

  // POS a tutto schermo, come la cassa.
  useEffect(() => {
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [])

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
    })

  // ── Comande esistenti: modifiche OTTIMISTICHE ──
  // La UX deve essere immediata: il tap su +/− aggiorna subito lo stato
  // locale, la scrittura su Firestore parte in background con un debounce
  // (tap rapidi = una sola transazione). In caso di errore si torna allo
  // stato del server. Finché ci sono modifiche in volo, per quella comanda
  // vale la versione locale (il realtime non la sovrascrive).
  const [pendingEdits, setPendingEdits] = useState({}) // comandaId -> items
  const flushTimers = useRef({})
  const latestPending = useRef({})
  latestPending.current = pendingEdits

  const flushComanda = useCallback(async (comandaId) => {
    clearTimeout(flushTimers.current[comandaId])
    delete flushTimers.current[comandaId]
    const items = latestPending.current[comandaId]
    if (!items) return
    try {
      await bartenderUpdateComanda(order.id, comandaId, { items })
      // Rimuovi l'override solo se nel frattempo non ci sono stati altri tap.
      setPendingEdits((p) => (p[comandaId] === items ? omit(p, comandaId) : p))
    } catch (e) {
      setError(e.message)
      setPendingEdits((p) => omit(p, comandaId)) // revert allo stato server
    }
  }, [order.id])

  // Flush di tutte le modifiche in sospeso (prima di azioni "forti").
  const flushAll = useCallback(async () => {
    await Promise.all(Object.keys(latestPending.current).map((id) => flushComanda(id)))
  }, [flushComanda])

  useEffect(() => {
    const timers = flushTimers.current
    return () => Object.values(timers).forEach(clearTimeout)
  }, [])

  function comandaQtyChange(comanda, idx, delta) {
    const base = pendingEdits[comanda.id] ?? comanda.items
    const items = base
      .map((i, j) => (j === idx ? { ...i, qty: i.qty + delta } : i))
      .filter((i) => i.qty > 0)
    setPendingEdits((p) => ({ ...p, [comanda.id]: items }))
    clearTimeout(flushTimers.current[comanda.id])
    flushTimers.current[comanda.id] = setTimeout(() => flushComanda(comanda.id), 600)
  }

  // ── Info conto ──
  const [info, setInfo] = useState({
    customer_name: order.customer_name || '',
    table_label: order.table_label || '',
    note: order.note || '',
  })
  const [showInfo, setShowInfo] = useState(false)
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
          borderBottom: '1px solid var(--line)',
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

      {/* ── Corpo a 3 colonne: categorie · griglia · prodotti dell'ordine ── */}
      <div className="posd-body">
        <PosProductPicker
          drinks={drinks}
          cats={cats}
          loading={loading}
          qtyByDrink={qtyByDrink}
          onAdd={addDrink}
          onSetQty={(d, q) => {
            const idx = newItems.findIndex((i) => !i.custom && i.drink_id === d.id)
            if (idx >= 0) setNewQty(idx, q)
          }}
          disabled={closed}
        />

        {/* ── Pannello destro: i prodotti dell'ordine ── */}
        <div className="posd-comanda">
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {/* Comande già inviate */}
            {comande.map((c) => {
              const ns = nextComandaStatus(c.status)
              const done = comandaDone(c)
              return (
                <div key={c.id} style={{ marginBottom: 12 }}>
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <span className="muted small" style={{ letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                      COMANDA {c.seq}
                      {c.created_at ? ` · ${String(c.created_at).slice(11, 16)}` : ''}
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      <span className={`pill ${c.status}`} style={{ fontSize: '0.7rem' }}>
                        {STATUS_EMOJI[c.status]}{' '}
                        {c.status === ORDER_STATUSES.RITIRATO
                          ? ritiratoLabel(order.service_mode)
                          : STATUS_LABELS[c.status]}
                      </span>
                    </span>
                  </div>
                  {(pendingEdits[c.id] ?? c.items ?? []).map((i, idx) => (
                    <div className="row between" key={idx} style={{ alignItems: 'center', marginTop: 6 }}>
                      <span className="grow" style={{ fontSize: '0.92rem' }}>
                        {i.custom ? '✨ ' : ''}{i.name}
                        <span className="muted small"> · {formatPrice(i.unit_price)}</span>
                      </span>
                      {done || closed ? (
                        <span className="muted">×{i.qty}</span>
                      ) : (
                        <span className="qty">
                          <button aria-label="Riduci" onClick={() => comandaQtyChange(c, idx, -1)}>−</button>
                          <strong>{i.qty}</strong>
                          <button aria-label="Aumenta" onClick={() => comandaQtyChange(c, idx, 1)}>+</button>
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Ogni comanda si può (ri)stampare: solo i SUOI item. */}
                  <div className="grid-2" style={{ marginTop: 6, gap: 6 }}>
                    <button
                      className="btn ghost small"
                      aria-label={`Stampa comanda ${c.seq}`}
                      onClick={() => printComanda(order, c).catch((e) => setError(`Stampa: ${e.message}`))}
                    >
                      🖨 Stampa
                    </button>
                    {ns && !closed ? (
                      <button
                        className="btn small"
                        disabled={saving}
                        onClick={() => run(async () => { await flushAll(); await advanceComanda(order.id, c.id, ns) })}
                      >
                        Segna “{ns === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[ns]}”
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              )
            })}

            {/* Nuova comanda (come "AGGIUNGI UN ORDINE" su SumUp) */}
            {!closed && (
              <div style={{ marginBottom: 12 }}>
                <div className="muted small" style={{ letterSpacing: 0.5 }}>
                  {comande.length > 0 ? `NUOVA COMANDA (${comande.length + 1})` : 'NUOVA COMANDA'}
                </div>
                {newItems.length === 0 && (
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    Tocca i prodotti per aggiungerli.
                  </p>
                )}
                {newItems.map((i, idx) => (
                  <div className="row between" key={idx} style={{ alignItems: 'center', marginTop: 6 }}>
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
                <button
                  className="btn ghost small block"
                  style={{ marginTop: 8 }}
                  onClick={() => setShowCustom(true)}
                >
                  🍹 Drink custom
                </button>
                {newItems.length > 0 && (
                  <button className="btn block" style={{ marginTop: 6 }} disabled={saving} onClick={sendComanda}>
                    📤 Invia comanda · {formatPrice(newTotal)}
                  </button>
                )}
              </div>
            )}

            {/* Dati conto (nome/tavolo/note) */}
            <button className="btn ghost small block" onClick={() => setShowInfo((v) => !v)}>
              {showInfo ? 'Nascondi dati conto' : '👤 Dati conto (nome, tavolo, note)'}
            </button>
            {showInfo && (
              <div style={{ marginTop: 6 }}>
                <label htmlFor="pd-name">Nome</label>
                <input
                  id="pd-name"
                  value={info.customer_name}
                  disabled={closed}
                  onChange={(e) => setInfo((v) => ({ ...v, customer_name: e.target.value }))}
                />
                <div className="grid-2" style={{ marginTop: 6 }}>
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
                    style={{ marginTop: 6 }}
                    disabled={saving}
                    onClick={() => run(() => updateOrderInfo(order.id, info))}
                  >
                    💾 Salva dati conto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer: totale + azioni conto */}
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
            {extras > 0 && (
              <div className="row between muted small">
                <span>Coperto/servizio/mancia</span>
                <span>{formatPrice(extras)}</span>
              </div>
            )}
            <div className="row between">
              <strong>Totale</strong>
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
                  onClick={() => (served ? run(async () => { await flushAll(); await markOrderPaid(order.id, 'banco') }) : setConfirmPay(true))}
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
            run(async () => { await flushAll(); await markOrderPaid(order.id, 'banco') })
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

// Copia di un oggetto senza una chiave (per rimuovere gli override flushati).
function omit(obj, key) {
  const next = { ...obj }
  delete next[key]
  return next
}
