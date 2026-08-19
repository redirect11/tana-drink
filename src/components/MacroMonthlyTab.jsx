import { useEffect, useMemo, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchDrinks,
  fetchInventoryItems,
  fetchCategories,
  fetchMacroCategories,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { categoryToMacro } from '../lib/macros.js'
import { macroMonthlyReport } from '../lib/macroStats.js'

// ANDAMENTO MENSILE PER MACRO-CATEGORIA DI MENÙ: quanto ha incassato ogni
// gruppo di voci del menù, quanto è costata la merce che ha venduto, che
// margine ne resta.
//
// La vendita di una voce va INTERA alla macro di quella voce, incasso e
// costo insieme (vedi lib/macroStats.js): la Schweppes versata in un Gin
// Tonic conta sui distillati, perché lì è stata venduta. Da qui non si
// legge «quanto ho speso in bibite» — quella è la domanda degli ACQUISTI e
// vive con le fatture, non in una tabella che parla del venduto.

const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']
const monthsOfYear = (year) => MESI.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
const eur0 = (v) =>
  `${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })} €`

export default function MacroMonthlyTab() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour

  const [data, setData] = useState(null) // { orders, drinks, items, cats, macros }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      fetchOrdersBetween(`${year}-01-01`, `${year}-12-31`, cutoff).catch(() => []),
      fetchDrinks({}).catch(() => []),
      // I prodotti servono ancora, ma solo per il COSTO di quello che è
      // uscito: le categorie e le macro qui sono quelle del MENÙ.
      fetchInventoryItems().catch(() => []),
      fetchCategories().catch(() => []),
      fetchMacroCategories('menu').catch(() => []),
    ])
      .then(([orders, drinks, items, cats, macros]) => {
        if (!active) return
        setData({ orders, drinks, items, cats, macros })
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
      drinksById: Object.fromEntries(data.drinks.map((d) => [d.id, d])),
      itemsById: Object.fromEntries(data.items.map((i) => [i.id, i])),
      menuCatToMacro: categoryToMacro(data.cats),
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
        Ogni voce del menù conta <strong>intera</strong> sulla sua
        macro-categoria: incasso e costo dei suoi ingredienti insieme. Valori
        al <strong>netto IVA</strong> — l’incasso scorporato al{' '}
        {settings.sale_vat}% di rivendita, il costo al netto dell’IVA
        d’acquisto.
      </p>
      {report && report.rows.some((r) => r.id === 'none' && r.tot.incasso > 0) && (
        <p className="muted small" style={{ margin: '-4px 0 10px' }}>
          ℹ️ In <strong>“Non attribuito”</strong> finisce l’incasso dei drink
          la cui categoria di menù non sta in nessuna macro: assegnala in{' '}
          <strong>Menù → Macro-categorie</strong> e si sposta al posto suo.
        </p>
      )}

      {loading && <div className="empty">Carico l’andamento…</div>}

      {!loading && data && data.macros.length === 0 && (
        <div className="empty">
          Nessuna macro-categoria di menù: creale in{' '}
          <strong>Menù → Macro-categorie</strong> e collega le categorie dei
          drink, poi qui vedrai incasso e costo per macro.
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
        <strong>🗂️ {row.name}</strong>
        <span className="muted small">
          Inc/Costo anno:{' '}
          <strong>{row.tot.rapporto != null ? `×${row.tot.rapporto}` : '—'}</strong>
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

// Tabella mesi × metriche (incasso/costo del venduto/margine/rapporto) con
// colonna TOT.
function MonthTable({ months, byMonth, tot }) {
  const cell = (m) => byMonth.get(m) || { incasso: 0, costo: 0, margine: 0, rapporto: null }
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
          <tr className="r-inc">
            <th className="rowhead">Incassato</th>
            {months.map((m) => <td key={m}>{eur0(cell(m).incasso)}</td>)}
            <td className="tot">{eur0(tot.incasso)}</td>
          </tr>
          <tr className="r-cos">
            <th className="rowhead">Costo del venduto</th>
            {months.map((m) => <td key={m}>{eur0(cell(m).costo)}</td>)}
            <td className="tot">{eur0(tot.costo)}</td>
          </tr>
          <tr className="r-mar">
            <th className="rowhead">Margine</th>
            {months.map((m) => (
              <td key={m} className={cell(m).margine < 0 ? 'neg' : ''}>{eur0(cell(m).margine)}</td>
            ))}
            <td className={`tot ${tot.margine < 0 ? 'neg' : ''}`}>{eur0(tot.margine)}</td>
          </tr>
          <tr className="r-rap">
            <th className="rowhead">Inc/Costo</th>
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
