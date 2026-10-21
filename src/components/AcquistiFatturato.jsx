import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOrdersBetween,
  fetchDrinks,
  fetchInventoryItems,
  fetchMacroCategories,
  fetchPurchaseOrders,
  fetchCarichiBetween,
  fetchVenditeStoriche,
  subscribeSettings,
  settingsIniziali,
} from '../lib/api.js'
import { businessDayKey } from '../lib/businessDay.js'
import { acquistiFatturato } from '../lib/acquistiFatturato.js'
import { unisciVendite } from '../lib/venditeStoriche.js'
import { VISTE, colonneDelBilancio, nomeDelPeriodo, spostaGiorno } from '../lib/periodiBilancio.js'
import { BloccoMacro, BloccoTotale } from './TabellaMacro.jsx'
import Didascalia from './Didascalia.jsx'
import GruppoChip from './GruppoChip.jsx'
import Soffietto from './Soffietto.jsx'

// BILANCIO → ACQUISTI × FATTURATO (REQ-MAG-022): il foglio «RAPPORTI
// ACQUISTI» di Flavio, per anno, mese, settimana o giorno. Il conto sta in
// lib/acquistiFatturato.js; qui si sceglie il periodo, si legge quello che
// serve e lo si disegna con la tabella di «Venduto × Incassato».

// Le righe nell'ordine del foglio: ACQUISTI, FATTURATO, UTILE, RAPPORTO.
const RIGHE = [
  { campo: 'costo', label: 'Acquisti', cls: 'r-cos' },
  { campo: 'incasso', label: 'Fatturato', cls: 'r-inc' },
  { campo: 'margine', label: 'Utile', cls: 'r-mar' },
  { campo: 'rapporto', label: 'Fat/Acq', cls: 'r-rap' },
]
const IVA = [
  { id: true, label: 'Lordo IVA' },
  { id: false, label: 'Netto IVA' },
]

