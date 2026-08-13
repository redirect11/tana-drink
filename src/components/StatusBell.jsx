import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeSync, retryAllSync, retryLastSync } from '../lib/sync.js'
import {
  subscribeNotifs,
  segnaLetta,
  segnaTutteLette,
  svuotaArchivio,
} from '../lib/notifyStore.js'

// Campanella unica in topbar: mostra lo storico delle notifiche e, con un
// pallino animato, lo STATO DELLA SINCRONIZZAZIONE local-first (idle / in
// corso / sincronizzato / errore). In errore si può ripetere la sync
// dell'ultima modifica o di tutte.
const fmtTime = (ms) => {
  try {
    return new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// `floating`: la stessa campanella come tasto tondo in basso a destra.
// Serve nella coda a tutto schermo, dove la topbar (e quindi la campanella)
// non c'è: gli avvisi di sincronizzazione non devono sparire proprio nella
// schermata dove si lavora tutta la sera.
export default function StatusBell({ floating = false }) {
  const [sync, setSync] = useState({ phase: 'idle', pending: 0, failedCount: 0, lastError: null })
  const [notifs, setNotifs] = useState({ items: [], archivio: [], unseen: 0 })
  const [open, setOpen] = useState(false)
  // Lo storico sta dietro un tocco: si apre quando serve («cos'era
  // quell'avviso di prima?»), non sta lì a fare volume.
  const [storico, setStorico] = useState(false)

  useEffect(() => subscribeSync(setSync), [])
  useEffect(() => subscribeNotifs(setNotifs), [])

  // APRIRE NON È LEGGERE. Prima bastava aprire la campanella perché tutto
  // risultasse visto: si dava un'occhiata di corsa fra due ordini e l'avviso
  // spariva senza essere stato letto davvero. Ora si segna leggendo — si
  // tocca la notifica — o con «segna tutte lette», che è una decisione.
  const toggle = () => {
    setOpen((v) => !v)
    setStorico(false)
  }

  const syncClass = ['idle', 'syncing', 'synced', 'error'].includes(sync.phase) ? sync.phase : 'idle'
  const badge = notifs.unseen > 0 ? (notifs.unseen > 9 ? '9+' : String(notifs.unseen)) : null

  return (
    <>
      <button
        className={`status-bell ${syncClass}${floating ? ' status-bell-float' : ''}`}
        onClick={toggle}
        title="Notifiche e sincronizzazione"
        aria-label={`Notifiche${notifs.unseen ? ` (${notifs.unseen} nuove)` : ''}`}
      >
        🔔
        {badge && <span className="status-bell-badge">{badge}</span>}
      </button>

      {open && (
        <>
          <div className="status-bell-backdrop" onClick={() => setOpen(false)} />
          <div className={`status-bell-panel${floating ? ' basso' : ''}`} role="dialog" aria-label="Notifiche e sincronizzazione">
            {/* Stato sincronizzazione */}
            {sync.phase === 'error' ? (
              <div className="status-bell-sync err">
                <div>
                  ⚠️ <strong>{sync.failedCount}</strong> modifica{sync.failedCount === 1 ? '' : 'e'} non sincronizzat{sync.failedCount === 1 ? 'a' : 'e'}
                  {sync.lastError ? <span className="muted"> · {sync.lastError}</span> : null}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <button className="btn small" onClick={retryLastSync}>↻ Riprova ultima</button>
                  <button className="btn secondary small" onClick={retryAllSync}>↻ Riprova tutte</button>
                </div>
              </div>
            ) : (
              <div className="status-bell-sync ok">
                {sync.phase === 'syncing'
                  ? `⟳ Sincronizzo…${sync.pending ? ` (${sync.pending})` : ''}`
                  : '✓ Tutto sincronizzato'}
              </div>
            )}

            {/* DA LEGGERE, oppure lo STORICO di quelle già lette. */}
            {(() => {
              const lista = storico ? notifs.archivio : notifs.items
              const riga = (n) => (
                <>
                  <div><strong>{n.title}</strong></div>
                  {n.body && <div className="muted small">{n.body}</div>}
                  <div className="muted" style={{ fontSize: '0.64rem', marginTop: 2 }}>{fmtTime(n.at)}</div>
                </>
              )
              return (
                <div className="status-bell-list">
                  {lista.length === 0 && (
                    <div className="muted small" style={{ padding: '10px 8px' }}>
                      {storico ? 'Lo storico è vuoto.' : 'Nessuna notifica da leggere.'}
                    </div>
                  )}
                  {lista.map((n) =>
                    // Con un `href` la notifica è una porta: si tocca, ci
                    // porta, e nel farlo risulta letta. Senza, il tocco la
                    // legge e basta.
                    n.href ? (
                      <Link
                        className={`status-bell-item status-bell-link${n.letta ? ' letta' : ''}`}
                        key={n.id}
                        to={n.href}
                        onClick={() => {
                          segnaLetta(n.id)
                          setOpen(false)
                        }}
                      >
                        {riga(n)}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`status-bell-item status-bell-link${n.letta ? ' letta' : ''}`}
                        key={n.id}
                        onClick={() => segnaLetta(n.id)}
                        title={n.letta ? undefined : 'Tocca per segnarla letta'}
                      >
                        {riga(n)}
                      </button>
                    )
                  )}
                </div>
              )
            })()}

            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button
                className="btn ghost small grow"
                onClick={() => setStorico((v) => !v)}
              >
                {storico ? '← Da leggere' : `📜 Storico${notifs.archivio.length ? ` (${notifs.archivio.length})` : ''}`}
              </button>
              {storico ? (
                notifs.archivio.length > 0 && (
                  <button className="btn ghost small grow" onClick={svuotaArchivio}>
                    🧹 Svuota storico
                  </button>
                )
              ) : (
                notifs.items.length > 0 && (
                  <button className="btn ghost small grow" onClick={segnaTutteLette}>
                    ✓ Segna tutte lette
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
