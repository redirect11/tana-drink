import { placedByName, placedByLetter } from '../lib/orderStatus.js'

// CHI HA BATTUTO IL CONTO, in un segno solo accanto al numero: l'iniziale
// del dipendente, oppure il mondo se l'ordine è arrivato dall'app del
// cliente. Sta in un file suo perché lo usano due viste della coda (la
// griglia e le corsie) e una copia per vista vuol dire due leggende
// diverse alla prima modifica.
export default function OrderBy({ order }) {
  const L = placedByLetter(order?.placed_by)
  return L ? (
    <span className="order-by staff" title={`Aperto da ${placedByName(order.placed_by)}`}>
      {L}
    </span>
  ) : (
    <span className="order-by client" title="Aperto dal cliente (app)">
      🌐
    </span>
  )
}
