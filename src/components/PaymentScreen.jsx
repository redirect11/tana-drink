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
  round2,
} from '../lib/pagamento.js'

// ── Schermata Pagamento in stile POS SumUp (vedi foto di riferimento) ──
// SINISTRA: gli articoli del conto (selezionabili per lo split) e il
// riepilogo Pagato / Ammontare dovuto / Totale. CENTRO: il display
// dell'importo da incassare con il TASTIERINO calcolatrice (C, /2, /3,
// operazioni) e il tasto "Riscuotere"; sotto, il Preconto. DESTRA: i
// metodi di pagamento (Contante / lettore SumUp) e lo Sconto in basso.

// Selezione "tutto il conto": la schermata si apre con ogni articolo già
// in pagamento; si deseleziona solo per lo split del tavolo.
const fullSelection = (order) =>
  Object.fromEntries(remainingItems(order).map((r) => [r.drink_id, r.qty]))

// Il display del tastierino lavora in CENTESIMI digitati ("350" → 3,50 €).
const toDigits = (euro) => String(Math.max(0, Math.round(euro * 100)))
const digitsToEuro = (s) => (parseInt(s || '0', 10) || 0) / 100

export default function PaymentScreen({ order, settings, onClose, onBeforePay }) {
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState(() => fullSelection(order)) // drink_id -> qty da pagare ora
  const [method, setMethod] = useState('banco')
  // Tastierino: null = importo automatico (dalla selezione); altrimenti
  // la stringa di cifre digitata. `acc`/`op` per la calcolatrice.
  const [display, setDisplay] = useState(null)
  const [acc, setAcc] = useState(null)
  const [op, setOp] = useState(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [disc, setDisc] = useState({
    type: order.discount?.type || 'percent',
    value: order.discount?.value ? String(order.discount.value) : '',
  })
  const [readerStarted, setReaderStarted] = useState(false)

  // Dopo ogni incasso registrato si riparte da "tutto il residuo".
  const paymentsCount = (order.payments || []).length
  useEffect(() => {
    setSel(fullSelection(order))
    setDisplay(null)
    setAcc(null)
    setOp(null)
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
  const splitting = !allSelected && selection.length > 0
  // Importo automatico: la selezione (o il residuo intero).
  const autoAmount =
    remaining.length === 0 || allSelected ? due : splitting ? selectionAmount(order, selection) : 0
  const manual = display !== null
  const amount = manual ? digitsToEuro(display) : autoAmount
  // Non si incassa mai oltre il dovuto: l'eccedenza digitata è il RESTO.
  const toPay = Math.min(round2(amount), due)
  const change = Math.max(0, round2(amount - due))

  const readerReady = settings.payments_reader_enabled && settings.sumup_reader_id
  const methods = [
    { key: 'banco', label: 'Contante', emoji: '💵' },
    ...(readerReady ? [{ key: 'lettore', label: 'SumUp (lettore)', emoji: '📟' }] : []),
  ]

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

  // ── Tastierino ──
  const current = () => (display !== null ? digitsToEuro(display) : autoAmount)
  const key = (d) => setDisplay((s) => ((s === null ? '' : s) + d).slice(0, 8))
  const back = () =>
    setDisplay((s) => {
      const cur = s === null ? toDigits(autoAmount) : s
      const next = cur.slice(0, -1)
      return next.length ? next : '0'
    })
  const clear = () => {
    setDisplay(null)
    setAcc(null)
    setOp(null)
  }
  const divideBy = (n) => setDisplay(toDigits(round2(current() / n)))
  const setOperator = (o) => {
    setAcc(current())
    setOp(o)
    setDisplay('0')
  }
  const equals = () => {
    if (op === null || acc === null) return
    const b = current()
    const result =
      op === '+' ? acc + b : op === '-' ? acc - b : op === 'x' ? acc * b : b !== 0 ? acc / b : acc
    setDisplay(toDigits(round2(Math.max(0, result))))
    setAcc(null)
    setOp(null)
  }

  const riscuoti = () =>
    run(async () => {
      await onBeforePay?.()
      const items = !manual && splitting ? selection : null
      if (method === 'lettore') {
        const res = await readerCheckout(order.id, { amount: toPay, items })
        if (res?.unavailable) {
          setError('Lettore non disponibile in ambiente di sviluppo: simula dai DevTools.')
          return
        }
        setReaderStarted(true)
        return
      }
      const { closed: done } = await registerPayment(order.id, {
        amount: toPay,
        method: 'banco',
        items,
      })
      if (done) onClose()
    })

  const applyDiscount = () =>
    run(async () => {
      const value = Number(String(disc.value).replace(',', '.'))
      await setOrderDiscount(order.id, value > 0 ? { type: disc.type, value } : null)
      setShowDiscount(false)
    })

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
          padding: '8px 14px',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0 }}>💳 Pagamento · #{order.daily_number ?? '—'}</h3>
        <button className="btn ghost small" onClick={onClose}>✕ Chiudi</button>
      </div>

      {error && <div className="banner" style={{ margin: '8px 12px 0', flexShrink: 0 }}>{error}</div>}

      <div className="payscreen-body">
        {/* ── SINISTRA: articoli del conto (split) + riepilogo ── */}
        <div className="payscreen-items">
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {order.customer_name && (
              <p style={{ margin: '10px 0 2px', fontWeight: 600 }}>{order.customer_name}</p>
            )}
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

          {/* Riepilogo come nel POS: Pagato (verde) / Dovuto (rosso) / Totale */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            {(order.discount_amount || 0) > 0 && (
              <div className="row between muted small">
                <span>Sconto</span>
                <span>−{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            <div className="row between small">
              <span style={{ color: '#2ecc71' }}>Pagato</span>
              <span style={{ color: '#2ecc71' }}>{formatPrice(paid)}</span>
            </div>
            <div className="row between small">
              <span style={{ color: '#e74c3c' }}>Ammontare dovuto</span>
              <span style={{ color: '#e74c3c' }}>{formatPrice(due)}</span>
            </div>
            <div className="row between" style={{ marginTop: 4 }}>
              <strong>Totale</strong>
              <strong className="price">{formatPrice(order.total)}</strong>
            </div>
          </div>
        </div>

        {/* ── CENTRO: display + tastierino + Riscuotere + Preconto ── */}
        <div className="payscreen-pad">
          <div className="row between" style={{ alignItems: 'baseline', flexShrink: 0 }}>
            <span className="muted small">
              AMMONTARE DOVUTO
              <br />
              <span style={{ fontSize: '1.2rem' }}>{formatPrice(due)}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span className="muted small" style={{ letterSpacing: 0.5 }}>
                PAGAMENTO{op ? ` (${acc != null ? formatPrice(acc) : ''} ${op === 'x' ? '×' : op})` : ''}
              </span>
              <br />
              <strong style={{ fontSize: '2rem', color: '#3f7ce0' }} data-testid="pay-amount">
                {formatPrice(amount)}
              </strong>
            </span>
          </div>
          {change > 0 && method === 'banco' && (
            <p className="small" style={{ margin: '2px 0 0', textAlign: 'right', flexShrink: 0 }}>
              Resto: <strong>{formatPrice(change)}</strong> (si incassano {formatPrice(toPay)})
            </p>
          )}
          {!served && !closed && (
            <p className="muted small" style={{ margin: '2px 0 0', flexShrink: 0 }}>
              ⚠️ Comande non ancora servite: saldando tutto, il conto si chiude
              e risultano tutte servite.
            </p>
          )}
          {readerStarted && order.payment_status === 'in_attesa' && (
            <p className="muted small" style={{ margin: '2px 0 0', flexShrink: 0 }}>
              📟 Transazione avviata sul lettore: il conto si aggiorna da solo all'esito.
            </p>
          )}
          {closed && <p style={{ margin: '2px 0 0', flexShrink: 0 }}>✅ Conto pagato e chiuso.</p>}

          <div className="paypad" role="group" aria-label="Tastierino importo">
            <button className="paypad-key danger" onClick={clear}>C</button>
            <button className="paypad-key accent" onClick={() => divideBy(2)}>/2</button>
            <button className="paypad-key accent" onClick={() => divideBy(3)}>/3</button>
            <button className="paypad-key accent" onClick={() => setOperator('/')}>÷</button>
            <button className="paypad-key" onClick={() => key('7')}>7</button>
            <button className="paypad-key" onClick={() => key('8')}>8</button>
            <button className="paypad-key" onClick={() => key('9')}>9</button>
            <button className="paypad-key accent" onClick={() => setOperator('x')}>×</button>
            <button className="paypad-key" onClick={() => key('4')}>4</button>
            <button className="paypad-key" onClick={() => key('5')}>5</button>
            <button className="paypad-key" onClick={() => key('6')}>6</button>
            <button className="paypad-key accent" onClick={() => setOperator('-')}>−</button>
            <button className="paypad-key" onClick={() => key('1')}>1</button>
            <button className="paypad-key" onClick={() => key('2')}>2</button>
            <button className="paypad-key" onClick={() => key('3')}>3</button>
            <button className="paypad-key accent" onClick={() => setOperator('+')}>+</button>
            <button className="paypad-key" onClick={() => key('00')}>00</button>
            <button className="paypad-key" onClick={() => key('0')}>0</button>
            <button className="paypad-key accent" onClick={equals}>=</button>
            <button className="paypad-key danger" aria-label="Cancella cifra" onClick={back}>←</button>
          </div>

          {!closed && (
            <button
              className="btn block payscreen-collect"
              disabled={saving || !(toPay > 0)}
              onClick={riscuoti}
            >
              Riscuotere · {formatPrice(toPay)}
            </button>
          )}

          <button
            className="btn ghost small block"
            style={{ marginTop: 8, flexShrink: 0 }}
            onClick={() => printScontrino(order).catch((e) => setError(`Stampa: ${e.message}`))}
          >
            🖨 Preconto
          </button>
        </div>

        {/* ── DESTRA: metodi di pagamento + Sconto ── */}
        <div className="payscreen-methods">
          {methods.map((m) => (
            <button
              key={m.key}
              className={`payscreen-method${method === m.key ? ' active' : ''}`}
              aria-pressed={method === m.key}
              disabled={closed}
              onClick={() => setMethod(m.key)}
            >
              {m.emoji} {m.label}
              {m.key === 'lettore' && settings.sumup_reader_name ? (
                <span className="muted small"> ({settings.sumup_reader_name})</span>
              ) : null}
            </button>
          ))}

          <div style={{ marginTop: 'auto' }}>
            {showDiscount && !closed && (
              <div style={{ marginBottom: 8 }}>
                <label htmlFor="ps-disc">Sconto</label>
                <input
                  id="ps-disc"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={disc.value}
                  onChange={(e) => setDisc((d) => ({ ...d, value: e.target.value }))}
                  style={{ width: '100%' }}
                />
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <button
                    className={`btn small ${disc.type === 'percent' ? '' : 'ghost'}`}
                    onClick={() => setDisc((d) => ({ ...d, type: 'percent' }))}
                  >
                    %
                  </button>
                  <button
                    className={`btn small ${disc.type === 'euro' ? '' : 'ghost'}`}
                    onClick={() => setDisc((d) => ({ ...d, type: 'euro' }))}
                  >
                    €
                  </button>
                  {discDirty && (
                    <button className="btn secondary small grow" disabled={saving} onClick={applyDiscount}>
                      Applica
                    </button>
                  )}
                </div>
              </div>
            )}
            {!closed && (
              <button
                className="btn ghost small block"
                onClick={() => setShowDiscount((v) => !v)}
              >
                🎁 Sconto{(order.discount_amount || 0) > 0 ? ` (−${formatPrice(order.discount_amount)})` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
