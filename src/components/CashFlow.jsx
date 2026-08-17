import { useEffect, useMemo, useState } from 'react'
import {
  subscribeActiveOrders,
  subscribeOpenCashSession,
  openCashSession,
  closeCashSession,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { auth } from '../lib/firebaseClient.js'
import { cashRecap } from '../lib/cassa.js'
import { formatPrice, cashMethodKeys, paymentMethodLabel } from '../lib/orderStatus.js'
import { printChiusuraCassa } from '../lib/printer.js'
import { toastError } from '../lib/toast.js'

// FLUSSO CASSA: apertura/chiusura della serata e andamento in tempo reale
// degli incassi della sessione aperta. I numeri vengono dagli ordini nella
// finestra [apertura → adesso], così includono anche contanti e acconti.

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
const durata = (fromIso, toIso) => {
  const a = Date.parse(fromIso)
  const b = Date.parse(toIso)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return ''
  const min = Math.floor((b - a) / 60000)
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`
}

export default function CashFlow() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [session, setSession] = useState(null)
  const [orders, setOrders] = useState([])
  const [now, setNow] = useState(() => new Date().toISOString())
  const cutoff = settings.business_day_cutoff_hour

  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  useEffect(() => subscribeOpenCashSession(setSession, () => {}), [])
  // Anche i conti CHIUSI IN QUESTA CASSA: un tavolo aperto ieri e incassato
  // stasera è incasso di stasera, e senza questo non entrava nel rendiconto
  // (le altre due letture guardano i conti aperti e quelli nati oggi).
  useEffect(
    () =>
      subscribeActiveOrders(setOrders, () => {}, {
        cutoffHour: cutoff,
        cashSessionId: session?.id ?? null,
      }),
    [cutoff, session?.id]
  )
  // Tick per aggiornare durata e finestra "fino ad ora".
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 60000)
    return () => clearInterval(t)
  }, [])

  const recap = useMemo(() => cashRecap(orders, session, now), [orders, session, now])
  const by = { email: auth.currentUser?.email ?? null }

  if (!session) {
    return (
      <>
        <ApriCassa cutoff={cutoff} by={by} />
      {/* Lista ordini e chiusure sono SOTTOSEZIONI della cassa (menu
          laterale): erano due tasti in fondo alla pagina, che si trovano
          solo scorrendo fino in fondo. */}
      </>
    )
  }

  return (
    // A COLONNA SOLA CI STA UN TELEFONO, non un monitor. Su schermi larghi
    // le stesse tessere si dispongono in griglia — quello che serve a chi
    // guarda la cassa si legge in un colpo, senza scorrere — e le due che
    // vogliono spazio (l'andamento per ora e la chiusura) restano larghe
    // tutta la riga. Il CSS sta in .cassa-flusso: qui non si decide niente.
    <div className="cassa-flusso">
      <div className="card cassa-open">
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <strong>🟢 Cassa aperta</strong>
            <div className="muted small">
              dalle {fmtTime(session.opened_at)} · da {durata(session.opened_at, now)}
              {session.fondo_cassa > 0 && ` · fondo ${formatPrice(session.fondo_cassa)}`}
            </div>
          </div>
        </div>
      </div>

      {/* Incassato della serata + metodi */}
      <div className="card row between" style={{ alignItems: 'center' }}>
        <div>
          <strong>💶 Incassato serata</strong>
          <div className="muted small">{recap.nPagati} conti chiusi</div>
        </div>
        <strong className="price" style={{ fontSize: '1.4rem' }}>{formatPrice(recap.incassato)}</strong>
      </div>
      {/* Un chip per ogni metodo BATTUTO, anche uno mai visto prima: l'elenco
          si costruisce dagli incassi, non da una lista scritta a mano. */}
      {cashMethodKeys(recap.byMethod).some((k) => recap.byMethod[k] > 0) && (
        <div className="chips-row" style={{ marginBottom: 8 }}>
          {cashMethodKeys(recap.byMethod)
            .filter((k) => recap.byMethod[k] > 0)
            .map((k) => (
              <span className="chip" key={k}>
                {paymentMethodLabel(k)} {formatPrice(recap.byMethod[k])}
              </span>
            ))}
        </div>
      )}

      {/* QUANTO DEVE ESSERCI IN CASSA ADESSO. Il conto lo si faceva solo alla
          chiusura, quando ormai è un verdetto: durante la serata serve per
          controllare il cassetto quando si cambia turno, o quando due numeri
          non tornano e si vuole capirlo subito. */}
      <div className="card row between" style={{ alignItems: 'center' }}>
        <div>
          <strong>💰 In cassa adesso</strong>
          <div className="muted small">
            fondo {formatPrice(recap.fondo)} + contanti {formatPrice(recap.byMethod.banco || 0)}
          </div>
        </div>
        <strong className="price">{formatPrice(recap.contanteAtteso)}</strong>
      </div>

      {/* COM'È ANDATA L'ULTIMA ORA. La curva racconta la serata; questo dice
          come sta andando adesso — se vale la pena aprire un'altra cassa o
          mandare qualcuno in pausa. */}
      {recap.nUltimaOra > 0 && (
        <div className="card row between" style={{ alignItems: 'center' }}>
          <span className="muted">
            ⏱ Nell'ultima ora · {recap.nUltimaOra} incass{recap.nUltimaOra === 1 ? 'o' : 'i'}
          </span>
          <strong>{formatPrice(recap.ultimaOra)}</strong>
        </div>
      )}

      {/* IL CONTO MEDIO, e quanto lascia una persona: in un cocktail bar il
          secondo dice più del primo, perché un tavolo da sei e uno da due
          fanno due serate diverse con lo stesso «conto medio». */}
      {recap.contoMedio != null && (
        <div className="card row between" style={{ alignItems: 'center' }}>
          <div>
            <strong>🧾 Conto medio</strong>
            <div className="muted small">
              {recap.nPagati} cont{recap.nPagati === 1 ? 'o' : 'i'} chius{recap.nPagati === 1 ? 'o' : 'i'}
              {recap.coperti > 0 && ` · ${recap.coperti} copert${recap.coperti === 1 ? 'o' : 'i'}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong className="price">{formatPrice(recap.contoMedio)}</strong>
            {recap.perCoperto != null && (
              <div className="muted small">{formatPrice(recap.perCoperto)} a testa</div>
            )}
          </div>
        </div>
      )}

      {/* CHI HA INCASSATO. Se il contante non torna è la prima domanda che ci
          si fa; e a fine turno ognuno sa cosa ha battuto. Una persona sola
          alla cassa non ha bisogno di leggerlo. */}
      {recap.perChi.length > 1 && (
        <div className="card">
          <strong>👤 Chi ha incassato</strong>
          {recap.perChi.map((r) => (
            <div className="row between" key={r.chi} style={{ marginTop: 4 }}>
              <span className="muted">
                {r.chi} · {r.n} incass{r.n === 1 ? 'o' : 'i'}
              </span>
              <strong>{formatPrice(r.importo)}</strong>
            </div>
          ))}
        </div>
      )}

      {recap.apertoDaIncassare > 0 && (
        <div className="card row between" style={{ alignItems: 'center' }}>
          <span className="muted">🟡 Ancora da incassare · {recap.nAperti} conti aperti</span>
          <strong>{formatPrice(recap.apertoDaIncassare)}</strong>
        </div>
      )}

      {/* Andamento per ora */}
      {recap.perOra.length > 0 && (
        <div className="cassa-larga">
          <OraBars perOra={recap.perOra} />
        </div>
      )}

      <div className="cassa-larga">
        <ChiudiCassa session={session} recap={recap} by={by} />
      </div>

    </div>
  )
}

