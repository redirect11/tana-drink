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

export default function CorsieStato({
  corsie,
  idAcceso = null,
  onApri,
  onAvanza,
  onIncassa,
  onScarta,
  inArrivo = [],
  attesaPagamento = () => false,
}) {
  // Un solo «adesso» per tutta la vista: card diverse non devono dire tempi
  // diversi solo perché sono state disegnate a un secondo di distanza.
  const adesso = Date.now()

  return (
    <div className="corsie">
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
                      <div className="small corsia-righe">
                        {(o.order_items || []).map((i) => (
                          <div key={i.id ?? `${i.drink_id}-${i.name}`}>
                            {i.qty}× {i.name}
                          </div>
                        ))}
                      </div>
                    )}
                    {o.note && <div className="order-note small corsia-nota">{o.note}</div>}
                    {azione && (
                      <button
                        className="btn small block corsia-azione"
                        disabled={attesa}
                        title={attesa ? 'In attesa del pagamento: non si prepara' : undefined}
                        onClick={(e) => {
                          // Il tasto non è la card: toccando il tasto si fa
                          // quello che c'è scritto, non si apre il conto.
                          e.stopPropagation()
                          if (azione.tipo === 'avanza') onAvanza?.(o)
                          else onIncassa?.(o)
                        }}
                      >
                        {azione.etichetta}
                      </button>
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
