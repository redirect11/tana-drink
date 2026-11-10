import { costoRiga } from '../lib/pricing.js'
import { formatPrice } from '../lib/orderStatus.js'

// Il costo di una riga di ricetta, accanto alla sua quantità (REQ-MENU-034).
// Condiviso dal prodotto modificato al POS e dalla scheda del drink, come
// PriceSuggestion: la cifra della riga deve tornare con il totale di sopra.
// Larghezza fissa e cifre tabellari, così i costi si leggono in colonna.
// Costo sconosciuto: un trattino, perché quale manca lo dice già la stima
// parziale nel riquadro del prezzo.
export default function CostoRiga({ row, item, name }) {
  const qty = Number(row?.qty) || 0
  const costo = costoRiga(row, item)
  return (
    <span
      className="muted small"
      aria-label={qty > 0 ? `Costo ${name || ''}`.trim() : undefined}
      style={{ width: 58, flex: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
    >
      {qty > 0 ? (costo == null ? '—' : formatPrice(costo)) : ''}
    </span>
  )
}
