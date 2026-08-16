import { useEffect, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import { listStaff, staffFromCache } from '../lib/staffApi.js'
import {
  createStaffCall,
  subscribePendingCalls,
  subscribeStaffShiftsRange,
  clockIn,
  clockOut,
} from '../lib/api.js'
import { RUOLO_ETICHETTA } from '../lib/ruoli.js'

// Cerca-persone direttamente nella coda del bartender: elenco del
// personale con tasto di chiamata per ciascuno. Cliccando 📟 si apre
// in riga il campo per un messaggio facoltativo.
// Orario di una timbratura, come lo si legge al banco.
const fmtOra = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// `mostraSeVuoto`: quando il pannello lo si è aperto APPOSTA (dal menu ⋯
// della coda) e non c'è nessuno da chiamare, si dice — se no si tocca una
// voce che promette qualcosa e non succede niente, e sembra rotto. Dove il
// pannello compare da sé, invece, resta muto: una card «non c'è nessuno»
// fissa in coda sarebbe rumore.
export default function StaffCallList({ mostraSeVuoto = false }) {
  // Si parte dall'elenco già in cache: aprire il pannello non deve voler dire
  // aspettare una chiamata di rete per vedere i nomi.
  const [users, setUsers] = useState(staffFromCache)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])
  const [target, setTarget] = useState(null) // uid in chiamata (form aperto)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [shifts, setShifts] = useState([])
  const [timbrando, setTimbrando] = useState('')

  useEffect(() => subscribePendingCalls(setPending), [])
  // Turni di ieri e oggi: un turno notturno resta aperto oltre la mezzanotte.
  const oggi = new Date().toISOString().slice(0, 10)
  const ieri = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  useEffect(() => subscribeStaffShiftsRange(ieri, oggi, setShifts, () => {}), [ieri, oggi])
  const turnoAperto = (uid) => shifts.find((t) => t.open && t.staff_uid === uid) || null

  async function timbra(u) {
    setTimbrando(u.uid)
    setError(null)
    try {
      if (turnoAperto(u.uid)) await clockOut({ uid: u.uid })
      else await clockIn({ uid: u.uid, name: u.name || u.email })
    } catch (e) {
      setError(e.message)
    } finally {
      setTimbrando('')
    }
  }
  useEffect(() => {
    listStaff()
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  async function chiama(u) {
    setBusy(true)
    setError(null)
    try {
      await createStaffCall({
        to_uid: u.uid,
        to_email: u.email,
        message: message.trim() || null,
        from_email: auth.currentUser?.email ?? null,
        from_name: auth.currentUser?.displayName ?? null,
      })
      setTarget(null)
      setMessage('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const myUid = auth.currentUser?.uid
  const list = (users || []).filter((u) => u.uid !== myUid && !u.disabled)

  // Nessun altro membro dello staff: niente da mostrare (salvo che il
  // pannello sia stato aperto apposta, e allora lo si dice).
  const vuoto = users !== null && list.length === 0 && !error
  if (vuoto && !mostraSeVuoto) return null
  if (vuoto) {
    return (
      <div className="card" style={{ marginTop: 8 }}>
        <strong>📟 Chiama lo staff</strong>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Non c&apos;è nessun altro da chiamare: gli account dello staff si
          creano in <strong>Utenti e ruoli</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <strong>📟 Chiama lo staff</strong>
      {error && <div className="banner">Errore: {error}</div>}
      {users === null && !error && <div className="muted small">Carico lo staff…</div>}
      {list.map((u) => (
        <div key={u.uid}>
          <div className="toggle-row">
            <div>
              <div>{u.name || u.email}</div>
              {/* Sotto il nome: ruolo e, se è in servizio, da che ora. È la
                  prima cosa che si vuole sapere di chi si sta per chiamare. */}
              <div className="desc">
                {RUOLO_ETICHETTA[u.role] ?? u.role}
                {/* "dentro/fuori" si leggeva come "dentro o fuori dal locale":
                    qui si parla di TURNO, cioè di chi ha timbrato. */}
                {turnoAperto(u.uid)
                  ? ` · in servizio dalle ${fmtOra(turnoAperto(u.uid).clock_in)}`
                  : ' · non in servizio'}
              </div>
            </div>
            <span className="row" style={{ gap: 6, flexShrink: 0 }}>
              {/* TIMBRATURA sulla riga: entrata e uscita si danno da qui, senza
                  passare dal pannello delle timbrature. */}
              <button
                className={`btn small${turnoAperto(u.uid) ? ' ghost' : ' secondary'}`}
                disabled={timbrando === u.uid}
                title={turnoAperto(u.uid) ? 'Timbra l’uscita' : 'Timbra l’entrata'}
                onClick={() => timbra(u)}
              >
                🕒 {turnoAperto(u.uid) ? 'Uscita' : 'Entrata'}
              </button>
              {pending.some((c) => c.to_uid === u.uid) ? (
                <span className="pill in_preparazione">📟 In chiamata…</span>
              ) : target === u.uid ? (
                <button className="btn ghost small" onClick={() => setTarget(null)}>
                  Annulla
                </button>
              ) : (
                <button
                  className="btn small"
                  title="Chiama (cerca-persone)"
                  onClick={() => {
                    setTarget(u.uid)
                    setMessage('')
                  }}
                >
                  📟 Chiama
                </button>
              )}
            </span>
          </div>
          {target === u.uid && (
            <div style={{ margin: '0 0 10px' }}>
              <textarea
                rows={2}
                placeholder="Messaggio (facoltativo): es. «Vieni al bancone»"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                className="btn block"
                style={{ marginTop: 8 }}
                disabled={busy}
                onClick={() => chiama(u)}
              >
                {busy ? 'Chiamo…' : '📟 Invia chiamata'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
