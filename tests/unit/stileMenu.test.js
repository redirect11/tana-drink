'use strict'

// LO STILE DEL MENÙ DEI CLIENTI (REQ-MENU-021): «ovviamente il tema base
// lascialo». Senza scelta, o con una scelta che non esiste più, è il
// classico.

import { describe, it, expect } from 'vitest'
import { STILI_MENU, STILE_PREDEFINITO, stileMenu } from '../../src/lib/stileMenu.js'

describe('lo stile del menù', () => {
  it('il classico è il predefinito', () => {
    expect(STILE_PREDEFINITO).toBe('classico')
    expect(stileMenu({})).toBe('classico')
    expect(stileMenu(null)).toBe('classico')
    expect(stileMenu({ stile_menu: 'inesistente' })).toBe('classico')
  })

  it('«Notte» si sceglie', () => {
    expect(stileMenu({ stile_menu: 'notte' })).toBe('notte')
  })

  it('ogni stile ha nome e descrizione da mostrare nelle impostazioni', () => {
    expect(STILI_MENU.map((s) => s.id)).toEqual(['classico', 'notte'])
    for (const s of STILI_MENU) {
      expect(s.nome).toBeTruthy()
      expect(s.desc).toBeTruthy()
    }
  })
})
