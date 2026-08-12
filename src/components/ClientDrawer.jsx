import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logoutCustomer } from '../lib/customerAuth.js'
import VersionBadge from './VersionBadge.jsx'

// MENU LATERALE DEL CLIENTE.
//
// Il ☰ ora c'è su tutte le schermate, quindi deve rispondere anche a chi
// non è dello staff. Le voci sono le sue e solo le sue: il menù, i propri
// ordini, l'accesso e il profilo. Niente gestionale, niente impostazioni —
// quelle non passano di qui e non passano nemmeno dalle regole di
// sicurezza, ma un menu che mostra porte chiuse è già un errore.
//
// È un componente a parte e non un ramo dello StaffDrawer: quello vive di
// gruppi, nuovo ordine, ruoli e tab del gestionale, e piegarlo avrebbe
// voluto dire condizioni ovunque. Le classi CSS sono le stesse, così il
// menu si apre e si comporta identico da tutte e due le parti.
export default function ClientDrawer({ user, profile, accountsOn = false }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Il ☰ sta nell'header (App.jsx) e chiama tutti col solito evento: così
  // il tasto non deve sapere quale dei due menu è montato.
  useEffect(() => {
    const h = () => setOpen((o) => !o)
    window.addEventListener('tana:toggle-drawer', h)
    return () => window.removeEventListener('tana:toggle-drawer', h)
  }, [])

  // Col menu aperto i tasti dello zoom passano dietro: stanno in basso a
  // sinistra, cioè sopra le ultime voci.
  useEffect(() => {
    document.body.classList.toggle('drawer-open', open)
    return () => document.body.classList.remove('drawer-open')
  }, [open])

  const nome =
    profile?.nome || user?.displayName?.split(' ')[0] || String(user?.email || '').split('@')[0]

  function vai(path) {
    setOpen(false)
    navigate(path)
  }

  const attivo = (path) => (location.pathname === path ? ' active' : '')

  return (
    <>
      <button className="bar-burger" aria-label="Menu" onClick={() => setOpen(true)}>
        ☰
      </button>
      <div className={`bar-nav-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <nav className={`bar-sidebar${open ? ' open' : ''}`}>
        <div className="brand-mini">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          La Tana del Coniglio
        </div>

        <div className={`bar-nav-item${attivo('/menu')}`} onClick={() => vai('/menu')}>
          <span>🍸</span> Menù
        </div>
        {/* "I miei ordini" resta anche a chi non ne ha ancora: è la sua
            sezione, e trovarla vuota è meglio che non trovarla. */}
        <div className={`bar-nav-item${attivo('/ordini')}`} onClick={() => vai('/ordini')}>
          <span>🧾</span> I miei ordini
        </div>

        <div className="bar-nav-sep" />

        {user ? (
          <>
            <div
              className={`bar-nav-item drawer-io${attivo('/profilo')}`}
              onClick={() => vai('/profilo')}
            >
              <span>👤</span>
              <span className="drawer-io-testo">
                <span className="drawer-io-nome">{nome || 'Il mio profilo'}</span>
                <span className="drawer-io-ruolo">Il mio profilo</span>
              </span>
            </div>
            <div
              className="bar-nav-item"
              onClick={() => {
                setOpen(false)
                logoutCustomer()
              }}
            >
              <span>🚪</span> Esci
            </div>
          </>
        ) : accountsOn ? (
          <>
            <div className={`bar-nav-item${attivo('/accedi')}`} onClick={() => vai('/accedi')}>
              <span>🔑</span> Accedi
            </div>
            <div
              className={`bar-nav-item${attivo('/registrati')}`}
              onClick={() => vai('/registrati')}
            >
              <span>✍️</span> Registrati
            </div>
          </>
        ) : null}

        {/* Ramo e commit del deploy: serve a capire cosa si sta guardando
            prima di dire "non funziona". */}
        <VersionBadge className="drawer-versione" />
      </nav>
    </>
  )
}
