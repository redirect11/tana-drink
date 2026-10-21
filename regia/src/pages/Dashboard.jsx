import { useEffect, useState } from 'react'
import { osservaCliente, osservaIstanza, osservaRichiesta, chiediAttivazione, inviaVerificaEmail, rileggiUtente } from '../lib/db.js'
import { statoIstanza, statoDetto, puoAttivare, urlDi, progettoDi, STATI } from '../lib/istanze.js'
import { PIANI, MODULI, prezzoMensile, euro } from '../lib/piani.js'
import SceltaPiano from './SceltaPiano.jsx'

// LA DASHBOARD DEL TITOLARE (REQ-FLOTTA-004): il suo locale, il piano, lo
// stato dell'istanza e, quando è attiva, l'indirizzo dell'app.
export default function Dashboard({ utente }) {
  const [cliente, setCliente] = useState(undefined)
  const [istanza, setIstanza] = useState(null)
  const [richiesta, setRichiesta] = useState(null)
  const [errore, setErrore] = useState(null)
  const [avviso, setAvviso] = useState(null)

  useEffect(() => osservaCliente(utente.uid, setCliente), [utente.uid])
  useEffect(() => {
    if (!cliente?.slug) return undefined
    const a = osservaIstanza(cliente.slug, setIstanza)
    const b = osservaRichiesta(cliente.slug, setRichiesta)
    return () => {
      a()
      b()
    }
  }, [cliente?.slug])

  if (cliente === undefined) return <main className="pagina stretta muted">Carico…</main>
  if (!cliente) return <main className="pagina stretta">Nessun locale registrato per questo account.</main>

  const stato = statoIstanza(istanza, richiesta)
  const via = puoAttivare(cliente, istanza, richiesta, { emailVerificata: utente.emailVerificata !== false })
  const piano = cliente.piano ? PIANI[cliente.piano] : null

  const attiva = async () => {
    setErrore(null)
    try {
      await chiediAttivazione(cliente)
    } catch (e) {
      setErrore(e.message)
    }
  }

  const rimanda = async () => {
    setAvviso(null)
    try {
      await inviaVerificaEmail()
      setAvviso('Email inviata di nuovo: controlla anche la posta indesiderata.')
    } catch (e) {
      setAvviso(e.message)
    }
  }
  const verificata = async () => {
    const ok = await rileggiUtente().catch(() => false)
    setAvviso(ok ? 'Email confermata.' : 'Non risulta ancora confermata: apri il link nel messaggio.')
  }

  return (
    <main className="pagina stretta">
      {utente.emailVerificata === false && (
        <section className="card avviso" role="status">
          <strong>Conferma la tua email.</strong> Ti abbiamo scritto a {utente.email}: apri il link nel messaggio. Senza, l’app non si
          attiva.
          <div className="azioni">
            <button type="button" className="btn ghost small" onClick={rimanda}>
              Invia di nuovo
            </button>
            <button type="button" className="btn ghost small" onClick={verificata}>
              Ho confermato
            </button>
          </div>
          {avviso && <p className="muted small">{avviso}</p>}
        </section>
      )}
      <section className="card">
        <h2>{cliente.nome_locale}</h2>
        <p className="muted small">
          Identificativo: <code>{cliente.slug}</code> · progetto <code>{progettoDi(cliente.slug)}</code>
        </p>
        <h3>Piano</h3>
        {piano ? (
          <p>
            <strong>{piano.nome}</strong> · {euro(prezzoMensile(cliente))} al mese
            {cliente.moduli?.length > 0 && (
              <span className="muted"> · moduli: {cliente.moduli.map((id) => MODULI.find((m) => m.id === id)?.nome || id).join(', ')}</span>
            )}
            {cliente.terminali > 1 && <span className="muted"> · {cliente.terminali} terminali</span>}
          </p>
        ) : (
          <p className="muted">Nessun piano ancora: scegline uno qui sotto.</p>
        )}
        {cliente.abbonamento?.stato && cliente.abbonamento.stato !== 'attivo' && (
          <p className="errore small">Abbonamento {cliente.abbonamento.stato}.</p>
        )}
        <h3>Istanza</h3>
        <p>
          <strong data-testid="stato-istanza">{statoDetto(stato)}</strong>
          {istanza?.aggiornata_il && <span className="muted small"> · {new Date(istanza.aggiornata_il).toLocaleString('it-IT')}</span>}
        </p>
        {stato === STATI.ATTIVA && (
          <p>
            L’app è su <a href={istanza?.url || urlDi(cliente.slug)}>{istanza?.url || urlDi(cliente.slug)}</a>. L’accesso
            admin è l’email di questo account: la password la imposti al primo accesso con «password dimenticata».
            {istanza?.versione && <span className="muted small"> Versione {istanza.versione}.</span>}
          </p>
        )}
        {stato === STATI.ERRORE && istanza?.errore && <p className="errore small">{istanza.errore}</p>}
        {(stato === STATI.DA_ATTIVARE || stato === STATI.ERRORE) && (
          <>
            <button className="btn" type="button" disabled={!via.ok} onClick={attiva}>
              Attiva l’istanza
            </button>
            {!via.ok && <p className="muted small">{via.perche}</p>}
          </>
        )}
        {errore && <p className="errore">{errore}</p>}
      </section>
      {/* Senza un abbonamento attivo si sceglie (o si rinnova) il piano. */}
      {cliente.abbonamento?.stato !== 'attivo' && <SceltaPiano cliente={cliente} />}
      {new URLSearchParams(window.location.search).get('pagamento') === 'ok' && (
        <p className="muted small">Pagamento ricevuto: l’abbonamento compare qui sopra appena Stripe ce lo conferma, di solito in pochi secondi.</p>
      )}
    </main>
  )
}
