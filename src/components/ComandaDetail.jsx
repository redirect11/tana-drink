import {
  ORDER_STATUSES,
  STATUS_EMOJI,
  STATUS_LABELS,
  formatPrice,
  ritiratoLabel,
  statiPrima,
} from '../lib/orderStatus.js'
import { useState } from 'react'
import { hhmm } from '../lib/ore.js'
import { paidAmount } from '../lib/pagamento.js'
import { destinazioneConto, daQuanto } from '../lib/coda.js'
import {
  annullataPerDivisione,
  comandaDivisibile,
  itemsTotal,
  nextComandaStatus,
  tappeComanda,
} from '../lib/comande.js'
import PreparazioneParziale from './PreparazioneParziale.jsx'

// ── IL DETTAGLIO DI UNA COMANDA ──────────────────────────────────────
//
// Il dettaglio del CONTO risponde alla domanda della cassa: quanto fa, chi
// paga, cosa aggiungo. Questa risponde a quella del banco: cosa devo fare
// ADESSO, per chi, e da quanto sta lì. Sono due domande diverse, e per
// questo sono due schermate — riusare quella del conto avrebbe voluto dire
// portarsi dietro la griglia dei prodotti, lo sconto e il pagamento su una
// comanda, che sono tutte cose del conto e non del ticket.
//
// Quello che è di tutte e due è già condiviso e sta altrove: le regole del
// flusso in lib/comande.js, i nomi degli stati in lib/orderStatus.js, la
// destinazione in lib/coda.js. Qui c'è solo il disegno.

// Come si chiama un passo, con la parola giusta per come si consegna
// («Ritirato» al banco, «Servito» al tavolo).
const nomeStato = (stato, serviceMode) =>
  stato === ORDER_STATUSES.RITIRATO ? ritiratoLabel(serviceMode) : STATUS_LABELS[stato]

