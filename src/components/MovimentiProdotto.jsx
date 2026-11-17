import { useEffect, useMemo, useState } from 'react'
import { fetchMovimentiProdotto, fetchVendutoStoricoProdotto } from '../lib/api.js'
import { formatQty } from '../lib/inventory.js'
import { shiftDay } from '../lib/ore.js'
import { businessDayKey } from '../lib/businessDay.js'
import { MESI_CORTI } from '../lib/periodo.js'
import { etichettaTipo, riepilogoMovimenti } from '../lib/movimentiProdotto.js'
import GruppoChip from './GruppoChip.jsx'
import Icona from './Icona.jsx'
import { tr, daTradurre, trSegnato, formatoAttivo, linguaInUso, LINGUA_DI_PARTENZA } from '../lib/lingua.js'

// LA MOVIMENTAZIONE DI UN PRODOTTO (REQ-MAG-048), dalla sua scheda in
// Magazzino: i totali per tipo nel periodo, il venduto mese per mese (app e
// Tiller) e l'elenco dei movimenti. Il conto sta in lib/movimentiProdotto.js.

const PERIODI = [
  { id: 30, label: daTradurre('30 giorni') },
  { id: 90, label: daTradurre('90 giorni') },
  { id: 365, label: daTradurre('1 anno') },
  { id: null, label: daTradurre('periodo|Tutto') },
]
// Il mese in inglese lo scrive Intl («Nov 2026»); in italiano resta la
// forma di sempre, coi mesi corti di lib/periodo.js.
const nomeMese = (k) =>
  linguaInUso() === LINGUA_DI_PARTENZA
    ? `${MESI_CORTI[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`
    : formatter(`mese-${formatoAttivo()}`, () => new Intl.DateTimeFormat(formatoAttivo(), { month: 'short', year: 'numeric' })).format(
        new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1)
      )
// Un formatter per lingua, fatto una volta: toLocaleString con le opzioni ne
// costruisce uno nuovo a ogni riga, e un ingrediente di un anno ne ha
// migliaia (BUG-117).
const FORMATTER = new Map()
const formatter = (chiave, crea) => {
  if (!FORMATTER.has(chiave)) FORMATTER.set(chiave, crea())
  return FORMATTER.get(chiave)
}
const quando = (iso) =>
  iso
    ? formatter(
        `data-${formatoAttivo()}`,
        () => new Intl.DateTimeFormat(formatoAttivo(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      ).format(new Date(iso))
    : ''

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
        aria-label={tr('Movimenti di {nome}', { nome: item.name })}
        style={{ '--larga': '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}><Icona nome="movimenti" gruppo="tasti" /> {item.name}</h3>
          <button type="button" className="btn ghost small" aria-label={tr('Chiudi')} onClick={onClose}>
            ✕
          </button>
        </div>
        <GruppoChip
          etichetta={tr('Periodo')}
          opzioni={PERIODI.map((p) => ({ ...p, label: trSegnato(p.label) }))}
          valore={periodo}
          scegli={setPeriodo}
          style={{ margin: '10px 0' }}
        />

        {errore && <div className="banner">{tr('Errore: {errore}', { errore })}</div>}
        {!r && !errore && <div className="empty">{tr('Carico i movimenti…')}</div>}

        {r && (
          <>
            <div className="summary-rows">
              {r.tipi.length === 0 && <p className="muted small">{tr('Nessun movimento nel periodo.')}</p>}
              {r.tipi.map((t) => (
                <div className="summary-row" key={t.id}>
                  <span className="muted">{trSegnato(t.label)}</span>
                  <strong>{q(t.q)}</strong>
                </div>
              ))}
            </div>

            {r.mesi.length > 0 && (
              <>
                <h4 style={{ margin: '14px 0 6px' }}>{tr('Venduto mese per mese')}</h4>
                <div className="table-scroll">
                  <table className="macro-tab">
                    <thead>
                      <tr>
                        <th className="rowhead">{tr('Mese')}</th>
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
                  {tr('Il venduto su Tiller è ricavato dalle ricette attuali delle voci vendute; non ha modificato la giacenza.')}
                </p>
              </>
            )}

            {r.righe.length > 0 && (
              <>
                <h4 style={{ margin: '14px 0 6px' }}>{tr('Movimenti')}</h4>
                <div className="inv-list">
                  {r.righe.map((m) => (
                    <div className="summary-row" key={m.id}>
                      <span className="muted small">
                        {quando(m.created_at)} · {trSegnato(etichettaTipo(m.tipo))}
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
