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
  raggruppaSerate,
  periodoDellaSerata,
  RAGGRUPPAMENTI,
  ETICHETTA_RAGGRUPPAMENTO,
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
//
// PER SERATA, PER SETTIMANA O PER MESE (22/08/2026): «aggiungi dei filtri
// alla lista delle chiusure cassa per mostrare quelle settimanali o mensili
// oltre che per data». La lista resta la stessa lista — cambia solo di cosa
// parla una riga. I conti li fa `raggruppaSerate` (`src/lib/serate.js`) sulle
// sessioni GIÀ in mano: qui dentro si disegna e basta.

const CHIAVE_RAGGRUPPAMENTO = 'tana:chiusure:raggruppamento'

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
  // COME SI GUARDA LA LISTA: una riga per serata, per settimana o per mese.
  // Sta sopra la lista e non in Impostazioni — la regola «come si guarda una
  // pagina non è navigazione» (docs/navigazione.md) manda là le viste della
  // coda perché si scelgono una volta e non si toccano più; questa si cambia
  // mentre si guarda («com'è andato agosto? e questa settimana?»), come i
  // filtri della coda. La scelta si ricorda, e vale per questo terminale.
  const [raggruppamento, setRaggruppamento] = useState(() => {
    try {
      const salvato = localStorage.getItem(CHIAVE_RAGGRUPPAMENTO)
      return RAGGRUPPAMENTI.includes(salvato) ? salvato : 'serata'
    } catch {
      return 'serata'
    }
  })
  // Un periodo alla volta, come il dettaglio di una serata: aperti tutti, la
  // lista tornerebbe l'elenco piatto da cui si è usciti.
  const [periodoAperto, setPeriodoAperto] = useState(null)
  const righe = useRef(new Map())

  function cambiaRaggruppamento(r) {
    setRaggruppamento(r)
    try {
      localStorage.setItem(CHIAVE_RAGGRUPPAMENTO, r)
    } catch {
      /* niente memoria: la scelta vale per questa sessione */
    }
  }

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
  const serataTrovata = useMemo(
    () => (giornoCercato ? serataDelGiorno(sessions, giornoCercato) : null),
    [sessions, giornoCercato]
  )
  const trovata = serataTrovata?.id || null

  // LE RIGHE AGGREGATE, quando si guarda per settimana o per mese. Escono
  // dalle stesse sessioni che la lista sta già disegnando: nessuna lettura in
  // più fra il tocco sul gettone e la lista nuova.
  const periodi = useMemo(
    () => raggruppaSerate(sessions, { raggruppamento }),
    [sessions, raggruppamento]
  )

  // Cambiando raggruppamento si riparte chiusi: la serata che era aperta può
  // essere finita dentro un periodo, e un dettaglio aperto dentro una riga
  // che nel frattempo è diventata un'altra cosa non si capisce più di chi è.
  useEffect(() => {
    setOpenId(null)
    setPeriodoAperto(null)
  }, [raggruppamento])

  // LA RICERCA NON CAMBIA IL RAGGRUPPAMENTO: apre il periodo che contiene
  // quella serata e accende la riga della serata, sempre — con le serate in
  // fila non c'è niente da aprire, ed è il comportamento di prima. Cambiare
  // raggruppamento da soli vorrebbe dire buttare via la vista che si era
  // scelta al primo giorno cercato; così invece si risponde a tutt'e due le
  // domande insieme, «com'è andata quella sera» e «in che settimana era».
  const chiaveTrovata =
    serataTrovata && raggruppamento !== 'serata'
      ? periodoDellaSerata(serataTrovata, raggruppamento)
      : null
  useEffect(() => {
    if (chiaveTrovata) setPeriodoAperto(chiaveTrovata)
  }, [chiaveTrovata])

  // In che periodo è finita: serve alla frase sopra l'elenco, che deve dire
  // dove guardare quando la riga della serata è dentro una riga aggregata.
  const periodoTrovato = chiaveTrovata
    ? periodi.find((g) => g.chiave === chiaveTrovata)
    : null
  const dove =
    !periodoTrovato
      ? 'nell’elenco'
      : raggruppamento === 'settimana'
        ? `nella settimana ${periodoTrovato.etichetta}`
        : `in ${periodoTrovato.etichetta}`
  const esito = !giornoCercato
    ? ''
    : trovata
      ? `Serata di ${businessDayLabel(giornoCercato)}: evidenziata ${dove}.`
      : `Nessuna chiusura di cassa registrata per ${businessDayLabel(giornoCercato)}.`

  // Trovata la serata, la si porta sotto gli occhi: la riga può stare a due
  // mesi di scorrimento da qui, e accenderla senza mostrarla non servirebbe a
  // niente. Dipende anche dal periodo aperto perché dentro una riga aggregata
  // la riga della serata nasce solo quando il periodo si apre, un disegno
  // dopo. `scrollIntoView` è chiamato in modo opzionale perché il DOM finto
  // dei test non ce l'ha.
  useEffect(() => {
    if (!trovata) return
    righe.current.get(trovata)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [trovata, periodoAperto])

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

  // LA RIGA DI UNA SERATA È SEMPRE LA STESSA RIGA, che stia in fila o dentro
  // una settimana aperta: stesse classi, stesso dettaglio che scende sotto,
  // stesso rendiconto. Una riga aggregata non porta a un dettaglio nuovo da
  // imparare — porta alle serate che si conoscono già.
  const rigaSerata = (s) => {
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
          {/* COME SI SCEGLIE IL RAGGRUPPAMENTO: i gettoni che il progetto usa
              già per i filtri della coda, attaccati in un gruppo solo perché
              sono una domanda sola con tre risposte (`.chip-gruppo`). Stanno
              nella riga della ricerca, che esiste comunque: a lista aperta non
              costano una riga a nessuno, e questa pagina esiste per la lista.
              Non una tendina — con tre voci bisognerebbe aprirla per sapere
              cosa c'è dentro (docs/navigazione.md). */}
          <div className="chip-gruppo" role="group" aria-label="Raggruppa le chiusure">
            {RAGGRUPPAMENTI.map((r) => (
              <button
                key={r}
                type="button"
                className={`chip${raggruppamento === r ? ' active' : ''}`}
                aria-pressed={raggruppamento === r}
                onClick={() => cambiaRaggruppamento(r)}
              >
                {ETICHETTA_RAGGRUPPAMENTO[r]}
              </button>
            ))}
          </div>
          <div className="cerca-serata-data">
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
      {sessions.length > 0 && raggruppamento === 'serata' && (
        <div className="inv-list">{sessions.map(rigaSerata)}</div>
      )}

      {/* PER SETTIMANA O PER MESE: una riga per periodo, e dentro le serate
          che contiene. La riga dice il periodo, quante serate e quanto ha
          incassato in tutto; il terzo numero è la MEDIA A SERATA, ed è
          quello con cui due settimane si confrontano davvero — una settimana
          di cinque aperture e una di tre fanno totali diversi per un motivo
          che non c'entra con com'è andata la sera. Stesso mestiere dei tre
          numeri della riga per serata (incasso = conti × scontrino medio),
          un piano più su: incasso = serate × media. */}
      {sessions.length > 0 && raggruppamento !== 'serata' && (
        <div className="inv-list">
          {periodi.map((g) => {
            const isOpen = periodoAperto === g.chiave
            return (
              <div className={`inv-row${g.inCorso ? ' in-corso' : ''}${isOpen ? ' open' : ''}`} key={g.chiave}>
                <button
                  type="button"
                  className="inv-row-main"
                  onClick={() => setPeriodoAperto(isOpen ? null : g.chiave)}
                  aria-expanded={isOpen}
                >
                  <span className="inv-row-name">{g.etichetta}</span>
                  <span className="muted small inv-row-cat">
                    {g.nSerate} serat{g.nSerate === 1 ? 'a' : 'e'}
                  </span>
                  {/* La pastiglia dice perché il totale non è ancora quello
                      definitivo: dentro c'è la serata di stasera, e il suo
                      incasso si saprà alla chiusura. */}
                  {g.inCorso && <span className="pill live small">in corso</span>}
                  <span className="muted small inv-row-price">{formatPrice(g.media)} a serata</span>
                  <span className="inv-cell-num price cash-sess-incasso">{formatPrice(g.incasso)}</span>
                </button>

                {/* SI APRE SULLE SUE SERE. Una settimana si spiega con le
                    serate che contiene, e sono le righe che si conoscono già:
                    da lì si arriva al riepilogo di cassa e al rendiconto per
                    la strada di sempre, invece che a un dettaglio nuovo. */}
                {isOpen && (
                  <div className="inv-row-dettaglio">
                    <div className="inv-list inv-sotto-lista">{g.serate.map(rigaSerata)}</div>
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
