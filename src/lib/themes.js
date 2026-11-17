// Temi dell'app: preset pronti (scuri e chiari) + personalizzazione dei
// colori principali, salvati nelle impostazioni (settings/bar) con scope
// separato per gestionale (theme_staff) e vista cliente (theme_client).
// I temi agiscono sulle variabili CSS di :root (index.css).

import { CLIENTE } from './venue.js'

// Campi personalizzabili: chiave CSS → etichetta mostrata nelle impostazioni.
export const THEME_FIELDS = [
  { key: '--bg', label: 'Sfondo' },
  { key: '--bg-2', label: 'Sfondo secondario' },
  { key: '--card', label: 'Card' },
  { key: '--accent', label: 'Colore accento' },
  { key: '--accent-2', label: 'Accento secondario' },
  { key: '--text', label: 'Testo' },
  { key: '--muted', label: 'Testo attenuato' },
]

// ── LE FORME, NON SOLO I COLORI ──────────────────────────────────────
//
// Un tema non è una tavolozza. Pico e Catppuccin hanno un MODO di fare le
// cose — quanto sono tondi gli angoli, se un bottone è una campitura piatta
// o un gradiente, se le superfici hanno un'ombra o un bordo — e prendendone
// solo i colori restava tutto con la faccia della Tana ridipinta: chi
// sceglieva «Pico» si aspettava il look documento e trovava i nostri tasti
// dorati con gli angoli morbidi.
//
// Sono pochi token apposta: sono quelli che si vedono da lontano. Ogni
// famiglia li dichiara TUTTI, perché applyTheme scrive sullo stile di
// :root e un token lasciato indietro resterebbe appiccicato al tema
// successivo (già successo con i bottoni, vedi sotto).
export const FORME = {
  // La Tana: angoli morbidi, gradiente sui tasti, titoli col serif del
  // locale. È il vestito di casa — i temi «chiaro» e «crema» sono la
  // stessa Tana con un altro contorno.
  tana: {
    '--raggio-card': '16px',
    '--raggio-btn': '12px',
    '--raggio-pill': '999px',
    '--raggio-campo': '10px',
    '--btn-bg': 'linear-gradient(135deg, var(--btn-1), var(--btn-2))',
    '--ombra-btn': '0 4px 14px color-mix(in srgb, var(--btn) 25%, transparent)',
    '--ombra-card': '0 4px 18px rgba(0, 0, 0, 0.25)',
    '--forma-titoli': "'Playfair Display', Georgia, 'Times New Roman', serif",
    // IL SEGNO DEL COLORE sulle card di una griglia: il nastro d'angolo di
    // casa, largo e squillante, oppure il pallino sobrio in alto a destra
    // (come le card del magazzino). Il nastro sta bene addosso alla Tana,
    // che è un locale, non un foglio di calcolo.
    '--segno-prodotto': 'nastro',
  },
  // Catppuccin: tondo ma contenuto, campiture piatte, niente aloni. La
  // palette è morbida di suo e il gradiente la sporcava.
  catppuccin: {
    '--raggio-card': '10px',
    '--raggio-btn': '8px',
    '--raggio-pill': '8px',
    '--raggio-campo': '8px',
    '--btn-bg': 'var(--btn)',
    '--ombra-btn': 'none',
    '--ombra-card': '0 2px 10px rgba(0, 0, 0, 0.18)',
    '--forma-titoli': 'inherit',
    // Catppuccin non è squadrato come Pico né sbandierato come la Tana:
    // un quadratino stondato, che è il suo modo di fare gli angoli.
    '--segno-prodotto': 'pastiglia',
  },
  // Pico CSS v2: il look «documento». Angoli appena smussati (0.25rem),
  // tasti piatti, nessuna ombra — la gerarchia la fanno i bordi e lo
  // spazio, non la profondità.
  pico: {
    '--raggio-card': '4px',
    '--raggio-btn': '4px',
    '--raggio-pill': '4px',
    '--raggio-campo': '4px',
    '--btn-bg': 'var(--btn)',
    '--ombra-btn': 'none',
    '--ombra-card': 'none',
    '--forma-titoli': 'inherit',
    // Pico è il look documento: una bandiera colorata larga mezza card
    // sarebbe la cosa più rumorosa della pagina.
    '--segno-prodotto': 'pallino',
  },
  // Lime - SmartOrders (REQ-UI-033): il vestito del prodotto, per i locali
  // che non hanno il loro, con le forme del sito e del backoffice della
  // regia (drink-regia DESIGN.md §4, 11/11/2026), perché il marchio è uno
  // solo: tasti a campitura piatta nel lime (il colore è il marchio, e un
  // gradiente lo sporcherebbe come sporcava Catppuccin), angoli da 14 e
  // 10px, ombre tenui, titoli in Playfair come il marchio della regia (nel
  // pacchetto dell'app, quindi anche senza rete).
  lime: {
    '--raggio-card': '14px',
    '--raggio-btn': '10px',
    '--raggio-pill': '999px',
    '--raggio-campo': '10px',
    '--btn-bg': 'var(--btn)',
    '--ombra-btn': 'none',
    '--ombra-card': '0 2px 12px rgba(0, 0, 0, 0.18)',
    '--forma-titoli': "'Playfair Display', Georgia, 'Times New Roman', serif",
    // Tondo come una fetta di lime.
    '--segno-prodotto': 'pallino',
  },
}

