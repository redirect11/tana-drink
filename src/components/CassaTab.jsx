import { useState } from 'react'
import CashFlow from './CashFlow.jsx'
import OrdersHistory from './OrdersHistory.jsx'
import CashSessionsList from './CashSessionsList.jsx'
import { Sottosezioni } from '../lib/sottosezioni.js'

// ── LA CASSA: il flusso, i conti, le chiusure ────────────────────────
//
// Erano tre posti diversi per la stessa domanda — «quanto ho incassato» —
// e due di essi si raggiungevano da tasti in fondo alla pagina del flusso,
// che si trovano solo scorrendo fino in fondo. La lista ordini aveva
// perfino una voce sua nel menu, accanto alla cassa, come se fosse un
// altro mestiere.
//
// Ora è una pagina sola con tre sottosezioni, nel menu laterale insieme
// alle altre: si apre sul flusso, che è la schermata della serata in
// corso.
const SEZIONI = [
  { id: 'flusso', icona: '💶', label: 'Flusso' },
  { id: 'ordini', icona: '📋', label: 'Lista ordini' },
  { id: 'chiusure', icona: '📒', label: 'Chiusure' },
]

export default function CassaTab({ canManageStaff = false, sezioneIniziale = 'flusso' }) {
  const [sezione, setSezione] = useState(sezioneIniziale)
  return (
    <div>
      <Sottosezioni voci={SEZIONI} attiva={sezione} scegli={setSezione} />
      {sezione === 'ordini' ? (
        <OrdersHistory />
      ) : sezione === 'chiusure' ? (
        <CashSessionsList />
      ) : (
        <CashFlow canManageStaff={canManageStaff} />
      )}
    </div>
  )
}
