import { ORDER_STATUSES } from '../lib/orderStatus.js'
import { azioneComanda, daQuanto, destinazioneConto } from '../lib/coda.js'
import { ETICHETTA_ANNULLO } from '../lib/comande.js'
import RigheCorsia from './RigheCorsia.jsx'
import { BolloAcconto, Corsia, Lavagna, PiedeCorsia, TastoAzioni, TastoCorsia } from './Corsia.jsx'
import { useState } from 'react'

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
// DOVE PORTANO I TOCCHI. Toccando la card si apre il DETTAGLIO DELLA
// COMANDA: le sue righe per intero, gli orari dei passi, e i tasti per
// portarla avanti o riportarla indietro. Prima si apriva il conto, ma dal
// banco quella è la seconda domanda, non la prima — la prima è «cosa devo
// fare qui». Al conto si va da un tasto suo, piccolo e scritto, accanto a
// quello dell'avanzamento: incassare e aggiungere righe sono cose del
// conto, e capitano di continuo. Il tasto grande resta uno solo, quello
// che si preme di corsa.
//
// IL CONTORNO È IN COMUNE con la lavagna dei conti e sta in Corsia.jsx:
// guscio della colonna, testata, card dei conti «in arrivo», bollo
// dell'acconto, piede. Qui resta il corpo della card della COMANDA.
//
// Le corsie e cosa ci sta dentro arrivano già fatte da lib/coda.js
// (corsieComande): qui non si decide niente, si disegna soltanto.

// Un conto senza modo scelto è roba da portare finché non si dice altro:
// è la stessa regola con cui lo smista la colonna (lib/coda.js).
const modoDi = (o) => (o?.service_mode === 'banco' ? 'banco' : 'tavolo')

