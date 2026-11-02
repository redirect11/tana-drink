'use strict'

// LO STILE DEL MENÙ DEI CLIENTI (REQ-MENU-021): «ovviamente il tema base
// lascialo». Senza scelta, o con una scelta che non esiste più, è il
// classico.

import { describe, it, expect } from 'vitest'
import { STILI_MENU, STILE_PREDEFINITO, stileMenu, stiliDisponibili, temiInLicenza } from '../../src/lib/stileMenu.js'

describe('lo stile del menù', () => {
  it('il classico è il predefinito', () => {
    expect(STILE_PREDEFINITO).toBe('classico')
    expect(stileMenu({})).toBe('classico')
    expect(stileMenu(null)).toBe('classico')
    expect(stileMenu({ stile_menu: 'inesistente' })).toBe('classico')
  })

  // «Notte» è della licenza (REQ-LIC-010): l'utente, 02/11/2026, «sono
  // esclusive loro». Con `temi: ['notte']` si sceglie; senza, chi l'ha
  // scritto nelle impostazioni (anche dalla console) vede il classico.
  it('«Notte» si sceglie dove la licenza lo nomina', () => {
    expect(stileMenu({ stile_menu: 'notte', licenza: { moduli: {}, temi: ['notte'] } })).toBe('notte')
  })

  it('senza «Notte» nella licenza resta il classico', () => {
    expect(stileMenu({ stile_menu: 'notte' })).toBe('classico')
    expect(stileMenu({ stile_menu: 'notte', licenza: { moduli: {} } })).toBe('classico')
    expect(stileMenu({ stile_menu: 'notte', licenza: { moduli: {}, temi: 'notte' } })).toBe('classico')
  })

  it('gli stili disponibili: quelli di tutti, più quelli della licenza', () => {
    expect(stiliDisponibili({}).map((s) => s.id)).toEqual(['classico'])
    expect(stiliDisponibili({ licenza: { temi: ['notte'] } }).map((s) => s.id)).toEqual(['classico', 'notte'])
    expect(temiInLicenza({ licenza: { temi: ['notte', 3, null] } })).toEqual(['notte'])
  })

  it('ogni stile ha nome e descrizione da mostrare nelle impostazioni', () => {
    expect(STILI_MENU.map((s) => s.id)).toEqual(['classico', 'notte'])
    for (const s of STILI_MENU) {
      expect(s.nome).toBeTruthy()
      expect(s.desc).toBeTruthy()
    }
  })
})
