import { useState } from 'react'
import { Sottosezioni } from '../lib/sottosezioni.js'
import Didascalia from './Didascalia.jsx'
import MacroMonthlyTab from './MacroMonthlyTab.jsx'
import AcquistiFatturato from './AcquistiFatturato.jsx'
import MesiBilancio from './MesiBilancio.jsx'

// ── BILANCIO: I CONTI DEL LOCALE ─────────────────────────────────────
// Qui sta quello che Flavio teneva su ANALISI DATI.xlsx: incassi, stipendi,
// spese, netto del mese. È un'altra cosa dalle STATISTICHE, che raccontano
// com'è andata ieri sera e le guarda chi lavora — questi sono i conti di
// chi il locale lo paga. Stavano nella stessa pagina solo perché sono
// tutti e due «numeri», e non è un motivo.
//
// La pagina la vede il solo admin, e il filtro sta in `lib/sezioni.js`:
// la voce si toglie dal menu invece di aprirsi e dire «non puoi».
//
// LE SOTTOSEZIONI STANNO NEL MENU, non in una riga di schede sopra il
// contenuto (docs/navigazione.md): su una schermata fatta di tabelle una
// riga in più costa altezza tutto il giorno.
const SEZIONI_BILANCIO = [
  { id: 'mesi', icona: '📅', label: 'Mesi' },
  { id: 'acquisti', icona: '📥', label: 'Acquisti × Fatturato' },
  { id: 'venduto', icona: '🗂️', label: 'Venduto × Incassato' },
]

export default function BilancioTab() {
  const [sub, setSub] = useState('mesi')
  return (
    <div>
      <Sottosezioni voci={SEZIONI_BILANCIO} attiva={sub} scegli={setSub} />
      {sub === 'mesi' && <Mesi />}
      {sub === 'acquisti' && <AcquistiFatturato />}
      {sub === 'venduto' && <VendutoIncassato />}
    </div>
  )
}

// Bilancio → Mesi (REQ-CASSA-011): il mese come i fogli di analisi.
function Mesi() {
  return <MesiBilancio />
}

// «Venduto × Incassato» è la tabella che stava nelle Statistiche: il
// TRASLOCO è un cambio di posto, non di contenuto. Quanto ha reso ogni
// macro è una domanda da conti di fine mese, non da serata — chi apre le
// Statistiche vuole sapere com'è andata ieri, chi apre il Bilancio com'è
// andato il mese.
function VendutoIncassato() {
  return <MacroMonthlyTab />
}
