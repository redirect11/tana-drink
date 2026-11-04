// LO STILE DEL MENÙ DEI CLIENTI (REQ-MENU-021). L'utente, 30/10/2026: «La
// home deve essere più elegante. Dobbiamo definire diversi temi che il
// titolare può scegliere», e poi «ovviamente il tema base lascialo».
//
// Lo stile è la FORMA del menù — impaginazione, caratteri, movimento — e
// non i colori: quelli restano del tema del menù clienti (themes.js), così
// i due si combinano. Fa eccezione «Lavagna», che senza la lavagna non è
// niente: i suoi colori li porta lei.
//
// Vale solo per chi ordina: per chi lavora il menù è uno strumento, e resta
// quello classico.
//
// TRE MODI DI AVERE UNO STILE (REQ-LIC-010, REQ-MENU-022):
//   · `sempre` — di tutti, senza fare niente: «Classico»;
//   · `gratis` — nel catalogo dell'app: si installa con un tasto, senza
//     pagare né passare dalla regia (l'utente, 02/11/2026: «su quelli gratis
//     non facciamo partire stripe ovviamente. Facciamo solo installare il
//     tema»). Quelli installati stanno nelle impostazioni del locale
//     (`stili_installati`): sono gratis, e non c'è niente da proteggere;
//   · `inLicenza` — solo dove la licenza lo nomina in `temi`: gli
//     esclusivi («Notte» è della Tana: «sono esclusive loro») e, un domani,
//     quelli comprati. La licenza dall'app non la scrive nessuno (BUG-125),
//     quindi un `stile_menu` scritto dalla console non li accende.
// Uno stile che il locale non ha non si applica: resta il classico.
import { licenzaDi } from './licenzaInVigore.js'

export const STILI_MENU = [
  {
    id: 'classico',
    nome: 'Classico',
    sempre: true,
    desc: 'Il menù a card, con le immagini dei prodotti e il carosello degli Special.',
  },
  {
    id: 'notte',
    nome: 'Notte',
    inLicenza: true,
    // Porta con sé i disegni dei drink (disegniDelLocale).
    disegni: true,
    desc: 'Carta a righe, senza riquadri, con titoli sottili; gli Special scorrono a tutto schermo, uno per volta.',
  },
  {
    id: 'lavagna',
    nome: 'Lavagna',
    gratis: true,
    desc: 'La lavagna del bistrot: scritte a mano, righe a gessetto, prezzi allineati a destra. Porta i suoi colori.',
  },
  {
    id: 'deco',
    nome: 'Déco',
    gratis: true,
    desc: 'Anni Venti: caratteri alti e sottili, cornici geometriche, impaginazione simmetrica.',
  },
  {
    id: 'riviera',
    nome: 'Riviera',
    gratis: true,
    desc: 'Da aperitivo all’aperto: titoli in corsivo, disegni nei cerchi, strisce colorate.',
  },
  {
    id: 'giornale',
    nome: 'Giornale',
    gratis: true,
    desc: 'La carta stampata: titoli grandi in serif, filetti, voci in colonna come un quotidiano.',
  },
]

export const STILE_PREDEFINITO = 'classico'

const perId = (id) => STILI_MENU.find((s) => s.id === id) || null
export const nomeStile = (id) => perId(id)?.nome || id

// I temi che la licenza dà: l'elenco `temi`, o nessuno.
export function temiInLicenza(settings) {
  const temi = licenzaDi(settings)?.temi
  return Array.isArray(temi) ? temi.filter((t) => typeof t === 'string') : []
}

// Gli stili gratis che il locale ha installato.
export function stiliInstallati(settings) {
  const ids = Array.isArray(settings?.stili_installati) ? settings.stili_installati : []
  return ids.filter((id) => perId(id)?.gratis)
}

// Il locale ha questo stile?
function haStile(settings, s) {
  if (s.sempre) return true
  if (s.gratis) return stiliInstallati(settings).includes(s.id)
  if (s.inLicenza) return temiInLicenza(settings).includes(s.id)
  return false
}

// Gli stili che questo locale può usare, nell'ordine del catalogo.
export const stiliDisponibili = (settings) => STILI_MENU.filter((s) => haStile(settings, s))

// I DISEGNI DEI DRINK SONO DEL LOCALE CHE HA «NOTTE» (REQ-LIC-013). Le
// illustrazioni di Alice e i disegni composti (illustrazioneDrink.js) sono
// nati con lo stile esclusivo della Tana. L'utente, 04/11/2026: «le
// immagini dei drink che abbiamo fatto sono solo per lo stile Notte che
// abbiamo fatto in esclusiva per la Tana», e poi «quelli stilizzati per
// Notte sono della Tana, ma può riutilizzarli Flavio se cambia stile».
// Quindi vanno col LOCALE, non con lo stile in uso: chi ha Notte nella
// licenza li vede in ogni stile; gli altri locali in nessuno, e al loro
// posto c'è il segnaposto (speciali.js). Le foto sono un'altra cosa: le
// carica chiunque e si vedono in ogni stile.
export const disegniDelLocale = (settings) => STILI_MENU.some((s) => s.disegni && haStile(settings, s))

export function stileMenu(settings) {
  const id = settings?.stile_menu
  return stiliDisponibili(settings).some((s) => s.id === id) ? id : STILE_PREDEFINITO
}

// LA PROVA SUL PROPRIO MENÙ: chi lavora apre il menù del cliente con uno
// stile che ha o che potrebbe installare, solo per sé (`?vista=cliente&
// stile=…`). Un esclusivo che il locale non ha non si prova: non c'è.
export function stileProvabile(settings, id) {
  const s = perId(id)
  return Boolean(s && (haStile(settings, s) || s.gratis))
}

// Installare e disinstallare: la patch delle impostazioni. Disinstallando
// lo stile in uso si torna al classico, invece di lasciare scritto uno
// stile che non c'è più.
export function patchInstalla(settings, id) {
  if (!perId(id)?.gratis) return null
  return { stili_installati: [...new Set([...stiliInstallati(settings), id])] }
}

export function patchDisinstalla(settings, id) {
  const patch = { stili_installati: stiliInstallati(settings).filter((x) => x !== id) }
  if (settings?.stile_menu === id) patch.stile_menu = STILE_PREDEFINITO
  return patch
}
