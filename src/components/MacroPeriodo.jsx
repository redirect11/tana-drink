import { useEffect, useMemo, useState } from 'react'
import {
  fetchInventoryItems,
  fetchMacroCategories,
  fetchPurchaseOrders,
  fetchStockMovementsSince,
} from '../lib/api.js'
import { macroNelPeriodo } from '../lib/macroStats.js'
import { businessDayKey } from '../lib/businessDay.js'
import { shiftDay } from '../lib/ore.js'
import { formatPrice } from '../lib/orderStatus.js'

// ── ACQUISTI, VENDUTO E GENERATO PER MACRO-CATEGORIA (REQ-STAT-004) ───
//
// Flavio, 30/09/2026: «quello che non vedo è la visualizzazione nelle
// statistiche di quello che c'è nelle macro-categorie: vedere gli acquisti,
// il venduto e quanto mi ha generato». Il conto sta in lib/macroStats.js
// (macroNelPeriodo); qui si legge quello che serve e lo si mette in fila.
//
// SI APRE A RICHIESTA, come «Magazzino nel periodo»: legge gli ordini
// fornitore, i prodotti, le macro e i movimenti di carico del periodo, e
// chi guarda l'incasso di una serata non deve pagare quella lettura.
//
// Segue lo STESSO periodo del resto della pagina: giornate intere (dal/al)
// o istanti (da/a) per «Personalizzato». I conti arrivano già tagliati
// (`ordini`); gli acquisti si tagliano qui, sulla data di consegna o del
// carico.
export default function MacroPeriodo({ ordini, drinksById, dal, al, da = null, a = null, cutoffHour, saleVat = 0 }) {
  const [aperto, setAperto] = useState(false)
  // Quello che si è letto, e da quando: `{ ordiniFornitore, items, macros, movimenti, dove }`.
  const [letti, setLetti] = useState(null)
  const [caricando, setCaricando] = useState(false)
  const [errore, setErrore] = useState(null)

  // I carichi si leggono dal primo istante del periodo (un giorno di
  // margine sulle giornate, come in «Magazzino nel periodo»); si rilegge
  // solo se si guarda più indietro.
  const dove = da || `${shiftDay(dal, -1)}T00:00:00.000Z`
  const bastaQuelloCheCe = letti && letti.dove <= dove
  useEffect(() => {
    if (!aperto || bastaQuelloCheCe) return undefined
    let vivo = true
    setCaricando(true)
    setErrore(null)
    Promise.all([fetchPurchaseOrders(), fetchInventoryItems(), fetchMacroCategories(), fetchStockMovementsSince(dove)])
      .then(([ordiniFornitore, items, macros, movimenti]) => {
        if (vivo) setLetti({ ordiniFornitore, items, macros, movimenti, dove })
      })
      .catch((e) => vivo && setErrore(e.message))
      .finally(() => vivo && setCaricando(false))
    return () => {
      vivo = false
    }
  }, [aperto, dove, bastaQuelloCheCe])

  const dati = useMemo(() => {
    if (!letti) return null
    // Una consegna o un carico cadono nel periodo? All'ora se il periodo è
    // fatto di istanti, alla giornata commerciale se no.
    const dentro = (t) => {
      if (!t) return false
      if (da) return t >= da && (!a || t < a)
      const g = businessDayKey(t, cutoffHour)
      return !!g && g >= dal && g <= al
    }
    return macroNelPeriodo({
      orders: ordini,
      purchaseOrders: letti.ordiniFornitore,
      movimenti: letti.movimenti,
      items: letti.items,
      drinksById,
      macros: letti.macros,
      saleVat,
      dentro,
    })
  }, [letti, ordini, drinksById, dal, al, da, a, cutoffHour, saleVat])

  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'center' }}>
        <h3 className="cat-header" style={{ margin: 0 }}>
          🗂️ Per macro-categoria
        </h3>
        <button type="button" className="btn ghost small" aria-expanded={aperto} onClick={() => setAperto((v) => !v)}>
          {aperto ? 'Nascondi' : 'Calcola'}
        </button>
      </div>

      {!aperto && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Acquisti, venduto e margine generato di ogni macro-categoria nel periodo selezionato.
        </p>
      )}
      {aperto && caricando && <div className="empty">Calcolo acquisti e vendite…</div>}
      {aperto && errore && <div className="banner">Errore: {errore}</div>}

      {aperto && !caricando && !errore && dati && (
        <>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Acquisti: righe d’ordine consegnate e carichi diretti, al netto IVA, ripartiti secondo le
            quote dei prodotti. Venduto: incassato delle voci di menù della macro, IVA scorporata.
            Generato: venduto − acquisti.
          </p>
          <div className="inv-list" style={{ marginTop: 8 }}>
            {dati.righe.map((r) => (
              <RigaMacro key={r.id} r={r} />
            ))}
            <RigaMacro r={{ id: 'totale', name: 'Totale', ...dati.totale }} totale />
          </div>
        </>
      )}
    </div>
  )
}

function RigaMacro({ r, totale = false }) {
  return (
    <div className="inv-item">
      <div className="inv-row" style={{ cursor: 'default' }}>
        <div className="grow">
          <div className="inv-name">{totale ? <strong>{r.name}</strong> : r.name}</div>
          <div className="muted small">
            Acquisti {formatPrice(r.acquisti)} · Venduto {formatPrice(r.venduto)} · Generato{' '}
            <strong>{formatPrice(r.generato)}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
