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
//
// UNO STILE PUÒ ESSERE DELLA LICENZA (02/11/2026). L'utente: «lo stile notte
// sia utilizzabile solo da tana-drink e tana-drink-test. Sono esclusive
// loro». Non è un caso speciale per la Tana: uno stile con `inLicenza` c'è
// solo dove la licenza lo nomina in `temi` (`licenza.temi: ['notte']`), e la
// licenza dall'app non la scrive nessuno (BUG-125). Chi si scrive
// `stile_menu: 'notte'` dalla console continua a vedere il classico. È il
// primo pezzo del catalogo dei temi (REQ-LIC-010): un tema comprato è un
// tema che la regia aggiunge a `temi`; uno esclusivo non è in vendita.
import { licenzaDi } from './licenzaInVigore.js'

export const STILI_MENU = [
  {
    id: 'classico',
    nome: 'Classico',
    desc: 'Il menù a card, con le immagini dei prodotti e il carosello degli Special.',
  },
  {
    id: 'notte',
    nome: 'Notte',
    inLicenza: true,
    desc: 'Carta a righe, senza riquadri, con titoli sottili; gli Special scorrono a tutto schermo, uno per volta.',
  },
]

export const STILE_PREDEFINITO = 'classico'

// I temi che la licenza dà: l'elenco `temi`, o nessuno.
export function temiInLicenza(settings) {
  const temi = licenzaDi(settings)?.temi
  return Array.isArray(temi) ? temi.filter((t) => typeof t === 'string') : []
}

// Gli stili che questo locale può usare: quelli di tutti, e quelli che la
// sua licenza nomina. Quelli che non ha non si mostrano nemmeno: un
// esclusivo non è una cosa che si può comprare.
export function stiliDisponibili(settings) {
  const temi = temiInLicenza(settings)
  return STILI_MENU.filter((s) => !s.inLicenza || temi.includes(s.id))
}

export function stileMenu(settings) {
  const id = settings?.stile_menu
  return stiliDisponibili(settings).some((s) => s.id === id) ? id : STILE_PREDEFINITO
}
