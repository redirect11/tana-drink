import { formatPrice } from '../lib/orderStatus.js'
import { orderTotal, paidAmount } from '../lib/pagamento.js'
import { AZIONI_CORSIA, daQuanto, destinazioneConto } from '../lib/coda.js'
import OrderBy from './OrderBy.jsx'
import RigheCorsia from './RigheCorsia.jsx'

// ── LA VISTA «CORSIE DI STATO» ───────────────────────────────────────
//
// Una colonna per passo del lavoro e UN tasto per card: quello che porta
// l'ordine al passo dopo. Chi guarda questa schermata ha in mano uno
// shaker e non ha tempo di leggere: la colonna dice cosa c'è da fare, la
// card dice per chi, il tasto lo fa.
//
// Le corsie e i loro conti arrivano già fatti da lib/coda.js: qui non si
// decide niente su cosa sta dove, si disegna soltanto.

const quantiDrink = (o) => (o.order_items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)

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
        const azione = AZIONI_CORSIA[corsia.id] || null
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
                    <div className="muted small corsia-dove">{destinazioneConto(p.order || {})}</div>
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
                    }${o.payment_status === 'parziale' ? ' acconto' : ''}${
                      o.id === idAcceso ? ' conto-acceso' : ''
                    }`}
                    key={o.id}
                    id={`ordine-${o.id}`}
                    onClick={() => onApri?.(o)}
                  >
                    <div className="row between">
                      <span className="corsia-num">
                        #{o.daily_number ?? '—'} <OrderBy order={o} />
                      </span>
                      {/* ACCONTO: qualcosa è già stato incassato, ma il conto
                          non è chiuso. Senza dirlo qui, chi porta il conto al
                          tavolo chiede l'intero — ed è successo. */}
                      {o.payment_status === 'parziale' && (
                        <span
                          className="pill acconto small"
                          title={`Già incassati ${formatPrice(paidAmount(o))}`}
                        >
                          💳 Acconto
                        </span>
                      )}
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
                      {destinazioneConto(o)}
                      {soloCifra && ` · ${quantiDrink(o)} drink`}
                    </div>
                    {soloCifra ? (
                      <div className="bignum corsia-cifra">{formatPrice(orderTotal(o))}</div>
                    ) : (
                      <RigheCorsia
                        items={o.order_items}
                        aperto={espansa === o.id}
                        onApri={() => onEspandi?.(espansa === o.id ? null : o.id)}
                      />
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
                      // Le azioni sono quelle della coda, disegnate qui: una
                      // regola sola, in un posto solo. L'avanzamento no —
                      // «Segna come Ritirato/Servito» e il tasto grande della
                      // corsia sono la STESSA cosa scritta due volte, a un
                      // dito di distanza. Qui comanda il tasto della corsia.
                      <div className="corsia-azioni-aperte" onClick={(e) => e.stopPropagation()}>
                        {azioni(o, { senzaAvanzamento: !!azione })}
                      </div>
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
