import { useEffect, useState } from 'react'
import { fetchCashSessions, fetchOrdersBetween, fetchDrinks } from '../lib/api.js'
import { sessionReport } from '../lib/stats.js'
import { cashRecap } from '../lib/cassa.js'
import { businessDayKey } from '../lib/businessDay.js'
import { formatPrice, cashMethodKeys, paymentMethodLabel } from '../lib/orderStatus.js'
import { printChiusuraCassa } from '../lib/printer.js'
import { toastSuccess, toastError } from '../lib/toast.js'

// STORICO DELLE CHIUSURE DI CASSA: una riga per serata, dall'apertura alla
// chiusura. Aprendo una riga il riepilogo (incassi per metodo, sconti, contante
// atteso) viene RICALCOLATO dagli ordini di quella finestra, non riletto dallo
// snapshot congelato alla chiusura. Si vede anche COSA è stato venduto in
// quella finestra — comprese le ore dopo la mezzanotte, perché il periodo è
// quello della sessione e non della giornata solare.

const fmtData = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return '—'
  }
}
const fmtOra = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}
// Come e' stato pagato: piu' metodi se il conto e' stato diviso.
const metodiDi = (o) => {
  const metodi = [...new Set((o.payments || []).map((p) => p.method).filter(Boolean))]
  if (!metodi.length && o.payment_method) metodi.push(o.payment_method)
  return metodi.map(paymentMethodLabel).join(' + ')
}

