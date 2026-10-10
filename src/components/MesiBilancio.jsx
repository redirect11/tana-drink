import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchVenditeStoriche,
  fetchFoglioMese,
  fetchDrinks,
  fetchInventoryItems,
  fetchSupplierInvoices,
  fetchAltreSpese,
  subscribeStaffHoursRange,
  subscribeStaffShiftsRange,
  subscribeStaffRates,
  subscribeSettings,
  settingsIniziali,
} from '../lib/api.js'
import { businessDayKey } from '../lib/businessDay.js'
import { normalizeEntries } from '../lib/ore.js'
import { payrollReport, tariffePer } from '../lib/paghe.js'
import { revenueByDay } from '../lib/stats.js'
import { unisciVendite } from '../lib/venditeStoriche.js'
import { macroMonthlyReport } from '../lib/macroStats.js'
import { riepilogoMesi } from '../lib/riepilogoFornitori.js'
import { colonneDelBilancio, nomeDelPeriodo, spostaGiorno } from '../lib/periodiBilancio.js'
import { paghePerGiorno, tabellaDelMese } from '../lib/bilancioMesi.js'
import { formatPrice } from '../lib/orderStatus.js'
import Didascalia from './Didascalia.jsx'
import Soffietto from './Soffietto.jsx'

// BILANCIO → MESI (REQ-CASSA-011): il mese come il foglio di ANALISI DATI,
// per settimane, con minimo, incassato e differenza giorno per giorno, e
// sotto i conti del mese. Il conto sta in lib/bilancioMesi.js; qui si legge
// quello che serve e lo si dispone.

const euro = (v) => (v == null ? '—' : formatPrice(v))
const perc = (v) => (v == null ? '—' : `${String(v).replace('.', ',')}%`)
// La differenza dice il verso col segno e coi colori di stato, non col
// rosso: in questa app il rosso è annullato o errore (DESIGN.md).
const colore = (d) => (d == null ? undefined : { color: d < 0 ? 'var(--warn)' : 'var(--ok)' })

