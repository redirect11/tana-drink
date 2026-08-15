import { Tendina } from 'karaoke-drink'

// Il pannello si apre toccando il tasto (stato interno): in un'immagine ferma
// si vede il tasto, che è comunque la parte che sta a schermo tutto il giorno.
// Quello che conta è che dica COSA è scelto adesso.

// Una fila di filtri, come in Inventario: a riposo e con una scelta attiva.
export const FilaDiFiltri = () => (
  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
    <Tendina etichetta="Categoria" riassunto="Tutte">
      <p className="muted small">Le categorie da spuntare.</p>
    </Tendina>
    <Tendina etichetta="Fornitore" riassunto="Bevande Sud" attivo>
      <p className="muted small">I fornitori.</p>
    </Tendina>
    <Tendina etichetta="Scorte" riassunto="Sotto soglia" attivo>
      <p className="muted small">Le soglie.</p>
    </Tendina>
    <Tendina etichetta="Ordinamento" riassunto="Nome A→Z">
      <p className="muted small">I criteri.</p>
    </Tendina>
  </div>
)

// Senza `riassunto` il tasto mostra l'etichetta: va bene solo dove non c'è
// niente di scelto da ricordare.
export const SenzaRiassunto = () => (
  <div className="row" style={{ gap: 8 }}>
    <Tendina etichetta="Altre azioni" largo={300}>
      <p className="muted small">Le azioni.</p>
    </Tendina>
  </div>
)