export const THEME_PRESETS = {
  'tana-scuro': {
    label: '🌑 Tana scuro',
    vars: {
      '--bg': '#0e0e15',
      '--bg-2': '#15151f',
      '--card': '#1a1a26',
      '--accent': '#e52e71',
      '--accent-2': '#f5b94a',
      '--text': '#f5f5f7',
      '--muted': '#9b9ba8',
    },
  },
  'notte-blu': {
    label: '🌌 Notte blu',
    vars: {
      '--bg': '#0a1220',
      '--bg-2': '#101a2c',
      '--card': '#152238',
      '--accent': '#3b82f6',
      '--accent-2': '#38bdf8',
      '--text': '#eef2f8',
      '--muted': '#8fa3bf',
    },
  },
  catppuccin: {
    forme: 'catppuccin',
    // Catppuccin Mocha (palette ufficiale): sobrio ma caldo, pensato per
    // il gestionale — base scura a tre livelli, malva come accento e
    // pesca per bottoni e gradienti. Vedi DESIGN.md.
    label: '🐈 Catppuccin scuro',
    vars: {
      '--bg': '#11111b',
      '--bg-2': '#181825',
      '--card': '#1e1e2e',
      '--accent': '#cba6f7',
      '--accent-2': '#fab387',
      '--text': '#cdd6f4',
      '--muted': '#a6adc8',
    },
  },
  'catppuccin-chiaro': {
    forme: 'catppuccin',
    // Catppuccin Latte, la gemella chiara di Mocha: stessi livelli
    // (crust → mantle → base), accenti più profondi perché sul chiaro
    // il contrasto va conquistato, non regalato.
    label: '🥛 Catppuccin chiaro',
    vars: {
      '--bg': '#dce0e8',
      '--bg-2': '#e6e9ef',
      '--card': '#eff1f5',
      '--accent': '#8839ef',
      '--accent-2': '#fe640b',
      // Il pesca di Latte va bene per i piccoli accenti, ma come fondo
      // dei bottoni satura troppo: per l'azione si usa il pesca pastello
      // di Mocha, che resta di famiglia ed è morbido anche in campitura.
      '--btn': '#fab387',
      '--text': '#4c4f69',
      '--muted': '#6c6f85',
    },
  },
  'pico-scuro': {
    forme: 'pico',
    // Palette di Pico CSS v2 (tema dark): ardesia blu e azzurro tecnico.
    // Non carichiamo il CSS di Pico — farebbe a botte col nostro — ne
    // adottiamo i colori dentro i nostri token. Vedi DESIGN.md.
    label: '🔷 Pico scuro',
    vars: {
      '--bg': '#13171f',
      '--bg-2': '#1a1f28',
      '--card': '#181c25',
      '--accent': '#01aaff',
      '--accent-2': '#01aaff',
      // Azzurro pastello per le campiture d'azione (testo scuro).
      '--btn': '#7cc4ea',
      '--text': '#c2c7d0',
      '--muted': '#7b8495',
    },
  },
  'pico-chiaro': {
    forme: 'pico',
    // Pico v2 chiaro: bianco piatto e blu petrolio, il look "documento".
    label: '💠 Pico chiaro',
    vars: {
      '--bg': '#fbfbfc',
      '--bg-2': '#ffffff',
      '--card': '#ffffff',
      '--accent': '#0172ad',
      '--accent-2': '#0172ad',
      '--btn': '#8cc9e9',
      '--text': '#373c44',
      '--muted': '#646b79',
    },
  },
  chiaro: {
    label: '☀️ Chiaro',
    vars: {
      '--bg': '#f2f2f7',
      '--bg-2': '#ffffff',
      '--card': '#ffffff',
      '--accent': '#c2185b',
      '--accent-2': '#a8790a',
      // L'accento-2 qui è scuro apposta (i link devono reggere sul
      // bianco): i bottoni restano l'oro di casa, che è lo stesso del tab
      // acceso — un tasto che cambia colore col tema di contorno si
      // riconosce meno, e il «+» della coda si prende di corsa.
      '--btn': '#f5b94a',
      '--text': '#17171f',
      '--muted': '#5c5c6b',
    },
  },
  crema: {
    label: '🥂 Crema',
    vars: {
      '--bg': '#f6f1e7',
      '--bg-2': '#fffaf0',
      '--card': '#fffdf7',
      '--accent': '#a3552b',
      '--accent-2': '#8c6d1f',
      // Come sopra: Crema è una variante della Tana, non un altro locale.
      '--btn': '#f5b94a',
      '--text': '#241d12',
      '--muted': '#6f6353',
    },
  },
  // LIME, IL TEMA DEL PRODOTTO (REQ-UI-033; Daniele, 15/11/2026). Lo scuro
  // è quello di partenza dei locali nuovi e della demo. I colori sono quelli
  // della regia (drink-regia src/index.css, «LA PALETTE LIME», 11/11/2026):
  // Daniele, 15/11: il sito li ha già, e l'app non deve averne di suoi. Un
  // nero appena verde a tre livelli, il lime pieno per i tasti e l'accento,
  // la sua versione chiara per il testo in colore; sopra il lime il verde
  // scurissimo della regia, non l'inchiostro bruno nato per l'oro.
  'lime-scuro': {
    forme: 'lime',
    label: '🌿 Lime scuro',
    vars: {
      '--bg': '#0c0f0a',
      '--bg-2': '#141911',
      '--card': '#1c2318',
      '--accent': '#b4ec2b',
      '--accent-2': '#c6f25a',
      '--btn': '#b4ec2b',
      '--btn-ink': '#16210a',
      '--accent-ink': '#16210a',
      '--text': '#eef2e6',
      '--muted': '#9aa38e',
    },
  },
  // Il chiaro, dalla versione chiara della regia: il lime sul bianco come
  // testo non si legge (1,4:1), quindi resta un riempimento — i tasti, col
  // verde scurissimo sopra (12:1) — e il testo in colore è il verde
  // profondo della regia, #2f6b0f (6,1:1 sul fondo).
  'lime-chiaro': {
    forme: 'lime',
    label: '🍃 Lime chiaro',
    vars: {
      '--bg': '#f7f9f1',
      '--bg-2': '#fefffa',
      '--card': '#fefffa',
      '--accent': '#2f6b0f',
      '--accent-2': '#2f6b0f',
      '--btn': '#b4ec2b',
      '--btn-ink': '#16210a',
      '--text': '#161b10',
      '--muted': '#525c47',
    },
  },
  // LE TAVOLOZZE CHE ARRIVANO CON UNO STILE (REQ-MENU-027). «Lavagna» e
  // «Meraviglie» si scelgono, dal marketplace, insieme ai loro colori; ma i
  // colori restano una tavolozza come le altre, e si cambiano (l'utente,
  // 05/11/2026: la tavolozza «sempre libera»). Fino alla 1.10.15 «Lavagna»
  // i colori li scriveva nel suo CSS, e il tema del menù non contava.
  lavagna: {
    label: '🖍️ Lavagna',
    vars: {
      '--bg': '#24332d',
      '--bg-2': '#1d2a25',
      '--card': '#2c3d36',
      '--accent': '#f3d27a',
      '--accent-2': '#f3d27a',
      '--btn': '#f3d27a',
      '--text': '#f2eee4',
      // Il gesso al 66% sull'ardesia, in tinta piena: i colori di una
      // tavolozza si modificano dal selettore, che vuole un esadecimale.
      '--muted': '#acaea6',
    },
  },
  // La carta di un libro dell'Ottocento: avorio, inchiostro, seppia, il
  // rosso della Regina di Cuori e un oro antico scuro abbastanza da
  // leggersi sull'avorio. Le forme sono quelle «documento» di Pico: angoli
  // appena smussati, tasti piatti, niente ombre — un libro non ha rilievi.
  meraviglie: {
    label: '🎩 Meraviglie',
    forme: 'pico',
    vars: {
      '--bg': '#f3ead6',
      '--bg-2': '#faf4e6',
      '--card': '#fdf8ec',
      '--accent': '#a8231c',
      '--accent-2': '#7d5d17',
      '--btn': '#a8231c',
      '--text': '#2a1f16',
      '--muted': '#6b5843',
    },
  },
}

