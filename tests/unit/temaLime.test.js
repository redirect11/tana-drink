// @vitest-environment happy-dom
'use strict'

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  THEME_PRESETS,
  resolveThemeVars,
  applyTheme,
  isLightColor,
  temaDiPartenza,
  TEMA_DI_PARTENZA,
  DEFAULT_THEME,
} from '../../src/lib/themes.js'

const leggi = (k) => document.documentElement.style.getPropertyValue(k)

beforeEach(() => {
  document.documentElement.style.cssText = ''
})

// ── LIME, IL TEMA DEL PRODOTTO (REQ-UI-033) ──────────────────────────
//
// Daniele, 15/11/2026: «dobbiamo fare il tema lime di Lime SmartOrders».
// Tavolozza e forme, scuro e chiaro, e di partenza per la demo e i locali
// nuovi: la demo che si mostrava a un locale nuovo aveva il rosa e l'oro
// della Tana (UR-014). La Tana resta col suo.
describe('il tema Lime', () => {
  // Il rapporto di contrasto WCAG, come lo misura DESIGN.md.
  const luce = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
  }
  const contrasto = (a, b) => {
    const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }

  it('ha le sue forme: tasti piatti, angoli tondi, il pallino sulle card', () => {
    for (const id of ['lime-scuro', 'lime-chiaro']) {
      const v = resolveThemeVars({ preset: id })
      expect(v['--btn-bg'], id).toBe('var(--btn)')
      expect(v['--ombra-btn'], id).toBe('none')
      expect(v['--raggio-btn'], id).toBe('10px')
      expect(v['--segno-prodotto'], id).toBe('pallino')
    }
    expect(isLightColor(THEME_PRESETS['lime-scuro'].vars['--bg'])).toBe(false)
    expect(isLightColor(THEME_PRESETS['lime-chiaro'].vars['--bg'])).toBe(true)
  })

  // DESIGN.md: 4,5:1 per il testo normale (testo, accento, link), 3:1 per
  // --muted, su tutti e tre i livelli di fondo.
  it.each(['lime-scuro', 'lime-chiaro'])('%s regge le soglie di contrasto su ogni fondo', (id) => {
    const v = THEME_PRESETS[id].vars
    for (const fondo of ['--bg', '--bg-2', '--card']) {
      for (const testo of ['--text', '--accent', '--accent-2']) {
        expect(contrasto(v[testo], v[fondo]), `${id} ${testo} su ${fondo}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrasto(v['--muted'], v[fondo]), `${id} --muted su ${fondo}`).toBeGreaterThanOrEqual(3)
    }
  })

  // Sopra il lime l'inchiostro della regia, #16210a, non quello bruno nato
  // per l'oro della Tana.
  it('il tasto lime prende l\'inchiostro della regia, ben leggibile', () => {
    for (const id of ['lime-scuro', 'lime-chiaro']) {
      applyTheme(resolveThemeVars({ preset: id }))
      expect(leggi('--btn-ink'), id).toBe('#16210a')
      expect(contrasto('#16210a', THEME_PRESETS[id].vars['--btn']), id).toBeGreaterThanOrEqual(4.5)
      expect(document.documentElement.dataset.segno).toBe('pallino')
    }
  })

  it('di partenza: la Tana col suo, la demo e i locali nuovi con Lime scuro', () => {
    expect(temaDiPartenza('tana')).toBe('tana-scuro')
    expect(temaDiPartenza(undefined)).toBe('tana-scuro') // senza cliente la build è la Tana
    expect(temaDiPartenza('demo')).toBe('lime-scuro')
    expect(temaDiPartenza('bar-mario')).toBe('lime-scuro')
    // Questa suite compila senza cliente: è la Tana, e non cambia niente.
    expect(TEMA_DI_PARTENZA).toBe('tana-scuro')
    expect(DEFAULT_THEME).toBe('tana-scuro')
  })

  // La build di un altro cliente, come la fa clienti/pluginCliente.js.
  it('compilata per la demo parte da Lime, ma il catalogo che descrive la Tana resta sui suoi colori', async () => {
    vi.stubGlobal('__CLIENTE__', { slug: 'demo', venue: {} })
    vi.resetModules()
    try {
      const temi = await import('../../src/lib/themes.js')
      expect(temi.TEMA_DI_PARTENZA).toBe('lime-scuro')
      expect(temi.resolveThemeVars(null)['--bg']).toBe(temi.THEME_PRESETS['lime-scuro'].vars['--bg'])
      const { CATALOGO_INIZIALE } = await import('../../src/lib/marketplaceTemi.js')
      const base = (id) => CATALOGO_INIZIALE.find((t) => t.id === id)?.tavolozza?.base
      // «Classico»: «coi colori di partenza: notte scura, rosa e oro».
      expect(base('classico')).toBe('tana-scuro')
    } finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })
})

// IL TEMA ARRIVA DAPPERTUTTO, gestionale e pagine del cliente (Daniele,
// 15/11/2026: «sia per vista cliente sia per il gestionale»). L'oro della
// Tana era scritto a mano in 24 punti del foglio — il tab al passaggio, la
// voce attiva della barra, la ricerca nel menù, la riga dell'attesa del
// cliente, il totale del riepilogo — e nel banner dei cookie, la prima
// cosa che vede un cliente: con Lime restavano dorati. Restano fissi solo
// i colori di STATO e di marchio: la pill «pagato», il bordo del conto
// pagato, la campanella che sincronizza, i raggi del riquadro Ceres.
describe('niente oro della Tana scritto a mano fuori dagli stati', () => {
  const ORO = /rgba\(\s*245\s*,\s*185\s*,\s*74\s*,|#f5b94a/i
  const AMMESSI = ['.pill.pagato', '.order-card.pagato', '.status-bell.syncing::after', '.news-ceres-rays']

  it('nel foglio l\'oro sta solo nei token e negli stati', async () => {
    const { readFileSync } = await import('node:fs')
    const righe = readFileSync('src/index.css', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(/\r?\n/)
    let selettore = ''
    const fuori = []
    for (const r of righe) {
      if (r.includes('{')) selettore = r.split('{')[0].trim()
      if (!ORO.test(r) || /^\s*--/.test(r)) continue
      // Un fallback dentro var(--x, #f5b94a) non dipinge niente da solo.
      if (/var\(--[\w-]+,\s*(#f5b94a|rgba\(245)/i.test(r)) continue
      if (!AMMESSI.includes(selettore)) fuori.push(`${selettore}: ${r.trim()}`)
    }
    expect(fuori).toEqual([])
  })

  it('il banner dei cookie e il conto di gruppo prendono i colori dal tema', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/lib/cookieConsent.js', 'utf8')).not.toMatch(/#[0-9a-f]{6}\b/i)
    expect(readFileSync('src/components/GroupView.jsx', 'utf8')).not.toMatch(ORO)
  })
})

// DAL REVISORE (15/11/2026): il segno «staff» sulla card, il numero sulla
// campanella, l'avviso di aggiornamento e gli estremi del periodo avevano
// il bianco fisso sull'accento pieno, e sul lime stava a 1,5:1. Ora usano
// --accent-ink, che applyTheme decide dal colore dell'accento.
describe('l\'inchiostro sopra l\'accento', () => {
  it('scuro sul lime, bianco sul rosa della Tana e sull\'oliva di Lime chiaro', () => {
    applyTheme(resolveThemeVars({ preset: 'lime-scuro' }))
    expect(leggi('--accent-ink')).toBe('#16210a')
    applyTheme(resolveThemeVars({ preset: 'lime-chiaro' }))
    expect(leggi('--accent-ink')).toBe('#ffffff')
    applyTheme(resolveThemeVars({ preset: 'tana-scuro' }))
    expect(leggi('--accent-ink')).toBe('#ffffff')
  })

  it('nel foglio nessun testo bianco fisso sull\'accento pieno', async () => {
    const { readFileSync } = await import('node:fs')
    const regole = readFileSync('src/index.css', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
    const bianche = regole.filter(
      (r) => /background:\s*var\(--accent[,)]/.test(r) && /(^|[;{\s])color:\s*(#fff\b|#ffffff\b|white\b)/i.test(r)
    )
    expect(bianche.map((r) => r.split('{')[0].trim())).toEqual([])
  })

  // BUG-166 (Daniele, 17/11/2026: «il bianco sul verde lime che abbiamo
  // scelto non è il massimo»): il foglio era a posto, ma due stili scritti
  // nei componenti avevano ancora il bianco fisso sull'accento — la
  // categoria scelta nel conto e il numero sulle card, 1,4:1 sul lime.
  it('anche negli stili dei componenti l\'accento pieno prende l\'inchiostro del tema', async () => {
    const { catBtnStyle } = await import('../../src/lib/posStyles.js')
    expect(catBtnStyle(true).color).toBe('var(--accent-ink, #fff)')
    expect(catBtnStyle(false).color).toBe('inherit')

    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const file = []
    const giro = (d) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n)
        if (statSync(p).isDirectory()) giro(p)
        else if (/\.(jsx?|tsx?)$/.test(n)) file.push(p)
      }
    }
    giro('src')
    // Uno sfondo d'accento seguito, entro un paio di righe, da un colore
    // bianco scritto a mano (anche dentro un ternario).
    const schema = /background:\s*'var\(--accent(-2)?[,)][^']*'[^\n]*\n?[^\n]*\n?[^\n]*color:\s*[^,\n]*'(#fff|#ffffff|white)'/
    const colpevoli = file.filter((f) => schema.test(readFileSync(f, 'utf8')))
    expect(colpevoli).toEqual([])
  })
})
