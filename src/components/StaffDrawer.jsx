import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebaseClient.js'
import { logoutStaff } from '../lib/logout.js'
import { devToolsEnabled } from '../dev/devActions.js'
import {
  subscribeSettings,
  subscribeOpenGroups,
  createManualGroup,
  DEFAULT_SETTINGS,
} from '../lib/api.js'

const BARTENDER_NAV = [
  ['coda', '🧾', 'Coda ordini'],
  ['pagamenti', '💳', 'Pagamenti'],
  ['fatture', '📄', 'Fatture'],
  ['stats', '📊', 'Statistiche'],
  ['menu', '🍸', 'Menù'],
  ['inventario', '📦', 'Inventario'],
  ['staff', '👥', 'Staff'],
  ['ore', '🕒', 'Ore staff'],
  ['vip', '🎟', 'Buoni VIP'],
  ['stampante', '🖨️', 'Stampante'],
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

  // Gruppi nel drawer (quadratini): attivi se l'impostazione lo prevede.
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [groups, setGroups] = useState([])
  const [newName, setNewName] = useState('')
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const showGroups = settings.groups_enabled && settings.groups_in_drawer
  useEffect(() => {
    if (!showGroups) {
      setGroups([])
      return
    }
    return subscribeOpenGroups(setGroups, () => {})
  }, [showGroups])
  // Solo gruppi che possono ricevere ordini diretti (no contenitori).
  const groupTiles = groups.filter((g) => !g.has_child_groups)

  const base = role === 'bartender' ? BARTENDER_NAV : STAFF_NAV
  const items = role === 'bartender' && devToolsEnabled ? [...base, ['dev', '🛠', 'Dev']] : base

  function go(id) {
    setOpen(false)
    if (onSelect) onSelect(id)
    else navigate(id === 'servizio' ? '/bar' : `/bar?tab=${id}`)
  }

  function nuovoOrdine() {
    setOpen(false)
    // La creazione ordine è la CASSA in stile POS (segue il tema staff),
    // non il menù cliente: /menu resta per la "vista cliente" e i gruppi.
    navigate('/pos')
  }

  function ordineGruppo(id) {
    setOpen(false)
    navigate(`/menu?group=${id}`)
  }

  async function creaGruppo() {
    const name = newName.trim()
    if (!name) return
    const u = auth.currentUser
    const g = await createManualGroup({
      name,
      created_by: u ? { uid: u.uid, email: u.email, role } : null,
    }).catch(() => null)
    setNewName('')
    if (g) ordineGruppo(g.id)
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

        {showGroups && (
          <div className="drawer-groups">
            <div className="drawer-groups-title">Gruppi</div>
            <div className="group-tiles">
              {groupTiles.map((g) => (
                <button
                  key={g.id}
                  className="group-tile"
                  title={g.name}
                  onClick={() => ordineGruppo(g.id)}
                >
                  <span className="group-tile-ic">{g.kind === 'customer' ? '👤' : '🏷'}</span>
                  <span className="group-tile-name">{g.name}</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 6, padding: '0 14px', marginTop: 8 }}>
              <input
                type="text"
                placeholder="+ Nuovo gruppo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && creaGruppo()}
              />
              <button className="btn small" style={{ flexShrink: 0 }} onClick={creaGruppo} disabled={!newName.trim()}>
                Crea
              </button>
            </div>
          </div>
        )}

        <div className="bar-nav-sep" />
        <div className="bar-nav-item" onClick={() => logoutStaff()}>
          <span>🚪</span> Esci
        </div>
      </nav>
    </>
  )
}
