import { formatPrice } from '../lib/orderStatus.js'
import { giorniScritti } from '../lib/warehouse.js'

// LA TESTATA DI UN INVENTARIO, in corso o chiuso: il titolo con le date, la
// durata e i contati, i due valori, e sotto la nota di lettura che cambia
// fra le due schermate (`children`).
export default function TestataInventario({ titolo, giorni, contati, totale, totals, children }) {
  return (
    <div className="card">
      <strong>{titolo}</strong>
      <div className="muted small">
        {giorni != null && `${giorniScritti(giorni)} · `}
        contati {contati}/{totale}
      </div>
      <div className="muted small">
        {/* IN EVIDENZA LA RIMANENZA (Flavio, 29/09/2026): «il consumato me ne
            faccio poco, mi serve più vedere in grassetto la rimanenza». */}
        Valore rimanenze: <strong>{formatPrice(totals.rim_value)}</strong>
        {' · '}Consumo: {formatPrice(totals.cons_value)}
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        {children}
      </p>
    </div>
  )
}
