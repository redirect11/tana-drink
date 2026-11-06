// ── GLI STILI A RICETTA (REQ-MENU-031) ───────────────────────────────────
//
// L'utente, 02/11/2026: «anche gli stili, non limitarti a quelli che
// abbiamo integrato. Creane di nuovi. In qualche modo dobbiamo poter
// caricare anche gli stili», e fra le due strade (una ricetta, o un CSS
// caricato dalla regia) «stile a ricetta», con «una scelta ampia di
// caratteri dentro l'app».
//
// Gli stili scritti nell'app («Déco», «Riviera»…) variano tutti lungo le
// stesse dimensioni: tre caratteri, i titoli, il fregio sotto la categoria,
// la voce a card o in riga, il prezzo, i separatori, le immagini, la
// cornice, gli angoli, lo sfondo. Uno STILE A RICETTA è una scelta fra
// valori fissi su ognuna, e l'app lo disegna con un MOTORE UNICO: le regole
// di `.stile-ricetta` in index.css, che leggono la ricetta dagli attributi
// `data-*` del contenitore del menù (`vesteRicetta`). Ogni valore ha la sua
// regola nell'app: la regia sceglie, l'app disegna. Resta una ricetta, non
// codice: non può rompere il menù e funziona senza rete.
//
// Il contratto con la regia è in docs/stili-a-ricetta.md, e il vocabolario
// è lo stesso di functions/lib/stili.js della regia: un valore in più si
// aggiunge nei due posti, con una versione dell'app. La regia manda la
// ricetta completa e l'ha già controllata; qui la si ricontrolla comunque
// (`leggiStile`, gemella di `leggiTema`): un valore che quest'app non
// conosce scarta lo stile, meglio non mostrarlo che disegnarlo male.
//
// DA DOVE ARRIVANO: dal catalogo della regia (`catalogoTemi` → `stili`),
// ricordato sul dispositivo come i temi; installati, con la loro copia nelle
// impostazioni del locale (`stili_ricetta`); e dai temi su misura
// (REQ-MENU-030), che portano la loro ricetta e si disegnano come uno stile
// con l'id del tema.

import { leggi, scrivi } from './impostazioniLocali.js'
import { licenzaDi } from './licenzaInVigore.js'

