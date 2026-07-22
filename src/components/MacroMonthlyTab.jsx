import { useEffect, useMemo, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchDrinks,
  fetchInventoryItems,
  fetchInventoryCategories,
  fetchMacroCategories,
  fetchPurchaseOrders,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { categoryToMacro } from '../lib/macros.js'
import { macroMonthlyReport } from '../lib/macroStats.js'

// DASHBOARD A — andamento MENSILE per MACRO-CATEGORIA: acquisti (ordini
// fornitore ricevuti nel mese), fatturato (incasso ripartito sugli ingredienti
// venduti), utile e rapporto Fat/Acq. Replica il cruscotto Excel per macro.

const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']
const monthsOfYear = (year) => MESI.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
const eur0 = (v) => `${Math.round(Number(v) || 0).toLocaleString('it-IT')} €`

export default function MacroMonthlyTab() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour

  const [data, setData] = useState(null) // { orders, drinks, items, cats, macros, pos }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      fetchOrdersBetween(`${year}-01-01`, `${year}-12-31`, cutoff).catch(() => []),
      fetchDrinks({}).catch(() => []),
      fetchInventoryItems().catch(() => []),
      fetchInventoryCategories().catch(() => []),
      fetchMacroCategories().catch(() => []),
      fetchPurchaseOrders({ limit: 500 }).catch(() => []),
    ])
      .then(([orders, drinks, items, cats, macros, pos]) => {
        if (!active) return
        setData({ orders, drinks, items, cats, macros, pos })
        setLoading(false)
      })
      .catch((e) => active && (setError(e.message), setLoading(false)))
    return () => {
      active = false
    }
  }, [year, cutoff])

  const report = useMemo(() => {
    if (!data) return null
    return macroMonthlyReport({
      orders: data.orders,
      purchaseOrders: data.pos,
      drinksById: Object.fromEntries(data.drinks.map((d) => [d.id, d])),
      itemsById: Object.fromEntries(data.items.map((i) => [i.id, i])),
      catToMacro: categoryToMacro(data.cats),
      macros: data.macros,
      months: monthsOfYear(year),
      cutoffHour: cutoff,
      saleVat: settings.sale_vat,
    })
  }, [data, year, cutoff, settings.sale_vat])

  if (error) return <div className="banner">Errore: {error}</div>

  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button className="btn ghost small" onClick={() => setYear((y) => y - 1)}>←</button>
        <strong style={{ fontSize: '1.1rem' }}>{year}</strong>
        <button className="btn ghost small" onClick={() => setYear((y) => y + 1)}>→</button>
      </div>

      <p className="muted small" style={{ margin: '0 0 10px' }}>
        Valori al <strong>netto IVA</strong> (vendita {settings.sale_vat}%, modificabile in
        Impostazioni). Acquisti = ordini fornitore segnati “ricevuto”.
      </p>

      {loading && <div className="empty">Carico l’andamento…</div>}

      {!loading && data && data.macros.length === 0 && (
        <div className="empty">
          Nessuna macro-categoria: creale in <strong>Inventario → 🗂 Macro-categorie</strong> e
          collega le categorie, poi qui vedrai acquisti e fatturato per macro.
        </div>
      )}

      {!loading && report && data.macros.length > 0 && (
        <>
          {report.rows.map((r) => (
            <MacroBlock key={r.id} row={r} months={report.months} />
          ))}
          <TotalBlock report={report} />
        </>
      )}
    </div>
  )
}

// Un blocco (card) per macro-categoria, con i mesi in colonna.
function MacroBlock({ row, months }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <strong>🗂 {row.name}</strong>
        <span className="muted small">
          Fat/Acq anno: <strong>{row.tot.rapporto != null ? `×${row.tot.rapporto}` : '—'}</strong>
        </span>
      </div>
      <MonthTable months={months} byMonth={row.byMonth} tot={row.tot} />
    </div>
  )
}

// Blocco finale con i totali di tutte le macro.
function TotalBlock({ report }) {
  return (
    <div className="card macro-total" style={{ marginBottom: 12 }}>
      <strong>Σ Totale ({report.rows.length} macro)</strong>
      <div style={{ marginTop: 6 }}>
        <MonthTable months={report.months} byMonth={report.totByMonth} tot={report.grand} />
      </div>
    </div>
  )
}

// Tabella mesi × metriche (acquisti/fatturato/utile/rapporto) con colonna TOT.
function MonthTable({ months, byMonth, tot }) {
  const cell = (m) => byMonth.get(m) || { acquisti: 0, fatturato: 0, utile: 0, rapporto: null }
  return (
    <div className="table-scroll">
      <table className="macro-tab">
        <thead>
          <tr>
            <th className="rowhead"></th>
            {months.map((m) => (
              <th key={m}>{MESI[Number(m.slice(5)) - 1]}</th>
            ))}
            <th className="tot">TOT</th>
          </tr>
        </thead>
        <tbody>
          <tr className="r-acq">
            <th className="rowhead">Acquisti</th>
            {months.map((m) => <td key={m}>{eur0(cell(m).acquisti)}</td>)}
            <td className="tot">{eur0(tot.acquisti)}</td>
          </tr>
          <tr className="r-fat">
            <th className="rowhead">Fatturato</th>
            {months.map((m) => <td key={m}>{eur0(cell(m).fatturato)}</td>)}
            <td className="tot">{eur0(tot.fatturato)}</td>
          </tr>
          <tr className="r-uti">
            <th className="rowhead">Utile</th>
            {months.map((m) => (
              <td key={m} className={cell(m).utile < 0 ? 'neg' : ''}>{eur0(cell(m).utile)}</td>
            ))}
            <td className={`tot ${tot.utile < 0 ? 'neg' : ''}`}>{eur0(tot.utile)}</td>
          </tr>
          <tr className="r-rap">
            <th className="rowhead">Fat/Acq</th>
            {months.map((m) => (
              <td key={m}>{cell(m).rapporto != null ? `×${cell(m).rapporto}` : '—'}</td>
            ))}
            <td className="tot">{tot.rapporto != null ? `×${tot.rapporto}` : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
