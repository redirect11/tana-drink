// ── GLI SPECIAL DELLA CASA (REQ-MENU-018) ─────────────────────────────
//
// L'utente, 29/10/2026, per Flavio: «i drink della casa vengano messi in
// una categoria special. L'idea è che si porta un menu a tavola con un qr
// code specifico che apre la pagina menu dove ci sono solo gli special
// drink. Il qr code ai tavoli invece apre il menu normale dove in alto a
// tutto ci deve essere un carousel degli special drink che se cliccato ti
// porta al menu dei drink speciali». E i primi sono «a tema Alice nel paese
// delle meraviglie», con «immagini stilizzate».
//
// UN SEGNO SULLA VOCE, NON UNA CATEGORIA. Un drink della casa è anche un
// cocktail: con una categoria «Special» sarebbe uscito dalla sua, e la
// marginalità, le statistiche e il POS l'avrebbero contato altrove. Così
// resta dov'è, e in più compare negli Special.
//
// Logica pura, interamente testabile.

import { urlDrink } from './illustrazioneDrink.js'

export const PERCORSO_SPECIALI = '/menu/special'

// Le illustrazioni pronte (public/illustrazioni/alice/, generate da
// scripts/illustrazioni-alice.mjs): si usano quando la voce non ha una foto.
// Ognuna in due versioni: `<id>.svg` col tratto bianco per i temi scuri del
// menù (quelli di partenza), `<id>-chiaro.svg` col tratto scuro per i temi
// chiari. L'utente, 29/10/2026: «anche il resto del menu dovrebbe essere
// coerente con i colori … disegni bianchi su fondo scuro».
export const ILLUSTRAZIONI = [
  { id: 'bevimi', nome: 'Bottiglia «Bevimi»' },
  { id: 'tazza-te', nome: 'Tazza del tè' },
  { id: 'cappello', nome: 'Cappello del Cappellaio' },
  { id: 'orologio', nome: 'Orologio del Bianconiglio' },
  { id: 'fungo', nome: 'Fungo del Bruco' },
  { id: 'rosa', nome: 'Rosa dipinta' },
  { id: 'stregatto', nome: 'Sorriso dello Stregatto' },
  { id: 'cuori', nome: 'Cuore della Regina' },
]

// L'indirizzo di un'illustrazione, o null se l'id non è fra quelle pronte:
// un id sbagliato non deve diventare un'immagine rotta in carta.
export function illustrazioneUrl(id, base = '/', { chiaro = false } = {}) {
  return ILLUSTRAZIONI.some((i) => i.id === id)
    ? `${base}illustrazioni/alice/${id}${chiaro ? '-chiaro' : ''}.svg`
    : null
}

// L'immagine di una voce: la foto, se c'è, vince sul disegno. Il disegno
// è COMPOSTO (bicchiere, colore, decorazione: lib/illustrazioneDrink.js);
// un id di testo è un disegno della prima versione, a soggetti fissi, che
// si continua a mostrare finché non lo si cambia.
// I DISEGNI SOLO CON `disegni` (REQ-LIC-013, disegniDelLocale in
// stileMenu.js): sono del locale che ha «Notte». Il valore di partenza è
// «no», perché un chiamante che se ne dimentica non regali l'esclusiva.
export function immagineVoce(d, base = '/', { disegni = false, ...opzioni } = {}) {
  if (d?.image_url) return d.image_url
  if (!disegni) return null
  const il = d?.illustrazione
  if (il && typeof il === 'object') return urlDrink(il, opzioni)
  return illustrazioneUrl(il, base, opzioni)
}

// IL SEGNAPOSTO: un bicchiere al tratto, neutro, dove una voce senza foto
// (e senza disegno) avrebbe il riquadro vuoto. L'utente, 04/11/2026, per
// gli stili e i locali senza disegni: «un bicchiere neutro». Prima c'era
// il logo del locale, e il logo ripetuto su ogni voce faceva il menù
// giocattolo. Un `data:` URL come i disegni, in due versioni del tratto.
const TRATTO_SEGNAPOSTO = { scuro: '#a49cab', chiaro: '#6e6674' }
const segnaposto = {}
export function segnapostoDrink({ chiaro = false } = {}) {
  const chiave = chiaro ? 'chiaro' : 'scuro'
  if (!segnaposto[chiave]) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="${TRATTO_SEGNAPOSTO[chiave]}" ` +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 16h34L32 35z"/><path d="M21 23h22"/><path d="M32 35v15"/><path d="M23 50h18"/></svg>'
    segnaposto[chiave] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }
  return segnaposto[chiave]
}

// Gli special, in ordine di nome.
export function drinkSpeciali(drinks) {
  return (drinks || [])
    .filter((d) => d?.speciale === true)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
}

// UNA SEZIONE FATTA SOLO DI SPECIAL (i «Signature» della Tana): è «la carta
// degli Special». L'utente, 11/11/2026: «Signature e special… dovrebbero
// essere la stessa cosa». È la stessa sezione che si apre dal carosello e
// dal QR del menù Special, e che il locale può tenere fuori dal menù.
export const soloSpecial = (voci) => Array.isArray(voci) && voci.length > 0 && voci.every((v) => v?.speciale === true)

// IL MENÙ SENZA LE SEZIONI DI SOLI SPECIAL (`special_nel_menu`, spento di
// partenza: «di default il menù signature/special si vede solo se clicchi
// sul carosello o con il QR code»). Le sezioni sono `[nome, voci, sezione]`,
// come le prepara MenuPage. Se toglierle lascerebbe il menù vuoto, restano:
// un menù di soli Special non può sparire.
export function senzaSoliSpecial(sezioni) {
  const resto = sezioni.filter(([, voci]) => !soloSpecial(voci))
  return resto.length ? resto : sezioni
}

// Da un menù all'altro passano il tavolo e il gruppo del QR (e l'anteprima
// del cliente): chi ordina dagli Special ordina dallo stesso tavolo.
const DA_PORTARE = ['tavolo', 'table', 'group', 'vista']
export function conParametri(percorso, params) {
  const p = new URLSearchParams()
  for (const k of DA_PORTARE) {
    const v = params?.get?.(k)
    if (v) p.set(k, v)
  }
  const qs = p.toString()
  return qs ? `${percorso}?${qs}` : percorso
}
