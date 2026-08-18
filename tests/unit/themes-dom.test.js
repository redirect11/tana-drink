// @vitest-environment happy-dom
'use strict'

// applyTheme sul DOM: variabili, gradiente e marcatura chiaro/scuro
// (data-luma) che guida i colori di stato leggibili sui temi chiari.

import { describe, it, expect } from 'vitest'
import { applyTheme, resolveThemeVars, isLightColor, THEME_PRESETS } from '../../src/lib/themes.js'

describe('isLightColor', () => {
  it('riconosce fondi chiari e scuri', () => {
    expect(isLightColor('#f6f1e7')).toBe(true) // crema
    expect(isLightColor('#f2f2f7')).toBe(true) // chiaro
    expect(isLightColor('#0e0e15')).toBe(false) // tana scuro
    expect(isLightColor('#0a1220')).toBe(false) // notte blu
    expect(isLightColor('boh')).toBe(false)
  })
})

describe('applyTheme (DOM)', () => {
  it('tema chiaro → data-luma="light" (pill/badge leggibili)', () => {
    applyTheme(resolveThemeVars({ preset: 'chiaro' }))
    expect(document.documentElement.dataset.luma).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      THEME_PRESETS.chiaro.vars['--bg']
    )
  })
  it('tema scuro → data-luma="dark"', () => {
    applyTheme(resolveThemeVars({ preset: 'tana-scuro' }))
    expect(document.documentElement.dataset.luma).toBe('dark')
  })
  it('override custom applicati alle variabili', () => {
    applyTheme(resolveThemeVars({ preset: 'tana-scuro', custom: { '--accent': '#123456' } }))
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456')
  })
})

// L'ORO DEI BOTTONI. Derivarlo dall'accento con due mescole lo rendeva più
// smorto di quello di sempre — l'estremo scuro passava da #e8a32e a
// #d5a03f, e al banco si vede. Sul tema di casa il gradiente resta quello
// scritto nel CSS; su un tema che cambia i bottoni si ricalcola, o sarebbe
// dorato su un preset che dorato non è.
describe('il gradiente dei bottoni', () => {
  const root = () => document.documentElement

  it('sul tema di casa non lo tocca: resta quello del CSS', () => {
    applyTheme(resolveThemeVars({ preset: 'tana-scuro' }))
    expect(root().style.getPropertyValue('--btn-1')).toBe('')
    expect(root().style.getPropertyValue('--btn-2')).toBe('')
  })

  it('anche sulle varianti di casa (chiaro, crema) resta quello', () => {
    // Sono la stessa Tana con un altro contorno: un tasto che cambia
    // colore col tema si riconosce meno, e il «+» si prende di corsa.
    for (const preset of ['chiaro', 'crema']) {
      applyTheme(resolveThemeVars({ preset }))
      expect(root().style.getPropertyValue('--btn-1')).toBe('')
    }
  })

  it('su un tema con bottoni suoi lo ricalcola da quel colore', () => {
    applyTheme(resolveThemeVars({ preset: 'catppuccin-chiaro' }))
    expect(root().style.getPropertyValue('--btn-1')).toContain('#fab387')
  })

  it('tornando al tema di casa il gradiente ricalcolato se ne va', () => {
    // Se restasse appiccicato, i bottoni terrebbero il colore del preset
    // di prima: è il difetto che aveva già morso con --btn.
    applyTheme(resolveThemeVars({ preset: 'catppuccin-chiaro' }))
    applyTheme(resolveThemeVars({ preset: 'tana-scuro' }))
    expect(root().style.getPropertyValue('--btn-1')).toBe('')
  })
})
