// @vitest-environment happy-dom
'use strict'

// UN TEMA NON È UNA TAVOLOZZA. Pico e Catppuccin hanno un modo di fare le
// cose — angoli, tasti, ombre — e prendendone solo i colori restava tutto
// con la faccia della Tana ridipinta: chi sceglieva «Pico» si aspettava il
// look documento e trovava i nostri tasti dorati con gli angoli morbidi.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  THEME_PRESETS,
  FORME,
  resolveThemeVars,
  applyTheme,
  isLightColor,
} from '../../src/lib/themes.js'

const leggi = (k) => document.documentElement.style.getPropertyValue(k)

beforeEach(() => {
  document.documentElement.style.cssText = ''
})

describe('le forme viaggiano col tema', () => {
  it('ogni famiglia dichiara TUTTI i token: nessuno resta appiccicato', () => {
    // applyTheme scrive sullo stile di :root: un token che una famiglia non
    // dichiara resterebbe quello del tema precedente. Già successo coi
    // bottoni, che restavano dorati cambiando preset.
    const chiavi = Object.keys(FORME.tana)
    for (const [nome, forma] of Object.entries(FORME)) {
      expect(Object.keys(forma).sort(), `forme «${nome}»`).toEqual(chiavi.sort())
    }
  })

  it('Pico è squadrato e piatto, la Tana tonda e col gradiente', () => {
    const pico = resolveThemeVars({ preset: 'pico-chiaro' })
    const tana = resolveThemeVars({ preset: 'tana-scuro' })
    expect(pico['--raggio-btn']).toBe('4px')
    expect(tana['--raggio-btn']).toBe('12px')
    expect(pico['--btn-bg']).toBe('var(--btn)') // campitura piatta
    expect(tana['--btn-bg']).toContain('linear-gradient')
    expect(pico['--ombra-card']).toBe('none')
  })

  it('Catppuccin sta in mezzo: tondo ma senza aloni', () => {
    const c = resolveThemeVars({ preset: 'catppuccin' })
    expect(c['--raggio-card']).toBe('10px')
    expect(c['--ombra-btn']).toBe('none')
  })

  it('i colori scelti a mano non toccano le forme', () => {
    // I campi personalizzabili sono solo colori: cambiando l'accento non si
    // deve poter storpiare la forma dei tasti.
    const v = resolveThemeVars({ preset: 'pico-chiaro', custom: { '--accent': '#ff0000' } })
    expect(v['--accent']).toBe('#ff0000')
    expect(v['--raggio-btn']).toBe('4px')
  })

  // IL SEGNO DEL COLORE sulle card di una griglia: nastro d'angolo o
  // pallino. Non è una variabile qualunque — il CSS ci cambia GEOMETRIA
  // sopra, e per farlo serve un aggancio nel selettore (data-segno).
  it('ogni famiglia ha il suo segno: nastro, pastiglia, pallino', () => {
    expect(resolveThemeVars({ preset: 'crema' })['--segno-prodotto']).toBe('nastro')
    expect(resolveThemeVars({ preset: 'chiaro' })['--segno-prodotto']).toBe('nastro')
    expect(resolveThemeVars({ preset: 'catppuccin' })['--segno-prodotto']).toBe('pastiglia')
    expect(resolveThemeVars({ preset: 'pico-chiaro' })['--segno-prodotto']).toBe('pallino')
  })

  it('e il documento lo espone come data-segno, per il CSS', () => {
    applyTheme(resolveThemeVars({ preset: 'pico-scuro' }))
    expect(document.documentElement.dataset.segno).toBe('pallino')
    applyTheme(resolveThemeVars({ preset: 'crema' }))
    expect(document.documentElement.dataset.segno).toBe('nastro')
  })

  it('cambiando tema le forme cambiano davvero sul documento', () => {
    applyTheme(resolveThemeVars({ preset: 'tana-scuro' }))
    expect(leggi('--raggio-btn')).toBe('12px')
    applyTheme(resolveThemeVars({ preset: 'pico-scuro' }))
    expect(leggi('--raggio-btn')).toBe('4px')
    expect(leggi('--ombra-card')).toBe('none')
  })
})

// L'INCHIOSTRO SUL TASTO era cablato scuro (#1c1305, nato per l'oro): su un
// tema con l'azione scura sarebbe stato nero su nero.
describe('il testo sul tasto si decide dal colore del tasto', () => {
  it('tasto chiaro → inchiostro scuro', () => {
    applyTheme(resolveThemeVars({ preset: 'tana-scuro' })) // oro
    expect(leggi('--btn-ink')).toBe('#1c1305')
  })

  it('tasto scuro → inchiostro bianco', () => {
    applyTheme({ '--btn': '#20305a', '--accent-2': '#20305a', '--bg': '#ffffff' })
    expect(leggi('--btn-ink')).toBe('#ffffff')
  })
})

describe('ogni preset regge la lettura', () => {
  it('dichiara i sette colori e una famiglia di forme valida', () => {
    for (const [id, preset] of Object.entries(THEME_PRESETS)) {
      for (const k of ['--bg', '--bg-2', '--card', '--accent', '--accent-2', '--text', '--muted']) {
        expect(preset.vars[k], `${id} ${k}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
      if (preset.forme) expect(FORME[preset.forme], `${id}`).toBeTruthy()
    }
  })

  it('il chiaro e lo scuro si riconoscono', () => {
    expect(isLightColor(THEME_PRESETS['pico-chiaro'].vars['--bg'])).toBe(true)
    expect(isLightColor(THEME_PRESETS['tana-scuro'].vars['--bg'])).toBe(false)
  })
})
