import { useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog.jsx'
import {
  clearDatabase,
  resetWithMockData,
  createMockHistory,
  simulatePaymentResult,
  simulateReaderPayment,
} from '../dev/devActions.js'
import { subscribeOpenSerata, subscribeSerataOrders } from '../lib/api.js'

// Opzioni sviluppatore: visibili SOLO in ambiente emulatore (Docker locale
// o ambiente di test). Permettono di svuotare il db o resettarlo coi mock.
export default function DevTools() {
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState([])
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null) // { title, message, run }

  // Pagamenti da simulare: in dev non ci sono Cloud Functions, quindi
  // l'esito del checkout SumUp si "recita" da qui.
  const [serata, setSerata] = useState(null)
  const [pending, setPending] = useState([])
  useEffect(() => subscribeOpenSerata(setSerata, () => setSerata(null)), [])
  const [unpaid, setUnpaid] = useState([])
  useEffect(() => {
    if (!serata?.id) {
      setPending([])
      setUnpaid([])
      return
    }
    return subscribeSerataOrders(serata.id, (orders) => {
      setPending(orders.filter((o) => o.payment_status === 'in_attesa'))
      // Candidati alla simulazione del lettore: non pagati, in mano al
      // cliente (pronto/ritirato), senza pagamento già in corso.
      setUnpaid(
        orders.filter(
          (o) =>
            o.payment_status !== 'pagato' &&
            o.payment_status !== 'in_attesa' &&
            ['pronto', 'ritirato'].includes(o.status)
        )
      )
    })
  }, [serata?.id])

  function pushLog(msg) {
    setLog((l) => [...l, msg])
  }

  async function run(action) {
    setBusy(true)
    setError(null)
    setLog([])
    try {
      await action(pushLog)
      // Lo svuotamento del db lascia appesi i listener realtime della
      // pagina: ricarica per ripartire da uno stato pulito.
      pushLog('✓ Operazione completata. Ricarico la pagina…')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="banner">
        🛠 Strumenti di sviluppo — disponibili solo nell&apos;ambiente di test
        (emulatore). Le operazioni sono irreversibili sul database locale.
      </div>

      {error && <div className="banner">Errore: {error}</div>}

      <div className="card settings-section">
        <h3>Database</h3>
        <div className="toggle-row">
          <div>
            <div>Reset con dati mock</div>
            <div className="desc">
              Svuota tutto e ripopola: menù completo con immagini, inventario,
              impostazioni e una serata aperta con 12 ordini di esempio.
            </div>
          </div>
          <button
            className="btn small"
            disabled={busy}
            onClick={() =>
              setConfirm({
                title: '🔄 Reset con dati mock?',
                message:
                  'Tutti i dati attuali verranno cancellati e sostituiti con i dati di esempio.',
                run: () => run(resetWithMockData),
              })
            }
          >
            {busy ? '…' : 'Reset'}
          </button>
        </div>
        <div className="toggle-row">
          <div>
            <div>Genera storico serate</div>
            <div className="desc">
              Aggiunge 12 serate passate chiuse con ordini, incassi e tempi
              realistici: alimenta la sezione Statistiche.
            </div>
          </div>
          <button
            className="btn small"
            disabled={busy}
            onClick={() =>
              setConfirm({
                title: '📊 Generare lo storico?',
                message: 'Verranno aggiunte 12 serate chiuse con ordini mock (i dati esistenti restano).',
                run: () =>
                  run(async (progress) => {
                    const n = await createMockHistory(progress)
                    progress(`Storico creato: ${n} serate.`)
                  }),
              })
            }
          >
            Genera
          </button>
        </div>
        <div className="toggle-row">
          <div>
            <div>Svuota database</div>
            <div className="desc">
              Cancella tutti i dati (menù, inventario, ordini, serate,
              impostazioni). L&apos;utente bartender resta.
            </div>
          </div>
          <button
            className="btn ghost small"
            disabled={busy}
            onClick={() =>
              setConfirm({
                title: '🧹 Svuotare il database?',
                message: 'Tutti i dati verranno cancellati. Operazione irreversibile.',
                danger: true,
                run: () =>
                  run(async (progress) => {
                    progress('Svuoto il database…')
                    await clearDatabase()
                  }),
              })
            }
          >
            Svuota
          </button>
        </div>
      </div>

      <div className="card settings-section">
        <h3>Pagamenti (simulazione)</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          In dev non ci sono Cloud Functions: simula qui l&apos;esito del
          checkout SumUp per gli ordini in attesa.
        </p>
        {pending.length === 0 && (
          <div className="muted small">Nessun ordine con pagamento in attesa.</div>
        )}
        {pending.map((o) => (
          <div className="toggle-row" key={o.id}>
            <div>
              <div>#{o.daily_number} {o.customer_name || ''}</div>
              <div className="desc">
                {o.payment_method} · {o.status} · {o.payment_required ? 'obbligatorio' : 'opzionale'}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button
                className="btn small"
                onClick={() => simulatePaymentResult(o.id, true).catch((e) => setError(e.message))}
              >
                ✓ Pagato
              </button>
              <button
                className="btn ghost small"
                onClick={() => simulatePaymentResult(o.id, false).catch((e) => setError(e.message))}
              >
                ✗ Fallito
              </button>
            </div>
          </div>
        ))}

        {unpaid.length > 0 && (
          <>
            <p className="muted small" style={{ margin: '12px 0 4px' }}>
              📟 Simulazione lettore (ordini non pagati pronti/ritirati):
            </p>
            {unpaid.map((o) => (
              <div className="toggle-row" key={o.id}>
                <div>
                  <div>#{o.daily_number} {o.customer_name || ''}</div>
                  <div className="desc">{o.status}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn small"
                    onClick={() => simulateReaderPayment(o.id, true).catch((e) => setError(e.message))}
                  >
                    📟 ✓ Carta OK
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => simulateReaderPayment(o.id, false).catch((e) => setError(e.message))}
                  >
                    ✗ Rifiutata
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {log.length > 0 && (
        <div className="card">
          {log.map((l, i) => (
            <div key={i} className="muted small" style={{ padding: '2px 0' }}>
              {l}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Procedi"
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { run: fn } = confirm
            setConfirm(null)
            fn()
          }}
        />
      )}
    </div>
  )
}
