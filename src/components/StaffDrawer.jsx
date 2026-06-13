import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { devToolsEnabled } from '../dev/devActions.js'

const BARTENDER_NAV = [
  ['coda', '🧾', 'Coda ordini'],
  ['stats', '📊', 'Statistiche'],
  ['menu', '🍸', 'Menù'],
  ['inventario', '📦', 'Inventario'],
  ['staff', '👥', 'Staff'],
  ['impostazioni', '⚙️', 'Impostazioni'],
]

const STAFF_NAV = [
  ['servizio', '🫱', 'Da servire'],
  ['miei-ordini', '🧾', 'I miei ordini'],
]

// Menu laterale dello staff: usato nel gestionale (onSelect cambia tab)
// e nella vista menu per l'ordinazione manuale (naviga a /bar?tab=…).
export default function StaffDrawer({ role, active = null, onSelect = null }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const base = role === 'bartender' ? BARTENDER_NAV : STAFF_NAV
  const items = role === 'bartender' && devToolsEnabled ? [...base, ['dev', '🛠', 'Dev']] : base

  function go(id) {
    setOpen(false)
    if (onSelect) onSelect(id)
    else navigate(id === 'servizio' ? '/bar' : `/bar?tab=${id}`)
  }

  function nuovoOrdine() {
    setOpen(false)
    navigate('/menu')
  }

  return (
    <>
      <button className="bar-burger" aria-label="Menu" onClick={() => setOpen(true)}>
        ☰
      </button>
      <div className={`bar-nav-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <nav className={`bar-sidebar${open ? ' open' : ''}`}>
        <div className="brand-mini">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          Gestionale
        </div>
        {items.map(([id, icon, label]) => (
          <div
            key={id}
            className={`bar-nav-item${active === id ? ' active' : ''}`}
            onClick={() => go(id)}
          >
            <span>{icon}</span> {label}
          </div>
        ))}
        <div className="bar-nav-sep" />
        <div
          className={`bar-nav-item${active === 'ordine' ? ' active' : ''}`}
          onClick={nuovoOrdine}
        >
          <span>✍️</span> Nuovo ordine
        </div>
        <div className="bar-nav-item" onClick={() => signOut(auth)}>
          <span>🚪</span> Esci
        </div>
      </nav>
    </>
  )
}
