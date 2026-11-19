// ── CHE COSA PUÒ DIRE UNA CONFIGURAZIONE (REQ-FLOTTA-034) ─────────────
//
// La configurazione di un locale (`configurazione.json`, e lo stesso
// contenuto nel blocco `<script id="configurazione">` di index.html) la
// scrive la regia al deploy. Qui c'è la sola regola su cosa ammette, e la
// usano in due:
//   - l'app (src/porte/configurazione.js), che tiene quello che sa seguire e
//     lascia cadere il resto, perché all'avvio non si può fermare niente;
//   - personalizza.mjs, che al deploy RIFIUTA quello che l'app lascerebbe
//     cadere. Meglio che la regia scopra un errore pubblicando un locale che
//     il locale aprendo l'app.
// Una regola scritta in due posti finisce per dire due cose diverse: per
// questo è un modulo solo, `.mjs` e senza import, che gira uguale nel
// browser e in Node (anche dentro il pacchetto, dove non c'è il
// package.json del repository a dire che i `.js` sono moduli).
//
// IL FILE È PUBBLICO, e la copia ricordata nel dispositivo la può cambiare
// chi ha il dispositivo in mano: i filtri valgono per ogni fonte, non solo
// per il file appena scaricato.

export const BACKEND = ['firebase']

// L'id del blocco `<script type="application/json">` con la configurazione
// dentro index.html: lo scrive personalizza.mjs, lo legge l'app.
export const ID_BLOCCO = 'configurazione'

export const CAMPI_FIREBASE = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
  'measurementId',
  'recaptchaSiteKey',
  'vapidKey',
]

// Quelli senza cui un locale nel cloud non parte: la sessione e App Check
// sono legati ad `apiKey` e `appId` (R6 dell'analisi del 18/11/2026), e
// l'accesso passa da `authDomain`. L'app ne pretende solo due, perché
// l'immagine on premise ne ha bisogno di meno; personalizza.mjs tutti.
const FIREBASE_NECESSARI_AL_DEPLOY = ['apiKey', 'authDomain', 'projectId', 'appId']

// I due progetti della regia, per intero: un progetto qualunque in un file
// pubblico non diventa un indirizzo a cui l'app manda il token del titolare
// (il perché per esteso sta in src/lib/aggiornamenti.js, che li rilegge da
// qui).
export const PROGETTI_REGIA = ['drink-regia', 'drink-regia-test']

export const PROFILI = ['completo', 'leggero']

// Le chiavi `venue_*` dell'app: le stesse di VENUE_NEUTRO in
// src/lib/venue.js (un test controlla che restino uguali).
export const CAMPI_VENUE = [
  'venue_name',
  'venue_short_name',
  'venue_presso',
  'venue_tagline',
  'venue_about',
  'venue_city',
  'venue_email',
  'venue_email_domain',
  'venue_legal_name',
  'venue_address',
  'venue_postal_city',
  'venue_phone',
  'venue_vat_number',
  'venue_tax_code',
  'venue_legal_address',
  'venue_description',
  'venue_theme_color',
  'venue_socials',
]

export const SLUG_LOCALE = /^[a-z][a-z0-9-]{1,29}$/
const COLORE = /^#[0-9a-f]{6}$/i
const CAMPI_PRIMO_LIVELLO = ['backend', 'locale', 'firebase', 'venue', 'profilo', 'regia']

const oggetto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const stringaPiena = (v) => typeof v === 'string' && v.trim() !== ''

// UN LINK DEL LOCALE È SOLO UN LINK (REQ-SIC-017). I social si disegnano in
// `<a href>` nel piede del menù di ogni cliente, e `settings/bar` lo può
// scrivere anche il bartender: un `javascript:` diventava codice eseguito
// sul telefono di chi apre il menù. Passano i quattro schemi che un locale
// usa davvero; il resto, anche scritto in maiuscolo o con spazi davanti,
// no.
const SCHEMI_AMMESSI = ['http:', 'https:', 'mailto:', 'tel:']

export function linkSicuro(href) {
  if (typeof href !== 'string') return false
  const pulito = href.trim()
  if (!pulito) return false
  try {
    return SCHEMI_AMMESSI.includes(new URL(pulito).protocol)
  } catch {
    return false
  }
}

// I social come elenco di { piattaforma, href }, solo quelli coi link buoni.
export function socialSicuri(socials) {
  if (!Array.isArray(socials)) return []
  return socials
    .filter((s) => oggetto(s) && linkSicuro(s.href))
    .map((s) => ({ piattaforma: typeof s.piattaforma === 'string' ? s.piattaforma : 'link', href: s.href.trim() }))
}

