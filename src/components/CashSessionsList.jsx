import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchCashSessions,
  fetchOrdersBetween,
  fetchDrinks,
  fetchInventoryItems,
} from '../lib/api.js'
import { sessionReport } from '../lib/stats.js'
import { cashRecap } from '../lib/cassa.js'
import { businessDayKey, businessDayLabel } from '../lib/businessDay.js'
import {
  giornoSerata,
  oraSerata,
  durataSerata,
  serataDelGiorno,
  limitiRicercaSerate,
} from '../lib/serate.js'
import { formatPrice, cashMethodKeys, paymentMethodLabel } from '../lib/orderStatus.js'
import { printChiusuraCassa } from '../lib/printer.js'
import { toastSuccess, toastError } from '../lib/toast.js'
import RendicontoSerata from './RendicontoSerata.jsx'

// STORICO DELLE CHIUSURE DI CASSA: una riga per serata, dall'apertura alla
// chiusura. Aprendo una riga il riepilogo (incassi per metodo, sconti, contante
// atteso) viene RICALCOLATO dagli ordini di quella finestra, non riletto dallo
// snapshot congelato alla chiusura. Si vede anche COSA è stato venduto in
// quella finestra — comprese le ore dopo la mezzanotte, perché il periodo è
// quello della sessione e non della giornata solare.
//
// NIENTE RIQUADRO ATTORNO (22/08/2026): «togli il box, lascia solo la lista».
// La `.card` qui non separava questa lista da nient'altro — è l'unica cosa
// della sottosezione — e su una schermata fatta di righe si mangiava margine
// a sinistra e a destra. Via anche il titolo «📒 Chiusure di cassa»: il
// titolo di una pagina sta nella barra in alto, che quando si è qui dice già
// «Chiusure» (`src/lib/sezioni.js`), e ripeterlo dieci pixel più sotto costa
// una riga per non aggiungere niente. Via la didascalia «Una riga per
// serata…»: descriveva quello che la riga ha già scritto sopra. Resta la
// lista, com'è nelle statistiche (`StatsTab.jsx` → «📒 Per serata», che il
// riquadro non l'ha mai avuto): sono lo stesso elenco e devono leggersi
// allo stesso modo.

