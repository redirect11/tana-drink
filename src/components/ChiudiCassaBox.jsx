import { useEffect, useState } from 'react'
import {
  closeCashSession,
  subscribeActiveOrders,
  subscribeOpenCashSession,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { cashRecap } from '../lib/cassa.js'
import { printChiusuraCassa } from '../lib/printer.js'
import { stampaNelPiano } from '../lib/limiti.js'
import { formatPrice } from '../lib/orderStatus.js'
import { toastError, toastSuccess } from '../lib/toast.js'
import Icona from './Icona.jsx'
import { tr, useLingua } from '../lib/lingua.js'

// ── CHIUDERE LA CASSA, DA DOVE CI SI TROVA ───────────────────────────
//
// A fine serata la cassa si chiude e basta. Il tasto nel menu della coda
// portava alla pagina della cassa: un viaggio di andata e ritorno per
// premere un tasto, con la coda che sparisce proprio mentre si sta
// finendo il servizio.
//
// Qui c'è quello che serve per decidere: quanto è entrato, quanto deve
// esserci in cassa, e il contante contato — facoltativo, perché non tutti
// lo contano subito. Confermando, la cassa si chiude. Punto.
//
// Con conti ancora aperti non si chiude: un conto aperto è un incasso che
// manca, e far quadrare una serata con dentro un buco non si può.
export default function ChiudiCassaBox({ by, onClose }) {
  useLingua()
  const [session, setSession] = useState(null)
  const [orders, setOrders] = useState([])
  const [cutoff, setCutoff] = useState(DEFAULT_SETTINGS.business_day_cutoff_hour)
  const [counted, setCounted] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeOpenCashSession(setSession, () => {}), [])
  useEffect(
    () => subscribeSettings((s) => setCutoff(s.business_day_cutoff_hour), () => {}),
    []
  )
  useEffect(
    () =>
      subscribeActiveOrders(setOrders, () => {}, {
        cutoffHour: cutoff,
        cashSessionId: session?.id ?? null,
      }),
    [cutoff, session?.id]
  )

  const recap = cashRecap(orders, session, new Date().toISOString())
  if (!session || !recap) return null
  const bloccato = recap.nAperti > 0
  const diff =
    counted === ''
      ? null
      : Math.round((Number(String(counted).replace(',', '.')) - recap.contanteAtteso) * 100) / 100

  const chiudi = () => {
    if (bloccato || busy) return
    setBusy(true)
    // La chiusura è local-first come tutto il resto: si scrive e si chiude il
    // box. Lo scontrino di chiusura parte per conto suo — se la stampante non
    // risponde, la cassa resta comunque chiusa.
    closeCashSession(session.id, {
      by,
      snapshot: recap,
      countedCash: counted === '' ? null : counted,
    })
    // Nel piano senza stampa la cassa si chiude e basta (REQ-LIC-016).
    if (stampaNelPiano()) {
      printChiusuraCassa(recap, session, { by: by?.email, countedCash: counted }).catch((e) =>
        toastError(tr('Chiusura non stampata: {errore}', { errore: e.message }))
      )
    }
    toastSuccess(tr('Cassa chiusa.'))
    onClose()
  }

  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}><Icona nome="rosso" gruppo="tasti" /> {tr('Chiudere la cassa?')}</h3>
        <div className="row between">
          <span className="muted small">{tr('Incassato serata')}</span>
          <strong>{formatPrice(recap.incassato)}</strong>
        </div>
        <div className="row between">
          <span className="muted small">{tr('di cui contanti')}</span>
          <span>{formatPrice(recap.byMethod.banco || 0)}</span>
        </div>
        <div
          className="row between"
          style={{ borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 6 }}
        >
          <span className="muted small">
            {tr('Contante atteso (fondo {fondo} + contanti)', { fondo: formatPrice(recap.fondo) })}
          </span>
          <strong>{formatPrice(recap.contanteAtteso)}</strong>
        </div>

        {/* CHIUSI IMPAGATI (REQ-CASSA-016): non bloccano la chiusura, ma i
            soldi mancano e va detto quanto. */}
        {recap.nImpagati > 0 && (
          <div className="muted small" style={{ marginTop: 10 }}>
            <Icona nome="orario" gruppo="tasti" />{' '}
            {recap.nImpagati === 1
              ? tr('1 conto chiuso impagato: {importo} da riscuotere.', { importo: formatPrice(recap.impagatoDaRiscuotere) })
              : tr('{n} conti chiusi impagati: {importo} da riscuotere.', {
                  n: recap.nImpagati,
                  importo: formatPrice(recap.impagatoDaRiscuotere),
                })}
          </div>
        )}

        {bloccato ? (
          <div className="banner" style={{ marginTop: 10 }}>
            <Icona nome="fermo" gruppo="segnali" />{' '}
            {tr('Ci sono {n} conti non pagati ({importo} da incassare). Incassali prima di chiudere.', {
              n: recap.nAperti,
              importo: formatPrice(recap.apertoDaIncassare),
            })}
          </div>
        ) : (
          <>
            <label htmlFor="contato-cassa" style={{ marginTop: 10, display: 'block' }}>
              {tr("Contante contato (€) — se l'hai contato")}
            </label>
            <input
              id="contato-cassa"
              type="number"
              step="0.5"
              min="0"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              placeholder={String(recap.contanteAtteso)}
            />
            {diff != null && (
              <p className={`small${diff === 0 ? ' muted' : ''}`} style={{ margin: '4px 0 0' }}>
                {diff === 0
                  ? <><Icona nome="fatto" gruppo="segnali" /> {tr('Il conto torna.')}</>
                  : diff > 0
                    ? tr("In cassa ci sono {importo} in più dell'atteso.", { importo: formatPrice(diff) })
                    : tr("Mancano {importo} rispetto all'atteso.", { importo: formatPrice(Math.abs(diff)) })}
              </p>
            )}
          </>
        )}

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {tr('Annulla')}
          </button>
          <button type="button" className="btn" onClick={chiudi} disabled={busy || bloccato}>
            {tr('Chiudi cassa')}
          </button>
        </div>
      </div>
    </div>
  )
}
