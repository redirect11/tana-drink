import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Registrati from './pages/Registrati.jsx'
import Accedi from './pages/Accedi.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Backoffice from './pages/Backoffice.jsx'
import { osservaUtente, esci } from './lib/db.js'
import { NOME_PRODOTTO } from './lib/prodotto.js'

export default function App() {
  const [utente, setUtente] = useState(undefined) // undefined = non ancora saputo
  useEffect(() => osservaUtente(setUtente), [])

  const pronto = utente !== undefined
  return (
    <div className="regia">
      <header className="barra">
        <Link to="/" className="marchio">
          {NOME_PRODOTTO}
        </Link>
        <nav>
          <a href="/#prezzi">Prezzi</a>
          {utente && <Link to="/dashboard">Dashboard</Link>}
          {utente?.admin && <Link to="/backoffice">Backoffice</Link>}
          {utente ? (
            <button type="button" className="link" onClick={esci}>
              Esci
            </button>
          ) : (
            <Link to="/accedi">Accedi</Link>
          )}
        </nav>
      </header>
      {pronto && (
        <Routes>
          <Route path="/" element={<Home utente={utente} />} />
          <Route path="/registrati" element={utente ? <Navigate to="/dashboard" replace /> : <Registrati />} />
          <Route path="/accedi" element={utente ? <Navigate to="/dashboard" replace /> : <Accedi />} />
          <Route path="/dashboard" element={utente ? <Dashboard utente={utente} /> : <Navigate to="/accedi" replace />} />
          <Route path="/backoffice" element={utente?.admin ? <Backoffice /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      <footer className="piede muted small">{NOME_PRODOTTO} · un’installazione per ogni locale</footer>
    </div>
  )
}