// Il tema DI CASA: quello della Tana. Non è più per forza quello con cui
// parte un locale (sotto): resta il riferimento dei temi del catalogo che
// ne descrivono i colori («Classico»: notte scura, rosa e oro).
export const DEFAULT_THEME = 'tana-scuro'

// IL TEMA DI PARTENZA (REQ-UI-033). La Tana parte dal suo; la demo e i
// locali che genera la regia da Lime, il tema del prodotto: la demo che si
// mostra a un locale nuovo aveva il rosa e l'oro della Tana (UR-014). Si
// decide dal cliente della build; senza cliente la build è la Tana.
export const temaDiPartenza = (cliente = CLIENTE) => (!cliente || cliente === 'tana' ? DEFAULT_THEME : 'lime-scuro')
export const TEMA_DI_PARTENZA = temaDiPartenza()

// Un colore #rrggbb nei suoi tre canali, o null se non si legge: l'unico
// posto dove si legge un esadecimale.
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hexToRgba(hex, alpha) {
  const c = rgb(hex)
  return c ? `rgba(${c.join(',')},${alpha})` : `rgba(245,185,74,${alpha})`
}

// Risolve un'impostazione tema { preset, custom } nelle variabili CSS finali:
// parte dal preset (fallback al default) e applica gli override custom.
export function resolveThemeVars(setting) {
  const presetId = setting?.preset && THEME_PRESETS[setting.preset] ? setting.preset : TEMA_DI_PARTENZA
  const base = THEME_PRESETS[presetId].vars
  const custom = setting?.custom && typeof setting.custom === 'object' ? setting.custom : {}
  // Le forme della famiglia stanno SOTTO ai colori del preset: un preset
  // che volesse un raggio suo lo dichiara fra le sue vars e vince.
  const forme = FORME[THEME_PRESETS[presetId].forme || 'tana']
  const vars = { ...forme, ...base }
  for (const f of THEME_FIELDS) {
    if (custom[f.key]) vars[f.key] = custom[f.key]
  }
  return vars
}

