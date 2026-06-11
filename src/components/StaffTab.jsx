import { useEffect, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import { listStaff, createStaff, setStaffRole, removeStaff } from '../lib/staffApi.js'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('staff')

  async function reload() {
    try {
      setUsers(await listStaff())
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await createStaff({ email: email.trim(), password, role })
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
              <div>{u.email}{u.uid === myUid && <span className="muted"> (tu)</span>}</div>
              <div className="desc">{ROLE_LABELS[u.role] ?? u.role}</div>
            </div>
            {u.uid !== myUid && (
              <div className="row" style={{ gap: 6 }}>
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
    </div>
  )
}
