import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeNotifs, segnaLetta, svuotaArchivio } from '../lib/notifyStore.js'

// ── LO STORICO DELLE NOTIFICHE, ANCHE NELLE IMPOSTAZIONI ─────────────
// Stava solo dietro la campanella, dentro un pannello che si chiude al
// primo tocco fuori: per ritrovare l'avviso di mezz'ora fa — chi ha
// annullato quel conto, cos'era finito in magazzino — bisognava riaprirlo e
// scorrere in un riquadro alto quattro righe. Qui c'è tutta la pagina, e si
// arriva da dove si guardano le altre cose passate.
//
// È lo STESSO elenco della campanella (notifyStore): non una copia, non un
// secondo archivio. Svuotarlo qui lo svuota anche lì.

function quando(at) {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const oggi = new Date()
  const stessoGiorno =
    d.getDate() === oggi.getDate() &&
    d.getMonth() === oggi.getMonth() &&
    d.getFullYear() === oggi.getFullYear()
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  // Di oggi basta l'ora: la data la si sta vivendo.
  return stessoGiorno ? ora : `${d.toLocaleDateString('it-IT')} · ${ora}`
}

export default function StoricoNotifiche() {
  const [notifs, setNotifs] = useState({ items: [], archivio: [], tutte: [], unseen: 0 })
  useEffect(() => subscribeNotifs(setNotifs), [])

  // Da leggere e già lette INSIEME, nell'ordine in cui sono arrivate: a chi
  // cerca un avviso di prima non interessa in quale delle due liste sia
  // finito. L'ordine lo tiene il registro, che è l'unico a saperlo.
  const tutte = notifs.tutte || []

  return (
    <div className="card settings-section">
      <h3>📜 Storico delle notifiche</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Gli avvisi arrivati <strong>su questo dispositivo</strong>, anche quelli
        già letti. È lo stesso elenco della campanella qui in alto.
      </p>

      {tutte.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          Ancora nessun avviso su questo dispositivo.
        </p>
      ) : (
        <div className="storico-notifiche">
          {tutte.map((n) =>
            // Con un `href` la notifica è una porta: si tocca e ci porta.
            n.href ? (
              <Link
                key={n.id}
                to={n.href}
                className={`storico-notifica${n.letta ? ' letta' : ''}`}
                onClick={() => segnaLetta(n.id)}
              >
                <span className="grow">
                  <strong>{n.title}</strong>
                  {n.body && <span className="muted small"> · {n.body}</span>}
                </span>
                <span className="muted small">{quando(n.at)}</span>
              </Link>
            ) : (
              <div key={n.id} className={`storico-notifica${n.letta ? ' letta' : ''}`}>
                <span className="grow">
                  <strong>{n.title}</strong>
                  {n.body && <span className="muted small"> · {n.body}</span>}
                </span>
                <span className="muted small">{quando(n.at)}</span>
              </div>
            )
          )}
        </div>
      )}

      {notifs.archivio.length > 0 && (
        <button
          className="btn ghost small"
          style={{ marginTop: 10 }}
          onClick={svuotaArchivio}
        >
          🧹 Svuota lo storico
        </button>
      )}
    </div>
  )
}