export default function CorsieComande({
  corsie,
  // Il badge «come va consegnato» serve solo quando il pronto è una
  // colonna sola: dividendola, la colonna dice già quello che direbbe il
  // badge, e ripeterlo è rumore su una card già piena.
  mostraModo = false,
  idAcceso = null,
  onApri,
  onApriConto,
  onAvanza,
  onIncassa,
  onScarta,
  // Le voci del ⋯ di una card: le decide la pagina, che sa le
  // impostazioni e come si scrive sul database. Qui si disegnano e basta.
  vociComanda = null,
  // Chi guarda: alla sala il tasto che porta avanti la preparazione non
  // compare (vedi azioneComanda). Vede lo stato, e segna quello che serve.
  ruolo = null,
  inArrivo = [],
  attesaPagamento = () => false,
  espansa = null,
  onEspandi,
}) {
  // Un solo «adesso» per tutta la vista: card diverse non devono dire tempi
  // diversi solo perché sono state disegnate a un secondo di distanza.
  const adesso = Date.now()
  // Quale card ha il ⋯ aperto: una alla volta, come le altre finestrelle.
  const [azioniDi, setAzioniDi] = useState(null)

  return (
    <Lavagna corsie={corsie}>
      {corsie.map((corsia) => (
        <Corsia
          key={corsia.id}
          corsia={corsia}
          quanti={corsia.schede.length}
          prima={corsie[0]?.id === corsia.id}
          inArrivo={inArrivo}
          onScarta={onScarta}
        >
          {corsia.schede.map((s) => {
            const o = s.ordine
            // IL TASTO DIPENDE DALLO STATO DELLA COMANDA, non dalla
            // colonna: la stessa comanda pronta ha lo stesso tasto sia
            // che le colonne siano unite sia che siano divise.
            const azione = azioneComanda(s.comanda, o, { ruolo })
            // Le voci del ⋯ si costruiscono UNA volta per card: prima
            // se ne facevano due giri — uno per contarle e uno per
            // disegnarle — e ogni giro allocava fino a cinque oggetti
            // con dentro altrettante chiusure, per ognuna delle
            // cinquanta card a vista.
            const voci = s.comanda && vociComanda ? vociComanda(s) : []
            const attesa = azione?.tipo === 'avanza' && attesaPagamento(o)
            return (
              <article
                className={`card order-card corsia-card ${
                  s.comanda?.status || o.workflow_status
                }${s.pagatoDaServire ? ' pagato-da-servire' : ''}${
                  o.payment_status === 'parziale' ? ' acconto' : ''
                }${o.id === idAcceso ? ' conto-acceso' : ''}`}
                key={s.id}
                id={`comanda-${s.id}`}
                onClick={() => onApri?.(o, s.comanda)}
              >
                <div className="row between">
                  <span className="corsia-num">
                    <span className="corsia-conto">#{s.numero ?? '—'}</span>
                    {/* IL NUMERO DELLA COMANDA sta accanto a quello del
                        conto, non al suo posto: due comande dello stesso
                        tavolo sono due card, e senza il secondo numero
                        sembrerebbero la stessa cosa mostrata due volte. */}
                    {s.seq != null && <span className="corsia-comanda"> · comanda {s.seq}</span>}
                  </span>
                  <BolloAcconto order={o} />
                  {/* PERCHÉ È QUI. Nella colonna delle annullate la
                      domanda non è «da quanto sta lì» ma «che fine ha
                      fatto», e le risposte sono tre: tolta a mano,
                      divisa in due, o caduta col conto. Una divisione
                      non è un drink saltato — quei drink si stanno
                      facendo — e leggere «Annullata» su tutte e tre
                      manderebbe a cercare un guaio che non c'è. */}
                  {s.motivo ? (
                    <span className="pill annullato small">{ETICHETTA_ANNULLO[s.motivo]}</span>
                  ) : s.pagatoDaServire ? (
                    <span className="pill pagato small">Pagato</span>
                  ) : (
                    <span className="muted small">
                      {daQuanto(s.comanda?.created_at || o.created_at, adesso)}
                    </span>
                  )}
                </div>
                <div className="muted small corsia-dove">
                  {destinazioneConto(o)}
                  {/* COME VA CONSEGNATO, sulla card del PRONTO. È lì che
                      la domanda si pone: quella colonna tiene due
                      lavori diversi — roba da portare a un tavolo e
                      roba che aspetta il cliente al bancone — e senza
                      dirlo si guarda il tavolo per indovinarlo. Dove le
                      colonne sono già due il badge non serve: lo dice
                      la colonna. */}
                  {mostraModo && s.comanda?.status === ORDER_STATUSES.PRONTO && (
                    <span className={`pill small consegna-${modoDi(o)}`}>
                      {modoDi(o) === 'banco' ? '🚶 Ritiro' : '🍸 Servizio'}
                    </span>
                  )}
                </div>
                <RigheCorsia
                  items={s.items}
                  aperto={espansa === s.id}
                  onApri={() => onEspandi?.(espansa === s.id ? null : s.id)}
                />
                {/* La nota del CONTO — «tavolo di fuori», «allergia alle
                    noci» — vale per tutte le sue comande: si porta dietro
                    anche il pezzo diviso, o chi prepara la seconda metà
                    non la legge. */}
                {o.note && <div className="order-note small corsia-nota">{o.note}</div>}
                {(azione || s.comanda) && (
                  <PiedeCorsia>
                    {/* AL CONTO SI VA DA QUI. La card apre la comanda —
                        «cosa devo fare» — e il conto è l'altra domanda:
                        quanto fa, cosa aggiungo, chi paga. Scritto e
                        piccolo, accanto al tasto grande e non al suo
                        posto: quello si preme di corsa, e un tasto in
                        più nella stessa posizione è un incasso aperto
                        per sbaglio. Nella colonna dei soldi non c'è: lì
                        la card è già il conto. */}
                    {s.comanda && (
                      <button
                        className="btn ghost small corsia-azioni"
                        onClick={(e) => {
                          e.stopPropagation()
                          onApriConto?.(o)
                        }}
                        title={`Apri il conto #${s.numero ?? ''}`}
                      >
                        🧾 Conto
                      </button>
                    )}
                    {/* IL ⋯ DELLA COMANDA. Riportarla a uno stato di
                        prima, ristamparla, dividerla: cose che si fanno
                        di rado ma proprio dalla card, senza aprire il
                        ticket. Il tasto grande resta uno solo — quello
                        che si preme di corsa — e tutto il resto sta
                        qui dietro. */}
                    {voci.length > 0 && (
                      <TastoAzioni
                        aperto={azioniDi === s.id}
                        titolo={`Azioni della comanda #${s.numero ?? ''}`}
                        onTocca={() => setAzioniDi(azioniDi === s.id ? null : s.id)}
                      />
                    )}
                    <TastoCorsia
                      azione={azione}
                      attesa={attesa}
                      onPremi={(a) => (a.tipo === 'avanza' ? onAvanza?.(o, s.comanda) : onIncassa?.(o))}
                    />
                  </PiedeCorsia>
                )}
                {/* LE AZIONI SI APRONO NELLA CARD, come per i conti: una
                    finestrella che copre lo schermo per un «torna a in
                    preparazione» è un sipario per un tocco, e al banco
                    fa perdere di vista la colonna. */}
                {azioniDi === s.id && (
                  <div className="corsia-azioni-aperte" onClick={(e) => e.stopPropagation()}>
                    {voci.map((v) => (
                      <button
                        key={v.id}
                        className="btn ghost small block"
                        disabled={v.disabled}
                        title={v.hint || undefined}
                        onClick={() => {
                          setAzioniDi(null)
                          v.onClick?.()
                        }}
                      >
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </Corsia>
      ))}
    </Lavagna>
  )
}
