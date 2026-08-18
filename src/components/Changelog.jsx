/* Il renderer delle note di rilascio, in comune fra le Informazioni e il
   box che compare dopo un aggiornamento. */
// Il changelog è scritto in Markdown ma qui non serve una libreria: sono
// titoli, elenchi e qualche grassetto. Meglio venti righe che un pacchetto.
function Riga({ testo }) {
  const pezzi = testo.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return (
    <>
      {pezzi.map((p, i) =>
        p.startsWith('**') ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.startsWith('`') ? (
          <code key={i}>{p.slice(1, -1)}</code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

export default function Changelog({ testo }) {
  const blocchi = []
  let elenco = null
  for (const raw of testo.split('\n')) {
    const riga = raw.trimEnd()
    if (riga.startsWith('- ')) {
      elenco = elenco || []
      elenco.push(riga.slice(2))
      continue
    }
    if (elenco && riga.startsWith('  ')) {
      // continuazione della voce precedente
      elenco[elenco.length - 1] += ' ' + riga.trim()
      continue
    }
    if (elenco) {
      blocchi.push({ tipo: 'elenco', voci: elenco })
      elenco = null
    }
    if (riga.startsWith('## ')) blocchi.push({ tipo: 'versione', testo: riga.slice(3) })
    else if (riga.startsWith('### ')) blocchi.push({ tipo: 'sezione', testo: riga.slice(4) })
    else if (riga.startsWith('# ') || riga.startsWith('---') || riga.startsWith('>')) continue
    else if (riga.trim()) blocchi.push({ tipo: 'p', testo: riga })
  }
  if (elenco) blocchi.push({ tipo: 'elenco', voci: elenco })

  return (
    <div className="changelog">
      {blocchi.map((b, i) =>
        b.tipo === 'versione' ? (
          <h4 key={i} className="changelog-versione">
            {b.testo}
          </h4>
        ) : b.tipo === 'sezione' ? (
          <div key={i} className="changelog-sezione">
            {b.testo}
          </div>
        ) : b.tipo === 'elenco' ? (
          <ul key={i}>
            {b.voci.map((v, j) => (
              <li key={j}>
                <Riga testo={v} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="muted small">
            <Riga testo={b.testo} />
          </p>
        )
      )}
    </div>
  )
}
