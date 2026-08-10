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
