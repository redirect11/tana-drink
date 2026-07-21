import { useEffect, useMemo, useState } from 'react'
import { subscribeSettings, DEFAULT_SETTINGS } from '../lib/api.js'
import { marginReport } from '../lib/pricing.js'
import { formatPrice } from '../lib/orderStatus.js'

// MARGINALITÀ DEL LISTINO: per ogni drink con ricetta, quanto costa
// davvero, a quanto è venduto e che ricarico ne esce. Serve a trovare le
// voci fuori linea senza aprirle una per una — di solito sono le birre
// premium, che costano molto e si vendono a poco.
//
// I drink con ingredienti non valorizzati restano a parte: il loro
// ricarico sarebbe ottimistico per forza, e presentarlo come un giudizio
// sarebbe fuorviante.
const FILTRI = [
  ['sotto', 'Da rivedere'],
  ['ok', 'In linea'],
  ['parziale', 'Costo incompleto'],
  ['tutti', 'Tutti'],
]

export default function MarginList({ drinks, inventory, onEdit }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const [filtro, setFiltro] = useState('sotto')

  const itemsById = useMemo(
    () => Object.fromEntries((inventory || []).map((i) => [i.id, i])),
    [inventory]
  )
  const report = useMemo(
    () => marginReport(drinks, itemsById, { markup: settings.price_markup }),
    [drinks, itemsById, settings.price_markup]
  )

  const righe = report.righe.filter((r) =>
    filtro === 'tutti' ? true : filtro === 'parziale' ? r.stato === 'parziale' || r.stato === 'no_costo' : r.stato === filtro
  )

  const conteggi = {
    sotto: report.sotto,
    ok: report.ok,
    parziale: report.parziali + report.senzaCosto,
    tutti: report.totali,
  }

  if (report.totali === 0) {
    return (
      <div className="empty" style={{ marginTop: 8 }}>
        Nessun drink con ingredienti: la marginalità si calcola dalla ricetta.
      </div>
    )
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <strong>📊 Marginalità</strong>
        <span className="muted small">obiettivo ×{settings.price_markup}</span>
      </div>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        {report.sotto > 0
          ? `${report.sotto} drink rendono meno del ×${settings.price_markup}.`
          : 'Tutti i drink calcolabili sono in linea.'}
      </p>

      <div className="chips-row" style={{ marginBottom: 8 }}>
        {FILTRI.map(([k, label]) => (
          <button
            key={k}
            className={`chip${filtro === k ? ' active' : ''}`}
            onClick={() => setFiltro(k)}
          >
            {label} ({conteggi[k]})
          </button>
        ))}
      </div>

      {righe.length === 0 && <div className="muted small">Nessun drink in questo gruppo.</div>}

      {righe.map((r) => (
        <div
          key={r.id}
          className="row between margin-row"
          style={{ alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)' }}
        >
          <span className="grow" style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.9rem' }}>{r.name}</span>
            <span className="muted small" style={{ display: 'block' }}>
              costo {formatPrice(r.cost)} · vendi {formatPrice(r.price)}
              {r.stato !== 'no_costo' && r.suggested != null && r.stato === 'sotto' && (
                <> · consigliato <strong>{formatPrice(r.suggested)}</strong></>
              )}
              {r.missing.length > 0 && <> · manca {r.missing.join(', ')}</>}
            </span>
          </span>
          <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <strong className={r.stato === 'sotto' ? 'neg' : ''}>
              {r.markup != null ? `×${r.markup}` : '—'}
            </strong>
            <span className="muted small" style={{ display: 'block' }}>
              {r.margin != null ? formatPrice(r.margin) : ''}
            </span>
          </span>
          <button className="btn ghost small" onClick={() => onEdit(r.id)} aria-label={`Modifica ${r.name}`}>
            ✏️
          </button>
        </div>
      ))}
    </div>
  )
}
