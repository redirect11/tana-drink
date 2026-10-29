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

// L'immagine di una voce: la foto, se c'è, vince sull'illustrazione.
export const immagineVoce = (d, base = '/', opzioni = {}) =>
  d?.image_url || illustrazioneUrl(d?.illustrazione, base, opzioni)

// Gli special, in ordine di nome.
export function drinkSpeciali(drinks) {
  return (drinks || [])
    .filter((d) => d?.speciale === true)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
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
