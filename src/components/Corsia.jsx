import { useEffect } from 'react'
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

// Il colore del conto sulla card — classe e variabile CSS — sta in
// lib/coloriConto.js insieme alla regola di chi vince fra colore del conto
// e colore dello stato: è logica pura, la usano tutte e quattro le viste
// della coda, e nessuna di loro è questo componente.

// IL COLORE DEL CONTO: UN TASTO NEL MENU, LA TAVOLOZZA IN UNA MODALE.
//
// Stava tutta dentro il ⋯ della card — dodici gettoni in due file più il
// «niente» — e allungava il menu di tre righe: le azioni vere (torna
// indietro, dividi, ristampa) finivano sopra una macchia di quadratini,
// e su una card di corsia quella macchia era metà del menu. «I colori del
// conto e della comanda andrebbero messi in una modale che si apre con un
// bottone» (l'utente, 20/08/2026).
//
// Nel menu resta un tasto solo, uguale agli altri, che PORTA ADDOSSO IL
// COLORE DI ADESSO: senza il pallino per sapere di che colore è il conto
// bisognerebbe aprire la modale, e la domanda «di che colore è?» è quella
// che si fa più spesso.

// Il pallino del colore attuale. Vuoto quando il conto non ne ha: un
// cerchio col solo bordo dice «nessuno» meglio di un posto lasciato in
// bianco, che sembra una cosa non caricata.
export function PallinoColoreConto({ order }) {
  const attuale = coloreDelConto(order)
  return (
    <span
      aria-hidden
      className={`pallino-colore-conto${attuale ? '' : ' niente'}`}
      style={attuale ? { background: attuale } : undefined}
    />
  )
}

// LA VOCE DEL MENU, una sola per tutti e due i menu: quello del conto
// (⋯ della card in corsia, in griglia e in lista) e quello della comanda,
// che è un elenco di oggetti e non di JSX. Scritta due volte si sarebbe
// scollata al primo ritocco — ed è la stessa cosa: anche dal ⋯ della
// comanda si dà il colore al CONTO.
export function voceColoreConto(order, onApri) {
  return {
    id: 'colore',
    icon: <PallinoColoreConto order={order} />,
    label: 'Colore del conto',
    hint: 'Lo portano anche tutte le sue comande',
    onClick: onApri,
  }
}

// Lo stesso tasto, disegnato: il menu del conto è JSX, non un elenco.
export function TastoColoreConto({ order, onApri }) {
  const v = voceColoreConto(order, onApri)
  return (
    <button
      type="button"
      className="btn ghost small block tasto-colore-conto"
      title={v.hint}
      onClick={v.onClick}
    >
      {v.icon} {v.label}
    </button>
  )
}

// LA TAVOLOZZA, nella sua modale. Stesso vestito degli altri dialoghi
// dell'app (`overlay confirm-overlay` + `confirm-box`, come il colore del
// prodotto nel POS): si chiude con Esc, toccando fuori e con la ✕.
//
// Scegliere APPLICA E CHIUDE: è un gesto solo, e una modale che resta
// aperta dopo la scelta chiede un secondo tocco per niente.
export function ModaleColoreConto({ order, onScegli, onChiudi }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onChiudi?.()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onChiudi])

  const attuale = (coloreDelConto(order) || '').toLowerCase()
  return (
    <div className="overlay confirm-overlay" onClick={onChiudi}>
      <div
        className="confirm-box colori-conto-box"
        role="dialog"
        aria-label="Colore del conto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Colore del conto</h3>
          <button className="btn ghost small" onClick={onChiudi} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Lo portano anche tutte le sue comande.
        </p>
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
