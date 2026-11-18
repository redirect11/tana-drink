// ── IL LOCALE DENTRO LE PAGINE (REQ-VENUE-001, REQ-FLOTTA-034, REQ-SIC-017) ─
//
// Quello che il browser legge PRIMA dell'app — il titolo e il colore in
// index.html, il manifest della PWA, l'informativa privacy e cookie — non
// lo può cambiare l'app a runtime: va scritto nei file. Lo si fa in due
// momenti, con le stesse funzioni:
//   - alla COMPILAZIONE per un cliente (clienti/pluginCliente.js, la Tana e
//     le build per locale di oggi);
//   - al DEPLOY del sito uguale per tutti (scripts/personalizza.mjs, che la
//     regia lancia per ogni locale).
// Due copie avrebbero finito per scrivere due locali diversi. Logica pura,
// `.mjs` perché giri anche dentro il pacchetto, dove non c'è il
// package.json del repository a dire che i `.js` sono moduli.

import { ID_BLOCCO } from '../src/porte/configurazioneLocale.mjs'

export { ID_BLOCCO }

// I segnaposti nei file: tutti `%VENUE_…%`. Uno rimasto in un file
// pubblicato è un locale senza nome (o col nome di un altro).
export const SEGNAPOSTO = /%VENUE_[A-Z_]+%/

// I file del set del locale (logo, icone, copertina): quelli che un
// cliente può avere suoi, e che nel sito uguale per tutti sono quelli
// neutri finché personalizza.mjs non mette i suoi.
export const FILE_DEL_SET = [
  'apple-touch-icon.png',
  'cocktail-hero.jpg',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'logo.png',
]

// Le pagine dell'informativa: modelli con i segnaposto del locale.
export const PAGINE_INFORMATIVA = ['privacy-policy.html', 'cookie-policy.html']

export const COLORE_DI_PARTENZA = '#0c0f0a'

const scappa = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const testo = (v) => (typeof v === 'string' ? v.trim() : '')

// La descrizione la scrive quasi nessuno: un cliente appena generato ha
// solo il nome, e index.html e manifest devono dire la stessa cosa.
const descrizione = (venue) => venue.venue_description || venue.venue_tagline || venue.venue_name

// index.html porta dei segnaposto %VENUE_*%: qui diventano il locale.
// OGNI SOSTITUTO È UNA FUNZIONE, mai un testo: in un testo `replace` legge
// `$&`, `$'` e `$$`, e un «$'» scritto dal locale in una descrizione
// copiava nella pagina il resto di index.html (dentro il blocco della
// configurazione: un JSON rotto, cioè il tablet senza locale).
export function htmlPerCliente(html, venue) {
  return html
    .replace(/%VENUE_NAME%/g, () => scappa(venue.venue_name))
    .replace(/%VENUE_DESCRIPTION%/g, () => scappa(descrizione(venue)))
    .replace(/%VENUE_THEME_COLOR%/g, () => scappa(venue.venue_theme_color || COLORE_DI_PARTENZA))
}

// Il manifest della PWA dal modello, col locale dentro. Il nome lo riscrive
// poi l'app a runtime col suffisso del ruolo (lib/nomeApp.js): questo è
// quello che si vede prima che l'app parta, e quello che indicizzano i
// browser.
export function manifestPerCliente(modello, venue) {
  return {
    ...modello,
    name: venue.venue_name,
    short_name: venue.venue_short_name || venue.venue_name,
    description: descrizione(venue),
    background_color: venue.venue_theme_color || modello.background_color,
    theme_color: venue.venue_theme_color || modello.theme_color,
  }
}

// CHI È IL TITOLARE DEL TRATTAMENTO (REQ-SIC-017). Prima era scritto nella
// pagina: EFFEVI, la Tana, in ogni build. Ora lo dicono i dati del locale.
// Quello che manca resta scritto «da inserire», come la partita IVA della
// Tana prima di questa modifica: un buco che si vede e non un dato
// inventato.
const DA_INSERIRE = (cosa) => `<span style="color:var(--muted)">[${cosa} — da inserire]</span>`

function titolare(venue) {
  const nome = testo(venue.venue_name)
  const ragione = testo(venue.venue_legal_name)
  const sede = testo(venue.venue_legal_address) || [testo(venue.venue_address), testo(venue.venue_postal_city)].filter(Boolean).join(', ')
  const piva = testo(venue.venue_vat_number)
  const cf = testo(venue.venue_tax_code)
  const codici = [piva && `P.IVA ${scappa(piva)}`, cf && cf !== piva && `C.F. ${scappa(cf)}`].filter(Boolean).join(' · ')
  return [
    ragione ? `<strong>${scappa(ragione)}</strong>${nome && nome !== ragione ? ` («${scappa(nome)}»)` : ''}` : `<strong>${scappa(nome)}</strong> ${DA_INSERIRE('ragione sociale')}`,
    sede ? `, con sede legale in ${scappa(sede)}` : `, ${DA_INSERIRE('sede legale')}`,
    codici ? ` (${codici})` : ` ${DA_INSERIRE('P.IVA / C.F.')}`,
  ].join('')
}

const contatto = (venue) => {
  const email = testo(venue.venue_email)
  return email ? `<a href="mailto:${scappa(email)}">${scappa(email)}</a>` : DA_INSERIRE('email del titolare')
}

// Una pagina dell'informativa (privacy o cookie) dal suo modello.
export function informativaPerCliente(modello, venue) {
  return modello
    .replace(/%VENUE_NAME%/g, () => scappa(venue.venue_name))
    .replace(/%VENUE_TITOLARE%/g, () => titolare(venue))
    .replace(/%VENUE_EMAIL_LINK%/g, () => contatto(venue))
    .replace(/%VENUE_THEME_COLOR%/g, () => scappa(venue.venue_theme_color || COLORE_DI_PARTENZA))
}

// ── LA CONFIGURAZIONE DENTRO LA PAGINA (REQ-FLOTTA-034) ───────────────
//
// Lo stesso contenuto di configurazione.json, in un blocco che il browser
// non esegue e che l'app legge in modo sincrono (porte/configurazione.js,
// ID_BLOCCO). Dentro un `<script>` il testo finisce al primo `</script`:
// ogni `<` si scrive `\u003c`, che per JSON è lo stesso carattere.

export const bloccoConfigurazione = (config) =>
  `<script id="${ID_BLOCCO}" type="application/json">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>`

// index.html col blocco in fondo a <head>. Basta: l'app è uno script
// `type="module"`, che parte a pagina letta, quando il blocco c'è già. Un
// index.html che ha già un blocco non si tocca: vuol dire che è già stato
// personalizzato.
export function conConfigurazione(html, config) {
  if (html.includes(`id="${ID_BLOCCO}"`)) throw new Error('index.html ha già il blocco della configurazione: serve una copia del sito non personalizzata.')
  if (!html.includes('</head>')) throw new Error('index.html senza </head>: non è la pagina dell’app.')
  return html.replace('</head>', () => `    ${bloccoConfigurazione(config)}\n  </head>`)
}
