import { useEffect, useMemo, useState } from 'react'
import { fetchMovimentiProdotto, fetchVendutoStoricoProdotto } from '../lib/api.js'
import { formatQty } from '../lib/inventory.js'
import { shiftDay } from '../lib/ore.js'
import { businessDayKey } from '../lib/businessDay.js'
import { MESI_CORTI } from '../lib/periodo.js'
import { etichettaTipo, riepilogoMovimenti } from '../lib/movimentiProdotto.js'
import GruppoChip from './GruppoChip.jsx'

// LA MOVIMENTAZIONE DI UN PRODOTTO (REQ-MAG-048), dalla sua scheda in
// Magazzino: i totali per tipo nel periodo, il venduto mese per mese (app e
// Tiller) e l'elenco dei movimenti. Il conto sta in lib/movimentiProdotto.js.

const PERIODI = [
  { id: 30, label: '30 giorni' },
  { id: 90, label: '90 giorni' },
  { id: 365, label: '1 anno' },
  { id: null, label: 'Tutto' },
]
const nomeMese = (k) => `${MESI_CORTI[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`
const quando = (iso) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

export default function MovimentiProdotto({ item, onClose }) {
  const [periodo, setPeriodo] = useState(90)
  const [dati, setDati] = useState(null) // { dal, movimenti, tiller }
  const [errore, setErrore] = useState(null)
  const dal = periodo ? shiftDay(businessDayKey(new Date()), -periodo) : null

  // I movimenti si leggono per il periodo scelto (cambiandolo si rileggono);
  // il venduto di Tiller è un documento solo, tutto insieme.
  useEffect(() => {
    let vivo = true
    Promise.all([fetchMovimentiProdotto(item.id, dal), fetchVendutoStoricoProdotto(item.id)])
      .then(([movimenti, tiller]) => vivo && setDati({ dal, movimenti, tiller }))
      .catch((e) => vivo && setErrore(e.message))
    return () => {
      vivo = false
    }
  }, [item.id, dal])
  const r = useMemo(
    () => (dati?.dal === dal ? riepilogoMovimenti(dati.movimenti, item, dati.tiller, { dal }) : null),
    [dati, item, dal]
  )
  // Il segno a parte: formatQty passa a litri e chili solo coi positivi.
  const q = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatQty(Math.abs(n), item.unit)}`

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div
        className="confirm-box larga"
        role="dialog"
        aria-label={`Movimenti di ${item.name}`}
        style={{ width: 'min(720px, 96vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📜 {item.name}</h3>
          <button type="button" className="btn ghost small" aria-label="Chiudi" onClick={onClose}>
            ✕
          </button>
        </div>
        <GruppoChip
          etichetta="Periodo"
          opzioni={PERIODI}
          valore={periodo}
          scegli={setPeriodo}
          style={{ margin: '10px 0' }}
        />

        {errore && <div className="banner">Errore: {errore}</div>}
        {!r && !errore && <div className="empty">Carico i movimenti…</div>}

        {r && (
          <>
            <div className="summary-rows">
              {r.tipi.length === 0 && <p className="muted small">Nessun movimento nel periodo.</p>}
              {r.tipi.map((t) => (
                <div className="summary-row" key={t.id}>
                  <span className="muted">{t.label}</span>
                  <strong>{q(t.q)}</strong>
                </div>
              ))}
            </div>

            {r.mesi.length > 0 && (
              <>
                <h4 style={{ margin: '14px 0 6px' }}>Venduto mese per mese</h4>
                <div className="table-scroll">
                  <table className="macro-tab">
                    <thead>
                      <tr>
                        <th className="rowhead">Mese</th>
                        <th>App</th>
                        <th>Tiller</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.mesi.map((m) => (
                        <tr key={m.mese}>
                          <th className="rowhead">{nomeMese(m.mese)}</th>
                          <td>{m.vendite ? formatQty(m.vendite, item.unit) : '—'}</td>
                          <td>{m.tiller ? formatQty(m.tiller, item.unit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted small" style={{ margin: '6px 0 0' }}>
                  Il venduto su Tiller è ricavato dalle ricette attuali delle voci vendute; non ha modificato
                  la giacenza.
                </p>
              </>
            )}

            {r.righe.length > 0 && (
              <>
                <h4 style={{ margin: '14px 0 6px' }}>Movimenti</h4>
                <div className="inv-list">
                  {r.righe.map((m) => (
                    <div className="summary-row" key={m.id}>
                      <span className="muted small">
                        {quando(m.created_at)} · {etichettaTipo(m.tipo)}
                      </span>
                      <span>{q(m.q)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
