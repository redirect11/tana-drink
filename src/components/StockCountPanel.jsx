import { useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  getOpenStockCount,
  startStockCount,
  updateStockCountLines,
  closeStockCount,
  fetchStockCounts,
  fetchLoadMovementsSince,
} from '../lib/api.js'
import { formatQty } from '../lib/inventory.js'
import { stockCountCompute, giorniDiConta, consumoSettimanale } from '../lib/warehouse.js'
import { formatPrice } from '../lib/orderStatus.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Conta di magazzino periodica, come i fogli INV dell'Excel storico:
// per ogni prodotto DEP (giacenza all'apertura) + ACQ (carichi nel periodo)
// − RIM (rimanenza contata) = CONS (consumo), con valori in €.
export default function StockCountPanel() {
  const [open, setOpen] = useState(undefined) // undefined=caricamento
  const [history, setHistory] = useState([])
  const [rims, setRims] = useState({}) // item_id -> valore input
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [viewing, setViewing] = useState(null) // conta chiusa in dettaglio

  async function load() {
    try {
      const [oc, hist] = await Promise.all([
        getOpenStockCount(),
        fetchStockCounts({ limit: 15 }),
      ])
      // ACQ live: carichi registrati dopo l'apertura della conta.
      if (oc) {
        const loads = await fetchLoadMovementsSince(oc.started_at).catch(() => [])
        const acqByItem = {}
        for (const m of loads) acqByItem[m.item_id] = (acqByItem[m.item_id] || 0) + m.qty
        oc.lines = oc.lines.map((l) => ({ ...l, acq: acqByItem[l.item_id] || 0 }))
        setRims(Object.fromEntries(oc.lines.map((l) => [l.item_id, l.rim ?? ''])))
      }
      setOpen(oc)
      setHistory(hist.filter((c) => c.status === 'closed'))
    } catch (e) {
      setError(e.message)
      setOpen(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const computed = useMemo(() => {
    if (!open) return null
    const lines = open.lines.map((l) => ({ ...l, rim: rims[l.item_id] === '' ? null : Number(rims[l.item_id]) }))
    // La conta è APERTA: il suo periodo finisce adesso e si allunga mentre
    // la si compila. Il consumo a settimana si divide per i giorni veri,
    // non per una costante da tenere aggiornata a mano.
    return stockCountCompute(lines, { dal: open.started_at })
  }, [open, rims])

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const items = await fetchInventoryItems()
      if (items.length === 0) {
        setError('Nessun prodotto in inventario: aggiungili prima di aprire una conta.')
        return
      }
      await startStockCount(items)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!open || !computed) return
    setBusy(true)
    setError(null)
    try {
      await updateStockCountLines(open.id, computed.lines)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doClose() {
    if (!open || !computed) return
    setConfirmClose(false)
    setBusy(true)
    setError(null)
    try {
      await closeStockCount(open.id, {
        lines: computed.lines,
        totals: computed.totals,
        align: true,
      })
      setRims({})
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (open === undefined) return <div className="empty">Carico la conta…</div>

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      {!open ? (
        <button className="btn block" onClick={start} disabled={busy}>
          ▶️ Nuova conta di magazzino
        </button>
      ) : (
        <>
          <div className="card row between" style={{ alignItems: 'center' }}>
            <div>
              <strong>Conta aperta</strong>
              <div className="muted small">
                dal {open.started_at?.slice(0, 10)}
                {computed.giorni != null && ` · ${giorniScritti(computed.giorni)}`} · contati{' '}
                {computed.totals.counted}/{open.lines.length}
              </div>
              <div className="muted small">
                Consumo: <strong>{formatPrice(computed.totals.cons_value)}</strong>
                {' · '}Valore rimanenze: {formatPrice(computed.totals.rim_value)}
              </div>
            </div>
          </div>

          <div className="inv-list" style={{ marginTop: 8 }}>
            {computed.lines.map((l) => (
              <div className="inv-item" key={l.item_id}>
                <div className="inv-row" style={{ cursor: 'default' }}>
                  <div className="grow">
                    <div className="inv-name">{l.name}</div>
                    <div className="muted small">
                      DEP {formatQty(l.dep, l.unit)} · ACQ {formatQty(l.acq, l.unit)}
                      {l.cons != null && (
                        <>
                          {' · '}CONS <strong>{formatQty(l.cons, l.unit)}</strong>
                          {l.cons_value > 0 && ` (${formatPrice(l.cons_value)})`}
                          {l.cons_week != null && (
                            <> · {formatQty(l.cons_week, l.unit)} a settimana</>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={rims[l.item_id] ?? ''}
                    placeholder={`RIM ${l.unit}`}
                    onChange={(e) => setRims((r) => ({ ...r, [l.item_id]: e.target.value }))}
                    style={{ width: 100, textAlign: 'right' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={saveDraft} disabled={busy}>
              💾 Salva bozza
            </button>
            <button className="btn small" onClick={() => setConfirmClose(true)} disabled={busy}>
              ✅ Chiudi conta
            </button>
          </div>
        </>
      )}

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Conte precedenti</strong>
          {history.map((c) => (
            <div
              className="row between"
              key={c.id}
              style={{ marginTop: 6, cursor: 'pointer' }}
              onClick={() => setViewing(viewing?.id === c.id ? null : c)}
            >
              <span className="muted small">
                {c.started_at?.slice(0, 10)} → {c.closed_at?.slice(0, 10)}
              </span>
              <span className="muted small">
                consumo <strong>{formatPrice(c.totals?.cons_value || 0)}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {viewing && <DettaglioConta conta={viewing} />}

      {confirmClose && computed && (
        <ConfirmDialog
          title="✅ Chiudere la conta?"
          message={`Prodotti contati: ${computed.totals.counted}/${open.lines.length}.\nLe giacenze dei prodotti contati verranno allineate alle rimanenze inserite.\nConsumo del periodo: ${formatPrice(computed.totals.cons_value)}.`}
          confirmLabel="Chiudi conta"
          onCancel={() => setConfirmClose(false)}
          onConfirm={doClose}
        />
      )}
    </div>
  )
}

// «tre settimane e mezzo» invece di «24,5 giorni»: al banco si ragiona a
// settimane, ed è la misura in cui si legge il consumo qui sotto.
function giorniScritti(giorni) {
  const g = Math.round(giorni)
  if (g < 14) return `${g} ${g === 1 ? 'giorno' : 'giorni'}`
  const settimane = Math.round((giorni / 7) * 10) / 10
  return `${String(settimane).replace('.', ',')} settimane`
}

// IL DETTAGLIO DI UNA CONTA CHIUSA. Il periodo qui è finito, quindi i
// giorni sono quelli veri fra apertura e chiusura — e il consumo a
// settimana si ricalcola da quelli, non da un divisore salvato: le conte
// vecchie non l'hanno mai avuto.
function DettaglioConta({ conta }) {
  const giorni = giorniDiConta(conta.started_at, conta.closed_at)
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <strong>Dettaglio conta {conta.started_at?.slice(0, 10)}</strong>
      {giorni != null && (
        <div className="muted small">
          {giorniScritti(giorni)} di consumo: il «a settimana» qui sotto è
          diviso per i giorni veri del periodo.
        </div>
      )}
      {(conta.lines || [])
        .filter((l) => l.cons != null && l.cons !== 0)
        .map((l) => (
          <div className="row between" key={l.item_id} style={{ marginTop: 4 }}>
            <span className="muted small">{l.name}</span>
            <span className="muted small">
              −{formatQty(l.cons, l.unit)} ({formatPrice(l.cons_value || 0)})
              {giorni != null &&
                ` · ${formatQty(consumoSettimanale(l.cons, giorni), l.unit)} a settimana`}
            </span>
          </div>
        ))}
    </div>
  )
}
