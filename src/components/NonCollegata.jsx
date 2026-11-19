import { tr, useLingua } from '../lib/lingua.js'

// IL SITO CHE NON SA ANCORA DI CHE LOCALE È (REQ-FLOTTA-034). Il sito uguale
// per tutti i locali, prima che la regia ci scriva la configurazione, o un
// dispositivo che non l'ha ancora ricevuta: niente backend. Si vede questa
// schermata AL POSTO dell'app (main.jsx), e non il banner per lo
// sviluppatore con le variabili d'ambiente, che al banco e al cliente non
// dice niente. Al posto dell'app vuol dire anche che niente scrive: un
// ordine finito nella coda di un progetto finto non arriverebbe mai al
// locale (R4 dell'analisi del 18/11/2026).
//
// L'app si collega da sola (porte/configurazione.js, seguiConfigurazione):
// qui non c'è un tasto da premere, e la frase lo dice.
export default function NonCollegata() {
  useLingua()
  return (
    <main className="installazione-sospesa" role="alert">
      <div className="card">
        <h2>{tr('L’app non è ancora collegata al locale')}</h2>
        <p>{tr('Si collega da sola appena la connessione lo permette.')}</p>
        <p className="muted">{tr('Se resta così, controllare la connessione del dispositivo.')}</p>
      </div>
    </main>
  )
}
