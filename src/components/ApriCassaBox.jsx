import { useEffect, useState } from 'react'
import { openCashSession } from '../lib/api.js'
import { toastError } from '../lib/toast.js'
import { listStaff, staffFromCache } from '../lib/staffApi.js'
import {
  operatoreCorrente,
  operatoriSelezionabili,
  ricordaOperatore,
  valeLaPenaChiedere,
} from '../lib/operatore.js'

// ── APRIRE LA CASSA, DA DOVE CI SI TROVA ─────────────────────────────
//
// A inizio serata la cassa si apre e basta: mandare chi sta al banco nella
// pagina della cassa per premere un tasto e tornare indietro sono tre
// passaggi per una cosa che ne vale uno. Qui si chiede solo il fondo — ed è
// facoltativo, perché non tutti lo mettono — e si apre.
//
// «Annulla» lascia tutto com'è: cassa chiusa. È il motivo per cui questo è
// un box e non un tasto secco — premere «apri cassa» per sbaglio, e
// ritrovarsi una serata aperta con un fondo sbagliato, si sistema solo
// chiudendo e riaprendo.
// ── E CHI LA APRE? (REQ-STAFF-016) ───────────────────────────────────
//
// Flavio, 11/09/2026: «ad ogni apertura di cassa dell'admin, già con login
// automatico, verrà chiesto se sta aprendo Flavio o Vittorio». Il tablet del
// banco resta collegato con un account solo, ma a lavorarci sono due
// persone, e l'apertura della cassa è il momento in cui si sa chi c'è.
//
// LA DOMANDA COMPARE SOLO SE HA SENSO: con un admin solo la risposta è una
// sola, e chiederla ogni sera sarebbe un tocco in più per niente.
//
// L'ELENCO ARRIVA DALLA CACHE, e non è un dettaglio. Gli admin si leggono da
// una Cloud Function: lenta, e con la rete del locale che «risulta collegata
// ma non passa» non arriva mai. Aprire la cassa non può aspettarla — è il
// primo gesto della serata — quindi si mostra quello che si sa già e si
// rinfresca in sottofondo per la prossima volta.
export default function ApriCassaBox({ cutoffHour, by, onClose }) {
  const [fondo, setFondo] = useState('')
  const [busy, setBusy] = useState(false)
  const [staff, setStaff] = useState(() => staffFromCache() || [])
  useEffect(() => {
    let vivo = true
    listStaff()
      .then((l) => vivo && setStaff(l || []))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  const scelte = operatoriSelezionabili(staff, by?.uid)
  const chiedere = valeLaPenaChiedere(staff, by?.uid)
  const [chi, setChi] = useState(null)
  // Di suo è chi ci lavorava l'ultima volta da questo tablet: a inizio
  // serata è quasi sempre lo stesso, e la risposta giusta è già pronta.
  const scelto = chi || operatoreCorrente(staff, by?.uid)

  const apri = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (chiedere && scelto) ricordaOperatore(by?.uid, scelto)
      await openCashSession({
        // Senza nessuno da scegliere si firma come sempre: è il locale con
        // un admin solo, e non c'è niente di nuovo da dire.
        by: chiedere && scelto ? { uid: scelto.uid, email: scelto.email, name: scelto.nome } : by,
        fondo: Number(String(fondo).replace(',', '.')) || 0,
        cutoffHour,
      })
      onClose()
    } catch (e) {
      toastError(`Cassa non aperta: ${e.message}`)
      setBusy(false)
    }
  }

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>🟢 Apri la cassa</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Da qui in poi gli incassi della serata si contano da soli, fino alla
          chiusura.
        </p>
        {chiedere && (
          <>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Chi apre la cassa?</p>
            <div className="chips-row" style={{ marginBottom: 12 }}>
              {scelte.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  className={`chip${scelto?.uid === u.uid ? ' active' : ''}`}
                  aria-pressed={scelto?.uid === u.uid}
                  onClick={() => setChi(u)}
                >
                  {u.nome}
                </button>
              ))}
            </div>
          </>
        )}
        <label htmlFor="fondo-cassa">Fondo cassa iniziale (€) — se ce n&apos;è</label>
        <input
          id="fondo-cassa"
          type="number"
          step="0.5"
          min="0"
          value={fondo}
          onChange={(e) => setFondo(e.target.value)}
          placeholder="Es. 50"
          autoFocus
        />
        <div className="grid-2" style={{ marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button type="button" className="btn" onClick={apri} disabled={busy}>
            {busy ? 'Apro…' : 'Apri cassa'}
          </button>
        </div>
      </div>
    </div>
  )
}
