import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { subscribeSettings, DEFAULT_SETTINGS } from '../lib/api.js'
import {
  registerCustomer,
  loginCustomer,
  loginWithGoogle,
  resetPassword,
  resendVerification,
  logoutCustomer,
  updateCustomerProfile,
  useCustomer,
  useHasOrders,
  authError,
} from '../lib/customerAuth.js'

// Hook: gli account clienti sono attivi? (impostazione del bartender)
function useAccountsEnabled() {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.customer_accounts_enabled)
  useEffect(() => subscribeSettings((s) => setEnabled(s.customer_accounts_enabled)), [])
  return enabled
}

function AccountsDisabled() {
  return (
    <div className="empty">
      🔒 La registrazione clienti non è attiva al momento.
      <br />
      <Link className="btn block" style={{ marginTop: 14 }} to="/">← Torna al menù</Link>
    </div>
  )
}

// ── /accedi ───────────────────────────────────────────────────────────
export function AccediPage() {
  const accountsOn = useAccountsEnabled()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)

  // Le schermate restano separate: se l'account è dello staff,
  // si viene rimandati al gestionale.
  async function routeByRole(user) {
    try {
      const token = await user.getIdTokenResult()
      const role = token.claims.role
      navigate(role === 'bartender' || role === 'staff' ? '/bar' : '/profilo')
    } catch {
      navigate('/profilo')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const cred = await loginCustomer(email, password)
      await routeByRole(cred.user)
    } catch (e2) {
      setErr(authError(e2.code))
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    setErr(null)
    try {
      const user = await loginWithGoogle()
      await routeByRole(user)
    } catch (e2) {
      setErr(authError(e2.code))
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    if (!email) return setErr('Inserisci la tua email per il reset.')
    try {
      await resetPassword(email)
      setInfo('Email di reset inviata: controlla la casella.')
      setErr(null)
    } catch (e2) {
      setErr(authError(e2.code))
    }
  }

  if (!accountsOn) return <AccountsDisabled />

  return (
    <div>
      <form className="card" onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Accedi</h2>
        <label htmlFor="acc-email">Email</label>
        <input
          id="acc-email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="acc-password" style={{ marginTop: 10 }}>Password</label>
        <input
          id="acc-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="banner" style={{ marginTop: 10 }}>{err}</div>}
        {info && <p className="muted small" style={{ marginTop: 10 }}>{info}</p>}
        <button className="btn block" style={{ marginTop: 14 }} type="submit" disabled={busy}>
          {busy ? 'Accesso…' : 'Entra'}
        </button>
        <button className="btn secondary block" style={{ marginTop: 8 }} type="button" disabled={busy} onClick={google}>
          <GoogleIcon /> Entra con Google
        </button>
        <div className="row between" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost small" onClick={reset}>
            Password dimenticata?
          </button>
          <Link className="btn ghost small" to="/registrati">
            Crea un account
          </Link>
        </div>
      </form>
      <Link className="btn ghost block" to="/">← Torna al menù</Link>
    </div>
  )
}

// ── /registrati ───────────────────────────────────────────────────────
export function RegistratiPage() {
  const accountsOn = useAccountsEnabled()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', cognome: '', birthDate: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await registerCustomer(form)
      navigate('/profilo')
    } catch (e2) {
      setErr(authError(e2.code))
    } finally {
      setBusy(false)
    }
  }

  if (!accountsOn) return <AccountsDisabled />

  return (
    <div>
      <form className="card" onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Crea il tuo account</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Il tuo conto alla Tana del Coniglio: ordini salvati e profilo personale.
        </p>
        <div className="grid-2">
          <div>
            <label htmlFor="reg-nome">Nome *</label>
            <input id="reg-nome" type="text" required value={form.nome} onChange={set('nome')} />
          </div>
          <div>
            <label htmlFor="reg-cognome">Cognome *</label>
            <input id="reg-cognome" type="text" required value={form.cognome} onChange={set('cognome')} />
          </div>
        </div>
        <label htmlFor="reg-data" style={{ marginTop: 10 }}>Data di nascita *</label>
        <input id="reg-data" type="date" required max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={set('birthDate')} />
        <label htmlFor="reg-email" style={{ marginTop: 10 }}>Email *</label>
        <input id="reg-email" type="email" required autoComplete="username" value={form.email} onChange={set('email')} />
        <label htmlFor="reg-password" style={{ marginTop: 10 }}>Password * (min 6 caratteri)</label>
        <input id="reg-password" type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} />
        {err && <div className="banner" style={{ marginTop: 10 }}>{err}</div>}
        <button className="btn block" style={{ marginTop: 14 }} type="submit" disabled={busy}>
          {busy ? 'Creo…' : 'Registrati'}
        </button>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          Riceverai un’email di conferma per verificare l’indirizzo.
        </p>
      </form>
      <div className="row" style={{ gap: 8 }}>
        <Link className="btn ghost grow" to="/accedi">Ho già un account</Link>
        <Link className="btn ghost grow" to="/">← Menù</Link>
      </div>
    </div>
  )
}

// ── /profilo ──────────────────────────────────────────────────────────
export function ProfiloPage() {
  const { user, profile, loading } = useCustomer()
  const hasOrders = useHasOrders()
  const navigate = useNavigate()
  const [birth, setBirth] = useState('')
  const [info, setInfo] = useState(null)

  if (loading) return <div className="empty">Carico il profilo…</div>
  if (!user) {
    return (
      <div className="empty">
        Non hai ancora effettuato l’accesso.
        <br />
        <Link className="btn block" style={{ marginTop: 14 }} to="/accedi">Accedi</Link>
      </div>
    )
  }

  async function saveBirth() {
    if (!birth) return
    await updateCustomerProfile(user.uid, { birth_date: birth })
    setInfo('Data di nascita salvata.')
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>👤 Il tuo profilo</h2>
        <div className="summary-rows" style={{ margin: 0 }}>
          <div className="summary-row">
            <span className="muted">Nome</span>
            <span>{profile ? `${profile.nome} ${profile.cognome}`.trim() : user.displayName || '—'}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Data di nascita</span>
            <span>{profile?.birth_date || '—'}</span>
          </div>
        </div>

        {!user.emailVerified && (
          <div className="banner" style={{ marginTop: 12 }}>
            📧 Email non ancora verificata: controlla la casella.{' '}
            <button
              className="btn ghost small"
              style={{ marginLeft: 6 }}
              onClick={() => resendVerification().then(() => setInfo('Email di verifica reinviata.'))}
            >
              Reinvia
            </button>
          </div>
        )}

        {profile && !profile.birth_date && (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="prof-birth">Completa il profilo: data di nascita</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="prof-birth" type="date" max={new Date().toISOString().slice(0, 10)} value={birth} onChange={(e) => setBirth(e.target.value)} />
              <button className="btn small" onClick={saveBirth}>Salva</button>
            </div>
          </div>
        )}

        {info && <p className="muted small" style={{ marginTop: 10 }}>{info}</p>}
      </div>

      {hasOrders && (
        <Link className="btn secondary block" to="/ordini">🧾 I miei ordini</Link>
      )}
      <button
        className="btn ghost block"
        style={{ marginTop: 8 }}
        onClick={() => logoutCustomer().then(() => navigate('/'))}
      >
        Esci dall’account
      </button>
      <Link className="btn ghost block" to="/">← Torna al menù</Link>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ verticalAlign: '-3px', marginRight: 6 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a7.21 7.21 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}