export default function MesiBilancio() {
  const [settings, setSettings] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour
  const oggi = businessDayKey(new Date(), cutoff)
  // Il primo del mese mostrato; le frecce lo spostano di un mese intero.
  const [dal, setDal] = useState(() => `${oggi.slice(0, 7)}-01`)
  const mese = dal.slice(0, 7)
  const al = useMemo(() => colonneDelBilancio('mese', dal).at(-1).al, [dal])

  // Quello che non dipende dal mese: si legge una volta.
  const [fissi, setFissi] = useState(null)
  const [errore, setErrore] = useState(null)
  useEffect(() => {
    let vivo = true
    Promise.all([
      fetchDrinks({}),
      fetchInventoryItems(),
      fetchSupplierInvoices({ limit: 500 }).catch(() => []),
      fetchAltreSpese({ limit: 500 }).catch(() => []),
    ])
      // Del Riepilogo di Fornitori serve il totale del mese (merce + altre
      // spese): ordini e fornitori servono solo alla colonna «senza
      // fattura», che qui non c'è.
      .then(([drinks, items, fatture, spese]) => {
        if (vivo) setFissi({ drinks, items, riepilogo: riepilogoMesi({ fatture, spese }) })
      })
      .catch((e) => vivo && setErrore(e.message))
    return () => {
      vivo = false
    }
  }, [])

  // Le ore e le tariffe: le stesse dell'Ore del personale.
  const [ore, setOre] = useState([])
  const [timbrature, setTimbrature] = useState([])
  const [tariffe, setTariffe] = useState([])
  useEffect(() => subscribeStaffRates(setTariffe, () => {}), [])
  useEffect(() => subscribeStaffHoursRange(dal, al, setOre, () => {}), [dal, al])
  useEffect(() => subscribeStaffShiftsRange(dal, al, setTimbrature, () => {}), [dal, al])

  // I conti del mese (app e Tiller) e il foglio, se il mese ce l'ha. I mesi
  // già visti restano in mano: avanti e indietro con le frecce non rilegge.
  const giaLetti = useRef(new Map())
  const [delMese, setDelMese] = useState(null) // { mese, app, storiche, foglio }
  useEffect(() => {
    const letto = giaLetti.current.get(`${mese}|${cutoff}`)
    if (letto) {
      setDelMese(letto)
      return undefined
    }
    let vivo = true
    Promise.all([fetchOrdersBetween(dal, al, cutoff), fetchVenditeStoriche(dal, al), fetchFoglioMese(mese)])
      .then(([app, storiche, foglio]) => {
        const dati = { mese, app, storiche, foglio }
        giaLetti.current.set(`${mese}|${cutoff}`, dati)
        if (vivo) setDelMese(dati)
      })
      .catch((e) => vivo && setErrore(e.message))
    return () => {
      vivo = false
    }
  }, [mese, dal, al, cutoff])

  // LE VENDITE DEL MESE e il costo di ciò che si è venduto: non cambiano con
  // una timbratura, quindi stanno per conto loro.
  const vendite = useMemo(() => {
    if (!fissi || delMese?.mese !== mese) return null
    const ordini = unisciVendite(delMese.app, delMese.storiche, { drinks: fissi.drinks, cutoffHour: cutoff, dal, al })
    const venduto = macroMonthlyReport({
      orders: ordini,
      drinksById: Object.fromEntries(fissi.drinks.map((d) => [d.id, d])),
      itemsById: Object.fromEntries(fissi.items.map((i) => [i.id, i])),
      macros: [],
      months: [mese],
      cutoffHour: cutoff,
      saleVat: settings.sale_vat,
    }).grand
    return { incassi: new Map(revenueByDay(ordini, cutoff).map((g) => [g.id, g.incasso])), venduto }
  }, [fissi, delMese, mese, dal, al, cutoff, settings.sale_vat])

  // LE PAGHE: seguono ore, timbrature e tariffe, che arrivano dal vivo.
  const paghe = useMemo(() => {
    const voci = normalizeEntries(ore, timbrature)
    const perVoce = tariffePer(tariffe)
    return { perGiorno: paghePerGiorno(voci, perVoce, oggi), busta: payrollReport(voci, perVoce) }
  }, [ore, timbrature, tariffe, oggi])

  const tabella = useMemo(() => {
    if (!vendite) return null
    const riga = fissi.riepilogo.find((r) => r.mese === mese)
    return tabellaDelMese({
      mese,
      incassi: vendite.incassi,
      foglio: delMese.foglio,
      paghe: paghe.perGiorno,
      stipendi: paghe.busta.oreTotali > 0 ? paghe.busta.totale : null,
      stipendiParziali: paghe.busta.parziale,
      spese: riga ? riga.totale : null,
      incassoNetto: vendite.venduto.incasso,
      costoVenduto: vendite.venduto.costo,
      oggi,
    })
  }, [vendite, paghe, fissi, delMese, mese, oggi])

  if (errore) return <div className="banner">Errore: {errore}</div>

  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button className="btn ghost small" aria-label="Mese precedente" onClick={() => setDal(spostaGiorno('mese', dal, -1))}>
          ←
        </button>
        <strong style={{ fontSize: '1.1rem' }}>{nomeDelPeriodo('mese', dal)}</strong>
        <button className="btn ghost small" aria-label="Mese successivo" onClick={() => setDal(spostaGiorno('mese', dal, 1))}>
          →
        </button>
      </div>

      <Spiegazione />

      {!tabella && <div className="empty">Carico il mese…</div>}
      {tabella && (
        <>
          {tabella.settimane.map((s) => (
            <Settimana key={s.label} settimana={s} />
          ))}
          <Totali totali={tabella.totali} />
        </>
      )}
    </div>
  )
}