// L'oro dei bottoni del tema di casa: quando è questo, il gradiente resta
// quello scritto nel CSS (identico alla produzione) invece di essere
// ricalcolato — ricalcolandolo veniva più smorto.
const ORO_DI_CASA = '#f5b94a'

// Applica le variabili al documento (e deriva il gradiente dall'accento 2).
export function applyTheme(vars) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  // Il colore-azione dei bottoni va SEMPRE riscritto: se il preset non lo
  // dichiara, torna all'accento-2 — altrimenti cambiando tema resterebbe
  // appiccicato quello del preset precedente.
  const btn = vars['--btn'] || vars['--accent-2'] || ''
  if (!vars['--btn']) root.style.setProperty('--btn', btn)
  // I DUE ESTREMI DEL GRADIENTE DEI BOTTONI. Sul tema di casa restano
  // quelli di sempre — l'oro che al banco si riconosce senza guardare, lo
  // stesso che c'è in produzione — e li lascia stare il CSS. Su un tema
  // che cambia i bottoni si derivano dal suo colore: schiarito da una
  // parte, scaldato dall'altra, come faceva il gradiente cablato.
  if (btn && btn.toLowerCase() !== ORO_DI_CASA) {
    root.style.setProperty('--btn-1', `color-mix(in srgb, ${btn} 92%, #fff)`)
    root.style.setProperty('--btn-2', `color-mix(in srgb, ${btn} 88%, #241500)`)
  } else {
    root.style.removeProperty('--btn-1')
    root.style.removeProperty('--btn-2')
  }
  // L'INCHIOSTRO SUL TASTO. Era cablato scuro (#1c1305, che è nato per
  // l'oro): su un tema con l'azione scura sarebbe nero su nero. Si decide
  // dal colore del tasto, non dal tema.
  // Un preset può dichiarare il suo (Lime: il verde scurissimo della regia).
  root.style.setProperty('--btn-ink', vars['--btn-ink'] || inchiostroSopra(btn))
  // Lo stesso sopra l'accento pieno (il segno «staff», il numero sulla
  // campanella): era bianco fisso, e sul lime stava a 1,5:1 (dal revisore,
  // REQ-UI-033). Sul rosa della Tana resta bianco.
  const inchiostroAccento = vars['--accent-ink'] || inchiostroSopra(vars['--accent'])
  root.style.setProperty('--accent-ink', inchiostroAccento)
  // E IL FONDO SOTTO QUELL'INCHIOSTRO, quando l'accento da solo non regge
  // 4,5:1 (REQ-UI-036): accentoPieno lo scurisce, o lo schiarisce, quanto
  // basta. Sul lime non cambia niente.
  root.style.setProperty('--accent-pieno', accentoPieno(vars['--accent'], inchiostroAccento))
  const a2 = vars['--accent-2']
  if (a2) {
    root.style.setProperty(
      '--grad',
      `linear-gradient(90deg, ${hexToRgba(a2, 0.9)}, ${hexToRgba(a2, 0.12)})`
    )
  }
  // Tema chiaro/scuro: guida i controlli nativi (color-scheme) e le varianti
  // CSS dei colori di stato (pill/badge), che altrimenti — pensati per lo
  // scuro — risulterebbero illeggibili sui temi chiari.
  // Il segno del colore sulle card (nastro o pallino) è una FORMA, e il CSS
  // deve poterci cambiare disegno sopra: una variabile non basta a scegliere
  // fra due geometrie, serve un aggancio nel selettore.
  root.dataset.segno = String(vars['--segno-prodotto'] || 'nastro').trim()
  const light = isLightColor(vars['--bg'])
  root.style.setProperty('color-scheme', light ? 'light' : 'dark')
  root.dataset.luma = light ? 'light' : 'dark'
}

