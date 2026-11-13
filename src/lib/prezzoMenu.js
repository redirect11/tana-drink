import { createContext, useContext } from 'react'
import { formatPrice } from './orderStatus.js'

// ── IL PREZZO NEL MENÙ DEI CLIENTI (REQ-MENU-038) ──────────────────────────
//
// Flavio, vocale dell'11/11/2026: «togliere il simbolo dell'euro dal menù
// dei clienti. Ci deve stare solo ed esclusivamente il numero. Non ci deve
// stare neanche 0,00. Cioè è 8 euro, 8. 3,50 euro, 3,5… il menù non deve
// portare il simbolo dell'euro e la virgola con il doppio decimale come se
// fosse una valuta». Daniele, lo stesso giorno: «metterei configurabile cosa
// si vede nel menù e renderei default questa impostazione».
//
// È UN'ALTRA FUNZIONE, NON `formatPrice` CON UN'OPZIONE IN PIÙ: `formatPrice`
// scrive i soldi che si incassano — conti, cassa, scontrini, statistiche,
// carrello e pagina dell'ordine — e lì l'importo va per intero. Qui si
// scrive il listino che il cliente legge prima di ordinare. Tenerle
// separate vuol dire che nessuno toglie l'euro da uno scontrino per sbaglio.

// I tre formati (Daniele, 11/11/2026, alla domanda se bastano: «basta»).
// `esempio` è quello che si legge nelle Impostazioni accanto alla scelta.
export const FORMATI_PREZZO_MENU = Object.freeze([
  Object.freeze({ id: 'numero', label: 'Numero', esempio: '8 · 3,5' }),
  Object.freeze({ id: 'centesimi', label: 'Numero con i centesimi', esempio: '8 · 3,50' }),
  Object.freeze({ id: 'valuta', label: 'Importo in euro', esempio: '8,00 € · 3,50 €' }),
])

const DI_PARTENZA = 'numero'

// Il formato scelto dal locale (`formato_prezzi_menu`); senza scelta, o con
// un valore che non si conosce, quello di partenza.
export const formatoPrezziMenu = (settings) =>
  FORMATI_PREZZO_MENU.some((f) => f.id === settings?.formato_prezzi_menu) ? settings.formato_prezzi_menu : DI_PARTENZA

export function prezzoInMenu(value, formato = DI_PARTENZA) {
  if (formato === 'valuta') return formatPrice(value)
  // Al centesimo: un prezzo calcolato (0,1 + 0,2) non deve lasciare code.
  const n = Math.round(Number(value || 0) * 100) / 100
  const intero = Number.isInteger(n)
  return n.toLocaleString('it-IT', {
    // «centesimi»: due decimali quando il prezzo non è tondo (3,50); il
    // prezzo tondo resta senza (8). «numero»: solo i decimali che servono.
    minimumFractionDigits: formato === 'centesimi' && !intero ? 2 : 0,
    maximumFractionDigits: 2,
    // Come in `formatPrice`: il punto delle migliaia non deve dipendere dal
    // dispositivo.
    useGrouping: 'always',
  })
}

// LA FUNZIONE CHE SCRIVE IL PREZZO, PER CHI DISEGNA UNA VOCE DEL MENÙ. La
// mette MenuPage, dalle impostazioni del locale; la leggono le voci di ogni
// stile, il carosello, il dettaglio del drink. Un contesto e non una
// proprietà: i punti dove compare un prezzo sono sette, in cinque componenti
// e tre stili, e una proprietà dimenticata in uno solo lascerebbe l'euro lì.
// Fuori dal menù dei clienti (la vetrina del Marketplace) non c'è un locale
// che abbia scelto: resta l'importo intero, come è sempre stato.
export const PrezzoMenu = createContext(formatPrice)
export const usePrezzoMenu = () => useContext(PrezzoMenu)
