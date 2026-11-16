import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { logoutStaff } from '../lib/logout.js'
import { updateDisplayName } from '../lib/customerAuth.js'
import PasswordChanger from '../components/PasswordChanger.jsx'
import { RUOLO_ETICHETTA, isPersonale, isGestore } from '../lib/ruoli.js'
import AvvisiPanel from '../components/AvvisiPanel.jsx'
import StoricoNotifiche from '../components/StoricoNotifiche.jsx'
import Icona, { ConIcona } from '../components/Icona.jsx'
import ToggleRow from '../components/ToggleRow.jsx'
import { contoVuotoSiChiude, ricordaContoVuotoSiChiude } from '../lib/impostazioniLocali.js'

// COME LAVORA CHI È COLLEGATO, SU QUESTO DISPOSITIVO (REQ-ORD-025; il perché
// in impostazioniLocali.js, contoVuotoSiChiude). Sta nel profilo e non nelle
// impostazioni del locale come gli avvisi: chi è in sala nelle impostazioni
// non entra.
function IlMioConto({ uid }) {
  const [siChiude, setSiChiude] = useState(() => contoVuotoSiChiude(uid))
  return (
    <div className="card settings-section">
      <h3><Icona nome="coda" gruppo="tasti" /> Conto vuoto</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Vale <strong>su questo dispositivo</strong> e per questo account.
      </p>
      <ToggleRow
        label="Conto svuotato: si annulla e si torna alla coda"
        desc="Togliendo l’ultimo prodotto il conto si annulla da solo. Spento, il conto resta aperto e si annulla all’uscita se è ancora vuoto."
        checked={siChiude}
        onChange={(v) => {
          ricordaContoVuotoSiChiude(uid, v)
          setSiChiude(v)
        }}
      />
    </div>
  )
}

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
        setRole(isPersonale(r) ? r : null)
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
        <Icona nome="licenza" gruppo="segnali" /> Quest’area è riservata allo staff.
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
          <Icona nome={RUOLO_ETICHETTA[role]?.split(' ')[0] ?? 'servizio'} gruppo="tasti" /> Il mio profilo
        </h2>
        <div className="summary-rows" style={{ margin: '0 0 12px' }}>
          <div className="summary-row">
            <span className="muted">Ruolo</span>
            <span><ConIcona testo={RUOLO_ETICHETTA[role] ?? role} /></span>
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

      {/* GLI AVVISI STANNO QUI, non nelle impostazioni del locale: sono una
          scelta di chi guarda quello schermo — per persona e per
          dispositivo — non una regola del bar. E nelle impostazioni non ci
          entra chi è in sala, cioè proprio chi ha bisogno di sapere quando
          un drink è pronto. */}
      <AvvisiPanel gestore={isGestore(role)} />
      <IlMioConto uid={user.uid} />
      <StoricoNotifiche />

      {/* Per tornare al gestionale c'è l'«← Indietro» nella barra in alto,
          come in ogni altra schermata: un tasto in fondo alla pagina lo si
          trova solo scorrendo, e diceva una cosa diversa dagli altri. */}
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
