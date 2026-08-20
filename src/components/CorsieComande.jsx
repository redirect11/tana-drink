import { ORDER_STATUSES } from '../lib/orderStatus.js'
import { azioneComanda, daQuanto, destinazioneConto, statoDelRilascio } from '../lib/coda.js'
import { ETICHETTA_ANNULLO } from '../lib/comande.js'
import RigheCorsia from './RigheCorsia.jsx'
import {
  BolloAcconto,
  Corsia,
  Lavagna,
  PiedeCorsia,
  TastoAzioni,
  TastoCorsia,
} from './Corsia.jsx'
import { coloreCardConto } from '../lib/coloriConto.js'
import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

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
//
// ── SI POSSONO ANCHE TRASCINARE ──────────────────────────────────
//
// «Se tengo premuto su una comanda questa fa come la modalità organizza
// della creazione ordine (quindi usa la stessa libreria) e posso spostarla
// in una delle lane visibili» (l'utente, 20/08). E subito dopo, che è la
// parte importante: «non è che DEVONO — come modo ALTERNATIVO per cambiare
// stato, le posso trascinare». I tasti non cambiano di una virgola.
//
// LA LIBRERIA È QUELLA DI CASA (dnd-kit), la stessa della modalità
// «Organizza» del POS e delle righe del conto: trascinare col dito è un
// problema risolto da altri, con dieci casi limite che non si vedono
// finché non capitano al banco.
//
// DOVE FINISCE lo dice `statoDelRilascio` (lib/coda.js), e A SCRIVERLO È
// LA STRADA DI SEMPRE — `onAvanza`, cioè la stessa funzione del tasto
// grande, che sa già dell'ottimismo locale e del magazzino. Qui non si
// scrive nessuno stato a mano.
//
// AL BANCO SI TOCCA CON LE DITA BAGNATE, e la lista si scorre: per questo
// si parte dopo una PRESSIONE LUNGA e non al primo movimento — se no
// scorrere le colonne vorrebbe dire spostare comande per sbaglio. Prima
// della soglia il dito scorre la pagina come sempre.

// La colonna come BERSAGLIO. Il gancio nasce da un hook, e dentro un `map`
// gli hook non si possono chiamare (cambiano di numero quando si accende o
// si spegne una colonna): quindi un componente per colonna.
//
// `ammessa` vale null quando non si sta trascinando niente: allora la
// colonna è quella di sempre e non si accende di niente.
function CorsiaBersaglio({ corsia, ammessa, ...resto }) {
  const { setNodeRef, isOver } = useDroppable({ id: corsia.id })
  const classe =
    ammessa === null
      ? ''
      : (ammessa ? 'corsia-accoglie' : 'corsia-rifiuta') + (isOver ? ' corsia-sotto' : '')
  return <Corsia corsia={corsia} refCorsia={setNodeRef} classe={classe} {...resto} />
}

// La card come COSA CHE SI PRENDE IN MANO. Stesso motivo del bersaglio: un
// hook per card, e dentro un `map` non ci può stare. I ganci si passano a
// chi disegna, così la card resta scritta dov'era, per intero.
function ComandaInMano({ id, disabilitato, children }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id, disabled: disabilitato })
  return children({ setNodeRef, listeners, isDragging })
}

// COME SI CHIAMA UNA COMANDA: «#41 Tavolo 4 · comanda 2».
//
// NUMERO E NOME INSIEME, E DELLA STESSA MISURA. Il nome stava sotto,
// piccolo e smorzato, mentre è la cosa che si cerca per prima quando si
// chiama un tavolo: «il ventidue, quello di Peppe». Ora stanno sulla stessa
// riga e pesano uguale, come sulle card della griglia.
//
// IL NUMERO DELLA COMANDA sta accanto a quello del conto, non al suo posto:
// due comande dello stesso tavolo sono due card, e senza il secondo numero
// sembrerebbero la stessa cosa mostrata due volte.
function NomeComanda({ scheda }) {
  const dove = destinazioneConto(scheda.ordine)
  return (
    <span className="corsia-num">
      <span className="corsia-conto">#{scheda.numero ?? '—'}</span>
      {dove && <span className="corsia-chi"> {dove}</span>}
      {scheda.seq != null && <span className="corsia-comanda"> · comanda {scheda.seq}</span>}
    </span>
  )
}

