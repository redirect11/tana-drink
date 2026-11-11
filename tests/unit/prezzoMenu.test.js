// IL PREZZO NEL MENÙ DEI CLIENTI (REQ-MENU-038). Flavio, 11/11/2026: «togliere
// il simbolo dell'euro dal menù dei clienti. Ci deve stare solo ed
// esclusivamente il numero. Non ci deve stare neanche 0,00. Cioè è 8 euro, 8.
// 3,50 euro, 3,5». Daniele: è un'impostazione del locale, con quello di
// Flavio come valore di partenza. Tre formati, e basta.

import { describe, it, expect } from 'vitest'
import { prezzoInMenu, formatoPrezziMenu, FORMATI_PREZZO_MENU } from '../../src/lib/prezzoMenu.js'
import { formatPrice } from '../../src/lib/orderStatus.js'

describe('il formato di partenza: il numero', () => {
  it('8 euro è «8», 3,50 è «3,5»: niente simbolo, niente decimali inutili', () => {
    expect(prezzoInMenu(8)).toBe('8')
    expect(prezzoInMenu(3.5)).toBe('3,5')
    expect(prezzoInMenu(10)).toBe('10')
  })

  // Daniele, 11/11/2026, alla domanda su un prezzo come 3,25: «va bene».
  it('i centesimi che ci sono restano: 3,25 è «3,25»', () => {
    expect(prezzoInMenu(3.25)).toBe('3,25')
    expect(prezzoInMenu(0.5)).toBe('0,5')
  })

  it('un prezzo scritto male o mancante non rompe il menù', () => {
    expect(prezzoInMenu(undefined)).toBe('0')
    expect(prezzoInMenu('7.50')).toBe('7,5')
    // I conti in virgola mobile non lasciano code: 0,1 + 0,2.
    expect(prezzoInMenu(0.1 + 0.2)).toBe('0,3')
  })

  it('mai il simbolo dell’euro', () => {
    for (const v of [8, 3.5, 3.25, 120, 1250]) expect(prezzoInMenu(v)).not.toMatch(/€/)
  })
})

describe('gli altri due formati', () => {
  it('«centesimi»: senza simbolo, ma con due decimali quando servono', () => {
    expect(prezzoInMenu(8, 'centesimi')).toBe('8')
    expect(prezzoInMenu(3.5, 'centesimi')).toBe('3,50')
    expect(prezzoInMenu(3.25, 'centesimi')).toBe('3,25')
  })

  it('«valuta»: com’era prima, uguale al resto dell’app', () => {
    expect(prezzoInMenu(8, 'valuta')).toBe(formatPrice(8))
    expect(prezzoInMenu(3.5, 'valuta')).toBe(formatPrice(3.5))
    expect(prezzoInMenu(8, 'valuta')).toMatch(/€/)
  })
})

describe('quale formato vale per il locale', () => {
  it('senza una scelta, e con una scelta che non esiste, è «numero»', () => {
    expect(formatoPrezziMenu({})).toBe('numero')
    expect(formatoPrezziMenu(null)).toBe('numero')
    expect(formatoPrezziMenu({ formato_prezzi_menu: 'dollari' })).toBe('numero')
  })

  it('la scelta del locale, quando è una delle tre', () => {
    expect(FORMATI_PREZZO_MENU.map((f) => f.id)).toEqual(['numero', 'centesimi', 'valuta'])
    for (const f of FORMATI_PREZZO_MENU) expect(formatoPrezziMenu({ formato_prezzi_menu: f.id })).toBe(f.id)
  })
})
