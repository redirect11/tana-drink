'use strict'

// Unit test dei temi (src/lib/themes.js): risoluzione preset + override.

import { describe, it, expect } from 'vitest'
import {
  THEME_PRESETS,
  THEME_FIELDS,
  DEFAULT_THEME,
  resolveThemeVars,
} from '../../src/lib/themes.js'

describe('resolveThemeVars', () => {
  it('usa il preset richiesto', () => {
    const vars = resolveThemeVars({ preset: 'chiaro', custom: null })
    expect(vars).toEqual(THEME_PRESETS.chiaro.vars)
  })

  it('fallback al default per preset sconosciuto o mancante', () => {
    expect(resolveThemeVars({ preset: 'boh' })).toEqual(THEME_PRESETS[DEFAULT_THEME].vars)
    expect(resolveThemeVars(null)).toEqual(THEME_PRESETS[DEFAULT_THEME].vars)
    expect(resolveThemeVars(undefined)).toEqual(THEME_PRESETS[DEFAULT_THEME].vars)
  })

  it('gli override custom vincono sul preset', () => {
    const vars = resolveThemeVars({
      preset: 'tana-scuro',
      custom: { '--accent': '#00ff00' },
    })
    expect(vars['--accent']).toBe('#00ff00')
    expect(vars['--bg']).toBe(THEME_PRESETS['tana-scuro'].vars['--bg'])
  })

  it('ignora chiavi custom non previste', () => {
    const vars = resolveThemeVars({
      preset: 'tana-scuro',
      custom: { '--evil': 'red' },
    })
    expect(vars['--evil']).toBeUndefined()
  })

  it('ogni preset definisce tutti i campi personalizzabili', () => {
    for (const p of Object.values(THEME_PRESETS)) {
      for (const f of THEME_FIELDS) {
        expect(p.vars[f.key], `${p.label} manca ${f.key}`).toBeTruthy()
      }
    }
  })
})
