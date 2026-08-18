import { formatPrice } from '../lib/orderStatus.js'
import { AZIONI_CORSIA, daQuanto, destinazioneConto } from '../lib/coda.js'
import RigheCorsia from './RigheCorsia.jsx'

// ── LE CORSIE DEL BANCO: UNA CARD PER COMANDA ────────────────────────
//
// La stessa lavagna a colonne, ma dentro non ci sono i conti: ci sono le
// COMANDE. Chi sta allo shaker non prepara un conto, prepara un ticket per
// volta — e un conto con tre comande in tre passi diversi, disegnato come
// una card sola, dice una cosa sbagliata comunque la si metta.
//
// La card porta il numero del conto E quello della comanda («#41 · comanda
// 2»), perché è così che si chiama un ordine da dietro il banco, e il tasto
// fa avanzare QUELLA comanda: le altre del conto restano dove sono.
//
// Le corsie e cosa ci sta dentro arrivano già fatte da lib/coda.js
// (corsieComande): qui non si decide niente, si disegna soltanto.

const quantiDrink = (items) => (items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)

export default function CorsieComande({
  corsie,
  idAcceso = null,
  onApri,
  onAvanza,
  onIncassa,
  onScarta,
  inArrivo = [],
  attesaPagamento = () => false,
  espansa = null,
  onEspandi,
}) {
  // Un solo «adesso» per tutta la vista: card diverse non devono dire tempi
  // diversi solo perché sono state disegnate a un secondo di distanza.
  const adesso = Date.now()

  return (
    <div className="corsie" style={{ '--corsie-n': corsie.length }}>
      {corsie.map((corsia) => {
        const azione = AZIONI_CORSIA[corsia.id] || null
        // «Da incassare» è l'unica colonna che non parla di lavoro: lì la
        // domanda è una sola — quanto devo chiedere — e la card torna a
        // essere il conto intero, con la cifra al posto delle righe.
        const soloCifra = corsia.id === 'da-incassare'
        const prima = corsie[0]?.id === corsia.id
        return (
          <section className="corsia" key={corsia.id}>
            <div className={`row between corsia-testa corsia-${corsia.id}`}>
              <span className="corsia-titolo">
                {corsia.titolo} <span className="muted small">{corsia.schede.length}</span>
              </span>
              <span className="price small">{formatPrice(corsia.totale)}</span>
            </div>
            <div className="corsia-lista">
              {/* CONTI APPENA BATTUTI, ancora in volo verso il server: le
                  comande non ci sono ancora — le fa il server — ma il conto
                  sì, e sta in cima alla prima corsia perché è lì che nasce.
                  Senza, chi batte un conto al POS torna in coda, non lo
                  vede e lo ribatte. */}
              {prima &&
                inArrivo.map((p) => (
                  <article className="card order-card corsia-card in-arrivo" key={p.tempId}>
                    <div className="row between">
                      <span className="corsia-num">
                        <span className="corsia-conto">#{p.order?.daily_number ?? '…'}</span>
                      </span>
                      <span className="muted small">
                        {p.state === 'error' ? 'non inviato' : 'in invio…'}
                      </span>
                    </div>
                    <div className="muted small corsia-dove">
                      {destinazioneConto(p.order || {})}
                    </div>
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
              {corsia.schede.map((s) => {
                const o = s.ordine
                const attesa = azione?.tipo === 'avanza' && attesaPagamento(o)
                return (
                  <article
                    className={`card order-card corsia-card ${s.comanda?.status || o.workflow_status}${
                      s.pagatoDaServire ? ' pagato-da-servire' : ''
                    }${o.id === idAcceso ? ' conto-acceso' : ''}`}
                    key={s.id}
                    id={`comanda-${s.id}`}
                    onClick={() => onApri?.(o)}
                  >
                    <div className="row between">
                      <span className="corsia-num">
                        <span className="corsia-conto">#{s.numero ?? '—'}</span>
                        {/* IL NUMERO DELLA COMANDA sta accanto a quello del
                            conto, non al suo posto: due comande dello stesso
                            tavolo sono due card, e senza il secondo numero
                            sembrerebbero la stessa cosa mostrata due volte. */}
                        {s.seq != null && (
                          <span className="corsia-comanda"> · comanda {s.seq}</span>
                        )}
                      </span>
                      {s.pagatoDaServire ? (
                        <span className="pill pagato small">Pagato</span>
                      ) : (
                        <span className="muted small">
                          {daQuanto(s.comanda?.created_at || o.created_at, adesso)}
                        </span>
                      )}
                    </div>
                    <div className="muted small corsia-dove">
                      {destinazioneConto(o)}
                      {/* Nella colonna dei soldi le righe non si vedono: al
                          loro posto quanti drink sono, che è quello che serve
                          per riconoscere il tavolo mentre si legge la cifra. */}
                      {soloCifra && ` · ${quantiDrink(s.items)} drink`}
                    </div>
                    {soloCifra ? (
                      <div className="bignum corsia-cifra">{formatPrice(s.totale)}</div>
                    ) : (
                      <RigheCorsia
                        items={s.items}
                        aperto={espansa === s.id}
                        onApri={() => onEspandi?.(espansa === s.id ? null : s.id)}
                      />
                    )}
                    {/* La nota del CONTO — «tavolo di fuori», «allergia alle
                        noci» — vale per tutte le sue comande: si porta dietro
                        anche il pezzo diviso, o chi prepara la seconda metà
                        non la legge. */}
                    {o.note && <div className="order-note small corsia-nota">{o.note}</div>}
                    {azione && (
                      <div className="corsia-piede">
                        <button
                          className="btn small corsia-azione"
                          disabled={attesa}
                          title={attesa ? 'In attesa del pagamento: non si prepara' : undefined}
                          onClick={(e) => {
                            // Il tasto non è la card: toccandolo si fa quello
                            // che c'è scritto, non si apre il conto.
                            e.stopPropagation()
                            if (azione.tipo === 'avanza') onAvanza?.(o, s.comanda)
                            else onIncassa?.(o)
                          }}
                        >
                          {azione.etichetta}
                        </button>
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
