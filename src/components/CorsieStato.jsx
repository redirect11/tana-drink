import { formatPrice } from '../lib/orderStatus.js'
import { orderTotal } from '../lib/pagamento.js'
import { daQuanto } from '../lib/coda.js'
import OrderBy from './OrderBy.jsx'

// ── LA VISTA «CORSIE DI STATO» ───────────────────────────────────────
//
// Una colonna per passo del lavoro e UN tasto per card: quello che porta
// l'ordine al passo dopo. Chi guarda questa schermata ha in mano uno
// shaker e non ha tempo di leggere: la colonna dice cosa c'è da fare, la
// card dice per chi, il tasto lo fa.
//
// Le corsie e i loro conti arrivano già fatti da lib/coda.js: qui non si
// decide niente su cosa sta dove, si disegna soltanto.

// Cosa fa il tasto, corsia per corsia. Le corsie senza voce qui — «Chiusi»
// e «Annullati», che compaiono solo a stati di servizio spenti — non hanno
// tasto: su un conto già chiuso non c'è niente da far avanzare.
const AZIONI = {
  'da-fare': { etichetta: 'Lo preparo io', tipo: 'avanza' },
  'al-banco': { etichetta: 'È pronto', tipo: 'avanza' },
  'al-ritiro': { etichetta: 'Consegnato', tipo: 'avanza' },
  'da-incassare': { etichetta: 'Incassa', tipo: 'incassa' },
  // Stati di servizio spenti: l'unica cosa che resta da fare a un conto in
  // corso è incassarlo, come sulla griglia.
  attivi: { etichetta: 'Incassa', tipo: 'incassa' },
}

// Dove va il drink e per chi: «Tavolo 4», «Bancone · Giulia». È la riga che
// serve a riconoscere il conto quando si urla un numero da dietro il banco.
function destinazione(o) {
  const dove = o.table_label
    ? `Tavolo ${o.table_label}`
    : o.service_mode === 'banco'
      ? 'Bancone'
      : ''
  return [dove, o.customer_name].filter(Boolean).join(' · ')
}

const quantiDrink = (o) => (o.order_items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)

// Quante righe si vedono senza chiedere. Sei: è quello che ci sta in una
// card senza far scomparire le corsie accanto, ed è anche più di quanto ha
// un conto normale — chi ne ha venti è l'eccezione, e la apre.
const RIGHE_A_VISTA = 6

// Da qui in su il conto si legge meglio su DUE colonne: dieci righe in fila
// fanno una card lunga il doppio delle altre, e la colonna dello stato si
// svuota di sotto. Sotto le dieci no — due colonnine da tre righe sono
// peggio di una lista. Lo spazio ce l'ha solo uno schermo largo: il CSS
// tiene la seconda colonna solo dove ci sta (vedi .corsia-righe-due).

