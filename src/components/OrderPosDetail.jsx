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
import {
  nextComandaStatus,
  activeComanda,
  allServed,
  orderIsClosed,
  planDecrement,
  comandaEditable,
} from '../lib/comande.js'
import { printComanda, printScontrino } from '../lib/printer.js'
import PosProductPicker from './PosProductPicker.jsx'
import CustomDrinkForm from './CustomDrinkForm.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'

// ── Dettaglio ordine in stile POS SumUp — solo bartender ──────────────────
// Il pannello destro mostra L'ORDINE AGGREGATO (niente comande in vista):
// gli aumenti (tap sulla griglia o +) compongono aggiunte che al salvataggio
// diventano una nuova comanda GESTITA INTERNAMENTE; le diminuzioni toccano
// solo le comande ancora modificabili — una comanda pronta o servita non si
// tocca più (il − si disabilita al minimo bloccato). Le comande restano
// consultabili a parte, in una modale dedicata (stati, avanzamento, stampa).

export default function OrderPosDetail({ order }) {
  const { drinks, cats, loading } = useMenu()
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [showComande, setShowComande] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)

  // AGGIUNTE in composizione (bozza locale → nuova comanda all'invio).
  const [draft, setDraft] = useState([])

  // POS a tutto schermo, come la cassa.
  useEffect(() => {
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [])

  const closed = orderIsClosed(order)
  const comande = useMemo(() => order.comande || [], [order.comande])
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

  // ── Diminuzioni OTTIMISTICHE sulle comande modificabili ──
  // Override locale per-comanda + scrittura debounced (tap rapidi = una
  // transazione); in errore si torna allo stato server.
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
      setPendingEdits((p) => (p[comandaId] === items ? omit(p, comandaId) : p))
    } catch (e) {
      setError(e.message)
      setPendingEdits((p) => omit(p, comandaId))
    }
  }, [order.id])

  const flushAll = useCallback(async () => {
    await Promise.all(Object.keys(latestPending.current).map((id) => flushComanda(id)))
  }, [flushComanda])

  useEffect(() => {
    const timers = flushTimers.current
    return () => Object.values(timers).forEach(clearTimeout)
  }, [])

  // Comande "effettive": server + override locali in volo.
  const effComande = useMemo(
    () => comande.map((c) => (pendingEdits[c.id] ? { ...c, items: pendingEdits[c.id] } : c)),
    [comande, pendingEdits]
  )

  // ── Vista aggregata: righe = item dell'ordine + aggiunte in bozza ──
  const rows = useMemo(() => {
    const out = []
    const byDrink = new Map()
    for (const c of effComande) {
      if (c.status === ORDER_STATUSES.ANNULLATO) continue
      const editable = comandaEditable(c)
      for (const i of c.items || []) {
        const key = i.drink_id
        if (!i.custom && key && byDrink.has(key)) {
          const ex = byDrink.get(key)
          ex.qty += i.qty
          if (editable) ex.editableQty += i.qty
        } else {
          const row = { ...i, editableQty: editable ? i.qty : 0, draftQty: 0 }
          out.push(row)
          if (key) byDrink.set(key, row)
        }
      }
    }
    for (const d of draft) {
      const ex = !d.custom && byDrink.get(d.drink_id)
      if (ex) {
        ex.qty += d.qty
        ex.draftQty += d.qty
      } else {
        out.push({ ...d, editableQty: 0, draftQty: d.qty })
      }
    }
    return out
  }, [effComande, draft])

  const draftCount = draft.reduce((s, i) => s + i.qty, 0)
  const draftTotal = draft.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const rowsTotal = rows.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const qtyByDrink = useMemo(() => {
    const m = {}
    for (const r of rows) if (!r.custom) m[r.drink_id] = (m[r.drink_id] || 0) + r.qty
    return m
  }, [rows])

  // + : sempre un'aggiunta (andrà in una NUOVA comanda, gestita internamente).
  function plus(drinkLike) {
    if (closed) return
    setDraft((items) => {
      const idx = items.findIndex((i) => !i.custom && i.drink_id === drinkLike.drink_id)
      if (idx >= 0) return items.map((i, j) => (j === idx ? { ...i, qty: i.qty + 1 } : i))
      return [...items, { ...drinkLike, qty: 1 }]
    })
  }
  const plusFromCatalog = (d) =>
    plus({
      drink_id: d.id,
      name: d.name,
      unit_price: d.price,
      sumup_product_id: d.sumup_product_id ?? null,
    })

  // − : prima dalla bozza, poi dalle comande MODIFICABILI (mai da pronte/servite).
  function minus(row) {
    if (closed) return
    if (row.draftQty > 0) {
      setDraft((items) => {
        const idx = items.findIndex((i) => i.drink_id === row.drink_id)
        if (idx === -1) return items
        return items
          .map((i, j) => (j === idx ? { ...i, qty: i.qty - 1 } : i))
          .filter((i) => i.qty > 0)
      })
      return
    }
    const plan = planDecrement(effComande, row.drink_id)
    if (!plan) return // solo quantità bloccate: il bottone è già disabilitato
    setPendingEdits((p) => ({ ...p, [plan.comandaId]: plan.items }))
    clearTimeout(flushTimers.current[plan.comandaId])
    flushTimers.current[plan.comandaId] = setTimeout(() => flushComanda(plan.comandaId), 600)
  }

  // Invio delle aggiunte: crea la nuova comanda (internamente).
  const sendDraft = () =>
    run(async () => {
      await flushAll()
      await addComanda(order.id, draft)
      setDraft([])
    })

  // ── Comanda attiva: azione rapida di avanzamento (senza mostrare i dettagli) ──
  const active = activeComanda({ comande: effComande })
  const activeNext = active ? nextComandaStatus(active.status) : null

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

      {/* ── Corpo a 3 colonne: categorie · griglia · ordine ── */}
      <div className="posd-body">
        <PosProductPicker
          drinks={drinks}
          cats={cats}
          loading={loading}
          qtyByDrink={qtyByDrink}
          onAdd={plusFromCatalog}
          onSetQty={(d, q) => {
            const row = rows.find((r) => !r.custom && r.drink_id === d.id)
            if (!row) return
            if (q > row.qty) plusFromCatalog(d)
            else if (q < row.qty) minus(row)
          }}
          disabled={closed}
        />

        {/* ── Pannello destro: L'ORDINE (aggregato) ── */}
        <div className="posd-comanda">
          <div className="row between" style={{ padding: '8px 12px 0', alignItems: 'center' }}>
            <span className="muted small" style={{ letterSpacing: 0.5 }}>ORDINE</span>
            <button className="btn ghost small" onClick={() => setShowComande(true)}>
              🧾 Comande ({comande.length})
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 10px' }}>
            {rows.length === 0 && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Tocca i prodotti per aggiungerli all'ordine.
              </p>
            )}
            {rows.map((r, idx) => {
              // Il − scende fino alle quantità bloccate (comande pronte/servite).
              const canMinus = !closed && (r.draftQty > 0 || r.editableQty > 0)
              return (
                <div className="row between" key={r.drink_id ?? idx} style={{ alignItems: 'center', marginTop: 8 }}>
                  <span className="grow" style={{ fontSize: '0.92rem' }}>
                    {r.custom ? '✨ ' : ''}{r.name}
                    <span className="muted small"> · {formatPrice(r.unit_price)}</span>
                    {r.draftQty > 0 && (
                      <span className="badge-low" style={{ marginLeft: 6 }}>+{r.draftQty} da inviare</span>
                    )}
                  </span>
                  <span className="qty">
                    <button aria-label="Riduci" onClick={() => minus(r)} disabled={!canMinus}>−</button>
                    <strong>{r.qty}</strong>
                    <button aria-label="Aumenta" onClick={() => plus(rowToDraft(r))} disabled={closed}>+</button>
                  </span>
                </div>
              )
            })}

            {!closed && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 10 }}
                onClick={() => setShowCustom(true)}
              >
                🍹 Drink custom
              </button>
            )}

            {draftCount > 0 && (
              <button className="btn block" style={{ marginTop: 8 }} disabled={saving} onClick={sendDraft}>
                📤 Invia aggiunte ({draftCount}) · {formatPrice(draftTotal)}
              </button>
            )}

            {/* Dati conto (nome/tavolo/note) */}
            <button className="btn ghost small block" style={{ marginTop: 10 }} onClick={() => setShowInfo((v) => !v)}>
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

          {/* Footer: azione comanda attiva + totale + azioni conto */}
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
            {active && activeNext && !closed && (
              <div className="row between" style={{ alignItems: 'center' }}>
                <span className={`pill ${active.status}`}>
                  {STATUS_EMOJI[active.status]} {STATUS_LABELS[active.status]}
                </span>
                <button
                  className="btn small"
                  disabled={saving}
                  onClick={() =>
                    run(async () => {
                      await flushAll()
                      await advanceComanda(order.id, active.id, activeNext)
                    })
                  }
                >
                  Segna “{activeNext === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[activeNext]}”
                </button>
              </div>
            )}

            {extras > 0 && (
              <div className="row between muted small">
                <span>Coperto/servizio/mancia</span>
                <span>{formatPrice(extras)}</span>
              </div>
            )}
            <div className="row between">
              <strong>Totale</strong>
              <strong className="price">{formatPrice(rowsTotal + extras)}</strong>
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

      {/* ── Modale comande: stati, avanzamento, stampa (sola lettura item) ── */}
      {showComande && (
        <div className="overlay confirm-overlay" onClick={() => setShowComande(false)}>
          <div
            className="confirm-box"
            style={{ maxHeight: '85vh', overflowY: 'auto', width: 'min(440px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🧾 Comande</h3>
              <button className="btn ghost small" onClick={() => setShowComande(false)}>✕ Chiudi</button>
            </div>
            {comande.map((c) => {
              const ns = nextComandaStatus(c.status)
              return (
                <div className="card" key={c.id} style={{ margin: '10px 0 0', padding: 12 }}>
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                      COMANDA {c.seq}
                      {c.created_at ? ` · ${String(c.created_at).slice(11, 16)}` : ''}
                    </span>
                    <span className={`pill ${c.status}`} style={{ fontSize: '0.7rem' }}>
                      {STATUS_EMOJI[c.status]}{' '}
                      {c.status === ORDER_STATUSES.RITIRATO
                        ? ritiratoLabel(order.service_mode)
                        : STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  {(c.items || []).map((i, idx) => (
                    <div className="row between" key={idx} style={{ marginTop: 4 }}>
                      <span className="muted small">
                        {i.qty}× {i.custom ? '✨ ' : ''}{i.name}
                      </span>
                      <span className="muted small">{formatPrice(i.qty * i.unit_price)}</span>
                    </div>
                  ))}
                  <div className="grid-2" style={{ marginTop: 8, gap: 6 }}>
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
            {comande.length === 0 && <p className="muted small">Nessuna comanda.</p>}
          </div>
        </div>
      )}

      {showCustom && (
        <CustomDrinkForm
          onCancel={() => setShowCustom(false)}
          onAdd={({ name, price, recipe_items }) => {
            setDraft((items) => [
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

// Riga aggregata → forma "item da bozza" per il +1.
function rowToDraft(r) {
  return {
    drink_id: r.drink_id,
    name: r.name,
    unit_price: r.unit_price,
    sumup_product_id: r.sumup_product_id ?? null,
    ...(r.custom ? { custom: true, recipe_items: r.recipe_items ?? [] } : {}),
  }
}

// Copia di un oggetto senza una chiave (per rimuovere gli override flushati).
function omit(obj, key) {
  const next = { ...obj }
  delete next[key]
  return next
}
