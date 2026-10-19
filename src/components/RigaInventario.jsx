import { memo } from 'react'
import { formatQty } from '../lib/inventory.js'

// «+0,4 pz», «-1,9 pz»: una differenza si legge col suo segno.
const conSegno = (n, unit) => `${n > 0 ? '+' : ''}${formatQty(n, unit)}`

// UNA RIGA DELL'INVENTARIO: i numeri del periodo, il campo dove si scrive
// il contato e il ✓ che conferma la RIM così com'è. La usano l'inventario
// in corso (REQ-MAG-046) e lo storico (REQ-MAG-052), che la vuole uguale
// ma «con la casella rimanenze bloccata»: in `soloLettura` la RIM è quella
// alla chiusura (`rim`), non la giacenza di adesso (`atteso`), la casella
// mostra il contato di allora senza accettare tasti, e il ✓ non c'è.
// Si ridisegna solo se cambia qualcosa che mostra: con quattrocento righe
// e un telefono in mano, ridisegnarle tutte a ogni cifra si sente.
const RigaInventario = memo(
  function RigaInventario({ riga: l, valore, onScrivi, onEsci, soloLettura = false }) {
    const q = (n) => formatQty(n, l.unit)
    const rim = soloLettura ? l.rim : l.atteso
    return (
      <div className="inv-item">
        <div className="inv-row" style={{ cursor: 'default' }}>
          <div className="grow">
            <div className="inv-name">{l.name}</div>
            <div className="muted small">
              DEP {q(l.dep)} · ACQ {q(l.acq)}
              {l.cons != null && ` · CONS ${q(l.cons)}`}
              {rim != null && (
                <>
                  {' · RIM '}
                  <strong>{q(rim)}</strong>
                </>
              )}
              {soloLettura && l.diff ? ` · differenza ${conSegno(l.diff, l.unit)}` : ''}
              {/* Il consumo a settimana (REQ-MAG-024) resta: è il numero su
                  cui si decide quanto ordinare. */}
              {l.cons_week != null && ` · ${q(l.cons_week)} a settimana`}
            </div>
          </div>
          <input
            type="number"
            step="any"
            min="0"
            value={valore}
            placeholder={`RIM ${l.unit}`}
            aria-label={`Rimanenza di ${l.name}`}
            disabled={soloLettura}
            onChange={soloLettura ? undefined : (e) => onScrivi(l.item_id, e.target.value)}
            onBlur={soloLettura ? undefined : () => onEsci(l.item_id)}
            style={{ width: 90, textAlign: 'right' }}
          />
          {/* «Confermare o modificare il valore di RIM» (Flavio, 24/09): la
              maggior parte dei prodotti torna, e riscriverne il numero a mano
              è solo un'occasione in più per sbagliarlo. */}
          {!soloLettura && (
            <button
              type="button"
              className="btn ghost small"
              aria-label={`Conferma la rimanenza di ${l.name}`}
              onClick={() => {
                onScrivi(l.item_id, String(l.atteso))
                onEsci(l.item_id)
              }}
            >
              ✓
            </button>
          )}
        </div>
      </div>
    )
  },
  (a, b) =>
    a.valore === b.valore &&
    a.onScrivi === b.onScrivi &&
    a.onEsci === b.onEsci &&
    a.soloLettura === b.soloLettura &&
    ['name', 'unit', 'dep', 'acq', 'cons', 'atteso', 'rim', 'diff', 'cons_week'].every((k) => a.riga[k] === b.riga[k])
)

export default RigaInventario
