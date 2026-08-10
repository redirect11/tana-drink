import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { logoutStaff } from '../lib/logout.js'
import { updateDisplayName } from '../lib/customerAuth.js'
import PasswordChanger from '../components/PasswordChanger.jsx'

// Profilo dello staff/bartender registrato: modifica del nome
// visualizzato (usato in «Ciao, …» e nell'attribuzione degli ordini) e
// cambio password. Account email/password con ruolo nei custom claim.
export default function StaffProfilePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(undefined) // undefined=caricamento
  const [role, setRole] = useState(null)
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        return
      }
      try {
        const token = await u.getIdTokenResult()
        const r = token.claims.role
        setRole(r === 'bartender' || r === 'staff' ? r : null)
      } catch {
        setRole(null)
      }
      setName(u.displayName || '')
      setUser(u)
    })
  }, [])

  if (user === undefined) return <div className="empty">Carico il profilo…</div>
  if (!user || !role) {
    return (
      <div className="empty">
        🔒 Quest’area è riservata allo staff.
        <br />
        <Link className="btn block" style={{ marginTop: 14 }} to="/bar">Accesso staff</Link>
      </div>
    )
  }

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true)
    setInfo(null)
    try {
      await updateDisplayName(name.trim())
      setInfo('Nome aggiornato. Comparirà al prossimo ordine inserito.')
    } catch (e) {
      setInfo(e.message)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {role === 'bartender' ? '🍸' : '🫱'} Il mio profilo
        </h2>
        <div className="summary-rows" style={{ margin: '0 0 12px' }}>
          <div className="summary-row">
            <span className="muted">Ruolo</span>
            <span>{role === 'bartender' ? 'Bartender' : 'Staff'}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Email</span>
            <span>{user.email}</span>
          </div>
        </div>
        <label htmlFor="staff-name">Nome visualizzato</label>
        <div className="row" style={{ gap: 8 }}>
          <input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Giulia" />
          <button className="btn small" onClick={saveName} disabled={savingName} style={{ flexShrink: 0 }}>
            {savingName ? 'Salvo…' : 'Salva'}
          </button>
        </div>
        {info && <p className="muted small" style={{ marginTop: 10 }}>{info}</p>}
      </div>

      <PasswordChanger />

      <Link className="btn secondary block" to="/bar">← Torna al gestionale</Link>
      <button
        className="btn ghost block"
        style={{ marginTop: 8 }}
        onClick={() => logoutStaff().then(() => navigate('/bar'))}
      >
        Esci
      </button>
    </div>
  )
}