export default function CashSessionsList() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [report, setReport] = useState(null) // { id, dati } della serata aperta
  const [caricando, setCaricando] = useState(false)
  // Serata aperta a tutta pagina nel rendiconto tabellare.
  const [rendiconto, setRendiconto] = useState(null)
  // Ricerca per data. Si tiene SOLO la data cercata: la serata e la frase da
  // leggere si ricavano da lì a ogni disegno, così non ci sono tre stati da
  // tenere d'accordo fra loro.
  const [giornoCercato, setGiornoCercato] = useState('')
  const righe = useRef(new Map())

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

  // I bordi del campo data escono dalle sessioni già in mano: nessuna lettura
  // in più per sapere fin dove ha senso cercare.
  const limiti = useMemo(() => limitiRicercaSerate(sessions), [sessions])

  // CERCARE UNA SERATA PORTA ALLA RIGA, NON FILTRA LA LISTA. Filtrando
  // resterebbe una riga sola, e questa lista serve anche a confrontare le
  // serate fra loro: si cerca il 15 agosto per vedere com'è andata, e subito
  // dopo si guarda il sabato prima. Qui la lista resta intera, si scorre fino
  // alla serata cercata e la riga si accende — e non serve nemmeno un modo
  // per «togliere il filtro», perché non c'è niente di nascosto.
  const trovata = useMemo(
    () => (giornoCercato ? serataDelGiorno(sessions, giornoCercato)?.id || null : null),
    [sessions, giornoCercato]
  )
  const esito = !giornoCercato
    ? ''
    : trovata
      ? `Serata di ${businessDayLabel(giornoCercato)}: evidenziata nell’elenco.`
      : `Nessuna chiusura di cassa registrata per ${businessDayLabel(giornoCercato)}.`

  // Trovata la serata, la si porta sotto gli occhi: la riga può stare a due
  // mesi di scorrimento da qui, e accenderla senza mostrarla non servirebbe a
  // niente. `scrollIntoView` è chiamato in modo opzionale perché il DOM finto
  // dei test non ce l'ha.
  useEffect(() => {
    if (!trovata) return
    righe.current.get(trovata)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [trovata])

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
      // L'inventario serve per il COSTO delle ricette (e quindi il guadagno):
      // se non si riesce a leggerlo il rendiconto mostra comunque i ricavi.
      const [ordini, drinks, items] = await Promise.all([
        fetchOrdersBetween(dal, al),
        fetchDrinks({}).catch(() => []),
        fetchInventoryItems().catch(() => []),
      ])
      const drinksById = Object.fromEntries(drinks.map((d) => [d.id, d]))
      const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
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
        drinksById,
        itemsById,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setCaricando(false)
    }
  }

  // Il rendiconto si prende tutta la schermata: è una tabella da leggere, non
  // un riquadro dentro una lista.
  if (rendiconto) {
    return (
      <RendicontoSerata
        session={rendiconto.session}
        orders={rendiconto.conti}
        drinksById={rendiconto.drinksById}
        itemsById={rendiconto.itemsById}
        recap={rendiconto.recap}
        onClose={() => setRendiconto(null)}
      />
    )
  }

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}
      {loading && <p className="muted small">Carico le chiusure…</p>}
      {!loading && sessions.length === 0 && (
        <p className="muted small">Nessuna sessione di cassa registrata.</p>
      )}

      {/* IL CAMPO DATA STA IN CIMA, sopra la lista: è il modo di arrivare a
          una serata lontana, e va visto prima di mettersi a scorrere. Il
          `min` e il `max` sono la prima e l'ultima serata in elenco — dentro
          quei bordi la ricerca ha sempre una risposta sensata, e una data
          futura non si può nemmeno scegliere. */}
      {!loading && sessions.length > 0 && (
        <div className="cerca-serata">
          <label className="muted small" htmlFor="cerca-serata-data">
            Cerca per data
          </label>
          <input
            id="cerca-serata-data"
            type="date"
            value={giornoCercato}
            min={limiti.dal || undefined}
            max={limiti.al || undefined}
            onChange={(e) => setGiornoCercato(e.target.value)}
          />
        </div>
      )}
      {/* L'ESITO SI LEGGE, non si deduce dal colore di una riga. Quando la
          serata c'è dice quale; quando non c'è lo dice invece di lasciare la
          lista ferma e muta, che si leggerebbe come «non ha funzionato».
          `role="status"` perché niente scompare e niente si sposta: senza,
          chi usa un lettore di schermo non saprebbe che è successo qualcosa. */}
      {esito && (
        <p className="muted small cerca-serata-esito" role="status">
          {esito}
        </p>
      )}

      {/* UNA SOLA FAMIGLIA DI LISTE in tutta l'app (`.inv-list` e parenti,
          vedi DESIGN.md): stesso riquadro, stessa riga toccabile alta
          `--riga-lista`, stesso dettaglio che si apre sotto la riga. Prima
          ogni serata era una card a sé con dentro una riga bassa, e lo
          stesso elenco si leggeva in tre modi diversi in tre pagine. */}
      {sessions.length > 0 && (
        <div className="inv-list">
          {sessions.map((s) => {
            const salvato = s.snapshot || {}
            const aperta = s.status === 'open'
            const isOpen = openId === s.id
            // Ricalcolato quando la riga è aperta; finché carica, quello salvato.
            const snap = (isOpen && report?.id === s.id && report.recap) || salvato
            // L'INCASSO DI UNA SERATA ANCORA APERTA non si sa finché non si
            // apre la riga: lo snapshot nasce alla chiusura. Prima al suo
            // posto usciva «0,00 €», che in una lista di soldi si legge come
            // «stasera non è entrato niente» — ed è una bugia.
            const incasso =
              snap.incassato != null ? formatPrice(snap.incassato) : aperta ? '—' : formatPrice(0)
            return (
              <div
                className={`inv-row${aperta ? ' in-corso' : ''}${isOpen ? ' open' : ''}${
                  trovata === s.id ? ' trovata' : ''
                }`}
                key={s.id}
                ref={(el) => {
                  if (el) righe.current.set(s.id, el)
                  else righe.current.delete(s.id)
                }}
              >
                <button
                  type="button"
                  className="inv-row-main"
                  onClick={() => apri(s)}
                  aria-expanded={isOpen}
                >
                  <span className="inv-row-name">{giornoSerata(s.opened_at)}</span>
                  <span className="muted small inv-row-cat">
                    {oraSerata(s.opened_at)} → {aperta ? '…' : oraSerata(s.closed_at)}
                    {!aperta && ` · ${durataSerata(s.opened_at, s.closed_at)}`}
                  </span>
                  {/* LA SERATA IN CORSO si riconosce senza leggere: la
                      pastiglia verde al posto dell'ora di chiusura, e la
                      striscia accesa a sinistra della riga. Sono due segni,
                      non uno: il colore da solo non basta (DESIGN.md). */}
                  {aperta && <span className="pill live small">in corso</span>}
                  <span className="inv-cell-num price cash-sess-incasso">{incasso}</span>
                </button>

                {isOpen && (
                  <div className="inv-row-dettaglio">
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

                    {/* Il dettaglio (prodotti, conti, guadagno) sta nel
                        rendiconto: qui resta il colpo d'occhio sulla cassa. */}
                    {caricando && <p className="muted small" style={{ marginTop: 8 }}>Carico la serata…</p>}
                    {report?.id === s.id && report.dati && (
                      <div style={{ marginTop: 10 }}>
                        <div className="row between">
                          <span className="muted small">
                            Venduto della serata · {report.dati.nOrdini} cont
                            {report.dati.nOrdini === 1 ? 'o' : 'i'}
                          </span>
                          <strong>{formatPrice(report.dati.totale)}</strong>
                        </div>
                        <button
                          className="btn block"
                          style={{ marginTop: 10 }}
                          onClick={() =>
                            setRendiconto({
                              session: s,
                              conti: report.conti,
                              drinksById: report.drinksById,
                              itemsById: report.itemsById,
                              recap: report.recap,
                            })
                          }
                        >
                          📊 Apri il rendiconto — conti, prodotti e guadagno
                        </button>
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
      )}
    </div>
  )
}
