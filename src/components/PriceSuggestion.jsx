import { useEffect, useMemo, useState } from 'react'
import { subscribeSettings, DEFAULT_SETTINGS } from '../lib/api.js'
import { recipeCost, suggestedPrice, markupOf, marginOf } from '../lib/pricing.js'
import { formatPrice } from '../lib/orderStatus.js'

// «Quanto mi costa, a quanto lo vendo»: riquadro condiviso dal PRODOTTO
// LIBERO del POS e dall'EDITOR DEL DRINK a menù, così il conto è lo stesso
// in tutti e due i posti.
//
//  · prezzo REALE   = somma di qty × costo al dettaglio degli ingredienti
//                     (dal listino di magazzino, IVA inclusa)
//  · CONSIGLIATO    = reale × ricarico del bartender, arrotondato
//  · GUADAGNO       = quanto resta col prezzo effettivamente impostato
//
// `rows` sono le righe di ricetta in corso di modifica: { inventory_item_id,
// qty, unit } con la quantità nell'unità di inserimento (cl, ml, g, pz).
export default function PriceSuggestion({ rows, itemsById, price, onUse }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])

  // I nomi servono solo a dire QUALI ingredienti non hanno un costo.
  const righe = useMemo(
    () => (rows || []).map((r) => ({ ...r, name: r.name || itemsById?.[r.inventory_item_id]?.name })),
    [rows, itemsById]
  )
  const { cost, missing } = useMemo(() => recipeCost(righe, itemsById), [righe, itemsById])
  const consigliato = useMemo(
    () => suggestedPrice(cost, { markup: settings.price_markup, step: settings.price_round_step }),
    [cost, settings.price_markup, settings.price_round_step]
  )

  if (!(cost > 0)) return null

  const priceNum = Number(String(price).replace(',', '.')) || 0
  const guadagno = marginOf(priceNum, cost)
  const ricarico = markupOf(priceNum, cost)
  const inPerdita = guadagno != null && guadagno < 0

  return (
    <div className="card" style={{ margin: '8px 0 0', padding: '8px 10px' }}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <span className="muted small">Prezzo reale (costo ingredienti)</span>
        <strong>{formatPrice(cost)}</strong>
      </div>

      {consigliato != null && (
        <div className="row between" style={{ alignItems: 'center', marginTop: 6 }}>
          <span className="muted small">Consigliato (×{settings.price_markup})</span>
          <span className="row" style={{ gap: 8, alignItems: 'center' }}>
            <strong className="price">{formatPrice(consigliato)}</strong>
            <button
              type="button"
              className="btn small"
              disabled={priceNum === consigliato}
              onClick={() => onUse(consigliato)}
            >
              Usa prezzo consigliato
            </button>
          </span>
        </div>
      )}

      {priceNum > 0 && (
        <div
          className="row between small"
          style={{ marginTop: 6, borderTop: '1px dashed var(--line)', paddingTop: 6 }}
        >
          <span className="muted">Con {formatPrice(priceNum)} {inPerdita ? 'perdi' : 'guadagni'}</span>
          <span>
            <strong className={inPerdita ? 'neg' : ''}>{formatPrice(Math.abs(guadagno))}</strong>
            {ricarico != null && <span className="muted"> · ×{ricarico}</span>}
          </span>
        </div>
      )}

      {missing.length > 0 && (
        <div className="muted small" style={{ marginTop: 6 }}>
          ⚠️ Stima parziale: manca il costo al dettaglio di {missing.join(', ')}.
          Impostalo in Magazzino per avere il prezzo reale.
        </div>
      )}
    </div>
  )
}