const durata = (a, b) => {
  const t1 = Date.parse(a)
  const t2 = Date.parse(b)
  if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 < t1) return ''
  const min = Math.floor((t2 - t1) / 60000)
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`
}

export default function CashSessionsList() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [report, setReport] = useState(null) // { id, dati } della serata aperta
  const [caricando, setCaricando] = useState(false)

  useEffect(() => {
    let vivo = true
    fetchCashSessions({ limit: 60 })
      .then((list) => vivo && setSessions(list))
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setLoading(false))
    return () => {
      vivo = false
    }
  }, [])

  // Venduto della serata: si caricano gli ordini della finestra solo quando
  // si apre la riga (sono letture, non servono a colpo d'occhio).
  async function apri(s) {
    if (openId === s.id) {
      setOpenId(null)
      return
    }
    setOpenId(s.id)
    setReport(null)
    setCaricando(true)
    try {
      const dal = businessDayKey(s.opened_at)
      const al = businessDayKey(s.closed_at || new Date().toISOString())
      const [ordini, drinks] = await Promise.all([
        fetchOrdersBetween(dal, al),
        fetchDrinks({}).catch(() => []),
      ])
      const drinksById = Object.fromEntries(drinks.map((d) => [d.id, d]))
      // Il riepilogo si RICALCOLA dagli ordini, non si legge dallo snapshot
      // salvato alla chiusura: le serate chiuse con una versione vecchia
      // avevano le carte di credito finite nel secchio dei contanti, e il
      // dato buono (payments[].method) è sempre rimasto sull'ordine.
      const dentro = ordini
        .filter((o) => {
          const t = o.paid_at || o.created_at
          return !!t && t >= s.opened_at && (!s.closed_at || t <= s.closed_at)
        })
        .sort((a, b) => String(b.paid_at || b.created_at).localeCompare(a.paid_at || a.created_at))
      setReport({
        id: s.id,
        dati: sessionReport(ordini, s, drinksById),
        recap: cashRecap(ordini, s, s.closed_at || new Date().toISOString()),
        conti: dentro,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setCaricando(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <strong>📒 Chiusure di cassa</strong>
      <div className="muted small" style={{ margin: '2px 0 8px' }}>
        Una riga per serata, dall’apertura alla chiusura. Tocca per il venduto.
      </div>

      {error && <div className="banner">Errore: {error}</div>}
      {loading && <p className="muted small">Carico le chiusure…</p>}
      {!loading && sessions.length === 0 && (
        <p className="muted small">Nessuna sessione di cassa registrata.</p>
      )}

      {sessions.map((s) => {
        const salvato = s.snapshot || {}
        const aperta = s.status === 'open'
        const isOpen = openId === s.id
        // Ricalcolato quando la riga è aperta; finché carica, quello salvato.
        const snap = (isOpen && report?.id === s.id && report.recap) || salvato
        return (
          <div className="card" key={s.id} style={{ margin: '8px 0 0', padding: 10 }}>
            <button
              type="button"
              className="cash-sess-head"
              onClick={() => apri(s)}
              aria-expanded={isOpen}
            >
              <span className="grow">
                <strong>{fmtData(s.opened_at)}</strong>{' '}
                <span className="muted small">
                  {fmtOra(s.opened_at)} → {aperta ? 'in corso' : fmtOra(s.closed_at)}
                  {!aperta && ` · ${durata(s.opened_at, s.closed_at)}`}
                </span>
              </span>
              <strong className="price">{formatPrice(snap.incassato ?? 0)}</strong>
            </button>

            {isOpen && (
              <div style={{ marginTop: 8 }}>
                {/* Incassi per metodo, ricalcolati dagli ordini della serata.
                    Le righe vengono dai metodi davvero battuti: se domani si
                    incassa con un metodo nuovo, compare da solo. */}
                {cashMethodKeys(snap.byMethod).map((k) => (
                  <div className="row between muted small" key={k}>
                    <span>{paymentMethodLabel(k)}</span>
                    <span>{formatPrice(snap.byMethod?.[k] ?? 0)}</span>
                  </div>
                ))}
                {/* Sempre in elenco, anche a zero: "quanto ho lasciato sul
                    tavolo stasera" è una domanda che si fa ogni sera. */}
                <div className="row between muted small">
                  <span>🎁 Sconti concessi</span>
                  <span>{(snap.sconti ?? 0) > 0 ? `−${formatPrice(snap.sconti)}` : formatPrice(0)}</span>
                </div>
                <div className="row between muted small">
                  <span>Conti chiusi</span>
                  <span>{snap.nPagati ?? 0}</span>
                </div>
                {s.counted_cash != null && (
                  <div className="row between muted small">
                    <span>Contante contato</span>
                    <span>
                      {formatPrice(s.counted_cash)}
                      {s.difference != null && s.difference !== 0 && (
                        <> ({s.difference > 0 ? '+' : ''}{formatPrice(s.difference)})</>
                      )}
                    </span>
                  </div>
                )}

                {/* Venduto della serata */}
                {caricando && <p className="muted small" style={{ marginTop: 8 }}>Carico il venduto…</p>}
                {report?.id === s.id && report.dati && (
                  <div style={{ marginTop: 10 }}>
                    <div className="row between">
                      <span className="muted small">
                        Venduto della serata · {report.dati.nOrdini} cont
                        {report.dati.nOrdini === 1 ? 'o' : 'i'}
                      </span>
                      <strong>{formatPrice(report.dati.totale)}</strong>
                    </div>
                    {report.dati.categorie.length > 0 && (
                      <div className="chips-row" style={{ margin: '6px 0' }}>
                        {report.dati.categorie.map((c) => (
                          <span className="chip" key={c.name}>
                            {c.name} · {c.qty} · {formatPrice(c.revenue)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="fascia-prodotti">
                      {report.dati.prodotti.map((pr) => (
                        <div className="row between fascia-riga" key={pr.name}>
                          <span className="grow">{pr.qty}× {pr.name}</span>
                          <span className="muted">{formatPrice(pr.revenue)}</span>
                        </div>
                      ))}
                    </div>
                    {/* COME viene ripartito lo sconto: la domanda se la fa
                        chiunque legga "9× Bjorne 35,24" invece di 36,00. */}
                    <p className="muted small" style={{ margin: '8px 0 0' }}>
                      ℹ️ Gli importi sono il <strong>venduto reale</strong>, non il listino.
                      Lo sconto è un importo sul conto e viene ripartito{' '}
                      <strong>in proporzione al prezzo</strong> di ogni riga: su un conto da
                      10&nbsp;€ con 1&nbsp;€ di sconto ogni prodotto vale il 10% in meno
                      (una birra da 4&nbsp;€ conta 3,60, un cocktail da 6&nbsp;€ conta 5,40).
                    </p>

                    {/* Lista dei conti della serata: dal totale ai singoli
                        scontrini, senza uscire dalla chiusura. */}
                    <div className="row between" style={{ marginTop: 12 }}>
                      <span className="muted small">Conti della serata</span>
                      <span className="muted small">{report.conti.length}</span>
                    </div>
                    <div className="fascia-prodotti">
                      {report.conti.map((o) => (
                        <div className="row between fascia-riga" key={o.id}>
                          <span className="grow">
                            <strong>#{o.daily_number ?? '—'}</strong>{' '}
                            {o.customer_name || o.table || ''}{' '}
                            <span className="muted">{fmtOra(o.paid_at || o.created_at)}</span>
                            {Number(o.discount_amount) > 0 && (
                              <span className="muted"> · sconto −{formatPrice(o.discount_amount)}</span>
                            )}
                          </span>
                          <span className="muted">{metodiDi(o)}</span>
                          <strong>
                            {formatPrice(
                              (Number(o.total) || 0) - (Number(o.discount_amount) || 0)
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!aperta && (
                  <button
                    className="btn ghost small block"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      printChiusuraCassa(snap, s, {
                        by: s.closed_by?.email,
                        countedCash: s.counted_cash,
                      })
                        .then(() => toastSuccess('Chiusura ristampata'))
                        .catch((e) => toastError(`Stampa: ${e.message}`))
                    }
                  >
                    🖨 Ristampa chiusura
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
