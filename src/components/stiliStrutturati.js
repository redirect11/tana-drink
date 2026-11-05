// ── GLI STILI STRUTTURATI DEL MENÙ (REQ-MENU-028) ─────────────────────────
//
// Uno stile che disegna il menù a modo suo si aggancia qui, con una riga,
// e riceve dal menù il pacchetto descritto in src/lib/contrattoStile.js.
//   · Testata — quello che sta in cima, al posto dell'apertura classica;
//   · Corpo   — il menù vero e proprio, al posto di carosello, schede e card;
//   · segno   — il segno dei disegni dei drink (illustrazioneDrink.js), lo
//               stesso nel corpo e nel dettaglio della voce.
// Uno stile che non è qui è «a veste»: il menù classico, vestito dal CSS.
import MenuGiornale, { TestataGiornale } from './MenuGiornale.jsx'

export const STILI_STRUTTURATI = Object.freeze({
  giornale: Object.freeze({ Testata: TestataGiornale, Corpo: MenuGiornale, segno: 'incisione' }),
})

export const strutturaDi = (stile) => STILI_STRUTTURATI[stile] || null
