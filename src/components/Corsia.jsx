import { formatPrice } from '../lib/orderStatus.js'
import { paidAmount } from '../lib/pagamento.js'
import { destinazioneConto } from '../lib/coda.js'

// ── QUELLO CHE LE DUE LAVAGNE A CORSIE HANNO IN COMUNE ───────────────
//
// La coda ha due viste a colonne: quella dei CONTI (CorsieStato) e quella
// del banco, che dentro ha le COMANDE (CorsieComande). Non sono la stessa
// vista — una risponde a «come sta andando la serata», l'altra a «cosa devo
// fare adesso», e solo quella dei conti ha la colonna della cifra grande —
// ma il contorno è lo stesso: il guscio della colonna, la testata con
// conteggio e totale, la card dei conti «in arrivo», il bollo dell'acconto e
// il piede con il ⋯ e il tasto grande.
//
// Erano una novantina di righe scritte due volte, e una modifica alla
// testata andava fatta in due posti. Qui sta il contorno; a ognuna delle due
// resta il corpo della propria card, che è la parte in cui davvero
// differiscono.
//
// NON SI FONDONO: farlo vorrebbe dire far finta che un conto e una comanda
// siano la stessa cosa, ed è esattamente l'errore che la vista del banco è
// nata per correggere.

// La lavagna: quante colonne quante sono le corsie. Erano quattro fisse, e
// con gli stati di servizio spenti restavano schiacciate a sinistra con un
// quarto di schermo vuoto a destra.
export function Lavagna({ corsie, children }) {
  return (
    <div className="corsie" style={{ '--corsie-n': corsie.length }}>
      {children}
    </div>
  )
}

// Una colonna: testata, lista, e in cima alla PRIMA i conti appena battuti
// al POS e ancora in volo verso il server. Il corpo delle card lo passa chi
// chiama.
//
// `quanti` è il numero accanto al titolo: nella vista dei conti sono i
// conti, in quella del banco le comande — due domande diverse sulla stessa
// colonna, e non si indovinano da qui.
export function Corsia({ corsia, quanti, prima = false, inArrivo = [], onScarta, children }) {
  return (
    <section className="corsia">
      <div className={`row between corsia-testa corsia-${corsia.id}`}>
        <span className="corsia-titolo">
          {corsia.titolo} <span className="muted small">{quanti}</span>
        </span>
        <span className="price small">{formatPrice(corsia.totale)}</span>
      </div>
      {/* Corsia vuota: intestazione a zero e basta. Una scritta di
          riempimento in ognuna delle colonne è rumore che copre quelle
          piene. */}
      <div className="corsia-lista">
        {prima && inArrivo.map((p) => <CardInArrivo key={p.tempId} pending={p} onScarta={onScarta} />)}
        {children}
      </div>
    </section>
  )
}

// CONTI APPENA BATTUTI, ancora in volo verso il server: stanno in cima alla
// prima corsia perché è lì che nascono. Senza, chi batte un conto al POS
// torna in coda, non lo vede e lo ribatte.
//
// Nella vista del banco le comande non ci sono ancora — le fa il server —
// ma il conto sì: è la stessa card, e per questo sta qui.
function CardInArrivo({ pending, onScarta }) {
  return (
    <article className="card order-card corsia-card in-arrivo">
      <div className="row between">
        <span className="corsia-num">
          <span className="corsia-conto">#{pending.order?.daily_number ?? '…'}</span>
        </span>
        <span className="muted small">
          {pending.state === 'error' ? 'non inviato' : 'in invio…'}
        </span>
      </div>
      <div className="muted small corsia-dove">{destinazioneConto(pending.order || {})}</div>
      {pending.state === 'error' && (
        <>
          <div className="small corsia-righe">{pending.error}</div>
          <button className="btn small block corsia-azione" onClick={() => onScarta?.(pending.tempId)}>
            Rimuovi
          </button>
        </>
      )}
    </article>
  )
}

// ACCONTO: qualcosa è già stato incassato, ma il conto non è chiuso. Senza
// dirlo sulla card, chi porta il conto al tavolo chiede l'intero — ed è
// successo.
export function BolloAcconto({ order }) {
  if (order?.payment_status !== 'parziale') return null
  return (
    <span className="pill acconto small" title={`Già incassati ${formatPrice(paidAmount(order))}`}>
      💳 Acconto
    </span>
  )
}

// IL PIEDE DELLA CARD, IN UNA RIGA SOLA. Il ⋯ e il tasto che porta avanti il
// lavoro erano due blocchi larghi tutta la card, uno sotto l'altro: due
// righe di altezza per ogni conto, moltiplicate per una colonna intera.
export function PiedeCorsia({ children }) {
  return <div className="corsia-piede">{children}</div>
}

// Il ⋯: apre le azioni DENTRO la card. Una finestrella che copre lo schermo
// per un «torna a in preparazione» è un sipario per un tocco, e al banco fa
// perdere di vista la colonna.
export function TastoAzioni({ aperto, onTocca, titolo }) {
  return (
    <button
      className="btn ghost small corsia-azioni"
      aria-expanded={aperto}
      // Il nome del tasto è quello che c'è scritto, e cambia con lo stato:
      // con un'etichetta fissa chi legge con la voce sentiva «Azioni» anche
      // a pannello già aperto.
      title={titolo}
      onClick={(e) => {
        e.stopPropagation()
        onTocca()
      }}
    >
      {aperto ? '▴ Chiudi' : '⋯ Azioni'}
    </button>
  )
}

// IL TASTO GRANDE: uno solo per card, quello che si preme col pollice, di
// corsa, al buio. Toccandolo si fa quello che c'è scritto — non si apre la
// card sotto.
export function TastoCorsia({ azione, attesa = false, onPremi }) {
  if (!azione) return null
  return (
    <button
      className="btn small corsia-azione"
      disabled={attesa}
      title={attesa ? 'In attesa del pagamento: non si prepara' : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onPremi(azione)
      }}
    >
      {azione.etichetta}
    </button>
  )
}
