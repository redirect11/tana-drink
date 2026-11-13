import { useEffect, useState } from 'react'
import { subscribeSettings, settingsIniziali } from '../lib/api.js'
import { voceVisibile } from '../lib/licenza.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { FornitoriPanel } from './InventoryManager.jsx'
import PurchaseOrdersPanel from './PurchaseOrdersPanel.jsx'
import SupplierInvoicesPanel from './SupplierInvoicesPanel.jsx'
import AltreSpesePanel from './AltreSpesePanel.jsx'
import RiepilogoFornitoriPanel from './RiepilogoFornitoriPanel.jsx'

// ── FORNITORI: chi ci vende, cosa gli abbiamo ordinato, cosa dobbiamo ──
//
// Chiesto dall'utente il 26/08/2026: «Dobbiamo spostare Fornitori come
// sezione a parte, e sotto Fornitori andrà la sottosezione Gestione
// Fornitori, lo Scadenzario e Ordini (che attualmente è sottosezione di
// magazzino)».
//
// PERCHÉ NON STAVANO BENE NEL MAGAZZINO. Il magazzino risponde a «cosa ho
// sullo scaffale»; queste tre rispondono a «con chi lavoro e quanto gli
// devo». Erano tre sottosezioni sparse in mezzo a prodotti e categorie, e
// non si parlavano: si ordinava di là, si segnava la fattura di qua, e
// quale fattura pagasse quale ordine non lo sapeva nessuno (è la stessa
// osservazione da cui nasce REQ-MAG-025).
//
// COME SI AGGIUNGE UNA SOTTOSEZIONE QUI: una voce in SEZIONI e un ramo nel
// corpo, come in CassaTab. Se la voce è una funzione premium, il suo id va
// messo nella tabella di `lib/licenza.js` e il filtro qui sotto la toglie
// da solo — non serve un `if` in più.
// ── ORDINI: DUE SOTTOSEZIONI AL POSTO DI UNA (REQ-MAG-038) ──────────
//
// «La sottosezione Ordini si divide in due: NUOVO ORDINE è la schermata di
// composizione, e nasce LISTA ORDINI, che conterrà lo storico di tutti gli
// ordini fatti, filtrabile per stato dell'ordine» (utente, 27/08/2026).
//
// Erano una schermata sola, con la composizione in alto e lo storico in
// fondo: per guardare un ordine di ieri bisognava scorrere sotto seicento
// righe di catalogo, e per ordinare bisognava passare accanto a tutti gli
// ordini già fatti. Sono due lavori diversi e si fanno in momenti diversi.
const SEZIONI = [
  { id: 'anagrafica', icona: 'fornitori', label: 'Gestione fornitori' },
  { id: 'nuovo-ordine', icona: 'carrello', label: 'Nuovo ordine' },
  { id: 'lista-ordini', icona: 'elenco', label: 'Lista ordini' },
  // Funzione premium (REQ-LIC-001): dove il modulo non lavora, la voce non
  // c'è. Le altre due restano, quindi la sezione non resta mai vuota.
  { id: 'scadenzario', icona: 'calendario', label: 'Scadenzario' },
  // ALTRE SPESE E RIEPILOGO (REQ-MAG-034, ritagliati da REQ-MAG-025). Non
  // se ne inventa un modulo: il riepilogo mette insieme quello che c'è. Le
  // altre spese stanno col magazzino come gli ordini (lib/licenza.js,
  // `sezioni`): le regole ne vogliono il modulo, e la sezione Fornitori la
  // apre anche lo scadenzario da solo (REQ-LIC-015), dove restano
  // l'anagrafica, lo scadenzario e il riepilogo.
  { id: 'spese', icona: 'coda', label: 'Altre spese' },
  { id: 'riepilogo', icona: 'statistiche', label: 'Riepilogo' },
]

export default function FornitoriTab({ sezioneIniziale = 'anagrafica' }) {
  const [sezione, setSezione] = useState(sezioneIniziale)
  // Dalla cache, come il magazzino: le voci non devono comparire e sparire
  // mentre il server risponde (local-first, nessuna lettura nuova).
  const [impostazioni, setImpostazioni] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setImpostazioni, () => {}), [])

  const voci = SEZIONI.filter((v) => voceVisibile(impostazioni, v.id))
  // La sezione aperta si RICAVA dall'elenco: se il modulo si spegne da un
  // altro terminale mentre si guarda lo scadenzario, si torna all'anagrafica
  // invece di restare su un pannello che non è più in elenco.
  const attiva = voci.some((v) => v.id === sezione) ? sezione : 'anagrafica'

  return (
    <div>
      <Sottosezioni voci={voci} attiva={attiva} scegli={setSezione} />
      {attiva === 'nuovo-ordine' ? (
        <PurchaseOrdersPanel vista="nuovo" />
      ) : attiva === 'lista-ordini' ? (
        <PurchaseOrdersPanel vista="lista" />
      ) : attiva === 'scadenzario' ? (
        <SupplierInvoicesPanel />
      ) : attiva === 'spese' ? (
        <AltreSpesePanel />
      ) : attiva === 'riepilogo' ? (
        <RiepilogoFornitoriPanel />
      ) : (
        // Il listino di un fornitore è del magazzino: con le sole fatture
        // ai fornitori l'anagrafica resta, senza il tasto che lo apre.
        <FornitoriPanel conListino={voceVisibile(impostazioni, 'listino')} />
      )}
    </div>
  )
}
