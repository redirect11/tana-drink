import { Link } from 'react-router-dom'
import OrderPosDetail from '../components/OrderPosDetail.jsx'
import { useCashSession } from '../lib/cashSession.js'

// ── POS cassa: CREAZIONE di un ordine nuovo ────────────────────────────────
// Stessa identica schermata della modifica: un solo componente
// (OrderPosDetail) che senza `order` lavora in creazione. Vedi lì la logica.
//
// SENZA CASSA APERTA non si battono ordini: la numerazione e gli incassi
// seguono la sessione di cassa, quindi si parte da lì.
export default function PosPage() {
  const { open, loading } = useCashSession()

  if (loading) return <div className="empty">Verifico la cassa…</div>

  if (!open) {
    return (
      <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>🔴 Cassa chiusa</h3>
        <p className="muted" style={{ margin: '8px 0 14px' }}>
          Per battere ordini bisogna prima <strong>aprire la cassa</strong>: il
          progressivo degli ordini e gli incassi della serata seguono la
          sessione di cassa.
        </p>
        <Link className="btn block" to="/bar?tab=pagamenti">
          🟢 Vai ad aprire la cassa
        </Link>
        <Link className="btn ghost small block" style={{ marginTop: 8 }} to="/bar">
          ← Torna agli ordini
        </Link>
      </div>
    )
  }

  return <OrderPosDetail order={null} />
}
