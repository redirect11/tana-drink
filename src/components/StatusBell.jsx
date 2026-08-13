import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeSync, retryAllSync, retryLastSync } from '../lib/sync.js'
import { subscribeNotifs, markNotifsSeen, clearNotifs } from '../lib/notifyStore.js'

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
  const [notifs, setNotifs] = useState({ items: [], unseen: 0 })
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeSync(setSync), [])
  useEffect(() => subscribeNotifs(setNotifs), [])

  const toggle = () => {
    if (open) return setOpen(false)
    setOpen(true)
    markNotifsSeen()
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

            {/* Storico notifiche */}
            <div className="status-bell-list">
              {notifs.items.length === 0 && (
                <div className="muted small" style={{ padding: '10px 8px' }}>Nessuna notifica.</div>
              )}
              {notifs.items.map((n) => {
                const dentro = (
                  <>
                    <div><strong>{n.title}</strong></div>
                    {n.body && <div className="muted small">{n.body}</div>}
                    <div className="muted" style={{ fontSize: '0.64rem', marginTop: 2 }}>{fmtTime(n.at)}</div>
                  </>
                )
                // Con un `href` la notifica è una porta: si tocca e ci porta.
                // Senza, resta quello che è sempre stata, una riga da leggere.
                return n.href ? (
                  <Link
                    className="status-bell-item status-bell-link"
                    key={n.id}
                    to={n.href}
                    onClick={() => setOpen(false)}
                  >
                    {dentro}
                  </Link>
                ) : (
                  <div className="status-bell-item" key={n.id}>{dentro}</div>
                )
              })}
            </div>

            {notifs.items.length > 0 && (
              <button className="btn ghost small block" style={{ marginTop: 6 }} onClick={clearNotifs}>
                🧹 Svuota
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
