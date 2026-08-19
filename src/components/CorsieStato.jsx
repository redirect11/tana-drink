import { azioneCorsia, daQuanto, destinazioneConto } from '../lib/coda.js'
import OrderBy from './OrderBy.jsx'
import RigheCorsia from './RigheCorsia.jsx'
import {
  BolloAcconto,
  Corsia,
  Lavagna,
  PallinoConto,
  PiedeCorsia,
  TastoAzioni,
  TastoCorsia,
} from './Corsia.jsx'

// ── LA VISTA A CORSIE DEI CONTI ───────────────────────────────────────
//
// Tre colonne — in corso, chiusi, annullati — e su ogni card in corso un
// tasto solo: «Incassa». Chi guarda questa schermata ha in mano uno shaker
// e non ha tempo di leggere: la colonna dice come sta il conto, la card
// dice per chi, il tasto lo fa.
//
// I PASSI DEL SERVIZIO stanno nella vista del BANCO (CorsieComande), che
// ragiona per comande: qui la card è il conto, e un conto con tre comande
// in tre passi diversi non sta in una colonna sola.
//
// IL CONTORNO È IN COMUNE con l'altra lavagna e sta in Corsia.jsx: guscio
// della colonna, testata, card dei conti «in arrivo», bollo dell'acconto,
// piede. Qui resta il corpo della card del CONTO, che è la parte in cui le
// due viste differiscono davvero.
//
// Le corsie e i loro conti arrivano già fatti da lib/coda.js: qui non si
// decide niente su cosa sta dove, si disegna soltanto.
export default function CorsieStato({
  corsie,
  idAcceso = null,
  onApri,
  onIncassa,
  onScarta,
  inArrivo = [],
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
    <Lavagna corsie={corsie}>
      {corsie.map((corsia) => {
        // Il tasto dipende dallo STATO che la colonna rappresenta, non dal
        // suo id: vedi azioneCorsia, e BUG-026 per il perché.
        const azione = azioneCorsia(corsia.stato)
        return (
          <Corsia
            key={corsia.id}
            corsia={corsia}
            quanti={corsia.ordini.length}
            prima={corsie[0]?.id === corsia.id}
            inArrivo={inArrivo}
            onScarta={onScarta}
          >
            {corsia.ordini.map((o) => (
              <article
                className={`card order-card corsia-card ${o.workflow_status}${
                  o.payment_status === 'parziale' ? ' acconto' : ''
                }${o.id === idAcceso ? ' conto-acceso' : ''}`}
                key={o.id}
                id={`ordine-${o.id}`}
                onClick={() => onApri?.(o)}
              >
                <div className="row between">
                  <span className="corsia-num">
                    <PallinoConto order={o} />#{o.daily_number ?? '—'} <OrderBy order={o} />
                  </span>
                  <BolloAcconto order={o} />
                  <span className="muted small">{daQuanto(o.created_at, adesso)}</span>
                </div>
                <div className="muted small corsia-dove">{destinazioneConto(o)}</div>
                <RigheCorsia
                  items={o.order_items}
                  aperto={espansa === o.id}
                  onApri={() => onEspandi?.(espansa === o.id ? null : o.id)}
                />
                {o.note && <div className="order-note small corsia-nota">{o.note}</div>}
                {(azioni || azione) && (
                  <PiedeCorsia>
                    {azioni && (
                      <TastoAzioni
                        aperto={aperta === o.id}
                        onTocca={() => onApriAzioni?.(aperta === o.id ? null : o.id)}
                      />
                    )}
                    <TastoCorsia azione={azione} onPremi={() => onIncassa?.(o)} />
                  </PiedeCorsia>
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
            ))}
          </Corsia>
        )
      })}
    </Lavagna>
  )
}
