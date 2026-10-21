'use strict'

// IL CLIENTE (REQ-FLOTTA-003): lo slug dal nome del locale è il prefisso
// del progetto Firebase dell'istanza, quindi vale la regola dei project id.

import { describe, it, expect } from 'vitest'
import { slugDi, problemaSlug, nuovoCliente } from '../src/lib/clienti.js'

describe('slugDi', () => {
  it('minuscole, senza accenti, trattini', () => {
    expect(slugDi('La Tana del Coniglio')).toBe('la-tana-del-coniglio')
    expect(slugDi('  Caffè  Sant’Anna  ')).toBe('caffe-sant-anna')
    expect(slugDi('Bar 2000!!')).toBe('bar-2000')
  })

  it('non supera i 30 caratteri e non finisce con un trattino', () => {
    const lungo = slugDi('Un nome di locale davvero molto lungo per un bar')
    expect(lungo.length).toBeLessThanOrEqual(30)
    expect(lungo).not.toMatch(/-$/)
  })
})

describe('problemaSlug', () => {
  it('accetta uno slug buono e spiega quelli cattivi', () => {
    expect(problemaSlug('bar-mario')).toBeNull()
    expect(problemaSlug('')).toMatch(/nome/)
    expect(problemaSlug('bar')).toMatch(/corto/)
    expect(problemaSlug('1bar-mario')).toMatch(/lettera/)
    expect(problemaSlug('demo')).toMatch(/riservato|corto/)
  })
})

describe('nuovoCliente', () => {
  it('nasce con slug, email pulita e data', () => {
    const c = nuovoCliente({ uid: 'u1', email: ' Mario@Example.IT ', nomeLocale: 'Bar Mario', adesso: new Date('2026-10-22T10:00:00Z') })
    expect(c).toEqual({
      uid: 'u1',
      email: 'mario@example.it',
      nome_locale: 'Bar Mario',
      slug: 'bar-mario',
      contatto: '',
      creato_il: '2026-10-22T10:00:00.000Z',
    })
  })

  it('con un nome che non dà uno slug valido si ferma', () => {
    expect(() => nuovoCliente({ uid: 'u1', email: 'a@b.it', nomeLocale: 'Bar' })).toThrow(/corto/)
  })
})