function Settimana({ settimana: s }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <strong>
          {s.label} <span className="muted small">{s.sotto}</span>
        </strong>
        <span className="muted small">
          Differenza: <strong style={colore(s.tot.differenza)}>{euro(s.tot.differenza)}</strong>
        </span>
      </div>
      <div className="table-scroll">
        <table className="macro-tab">
          <thead>
            <tr>
              <th className="rowhead"></th>
              {s.giorni.map((g) => (
                <th key={g.giorno}>
                  {g.nome}
                  {g.nota && <div className="muted">{g.nota}</div>}
                </th>
              ))}
              <th className="tot">TOT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="rowhead">Minimo</th>
              {s.giorni.map((g) => (
                <td key={g.giorno}>{euro(g.minimo)}</td>
              ))}
              <td className="tot">{euro(s.tot.minimo)}</td>
            </tr>
            <tr className="r-inc">
              <th className="rowhead">Incassato</th>
              {s.giorni.map((g) => (
                <td key={g.giorno}>{euro(g.incassato)}</td>
              ))}
              <td className="tot">{euro(s.tot.incassato)}</td>
            </tr>
            <tr className="r-mar">
              <th className="rowhead">Differenza</th>
              {s.giorni.map((g) => (
                <td key={g.giorno} style={colore(g.differenza)}>
                  {euro(g.differenza)}
                </td>
              ))}
              <td className="tot" style={colore(s.tot.differenza)}>
                {euro(s.tot.differenza)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Totali({ totali: t }) {
  const riga = (label, valore, nota = null, stile) => (
    <div className="summary-row">
      <span className="muted">
        {label}
        {nota && <span className="small"> · {nota}</span>}
      </span>
      <strong style={stile}>{valore}</strong>
    </div>
  )
  return (
    <div className="card macro-total" style={{ marginBottom: 12 }}>
      <strong>Σ Il mese</strong>
      <div className="summary-rows" style={{ marginTop: 6 }}>
        {riga('Incassi', euro(t.incassi))}
        {riga(
          'Stipendi',
          euro(t.stipendi),
          t.dalFoglio.stipendi
            ? 'dal foglio'
            : t.stipendi == null
              ? 'ore non registrate'
              : t.stipendiParziali
                ? 'dalle ore, parziali: manca qualche tariffa'
                : 'dalle ore'
        )}
        {riga('Spese', euro(t.spese), t.dalFoglio.spese ? 'dal foglio' : t.spese == null ? 'nessuna registrata' : 'merce e altre spese')}
        {riga('Netto', euro(t.netto), null, colore(t.netto))}
        {riga('Differenza dal minimo', euro(t.differenza), null, colore(t.differenza))}
        {riga('Costo del lavoro', perc(t.costoLavoroPct))}
        {riga('Prime cost', perc(t.primeCostPct))}
      </div>
    </div>
  )
}

// COSA MISURA LA TABELLA, a scomparsa (REQ-UI-029), nel registro del
// gestionale. Prime cost e costo del lavoro sono le righe che il foglio non
// aveva, e che senza una frase non si sanno leggere (REQ-CASSA-011).
function Spiegazione() {
  return (
    <Soffietto titolo="Cosa misura questa tabella">
      <Didascalia>
        <strong>Il mese giorno per giorno</strong>, diviso per settimane come i fogli mensili di analisi:{' '}
        <strong>minimo</strong> (quanto il locale doveva fare quella sera), <strong>incassato</strong> (quanto ha
        fatto: i conti dell’app e, fino all’agosto 2026, quelli di Tiller, per giornata commerciale) e{' '}
        <strong>differenza</strong>. Sopra il giorno, le note del foglio.
      </Didascalia>
      <Didascalia>
        <strong>Da dove viene il minimo.</strong> Nei mesi dei fogli (gennaio 2025 – luglio 2026) è quello scritto
        nel foglio. Nei mesi dell’app è il costo del personale di quel giorno — ore effettive per i giorni passati,
        turni programmati per quelli a venire, alla paga in vigore — senza ancora l’extra deciso dall’admin. Un
        giorno senza ore registrate non ha minimo.
      </Didascalia>
      <Didascalia>
        <strong>Il mese.</strong> Netto = incassi − stipendi − spese. Nei mesi dei fogli stipendi e spese sono
        quelli del foglio, dove le spese comprendono anche la merce; nei mesi dell’app gli stipendi vengono dalle
        ore registrate e le spese sono la merce fatturata più le altre spese del Riepilogo di Fornitori.{' '}
        <strong>Costo del lavoro</strong>: stipendi sull’incassato al netto dell’IVA. <strong>Prime cost</strong>:
        stipendi più costo della merce venduta (dalle ricette), sull’incassato al netto dell’IVA — il numero con
        cui si capisce se il mese è andato.
      </Didascalia>
    </Soffietto>
  )
}