export default function ComandaDetail({
  order,
  comanda,
  workflowOn = true,
  onAvanza,
  onTornaA,
  onDividi,
  onApriConto,
  onStampa,
  onIndietro,
}) {
  // Il riquadro delle quantità è aperto? Sta chiuso di suo: dividere è la
  // deroga, non la regola, e sei tastini +/− sempre aperti sotto il tasto
  // grande sono sei modi di toccare quello sbagliato di corsa.
  const [dividendo, setDividendo] = useState(false)
  const righe = comanda.items || []
  const prossimo = nextComandaStatus(comanda.status)
  const chiusa =
    order.status === ORDER_STATUSES.PAGATO || order.status === ORDER_STATUSES.ANNULLATO
  const divisa = annullataPerDivisione(comanda)
  const indietro = statiPrima(comanda.status)

  return (
    <div className="comanda-det">
      {/* LA TESTATA DICE TRE COSE, in quest'ordine: che comanda è, dove va
          e a che punto sta. È l'ordine in cui le si cerca quando si guarda
          uno schermo con l'ordine già in mano. */}
      <div className="card comanda-det-testa">
        <div className="row between comanda-det-riga1">
          <button className="btn ghost small" onClick={onIndietro}>
            ← Torna alla coda
          </button>
          <button className="btn small comanda-det-conto" onClick={onApriConto}>
            🧾 Apri il conto #{order.daily_number ?? '—'}
          </button>
        </div>
        <div className="bignum comanda-det-num">
          #{order.daily_number ?? '—'}
          {comanda.seq != null && (
            <span className="comanda-det-seq"> · comanda {comanda.seq}</span>
          )}
        </div>
        <div className="muted comanda-det-dove">
          {destinazioneConto(order) || 'Senza tavolo né nome'}
        </div>
        <div className="row comanda-det-bolli">
          <span className={`pill ${comanda.status}`}>
            {divisa ? '✂️ Divisa' : `${STATUS_EMOJI[comanda.status]} ${nomeStato(comanda.status, order.service_mode)}`}
          </span>
          {/* ACCONTO: qualcosa è già stato incassato ma il conto è aperto.
              Serve saperlo anche da qui: chi finisce la comanda spesso è
              quello che poi porta il conto al tavolo. */}
          {order.payment_status === 'parziale' && (
            <span className="pill acconto" title={`Già incassati ${formatPrice(paidAmount(order))}`}>
              💳 Acconto
            </span>
          )}
          {order.payment_status === 'pagato' && <span className="pill pagato">💶 Pagato</span>}
          <span className="muted small comanda-det-eta">
            {daQuanto(comanda.created_at || order.created_at)}
          </span>
        </div>
      </div>

      {/* I PASSI CON L'ORA. Al banco quei minuti sono la differenza fra
          «siamo indietro» e «questo ticket è stato dimenticato»: il totale
          da solo non lo dice. */}
      <div className="steps comanda-det-passi">
        {tappeComanda(comanda).map((t) => (
          <div className={`step${t.fatta ? ' done' : ''}${t.adesso ? ' active' : ''}`} key={t.stato}>
            {STATUS_EMOJI[t.stato]}
            <br />
            {nomeStato(t.stato, order.service_mode)}
            <br />
            <span className="muted small">{t.quando ? hhmm(t.quando) : '—'}</span>
          </div>
        ))}
      </div>

      {/* QUESTA COMANDA, non il conto: le sue righe e il suo totale. Il
          conto intero — con coperto, sconto e quello che è già stato
          incassato — sta dietro il tasto in alto, che è il suo posto. */}
      <div className="card comanda-det-righe">
        <h3 className="comanda-det-titolo">Cosa c’è da fare</h3>
        {righe.length === 0 && <p className="muted small">Questa comanda è vuota.</p>}
        {righe.map((i, idx) => (
          <div className="row between comanda-det-riga" key={i.line_id ?? `${i.drink_id}-${idx}`}>
            <span className="comanda-det-nome">
              <strong>{i.qty}×</strong> {i.custom ? '✨ ' : ''}
              {i.name}
              {/* La nota della RIGA è quella che cambia come si prepara:
                  sta attaccata alla riga, non in fondo alla comanda. */}
              {i.note && <span className="comanda-det-nota muted small">↳ {i.note}</span>}
            </span>
            <span className="muted">{formatPrice((i.qty || 0) * (i.unit_price || 0))}</span>
          </div>
        ))}
        {righe.length > 0 && (
          <div className="row between comanda-det-totale">
            <strong>Totale comanda</strong>
            <strong className="price">{formatPrice(itemsTotal(righe))}</strong>
          </div>
        )}
        {/* La nota del CONTO — «tavolo di fuori», «allergia alle noci» —
            vale per tutte le sue comande, anche per un pezzo diviso. */}
        {order.note && <div className="order-note small comanda-det-notaconto">{order.note}</div>}
        {comanda.note && <div className="order-note small comanda-det-notaconto">{comanda.note}</div>}
      </div>

      {/* IL TASTO GRANDE È UNO SOLO, quello che porta avanti il lavoro: è
          quello che si preme di corsa, e deve stare dove il pollice lo
          trova senza guardare. Tornare indietro si può, ma sta sotto e più
          piccolo: si sbaglia meno spesso di quanto si lavori. */}
      <div className="comanda-det-azioni">
        {prossimo && !chiusa && (
          <button className="btn block comanda-det-avanti" onClick={() => onAvanza?.(prossimo)}>
            {nomeStato(prossimo, order.service_mode)}
          </button>
        )}
        {!chiusa && indietro.length > 0 && (
          <div className="row comanda-det-indietro">
            <span className="muted small">Torna a</span>
            {indietro.map((st) => (
              <button
                key={st}
                className="chip"
                onClick={() => onTornaA?.(st)}
                title={`Riporta la comanda a «${nomeStato(st, order.service_mode)}»`}
              >
                ↩︎ {nomeStato(st, order.service_mode)}
              </button>
            ))}
          </div>
        )}
        {/* ── PREPARAZIONE PARZIALE ───────────────────────────
            Tre gin tonic qui e due nella comanda del tavolo accanto si
            preparano insieme, per farli uscire in una volta. È una
            decisione che si prende guardando IL TICKET, non il conto: sta
            qui perché qui c'è chi la prende, e farlo risalire al conto per
            dividere quello che ha già davanti sono due schermate indietro
            per una cosa che riguarda solo questa comanda.
            Solo su una comanda ancora DA FARE e con più di un'unità
            (comandaDivisibile): quello che è già al banco non si divide, il
            lavoro è cominciato, e su un drink solo la scelta sarebbe fra
            tutto e niente — cioè il tasto grande qui sopra. */}
        {workflowOn &&
          !chiusa &&
          comandaDivisibile(comanda) &&
          (dividendo ? (
            <PreparazioneParziale
              comanda={comanda}
              onAnnulla={() => setDividendo(false)}
              onConferma={(scelte) => {
                setDividendo(false)
                onDividi?.(scelte)
              }}
            />
          ) : (
            <button
              className="btn ghost small block comanda-det-dividi"
              onClick={() => setDividendo(true)}
            >
              ✂️ Preparazione parziale
            </button>
          ))}
        <button className="btn ghost small block comanda-det-stampa" onClick={onStampa}>
          🖨 Ristampa la comanda
        </button>
      </div>
    </div>
  )
}