// I CARATTERI: tutti dentro la build (src/main.jsx, REQ-SIC-004), coi loro
// ripieghi di sistema. `pieno` dice se c'è il peso 700: chi non ce l'ha
// scrive il nome delle voci al suo peso, invece del grassetto finto che il
// browser ricava allargando il tratto. `scala` ingrandisce le scritture a
// mano, che alla stessa misura degli altri vengono minuscole (lo fa a mano
// anche «Lavagna»): sulla prova del 06/11/2026 i nomi in Caveat del
// «Quaderno» si leggevano a fatica.
export const CARATTERI = {
  caveat: { famiglia: "'Caveat', 'Segoe Print', 'Bradley Hand', cursive", pieno: true, scala: 1.3 },
  'poiret-one': { famiglia: "'Poiret One', 'Jost', 'Futura', sans-serif", pieno: false },
  jost: { famiglia: "'Jost', 'Futura', 'Segoe UI', sans-serif", pieno: true },
  'dancing-script': { famiglia: "'Dancing Script', 'Brush Script MT', cursive", pieno: true, scala: 1.15 },
  'playfair-display': { famiglia: "'Playfair Display', 'Didot', Georgia, serif", pieno: true },
  georgia: { famiglia: "Georgia, 'Times New Roman', 'Noto Serif', serif", pieno: true },
  'cormorant-garamond': { famiglia: "'Cormorant Garamond', Garamond, Georgia, serif", pieno: true },
  'libre-baskerville': { famiglia: "'Libre Baskerville', Baskerville, Georgia, serif", pieno: true },
  'dm-serif-display': { famiglia: "'DM Serif Display', Didot, Georgia, serif", pieno: false },
  'abril-fatface': { famiglia: "'Abril Fatface', 'Bodoni 72', Didot, serif", pieno: false },
  'bebas-neue': { famiglia: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif", pieno: false },
  oswald: { famiglia: "'Oswald', 'Arial Narrow', sans-serif", pieno: true },
  inter: { famiglia: "'Inter', 'Segoe UI', system-ui, sans-serif", pieno: true },
  'space-grotesk': { famiglia: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif", pieno: true },
  'josefin-sans': { famiglia: "'Josefin Sans', 'Futura', 'Segoe UI', sans-serif", pieno: true },
  pacifico: { famiglia: "'Pacifico', 'Brush Script MT', cursive", pieno: false },
  'amatic-sc': { famiglia: "'Amatic SC', 'Segoe Print', cursive", pieno: true, scala: 1.35 },
  'special-elite': { famiglia: "'Special Elite', 'Courier New', monospace", pieno: false },
}

// Le dimensioni della ricetta e i loro valori: il primo vale quando la
// ricetta non lo dice. `impaginazione` è arrivata coi temi su misura
// (REQ-MENU-030): come si divide il menù dei clienti.
export const VALORI = {
  'titoli.allineamento': ['sinistra', 'centro'],
  'titoli.dimensione': ['normale', 'grande', 'enorme'],
  'titoli.spaziatura': ['normale', 'stretta', 'larga'],
  intestazione: ['nessuna', 'filetto', 'doppio-filetto', 'tratteggio', 'punti', 'fregio'],
  'voce.forma': ['card', 'riga', 'colonna'],
  'voce.prezzo': ['accanto', 'sotto', 'puntini'],
  'voce.separatore': ['nessuno', 'filetto', 'tratteggio', 'punti'],
  'voce.immagine': ['tonda', 'quadrata', 'nascosta'],
  cornice: ['nessuna', 'sottile', 'doppia', 'angoli'],
  angoli: ['morbidi', 'vivi', 'tondi'],
  sfondo: ['tinta', 'grana', 'carta', 'gesso', 'righe', 'quadretti'],
  impaginazione: ['unica', 'per-categoria', 'per-macro-categoria'],
}

// Gli stili scritti nell'app: un id di uno stile a ricetta non li copre.
export const STILI_DELL_APP = ['classico', 'notte', 'meraviglie', 'lavagna', 'deco', 'riviera', 'giornale']

const VERSIONE = 1
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/
const COLORE = /^#[0-9a-f]{6}$/i
const CHIAVI_COLORE = ['--bg', '--bg-2', '--card', '--accent', '--accent-2', '--text', '--muted']
const testo = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '')
const valoreDi = (obj, percorso) => percorso.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)

// Una ricetta com'è scritta → la ricetta completa, o null se c'è un valore
// che quest'app non sa disegnare. Un valore che manca prende quello di
// partenza: la regia li manda tutti, ma una ricetta scritta a mano no.
export function leggiRicetta(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || r.versione !== VERSIONE) return null
  const caratteri = {}
  for (const k of ['titolo', 'voce', 'testo']) {
    const c = r.caratteri?.[k]
    if (!Object.hasOwn(CARATTERI, c)) return null
    caratteri[k] = c
  }
  const ricetta = { versione: VERSIONE, caratteri, titoli: {}, voce: {} }
  for (const k of ['maiuscolo', 'corsivo']) {
    const v = r.titoli?.[k]
    if (v !== undefined && typeof v !== 'boolean') return null
    ricetta.titoli[k] = v === true
  }
  for (const [percorso, ammessi] of Object.entries(VALORI)) {
    const v = valoreDi(r, percorso)
    if (v !== undefined && !ammessi.includes(v)) return null
    const [primo, secondo] = percorso.split('.')
    if (secondo) ricetta[primo][secondo] = v ?? ammessi[0]
    else ricetta[primo] = v ?? ammessi[0]
  }
  if (r.colori !== undefined) {
    if (!r.colori || typeof r.colori !== 'object') return null
    const colori = {}
    for (const [k, v] of Object.entries(r.colori)) {
      if (!CHIAVI_COLORE.includes(k) || !COLORE.test(String(v))) return null
      colori[k] = String(v).toLowerCase()
    }
    if (Object.keys(colori).length) ricetta.colori = colori
  }
  return ricetta
}

// Uno stile com'è scritto (dal catalogo, dalle impostazioni) → lo stile da
// usare, o null.
export function leggiStile(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const id = typeof v.id === 'string' && ID.test(v.id) && !STILI_DELL_APP.includes(v.id) ? v.id : null
  const nome = testo(v.nome, 40)
  const ricetta = leggiRicetta(v.ricetta)
  if (!id || !nome || !ricetta) return null
  return { id, nome, descrizione: testo(v.descrizione, 240), prezzo: 0, ricetta }
}

