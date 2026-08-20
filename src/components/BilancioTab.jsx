import { useState } from 'react'
import { Sottosezioni } from '../lib/sottosezioni.js'
import Didascalia from './Didascalia.jsx'
import MacroMonthlyTab from './MacroMonthlyTab.jsx'

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

// Una sottosezione che c'è nel menu ma non ha ancora la sua tabella. Dice
// che numero ci sarà — così chi apre il Bilancio sa già cosa aspettarsi —
// invece di una pagina bianca che sembra rotta.
function InArrivo({ titolo, cosa, didascalia }) {
  return (
    <div className="card">
      <strong>{titolo}</strong>
      <div className="empty" style={{ marginTop: 8 }}>
        {cosa}
      </div>
      <Didascalia>{didascalia}</Didascalia>
    </div>
  )
}

function Mesi() {
  return (
    <InArrivo
      titolo="📅 Mesi"
      cosa="La tabella del mese sta arrivando."
      didascalia={
        <>
          Giorno per giorno: il <strong>minimo</strong> (quanto doveva fare il
          locale quella sera), l’<strong>incassato</strong> (quanto ha fatto
          davvero) e la differenza fra i due. Sotto, i conti del mese —
          incassi, stipendi, spese e il <strong>netto</strong>, cioè quello che
          resta dopo aver pagato tutti. Gli stipendi non si ricopiano da
          nessun foglio: escono dalle ore registrate nell’app.
        </>
      }
    />
  )
}

function AcquistiFatturato() {
  return (
    <InArrivo
      titolo="📥 Acquisti × Fatturato"
      cosa="La tabella degli acquisti sta arrivando."
      didascalia={
        <>
          Quanta merce è entrata dalla porta e quanto ha reso, gruppo per
          gruppo e mese per mese. <strong>Da sapere prima di guardarla</strong>:
          si riempie da quando gli ordini fornitore passano dall’app, quindi i
          primi mesi saranno mezzi vuoti — dello storico non si ricostruisce
          niente, e un totale basso lì dentro vuol dire «non l’ho ancora
          scritto», non «non ho comprato».
        </>
      }
    />
  )
}

// «Venduto × Incassato» è la tabella che stava nelle Statistiche: il
// TRASLOCO è un cambio di posto, non di contenuto. Quanto ha reso ogni
// macro è una domanda da conti di fine mese, non da serata — chi apre le
// Statistiche vuole sapere com'è andata ieri, chi apre il Bilancio com'è
// andato il mese.
function VendutoIncassato() {
  return <MacroMonthlyTab />
}
