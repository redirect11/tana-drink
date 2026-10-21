/* global __CLIENTE__ */
// ── IL LOCALE È UN DATO (REQ-VENUE-001) ───────────────────────────────
//
// Nome, slogan, indirizzo, email, ragione sociale, social: quello che
// prima era scritto nel codice in dieci posti diversi. Viene da due
// strati, e vince il più vicino al locale:
//   1. la BUILD: `clienti/<slug>/venue.json`, iniettato da Vite come
//      `__CLIENTE__` (clienti/pluginCliente.js). Senza CLIENTE è la Tana;
//   2. le IMPOSTAZIONI: `settings/bar`, chiavi `venue_*`. Un locale che le
//      scrive da Impostazioni cambia nome e indirizzo senza rebuild.
// Sotto a tutti e due una riserva NEUTRA, senza nessuna parola della Tana:
// è quello che si vede se qualcuno compila senza cartella e senza
// impostazioni, e non deve essere un altro locale.
//
// Logica pura: niente Firebase, niente React.

const BUILD = typeof __CLIENTE__ !== 'undefined' ? __CLIENTE__ : { slug: 'tana', venue: {} }

// Lo slug del cliente per cui è stata compilata questa app.
export const CLIENTE = BUILD.slug

export const VENUE_NEUTRO = Object.freeze({
  venue_name: 'Il locale',
  venue_short_name: 'Locale',
  venue_tagline: '',
  venue_about: '',
  venue_city: '',
  venue_email: '',
  venue_email_domain: '',
  venue_legal_name: '',
  venue_address: '',
  venue_postal_city: '',
  venue_description: '',
  venue_theme_color: '#0e0e15',
  venue_socials: [],
})

export const CHIAVI_VENUE = Object.keys(VENUE_NEUTRO)

// Le stesse chiavi, vuote: è la forma in DEFAULT_SETTINGS, dove «vuoto»
// vuol dire «vale la build».
export const VENUE_VUOTO = Object.freeze(
  Object.fromEntries(CHIAVI_VENUE.map((k) => [k, k === 'venue_socials' ? [] : '']))
)

const vuoto = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

// Il locale, impostazione per impostazione: le impostazioni vincono sulla
// build, la build sulla riserva neutra. Una chiave vuota non cancella
// quella sotto.
export function venueDi(settings) {
  const out = { ...VENUE_NEUTRO }
  for (const k of CHIAVI_VENUE) {
    if (!vuoto(BUILD.venue?.[k])) out[k] = BUILD.venue[k]
    if (!vuoto(settings?.[k])) out[k] = settings[k]
  }
  return out
}

// Il locale della build, senza impostazioni: è la riserva di chi non ha
// le impostazioni in mano (il nome dell'app prima che arrivino, i default
// dello scontrino).
export const venuePredefinito = () => venueDi(null)

// L'intestazione dello scontrino (REQ-VENUE-003): i quattro campi che
// printer.js stampa in testa e in coda.
export function intestazioneScontrino(venue) {
  return {
    businessName: venue.venue_name,
    businessAddress: venue.venue_address,
    businessCity: venue.venue_postal_city,
    businessFooter: venue.venue_legal_name,
  }
}

// I social come li scrive il locale in Impostazioni: una riga per social,
// «piattaforma indirizzo». Da e verso l'elenco di oggetti.
export function socialDaTesto(testo) {
  return String(testo || '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [piattaforma, ...resto] = r.split(/\s+/)
      const href = resto.join(' ')
      return href ? { piattaforma: piattaforma.toLowerCase(), href } : { piattaforma: 'link', href: piattaforma }
    })
}

export const socialInTesto = (socials) =>
  (socials || []).map((s) => `${s.piattaforma || 'link'} ${s.href || ''}`.trim()).join('\n')
