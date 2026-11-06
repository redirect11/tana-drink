// ── GLI STILI STRUTTURATI DEL MENÙ (REQ-MENU-028) ─────────────────────────
//
// Uno stile che disegna il menù a modo suo si aggancia qui, con una riga,
// e riceve dal menù il pacchetto descritto in src/lib/contrattoStile.js.
//   · Testata — quello che sta in cima, al posto dell'apertura classica;
//   · Corpo   — il menù vero e proprio, al posto di carosello, schede e card;
//   · segno   — il segno dei disegni dei drink (illustrazioneDrink.js), lo
//               stesso nel corpo e nel dettaglio della voce;
//   · carosello — gli Special nel menù li mostra il carosello di sempre, in
//               cima, e lo stile li riceve solo sulla pagina Special;
//   · chiaro  — lo stile disegna su un fondo chiaro suo (le carte bianche),
//               qualunque sia il tema: i disegni dei drink vanno col tratto
//               scuro, se no sul bianco quasi spariscono;
//   · Vetrina — lo stile in miniatura per la scheda del Marketplace, con
//               le voci d'esempio che gli passa (`voci`): la vetrina non può
//               mostrare card che lo stile non ha. Stava nel Marketplace,
//               un `if` per stile, e per «Carte» ne rifaceva il markup.
// Uno stile che non è qui è «a veste»: il menù classico, vestito dal CSS.
import MenuCarte, { TestataCarte, VetrinaCarte } from './MenuCarte.jsx'
import MenuGiornale, { TestataGiornale, VetrinaGiornale } from './MenuGiornale.jsx'

// «Carte» è della Tana, e ne tiene il segno: i disegni di Tenniel, che con
// le carte da gioco sono a casa loro. Gli Special restano al carosello:
// l'utente, 06/11/2026, «il menù special deve essere sempre separato con il
// carosello in alto e le immagini Lewis Carroll dei drink» (e il Jolly nel
// mazzo ripeteva la sezione Signature: «sono la stessa cosa»).
export const STILI_STRUTTURATI = Object.freeze({
  giornale: Object.freeze({ Testata: TestataGiornale, Corpo: MenuGiornale, Vetrina: VetrinaGiornale, segno: 'incisione' }),
  carte: Object.freeze({ Testata: TestataCarte, Corpo: MenuCarte, Vetrina: VetrinaCarte, segno: 'tenniel', carosello: true, chiaro: true }),
})

export const strutturaDi = (stile) => STILI_STRUTTURATI[stile] || null
