import { useEffect, useMemo, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchDrinks,
  fetchInventoryItems,
  fetchMacroCategories,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { macroMonthlyReport, UNASSIGNED } from '../lib/macroStats.js'
import Didascalia from './Didascalia.jsx'
import { BloccoMacro, BloccoTotale } from './TabellaMacro.jsx'
import { colonneDelBilancio } from '../lib/periodiBilancio.js'

// BILANCIO → VENDUTO × INCASSATO: quanto ha incassato ogni gruppo di voci
// del menù, quanto è costata la merce che ha venduto, che margine ne resta.
//
// Stava nelle STATISTICHE e ha traslocato qui: quanto ha reso ogni macro è
// una domanda da conti di fine mese, non da serata. Chi apre le Statistiche
// vuole sapere com'è andata ieri, chi apre il Bilancio com'è andato il mese
// — due mestieri diversi, anche se i numeri escono dalla stessa cassa. Il
// contenuto non è cambiato: sono cambiate la casa e due righe in più.
//
// La vendita di una voce va alla macro di quella voce, SECONDO LA QUOTA che
// la voce ha lì (di solito il 100% in una sola), incasso e costo insieme
// (vedi lib/macroStats.js): la Schweppes versata in un Gin Tonic conta sui
// distillati, perché lì è stata venduta. Da qui non si legge «quanto ho
// speso in bibite» — quella è la domanda degli ACQUISTI e vive con le
// fatture, non in una tabella che parla del venduto.

// Le righe nell'ordine di questa tabella: prima quello che è entrato in
// cassa, poi quanto è costato.
const RIGHE = [
  { campo: 'incasso', label: 'Incassato', cls: 'r-inc' },
  { campo: 'costo', label: 'Costo del venduto', cls: 'r-cos' },
  { campo: 'margine', label: 'Margine', cls: 'r-mar' },
  { campo: 'rapporto', label: 'Inc/Costo', cls: 'r-rap' },
]

export default function MacroMonthlyTab() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour

  const [data, setData] = useState(null) // { orders, drinks, items, macros }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      fetchOrdersBetween(`${year}-01-01`, `${year}-12-31`, cutoff).catch(() => []),
      fetchDrinks({}).catch(() => []),
      // I prodotti servono solo per il COSTO di quello che è uscito: qui
      // si guarda il lato delle VOCI di ogni macro (pesi_voci).
      fetchInventoryItems().catch(() => []),
      fetchMacroCategories().catch(() => []),
    ])
      .then(([orders, drinks, items, macros]) => {
        if (!active) return
        setData({ orders, drinks, items, macros })
        setLoading(false)
      })
      .catch((e) => active && (setError(e.message), setLoading(false)))
    return () => {
      active = false
    }
  }, [year, cutoff])

  // I dodici mesi, le stesse colonne della vista per anno di «Acquisti ×
  // Fatturato».
  const colonne = useMemo(() => colonneDelBilancio('anno', `${year}-01-01`), [year])

  const report = useMemo(() => {
    if (!data) return null
    return macroMonthlyReport({
      orders: data.orders,
      drinksById: Object.fromEntries(data.drinks.map((d) => [d.id, d])),
      itemsById: Object.fromEntries(data.items.map((i) => [i.id, i])),
      macros: data.macros,
      months: colonne.map((c) => c.key),
      cutoffHour: cutoff,
      saleVat: settings.sale_vat,
    })
  }, [data, colonne, cutoff, settings.sale_vat])

  if (error) return <div className="banner">Errore: {error}</div>

  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button className="btn ghost small" onClick={() => setYear((y) => y - 1)}>←</button>
        <strong style={{ fontSize: '1.1rem' }}>{year}</strong>
        <button className="btn ghost small" onClick={() => setYear((y) => y + 1)}>→</button>
      </div>

      <p className="muted small" style={{ margin: '0 0 10px' }}>
        Ogni voce del menù conta sulla sua macro-categoria{' '}
        <strong>secondo la quota</strong> che le è data lì: incasso e costo
        dei suoi ingredienti insieme. Valori
        al <strong>netto IVA</strong> — l’incasso scorporato al{' '}
        {settings.sale_vat}% di rivendita (o all’aliquota della voce, dove ne
        ha una sua), il costo al netto dell’IVA d’acquisto.
      </p>
      {report && report.rows.some((r) => r.id === UNASSIGNED && r.tot.incasso > 0) && (
        <p className="muted small" style={{ margin: '-4px 0 10px' }}>
          ℹ️ In <strong>“Non attribuito”</strong> finisce l’incasso delle voci
          che nessuna macro reclama per intero: dai loro la quota in{' '}
          <strong>Magazzino → Macro-categorie</strong> e si sposta al posto suo.
        </p>
      )}

      {loading && <div className="empty">Carico l’andamento…</div>}

      {!loading && data && data.macros.length === 0 && (
        <div className="empty">
          Nessuna macro-categoria: creale in{' '}
          <strong>Magazzino → Macro-categorie</strong> e dai a ogni voce del
          menù la sua quota, poi qui vedrai incasso e costo per macro.
        </div>
      )}

      {!loading && report && data.macros.length > 0 && (
        <>
          {report.rows.map((r) => (
            <BloccoMacro key={r.id} row={r} colonne={colonne} righe={RIGHE} rapportoLabel="Inc/Costo anno" />
          ))}
          <BloccoTotale report={report} colonne={colonne} righe={RIGHE} incidenzaLabel="Incidenza sull’anno" />
          <SpiegazioneTabella saleVat={settings.sale_vat} />
        </>
      )}
    </div>
  )
}

// COSA VUOL DIRE OGNI RIGA, in parole da banco. Sono quattro parole da
// contabile — margine, inc/costo, le due incidenze — e senza una frase che
// le spieghi la tabella la sa leggere solo chi l'ha scritta.
//
// E LA DIFFERENZA COL FOGLIO VA DETTA QUI, perché è la prima cosa che si
// chiede chi mette i due numeri accanto: non torneranno mai identici, e non
// perché uno dei due sbaglia.
function SpiegazioneTabella({ saleVat }) {
  return (
    <div className="card">
      <Didascalia>
        <strong>Margine</strong>: quello che resta dell’incasso dopo aver
        pagato la merce che è uscita per farlo.{' '}
        <strong>Inc/Costo</strong>: quante volte rientra quello che hai speso
        — ×4 vuol dire che ogni euro di merce ne ha incassati quattro.{' '}
        <strong>Incidenza</strong>: quanto pesa questo gruppo sul margine di
        tutto il mese — se i quattro gruppi fanno 100, questo quanto ne
        prende. <strong>Incidenza sull’anno</strong> (in fondo, sui totali):
        quanto pesa questo mese sull’incassato dell’anno.
      </Didascalia>
      <Didascalia>
        <strong>Se lo confronti col foglio non torna, ed è giusto così.</strong>{' '}
        Qui l’incassato si confronta con il costo della merce{' '}
        <strong>venduta</strong>, tutti e due al netto dell’IVA (l’incasso
        scorporato al {saleVat}%, o all’aliquota della singola voce dove ne ha
        una sua). Il foglio confronta il fatturato con la
        merce <strong>entrata dalla porta</strong>, al lordo. Le percentuali
        si somigliano, gli importi no.
      </Didascalia>
    </div>
  )
}
