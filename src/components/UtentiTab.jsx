import { useEffect, useMemo, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import {
  listStaff,
  listUtenti,
  createStaff,
  setStaffRole,
  setStaffDisabled,
  removeStaff,
} from '../lib/staffApi.js'
import { createStaffCall, subscribePendingCalls, updateSettings } from '../lib/api.js'
import {
  RUOLI,
  RUOLI_ASSEGNABILI,
  RUOLO_ETICHETTA,
  RUOLO_DESCRIZIONE,
  isAdmin,
} from '../lib/ruoli.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import SectionPanels from './SectionPanels.jsx'
import VipTab from './VipTab.jsx'

// GESTIONE UTENTI. Due elenchi in uno: il personale (admin/bartender/staff)
// e i clienti registrati dal sito. La nomina dei ruoli è dell'admin: da qui
// un cliente che si è registrato da solo diventa staff, e uno staff diventa
// bartender o admin, senza passare per la riga di comando.
//
// Il bartender vede gli elenchi e può chiamare col cerca-persone, ma non
// tocca i ruoli: dare le chiavi del locale è dell'amministratore.
export default function UtentiTab({ role = null }) {
  const admin = isAdmin(role)
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // { title, message, danger, run }
  const [cambioRuolo, setCambioRuolo] = useState(null) // utente da nominare
  const [ruoloScelto, setRuoloScelto] = useState('staff')
  const [cerca, setCerca] = useState('')
  const [tuttiClienti, setTuttiClienti] = useState(false)

  // Form nuovo account
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nuovoRuolo, setNuovoRuolo] = useState('staff')

  const [pendingCalls, setPendingCalls] = useState([])
  const [callTarget, setCallTarget] = useState(null)
  const [callMessage, setCallMessage] = useState('')

  useEffect(() => subscribePendingCalls(setPendingCalls), [])

  async function reload() {
    try {
      // L'admin vede tutti (clienti compresi): è da lì che nomina. Al
      // bartender la callable nega l'elenco completo, e va bene: gli serve
      // solo la rubrica del personale.
      const list = admin ? await listUtenti() : await listStaff()
      setUsers(list)
      // Numero membri attivi: serve per la divisione delle mance
      // (visibile allo staff via settings, lettura pubblica).
      const attivi = list.filter((u) => !u.disabled && RUOLI.includes(u.role)).length
      updateSettings({ staff_count: attivi }).catch(() => {})
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin])

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendCall() {
    const target = callTarget
    setCallTarget(null)
    setError(null)
    try {
      await createStaffCall({
        to_uid: target.uid,
        to_email: target.email,
        message: callMessage.trim() || null,
        from_email: auth.currentUser?.email ?? null,
        from_name: auth.currentUser?.displayName ?? null,
      })
      setCallMessage('')
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    await run(async () => {
      await createStaff({ email: email.trim(), password, role: nuovoRuolo, name: name.trim() })
      setName('')
      setEmail('')
      setPassword('')
    })
  }

  const myUid = auth.currentUser?.uid
  const personale = useMemo(
    () => (users ?? []).filter((u) => RUOLI.includes(u.role)),
    [users]
  )
  const clienti = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    const soloClienti = (users ?? []).filter((u) => !RUOLI.includes(u.role))
    if (!q) return soloClienti
    return soloClienti.filter((u) =>
      `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(q)
    )
  }, [users, cerca])

  if (error && !users) return <div className="banner">Errore: {error}</div>
  if (!users) return <div className="empty">Carico gli utenti…</div>

  // Riga utente, uguale per personale e clienti.
  const riga = (u) => (
    <div className="toggle-row" key={u.uid}>
      <div>
        <div>
          {u.name || u.email}
          {u.uid === myUid && <span className="muted"> (tu)</span>}
          {u.disabled && <span className="pill annullato" style={{ marginLeft: 6 }}>sospeso</span>}
        </div>
        <div className="desc">
          {RUOLO_ETICHETTA[u.role] ?? u.role}
          {u.name && u.email ? ` · ${u.email}` : ''}
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {RUOLI.includes(u.role) && u.uid !== myUid && !u.disabled && (
          pendingCalls.some((c) => c.to_uid === u.uid) ? (
            <span className="pill in_preparazione">📟 In chiamata…</span>
          ) : (
            <button
              className="btn small"
              disabled={busy}
              title="Chiama (cerca-persone)"
              onClick={() => setCallTarget(u)}
            >
              📟
            </button>
          )
        )}
        {admin && u.uid !== myUid && (
          <>
            <button
              className="btn ghost small"
              disabled={busy}
              title="Cambia ruolo"
              onClick={() => {
                setRuoloScelto(u.role)
                setCambioRuolo(u)
              }}
            >
              🎚 Ruolo
            </button>
            <button
              className="btn ghost small"
              disabled={busy}
              title={u.disabled ? 'Riattiva l’accesso' : 'Sospendi l’accesso'}
              onClick={() =>
                setConfirm({
                  title: u.disabled ? `Riattivare ${u.email}?` : `Sospendere ${u.email}?`,
                  message: u.disabled
                    ? 'Tornerà a poter accedere con le stesse credenziali.'
                    : 'Non potrà più accedere. L’account e il suo storico restano: si può riattivare quando vuoi.',
                  run: () => run(() => setStaffDisabled(u.uid, !u.disabled)),
                })
              }
            >
              {u.disabled ? '▶' : '⏸'}
            </button>
            <button
              className="btn ghost small"
              disabled={busy}
              title="Elimina definitivamente"
              onClick={() =>
                setConfirm({
                  title: `Eliminare ${u.email}?`,
                  message:
                    'Operazione irreversibile: l’account sparisce. Se serve solo togliergli l’accesso, usa ⏸ Sospendi.',
                  danger: true,
                  run: () => run(() => removeStaff(u.uid)),
                })
              }
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <h2>🧑‍🤝‍🧑 Utenti e ruoli</h2>
      {error && <div className="banner">Errore: {error}</div>}

      {!admin && (
        <div className="card settings-section">
          <p className="muted small" style={{ margin: 0 }}>
            I ruoli li assegna l’<strong>admin</strong>. Da qui puoi consultare
            l’elenco e chiamare un collega col cerca-persone.
          </p>
        </div>
      )}

      {/* Sottosezioni: stessa convenzione di tutte le pagine — tasti sotto
          al titolo, il pannello si apre lì. */}
      {admin && (
        <SectionPanels
          panels={[
            {
              id: 'nuovo',
              label: '➕ Nuovo account',
              desc: 'Serve solo per creare un account al posto di qualcuno. Chi si registra da sé compare qui sotto fra i clienti: gli dai il ruolo e basta.',
              render: () => (
            <form onSubmit={handleCreate}>
              <label htmlFor="staff-name">Nome</label>
              <input
                id="staff-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Giulia"
              />
              <label htmlFor="staff-email">Email</label>
              <input
                id="staff-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cameriera@latanadelconiglio.it"
              />
              <label htmlFor="staff-password">Password (min 6 caratteri)</label>
              <input
                id="staff-password"
                type="text"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="da comunicare al collaboratore"
              />
              <label>Ruolo</label>
              <div className="mode-choice">
                {RUOLI.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`mode-option${nuovoRuolo === value ? ' active' : ''}`}
                    onClick={() => setNuovoRuolo(value)}
                  >
                    {RUOLO_ETICHETTA[value]}
                  </button>
                ))}
              </div>
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                {RUOLO_DESCRIZIONE[nuovoRuolo]}
              </p>
              <button className="btn block" style={{ marginTop: 12 }} type="submit" disabled={busy}>
                {busy ? 'Creo…' : '➕ Crea account'}
              </button>
            </form>
              ),
            },
            {
              id: 'vip',
              label: '🎟 Buoni VIP',
              // I buoni sono credito intestato a una persona: stanno con le
              // persone, non in una voce di menu tutta loro.
              render: () => <VipTab embedded />,
            },
          ]}
        />
      )}

      <div className="card settings-section">
        <h3>Personale ({personale.length})</h3>
        {personale.length === 0 && <div className="empty">Nessun account con un ruolo.</div>}
        {personale.map(riga)}
      </div>

      {admin && (
        <div className="card settings-section">
          <h3>Clienti registrati ({clienti.length})</h3>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            Si sono registrati dal sito. Non vedono nulla del gestionale finché
            non gli dai un ruolo.
          </p>
          <input
            type="search"
            placeholder="Cerca per nome o email…"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
          />
          {clienti.length === 0 && (
            <div className="empty" style={{ marginTop: 10 }}>
              {cerca ? 'Nessuno con questo nome.' : 'Ancora nessun cliente registrato.'}
            </div>
          )}
          {(tuttiClienti ? clienti : clienti.slice(0, 25)).map(riga)}
          {!tuttiClienti && clienti.length > 25 && (
            <button
              className="btn ghost block"
              style={{ marginTop: 8 }}
              onClick={() => setTuttiClienti(true)}
            >
              Mostra tutti ({clienti.length})
            </button>
          )}
        </div>
      )}

      {cambioRuolo && (
        <div className="overlay confirm-overlay" onClick={() => setCambioRuolo(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Ruolo di {cambioRuolo.name || cambioRuolo.email}
            </h3>
            <div className="mode-choice" style={{ flexWrap: 'wrap' }}>
              {RUOLI_ASSEGNABILI.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`mode-option${ruoloScelto === value ? ' active' : ''}`}
                  onClick={() => setRuoloScelto(value)}
                >
                  {RUOLO_ETICHETTA[value]}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ marginBottom: 4 }}>
              {RUOLO_DESCRIZIONE[ruoloScelto]}
            </p>
            <p className="muted small" style={{ marginTop: 0 }}>
              Il nuovo ruolo vale dal suo prossimo accesso.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="btn ghost grow" onClick={() => setCambioRuolo(null)}>
                Annulla
              </button>
              <button
                className="btn grow"
                disabled={busy || ruoloScelto === cambioRuolo.role}
                onClick={() => {
                  const u = cambioRuolo
                  const nuovo = ruoloScelto
                  setCambioRuolo(null)
                  if (isAdmin(nuovo)) {
                    setConfirm({
                      title: `Nominare admin ${u.email}?`,
                      message:
                        'Un admin ha accesso completo e può cambiare i ruoli di tutti, incluso il tuo.',
                      run: () => run(() => setStaffRole(u.uid, nuovo)),
                    })
                  } else {
                    run(() => setStaffRole(u.uid, nuovo))
                  }
                }}
              >
                Assegna
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Conferma"
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { run: fn } = confirm
            setConfirm(null)
            fn()
          }}
        />
      )}

      {callTarget && (
        <div className="overlay confirm-overlay" onClick={() => setCallTarget(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>📟 Chiama {callTarget.name || callTarget.email}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Il dispositivo vibrerà con insistenza finché non risponde.
            </p>
            <textarea
              rows={2}
              placeholder="Messaggio (facoltativo): es. «Vieni al bancone»"
              value={callMessage}
              onChange={(e) => setCallMessage(e.target.value)}
            />
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="btn ghost grow" onClick={() => setCallTarget(null)}>
                Annulla
              </button>
              <button className="btn grow" onClick={sendCall}>
                📟 Chiama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
