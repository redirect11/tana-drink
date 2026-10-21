import { useEffect, useState } from 'react'
import { elencoClienti, elencoIstanze, elencoRichieste, segnaPiano, rilanciaAttivazione } from '../lib/db.js'
import { statoIstanza, statoDetto, STATI, progettoDi } from '../lib/istanze.js'
import { PIANI, prezzoMensile, euro } from '../lib/piani.js'

// IL BACKOFFICE (REQ-FLOTTA-005): tutti i clienti con piano, stato
// dell'istanza, progetto, versione; le richieste in coda o in errore in
// cima. Solo col claim admin (App.jsx non ci fa arrivare gli altri, e le
// regole Firestore non gli darebbero comunque i dati).
export default function Backoffice() {
  const [righe, setRighe] = useState(undefined)
  const [errore, setErrore] = useState(null)

  const carica = async () => {
    try {
      const [clienti, istanze, richieste] = await Promise.all([elencoClienti(), elencoIstanze(), elencoRichieste()])
      setRighe(
        clienti
          .map((c) => ({ cliente: c, istanza: istanze[c.slug] || null, richiesta: richieste[c.slug] || null }))
          .map((r) => ({ ...r, stato: statoIstanza(r.istanza, r.richiesta) }))
          .sort((a, b) => peso(a.stato) - peso(b.stato))
      )
    } catch (e) {
      setErrore(e.message)
      setRighe([])
    }
  }
  useEffect(() => {
    carica()
  }, [])

  const pianoAMano = async (c) => {
    const piano = window.prompt('Piano (base | completo):', c.piano || 'base')
    if (!piano || !PIANI[piano]) return
    await segnaPiano(c.uid, { piano, moduli: c.moduli || [], terminali: c.terminali || 1 })
    carica()
  }

  if (righe === undefined) return <main className="pagina muted">Carico…</main>

  return (
    <main className="pagina">
      <h2>Backoffice</h2>
      {errore && <p className="errore">{errore}</p>}
      {righe.length === 0 ? (
        <p className="muted">Nessun cliente.</p>
      ) : (
        <table className="clienti">
          <thead>
            <tr>
              <th>Locale</th>
              <th>Email</th>
              <th>Piano</th>
              <th>Istanza</th>
              <th>Progetto</th>
              <th>Versione</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {righe.map(({ cliente: c, istanza, stato }) => (
              <tr key={c.uid} className={stato === STATI.ERRORE ? 'errore-riga' : ''}>
                <td>
                  <strong>{c.nome_locale}</strong>
                  <div className="muted small">{c.slug}</div>
                </td>
                <td>{c.email}</td>
                <td>{c.piano ? `${PIANI[c.piano]?.nome || c.piano} · ${euro(prezzoMensile(c))}` : <span className="muted">—</span>}</td>
                <td>{statoDetto(stato)}</td>
                <td>
                  <code>{istanza?.progetto || progettoDi(c.slug)}</code>
                </td>
                <td>{istanza?.versione || <span className="muted">—</span>}</td>
                <td className="azioni-riga">
                  <button type="button" className="btn ghost small" onClick={() => pianoAMano(c)}>
                    Piano a mano
                  </button>
                  {stato === STATI.ERRORE && (
                    <button type="button" className="btn ghost small" onClick={() => rilanciaAttivazione(c.slug).then(carica)}>
                      Rilancia
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

// In cima quello che chiede attenzione.
const PESI = { [STATI.ERRORE]: 0, [STATI.IN_CODA]: 1, [STATI.IN_CORSO]: 2, [STATI.DA_ATTIVARE]: 3, [STATI.ATTIVA]: 4 }
const peso = (s) => PESI[s] ?? 9
