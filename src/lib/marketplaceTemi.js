// ── IL MARKETPLACE DEI TEMI (REQ-MENU-023) ─────────────────────────────
//
// L'utente, 02/11/2026: «Dobbiamo fare una sezione marketplace per i temi
// in aspetto. È una pagina che carica tutti i temi disponibili. Serve un
// posto dove pubblicarne di nuovi», e «il tema quindi è composto da
// tavolozze e stile. Si possono vendere/uppare/scaricare/acquistare temi che
// miscelano tavolozze e stili. Per ora tutto gratis tra quelli che già
// abbiamo». Li pubblica solo il fornitore, dalla regia.
//
// UN TEMA È UNA RICETTA, NON CODICE («descrittivo», scelto dall'utente lo
// stesso giorno): una tavolozza (una delle basi dell'app più, se serve,
// i sette colori di THEME_FIELDS) e uno degli stili del menù che l'app sa
// già disegnare. Non può rompere il menù né la cassa, e funziona senza
// rete. Una forma davvero nuova è uno stile, e arriva con l'app.
//
//   { id, nome, descrizione, prezzo: 0,
//     tavolozza: { base: 'notte-blu', colori: { '--accent': '#d4af37' } },
//     stile: 'deco' }
//
// DA DOVE ARRIVANO: il catalogo iniziale qui sotto, nell'app, composto da
// quello che c'era già; e quello che la regia pubblica, letto all'apertura
// del marketplace (mai a tempo) e ricordato sul dispositivo. Un tema della
// regia con lo stesso id sostituisce quello iniziale. Il contratto per la
// regia è in docs/marketplace-temi.md, e questa è la fonte della verità:
// `leggiTema` decide che cosa è un tema.
//
// INSTALLATO, UN TEMA SE NE PORTA UNA COPIA nelle impostazioni del locale
// (`temi_installati`): il menù non dipende dal catalogo, né dalla rete.
// «Usa» scrive la tavolozza nei colori del menù dei clienti
// (`theme_client`) e lo stile in `stile_menu` (installandolo, se è uno
// stile gratis). I colori del gestionale non si toccano: lì si lavora.

import { THEME_PRESETS, THEME_FIELDS, DEFAULT_THEME } from './themes.js'
import { STILI_MENU, stileProvabile, patchInstalla as installaStile } from './stileMenu.js'
import { leggi, scrivi } from './impostazioniLocali.js'
import { PROGETTI_REGIA } from './aggiornamenti.js'

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/
const COLORE = /^#[0-9a-f]{6}$/i
const CHIAVI_COLORE = THEME_FIELDS.map((f) => f.key)
const stringa = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// Un tema com'è scritto (dal catalogo, dalla regia, dalle impostazioni) →
// il tema da usare, o null se non è un tema che questa app sa disegnare.
// Uno stile che l'app non conosce (arriverà con una versione dopo) o una
// base che non c'è lo scartano: meglio non mostrarlo che disegnarlo male.
export function leggiTema(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const id = typeof v.id === 'string' && SLUG.test(v.id) ? v.id : null
  const nome = stringa(v.nome, 40)
  const t = v.tavolozza
  if (!id || !nome || !t || typeof t !== 'object') return null
  if (!Object.hasOwn(THEME_PRESETS, t.base)) return null
  const stile = STILI_MENU.find((s) => s.id === v.stile)
  if (!stile) return null
  const colori = {}
  for (const [k, c] of Object.entries(t.colori && typeof t.colori === 'object' ? t.colori : {})) {
    if (CHIAVI_COLORE.includes(k) && COLORE.test(String(c))) colori[k] = c
  }
  const prezzo = Number.isFinite(Number(v.prezzo)) && Number(v.prezzo) > 0 ? Number(v.prezzo) : 0
  return {
    id,
    nome,
    descrizione: stringa(v.descrizione, 240) || '',
    prezzo,
    tavolozza: { base: t.base, colori },
    stile: stile.id,
  }
}

// IL CATALOGO INIZIALE: quello che si compone con le tavolozze e gli stili
// che l'app ha già, tutto gratis («per ora tutto gratis tra quelli che già
// abbiamo»). «Notte» c'è solo dove la licenza lo dà: è un esclusivo.
// Nessun nome di locale qui: questo catalogo arriva a tutti (marchio.test).
export const CATALOGO_INIZIALE = [
  {
    id: 'classico',
    nome: 'Classico',
    descrizione: 'Il menù di sempre, a card, coi colori di partenza: notte scura, rosa e oro.',
    tavolozza: { base: DEFAULT_THEME },
    stile: 'classico',
  },
  {
    id: 'lavagna',
    nome: 'Lavagna',
    descrizione: 'La lavagna del bistrot: gesso su ardesia verde, scritte a mano.',
    tavolozza: { base: DEFAULT_THEME },
    stile: 'lavagna',
  },
  {
    id: 'grand-hotel',
    nome: 'Grand Hotel',
    descrizione: 'Anni Venti sul blu di mezzanotte: maiuscole sottili, cornici e oro.',
    tavolozza: { base: 'notte-blu' },
    stile: 'deco',
  },
  {
    id: 'riviera',
    nome: 'Riviera',
    descrizione: 'Aperitivo all’aperto su un fondo crema: corsivi, strisce e disegni nei cerchi.',
    tavolozza: { base: 'crema' },
    stile: 'riviera',
  },
  {
    id: 'pastello',
    nome: 'Pastello',
    descrizione: 'Lo stile «Riviera» sui colori tenui di Catppuccin chiaro.',
    tavolozza: { base: 'catppuccin-chiaro' },
    stile: 'riviera',
  },
  {
    id: 'gazzetta',
    nome: 'Gazzetta',
    descrizione: 'La carta stampata, nero su bianco: testata, filetti e voci in colonna.',
    tavolozza: { base: 'chiaro' },
    stile: 'giornale',
  },
  {
    id: 'inchiostro',
    nome: 'Inchiostro',
    descrizione: 'Lo stile «Giornale» al rovescio: inchiostro chiaro su un fondo scuro.',
    tavolozza: { base: 'pico-scuro' },
    stile: 'giornale',
  },
  {
    id: 'notte',
    nome: 'Notte',
    descrizione: 'La carta stampata al buio, con gli Special a tutto schermo. Esclusivo.',
    tavolozza: { base: DEFAULT_THEME },
    stile: 'notte',
  },
]
  .map(leggiTema)
  .filter(Boolean)

