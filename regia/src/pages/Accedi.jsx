import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { accedi, recuperaPassword } from '../lib/db.js'
import { messaggio } from './Registrati.jsx'

export default function Accedi() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState(null)
  const [avviso, setAvviso] = useState(null)
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

  // Il recupero non dice se l'email esiste: a chi la indovina non si
  // regala la conferma.
  const recupera = async () => {
    setErrore(null)
    if (!email) return setErrore('Scrivi l’email dell’account, poi tocca «Password dimenticata».')
    try {
      await recuperaPassword(email)
    } catch {
      /* stesso messaggio in ogni caso */
    }
    setAvviso('Se l’email ha un account, riceverai un messaggio per scegliere una password nuova.')
  }

  return (
    <main className="pagina stretta">
      <form className="card" onSubmit={invia}>
        <h2>Accedi</h2>
        <label htmlFor="a-email">Email</label>
        <input id="a-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="a-password">Password</label>
        <input id="a-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {errore && <p className="errore">{errore}</p>}
        {avviso && <p className="muted small">{avviso}</p>}
        <button className="btn block" type="submit" disabled={inCorso}>
          {inCorso ? 'Un momento…' : 'Entra'}
        </button>
        <p className="muted small">
          <button type="button" className="link" onClick={recupera}>
            Password dimenticata
          </button>
          {' · '}
          Non hai un account? <Link to="/registrati">Registra il tuo locale</Link>
        </p>
      </form>
    </main>
  )
}
