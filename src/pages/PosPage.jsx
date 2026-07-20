import OrderPosDetail from '../components/OrderPosDetail.jsx'

// ── POS cassa: CREAZIONE di un ordine nuovo ────────────────────────────────
// Stessa identica schermata della modifica: un solo componente
// (OrderPosDetail) che senza `order` lavora in creazione. Vedi lì la logica.
export default function PosPage() {
  return <OrderPosDetail order={null} />
}
