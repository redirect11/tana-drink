import { useEffect, useMemo, useState } from 'react'
import { subscribeSettings, DEFAULT_SETTINGS } from '../lib/api.js'
import { marginReport, ordinaMargini, marginiPerCategoria } from '../lib/pricing.js'
import { formatPrice } from '../lib/orderStatus.js'
import { catColor } from '../lib/categoryColors.js'
import SortTh from './SortTh.jsx'
import GruppoChip from './GruppoChip.jsx'

// MARGINALITÀ DEL LISTINO: per ogni drink con ricetta, quanto costa
// davvero, a quanto è venduto e che ricarico ne esce. Serve a trovare le
// voci fuori linea senza aprirle una per una — di solito sono le birre
// premium, che costano molto e si vendono a poco.
//
// I drink con ingredienti non valorizzati restano a parte: il loro
// ricarico sarebbe ottimistico per forza, e presentarlo come un giudizio
// sarebbe fuorviante.
//
// IN TABELLA, DIVISA PER CATEGORIE (REQ-MENU-002). Flavio, 22/10/2026:
// «bisognerebbe mettere sempre la divisione in categorie», con le colonne
// del ricarico, del margine netto, del costo e del prezzo — che prima
// stava «scritto piccolo e sotto il nome» — e la possibilità di ordinare
// su ognuna. «Tutto insieme» resta, per il confronto su tutto il listino.
const FILTRI = [
  ['tutti', 'Tutti'],
  ['sotto', 'Da rivedere'],
  ['ok', 'In linea'],
  ['parziale', 'Costo incompleto'],
]
const VISTE = [
  { id: 'categorie', label: 'Per categoria' },
  { id: 'tutto', label: 'Tutto insieme' },
]
// LE PAROLE E L'ORDINE SONO QUELLI DI FLAVIO (29/10/2026): «COSTO,
// VENDITA, CONSIGLIATO, MOLTIPLICATORE e UTILE incolonnate come una
// tabella». Il consigliato ha una colonna sua: prima stava scritto piccolo
// sotto il nome, e solo per le voci da rivedere.
const COLONNE = [
  ['cost', 'Costo'],
  ['price', 'Vendita'],
  ['suggested', 'Consigliato'],
  ['markup', 'Moltiplicatore'],
  ['margin', 'Utile'],
]
const ricarico = (m) => (m != null ? `×${String(m).replace('.', ',')}` : '—')

export default function MarginList({ drinks, inventory, categories = [], onEdit }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const [filtro, setFiltro] = useState('tutti')
  const [vista, setVista] = useState('categorie')
  // Di partenza il ricarico dal più basso: le voci da sistemare in cima.
  const [sort, setSort] = useState({ col: 'markup', dir: 'asc' })
  const ordinaPer = (col) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))

  const itemsById = useMemo(
    () => Object.fromEntries((inventory || []).map((i) => [i.id, i])),
    [inventory]
  )
  const report = useMemo(
    () => marginReport(drinks, itemsById, { markup: settings.price_markup }),
    [drinks, itemsById, settings.price_markup]
  )

  const righe = useMemo(() => {
    const scelte = report.righe.filter((r) =>
      filtro === 'tutti' ? true : filtro === 'parziale' ? r.stato === 'parziale' || r.stato === 'no_costo' : r.stato === filtro
    )
    return ordinaMargini(scelte, sort)
  }, [report, filtro, sort])
  const gruppi = useMemo(
    () => (vista === 'categorie' ? marginiPerCategoria(righe, categories) : [{ id: 'tutto', righe }]),
    [vista, righe, categories]
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

  const verso = (col) => (sort.col === col ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none')

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <strong>📊 Marginalità</strong>
        <span className="muted small">obiettivo {ricarico(settings.price_markup)}</span>
      </div>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        {report.sotto > 0
          ? `${report.sotto} drink rendono meno del ${ricarico(settings.price_markup)}.`
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
      <GruppoChip etichetta="Vista" opzioni={VISTE} valore={vista} scegli={setVista} style={{ marginBottom: 8 }} />

      {righe.length === 0 ? (
        <div className="muted small">Nessun drink in questo gruppo.</div>
      ) : (
        <div className="table-scroll">
          <table className="margin-tab">
            <thead>
              <tr>
                <th className="rowhead" aria-sort={verso('name')}>
                  <SortTh label="Voce" col="name" sort={sort} onSort={ordinaPer} />
                </th>
                {COLONNE.map(([col, label]) => (
                  <th key={col} aria-sort={verso(col)}>
                    <SortTh label={label} col={col} sort={sort} onSort={ordinaPer} num />
                  </th>
                ))}
              </tr>
            </thead>
            {gruppi.map((g) => (
              <tbody key={g.id}>
                {vista === 'categorie' && (
                  <tr className="margin-cat">
                    <th scope="rowgroup" className="rowhead">
                      <span
                        className="margin-cat-punto"
                        aria-hidden="true"
                        style={{ background: g.categoria ? catColor(g.categoria) : 'var(--line)' }}
                      />
                      {g.nome} <span className="muted small">({g.righe.length})</span>
                    </th>
                    <td />
                    <td />
                    <td />
                    <td title="Moltiplicatore medio">{ricarico(g.ricaricoMedio)}</td>
                    <td title="Utile medio">{g.margineMedio != null ? formatPrice(g.margineMedio) : ''}</td>
                  </tr>
                )}
                {g.righe.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="rowhead">
                      <button
                        type="button"
                        className="margin-nome"
                        onClick={() => onEdit(r.id)}
                        aria-label={`Modifica ${r.name}`}
                      >
                        {r.name}
                      </button>
                      {r.missing.length > 0 && (
                        <span className="muted small margin-nota">manca {r.missing.join(', ')}</span>
                      )}
                    </th>
                    <td>{formatPrice(r.cost)}</td>
                    <td>{formatPrice(r.price)}</td>
                    {/* In evidenza quando la vendita sta sotto: è il prezzo a
                        cui portarla. */}
                    <td className={r.stato === 'sotto' ? 'margin-consigliato' : 'muted'}>
                      {r.suggested != null ? formatPrice(r.suggested) : '—'}
                    </td>
                    <td className={r.stato === 'sotto' ? 'neg' : ''}>
                      <strong>{ricarico(r.markup)}</strong>
                    </td>
                    <td className={r.margin != null && r.margin < 0 ? 'neg' : ''}>
                      {r.margin != null ? formatPrice(r.margin) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  )
}
