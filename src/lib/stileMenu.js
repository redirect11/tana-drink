// LO STILE DEL MENÙ DEI CLIENTI (REQ-MENU-021). L'utente, 30/10/2026: «La
// home deve essere più elegante. Dobbiamo definire diversi temi che il
// titolare può scegliere», e poi «ovviamente il tema base lascialo».
//
// Lo stile è la FORMA del menù — impaginazione, caratteri, movimento — e
// non i colori: quelli restano del tema del menù clienti (themes.js), così
// i due si combinano. «Classico» è il menù di sempre ed è il predefinito;
// «Notte» è la carta stampata al buio, con gli Special in scene a tutto
// schermo che scorrono (ispirato a Mùn Rooftop, Roma).
//
// Vale solo per chi ordina: per chi lavora il menù è uno strumento, e resta
// quello classico.
export const STILI_MENU = [
  {
    id: 'classico',
    nome: 'Classico',
    desc: 'Il menù a card, con le immagini dei prodotti e il carosello degli Special.',
  },
  {
    id: 'notte',
    nome: 'Notte',
    desc: 'Carta a righe, senza riquadri, con titoli sottili; gli Special scorrono a tutto schermo, uno per volta.',
  },
]

export const STILE_PREDEFINITO = 'classico'

export function stileMenu(settings) {
  const id = settings?.stile_menu
  return STILI_MENU.some((s) => s.id === id) ? id : STILE_PREDEFINITO
}