export default function AcquistiFatturato() {
  // Le impostazioni ricordate, non quelle di partenza: con un cambio di
  // giornata diverso dal predefinito la prima lettura sarebbe da buttare.
  const [settings, setSettings] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const cutoff = settings.business_day_cutoff_hour

  const [vista, setVista] = useState('anno')
  const [giorno, setGiorno] = useState(() => businessDayKey(new Date()))
  // Si apre al LORDO: è come legge Flavio ed è com'è il foglio.
  const [lordo, setLordo] = useState(true)

  const colonne = useMemo(() => colonneDelBilancio(vista, giorno), [vista, giorno])
  const dal = colonne[0].dal
  const al = colonne[colonne.length - 1].al

  // Quello che non dipende dal periodo si legge una volta sola.
  const [fissi, setFissi] = useState(null) // { drinks, drinksById, items, macros, ordiniFornitore }
  // Conti, vendite di Tiller (REQ-STAT-006) e carichi del periodo mostrato,
  // con la chiave che dice di quale.
  const [periodo, setPeriodo] = useState(null) // { chiave, orders, storiche, carichi }
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    Promise.all([fetchDrinks({}), fetchInventoryItems(), fetchMacroCategories(), fetchPurchaseOrders()])
      .then(([drinks, items, macros, ordiniFornitore]) => {
        if (vivo) setFissi({ drinks, drinksById: Object.fromEntries(drinks.map((d) => [d.id, d])), items, macros, ordiniFornitore })
      })
      .catch((e) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [])

  // I PERIODI GIÀ VISTI RESTANO IN MANO: avanti e indietro con le frecce non
  // rilegge quello che si è appena guardato.
  const giaLetti = useRef(new Map())
  const chiave = `${dal}|${al}|${cutoff}`
  useEffect(() => {
    const letto = giaLetti.current.get(chiave)
    if (letto) {
      setPeriodo(letto)
      return undefined
    }
    let vivo = true
    Promise.all([fetchOrdersBetween(dal, al, cutoff), fetchVenditeStoriche(dal, al), fetchCarichiBetween(dal, al)])
      .then(([orders, storiche, carichi]) => {
        const dati = { chiave, orders, storiche, carichi }
        giaLetti.current.set(chiave, dati)
        if (vivo) setPeriodo(dati)
      })
      .catch((e) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [chiave, dal, al, cutoff])

  const pronto = fissi && periodo?.chiave === chiave
  // L'unione coi conti di Tiller dipende dal periodo, non da lordo/netto:
  // passare dall'uno all'altro non la rifà.
  const ordini = useMemo(
    () => (pronto ? unisciVendite(periodo.orders, periodo.storiche, { drinks: fissi.drinks, cutoffHour: cutoff, dal, al }) : null),
    [pronto, periodo, fissi, cutoff, dal, al]
  )
  const report = useMemo(() => {
    if (!pronto) return null
    return acquistiFatturato({
      orders: ordini,
      purchaseOrders: fissi.ordiniFornitore,
      movimenti: periodo.carichi,
      items: fissi.items,
      drinksById: fissi.drinksById,
      macros: fissi.macros,
      colonne,
      cutoffHour: cutoff,
      saleVat: settings.sale_vat,
      lordo,
    })
  }, [pronto, ordini, periodo, fissi, colonne, cutoff, settings.sale_vat, lordo])

  if (error) return <div className="banner">Errore: {error}</div>

  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <GruppoChip etichetta="Periodo della tabella" opzioni={VISTE} valore={vista} scegli={setVista} />
        <GruppoChip etichetta="IVA" opzioni={IVA} valore={lordo} scegli={setLordo} />
      </div>

      <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button className="btn ghost small" aria-label="Periodo precedente" onClick={() => setGiorno((g) => spostaGiorno(vista, g, -1))}>
          ←
        </button>
        <strong style={{ fontSize: '1.1rem' }}>{nomeDelPeriodo(vista, giorno)}</strong>
        <button className="btn ghost small" aria-label="Periodo successivo" onClick={() => setGiorno((g) => spostaGiorno(vista, g, 1))}>
          →
        </button>
      </div>

      <Spiegazione lordo={lordo} saleVat={settings.sale_vat} />

      {!report && <div className="empty">Calcolo acquisti e fatturato…</div>}

      {report && fissi.macros.length === 0 && (
        <div className="empty">
          Nessuna macro-categoria: si creano in <strong>Magazzino → Macro-categorie</strong>, con la quota di
          ogni prodotto e di ogni voce del menù.
        </div>
      )}

      {report && fissi.macros.length > 0 && (
        <>
          {report.rows.map((r) => (
            <BloccoMacro key={r.id} row={r} colonne={colonne} righe={RIGHE} rapportoLabel="Fat/Acq del periodo" />
          ))}
          <BloccoTotale
            report={report}
            colonne={colonne}
            righe={RIGHE}
            incidenzaLabel={VISTE.find((v) => v.id === vista).incidenza}
          />
        </>
      )}
    </div>
  )
}

// COSA MISURA LA TABELLA, A SCOMPARSA IN CIMA (REQ-UI-029): la domanda, la
// differenza con «Venduto × Incassato», le parole e le avvertenze. Nel
// registro del gestionale (DESIGN.md, guardrail 3): la legge il gestore.
function Spiegazione({ lordo, saleVat }) {
  return (
    <Soffietto titolo="Cosa misura questa tabella">
      <Didascalia>
        <strong>Quanto si spende in merce rispetto a quanto si fattura.</strong> È il foglio «Rapporti acquisti»:
        per ogni macro-categoria il fatturato del periodo e la merce entrata nello stesso periodo — consegne
        degli ordini fornitore alla data di consegna e carichi diretti — ripartita secondo le quote dei
        prodotti. Il fatturato è l’incassato delle voci di menù, sconti compresi, secondo le quote delle voci.
      </Didascalia>
      <Didascalia>
        <strong>La data di un acquisto è quella in cui la merce entra</strong>: il giorno della consegna
        dell’ordine o del carico, non quello del pagamento. Una fattura pagata a trenta giorni pesa sul mese
        in cui la merce è arrivata.
      </Didascalia>
      <Didascalia>
        <strong>Differenza con «Venduto × Incassato».</strong> Qui conta la merce <strong>entrata</strong>,
        quando entra, venduta o no; là il costo della merce <strong>venduta</strong>, dalle ricette. Trenta casse
        di birra comprate a giugno per l’estate qui pesano tutte su giugno, che sembra in perdita, e luglio
        sembra in forte attivo; là pesano solo le birre vendute, mese per mese. Per il margine di ciò che si
        vende: «Venduto × Incassato». Per quanto esce per comprare: questa.
      </Didascalia>
      <Didascalia>
        <strong>Utile</strong>: fatturato − acquisti. <strong>Fat/Acq</strong>: fatturato ÷ acquisti.{' '}
        <strong>Incidenza</strong>: quota dell’utile della macro sulla somma degli utili della colonna. In
        fondo, l’incidenza di ogni colonna sul fatturato del periodo.
      </Didascalia>
      <Didascalia>
        {lordo ? (
          <>
            Valori <strong>al lordo dell’IVA</strong>, come il foglio di analisi: incassato così com’è, acquisti
            con l’IVA del prodotto.
          </>
        ) : (
          <>
            Valori <strong>al netto dell’IVA</strong>: incassato scorporato al {saleVat}% (o all’aliquota della
            voce), acquisti al costo senza IVA.
          </>
        )}{' '}
        Gli acquisti ci sono da quando ordini fornitore e carichi passano dall’app (agosto 2026): per gli anni
        di Tiller c’è il fatturato ma non gli acquisti, e l’utile di quei mesi non è un utile. Lo storico del
        foglio non è importato.
      </Didascalia>
    </Soffietto>
  )
}