// ── IL CATALOGO DELLA REGIA ──────────────────────────────────────────
// Si legge all'apertura del marketplace, dalla regia scritta nella build
// (VITE_REGIA_PROGETTO, solo i due progetti della regia, come la
// presentazione), e si ricorda: senza rete si vede l'ultimo letto.
const CHIAVE_CATALOGO = 'drink:catalogo-temi'
const REGIONE = 'europe-west1'

export function urlCatalogo(progetto = import.meta.env?.VITE_REGIA_PROGETTO) {
  return PROGETTI_REGIA.includes(progetto) ? `https://${REGIONE}-${progetto}.cloudfunctions.net/catalogoTemi` : null
}

export const catalogoRicordato = () => leggi(CHIAVE_CATALOGO, (s) => leggiCatalogo(JSON.parse(s)), [])
export const ricordaCatalogo = (temi) => scrivi(CHIAVE_CATALOGO, temi)

// La risposta della regia, `{ temi: [...] }`, nei temi da usare.
export function leggiCatalogo(corpo) {
  const temi = Array.isArray(corpo) ? corpo : Array.isArray(corpo?.temi) ? corpo.temi : []
  return temi.map(leggiTema).filter(Boolean)
}

// Il catalogo da mostrare: quello iniziale, con sopra quello della regia
// (lo stesso id lo sostituisce), senza i temi che questo locale non può
// usare (uno stile esclusivo che non ha) né, per ora, quelli a pagamento:
// «Compra» non c'è ancora (REQ-LIC-011).
export function catalogo(settings, daRegia = []) {
  const perId = new Map(CATALOGO_INIZIALE.map((t) => [t.id, t]))
  for (const t of daRegia) perId.set(t.id, t)
  return [...perId.values()].filter((t) => t.prezzo === 0 && stileProvabile(settings, t.stile))
}

// ── I TEMI DEL LOCALE ────────────────────────────────────────────────
export function temiInstallati(settings) {
  const v = Array.isArray(settings?.temi_installati) ? settings.temi_installati : []
  return v.map(leggiTema).filter(Boolean)
}

export const temaInUso = (settings) => (typeof settings?.tema_menu === 'string' ? settings.tema_menu : null)

// Un tema per id: prima quelli installati (la copia del locale), poi il
// catalogo. Serve alla prova sul menù.
export function temaPerId(settings, id, daRegia = catalogoRicordato()) {
  return temiInstallati(settings).find((t) => t.id === id) || catalogo(settings, daRegia).find((t) => t.id === id) || null
}

// I colori di un tema, nella forma di `theme_client`.
export const temaComeColori = (t) => ({
  preset: t.tavolozza.base,
  custom: Object.keys(t.tavolozza.colori).length ? { ...t.tavolozza.colori } : null,
})

export function patchInstallaTema(settings, tema) {
  const altri = temiInstallati(settings).filter((t) => t.id !== tema.id)
  return { temi_installati: [...altri, tema] }
}

// «Usa»: colori e stile del menù dei clienti, e lo stile installato se è
// uno di quelli gratis. Installa anche il tema, se non lo era.
export function patchUsaTema(settings, tema) {
  const patch = {
    ...patchInstallaTema(settings, tema),
    theme_client: temaComeColori(tema),
    stile_menu: tema.stile,
    tema_menu: tema.id,
  }
  const stile = installaStile(settings, tema.stile)
  if (stile) patch.stili_installati = stile.stili_installati
  return patch
}

// Disinstallare un tema toglie la copia; i colori e lo stile restano quelli
// in uso finché non se ne sceglie un altro (non c'è un «prima» a cui
// tornare che sia meglio di quello che il locale vede adesso).
export function patchDisinstallaTema(settings, id) {
  const patch = { temi_installati: temiInstallati(settings).filter((t) => t.id !== id) }
  if (temaInUso(settings) === id) patch.tema_menu = null
  return patch
}

// Il catalogo della regia, letto adesso: i temi, o null se non si è letto
// (senza regia nella build, senza rete, una risposta che non è un
// catalogo). Venti secondi al massimo; si ricorda quello che arriva.
const ATTESA_MS = 20000
export async function scaricaCatalogo(url = urlCatalogo(), prendi = globalThis.fetch) {
  if (!url || typeof prendi !== 'function') return null
  const ferma = new AbortController()
  const timer = setTimeout(() => ferma.abort(), ATTESA_MS)
  try {
    const r = await prendi(url, { signal: ferma.signal })
    if (!r.ok) return null
    const temi = leggiCatalogo(await r.json())
    ricordaCatalogo(temi)
    return temi
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// LA PROVA SUL MENÙ: `?vista=cliente&tema=…` (da Aspetto → Marketplace)
// mostra a chi lavora il proprio menù con i colori e lo stile di un tema.
// La vede solo chi la apre. Null se non c'è un tema in prova.
export function temaInProva(settings, search) {
  const p = new URLSearchParams(search || '')
  if (p.get('vista') !== 'cliente') return null
  const id = p.get('tema')
  return id ? temaPerId(settings, id) : null
}
