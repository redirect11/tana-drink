// LA TABELLA PER MACRO DEL BILANCIO: un blocco per macro e uno coi totali,
// le colonne del periodo e una colonna TOT. La disegnano «Venduto ×
// Incassato» e «Acquisti × Fatturato» (REQ-MAG-022), che hanno la stessa
// forma e la stessa aritmetica (componiTabella, lib/macroStats.js): cambiano
// solo le parole delle righe e il loro ordine, che ognuna passa in `righe`.
//
//   colonne: [{ key, label, sotto? }]  — `sotto` è la seconda riga
//            dell'intestazione (i giorni di una settimana del mese)
//   righe:   [{ campo, label, cls }]   — campo fra incasso, costo, margine,
//            rapporto; `cls` dà il colore della riga (index.css, .macro-tab)

const eur0 = (v) =>
  `${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })} €`
// Un'incidenza che non si può calcolare (colonna in perdita, periodo vuoto)
// resta un trattino: un numero inventato lì si legge come vero.
const perc = (v) => (v == null ? '—' : `${String(v).replace('.', ',')}%`)
const rapporto = (v) => (v != null ? `×${v}` : '—')

const VUOTA = { incasso: 0, costo: 0, margine: 0, rapporto: null }

// Un blocco (card) per macro-categoria, con le colonne del periodo.
export function BloccoMacro({ row, colonne, righe, rapportoLabel }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <strong>🗂️ {row.name}</strong>
        <span className="muted small">
          {rapportoLabel}: <strong>{rapporto(row.tot.rapporto)}</strong>
        </span>
      </div>
      <TabellaColonne
        colonne={colonne}
        perColonna={row.perColonna}
        tot={row.tot}
        righe={righe}
        incidenza={{ label: 'Incidenza', campo: 'incidenza' }}
      />
    </div>
  )
}

// Blocco finale con i totali di tutte le macro.
//
// LE DUE INCIDENZE non stanno sulle stesse righe: quella sul margine ha
// senso per una macro (quanto pesa fra le altre), quella sul periodo solo
// per i totali (quanto pesa una colonna sul periodo). Una riga sola che
// cambia significato a seconda del blocco sarebbe la stessa parola per due
// domande diverse.
export function BloccoTotale({ report, colonne, righe, incidenzaLabel }) {
  return (
    <div className="card macro-total" style={{ marginBottom: 12 }}>
      <strong>Σ Totale ({report.rows.length} macro)</strong>
      <div style={{ marginTop: 6 }}>
        <TabellaColonne
          colonne={colonne}
          perColonna={report.totPerColonna}
          tot={report.grand}
          righe={righe}
          incidenza={{ label: incidenzaLabel, campo: 'incidenzaPeriodo' }}
        />
      </div>
    </div>
  )
}

function valoreCella(campo, c) {
  return campo === 'rapporto' ? rapporto(c.rapporto) : eur0(c[campo])
}

function TabellaColonne({ colonne, perColonna, tot, righe, incidenza }) {
  // Il margine sotto zero si colora: è la riga su cui si decide.
  const neg = (campo, c) => (campo === 'margine' && c.margine < 0 ? 'neg' : '')
  const celle = colonne.map((c) => ({ key: c.key, v: perColonna.get(c.key) || VUOTA }))
  return (
    <div className="table-scroll">
      <table className="macro-tab">
        <thead>
          <tr>
            <th className="rowhead"></th>
            {colonne.map((c) => (
              <th key={c.key}>
                {c.label}
                {c.sotto && <div className="muted">{c.sotto}</div>}
              </th>
            ))}
            <th className="tot">TOT</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.campo} className={r.cls}>
              <th className="rowhead">{r.label}</th>
              {celle.map(({ key, v }) => (
                <td key={key} className={neg(r.campo, v)}>
                  {valoreCella(r.campo, v)}
                </td>
              ))}
              <td className={`tot ${neg(r.campo, tot)}`}>{valoreCella(r.campo, tot)}</td>
            </tr>
          ))}
          <tr className="r-inci">
            <th className="rowhead">{incidenza.label}</th>
            {celle.map(({ key, v }) => (
              <td key={key}>{perc(v[incidenza.campo])}</td>
            ))}
            <td className="tot">{perc(tot[incidenza.campo])}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
