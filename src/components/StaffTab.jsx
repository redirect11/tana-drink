import { useEffect, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import { listStaff, createStaff, setStaffRole, removeStaff } from '../lib/staffApi.js'
import { createStaffCall, subscribePendingCalls, updateSettings } from '../lib/api.js'
import ConfirmDialog from './ConfirmDialog.jsx'

const ROLE_LABELS = { bartender: '🍸 Bartender', staff: '🫱 Staff' }

// Backoffice utenze staff: il bartender crea e gestisce gli account dei
// collaboratori (cameriere ecc.) col relativo ruolo.
export default function StaffTab() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // { title, message, run }

  // Form nuovo utente
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('staff')

  const [pendingCalls, setPendingCalls] = useState([])
  const [callTarget, setCallTarget] = useState(null) // utente da chiamare
  const [callMessage, setCallMessage] = useState('')

  useEffect(() => subscribePendingCalls(setPendingCalls), [])

  async function reload() {
    try {
      const list = await listStaff()
      setUsers(list)
      // Numero membri attivi: serve per la divisione delle mance
      // (visibile allo staff via settings, lettura pubblica).
      updateSettings({ staff_count: list.filter((u) => !u.disabled).length }).catch(() => {})
    } catch (e) {
      setError(e.message)
    }
  }

  async function sendCall() {
    const target = callTarget
    setCallTarget(null)
    setError(null)
    try {
      await createStaffCall({
        to_uid: target.uid,
        to_email: target.email,
        message: callMessage.trim() || null,
        from_email: auth.currentUser?.email ?? null,
        from_name: auth.currentUser?.displayName ?? null,
      })
      setCallMessage('')
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    await run(async () => {
      await createStaff({ email: email.trim(), password, role, name: name.trim() })
      setName('')
      setEmail('')
      setPassword('')
    })
  }

  if (error && !users) return <div className="banner">Errore: {error}</div>
  if (!users) return <div className="empty">Carico lo staff…</div>

  const myUid = auth.currentUser?.uid

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      <form className="card settings-section" onSubmit={handleCreate}>
        <h3>Nuovo collaboratore</h3>
        <label htmlFor="staff-name">Nome</label>
        <input
          id="staff-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="es. Giulia"
        />
        <label htmlFor="staff-email">Email</label>
        <input
          id="staff-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cameriera@latanadelconiglio.it"
        />
        <label htmlFor="staff-password">Password (min 6 caratteri)</label>
        <input
          id="staff-password"
          type="text"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="da comunicare al collaboratore"
        />
        <label>Ruolo</label>
        <div className="mode-choice">
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`mode-option${role === value ? ' active' : ''}`}
              onClick={() => setRole(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Lo staff vede solo gli ordini pronti da servire e può segnarli
          come serviti. Il bartender ha accesso completo al gestionale.
        </p>
        <button className="btn block" style={{ marginTop: 12 }} type="submit" disabled={busy}>
          {busy ? 'Creo…' : '➕ Crea account'}
        </button>
      </form>

      <div className="card settings-section">
        <h3>Staff ({users.length})</h3>
        {users.map((u) => (
          <div className="toggle-row" key={u.uid}>
            <div>
              <div>
                {u.name || u.email}
                {u.uid === myUid && <span className="muted"> (tu)</span>}
              </div>
              <div className="desc">
                {ROLE_LABELS[u.role] ?? u.role}
                {u.name ? ` · ${u.email}` : ''}
              </div>
            </div>
            {u.uid !== myUid && (
              <div className="row" style={{ gap: 6 }}>
                {pendingCalls.some((c) => c.to_uid === u.uid) ? (
                  <span className="pill in_preparazione">📟 In chiamata…</span>
                ) : (
                  <button
                    className="btn small"
                    disabled={busy}
                    title="Chiama (cerca-persone)"
                    onClick={() => setCallTarget(u)}
                  >
                    📟
                  </button>
                )}
                <button
                  className="btn ghost small"
                  disabled={busy}
                  title="Cambia ruolo"
                  onClick={() => {
                    const next = u.role === 'bartender' ? 'staff' : 'bartender'
                    setConfirm({
                      title: `Cambiare ruolo a ${u.email}?`,
                      message: `Nuovo ruolo: ${ROLE_LABELS[next]}. Attivo al prossimo login.`,
                      run: () => run(() => setStaffRole(u.uid, next)),
                    })
                  }}
                >
                  ⇄ {u.role === 'bartender' ? 'Staff' : 'Bartender'}
                </button>
                <button
                  className="btn ghost small"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      title: `Eliminare ${u.email}?`,
                      message: 'L’account non potrà più accedere. Operazione irreversibile.',
                      danger: true,
                      run: () => run(() => removeStaff(u.uid)),
                    })
                  }
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Conferma"
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { run: fn } = confirm
            setConfirm(null)
            fn()
          }}
        />
      )}

      {callTarget && (
        <div className="overlay confirm-overlay" onClick={() => setCallTarget(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>📟 Chiama {callTarget.name || callTarget.email}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Il dispositivo vibrerà con insistenza finché non risponde.
            </p>
            <textarea
              rows={2}
              placeholder="Messaggio (facoltativo): es. «Vieni al bancone»"
              value={callMessage}
              onChange={(e) => setCallMessage(e.target.value)}
            />
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="btn ghost grow" onClick={() => setCallTarget(null)}>
                Annulla
              </button>
              <button className="btn grow" onClick={sendCall}>
                📟 Chiama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
