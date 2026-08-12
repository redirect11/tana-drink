/* global __GIT_BRANCH__, __GIT_COMMIT__, __BUILD_ID__, __APP_VERSION__ */
import { useEffect, useState } from 'react'
import { etichettaVersione } from '../lib/versione.js'

// INFORMAZIONI: che versione è, cosa è cambiato, e i dati tecnici che
// servono quando qualcosa non va.
//
// Chi usa l'app deve poter sapere cosa è cambiato senza chiederlo a chi
// l'ha scritta — e chi assiste deve poter chiedere "che versione hai?"
// ottenendo una risposta esatta invece di "l'ultima, credo".

const BRANCH = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''
const COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : ''
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : ''
const VERSIONE = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

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

function Changelog({ testo }) {
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

export default function InfoTab() {
  const [changelog, setChangelog] = useState(null)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL || '/'}changelog.md`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setChangelog)
      .catch(() => setErrore('Le note di questa versione non sono disponibili.'))
  }, [])

  const dati = [
    ['Versione', etichettaVersione({ branch: 'main', versione: VERSIONE }) || '—'],
    ['Ramo', BRANCH || '—'],
    ['Commit', COMMIT || '—'],
    ['Build', BUILD || '—'],
    ['Ambiente', import.meta.env.VITE_APP_ENV || 'produzione'],
    ['Progetto', import.meta.env.VITE_FIREBASE_PROJECT_ID || '—'],
  ]

  const copia = () =>
    navigator.clipboard?.writeText(dati.map(([k, v]) => `${k}: ${v}`).join('\n')).catch(() => {})

  return (
    <div>
      <div className="card settings-section">
        <h3>Questa versione</h3>
        <div className="info-dati">
          {dati.map(([k, v]) => (
            <div className="row between" key={k}>
              <span className="muted">{k}</span>
              <strong className="info-valore">{v}</strong>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Servono quando qualcosa non va: copiali e allegali alla segnalazione.
        </p>
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={copia}>
          Copia i dati tecnici
        </button>
      </div>

      <div className="card settings-section">
        <h3>Cosa è cambiato</h3>
        {errore && <p className="muted small">{errore}</p>}
        {!changelog && !errore && <p className="muted small">Carico le note…</p>}
        {changelog && <Changelog testo={changelog} />}
      </div>
    </div>
  )
}
