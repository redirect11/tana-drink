import { useEffect, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import { listStaff } from '../lib/staffApi.js'
import { createStaffCall, subscribePendingCalls } from '../lib/api.js'

const ROLE_LABELS = { bartender: '🍸 Bartender', staff: '🫱 Staff' }

// Pannello rapido cerca-persone: elenco del personale con tasto di
// chiamata. Usato come shortcut dalla coda ordini del bartender.
export default function StaffCallPanel({ onClose }) {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])
  const [target, setTarget] = useState(null) // utente da chiamare
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribePendingCalls(setPending), [])
  useEffect(() => {
    listStaff()
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  async function chiama() {
    setBusy(true)
    setError(null)
    try {
      await createStaffCall({
        to_uid: target.uid,
        to_email: target.email,
        message: message.trim() || null,
        from_email: auth.currentUser?.email ?? null,
        from_name: auth.currentUser?.displayName ?? null,
      })
      setTarget(null)
      setMessage('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const myUid = auth.currentUser?.uid
  const list = (users || []).filter((u) => u.uid !== myUid && !u.disabled)

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        {target ? (
          <>
            <h3 style={{ marginTop: 0 }}>📟 Chiama {target.name || target.email}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Il dispositivo vibrerà con insistenza finché non risponde.
            </p>
            <textarea
              rows={2}
              placeholder="Messaggio (facoltativo): es. «Vieni al bancone»"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="btn ghost grow" onClick={() => setTarget(null)}>
                Indietro
              </button>
              <button className="btn grow" disabled={busy} onClick={chiama}>
                📟 Chiama
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>📟 Chiama lo staff</h3>
            {error && <div className="banner">Errore: {error}</div>}
            {users === null && !error && <div className="empty">Carico lo staff…</div>}
            {users !== null && list.length === 0 && (
              <div className="empty">Nessun altro membro dello staff.</div>
            )}
            {list.map((u) => (
              <div className="toggle-row" key={u.uid}>
                <div>
                  <div>{u.name || u.email}</div>
                  <div className="desc">{ROLE_LABELS[u.role] ?? u.role}</div>
                </div>
                {pending.some((c) => c.to_uid === u.uid) ? (
                  <span className="pill in_preparazione">📟 In chiamata…</span>
                ) : (
                  <button className="btn small" onClick={() => setTarget(u)}>
                    📟 Chiama
                  </button>
                )}
              </div>
            ))}
            <button className="btn ghost block" style={{ marginTop: 12 }} onClick={onClose}>
              Chiudi
            </button>
          </>
        )}
      </div>
    </div>
  )
}
