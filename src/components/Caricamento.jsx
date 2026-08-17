// ── «UN ATTIMO» DETTO BENE ───────────────────────────────────────────
//
// «Verifica accesso…» scritto e basta, su una pagina vuota, non si
// distingue da un'app che si è piantata: chi guarda non sa se aspettare o
// ricaricare. Tre bollicine che salgono dicono la stessa cosa e dicono
// anche che qualcosa si sta muovendo — e sono bollicine perché questo è un
// bar, non un gestionale di magazzino.
//
// Non ha una percentuale apposta: non sappiamo quanto ci vuole, e una barra
// che si ferma a metà è peggio del silenzio.
export default function Caricamento({ testo = 'Un attimo…', piccolo = false }) {
  return (
    <div className={`caricamento${piccolo ? ' piccolo' : ''}`} role="status" aria-live="polite">
      <span className="caricamento-bolle" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="caricamento-testo">{testo}</span>
    </div>
  )
}
