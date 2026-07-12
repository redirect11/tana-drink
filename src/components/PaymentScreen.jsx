import { useEffect, useMemo, useState } from 'react'
import { registerPayment, setOrderDiscount } from '../lib/api.js'
import { readerCheckout } from '../lib/paymentsApi.js'
import { formatPrice, PAYMENT_METHOD_LABELS } from '../lib/orderStatus.js'
import { allServed } from '../lib/comande.js'
import { printScontrino } from '../lib/printer.js'
import {
  remainingItems,
  paidAmount,
  orderDue,
  selectionAmount,
  discountAmount,
} from '../lib/pagamento.js'

// ── Schermata Pagamento in stile POS SumUp ─────────────────────────────
// A SINISTRA gli articoli del conto, selezionabili e pagabili singolarmente
// (split del tavolo); a DESTRA lo sconto (percentuale o in euro), la stampa
// del preconto e i metodi di pagamento (contanti / carta sul lettore).
// Il conto si chiude da solo quando il residuo arriva a zero.

// Selezione "tutto il conto": la schermata si apre con ogni articolo già
// in pagamento; si deseleziona solo per lo split del tavolo.
const fullSelection = (order) =>
  Object.fromEntries(remainingItems(order).map((r) => [r.drink_id, r.qty]))

export default function PaymentScreen({ order, settings, onClose, onBeforePay }) {
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState(() => fullSelection(order)) // drink_id -> qty da pagare ora
  const [disc, setDisc] = useState({
    type: order.discount?.type || 'percent',
    value: order.discount?.value ? String(order.discount.value) : '',
  })
  const [readerStarted, setReaderStarted] = useState(false)

  // Dopo ogni incasso registrato la selezione torna a "tutto il residuo".
  const paymentsCount = (order.payments || []).length
  useEffect(() => {
    setSel(fullSelection(order))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, paymentsCount])

  const remaining = useMemo(() => remainingItems(order), [order])
  const paid = paidAmount(order)
  const due = orderDue(order)
  const served = allServed(order)
  const closed = order.payment_status === 'pagato'

  const selection = remaining
    .filter((r) => (sel[r.drink_id] || 0) > 0)
    .map((r) => ({ ...r, qty: Math.min(sel[r.drink_id], r.qty) }))
  const allSelected =
    remaining.length > 0 && remaining.every((r) => (sel[r.drink_id] || 0) >= r.qty)
  // Split solo quando si è tolto qualcosa: a selezione piena si salda il
  // residuo intero (coperto/servizio compresi), senza dettaglio articoli.
  const splitting = !allSelected && selection.length > 0
  const toPay =
    remaining.length === 0 || allSelected ? due : splitting ? selectionAmount(order, selection) : 0

  const readerReady = settings.payments_reader_enabled && settings.sumup_reader_id

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

  const bump = (r, delta) =>
    setSel((s) => {
      const next = Math.max(0, Math.min((s[r.drink_id] || 0) + delta, r.qty))
      return { ...s, [r.drink_id]: next }
    })

  const applyDiscount = () =>
    run(async () => {
      const value = Number(String(disc.value).replace(',', '.'))
      await setOrderDiscount(order.id, value > 0 ? { type: disc.type, value } : null)
    })

  const payCash = () =>
    run(async () => {
      await onBeforePay?.()
      const { closed: done } = await registerPayment(order.id, {
        amount: toPay,
        method: 'banco',
        items: splitting ? selection : null,
      })
      if (done) onClose()
    })

  const payReader = () =>
    run(async () => {
      await onBeforePay?.()
      const res = await readerCheckout(order.id, {
        amount: toPay,
        items: splitting ? selection : null,
      })
      if (res?.unavailable) {
        setError('Lettore non disponibile in ambiente di sviluppo: simula dai DevTools.')
        return
      }
      setReaderStarted(true)
    })

  // Anteprima dello sconto mentre si digita (prima di "Applica").
  const discPreview = discountAmount(order.total, {
    type: disc.type,
    value: Number(String(disc.value).replace(',', '.')),
  })
  const discDirty =
    discPreview !== (order.discount_amount || 0) ||
    (order.discount?.type || 'percent') !== disc.type

  return (
    <div
      role="dialog"
      aria-label="Pagamento"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Barra in alto */}
      <div
        className="row between"
        style={{
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0 }}>💳 Pagamento · #{order.daily_number ?? '—'}</h3>
        <button className="btn ghost small" onClick={onClose}>✕ Chiudi</button>
      </div>

      {error && <div className="banner" style={{ margin: '8px 12px 0', flexShrink: 0 }}>{error}</div>}

      <div className="payscreen-body">
        {/* ── SINISTRA: articoli selezionabili (split del conto) ── */}
        <div className="payscreen-items">
          <p className="muted small" style={{ margin: '10px 0 2px' }}>
            Tutti gli articoli sono già in pagamento: togli quelli che non
            vanno incassati adesso per fare lo split del conto.
          </p>
          {remaining.map((r) => {
            const s = Math.min(sel[r.drink_id] || 0, r.qty)
            return (
              <div className="row between" key={r.drink_id} style={{ alignItems: 'center', marginTop: 8 }}>
                <span className="grow" style={{ fontSize: '0.92rem' }}>
                  {r.custom ? '✨ ' : ''}{r.name}
                  <span className="muted small"> · {r.qty}× {formatPrice(r.unit_price)}</span>
                </span>
                <span className="qty">
                  <button aria-label={`Togli ${r.name} dal pagamento`} onClick={() => bump(r, -1)} disabled={closed || s === 0}>−</button>
                  <strong>{s}/{r.qty}</strong>
                  <button aria-label={`Paga ${r.name}`} onClick={() => bump(r, 1)} disabled={closed || s >= r.qty}>+</button>
                </span>
              </div>
            )
          })}
          {remaining.length === 0 && !closed && (
            <p className="muted small">Nessun articolo da pagare{due > 0 ? ': resta il residuo (coperto/servizio).' : '.'}</p>
          )}
          {remaining.length > 0 && !allSelected && !closed && (
            <button
              className="btn ghost small block"
              style={{ marginTop: 10 }}
              onClick={() => setSel(fullSelection(order))}
            >
              Rimetti tutto in pagamento
            </button>
          )}

          {(order.payments || []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <span className="muted small" style={{ letterSpacing: 0.5 }}>GIÀ PAGATO</span>
              {order.payments.map((p) => (
                <div className="row between muted small" key={p.id} style={{ marginTop: 4 }}>
                  <span>
                    {PAYMENT_METHOD_LABELS[p.method] || p.method}
                    {p.at ? ` · ${String(p.at).slice(11, 16)}` : ''}
                  </span>
                  <span>{formatPrice(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── DESTRA: sconto, preconto e metodi di pagamento ── */}
        <div className="payscreen-actions">
          <div className="row between">
            <span>Totale conto</span>
            <span>{formatPrice(order.total)}</span>
          </div>

          {/* Sconto: percentuale o in euro, sull'intero conto */}
          <div style={{ marginTop: 8 }}>
            <label htmlFor="ps-disc">Sconto</label>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input
                id="ps-disc"
                type="number"
                min="0"
                inputMode="decimal"
                value={disc.value}
                disabled={closed}
                onChange={(e) => setDisc((d) => ({ ...d, value: e.target.value }))}
                style={{ width: 90 }}
              />
              <button
                className={`btn small ${disc.type === 'percent' ? '' : 'ghost'}`}
                disabled={closed}
                onClick={() => setDisc((d) => ({ ...d, type: 'percent' }))}
              >
                %
              </button>
              <button
                className={`btn small ${disc.type === 'euro' ? '' : 'ghost'}`}
                disabled={closed}
                onClick={() => setDisc((d) => ({ ...d, type: 'euro' }))}
              >
                €
              </button>
              {discDirty && !closed && (
                <button className="btn secondary small" disabled={saving} onClick={applyDiscount}>
                  Applica
                </button>
              )}
            </div>
          </div>

          {(order.discount_amount || 0) > 0 && (
            <div className="row between muted small" style={{ marginTop: 6 }}>
              <span>Sconto applicato</span>
              <span>−{formatPrice(order.discount_amount)}</span>
            </div>
          )}
          {paid > 0 && (
            <div className="row between muted small" style={{ marginTop: 4 }}>
              <span>Già pagato</span>
              <span>−{formatPrice(paid)}</span>
            </div>
          )}

          <div className="row between" style={{ marginTop: 10, alignItems: 'baseline' }}>
            <strong>
              {remaining.length === 0 || allSelected ? 'Residuo da incassare' : 'Selezione da incassare'}
            </strong>
            <strong className="price" style={{ fontSize: '1.5rem' }}>{formatPrice(toPay)}</strong>
          </div>

          {!served && !closed && (
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              ⚠️ Ci sono comande non ancora servite: saldando tutto, il conto
              viene chiuso comunque.
            </p>
          )}
          {readerStarted && order.payment_status === 'in_attesa' && (
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              📟 Transazione avviata sul lettore: il conto si aggiorna da solo
              all'esito del pagamento.
            </p>
          )}
          {closed && (
            <p style={{ margin: '8px 0 0' }}>✅ Conto pagato e chiuso.</p>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn ghost block"
              onClick={() => printScontrino(order).catch((e) => setError(`Stampa: ${e.message}`))}
            >
              🖨 Stampa preconto
            </button>
            {!closed && (
              <>
                <button className="btn block" disabled={saving || !(toPay > 0)} onClick={payCash}>
                  💵 Contanti · {formatPrice(toPay)}
                </button>
                {readerReady && (
                  <button className="btn secondary block" disabled={saving || !(toPay > 0)} onClick={payReader}>
                    📟 Carta sul lettore SumUp
                    {settings.sumup_reader_name ? ` (${settings.sumup_reader_name})` : ''}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