export default function CorsieStato({
  corsie,
  idAcceso = null,
  onApri,
  onAvanza,
  onIncassa,
  onScarta,
  inArrivo = [],
  attesaPagamento = () => false,
  // TUTTO IL RESTO CHE SI FA SU UN CONTO — incassare in contanti, stampare
  // la comanda, annullare — sta dietro un «⋯ Azioni» come nelle altre
  // viste. Il tasto grande resta uno, quello che porta avanti il lavoro;
  // ma chi incassa al volo non deve cambiare vista per farlo.
  azioni = null,
  aperta = null,
  onApriAzioni,
  // Quale card mostra TUTTE le righe: una alla volta, come per le azioni.
  espansa = null,
  onEspandi,
}) {
  // Un solo «adesso» per tutta la vista: card diverse non devono dire tempi
  // diversi solo perché sono state disegnate a un secondo di distanza.
  const adesso = Date.now()

  return (
    // QUANTE COLONNE QUANTE SONO LE CORSIE. Erano quattro fisse: con gli
    // stati di servizio spenti le corsie diventano tre e restavano
    // schiacciate a sinistra, con un quarto di schermo vuoto a destra.
    <div className="corsie" style={{ '--corsie-n': corsie.length }}>
      {corsie.map((corsia) => {
        const azione = AZIONI[corsia.id] || null
        // «Da incassare» non mostra i drink ma la cifra: lì la domanda è una
        // sola — quanto devo chiedere — e leggerla in mezzo alle righe
        // dell'ordine, col cliente davanti, è un secondo perso ogni volta.
        const soloCifra = corsia.id === 'da-incassare'
        const prima = corsie[0]?.id === corsia.id
        return (
          <section className="corsia" key={corsia.id}>
            <div className={`row between corsia-testa corsia-${corsia.id}`}>
              <span className="corsia-titolo">
                {corsia.titolo} <span className="muted small">{corsia.ordini.length}</span>
              </span>
              <span className="price small">{formatPrice(corsia.totale)}</span>
            </div>
            {/* Corsia vuota: intestazione a zero e basta. Una scritta di
                riempimento in ognuna delle quattro colonne è rumore che
                copre quelle piene. */}
            <div className="corsia-lista">
              {/* CONTI APPENA BATTUTI, ancora in volo verso il server: stanno
                  in cima alla prima corsia perché è lì che nascono. Senza,
                  chi batte un conto al POS torna in coda e non lo vede — e
                  lo ribatte. */}
              {prima &&
                inArrivo.map((p) => (
                  <article className="card order-card corsia-card in-arrivo" key={p.tempId}>
                    <div className="row between">
                      <span className="corsia-num">#{p.order?.daily_number ?? '…'}</span>
                      <span className="muted small">
                        {p.state === 'error' ? 'non inviato' : 'in invio…'}
                      </span>
                    </div>
                    <div className="muted small corsia-dove">{destinazione(p.order || {})}</div>
                    {p.state === 'error' && (
                      <>
                        <div className="small corsia-righe">{p.error}</div>
                        <button
                          className="btn small block corsia-azione"
                          onClick={() => onScarta?.(p.tempId)}
                        >
                          Rimuovi
                        </button>
                      </>
                    )}
                  </article>
                ))}
              {corsia.ordini.map((o) => {
                const attesa = azione?.tipo === 'avanza' && attesaPagamento(o)
                return (
                  <article
                    className={`card order-card corsia-card ${o.workflow_status}${
                      o.pagatoDaServire ? ' pagato-da-servire' : ''
                    }${o.id === idAcceso ? ' conto-acceso' : ''}`}
                    key={o.id}
                    id={`ordine-${o.id}`}
                    onClick={() => onApri?.(o)}
                  >
                    <div className="row between">
                      <span className="corsia-num">
                        #{o.daily_number ?? '—'} <OrderBy order={o} />
                      </span>
                      {/* Già pagato ma ancora da consegnare: al posto del
                          tempo il bollo, perché è quello che cambia il gesto
                          (si consegna e si chiude, non si incassa). */}
                      {o.pagatoDaServire ? (
                        <span className="pill pagato small">Pagato</span>
                      ) : (
                        <span className="muted small">{daQuanto(o.created_at, adesso)}</span>
                      )}
                    </div>
                    <div className="muted small corsia-dove">
                      {destinazione(o)}
                      {soloCifra && ` · ${quantiDrink(o)} drink`}
                    </div>
                    {soloCifra ? (
                      <div className="bignum corsia-cifra">{formatPrice(orderTotal(o))}</div>
                    ) : (
                      <div className="corsia-righe-box">
                      <div
                        className={`small corsia-righe${
                          (o.order_items || []).length > RIGHE_A_VISTA && espansa !== o.id
                            ? ' corsia-righe-sfuma'
                            : ''
                        }${(o.order_items || []).length >= 10 ? ' corsia-righe-due' : ''}`}
                      >
                        {(espansa === o.id
                          ? o.order_items || []
                          : (o.order_items || []).slice(0, RIGHE_A_VISTA)
                        ).map((i, idx) => (
                          <div key={i.id ?? `${i.drink_id}-${i.name}-${idx}`} className="corsia-riga">
                            <span className="corsia-riga-nome">
                              {i.qty}× {i.name}
                            </span>
                            {/* IL PREZZO DELLA RIGA: chi guarda la card sta
                                spesso rispondendo a «quanto viene?», e
                                doveva aprire il conto per saperlo. */}
                            <span className="corsia-riga-prezzo">
                              {formatPrice((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}
                            </span>
                            {/* La nota della RIGA — «senza ghiaccio» — è
                                quella che cambia come si prepara: sta
                                attaccata alla riga, non in fondo al conto. */}
                            {i.note && <span className="corsia-riga-nota">{i.note}</span>}
                          </div>
                        ))}
                        {/* UN CONTO LUNGO NON DEVE MANGIARSI LA COLONNA. Con
                            venti righe la card diventava una pagina, e le
                            altre corsie sparivano sotto: si vedono le prime,
                            e chi vuole il resto lo chiede. */}
                      </div>
                      {/* IL TASTO NON SFUMA. Stava dentro il blocco velato e
                          si sbiadiva insieme al testo: proprio la cosa da
                          leggere. E aperto spariva — non c'era modo di
                          richiudere la card. Adesso è fratello dell'elenco:
                          sopra la sfumatura quando è chiuso, in fondo alle
                          righe quando è aperto. */}
                      {(o.order_items || []).length > RIGHE_A_VISTA && (
                        <button
                          className={`corsia-piu${espansa === o.id ? ' aperto' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEspandi?.(espansa === o.id ? null : o.id)
                          }}
                          aria-expanded={espansa === o.id}
                        >
                          {espansa === o.id
                            ? '▴ mostra meno'
                            : `▾ altre ${(o.order_items || []).length - RIGHE_A_VISTA}`}
                        </button>
                      )}
                      </div>
                    )}
                    {o.note && <div className="order-note small corsia-nota">{o.note}</div>}
                    {/* IL PIEDE DELLA CARD, IN UNA RIGA SOLA. «⋯ Azioni» e
                        il tasto che porta avanti il lavoro erano due blocchi
                        larghi tutta la card, uno sotto l'altro: due righe di
                        altezza per ogni conto, moltiplicate per una colonna
                        intera. */}
                    {(azioni || azione) && (
                      <div className="corsia-piede">
                        {azioni && (
                          <button
                            className="btn ghost small corsia-azioni"
                            onClick={(e) => {
                              e.stopPropagation()
                              onApriAzioni?.(aperta === o.id ? null : o.id)
                            }}
                            aria-expanded={aperta === o.id}
                          >
                            {aperta === o.id ? '▴ Chiudi' : '⋯ Azioni'}
                          </button>
                        )}
                        {azione && (
                          <button
                            className="btn small corsia-azione"
                            disabled={attesa}
                            title={attesa ? 'In attesa del pagamento: non si prepara' : undefined}
                            onClick={(e) => {
                              // Il tasto non è la card: toccandolo si fa
                              // quello che c'è scritto, non si apre il conto.
                              e.stopPropagation()
                              if (azione.tipo === 'avanza') onAvanza?.(o)
                              else onIncassa?.(o)
                            }}
                          >
                            {azione.etichetta}
                          </button>
                        )}
                      </div>
                    )}
                    {azioni && aperta === o.id && (
                      // Le azioni sono quelle della coda, disegnate qui:
                      // una regola sola, in un posto solo.
                      <div onClick={(e) => e.stopPropagation()}>{azioni(o)}</div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
