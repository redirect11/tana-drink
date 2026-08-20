import { formatPrice } from '../lib/orderStatus.js'
import { paidAmount } from '../lib/pagamento.js'
import { destinazioneConto } from '../lib/coda.js'
import { COLORI_CONTO, coloreDelConto } from '../lib/coloriConto.js'

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
export function Lavagna({ corsie, classe = '', children }) {
  return (
    <div
      className={`corsie${classe ? ' ' + classe : ''}`}
      style={{ '--corsie-n': corsie.length }}
    >
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
//
// `refCorsia` e `classe` servono a chi la usa come BERSAGLIO DI UN
// TRASCINAMENTO (la vista del banco: una comanda si sposta di colonna col
// dito). Qui non entra niente di quella libreria — la colonna riceve un
// riferimento e una classe, e non sa perché.
export function Corsia({
  corsia,
  quanti,
  prima = false,
  inArrivo = [],
  onScarta,
  refCorsia = null,
  classe = '',
  children,
}) {
  return (
    <section className={`corsia${classe ? ' ' + classe : ''}`} ref={refCorsia}>
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

// ── IL COLORE DEL CONTO SULLA CARD ────────────────────────────────────
//
// TINGE LA CARD INTERA, sfumata e leggera: è il segno che dice «questa e
// quella sono lo stesso tavolo» anche quando finiscono in tre colonne
// diverse. Prima era un pallino accanto al numero, e non serviva: questo
// colore deve rispondere da LONTANO, guardando la lavagna mentre si versa,
// e dieci pixel da lontano non ci sono.
//
// NON LA STRISCIA A SINISTRA, che è un vocabolario chiuso di sei tinte —
// arancio da fare, azzurro al banco, verde pronto, grigio uscito, ambra
// pagato — e dice a che punto sta il lavoro. Quella non si tocca: chi
// vince fra i due sta scritto in lib/coloriConto.js. Il fondo invece era
// libero, e il colore del conto ci sta senza coprire niente.
//
// Restituisce le proprietà da mettere sulla card (classe e variabile CSS),
// non un pezzo di schermata: il colore non è una cosa DENTRO la card, è
// la card.
export function coloreCardConto(order) {
  const colore = coloreDelConto(order)
  if (!colore) return null
  return { className: 'conto-colorato', style: { '--conto-colore': colore } }
}

// LA TAVOLOZZA, dentro il ⋯ della card. La stessa fila di gettoni del menù
// e del POS, con la stessa tavolozza. Sta dietro al ⋯ e non sul pallino
// perché sulla card ogni tocco che non sia il tasto grande è un tocco
// sbagliato preso di corsa.
export function SceltaColoreConto({ order, onScegli }) {
  const attuale = (coloreDelConto(order) || '').toLowerCase()
  return (
    <div className="colori-conto">
      <span className="muted small">Colore del conto</span>
      <div className="colori-conto-riga">
        {COLORI_CONTO.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colore ${c}`}
            aria-pressed={attuale === c.toLowerCase()}
            className={`colore-conto${attuale === c.toLowerCase() ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => onScegli?.(c)}
          />
        ))}
        {/* Togliere il colore dev'essere facile quanto darlo: un conto
            colorato per sbaglio, o un tavolo che se n'è andato e il colore
            adesso confonde con quello nuovo. */}
        <button
          type="button"
          className={`colore-conto niente${attuale ? '' : ' active'}`}
          title="Nessun colore"
          aria-label="Nessun colore"
          aria-pressed={!attuale}
          onClick={() => onScegli?.(null)}
        >
          ✕
        </button>
      </div>
    </div>
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
