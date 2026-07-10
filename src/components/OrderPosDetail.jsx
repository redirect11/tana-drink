import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  updateOrderStatus,
  markOrderPaid,
  bartenderUpdateOrder,
  cancelOrder,
} from '../lib/api.js'
import { useMenu } from '../lib/menuCache.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  nextStatus,
  formatPrice,
  placedByName,
} from '../lib/orderStatus.js'
import { DrinkTile } from './PosBits.jsx'
import { catBtnStyle } from '../lib/posStyles.js'
import CustomDrinkForm from './CustomDrinkForm.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'

// ── Dettaglio ordine in stile POS (SumUp) — solo bartender ────────────────
// Stessa interfaccia della cassa (categorie a sinistra, griglia prodotti al
// centro) ma la comanda è l'ORDINE ESISTENTE: toccando i prodotti si
// aggiungono alla comanda, che si gestisce come sempre (quantità, custom,
// avanzamento stato, incasso, annullo). Le modifiche restano in bozza finché
// non si preme Salva: se le scorte erano già scalate vengono riallineate
// alla differenza (bartenderUpdateOrder).

export default function OrderPosDetail({ order }) {
  const { drinks, cats, loading } = useMenu()
  const [selectedCat, setSelectedCat] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const gridRef = useRef(null)

  // Bozza comanda: item + tavolo + note. Si risincronizza dall'ordine
  // realtime finché non ci sono modifiche locali non salvate.
  const [draft, setDraft] = useState(() => makeDraft(order))
  const dirty = useMemo(() => !sameDraft(draft, makeDraft(order)), [draft, order])
  const orderId = order.id
  useEffect(() => {
    setDraft(makeDraft(order))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])
  useEffect(() => {
    if (!dirty) setDraft(makeDraft(order))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

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

  const closed =
    order.status === ORDER_STATUSES.PAGATO || order.status === ORDER_STATUSES.ANNULLATO

  // ── Operazioni sulla bozza ──
  function addDrink(d) {
    if (closed) return
    setDraft((ed) => {
      const idx = ed.items.findIndex((i) => !i.custom && i.drink_id === d.id)
      if (idx >= 0) {
        return {
          ...ed,
          items: ed.items.map((i, j) => (j === idx ? { ...i, qty: i.qty + 1 } : i)),
        }
      }
      return {
        ...ed,
        items: [
          ...ed.items,
          {
            drink_id: d.id,
            name: d.name,
            unit_price: d.price,
            qty: 1,
            sumup_product_id: d.sumup_product_id ?? null,
          },
        ],
      }
    })
  }

  function setQty(idx, qty) {
    setDraft((ed) => ({
      ...ed,
      items: ed.items
        .map((i, j) => (j === idx ? { ...i, qty } : i))
        .filter((i) => i.qty > 0),
    }))
  }

  const qtyByDrink = useMemo(() => {
    const m = {}
    for (const i of draft.items) if (!i.custom) m[i.drink_id] = (m[i.drink_id] || 0) + i.qty
    return m
  }, [draft.items])

  const itemsTotal = draft.items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const extras =
    Number(order.coperto_amount || 0) +
    Number(order.service_charge_amount || 0) +
    Number(order.tip_amount || 0)

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

  const save = () =>
    run(async () => {
      await bartenderUpdateOrder(order.id, {
        items: draft.items,
        table_label: draft.table_label,
        note: draft.note,
        customer_name: draft.customer_name,
      })
    })

  // ── Avanzamento stato / incasso ──
  const ns = nextStatus(order.status)
  const isPay = ns === ORDER_STATUSES.PAGATO
  const showAdvance =
    !closed && ns && !(isPay && order.payment_status === 'pagato')

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
          {STATUS_EMOJI[order.status]}{' '}
          {order.status === ORDER_STATUSES.RITIRATO
            ? ritiratoLabel(order.service_mode)
            : STATUS_LABELS[order.status]}
        </span>
        {order.placed_by && (
          <span className="muted small">✍️ {placedByName(order.placed_by)}</span>
        )}
        {order.payment_status === 'pagato' && (
          <span className="muted small">💳 pagato</span>
        )}
      </div>

      {error && <div className="banner" style={{ margin: '8px 8px 0', flexShrink: 0 }}>{error}</div>}

      {/* ── Corpo: sidebar + griglia + comanda ── */}
      <div className="posd-body">
        {/* Sidebar categorie */}
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

        {/* Griglia prodotti */}
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
                const idx = draft.items.findIndex((i) => !i.custom && i.drink_id === d.id)
                if (idx >= 0) setQty(idx, q)
              }}
            />
          ))}
        </div>

        {/* ── Comanda (l'ordine) ── */}
        <div className="posd-comanda">
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <strong>Comanda</strong>
              {dirty && <span className="badge-low">modifiche non salvate</span>}
            </div>

            {draft.items.length === 0 && (
              <p className="muted small">Comanda vuota: tocca i prodotti per aggiungerli.</p>
            )}

            {draft.items.map((i, idx) => (
              <div className="row between" key={idx} style={{ alignItems: 'center', marginTop: 8 }}>
                <span className="grow" style={{ fontSize: '0.92rem' }}>
                  {i.custom ? '✨ ' : ''}{i.name}
                  <span className="muted small"> · {formatPrice(i.unit_price)}</span>
                </span>
                <span className="qty">
                  <button aria-label="Riduci" onClick={() => setQty(idx, i.qty - 1)} disabled={closed}>−</button>
                  <strong>{i.qty}</strong>
                  <button aria-label="Aumenta" onClick={() => setQty(idx, i.qty + 1)} disabled={closed}>+</button>
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

            <label htmlFor="pd-name" style={{ marginTop: 10 }}>Nome</label>
            <input
              id="pd-name"
              placeholder="Es. iole"
              value={draft.customer_name}
              disabled={closed}
              onChange={(e) => setDraft((ed) => ({ ...ed, customer_name: e.target.value }))}
            />

            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="pd-table">Tavolo</label>
                <input
                  id="pd-table"
                  value={draft.table_label}
                  disabled={closed}
                  onChange={(e) => setDraft((ed) => ({ ...ed, table_label: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="pd-note">Note</label>
                <input
                  id="pd-note"
                  value={draft.note}
                  disabled={closed}
                  onChange={(e) => setDraft((ed) => ({ ...ed, note: e.target.value }))}
                />
              </div>
            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            {extras > 0 && (
              <div className="row between muted small">
                <span>Coperto/servizio/mancia</span>
                <span>{formatPrice(extras)}</span>
              </div>
            )}
            <div className="row between">
              <strong>Totale</strong>
              <strong className="price">{formatPrice(itemsTotal + extras)}</strong>
            </div>
          </div>

          {/* Azioni comanda */}
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
            {dirty && (
              <div className="grid-2">
                <button className="btn ghost small" disabled={saving} onClick={() => setDraft(makeDraft(order))}>
                  ↩︎ Ripristina
                </button>
                <button
                  className="btn small"
                  disabled={saving || draft.items.length === 0}
                  onClick={save}
                >
                  {saving ? 'Salvo…' : '💾 Salva comanda'}
                </button>
              </div>
            )}

            {showAdvance && (
              <button
                className="btn block"
                disabled={saving || dirty}
                onClick={() =>
                  run(async () => {
                    if (isPay) await markOrderPaid(order.id, 'banco')
                    else await updateOrderStatus(order.id, ns)
                  })
                }
              >
                {isPay
                  ? '💶 Segna pagato (al banco)'
                  : `Segna come “${ns === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[ns]}”`}
              </button>
            )}
            {dirty && showAdvance && (
              <p className="muted small" style={{ margin: 0 }}>
                Salva (o ripristina) la comanda prima di avanzare lo stato.
              </p>
            )}

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
            setDraft((ed) => ({
              ...ed,
              items: [
                ...ed.items,
                {
                  drink_id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                  custom: true,
                  name,
                  unit_price: price,
                  qty: 1,
                  sumup_product_id: null,
                  recipe_items,
                },
              ],
            }))
            setShowCustom(false)
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

// ── Bozza comanda ──────────────────────────────────────────────────────

function makeDraft(order) {
  return {
    items: (order.order_items || []).map((i) => ({
      drink_id: i.drink_id,
      name: i.name,
      unit_price: i.unit_price,
      qty: i.qty,
      sumup_product_id: i.sumup_product_id ?? null,
      ...(i.custom ? { custom: true, recipe_items: i.recipe_items ?? [] } : {}),
    })),
    table_label: order.table_label || '',
    note: order.note || '',
    customer_name: order.customer_name || '',
  }
}

function sameDraft(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}
