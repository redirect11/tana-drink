// Temi dell'app: preset pronti (scuri e chiari) + personalizzazione dei
// colori principali, salvati nelle impostazioni (settings/bar) con scope
// separato per gestionale (theme_staff) e vista cliente (theme_client).
// I temi agiscono sulle variabili CSS di :root (index.css).

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
  chiaro: {
    label: '☀️ Chiaro',
    vars: {
      '--bg': '#f2f2f7',
      '--bg-2': '#ffffff',
      '--card': '#ffffff',
      '--accent': '#c2185b',
      '--accent-2': '#a8790a',
      // L'accento-2 qui è scuro apposta (i link devono reggere sul
      // bianco): i bottoni prendono l'oro chiaro di sempre da --btn.
      '--btn': '#f0b83f',
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
      '--btn': '#e2b04a',
      '--text': '#241d12',
      '--muted': '#6f6353',
    },
  },
}

export const DEFAULT_THEME = 'tana-scuro'

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return `rgba(245,185,74,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// Risolve un'impostazione tema { preset, custom } nelle variabili CSS finali:
// parte dal preset (fallback al default) e applica gli override custom.
export function resolveThemeVars(setting) {
  const presetId = setting?.preset && THEME_PRESETS[setting.preset] ? setting.preset : DEFAULT_THEME
  const base = THEME_PRESETS[presetId].vars
  const custom = setting?.custom && typeof setting.custom === 'object' ? setting.custom : {}
  const vars = { ...base }
  for (const f of THEME_FIELDS) {
    if (custom[f.key]) vars[f.key] = custom[f.key]
  }
  return vars
}

// Applica le variabili al documento (e deriva il gradiente dall'accento 2).
export function applyTheme(vars) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  // Il colore-azione dei bottoni va SEMPRE riscritto: se il preset non lo
  // dichiara, torna all'accento-2 — altrimenti cambiando tema resterebbe
  // appiccicato quello del preset precedente.
  if (!vars['--btn']) root.style.setProperty('--btn', vars['--accent-2'] || '')
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
  const light = isLightColor(vars['--bg'])
  root.style.setProperty('color-scheme', light ? 'light' : 'dark')
  root.dataset.luma = light ? 'light' : 'dark'
}

// Un colore esadecimale è "chiaro"? (luminanza percepita > 0.6)
export function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}
