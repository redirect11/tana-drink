import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registra } from '../lib/db.js'
import { slugDi, problemaSlug } from '../lib/clienti.js'
import { urlDi } from '../lib/istanze.js'

// LA REGISTRAZIONE DEL TITOLARE (REQ-FLOTTA-003): email, password, nome
// del locale. Lo slug si vede mentre si scrive, perché è l'indirizzo che
// l'app avrà e non si cambia dopo.
export default function Registrati() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nomeLocale, setNomeLocale] = useState('')
  const [contatto, setContatto] = useState('')
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)
  const slug = slugDi(nomeLocale)
  const problema = nomeLocale ? problemaSlug(slug) : null

  const invia = async (e) => {
    e.preventDefault()
    setErrore(null)
    if (problema) return setErrore(problema)
    setInCorso(true)
    try {
      await registra({ email, password, nomeLocale, contatto })
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
        <h2>Registra il tuo locale</h2>
        <label htmlFor="r-nome">Nome del locale</label>
        <input id="r-nome" value={nomeLocale} onChange={(e) => setNomeLocale(e.target.value)} required />
        {nomeLocale && (
          <p className={`small ${problema ? 'errore' : 'muted'}`}>
            {problema || `L’indirizzo dell’app sarà ${urlDi(slug)}`}
          </p>
        )}
        <label htmlFor="r-email">Email</label>
        <input id="r-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="r-password">Password (almeno 8 caratteri)</label>
        <input id="r-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <label htmlFor="r-contatto">Telefono (facoltativo)</label>
        <input id="r-contatto" value={contatto} onChange={(e) => setContatto(e.target.value)} />
        {errore && <p className="errore">{errore}</p>}
        <button className="btn block" type="submit" disabled={inCorso}>
          {inCorso ? 'Un momento…' : 'Crea l’account'}
        </button>
        <p className="muted small">
          Hai già un account? <Link to="/accedi">Accedi</Link>
        </p>
      </form>
    </main>
  )
}

export function messaggio(err) {
  const codice = err?.code || ''
  if (codice.includes('email-already-in-use')) return 'Questa email ha già un account: accedi.'
  if (codice.includes('invalid-email')) return 'L’email non è scritta bene.'
  if (codice.includes('weak-password')) return 'La password è troppo corta.'
  if (codice.includes('invalid-credential') || codice.includes('wrong-password') || codice.includes('user-not-found')) {
    return 'Email o password non corrispondono.'
  }
  return err?.message || 'Qualcosa non è andato. Riprova.'
}