const elenco = (v) => (Array.isArray(v) ? v.map(leggiStile).filter(Boolean) : [])

// ── IL CATALOGO DELLA REGIA ──────────────────────────────────────────
// Arriva con quello dei temi (`{ temi, stili }`) e si ricorda a parte: lo
// legge anche il menù, per la prova di uno stile non ancora installato.
const CHIAVE_STILI = 'drink:catalogo-stili'
export const leggiStiliDelCatalogo = (corpo) => elenco(corpo?.stili)
export const stiliRicordati = () => leggi(CHIAVE_STILI, (s) => elenco(JSON.parse(s)), [])
export const ricordaStili = (stili) => scrivi(CHIAVE_STILI, stili)

// ── GLI STILI A RICETTA DI UN LOCALE ─────────────────────────────────
// Un tema su misura con la sua ricetta è uno stile con l'id del tema
// (docs/temi-su-misura.md): così il suo menù si disegna col motore, e uno
// stile in più non va installato a parte.
const daTema = (t) => (t?.su_misura && t.ricetta ? leggiStile({ id: t.id, nome: t.nome, descrizione: t.descrizione, ricetta: t.ricetta }) : null)

// Quelli che il locale ha: installati dal catalogo, e quelli dei temi su
// misura installati.
export function stiliRicettaDelLocale(settings) {
  const temi = Array.isArray(settings?.temi_installati) ? settings.temi_installati : []
  return unici([...elenco(settings?.stili_ricetta), ...temi.map(daTema).filter(Boolean)])
}

// Quelli che si possono provare sul menù: quelli del locale, quelli dei
// temi su misura della licenza (prima di installarli), e quelli del
// catalogo ricordato.
export function stiliRicettaProvabili(settings, catalogo = stiliRicordati()) {
  const suMisura = licenzaDi(settings)?.temi_su_misura
  const dallaLicenza = Array.isArray(suMisura) ? suMisura.map((t) => daTema({ ...t, su_misura: true })).filter(Boolean) : []
  return unici([...stiliRicettaDelLocale(settings), ...dallaLicenza, ...catalogo])
}

function unici(stili) {
  const visti = new Set()
  return stili.filter((s) => !visti.has(s.id) && visti.add(s.id))
}

// ── LA VESTE: DALLA RICETTA AL CONTENITORE DEL MENÙ ──────────────────
// Gli attributi che le regole del motore leggono, e le variabili dei
// caratteri e dei colori. Una dimensione al valore di partenza non scrive
// niente: il motore disegna sopra il menù classico, e il classico è già
// quello.
export function vesteRicetta(ricetta) {
  const attributi = {}
  const metti = (nome, valore, partenza) => {
    if (valore !== partenza) attributi[`data-${nome}`] = String(valore)
  }
  metti('titoli-maiuscolo', ricetta.titoli.maiuscolo, false)
  metti('titoli-corsivo', ricetta.titoli.corsivo, false)
  for (const percorso of Object.keys(VALORI)) {
    if (percorso === 'impaginazione') continue
    metti(percorso.replace('.', '-'), valoreDi(ricetta, percorso), VALORI[percorso][0])
  }
  const voce = CARATTERI[ricetta.caratteri.voce]
  const titolo = CARATTERI[ricetta.caratteri.titolo]
  const style = {
    '--stile-titolo': titolo.famiglia,
    '--stile-voce': voce.famiglia,
    '--stile-testo': CARATTERI[ricetta.caratteri.testo].famiglia,
    '--peso-voce': voce.pieno ? 700 : 400,
    '--scala-titolo': titolo.scala ?? 1,
    '--scala-voce': voce.scala ?? 1,
  }
  return { attributi, style }
}

// I COLORI PROPRI DELLO STILE stanno sopra quelli del tema (come la lavagna,
// che senza ardesia non è lei): `scelta` è nella forma di `theme_client`.
export function coloriConRicetta(scelta, ricetta) {
  if (!ricetta?.colori) return scelta
  return { ...(scelta || {}), custom: { ...(scelta?.custom || {}), ...ricetta.colori } }
}
