// LO STILE DEL MENÙ DEI CLIENTI (REQ-MENU-021). L'utente, 30/10/2026: «La
// home deve essere più elegante. Dobbiamo definire diversi temi che il
// titolare può scegliere», e poi «ovviamente il tema base lascialo».
//
// Lo stile è la FORMA del menù — impaginazione, caratteri, movimento — e
// non i colori: quelli restano del tema del menù clienti (themes.js), così
// i due si combinano. Uno stile può avere una tavolozza sua (`tavolozza`,
// «Lavagna» e «Meraviglie»): la propone il tema del marketplace che lo
// usa, ma resta una tavolozza come le altre, e si cambia (REQ-MENU-027).
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
//   · `aRicetta` — gli STILI A RICETTA (REQ-MENU-031): non scritti qui ma
//     arrivati dalla regia, che il motore disegna. Il locale li ha quando li
//     ha installati (`stili_ricetta`, con la loro copia) o quando ha
//     installato il tema su misura che li porta.
// Uno stile che il locale non ha non si applica: resta il classico.
import { licenzaDi } from './licenzaInVigore.js'
import { stiliRicettaDelLocale, stiliRicettaProvabili, stiliRicordati, leggiStile, vesteRicetta } from './stiliRicetta.js'

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
    id: 'meraviglie',
    nome: 'Meraviglie',
    inLicenza: true,
    disegni: true,
    // Veste tutte le pagine dei clienti, non solo il menù, e ha le sue
    // frasi (testiStile.js).
    pagine: true,
    tavolozza: 'meraviglie',
    desc: 'Un libro illustrato dell’Ottocento: carta avorio, caratteri da stampa d’epoca, capitoli e semi di carte da gioco. Veste anche la home e le altre pagine dei clienti.',
  },
  {
    // L'idea di Flavio (REQ-MENU-029): esclusivo della Tana, come «Notte»
    // e «Meraviglie». Ha una struttura sua (MenuCarte.jsx).
    id: 'carte',
    nome: 'Carte',
    inLicenza: true,
    desc: 'Il menù come un mazzo di carte francesi: ogni sezione è una carta col seme del suo gruppo, e la carta scelta si alza e si apre. Gli Special restano nel carosello in cima.',
  },
  {
    id: 'lavagna',
    nome: 'Lavagna',
    gratis: true,
    tavolozza: 'lavagna',
    desc: 'La lavagna del bistrot: scritte a mano, righe a gessetto, prezzi allineati a destra.',
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

// Uno stile a ricetta nella forma delle voci di STILI_MENU.
const comeStile = (s) => ({ id: s.id, nome: s.nome, desc: s.descrizione, aRicetta: true, ricetta: s.ricetta })

// Lo stile per id, quelli a ricetta compresi: quelli che il locale può
// almeno provare (servono le impostazioni per saperlo).
function stileDi(settings, id) {
  const scritto = perId(id)
  if (scritto) return scritto
  const r = stiliRicettaProvabili(settings).find((s) => s.id === id)
  return r ? comeStile(r) : null
}

export const nomeStile = (id, settings = null) => stileDi(settings, id)?.nome || id

// La ricetta dello stile, se è uno stile a ricetta: è quella che il menù
// disegna, e la sua impaginazione divide il menù in pagine.
export const ricettaDelloStile = (settings, id) => (perId(id) ? null : stileDi(settings, id)?.ricetta || null)

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
  if (s.aRicetta) return stiliRicettaDelLocale(settings).some((r) => r.id === s.id)
  if (s.gratis) return stiliInstallati(settings).includes(s.id)
  if (s.inLicenza) return temiInLicenza(settings).includes(s.id)
  return false
}

// Gli stili che questo locale può usare, nell'ordine del catalogo.
export const stiliDisponibili = (settings) => [
  ...STILI_MENU.filter((s) => haStile(settings, s)),
  ...stiliRicettaDelLocale(settings).map(comeStile),
]

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

// LO STILE CHE SI VEDE, in una schermata. Chi lavora vede il classico: per
// lui il menù è uno strumento. Chi prova uno stile dalla vista cliente
// (`prova`) vede quello, se lo può provare; tutti gli altri lo stile del
// locale. Una funzione sola per il menù e per l'app (che con lo stesso
// risultato veste le altre pagine dei clienti), così non si contraddicono.
export function stileInVista(settings, { lavoro = false, prova = null } = {}) {
  if (prova && stileProvabile(settings, prova)) return prova
  return lavoro ? STILE_PREDEFINITO : stileMenu(settings)
}

// LA VESTE DI UNO STILE su un contenitore: la classe dello stile scritto
// nell'app (`stile-deco`), o il motore con la ricetta (`stile-ricetta`, i
// suoi attributi e le variabili dei caratteri). La usano il menù, le
// vetrine del marketplace e l'assaggio nelle impostazioni, così uno stile a
// ricetta si vede allo stesso modo dappertutto.
export function vesteDelloStile(settings, id) {
  const ricetta = ricettaDelloStile(settings, id)
  if (ricetta) {
    const { attributi, style } = vesteRicetta(ricetta)
    return { className: 'stile-ricetta', attributi, style }
  }
  return { className: id && id !== STILE_PREDEFINITO ? `stile-${id}` : '', attributi: {}, style: {} }
}

// Lo stile veste anche la home, gli ordini e l'accesso, o solo il menù?
export const vestePagine = (id) => Boolean(perId(id)?.pagine)

// LA PROVA SUL PROPRIO MENÙ: chi lavora apre il menù del cliente con uno
// stile che ha o che potrebbe installare, solo per sé (`?vista=cliente&
// stile=…`). Un esclusivo che il locale non ha non si prova: non c'è.
// Uno stile a ricetta si prova se il locale lo ha, se è di un suo tema su
// misura, o se è nel catalogo ricordato: gratis come gli stili dell'app.
export function stileProvabile(settings, id) {
  const s = stileDi(settings, id)
  return Boolean(s && (s.aRicetta || haStile(settings, s) || s.gratis))
}

// Installare e disinstallare: la patch delle impostazioni. Disinstallando
// lo stile in uso si torna al classico, invece di lasciare scritto uno
// stile che non c'è più.
// Uno stile a ricetta del catalogo si installa con la sua copia: se la
// regia lo ritira, resta a chi l'ha. Uno che il locale ha già (anche da un
// suo tema su misura) non si ricopia.
export function patchInstalla(settings, id, catalogo = stiliRicordati()) {
  if (perId(id)?.gratis) return { stili_installati: [...new Set([...stiliInstallati(settings), id])] }
  if (stiliRicettaDelLocale(settings).some((s) => s.id === id)) return null
  const dalCatalogo = catalogo.find((s) => s.id === id)
  if (!dalCatalogo) return null
  return { stili_ricetta: [...stiliRicettaInstallati(settings), dalCatalogo] }
}

// Le copie degli stili a ricetta installati dal catalogo (quelli dei temi
// su misura stanno nel loro tema).
export function stiliRicettaInstallati(settings) {
  const v = Array.isArray(settings?.stili_ricetta) ? settings.stili_ricetta : []
  return v.map(leggiStile).filter(Boolean)
}

export function patchDisinstalla(settings, id) {
  const patch = perId(id)
    ? { stili_installati: stiliInstallati(settings).filter((x) => x !== id) }
    : { stili_ricetta: stiliRicettaInstallati(settings).filter((s) => s.id !== id) }
  if (settings?.stile_menu === id) patch.stile_menu = STILE_PREDEFINITO
  return patch
}