// Il locale come l'app lo sa usare: solo le chiavi note, solo testi, i
// social filtrati. null se non resta niente.
export function filtraVenue(venue) {
  if (!oggetto(venue)) return null
  const out = {}
  for (const k of CAMPI_VENUE) {
    if (k === 'venue_socials') {
      if (Array.isArray(venue[k])) out[k] = socialSicuri(venue[k])
    } else if (typeof venue[k] === 'string') out[k] = venue[k]
  }
  return Object.keys(out).length ? out : null
}

// La configurazione come l'app la segue, o null se non la sa seguire (un
// backend che non ha, senza chiave o senza progetto). Quello che è fuori
// elenco diventa null: «vale la build».
export function leggiConfigurazione(v) {
  if (!oggetto(v) || !BACKEND.includes(v.backend)) return null
  const f = v.firebase
  if (!oggetto(f) || !stringaPiena(f.apiKey) || !stringaPiena(f.projectId)) return null
  const firebase = {}
  for (const k of CAMPI_FIREBASE) firebase[k] = typeof f[k] === 'string' ? f[k] : ''
  return {
    backend: v.backend,
    locale: stringaPiena(v.locale) ? v.locale : null,
    firebase,
    venue: filtraVenue(v.venue),
    profilo: PROFILI.includes(v.profilo) ? v.profilo : null,
    regia: PROGETTI_REGIA.includes(v.regia) ? v.regia : null,
  }
}

// AL DEPLOY: tutto quello che non va, in parole per chi pubblica. Vuoto
// vuol dire che la configurazione si può scrivere in un locale.
export function problemiConfigurazione(v) {
  if (!oggetto(v)) return ['la configurazione non è un oggetto JSON']
  const p = []
  for (const k of Object.keys(v)) if (!CAMPI_PRIMO_LIVELLO.includes(k)) p.push(`campo sconosciuto: ${k}`)
  if (!BACKEND.includes(v.backend)) p.push(`backend ${JSON.stringify(v.backend)} non previsto (ammessi: ${BACKEND.join(', ')})`)
  if (!(typeof v.locale === 'string' && SLUG_LOCALE.test(v.locale))) p.push('locale: serve lo slug del locale (minuscole, cifre e trattini, da 2 a 30 caratteri)')
  if (!oggetto(v.firebase)) p.push('manca firebase{}')
  else {
    for (const k of Object.keys(v.firebase)) if (!CAMPI_FIREBASE.includes(k)) p.push(`firebase: campo sconosciuto ${k}`)
    for (const k of CAMPI_FIREBASE) if (k in v.firebase && typeof v.firebase[k] !== 'string') p.push(`firebase.${k} deve essere un testo`)
    for (const k of FIREBASE_NECESSARI_AL_DEPLOY) if (!stringaPiena(v.firebase[k])) p.push(`firebase.${k} manca`)
  }
  if (!oggetto(v.venue)) p.push('manca venue{} con i dati del locale')
  else {
    for (const [k, val] of Object.entries(v.venue)) {
      if (!CAMPI_VENUE.includes(k)) p.push(`venue: campo sconosciuto ${k}`)
      else if (k === 'venue_socials') {
        if (!Array.isArray(val)) p.push('venue.venue_socials deve essere un elenco')
        else if (socialSicuri(val).length !== val.length) p.push('venue.venue_socials: ogni voce vuole un link http, https, mailto o tel')
      } else if (typeof val !== 'string') p.push(`venue.${k} deve essere un testo`)
    }
    if (!stringaPiena(v.venue.venue_name)) p.push('venue.venue_name manca')
    if ('venue_theme_color' in v.venue && !COLORE.test(v.venue.venue_theme_color)) p.push('venue.venue_theme_color deve essere un colore #rrggbb')
  }
  if ('profilo' in v && !PROFILI.includes(v.profilo)) p.push(`profilo ${JSON.stringify(v.profilo)} non previsto (ammessi: ${PROFILI.join(', ')})`)
  if ('regia' in v && !PROGETTI_REGIA.includes(v.regia)) p.push(`regia ${JSON.stringify(v.regia)} non prevista (ammesse: ${PROGETTI_REGIA.join(', ')})`)
  // Lo stesso controllo dell'app, per ultimo: se dice di no, c'è un buco qui
  // sopra, e meglio fermarsi lo stesso.
  if (p.length === 0 && !leggiConfigurazione(v)) p.push('l’app non seguirebbe questa configurazione')
  return p
}
