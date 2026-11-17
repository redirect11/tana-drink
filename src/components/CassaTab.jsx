import { useState } from 'react'
import CashFlow from './CashFlow.jsx'
import OrdersHistory from './OrdersHistory.jsx'
import CashSessionsList from './CashSessionsList.jsx'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { daTradurre, trSegnato, useLingua } from '../lib/lingua.js'

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
  { id: 'flusso', icona: 'cassa', label: daTradurre('Flusso') },
  { id: 'ordini', icona: 'elenco', label: daTradurre('Storico ordini') },
  { id: 'chiusure', icona: 'registro', label: daTradurre('Chiusure') },
]

export default function CassaTab({ sezioneIniziale = 'flusso' }) {
  useLingua()
  const [sezione, setSezione] = useState(sezioneIniziale)
  // Le etichette si traducono qui, a ogni disegno: la tabella sta fuori dal
  // componente, e un `tr` lassù fisserebbe la lingua del primo caricamento.
  const voci = SEZIONI.map((v) => ({ ...v, label: trSegnato(v.label) }))
  return (
    <div>
      <Sottosezioni voci={voci} attiva={sezione} scegli={setSezione} />
      {sezione === 'ordini' ? (
        <OrdersHistory />
      ) : sezione === 'chiusure' ? (
        <CashSessionsList />
      ) : (
        <CashFlow />
      )}
    </div>
  )
}