// Apertura cassa con fondo opzionale.
function ApriCassa({ cutoff, by }) {
  const [fondo, setFondo] = useState('')
  const [busy, setBusy] = useState(false)
  const num = (v) => Number(String(v).replace(',', '.')) || 0
  async function apri() {
    setBusy(true)
    try {
      await openCashSession({ by, fondo: num(fondo), cutoffHour: cutoff })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <strong>Cassa chiusa</strong>
      <p className="muted small" style={{ margin: '6px 0 10px' }}>
        Apri la cassa a inizio serata: da qui vedrai in tempo reale l’andamento
        degli incassi fino alla chiusura.
      </p>
      <label htmlFor="fondo" style={{ display: 'block', marginBottom: 4 }}>Fondo cassa iniziale (€) — opzionale</label>
      <input id="fondo" type="number" step="0.5" min="0" value={fondo} onChange={(e) => setFondo(e.target.value)} placeholder="Es. 50" style={{ maxWidth: 160 }} />
      <button className="btn block" style={{ marginTop: 10 }} onClick={apri} disabled={busy}>
        🟢 Apri cassa
      </button>
    </div>
  )
}

// Chiusura cassa: mostra il riepilogo, contante atteso ed eventuale conteggio.
function ChiudiCassa({ session, recap, by }) {
  const [counted, setCounted] = useState('')
  const [busy, setBusy] = useState(false)
  const diff =
    counted === '' ? null : Math.round((Number(String(counted).replace(',', '.')) - recap.contanteAtteso) * 100) / 100
  // La cassa NON si può chiudere se ci sono ordini non pagati: conta solo il
  // pagamento, a prescindere dallo stato di preparazione/servizio.
  const bloccato = recap.nAperti > 0

  async function chiudi() {
    if (bloccato || busy) return
    setBusy(true)
    try {
      await closeCashSession(session.id, { by, snapshot: recap, countedCash: counted === '' ? null : counted })
      // Scontrino di chiusura: contante, carte, sconti e totale, da allegare
      // al fondo. Se la stampante non risponde la cassa resta comunque chiusa.
      printChiusuraCassa(recap, session, { by: by?.email, countedCash: counted }).catch((e) =>
        toastError(`Chiusura non stampata: ${e.message}`)
      )
    } finally {
      setBusy(false)
    }
  }

  // Nessuna conferma: si può chiudere solo se tutti i conti sono già pagati
  // (altrimenti è bloccata), quindi la chiusura è un'azione diretta.
  return (
    <div className="card" style={{ marginTop: 12, border: '1px solid var(--line)' }}>
      <strong>🔴 Chiusura cassa</strong>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="muted small">Incassato serata</span>
        <strong>{formatPrice(recap.incassato)}</strong>
      </div>
      <div className="row between">
        <span className="muted small">di cui contanti</span>
        <span>{formatPrice(recap.byMethod.banco)}</span>
      </div>
      {recap.sconti > 0 && (
        <div className="row between">
          <span className="muted small">Sconti concessi (già dedotti)</span>
          <span className="muted">−{formatPrice(recap.sconti)}</span>
        </div>
      )}
      <div className="row between" style={{ borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 6 }}>
        <span className="muted small">Contante atteso in cassa (fondo {formatPrice(recap.fondo)} + contanti)</span>
        <strong>{formatPrice(recap.contanteAtteso)}</strong>
      </div>
      {bloccato ? (
        <div className="banner" style={{ marginTop: 8 }}>
          ⛔ Non puoi chiudere la cassa: ci sono <strong>{recap.nAperti} conti non pagati</strong>
          {' '}({formatPrice(recap.apertoDaIncassare)} da incassare). Incassali prima di chiudere.
        </div>
      ) : (
        <>
          <label htmlFor="counted" style={{ display: 'block', marginTop: 8 }}>Contante contato (€) — opzionale</label>
          <input id="counted" type="number" step="0.5" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={String(recap.contanteAtteso)} style={{ maxWidth: 160 }} />
          {diff != null && (
            <div className="small" style={{ marginTop: 4 }}>
              Differenza: <strong className={diff < 0 ? 'neg' : ''}>{diff > 0 ? '+' : ''}{formatPrice(diff)}</strong>
            </div>
          )}
        </>
      )}
      <button className="btn danger block" style={{ marginTop: 10 }} onClick={chiudi} disabled={busy || bloccato}>
        🔴 Chiudi cassa
      </button>
    </div>
  )
}

// Barre dell'andamento incassi per ora.
function OraBars({ perOra }) {
  const max = Math.max(...perOra.map((x) => x.importo), 1)
  return (
    <div className="card">
      <strong className="small">📈 Andamento per ora</strong>
      <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
        {perOra.map((x) => (
          <div key={x.ora} className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted small" style={{ width: 34 }}>{x.ora}:00</span>
            <div style={{ flex: 1, background: 'var(--line)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
              <div style={{ width: `${(x.importo / max) * 100}%`, background: 'var(--accent-2, #f5b94a)', height: '100%' }} />
            </div>
            <span className="small" style={{ width: 64, textAlign: 'right' }}>{formatPrice(x.importo)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
