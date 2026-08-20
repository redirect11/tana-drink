import { useEffect, useState } from 'react'
import { stampanteFintaAttiva, forzaStampanteFinta } from '../lib/stampanteFinta.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import {
  clearDatabase,
  resetWithMockData,
  createMockHistory,
  simulatePaymentResult,
  simulateReaderPayment,
  isDevEnvironment,
} from '../dev/devActions.js'
import { subscribeActiveOrders } from '../lib/api.js'
import { runImport } from '../dev/importExcel.js'

// Opzioni sviluppatore: visibili SOLO in ambiente emulatore (Docker locale
// o ambiente di test). Permettono di svuotare il db o resettarlo coi mock.
export default function DevTools() {
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState([])
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null) // { title, message, run }
  // La stampante finta com'è ADESSO su questo terminale (ambiente o forzatura).
  const [fintaAccesa, setFintaAccesa] = useState(() => stampanteFintaAttiva())

  // Pagamenti da simulare: in dev non ci sono Cloud Functions, quindi
  // l'esito del checkout SumUp si "recita" da qui.
  const [pending, setPending] = useState([])
  const [unpaid, setUnpaid] = useState([])
  useEffect(() => {
    return subscribeActiveOrders((orders) => {
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
  }, [])

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
        🛠 Strumenti di sviluppo — visibili solo in ambiente di sviluppo
        (emulatore locale) e di test, mai in produzione.
      </div>

      {error && <div className="banner">Errore: {error}</div>}

      {/* LA STAMPANTE FINTA SUL SITO DI TEST. In locale è accesa da sé;
          qui l'ambiente è quello vero e senza la Epson ogni prova di
          stampa fallirebbe in silenzio. L'interruttore è DEL TERMINALE
          (localStorage): chi prova da casa accende, il tablet del banco
          non ne sa niente. */}
      <div className="card settings-section">
        <strong>🖨 Stampante simulata</strong>
        <p className="muted small" style={{ margin: '4px 0 8px' }}>
          Le stampe escono come facsimile a schermo invece che sulla
          stampante vera. Vale solo per questo dispositivo.
        </p>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={fintaAccesa}
            onChange={(e) => {
              forzaStampanteFinta(e.target.checked ? true : null)
              setFintaAccesa(stampanteFintaAttiva())
            }}
          />
          <span>Simula la stampa su questo dispositivo</span>
        </label>
      </div>

      {/* Azioni distruttive sul database: solo emulatore locale (usano un
          endpoint che sul progetto reale di test non esiste). */}
      {isDevEnvironment && (
      <div className="card settings-section">
        <h3>Database</h3>
        <div className="toggle-row">
          <div>
            <div>Reset con dati mock</div>
            <div className="desc">
              Svuota tutto e ripopola: menù completo con immagini, inventario,
              impostazioni e 12 ordini di esempio di oggi.
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
            <div>Genera storico giornate</div>
            <div className="desc">
              Aggiunge 12 giornate passate con ordini, incassi e tempi
              realistici: alimenta la sezione Statistiche.
            </div>
          </div>
          <button
            className="btn small"
            disabled={busy}
            onClick={() =>
              setConfirm({
                title: '📊 Generare lo storico?',
                message: 'Verranno aggiunte 12 giornate passate con ordini mock (i dati esistenti restano).',
                run: () =>
                  run(async (progress) => {
                    const n = await createMockHistory(progress)
                    progress(`Storico creato: ${n} giornate.`)
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
              Cancella tutti i dati (menù, inventario, ordini,
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
      )}

      <div className="card settings-section">
        <h3>📥 Import storico da Excel (JSON)</h3>
        <p className="muted small">
          Carica il file <code>import-tana.json</code> (estratto dagli Excel:
          fornitori, scadenzario, catalogo inventario, ore staff). Idempotente:
          ciò che esiste già viene saltato, si può rilanciare.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setBusy(true)
            setError(null)
            try {
              const data = JSON.parse(await file.text())
              await runImport(data, (msg) => setLog((l) => [...l.slice(-30), msg]))
            } catch (err) {
              setError(err.message)
            } finally {
              setBusy(false)
            }
          }}
        />

        <h3 style={{ marginTop: 18 }}>Pagamenti (simulazione)</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Simula qui l&apos;esito del pagamento SumUp per gli ordini in
          attesa (utile finché SumUp non è configurato con le credenziali
          sandbox).
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
