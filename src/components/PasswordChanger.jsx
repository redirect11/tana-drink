import { useState } from 'react'
import { changePassword, authError } from '../lib/customerAuth.js'

// Form di cambio password riutilizzabile (clienti e staff). Richiede la
// password attuale per la ri-autenticazione imposta da Firebase.
export default function PasswordChanger() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (next.length < 6) return setErr('La nuova password deve avere almeno 6 caratteri.')
    if (next !== confirm) return setErr('Le due password non coincidono.')
    setBusy(true)
    try {
      await changePassword(current, next)
      setMsg('Password aggiornata.')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (e) {
      setErr(authError(e.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card settings-section" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>🔑 Cambia password</h3>
      <label htmlFor="pw-cur">Password attuale</label>
      <input id="pw-cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      <label htmlFor="pw-new">Nuova password</label>
      <input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
      <label htmlFor="pw-confirm">Conferma nuova password</label>
      <input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      {err && <div className="banner" style={{ marginTop: 10 }}>{err}</div>}
      {msg && <p className="muted small" style={{ marginTop: 10 }}>✓ {msg}</p>}
      <button className="btn block" style={{ marginTop: 12 }} type="submit" disabled={busy}>
        {busy ? 'Aggiorno…' : 'Aggiorna password'}
      </button>
    </form>
  )
}
