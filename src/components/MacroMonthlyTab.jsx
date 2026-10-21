import { useEffect, useMemo, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchVenditeStoriche,
  fetchDrinks,
  fetchInventoryItems,
  fetchMacroCategories,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { macroMonthlyReport, UNASSIGNED } from '../lib/macroStats.js'
import Didascalia from './Didascalia.jsx'
import Soffietto from './Soffietto.jsx'
import { BloccoMacro, BloccoTotale } from './TabellaMacro.jsx'
import { colonneDelBilancio } from '../lib/periodiBilancio.js'
import { unisciVendite } from '../lib/venditeStoriche.js'

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
      // Gli anni di Tiller (REQ-STAT-006).
      fetchVenditeStoriche(`${year}-01-01`, `${year}-12-31`),
    ])
      .then(([app, drinks, items, macros, storiche]) => {
        if (!active) return
        const orders = unisciVendite(app, storiche, {
          drinks,
          cutoffHour: cutoff,
          dal: `${year}-01-01`,
          al: `${year}-12-31`,
        })
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

      <SpiegazioneTabella saleVat={settings.sale_vat} />
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
        </>
      )}
    </div>
  )
}

// COSA MISURA LA TABELLA, A SCOMPARSA IN CIMA (REQ-UI-029). Dentro: la
// domanda a cui risponde, la DIFFERENZA con «Acquisti × Fatturato» — la
// prima cosa che si chiede chi mette i due numeri accanto, e l'esempio delle
// birre comprate a giugno la fa vedere — e le parole delle righe. Nel
// registro del gestionale (DESIGN.md, guardrail 3).
function SpiegazioneTabella({ saleVat }) {
  return (
    <Soffietto titolo="Cosa misura questa tabella">
      <Didascalia>
        <strong>Quanto rende ciò che si vende.</strong> Per ogni macro-categoria, l’incassato delle voci di menù
        e il costo della merce che quelle vendite hanno consumato, calcolato dalle ricette. Ogni voce conta sulla
        sua macro secondo la quota che ha lì, incasso e costo insieme.
      </Didascalia>
      <Didascalia>
        <strong>Differenza con «Acquisti × Fatturato».</strong> Qui il costo è quello della merce{' '}
        <strong>venduta</strong> nel mese, non di quella acquistata: un acquisto di scorta non sposta il margine
        del mese in cui entra. Trenta casse di birra comprate a giugno per l’estate qui pesano solo per le birre
        vendute, mese per mese; in «Acquisti × Fatturato» pesano tutte su giugno, che sembra in perdita, e luglio
        sembra in forte attivo. Sui periodi lunghi le due tabelle si avvicinano; sul singolo mese possono essere
        molto diverse.
      </Didascalia>
      <Didascalia>
        <strong>Margine</strong>: incassato − costo del venduto. <strong>Inc/Costo</strong>: incassato ÷ costo
        del venduto (×4: ogni euro di merce venduta ne ha incassati quattro). <strong>Incidenza</strong>: quota
        del margine della macro sul margine di tutte le macro del mese. <strong>Incidenza sull’anno</strong> (sui
        totali): quota dell’incassato del mese sull’incassato dell’anno.
      </Didascalia>
      <Didascalia>
        Valori <strong>al netto dell’IVA</strong>: incassato scorporato al {saleVat}% (o all’aliquota della voce,
        dove ne ha una sua), costo al netto dell’IVA d’acquisto. Il foglio di analisi confronta invece il
        fatturato con la merce <strong>entrata dalla porta</strong>, al lordo: i due numeri non tornano, e non
        devono. Le vendite di Tiller (giugno 2023 – agosto 2026) usano le ricette attuali.
      </Didascalia>
    </Soffietto>
  )
}
