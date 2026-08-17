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
  // Dal 1.4.8 la risposta porta anche le FORME della famiglia (angoli,
  // fondo dei tasti, ombre): i colori del preset ci stanno dentro tutti,
  // ma non sono più tutto quello che c'è. Vedi tests/unit/temi.test.js.
  it('usa il preset richiesto', () => {
    const vars = resolveThemeVars({ preset: 'chiaro', custom: null })
    expect(vars).toMatchObject(THEME_PRESETS.chiaro.vars)
    expect(vars['--raggio-btn']).toBeTruthy()
  })

  it('fallback al default per preset sconosciuto o mancante', () => {
    const atteso = THEME_PRESETS[DEFAULT_THEME].vars
    expect(resolveThemeVars({ preset: 'boh' })).toMatchObject(atteso)
    expect(resolveThemeVars(null)).toMatchObject(atteso)
    expect(resolveThemeVars(undefined)).toMatchObject(atteso)
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