// ── IL CONTRASTO, COME LO MISURA WCAG (REQ-UI-036) ────────────────────
// La luminanza relativa e il rapporto fra due colori (1:1 – 21:1), con la
// formula di WCAG 2.x: è quella che usa axe, quindi un numero qui è lo
// stesso che la prova di accessibilità misura sulla pagina.
const lineare = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
export function luminanza(hex) {
  const c = rgb(hex)
  return c ? 0.2126 * lineare(c[0]) + 0.7152 * lineare(c[1]) + 0.0722 * lineare(c[2]) : null
}
export function contrasto(a, b) {
  const la = luminanza(a)
  const lb = luminanza(b)
  if (la == null || lb == null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
const mescola = (hex, verso, quanto) =>
  `#${rgb(hex)
    .map((c) => Math.round(c + (verso - c) * quanto).toString(16).padStart(2, '0'))
    .join('')}`

// L'ACCENTO PIENO SOTTO UN TESTO (REQ-UI-036, WCAG 1.4.3). Il rosa della
// Tana (#e52e71) col bianco sopra sta a 4,2:1, e col bruno a 4,35:1: la
// categoria scelta nel conto e il segno «staff» non arrivavano a 4,5. Qui
// l'accento si scurisce (sotto un inchiostro chiaro) o si schiarisce (sotto
// uno scuro) a piccoli passi, finché il testo si legge. Un accento che regge
// già, come il lime col suo inchiostro, resta com'è.
export function accentoPieno(accento, inchiostro, soglia = 4.5) {
  const li = luminanza(inchiostro)
  if (luminanza(accento) == null || li == null) return accento
  const verso = li > 0.5 ? 0 : 255
  let c = accento.startsWith('#') ? accento : `#${accento}`
  for (let i = 0; i < 40 && contrasto(c, inchiostro) < soglia; i++) c = mescola(c, verso, 0.04)
  return c
}

// Un colore esadecimale è "chiaro"? (luminanza percepita > 0.6)
export function isLightColor(hex) {
  const c = rgb(hex)
  return c ? (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.6 : false
}

// L'inchiostro di partenza sopra un colore pieno: scuro su uno chiaro,
// bianco su uno scuro. Una regola sola per i tasti (`--btn-ink`) e per
// l'accento (`--accent-ink`); un preset può dichiarare il suo.
export const inchiostroSopra = (colore) => (isLightColor(colore) ? '#1c1305' : '#ffffff')
