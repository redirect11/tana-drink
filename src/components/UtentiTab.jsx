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
import {
  createStaffCall,
  subscribePendingCalls,
  updateSettings,
  subscribeSettings,
  settingsIniziali,
} from '../lib/api.js'
import { associazioniDi, nomeOperatore } from '../lib/operatore.js'
import {
  RUOLI,
  RUOLI_ASSEGNABILI,
  RUOLO_ETICHETTA,
  RUOLO_DESCRIZIONE,
  isAdmin,
} from '../lib/ruoli.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import VipTab from './VipTab.jsx'
import { Sottosezioni } from '../lib/sottosezioni.js'

// GESTIONE UTENTI. Due elenchi in uno: il personale (admin/bartender/staff)
// e i clienti registrati dal sito. La nomina dei ruoli è dell'admin: da qui
// un cliente che si è registrato da solo diventa staff, e uno staff diventa
// bartender o admin, senza passare per la riga di comando.
//
// Il bartender vede gli elenchi e può chiamare col cerca-persone, ma non
// tocca i ruoli: dare le chiavi del locale è dell'amministratore.
const SEZIONI_UTENTI = [
  { id: 'utenze', icona: '👥', label: 'Utenze registrate' },
  { id: 'cassa', icona: '🟢', label: 'Chi apre la cassa' },
  { id: 'nuovo', icona: '➕', label: 'Nuovo account' },
  { id: 'vip', icona: '🎟', label: 'Buoni VIP' },
]

export default function UtentiTab({ role = null, sezioneIniziale = 'utenze' }) {
  const admin = isAdmin(role)
  // Tre sezioni come nelle altre pagine; si apre sull'elenco, che è il
  // motivo per cui si viene qui. Chi non è amministratore ha solo quello.
  const [sezione, setSezione] = useState(sezioneIniziale)
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
      {/* Il titolo sta nella barra in alto (vedi lib/sezioni.js). */}
      <Sottosezioni
        voci={admin ? SEZIONI_UTENTI : SEZIONI_UTENTI.slice(0, 1)}
        attiva={sezione}
        scegli={setSezione}
      />
      {error && <div className="banner">Errore: {error}</div>}

      {!admin && (
        <div className="card settings-section">
          <p className="muted small" style={{ margin: 0 }}>
            I ruoli li assegna l’<strong>admin</strong>. Da qui puoi consultare
            l’elenco e chiamare un collega col cerca-persone.
          </p>
        </div>
      )}

      {admin && sezione === 'cassa' && <ChiApreLaCassa utenti={users} />}

      {/* NUOVO ACCOUNT E BUONI VIP SONO SEZIONI, non pannelli a scomparsa in
          cima: aprirli spingeva giù l'elenco delle utenze, che è la cosa per
          cui si viene qui. Stanno nel menu laterale come nelle altre
          pagine. */}
      {admin && sezione === 'nuovo' && (
        <div className="card settings-section">
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            Serve solo per creare un account al posto di qualcuno. Chi si registra
            da sé compare fra i clienti: gli dai il ruolo e basta.
          </p>
          {(
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
          )}
        </div>
      )}

      {/* I buoni sono credito intestato a una persona: stanno con le persone,
          non in una voce di menu tutta loro. */}
      {admin && sezione === 'vip' && <VipTab embedded />}

      {sezione === 'utenze' && (
        <>
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
        </>
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

// ── CHI PUÒ APRIRE LA CASSA, PER OGNI ACCOUNT (REQ-STAFF-016) ────────
//
// All'apertura della cassa si sceglie chi sta lavorando fra gli admin: qui
// si decide QUALI, e la scelta è per ACCOUNT. Daniele, 19/09/2026: «si deve
// decidere quali sono gli admin, anche perché può essere Vittorio o io a
// fare il login, e lì sono altre associazioni» — il tablet del banco resta
// collegato con un account solo, e chi ci lavora dipende da quale.
//
// NON SPUNTARE NIENTE VUOL DIRE «TUTTI», e non «nessuno»: il locale che non
// ha deciso niente continua a vedere tutti gli admin, come prima. Una lista
// vuota che volesse dire «nessuno» lascerebbe l'account senza nessuno da
// scegliere, che non è una cosa che qualcuno vuole davvero.
//
// L'ACCOUNT STESSO NON SI SPUNTA: c'è sempre, è il suo login. Toglierlo
// sarebbe l'unico modo di non poter aprire la cassa con nessuno.
function ChiApreLaCassa({ utenti }) {
  const [impostazioni, setImpostazioni] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setImpostazioni, () => {}), [])
  const mappa = impostazioni.admin_associati || {}
  const admins = useMemo(
    () =>
      (utenti ?? [])
        .filter((u) => isAdmin(u.role) && !u.disabled)
        .map((u) => ({ uid: u.uid, nome: nomeOperatore(u), email: u.email || '' }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    [utenti]
  )

  const cambia = (uidAccount, uidAltro, dentro) => {
    const adesso = associazioniDi(mappa, uidAccount)
    // Da «tutti» si parte da tutti: togliendo il primo, gli altri restano.
    const base = adesso
      ? [...adesso]
      : admins.filter((a) => a.uid !== uidAccount).map((a) => a.uid)
    const prossima = dentro ? [...new Set([...base, uidAltro])] : base.filter((x) => x !== uidAltro)
    updateSettings({ admin_associati: { ...mappa, [uidAccount]: prossima } }).catch(() => {})
  }

  if (admins.length < 2) {
    return (
      <div className="card settings-section">
        <h3>Chi apre la cassa</h3>
        <p className="muted small" style={{ margin: 0 }}>
          C’è un solo account admin: all’apertura della cassa non c’è niente da
          scegliere. La domanda compare da quando ce n’è più d’uno.
        </p>
      </div>
    )
  }

  return (
    <div className="card settings-section">
      <h3>Chi apre la cassa</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
        All’apertura della cassa si sceglie chi sta lavorando, senza rifare il
        login. Qui si decide chi può comparire in quell’elenco, <strong>per
        ogni account</strong>: il tablet resta collegato con un account solo, e
        da quale dipende chi ci lavora. Se non spunti nessuno, compaiono tutti.
      </p>
      {admins.map((account) => {
        const ammessi = associazioniDi(mappa, account.uid)
        return (
          <div key={account.uid} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600 }}>
              Col login di {account.nome}{' '}
              <span className="muted small">{account.email}</span>
            </div>
            <div className="chips-row" style={{ marginTop: 6 }}>
              {admins.map((altro) => {
                const sempre = altro.uid === account.uid
                const dentro = sempre || !ammessi || ammessi.has(altro.uid)
                return (
                  <button
                    key={altro.uid}
                    type="button"
                    className={`chip${dentro ? ' active' : ''}`}
                    aria-pressed={dentro}
                    disabled={sempre}
                    title={sempre ? 'È il suo account: c’è sempre' : undefined}
                    onClick={() => cambia(account.uid, altro.uid, !dentro)}
                  >
                    {altro.nome}
                    {sempre ? ' (sempre)' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
