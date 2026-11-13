import { placedByName, placedByLetter } from '../lib/orderStatus.js'
import { colorePersona } from '../lib/colorePersona.js'
import Icona from './Icona.jsx'

// CHI HA BATTUTO IL CONTO, in un segno solo accanto al numero: l'iniziale
// del dipendente, oppure il mondo se l'ordine è arrivato dall'app del
// cliente. Sta in un file suo perché lo usano due viste della coda (la
// griglia e le corsie) e una copia per vista vuol dire due leggende
// diverse alla prima modifica.
//
// ANCHE PER UNA RIGA SOLA (REQ-ORD-023): con `persona` il segno dice chi ha
// battuto quella riga, con `titolo` «Aggiunto». Ogni persona ha il suo
// colore (lib/colorePersona.js), lo stesso sulla card e sulle righe.
export default function OrderBy({ order, persona = order?.placed_by, titolo = 'Aperto' }) {
  const L = placedByLetter(persona)
  return L ? (
    <span
      className="order-by staff"
      style={{ background: colorePersona(persona) }}
      title={`${titolo} da ${placedByName(persona)}`}
    >
      {L}
    </span>
  ) : (
    <span className="order-by client" title={`${titolo} dal cliente (app)`}>
      <Icona nome="mondo" gruppo="tasti" />
    </span>
  )
}