// QUELLO CHE SEGUE IL DITO. Non è la card vera: la lista delle colonne
// ritaglia quello che esce dai suoi bordi, e una card trascinata di lato
// sparirebbe a metà strada. Questa galleggia sopra tutto, e porta la sola
// cosa che serve a sapere cosa si ha in mano: come si chiama.
function CardTrascinata({ scheda }) {
  return (
    <article className="card order-card corsia-card corsia-in-volo">
      <NomeComanda scheda={scheda} />
    </article>
  )
}

export default function CorsieComande({
  corsie,
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
  // L'impostazione del locale: la striscia a sinistra dice il colore del
  // conto invece del passo della preparazione. Arriva dalla pagina, che le
  // impostazioni le ha già in cache — qui non si legge niente.
  bordoColoreConto = false,
}) {
  // Un solo «adesso» per tutta la vista: card diverse non devono dire tempi
  // diversi solo perché sono state disegnate a un secondo di distanza.
  const adesso = Date.now()
  // Quale card ha il ⋯ aperto: una alla volta, come le altre finestrelle.
  const [azioniDi, setAzioniDi] = useState(null)
  // La comanda che si ha in mano adesso, se ce n'è una.
  const [trascinata, setTrascinata] = useState(null)
  // FINITO IL TRASCINAMENTO ARRIVA ANCHE UN CLIC, che il browser manda da
  // sé sull'elemento sotto il dito: senza questa memoria, mollata la card
  // in un'altra colonna si aprirebbe pure la comanda. Un istante basta.
  const finitoAlle = useRef(0)
  // Da un id alla scheda: `active` e `over` di dnd-kit parlano per id.
  const perId = useMemo(
    () => new Map((corsie || []).flatMap((c) => c.schede.map((s) => [s.id, s]))),
    [corsie]
  )
  // COL DITO SI PARTE DOPO UNA PRESSIONE, col mouse anche: la lista si
  // scorre, e un trascinamento che parte al primo movimento vorrebbe dire
  // spostare comande scorrendo. `tolerance` è quanto si può ballare nel
  // frattempo — un dito fermo non è mai fermo davvero.
  const sensori = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 260, tolerance: 8 } })
  )

  function fineTrascinamento({ active, over }) {
    const scheda = perId.get(String(active?.id))
    setTrascinata(null)
    finitoAlle.current = Date.now()
    if (!scheda || !over) return // mollata fuori dalle colonne: non succede niente
    const corsia = (corsie || []).find((c) => c.id === String(over.id))
    const stato = statoDelRilascio(scheda, corsia, { ruolo })
    if (!stato) return
    // La stessa strada del tasto grande: si vede subito, si scrive in
    // sottofondo. Qui non si scrive nessuno stato per conto proprio.
    onAvanza?.(scheda.ordine, scheda.comanda, stato)
  }

  return (
    <DndContext
      sensors={sensori}
      // IL DITO DECIDE, non il centro della card: si lascia DOVE si guarda.
      // E se si molla fuori da ogni colonna non succede niente — con una
      // strategia «la più vicina» un rilascio a vuoto cambierebbe stato.
      collisionDetection={pointerWithin}
      // Le colonne si allargano mentre si trascina (una colonna vuota deve
      // poter accogliere qualcosa): misurate una volta sola, i bersagli
      // resterebbero dov'erano prima.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active }) => setTrascinata(perId.get(String(active.id)) || null)}
      onDragEnd={fineTrascinamento}
      onDragCancel={() => {
        setTrascinata(null)
        finitoAlle.current = Date.now()
      }}
    >
      <Lavagna corsie={corsie} classe={trascinata ? 'trascinando' : ''}>
        {corsie.map((corsia) => (
          <CorsiaBersaglio
            key={corsia.id}
            corsia={corsia}
            ammessa={trascinata ? !!statoDelRilascio(trascinata, corsia, { ruolo }) : null}
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
              // IL COLORE È DEL CONTO, e la comanda se lo porta dietro: da
              // tre colonne di distanza è così che si riconosce che questa e
              // quella sono lo stesso tavolo.
              const colore = coloreCardConto(o, bordoColoreConto)
              return (
                // SI PRENDE IN MANO SOLO QUELLO CHE SI PUÒ SPOSTARE: le card
                // della colonna dei soldi non sono comande, e le annullate
                // sono lavoro buttato — prenderle in mano prometterebbe un
                // gesto che poi nessuna colonna accetta.
                <ComandaInMano
                  key={s.id}
                  id={s.id}
                  disabilitato={!s.comanda || s.comanda.status === ORDER_STATUSES.ANNULLATO}
                >
                  {({ setNodeRef, listeners, isDragging }) => (
                    <article
                      ref={setNodeRef}
                      {...listeners}
                      className={`card order-card corsia-card ${
                        s.comanda?.status || o.workflow_status
                      }${s.pagatoDaServire ? ' pagato-da-servire' : ''}${
                        o.payment_status === 'parziale' ? ' acconto' : ''
                      }${o.id === idAcceso ? ' conto-acceso' : ''}${
                        colore ? ' ' + colore.className : ''
                      }${isDragging ? ' corsia-in-mano' : ''}`}
                      style={colore?.style}
                      id={`comanda-${s.id}`}
                      onClick={() => {
                        // Appena mollata la card, il clic che il browser manda da
                        // sé non deve aprire niente: si è spostata una comanda,
                        // non se n'è chiesto il dettaglio.
                        if (Date.now() - finitoAlle.current < 400) return
                        onApri?.(o, s.comanda)
                      }}
                    >
                      <div className="row between">
                        <NomeComanda scheda={s} />
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
                          <span className="muted small corsia-quando">
                            {daQuanto(s.comanda?.created_at || o.created_at, adesso)}
                          </span>
                        )}
                      </div>
                      {/* IL BADGE «Ritiro / Servizio» NON C'È PIÙ (19/08, chiesto
                          dall'utente: «il badge servizio non serve»). Diceva come
                          va consegnato, ma la card lo dice già senza pastiglie: un
                          conto con un tavolo si porta, uno al bancone si ritira, e
                          il tavolo adesso è scritto in grande accanto al numero.
                          Una pastiglia in più su ogni card pronta costava una riga
                          a tutte per una cosa che si legge dal nome. */}
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
                      {/* I TASTI NON SI TRASCINANO. Tenendo premuto «Incassa»
                          partirebbe il trascinamento della card: qui la
                          pressione si ferma, e i tasti restano tasti. */}
                      {(azione || s.comanda) && (
                        <div onPointerDown={(e) => e.stopPropagation()}>
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
                        </div>
                      )}
                      {/* LE AZIONI SI APRONO NELLA CARD, come per i conti: una
                          finestrella che copre lo schermo per un «torna a in
                          preparazione» è un sipario per un tocco, e al banco
                          fa perdere di vista la colonna. */}
                      {azioniDi === s.id && (
                        <div
                          className="corsia-azioni-aperte"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {voci.map((v) =>
                            // Una voce può essere un pezzo di schermata invece
                            // di un tasto — la tavolozza del conto è una fila di
                            // gettoni, non una cosa che si fa in un tocco solo.
                            v.nodo ? (
                              <div key={v.id}>{v.nodo}</div>
                            ) : (
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
                            )
                          )}
                        </div>
                      )}
                    </article>
                  )}
                </ComandaInMano>
              )
            })}
          </CorsiaBersaglio>
        ))}
      </Lavagna>
      {/* Quello che segue il dito, sopra tutto il resto. */}
      <DragOverlay dropAnimation={null}>
        {trascinata ? <CardTrascinata scheda={trascinata} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
