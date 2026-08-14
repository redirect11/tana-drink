import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebaseClient.js'
import { logoutStaff } from '../lib/logout.js'
import { devToolsEnabled } from '../dev/devActions.js'
import { isGestore, RUOLO_ETICHETTA } from '../lib/ruoli.js'
import { IconGruppo, IconPersona } from './Icons.jsx'
import VersionBadge from './VersionBadge.jsx'
import {
  subscribeSettings,
  subscribeOpenGroups,
  createManualGroup,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
// Le voci stanno in un posto solo: le stesse fanno il titolo nella barra.
import { NAV_GESTIONALE as BARTENDER_NAV, NAV_SALA as STAFF_NAV } from '../lib/sezioni.js'
import { subscribeSottosezioni } from '../lib/sottosezioni.js'

// Menu laterale dello staff: usato nel gestionale (onSelect cambia tab)
// e nella vista menu per l'ordinazione manuale (naviga a /bar?tab=…).
export default function StaffDrawer({ role, active = null, onSelect = null }) {
  const [open, setOpen] = useState(false)
  // I gruppi restano chiusi finché non li si apre, e la scelta si ricorda:
  // chi lavora a gruppi non deve riaprirli a ogni giro.
  // Le sottosezioni della pagina aperta: le dichiara la pagina stessa.
  const [sotto, setSotto] = useState({ voci: [], attiva: null, scegli: null })
  useEffect(() => subscribeSottosezioni(setSotto), [])
  const [gruppiAperti, setGruppiAperti] = useState(
    () => localStorage.getItem('tana:drawer-gruppi') === '1'
  )
  // ── IL MENU AGGANCIATO ALLA PAGINA ────────────────────────────────
  // Dove la pagina ha delle sezioni sue (Impostazioni, Inventario) il menu
  // resta APERTO come parte della pagina: il contenuto si stringe per fargli
  // posto invece di finirci sotto. Lì dentro si salta da una sezione
  // all'altra venti volte di seguito, e un menu che copre significa aprire,
  // cercare, scegliere — e intanto non vedere più dove si era.
  // Chi ha bisogno di tutta la larghezza lo chiude col ✕, e resta chiuso
  // anche domani: la scelta è di chi lavora, non nostra.
  const [agganciato, setAgganciato] = useState(
    () => localStorage.getItem('tana:drawer-agganciato') !== '0'
  )
  const navigate = useNavigate()
  const utente = auth.currentUser
  const nomeUtente = utente?.displayName || String(utente?.email || '').split('@')[0] || 'Il mio profilo'

  useEffect(() => {
    try {
      localStorage.setItem('tana:drawer-gruppi', gruppiAperti ? '1' : '0')
    } catch {
      /* niente memoria: valgono per questa sessione */
    }
  }, [gruppiAperti])

  // Il menu si apre dal ☰ della TOPBAR (che sta in App.jsx): il tasto flottante
  // resta solo nelle schermate a tutto schermo, dove la topbar è nascosta.
  useEffect(() => {
    const h = () => setOpen((o) => !o)
    window.addEventListener('tana:toggle-drawer', h)
    return () => window.removeEventListener('tana:toggle-drawer', h)
  }, [])

  // Col menu aperto i tasti dello zoom devono passare DIETRO: stanno in
  // basso a sinistra, cioè esattamente sopra le ultime voci (Esci).
  useEffect(() => {
    document.body.classList.toggle('drawer-open', open)
    return () => document.body.classList.remove('drawer-open')
  }, [open])

  // Solo le pagine con sezioni proprie tengono il menu agganciato: sulla
  // coda ordini sarebbe una colonna in meno di conti. La classe sta sul
  // body perché a diventare una riga dev'essere la PAGINA, che sta in un
  // altro componente; sul telefono il CSS la ignora — lì una colonna fissa
  // sarebbe mezzo schermo.
  const dock = agganciato && sotto.voci.length > 0
  useEffect(() => {
    document.body.classList.toggle('drawer-agganciato', dock)
    return () => document.body.classList.remove('drawer-agganciato')
  }, [dock])

  useEffect(() => {
    try {
      localStorage.setItem('tana:drawer-agganciato', agganciato ? '1' : '0')
    } catch {
      /* niente memoria: vale per questa volta */
    }
  }, [agganciato])

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

  const base = isGestore(role) ? BARTENDER_NAV : STAFF_NAV
  const items = isGestore(role) && devToolsEnabled ? [...base, ['dev', '🛠', 'Dev']] : base

  function go(id) {
    setOpen(false)
    // "Vista cliente" non è una sezione del gestionale: è il menù come lo
    // vede chi ordina. Era un tasto in barra, ma la navigazione sta qui.
    // ?vista=cliente: il menù COM'È PER CHI ORDINA. Senza, un membro del
    // personale che apre /menu trova il proprio strumento per gli ordini
    // manuali — utile, ma non è la vista cliente.
    if (id === 'vista-cliente') return navigate('/menu?vista=cliente')
    if (onSelect) onSelect(id)
    else navigate(id === 'servizio' ? '/bar' : `/bar?tab=${id}`)
  }

  function nuovoOrdine() {
    setOpen(false)
    // Per i gestori la creazione ordine è la CASSA in stile POS (segue il
    // tema staff). La sala invece ordina DAL MENÙ: lo stesso che mostra al
    // tavolo, con la ricerca — il POS è lo strumento del banco.
    navigate(isGestore(role) ? '/pos' : '/menu')
  }

  // Toccando un gruppo si aprono i SUOI ORDINI nella coda (non si entra
  // a comporre un ordine: da lì semmai si aggiunge).
  function apriGruppo(id) {
    setOpen(false)
    navigate(`/bar?group=${id}`)
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
    if (g) apriGruppo(g.id)
  }

  return (
    <>
      <button className="bar-burger" aria-label="Menu" onClick={() => setOpen(true)}>
        ☰
      </button>
      <div className={`bar-nav-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <nav className={`bar-sidebar${open ? ' open' : ''}${dock ? ' agganciata' : ''}`}>
        <div className="brand-mini">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          Gestionale
          {/* Aggancia o stacca. Compare solo dove ha senso — pagine con
              sezioni proprie, schermo largo — e dice cosa fa: chiuderlo
              restituisce larghezza al contenuto. */}
          {sotto.voci.length > 0 && (
            <button
              type="button"
              className="bar-nav-aggancia"
              onClick={() => {
                setAgganciato((v) => !v)
                setOpen(false)
              }}
              title={dock ? 'Chiudi il menu e allarga la pagina' : 'Tieni il menu aperto nella pagina'}
              aria-label={dock ? 'Chiudi il menu' : 'Tieni il menu aperto'}
            >
              {dock ? '✕' : '📌'}
            </button>
          )}
        </div>
        {/* IL SECONDO LIVELLO STA QUI DENTRO, sotto la pagina in cui ci si
            trova. È il modo in cui si fa di solito con un menu a scomparsa:
            un posto solo per navigare, uguale sul telefono e sul computer,
            invece di schede in barra (che sopra le cinque voci non ci
            stanno) o di una colonna in pagina (che costa spazio tutto il
            giorno). Le sottosezioni compaiono per la pagina APERTA: sono le
            uniche che si conoscono senza esserci passati. */}
        {items.map(([id, icon, label]) => (
          <div key={id}>
            <div
              className={`bar-nav-item${active === id ? ' active' : ''}`}
              onClick={() => go(id)}
            >
              <span>{icon}</span> {label}
            </div>
            {active === id && sotto.voci.length > 0 && (
              <div className="bar-nav-sotto">
                {sotto.voci.map((v) => (
                  <div
                    key={v.id}
                    className={`bar-nav-item bar-nav-sottovoce${
                      v.id === sotto.attiva ? ' active' : ''
                    }`}
                    onClick={() => {
                      sotto.scegli?.(v.id)
                      setOpen(false)
                    }}
                  >
                    <span>{v.icona}</span> {v.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="bar-nav-sep" />
        <div
          className={`bar-nav-item${active === 'ordine' ? ' active' : ''}`}
          onClick={nuovoOrdine}
        >
          <span>✍️</span> {isGestore(role) ? 'Nuovo ordine' : 'Nuovo ordine dal menù'}
        </div>

        {showGroups && (
          <div className="drawer-groups">
            {/* A SCOMPARSA. I gruppi sono pochi ma occupano molto (riquadri
                a due colonne) e spingevano "Esci" e il resto fuori vista.
                Chiusi di default: chi li usa li apre, e la scelta resta. */}
            <button
              type="button"
              className={`drawer-groups-title${gruppiAperti ? ' aperto' : ''}`}
              onClick={() => setGruppiAperti((v) => !v)}
              aria-expanded={gruppiAperti}
            >
              <span className="drawer-groups-freccia">▸</span>
              Gruppi
              {groupTiles.length > 0 && <span className="drawer-groups-conto">{groupTiles.length}</span>}
            </button>
            {gruppiAperti && (
              <>
                <div className="group-tiles">
                  {groupTiles.map((g) => (
                    <button
                      key={g.id}
                      className="group-tile"
                      title={g.name}
                      onClick={() => apriGruppo(g.id)}
                    >
                      <span className="group-tile-ic">
                        {g.kind === 'customer' ? <IconPersona /> : <IconGruppo />}
                      </span>
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
                  <button
                    className="btn small"
                    style={{ flexShrink: 0 }}
                    onClick={creaGruppo}
                    disabled={!newName.trim()}
                  >
                    Crea
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="bar-nav-sep" />
        {/* CHI È COLLEGATO. Serve al bar con più persone e un dispositivo
            solo: prima di battere un ordine si vede a nome di chi va, e con
            un tocco si apre il profilo (nome, password). */}
        <div
          className={`bar-nav-item drawer-io${active === 'profilo' ? ' active' : ''}`}
          onClick={() => {
            setOpen(false)
            navigate('/profilo-staff')
          }}
        >
          <span>{RUOLO_ETICHETTA[role]?.split(' ')[0] ?? '🙋'}</span>
          <span className="drawer-io-testo">
            <span className="drawer-io-nome">{nomeUtente}</span>
            <span className="drawer-io-ruolo">
              {(RUOLO_ETICHETTA[role] ?? 'Utente').replace(/^\S+\s/, '')}
            </span>
          </span>
        </div>
        <div className="bar-nav-item" onClick={() => logoutStaff()}>
          <span>🚪</span> Esci
        </div>
        {/* Ramo e commit del deploy: con più branch che passano a turno
            sullo stesso ambiente di test, serve sapere cosa si sta
            guardando prima di dire "non funziona". */}
        <VersionBadge className="drawer-versione" />
      </nav>
    </>
  )
}
