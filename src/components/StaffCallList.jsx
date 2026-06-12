import { useEffect, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import { listStaff } from '../lib/staffApi.js'
import { createStaffCall, subscribePendingCalls } from '../lib/api.js'

const ROLE_LABELS = { bartender: '🍸 Bartender', staff: '🫱 Staff' }

// Cerca-persone direttamente nella coda del bartender: elenco del
// personale con tasto di chiamata per ciascuno. Cliccando 📟 si apre
// in riga il campo per un messaggio facoltativo.
export default function StaffCallList() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])
  const [target, setTarget] = useState(null) // uid in chiamata (form aperto)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribePendingCalls(setPending), [])
  useEffect(() => {
    listStaff()
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  async function chiama(u) {
    setBusy(true)
    setError(null)
    try {
      await createStaffCall({
        to_uid: u.uid,
        to_email: u.email,
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

  // Nessun altro membro dello staff: niente da mostrare.
  if (users !== null && list.length === 0 && !error) return null

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <strong>📟 Chiama lo staff</strong>
      {error && <div className="banner">Errore: {error}</div>}
      {users === null && !error && <div className="muted small">Carico lo staff…</div>}
      {list.map((u) => (
        <div key={u.uid}>
          <div className="toggle-row">
            <div>
              <div>{u.name || u.email}</div>
              <div className="desc">{ROLE_LABELS[u.role] ?? u.role}</div>
            </div>
            {pending.some((c) => c.to_uid === u.uid) ? (
              <span className="pill in_preparazione">📟 In chiamata…</span>
            ) : target === u.uid ? (
              <button className="btn ghost small" onClick={() => setTarget(null)}>
                Annulla
              </button>
            ) : (
              <button
                className="btn small"
                title="Chiama (cerca-persone)"
                onClick={() => {
                  setTarget(u.uid)
                  setMessage('')
                }}
              >
                📟 Chiama
              </button>
            )}
          </div>
          {target === u.uid && (
            <div style={{ margin: '0 0 10px' }}>
              <textarea
                rows={2}
                placeholder="Messaggio (facoltativo): es. «Vieni al bancone»"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                className="btn block"
                style={{ marginTop: 8 }}
                disabled={busy}
                onClick={() => chiama(u)}
              >
                {busy ? 'Chiamo…' : '📟 Invia chiamata'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
