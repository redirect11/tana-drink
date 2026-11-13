import { useEffect, useState } from 'react'
import { formatPrice } from '../lib/orderStatus.js'
import { minutiRimasti, scaduta } from '../lib/attesaCliente.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// IL BANCO HA CAMBIATO L'ORDINE, E LO DICE AL CLIENTE (REQ-CLI-009). Sulla
// pagina del suo ordine, sopra il riepilogo (che è già quello nuovo): il
// totale di prima e quello di adesso, i minuti per rispondere, e i due
// tasti. Rifiutare annulla l'ordine, e lo si chiede prima. A tempo scaduto
// i tasti spariscono: l'annullo lo fa la coda del banco.
export default function ModificaDaConfermare({ order, onRispondi, inCorso = false }) {
  const [adesso, setAdesso] = useState(() => Date.now())
  const [chiediRifiuto, setChiediRifiuto] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  const prima = Number(order.attesa_cliente?.totale_prima ?? order.total)
  const cambiato = Math.round(prima * 100) !== Math.round(Number(order.total) * 100)
  const finito = scaduta(order, adesso)
  const minuti = minutiRimasti(order, adesso)

  return (
    <div className="card modifica-da-confermare" role="region" aria-label="Modifiche da confermare">
      <h3 style={{ marginTop: 0 }}>Il locale ha modificato il tuo ordine</h3>
      <p style={{ margin: '0 0 8px' }}>
        Controlla il riepilogo qui sotto.
        {cambiato && (
          <>
            {' '}
            Il totale passa da <strong>{formatPrice(prima)}</strong> a <strong>{formatPrice(order.total)}</strong>.
          </>
        )}
      </p>
      {finito ? (
        <p className="muted" style={{ margin: 0 }}>
          Il tempo per rispondere è scaduto: l’ordine viene annullato.
        </p>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {minuti === 1 ? 'Resta 1 minuto' : `Restano ${minuti} minuti`} per rispondere; poi l’ordine si annulla.
          </p>
          <div className="grid-2">
            <button className="btn ghost" disabled={inCorso} onClick={() => setChiediRifiuto(true)}>
              Rifiuta
            </button>
            <button className="btn" disabled={inCorso} onClick={() => onRispondi('accettato')}>
              Accetta
            </button>
          </div>
        </>
      )}
      {chiediRifiuto && (
        <ConfirmDialog
          title="Rifiutare le modifiche?"
          message="L’ordine viene annullato."
          confirmLabel="Rifiuta e annulla"
          cancelLabel="Torna indietro"
          onCancel={() => setChiediRifiuto(false)}
          onConfirm={() => {
            setChiediRifiuto(false)
            onRispondi('rifiutato')
          }}
        />
      )}
    </div>
  )
}
