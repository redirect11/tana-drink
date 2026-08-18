import { useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  fetchSuppliers,
  createPurchaseOrder,
  fetchPurchaseOrders,
  receivePurchaseOrder,
  deletePurchaseOrder,
} from '../lib/api.js'
import { formatQty, fmtContenuto, stockStatus } from '../lib/inventory.js'
import { purchaseOrderTotals, suggestedPackages, purchaseOrderText } from '../lib/warehouse.js'
import { formatPrice } from '../lib/orderStatus.js'
import { printOrdineFornitore } from '../lib/printer.js'
import { toastSuccess, toastError } from '../lib/toast.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Generatore ordini fornitore (come GENERATORE ORDINI dell'Excel): scegli il
// fornitore, componi le quantità a confezioni con totale live, salva l'ordine
// e al ricevimento la merce viene caricata a magazzino in un colpo.
export default function PurchaseOrdersPanel() {
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [supplierId, setSupplierId] = useState('') // fornitore del nuovo ordine
  const [qtys, setQtys] = useState({}) // item_id -> confezioni
  const [confirmReceive, setConfirmReceive] = useState(null) // ordine da ricevere

  async function load() {
    try {
      const [sups, its, ords] = await Promise.all([
        fetchSuppliers(),
        fetchInventoryItems(),
        fetchPurchaseOrders({ limit: 25 }),
      ])
      setSuppliers(sups)
      setItems(its)
      setOrders(ords)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const supplierItems = useMemo(
    () => items.filter((i) => i.supplier_id === supplierId && i.status !== 'out'),
    [items, supplierId]
  )

  const lines = useMemo(
    () =>
      supplierItems
        .map((it) => ({
          item_id: it.id,
          name: it.name,
          unit: it.unit,
          package_size: it.package_size ?? null,
          unit_cost: it.cost ?? 0,
          vat: it.vat ?? 22,
          qty_packages: Number(qtys[it.id]) || 0,
        }))
        .filter((l) => l.qty_packages > 0),
    [supplierItems, qtys]
  )
  const totals = useMemo(() => purchaseOrderTotals(lines), [lines])

  async function save() {
    if (!supplierId || lines.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const sup = suppliers.find((s) => s.id === supplierId)
      await createPurchaseOrder({
        supplier_id: supplierId,
        supplier_name: sup?.name ?? '',
        lines,
        total_net: totals.net,
        total_gross: totals.gross,
      })
      setQtys({})
      setSupplierId('')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doReceive(order) {
    setConfirmReceive(null)
    setBusy(true)
    setError(null)
    try {
      await receivePurchaseOrder(order.id)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Invia l'ordine al fornitore: client di posta precompilato (l'email si
  // imposta sull'anagrafica fornitore, bottone 📧 in Magazzino → Fornitori).
  function inviaEmail(order) {
    const sup = suppliers.find((x) => x.id === order.supplier_id)
    const body = purchaseOrderText(order)
    window.location.href = `mailto:${encodeURIComponent(sup?.email || '')}?subject=${encodeURIComponent(
      `Ordine ${order.supplier_name} — ${String(order.created_at || '').slice(0, 10)}`
    )}&body=${encodeURIComponent(body)}`
  }

  async function copia(order) {
    try {
      await navigator.clipboard.writeText(purchaseOrderText(order))
      toastSuccess('Ordine copiato negli appunti')
    } catch (e) {
      toastError(`Copia non riuscita: ${e.message}`)
    }
  }

  async function remove(order) {
    if (!confirm(`Eliminare l'ordine ${order.supplier_name} del ${order.created_at?.slice(0, 10)}?`)) return
    try {
      await deletePurchaseOrder(order.id)
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      <div className="card">
        <strong>Nuovo ordine</strong>
        <label htmlFor="po-sup" style={{ marginTop: 8 }}>Fornitore</label>
        <select id="po-sup" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setQtys({}) }}>
          <option value="">— Scegli fornitore —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {supplierId && supplierItems.some((it) => suggestedPackages(it) > 0) && (
          <button
            className="btn secondary small block"
            style={{ marginTop: 8 }}
            onClick={() =>
              setQtys((q) => {
                const next = { ...q }
                for (const it of supplierItems) {
                  const sugg = suggestedPackages(it)
                  if (sugg > 0 && !next[it.id]) next[it.id] = String(sugg)
                }
                return next
              })
            }
          >
            ⚡ Precompila i sotto scorta (quantità suggerite)
          </button>
        )}

        {supplierId && supplierItems.length === 0 && (
          <p className="muted small" style={{ marginTop: 8 }}>
            Nessun prodotto assegnato a questo fornitore (assegna il fornitore ai
            prodotti dal magazzino).
          </p>
        )}

        {supplierItems.map((it) => {
          const st = stockStatus(it)
          return (
            <div className="row between" key={it.id} style={{ alignItems: 'center', marginTop: 6 }}>
              <div className="grow">
                <span>{it.name}</span>{' '}
                {st !== 'ok' && (
                  <span className={st === 'empty' ? 'badge-empty' : 'badge-low'}>
                    {st === 'empty' ? 'esaurito' : 'in esaurimento'}
                  </span>
                )}
                <div className="muted small">
                  In casa: {formatQty(it.stock, it.unit)}
                  {/* Il contenuto non si misura mai in pezzi: con la giacenza
                      contata a pezzi «1 conf. = 700 pz» era il contenuto letto
                      nell'unità sbagliata. E la parola è «pz», che vale anche
                      per quello che bottiglia non è (REQ-MAG-016, REQ-MAG-019). */}
                  {it.package_size ? ` · 1 pz = ${fmtContenuto(it.package_size, it)}` : ''}
                  {suggestedPackages(it) > 0 ? ` · sugg. ${suggestedPackages(it)} pz` : ''}
                </div>
              </div>
              <input
                type="number"
                step="1"
                min="0"
                value={qtys[it.id] ?? ''}
                placeholder="pz"
                onChange={(e) => setQtys((q) => ({ ...q, [it.id]: e.target.value }))}
                style={{ width: 76, textAlign: 'right' }}
              />
            </div>
          )
        })}

        {lines.length > 0 && (
          <>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <div className="row between">
              <span className="muted">{totals.pieces} confezioni · netto {formatPrice(totals.net)}</span>
              <strong>{formatPrice(totals.gross)} <span className="muted small">+IVA</span></strong>
            </div>
            <button className="btn block" style={{ marginTop: 8 }} onClick={save} disabled={busy}>
              📤 Salva ordine
            </button>
          </>
        )}
      </div>

      {orders.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Storico ordini</strong>
          {orders.map((o) => (
            <div key={o.id} style={{ marginTop: 8 }}>
              <div className="row between" style={{ alignItems: 'center' }}>
                <div>
                  <span>{o.status === 'ricevuto' ? '✅' : '📤'} {o.supplier_name}</span>
                  <div className="muted small">
                    {o.created_at?.slice(0, 10)} · {o.lines.length} art. · {formatPrice(o.total_gross)}
                  </div>
                </div>
                <span className="row" style={{ gap: 4 }}>
                  {o.status !== 'ricevuto' && (
                    <button className="btn small" onClick={() => setConfirmReceive(o)} disabled={busy}>
                      📦 Ricevuto
                    </button>
                  )}
                  <button className="btn ghost small" title="Invia via email" onClick={() => inviaEmail(o)}>📧</button>
                  <button className="btn ghost small" title="Copia il testo" onClick={() => copia(o)}>📋</button>
                  <button
                    className="btn ghost small"
                    title="Stampa"
                    onClick={() => printOrdineFornitore(o).catch((e) => toastError(`Stampa: ${e.message}`))}
                  >
                    🖨
                  </button>
                  <button className="btn ghost small" onClick={() => remove(o)}>🗑</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmReceive && (
        <ConfirmDialog
          title="📦 Merce ricevuta?"
          message={`L'ordine ${confirmReceive.supplier_name} del ${confirmReceive.created_at?.slice(0, 10)} verrà caricato a magazzino (${confirmReceive.lines.length} articoli).`}
          confirmLabel="Carica a magazzino"
          onCancel={() => setConfirmReceive(null)}
          onConfirm={() => doReceive(confirmReceive)}
        />
      )}
    </div>
  )
}
