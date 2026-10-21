import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { accedi } from '../lib/db.js'
import { messaggio } from './Registrati.jsx'

export default function Accedi() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  const invia = async (e) => {
    e.preventDefault()
    setErrore(null)
    setInCorso(true)
    try {
      await accedi({ email, password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrore(messaggio(err))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <main className="pagina stretta">
      <form className="card" onSubmit={invia}>
        <h2>Accedi</h2>
        <label htmlFor="a-email">Email</label>
        <input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="a-password">Password</label>
        <input id="a-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {errore && <p className="errore">{errore}</p>}
        <button className="btn block" type="submit" disabled={inCorso}>
          {inCorso ? 'Un momento…' : 'Entra'}
        </button>
        <p className="muted small">
          Non hai un account? <Link to="/registrati">Registra il tuo locale</Link>
        </p>
      </form>
    </main>
  )
}
